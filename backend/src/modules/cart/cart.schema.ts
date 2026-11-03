import { z } from 'zod';

export const AddCartItemSchema = z.object({
  bookId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100).default(1),
});
export type AddCartItemInput = z.infer<typeof AddCartItemSchema>;

export const UpdateCartItemSchema = z.object({ quantity: z.number().int().min(1).max(100) });
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;

export const MergeCartSchema = z.object({ guestSessionId: z.string().min(1).max(255) });
export type MergeCartInput = z.infer<typeof MergeCartSchema>;

export const WishlistAddSchema = z.object({ bookId: z.string().uuid() });
export type WishlistAddInput = z.infer<typeof WishlistAddSchema>;

export const ItemIdParamSchema = z.object({ itemId: z.string().uuid() });
export const BookIdParamSchema = z.object({ bookId: z.string().uuid() });
