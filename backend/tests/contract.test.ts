import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { createApp } from '../src/app';
import { OPENAPI_PATH } from '../src/config/openapi';
import { prisma } from '../src/config/prisma.client';
import { checkContract, getSpec } from './helpers/contract';

const app = createApp();
const stamp = Date.now();
const email = `contract-${stamp}@test.dev`;
const PASSWORD = 'Password@123';
const UUID = '00000000-0000-4000-8000-000000000000';

const problems: string[] = [];
let bookSnapshot: Array<{ id: string; stockQuantity: number; totalSalesCount: number; averageRating: unknown; reviewCount: number }> = [];
let couponSnapshot: Array<{ code: string; timesUsed: number }> = [];

beforeAll(async () => {
  bookSnapshot = await prisma.book.findMany({
    select: { id: true, stockQuantity: true, totalSalesCount: true, averageRating: true, reviewCount: true },
  });
  couponSnapshot = await prisma.coupon.findMany({ select: { code: true, timesUsed: true } });
});
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Sends a request and records any divergence from the OpenAPI contract. */
async function call(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  opts: { token?: string; body?: object; headers?: Record<string, string> } = {},
) {
  let r = request(app)[method](url);
  if (opts.token) r = r.set(bearer(opts.token));
  for (const [k, v] of Object.entries(opts.headers ?? {})) r = r.set(k, v);
  const res = await (opts.body ? r.send(opts.body) : r);
  problems.push(...(await checkContract(method, url, res.status, res.body)));
  return res;
}

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const orders = await prisma.order.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = orders.map((o) => o.id);
    await prisma.refund.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.shipment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.review.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  for (const b of bookSnapshot) {
    await prisma.book.update({
      where: { id: b.id },
      data: {
        stockQuantity: b.stockQuantity,
        totalSalesCount: b.totalSalesCount,
        averageRating: b.averageRating as number,
        reviewCount: b.reviewCount,
      },
    });
  }
  for (const c of couponSnapshot) await prisma.coupon.update({ where: { code: c.code }, data: { timesUsed: c.timesUsed } });
  await prisma.$disconnect();
});

describe('OpenAPI contract', () => {
  it('the specification is a valid OpenAPI 3.0 document', async () => {
    const api = (await SwaggerParser.validate(OPENAPI_PATH)) as { openapi: string };
    expect(api.openapi).toMatch(/^3\.0/);
  });

  it('every documented operation is routed by the application (no unrouted 404)', async () => {
    const spec = await getSpec();
    const unrouted: string[] = [];
    for (const [tpl, ops] of Object.entries(spec.paths)) {
      const url = tpl.replace(/\{[^}]+\}/g, UUID);
      for (const method of Object.keys(ops)) {
        const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method](url);
        if (res.status === 404 && /^Route /.test(String(res.body?.detail))) unrouted.push(`${method.toUpperCase()} ${tpl}`);
      }
    }
    expect(unrouted).toEqual([]);
  });

  it('serves Swagger UI at /api-docs', async () => {
    const res = await request(app).get('/api-docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('error responses are RFC 7807 problem+json', async () => {
    const res = await request(app).get('/api/v1/catalog/books/not-a-uuid').expect(400);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(await checkContract('get', '/api/v1/catalog/books/x', 400, res.body)).toEqual([]);
    const nf = await request(app).get('/nope').expect(404);
    expect(nf.body).toMatchObject({ status: 404, title: 'Not Found' });
  });

  it('live responses across the purchase journey match the documented schemas', async () => {
    const reg = await call('post', '/api/v1/auth/register', { body: { email, password: PASSWORD, firstName: 'Con', lastName: 'Tract' } });
    expect(reg.status).toBe(201);
    await call('post', '/api/v1/auth/register', { body: { email: 'bad' } });
    await call('post', '/api/v1/auth/register', { body: { email, password: PASSWORD, firstName: 'a', lastName: 'b' } });
    const login = await call('post', '/api/v1/auth/login', { body: { email, password: PASSWORD } });
    const token = login.body.tokens.accessToken as string;
    await call('post', '/api/v1/auth/login', { body: { email, password: 'wrong-password' } });
    const refreshed = await call('post', '/api/v1/auth/refresh', { body: { refreshToken: login.body.tokens.refreshToken } });
    await call('post', '/api/v1/auth/logout', { token, body: { refreshToken: refreshed.body.refreshToken } });

    await call('get', '/api/v1/members/me', { token });
    await call('get', '/api/v1/members/me');
    await call('put', '/api/v1/members/me', { token, body: { firstName: 'Renamed' } });
    const addr = await call('post', '/api/v1/members/me/addresses', {
      token,
      body: { recipientName: 'C T', phoneNumber: '9999999999', addressLine1: '1 MG Road', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' },
    });
    await call('get', '/api/v1/members/me/addresses', { token });

    await call('get', '/api/v1/categories');
    const search = await call('get', '/api/v1/catalog/books?sort=rating&limit=5');
    const featured = await call('get', '/api/v1/catalog/featured');
    const bookId = featured.body.bestsellers[0].id as string;
    const authorId = search.body.data[0].author.id as string;
    await call('get', `/api/v1/catalog/books/${bookId}`);
    await call('get', `/api/v1/catalog/books/${UUID}`);
    await call('get', `/api/v1/catalog/books/${bookId}/related`);
    await call('get', `/api/v1/catalog/books/${bookId}/reviews`);
    await call('post', `/api/v1/catalog/books/${bookId}/reviews`, { token, body: { rating: 5, comment: 'Great' } });
    await call('get', `/api/v1/authors/${authorId}`);

    await call('get', '/api/v1/cart', { token });
    const added = await call('post', '/api/v1/cart/items', { token, body: { bookId, quantity: 2 } });
    await call('put', `/api/v1/cart/items/${added.body.items[0].id}`, { token, body: { quantity: 3 } });
    const guest = await call('get', '/api/v1/cart');
    await call('post', '/api/v1/cart/merge', { token, body: { guestSessionId: guest.body.guestSessionId } });

    await call('post', '/api/v1/wishlist/items', { token, body: { bookId: search.body.data[1].id } });
    await call('get', '/api/v1/wishlist', { token });
    await call('delete', `/api/v1/wishlist/items/${search.body.data[1].id}`, { token });

    await call('post', '/api/v1/shipping/calculate-rate', { body: { postalCode: '560001', weightKg: 1 } });
    await call('get', '/api/v1/shipping/estimate-delivery?postalCode=560001');
    await call('post', '/api/v1/coupons/validate', { token, body: { code: 'WELCOME10' } });
    await call('post', '/api/v1/orders/checkout/summary', { token, body: { postalCode: '560001', couponCode: 'WELCOME10' } });

    const created = await call('post', '/api/v1/orders', {
      token,
      headers: { 'Idempotency-Key': `contract-${stamp}` },
      body: { addressId: addr.body.id, couponCode: 'WELCOME10' },
    });
    expect(created.status).toBe(201);
    await call('post', '/api/v1/orders', {
      token,
      headers: { 'Idempotency-Key': `contract-${stamp}` },
      body: { addressId: addr.body.id, couponCode: 'WELCOME10' },
    });
    const orderId = created.body.id as string;

    const intent = await call('post', '/api/v1/payments/initiate', { token, body: { orderId, paymentMethod: 'CREDIT_CARD' } });
    await call('post', '/api/v1/payments/confirm', {
      token,
      body: { paymentId: intent.body.id, paymentMethod: 'CREDIT_CARD', card: { number: '4111111111110000', holderName: 'C T', cvv: '123', expiry: '12/40' } },
    });
    await call('post', '/api/v1/payments/confirm', {
      token,
      body: { paymentId: intent.body.id, paymentMethod: 'CREDIT_CARD', card: { number: '4111111111111111', holderName: 'C T', cvv: '123', expiry: '12/40' } },
    });
    await call('get', `/api/v1/orders/${orderId}`, { token });
    await call('get', '/api/v1/orders', { token });
    await call('post', `/api/v1/orders/${orderId}/buy-again`, { token });
    await call('post', `/api/v1/orders/${orderId}/cancel`, { token, body: { reason: 'contract test' } });

    expect(problems).toEqual([]);
  });
});
