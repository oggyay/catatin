import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || '6289999999999';
const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER || '6281234567890';

try {
  const admin = await prisma.user.findUnique({ where: { whatsappNumber: adminPhone } });
  const owner = await prisma.user.findUnique({ where: { whatsappNumber: ownerPhone } });

  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'platform_admin', status: 'active' },
    });
    console.log('Set platform_admin:', admin.whatsappNumber);
  }

  if (owner) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { role: 'owner', status: 'active' },
    });
    console.log('Set owner:', owner.whatsappNumber);
  }

  const users = await prisma.user.findMany({
    select: { name: true, whatsappNumber: true, role: true, tenantId: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(JSON.stringify(users, null, 2));
} finally {
  await prisma.$disconnect();
}
