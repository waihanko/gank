import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateToken } from '../middleware/auth';
import { verifyMLBBAccount } from '../services/mlbb';
import { verifyTelegramUsername } from '../services/telegram';

const router = Router();
const prisma = new PrismaClient();

// ========================
// STATE 1: Verify MLBB ID
// ========================
const verifyMLBBSchema = z.object({
  server_id: z.string().min(1),
  zone_id: z.string().min(1),
});

router.post('/verify-mlbb', async (req: Request, res: Response): Promise<void> => {
  try {
    const { server_id, zone_id } = verifyMLBBSchema.parse(req.body);

    // Check if already registered
    const existing = await prisma.user.findFirst({
      where: { mlbb_server_id: server_id, mlbb_zone_id: zone_id },
    });
    if (existing) {
      res.status(400).json({ success: false, error: 'This MLBB account is already registered' });
      return;
    }

    // Call external MLBB API
    const account = await verifyMLBBAccount(server_id, zone_id);
    if (!account.found) {
      res.status(404).json({ success: false, error: 'MLBB account not found. Check your Server ID and Zone ID.' });
      return;
    }

    res.json({
      success: true,
      data: {
        mlbb_ign: account.username,
        region: account.region,
        server_id,
        zone_id,
      },
      message: `Found: ${account.username} (${account.region})`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Server ID and Zone ID are required' });
      return;
    }
    console.error('[AUTH] MLBB verify error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ========================
// STATE 2: Validate Telegram Username
// ========================
const verifyTelegramSchema = z.object({
  telegram_username: z.string().regex(/^@[a-zA-Z0-9_]{5,32}$/, 'Must be @username format (5-32 chars)'),
});

router.post('/verify-telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegram_username } = verifyTelegramSchema.parse(req.body);

    // Check if already used in our DB
    const existing = await prisma.user.findUnique({
      where: { telegram_username },
    });
    if (existing) {
      res.status(400).json({ success: false, error: 'This Telegram username is already linked to another account' });
      return;
    }

    // Verify username exists on Telegram
    const tgAccount = await verifyTelegramUsername(telegram_username);
    if (!tgAccount.exists) {
      res.status(404).json({ success: false, error: 'This Telegram username does not exist. Please check your username.' });
      return;
    }

    // Only allow real user accounts (block bots, channels, groups)
    if (tgAccount.type !== 'user' && tgAccount.type !== 'unknown') {
      res.status(400).json({ success: false, error: `Only personal Telegram accounts are allowed. This is a ${tgAccount.type}.` });
      return;
    }

    res.json({
      success: true,
      data: {
        telegram_username,
        display_name: tgAccount.displayName,
        bio: tgAccount.bio,
        type: tgAccount.type,
        profile_image: tgAccount.profileImage,
      },
      message: `Telegram verified: ${tgAccount.displayName}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

// ========================
// STATE 3: Create Account
// ========================
const registerSchema = z.object({
  server_id: z.string().min(1),
  zone_id: z.string().min(1),
  mlbb_ign: z.string().min(1),
  telegram_username: z.string().regex(/^@/),
  telegram_display_name: z.string().nullable().optional(),
  telegram_bio: z.string().nullable().optional(),
  telegram_profile_image: z.string().nullable().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    // Double-check uniqueness
    const existingMLBB = await prisma.user.findFirst({
      where: { mlbb_server_id: data.server_id, mlbb_zone_id: data.zone_id },
    });
    if (existingMLBB) {
      res.status(400).json({ success: false, error: 'MLBB account already registered' });
      return;
    }

    const existingTG = await prisma.user.findUnique({
      where: { telegram_username: data.telegram_username },
    });
    if (existingTG) {
      res.status(400).json({ success: false, error: 'Telegram username already taken' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(data.password, 12);

    // Create user + wallet atomically
    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          username: data.mlbb_ign,
          password_hash,
          telegram_username: data.telegram_username,
          telegram_display_name: data.telegram_display_name || null,
          telegram_bio: data.telegram_bio || null,
          avatar_url: (data.telegram_profile_image && data.telegram_profile_image !== 'https://telegram.org/img/t_logo_2x.png') ? data.telegram_profile_image : null,
          mlbb_server_id: data.server_id,
          mlbb_zone_id: data.zone_id,
          mlbb_ign: data.mlbb_ign,
        },
      });

      await tx.wallet.create({
        data: { user_id: newUser.id },
      });

      return newUser;
    });

    const token = generateToken({
      userId: user.id,
      username: user.username,
      mlbb_ign: user.mlbb_ign,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          mlbb_ign: user.mlbb_ign,
          telegram_username: user.telegram_username,
          avatar_url: user.avatar_url,
        },
        token,
      },
      message: 'Account created successfully!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[AUTH] Zod validation error:', error.errors);
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    // Handle Prisma unique constraint violations
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any;
      if (prismaError.code === 'P2002') {
        const target = prismaError.meta?.target;
        if (target?.includes('username')) {
          res.status(400).json({ success: false, error: 'This username is already taken. Please use a different MLBB account.' });
          return;
        }
        if (target?.includes('telegram_username')) {
          res.status(400).json({ success: false, error: 'This Telegram username is already linked to another account.' });
          return;
        }
        if (target?.includes('mlbb_server_id')) {
          res.status(400).json({ success: false, error: 'This MLBB account is already registered.' });
          return;
        }
        res.status(400).json({ success: false, error: 'An account with these details already exists.' });
        return;
      }
    }
    console.error('[AUTH] Register error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body
    });
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// ========================
// Login: Telegram Tab
// ========================
const loginTelegramSchema = z.object({
  telegram_username: z.string().regex(/^@/),
  password: z.string().min(1),
});

router.post('/login/telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegram_username, password } = loginTelegramSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { telegram_username } });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
    if (user.is_banned) {
      res.status(403).json({ success: false, error: `Account banned: ${user.ban_reason || 'Contact admin'}` });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      mlbb_ign: user.mlbb_ign,
    });

    const userWithWallet = await prisma.user.findUnique({
      where: { id: user.id },
      include: { wallet: true },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          mlbb_ign: user.mlbb_ign,
          mlbb_server_id: user.mlbb_server_id,
          mlbb_zone_id: user.mlbb_zone_id,
          telegram_username: user.telegram_username,
          telegram_display_name: user.telegram_display_name,
          telegram_bio: user.telegram_bio,
          avatar_url: user.avatar_url,
          wins: user.wins,
          losses: user.losses,
          wallet: userWithWallet?.wallet ? {
            balance: userWithWallet.wallet.balance,
            frozen_amount: userWithWallet.wallet.frozen_amount,
            total_won: userWithWallet.wallet.total_won,
            total_lost: userWithWallet.wallet.total_lost,
          } : null,
        },
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

// ========================
// Login: MLBB Tab
// ========================
const loginMLBBSchema = z.object({
  server_id: z.string().min(1),
  zone_id: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login/mlbb', async (req: Request, res: Response): Promise<void> => {
  try {
    const { server_id, zone_id, password } = loginMLBBSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { mlbb_server_id: server_id, mlbb_zone_id: zone_id },
    });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }
    if (user.is_banned) {
      res.status(403).json({ success: false, error: `Account banned: ${user.ban_reason || 'Contact admin'}` });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      mlbb_ign: user.mlbb_ign,
    });

    const userWithWallet = await prisma.user.findUnique({
      where: { id: user.id },
      include: { wallet: true },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          mlbb_ign: user.mlbb_ign,
          mlbb_server_id: user.mlbb_server_id,
          mlbb_zone_id: user.mlbb_zone_id,
          telegram_username: user.telegram_username,
          telegram_display_name: user.telegram_display_name,
          telegram_bio: user.telegram_bio,
          avatar_url: user.avatar_url,
          wins: user.wins,
          losses: user.losses,
          wallet: userWithWallet?.wallet ? {
            balance: userWithWallet.wallet.balance,
            frozen_amount: userWithWallet.wallet.frozen_amount,
            total_won: userWithWallet.wallet.total_won,
            total_lost: userWithWallet.wallet.total_lost,
          } : null,
        },
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

// ========================
// Get current user profile
// ========================
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { wallet: true },
  });

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      mlbb_ign: user.mlbb_ign,
      mlbb_server_id: user.mlbb_server_id,
      mlbb_zone_id: user.mlbb_zone_id,
      telegram_username: user.telegram_username,
      telegram_display_name: user.telegram_display_name,
      telegram_bio: user.telegram_bio,
      avatar_url: user.avatar_url,
      wins: user.wins,
      losses: user.losses,
      wallet: user.wallet ? {
        balance: user.wallet.balance,
        frozen_amount: user.wallet.frozen_amount,
        total_won: user.wallet.total_won,
        total_lost: user.wallet.total_lost,
      } : null,
    },
  });
});

// ========================
// Sync Telegram Profile
// ========================
router.post('/sync-profile', async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const tgAccount = await verifyTelegramUsername(user.telegram_username);
    if (tgAccount.exists) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          telegram_display_name: tgAccount.displayName,
          telegram_bio: tgAccount.bio,
          avatar_url: tgAccount.profileImage,
        },
        include: { wallet: true },
      });

      res.json({
        success: true,
        data: {
          id: updatedUser.id,
          username: updatedUser.username,
          mlbb_ign: updatedUser.mlbb_ign,
          telegram_username: updatedUser.telegram_username,
          avatar_url: updatedUser.avatar_url,
          telegram_display_name: updatedUser.telegram_display_name,
          telegram_bio: updatedUser.telegram_bio,
        },
      });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sync failed' });
  }
});

export default router;
