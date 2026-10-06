import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/error.js';
import { authenticate, requirePlatformAdmin } from '../middleware/auth.js';
import { normalizeWhatsappNumber } from '../utils/phone.js';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from '../config/defaults.js';

const router = Router();
router.use(authenticate, requirePlatformAdmin);

const tenantStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const subscriptionSchema = z.object({
  subscriptionPlan: z.enum(['free', 'basic', 'pro']).optional(),
  subscriptionStatus: z.enum(['active', 'suspended', 'trial', 'inactive']).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
});

const createTenantSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['personal', 'umkm']).default('personal'),
  ownerName: z.string().min(2),
  ownerWhatsappNumber: z.string().min(6),
  subscriptionPlan: z.enum(['free', 'basic', 'pro']).default('free'),
  subscriptionStatus: z.enum(['active', 'suspended', 'trial', 'inactive']).default('trial'),
  trialEndsAt: z.string().datetime().nullable().optional(),
});

const adminUserCreateSchema = z.object({
  name: z.string().min(2),
  whatsappNumber: z.string().min(6),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
});

const adminUserUpdateSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});

async function ensureCanDeactivateOrDeleteUser({ tenantId, user }) {
  if (user.role !== 'owner' || user.status !== 'active') return;
  const ownerCount = await prisma.user.count({
    where: { tenantId, role: 'owner', status: 'active', deletedAt: null },
  });
  if (ownerCount <= 1) {
    throw new HttpError(409, 'Tenant harus memiliki minimal satu owner aktif');
  }
}

async function ensureCanDemoteOwner({ tenantId, user, nextRole }) {
  if (!nextRole || user.role !== 'owner' || nextRole === 'owner') return;
  await ensureCanDeactivateOrDeleteUser({ tenantId, user });
}

router.get(
  '/tenants',
  asyncHandler(async (req, res) => {
    const tenants = await prisma.tenant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, transactions: true } },
      },
    });
    res.json({
      data: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        subscriptionPlan: t.subscriptionPlan,
        subscriptionStatus: t.subscriptionStatus,
        trialEndsAt: t.trialEndsAt,
        deletedAt: t.deletedAt,
        usersCount: t._count.users,
        transactionsCount: t._count.transactions,
        createdAt: t.createdAt,
      })),
    });
  })
);

router.post(
  '/tenants',
  asyncHandler(async (req, res) => {
    const payload = createTenantSchema.parse(req.body);
    const ownerWhatsappNumber = normalizeWhatsappNumber(payload.ownerWhatsappNumber);

    const exists = await prisma.user.findFirst({
      where: { whatsappNumber: ownerWhatsappNumber, deletedAt: null },
    });
    const existsIdentity = await prisma.accountIdentity.findUnique({
      where: { whatsappNumber: ownerWhatsappNumber },
    });
    if (exists || existsIdentity) throw new HttpError(409, 'Nomor WhatsApp owner sudah terdaftar');

    const trialEndsAt = payload.trialEndsAt !== undefined
      ? (payload.trialEndsAt ? new Date(payload.trialEndsAt) : null)
      : dayjs().add(14, 'day').toDate();

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: payload.name,
          type: payload.type,
          subscriptionPlan: payload.subscriptionPlan,
          subscriptionStatus: payload.subscriptionStatus,
          trialEndsAt,
        },
      });

      const identity = await tx.accountIdentity.create({
        data: {
          name: payload.ownerName,
          whatsappNumber: ownerWhatsappNumber,
          status: 'active',
          activeTenantId: tenant.id,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          identityId: identity.id,
          name: payload.ownerName,
          whatsappNumber: ownerWhatsappNumber,
          role: 'owner',
          status: 'active',
        },
      });

      await tx.tenantMember.create({
        data: {
          accountId: identity.id,
          tenantId: tenant.id,
          role: 'owner',
          status: 'active',
        },
      });

      await tx.account.create({
        data: {
          tenantId: tenant.id,
          name: 'Kas Tunai',
          type: 'cash',
          openingBalance: 0,
          currentBalance: 0,
          isDefault: true,
        },
      });

      await tx.category.createMany({
        data: [
          ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ tenantId: tenant.id, name, type: 'income', isDefault: true })),
          ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ tenantId: tenant.id, name, type: 'expense', isDefault: true })),
        ],
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'tenant.admin_create',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: {
            name: tenant.name,
            type: tenant.type,
            ownerName: user.name,
            ownerWhatsappNumber: user.whatsappNumber,
            subscriptionPlan: tenant.subscriptionPlan,
            subscriptionStatus: tenant.subscriptionStatus,
            trialEndsAt: tenant.trialEndsAt,
          },
        },
      });

      return { tenant, user };
    });

    res.status(201).json({ data: result });
  })
);

router.get(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, whatsappNumber: true, whatsappJid: true, role: true, status: true, deletedAt: true },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        },
        _count: { select: { users: true, transactions: true, accounts: true } },
      },
    });
    if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

    const waCount = await prisma.whatsappLog.count({
      where: { tenantId: tenant.id, direction: 'inbound' },
    });

    res.json({ data: { ...tenant, whatsappCommandCount: waCount } });
  })
);

router.patch(
  '/tenants/:id/status',
  asyncHandler(async (req, res) => {
    const payload = tenantStatusSchema.parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { status: payload.status },
    });
    res.json({ data: tenant });
  })
);

router.delete(
  '/tenants/:id',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

    const deletedAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const deleted = await tx.tenant.update({
        where: { id: tenant.id },
        data: { status: 'inactive', deletedAt },
      });
      await tx.user.updateMany({
        where: { tenantId: tenant.id, deletedAt: null },
        data: { status: 'inactive', whatsappJid: null },
      });
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: null,
          action: 'platform_admin.tenant.delete',
          entityType: 'tenant',
          entityId: tenant.id,
          oldValue: { name: tenant.name, status: tenant.status },
          newValue: { deletedAt, status: 'inactive' },
        },
      });
      return deleted;
    });

    res.json({ data: { id: updated.id, deletedAt: updated.deletedAt } });
  })
);

router.patch(
  '/tenants/:id/subscription',
  asyncHandler(async (req, res) => {
    const payload = subscriptionSchema.parse(req.body);
    const data = { ...payload };
    if (payload.trialEndsAt !== undefined) {
      data.trialEndsAt = payload.trialEndsAt ? new Date(payload.trialEndsAt) : null;
    }
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ data: tenant });
  })
);

router.post(
  '/tenants/:tenantId/users',
  asyncHandler(async (req, res) => {
    const payload = adminUserCreateSchema.parse(req.body);
    const whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);

    const tenant = await prisma.tenant.findFirst({
      where: { id: req.params.tenantId, deletedAt: null },
    });
    if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

    let identity = await prisma.accountIdentity.findUnique({ where: { whatsappNumber } });
    if (identity) {
      const existingMember = await prisma.tenantMember.findUnique({
        where: { accountId_tenantId: { accountId: identity.id, tenantId: tenant.id } },
      });
      if (existingMember && !existingMember.deletedAt) {
        throw new HttpError(409, 'Nomor WhatsApp sudah menjadi user tenant ini');
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (!identity) {
        identity = await tx.accountIdentity.create({
          data: { name: payload.name, whatsappNumber, status: 'active', activeTenantId: tenant.id },
        });
      } else if (identity.status !== 'active') {
        identity = await tx.accountIdentity.update({
          where: { id: identity.id },
          data: { status: 'active', activeTenantId: identity.activeTenantId || tenant.id },
        });
      }

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          identityId: identity.id,
          name: payload.name,
          whatsappNumber,
          whatsappJid: identity.whatsappJid,
          role: payload.role,
          status: 'active',
        },
      });

      await tx.tenantMember.upsert({
        where: { accountId_tenantId: { accountId: identity.id, tenantId: tenant.id } },
        create: { accountId: identity.id, tenantId: tenant.id, role: payload.role, status: 'active' },
        update: { role: payload.role, status: 'active', deletedAt: null },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: null,
          action: 'platform_admin.user.create',
          entityType: 'user',
          entityId: user.id,
          newValue: { name: user.name, whatsappNumber: user.whatsappNumber, role: user.role },
        },
      });

      return user;
    });

    res.status(201).json({ data: result });
  })
);

router.patch(
  '/tenants/:tenantId/users/:userId',
  asyncHandler(async (req, res) => {
    const payload = adminUserUpdateSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.params.tenantId, deletedAt: null },
    });
    if (!user) throw new HttpError(404, 'User tidak ditemukan');

    if (payload.status === 'inactive') {
      await ensureCanDeactivateOrDeleteUser({ tenantId: req.params.tenantId, user });
    }
    if (payload.role) {
      await ensureCanDemoteOwner({ tenantId: req.params.tenantId, user, nextRole: payload.role });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: payload,
        select: { id: true, name: true, whatsappNumber: true, whatsappJid: true, role: true, status: true, identityId: true },
      });

      if (result.identityId && (payload.role || payload.status)) {
        await tx.tenantMember.updateMany({
          where: { accountId: result.identityId, tenantId: req.params.tenantId },
          data: {
            ...(payload.role ? { role: payload.role } : {}),
            ...(payload.status ? { status: payload.status } : {}),
          },
        });
      }

      if (result.identityId && payload.status === 'active') {
        await tx.accountIdentity.update({
          where: { id: result.identityId },
          data: { status: 'active', activeTenantId: req.params.tenantId },
        });
      }

      return result;
    });

    await prisma.auditLog.create({
      data: {
        tenantId: req.params.tenantId,
        userId: null,
        action: 'platform_admin.user.update',
        entityType: 'user',
        entityId: user.id,
        oldValue: { status: user.status, role: user.role },
        newValue: payload,
      },
    });

    res.json({ data: updated });
  })
);

router.post(
  '/tenants/:tenantId/users/:userId/reset-whatsapp',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.params.tenantId, deletedAt: null },
    });
    if (!user) throw new HttpError(404, 'User tidak ditemukan');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: { whatsappJid: null },
        select: { id: true, name: true, whatsappNumber: true, whatsappJid: true, role: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          tenantId: req.params.tenantId,
          userId: null,
          action: 'platform_admin.user.reset_whatsapp',
          entityType: 'user',
          entityId: user.id,
          oldValue: { whatsappJid: user.whatsappJid },
          newValue: { whatsappJid: null },
        },
      });
      return result;
    });

    res.json({ data: updated });
  })
);

router.delete(
  '/tenants/:tenantId/users/:userId',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.params.tenantId, deletedAt: null },
    });
    if (!user) throw new HttpError(404, 'User tidak ditemukan');

    await ensureCanDeactivateOrDeleteUser({ tenantId: req.params.tenantId, user });

    const deletedAt = new Date();
    const deletedWhatsappNumber = user.whatsappNumber;
    const deletedMarker = `deleted:${user.id}:${user.whatsappNumber}`;

    const updated = await prisma.$transaction(async (tx) => {
      const deleted = await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'inactive',
          deletedAt,
          deletedWhatsappNumber,
          whatsappNumber: deletedMarker,
          whatsappJid: null,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: req.params.tenantId,
          userId: null,
          action: 'platform_admin.user.delete',
          entityType: 'user',
          entityId: user.id,
          oldValue: {
            name: user.name,
            whatsappNumber: user.whatsappNumber,
            whatsappJid: user.whatsappJid,
            role: user.role,
            status: user.status,
          },
          newValue: {
            deletedAt,
            deletedWhatsappNumber,
            status: 'inactive',
          },
        },
      });

      return deleted;
    });

    res.json({ data: { id: updated.id, deletedAt: updated.deletedAt } });
  })
);

router.get(
  '/usage',
  asyncHandler(async (req, res) => {
    const [tenants, users, trx, wa, pending] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.whatsappLog.count(),
      prisma.whatsappPendingTransaction.count(),
    ]);
    const byType = await prisma.tenant.groupBy({
      by: ['type'],
      _count: true,
    });
    res.json({
      data: {
        tenants,
        users,
        transactions: trx,
        whatsappLogs: wa,
        whatsappPendings: pending,
        tenantsByType: byType.map((b) => ({ type: b.type, count: b._count })),
      },
    });
  })
);

export default router;
