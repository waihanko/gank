import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';
import { emitMatchUpdate } from '../services/socket';
import { getIO } from '../services/socket';

const router = Router();
const prisma = new PrismaClient();

// GET /api/battle-room/:matchId/messages — Get chat history
router.get('/:matchId/messages', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const matchId = req.params.matchId as string;
  const userId = req.user!.userId;

  // Verify match exists and user is part of it
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { challenger_id: true, opponent_id: true }
  });

  if (!match) {
    res.status(404).json({ success: false, error: 'Match not found' });
    return;
  }

  // Allow either challenger or opponent to see messages
  if (match.challenger_id !== userId && match.opponent_id !== userId) {
    res.status(403).json({ success: false, error: 'Not authorized to view this match' });
    return;
  }

  const messages = await prisma.battleMessage.findMany({
    where: { match_id: matchId },
    include: {
      sender: { select: { id: true, username: true, mlbb_ign: true, avatar_url: true } }
    },
    orderBy: { created_at: 'asc' },
    take: 200
  });

  res.json({ success: true, data: messages });
});

// GET /api/battle-room/:matchId/messages/count — Lightweight heartbeat check
router.get('/:matchId/messages/count', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const matchId = req.params.matchId as string;
  const userId = req.user!.userId;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { challenger_id: true, opponent_id: true }
  });

  if (!match || (match.challenger_id !== userId && match.opponent_id !== userId)) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return;
  }

  const count = await prisma.battleMessage.count({ where: { match_id: matchId } });
  res.json({ success: true, count });
});

// POST /api/battle-room/:matchId/ready — Player clicks Ready
router.post('/:matchId/ready', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const matchId = req.params.matchId as string;
  const userId = req.user!.userId;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    res.status(404).json({ success: false, error: 'Match not found' });
    return;
  }

  const isChallenger = match.challenger_id === userId;
  const isOpponent = match.opponent_id === userId;

  if (!isChallenger && !isOpponent) {
    res.status(403).json({ success: false, error: 'Not a participant' });
    return;
  }

  const updateData: any = {};
  if (isChallenger) updateData.challenger_ready = true;
  if (isOpponent) updateData.opponent_ready = true;

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: updateData,
  });

  // System message
  const sysMsg = await prisma.battleMessage.create({
    data: {
      match_id: matchId,
      type: 'system',
      content: `${req.user!.username} is READY!`,
    }
  });
  getIO().to(`match:${matchId}`).emit('new-message', sysMsg);

  // If both ready, start battle
  if ((updated.challenger_ready || isChallenger) && (updated.opponent_ready || isOpponent) && updated.status === 'READY_CHECK') {
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'BATTLE', started_at: new Date() },
    });
    
    emitMatchUpdate(matchId, { status: 'BATTLE', matchId });
    
    const battleSysMsg = await prisma.battleMessage.create({
      data: {
        match_id: matchId,
        type: 'system',
        content: `⚔️ Both players are READY! Go play your match in MLBB.`,
      }
    });
    getIO().to(`match:${matchId}`).emit('new-message', battleSysMsg);
  } else {
    emitMatchUpdate(matchId, { updatedReadyState: true });
  }

  res.json({ success: true, message: 'You are READY!' });
});

// POST /api/battle-room/:matchId/claim — Player claims WON/LOST
router.post('/:matchId/claim', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const matchId = req.params.matchId as string;
  const { claim } = req.body; // 'WON' or 'LOST'
  const userId = req.user!.userId;

  if (!['WON', 'LOST'].includes(claim)) {
    res.status(400).json({ success: false, error: 'Invalid claim type' });
    return;
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    res.status(404).json({ success: false, error: 'Match not found' });
    return;
  }

  if (!['BATTLE', 'SUBMISSION'].includes(match.status)) {
    res.status(400).json({ success: false, error: 'Match is not in a claimable state' });
    return;
  }

  const isChallenger = match.challenger_id === userId;
  const isOpponent = match.opponent_id === userId;

  if (!isChallenger && !isOpponent) {
    res.status(403).json({ success: false, error: 'Not a participant' });
    return;
  }

  const claimData: any = {};
  if (isChallenger) claimData.challenger_claim = claim;
  if (isOpponent) claimData.opponent_claim = claim;

  if (match.status === 'BATTLE') {
    claimData.status = 'SUBMISSION';
  }

  await prisma.match.update({ where: { id: match.id }, data: claimData });

  // System message
  const emoji = claim === 'WON' ? '🏆' : '💀';
  const claimText = claim === 'WON' ? 'claims VICTORY!' : 'concedes defeat.';
  
  const sysMsg = await prisma.battleMessage.create({
    data: {
      match_id: matchId,
      type: 'system',
      content: `${emoji} ${req.user!.username} ${claimText}`,
    }
  });
  getIO().to(`match:${matchId}`).emit('new-message', sysMsg);
  
  const currentStatus = claimData.status || match.status;
  emitMatchUpdate(matchId, { claimUpdated: true, status: currentStatus });

  // Attempt to resolve match if both claims are in
  try {
    const { resolveMatchClaims } = require('../services/bot');
    await resolveMatchClaims(match.id, ''); // Empty chat ID since we are bypassing Telegram
    
    // Check if it got resolved
    const updatedMatch = await prisma.match.findUnique({ where: { id: match.id } });
    if (updatedMatch && updatedMatch.status !== match.status) {
      emitMatchUpdate(matchId, { status: updatedMatch.status, completed_at: updatedMatch.completed_at });
      
      if (updatedMatch.status === 'COMPLETED') {
        const resolveMsg = await prisma.battleMessage.create({
          data: { match_id: matchId, type: 'system', content: `🎉 Match has been officially resolved! Stakes have been distributed.` }
        });
        getIO().to(`match:${matchId}`).emit('new-message', resolveMsg);
      } else if (updatedMatch.status === 'DISPUTED') {
        const isBothLost = updatedMatch.challenger_claim === 'LOST' && updatedMatch.opponent_claim === 'LOST';
        const disputeReason = isBothLost ? "Both players conceded defeat." : "Both players claimed victory.";
        const disputeMsg = await prisma.battleMessage.create({
          data: { match_id: matchId, type: 'system', content: `⚠️ Match is DISPUTED! ${disputeReason} An admin will review.` }
        });
        getIO().to(`match:${matchId}`).emit('new-message', disputeMsg);
      }
    }
  } catch (err) {
    console.warn('[BATTLE-ROOM] resolveMatchClaims failed:', err);
  }

  res.json({ success: true, message: `Claim ${claim} recorded.` });
});

export default router;
