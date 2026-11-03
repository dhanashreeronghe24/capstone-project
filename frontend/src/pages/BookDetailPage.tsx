import { Link, useParams } from 'react-router-dom';
import AuthorSection from '@/components/catalog/AuthorSection';
import BookInfo from '@/components/catalog/BookInfo';
import RelatedReads from '@/components/catalog/RelatedReads';
import ReviewsSection from '@/components/catalog/ReviewsSection';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/StateMessage';
import { useBook } from '@/hooks/catalog';
import { getErrorMessage, hasStatus } from '@/utils/errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function BookNotFound({ invalid }: { invalid: boolean }) {
  return (
    <section className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-serif text-6xl text-accent-400">404</p>
      <h1 className="text-2xl text-parchment-50">Book not found</h1>
      <p className="text-parchment-400">
        {invalid
          ? 'This book link is not valid.'
          : 'The book you are looking for does not exist or is no longer available.'}
      </p>
      <Link to="/books" className="text-accent-400 hover:underline">
        Browse all books
      </Link>
    </section>
  );
}

function PdpSkeleton() {
  return (
    <div role="status" aria-label="Loading book" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-4">
        <Skeleton className="h-72 w-48" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/** Product detail page (`/books/:bookId`, wireframe image3). */
export default function BookDetailPage() {
  const { bookId = '' } = useParams<{ bookId: string }>();
  const validId = UUID_PATTERN.test(bookId);

  // An invalid id never reaches the API: the query is only mounted by `BookDetailContent`.
  return validId ? <BookDetailContent bookId={bookId} /> : <BookNotFound invalid />;
}

function BookDetailContent({ bookId }: { bookId: string }) {
  const { data: book, isPending, isError, error, refetch } = useBook(bookId);

  if (isPending) return <PdpSkeleton />;
  if (isError) {
    if (hasStatus(error, 400, 404)) return <BookNotFound invalid={false} />;
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  const primaryCategory = book.categories[0];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-parchment-400">
        <ol className="flex flex-wrap items-center gap-x-2">
          <li>
            <Link to="/" className="hover:text-accent-400">
              Home
            </Link>
          </li>
          {primaryCategory ? (
            <li className="flex gap-2">
              <span aria-hidden="true">/</span>
              <Link
                to={`/books?category=${encodeURIComponent(primaryCategory.slug)}`}
                className="hover:text-accent-400"
              >
                {primaryCategory.name}
              </Link>
            </li>
          ) : null}
          <li className="flex gap-2" aria-current="page">
            <span aria-hidden="true">/</span>
            <span className="text-parchment-200">{book.title}</span>
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <BookInfo book={book} />
          <AuthorSection book={book} />
          <ReviewsSection bookId={book.id} />
        </div>
        <RelatedReads bookId={book.id} />
      </div>
    </div>
  );
}
