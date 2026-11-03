import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateMessage';
import { useMoveWishlistToCart, useToggleWishlist, useWishlist } from '@/hooks/wishlist';
import { FORMAT_LABELS } from '@/utils/book-filters';
import { getErrorMessage } from '@/utils/errors';
import { formatINR } from '@/utils/money';

function WishlistSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading wishlist"
      className="flex flex-col gap-4"
    >
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

/** Member wishlist (`/wishlist`, behind `ProtectedRoute`): remove or move books to the cart. */
export default function WishlistPage() {
  const { data: items, isPending, error, refetch } = useWishlist();
  const removeItem = useToggleWishlist();
  const moveToCart = useMoveWishlistToCart();

  // Lock only the row that has a change in flight.
  const busyBookId =
    (removeItem.isPending ? removeItem.variables?.bookId : undefined) ??
    (moveToCart.isPending ? moveToCart.variables?.bookId : undefined);

  let content;
  if (error && !items) {
    content = <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  } else if (isPending) {
    content = <WishlistSkeleton />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        title="Your wishlist is empty"
        description="Save books you want to read later and they will show up here."
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
      <ul aria-label="Wishlist items" className="flex flex-col gap-4">
        {items.map(({ id, book }) => {
          const busy = busyBookId === book.id;
          const hasDiscount = book.listPrice != null && book.listPrice > book.price;
          return (
            <li
              key={id}
              aria-label={book.title}
              className="flex gap-4 rounded-lg border border-ink-700 bg-ink-900 p-4"
            >
              <Link to={`/books/${book.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
                <img
                  src={book.frontCoverUrl}
                  alt=""
                  loading="lazy"
                  className="h-36 w-24 rounded object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="font-serif text-lg leading-snug text-parchment-50">
                  <Link to={`/books/${book.id}`} className="hover:text-accent-400">
                    {book.title}
                  </Link>
                </h2>
                <p className="text-sm text-parchment-400">by {book.author.name}</p>
                <p className="text-xs text-parchment-400">{FORMAT_LABELS[book.format]}</p>
                <p className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-parchment-50">
                    {formatINR(book.price, { hideZeroDecimals: true })}
                  </span>
                  {hasDiscount ? (
                    <span className="text-sm text-parchment-400 line-through">
                      {formatINR(book.listPrice ?? 0, { hideZeroDecimals: true })}
                    </span>
                  ) : null}
                </p>
                <p className={`text-sm ${book.inStock ? 'text-success' : 'text-danger'}`}>
                  {book.inStock ? 'In stock' : 'Out of stock'}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <Button
                    className="px-3 py-1.5"
                    disabled={busy || !book.inStock}
                    aria-label={`Move ${book.title} to cart`}
                    onClick={() => moveToCart.mutate({ bookId: book.id, title: book.title })}
                  >
                    Move to cart
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5"
                    disabled={busy}
                    aria-label={`Remove ${book.title} from wishlist`}
                    onClick={() =>
                      removeItem.mutate({ bookId: book.id, wishlisted: true, title: book.title })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl text-accent-400">My Wishlist</h1>
      {content}
    </div>
  );
}
