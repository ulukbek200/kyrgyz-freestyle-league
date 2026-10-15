import type {ErrorRequestHandler, RequestHandler} from 'express';
import {ZodError} from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve().then(() => handler(req, res, next)).catch(next);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return void res.status(error.status).json({error: error.message});
  if (error instanceof ZodError) return void res.status(400).json({error:'Проверьте параметры запроса'});
  if ((error as {code?:string})?.code==='P2002') return void res.status(409).json({error:'Такая запись уже существует'});
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    return void res.status(400).json({error: 'Invalid request'});
  }
  console.error(error);
  res.status(500).json({error: 'Invalid request'});
};
