import { apiClient } from './client';
import type { AddCartItemRequest, Cart, UpdateCartItemRequest } from './types';

const enc = encodeURIComponent;

/**
 * Cart works for guests and members. The client automatically sends `x-guest-session-id`
 * (when known) and captures it from responses, so callers never handle the header.
 */
export const cartApi = {
  getCart: () => apiClient.get<Cart>('/cart'),

  addItem: (body: AddCartItemRequest) => apiClient.post<Cart>('/cart/items', body),

  updateItem: (itemId: string, body: UpdateCartItemRequest) =>
    apiClient.put<Cart>(`/cart/items/${enc(itemId)}`, body),

  removeItem: (itemId: string) => apiClient.delete<Cart>(`/cart/items/${enc(itemId)}`),

  /** Requires a Bearer token; call right after login/register with the stored guest session id. */
  merge: (guestSessionId: string) => apiClient.post<Cart>('/cart/merge', { guestSessionId }),
};
