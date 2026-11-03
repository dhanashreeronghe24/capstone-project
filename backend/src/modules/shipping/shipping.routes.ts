import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/http-error';
import { shippingController as c } from './shipping.controller';
import { CalculateRateSchema, EstimateQuerySchema, TrackingParamSchema } from './shipping.schema';

export const shippingRouter = Router();
shippingRouter.post('/calculate-rate', validate(CalculateRateSchema), asyncHandler(c.calculateRate));
shippingRouter.get('/estimate-delivery', validate(EstimateQuerySchema, 'query'), asyncHandler(c.estimateDelivery));
shippingRouter.get('/track/:trackingNumber', validate(TrackingParamSchema, 'params'), asyncHandler(c.track));
