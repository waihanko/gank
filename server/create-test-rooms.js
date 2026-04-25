const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestRooms() {
  try {
    // Create 5 test Telegram rooms
    const rooms = [];
    for (let i = 1; i <= 5; i++) {
      const room = await prisma.telegramRoom.upsert({
        where: { chat_id: `test_room_${i}` },
        update: {},
        create: {
          chat_id: `test_room_${i}`,
          invite_link: `https://t.me/joinchat/test_room_${i}`,
          title: `Ghost Referee Battle Room ${i}`,
          status: 'AVAILABLE',
          total_matches_hosted: 0,
        },
      });
      rooms.push(room);
    }

    console.log('Test rooms created:', rooms);
    console.log('Room IDs for testing:');
    rooms.forEach(room => console.log(`  ${room.title}: ${room.chat_id}`));
  } catch (error) {
    console.error('Error creating test rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestRooms();
