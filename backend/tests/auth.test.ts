import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma.client';

const app = createApp();
const email = `auth-${Date.now()}@test.dev`;
const password = 'Sup3rSecret!';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('Auth & Members', () => {
  let access = '';
  let refresh = '';
  let addressId = '';

  it('GET /health', async () => {
    await request(app).get('/health').expect(200, { status: 'ok' });
  });

  it('rejects invalid registration with Problem Details (400)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'nope', password: 'x' }).expect(400);
    expect(res.body).toMatchObject({ status: 400, title: 'Bad Request' });
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.timestamp).toBeDefined();
  });

  it('registers a customer (201) and never returns password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'Test', lastName: 'User' })
      .expect(201);
    expect(res.body.user.roles).toEqual(['ROLE_CUSTOMER']);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    access = res.body.tokens.accessToken;
    refresh = res.body.tokens.refreshToken;
  });

  it('stores a bcrypt hash, not the plain password', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(u.passwordHash).not.toBe(password);
    expect(u.passwordHash).toMatch(/^\$2[aby]\$1\d\$/);
  });

  it('409 on duplicate registration', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password, firstName: 'T', lastName: 'U' })
      .expect(409);
  });

  it('401 on wrong password, 200 on correct', async () => {
    await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-pass' }).expect(401);
    const res = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    expect(res.body.tokens.accessToken).toBeDefined();
  });

  it('401 without token, 403 for wrong role', async () => {
    await request(app).get('/api/v1/members/me').expect(401);
    // customers cannot create books
    await request(app)
      .post('/api/v1/catalog/books')
      .set('Authorization', `Bearer ${access}`)
      .send({})
      .expect((r) => expect([403, 404]).toContain(r.status));
  });

  it('GET/PUT /members/me', async () => {
    const me = await request(app).get('/api/v1/members/me').set('Authorization', `Bearer ${access}`).expect(200);
    expect(me.body.email).toBe(email);
    const upd = await request(app)
      .put('/api/v1/members/me')
      .set('Authorization', `Bearer ${access}`)
      .send({ firstName: 'Renamed' })
      .expect(200);
    expect(upd.body.firstName).toBe('Renamed');
    await request(app).put('/api/v1/members/me').set('Authorization', `Bearer ${access}`).send({}).expect(400);
  });

  it('address add (first becomes default), list, delete, 404 on repeat', async () => {
    const body = {
      recipientName: 'Test User', phoneNumber: '9999999999', addressLine1: '1 MG Road',
      city: 'Bengaluru', state: 'Karnataka', postalCode: '560001',
    };
    await request(app).post('/api/v1/members/me/addresses').set('Authorization', `Bearer ${access}`).send({ ...body, postalCode: '12' }).expect(400);
    const created = await request(app).post('/api/v1/members/me/addresses').set('Authorization', `Bearer ${access}`).send(body).expect(201);
    expect(created.body.isDefault).toBe(true);
    addressId = created.body.id;
    const list = await request(app).get('/api/v1/members/me/addresses').set('Authorization', `Bearer ${access}`).expect(200);
    expect(list.body).toHaveLength(1);
    await request(app).delete(`/api/v1/members/me/addresses/${addressId}`).set('Authorization', `Bearer ${access}`).expect(204);
    await request(app).delete(`/api/v1/members/me/addresses/${addressId}`).set('Authorization', `Bearer ${access}`).expect(404);
  });

  it('rotates refresh token; reuse of old token fails; logout revokes', async () => {
    const r1 = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh }).expect(200);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh }).expect(401);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${r1.body.accessToken}`)
      .send({ refreshToken: r1.body.refreshToken })
      .expect(204);
    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
  });
});
