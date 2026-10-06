import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const targetNumber = process.env.DEBUG_WHATSAPP_NUMBER || '6281234567890';
const user = await p.user.findUnique({ where: { whatsappNumber: targetNumber }, include: { tenant: true } });
console.log('USER:', JSON.stringify(user, null, 2));

const logs = await p.whatsappLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
console.log('WA LOGS:', JSON.stringify(logs, null, 2));

await p.$disconnect();
