import winston from 'winston';
import { env } from '../config/env.config';

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'test' ? 'error' : 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});
