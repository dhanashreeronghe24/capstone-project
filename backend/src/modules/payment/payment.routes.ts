import { Router } from 'express';
import { authenticate, requireRole } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/http-error';
import { paymentController as c } from './payment.controller';
import {
  ConfirmPaymentSchema,
  InitiatePaymentSchema,
  PaymentIdParamSchema,
  RefundSchema,
  WebhookSchema,
} from './payment.schema';

export const paymentRouter = Router();
paymentRouter.post(
  '/initiate',
  authenticate,
  requireRole('ROLE_CUSTOMER'),
  validate(InitiatePaymentSchema),
  asyncHandler(c.initiate),
);
paymentRouter.post(
  '/confirm',
  authenticate,
  requireRole('ROLE_CUSTOMER'),
  validate(ConfirmPaymentSchema),
  asyncHandler(c.confirm),
);
paymentRouter.post('/simulate-webhook', validate(WebhookSchema), asyncHandler(c.simulateWebhook));
paymentRouter.post(
  '/:paymentId/refund',
  authenticate,
  requireRole('ROLE_STORE_ADMIN'),
  validate(PaymentIdParamSchema, 'params'),
  validate(RefundSchema),
  asyncHandler(c.refund),
);
