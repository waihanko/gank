import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncHostedCounts() {
  console.log('🔄 Checking match counts per group...');
  const groups = await prisma.telegramGroup.findMany();
  
  for (const group of groups) {
    const count = await prisma.match.count({
      where: { room_id: group.id }
    });
    
    console.log(`✅ Group "${group.title}": ${count} matches total`);
  }
  
  console.log('✨ Check complete!');
}

syncHostedCounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
