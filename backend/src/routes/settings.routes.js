import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/error.js';
import { authenticate, requireTenant } from '../middleware/auth.js';
import { normalizeWhatsappNumber } from '../utils/phone.js';
import { sendWhatsapp } from '../services/whatsapp/index.js';
import { getPlanLimits } from '../config/plans.js';
import { getRedis } from '../config/redis.js';

const router = Router();
router.use(authenticate, requireTenant);

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  whatsappNumber: z.string().min(6).optional(),
});

const userSchema = z.object({
  name: z.string().min(2),
  whatsappNumber: z.string().min(6),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
});

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

function allowedManagedRoles(role) {
  if (role === 'owner') return ['owner', 'member'];
  if (role === 'admin') return ['admin', 'member'];
  return [];
}

function ensureSubscriptionUsable(tenant) {
  if (tenant.subscriptionStatus === 'inactive' || tenant.subscriptionStatus === 'suspended') {
    throw new HttpError(403, 'Langganan tidak aktif');
  }
  if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
    throw new HttpError(403, 'Masa trial sudah berakhir');
  }
}

const tenantSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['personal', 'umkm']).optional(),
});

function generateLinkToken() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `CATATIN-${n}`;
}

const LINK_REQUEST_EXPIRES_MIN = 5;

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    res.json({
      data: {
        id: req.user.id,
        name: req.user.name,
        whatsappNumber: req.user.whatsappNumber,
        whatsappJid: req.user.whatsappJid,
        whatsappLinked: Boolean(req.user.whatsappJid),
        role: req.user.role,
      },
    });
  })
);

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const payload = profileSchema.parse(req.body);
    const data = { ...payload };
    if (payload.whatsappNumber) {
      data.whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);
      const exists = await prisma.user.findFirst({
        where: { whatsappNumber: data.whatsappNumber, deletedAt: null, NOT: { id: req.user.id } },
      });
      if (exists) throw new HttpError(409, 'Nomor WhatsApp sudah dipakai user lain');
    }
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
    });
    res.json({ data: updated });
  })
);

router.get(
  '/whatsapp',
  asyncHandler(async (req, res) => {
    const activeToken = await prisma.whatsappLinkToken.findFirst({
      where: {
        userId: req.user.id,
        tenantId: req.tenantId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeRequest = await prisma.whatsappLinkRequest.findFirst({
      where: {
        userId: req.user.id,
        tenantId: req.tenantId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: {
        whatsappNumber: req.user.whatsappNumber,
        whatsappJid: req.user.whatsappJid,
        linked: Boolean(req.user.whatsappJid),
        activeToken: activeToken
          ? { token: activeToken.token, expiresAt: activeToken.expiresAt }
          : null,
        activeRequest: activeRequest
          ? {
              id: activeRequest.id,
              whatsappNumber: activeRequest.whatsappNumber,
              expiresAt: activeRequest.expiresAt,
              status: activeRequest.status,
            }
          : null,
      },
    });
  })
);

router.post(
  '/whatsapp/link-request',
  asyncHandler(async (req, res) => {
    if (req.user.whatsappJid) {
      throw new HttpError(409, 'WhatsApp sudah terhubung. Putuskan dulu untuk menghubungkan ulang.');
    }
    ensureSubscriptionUsable(req.user.tenant);
    if (!getPlanLimits(req.user.tenant.type, req.user.tenant.subscriptionPlan).whatsappBot) {
      throw new HttpError(403, 'Fitur WhatsApp tersedia mulai plan Basic');
    }

    const whatsappNumber = normalizeWhatsappNumber(req.user.whatsappNumber);
    if (!whatsappNumber) {
      throw new HttpError(400, 'Nomor WhatsApp akun tidak valid.');
    }

    await prisma.whatsappLinkRequest.updateMany({
      where: { userId: req.user.id, tenantId: req.tenantId, status: 'pending' },
      data: { status: 'cancelled' },
    });

    const expiresAt = new Date(Date.now() + LINK_REQUEST_EXPIRES_MIN * 60 * 1000);
    const linkRequest = await prisma.whatsappLinkRequest.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        whatsappNumber,
        expiresAt,
      },
    });

    try {
      const redis = await getRedis();
      await redis.set(
        `wa:link-request:${whatsappNumber}`,
        JSON.stringify({
          id: linkRequest.id,
          tenantId: req.tenantId,
          userId: req.user.id,
          name: req.user.name,
          identityId: req.user.identityId || null,
          createdAt: linkRequest.createdAt,
        }),
        { EX: LINK_REQUEST_EXPIRES_MIN * 60 }
      );
    } catch (e) {
      console.warn('[link-request] Redis set gagal:', e.message);
    }

    const message =
      `Konfirmasi hubungkan WhatsApp ini ke akun CatatIN atas nama *${req.user.name}*.\n\n` +
      `Balas *YA* dalam ${LINK_REQUEST_EXPIRES_MIN} menit untuk menyetujui, atau *BATAL* untuk membatalkan.`;

    try {
      await sendWhatsapp(whatsappNumber, message);
    } catch (e) {
      await prisma.whatsappLinkRequest.update({
        where: { id: linkRequest.id },
        data: { status: 'cancelled' },
      });
      throw new HttpError(502, `Gagal mengirim pesan WhatsApp: ${e.message}`);
    }

    res.status(201).json({
      data: {
        id: linkRequest.id,
        whatsappNumber: linkRequest.whatsappNumber,
        expiresAt: linkRequest.expiresAt,
        status: linkRequest.status,
      },
    });
  })
);

router.delete(
  '/whatsapp/link-request',
  asyncHandler(async (req, res) => {
    await prisma.whatsappLinkRequest.updateMany({
      where: { userId: req.user.id, tenantId: req.tenantId, status: 'pending' },
      data: { status: 'cancelled' },
    });
    try {
      const redis = await getRedis();
      await redis.del(`wa:link-request:${normalizeWhatsappNumber(req.user.whatsappNumber)}`);
    } catch {}
    res.json({ data: { ok: true } });
  })
);

router.post(
  '/whatsapp/link-token',
  asyncHandler(async (req, res) => {
    await prisma.whatsappLinkToken.updateMany({
      where: { userId: req.user.id, tenantId: req.tenantId, usedAt: null },
      data: { usedAt: new Date() },
    });

    let token = generateLinkToken();
    for (let i = 0; i < 3; i += 1) {
      const exists = await prisma.whatsappLinkToken.findUnique({ where: { token } });
      if (!exists) break;
      token = generateLinkToken();
    }

    const linkToken = await prisma.whatsappLinkToken.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        token,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    res.status(201).json({
      data: { token: linkToken.token, expiresAt: linkToken.expiresAt },
    });
  })
);

router.delete(
  '/whatsapp/link',
  asyncHandler(async (req, res) => {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { whatsappJid: null },
    });
    res.json({
      data: {
        whatsappNumber: updated.whatsappNumber,
        whatsappJid: updated.whatsappJid,
        linked: false,
      },
    });
  })
);

router.get(
  '/subscription',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      include: {
        _count: {
          select: {
            members: { where: { deletedAt: null, status: 'active' } },
            accounts: true,
          },
        },
      },
    });
    if (!tenant) throw new HttpError(404, 'Tenant tidak ditemukan');

    const limits = getPlanLimits(tenant.type, tenant.subscriptionPlan);
    const trialExpired = tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && tenant.trialEndsAt < new Date();

    res.json({
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          type: tenant.type,
          status: tenant.status,
          subscriptionPlan: tenant.subscriptionPlan,
          subscriptionStatus: tenant.subscriptionStatus,
          trialEndsAt: tenant.trialEndsAt,
          trialExpired: Boolean(trialExpired),
        },
        limits,
        usage: {
          users: tenant._count.members,
          accounts: tenant._count.accounts,
        },
      },
    });
  })
);

router.get(
  '/tenant',
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    res.json({ data: tenant });
  })
);

router.patch(
  '/tenant',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new HttpError(403, 'Hanya owner/admin yang bisa mengubah tenant');
    }
    const payload = tenantSchema.parse(req.body);

    if (payload.type === 'personal' && req.identity) {
      const existingPersonal = await prisma.tenantMember.findFirst({
        where: {
          accountId: req.identity.id,
          deletedAt: null,
          tenantId: { not: req.tenantId },
          tenant: { type: 'personal', deletedAt: null },
        },
      });
      if (existingPersonal) {
        throw new HttpError(409, 'Anda sudah memiliki tenant personal lain');
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: payload,
    });
    res.json({ data: updated });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new HttpError(403, 'Hanya owner/admin yang bisa melihat user');
    }
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        identityId: true,
        name: true,
        whatsappNumber: true,
        role: true,
        status: true,
        deletedAt: true,
        createdAt: true,
      },
    });

    const members = await prisma.tenantMember.findMany({
      where: { tenantId: req.tenantId, deletedAt: null },
      select: { accountId: true, role: true, status: true },
    });
    const memberMap = new Map(members.map((m) => [m.accountId, m]));

    res.json({
      data: users.map((u) => {
        const member = u.identityId ? memberMap.get(u.identityId) : null;
        return {
          id: u.id,
          name: u.name,
          whatsappNumber: u.whatsappNumber,
          role: member?.role || u.role,
          status: member?.status || u.status,
          deletedAt: u.deletedAt,
          createdAt: u.createdAt,
        };
      }),
    });
  })
);

router.post(
  '/users',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new HttpError(403, 'Hanya owner/admin yang bisa menambah user');
    }
    ensureSubscriptionUsable(req.user.tenant);
    const payload = userSchema.parse(req.body);
    if (!allowedManagedRoles(req.user.role).includes(payload.role)) {
      throw new HttpError(403, 'Role tujuan tidak diizinkan');
    }
    const limits = getPlanLimits(req.user.tenant.type, req.user.tenant.subscriptionPlan);
    const userCount = await prisma.tenantMember.count({
      where: { tenantId: req.tenantId, deletedAt: null, status: 'active' },
    });
    if (userCount >= limits.maxUsers) {
      throw new HttpError(403, `Plan ${req.user.tenant.subscriptionPlan} maksimal ${limits.maxUsers} user`);
    }
    const whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);
    let identity = await prisma.accountIdentity.findUnique({ where: { whatsappNumber } });
    if (identity) {
      const existingMember = await prisma.tenantMember.findUnique({
        where: { accountId_tenantId: { accountId: identity.id, tenantId: req.tenantId } },
      });
      if (existingMember && !existingMember.deletedAt) throw new HttpError(409, 'Nomor WhatsApp sudah menjadi user tenant ini');
    }

    const user = await prisma.$transaction(async (tx) => {
      if (!identity) {
        identity = await tx.accountIdentity.create({
          data: {
            name: payload.name,
            whatsappNumber,
            status: 'active',
            activeTenantId: req.tenantId,
          },
        });
      }

      const createdUser = await tx.user.create({
        data: {
          tenantId: req.tenantId,
          identityId: identity.id,
          name: payload.name,
          whatsappNumber,
          role: payload.role,
          status: 'active',
        },
      });

      await tx.tenantMember.upsert({
        where: { accountId_tenantId: { accountId: identity.id, tenantId: req.tenantId } },
        create: {
          accountId: identity.id,
          tenantId: req.tenantId,
          role: payload.role,
          status: 'active',
        },
        update: {
          role: payload.role,
          status: 'active',
          deletedAt: null,
        },
      });

      return createdUser;
    });
    res.status(201).json({ data: user });
  })
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new HttpError(403, 'Hanya owner/admin yang bisa mengubah user');
    }
    const payload = userUpdateSchema.parse(req.body);
    if (payload.role && !allowedManagedRoles(req.user.role).includes(payload.role)) {
      throw new HttpError(403, 'Role tujuan tidak diizinkan');
    }
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!target) throw new HttpError(404, 'User tidak ditemukan');

    if (req.user.role === 'admin' && target.role === 'owner') {
      throw new HttpError(403, 'Admin tidak bisa mengubah owner');
    }

    if (payload.role && target.id === req.user.id) {
      throw new HttpError(403, 'Tidak bisa mengubah role akun sendiri');
    }

    if (payload.status && target.id === req.user.id) {
      throw new HttpError(403, 'Tidak bisa mengubah status akun sendiri');
    }

    if ((payload.role && target.role === 'owner' && payload.role !== 'owner') ||
        (payload.status === 'inactive' && target.role === 'owner' && target.status === 'active')) {
      const ownerCount = await prisma.tenantMember.count({
        where: { tenantId: req.tenantId, role: 'owner', status: 'active', deletedAt: null },
      });
      if (ownerCount <= 1) {
        throw new HttpError(409, 'Tenant harus memiliki minimal satu owner aktif');
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: target.id },
        data: payload,
      });
      if (u.identityId && (payload.role || payload.status)) {
        await tx.tenantMember.updateMany({
          where: { accountId: u.identityId, tenantId: req.tenantId },
          data: {
            ...(payload.role ? { role: payload.role } : {}),
            ...(payload.status ? { status: payload.status } : {}),
          },
        });
      }
      if (u.identityId && payload.status === 'active') {
        await tx.accountIdentity.update({
          where: { id: u.identityId },
          data: { status: 'active', activeTenantId: req.tenantId },
        });
      }
      return u;
    });
    res.json({ data: updated });
  })
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'owner' && req.user.role !== 'admin') {
      throw new HttpError(403, 'Hanya owner/admin yang bisa menghapus user');
    }

    const target = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId, deletedAt: null },
    });
    if (!target) throw new HttpError(404, 'User tidak ditemukan');

    if (target.id === req.user.id) {
      throw new HttpError(403, 'Tidak bisa menghapus akun sendiri');
    }

    if (req.user.role === 'admin' && target.role === 'owner') {
      throw new HttpError(403, 'Admin tidak bisa menghapus owner');
    }

    if (target.role === 'owner' && target.status === 'active') {
      const ownerCount = await prisma.tenantMember.count({
        where: { tenantId: req.tenantId, role: 'owner', status: 'active', deletedAt: null },
      });
      if (ownerCount <= 1) {
        throw new HttpError(409, 'Tenant harus memiliki minimal satu owner aktif');
      }
    }

    const deletedAt = new Date();
    const deletedWhatsappNumber = target.whatsappNumber;
    const deletedMarker = `deleted:${target.id}:${target.whatsappNumber}`;

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: target.id },
        data: {
          status: 'inactive',
          deletedAt,
          deletedWhatsappNumber,
          whatsappNumber: deletedMarker,
          whatsappJid: null,
        },
      });

      if (user.identityId) {
        await tx.tenantMember.updateMany({
          where: { accountId: user.identityId, tenantId: req.tenantId },
          data: { status: 'inactive', deletedAt },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          action: 'user.delete',
          entityType: 'user',
          entityId: target.id,
          oldValue: {
            name: target.name,
            whatsappNumber: target.whatsappNumber,
            whatsappJid: target.whatsappJid,
            role: target.role,
            status: target.status,
          },
          newValue: {
            deletedAt,
            deletedWhatsappNumber,
            status: 'inactive',
          },
        },
      });

      return user;
    });

    res.json({ data: { id: updated.id, deletedAt: updated.deletedAt } });
  })
);

export default router;
