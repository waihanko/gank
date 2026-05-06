import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getSystemSetting(key: string, defaultValue: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key }
    });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`[SETTINGS] Error fetching ${key}:`, error);
    return defaultValue;
  }
}

export async function getCommissionRate(): Promise<number> {
  const rate = await getSystemSetting('commission_rate', '0.05');
  return parseFloat(rate);
}
