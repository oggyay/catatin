import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';
import {
  createTransactionAtomic,
  createTransferAtomic,
  updateTransactionAtomic,
  voidTransactionAtomic,
} from '../services/transaction.service.js';

const router = Router();

router.use(authenticate, requireTenant, requireActiveSubscription);

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive(),
  accountId: z.string(),
  categoryId: z.string().optional().nullable(),
  transactionDate: z.string().optional(),
  description: z.string().optional().nullable(),
});

const updateSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  transactionDate: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string(),
  toAccountId: z.string(),
  amount: z.coerce.number().positive(),
  transactionDate: z.string().optional(),
  description: z.string().optional().nullable(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
  type: z.enum(['income', 'expense', 'adjustment']).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  userId: z.string().optional(),
  source: z.enum(['web', 'whatsapp', 'adjustment']).optional(),
  status: z.enum(['active', 'void']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  q: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    let transferGroupIds = [];
    if (q.accountId) {
      const transferRows = await prisma.transaction.findMany({
        where: { tenantId: req.tenantId, accountId: q.accountId, transferGroupId: { not: null } },
        select: { transferGroupId: true },
      });
      transferGroupIds = Array.from(new Set(transferRows.map((t) => t.transferGroupId).filter(Boolean)));
    }

    const where = {
      tenantId: req.tenantId,
      ...(q.type ? { type: q.type } : {}),
      ...(q.accountId
        ? { OR: [{ accountId: q.accountId }, ...(transferGroupIds.length ? [{ transferGroupId: { in: transferGroupIds } }] : [])] }
        : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.dateFrom || q.dateTo
        ? {
            transactionDate: {
              ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}),
              ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}),
            },
          }
        : {}),
      ...(q.q
        ? {
            description: { contains: q.q, mode: 'insensitive' },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, type: true } },
          category: { select: { id: true, name: true, type: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    res.json({
      data,
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
      },
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);

    const { transaction, account } = await createTransactionAtomic({
      tenantId: req.tenantId,
      userId: req.user.id,
      accountId: payload.accountId,
      type: payload.type,
      amount: payload.amount,
      categoryId: payload.categoryId || null,
      transactionDate: payload.transactionDate || new Date().toISOString(),
      description: payload.description,
      source: 'web',
      attachmentUrl: null,
    });

    res.status(201).json({ data: { transaction, account } });
  })
);

router.post(
  '/transfer',
  asyncHandler(async (req, res) => {
    const payload = transferSchema.parse(req.body);
    if (payload.fromAccountId === payload.toAccountId) {
      throw new HttpError(400, 'Akun asal dan tujuan tidak boleh sama');
    }

    const result = await createTransferAtomic({
      tenantId: req.tenantId,
      userId: req.user.id,
      fromAccountId: payload.fromAccountId,
      toAccountId: payload.toAccountId,
      amount: payload.amount,
      transactionDate: payload.transactionDate,
      description: payload.description,
      source: 'web',
    });

    res.status(201).json({ data: result });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const trx = await prisma.transaction.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        account: true,
        category: true,
        user: { select: { id: true, name: true } },
        adjustment: true,
      },
    });
    if (!trx) throw new HttpError(404, 'Transaksi tidak ditemukan');
    res.json({ data: trx });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = updateSchema.parse(req.body);
    const trx = await updateTransactionAtomic({
      tenantId: req.tenantId,
      userId: req.user.id,
      transactionId: req.params.id,
      amount: payload.amount,
      accountId: payload.accountId,
      categoryId: payload.categoryId,
      transactionDate: payload.transactionDate,
    });
    res.json({ data: trx });
  })
);

router.post(
  '/:id/void',
  asyncHandler(async (req, res) => {
    const trx = await voidTransactionAtomic({
      tenantId: req.tenantId,
      userId: req.user.id,
      transactionId: req.params.id,
    });
    res.json({ data: trx });
  })
);

export default router;
