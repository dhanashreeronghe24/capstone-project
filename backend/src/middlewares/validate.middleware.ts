import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny, z } from 'zod';
import { badRequest, FieldError } from '../utils/http-error';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and replaces req[source] with the parsed (coerced / defaulted) value.
 * Failures are forwarded as 400 Problem Details.
 */
export const validate =
  <T extends ZodTypeAny>(schema: T, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors: FieldError[] = result.error.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message,
      }));
      next(badRequest(`Invalid request ${source}`, errors));
      return;
    }
    // Express 4 allows reassigning; cast keeps the parsed type available to controllers.
    (req as unknown as Record<Source, z.infer<T>>)[source] = result.data;
    next();
  };
