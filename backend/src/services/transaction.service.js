import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/error.js';
import { randomUUID } from 'crypto';

function signedAmount(type, amount) {
  const n = Number(amount || 0);
  if (type === 'income') return n;
  if (type === 'expense') return -n;
  return 0;
}

function startOfLocalDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Persist a transaction and atomically update account balance.
 * Also writes an audit log.
 */
export async function createTransactionAtomic({
  tenantId,
  userId,
  accountId,
  type, // income | expense | adjustment
  amount,
  categoryId,
  transactionDate,
  description,
  source = 'web',
  attachmentUrl = null,
  adjustment = null, // { previousBalance, newBalance, difference, reason }
}) {
  if (!tenantId) throw new HttpError(400, 'tenantId wajib');
  if (!accountId) throw new HttpError(400, 'Akun wajib dipilih');
  if (!type) throw new HttpError(400, 'Tipe transaksi wajib');
  if (!['income', 'expense', 'adjustment'].includes(type)) {
    throw new HttpError(400, 'Tipe transaksi tidak valid');
  }
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) {
    if (type !== 'adjustment') throw new HttpError(400, 'Nominal harus lebih dari 0');
  }

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new HttpError(404, 'Akun tidak ditemukan');
    if (account.status !== 'active') throw new HttpError(400, 'Akun tidak aktif');

    if (categoryId) {
      const cat = await tx.category.findFirst({
        where: { id: categoryId, tenantId },
      });
      if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');
      if (type === 'income' && cat.type !== 'income') {
        throw new HttpError(400, 'Kategori tidak sesuai tipe pemasukan');
      }
      if (type === 'expense' && cat.type !== 'expense') {
        throw new HttpError(400, 'Kategori tidak sesuai tipe pengeluaran');
      }
    }

    const trx = await tx.transaction.create({
      data: {
        tenantId,
        userId,
        accountId,
        type,
        amount: amountNum,
        categoryId: categoryId || null,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        description: description || null,
        source,
        status: 'active',
        attachmentUrl,
      },
    });

    let newBalance;
    if (type === 'income') {
      newBalance = Number(account.currentBalance) + amountNum;
    } else if (type === 'expense') {
      newBalance = Number(account.currentBalance) - amountNum;
    } else {
      // adjustment: newBalance comes from adjustment payload
      newBalance = Number(adjustment?.newBalance ?? account.currentBalance);
    }

    await tx.account.update({
      where: { id: account.id },
      data: { currentBalance: newBalance },
    });

    if (type === 'adjustment' && adjustment) {
      await tx.balanceAdjustment.create({
        data: {
          transactionId: trx.id,
          accountId: account.id,
          previousBalance: adjustment.previousBalance,
          newBalance: adjustment.newBalance,
          difference: adjustment.difference,
          reason: adjustment.reason || '-',
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: `transaction.create.${type}`,
        entityType: 'transaction',
        entityId: trx.id,
        newValue: {
          amount: amountNum,
          accountId: account.id,
          categoryId: categoryId || null,
          source,
        },
      },
    });

    return { transaction: trx, account: { ...account, currentBalance: newBalance } };
  });
}

export async function createTransferAtomic({
  tenantId,
  userId,
  fromAccountId,
  toAccountId,
  amount,
  transactionDate,
  description,
  source = 'web',
}) {
  if (!tenantId) throw new HttpError(400, 'tenantId wajib');
  if (!fromAccountId || !toAccountId) throw new HttpError(400, 'Akun asal dan tujuan wajib dipilih');
  if (fromAccountId === toAccountId) throw new HttpError(400, 'Akun asal dan tujuan tidak boleh sama');
  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0) throw new HttpError(400, 'Nominal harus lebih dari 0');

  return prisma.$transaction(async (tx) => {
    const [from, to] = await Promise.all([
      tx.account.findFirst({ where: { id: fromAccountId, tenantId } }),
      tx.account.findFirst({ where: { id: toAccountId, tenantId } }),
    ]);

    if (!from || !to) throw new HttpError(404, 'Akun transfer tidak ditemukan');
    if (from.status !== 'active' || to.status !== 'active') throw new HttpError(400, 'Akun harus aktif');
    if (Number(from.currentBalance) < amountNum) throw new HttpError(400, 'Saldo akun asal tidak cukup');

    const txDate = startOfLocalDay(transactionDate || new Date());
    const note = description || `Transfer ${from.name} -> ${to.name}`;
    const transferGroupId = randomUUID();

    const out = await tx.transaction.create({
      data: {
        tenantId,
        userId,
        accountId: from.id,
        type: 'expense',
        amount: amountNum,
        categoryId: null,
        transactionDate: txDate,
        description: `[Transfer Keluar] ${note}`,
        source,
        status: 'active',
        transferGroupId,
        transferDirection: 'out',
      },
    });

    const incoming = await tx.transaction.create({
      data: {
        tenantId,
        userId,
        accountId: to.id,
        type: 'income',
        amount: amountNum,
        categoryId: null,
        transactionDate: txDate,
        description: `[Transfer Masuk] ${note}`,
        source,
        status: 'active',
        transferGroupId,
        transferDirection: 'in',
      },
    });

    const [updatedFrom, updatedTo] = await Promise.all([
      tx.account.update({ where: { id: from.id }, data: { currentBalance: Number(from.currentBalance) - amountNum } }),
      tx.account.update({ where: { id: to.id }, data: { currentBalance: Number(to.currentBalance) + amountNum } }),
    ]);

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'transaction.transfer',
        entityType: 'transaction',
        entityId: out.id,
        newValue: { transferGroupId, fromAccountId: from.id, toAccountId: to.id, amount: amountNum, source, outTransactionId: out.id, inTransactionId: incoming.id },
      },
    });

    return { out, incoming, from: updatedFrom, to: updatedTo, transferGroupId };
  });
}

export async function voidTransactionAtomic({ tenantId, userId, transactionId }) {
  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findFirst({
      where: { id: transactionId, tenantId },
    });
    if (!trx) throw new HttpError(404, 'Transaksi tidak ditemukan');
    if (trx.status === 'void') throw new HttpError(400, 'Transaksi sudah dibatalkan');

    if (trx.transferGroupId) {
      const pair = await tx.transaction.findMany({
        where: { tenantId, transferGroupId: trx.transferGroupId, status: 'active' },
      });
      for (const item of pair) {
        const account = await tx.account.findUnique({ where: { id: item.accountId } });
        let newBalance = Number(account.currentBalance);
        const amt = Number(item.amount);
        if (item.type === 'income') newBalance -= amt;
        else if (item.type === 'expense') newBalance += amt;
        await tx.account.update({ where: { id: account.id }, data: { currentBalance: newBalance } });
        await tx.transaction.update({ where: { id: item.id }, data: { status: 'void' } });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'transaction.transfer.void',
          entityType: 'transaction',
          entityId: trx.id,
          oldValue: { status: 'active', transferGroupId: trx.transferGroupId },
          newValue: { status: 'void' },
        },
      });

      return tx.transaction.findUnique({ where: { id: trx.id } });
    }

    const account = await tx.account.findUnique({ where: { id: trx.accountId } });
    let newBalance = Number(account.currentBalance);
    const amt = Number(trx.amount);

    if (trx.type === 'income') newBalance -= amt;
    else if (trx.type === 'expense') newBalance += amt;
    else if (trx.type === 'adjustment') {
      const adj = await tx.balanceAdjustment.findUnique({
        where: { transactionId: trx.id },
      });
      if (adj) newBalance = Number(adj.previousBalance);
    }

    await tx.account.update({
      where: { id: account.id },
      data: { currentBalance: newBalance },
    });

    const updated = await tx.transaction.update({
      where: { id: trx.id },
      data: { status: 'void' },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'transaction.void',
        entityType: 'transaction',
        entityId: trx.id,
        oldValue: { status: 'active' },
        newValue: { status: 'void' },
      },
    });

    return updated;
  });
}

export async function updateTransactionAtomic({
  tenantId,
  userId,
  transactionId,
  amount,
  accountId,
  categoryId,
  transactionDate,
}) {
  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findFirst({
      where: { id: transactionId, tenantId },
    });
    if (!trx) throw new HttpError(404, 'Transaksi tidak ditemukan');
    if (trx.status === 'void') throw new HttpError(400, 'Transaksi void tidak bisa diedit');
    if (trx.type === 'adjustment') {
      throw new HttpError(400, 'Transaksi penyesuaian saldo tidak bisa diedit dari menu transaksi');
    }

    const nextAmount = Number(amount ?? trx.amount);
    if (!nextAmount || nextAmount <= 0) throw new HttpError(400, 'Nominal harus lebih dari 0');

    const nextAccountId = accountId || trx.accountId;
    const nextCategoryId = categoryId === undefined ? trx.categoryId : categoryId || null;
    const nextDate = transactionDate ? new Date(transactionDate) : trx.transactionDate;

    const oldAccount = await tx.account.findFirst({
      where: { id: trx.accountId, tenantId },
    });
    if (!oldAccount) throw new HttpError(404, 'Akun lama tidak ditemukan');

    const newAccount = await tx.account.findFirst({
      where: { id: nextAccountId, tenantId },
    });
    if (!newAccount) throw new HttpError(404, 'Akun baru tidak ditemukan');
    if (newAccount.status !== 'active') throw new HttpError(400, 'Akun baru tidak aktif');

    if (nextCategoryId) {
      const cat = await tx.category.findFirst({
        where: { id: nextCategoryId, tenantId },
      });
      if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');
      if (cat.type !== trx.type) throw new HttpError(400, 'Kategori tidak sesuai tipe transaksi');
    }

    const oldDelta = signedAmount(trx.type, trx.amount);
    const newDelta = signedAmount(trx.type, nextAmount);

    if (oldAccount.id === newAccount.id) {
      const balance = Number(oldAccount.currentBalance) - oldDelta + newDelta;
      await tx.account.update({
        where: { id: oldAccount.id },
        data: { currentBalance: balance },
      });
    } else {
      await tx.account.update({
        where: { id: oldAccount.id },
        data: { currentBalance: Number(oldAccount.currentBalance) - oldDelta },
      });
      await tx.account.update({
        where: { id: newAccount.id },
        data: { currentBalance: Number(newAccount.currentBalance) + newDelta },
      });
    }

    const updated = await tx.transaction.update({
      where: { id: trx.id },
      data: {
        amount: nextAmount,
        accountId: nextAccountId,
        categoryId: nextCategoryId,
        transactionDate: nextDate,
      },
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'transaction.update',
        entityType: 'transaction',
        entityId: trx.id,
        oldValue: {
          amount: Number(trx.amount),
          accountId: trx.accountId,
          categoryId: trx.categoryId,
          transactionDate: trx.transactionDate,
        },
        newValue: {
          amount: nextAmount,
          accountId: nextAccountId,
          categoryId: nextCategoryId,
          transactionDate: nextDate,
        },
      },
    });

    return updated;
  });
}
