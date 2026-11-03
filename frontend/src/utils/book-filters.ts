import type { BookFormat, SearchBooksParams } from '@/api';

export const BOOK_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'publication_date',
  'rating',
] as const;
export type BookSort = (typeof BOOK_SORTS)[number];

export const BOOK_FORMATS: readonly BookFormat[] = ['PAPERBACK', 'HARDCOVER', 'EBOOK'];

export const SORT_LABELS: Record<BookSort, string> = {
  relevance: 'Relevance',
  price_asc: 'Price: Low to High',
  price_desc: 'Price: High to Low',
  publication_date: 'Newest first',
  rating: 'Top rated',
};

export const FORMAT_LABELS: Record<BookFormat, string> = {
  PAPERBACK: 'Paperback',
  HARDCOVER: 'Hardcover',
  EBOOK: 'eBook',
};

/** The API has no "list languages" endpoint (`language` is free text), so offer common ones. */
export const LANGUAGE_OPTIONS = ['English', 'Hindi', 'French', 'Spanish', 'German'] as const;

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

/** Browse filters, mirrored 1:1 in the URL query string and the `GET /catalog/books` query. */
export interface BookFilters {
  q?: string | undefined;
  /** Category slug (a parent slug also matches its sub-categories on the backend). */
  category?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  format?: BookFormat | undefined;
  language?: string | undefined;
  sort: BookSort;
  page: number;
  limit: number;
}

export const DEFAULT_FILTERS: BookFilters = {
  sort: 'relevance',
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
};

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

function price(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Reads filters from URL params, silently dropping invalid values. */
export function parseBookFilters(params: URLSearchParams): BookFilters {
  const format = params.get('format');
  const sort = params.get('sort');
  const limit = positiveInt(params.get('limit'));
  return {
    q: text(params.get('q')),
    category: text(params.get('category')),
    minPrice: price(params.get('minPrice')),
    maxPrice: price(params.get('maxPrice')),
    format: BOOK_FORMATS.find((f) => f === format),
    language: text(params.get('language')),
    sort: BOOK_SORTS.find((s) => s === sort) ?? 'relevance',
    page: positiveInt(params.get('page')) ?? 1,
    limit: limit === undefined ? DEFAULT_PAGE_SIZE : Math.min(limit, MAX_PAGE_SIZE),
  };
}

/** Serialises filters to URL params, omitting unset values and defaults. */
export function toSearchParams(filters: BookFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.format) params.set('format', filters.format);
  if (filters.language) params.set('language', filters.language);
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
  if (filters.sort !== 'relevance') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.limit !== DEFAULT_PAGE_SIZE) params.set('limit', String(filters.limit));
  return params;
}

/** Query for `catalogApi.searchBooks`. */
export function toSearchBooksParams(filters: BookFilters): SearchBooksParams {
  return {
    q: filters.q,
    category: filters.category,
    format: filters.format,
    language: filters.language,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    sort: filters.sort,
    page: filters.page,
    limit: filters.limit,
  };
}

export function hasActiveFilters(filters: BookFilters): boolean {
  return (
    filters.q !== undefined ||
    filters.category !== undefined ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.format !== undefined ||
    filters.language !== undefined ||
    filters.sort !== 'relevance'
  );
}

/** Filters with everything reset except the page size. */
export function clearedFilters(filters: BookFilters): BookFilters {
  return { ...DEFAULT_FILTERS, limit: filters.limit };
}
