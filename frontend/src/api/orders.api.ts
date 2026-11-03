import { apiClient } from './client';
import type {
  Cart,
  CheckoutSummary,
  CheckoutSummaryRequest,
  CreateOrderRequest,
  ListOrdersParams,
  Order,
  OrderPage,
} from './types';

const enc = encodeURIComponent;

export interface CreateOrderResult {
  order: Order;
  /** `true` when the Idempotency-Key matched an existing order (HTTP 200 instead of 201). */
  replayed: boolean;
}

export const ordersApi = {
  /** Works for guests (via `x-guest-session-id`) and members. */
  checkoutSummary: (body: CheckoutSummaryRequest) =>
    apiClient.post<CheckoutSummary>('/orders/checkout/summary', body),

  /**
   * `idempotencyKey` is mandatory: generate one per checkout attempt with
   * `newIdempotencyKey()` and reuse it on retries so duplicates are not created.
   */
  async create(body: CreateOrderRequest, idempotencyKey: string): Promise<CreateOrderResult> {
    const { data, status } = await apiClient.requestRaw<Order>('POST', '/orders', {
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return { order: data, replayed: status === 200 };
  },

  list: (params?: ListOrdersParams) => apiClient.get<OrderPage>('/orders', { query: params }),

  get: (orderId: string) => apiClient.get<Order>(`/orders/${enc(orderId)}`),

  cancel: (orderId: string, reason?: string) =>
    apiClient.post<Order>(`/orders/${enc(orderId)}/cancel`, reason ? { reason } : {}),

  /** `reason` is required by the contract (3-255 characters). */
  return: (orderId: string, reason: string) =>
    apiClient.post<Order>(`/orders/${enc(orderId)}/return`, { reason }),

  buyAgain: (orderId: string) => apiClient.post<Cart>(`/orders/${enc(orderId)}/buy-again`),
};
