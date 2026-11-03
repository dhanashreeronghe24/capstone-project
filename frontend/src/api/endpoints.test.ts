import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { FIXTURE_ACCESS_TOKEN, FIXTURE_IDS, bookDetailFixture } from '@/test/fixtures';
import { apiClient } from './client';
import { createMemoryTokenStorage } from './token-storage';
import { ApiError } from './errors';
import { catalogApi } from './catalog.api';
import { paymentsApi } from './payments.api';
import { couponsApi } from './coupons.api';
import { cartApi } from './cart.api';
import { authApi } from './auth.api';

// Exercises the default MSW handlers (contract fixtures) through the real endpoint modules.
describe('endpoint modules against default MSW handlers', () => {
  beforeEach(() => {
    const storage = createMemoryTokenStorage();
    storage.setTokens({ accessToken: FIXTURE_ACCESS_TOKEN, refreshToken: 'r', expiresIn: 900 });
    apiClient.configure({ baseUrl: 'http://api.test/api/v1', storage });
  });

  it('loads a book and maps 404 to ApiError', async () => {
    await expect(catalogApi.getBook(bookDetailFixture.id)).resolves.toMatchObject({
      isbn: '9780525559474',
    });
    await expect(catalogApi.getBook(FIXTURE_IDS.order)).rejects.toMatchObject({ status: 404 });
  });

  it('fetches cart and captures the guest session', async () => {
    const storage = createMemoryTokenStorage();
    apiClient.configure({ storage });
    await cartApi.getCart();
    expect(storage.getGuestSessionId()).toBe('guest-session-fixture');
  });

  it('login does not send a Bearer token', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.post('*/api/v1/auth/login', ({ request }) => {
        auth = request.headers.get('authorization');
        return HttpResponse.json({ user: {}, tokens: {} });
      }),
    );
    await authApi.login({ email: 'a@b.co', password: 'password1' });
    expect(auth).toBeNull();
  });

  it('mock gateway: card ending 0000 is a FAILED outcome with HTTP 200, others succeed', async () => {
    const card = { holderName: 'A', cvv: '123', expiry: '12/30' };
    const declined = await paymentsApi.confirm({
      paymentId: FIXTURE_IDS.payment,
      paymentMethod: 'CREDIT_CARD',
      card: { ...card, number: '4111111111110000' },
    });
    const ok = await paymentsApi.confirm({
      paymentId: FIXTURE_IDS.payment,
      paymentMethod: 'CREDIT_CARD',
      card: { ...card, number: '4111111111111111' },
    });
    expect(declined.payment.status).toBe('FAILED');
    expect(declined.orderStatus).toBe('PAYMENT_PENDING');
    expect(ok.payment.status).toBe('SUCCESS');
    expect(ok.payment.gatewayPaymentId).toMatch(/^MOCK_TXN_/);
    expect(ok.orderStatus).toBe('CONFIRMED');
  });

  it('coupon validation surfaces 404 as ApiError', async () => {
    await expect(couponsApi.validate('WELCOME10')).resolves.toMatchObject({ valid: true });
    const error = await couponsApi.validate('NOPE').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
  });
});
