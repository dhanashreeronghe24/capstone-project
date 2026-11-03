import type { SearchBooksParams } from '@/api';

/** TanStack Query keys shared across hooks so auth transitions can invalidate/clear them. */
export const cartKeys = { all: ['cart'] as const };

/** Public catalog data (safe to keep across login/logout). */
export const catalogKeys = {
  all: ['catalog'] as const,
  featured: ['catalog', 'featured'] as const,
  categories: ['catalog', 'categories'] as const,
  books: (params: SearchBooksParams) => ['catalog', 'books', params] as const,
  book: (id: string) => ['catalog', 'book', id] as const,
  related: (id: string) => ['catalog', 'book', id, 'related'] as const,
  /** Root of every reviews page for a book (use to invalidate after posting a review). */
  reviewsOf: (id: string) => ['catalog', 'book', id, 'reviews'] as const,
  reviews: (id: string, page: number, limit: number) =>
    ['catalog', 'book', id, 'reviews', { page, limit }] as const,
  author: (id: string) => ['catalog', 'author', id] as const,
};

/** Wishlist is member-only; its root is one of the `privateKeys` prefixes below. */
export const wishlistKeys = { all: ['wishlist'] as const };

/** Data that belongs to the signed-in member and must not survive logout/session expiry. */
export const privateKeys = [
  ['wishlist'],
  ['orders'],
  ['profile'],
  ['addresses'],
  ['checkout'],
] as const;
