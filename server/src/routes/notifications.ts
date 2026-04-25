import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /notifications — list user notifications
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const notifications = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({
    where: { user_id: userId, is_read: false },
  });
  res.json({ success: true, data: notifications, unreadCount });
});

// PUT /notifications/:id/read — mark one as read
router.put('/:id/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const id = req.params.id as string;
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif || notif.user_id !== userId) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  await prisma.notification.update({
    where: { id },
    data: { is_read: true },
  });
  res.json({ success: true });
});

// PUT /notifications/read-all — mark all as read
router.put('/read-all', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await prisma.notification.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true },
  });
  res.json({ success: true });
});

export default router;
