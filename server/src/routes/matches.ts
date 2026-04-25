import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { COMMISSION_RATE, MIN_STAKE } from '../config/env';
import { emitMatchUpdate } from '../services/socket';
import { scheduleReadyCheckTimeout, schedulePendingJoinTimeout, cancelJob } from '../services/queue';
import crypto from 'crypto';
import { generateInviteLink, kickUserFromRoom, kickAndWipeRoom, revokeInviteLinks } from '../services/bot';

const router = Router();
const prisma = new PrismaClient();

// GET /matches — list matches (public lobby)
// Return global matches, but exclude user's own live match to avoid duplication with myLiveMatch banner
router.get('/', async (req: Request, res: Response): Promise<void> => {
  let userId: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
      userId = (decoded as any).userId;
    } catch {}
  }

  const statusQuery = req.query.status as string;
  const liveStatuses = ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION', 'DISPUTED'];

  const matches = await prisma.match.findMany({
    where: {
      ...(statusQuery ? { status: statusQuery } : { status: { notIn: ['PENDING_JOIN', 'CANCELLED', 'DISPUTED', 'VOIDED'] } }),
      ...(userId ? {
        OR: [
          {
            challenger_id: { not: userId },
            OR: [
              { opponent_id: { not: userId } },
              { opponent_id: null }
            ]
          },
          {
            status: { notIn: liveStatuses }
          }
        ]
      } : {}),
    },
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true, telegram_username: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true, telegram_username: true } },
      room: { select: { id: true, title: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  res.json({ success: true, data: matches });
});

// GET /matches/stats — global stats
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const totalMatches = await prisma.match.count({ where: { status: 'COMPLETED' } });
    const totalUsers = await prisma.user.count({ where: { is_banned: false } });
    
    // Sum all total_pot of COMPLETED matches
    const completedMatches = await prisma.match.findMany({
      where: { status: 'COMPLETED' },
      select: { total_pot: true }
    });
    
    const totalPrizePool = completedMatches.reduce((acc, m) => acc + Number(m.total_pot), 0);

    res.json({
      success: true,
      data: { totalMatches, totalUsers, totalPrizePool }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /matches/leaderboard — top players
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const topPlayers = await prisma.user.findMany({
      where: { is_banned: false },
      select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true },
      orderBy: { wins: 'desc' },
      take: 10,
    });
    res.json({ success: true, data: topPlayers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// GET /matches/my-pending — get user's own PENDING_JOIN match (auth required)
router.get('/my-pending', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const pendingMatch = await prisma.match.findFirst({
    where: { challenger_id: userId, status: 'PENDING_JOIN' },
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true, telegram_username: true } },
      room: { select: { id: true, title: true } },
    },
  });
  res.json({ success: true, data: pendingMatch });
});

// GET /matches/my-recent — get user's latest 2 matches (live or completed)
router.get('/my-recent', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const recentMatches = await prisma.match.findMany({
    where: {
      OR: [
        { challenger_id: userId },
        { opponent_id: userId },
      ],
    },
    orderBy: { created_at: 'desc' },
    take: 2,
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true } },
      room: { select: { id: true, title: true } },
    },
  });
  res.json({ success: true, data: recentMatches });
});

// GET /matches/my-history — user's past matches
router.get('/my-history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const history = await prisma.match.findMany({
    where: {
      OR: [
        { challenger_id: userId },
        { opponent_id: userId },
      ]
    },
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true } },
      room: { select: { id: true, title: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: history });
});

// POST /matches — create challenge (auth required)
// Stage 1: Private Initiation
//   - Freeze stake, assign room, generate Link A (single-use, 5 min)
//   - Match starts as PENDING_JOIN (NOT visible in public lobby)
//   - Auto-cancel if challenger doesn't join within 5 minutes
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { stake_amount } = req.body;
  const userId = req.user!.userId;

  if (!stake_amount || stake_amount < MIN_STAKE) {
    res.status(400).json({ success: false, error: `Minimum stake is ${MIN_STAKE} MMK` });
    return;
  }

  // Check if user has ANY live engagement (challenger or opponent)
  const liveStatuses = ['PENDING_JOIN', 'ACTIVE', 'ACCEPTED', 'WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'];
  const existingLive = await prisma.match.findFirst({
    where: {
      OR: [
        { challenger_id: userId, status: { in: liveStatuses } },
        { opponent_id: userId, status: { in: liveStatuses } },
      ],
    },
  });
  if (existingLive) {
    res.status(400).json({ success: false, error: 'You already have a live match. Finish or delete it first.' });
    return;
  }

  // Check wallet balance
  const wallet = await prisma.wallet.findUnique({ where: { user_id: userId } });
  if (!wallet || Number(wallet.balance) < stake_amount) {
    res.status(400).json({ success: false, error: 'Insufficient balance' });
    return;
  }

  // Find an available room
  const availableRoom = await prisma.telegramRoom.findFirst({ where: { status: 'AVAILABLE' } });
  if (!availableRoom) {
    res.status(400).json({ success: false, error: 'No battle rooms available. Please try again later.' });
    return;
  }

  // Generate match ID early for the link name
  const matchId = crypto.randomUUID();
  const linkName = `Challenger #${matchId.substring(0, 6)}`;

  // Generate dynamic invite Link A (single-use, 5 min expiry, requires join request)
  const challengerInviteLink = await generateInviteLink(availableRoom.chat_id, linkName, availableRoom.invite_link, true);

  // Create match + assign room atomically
  try {
    const match = await prisma.$transaction(async (tx: any) => {

      // 1. Acquire row-level lock on user's wallet to serialize concurrent requests
      await tx.wallet.update({
        where: { user_id: userId },
        data: { balance: { increment: 0 } },
      });

      // 2. Double-check if user already has a live match
      const existing = await tx.match.findFirst({
        where: {
          OR: [
            { challenger_id: userId, status: { in: liveStatuses } },
            { opponent_id: userId, status: { in: liveStatuses } },
          ],
        },
      });
      if (existing) {
        throw new Error('ALREADY_IN_MATCH');
      }

      // 3. Double-check room availability
      const doubleCheckRoom = await tx.telegramRoom.findFirst({ where: { id: availableRoom.id, status: 'AVAILABLE' } });
      if (!doubleCheckRoom) {
        throw new Error('ROOM_TAKEN');
      }

      // 4. Mark room as occupied
      await tx.telegramRoom.update({
        where: { id: availableRoom.id },
        data: { status: 'OCCUPIED' },
      });

      return tx.match.create({
        data: {
          id: matchId,
          challenger_id: userId,
          stake_amount,
          status: 'PENDING_JOIN', // NOT public yet
          room_id: availableRoom.id,
          challenger_invite_link: challengerInviteLink,
          challenger_joined: false,
          opponent_joined: false,
        },
      });
    });

    // Set the current match on the room
    await prisma.telegramRoom.update({
      where: { id: availableRoom.id },
      data: { current_match_id: match.id },
    });

    // Schedule auto-cancel if challenger doesn't join within 5 minutes
    try {
      await schedulePendingJoinTimeout(match.id);
    } catch (err) {
      console.warn('[MATCHES] Could not schedule pending join timeout:', err);
    }

    res.status(201).json({
      success: true,
      data: {
        match,
        telegram_invite: challengerInviteLink,
        room_title: availableRoom.title,
      },
      message: 'Join the Telegram room to activate your challenge.',
    });
  } catch (error: any) {
    if (challengerInviteLink) {
      revokeInviteLinks(availableRoom.chat_id, [challengerInviteLink]).catch(() => {});
    }

    if (error.message === 'ALREADY_IN_MATCH') {
      res.status(400).json({ success: false, error: 'You already have a live match. Finish or delete it first.' });
    } else if (error.message === 'ROOM_TAKEN') {
      res.status(400).json({ success: false, error: 'The room was just taken. Please try again.' });
    } else {
      console.error('[MATCHES] Transaction error:', error);
      res.status(500).json({ success: false, error: 'Internal server error during match creation' });
    }
  }
});

// DELETE /matches/:id — delete/cancel a challenge (owner only)
// Stage 3, Option A: Challenger cancels while no opponent
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const matchId = req.params.id as string;
  const userId = req.user!.userId;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { room: true },
  });

  if (!match) {
    res.status(404).json({ success: false, error: 'Match not found' });
    return;
  }
  if (match.challenger_id !== userId) {
    res.status(403).json({ success: false, error: 'Only the challenger can delete this match' });
    return;
  }
  if (match.opponent_id) {
    res.status(400).json({ success: false, error: 'Cannot delete — an opponent has already joined' });
    return;
  }
  if (!['PENDING_JOIN', 'ACTIVE'].includes(match.status)) {
    res.status(400).json({ success: false, error: 'Match cannot be deleted in its current state' });
    return;
  }

  const stakeAmount = Number(match.stake_amount);

  // Unfreeze stake + cancel match
  const wallet = await prisma.wallet.findUnique({ where: { user_id: userId } });
  if (wallet) {
    await prisma.$transaction(async (tx: any) => {
      if (match.status === 'ACTIVE') {
        await tx.wallet.update({
          where: { user_id: userId },
          data: {
            balance: { increment: stakeAmount },
            frozen_amount: { decrement: stakeAmount },
          },
        });
        await tx.transaction.create({
          data: {
            wallet_id: wallet.id,
            user_id: userId,
            type: 'RELEASE',
            amount: stakeAmount,
            description: 'Stake released — challenge deleted by owner',
            match_id: matchId,
          },
        });
      }
      await tx.match.update({
        where: { id: matchId },
        data: { status: 'CANCELLED' },
      });
    });
  }

  // Recycle the room
  if (match.room_id) {
    await prisma.telegramRoom.update({
      where: { id: match.room_id },
      data: { status: 'AVAILABLE', current_match_id: null },
    });
    // Kick challenger and clean the Telegram room
    if (match.room?.chat_id) {
      await revokeInviteLinks(match.room.chat_id, [match.challenger_invite_link, match.opponent_invite_link]);
      kickAndWipeRoom(match.room.chat_id, matchId).catch(err => {
        console.error('[MATCHES] Failed to clean room after delete:', err);
      });
    }
  }

  // Cancel any pending timers
  try {
    await cancelJob(`pending-join-${matchId}`);
  } catch {}

  // Emit update
  emitMatchUpdate(matchId, { status: 'CANCELLED', matchId });

  res.json({ success: true, message: 'Challenge deleted. Stake has been returned to your wallet.' });
});

// POST /matches/:id/accept — accept a challenge (opponent)
// Stage 3, Option B: Opponent joins
router.post('/:id/accept', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const matchId = req.params.id as string;
  const opponentId = req.user!.userId;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { room: true },
  });
  if (!match || match.status !== 'ACTIVE') {
    res.status(400).json({ success: false, error: 'Match not available for acceptance' });
    return;
  }
  if (match.challenger_id === opponentId) {
    res.status(400).json({ success: false, error: 'Cannot accept your own challenge' });
    return;
  }
  if (match.opponent_id) {
    res.status(400).json({ success: false, error: 'Match already has an opponent' });
    return;
  }

  // AUTO-DELETE: If opponent owns an ACTIVE/PENDING_JOIN challenge, auto-delete it first
  const existingChallenge = await prisma.match.findFirst({
    where: { challenger_id: opponentId, status: { in: ['PENDING_JOIN', 'ACTIVE'] }, opponent_id: null },
    include: { room: true },
  });
  if (existingChallenge) {
    const oldStake = Number(existingChallenge.stake_amount);
    const oldWallet = await prisma.wallet.findUnique({ where: { user_id: opponentId } });
    if (oldWallet) {
      await prisma.$transaction(async (tx: any) => {
        await tx.wallet.update({
          where: { user_id: opponentId },
          data: { balance: { increment: oldStake }, frozen_amount: { decrement: oldStake } },
        });
        await tx.transaction.create({
          data: {
            wallet_id: oldWallet.id, user_id: opponentId, type: 'RELEASE', amount: oldStake,
            description: 'Stake released — auto-deleted challenge to join another battle',
            match_id: existingChallenge.id,
          },
        });
        await tx.match.update({ where: { id: existingChallenge.id }, data: { status: 'CANCELLED' } });
      });
    }
    // Recycle the old room
    if (existingChallenge.room_id) {
      await prisma.telegramRoom.update({
        where: { id: existingChallenge.room_id },
        data: { status: 'AVAILABLE', current_match_id: null },
      });
    }
    try { await cancelJob(`pending-join-${existingChallenge.id}`); } catch {}
    console.log(`[MATCHES] Auto-deleted challenge ${existingChallenge.id} for user ${opponentId}`);
  }

  const stakeAmount = Number(match.stake_amount);
  const wallet = await prisma.wallet.findUnique({ where: { user_id: opponentId } });
  if (!wallet || Number(wallet.balance) < stakeAmount) {
    res.status(400).json({ success: false, error: 'Insufficient balance' });
    return;
  }

  // Provide the direct link for Player B generated during Phase 2
  const opponentInviteLink = match.opponent_invite_link || (match.room ? match.room.invite_link : null);

  // DO NOT freeze funds or assign opponent_id here. 
  // The bot will do this when the user physically joins the group.
  
  res.json({
    success: true,
    data: {
      match,
      telegram_invite: opponentInviteLink,
      room_title: match.room?.title || 'Battle Room',
    },
    message: 'Link generated. Join the Telegram battle room to claim the match!',
  });
});

// GET /matches/:id — get single match
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id as string },
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true, telegram_username: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, wins: true, losses: true, telegram_username: true } },
      room: true,
    },
  });

  if (!match) {
    res.status(404).json({ success: false, error: 'Match not found' });
    return;
  }

  res.json({ success: true, data: match });
});

export default router;
