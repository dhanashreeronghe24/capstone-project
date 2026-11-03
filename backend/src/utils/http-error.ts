import { NextFunction, Request, RequestHandler, Response } from 'express';

export interface FieldError {
  field: string;
  message: string;
}

/** Error carrying an HTTP status; rendered as RFC 7807 Problem Details by the error middleware. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    message: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, errors?: FieldError[]): HttpError =>
  new HttpError(400, 'Bad Request', msg, errors);
export const unauthorized = (msg = 'Authentication required'): HttpError =>
  new HttpError(401, 'Unauthorized', msg);
export const forbidden = (msg = 'Insufficient permissions'): HttpError =>
  new HttpError(403, 'Forbidden', msg);
export const notFound = (msg: string): HttpError => new HttpError(404, 'Not Found', msg);
export const conflict = (msg: string): HttpError => new HttpError(409, 'Conflict', msg);
export const unprocessable = (msg: string): HttpError =>
  new HttpError(422, 'Unprocessable Entity', msg);

/** Wraps an async handler so rejections are forwarded to the global error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
