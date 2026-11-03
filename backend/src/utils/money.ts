import { Prisma } from '@prisma/client';

/** Convert Prisma Decimal (or null) to a plain JS number for JSON responses. */
export const num = (v: Prisma.Decimal | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

export const numOrNull = (v: Prisma.Decimal | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Round to 2 decimal places (currency). */
export const round2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export const toDateOnly = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (d: Date, days: number): Date => {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
};
