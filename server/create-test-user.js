const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const hash = await bcrypt.hash('password123', 10);
    
    const user = await prisma.user.create({
      data: {
        username: 'testuser',
        password_hash: hash,
        telegram_username: '@testuser123',
        telegram_display_name: 'Test User',
        mlbb_server_id: '123456789',
        mlbb_zone_id: '2001',
        mlbb_ign: 'TestPlayer',
      },
    });

    await prisma.wallet.create({
      data: { user_id: user.id },
    });

    console.log('Test user created:', user);
    console.log('Login credentials:');
    console.log('  Telegram: @testuser123');
    console.log('  MLBB Server ID: 123456789');
    console.log('  MLBB Zone ID: 2001');
    console.log('  Password: password123');
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
