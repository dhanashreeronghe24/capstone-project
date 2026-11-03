import { z } from 'zod';

export const BookFormatEnum = z.enum(['PAPERBACK', 'HARDCOVER', 'EBOOK']);

export const BookQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    authorId: z.string().uuid().optional(),
    publisher: z.string().trim().min(1).optional(),
    format: BookFormatEnum.optional(),
    language: z.string().trim().min(1).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(['relevance', 'price_asc', 'price_desc', 'publication_date', 'rating']).default('relevance'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: 'minPrice must be <= maxPrice',
    path: ['minPrice'],
  });
export type BookQuery = z.infer<typeof BookQuerySchema>;

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;

const BookFields = {
  title: z.string().trim().min(1).max(255),
  subtitle: z.string().trim().max(255).nullable().optional(),
  format: BookFormatEnum,
  language: z.string().trim().min(1).max(50),
  description: z.string().nullable().optional(),
  frontCoverUrl: z.string().trim().min(1).max(500),
  backCoverUrl: z.string().trim().max(500).nullable().optional(),
  price: z.number().min(0),
  listPrice: z.number().min(0).nullable().optional(),
  stockQuantity: z.number().int().min(0),
  isFeatured: z.boolean(),
  isBestseller: z.boolean(),
  isNewLaunch: z.boolean(),
  publicationDate: z.string().date().nullable().optional(),
  publisherId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.number().int().positive()),
};

export const CreateBookSchema = z.object({
  title: BookFields.title,
  subtitle: BookFields.subtitle,
  isbn: z.string().trim().min(1).max(20),
  authorId: z.string().uuid(),
  publisherId: BookFields.publisherId,
  format: BookFields.format,
  language: BookFields.language.default('English'),
  description: BookFields.description,
  frontCoverUrl: BookFields.frontCoverUrl,
  backCoverUrl: BookFields.backCoverUrl,
  price: BookFields.price,
  listPrice: BookFields.listPrice,
  stockQuantity: BookFields.stockQuantity.default(0),
  isFeatured: BookFields.isFeatured.default(false),
  isBestseller: BookFields.isBestseller.default(false),
  isNewLaunch: BookFields.isNewLaunch.default(false),
  publicationDate: BookFields.publicationDate,
  categoryIds: BookFields.categoryIds.default([]),
});
export type CreateBookInput = z.infer<typeof CreateBookSchema>;

export const UpdateBookSchema = z
  .object({
    title: BookFields.title,
    subtitle: BookFields.subtitle,
    publisherId: BookFields.publisherId,
    format: BookFields.format,
    language: BookFields.language,
    description: BookFields.description,
    frontCoverUrl: BookFields.frontCoverUrl,
    backCoverUrl: BookFields.backCoverUrl,
    price: BookFields.price,
    listPrice: BookFields.listPrice,
    stockQuantity: BookFields.stockQuantity,
    isFeatured: BookFields.isFeatured,
    isBestseller: BookFields.isBestseller,
    isNewLaunch: BookFields.isNewLaunch,
    publicationDate: BookFields.publicationDate,
    categoryIds: BookFields.categoryIds,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });
export type UpdateBookInput = z.infer<typeof UpdateBookSchema>;

export const ReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const IdParamSchema = z.object({ id: z.string().uuid() });
