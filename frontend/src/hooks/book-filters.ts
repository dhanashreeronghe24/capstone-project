import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  clearedFilters,
  parseBookFilters,
  toSearchParams,
  type BookFilters,
} from '@/utils/book-filters';

/**
 * Browse filters backed by the URL query string (`q, category, minPrice, maxPrice, format,
 * language, sort, page, limit`). `updateFilters` resets to page 1 unless `page` is in the patch.
 */
export function useBookFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseBookFilters(searchParams), [searchParams]);

  const updateFilters = useCallback(
    (patch: Partial<BookFilters>) => {
      setSearchParams((prev) => toSearchParams({ ...parseBookFilters(prev), page: 1, ...patch }));
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((prev) => toSearchParams(clearedFilters(parseBookFilters(prev))));
  }, [setSearchParams]);

  return { filters, updateFilters, clearFilters };
}
