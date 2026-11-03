import { env } from './config/env.config';
import { prisma } from './config/prisma.client';
import { createApp } from './app';
import { logger } from './utils/logger';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`BookWorm API listening on port ${env.PORT}`);
});

const shutdown = (signal: string): void => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
