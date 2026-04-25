const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password_hash: hash,
      role: 'SUPER_ADMIN'
    },
    create: {
      email: 'admin@gmail.com',
      password_hash: hash,
      role: 'SUPER_ADMIN'
    }
  });
  console.log('Admin seeded:', admin);
}

main().catch(console.error).finally(() => prisma.$disconnect());
