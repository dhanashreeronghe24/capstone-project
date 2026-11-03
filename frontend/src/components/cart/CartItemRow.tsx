import { Link } from 'react-router-dom';
import type { CartItem } from '@/api';
import { Button } from '@/components/ui/Button';
import { FORMAT_LABELS } from '@/utils/book-filters';
import { formatINR } from '@/utils/money';

interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (item: CartItem, quantity: number) => void;
  onRemove: (item: CartItem) => void;
  /** True while a change to this line is in flight; the controls are locked to avoid races. */
  busy?: boolean;
}

/** One cart line (wireframe image4 "Shopping Cart"): cover, details, quantity stepper, totals. */
export default function CartItemRow({
  item,
  onQuantityChange,
  onRemove,
  busy = false,
}: CartItemRowProps) {
  return (
    <li
      aria-label={item.title}
      className="flex gap-4 rounded-lg border border-ink-700 bg-ink-900 p-4"
    >
      <Link to={`/books/${item.bookId}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <img src={item.coverImageUrl} alt="" className="h-36 w-24 rounded object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="font-serif text-lg leading-snug text-parchment-50">
          <Link to={`/books/${item.bookId}`} className="hover:text-accent-400">
            {item.title}
          </Link>
        </h2>
        <p className="text-sm text-parchment-400">by {item.author}</p>
        <p className="text-xs text-parchment-400">{FORMAT_LABELS[item.format]}</p>
        <p className="text-sm text-parchment-200">
          <span className="sr-only">Unit price </span>
          {formatINR(item.unitPrice, { hideZeroDecimals: true })}
          <span className="text-parchment-400"> each</span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <div role="group" aria-label={`Quantity of ${item.title}`} className="flex items-center">
            <Button
              variant="secondary"
              className="px-3 py-1.5"
              aria-label={`Decrease quantity of ${item.title}`}
              disabled={busy || item.quantity <= 1}
              onClick={() => onQuantityChange(item, item.quantity - 1)}
            >
              −
            </Button>
            <output
              aria-label={`Quantity of ${item.title}: ${item.quantity}`}
              className="mx-2 min-w-8 text-center text-parchment-50"
            >
              {item.quantity}
            </output>
            <Button
              variant="secondary"
              className="px-3 py-1.5"
              aria-label={`Increase quantity of ${item.title}`}
              disabled={busy}
              onClick={() => onQuantityChange(item, item.quantity + 1)}
            >
              +
            </Button>
          </div>
          <Button
            variant="ghost"
            className="px-3 py-1.5 text-danger"
            aria-label={`Remove ${item.title} from cart`}
            disabled={busy}
            onClick={() => onRemove(item)}
          >
            Remove
          </Button>
        </div>
      </div>
      <p className="shrink-0 text-right text-lg font-semibold text-parchment-50">
        <span className="sr-only">Line total </span>
        <span data-testid={`line-total-${item.id}`}>
          {formatINR(item.lineTotal, { hideZeroDecimals: true })}
        </span>
      </p>
    </li>
  );
}
