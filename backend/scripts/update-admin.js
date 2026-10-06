import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { normalizeWhatsappNumber } from '../src/utils/phone.js';

const prisma = new PrismaClient();
const newWa = normalizeWhatsappNumber(process.env.NEW_ADMIN_WHATSAPP || '6289999999998');
const oldWa = process.env.OLD_ADMIN_WHATSAPP || '6289999999999';

try {
  const oldUser = await prisma.user.findUnique({ where: { whatsappNumber: oldWa } });
  if (oldUser) {
    const existNew = await prisma.user.findUnique({ where: { whatsappNumber: newWa } });
    if (existNew && existNew.id !== oldUser.id) {
      await prisma.user.update({
        where: { id: existNew.id },
        data: { role: 'platform_admin', status: 'active' },
      });
      await prisma.user.delete({ where: { id: oldUser.id } });
      console.log('Promoted existing user to admin, removed old admin:', newWa);
    } else {
      const updated = await prisma.user.update({
        where: { id: oldUser.id },
        data: { whatsappNumber: newWa },
      });
      console.log('Updated admin WA to:', updated.whatsappNumber);
    }
  } else {
    const existing = await prisma.user.findUnique({ where: { whatsappNumber: newWa } });
    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'platform_admin', status: 'active' },
      });
      console.log('Promoted user to platform_admin:', updated.whatsappNumber);
    } else {
      const created = await prisma.user.create({
        data: {
          name: 'Platform Admin',
          whatsappNumber: newWa,
          role: 'platform_admin',
          status: 'active',
        },
      });
      console.log('Created admin:', created.whatsappNumber);
    }
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
