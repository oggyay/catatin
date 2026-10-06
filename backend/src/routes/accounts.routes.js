import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';
import { createTransactionAtomic } from '../services/transaction.service.js';
import { getPlanLimits } from '../config/plans.js';

const router = Router();

router.use(authenticate, requireTenant, requireActiveSubscription);

const ACCOUNT_TYPES = ['cash', 'bank', 'ewallet', 'hutang', 'piutang'];

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: z.coerce.number().default(0),
  isDefault: z.boolean().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

const adjustSchema = z.object({
  realBalance: z.coerce.number(),
  reason: z.string().min(1),
  transactionDate: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { tenantId: req.tenantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ data: accounts });
  })
);

// GET /accounts/debt-summary — ringkasan hutang & piutang
router.get(
  '/debt-summary',
  asyncHandler(async (req, res) => {
    const { type } = req.query; // 'hutang' | 'piutang'
    const where = { tenantId: req.tenantId };
    if (type === 'hutang') where.type = 'hutang';
    else if (type === 'piutang') where.type = 'piutang';
    else where.type = { in: ['hutang', 'piutang'] };

    const accounts = await prisma.account.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });

    // Hitung total per tipe (hanya akun active)
    const hutangAktif = accounts.filter((a) => a.type === 'hutang' && a.status === 'active');
    const piutangAktif = accounts.filter((a) => a.type === 'piutang' && a.status === 'active');
    const totalHutang = hutangAktif.reduce((s, a) => s + Number(a.currentBalance), 0);
    const totalPiutang = piutangAktif.reduce((s, a) => s + Number(a.currentBalance), 0);

    res.json({
      data: accounts,
      summary: {
        totalHutang,
        totalPiutang,
        countHutang: hutangAktif.length,
        countPiutang: piutangAktif.length,
      },
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const limits = getPlanLimits(req.user.tenant.type, req.user.tenant.subscriptionPlan);
    const accountCount = await prisma.account.count({ where: { tenantId: req.tenantId } });
    if (accountCount >= limits.maxAccounts) {
      throw new HttpError(403, `Plan ${req.user.tenant.subscriptionPlan} maksimal ${limits.maxAccounts} akun`);
    }

    const account = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.account.updateMany({
          where: { tenantId: req.tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const created = await tx.account.create({
        data: {
          tenantId: req.tenantId,
          name: payload.name,
          type: payload.type,
          openingBalance: payload.openingBalance,
          currentBalance: payload.openingBalance,
          isDefault: payload.isDefault || false,
          status: 'active',
          contactName: payload.contactName || null,
          contactPhone: payload.contactPhone || null,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          action: 'account.create',
          entityType: 'account',
          entityId: created.id,
          newValue: { name: created.name, type: created.type, openingBalance: created.openingBalance, isDefault: created.isDefault },
        },
      });
      return created;
    });

    res.status(201).json({ data: account });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!account) throw new HttpError(404, 'Akun tidak ditemukan');
    res.json({ data: account });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = updateSchema.parse(req.body);

    const account = await prisma.account.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!account) throw new HttpError(404, 'Akun tidak ditemukan');

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.isDefault) {
        await tx.account.updateMany({
          where: { tenantId: req.tenantId, isDefault: true, NOT: { id: account.id } },
          data: { isDefault: false },
        });
      }
      const result = await tx.account.update({
        where: { id: account.id },
        data: payload,
      });
      await tx.auditLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          action: payload.status === 'inactive' ? 'account.deactivate' : 'account.update',
          entityType: 'account',
          entityId: account.id,
          oldValue: { name: account.name, type: account.type, isDefault: account.isDefault, status: account.status },
          newValue: payload,
        },
      });
      return result;
    });

    res.json({ data: updated });
  })
);

router.get(
  '/:id/delete-info',
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!account) throw new HttpError(404, 'Akun tidak ditemukan');

    const totalTx = await prisma.transaction.count({ where: { accountId: account.id } });
    const transferCount = await prisma.transaction.count({
      where: { accountId: account.id, transferGroupId: { not: null } },
    });

    res.json({ data: { accountId: account.id, name: account.name, status: account.status, totalTransactions: totalTx, transferTransactions: transferCount } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!account) throw new HttpError(404, 'Akun tidak ditemukan');

    if (account.status === 'active') {
      // Pertama: soft delete — jadikan inactive
      const txCount = await prisma.transaction.count({ where: { accountId: account.id } });
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.account.update({
          where: { id: account.id },
          data: { status: 'inactive' },
        });
        await tx.auditLog.create({
          data: {
            tenantId: req.tenantId,
            userId: req.user.id,
            action: 'account.deactivate',
            entityType: 'account',
            entityId: account.id,
            oldValue: { status: 'active' },
            newValue: { status: 'inactive' },
          },
        });
        return result;
      });
      const message = txCount > 0
        ? 'Akun dinonaktifkan karena sudah punya transaksi'
        : 'Akun dinonaktifkan';
      return res.json({ data: updated, message });
    }

    // Kedua: hard delete akun inactive — void semua transaksi dulu, lalu hapus
    await prisma.$transaction(async (tx) => {
      const transactions = await tx.transaction.findMany({
        where: { accountId: account.id, status: 'active' },
      });

      const voidedGroupIds = new Set();
      for (const trx of transactions) {
        if (trx.transferGroupId) {
          if (voidedGroupIds.has(trx.transferGroupId)) continue;
          voidedGroupIds.add(trx.transferGroupId);
          // Void seluruh pasangan transfer
          const pair = await tx.transaction.findMany({
            where: { tenantId: req.tenantId, transferGroupId: trx.transferGroupId, status: 'active' },
          });
          for (const item of pair) {
            const acc = await tx.account.findUnique({ where: { id: item.accountId } });
            if (!acc) continue;
            let newBalance = Number(acc.currentBalance);
            if (item.type === 'income') newBalance -= Number(item.amount);
            else if (item.type === 'expense') newBalance += Number(item.amount);
            await tx.account.update({ where: { id: acc.id }, data: { currentBalance: newBalance } });
            await tx.transaction.update({ where: { id: item.id }, data: { status: 'void' } });
          }
        } else {
          // Non-transfer: balik saldo & void
          const acc = await tx.account.findUnique({ where: { id: trx.accountId } });
          if (acc) {
            let newBalance = Number(acc.currentBalance);
            if (trx.type === 'income') newBalance -= Number(trx.amount);
            else if (trx.type === 'expense') newBalance += Number(trx.amount);
            // adjustment: saldo sudah tidak relevan karena akun akan dihapus, skip reversal
            await tx.account.update({ where: { id: acc.id }, data: { currentBalance: newBalance } });
          }
          await tx.transaction.update({ where: { id: trx.id }, data: { status: 'void' } });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: req.tenantId,
          userId: req.user.id,
          action: 'account.hard_delete',
          entityType: 'account',
          entityId: account.id,
          oldValue: { name: account.name, type: account.type, status: 'inactive' },
          newValue: { deleted: true },
        },
      });

      await tx.balanceAdjustment.deleteMany({ where: { accountId: account.id } });
      await tx.transaction.deleteMany({ where: { accountId: account.id } });
      await tx.account.delete({ where: { id: account.id } });
    });

    res.json({ message: 'Akun berhasil dihapus permanen' });
  })
);

router.post(
  '/:id/adjust-balance',
  asyncHandler(async (req, res) => {
    const payload = adjustSchema.parse(req.body);
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!account) throw new HttpError(404, 'Akun tidak ditemukan');

    const previous = Number(account.currentBalance);
    const next = Number(payload.realBalance);
    const diff = next - previous;
    const absAmount = Math.abs(diff);

    const { transaction, account: updatedAccount } = await createTransactionAtomic({
      tenantId: req.tenantId,
      userId: req.user.id,
      accountId: account.id,
      type: 'adjustment',
      amount: absAmount,
      categoryId: null,
      transactionDate: payload.transactionDate || new Date().toISOString(),
      description: `Penyesuaian saldo: ${payload.reason}`,
      source: 'adjustment',
      adjustment: {
        previousBalance: previous,
        newBalance: next,
        difference: diff,
        reason: payload.reason,
      },
    });

    res.json({ data: { transaction, account: updatedAccount } });
  })
);

export default router;
