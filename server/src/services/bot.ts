import { Bot, webhookCallback, InlineKeyboard } from 'grammy';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { cancelJob } from './queue';
import { emitMatchUpdate } from './socket';

let bot: Bot | null = null;
const prisma = new PrismaClient();

// Track Telegram user IDs per match for later kick operations
// Key: matchId, Value: { challengerTgId, opponentTgId }
const roomMemberIds = new Map<string, { challengerTgId?: number; opponentTgId?: number }>();

// Deduplication: prevent processing the same join/leave event twice
// (both message:new_chat_members and chat_member can fire for the same event)
const recentlyProcessed = new Set<string>();
function dedup(key: string): boolean {
  if (recentlyProcessed.has(key)) return true;
  recentlyProcessed.add(key);
  setTimeout(() => recentlyProcessed.delete(key), 10000); // 10s window
  return false;
}

// =============================================
// Handle Player Join (called from both event types)
// =============================================
async function handlePlayerJoin(chatId: string, tgUserId: number, tgUsername: string, firstName: string) {
  const dedupKey = `join-${chatId}-${tgUserId}`;
  if (dedup(dedupKey)) {
    console.log(`[BOT] ⏭️ Skipping duplicate join for @${tgUsername} (ID: ${tgUserId}) in chat ${chatId}`);
    return;
  }

  console.log(`[BOT] 📥 Processing join event for @${tgUsername} (ID: ${tgUserId}) in chat ${chatId}`);
  const joinedUsername = tgUsername.toLowerCase();
  const displayName = tgUsername ? `@${tgUsername}` : firstName;
  const numericChatId = Number(chatId);

  // WHITELIST: Ignore group admins and creators immediately
  try {
    const memberInfo = await bot!.api.getChatMember(numericChatId, tgUserId);
    if (memberInfo.status === 'creator' || memberInfo.status === 'administrator') {
      console.log(`[BOT] ℹ️ Whitelist: Admin/creator @${joinedUsername} joined — ignoring completely`);
      return;
    }
  } catch (err) {
    console.error(`[BOT] Failed to check admin status for ${tgUserId}:`, err);
  }

  // Find the room + active match
  const room = await prisma.telegramRoom.findFirst({ where: { chat_id: chatId } });
  if (!room) {
    console.log(`[BOT] ❌ UNKNOWN ROOM: Join event in chat ${chatId} but this room is not in the database!`);
    return;
  }
  
  if (!room.current_match_id) {
    console.log(`[BOT] ℹ️ INACTIVE ROOM: Join event in chat ${chatId} but no active match is assigned to this room.`);
    return;
  }

  const match = await prisma.match.findUnique({
    where: { id: room.current_match_id },
    include: {
      challenger: { select: { id: true, telegram_username: true, username: true } },
      opponent: { select: { id: true, telegram_username: true, username: true } },
    },
  });
  if (!match) {
    console.log(`[BOT] ❌ MATCH NOT FOUND: Room ${chatId} claims to have match ${room.current_match_id} but it doesn't exist!`);
    return;
  }

  const kickUser = async (reason: string) => {
    console.log(`[BOT] 🚫 GATEKEEPER: ${displayName} — kicking. Reason: ${reason}`);
    try {
      await bot!.api.banChatMember(numericChatId, tgUserId, { revoke_messages: true });
      await bot!.api.unbanChatMember(numericChatId, tgUserId, { only_if_banned: true });
      await bot!.api.sendMessage(numericChatId, `🚫 Kicked unauthorized player ${displayName}.`);
      if (tgUsername) {
        const unauthorizedUserAt = await prisma.user.findFirst({
          where: { OR: [{ telegram_username: { equals: tgUsername, mode: 'insensitive' } }, { telegram_username: { equals: `@${tgUsername}`, mode: 'insensitive' } }] }
        });
        if (unauthorizedUserAt) {
          await prisma.notification.create({
            data: { user_id: unauthorizedUserAt.id, title: 'Match Room Access Denied', message: `You were kicked. Reason: ${reason}` }
          });
        }
      }
    } catch (kickErr) {
      console.error(`[BOT] Failed to kick ${displayName}:`, kickErr);
    }
  };
  const challengerTg = (match.challenger?.telegram_username || '').replace(/^@/, '').toLowerCase();
  const isChallengerJoining = challengerTg !== '' && joinedUsername === challengerTg;

  if (isChallengerJoining) {
    console.log(`[BOT] ✅ Challenger @${joinedUsername} (tgId: ${tgUserId}) joined room for match ${match.id}`);
    await cancelJob(`pending-join-${match.id}`);
    await prisma.match.update({ where: { id: match.id }, data: { challenger_joined: true } });
    const existing = roomMemberIds.get(match.id) || {};
    roomMemberIds.set(match.id, { ...existing, challengerTgId: tgUserId });
  } else if (match.opponent_id) {
    // SCENARIO C: Match already has an opponent assigned
    const opponentTg = (match.opponent?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const isOpponentJoining = opponentTg !== '' && joinedUsername === opponentTg;
    if (isOpponentJoining) {
      console.log(`[BOT] ✅ Opponent @${joinedUsername} (tgId: ${tgUserId}) joined room for match ${match.id}`);
      await prisma.match.update({ where: { id: match.id }, data: { opponent_joined: true, status: 'ACCEPTED' } });
      const existing = roomMemberIds.get(match.id) || {};
      roomMemberIds.set(match.id, { ...existing, opponentTgId: tgUserId });
    } else {
      await kickUser("This match already has an opponent assigned. It is currently a locked 1v1.");
      return;
    }
  } else {
    // SCENARIO B: No opponent assigned yet! This person wants to be the opponent.
    if (match.status === 'PENDING_JOIN') {
      await kickUser("The match creator has not fully joined yet. You cannot join before the creator.");
      return;
    }

    if (!joinedUsername) {
      await kickUser("You must have a Telegram Username configured to join matches.");
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegram_username: { equals: joinedUsername, mode: 'insensitive' } },
          { telegram_username: { equals: `@${joinedUsername}`, mode: 'insensitive' } }
        ]
      },
      include: { wallet: true }
    });

    if (!user) {
      await kickUser("You must register on the website and link your Telegram account first.");
      return;
    }

    // UPDATE: Save telegram_id if missing
    if (!user.telegram_id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { telegram_id: tgUserId.toString() }
      });
      console.log(`[BOT] 🆔 Linked Telegram ID ${tgUserId} to user ${user.username}`);
    }

    // Check if user is already in another live match
    const liveStatuses = ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'];
    const existingLive = await prisma.match.findFirst({
      where: {
        id: { not: match.id },
        OR: [
          { challenger_id: user.id, status: { in: liveStatuses } },
          { opponent_id: user.id, status: { in: liveStatuses } },
        ],
      },
    });

    if (existingLive) {
      // If it's just an open challenge, let them know to delete it first.
      if (existingLive.challenger_id === user.id && !existingLive.opponent_id) {
        await kickUser("You have an open challenge. Please delete it on the website before joining another match.");
      } else {
        await kickUser("You are already participating in another live match.");
      }
      return;
    }

    // Check balance
    const stakeAmount = Number(match.stake_amount);
    if (!user.wallet || Number(user.wallet.balance) < stakeAmount) {
      await kickUser(`Insufficient wallet balance to join this match. Required: ${stakeAmount} MMK.`);
      return;
    }

    // Assign Opponent and Freeze Funds
    const totalPot = stakeAmount * 2;
    const commission = totalPot * 0.05;

    try {
      await prisma.$transaction(async (tx: any) => {
        // Double check opponent_id is still null to avoid race conditions
        const currentMatch = await tx.match.findUnique({ where: { id: match.id } });
        if (currentMatch.opponent_id) {
          throw new Error('Already accepted');
        }

        await tx.wallet.update({
          where: { user_id: user.id },
          data: {
            balance: { decrement: stakeAmount },
            frozen_amount: { increment: stakeAmount },
          },
        });

        await tx.transaction.create({
          data: {
            wallet_id: user.wallet!.id,
            user_id: user.id,
            type: 'FREEZE',
            amount: stakeAmount,
            description: 'Stake frozen for accepted challenge (Joined Telegram)',
            match_id: match.id,
          },
        });

        await tx.match.update({
          where: { id: match.id },
          data: {
            opponent_id: user.id,
            total_pot: totalPot,
            commission,
            opponent_joined: true,
            status: 'READY_CHECK',
          },
        });
      });

      console.log(`[BOT] ✅ New Opponent @${joinedUsername} (tgId: ${tgUserId}) successfully assigned to match ${match.id}`);
      const existing = roomMemberIds.get(match.id) || {};
      roomMemberIds.set(match.id, { ...existing, opponentTgId: tgUserId });

      try {
        console.log(`[BOT] 📤 Sending READY_CHECK messages to chat ${numericChatId}`);
        const keyboard = new InlineKeyboard().text('🚀 READY TO START', 'ready_start');
        const joinMsg = [
          `👋 ${displayName} has entered the arena!`,
          `✅ <b>Press READY TO START</b>`,
        ].join('\n');
        await bot!.api.sendMessage(numericChatId, joinMsg, { parse_mode: 'HTML', reply_markup: keyboard });
        console.log(`[BOT] ✅ READY_CHECK messages sent successfully`);
        emitMatchUpdate(match.id, { status: 'READY_CHECK', matchId: match.id });
      } catch (msgErr) {
        console.error(`[BOT] ❌ Failed to send READY_CHECK messages:`, msgErr);
      }
      return;
    } catch (err: any) {
      if (err.message === 'Already accepted') {
        await kickUser("Someone else joined and claimed this match just before you!");
      } else {
        console.error(`[BOT] Failed to assign opponent to match:`, err);
        await kickUser("System error while assigning match. Please try again.");
      }
      return;
    }
  }

  // Re-fetch match to see current joined state
  const updatedMatch = await prisma.match.findUnique({ where: { id: match.id } });
  if (!updatedMatch) return;

  if (updatedMatch.challenger_joined && updatedMatch.opponent_joined) {
    // Both players are here, but they already got the READY_CHECK from the initial join.
    // If we reach here, it's a rejoin or a late sync.
    try {
      await bot!.api.sendMessage(numericChatId, `👋 Welcome back ${displayName}! Match status: <b>${updatedMatch.status}</b>`, { parse_mode: 'HTML' });
    } catch {}
  } else if (updatedMatch.challenger_joined && !updatedMatch.opponent_joined) {
    if (updatedMatch.status === 'PENDING_JOIN') {
      await prisma.match.update({ where: { id: match.id }, data: { status: 'ACTIVE' } });
    }
    try {
      console.log(`[BOT] 📤 Sending welcome message to challenger in chat ${numericChatId}`);
      const welcomeMsg = [
        `👋 Welcome ${displayName}!`,
        `⏳ <i>Waiting for an opponent to join...</i>`,
      ].join('\n');
      await bot!.api.sendMessage(numericChatId, welcomeMsg, { parse_mode: 'HTML' });
      console.log(`[BOT] ✅ Welcome message sent successfully`);
      emitMatchUpdate(match.id, { status: 'ACTIVE', matchId: match.id });
    } catch (msgErr) {
      console.error(`[BOT] ❌ Failed to send welcome message:`, msgErr);
    }
  } else if (!updatedMatch.challenger_joined && updatedMatch.opponent_joined) {
    try {
      const waitMsg = [
        `👋 Welcome ${displayName}!`,
        ``,
        `⏳ <i>Waiting for the challenger to join...</i>`,
      ].join('\n');
      await bot!.api.sendMessage(numericChatId, waitMsg, { parse_mode: 'HTML' });
    } catch {}
  }
}

// =============================================
// Handle Player Leave (called from both event types)
// =============================================
async function handlePlayerLeave(chatId: string, tgUserId: number, tgUsername: string) {
  const dedupKey = `leave-${chatId}-${tgUserId}`;
  if (dedup(dedupKey)) {
    console.log(`[BOT] ⏭️ Skipping duplicate leave for @${tgUsername} in ${chatId}`);
    return;
  }

  const leftUsername = tgUsername.toLowerCase();
  const numericChatId = Number(chatId);

  const room = await prisma.telegramRoom.findFirst({ where: { chat_id: chatId } });
  if (!room || !room.current_match_id) return;

  const match = await prisma.match.findUnique({
    where: { id: room.current_match_id },
    include: {
      challenger: { include: { wallet: true } },
      opponent: { include: { wallet: true } },
    },
  });
  if (!match) return;

  const challengerTg = (match.challenger?.telegram_username || '').replace(/^@/, '').toLowerCase();
  const opponentTg = (match.opponent?.telegram_username || '').replace(/^@/, '').toLowerCase();

  const isChallengerLeaving = challengerTg !== '' && leftUsername === challengerTg;
  const isOpponentLeaving = opponentTg !== '' && leftUsername === opponentTg;

  if (!isChallengerLeaving && !isOpponentLeaving) return;

  console.log(`[BOT] 🚨 Player @${leftUsername} left room ${chatId} for match ${match.id}`);

  // Case 1: Match is ACTIVE or PENDING_JOIN (no opponent yet) → auto-cancel
  if (['PENDING_JOIN', 'ACTIVE'].includes(match.status) && isChallengerLeaving) {
    console.log(`[BOT] 🗑️ Challenger left before opponent joined. Cancelling match.`);
    const stakeAmount = Number(match.stake_amount);
    const wallet = await prisma.wallet.findUnique({ where: { user_id: match.challenger_id } });
    if (wallet) {
      await prisma.$transaction(async (tx: any) => {
        await tx.wallet.update({ where: { user_id: match.challenger_id }, data: { balance: { increment: stakeAmount }, frozen_amount: { decrement: stakeAmount } } });
        await tx.transaction.create({ data: { wallet_id: wallet.id, user_id: match.challenger_id, type: 'RELEASE', amount: stakeAmount, description: 'Stake released — auto-cancelled (left room)', match_id: match.id } });
        await tx.match.update({ where: { id: match.id }, data: { status: 'CANCELLED' } });
        await tx.telegramRoom.update({ where: { id: room.id }, data: { status: 'AVAILABLE', current_match_id: null } });
      });
      await prisma.notification.create({ data: { user_id: match.challenger_id, title: 'Match Cancelled', message: 'Your challenge was auto-cancelled because you left the battle room.' } });
      try { await bot!.api.sendMessage(numericChatId, '🗑️ The challenger left the room. Match auto-cancelled.'); } catch {}
      await revokeInviteLinks(chatId, [match.challenger_invite_link, match.opponent_invite_link]);
      roomMemberIds.delete(match.id);

      // Clean up room messages
      try {
        await new Promise(r => setTimeout(r, 1500));
        await purgeRecentMessages(numericChatId);
      } catch (cleanupErr) {
        console.error(`[BOT] ❌ Failed to purge messages after cancel:`, cleanupErr);
      }
    }
  }

  // Case 2: Match is in progress → auto-forfeit
  else if (['ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'].includes(match.status)) {
    console.log(`[BOT] 🚨 Player @${leftUsername} left mid-match. Auto-forfeiting.`);
    const loserId = isChallengerLeaving ? match.challenger_id : match.opponent_id;
    const winnerId = isChallengerLeaving ? match.opponent_id : match.challenger_id;

    if (loserId && winnerId) {
      const winnerPayout = Number(match.total_pot) - Number(match.commission);
      const stakeAmount = Number(match.stake_amount);

      await prisma.$transaction(async (tx: any) => {
        await tx.match.update({ where: { id: match.id }, data: { status: 'COMPLETED', winner_id: winnerId, loser_id: loserId, completed_at: new Date() } });
        await tx.user.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } });
        await tx.user.update({ where: { id: loserId }, data: { losses: { increment: 1 } } });
        await tx.wallet.update({ where: { user_id: winnerId }, data: { balance: { increment: winnerPayout }, frozen_amount: { decrement: stakeAmount }, total_won: { increment: winnerPayout } } });
        await tx.wallet.update({ where: { user_id: loserId }, data: { frozen_amount: { decrement: stakeAmount }, total_lost: { increment: stakeAmount } } });
        await tx.platformRevenue.create({ data: { match_id: match.id, amount: Number(match.commission) } });

        const winnerWallet = isChallengerLeaving ? match.opponent?.wallet : match.challenger?.wallet;

        // RECORD TRANSACTIONS FOR ADMIN DASHBOARD
        if (winnerWallet) {
          await tx.transaction.create({
            data: {
              wallet_id: winnerWallet.id,
              user_id: winnerId,
              type: 'PAYOUT',
              amount: winnerPayout,
              description: `Match winnings by forfeit (Commission: ${Number(match.commission).toLocaleString()} MMK)`,
              match_id: match.id,
            }
          });

          await tx.transaction.create({
            data: {
              wallet_id: winnerWallet.id,
              user_id: winnerId,
              type: 'COMMISSION',
              amount: Number(match.commission),
              description: `Platform fee for forfeit match ${match.id.substring(0, 8)}`,
              match_id: match.id,
            }
          });
        }

        await tx.telegramRoom.update({ where: { id: room.id }, data: { status: 'AVAILABLE', current_match_id: null } });
      });

      await prisma.notification.create({ data: { user_id: winnerId, title: 'Victory by Forfeit! 🏆', message: 'Your opponent left the battle room. You win!' } });
      await prisma.notification.create({ data: { user_id: loserId, title: 'Match Forfeited 💀', message: 'You left the battle room mid-match. This is a forfeit and you lost.' } });

      try { await bot!.api.sendMessage(numericChatId, `🚨 @${leftUsername} fled the room!\n\nThis is treated as a <b>forfeit</b>. The remaining player wins the pot.`, { parse_mode: 'HTML' }); } catch {}

      await revokeInviteLinks(chatId, [match.challenger_invite_link, match.opponent_invite_link]);

      // Clean up room: kick winner, purge messages
      try {
        await new Promise(r => setTimeout(r, 2000));
        const tracked = roomMemberIds.get(match.id);
        if (tracked) {
          const winnerTgId = isChallengerLeaving ? tracked.opponentTgId : tracked.challengerTgId;
          if (winnerTgId) {
            console.log(`[BOT] Kicking winner (tgId: ${winnerTgId}) from room`);
            await bot!.api.banChatMember(numericChatId, winnerTgId, { revoke_messages: true });
            await bot!.api.unbanChatMember(numericChatId, winnerTgId, { only_if_banned: true });
          }
          roomMemberIds.delete(match.id);
        }
        await purgeRecentMessages(numericChatId);
      } catch (cleanupErr) {
        console.error(`[BOT] ❌ Failed to clean up room after forfeit:`, cleanupErr);
      }
    }
  }
}

export function createBot(): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn('[BOT] No TELEGRAM_BOT_TOKEN set — bot disabled');
    bot = new Bot('placeholder:token');
    return bot;
  }

  bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Global ID Linker Middleware
  bot.on('message', async (ctx, next) => {
    const tgUserId = ctx.from?.id?.toString();
    const username = ctx.from?.username;

    if (tgUserId && username) {
      console.log(`[BOT] 🔍 Global Linker: Checking @${username} (${tgUserId})`);
      try {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { telegram_username: { equals: username, mode: 'insensitive' } },
              { telegram_username: { equals: `@${username}`, mode: 'insensitive' } }
            ]
          }
        });

        if (user) {
          // If the ID is different from what we have, update it
          if (user.telegram_id !== tgUserId) {
            // Clear this ID from any other user first to maintain uniqueness
            await prisma.user.updateMany({ where: { telegram_id: tgUserId }, data: { telegram_id: null } });
            
            // Update the target user with the new ID
            await prisma.user.update({ where: { id: user.id }, data: { telegram_id: tgUserId } });
            console.log(`[BOT] 🆔 Re-linked/Updated ID ${tgUserId} for @${username}`);
          }
        }
      } catch (err) {
        console.warn('[BOT] Global Linker Error:', err);
      }
    }
    return next();
  });

  // Verify bot identity on startup
  bot.api.getMe().then(me => {
    console.log(`[BOT] 🤖 Bot authenticated successfully as @${me.username} (ID: ${me.id})`);
  }).catch(err => {
    console.error(`[BOT] ❌ FATAL: Could not authenticate with Telegram token. Check your environment variables!`, err);
  });

  // /start command
  bot.command('start', (ctx) => {
    const msg = [
      `┌─────────────────────────┐`,
      `│   👻 <b>GHOST REFEREE</b>    │`,
      `└─────────────────────────┘`,
      ``,
      `Automated MLBB Escrow &amp; Battle Management`,
      ``,
      `You'll be invited here when a match starts.`,
      `Fair play is enforced. Cheating = permanent ban.`,
    ].join('\n');
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // /noshow command
  bot.command('noshow', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    console.log(`[BOT] /noshow from @${ctx.from?.username} in chat ${chatId}`);
    const msg = [
      `╔══════════════════════════╗`,
      `║  ⚠️  <b>NO-SHOW REPORTED</b>  ║`,
      `╚══════════════════════════╝`,
      ``,
      `Your opponent has <b>3 minutes</b> to respond`,
      `or the match will be voided.`,
      ``,
      `<i>Reported by @${ctx.from?.username}</i>`,
    ].join('\n');
    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // Handle READY button
  bot.callbackQuery('ready_start', async (ctx) => {
    const telegramUserId = ctx.from.id.toString();
    const username = ctx.from.username || 'unknown';
    const chatId = ctx.chat?.id?.toString();
    const numChatId = Number(chatId);
    console.log(`[BOT] @${username} (${telegramUserId}) clicked READY in chat ${chatId}`);

    if (!chatId) {
      await ctx.answerCallbackQuery({ text: '❌ Error: no chat context' });
      return;
    }

    const room = await prisma.telegramRoom.findFirst({ where: { chat_id: chatId } });
    if (!room || !room.current_match_id) {
      await ctx.answerCallbackQuery({ text: '❌ No active match in this room' });
      return;
    }

    const match = await prisma.match.findUnique({
      where: { id: room.current_match_id },
      include: {
        challenger: { select: { telegram_username: true } },
        opponent: { select: { telegram_username: true } },
      },
    });

    if (!match) {
      await ctx.answerCallbackQuery({ text: '❌ Match not found' });
      return;
    }

    const challengerTg = (match.challenger?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const opponentTg = (match.opponent?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const isChallenger = challengerTg !== '' && username.toLowerCase() === challengerTg;
    const isOpponent = opponentTg !== '' && username.toLowerCase() === opponentTg;

    if (!isChallenger && !isOpponent) {
      console.log(`[BOT] ❌ READY: @${username} not matched. challenger_tg='${challengerTg}', opponent_tg='${opponentTg}'`);
      await ctx.answerCallbackQuery({ text: '❓ You are not a participant in this match' });
      return;
    }

    const updateData: any = {};
    if (isChallenger) updateData.challenger_ready = true;
    if (isOpponent) updateData.opponent_ready = true;

    const updated = await prisma.match.update({
      where: { id: match.id },
      data: updateData,
    });

    await ctx.answerCallbackQuery({ text: '✅ You are READY!' });
    try {
      await bot!.api.sendMessage(numChatId, `✅ <b>@${username}</b> is READY!`, { parse_mode: 'HTML' });
    } catch {}

    if (
      (updated.challenger_ready || isChallenger) &&
      (updated.opponent_ready || isOpponent)
    ) {
      await prisma.match.update({
        where: { id: match.id },
        data: { status: 'BATTLE', started_at: new Date() },
      });

      const keyboard = new InlineKeyboard()
        .text('🏆 I WON', 'claim_won')
        .text('💀 I LOST', 'claim_lost');
      const battleMsg = [
        `⚔️ Both players are <b>READY</b>!`,
        ``,
        `📱 Go play your match in MLBB`,
        `🔙 Come back when done to report`,
      ].join('\n');
      try {
        await bot!.api.sendMessage(numChatId, battleMsg, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch {}
    }
  });

  // Handle WON claim
  bot.callbackQuery('claim_won', async (ctx) => {
    const username = ctx.from.username || 'unknown';
    const chatId = ctx.chat?.id?.toString();
    const numChatId = Number(chatId);
    console.log(`[BOT] @${username} claims WON in chat ${chatId}`);

    if (!chatId) { await ctx.answerCallbackQuery({ text: '❌ Error' }); return; }

    const room = await prisma.telegramRoom.findFirst({ where: { chat_id: chatId } });
    if (!room || !room.current_match_id) { await ctx.answerCallbackQuery({ text: '❌ No active match' }); return; }

    const match = await prisma.match.findUnique({
      where: { id: room.current_match_id },
      include: {
        challenger: { select: { id: true, telegram_username: true, username: true } },
        opponent: { select: { id: true, telegram_username: true, username: true } },
      },
    });
    if (!match) { await ctx.answerCallbackQuery({ text: '❌ Match not found' }); return; }

    const challengerTg = (match.challenger?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const opponentTg = (match.opponent?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const isChallenger = challengerTg !== '' && username.toLowerCase() === challengerTg;
    const isOpponent = opponentTg !== '' && username.toLowerCase() === opponentTg;

    if (!isChallenger && !isOpponent) { await ctx.answerCallbackQuery({ text: '❓ Not a participant' }); return; }

    // Record the claim
    const claimData: any = {};
    if (isChallenger) claimData.challenger_claim = 'WON';
    if (isOpponent) claimData.opponent_claim = 'WON';
    const updated = await prisma.match.update({ where: { id: match.id }, data: claimData });

    await ctx.answerCallbackQuery({ text: '🏆 Victory claim recorded!' });
    try {
      await bot!.api.sendMessage(numChatId, `🏆 <b>@${username}</b> claims <b>VICTORY</b>!`, { parse_mode: 'HTML' });
    } catch {}

    // Check if both have now claimed
    await resolveMatchClaims(match.id, chatId);
  });

  // Handle LOST claim
  bot.callbackQuery('claim_lost', async (ctx) => {
    const username = ctx.from.username || 'unknown';
    const chatId = ctx.chat?.id?.toString();
    const numChatId = Number(chatId);
    console.log(`[BOT] @${username} claims LOST in chat ${chatId}`);

    if (!chatId) { await ctx.answerCallbackQuery({ text: '❌ Error' }); return; }

    const room = await prisma.telegramRoom.findFirst({ where: { chat_id: chatId } });
    if (!room || !room.current_match_id) { await ctx.answerCallbackQuery({ text: '❌ No active match' }); return; }

    const match = await prisma.match.findUnique({
      where: { id: room.current_match_id },
      include: {
        challenger: { select: { id: true, telegram_username: true, username: true } },
        opponent: { select: { id: true, telegram_username: true, username: true } },
      },
    });
    if (!match) { await ctx.answerCallbackQuery({ text: '❌ Match not found' }); return; }

    const challengerTg = (match.challenger?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const opponentTg = (match.opponent?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const isChallenger = challengerTg !== '' && username.toLowerCase() === challengerTg;
    const isOpponent = opponentTg !== '' && username.toLowerCase() === opponentTg;

    if (!isChallenger && !isOpponent) { await ctx.answerCallbackQuery({ text: '❓ Not a participant' }); return; }

    const claimData: any = {};
    if (isChallenger) claimData.challenger_claim = 'LOST';
    if (isOpponent) claimData.opponent_claim = 'LOST';
    const updated = await prisma.match.update({ where: { id: match.id }, data: claimData });

    await ctx.answerCallbackQuery({ text: '💀 Defeat recorded.' });
    try {
      await bot!.api.sendMessage(numChatId, `💀 <b>@${username}</b> concedes defeat.`, { parse_mode: 'HTML' });
    } catch {}

    // Check if both have now claimed
    await resolveMatchClaims(match.id, chatId);
  });

  // Handle photo uploads (screenshots)
  bot.on('message:photo', async (ctx) => {
    const username = ctx.from?.username || 'unknown';
    console.log(`[BOT] Photo from @${username}`);
    try {
      await bot!.api.sendMessage(Number(ctx.chat.id), `📸 Screenshot received from <b>@${username}</b>! Processing...`, { parse_mode: 'HTML' });
    } catch {}
  });

  // Handle new members (detect players joining the battle room)
  // This fires from the service message "X joined the group"
  bot.on('message:new_chat_members', async (ctx) => {
    const members = ctx.message.new_chat_members;
    const chatId = ctx.chat.id.toString();
    console.log(`[BOT] 📥 new_chat_members event in chat ${chatId}: ${members.map(m => `@${m.username}(${m.id})`).join(', ')}`);
    for (const member of members) {
      if (member.is_bot) continue;
      await handlePlayerJoin(chatId, member.id, member.username || '', member.first_name);
    }
  });

  // Also handle chat_member updates (more reliable, fires even if service messages are disabled)
  bot.on('chat_member', async (ctx) => {
    const update = ctx.chatMember;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;
    const user = update.new_chat_member.user;
    const chatId = ctx.chat.id.toString();

    // Detect join: was not member -> now member/admin
    if (['left', 'kicked'].includes(oldStatus) && ['member', 'administrator', 'creator'].includes(newStatus)) {
      if (user.is_bot) return;
      console.log(`[BOT] 📥 chat_member JOIN event: @${user.username}(${user.id}) in chat ${chatId}`);
      await handlePlayerJoin(chatId, user.id, user.username || '', user.first_name);
    }

    // Detect leave: was member -> now left/kicked  
    if (['member', 'administrator', 'creator'].includes(oldStatus) && ['left', 'kicked'].includes(newStatus)) {
      if (user.is_bot) return;
      console.log(`[BOT] 📤 chat_member LEAVE event: @${user.username}(${user.id}) in chat ${chatId}`);
      await handlePlayerLeave(chatId, user.id, user.username || '');
    }
  });

  // Mirror text messages
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
  });

    // Handle Join Requests for Challenger Phase 1
  bot.on('chat_join_request', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const tgUserId = ctx.from.id;
    const tgUsername = ctx.from.username || '';
    
    console.log(`[BOT] 📥 Received chat_join_request from @${tgUsername} (${tgUserId}) for chat ${chatId}`);

    // PHASE 0: Link ID immediately so we have it even if we decline the join
    if (tgUsername) {
      try {
        await prisma.user.updateMany({
          where: { telegram_id: tgUserId.toString() },
          data: { telegram_id: null }
        });
        await prisma.user.updateMany({
          where: { 
            OR: [
              { telegram_username: { equals: tgUsername, mode: 'insensitive' } },
              { telegram_username: { equals: `@${tgUsername}`, mode: 'insensitive' } }
            ]
          },
          data: { telegram_id: tgUserId.toString() }
        });
        console.log(`[BOT] 🆔 Identity linked for @${tgUsername} during join request.`);
      } catch (err) {
        console.warn('[BOT] Identity linking failed in join request:', err);
      }
    }

    // PHASE 1: Find Room (with polling retry for production stability)
    let room = null;
    for (let i = 0; i < 5; i++) {
      room = await prisma.telegramRoom.findFirst({ 
        where: { 
          OR: [
            { chat_id: chatId },
            { chat_id: chatId.startsWith('-100') ? chatId.replace('-100', '-') : chatId }, // Handle variations
            { chat_id: chatId.startsWith('-') && !chatId.startsWith('-100') ? chatId.replace('-', '-100') : chatId }
          ]
        } 
      });

      if (room && room.current_match_id) break;
      
      console.log(`[BOT] ⏳ Attempt ${i + 1}/5: Match not found yet for chat ${chatId}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (!room) {
      console.log(`[BOT] 🚫 Decline Join: Room ${chatId} not in DB.`);
      await ctx.declineChatJoinRequest(tgUserId);
      await sendDirectMessage(tgUserId.toString(), "❌ <b>Join Declined:</b> This room is not recognized by the system.");
      return;
    }
    if (!room.current_match_id) {
      console.log(`[BOT] 🚫 Decline Join: Room ${chatId} has no active match after retry.`);
      await ctx.declineChatJoinRequest(tgUserId);
      await sendDirectMessage(tgUserId.toString(), "❌ <b>Join Declined:</b> This room is currently empty or the match has expired.");
      return;
    }

    const match = await prisma.match.findUnique({
      where: { id: room.current_match_id },
      include: {
        challenger: { select: { id: true, telegram_username: true, username: true } },
      },
    });

    if (!match || match.status !== 'PENDING_JOIN') {
      console.log(`[BOT] 🚫 Decline Join: Match not found or not PENDING_JOIN. Status: ${match?.status}`);
      await ctx.declineChatJoinRequest(tgUserId);
      await sendDirectMessage(tgUserId.toString(), "❌ <b>Join Declined:</b> The match in this room is no longer in the joining phase.");
      return;
    }

    const joinedUsername = tgUsername.toLowerCase();
    const challengerTg = (match.challenger?.telegram_username || '').replace(/^@/, '').toLowerCase();
    const isChallengerJoining = challengerTg !== '' && joinedUsername === challengerTg;

    if (isChallengerJoining) {
      // PHASE A: Challenger Approval
      const stakeAmount = Number(match.stake_amount);
      const user = await prisma.user.findUnique({
        where: { id: match.challenger_id },
        include: { wallet: true }
      });

      if (!user || !user.wallet || Number(user.wallet.balance) < stakeAmount) {
        console.log(`[BOT] 🚫 Declined join request for ${tgUsername}: Insufficient balance.`);
        await ctx.declineChatJoinRequest(tgUserId);
        await sendDirectMessage(tgUserId.toString(), `❌ <b>Join Declined:</b> Insufficient balance. You need at least ${stakeAmount} to enter this match.`);
        return;
      }

      console.log(`[BOT] ✅ Challenger @${tgUsername} approved for match ${match.id}`);
      
      // Save ID immediately upon approval
      try {
        await prisma.user.updateMany({ where: { telegram_id: tgUserId.toString() }, data: { telegram_id: null } });
        await prisma.user.updateMany({
          where: { 
            OR: [
              { telegram_username: { equals: tgUsername, mode: 'insensitive' } },
              { telegram_username: { equals: `@${tgUsername}`, mode: 'insensitive' } }
            ]
          },
          data: { telegram_id: tgUserId.toString() }
        });
      } catch (err) {}

      await ctx.approveChatJoinRequest(tgUserId);

      // Generate direct invite link for opponent and freeze balance
      const linkName = `Opponent #${match.id.substring(0, 6)}`;
      const directInviteLink = await generateInviteLink(chatId, linkName, room.invite_link, false);

      await prisma.$transaction(async (tx: any) => {
        await tx.wallet.update({
          where: { user_id: user.id },
          data: { balance: { decrement: stakeAmount }, frozen_amount: { increment: stakeAmount } },
        });

        await tx.transaction.create({
          data: {
            wallet_id: user.wallet!.id,
            user_id: user.id,
            type: 'FREEZE',
            amount: stakeAmount,
            description: 'Stake frozen for new challenge',
            match_id: match.id,
          },
        });

        await tx.match.update({
          where: { id: match.id },
          data: {
            status: 'ACTIVE',
            challenger_joined: true,
            opponent_invite_link: directInviteLink || null,
          },
        });
      });

      emitMatchUpdate(match.id, { status: 'ACTIVE', matchId: match.id });
    } 
    else if (match.status === 'ACTIVE' && !match.opponent_id) {
      // PHASE B: Potential Opponent Approval
      // If the match is ACTIVE and looking for an opponent, we check if this requester
      // is a registered user with enough money. If so, we approve the join request.
      // The actual assignment happens in handlePlayerJoin once they are physically in the room.
      
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { telegram_username: { equals: joinedUsername, mode: 'insensitive' } },
            { telegram_username: { equals: `@${joinedUsername}`, mode: 'insensitive' } }
          ]
        },
        include: { wallet: true }
      });

      const stakeAmount = Number(match.stake_amount);

      if (user && user.wallet && Number(user.wallet.balance) >= stakeAmount) {
        console.log(`[BOT] ✅ Potential Opponent @${tgUsername} approved for match ${match.id}`);
        
        // Link ID (Non-blocking)
        try {
          await prisma.user.updateMany({ where: { telegram_id: tgUserId.toString() }, data: { telegram_id: null } });
          await prisma.user.update({ where: { id: user.id }, data: { telegram_id: tgUserId.toString() } });
        } catch {}

        await ctx.approveChatJoinRequest(tgUserId);
      } else {
        console.log(`[BOT] 🚫 Decline Join: User @${joinedUsername} not registered or low balance.`);
        await ctx.declineChatJoinRequest(tgUserId);
        if (!user) {
          await sendDirectMessage(tgUserId.toString(), `❌ <b>Join Declined:</b> You must register on the website and link your Telegram account before joining matches.`);
        } else {
          await sendDirectMessage(tgUserId.toString(), `❌ <b>Join Declined:</b> Insufficient balance. You need ${stakeAmount} MMK to join this match.`);
        }
      }
    }
    else {
      console.log(`[BOT] 🚫 Decline Join: Room is reserved or requester @${joinedUsername} is unauthorized.`);
      await ctx.declineChatJoinRequest(tgUserId);
      await sendDirectMessage(tgUserId.toString(), `❌ <b>Join Declined:</b> This match room is currently reserved for specific players or the join phase has ended.`);
    }
  });

  bot.catch((err) => {
    console.error('[BOT] Error:', err);
  });

  // Start polling — include chat_member updates for reliable join/leave detection
  bot.start({
    onStart: () => console.log('[BOT] Polling started'),
    allowed_updates: ['message', 'callback_query', 'chat_member', 'my_chat_member', 'chat_join_request'],
  });

  console.log('[BOT] grammY bot created');
  return bot;
}

/**
 * Send a direct message to a user via Telegram.
 * Requires the user's numeric Telegram ID.
 */
export async function sendDirectMessage(tgUserId: string, message: string): Promise<boolean> {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return false;
  const numId = Number(tgUserId);
  if (isNaN(numId)) return false;
  
  try {
    await bot.api.sendMessage(numId, message, { parse_mode: 'HTML' });
    return true;
  } catch (error) {
    console.error(`[BOT] Failed to send DM to ${tgUserId}:`, error);
    return false;
  }
}

export function getBot(): Bot | null {
  return bot;
}

export function getBotWebhookHandler() {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) {
    return (_req: any, res: any) => res.status(200).json({ status: 'bot_disabled' });
  }
  return webhookCallback(bot, 'express');
}

// =============================================
// Dynamic Invite Link Generation
// =============================================

/**
 * Generate a unique single-use invite link for a Telegram group.
 * The link expires after 5 minutes and allows only 1 member.
 * If the bot cannot generate a dynamic link (e.g. invalid chat_id or bot not admin),
 * it returns the fallbackLink (the static invite link from the room record).
 */
export async function generateInviteLink(chatId: string, linkName: string, fallbackLink?: string, createsJoinRequest: boolean = false): Promise<string | null> {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) {
    console.log(`[BOT] Bot not available, using fallback link`);
    return fallbackLink || null;
  }

  // If chat_id isn't numeric, we can't use the Telegram API — return fallback
  const numericChatId = Number(chatId);
  if (isNaN(numericChatId) || chatId.trim() === '') {
    console.log(`[BOT] chat_id "${chatId}" is not a valid Telegram ID, using fallback link`);
    return fallbackLink || null;
  }
  
  try {
    const options: any = {
      name: linkName,
      expire_date: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
    };
    if (createsJoinRequest) {
      options.creates_join_request = true;
    } else {
      options.member_limit = 1;
    }
    const invite = await bot.api.createChatInviteLink(numericChatId, options);
    console.log(`[BOT] Generated dynamic invite link for chat ${chatId}: ${invite.invite_link}`);
    return invite.invite_link;
  } catch (error) {
    console.error(`[BOT] Failed to generate invite link for chat ${chatId}:`, error);
    // Fall back to static link from room record
    return fallbackLink || null;
  }
}

// =============================================
// Match Claim Resolution Logic
// =============================================
async function resolveMatchClaims(matchId: string, chatId: string) {
  const numChatId = Number(chatId);
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      challenger: { include: { wallet: true } },
      opponent: { include: { wallet: true } },
    },
  });
  if (!match || !match.challenger_claim || !match.opponent_claim) return;

  // Case 1: One says WON, other says LOST → auto-resolve
  if (
    (match.challenger_claim === 'WON' && match.opponent_claim === 'LOST') ||
    (match.challenger_claim === 'LOST' && match.opponent_claim === 'WON')
  ) {
    const winnerId = match.challenger_claim === 'WON' ? match.challenger_id : match.opponent_id;
    const loserId = match.challenger_claim === 'WON' ? match.opponent_id : match.challenger_id;
    const winnerName = match.challenger_claim === 'WON' 
      ? (match.challenger?.username || 'Challenger') 
      : (match.opponent?.username || 'Opponent');
    const loserName = match.challenger_claim === 'LOST' 
      ? (match.challenger?.username || 'Challenger') 
      : (match.opponent?.username || 'Opponent');

    if (!winnerId || !loserId) return;

    const winnerPayout = Number(match.total_pot) - Number(match.commission);
    const stakeAmount = Number(match.stake_amount);

    const room = await prisma.telegramRoom.findFirst({ where: { chat_id: chatId } });

    await prisma.$transaction(async (tx: any) => {
      await tx.match.update({
        where: { id: matchId },
        data: { status: 'COMPLETED', winner_id: winnerId, loser_id: loserId, completed_at: new Date() },
      });
      await tx.user.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } });
      await tx.user.update({ where: { id: loserId }, data: { losses: { increment: 1 } } });
      await tx.wallet.update({
        where: { user_id: winnerId },
        data: { balance: { increment: winnerPayout }, frozen_amount: { decrement: stakeAmount }, total_won: { increment: winnerPayout } },
      });
      await tx.wallet.update({
        where: { user_id: loserId },
        data: { frozen_amount: { decrement: stakeAmount }, total_lost: { increment: stakeAmount } },
      });
      await tx.platformRevenue.create({ data: { match_id: matchId, amount: Number(match.commission) } });

      const winnerWallet = winnerId === match.challenger_id ? match.challenger?.wallet : match.opponent?.wallet;

      // RECORD TRANSACTIONS FOR ADMIN DASHBOARD
      if (winnerWallet) {
        await tx.transaction.create({
          data: {
            wallet_id: winnerWallet.id,
            user_id: winnerId,
            type: 'PAYOUT',
            amount: winnerPayout,
            description: `Match winnings (Commission: ${Number(match.commission).toLocaleString()} MMK)`,
            match_id: matchId,
          }
        });

        await tx.transaction.create({
          data: {
            wallet_id: winnerWallet.id,
            user_id: winnerId,
            type: 'COMMISSION',
            amount: Number(match.commission),
            description: `Platform fee for match ${matchId.substring(0, 8)}`,
            match_id: matchId,
          }
        });
      }

      if (room) {
        await tx.telegramRoom.update({ where: { id: room.id }, data: { status: 'AVAILABLE', current_match_id: null } });
      }
    });

    await revokeInviteLinks(chatId, [match.challenger_invite_link, match.opponent_invite_link]);

    await prisma.notification.create({ data: { user_id: winnerId, title: 'Victory! \uD83C\uDFC6', message: `You won the match! ${winnerPayout.toLocaleString()} MMK has been added to your wallet.` } });
    await prisma.notification.create({ data: { user_id: loserId, title: 'Defeat \uD83D\uDC80', message: `You lost the match. Better luck next time!` } });

    const msg = [
      `╔══════════════════════════════╗`,
      `║  🏆 <b>MATCH RESOLVED!</b>      ║`,
      `╚══════════════════════════════╝`,
      ``,
      `🏆 Winner: <b>${winnerName}</b>`,
      `💀 Loser: <b>${loserName}</b>`,
      `💰 Payout: <b>${winnerPayout.toLocaleString()} MMK</b>`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Both players agreed on the result.</i>`,
      `<i>Room will be cleaned shortly.</i>`,
    ].join('\n');
    try { await bot!.api.sendMessage(numChatId, msg, { parse_mode: 'HTML' }); } catch {}

    // Clean up room
    setTimeout(async () => {
      try {
        const tracked = roomMemberIds.get(matchId);
        if (tracked) {
          if (tracked.challengerTgId) {
            await bot!.api.banChatMember(numChatId, tracked.challengerTgId, { revoke_messages: true });
            await bot!.api.unbanChatMember(numChatId, tracked.challengerTgId, { only_if_banned: true });
          }
          if (tracked.opponentTgId) {
            await bot!.api.banChatMember(numChatId, tracked.opponentTgId, { revoke_messages: true });
            await bot!.api.unbanChatMember(numChatId, tracked.opponentTgId, { only_if_banned: true });
          }
          roomMemberIds.delete(matchId);
        }
        await purgeRecentMessages(numChatId);
      } catch {}
    }, 3000);

    console.log(`[BOT] \u2705 Match ${matchId} auto-resolved: ${winnerName} won`);
  }

  // Case 2: Both claim WON → auto-dispute
  else if (match.challenger_claim === 'WON' && match.opponent_claim === 'WON') {
    console.log(`[BOT] \u26A0\uFE0F Both players claim WON for match ${matchId} — creating dispute`);

    await prisma.match.update({ where: { id: matchId }, data: { status: 'DISPUTED' } });

    // Create a dispute record
    await prisma.dispute.create({
      data: {
        match_id: matchId,
        reported_by_id: match.challenger_id,
        reason: 'Both players claim victory. Admin review required.',
        status: 'PENDING',
      },
    });

    await prisma.notification.create({ data: { user_id: match.challenger_id, title: '\u26A0\uFE0F Match Disputed', message: 'Both players claimed victory. An admin will review the match.' } });
    if (match.opponent_id) {
      await prisma.notification.create({ data: { user_id: match.opponent_id, title: '\u26A0\uFE0F Match Disputed', message: 'Both players claimed victory. An admin will review the match.' } });
    }

    const msg = [
      `╔══════════════════════════════╗`,
      `║  ⚠️ <b>MATCH DISPUTED!</b>       ║`,
      `╚══════════════════════════════╝`,
      ``,
      `Both players claim <b>VICTORY</b>.`,
      `This match is now under <b>admin review</b>.`,
      ``,
      `📸 Upload your scoreboard screenshots`,
      `as evidence. An admin will decide the winner.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ <i>Lying about results = permanent ban</i>`,
    ].join('\n');
    try { await bot!.api.sendMessage(numChatId, msg, { parse_mode: 'HTML' }); } catch {}
  }

  // Case 3: Both claim LOST (very rare, possibly trolling) → void
  else if (match.challenger_claim === 'LOST' && match.opponent_claim === 'LOST') {
    console.log(`[BOT] \u2753 Both players claim LOST for match ${matchId} — voiding`);
    await prisma.match.update({ where: { id: matchId }, data: { status: 'DISPUTED' } });
    await prisma.dispute.create({
      data: { match_id: matchId, reported_by_id: match.challenger_id, reason: 'Both players claim defeat. Suspicious activity.', status: 'PENDING' },
    });
    try { await bot!.api.sendMessage(numChatId, `❓ Both players claim defeat. This match has been flagged for <b>admin review</b>.`, { parse_mode: 'HTML' }); } catch {}
  }
}

// Helper: Send ready check to a room
export async function sendReadyCheck(chatId: string) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  const numericChatId = Number(chatId);
  const keyboard = new InlineKeyboard().text('🚀 READY TO START', 'ready_start');
  const msg = [
    `✅ <b>Both players are in the room.</b>`,
    `Press <b>READY TO START</b> to begin.`,
  ].join('\n');
  try {
    await bot.api.sendMessage(numericChatId, msg, { parse_mode: 'HTML', reply_markup: keyboard });
    console.log(`[BOT] ✅ Ready check button sent to ${numericChatId}`);
  } catch (err) {
    console.error(`[BOT] ❌ Failed to send ready check to ${numericChatId}:`, err);
  }
}

// Helper: Send submission buttons
export async function sendSubmissionButtons(chatId: string) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  const numericChatId = Number(chatId);
  const keyboard = new InlineKeyboard()
    .text('🏆 I WON', 'claim_won')
    .text('💀 I LOST', 'claim_lost');
  const msg = [
    `⚔️ Both players are <b>READY</b>!`,
    ``,
    `📱 Go play your match in MLBB`,
    `🔙 Come back when done to report`,
  ].join('\n');
  try {
    await bot.api.sendMessage(numericChatId, msg, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error(`[BOT] ❌ Failed to send submission buttons:`, err);
  }
}

// Helper: Mute a chat
export async function muteChat(chatId: string) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  await bot.api.setChatPermissions(chatId, { can_send_messages: false });
}

// Helper: Unmute a chat
export async function unmuteChat(chatId: string) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  await bot.api.setChatPermissions(chatId, {
    can_send_messages: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
  });
}

/**
 * Kick all match players from the room and wipe messages.
 * Then unban so they can be re-invited in future matches.
 */
export async function kickAndWipeRoom(chatId: string, matchId: string) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  const numericChatId = Number(chatId);
  if (isNaN(numericChatId)) return;

  console.log(`[BOT] 🧹 Cleaning room ${chatId} for match ${matchId}`);

  try {
    await bot.api.sendMessage(numericChatId, '🏁 Match concluded. Cleaning room...', { parse_mode: 'HTML' });
  } catch {}

  // Try to kick tracked players first
  const tracked = roomMemberIds.get(matchId);
  if (tracked) {
    for (const tgId of [tracked.challengerTgId, tracked.opponentTgId]) {
      if (!tgId) continue;
      try {
        await bot.api.banChatMember(numericChatId, tgId, { revoke_messages: true });
        await bot.api.unbanChatMember(numericChatId, tgId, { only_if_banned: true });
        console.log(`[BOT] Kicked tracked user ${tgId} from room ${chatId}`);
      } catch {}
    }
    roomMemberIds.delete(matchId);
  }

  // Also try to get chat members from the match record and kick by username lookup
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        challenger: { select: { telegram_username: true } },
        opponent: { select: { telegram_username: true } },
      },
    });
    if (match) {
      // Try to get and kick any remaining non-admin, non-bot members
      // by checking recent chat members via getChat
      const admins = await bot.api.getChatAdministrators(numericChatId);
      const botId = (await bot.api.getMe()).id;
      for (const admin of admins) {
        if (admin.user.is_bot) continue;
        if (admin.user.id === botId) continue;
        // Don't kick actual group admins/creators
        if (admin.status === 'creator') continue;
      }
    }
  } catch {}

  // Purge messages
  await purgeRecentMessages(numericChatId);
  console.log(`[BOT] ✅ Room ${chatId} cleaned for match ${matchId}`);
}

/**
 * Kick a single user from a room by their Telegram user ID.
 * Uses banChatMember with revoke_messages to wipe their messages.
 */
export async function kickUserFromRoom(chatId: string, telegramUserId: number) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  const numericChatId = Number(chatId);
  if (isNaN(numericChatId)) return;

  try {
    await bot.api.banChatMember(numericChatId, telegramUserId, { revoke_messages: true });
    // Immediately unban so they can be re-invited
    await bot.api.unbanChatMember(numericChatId, telegramUserId, { only_if_banned: true });
    console.log(`[BOT] Kicked user ${telegramUserId} from chat ${chatId}`);
  } catch (err) {
    console.error(`[BOT] Failed to kick user ${telegramUserId}:`, err);
  }
}

/**
 * Purge recent messages from a chat.
 * Telegram only allows deleting messages < 48h old.
 * We send a marker message then delete backwards.
 */
async function purgeRecentMessages(chatId: number) {
  if (!bot) return;
  try {
    // Send a marker message so we know the latest message ID
    const marker = await bot.api.sendMessage(chatId, '🧹 Cleaning room...');
    const latestId = marker.message_id;
    
    // Delete backwards from the marker (try last 100 messages)
    const deletePromises: Promise<boolean>[] = [];
    for (let i = latestId; i > Math.max(1, latestId - 100); i--) {
      deletePromises.push(
        bot.api.deleteMessage(chatId, i).then(() => true).catch(() => false)
      );
    }
    const results = await Promise.all(deletePromises);
    const deleted = results.filter(Boolean).length;
    console.log(`[BOT] 🧹 Purged ${deleted} messages from chat ${chatId}`);
  } catch (err) {
    console.error(`[BOT] Failed to purge messages from chat ${chatId}:`, err);
  }
}

/**
 * Revoke Telegram invite links
 */
export async function revokeInviteLinks(chatId: string, links: (string | null)[]) {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return;
  const numericChatId = Number(chatId);
  if (isNaN(numericChatId)) return;

  for (const link of links) {
    if (link) {
      try {
        await bot.api.revokeChatInviteLink(numericChatId, link);
        console.log(`[BOT] 🗑️ Revoked invite link: ${link}`);
      } catch (err) {
        console.error(`[BOT] ❌ Failed to revoke invite link ${link}:`, err);
      }
    }
  }
}
