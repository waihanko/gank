import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload {
  userId: string;
  username: string;
  mlbb_ign: string;
}

export interface AdminAuthPayload {
  adminId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      admin?: AdminAuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No admin token provided' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const secret = env.ADMIN_SECRET_KEY || env.JWT_SECRET;
    const decoded = jwt.verify(token, secret) as AdminAuthPayload;
    if (!decoded.adminId) {
      throw new Error('Not an admin token');
    }
    req.admin = decoded;
    next();
  } catch {
    res.status(403).json({ success: false, error: 'Forbidden' });
  }
}

import { SignOptions } from 'jsonwebtoken';

export function generateToken(payload: AuthPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function generateAdminToken(payload: AdminAuthPayload): string {
  const options: SignOptions = { expiresIn: '24h' };
  const secret = env.ADMIN_SECRET_KEY || env.JWT_SECRET;
  return jwt.sign(payload, secret, options);
}
