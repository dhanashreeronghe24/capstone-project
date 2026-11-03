import { apiClient } from './client';
import type {
  ConfirmPaymentRequest,
  PaymentMethod,
  PaymentOutcome,
  PaymentTransaction,
} from './types';

/** Mock gateway only. Card numbers ending in `0000` yield a FAILED outcome (still HTTP 200). */
export const paymentsApi = {
  initiate: (orderId: string, paymentMethod: PaymentMethod, idempotencyKey?: string) =>
    apiClient.post<PaymentTransaction>(
      '/payments/initiate',
      { orderId, paymentMethod },
      { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined },
    ),

  /** Card data is sent once and never stored by the client; do not log this payload. */
  confirm: (body: ConfirmPaymentRequest) =>
    apiClient.post<PaymentOutcome>('/payments/confirm', body),
};
