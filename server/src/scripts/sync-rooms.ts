import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncHostedCounts() {
  console.log('🔄 Syncing hosted matches counts...');
  const rooms = await prisma.telegramRoom.findMany();
  
  for (const room of rooms) {
    const count = await prisma.match.count({
      where: { room_id: room.id }
    });
    
    await prisma.telegramRoom.update({
      where: { id: room.id },
      data: { total_matches_hosted: count }
    });
    
    console.log(`✅ Room "${room.title}": ${count} matches`);
  }
  
  console.log('✨ Sync complete!');
}

syncHostedCounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
