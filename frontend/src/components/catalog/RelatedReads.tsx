import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { useRelatedBooks } from '@/hooks/catalog';
import { FORMAT_LABELS } from '@/utils/book-filters';
import { formatINR } from '@/utils/money';

/** Right-hand "Related Reads" panel of the PDP (wireframe image3). */
export default function RelatedReads({ bookId }: { bookId: string }) {
  const { data, isPending, isError } = useRelatedBooks(bookId);

  let content;
  if (isPending) {
    content = (
      <div role="status" aria-label="Loading related reads" className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  } else if (isError) {
    content = (
      <p className="text-sm text-parchment-400">Related reads are unavailable right now.</p>
    );
  } else if (data.length === 0) {
    content = <p className="text-sm text-parchment-400">No related reads yet.</p>;
  } else {
    content = (
      <ul className="flex flex-col gap-4">
        {data.map((book) => (
          <li key={book.id}>
            <article aria-label={book.title} className="flex gap-3">
              <Link to={`/books/${book.id}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
                <img
                  src={book.frontCoverUrl}
                  alt=""
                  loading="lazy"
                  className="h-28 w-20 rounded object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-serif text-base leading-snug text-parchment-50">
                  <Link to={`/books/${book.id}`} className="hover:text-accent-400">
                    {book.title}
                  </Link>
                </h3>
                <p className="text-sm text-parchment-400">{book.author.name}</p>
                <p className="text-xs text-parchment-400">{FORMAT_LABELS[book.format]}</p>
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
                <p className="mt-1 font-semibold text-parchment-50">
                  {formatINR(book.price, { hideZeroDecimals: true })}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <aside aria-labelledby="related-reads-heading" className="flex flex-col gap-4">
      <h2 id="related-reads-heading" className="font-serif text-xl text-accent-400">
        Related Reads
      </h2>
      {content}
    </aside>
  );
}
