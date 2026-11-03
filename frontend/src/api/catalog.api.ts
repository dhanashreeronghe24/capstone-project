import { apiClient } from './client';
import type {
  AuthorDetail,
  BookDetail,
  BookPage,
  BookSummary,
  CategoryNode,
  FeaturedSections,
  PageParams,
  Review,
  ReviewInput,
  ReviewPage,
  SearchBooksParams,
} from './types';

const enc = encodeURIComponent;

export const catalogApi = {
  searchBooks: (params?: SearchBooksParams) =>
    apiClient.get<BookPage>('/catalog/books', { query: params }),

  getBook: (id: string) => apiClient.get<BookDetail>(`/catalog/books/${enc(id)}`),

  getFeatured: () => apiClient.get<FeaturedSections>('/catalog/featured'),

  getRelatedBooks: (id: string) =>
    apiClient.get<BookSummary[]>(`/catalog/books/${enc(id)}/related`),

  listReviews: (id: string, params?: PageParams) =>
    apiClient.get<ReviewPage>(`/catalog/books/${enc(id)}/reviews`, { query: params }),

  createReview: (id: string, body: ReviewInput) =>
    apiClient.post<Review>(`/catalog/books/${enc(id)}/reviews`, body),

  getAuthor: (id: string) => apiClient.get<AuthorDetail>(`/authors/${enc(id)}`),

  listCategories: () => apiClient.get<CategoryNode[]>('/categories'),
};
