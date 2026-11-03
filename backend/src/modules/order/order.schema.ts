import { z } from 'zod';
import { AddressInputSchema, IdParamSchema as _Id } from '../member/member.schema';
import { PostalCodeSchema, ShippingTierEnum } from '../shipping/shipping.schema';

export const OrderStatusEnum = z.enum([
  'CREATED', 'PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED',
  'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
]);

export const CheckoutSummarySchema = z.object({
  postalCode: PostalCodeSchema,
  shippingTier: ShippingTierEnum.default('STANDARD'),
  couponCode: z.string().trim().min(1).max(50).optional(),
  redeemPoints: z.number().int().min(0).default(0),
});
export type CheckoutSummaryInput = z.infer<typeof CheckoutSummarySchema>;

export const CreateOrderSchema = z
  .object({
    addressId: z.string().uuid().optional(),
    shippingAddress: AddressInputSchema.optional(),
    shippingTier: ShippingTierEnum.default('STANDARD'),
    couponCode: z.string().trim().min(1).max(50).optional(),
    redeemPoints: z.number().int().min(0).default(0),
  })
  .refine((v) => v.addressId || v.shippingAddress, {
    message: 'Either addressId or shippingAddress is required',
    path: ['shippingAddress'],
  });
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const OrderListQuerySchema = z.object({
  status: OrderStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

export const OrderIdParamSchema = z.object({ orderId: z.string().uuid() });

export const CancelOrderSchema = z.object({ reason: z.string().trim().max(255).optional() }).default({});
export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

export const ReturnOrderSchema = z.object({ reason: z.string().trim().min(3).max(255) });
export type ReturnOrderInput = z.infer<typeof ReturnOrderSchema>;

export const UpdateStatusSchema = z
  .object({
    status: OrderStatusEnum,
    comments: z.string().trim().max(255).optional(),
    carrierName: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.status !== 'SHIPPED' || !!v.carrierName, {
    message: 'carrierName is required when moving to SHIPPED',
    path: ['carrierName'],
  });
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;

export const ValidateCouponSchema = z.object({ code: z.string().trim().min(1).max(50) });
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;

export { _Id as IdParamSchema };
