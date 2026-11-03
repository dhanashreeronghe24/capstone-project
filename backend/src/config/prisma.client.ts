import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type TxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
