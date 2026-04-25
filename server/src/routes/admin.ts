import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { adminMiddleware, generateAdminToken } from '../middleware/auth';
import { z } from 'zod';
import { kickAndWipeRoom } from '../services/bot';

const router = Router();
const prisma = new PrismaClient();

// POST /admin/login — Admin authentication
const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateAdminToken({
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    res.json({
      success: true,
      data: {
        admin: { id: admin.id, email: admin.email, role: admin.role },
        token,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// All following admin routes require bearer token containing AdminAuthPayload
router.use(adminMiddleware);

// PUT /admin/profile/password — Update current admin password
router.put('/profile/password', async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Both passwords required' });
    return;
  }
  
  const adminId = req.admin?.adminId;
  if (!adminId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    res.status(404).json({ success: false, error: 'Admin not found' });
    return;
  }
  
  const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!isValid) {
    res.status(400).json({ success: false, error: 'Incorrect current password' });
    return;
  }
  
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.admin.update({
    where: { id: adminId },
    data: { password_hash: hashed }
  });
  
  res.json({ success: true });
});

// GET /admin/admins — list admins (Super Admin only)
router.get('/admins', async (req: Request, res: Response): Promise<void> => {
  if (req.admin?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Super Admin only' });
    return;
  }
  const admins = await prisma.admin.findMany({ select: { id: true, email: true, role: true, created_at: true } });
  res.json({ success: true, data: admins });
});

// POST /admin/admins — create new normal admin (Super Admin only)
const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/admins', async (req: Request, res: Response): Promise<void> => {
  if (req.admin?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Super Admin only' });
    return;
  }
  try {
    const { email, password } = createAdminSchema.parse(req.body);
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already used by another admin' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const newAdmin = await prisma.admin.create({
      data: { email, password_hash: hash, role: 'NORMAL_ADMIN' },
      select: { id: true, email: true, role: true, created_at: true },
    });
    res.json({ success: true, data: newAdmin });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to create admin' });
  }
});

// DELETE /admin/admins/:id — delete admin (Super Admin only)
router.delete('/admins/:id', async (req: Request, res: Response): Promise<void> => {
  if (req.admin?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Super Admin only' });
    return;
  }
  const adminId = req.params.id as string;
  if (adminId === req.admin.adminId) {
    res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    return;
  }
  try {
    await prisma.admin.delete({ where: { id: adminId } });
    res.json({ success: true, message: 'Admin deleted' });
  } catch {
    res.status(400).json({ success: false, error: 'Failed to delete' });
  }
});

// GET /admin/stats — dashboard stats
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const [totalUsers, totalMatches, activeMatches, pendingDisputes, rooms] = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
    prisma.match.count({ where: { status: { in: ['WAITING', 'READY_CHECK', 'NEGOTIATION', 'BATTLE', 'SUBMISSION'] } } }),
    prisma.dispute.count({ where: { status: 'PENDING' } }),
    prisma.telegramRoom.groupBy({ by: ['status'], _count: true }),
  ]);

  const totalRevenue = await prisma.platformRevenue.aggregate({ _sum: { amount: true } });

  res.json({
    success: true,
    data: {
      totalUsers,
      totalMatches,
      activeMatches,
      pendingDisputes,
      totalRevenue: totalRevenue._sum.amount || 0,
      rooms: rooms.reduce((acc: Record<string, number>, r: any) => ({ ...acc, [r.status]: r._count }), {}),
    },
  });
});

// GET /admin/users — list all users
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    include: { wallet: true },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, data: users });
});

// POST /admin/users/:id/ban
router.post('/users/:id/ban', async (req: Request, res: Response): Promise<void> => {
  const { reason } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { is_banned: true, ban_reason: reason || 'Banned by admin' },
  });
  res.json({ success: true, data: user });
});

// POST /admin/users/:id/notify
router.post('/users/:id/notify', async (req: Request, res: Response): Promise<void> => {
  const { title, message } = req.body;
  if (!title || !message) {
    res.status(400).json({ success: false, error: 'Title and message required' });
    return;
  }
  await prisma.notification.create({
    data: {
      user_id: req.params.id as string,
      title,
      message
    }
  });
  res.json({ success: true });
});

// POST /admin/users/:id/unban
router.post('/users/:id/unban', async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { is_banned: false, ban_reason: null },
  });
  res.json({ success: true, data: user });
});

// GET /admin/matches
router.get('/matches', async (req: Request, res: Response): Promise<void> => {
  const matches = await prisma.match.findMany({
    include: {
      challenger: { select: { id: true, username: true, mlbb_ign: true } },
      opponent: { select: { id: true, username: true, mlbb_ign: true } },
      room: true,
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: matches });
});

// GET /admin/disputes
router.get('/disputes', async (_req: Request, res: Response): Promise<void> => {
  const disputes = await prisma.dispute.findMany({
    include: {
      match: {
        include: {
          challenger: { select: { id: true, username: true, mlbb_ign: true } },
          opponent: { select: { id: true, username: true, mlbb_ign: true } },
        },
      },
      reporter: { select: { id: true, username: true } },
    },
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, data: disputes });
});

// POST /admin/disputes/:id/resolve
router.post('/disputes/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  const { winner_id, resolution } = req.body;
  const dispute = await prisma.dispute.findUnique({
    where: { id: req.params.id as string },
    include: { match: true },
  });

  if (!dispute) {
    res.status(404).json({ success: false, error: 'Dispute not found' });
    return;
  }

  const match = dispute.match;
  const stakeAmount = Number(match.stake_amount);

  await prisma.$transaction(async (tx: any) => {
    await tx.dispute.update({
      where: { id: dispute.id },
      data: { status: 'RESOLVED', resolution, resolved_at: new Date() },
    });

    if (winner_id) {
      // Award winner
      const loserId = winner_id === match.challenger_id ? match.opponent_id : match.challenger_id;
      const winnerPayout = Number(match.total_pot) - Number(match.commission);

      await tx.match.update({
        where: { id: match.id },
        data: { status: 'COMPLETED', winner_id, loser_id: loserId, completed_at: new Date() },
      });

      // Increment wins/losses on user
      await tx.user.update({ where: { id: winner_id }, data: { wins: { increment: 1 } } });
      if (loserId) {
        await tx.user.update({ where: { id: loserId }, data: { losses: { increment: 1 } } });
      }

      // Release winner payout
      await tx.wallet.update({
        where: { user_id: winner_id },
        data: { balance: { increment: winnerPayout }, frozen_amount: { decrement: stakeAmount }, total_won: { increment: winnerPayout } },
      });

      // Release loser's frozen amount (they lose it)
      if (loserId) {
        await tx.wallet.update({
          where: { user_id: loserId },
          data: { frozen_amount: { decrement: stakeAmount }, total_lost: { increment: stakeAmount } },
        });
      }

      // Record commission
      await tx.platformRevenue.create({ data: { match_id: match.id, amount: Number(match.commission) } });

      // Notifications
      await tx.notification.create({ data: { user_id: winner_id, title: 'Dispute Resolved — You Won! 🏆', message: `An admin resolved the dispute in your favor. ${winnerPayout.toLocaleString()} MMK added to wallet.` } });
      if (loserId) {
        await tx.notification.create({ data: { user_id: loserId, title: 'Dispute Resolved — You Lost 💀', message: `An admin resolved the dispute. You lost the match.` } });
      }
    } else {
      // Void & Refund both
      await tx.match.update({
        where: { id: match.id },
        data: { status: 'VOIDED', completed_at: new Date() },
      });

      // Refund challenger
      const challengerWallet = await tx.wallet.findUnique({ where: { user_id: match.challenger_id } });
      if (challengerWallet) {
        await tx.wallet.update({
          where: { user_id: match.challenger_id },
          data: { balance: { increment: stakeAmount }, frozen_amount: { decrement: stakeAmount } },
        });
        await tx.transaction.create({
          data: { wallet_id: challengerWallet.id, user_id: match.challenger_id, type: 'RELEASE', amount: stakeAmount, description: 'Stake refunded — match voided by admin', match_id: match.id },
        });
      }

      // Refund opponent
      if (match.opponent_id) {
        const opponentWallet = await tx.wallet.findUnique({ where: { user_id: match.opponent_id } });
        if (opponentWallet) {
          await tx.wallet.update({
            where: { user_id: match.opponent_id },
            data: { balance: { increment: stakeAmount }, frozen_amount: { decrement: stakeAmount } },
          });
          await tx.transaction.create({
            data: { wallet_id: opponentWallet.id, user_id: match.opponent_id, type: 'RELEASE', amount: stakeAmount, description: 'Stake refunded — match voided by admin', match_id: match.id },
          });
        }
      }

      await tx.notification.create({ data: { user_id: match.challenger_id, title: 'Match Voided ↩️', message: 'The disputed match was voided by an admin. Your stake has been refunded.' } });
      if (match.opponent_id) {
        await tx.notification.create({ data: { user_id: match.opponent_id, title: 'Match Voided ↩️', message: 'The disputed match was voided by an admin. Your stake has been refunded.' } });
      }
    }

    // Free the room
    if (match.room_id) {
      await tx.telegramRoom.update({ where: { id: match.room_id }, data: { status: 'AVAILABLE', current_match_id: null } });
    }
  });

  // Kick players and clean the Telegram room
  if (match.room_id) {
    const room = await prisma.telegramRoom.findUnique({ where: { id: match.room_id } });
    if (room?.chat_id) {
      // Run async — don't block the API response
      kickAndWipeRoom(room.chat_id, match.id).catch(err => {
        console.error('[ADMIN] Failed to clean room after dispute resolve:', err);
      });
    }
  }

  res.json({ success: true, message: 'Dispute resolved' });
});

// GET /admin/rooms
router.get('/rooms', async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query;
  const where = status && status !== 'All' ? { status: status as string } : {};
  const rooms = await prisma.telegramRoom.findMany({ where, orderBy: { created_at: 'asc' } });
  res.json({ success: true, data: rooms });
});

// POST /admin/rooms
const createRoomSchema = z.object({
  chat_id: z.string().min(1),
  title: z.string().min(1),
  invite_link: z.string().url(),
});
router.post('/rooms', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createRoomSchema.parse(req.body);
    const room = await prisma.telegramRoom.create({
      data: { ...data, status: 'AVAILABLE' }
    });
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to create room' });
  }
});

// PUT /admin/rooms/:id
router.put('/rooms/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.params.id as string;
    const { title, chat_id, invite_link } = req.body;
    
    const room = await prisma.telegramRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }

    const updated = await prisma.telegramRoom.update({
      where: { id: roomId },
      data: {
        title: title !== undefined ? title : room.title,
        chat_id: chat_id !== undefined ? chat_id : room.chat_id,
        invite_link: invite_link !== undefined ? invite_link : room.invite_link,
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update room' });
  }
});

// PATCH /admin/rooms/:id/status
router.patch('/rooms/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'PAUSED'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }
    const roomId = req.params.id as string;
    const room = await prisma.telegramRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    if (room.status === 'OCCUPIED') {
      res.status(400).json({ success: false, error: 'Cannot change status of an occupied room' });
      return;
    }
    const updated = await prisma.telegramRoom.update({
      where: { id: roomId },
      data: { status }
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update room status' });
  }
});

// DELETE /admin/rooms/:id — delete a room
router.delete('/rooms/:id', async (req: Request, res: Response): Promise<void> => {
  const roomId = req.params.id as string;
  try {
    const room = await prisma.telegramRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ success: false, error: 'Room not found' });
      return;
    }
    if (room.status === 'OCCUPIED') {
      res.status(400).json({ success: false, error: 'Cannot delete an occupied room. Wait for the match to complete or release the room first.' });
      return;
    }
    await prisma.telegramRoom.delete({ where: { id: roomId } });
    res.json({ success: true, message: `Room "${room.title}" deleted successfully` });
  } catch (error) {
    console.error('[ADMIN] Delete room error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete room' });
  }
});

// GET /admin/transactions
router.get('/transactions', async (_req: Request, res: Response): Promise<void> => {
  const transactions = await prisma.transaction.findMany({
    include: { user: { select: { username: true } } },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: transactions });
});

// GET /admin/revenue
router.get('/revenue', async (_req: Request, res: Response): Promise<void> => {
  const revenue = await prisma.platformRevenue.findMany({
    include: { match: { select: { id: true, stake_amount: true } } },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  const total = await prisma.platformRevenue.aggregate({ _sum: { amount: true } });
  res.json({ success: true, data: { items: revenue, total: total._sum.amount || 0 } });
});

export default router;
