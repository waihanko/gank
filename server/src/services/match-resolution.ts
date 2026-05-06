import { PrismaClient } from '@prisma/client';
import { emitMatchUpdate } from './socket';

const prisma = new PrismaClient();
const resolvingMatches = new Set<string>();

/**
 * Resolves match claims and performs payouts/disputes.
 * This logic is independent of the communication channel (Telegram vs In-App).
 */
export async function resolveMatchClaims(matchId: string) {
  if (resolvingMatches.has(matchId)) {
    console.log(`[MATCH-RESOLUTION] ⏭️ resolveMatchClaims already in progress for ${matchId}, skipping`);
    return;
  }
  resolvingMatches.add(matchId);

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        challenger: { include: { wallet: true } },
        opponent: { include: { wallet: true } },
      },
    });

    if (!match || !match.challenger_claim || !match.opponent_claim) return;

    if (['COMPLETED', 'DISPUTED', 'VOIDED', 'CANCELLED'].includes(match.status)) {
      console.log(`[MATCH-RESOLUTION] ⏭️ Match ${matchId} already resolved (status: ${match.status}), skipping`);
      return;
    }

    // Case 1: One says WON, other says LOST → auto-resolve
    if (
      (match.challenger_claim === 'WON' && match.opponent_claim === 'LOST') ||
      (match.challenger_claim === 'LOST' && match.opponent_claim === 'WON')
    ) {
      const winnerId = match.challenger_claim === 'WON' ? match.challenger_id : match.opponent_id;
      const loserId = match.challenger_claim === 'WON' ? match.opponent_id : match.challenger_id;
      const winnerName = match.challenger_claim === 'WON' 
        ? (match.challenger?.username || 'Challenger') 
        : (match.opponent?.username || 'Opponent');
      const loserName = match.challenger_claim === 'LOST' 
        ? (match.challenger?.username || 'Challenger') 
        : (match.opponent?.username || 'Opponent');

      if (!winnerId || !loserId) return;

      const winnerPayout = Number(match.total_pot) - Number(match.commission);
      const stakeAmount = Number(match.stake_amount);

      await prisma.$transaction(async (tx: any) => {
        await tx.match.update({
          where: { id: matchId },
          data: { status: 'COMPLETED', winner_id: winnerId, loser_id: loserId, completed_at: new Date() },
        });
        await tx.user.update({ where: { id: winnerId }, data: { wins: { increment: 1 } } });
        await tx.user.update({ where: { id: loserId }, data: { losses: { increment: 1 } } });
        await tx.wallet.update({
          where: { user_id: winnerId },
          data: { balance: { increment: winnerPayout }, frozen_amount: { decrement: stakeAmount } },
        });
        await tx.wallet.update({
          where: { user_id: loserId },
          data: { frozen_amount: { decrement: stakeAmount } },
        });

        const rateUsed = Number(match.total_pot) > 0 ? Number(match.commission) / Number(match.total_pot) : 0.05;
        await tx.platformRevenue.create({ 
          data: { 
            match_id: matchId, 
            amount: Number(match.commission),
            rate: rateUsed
          } 
        });

        const winnerWallet = winnerId === match.challenger_id ? match.challenger?.wallet : match.opponent?.wallet;

        if (winnerWallet) {
          await tx.transaction.create({
            data: {
              wallet_id: winnerWallet.id,
              user_id: winnerId,
              type: 'PAYOUT',
              amount: winnerPayout,
              description: `Match winnings (Commission: ${Number(match.commission).toLocaleString()} MMK)`,
              match_id: matchId,
            }
          });

          await tx.transaction.create({
            data: {
              wallet_id: winnerWallet.id,
              user_id: winnerId,
              type: 'COMMISSION',
              amount: Number(match.commission),
              description: `Platform fee for match ${matchId.substring(0, 8)}`,
              match_id: matchId,
            }
          });
        }
      });

      await prisma.notification.create({ data: { user_id: winnerId, title: 'Victory! 🏆', message: `You won the match! ${winnerPayout.toLocaleString()} MMK has been added to your wallet.` } });
      await prisma.notification.create({ data: { user_id: loserId, title: 'Defeat 💀', message: `You lost the match. Better luck next time!` } });

      console.log(`[MATCH-RESOLUTION] ✅ Match ${matchId} auto-resolved: ${winnerName} won`);
    }

    // Case 2: Both claim WON or Both claim LOST -> auto-dispute
    else if (match.challenger_claim === match.opponent_claim) {
      const isBothLost = match.challenger_claim === 'LOST';
      const claimText = isBothLost ? 'DEFEAT' : 'VICTORY';
      
      console.log(`[MATCH-RESOLUTION] ⚠️ Both players claim ${match.challenger_claim} for match ${matchId} — creating dispute`);

      await prisma.match.update({ where: { id: matchId }, data: { status: 'DISPUTED' } });

      await prisma.dispute.create({
        data: {
          match_id: matchId,
          reported_by_id: match.challenger_id,
          reason: isBothLost ? 'Both players claim defeat. Admin review required.' : 'Both players claim victory. Admin review required.',
          status: 'PENDING',
        },
      });

      await prisma.notification.create({ data: { user_id: match.challenger_id, title: '⚠️ Match Disputed', message: `Both players claimed ${claimText.toLowerCase()}. An admin will review the match.` } });
      if (match.opponent_id) {
        await prisma.notification.create({ data: { user_id: match.opponent_id, title: '⚠️ Match Disputed', message: `Both players claimed ${claimText.toLowerCase()}. An admin will review the match.` } });
      }
    }
  } finally {
    resolvingMatches.delete(matchId);
  }
}
