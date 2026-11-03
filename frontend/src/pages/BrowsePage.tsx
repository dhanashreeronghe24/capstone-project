import BookFilterBar from '@/components/catalog/BookFilterBar';
import BookGrid from '@/components/catalog/BookGrid';
import Pagination from '@/components/catalog/Pagination';
import { Button } from '@/components/ui/Button';
import { BookGridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateMessage';
import { useBookFilters } from '@/hooks/book-filters';
import { useBooks } from '@/hooks/catalog';
import { hasActiveFilters } from '@/utils/book-filters';
import { getErrorMessage } from '@/utils/errors';

/** Browse / search results (`/books`); every filter lives in the URL query string. */
export default function BrowsePage() {
  const { filters, updateFilters, clearFilters } = useBookFilters();
  const { data, isPending, isPlaceholderData, error, refetch } = useBooks(filters);

  let results;
  if (error && !data) {
    results = <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  } else if (isPending) {
    results = <BookGridSkeleton count={6} label="Loading books" />;
  } else if (data.data.length === 0) {
    results = (
      <EmptyState
        title="No books found"
        description="Try changing or clearing your filters."
        action={
          hasActiveFilters(filters) ? (
            <Button onClick={clearFilters}>Clear all filters</Button>
          ) : null
        }
      />
    );
  } else {
    results = (
      <>
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <BookGrid books={data.data} />
        </div>
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={(page) => updateFilters({ page })}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl text-accent-400">Browse Books</h1>
      <BookFilterBar filters={filters} onChange={updateFilters} onClear={clearFilters} />
      <p aria-live="polite" className="text-sm text-parchment-400">
        {filters.q ? `Results for “${filters.q}” — ` : ''}
        {data
          ? `${data.pagination.total} ${data.pagination.total === 1 ? 'book' : 'books'} found`
          : ''}
      </p>
      {results}
    </div>
  );
}
