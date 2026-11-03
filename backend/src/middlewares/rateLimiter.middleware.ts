import rateLimit from 'express-rate-limit';
import { env } from '../config/env.config';

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    title: 'Too Many Requests',
    detail: 'Rate limit exceeded, please retry later',
    timestamp: new Date().toISOString(),
  },
});
