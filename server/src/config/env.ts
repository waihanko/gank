import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '4000'),
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY || '',
  ONE_CENT_PAY_API_KEY: process.env.ONE_CENT_PAY_API_KEY || '',
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Match timers (ms)
export const TIMERS = {
  READY_CHECK: 120_000,      // 2 min
  NEGOTIATION: 300_000,      // 5 min
  NOSHOW_WARNING: 180_000,   // 3 min
  BATTLE_MINIMUM: 600_000,   // 10 min
  SUBMISSION: 900_000,       // 15 min
  ROOM_WIPE_DELAY: 5_000,   // 5 sec
};

export const COMMISSION_RATE = 0.05;
export const ROOM_OCCUPANCY_FEE = 500;
export const MIN_STAKE = 500;
