import { apiClient } from './client';
import type { Cart, WishlistItem } from './types';

const enc = encodeURIComponent;

/** All wishlist endpoints require a Bearer token. */
export const wishlistApi = {
  getWishlist: () => apiClient.get<WishlistItem[]>('/wishlist'),

  addItem: (bookId: string) => apiClient.post<WishlistItem>('/wishlist/items', { bookId }),

  removeItem: (bookId: string) => apiClient.delete<void>(`/wishlist/items/${enc(bookId)}`),

  moveToCart: (bookId: string) => apiClient.post<Cart>(`/wishlist/move-to-cart/${enc(bookId)}`),
};
