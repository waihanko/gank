import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateToken, authMiddleware } from '../middleware/auth';
import { sendVc, loginWithVc, getBaseInfo } from '../services/mlbb';
import { verifyTelegramUsername } from '../services/telegram';

const router = Router();
const prisma = new PrismaClient();

// ========================
// STATE 1: Send VC (OTP)
// ========================
const sendVcSchema = z.object({
  server_id: z.string().min(1),
  zone_id: z.string().min(1),
});

router.post('/send-vc', async (req: Request, res: Response): Promise<void> => {
  try {
    const { server_id, zone_id } = sendVcSchema.parse(req.body);

    const success = await sendVc(server_id, zone_id);
    if (!success) {
      res.status(400).json({ success: false, error: 'Failed to send verification code. Please check your Server ID and Zone ID.' });
      return;
    }

    res.json({ success: true, message: 'Verification code sent to your MLBB in-game mail.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Server ID and Zone ID are required' });
      return;
    }
    console.error('[AUTH] sendVc error:', error);
    res.status(500).json({ success: false, error: 'Failed to send verification code' });
  }
});

// ========================
// STATE 1.5: Verify VC & Fetch Profile
// ========================
const verifyVcSchema = z.object({
  server_id: z.string().min(1),
  zone_id: z.string().min(1),
  vc: z.string().length(4, 'Verification code must be 4 digits'),
});

router.post('/verify-vc', async (req: Request, res: Response): Promise<void> => {
  try {
    const { server_id, zone_id, vc } = verifyVcSchema.parse(req.body);

    // Verify VC with MLBB
    const loginRes = await loginWithVc(server_id, zone_id, vc);
    if (!loginRes.success || !loginRes.jwt) {
      res.status(400).json({ success: false, error: loginRes.error || 'Invalid verification code' });
      return;
    }

    // Get Profile Info
    const profileRes = await getBaseInfo(loginRes.jwt);
    if (!profileRes.success || !profileRes.name) {
      res.status(400).json({ success: false, error: 'Failed to retrieve MLBB profile info' });
      return;
    }

    res.json({
      success: true,
      data: {
        mlbb_ign: profileRes.name,
        avatar_url: profileRes.avatar,
        level: profileRes.level,
        rank_level: profileRes.rank_level,
        reg_country: profileRes.reg_country
      },
      message: `MLBB Account verified: ${profileRes.name}`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[AUTH] verifyVc error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ========================
// STATE 2: Validate Telegram (Optional)
// ========================
const verifyTelegramSchema = z.object({
  telegram_username: z.string().regex(/^@[a-zA-Z0-9_]{5,32}$/, 'Must be @username format (5-32 chars)'),
});

router.post('/verify-telegram', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegram_username } = verifyTelegramSchema.parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { telegram_username },
    });
    if (existing) {
      res.status(400).json({ success: false, error: 'This Telegram username is already linked to another account' });
      return;
    }

    const tgAccount = await verifyTelegramUsername(telegram_username);
    if (!tgAccount.exists) {
      res.status(404).json({ success: false, error: 'This Telegram username does not exist. Please check your username.' });
      return;
    }

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
  vc: z.string().length(4, 'Verification code must be 4 digits'),
  telegram_username: z.string().regex(/^@/).optional().or(z.literal('')),
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

    const existingMLBB = await prisma.user.findFirst({
      where: { mlbb_server_id: data.server_id, mlbb_zone_id: data.zone_id },
    });
    if (existingMLBB) {
      res.status(400).json({ success: false, error: 'MLBB account already registered' });
      return;
    }

    if (data.telegram_username && data.telegram_username !== '') {
      const existingTG = await prisma.user.findUnique({
        where: { telegram_username: data.telegram_username },
      });
      if (existingTG) {
        res.status(400).json({ success: false, error: 'Telegram username already taken' });
        return;
      }
    }

    // Verify VC with MLBB
    const loginRes = await loginWithVc(data.server_id, data.zone_id, data.vc);
    if (!loginRes.success || !loginRes.jwt) {
      res.status(400).json({ success: false, error: loginRes.error || 'Invalid verification code' });
      return;
    }

    // Get Profile Info
    const profileRes = await getBaseInfo(loginRes.jwt);
    if (!profileRes.success || !profileRes.name) {
      res.status(400).json({ success: false, error: 'Failed to retrieve MLBB profile info' });
      return;
    }

    const password_hash = await bcrypt.hash(data.password, 12);
    const username = `${data.server_id}_${data.zone_id}`;

    const user = await prisma.$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          username: username,
          password_hash,
          telegram_username: data.telegram_username || null,
          telegram_display_name: data.telegram_display_name || null,
          telegram_bio: data.telegram_bio || null,
          mlbb_avatar_url: profileRes.avatar || null,
          avatar_url: profileRes.avatar || null, // Keep both for backward compatibility for now
          mlbb_server_id: data.server_id,
          mlbb_zone_id: data.zone_id,
          mlbb_ign: profileRes.name,
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
          avatar_url: user.mlbb_avatar_url || user.avatar_url,
        },
        token,
      },
      message: 'Account created successfully!',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    console.error('[AUTH] Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// ========================
// Login: MLBB (Only flow now)
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
          avatar_url: user.mlbb_avatar_url || user.avatar_url,
          wins: user.wins,
          losses: user.losses,
          wallet: userWithWallet?.wallet ? {
            balance: userWithWallet.wallet.balance,
            frozen_amount: userWithWallet.wallet.frozen_amount,
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
// Forgot Password Flow
// ========================
router.post('/forgot-password/send-vc', async (req: Request, res: Response): Promise<void> => {
  try {
    const { server_id, zone_id } = sendVcSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { mlbb_server_id: server_id, mlbb_zone_id: zone_id },
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'No account found with this Server ID and Zone ID.' });
      return;
    }

    const success = await sendVc(server_id, zone_id);
    if (!success) {
      res.status(400).json({ success: false, error: 'Failed to send verification code.' });
      return;
    }

    res.json({ success: true, message: 'Verification code sent to your MLBB in-game mail.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

const resetPasswordSchema = z.object({
  server_id: z.string().min(1),
  zone_id: z.string().min(1),
  vc: z.string().length(4, 'Verification code must be 4 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

router.post('/forgot-password/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { mlbb_server_id: data.server_id, mlbb_zone_id: data.zone_id },
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'No account found.' });
      return;
    }

    const loginRes = await loginWithVc(data.server_id, data.zone_id, data.vc);
    if (!loginRes.success || !loginRes.jwt) {
      res.status(400).json({ success: false, error: loginRes.error || 'Invalid verification code' });
      return;
    }

    const password_hash = await bcrypt.hash(data.password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash },
    });

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

// ========================
// Get current user profile
// ========================
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
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
      telegram_chat_id: user.telegram_chat_id,
      telegram_display_name: user.telegram_display_name,
      telegram_bio: user.telegram_bio,
      avatar_url: user.mlbb_avatar_url || user.avatar_url,
      wins: user.wins,
      losses: user.losses,
      wallet: user.wallet ? {
        balance: user.wallet.balance,
        frozen_amount: user.wallet.frozen_amount,
      } : null,
    },
  });
});

export default router;
