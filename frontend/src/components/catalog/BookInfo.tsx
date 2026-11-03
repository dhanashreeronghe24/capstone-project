import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { BookDetail } from '@/api';
import { Button } from '@/components/ui/Button';
import StarRating from '@/components/ui/StarRating';
import { useAddToCart } from '@/hooks/cart';
import { useToggleWishlist, useWishlistedIds } from '@/hooks/wishlist';
import { selectIsAuthenticated, toast, useAuthStore } from '@/stores';
import { FORMAT_LABELS } from '@/utils/book-filters';
import { discountPercent, formatINR } from '@/utils/money';
import { loginPathWithRedirect } from '@/utils/redirect';

/** Highest quantity a customer can add in one go (also capped by stock). */
const MAX_QUANTITY = 10;
const LOW_STOCK_THRESHOLD = 5;

function clampQuantity(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

/** Covers, title block, price, stock and purchase actions of the PDP (wireframe image3). */
export default function BookInfo({ book }: { book: BookDetail }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const wishlisted = useWishlistedIds().has(book.id);
  const addToCart = useAddToCart();
  const toggleWishlist = useToggleWishlist();
  const [quantity, setQuantity] = useState(1);

  const maxQuantity = Math.max(1, Math.min(book.stockQuantity, MAX_QUANTITY));
  const hasDiscount = book.listPrice != null && book.listPrice > book.price;
  const percentOff = discountPercent(book.price, book.listPrice);

  const onToggleWishlist = () => {
    if (!isAuthenticated) {
      toast.info('Please log in to save books to your wishlist.');
      navigate(loginPathWithRedirect(`${location.pathname}${location.search}`));
      return;
    }
    toggleWishlist.mutate({ bookId: book.id, wishlisted, title: book.title });
  };

  let stockLabel = 'In stock';
  let stockClass = 'text-success';
  if (!book.inStock) {
    stockLabel = 'Out of stock';
    stockClass = 'text-danger';
  } else if (book.stockQuantity <= LOW_STOCK_THRESHOLD) {
    stockLabel = `Only ${book.stockQuantity} left in stock`;
    stockClass = 'text-accent-400';
  }

  return (
    <section aria-label="Book details" className="flex flex-col gap-6 md:flex-row">
      <div className="flex shrink-0 gap-3">
        <img
          src={book.frontCoverUrl}
          alt={`Front cover of ${book.title}`}
          className="h-72 w-48 rounded object-cover"
        />
        {book.backCoverUrl ? (
          <img
            src={book.backCoverUrl}
            alt={`Back cover of ${book.title}`}
            className="hidden h-72 w-48 rounded object-cover lg:block"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h1 className="font-serif text-3xl leading-tight text-parchment-50">{book.title}</h1>
        {book.subtitle ? <p className="text-parchment-200">{book.subtitle}</p> : null}
        <p className="text-sm text-parchment-200">
          By{' '}
          <Link
            to={`/books?q=${encodeURIComponent(book.author.name)}`}
            className="text-accent-400 underline hover:text-accent-500"
          >
            {book.author.name}
          </Link>
        </p>
        {book.publisher ? (
          <p className="text-sm text-parchment-400">Published by {book.publisher.name}</p>
        ) : null}
        <p className="text-sm text-parchment-400">{FORMAT_LABELS[book.format]}</p>
        {book.categories.length > 0 ? (
          <p className="flex flex-wrap gap-x-2 text-sm">
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
        {book.description ? (
          <p className="mt-1 text-sm leading-relaxed text-parchment-200">{book.description}</p>
        ) : null}

        <p className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold text-parchment-50" aria-label="Price">
            {formatINR(book.price, { hideZeroDecimals: true })}
          </span>
          {hasDiscount ? (
            <>
              <span className="text-parchment-400 line-through" aria-label="List price">
                {formatINR(book.listPrice ?? 0, { hideZeroDecimals: true })}
              </span>
              {percentOff > 0 ? (
                <span className="text-sm text-success">{percentOff}% off</span>
              ) : null}
            </>
          ) : null}
        </p>
        <p className={`text-sm font-medium ${stockClass}`}>{stockLabel}</p>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="pdp-quantity" className="text-sm text-parchment-200">
              Quantity
            </label>
            <div className="flex items-center">
              <Button
                variant="secondary"
                className="px-3 py-2"
                aria-label="Decrease quantity"
                disabled={!book.inStock || quantity <= 1}
                onClick={() => setQuantity((q) => clampQuantity(q - 1, maxQuantity))}
              >
                −
              </Button>
              <input
                id="pdp-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQuantity}
                value={quantity}
                disabled={!book.inStock}
                onChange={(event) =>
                  setQuantity(clampQuantity(event.target.valueAsNumber, maxQuantity))
                }
                className="mx-1 w-16 rounded-md border border-ink-600 bg-ink-900 px-2 py-2 text-center text-parchment-50 disabled:opacity-60"
              />
              <Button
                variant="secondary"
                className="px-3 py-2"
                aria-label="Increase quantity"
                disabled={!book.inStock || quantity >= maxQuantity}
                onClick={() => setQuantity((q) => clampQuantity(q + 1, maxQuantity))}
              >
                +
              </Button>
            </div>
          </div>
          <Button
            disabled={!book.inStock || addToCart.isPending}
            onClick={() => addToCart.mutate({ bookId: book.id, quantity, title: book.title })}
          >
            {book.inStock ? 'Add to Cart' : 'Out of stock'}
          </Button>
          <Button
            variant="secondary"
            aria-pressed={wishlisted}
            disabled={toggleWishlist.isPending}
            onClick={onToggleWishlist}
          >
            {wishlisted ? '♥ Remove from Wishlist' : '♡ Add to Wishlist'}
          </Button>
        </div>

        <dl className="mt-4 grid max-w-md grid-cols-3 gap-4 border-t border-ink-700 pt-4 text-sm">
          <div>
            <dt className="text-parchment-400">Language</dt>
            <dd className="text-parchment-50">{book.language ?? 'English'}</dd>
          </div>
          <div>
            <dt className="text-parchment-400">Rating</dt>
            <dd className="flex flex-col text-parchment-50">
              <StarRating value={book.averageRating} />
              <span className="text-xs text-parchment-400">
                {book.reviewCount} {book.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-parchment-400">Sells</dt>
            <dd className="text-parchment-50">{book.totalSalesCount} copies sold</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
