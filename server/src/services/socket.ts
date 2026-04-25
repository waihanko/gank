import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Join match room for real-time updates
    socket.on('join-match', (matchId: string) => {
      socket.join(`match:${matchId}`);
      console.log(`[SOCKET] ${socket.id} joined match:${matchId}`);
    });

    socket.on('leave-match', (matchId: string) => {
      socket.leave(`match:${matchId}`);
    });

    // Join user room for personal notifications
    socket.on('join-user', (userId: string) => {
      socket.join(`user:${userId}`);
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
