import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import { toSearchBooksParams, type BookFilters } from '@/utils/book-filters';
import { hasStatus } from '@/utils/errors';
import { catalogKeys } from './query-keys';

const FIVE_MINUTES = 5 * 60 * 1000;

/** 400/404 will not change on retry; anything else gets one retry like the app default. */
const retryUnlessClientError = (failureCount: number, error: unknown) =>
  !hasStatus(error, 400, 404) && failureCount < 1;

/** Recommended / bestsellers / new launches for the home page. */
export function useFeatured() {
  return useQuery({ queryKey: catalogKeys.featured, queryFn: catalogApi.getFeatured });
}

/** Hierarchical category tree (rarely changes). */
export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: catalogApi.listCategories,
    staleTime: FIVE_MINUTES,
  });
}

/** Paginated search; keeps the previous page visible while the next one loads. */
export function useBooks(filters: BookFilters) {
  const params = toSearchBooksParams(filters);
  return useQuery({
    queryKey: catalogKeys.books(params),
    queryFn: () => catalogApi.searchBooks(params),
    placeholderData: keepPreviousData,
  });
}

/** Single book (PDP). */
export function useBook(bookId: string) {
  return useQuery({
    queryKey: catalogKeys.book(bookId),
    queryFn: () => catalogApi.getBook(bookId),
    retry: retryUnlessClientError,
  });
}

/** Related reads for the PDP side panel. */
export function useRelatedBooks(bookId: string) {
  return useQuery({
    queryKey: catalogKeys.related(bookId),
    queryFn: () => catalogApi.getRelatedBooks(bookId),
    retry: retryUnlessClientError,
  });
}

/** Author profile (bio + avatar); only fetched once the author id is known. */
export function useAuthor(authorId: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.author(authorId ?? ''),
    queryFn: () => catalogApi.getAuthor(authorId ?? ''),
    enabled: Boolean(authorId),
    staleTime: FIVE_MINUTES,
    retry: retryUnlessClientError,
  });
}
