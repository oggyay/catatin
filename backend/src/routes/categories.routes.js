import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireTenant, requireActiveSubscription);

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type } = req.query;
    const categories = await prisma.category.findMany({
      where: {
        tenantId: req.tenantId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json({ data: categories });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const exists = await prisma.category.findFirst({
      where: { tenantId: req.tenantId, name: payload.name, type: payload.type },
    });
    if (exists) throw new HttpError(409, 'Kategori sudah ada');
    const cat = await prisma.category.create({
      data: { ...payload, tenantId: req.tenantId, status: 'active' },
    });
    res.status(201).json({ data: cat });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cat = await prisma.category.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');
    res.json({ data: cat });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = updateSchema.parse(req.body);
    const cat = await prisma.category.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');
    const updated = await prisma.category.update({ where: { id: cat.id }, data: payload });
    res.json({ data: updated });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const cat = await prisma.category.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');

    const used = await prisma.transaction.count({ where: { categoryId: cat.id } });
    if (used > 0) {
      const updated = await prisma.category.update({
        where: { id: cat.id },
        data: { status: 'inactive' },
      });
      return res.json({ data: updated, message: 'Kategori dinonaktifkan karena sudah digunakan' });
    }
    await prisma.category.delete({ where: { id: cat.id } });
    res.json({ message: 'Kategori dihapus' });
  })
);

export default router;
