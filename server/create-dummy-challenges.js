const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createDummyChallenges() {
  try {
    // Get user IDs
    const user1 = await prisma.user.findUnique({ where: { telegram_username: '@testuser123' } });
    const user2 = await prisma.user.findUnique({ where: { telegram_username: '@testuser456' } });
    
    if (!user1 || !user2) {
      console.error('Test users not found');
      return;
    }

    // Get available rooms
    let rooms = await prisma.telegramRoom.findMany({ where: { status: 'AVAILABLE' } });
    
    // Create more rooms if needed
    if (rooms.length < 50) {
      console.log(`Creating ${50 - rooms.length} additional rooms...`);
      for (let i = rooms.length; i < 50; i++) {
        const newRoom = await prisma.telegramRoom.create({
          data: {
            chat_id: `auto_room_${Date.now()}_${i}`,
            invite_link: `https://t.me/joinchat/auto_${Date.now()}_${i}`,
            title: `Auto Battle Room ${i + 1}`,
            status: 'AVAILABLE',
          },
        });
        rooms.push(newRoom);
      }
    }

    const statuses = ['OPEN', 'ACCEPTED', 'BATTLE', 'COMPLETED'];
    const stakeAmounts = [2000, 3000, 5000, 7000, 10000];

    // Create 50 challenges
    for (let i = 0; i < 50; i++) {
      const isUser1 = i % 2 === 0;
      const challenger = isUser1 ? user1 : user2;
      const opponent = isUser1 ? user2 : user1;
      const room = rooms[i];
      const stakeAmount = stakeAmounts[i % stakeAmounts.length];
      const status = statuses[i % statuses.length];
      
      // Randomly decide if match has opponent
      const hasOpponent = status !== 'OPEN';
      
      const matchData = {
        challenger_id: challenger.id,
        opponent_id: hasOpponent ? opponent.id : null,
        stake_amount: stakeAmount,
        total_pot: hasOpponent ? stakeAmount * 2 : 0,
        commission: hasOpponent ? stakeAmount * 2 * 0.05 : 0,
        status: status,
        room_id: room.id,
        winner_id: status === 'COMPLETED' ? (Math.random() > 0.5 ? challenger.id : opponent.id) : null,
        loser_id: status === 'COMPLETED' ? (Math.random() > 0.5 ? opponent.id : challenger.id) : null,
        started_at: status === 'BATTLE' || status === 'COMPLETED' ? new Date(Date.now() - Math.random() * 3600000) : null,
        completed_at: status === 'COMPLETED' ? new Date(Date.now() - Math.random() * 3600000) : null,
      };

      const match = await prisma.match.create({ data: matchData });
      
      // Update room status
      if (status !== 'OPEN') {
        await prisma.telegramRoom.update({
          where: { id: room.id },
          data: { status: 'OCCUPIED', current_match_id: match.id }
        });
      } else {
        await prisma.telegramRoom.update({
          where: { id: room.id },
          data: { current_match_id: match.id }
        });
      }

      // Freeze funds for challenger
      await prisma.wallet.update({
        where: { user_id: challenger.id },
        data: {
          balance: { decrement: stakeAmount },
          frozen_amount: { increment: stakeAmount },
        },
      });

      // Freeze funds for opponent if exists
      if (hasOpponent) {
        await prisma.wallet.update({
          where: { user_id: opponent.id },
          data: {
            balance: { decrement: stakeAmount },
            frozen_amount: { increment: stakeAmount },
          },
        });
      }

      // Update win/loss counts for completed matches
      if (status === 'COMPLETED') {
        await prisma.user.update({
          where: { id: match.winner_id },
          data: { wins: { increment: 1 } },
        });
        await prisma.user.update({
          where: { id: match.loser_id },
          data: { losses: { increment: 1 } },
        });
      }

      console.log(`Created challenge ${i + 1}/50: ${status} - ${stakeAmount} MMK by ${challenger.username}`);
    }

    console.log('Successfully created 50 dummy challenges!');
  } catch (error) {
    console.error('Error creating dummy challenges:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDummyChallenges();
