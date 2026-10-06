import { prisma } from '../src/config/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
  });

  let identitiesCreated = 0;
  let membersCreated = 0;
  let usersLinked = 0;

  for (const user of users) {
    const activeNumber = user.deletedAt ? user.deletedWhatsappNumber || user.whatsappNumber : user.whatsappNumber;

    let identity = await prisma.accountIdentity.findFirst({
      where: {
        OR: [
          ...(activeNumber ? [{ whatsappNumber: activeNumber }] : []),
          ...(user.whatsappJid ? [{ whatsappJid: user.whatsappJid }] : []),
        ],
      },
    });

    if (!identity) {
      identity = await prisma.accountIdentity.create({
        data: {
          name: user.name,
          whatsappNumber: activeNumber,
          whatsappJid: user.whatsappJid,
          status: user.status,
          activeTenantId: user.tenantId || null,
        },
      });
      identitiesCreated += 1;
    } else {
      const patch = {};
      if (!identity.whatsappJid && user.whatsappJid) patch.whatsappJid = user.whatsappJid;
      if (!identity.activeTenantId && user.tenantId) patch.activeTenantId = user.tenantId;
      if (Object.keys(patch).length > 0) {
        identity = await prisma.accountIdentity.update({ where: { id: identity.id }, data: patch });
      }
    }

    if (user.identityId !== identity.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { identityId: identity.id },
      });
      usersLinked += 1;
    }

    if (user.tenantId) {
      const existingMember = await prisma.tenantMember.findUnique({
        where: {
          accountId_tenantId: {
            accountId: identity.id,
            tenantId: user.tenantId,
          },
        },
      });

      if (!existingMember) {
        await prisma.tenantMember.create({
          data: {
            accountId: identity.id,
            tenantId: user.tenantId,
            role: user.role,
            status: user.status,
            deletedAt: user.deletedAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        });
        membersCreated += 1;
      }
    }
  }

  console.log(JSON.stringify({ identitiesCreated, membersCreated, usersLinked, usersProcessed: users.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
