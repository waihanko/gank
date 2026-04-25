import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get leaderboard data
router.get('/leaderboard', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        telegram_username: true,
        mlbb_ign: true,
        wins: true,
        losses: true,
        is_banned: true,
        created_at: true,
        wallet: {
          select: {
            balance: true,
            total_won: true,
            total_lost: true
          }
        }
      },
      where: {
        is_banned: false
      },
      orderBy: [
        { wins: 'desc' },
        { created_at: 'asc' }
      ]
    });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('[USERS] Leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

// Update Profile endpoint
router.put('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { telegram_username, telegram_display_name, telegram_bio, telegram_profile_image, mlbb_server_id, mlbb_zone_id, mlbb_ign } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    const updates: any = {};

    if (telegram_username && telegram_username !== user.telegram_username) {
      if (user.last_telegram_change && (now.getTime() - user.last_telegram_change.getTime()) < thirtyDays) {
        res.status(400).json({ success: false, error: 'Telegram username can only be changed once every 30 days.' });
        return;
      }
      const existing = await prisma.user.findUnique({ where: { telegram_username } });
      if (existing) {
        res.status(400).json({ success: false, error: 'Telegram username already taken.' });
        return;
      }
      
      updates.telegram_username = telegram_username.startsWith('@') ? telegram_username : `@${telegram_username}`;
      if (telegram_display_name !== undefined) updates.telegram_display_name = telegram_display_name;
      if (telegram_bio !== undefined) updates.telegram_bio = telegram_bio;
      if (telegram_profile_image !== undefined) updates.avatar_url = telegram_profile_image;
      updates.last_telegram_change = now;
    }

    if ((mlbb_server_id && mlbb_server_id !== user.mlbb_server_id) || (mlbb_zone_id && mlbb_zone_id !== user.mlbb_zone_id)) {
      if (user.last_mlbb_change && (now.getTime() - user.last_mlbb_change.getTime()) < thirtyDays) {
        res.status(400).json({ success: false, error: 'MLBB Server/Zone ID can only be changed once every 30 days.' });
        return;
      }
      
      updates.mlbb_server_id = mlbb_server_id || user.mlbb_server_id;
      updates.mlbb_zone_id = mlbb_zone_id || user.mlbb_zone_id;
      if (mlbb_ign) updates.mlbb_ign = mlbb_ign;
      updates.last_mlbb_change = now;
    }

    if (Object.keys(updates).length > 0) {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updates
      });
      res.json({ success: true, data: updatedUser });
    } else {
      res.json({ success: true, data: user });
    }
  } catch (error) {
    console.error('[USERS] Profile update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

export default router;
