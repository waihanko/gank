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
      challenger: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
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
      select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, avatar_url: true },
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
      challenger: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true } },
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
      challenger: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
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
      challenger: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
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

  // Create match atomically
  try {
    const match = await prisma.$transaction(async (tx: any) => {
      // 1. Double-check if user already has a live match
      const existing = await tx.match.findFirst({
        where: {
          OR: [
            { challenger_id: userId, status: { in: liveStatuses } },
            { opponent_id: userId, status: { in: liveStatuses } },
          ],
        },
      });
      if (existing) throw new Error('ALREADY_IN_MATCH');

      // 2. Freeze funds
      await tx.wallet.update({
        where: { user_id: userId },
        data: {
          balance: { decrement: stake_amount },
          frozen_amount: { increment: stake_amount },
        },
      });

      await tx.transaction.create({
        data: {
          wallet_id: wallet.id,
          user_id: userId,
          type: 'FREEZE',
          amount: stake_amount,
          description: 'Stake frozen for new challenge',
        },
      });

      const matchId = crypto.randomUUID();

      return tx.match.create({
        data: {
          id: matchId,
          challenger_id: userId,
          stake_amount,
          status: 'ACTIVE', // Public immediately
          challenger_joined: true, // They are already in the app
          opponent_joined: false,
        },
      });
    });

    res.status(201).json({
      success: true,
      data: { match },
      message: 'Challenge created successfully.',
    });
  } catch (error: any) {
    if (error.message === 'ALREADY_IN_MATCH') {
      res.status(400).json({ success: false, error: 'You already have a live match. Finish or delete it first.' });
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

  // Freeze funds and assign opponent
  try {
    const updatedMatch = await prisma.$transaction(async (tx: any) => {
      // Re-check wallet balance inside transaction
      const currentWallet = await tx.wallet.findUnique({ where: { user_id: opponentId } });
      if (!currentWallet || Number(currentWallet.balance) < stakeAmount) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      await tx.wallet.update({
        where: { user_id: opponentId },
        data: {
          balance: { decrement: stakeAmount },
          frozen_amount: { increment: stakeAmount },
        },
      });

      await tx.transaction.create({
        data: {
          wallet_id: currentWallet.id,
          user_id: opponentId,
          type: 'FREEZE',
          amount: stakeAmount,
          description: 'Stake frozen for accepted challenge',
        },
      });

      return tx.match.update({
        where: { id: matchId },
        data: {
          opponent_id: opponentId,
          opponent_joined: true,
          status: 'READY_CHECK', // Move directly to Ready Check
        },
      });
    });
    
    // Broadcast updates
    emitMatchUpdate(matchId, { status: 'READY_CHECK', opponent_id: opponentId, matchId });
    
    try {
      const { getIO } = require('../services/socket');
      const sysMsg = await prisma.battleMessage.create({
        data: {
          match_id: matchId,
          type: 'system',
          content: `${req.user!.username} joined the battle!`,
        }
      });
      getIO().to(`match:${matchId}`).emit('new-message', sysMsg);
    } catch (err) {
      console.warn('[MATCHES] Could not broadcast join message:', err);
    }

    res.json({
      success: true,
      data: { match: updatedMatch },
      message: 'Challenge accepted!',
    });
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ success: false, error: 'Insufficient balance' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to accept challenge' });
    }
  }
});

// GET /matches/:id — get single match
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id as string },
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true, mlbb_server_id: true, mlbb_zone_id: true, wins: true, losses: true, telegram_username: true, telegram_display_name: true, avatar_url: true } },
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
