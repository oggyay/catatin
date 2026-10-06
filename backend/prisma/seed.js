import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../src/config/defaults.js';
import { normalizeWhatsappNumber } from '../src/utils/phone.js';

const prisma = new PrismaClient();

async function main() {
  const rawDemo = process.env.DEMO_USER_WHATSAPP || '6281234567890';
  const demoWa = normalizeWhatsappNumber(rawDemo);
  const rawAdmin = process.env.PLATFORM_ADMIN_WHATSAPP || '6289999999999';
  const adminWa = normalizeWhatsappNumber(rawAdmin);

  console.log('Seeding CatatIN...');
  console.log('  Demo user WA:     ', demoWa);
  console.log('  Platform admin WA:', adminWa);

  // Demo tenant + user (idempotent)
  let demoUser = await prisma.user.findUnique({ where: { whatsappNumber: demoWa } });
  if (demoUser) {
    console.log('  Demo user sudah ada, dilewati.');
  } else {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Demo UMKM',
        type: 'umkm',
        subscriptionPlan: 'free',
        subscriptionStatus: 'trial',
      },
    });

    demoUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: 'Demo Owner',
        whatsappNumber: demoWa,
        role: 'owner',
        status: 'active',
      },
    });

    await prisma.account.create({
      data: {
        tenantId: tenant.id,
        name: 'Kas Tunai',
        type: 'cash',
        openingBalance: 0,
        currentBalance: 0,
        isDefault: true,
      },
    });

    await prisma.category.createMany({
      data: [
        ...DEFAULT_INCOME_CATEGORIES.map((name) => ({
          tenantId: tenant.id,
          name,
          type: 'income',
          isDefault: true,
        })),
        ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
          tenantId: tenant.id,
          name,
          type: 'expense',
          isDefault: true,
        })),
      ],
    });

    console.log('  Demo tenant dibuat:', tenant.id);
  }

  // Platform admin (idempotent)
  const adminExist = await prisma.user.findUnique({ where: { whatsappNumber: adminWa } });
  if (!adminExist) {
    await prisma.user.create({
      data: {
        name: 'Platform Admin',
        whatsappNumber: adminWa,
        role: 'platform_admin',
        status: 'active',
      },
    });
    console.log('  Platform admin dibuat.');
  } else {
    console.log('  Platform admin sudah ada, dilewati.');
  }

  console.log('Seed selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
