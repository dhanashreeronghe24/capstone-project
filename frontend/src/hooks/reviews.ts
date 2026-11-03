import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, type ReviewInput } from '@/api';
import { toast } from '@/stores';
import { catalogKeys } from './query-keys';

export const REVIEWS_PAGE_SIZE = 5;

/** One page of reviews (also carries the aggregated average rating and count). */
export function useReviews(bookId: string, page: number, limit = REVIEWS_PAGE_SIZE) {
  return useQuery({
    queryKey: catalogKeys.reviews(bookId, page, limit),
    queryFn: () => catalogApi.listReviews(bookId, { page, limit }),
    placeholderData: keepPreviousData,
  });
}

/**
 * Posts a review. Errors are not toasted here: the review form maps 403/409/422 to inline
 * messages. On success every reviews page and the book (rating, review count) are refetched.
 */
export function useCreateReview(bookId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewInput) => catalogApi.createReview(bookId, input),
    onSuccess: async () => {
      toast.success('Thanks! Your review has been posted.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: catalogKeys.reviewsOf(bookId) }),
        queryClient.invalidateQueries({ queryKey: catalogKeys.book(bookId), exact: true }),
      ]);
    },
  });
}
