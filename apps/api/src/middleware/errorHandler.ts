import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/utils';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: 'Validation error', details: err.flatten() });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл больше 5 МБ' });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === 'P2002') return res.status(409).json({ error: 'Already exists' });
  if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
  if (err?.code === 'P2003') return res.status(409).json({ error: 'Referenced record does not exist or is still in use' });
  if (err?.code === 'P2004') return res.status(400).json({ error: 'Data integrity constraint failed' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
