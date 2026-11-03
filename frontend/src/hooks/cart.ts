import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi, type Cart } from '@/api';
import { toast } from '@/stores';
import { getErrorMessage, hasStatus } from '@/utils/errors';
import { roundMoney } from '@/utils/money';
import { cartKeys } from './query-keys';

/**
 * Current cart (guest or member). Shared by the header badge and the cart page, so both read the
 * same `['cart']` cache entry. `CartItem` already carries title/author/format/cover/prices, so no
 * extra catalog lookups are needed to render it.
 */
export function useCart() {
  return useQuery({ queryKey: cartKeys.all, queryFn: cartApi.getCart });
}

export interface AddToCartVariables {
  bookId: string;
  quantity?: number;
  /** Only used for the confirmation toast. */
  title?: string;
}

/** Adds a book to the guest/member cart and refreshes every `['cart']` query (header badge). */
export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, quantity = 1 }: AddToCartVariables) =>
      cartApi.addItem({ bookId, quantity }),
    onSuccess: async (_cart, { title }) => {
      toast.success(title ? `Added "${title}" to your cart.` : 'Added to your cart.');
      await queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

/**
 * User-facing message for a failed cart change. 409/422 carry the server's explanation
 * (e.g. "Only 2 unit(s) of "X" available"); 404 means the line vanished (removed elsewhere).
 */
export function cartErrorMessage(error: unknown): string {
  if (hasStatus(error, 404)) return 'This item is no longer in your cart.';
  return getErrorMessage(error);
}

/** Re-derives the totals the server would return after the items change (best-effort preview). */
function withItems(cart: Cart, items: Cart['items']): Cart {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const taxAmount =
    cart.subtotal > 0 ? roundMoney((cart.taxAmount * subtotal) / cart.subtotal) : cart.taxAmount;
  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    taxAmount,
    totalAmount: roundMoney(subtotal + taxAmount + cart.shippingFee),
  };
}

interface CartMutationContext {
  previous: Cart | undefined;
}

/**
 * Shared optimistic-update plumbing: cancel in-flight cart fetches, snapshot, apply `optimistic`
 * to the cache, roll back on error (with a toast), and always refetch the server's truth.
 */
function useOptimisticCartMutation<TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<Cart>;
  optimistic: (cart: Cart, variables: TVariables) => Cart;
}) {
  const queryClient = useQueryClient();
  return useMutation<Cart, Error, TVariables, CartMutationContext>({
    mutationFn: options.mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: cartKeys.all });
      const previous = queryClient.getQueryData<Cart>(cartKeys.all);
      if (previous) {
        queryClient.setQueryData<Cart>(cartKeys.all, options.optimistic(previous, variables));
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData<Cart>(cartKeys.all, context.previous);
      toast.error(cartErrorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cartKeys.all }),
  });
}

export interface UpdateCartItemVariables {
  itemId: string;
  quantity: number;
}

/** Sets a line's quantity (>= 1). Optimistic; rolled back with a toast on 404/409/422. */
export function useUpdateCartItem() {
  return useOptimisticCartMutation<UpdateCartItemVariables>({
    mutationFn: ({ itemId, quantity }) => cartApi.updateItem(itemId, { quantity }),
    optimistic: (cart, { itemId, quantity }) =>
      withItems(
        cart,
        cart.items.map((item) =>
          item.id === itemId
            ? { ...item, quantity, lineTotal: roundMoney(item.unitPrice * quantity) }
            : item,
        ),
      ),
  });
}

export interface RemoveCartItemVariables {
  itemId: string;
}

/** Removes a line. Optimistic; rolled back with a toast on failure. */
export function useRemoveCartItem() {
  return useOptimisticCartMutation<RemoveCartItemVariables>({
    mutationFn: ({ itemId }) => cartApi.removeItem(itemId),
    optimistic: (cart, { itemId }) =>
      withItems(
        cart,
        cart.items.filter((item) => item.id !== itemId),
      ),
  });
}
