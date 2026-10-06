import { Router } from 'express';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireTenant, requireActiveSubscription);

function resolveRange(query) {
  const { period, dateFrom, dateTo } = query;
  if (dateFrom && dateTo) {
    return {
      from: new Date(dateFrom),
      to: new Date(dateTo),
      label: `${dayjs(dateFrom).format('DD MMM YYYY')} - ${dayjs(dateTo).format('DD MMM YYYY')}`,
    };
  }
  const now = dayjs();
  switch (period) {
    case 'today':
      return { from: now.startOf('day').toDate(), to: now.endOf('day').toDate(), label: 'Hari ini' };
    case 'this_week':
      return { from: now.startOf('week').toDate(), to: now.endOf('week').toDate(), label: 'Minggu ini' };
    case 'this_month':
    default:
      return { from: now.startOf('month').toDate(), to: now.endOf('month').toDate(), label: 'Bulan ini' };
  }
}

async function buildCashflow(tenantId, range) {
  const where = {
    tenantId,
    status: 'active',
    transactionDate: { gte: range.from, lte: range.to },
    type: { in: ['income', 'expense'] },
    transferGroupId: null,
  };

  const [incomeAgg, expenseAgg, byCategory, byAccount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, type: 'income' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'expense' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where,
      _sum: { amount: true },
    }),
  ]);

  const categories = await prisma.category.findMany({
    where: { tenantId },
    select: { id: true, name: true, type: true },
  });
  const accounts = await prisma.account.findMany({
    where: { tenantId },
    select: { id: true, name: true, type: true, currentBalance: true },
  });

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const incomeByCategory = byCategory
    .filter((g) => g.type === 'income')
    .map((g) => ({
      categoryId: g.categoryId,
      name: catMap[g.categoryId]?.name || 'Lainnya',
      total: Number(g._sum.amount || 0),
      count: g._count,
    }))
    .sort((a, b) => b.total - a.total);

  const expenseByCategory = byCategory
    .filter((g) => g.type === 'expense')
    .map((g) => ({
      categoryId: g.categoryId,
      name: catMap[g.categoryId]?.name || 'Lainnya',
      total: Number(g._sum.amount || 0),
      count: g._count,
    }))
    .sort((a, b) => b.total - a.total);

  const perAccount = accounts.map((a) => {
    const income = Number(
      byAccount.find((x) => x.accountId === a.id && x.type === 'income')?._sum.amount || 0
    );
    const expense = Number(
      byAccount.find((x) => x.accountId === a.id && x.type === 'expense')?._sum.amount || 0
    );
    return {
      accountId: a.id,
      name: a.name,
      type: a.type,
      currentBalance: Number(a.currentBalance),
      income,
      expense,
      net: income - expense,
    };
  });

  const totalIncome = Number(incomeAgg._sum.amount || 0);
  const totalExpense = Number(expenseAgg._sum.amount || 0);

  return {
    range,
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    incomeCount: incomeAgg._count,
    expenseCount: expenseAgg._count,
    incomeByCategory,
    expenseByCategory,
    perAccount,
  };
}

router.get(
  '/cashflow',
  asyncHandler(async (req, res) => {
    const range = resolveRange(req.query);
    const data = await buildCashflow(req.tenantId, range);
    res.json({ data });
  })
);

router.get(
  '/cashflow/export',
  asyncHandler(async (req, res) => {
    const range = resolveRange(req.query);
    const data = await buildCashflow(req.tenantId, range);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CatatIN';
    wb.created = new Date();

    const summary = wb.addWorksheet('Ringkasan');
    summary.columns = [
      { header: 'Keterangan', key: 'k', width: 30 },
      { header: 'Nilai', key: 'v', width: 24 },
    ];
    summary.addRows([
      { k: 'Periode', v: data.range.label },
      { k: 'Total Pemasukan', v: data.totalIncome },
      { k: 'Total Pengeluaran', v: data.totalExpense },
      { k: 'Net Cashflow', v: data.netCashflow },
      { k: 'Jumlah Transaksi Pemasukan', v: data.incomeCount },
      { k: 'Jumlah Transaksi Pengeluaran', v: data.expenseCount },
    ]);

    const incomeSheet = wb.addWorksheet('Pemasukan per Kategori');
    incomeSheet.columns = [
      { header: 'Kategori', key: 'name', width: 30 },
      { header: 'Jumlah Transaksi', key: 'count', width: 18 },
      { header: 'Total', key: 'total', width: 20 },
    ];
    incomeSheet.addRows(data.incomeByCategory);

    const expenseSheet = wb.addWorksheet('Pengeluaran per Kategori');
    expenseSheet.columns = [
      { header: 'Kategori', key: 'name', width: 30 },
      { header: 'Jumlah Transaksi', key: 'count', width: 18 },
      { header: 'Total', key: 'total', width: 20 },
    ];
    expenseSheet.addRows(data.expenseByCategory);

    const accountSheet = wb.addWorksheet('Per Akun');
    accountSheet.columns = [
      { header: 'Akun', key: 'name', width: 28 },
      { header: 'Tipe', key: 'type', width: 12 },
      { header: 'Pemasukan', key: 'income', width: 18 },
      { header: 'Pengeluaran', key: 'expense', width: 18 },
      { header: 'Net', key: 'net', width: 18 },
      { header: 'Saldo Saat Ini', key: 'currentBalance', width: 20 },
    ];
    accountSheet.addRows(data.perAccount);

    // Raw transactions
    const trxs = await prisma.transaction.findMany({
      where: {
        tenantId: req.tenantId,
        status: 'active',
        transactionDate: { gte: range.from, lte: range.to },
        transferGroupId: null,
      },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ transactionDate: 'asc' }],
    });
    const trxSheet = wb.addWorksheet('Transaksi');
    trxSheet.columns = [
      { header: 'Tanggal', key: 'date', width: 14 },
      { header: 'Tipe', key: 'type', width: 12 },
      { header: 'Akun', key: 'account', width: 20 },
      { header: 'Kategori', key: 'category', width: 20 },
      { header: 'Nominal', key: 'amount', width: 18 },
      { header: 'Keterangan', key: 'description', width: 40 },
      { header: 'Sumber', key: 'source', width: 12 },
      { header: 'User', key: 'user', width: 20 },
      { header: 'Status', key: 'status', width: 10 },
    ];
    trxSheet.addRows(
      trxs.map((t) => ({
        date: dayjs(t.transactionDate).format('YYYY-MM-DD'),
        type: t.type,
        account: t.account?.name,
        category: t.category?.name,
        amount: Number(t.amount),
        description: t.description,
        source: t.source,
        user: t.user?.name,
        status: t.status,
      }))
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cashflow-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  })
);

export default router;
