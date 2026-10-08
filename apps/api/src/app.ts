import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './env';
import { authenticate, requireRole } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { adminRouter } from './routes/admin';
import { competitionAdmin, competitionPublic } from './routes/competition';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), { maxAge: '7d' }));
app.use(cors({ origin: env.WEB_URL }));
app.use(express.json({ limit: '1mb' }));

const limiter = (max: number) => rateLimit({ windowMs: 15 * 60_000, max, standardHeaders: true, legacyHeaders: false });
app.post('/api/applications', limiter(10));
app.post('/api/auth/login', limiter(10));

app.get('/api/health', (_q, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/admin/competitions', authenticate, requireRole('ADMIN'), competitionAdmin);
app.use('/api/competitions', competitionPublic);
app.use('/api/admin', authenticate, requireRole('ADMIN'), adminRouter);
app.use('/api', publicRouter);
app.use((_q, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);
