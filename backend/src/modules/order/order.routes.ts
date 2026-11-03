import { NextFunction, Request, Response, Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler, badRequest } from '../../utils/http-error';
import { orderController as c } from './order.controller';
import {
  CancelOrderSchema,
  CheckoutSummarySchema,
  CreateOrderSchema,
  OrderIdParamSchema,
  OrderListQuerySchema,
  ReturnOrderSchema,
  UpdateStatusSchema,
  ValidateCouponSchema,
} from './order.schema';

/** NFR: order creation must carry an Idempotency-Key header. */
const requireIdempotencyKey = (req: Request, _res: Response, next: NextFunction): void => {
  const key = req.header('idempotency-key');
  if (!key || key.length > 100) {
    next(badRequest('Idempotency-Key header is required (max 100 characters)'));
    return;
  }
  next();
};

const customer = [authenticate, requireRole('ROLE_CUSTOMER')];

export const orderRouter = Router();
orderRouter.post('/checkout/summary', optionalAuth, validate(CheckoutSummarySchema), asyncHandler(c.checkoutSummary));
orderRouter.post('/', ...customer, requireIdempotencyKey, validate(CreateOrderSchema), asyncHandler(c.create));
orderRouter.get('/', ...customer, validate(OrderListQuerySchema, 'query'), asyncHandler(c.list));
orderRouter.get(
  '/:orderId',
  authenticate,
  requireRole('ROLE_CUSTOMER', 'ROLE_FULFILLMENT', 'ROLE_STORE_ADMIN'),
  validate(OrderIdParamSchema, 'params'),
  asyncHandler(c.get),
);
orderRouter.post(
  '/:orderId/cancel',
  ...customer,
  validate(OrderIdParamSchema, 'params'),
  validate(CancelOrderSchema),
  asyncHandler(c.cancel),
);
orderRouter.post(
  '/:orderId/return',
  ...customer,
  validate(OrderIdParamSchema, 'params'),
  validate(ReturnOrderSchema),
  asyncHandler(c.returnOrder),
);
orderRouter.post('/:orderId/buy-again', ...customer, validate(OrderIdParamSchema, 'params'), asyncHandler(c.buyAgain));
orderRouter.patch(
  '/:orderId/status',
  authenticate,
  requireRole('ROLE_FULFILLMENT', 'ROLE_STORE_ADMIN'),
  validate(OrderIdParamSchema, 'params'),
  validate(UpdateStatusSchema),
  asyncHandler(c.updateStatus),
);

export const couponRouter = Router();
couponRouter.post('/validate', optionalAuth, validate(ValidateCouponSchema), asyncHandler(c.validateCoupon));
