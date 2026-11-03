import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { BookSummary } from '@/api';
import { Button } from '@/components/ui/Button';
import { useAddToCart } from '@/hooks/cart';
import { useToggleWishlist, useWishlistedIds } from '@/hooks/wishlist';
import { selectIsAuthenticated, toast, useAuthStore } from '@/stores';
import { FORMAT_LABELS } from '@/utils/book-filters';
import { formatINR } from '@/utils/money';
import { loginPathWithRedirect } from '@/utils/redirect';

/** Book tile (wireframe image1): cover, title, author, format, category links, price, actions. */
export default function BookCard({ book }: { book: BookSummary }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const wishlisted = useWishlistedIds().has(book.id);
  const addToCart = useAddToCart();
  const toggleWishlist = useToggleWishlist();

  const onToggleWishlist = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to save books to your wishlist.');
      navigate(loginPathWithRedirect(`${location.pathname}${location.search}`));
      return;
    }
    toggleWishlist.mutate({ bookId: book.id, wishlisted, title: book.title });
  };

  const hasDiscount = book.listPrice != null && book.listPrice > book.price;

  return (
    <article
      aria-label={book.title}
      className="flex h-full gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3"
    >
      <Link to={`/books/${book.id}`} className="shrink-0" tabIndex={-1} aria-hidden="true">
        <img
          src={book.frontCoverUrl}
          alt=""
          loading="lazy"
          className="h-36 w-24 rounded object-cover"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-serif text-base leading-snug text-parchment-50">
          <Link to={`/books/${book.id}`} className="hover:text-accent-400">
            {book.title}
          </Link>
        </h3>
        <p className="text-sm text-parchment-400">by {book.author.name}</p>
        <p className="text-xs text-parchment-400">
          {FORMAT_LABELS[book.format]}
          {book.reviewCount > 0 ? (
            <span className="ml-2" aria-label={`Rated ${book.averageRating} out of 5`}>
              ★ {book.averageRating.toFixed(1)} ({book.reviewCount})
            </span>
          ) : null}
        </p>
        {book.categories.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 text-xs">
            {book.categories.map((category) => (
              <Link
                key={category.id}
                to={`/books?category=${encodeURIComponent(category.slug)}`}
                className="text-accent-400 underline hover:text-accent-500"
              >
                {category.name}
              </Link>
            ))}
          </p>
        ) : null}
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-parchment-50">
            {formatINR(book.price, { hideZeroDecimals: true })}
          </span>
          {hasDiscount ? (
            <span className="text-sm text-parchment-400 line-through">
              {formatINR(book.listPrice ?? 0, { hideZeroDecimals: true })}
            </span>
          ) : null}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button
            className="px-3 py-1.5"
            disabled={!book.inStock || addToCart.isPending}
            onClick={() => addToCart.mutate({ bookId: book.id, title: book.title })}
            aria-label={`Add ${book.title} to cart`}
          >
            {book.inStock ? 'Add to cart' : 'Out of stock'}
          </Button>
          <Button
            variant="secondary"
            className="px-3 py-1.5"
            aria-pressed={wishlisted}
            disabled={toggleWishlist.isPending}
            onClick={onToggleWishlist}
            aria-label={`${wishlisted ? 'Remove' : 'Add'} ${book.title} ${wishlisted ? 'from' : 'to'} wishlist`}
          >
            {wishlisted ? '♥ Wishlisted' : '♡ Wishlist'}
          </Button>
        </div>
      </div>
    </article>
  );
}
