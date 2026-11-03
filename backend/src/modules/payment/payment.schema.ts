import { z } from 'zod';

export const PaymentMethodEnum = z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'WALLET']);

export const InitiatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  paymentMethod: PaymentMethodEnum,
});
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;

export const ConfirmPaymentSchema = z
  .object({
    paymentId: z.string().uuid(),
    paymentMethod: PaymentMethodEnum,
    card: z
      .object({
        number: z.string().regex(/^[0-9]{13,19}$/, 'card number must be 13-19 digits'),
        holderName: z.string().trim().min(1).max(150),
        cvv: z.string().regex(/^[0-9]{3,4}$/, 'cvv must be 3-4 digits'),
        expiry: z.string().regex(/^(0[1-9]|1[0-2])\/[0-9]{2}$/, 'expiry must be MM/YY'),
      })
      .optional(),
    upiId: z.string().regex(/^[\w.\-]{2,}@[\w.\-]{2,}$/, 'invalid UPI id').optional(),
    walletId: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((v, ctx) => {
    const needs = (ok: boolean, path: string, message: string): void => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };
    if (v.paymentMethod === 'CREDIT_CARD' || v.paymentMethod === 'DEBIT_CARD') {
      needs(!!v.card, 'card', 'card details are required');
    } else if (v.paymentMethod === 'UPI') {
      needs(!!v.upiId, 'upiId', 'upiId is required');
    } else {
      needs(!!v.walletId, 'walletId', 'walletId is required');
    }
  });
export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;

export const WebhookSchema = z.object({
  gatewayOrderId: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED']),
});
export type WebhookInput = z.infer<typeof WebhookSchema>;

export const RefundSchema = z.object({
  amount: z.number().min(0.01).optional(),
  reason: z.string().trim().min(1).max(255),
});
export type RefundInput = z.infer<typeof RefundSchema>;

export const PaymentIdParamSchema = z.object({ paymentId: z.string().uuid() });
