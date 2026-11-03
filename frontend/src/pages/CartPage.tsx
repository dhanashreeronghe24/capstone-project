import { Link, useNavigate } from 'react-router-dom';
import type { CartItem } from '@/api';
import CartItemRow from '@/components/cart/CartItemRow';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateMessage';
import { useCart, useRemoveCartItem, useUpdateCartItem } from '@/hooks/cart';
import { selectIsAuthenticated, useAuthStore } from '@/stores';
import { getErrorMessage } from '@/utils/errors';
import { formatINR } from '@/utils/money';
import { loginPathWithRedirect } from '@/utils/redirect';

const CHECKOUT_PATH = '/checkout';

function CartSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading cart" className="flex flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
          <Skeleton className="h-36 w-24 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shopping cart for guests and members (top section of wireframe image4). */
export default function CartPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const { data: cart, isPending, error, refetch } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();

  // Lock only the line that has a change in flight.
  const busyItemId =
    (updateItem.isPending ? updateItem.variables?.itemId : undefined) ??
    (removeItem.isPending ? removeItem.variables?.itemId : undefined);

  const onCheckout = () => {
    navigate(isAuthenticated ? CHECKOUT_PATH : loginPathWithRedirect(CHECKOUT_PATH));
  };

  let content;
  if (error && !cart) {
    content = <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  } else if (isPending) {
    content = <CartSkeleton />;
  } else if (cart.items.length === 0) {
    content = (
      <EmptyState
        title="Your cart is empty"
        description="Browse the catalogue and add a few books you would love to read."
        action={
          <Link
            to="/books"
            className="inline-block rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-400"
          >
            Browse books
          </Link>
        }
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ul aria-label="Cart items" className="flex flex-1 flex-col gap-4">
          {cart.items.map((item: CartItem) => (
            <CartItemRow
              key={item.id}
              item={item}
              busy={busyItemId === item.id}
              onQuantityChange={(line, quantity) =>
                updateItem.mutate({ itemId: line.id, quantity })
              }
              onRemove={(line) => removeItem.mutate({ itemId: line.id })}
            />
          ))}
        </ul>
        <aside
          aria-label="Cart summary"
          className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4 lg:w-80"
        >
          <h2 className="font-serif text-xl text-parchment-50">Order Summary</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-parchment-400">Items</dt>
              <dd data-testid="summary-item-count" className="text-parchment-50">
                {cart.itemCount}
              </dd>
            </div>
            <div className="flex justify-between border-t border-ink-700 pt-2 text-base">
              <dt className="text-parchment-200">Subtotal</dt>
              <dd data-testid="summary-subtotal" className="font-semibold text-parchment-50">
                {formatINR(cart.subtotal, { hideZeroDecimals: true })}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-parchment-400">
            Tax, delivery charges, coupons and reward points are calculated at checkout.
          </p>
          <Button onClick={onCheckout}>Proceed to Checkout</Button>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl text-accent-400">Shopping Cart</h1>
      {content}
    </div>
  );
}
