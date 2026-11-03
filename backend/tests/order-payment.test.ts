import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma.client';

const app = createApp();
const stamp = Date.now();
const email = `order-${stamp}@test.dev`;
const otherEmail = `order-other-${stamp}@test.dev`;
const PASSWORD = 'Password@123';
const GOOD_CARD = { number: '4111111111111111', holderName: 'Test User', cvv: '123', expiry: '12/40' };
const address = {
  recipientName: 'Test User', phoneNumber: '9999999999', addressLine1: '1 MG Road',
  city: 'Bengaluru', state: 'Karnataka', postalCode: '560001',
};

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

let token = '';
let otherToken = '';
let adminToken = '';
let fulfilToken = '';
let userId = '';
let bookA = ''; // Joy of Minimalism (149)
let bookB = ''; // The Path to Success (359)
let snapshot: Array<{ id: string; stockQuantity: number; totalSalesCount: number; averageRating: unknown; reviewCount: number }> = [];
let couponSnapshot: Array<{ code: string; timesUsed: number }> = [];

async function login(e: string): Promise<string> {
  const r = await request(app).post('/api/v1/auth/login').send({ email: e, password: PASSWORD }).expect(200);
  return r.body.tokens.accessToken as string;
}
async function fillCart(t: string, items: Array<[string, number]>): Promise<void> {
  for (const [bookId, quantity] of items) {
    await request(app).post('/api/v1/cart/items').set(bearer(t)).send({ bookId, quantity }).expect(201);
  }
}
async function placeOrder(t: string, key: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/orders')
    .set(bearer(t))
    .set('Idempotency-Key', key)
    .send({ shippingAddress: address, ...extra });
}
async function pay(t: string, orderId: string, card = GOOD_CARD) {
  const init = await request(app).post('/api/v1/payments/initiate').set(bearer(t)).send({ orderId, paymentMethod: 'CREDIT_CARD' }).expect(201);
  const confirm = await request(app)
    .post('/api/v1/payments/confirm')
    .set(bearer(t))
    .send({ paymentId: init.body.id, paymentMethod: 'CREDIT_CARD', card });
  return { init: init.body, confirm };
}
const stockOf = async (id: string): Promise<number> => (await prisma.book.findUniqueOrThrow({ where: { id } })).stockQuantity;

beforeAll(async () => {
  snapshot = await prisma.book.findMany({
    select: { id: true, stockQuantity: true, totalSalesCount: true, averageRating: true, reviewCount: true },
  });
  couponSnapshot = await prisma.coupon.findMany({ select: { code: true, timesUsed: true } });
  bookA = (await prisma.book.findFirstOrThrow({ where: { title: 'Joy of Minimalism' } })).id;
  bookB = (await prisma.book.findFirstOrThrow({ where: { title: 'The Path to Success' } })).id;

  const reg = await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD, firstName: 'Ord', lastName: 'Er' }).expect(201);
  token = reg.body.tokens.accessToken;
  userId = reg.body.user.id;
  await prisma.user.update({ where: { id: userId }, data: { rewardPoints: 200 } });
  const reg2 = await request(app).post('/api/v1/auth/register').send({ email: otherEmail, password: PASSWORD, firstName: 'Oth', lastName: 'Er' }).expect(201);
  otherToken = reg2.body.tokens.accessToken;
  adminToken = await login('admin@bookworm.test');
  fulfilToken = await login('fulfillment@bookworm.test');
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: [email, otherEmail] } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const orders = await prisma.order.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const oids = orders.map((o) => o.id);
  await prisma.refund.deleteMany({ where: { orderId: { in: oids } } });
  await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: oids } } });
  await prisma.shipment.deleteMany({ where: { orderId: { in: oids } } });
  await prisma.order.deleteMany({ where: { id: { in: oids } } });
  await prisma.review.deleteMany({ where: { userId: { in: ids } } });
  await prisma.cart.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const b of snapshot) {
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

describe('Coupons & checkout summary', () => {
  it('validates coupons: ok, unknown (404), min order not met (422)', async () => {
    await fillCart(token, [[bookA, 1]]); // 149
    await request(app).post('/api/v1/coupons/validate').set(bearer(token)).send({ code: 'FLAT50' }).expect(422); // min 300
    await request(app).post('/api/v1/coupons/validate').set(bearer(token)).send({ code: 'WELCOME10' }).expect(422); // min 200
    await request(app).post('/api/v1/coupons/validate').set(bearer(token)).send({ code: 'NOPE' }).expect(404);
    await fillCart(token, [[bookB, 1]]); // cart = 149 + 359 = 508
    const ok = await request(app).post('/api/v1/coupons/validate').set(bearer(token)).send({ code: 'welcome10' }).expect(200);
    expect(ok.body).toMatchObject({ code: 'WELCOME10', valid: true, discountType: 'PERCENTAGE' });
    expect(ok.body.discountAmount).toBeCloseTo(50.8, 2);
  });

  it('computes subtotal, tax, free shipping, coupon and points', async () => {
    const res = await request(app)
      .post('/api/v1/orders/checkout/summary')
      .set(bearer(token))
      .send({ postalCode: '560001', couponCode: 'WELCOME10', redeemPoints: 100 })
      .expect(200);
    expect(res.body.subtotal).toBeCloseTo(508, 2);
    expect(res.body.taxAmount).toBeCloseTo(10.16, 2);
    expect(res.body.shippingFee).toBe(0); // >= 499 threshold
    expect(res.body.discountAmount).toBeCloseTo(50.8, 2); // 10%
    expect(res.body.pointsDiscount).toBe(100);
    expect(res.body.totalAmount).toBeCloseTo(508 + 10.16 - 50.8 - 100, 2);
    expect(res.body.estimatedDelivery).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects too many points (422), unserviceable pincode (422), bad body (400), empty guest cart (422)', async () => {
    await request(app).post('/api/v1/orders/checkout/summary').set(bearer(token)).send({ postalCode: '560001', redeemPoints: 9999 }).expect(422);
    await request(app).post('/api/v1/orders/checkout/summary').set(bearer(token)).send({ postalCode: '999999' }).expect(422);
    await request(app).post('/api/v1/orders/checkout/summary').send({ postalCode: 'x' }).expect(400);
    await request(app).post('/api/v1/orders/checkout/summary').send({ postalCode: '560001' }).expect(422);
  });
});

describe('Order placement, payment and fulfilment journey', () => {
  let orderId = '';
  let paymentId = '';
  let totalAfterDiscounts = 0;
  const key = `idem-${stamp}-1`;

  it('requires auth, an Idempotency-Key and an address', async () => {
    await request(app).post('/api/v1/orders').set('Idempotency-Key', 'k').send({ shippingAddress: address }).expect(401);
    await request(app).post('/api/v1/orders').set(bearer(token)).send({ shippingAddress: address }).expect(400);
    await request(app).post('/api/v1/orders').set(bearer(token)).set('Idempotency-Key', 'k').send({}).expect(400);
  });

  it('creates an immutable order (201), clears cart, consumes points + coupon; replay returns same order (200)', async () => {
    const res = await placeOrder(token, key, { couponCode: 'WELCOME10', redeemPoints: 100 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PAYMENT_PENDING');
    expect(res.body.orderNumber).toMatch(/^BW-\d{8}-[0-9A-F]{8}$/);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((i: { bookTitle: string }) => i.bookTitle).sort()).toEqual(['Joy of Minimalism', 'The Path to Success']);
    expect(res.body.statusHistory.map((h: { status: string }) => h.status)).toEqual(['CREATED', 'PAYMENT_PENDING']);
    expect(res.body.shippingAddress.postalCode).toBe('560001');
    orderId = res.body.id;
    totalAfterDiscounts = res.body.totalAmount;
    expect(totalAfterDiscounts).toBeCloseTo(367.36, 2);

    expect((await request(app).get('/api/v1/cart').set(bearer(token))).body.items).toEqual([]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(100);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).timesUsed).toBe(
      couponSnapshot.find((c) => c.code === 'WELCOME10')!.timesUsed + 1,
    );

    const replay = await placeOrder(token, key, { couponCode: 'WELCOME10', redeemPoints: 100 });
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(orderId);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    // replay must not consume points a second time
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(100);
  });

  it('422 when cart is empty; other idempotency key from another user is a conflict', async () => {
    expect((await placeOrder(token, `idem-${stamp}-empty`)).status).toBe(422);
    expect((await placeOrder(otherToken, key)).status).toBe(409);
  });

  it('order detail: owner OK, other customer 403, staff OK, listing + status filter', async () => {
    await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(token)).expect(200);
    await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(otherToken)).expect(403);
    await request(app).get(`/api/v1/orders/${orderId}`).set(bearer(fulfilToken)).expect(200);
    await request(app).get('/api/v1/orders/00000000-0000-4000-8000-000000000000').set(bearer(token)).expect(404);
    const list = await request(app).get('/api/v1/orders?status=PAYMENT_PENDING').set(bearer(token)).expect(200);
    expect(list.body.pagination.total).toBe(1);
    expect((await request(app).get('/api/v1/orders?status=SHIPPED').set(bearer(token)).expect(200)).body.data).toHaveLength(0);
    await request(app).get('/api/v1/orders?status=BOGUS').set(bearer(token)).expect(400);
  });

  it('payment: initiate is owner-only and idempotent; decline (0000) keeps order unpaid and stock untouched', async () => {
    await request(app).post('/api/v1/payments/initiate').set(bearer(otherToken)).send({ orderId, paymentMethod: 'UPI' }).expect(403);
    const before = await stockOf(bookA);
    const first = await pay(token, orderId, { ...GOOD_CARD, number: '4111111111110000' });
    expect(first.confirm.status).toBe(200);
    expect(first.confirm.body.payment.status).toBe('FAILED');
    expect(first.confirm.body.payment.errorMessage).toBe('Card declined');
    expect(first.confirm.body.orderStatus).toBe('PAYMENT_PENDING');
    expect(await stockOf(bookA)).toBe(before);
    paymentId = first.init.id;
  });

  it('payment: success -> MOCK_TXN id, CONFIRMED, stock deducted, no PAN stored; re-confirm is idempotent', async () => {
    const before = await stockOf(bookA);
    const res = await request(app)
      .post('/api/v1/payments/confirm')
      .set(bearer(token))
      .send({ paymentId, paymentMethod: 'CREDIT_CARD', card: GOOD_CARD })
      .expect(200);
    expect(res.body.payment.status).toBe('SUCCESS');
    expect(res.body.payment.gatewayPaymentId).toMatch(/^MOCK_TXN_[0-9a-f-]{36}$/);
    expect(res.body.orderStatus).toBe('CONFIRMED');
    expect(res.body.payment.amount).toBeCloseTo(totalAfterDiscounts, 2);
    expect(await stockOf(bookA)).toBe(before - 1);

    const row = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId } });
    const raw = JSON.stringify(row.gatewayResponseRaw);
    expect(raw).not.toContain(GOOD_CARD.number);
    expect(raw).not.toContain(GOOD_CARD.cvv);
    expect(raw).toContain('1111'); // last4 only

    const again = await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId, paymentMethod: 'CREDIT_CARD', card: GOOD_CARD }).expect(200);
    expect(again.body.payment.gatewayPaymentId).toBe(res.body.payment.gatewayPaymentId);
    expect(await stockOf(bookA)).toBe(before - 1); // not deducted twice
  });

  it('payment validation: missing instrument (400), wrong owner (403), unknown payment (404)', async () => {
    await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId, paymentMethod: 'CREDIT_CARD' }).expect(400);
    await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId, paymentMethod: 'UPI' }).expect(400);
    await request(app).post('/api/v1/payments/confirm').set(bearer(otherToken)).send({ paymentId, paymentMethod: 'CREDIT_CARD', card: GOOD_CARD }).expect(403);
    await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId: '00000000-0000-4000-8000-000000000000', paymentMethod: 'UPI', upiId: 'abc@bank' }).expect(404);
    await request(app).post('/api/v1/payments/initiate').set(bearer(token)).send({ orderId, paymentMethod: 'UPI' }).expect(422); // already paid
  });

  it('state machine: illegal manual transitions are rejected; role guard enforced', async () => {
    const patch = (t: string, body: object) => request(app).patch(`/api/v1/orders/${orderId}/status`).set(bearer(t)).send(body);
    expect((await patch(token, { status: 'PROCESSING' })).status).toBe(403);
    expect((await patch(fulfilToken, { status: 'DELIVERED' })).status).toBe(422); // CONFIRMED -> DELIVERED
    expect((await patch(fulfilToken, { status: 'CONFIRMED' })).status).toBe(422); // not a manual target
    expect((await patch(fulfilToken, { status: 'PROCESSING' })).status).toBe(200);
    expect((await patch(fulfilToken, { status: 'SHIPPED' })).status).toBe(400); // carrier required
    const shipped = await patch(fulfilToken, { status: 'SHIPPED', carrierName: 'Delhivery' });
    expect(shipped.status).toBe(200);
    expect(shipped.body.shipment).toMatchObject({ carrierName: 'Delhivery', shippingStatus: 'IN_TRANSIT' });

    const track = await request(app).get(`/api/v1/shipping/track/${shipped.body.shipment.trackingNumber}`).expect(200);
    expect(track.body.milestones.map((m: { status: string }) => m.status)).toEqual(['MANIFESTED', 'IN_TRANSIT']);

    // cannot cancel once shipped, cannot return before delivery
    await request(app).post(`/api/v1/orders/${orderId}/cancel`).set(bearer(token)).send({}).expect(422);
    await request(app).post(`/api/v1/orders/${orderId}/return`).set(bearer(token)).send({ reason: 'changed my mind' }).expect(422);

    const delivered = await patch(fulfilToken, { status: 'DELIVERED' });
    expect(delivered.status).toBe(200);
    expect(delivered.body.shipment.shippingStatus).toBe('DELIVERED');
  });

  it('review after purchase is a verified purchase', async () => {
    const r = await request(app).post(`/api/v1/catalog/books/${bookA}/reviews`).set(bearer(token)).send({ rating: 5, comment: 'Loved it' }).expect(201);
    expect(r.body.isVerifiedPurchase).toBe(true);
  });

  it('return flow: request -> staff accepts -> auto-refund, stock restored, order REFUNDED', async () => {
    await request(app).post(`/api/v1/orders/${orderId}/return`).set(bearer(token)).send({ reason: 'x' }).expect(400); // reason too short
    const stockBefore = await stockOf(bookA);
    const rq = await request(app).post(`/api/v1/orders/${orderId}/return`).set(bearer(token)).send({ reason: 'Damaged on arrival' }).expect(200);
    expect(rq.body.status).toBe('RETURN_REQUESTED');
    const done = await request(app).patch(`/api/v1/orders/${orderId}/status`).set(bearer(fulfilToken)).send({ status: 'RETURNED' }).expect(200);
    expect(done.body.status).toBe('REFUNDED');
    expect(done.body.payment.status).toBe('REFUNDED');
    expect(await stockOf(bookA)).toBe(stockBefore + 1);
    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId } });
    expect(refund.gatewayRefundId).toMatch(/^MOCK_REF_/);
    expect(Number(refund.refundAmount)).toBeCloseTo(totalAfterDiscounts, 2);
    expect(done.body.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      'CREATED', 'PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
    ]);
  });

  it('buy again re-adds the items to the cart', async () => {
    const res = await request(app).post(`/api/v1/orders/${orderId}/buy-again`).set(bearer(token)).expect(200);
    expect(res.body.items.map((i: { bookId: string }) => i.bookId).sort()).toEqual([bookA, bookB].sort());
    await request(app).post(`/api/v1/orders/${orderId}/buy-again`).set(bearer(otherToken)).expect(403);
    await prisma.cart.deleteMany({ where: { userId } });
  });
});

describe('Cancellation, UPI, webhook and admin refund', () => {
  it('cancel an unpaid order releases points and coupon usage; cannot cancel twice', async () => {
    await fillCart(token, [[bookA, 1], [bookB, 1]]);
    const pointsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints;
    const couponBefore = (await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).timesUsed;
    const o = await placeOrder(token, `idem-${stamp}-cancel`, { couponCode: 'WELCOME10', redeemPoints: 50 });
    expect(o.status).toBe(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(pointsBefore - 50);

    const c = await request(app).post(`/api/v1/orders/${o.body.id}/cancel`).set(bearer(token)).send({ reason: 'No longer needed' }).expect(200);
    expect(c.body.status).toBe('CANCELLED');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).rewardPoints).toBe(pointsBefore);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'WELCOME10' } })).timesUsed).toBe(couponBefore);
    await request(app).post(`/api/v1/orders/${o.body.id}/cancel`).set(bearer(token)).send({}).expect(422);
    await request(app).post(`/api/v1/orders/${o.body.id}/cancel`).set(bearer(otherToken)).send({}).expect(403);
  });

  it('cancel a paid order refunds the payment and restores stock', async () => {
    await fillCart(token, [[bookA, 2]]);
    const stockBefore = await stockOf(bookA);
    const o = await placeOrder(token, `idem-${stamp}-paidcancel`);
    const { confirm } = await pay(token, o.body.id);
    expect(confirm.body.orderStatus).toBe('CONFIRMED');
    expect(await stockOf(bookA)).toBe(stockBefore - 2);

    const c = await request(app).post(`/api/v1/orders/${o.body.id}/cancel`).set(bearer(token)).send({}).expect(200);
    expect(c.body.status).toBe('CANCELLED');
    expect(c.body.payment.status).toBe('REFUNDED');
    expect(await stockOf(bookA)).toBe(stockBefore);
  });

  it('UPI success and UPI decline; insufficient stock at payment time is surfaced as 422', async () => {
    await fillCart(token, [[bookA, 1]]);
    const o = await placeOrder(token, `idem-${stamp}-upi`);
    const init = await request(app).post('/api/v1/payments/initiate').set(bearer(token)).send({ orderId: o.body.id, paymentMethod: 'UPI' }).expect(201);
    const again = await request(app).post('/api/v1/payments/initiate').set(bearer(token)).send({ orderId: o.body.id, paymentMethod: 'UPI' }).expect(201);
    expect(again.body.id).toBe(init.body.id); // open intent is reused
    const bad = await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId: init.body.id, paymentMethod: 'UPI', upiId: 'fail@bank' }).expect(200);
    expect(bad.body.payment.status).toBe('FAILED');

    // stock drops to zero before the customer completes payment
    await prisma.book.update({ where: { id: bookA }, data: { stockQuantity: 0 } });
    await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId: init.body.id, paymentMethod: 'UPI', upiId: 'ok@bank' }).expect(422);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.body.id } })).status).toBe('PAYMENT_PENDING'); // rolled back
    await prisma.book.update({ where: { id: bookA }, data: { stockQuantity: snapshot.find((b) => b.id === bookA)!.stockQuantity } });

    const good = await request(app).post('/api/v1/payments/confirm').set(bearer(token)).send({ paymentId: init.body.id, paymentMethod: 'UPI', upiId: 'ok@bank' }).expect(200);
    expect(good.body.payment.status).toBe('SUCCESS');
    expect(good.body.orderStatus).toBe('CONFIRMED');
  });

  it('webhook confirms an order asynchronously; unknown gateway order is 404', async () => {
    await fillCart(token, [[bookB, 1]]);
    const o = await placeOrder(token, `idem-${stamp}-webhook`);
    const init = await request(app).post('/api/v1/payments/initiate').set(bearer(token)).send({ orderId: o.body.id, paymentMethod: 'WALLET' }).expect(201);
    await request(app).post('/api/v1/payments/simulate-webhook').send({ gatewayOrderId: 'nope', status: 'SUCCESS' }).expect(404);
    await request(app).post('/api/v1/payments/simulate-webhook').send({ gatewayOrderId: init.body.gatewayOrderId, status: 'BAD' }).expect(400);
    const hook = await request(app).post('/api/v1/payments/simulate-webhook').send({ gatewayOrderId: init.body.gatewayOrderId, status: 'SUCCESS' }).expect(200);
    expect(hook.body.orderStatus).toBe('CONFIRMED');
    expect(hook.body.payment.gatewayPaymentId).toMatch(/^MOCK_TXN_/);

    // admin partial refund, then over-refund is rejected
    const pid = init.body.id as string;
    await request(app).post(`/api/v1/payments/${pid}/refund`).set(bearer(token)).send({ reason: 'x' }).expect(403);
    const part = await request(app).post(`/api/v1/payments/${pid}/refund`).set(bearer(adminToken)).send({ amount: 100, reason: 'Goodwill' }).expect(201);
    expect(part.body.gatewayRefundId).toMatch(/^MOCK_REF_/);
    expect(part.body.refundAmount).toBe(100);
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: pid } })).status).toBe('SUCCESS'); // partial
    await request(app).post(`/api/v1/payments/${pid}/refund`).set(bearer(adminToken)).send({ amount: 100000, reason: 'Too much' }).expect(422);
    await request(app).post(`/api/v1/payments/${pid}/refund`).set(bearer(adminToken)).send({ reason: 'Remainder' }).expect(201);
    expect((await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: pid } })).status).toBe('REFUNDED');
    await request(app).post(`/api/v1/payments/${pid}/refund`).set(bearer(adminToken)).send({ reason: 'Again' }).expect(422);
  });
});
