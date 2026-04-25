const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser2() {
  try {
    const hash = await bcrypt.hash('password123', 10);
    
    const user = await prisma.user.create({
      data: {
        username: 'testuser2',
        password_hash: hash,
        telegram_username: '@testuser456',
        telegram_display_name: 'Test User 2',
        mlbb_server_id: '987654321',
        mlbb_zone_id: '2002',
        mlbb_ign: 'TestPlayer2',
      },
    });

    await prisma.wallet.create({
      data: { user_id: user.id },
    });

    // Add funds to wallet
    await prisma.wallet.update({
      where: { user_id: user.id },
      data: { balance: 50000 }
    });

    console.log('Test user 2 created:', user);
    console.log('Login credentials:');
    console.log('  Telegram: @testuser456');
    console.log('  MLBB Server ID: 987654321');
    console.log('  MLBB Zone ID: 2002');
    console.log('  Password: password123');
  } catch (error) {
    console.error('Error creating test user 2:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser2();
