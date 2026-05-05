import { Bot, webhookCallback, InputFile } from 'grammy';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';

let bot: Bot | null = null;
const prisma = new PrismaClient();

export function createBot(): Bot {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn('[BOT] No TELEGRAM_BOT_TOKEN set — bot disabled');
    bot = new Bot('placeholder:token');
    return bot;
  }

  bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Global ID Linker Middleware
  // This helps us know the numeric Telegram ID of a user who has a username.
  bot.on(['message', 'chat_member', 'chat_join_request'], async (ctx, next) => {
    // Get user from message or chat_member update
    const from = ctx.from;
    const tgUserId = from?.id?.toString();
    const username = from?.username;

    let isRegisteredUser = false;

    if (tgUserId && username) {
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
          isRegisteredUser = true;
          if (user.telegram_chat_id !== tgUserId) {
            // Unlink any other user who might have had this ID (integrity check)
            await prisma.user.updateMany({ 
              where: { telegram_chat_id: tgUserId }, 
              data: { telegram_chat_id: null } 
            });
            
            // Link this user
            await prisma.user.update({ 
              where: { id: user.id }, 
              data: { telegram_chat_id: tgUserId } 
            });
            
            console.log(`[BOT] 🆔 Linked Chat ID ${tgUserId} for @${username}`);
            
            // Send a confirmation DM
            await ctx.api.sendMessage(tgUserId, [
              `✅ <b>Telegram Identity Connected!</b>`,
              ``,
              `Your Telegram account has been successfully linked to your Good Game profile. You will now receive match notifications here.`,
            ].join('\n'), { parse_mode: 'HTML' }).catch(() => {
              console.log(`[BOT] Could not send confirmation DM to ${tgUserId} (user might not have started bot)`);
            });
          }
        }
      } catch (err) {
        console.warn('[BOT] Global Linker Error:', err);
      }
    }
    
    // Process join requests
    if (ctx.chatJoinRequest && tgUserId) {
      try {
        if (isRegisteredUser) {
          await ctx.api.approveChatJoinRequest(ctx.chatJoinRequest.chat.id, Number(tgUserId));
          console.log(`[BOT] ✅ Approved chat join request for ID ${tgUserId}`);
          
          // Send welcome message
          await ctx.api.sendMessage(tgUserId, [
            `🎉 <b>Welcome to the Good Game Platform, @${username}!</b>`,
            ``,
            `Your request to join the official Telegram group has been approved.`,
            `You will now receive all your match notifications and updates right here.`,
            ``,
            `Good luck and have fun! 👻`
          ].join('\n'), { parse_mode: 'HTML' }).catch(() => {
            console.log(`[BOT] Could not send welcome DM to ${tgUserId}`);
          });
        } else {
          await ctx.api.declineChatJoinRequest(ctx.chatJoinRequest.chat.id, Number(tgUserId));
          console.log(`[BOT] ❌ Declined chat join request for ID ${tgUserId} (Not registered)`);
          
          await ctx.api.sendMessage(tgUserId, `❌ Your request to join the Good Game group was declined because your Telegram username (@${username || 'unknown'}) is not linked to a registered account. Please update your profile on the website first!`).catch(() => {});
        }
      } catch (err) {
        console.error('[BOT] Failed to process chat join request:', err);
      }
    }
    
    return next();
  });

  // Verify bot identity on startup
  bot.api.getMe().then(me => {
    console.log(`[BOT] 🤖 Bot authenticated successfully as @${me.username} (ID: ${me.id})`);
  }).catch(err => {
    console.error(`[BOT] ❌ FATAL: Could not authenticate with Telegram token.`, err);
  });

  // /start command
  bot.command('start', (ctx) => {
    const msg = [
      `┌─────────────────────────┐`,
      `│   👻 <b>GOOD GAME</b>        │`,
      `└─────────────────────────┘`,
      ``,
      `Welcome to the Good Game Platform!`,
      ``,
      `Register and link your Telegram account on our website to start participating in matches.`,
    ].join('\n');
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  bot.catch((err) => {
    console.error('[BOT] Error:', err);
  });

  // Start polling
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

/**
 * Send a message to a Telegram group.
 * Requires the group's exact chat ID (often starts with a hyphen).
 * Can optionally include an image.
 */
export async function sendGroupMessage(chatId: string, message: string, image?: Buffer): Promise<boolean> {
  if (!bot || !env.TELEGRAM_BOT_TOKEN) return false;
  try {
    if (image) {
      await bot.api.sendPhoto(chatId, new InputFile(image), { caption: message, parse_mode: 'HTML' });
    } else {
      await bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }
    return true;
  } catch (error) {
    console.error(`[BOT] Failed to send message to group ${chatId}:`, error);
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


