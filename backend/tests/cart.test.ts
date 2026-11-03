import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma.client';

const app = createApp();
const email = `cart-${Date.now()}@test.dev`;

afterAll(async () => {
  await prisma.cart.deleteMany({ where: { OR: [{ user: { email } }, { sessionToken: { startsWith: 'itest-' } }] } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('Cart & Wishlist', () => {
  let bookA = '';
  let bookB = '';
  let token = '';
  let guest = '';
  let guestItem = '';

  beforeAll(async () => {
    const books = await prisma.book.findMany({ where: { stockQuantity: { gt: 5 } }, take: 2, orderBy: { isbn: 'asc' } });
    bookA = books[0].id;
    bookB = books[1].id;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Password@123', firstName: 'C', lastName: 'T' });
    token = reg.body.tokens.accessToken;
  });

  it('guest: empty cart creates a session token, header echoed', async () => {
    const res = await request(app).get('/api/v1/cart').expect(200);
    expect(res.body.items).toEqual([]);
    guest = res.headers['x-guest-session-id'];
    expect(guest).toBeTruthy();
    expect(res.body.guestSessionId).toBe(guest);
  });

  it('guest: add, increment, totals, update, remove', async () => {
    const add = await request(app).post('/api/v1/cart/items').set('x-guest-session-id', guest).send({ bookId: bookA, quantity: 2 }).expect(201);
    guestItem = add.body.items[0].id;
    expect(add.body.itemCount).toBe(2);
    await request(app).post('/api/v1/cart/items').set('x-guest-session-id', guest).send({ bookId: bookA }).expect(201);
    const got = await request(app).get('/api/v1/cart').set('x-guest-session-id', guest).expect(200);
    expect(got.body.items).toHaveLength(1);
    expect(got.body.items[0].quantity).toBe(3);
    expect(got.body.subtotal).toBeCloseTo(got.body.items[0].unitPrice * 3, 2);
    expect(got.body.totalAmount).toBeCloseTo(got.body.subtotal + got.body.taxAmount, 2);

    await request(app).put(`/api/v1/cart/items/${guestItem}`).set('x-guest-session-id', guest).send({ quantity: 1 }).expect(200);
    await request(app).put(`/api/v1/cart/items/${guestItem}`).set('x-guest-session-id', guest).send({ quantity: 0 }).expect(400);
    await request(app).put(`/api/v1/cart/items/${guestItem}`).set('x-guest-session-id', guest).send({ quantity: 100000 }).expect(400);
    await request(app).put(`/api/v1/cart/items/${guestItem}`).set('x-guest-session-id', guest).send({ quantity: 100 }).expect(422);
  });

  it('validation & domain errors', async () => {
    await request(app).post('/api/v1/cart/items').send({ bookId: 'bad' }).expect(400);
    await request(app).post('/api/v1/cart/items').send({ bookId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    await request(app).delete('/api/v1/cart/items/00000000-0000-4000-8000-000000000000').set('x-guest-session-id', guest).expect(404);
  });

  it('merges guest cart into customer cart on login and removes guest cart', async () => {
    await request(app).post('/api/v1/cart/items').set('Authorization', `Bearer ${token}`).send({ bookId: bookA, quantity: 1 }).expect(201);
    await request(app).post('/api/v1/cart/items').set('x-guest-session-id', guest).send({ bookId: bookB, quantity: 1 }).expect(201);
    await request(app).post('/api/v1/cart/merge').send({ guestSessionId: guest }).expect(401);
    const merged = await request(app).post('/api/v1/cart/merge').set('Authorization', `Bearer ${token}`).send({ guestSessionId: guest }).expect(200);
    expect(merged.body.items).toHaveLength(2);
    const a = merged.body.items.find((i: { bookId: string }) => i.bookId === bookA);
    expect(a.quantity).toBe(2); // 1 (user) + 1 (guest)
    expect(await prisma.cart.count({ where: { sessionToken: guest } })).toBe(0);
  });

  it('wishlist add / duplicate / list / move-to-cart / remove', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).get('/api/v1/wishlist').expect(401);
    const third = await prisma.book.findFirstOrThrow({ where: { id: { notIn: [bookA, bookB] }, stockQuantity: { gt: 0 } } });
    await request(app).post('/api/v1/wishlist/items').set(auth).send({ bookId: third.id }).expect(201);
    await request(app).post('/api/v1/wishlist/items').set(auth).send({ bookId: third.id }).expect(409);
    await request(app).post('/api/v1/wishlist/items').set(auth).send({ bookId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    const list = await request(app).get('/api/v1/wishlist').set(auth).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].book.id).toBe(third.id);

    const moved = await request(app).post(`/api/v1/wishlist/move-to-cart/${third.id}`).set(auth).expect(200);
    expect(moved.body.items.some((i: { bookId: string }) => i.bookId === third.id)).toBe(true);
    expect((await request(app).get('/api/v1/wishlist').set(auth)).body).toHaveLength(0);
    await request(app).post(`/api/v1/wishlist/move-to-cart/${third.id}`).set(auth).expect(404);

    await request(app).post('/api/v1/wishlist/items').set(auth).send({ bookId: third.id }).expect(201);
    await request(app).delete(`/api/v1/wishlist/items/${third.id}`).set(auth).expect(204);
    await request(app).delete(`/api/v1/wishlist/items/${third.id}`).set(auth).expect(404);
  });
});
