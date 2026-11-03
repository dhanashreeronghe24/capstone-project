import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { forbidden, unauthorized } from '../utils/http-error';

export type RoleName =
  | 'ROLE_CUSTOMER'
  | 'ROLE_CATALOG_ADMIN'
  | 'ROLE_STORE_ADMIN'
  | 'ROLE_FULFILLMENT'
  | 'ROLE_SYSTEM';

export interface AuthUser {
  id: string;
  email: string;
  roles: RoleName[];
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: RoleName[];
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const signAccessToken = (user: AuthUser): string =>
  jwt.sign({ email: user.email, roles: user.roles } satisfies Omit<AccessTokenPayload, 'sub'>, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    algorithm: 'HS256',
  });

const parseBearer = (req: Request): AuthUser | null => {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized('Malformed Authorization header');
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as unknown as AccessTokenPayload;
    return { id: payload.sub, email: payload.email, roles: payload.roles };
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
};

/** Requires a valid JWT. */
export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const user = parseBearer(req);
    if (!user) throw unauthorized();
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

/** Populates req.user when a valid JWT is supplied, otherwise continues as guest. */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const user = parseBearer(req);
    if (user) req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

/** RBAC guard; must run after `authenticate`. */
export const requireRole =
  (...allowed: RoleName[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!req.user.roles.some((r) => allowed.includes(r))) return next(forbidden());
    next();
  };
