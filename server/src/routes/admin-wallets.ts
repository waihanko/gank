import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { adminMiddleware } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// All routes require admin authentication
router.use(adminMiddleware);

const walletSchema = z.object({
  type: z.string().min(1),
  account_number: z.string().regex(/^\d+$/, 'Account number must contain only digits'),
  holder_name: z.string().min(1, 'Holder name is required'),
  transaction_type: z.enum(['WITHDRAWAL', 'DEPOSIT', 'BOTH']),
  is_active: z.boolean().default(true),
});

// GET /api/admin/wallets — List all admin wallets
router.get('/', async (req: Request, res: Response) => {
  try {
    const wallets = await prisma.adminWallet.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json({ success: true, data: wallets });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch wallets' });
  }
});

// POST /api/admin/wallets — Add new wallet
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = walletSchema.parse(req.body);
    const wallet = await prisma.adminWallet.create({
      data: validated,
    });
    res.json({ success: true, data: wallet });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    res.status(500).json({ success: false, error: 'Failed to create wallet' });
  }
});

// PUT /api/admin/wallets/:id — Update wallet
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = walletSchema.partial().parse(req.body);
    const wallet = await prisma.adminWallet.update({
      where: { id: String(id) },
      data: validated,
    });
    res.json({ success: true, data: wallet });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message });
    }
    res.status(500).json({ success: false, error: 'Failed to update wallet' });
  }
});

// DELETE /api/admin/wallets/:id — Delete wallet
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.adminWallet.delete({ where: { id: String(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete wallet' });
  }
});

export default router;
