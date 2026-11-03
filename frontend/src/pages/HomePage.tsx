import BookSection from '@/components/catalog/BookSection';
import { ErrorState } from '@/components/ui/StateMessage';
import { useFeatured } from '@/hooks/catalog';
import { getErrorMessage } from '@/utils/errors';

/** Home (wireframe image1): Recommended for You / Bestsellers this Month / New Launches. */
export default function HomePage() {
  const { data, isPending, error, refetch } = useFeatured();

  if (error) {
    return <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  }

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Book Worm home</h1>
      <BookSection
        title="Recommended for You"
        books={data?.recommended}
        isLoading={isPending}
        emptyMessage="No recommendations yet."
      />
      <BookSection
        title="Bestsellers this Month"
        books={data?.bestsellers}
        isLoading={isPending}
        emptyMessage="No bestsellers yet."
      />
      <BookSection
        title="New Launches"
        books={data?.newLaunches}
        isLoading={isPending}
        seeAllTo="/books?sort=publication_date"
        emptyMessage="No new launches yet."
      />
    </div>
  );
}
