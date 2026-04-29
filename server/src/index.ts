import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/env';
import { initSocket } from './services/socket';
import { createBot, getBotWebhookHandler } from './services/bot';
import { startMatchWorker } from './services/queue';
import authRoutes from './routes/auth';
import matchRoutes from './routes/matches';
import walletRoutes from './routes/wallet';
import adminRoutes from './routes/admin';
import usersRoutes from './routes/users';
import notificationsRoutes from './routes/notifications';
import battleRoomRoutes from './routes/battle-room';
import { authMiddleware } from './middleware/auth';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    // Allow localhost, localtunnel, and configured frontend URL
    const allowed = [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:4000',
    ];
    if (allowed.includes(origin) || origin.endsWith('.loca.lt')) {
      return callback(null, true);
    }
    callback(null, true); // Allow all for development
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'good-game-api', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/battle-room', battleRoomRoutes);

// Telegram bot (polling mode for local dev)
const bot = createBot();

// Socket.io
initSocket(httpServer);

// BullMQ Worker (only start if Redis available)
try {
  startMatchWorker();
} catch (err) {
  console.warn('[WORKER] Redis not available, job worker disabled:', (err as Error).message);
}

// Start server
httpServer.listen(env.PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║     👻 Good Game API Server              ║
║     Port: ${env.PORT}                           ║
║     Env:  ${env.NODE_ENV}                  ║
╚══════════════════════════════════════════╝
  `);
  console.log(`[SERVER] API:       http://localhost:${env.PORT}`);
  console.log(`[SERVER] Health:    http://localhost:${env.PORT}/health`);
  console.log(`[SERVER] Socket.io: ws://localhost:${env.PORT}`);
  console.log(`[SERVER] Bot:       ${env.TELEGRAM_BOT_TOKEN ? 'Active' : 'Disabled (no token)'}`);
});

export default app;
