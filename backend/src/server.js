import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import accountsRoutes from './routes/accounts.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import transactionsRoutes from './routes/transactions.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import adminRoutes from './routes/admin.routes.js';
import webhookRoutes from './routes/webhooks.routes.js';
import { errorHandler } from './utils/error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 4000);
const quietLogs = ['error', 'silent'].includes(String(process.env.LOG_LEVEL || '').toLowerCase());

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
if (!quietLogs) {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Serve uploaded files
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadDir));

// Rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
});

// Rate limit for webhooks
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
});

app.get('/health', (req, res) => res.json({ ok: true, service: 'catatin-backend' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookLimiter, webhookRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route tidak ditemukan' }));
app.use(errorHandler);

app.listen(PORT, () => {
  if (!quietLogs) {
    console.log(`CatatIN backend running on http://localhost:${PORT}`);
    console.log(`  WA provider: ${process.env.WA_PROVIDER || 'mock'}`);
    console.log(`  AI parser:   ${process.env.AI_PARSER_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
  }
});
