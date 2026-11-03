import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import { env } from '../config/env.config';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

export const correlationId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.header('x-correlation-id') as string | undefined) ?? randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
};

morgan.token('cid', (req) => (req as Request).correlationId ?? '-');

export const httpLogger = morgan(':cid :method :url :status :response-time ms', {
  skip: () => env.NODE_ENV === 'test',
});
