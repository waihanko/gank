import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/announcements — Fetch active announcements (Public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        is_active: true,
        starts_at: { lte: now },
        ends_at: { gte: now },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
  }
});

// GET /api/announcements/admin — Fetch all announcements (Admin)
router.get('/admin', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch announcements' });
  }
});

// POST /api/announcements — Create announcement (Admin)
router.post('/', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, content, image_url, link_url, starts_at, ends_at, is_active } = req.body;
    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        image_url,
        link_url,
        starts_at: new Date(starts_at),
        ends_at: new Date(ends_at),
        is_active: is_active !== undefined ? is_active : true,
      },
    });
    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create announcement' });
  }
});

// PUT /api/announcements/:id — Update announcement (Admin)
router.put('/:id', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, image_url, link_url, starts_at, ends_at, is_active } = req.body;
    const announcement = await prisma.announcement.update({
      where: { id: id as string },
      data: {
        title,
        content,
        image_url,
        link_url,
        starts_at: starts_at ? new Date(starts_at) : undefined,
        ends_at: ends_at ? new Date(ends_at) : undefined,
        is_active,
      },
    });
    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update announcement' });
  }
});

// DELETE /api/announcements/:id — Delete announcement (Admin)
router.delete('/:id', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({ where: { id: id as string } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete announcement' });
  }
});

export default router;
