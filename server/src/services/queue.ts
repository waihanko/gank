import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env, TIMERS } from '../config/env';
import { revokeInviteLinks } from './bot';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

// ========================
// Match Job Queue
// ========================

export const matchQueue = new Queue('match-jobs', {
  connection: getRedisConnection(),
  defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
});

// ========================
// Job Schedulers
// ========================

export async function scheduleReadyCheckTimeout(matchId: string) {
  await matchQueue.add('ready-check-timeout', { matchId }, {
    delay: TIMERS.READY_CHECK,
    jobId: `ready-${matchId}`,
  });
  console.log(`[JOB] Scheduled ready-check-timeout for ${matchId} in ${TIMERS.READY_CHECK / 1000}s`);
}

export async function scheduleNegotiationTimeout(matchId: string) {
  await matchQueue.add('negotiation-timeout', { matchId }, {
    delay: TIMERS.NEGOTIATION,
    jobId: `negotiation-${matchId}`,
  });
  console.log(`[JOB] Scheduled negotiation-timeout for ${matchId} in ${TIMERS.NEGOTIATION / 1000}s`);
}

export async function scheduleNoshowWarning(matchId: string) {
  await matchQueue.add('noshow-warning', { matchId }, {
    delay: TIMERS.NOSHOW_WARNING,
    jobId: `noshow-${matchId}`,
  });
  console.log(`[JOB] Scheduled noshow-warning for ${matchId} in ${TIMERS.NOSHOW_WARNING / 1000}s`);
}

export async function scheduleBattleMinimum(matchId: string) {
  await matchQueue.add('battle-end', { matchId }, {
    delay: TIMERS.BATTLE_MINIMUM,
    jobId: `battle-${matchId}`,
  });
  console.log(`[JOB] Scheduled battle-end for ${matchId} in ${TIMERS.BATTLE_MINIMUM / 1000}s`);
}

export async function scheduleSubmissionTimeout(matchId: string) {
  await matchQueue.add('submission-timeout', { matchId }, {
    delay: TIMERS.SUBMISSION,
    jobId: `submission-${matchId}`,
  });
  console.log(`[JOB] Scheduled submission-timeout for ${matchId} in ${TIMERS.SUBMISSION / 1000}s`);
}

export async function scheduleRoomWipe(matchId: string, roomId: string) {
  await matchQueue.add('room-wipe', { matchId, roomId }, {
    delay: TIMERS.ROOM_WIPE_DELAY,
    jobId: `wipe-${matchId}`,
  });
  console.log(`[JOB] Scheduled room-wipe for ${matchId}`);
}

export async function schedulePendingJoinTimeout(matchId: string) {
  await matchQueue.add('pending-join-timeout', { matchId }, {
    delay: 5 * 60 * 1000, // 5 minutes
    jobId: `pending-join-${matchId}`,
  });
  console.log(`[JOB] Scheduled pending-join-timeout for ${matchId} in 5 minutes`);
}

export async function cancelJob(jobId: string) {
  try {
    const job = await matchQueue.getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[JOB] Canceled job ${jobId}`);
    }
  } catch (err) {
    console.warn(`[JOB] Failed to cancel job ${jobId} (Redis might be down):`, (err as Error).message);
  }
}

// ========================
// Job Worker
// ========================

export function startMatchWorker() {
  const worker = new Worker('match-jobs', async (job) => {
    console.log(`[WORKER] Processing ${job.name} for match ${job.data.matchId}`);

    switch (job.name) {
      case 'pending-join-timeout': {
        // Challenger didn't join Telegram within 5 minutes → cancel match, unfreeze
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        try {
          const match = await prisma.match.findUnique({
            where: { id: job.data.matchId },
            include: { room: true },
          });
          if (!match || match.status !== 'PENDING_JOIN') break;
          
          console.log(`[WORKER] Pending join expired → canceling match ${match.id}`);
          
          // Just cancel the match and free the room, no funds were frozen yet
          await prisma.$transaction(async (tx: any) => {
            await tx.match.update({
              where: { id: match.id },
              data: { status: 'CANCELLED' },
            });
          });
          
          if (match.room && match.room.chat_id) {
            await revokeInviteLinks(match.room.chat_id, [match.challenger_invite_link, match.opponent_invite_link]);
          }
          
          if (match.room_id) {
            await prisma.telegramRoom.update({
              where: { id: match.room_id },
              data: { status: 'AVAILABLE', current_match_id: null },
            });
          }
        } finally {
          await prisma.$disconnect();
        }
        break;
      }

      case 'ready-check-timeout':
        // Both didn't click READY → void match, refund 100%
        console.log(`[WORKER] Ready check expired → voiding match ${job.data.matchId}`);
        break;

      case 'negotiation-timeout':
        console.log(`[WORKER] Negotiation ended → starting battle ${job.data.matchId}`);
        break;

      case 'noshow-warning':
        console.log(`[WORKER] No-show confirmed → voiding match ${job.data.matchId}`);
        break;

      case 'battle-end':
        console.log(`[WORKER] Battle period over → submission phase ${job.data.matchId}`);
        break;

      case 'submission-timeout':
        console.log(`[WORKER] Submission timed out → voiding match ${job.data.matchId}`);
        break;

      case 'room-wipe': {
        // Kick players from room and reset it to AVAILABLE
        const { PrismaClient: PC2 } = require('@prisma/client');
        const p2 = new PC2();
        try {
          const { kickAndWipeRoom } = require('./bot');
          const room = await p2.telegramRoom.findUnique({ where: { id: job.data.roomId } });
          if (room) {
            await kickAndWipeRoom(room.chat_id, job.data.matchId);
            await p2.telegramRoom.update({
              where: { id: room.id },
              data: { status: 'AVAILABLE', current_match_id: null },
            });
            console.log(`[WORKER] Room ${room.title} wiped and recycled`);
          }
        } finally {
          await p2.$disconnect();
        }
        break;
      }
    }
  }, {
    connection: getRedisConnection(),
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[WORKER] Job ${job.name} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] Job ${job?.name} failed:`, err);
  });

  console.log('[WORKER] Match job worker started');
  return worker;
}
