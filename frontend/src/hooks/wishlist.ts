import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { wishlistApi } from '@/api';
import { selectIsAuthenticated, toast, useAuthStore } from '@/stores';
import { getErrorMessage, hasStatus } from '@/utils/errors';
import { cartKeys, wishlistKeys } from './query-keys';

/** The member's wishlist. Disabled for guests (the endpoint requires a Bearer token). */
export function useWishlist() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  return useQuery({
    queryKey: wishlistKeys.all,
    queryFn: wishlistApi.getWishlist,
    enabled: isAuthenticated,
  });
}

/** Book ids on the member's wishlist (empty for guests). */
export function useWishlistedIds(): ReadonlySet<string> {
  const { data } = useWishlist();
  return useMemo(() => new Set(data?.map((item) => item.book.id) ?? []), [data]);
}

export interface ToggleWishlistVariables {
  bookId: string;
  /** Current state: `true` removes the book, `false` adds it. */
  wishlisted: boolean;
  /** Only used for the confirmation toast. */
  title?: string;
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, wishlisted }: ToggleWishlistVariables): Promise<void> => {
      if (wishlisted) await wishlistApi.removeItem(bookId);
      else await wishlistApi.addItem(bookId);
    },
    onSuccess: async (_data, { wishlisted, title }) => {
      const subject = title ? `"${title}"` : 'Book';
      toast.success(
        wishlisted
          ? `${subject} removed from your wishlist.`
          : `${subject} added to your wishlist.`,
      );
      await queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export interface MoveToCartVariables {
  bookId: string;
  /** Only used for the confirmation toast. */
  title?: string;
}

/**
 * Moves a wishlist book into the cart (server adds 1 unit and removes the wishlist entry
 * atomically). Refreshes both lists; a 422 (e.g. out of stock) leaves the book on the wishlist.
 */
export function useMoveWishlistToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId }: MoveToCartVariables) => wishlistApi.moveToCart(bookId),
    onSuccess: async (_cart, { title }) => {
      toast.success(title ? `Moved "${title}" to your cart.` : 'Moved to your cart.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cartKeys.all }),
        queryClient.invalidateQueries({ queryKey: wishlistKeys.all }),
      ]);
    },
    onError: async (error) => {
      toast.error(getErrorMessage(error));
      // 404: the entry is already gone, so resync the list.
      if (hasStatus(error, 404))
        await queryClient.invalidateQueries({ queryKey: wishlistKeys.all });
    },
  });
}
