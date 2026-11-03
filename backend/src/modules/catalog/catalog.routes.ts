import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/http-error';
import { catalogController as c } from './catalog.controller';
import {
  BookQuerySchema,
  CreateBookSchema,
  IdParamSchema,
  PageQuerySchema,
  ReviewInputSchema,
  UpdateBookSchema,
} from './catalog.schema';

export const catalogRouter = Router();
catalogRouter.get('/books', validate(BookQuerySchema, 'query'), asyncHandler(c.searchBooks));
catalogRouter.post(
  '/books',
  authenticate,
  requireRole('ROLE_CATALOG_ADMIN'),
  validate(CreateBookSchema),
  asyncHandler(c.createBook),
);
catalogRouter.get('/featured', asyncHandler(c.getFeatured));
catalogRouter.get('/books/:id', validate(IdParamSchema, 'params'), asyncHandler(c.getBook));
catalogRouter.put(
  '/books/:id',
  authenticate,
  requireRole('ROLE_CATALOG_ADMIN'),
  validate(IdParamSchema, 'params'),
  validate(UpdateBookSchema),
  asyncHandler(c.updateBook),
);
catalogRouter.get('/books/:id/related', validate(IdParamSchema, 'params'), asyncHandler(c.getRelated));
catalogRouter.get(
  '/books/:id/reviews',
  validate(IdParamSchema, 'params'),
  validate(PageQuerySchema, 'query'),
  asyncHandler(c.listReviews),
);
catalogRouter.post(
  '/books/:id/reviews',
  authenticate,
  requireRole('ROLE_CUSTOMER'),
  validate(IdParamSchema, 'params'),
  validate(ReviewInputSchema),
  asyncHandler(c.createReview),
);

export const categoryRouter = Router();
categoryRouter.get('/', asyncHandler(c.listCategories));

export const authorRouter = Router();
authorRouter.get('/:id', validate(IdParamSchema, 'params'), asyncHandler(c.getAuthor));
