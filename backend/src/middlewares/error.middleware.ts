import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http-error';
import { logger } from '../utils/logger';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, 'Not Found', `Route ${req.method} ${req.path} not found`));
};

/** Global error handler emitting RFC 7807 Problem Details. */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let status = 500;
  let title = 'Internal Server Error';
  let detail = 'An unexpected error occurred';
  let errors: HttpError['errors'];

  if (err instanceof HttpError) {
    status = err.status;
    title = err.title;
    detail = err.message;
    errors = err.errors;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    status = 409;
    title = 'Conflict';
    detail = 'A record with the same unique value already exists';
  } else if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
    status = 400;
    title = 'Bad Request';
    detail = 'Malformed JSON body';
  } else {
    logger.error('Unhandled error', { err });
  }

  res
    .status(status)
    .type('application/problem+json')
    .json({ status, title, detail, errors, timestamp: new Date().toISOString() });
};
