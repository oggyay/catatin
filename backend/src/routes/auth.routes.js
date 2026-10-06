import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { HttpError, asyncHandler } from '../utils/error.js';
import { normalizeWhatsappNumber } from '../utils/phone.js';
import { signToken } from '../utils/jwt.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../config/defaults.js';
import { authenticate } from '../middleware/auth.js';
import { serializeAuthUser } from '../utils/auth-user.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  whatsappNumber: z.string().min(6),
  businessName: z.string().min(2),
  type: z.enum(['personal', 'umkm']).default('personal'),
});

const requestOtpSchema = z.object({
  whatsappNumber: z.string().min(6),
  purpose: z.enum(['login', 'register']).default('login'),
});

const verifyOtpSchema = z.object({
  whatsappNumber: z.string().min(6),
  code: z.string().min(4),
  purpose: z.enum(['login', 'register']).optional(),
});

const createOwnTenantSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['personal', 'umkm']),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);

    const existing = await prisma.user.findFirst({ where: { whatsappNumber, deletedAt: null } });
    const existingIdentity = await prisma.accountIdentity.findUnique({ where: { whatsappNumber } });
    if (existing || existingIdentity) {
      throw new HttpError(409, 'Nomor WhatsApp sudah terdaftar. Silakan login.');
    }

    // Create tenant + user + identity + member + defaults in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: payload.businessName,
          type: payload.type,
          subscriptionPlan: 'free',
          subscriptionStatus: 'trial',
          trialEndsAt: dayjs().add(14, 'day').toDate(),
        },
      });

      const identity = await tx.accountIdentity.create({
        data: {
          name: payload.name,
          whatsappNumber,
          status: 'active',
          activeTenantId: tenant.id,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          identityId: identity.id,
          name: payload.name,
          whatsappNumber,
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

      await tx.account.createMany({
        data: [
          { tenantId: tenant.id, name: 'Hutang', type: 'hutang', openingBalance: 0, currentBalance: 0, isDefault: false },
          { tenantId: tenant.id, name: 'Piutang', type: 'piutang', openingBalance: 0, currentBalance: 0, isDefault: false },
        ],
      });

      await tx.category.createMany({
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

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'tenant.register',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: { name: tenant.name, type: tenant.type },
        },
      });

      return { tenant, user };
    });

    // Send OTP
    await requestOtp({
      whatsappNumber,
      purpose: 'register',
      userId: result.user.id,
    });

    res.json({
      message: 'OTP telah dikirim ke WhatsApp Anda',
      whatsappNumber,
    });
  })
);

router.post(
  '/request-otp',
  asyncHandler(async (req, res) => {
    const payload = requestOtpSchema.parse(req.body);
    const whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);

    const user = await prisma.user.findFirst({ where: { whatsappNumber, deletedAt: null } });
    const identity = await prisma.accountIdentity.findUnique({ where: { whatsappNumber } });
    if (!user && !identity) {
      throw new HttpError(404, 'Nomor WhatsApp belum terdaftar. Silakan register.');
    }
    if ((identity && identity.status !== 'active') || (!identity && user && user.status !== 'active')) {
      throw new HttpError(403, 'User tidak aktif');
    }

    await requestOtp({
      whatsappNumber,
      purpose: payload.purpose,
      userId: user?.id || null,
    });

    res.json({
      message: 'OTP telah dikirim ke WhatsApp Anda',
      whatsappNumber,
    });
  })
);

router.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const payload = verifyOtpSchema.parse(req.body);
    const whatsappNumber = normalizeWhatsappNumber(payload.whatsappNumber);

    await verifyOtp({ whatsappNumber, code: payload.code, purpose: payload.purpose });

    const identity = await prisma.accountIdentity.findUnique({
      where: { whatsappNumber },
      include: {
        memberships: {
          where: { deletedAt: null, status: 'active', tenant: { deletedAt: null } },
          include: { tenant: true },
        },
      },
    });

    if (!identity) {
      const user = await prisma.user.findFirst({
        where: {
          whatsappNumber,
          deletedAt: null,
          OR: [{ role: 'platform_admin' }, { tenant: { deletedAt: null } }],
        },
        include: { tenant: true },
      });
      if (!user) throw new HttpError(404, 'User tidak ditemukan');
      const token = signToken({ userId: user.id, tenantId: user.tenantId });
      return res.json({ token, user: serializeAuthUser({ user, tenant: user.tenant }) });
    }

    if (identity.status !== 'active') {
      const platformAdmin = await prisma.user.findFirst({
        where: { whatsappNumber, role: 'platform_admin', status: 'active', deletedAt: null },
        include: { tenant: true },
      });
      if (platformAdmin) {
        const token = signToken({ userId: platformAdmin.id, tenantId: platformAdmin.tenantId });
        return res.json({ token, user: serializeAuthUser({ user: platformAdmin, tenant: platformAdmin.tenant }), tenants: [] });
      }

      throw new HttpError(403, 'User tidak aktif');
    }

    const activeTenantId = identity.activeTenantId || identity.memberships[0]?.tenantId;
    const activeMember = identity.memberships.find((m) => m.tenantId === activeTenantId) || identity.memberships[0];

    if (!activeMember) {
      const platformAdmin = await prisma.user.findFirst({
        where: { whatsappNumber, role: 'platform_admin', status: 'active', deletedAt: null },
        include: { tenant: true },
      });
      if (platformAdmin) {
        const token = signToken({ userId: platformAdmin.id, tenantId: platformAdmin.tenantId });
        return res.json({ token, user: serializeAuthUser({ user: platformAdmin, tenant: platformAdmin.tenant }), tenants: [] });
      }

      throw new HttpError(404, 'Tidak ada tenant aktif. Hubungi admin.');
    }

    if (identity.activeTenantId !== activeMember.tenantId) {
      await prisma.accountIdentity.update({
        where: { id: identity.id },
        data: { activeTenantId: activeMember.tenantId },
      });
    }

    const user = await prisma.user.findFirst({
      where: { identityId: identity.id, tenantId: activeMember.tenantId, deletedAt: null },
      include: { tenant: true },
    });

    if (!user) throw new HttpError(404, 'User tidak ditemukan');

    const token = signToken({
      userId: user.id,
      accountId: identity.id,
      memberId: activeMember.id,
      tenantId: activeMember.tenantId,
    });

    res.json({
      token,
      user: serializeAuthUser({ user, tenant: activeMember.tenant }),
      tenants: identity.memberships.map((m) => ({
        tenantId: m.tenantId,
        memberId: m.id,
        tenantName: m.tenant.name,
        tenantType: m.tenant.type,
        role: m.role,
      })),
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const identity = req.identity;
    const tenants = identity
      ? (await prisma.tenantMember.findMany({
          where: { accountId: identity.id, deletedAt: null, status: 'active', tenant: { deletedAt: null } },
          include: { tenant: true },
        })).map((m) => ({
          tenantId: m.tenantId,
          memberId: m.id,
          tenantName: m.tenant.name,
          tenantType: m.tenant.type,
          role: m.role,
        }))
      : null;

    res.json({
      user: serializeAuthUser({ user: req.user, tenant: req.user.tenant }),
      tenants,
    });
  })
);

router.get(
  '/tenants',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.identity) {
      return res.json({ data: [] });
    }
    const memberships = await prisma.tenantMember.findMany({
      where: { accountId: req.identity.id, deletedAt: null, status: 'active', tenant: { deletedAt: null } },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      data: memberships.map((m) => ({
        tenantId: m.tenantId,
        memberId: m.id,
        tenantName: m.tenant.name,
        tenantType: m.tenant.type,
        role: m.role,
        isActive: m.tenantId === req.identity.activeTenantId,
      })),
    });
  })
);

router.post(
  '/switch-tenant',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.identity) {
      throw new HttpError(400, 'Akun tidak mendukung multi-tenant');
    }

    const { tenantId } = z.object({ tenantId: z.string() }).parse(req.body);

    const member = await prisma.tenantMember.findUnique({
      where: { accountId_tenantId: { accountId: req.identity.id, tenantId } },
      include: { tenant: true },
    });

    if (!member || member.deletedAt || member.status !== 'active') {
      throw new HttpError(403, 'Anda tidak memiliki akses ke tenant ini');
    }

    if (member.tenant.deletedAt || member.tenant.status === 'inactive') {
      throw new HttpError(403, 'Tenant tidak aktif');
    }

    await prisma.accountIdentity.update({
      where: { id: req.identity.id },
      data: { activeTenantId: tenantId },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: null,
        action: 'identity.switch_tenant',
        entityType: 'account_identity',
        entityId: req.identity.id,
        newValue: { tenantId },
      },
    });

    const user = await prisma.user.findFirst({
      where: { identityId: req.identity.id, tenantId, deletedAt: null },
      include: { tenant: true },
    });

    if (!user) throw new HttpError(404, 'User tidak ditemukan di tenant ini');

    const token = signToken({
      userId: user.id,
      accountId: req.identity.id,
      memberId: member.id,
      tenantId,
    });

    res.json({
      token,
      user: serializeAuthUser({ user, tenant: member.tenant }),
    });
  })
);

router.post(
  '/tenants',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.identity) {
      throw new HttpError(400, 'Akun belum mendukung multi-tenant. Silakan login ulang.');
    }

    const payload = createOwnTenantSchema.parse(req.body);

    if (payload.type === 'personal') {
      const existingPersonal = await prisma.tenantMember.findFirst({
        where: {
          accountId: req.identity.id,
          deletedAt: null,
          tenant: { type: 'personal', deletedAt: null },
        },
      });
      if (existingPersonal) {
        throw new HttpError(409, 'Anda sudah memiliki tenant personal');
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: payload.name,
          type: payload.type,
          subscriptionPlan: 'free',
          subscriptionStatus: 'trial',
          trialEndsAt: dayjs().add(14, 'day').toDate(),
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          identityId: req.identity.id,
          name: req.identity.name,
          whatsappNumber: req.identity.whatsappNumber,
          whatsappJid: req.identity.whatsappJid,
          role: 'owner',
          status: 'active',
        },
      });

      const member = await tx.tenantMember.create({
        data: {
          accountId: req.identity.id,
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

      await tx.account.createMany({
        data: [
          { tenantId: tenant.id, name: 'Hutang', type: 'hutang', openingBalance: 0, currentBalance: 0, isDefault: false },
          { tenantId: tenant.id, name: 'Piutang', type: 'piutang', openingBalance: 0, currentBalance: 0, isDefault: false },
        ],
      });

      await tx.category.createMany({
        data: [
          ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ tenantId: tenant.id, name, type: 'income', isDefault: true })),
          ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ tenantId: tenant.id, name, type: 'expense', isDefault: true })),
        ],
      });

      await tx.accountIdentity.update({
        where: { id: req.identity.id },
        data: { activeTenantId: tenant.id },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: 'tenant.self_create',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: { name: tenant.name, type: tenant.type },
        },
      });

      return { tenant, user, member };
    });

    const token = signToken({
      userId: result.user.id,
      accountId: req.identity.id,
      memberId: result.member.id,
      tenantId: result.tenant.id,
    });

    res.status(201).json({
      token,
      user: serializeAuthUser({ user: result.user, tenant: result.tenant }),
    });
  })
);

router.delete(
  '/tenants/:tenantId',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.identity) {
      throw new HttpError(400, 'Akun belum mendukung multi-tenant. Silakan login ulang.');
    }

    const { tenantId } = req.params;

    const member = await prisma.tenantMember.findUnique({
      where: { accountId_tenantId: { accountId: req.identity.id, tenantId } },
      include: { tenant: true },
    });

    if (!member || member.deletedAt || member.status !== 'active') {
      throw new HttpError(403, 'Anda tidak memiliki akses ke tenant ini');
    }

    if (member.role !== 'owner') {
      throw new HttpError(403, 'Hanya owner yang bisa menghapus tenant');
    }

    if (member.tenant.deletedAt) {
      throw new HttpError(404, 'Tenant tidak ditemukan');
    }

    const activeMemberships = await prisma.tenantMember.count({
      where: { accountId: req.identity.id, deletedAt: null, status: 'active' },
    });

    if (activeMemberships <= 1) {
      throw new HttpError(409, 'Anda harus memiliki minimal 1 tenant aktif');
    }

    const deletedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { status: 'inactive', deletedAt },
      });

      await tx.tenantMember.updateMany({
        where: { tenantId, deletedAt: null },
        data: { status: 'inactive', deletedAt },
      });

      await tx.user.updateMany({
        where: { tenantId, deletedAt: null },
        data: { status: 'inactive', whatsappJid: null },
      });

      const nextActiveMember = await tx.tenantMember.findFirst({
        where: {
          accountId: req.identity.id,
          tenantId: { not: tenantId },
          deletedAt: null,
          status: 'active',
        },
        orderBy: { createdAt: 'asc' },
      });

      const nextTenantId = nextActiveMember?.tenantId || null;

      await tx.accountIdentity.update({
        where: { id: req.identity.id },
        data: { activeTenantId: nextTenantId },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: req.user.id,
          action: 'tenant.self_delete',
          entityType: 'tenant',
          entityId: tenantId,
          oldValue: { name: member.tenant.name, type: member.tenant.type },
          newValue: { deletedAt, status: 'inactive' },
        },
      });
    });

    const nextMembership = await prisma.tenantMember.findFirst({
      where: { accountId: req.identity.id, tenantId: { not: tenantId }, deletedAt: null },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextMembership) {
      throw new HttpError(500, 'Tidak ada tenant tersisa');
    }

    const nextUser = await prisma.user.findFirst({
      where: { identityId: req.identity.id, tenantId: nextMembership.tenantId, deletedAt: null },
      include: { tenant: true },
    });

    if (!nextUser) throw new HttpError(500, 'User tidak ditemukan di tenant pengganti');

    const token = signToken({
      userId: nextUser.id,
      accountId: req.identity.id,
      memberId: nextMembership.id,
      tenantId: nextMembership.tenantId,
    });

    res.json({
      token,
      user: serializeAuthUser({ user: nextUser, tenant: nextMembership.tenant }),
    });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    // stateless JWT; client drops token
    res.json({ message: 'Logout berhasil' });
  })
);

export default router;
