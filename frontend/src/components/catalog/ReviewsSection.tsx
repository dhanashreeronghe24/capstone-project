import { useState } from 'react';
import Pagination from '@/components/catalog/Pagination';
import ReviewForm from '@/components/catalog/ReviewForm';
import { Skeleton } from '@/components/ui/Skeleton';
import StarRating from '@/components/ui/StarRating';
import { ErrorState } from '@/components/ui/StateMessage';
import { useReviews } from '@/hooks/reviews';
import { getErrorMessage } from '@/utils/errors';

const dateFormatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' });

/** Reviews section of the PDP (wireframe image3): form on the left, paginated list on the right. */
export default function ReviewsSection({ bookId }: { bookId: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useReviews(bookId, page);

  let list;
  if (error && !data) {
    list = <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />;
  } else if (isPending) {
    list = (
      <div role="status" aria-label="Loading reviews" className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  } else if (data.data.length === 0) {
    list = <p className="text-sm text-parchment-400">No reviews yet. Be the first to review!</p>;
  } else {
    list = (
      <>
        <ul className="flex flex-col gap-4">
          {data.data.map((review) => (
            <li key={review.id} className="flex flex-col gap-1 border-b border-ink-700 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-parchment-50">{review.reviewerName}</span>
                {review.isVerifiedPurchase ? (
                  <span className="rounded bg-ink-700 px-1.5 py-0.5 text-xs text-success">
                    Verified purchase
                  </span>
                ) : null}
                <time dateTime={review.createdAt} className="text-xs text-parchment-400">
                  {dateFormatter.format(new Date(review.createdAt))}
                </time>
              </div>
              <StarRating value={review.rating} />
              {review.comment ? (
                <p className="whitespace-pre-line text-sm text-parchment-200">{review.comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
        />
      </>
    );
  }

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id="reviews-heading" className="font-serif text-xl text-accent-400">
          Reviews
        </h2>
        {data && data.reviewCount > 0 ? (
          <span className="text-sm text-parchment-400">
            {data.averageRating.toFixed(1)} average from {data.reviewCount}{' '}
            {data.reviewCount === 1 ? 'review' : 'reviews'}
          </span>
        ) : null}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ReviewForm bookId={bookId} />
        <div className="flex flex-col gap-4">{list}</div>
      </div>
    </section>
  );
}
