import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireTenant, requireActiveSubscription);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantId;
    const now = dayjs();
    const startMonth = now.startOf('month').toDate();
    const endMonth = now.endOf('month').toDate();

    const [accounts, grouped] = await Promise.all([
      prisma.account.findMany({
        where: { tenantId, status: 'active' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: {
          tenantId,
          status: 'active',
          transactionDate: { gte: startMonth, lte: endMonth },
          type: { in: ['income', 'expense'] },
          transferGroupId: null,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalBalance = accounts.reduce(
      (sum, a) => sum + Number(a.currentBalance),
      0
    );
    const income = Number(
      grouped.find((g) => g.type === 'income')?._sum.amount || 0
    );
    const expense = Number(
      grouped.find((g) => g.type === 'expense')?._sum.amount || 0
    );

    res.json({
      data: {
        totalBalance,
        incomeThisMonth: income,
        expenseThisMonth: expense,
        netCashflow: income - expense,
        accountsCount: accounts.length,
        period: {
          from: startMonth,
          to: endMonth,
          label: 'bulan ini',
        },
      },
    });
  })
);

router.get(
  '/recent-transactions',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const data = await prisma.transaction.findMany({
      where: { tenantId: req.tenantId, status: 'active' },
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    res.json({ data });
  })
);

export default router;
