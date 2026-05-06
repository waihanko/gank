import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthPayload } from '../middleware/auth';

let io: Server | null = null;
const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      // Allow unauthenticated connections, but don't set user
      // Useful for global public lobby updates
      return next();
    }
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      socket.user = decoded;
      next();
    } catch (err) {
      // We still allow connection, but without user payload
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[SOCKET] Client connected: ${socket.id} (User: ${socket.user?.username || 'Guest'})`);

    // Join match room for real-time updates
    socket.on('join-match', async (matchId: string) => {
      // Optional: check if user is part of match if we want to restrict spectators
      socket.join(`match:${matchId}`);
      console.log(`[SOCKET] ${socket.id} joined match:${matchId}`);
    });

    socket.on('leave-match', (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });

    // Join user room for personal notifications
    socket.on('join-user', (userId: string) => {
      // Only allow joining your own user room
      if (socket.user && socket.user.userId === userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Handle new battle room chat messages
    socket.on('send-message', async (data: { matchId: string; type: string; content: string; media_url?: string }) => {
      if (!socket.user) return; // Require auth to send messages
      
      const { matchId, type, content, media_url } = data;
      
      try {
        // Save to DB
        const savedMessage = await prisma.battleMessage.create({
          data: {
            match_id: matchId,
            sender_id: socket.user.userId,
            type: type || 'text',
            content: content,
            media_url: media_url || null,
          },
          include: {
            sender: { select: { id: true, username: true, mlbb_ign: true, mlbb_avatar_url: true } }
          }
        });

        // Broadcast to the room
        io?.to(`match:${matchId}`).emit('new-message', savedMessage);
        
      } catch (err) {
        console.error('[SOCKET] Failed to save/send message:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[SOCKET] Socket.io initialized');
  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

// Emit helpers
export function emitMatchUpdate(matchId: string, data: Record<string, unknown>) {
  if (io) io.to(`match:${matchId}`).emit('match-update', data);
}

export function emitUserNotification(userId: string, data: Record<string, unknown>) {
  if (io) io.to(`user:${userId}`).emit('notification', data);
}
