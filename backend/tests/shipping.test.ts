import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma.client';

const app = createApp();

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Shipping', () => {
  it('calculates zone rate = base + per-kg * weight', async () => {
    // LOCAL STANDARD seed: base 40, per-kg 5 -> 40 + 5*2 = 50
    const res = await request(app)
      .post('/api/v1/shipping/calculate-rate')
      .send({ postalCode: '560001', weightKg: 2, orderAmount: 100 })
      .expect(200);
    expect(res.body).toMatchObject({ zoneCode: 'LOCAL', tier: 'STANDARD', rate: 50, isFree: false });
    expect(res.body.estimatedDelivery).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('EXPRESS costs more and delivers sooner than STANDARD', async () => {
    const std = await request(app).post('/api/v1/shipping/calculate-rate').send({ postalCode: '795001', weightKg: 1 }).expect(200);
    const exp = await request(app).post('/api/v1/shipping/calculate-rate').send({ postalCode: '795001', weightKg: 1, tier: 'EXPRESS' }).expect(200);
    expect(exp.body.rate).toBeGreaterThan(std.body.rate);
    expect(new Date(exp.body.estimatedDelivery).getTime()).toBeLessThan(new Date(std.body.estimatedDelivery).getTime());
  });

  it('is free at or above the free-shipping threshold', async () => {
    const res = await request(app).post('/api/v1/shipping/calculate-rate').send({ postalCode: '560001', weightKg: 3, orderAmount: 499 }).expect(200);
    expect(res.body).toMatchObject({ rate: 0, isFree: true });
  });

  it('validation (400) and unserviceable pincode (422)', async () => {
    await request(app).post('/api/v1/shipping/calculate-rate').send({ postalCode: '12', weightKg: 1 }).expect(400);
    await request(app).post('/api/v1/shipping/calculate-rate').send({ postalCode: '560001', weightKg: 0 }).expect(400);
    await request(app).post('/api/v1/shipping/calculate-rate').send({ postalCode: '999999', weightKg: 1 }).expect(422);
  });

  it('estimate-delivery: success, unknown pincode 404, unknown book 404', async () => {
    const res = await request(app).get('/api/v1/shipping/estimate-delivery?postalCode=400001&tier=EXPRESS').expect(200);
    expect(res.body).toMatchObject({ postalCode: '400001', tier: 'EXPRESS', deliveryDays: 1, isServiceable: true });
    await request(app).get('/api/v1/shipping/estimate-delivery?postalCode=999999').expect(404);
    await request(app).get('/api/v1/shipping/estimate-delivery?postalCode=400001&bookId=00000000-0000-4000-8000-000000000000').expect(404);
    await request(app).get('/api/v1/shipping/estimate-delivery').expect(400);
  });

  it('track: 404 for unknown number', async () => {
    await request(app).get('/api/v1/shipping/track/NOPE123').expect(404);
  });
});
