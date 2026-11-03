import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.config';
import { loadOpenApiDocument } from './config/openapi';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { correlationId, httpLogger } from './middlewares/logger.middleware';
import { rateLimiter } from './middlewares/rateLimiter.middleware';
import { cartRouter, wishlistRouter } from './modules/cart/cart.routes';
import { authorRouter, catalogRouter, categoryRouter } from './modules/catalog/catalog.routes';
import { authRouter, memberRouter } from './modules/member/member.routes';
import { couponRouter, orderRouter } from './modules/order/order.routes';
import { paymentRouter } from './modules/payment/payment.routes';
import { shippingRouter } from './modules/shipping/shipping.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','), exposedHeaders: ['x-guest-session-id', 'x-correlation-id'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationId);
  app.use(httpLogger);
  app.use(rateLimiter);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Swagger UI serves the same OpenAPI contract the implementation is verified against.
  app.use(
    '/api-docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(loadOpenApiDocument() as Parameters<typeof swaggerUi.setup>[0]),
  );

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/members', memberRouter);
  app.use('/api/v1/catalog', catalogRouter);
  app.use('/api/v1/categories', categoryRouter);
  app.use('/api/v1/authors', authorRouter);
  app.use('/api/v1/cart', cartRouter);
  app.use('/api/v1/wishlist', wishlistRouter);
  app.use('/api/v1/orders', orderRouter);
  app.use('/api/v1/coupons', couponRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use('/api/v1/shipping', shippingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
