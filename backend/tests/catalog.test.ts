import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma.client';

const app = createApp();
const stamp = Date.now();
const custEmail = `cat-cust-${stamp}@test.dev`;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return res.body.tokens.accessToken as string;
}

afterAll(async () => {
  await prisma.review.deleteMany({ where: { user: { email: custEmail } } });
  await prisma.user.deleteMany({ where: { email: custEmail } });
  await prisma.bookCategory.deleteMany({ where: { book: { isbn: `TEST-${stamp}` } } });
  await prisma.book.deleteMany({ where: { isbn: `TEST-${stamp}` } });
  await prisma.$disconnect();
});

describe('Catalog', () => {
  it('GET /categories returns a tree with nested children', async () => {
    const res = await request(app).get('/api/v1/categories').expect(200);
    const fiction = res.body.find((c: { slug: string }) => c.slug === 'fiction');
    expect(fiction.children.length).toBeGreaterThan(0);
  });

  it('searches with filters, sort and pagination', async () => {
    const all = await request(app).get('/api/v1/catalog/books?limit=3&page=1').expect(200);
    expect(all.body.data).toHaveLength(3);
    expect(all.body.pagination.total).toBeGreaterThanOrEqual(9);

    const hard = await request(app).get('/api/v1/catalog/books?format=HARDCOVER').expect(200);
    expect(hard.body.data.every((b: { format: string }) => b.format === 'HARDCOVER')).toBe(true);

    const asc = await request(app).get('/api/v1/catalog/books?sort=price_asc&maxPrice=300').expect(200);
    const prices = asc.body.data.map((b: { price: number }) => b.price);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));
    expect(Math.max(...prices)).toBeLessThanOrEqual(300);

    const q = await request(app).get('/api/v1/catalog/books?q=minimalism').expect(200);
    expect(q.body.data[0].title).toBe('Joy of Minimalism');

    const cat = await request(app).get('/api/v1/catalog/books?category=fiction').expect(200);
    expect(cat.body.data.length).toBeGreaterThan(0);
  });

  it('400 on invalid query', async () => {
    await request(app).get('/api/v1/catalog/books?minPrice=500&maxPrice=100').expect(400);
    await request(app).get('/api/v1/catalog/books?format=PDF').expect(400);
  });

  it('featured sections, PDP, related, author', async () => {
    const f = await request(app).get('/api/v1/catalog/featured').expect(200);
    expect(f.body.recommended.length).toBeGreaterThan(0);
    expect(f.body.bestsellers.length).toBeGreaterThan(0);
    expect(f.body.newLaunches.length).toBeGreaterThan(0);

    const id = f.body.bestsellers[0].id as string;
    const pdp = await request(app).get(`/api/v1/catalog/books/${id}`).expect(200);
    expect(pdp.body).toMatchObject({ id, isbn: expect.any(String) });
    expect(pdp.body.authorBio).toBeDefined();

    const rel = await request(app).get(`/api/v1/catalog/books/${id}/related`).expect(200);
    expect(rel.body.find((b: { id: string }) => b.id === id)).toBeUndefined();

    const author = await request(app).get(`/api/v1/authors/${pdp.body.author.id}`).expect(200);
    expect(author.body.books.length).toBeGreaterThan(0);

    await request(app).get('/api/v1/catalog/books/not-a-uuid').expect(400);
    await request(app).get('/api/v1/catalog/books/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('admin creates and updates a book; customer is forbidden', async () => {
    const admin = await login('catalog@bookworm.test', 'Password@123');
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: custEmail, password: 'Password@123', firstName: 'Rev', lastName: 'Iewer' })
      .expect(201);
    const cust = reg.body.tokens.accessToken as string;

    const author = await prisma.author.findFirstOrThrow();
    const body = {
      title: 'Test Book', isbn: `TEST-${stamp}`, authorId: author.id, format: 'EBOOK',
      frontCoverUrl: 'http://x/y.jpg', price: 10, stockQuantity: 5,
    };
    await request(app).post('/api/v1/catalog/books').set('Authorization', `Bearer ${cust}`).send(body).expect(403);
    await request(app).post('/api/v1/catalog/books').send(body).expect(401);
    await request(app).post('/api/v1/catalog/books').set('Authorization', `Bearer ${admin}`).send({ ...body, price: -1 }).expect(400);
    const created = await request(app).post('/api/v1/catalog/books').set('Authorization', `Bearer ${admin}`).send(body).expect(201);
    await request(app).post('/api/v1/catalog/books').set('Authorization', `Bearer ${admin}`).send(body).expect(409);

    const upd = await request(app)
      .put(`/api/v1/catalog/books/${created.body.id}`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ price: 12.5, stockQuantity: 0 })
      .expect(200);
    expect(upd.body.price).toBe(12.5);
    expect(upd.body.inStock).toBe(false);

    // reviews: submit, duplicate, aggregation
    const bookId = created.body.id as string;
    const rv = await request(app)
      .post(`/api/v1/catalog/books/${bookId}/reviews`)
      .set('Authorization', `Bearer ${cust}`)
      .send({ rating: 4, comment: 'Nice' })
      .expect(201);
    expect(rv.body.isVerifiedPurchase).toBe(false);
    await request(app).post(`/api/v1/catalog/books/${bookId}/reviews`).set('Authorization', `Bearer ${cust}`).send({ rating: 5 }).expect(409);
    await request(app).post(`/api/v1/catalog/books/${bookId}/reviews`).set('Authorization', `Bearer ${cust}`).send({ rating: 9 }).expect(400);

    const list = await request(app).get(`/api/v1/catalog/books/${bookId}/reviews`).expect(200);
    expect(list.body).toMatchObject({ averageRating: 4, reviewCount: 1 });
    expect(list.body.data).toHaveLength(1);
  });
});
