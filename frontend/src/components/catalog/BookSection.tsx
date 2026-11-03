import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { BookSummary } from '@/api';
import { BookGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/StateMessage';
import BookCard from './BookCard';

interface BookSectionProps {
  title: string;
  books: readonly BookSummary[] | undefined;
  isLoading?: boolean;
  /** Optional "See all" link target. */
  seeAllTo?: string;
  emptyMessage?: string;
}

/** Titled horizontal row of book cards (home page: Recommended / Bestsellers / New Launches). */
export default function BookSection({
  title,
  books,
  isLoading = false,
  seeAllTo,
  emptyMessage = 'No books to show yet.',
}: BookSectionProps) {
  const headingId = useId();

  let body;
  if (isLoading || !books) {
    body = <BookGridSkeleton count={3} label={`Loading ${title}`} />;
  } else if (books.length === 0) {
    body = <EmptyState title={emptyMessage} />;
  } else {
    body = (
      <ul className="flex gap-4 overflow-x-auto pb-2">
        {books.map((book) => (
          <li key={book.id} className="w-80 shrink-0">
            <BookCard book={book} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="font-serif text-2xl text-parchment-50">
          {title}
        </h2>
        {seeAllTo ? (
          <Link to={seeAllTo} className="text-sm text-accent-400 hover:text-accent-500">
            See all
          </Link>
        ) : null}
      </div>
      {body}
    </section>
  );
}
