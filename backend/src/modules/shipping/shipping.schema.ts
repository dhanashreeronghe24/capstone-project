import { z } from 'zod';

export const PostalCodeSchema = z.string().regex(/^[0-9]{6}$/, 'postalCode must be a 6-digit PIN');
export const ShippingTierEnum = z.enum(['STANDARD', 'EXPRESS']);

export const CalculateRateSchema = z.object({
  postalCode: PostalCodeSchema,
  weightKg: z.number().min(0.01).max(1000),
  orderAmount: z.number().min(0).optional(),
  tier: ShippingTierEnum.default('STANDARD'),
});
export type CalculateRateInput = z.infer<typeof CalculateRateSchema>;

export const EstimateQuerySchema = z.object({
  postalCode: PostalCodeSchema,
  tier: ShippingTierEnum.default('STANDARD'),
  bookId: z.string().uuid().optional(),
});
export type EstimateQuery = z.infer<typeof EstimateQuerySchema>;

export const TrackingParamSchema = z.object({ trackingNumber: z.string().min(1).max(100) });
