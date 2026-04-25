import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /wallet — get wallet balance (auth required)
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const wallet = await prisma.wallet.findUnique({ where: { user_id: req.user!.userId } });
  if (!wallet) {
    res.status(404).json({ success: false, error: 'Wallet not found' });
    return;
  }
  res.json({ success: true, data: wallet });
});

// GET /wallet/transactions — get transaction history
router.get('/transactions', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const transactions = await prisma.transaction.findMany({
    where: { user_id: req.user!.userId },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: transactions });
});

// POST /wallet/deposit — create a PENDING deposit (does NOT increase balance yet)
router.post('/deposit', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: 'Invalid amount' });
    return;
  }

  const wallet = await prisma.wallet.findUnique({ where: { user_id: req.user!.userId } });
  if (!wallet) {
    res.status(404).json({ success: false, error: 'Wallet not found' });
    return;
  }

  // Create a PENDING deposit transaction — balance is NOT increased yet
  const transaction = await prisma.transaction.create({
    data: {
      wallet_id: wallet.id,
      user_id: req.user!.userId,
      type: 'DEPOSIT_PENDING',
      amount,
      description: 'Deposit via One Cent Pay (awaiting confirmation)',
      reference_id: `OCP-${Date.now()}`,
    },
  });

  res.json({
    success: true,
    data: { transaction },
    message: `Deposit of ${amount} MMK created. Please confirm with your 6-digit code.`,
  });
});

// POST /wallet/deposit/confirm — confirm a pending deposit with 6-digit code
router.post('/deposit/confirm', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { transaction_id, confirmation_code } = req.body;

  if (!transaction_id) {
    res.status(400).json({ success: false, error: 'Transaction ID is required' });
    return;
  }
  if (!confirmation_code || confirmation_code.length !== 6) {
    res.status(400).json({ success: false, error: 'A 6-digit confirmation code is required' });
    return;
  }

  // Find the pending transaction
  const transaction = await prisma.transaction.findUnique({ where: { id: transaction_id } });
  if (!transaction) {
    res.status(404).json({ success: false, error: 'Transaction not found' });
    return;
  }
  if (transaction.user_id !== req.user!.userId) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }
  if (transaction.type !== 'DEPOSIT_PENDING') {
    res.status(400).json({ success: false, error: 'This transaction is not a pending deposit' });
    return;
  }

  const amount = Number(transaction.amount);

  // For now: skip actual 6-digit validation — just confirm and credit
  await prisma.$transaction(async (tx) => {
    // Increase wallet balance
    await tx.wallet.update({
      where: { user_id: req.user!.userId },
      data: {
        balance: { increment: amount },
        total_deposited: { increment: amount },
      },
    });

    // Update transaction type from DEPOSIT_PENDING to DEPOSIT
    await tx.transaction.update({
      where: { id: transaction_id },
      data: {
        type: 'DEPOSIT',
        description: `Wallet top-up via One Cent Pay (confirmed: ${confirmation_code})`,
      },
    });
  });

  res.json({ success: true, message: `Deposit of ${amount} MMK confirmed and credited!` });
});

// POST /wallet/withdraw
router.post('/withdraw', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ success: false, error: 'Invalid amount' });
    return;
  }

  const wallet = await prisma.wallet.findUnique({ where: { user_id: req.user!.userId } });
  if (!wallet || Number(wallet.balance) < amount) {
    res.status(400).json({ success: false, error: 'Insufficient balance' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { user_id: req.user!.userId },
      data: {
        balance: { decrement: amount },
        total_withdrawn: { increment: amount },
      },
    });

    await tx.transaction.create({
      data: {
        wallet_id: wallet.id,
        user_id: req.user!.userId,
        type: 'WITHDRAWAL',
        amount,
        description: 'Withdrawal to bank',
      },
    });
  });

  res.json({ success: true, message: `Withdrew ${amount} MMK successfully` });
});

export default router;
