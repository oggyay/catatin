import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/error.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Unauthorized');
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (payload.accountId && payload.tenantId) {
      const identity = await prisma.accountIdentity.findUnique({
        where: { id: payload.accountId },
      });
      if (!identity || identity.status !== 'active') {
        throw new HttpError(401, 'User tidak aktif');
      }

      const member = await prisma.tenantMember.findUnique({
        where: { accountId_tenantId: { accountId: identity.id, tenantId: payload.tenantId } },
        include: { tenant: true },
      });
      if (!member || member.status !== 'active' || member.deletedAt || member.tenant?.deletedAt) {
        throw new HttpError(401, 'User tidak aktif');
      }

      const user = await prisma.user.findFirst({
        where: { identityId: identity.id, tenantId: member.tenantId, deletedAt: null },
        include: { tenant: true },
      });
      if (!user || user.status !== 'active') {
        throw new HttpError(401, 'User tidak aktif');
      }

      req.identity = identity;
      req.member = member;
      req.user = { ...user, role: member.role, status: member.status, tenant: member.tenant };
      req.tenantId = member.tenantId;
      return next();
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      include: { tenant: true, identity: true },
    });

    if (!user || user.status !== 'active' || user.tenant?.deletedAt) {
      throw new HttpError(401, 'User tidak aktif');
    }

    req.identity = user.identity || null;
    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (e) {
    if (e instanceof HttpError) return next(e);
    return next(new HttpError(401, 'Token tidak valid'));
  }
}

export function requireTenant(req, res, next) {
  if (!req.tenantId) return next(new HttpError(403, 'Tenant tidak ditemukan'));
  next();
}

export function requireActiveSubscription(req, res, next) {
  const tenant = req.user?.tenant;
  if (!tenant) return next(new HttpError(403, 'Tenant tidak ditemukan'));
  if (tenant.deletedAt) return next(new HttpError(403, 'Tenant sudah dihapus'));
  if (tenant.status === 'inactive') return next(new HttpError(403, 'Tenant tidak aktif'));
  if (tenant.subscriptionStatus === 'inactive' || tenant.subscriptionStatus === 'suspended') {
    return next(new HttpError(403, 'Langganan tidak aktif'));
  }
  if (tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
    return next(new HttpError(403, 'Masa trial sudah berakhir'));
  }
  next();
}

export function requirePlatformAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'platform_admin') {
    return next(new HttpError(403, 'Hanya platform admin'));
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Akses ditolak'));
    }
    next();
  };
}
