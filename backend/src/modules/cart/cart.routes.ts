import { Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/http-error';
import { cartController as c, wishlistController as w } from './cart.controller';
import {
  AddCartItemSchema,
  BookIdParamSchema,
  ItemIdParamSchema,
  MergeCartSchema,
  UpdateCartItemSchema,
  WishlistAddSchema,
} from './cart.schema';

export const cartRouter = Router();
cartRouter.get('/', optionalAuth, asyncHandler(c.getCart));
cartRouter.post('/items', optionalAuth, validate(AddCartItemSchema), asyncHandler(c.addItem));
cartRouter.put(
  '/items/:itemId',
  optionalAuth,
  validate(ItemIdParamSchema, 'params'),
  validate(UpdateCartItemSchema),
  asyncHandler(c.updateItem),
);
cartRouter.delete('/items/:itemId', optionalAuth, validate(ItemIdParamSchema, 'params'), asyncHandler(c.removeItem));
cartRouter.post('/merge', authenticate, requireRole('ROLE_CUSTOMER'), validate(MergeCartSchema), asyncHandler(c.merge));

export const wishlistRouter = Router();
wishlistRouter.use(authenticate, requireRole('ROLE_CUSTOMER'));
wishlistRouter.get('/', asyncHandler(w.list));
wishlistRouter.post('/items', validate(WishlistAddSchema), asyncHandler(w.add));
wishlistRouter.delete('/items/:bookId', validate(BookIdParamSchema, 'params'), asyncHandler(w.remove));
wishlistRouter.post('/move-to-cart/:bookId', validate(BookIdParamSchema, 'params'), asyncHandler(w.moveToCart));
