import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import {
  FIXTURE_ACCESS_TOKEN,
  FIXTURE_GUEST_SESSION_ID,
  FIXTURE_IDS,
  FIXTURE_REFRESH_TOKEN,
  cartFixture,
  problemFixture,
  tokenPairFixture,
} from '@/test/fixtures';
import { ApiError } from './errors';
import { createHttpClient, type HttpClient } from './client';
import { createMemoryTokenStorage, type TokenStorage } from './token-storage';

const BASE = 'http://api.test/api/v1';

function setup(): { client: HttpClient; storage: TokenStorage } {
  const storage = createMemoryTokenStorage();
  return { client: createHttpClient({ baseUrl: BASE, storage }), storage };
}

const problemResponse = (status: number, title: string, detail: string, errors = []) =>
  HttpResponse.json(problemFixture({ status, title, detail, errors }), {
    status,
    headers: { 'content-type': 'application/problem+json', 'x-correlation-id': 'corr-1' },
  });

describe('http client: auth header', () => {
  it('sends the Bearer token when one is stored', async () => {
    const { client, storage } = setup();
    storage.setTokens(tokenPairFixture);
    let header: string | null = null;
    server.use(
      http.get(`${BASE}/cart`, ({ request }) => {
        header = request.headers.get('authorization');
        return HttpResponse.json(cartFixture);
      }),
    );

    await client.get('/cart');

    expect(header).toBe(`Bearer ${FIXTURE_ACCESS_TOKEN}`);
  });

  it('sends no Authorization header without a token or with auth: false', async () => {
    const { client, storage } = setup();
    const seen: Array<string | null> = [];
    server.use(
      http.get(`${BASE}/cart`, ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json(cartFixture);
      }),
    );

    await client.get('/cart');
    storage.setTokens(tokenPairFixture);
    await client.get('/cart', { auth: false });

    expect(seen).toEqual([null, null]);
  });
});

describe('http client: guest session', () => {
  it('captures x-guest-session-id from a response and sends it on later calls', async () => {
    const { client, storage } = setup();
    const sent: Array<string | null> = [];
    server.use(
      http.post(`${BASE}/cart/items`, ({ request }) => {
        sent.push(request.headers.get('x-guest-session-id'));
        return HttpResponse.json(cartFixture, {
          status: 201,
          headers: { 'x-guest-session-id': FIXTURE_GUEST_SESSION_ID },
        });
      }),
      http.get(`${BASE}/cart`, ({ request }) => {
        sent.push(request.headers.get('x-guest-session-id'));
        return HttpResponse.json(cartFixture);
      }),
    );

    await client.post('/cart/items', { bookId: FIXTURE_IDS.book1 });
    expect(storage.getGuestSessionId()).toBe(FIXTURE_GUEST_SESSION_ID);
    await client.get('/cart');

    expect(sent).toEqual([null, FIXTURE_GUEST_SESSION_ID]);
  });
});

describe('http client: 401 refresh', () => {
  it('refreshes once, stores the rotated tokens and retries the original request', async () => {
    const { client, storage } = setup();
    storage.setTokens({ accessToken: 'expired', refreshToken: 'r1', expiresIn: 1 });
    const rotated = { accessToken: 'fresh', refreshToken: 'r2', expiresIn: 900 };
    const auths: Array<string | null> = [];
    let refreshBody: unknown;
    server.use(
      http.get(`${BASE}/members/me`, ({ request }) => {
        const auth = request.headers.get('authorization');
        auths.push(auth);
        return auth === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : problemResponse(401, 'Unauthorized', 'jwt expired');
      }),
      http.post(`${BASE}/auth/refresh`, async ({ request }) => {
        refreshBody = await request.json();
        return HttpResponse.json(rotated);
      }),
    );

    await expect(client.get('/members/me')).resolves.toEqual({ ok: true });

    expect(auths).toEqual(['Bearer expired', 'Bearer fresh']);
    expect(refreshBody).toEqual({ refreshToken: 'r1' });
    expect(storage.getAccessToken()).toBe('fresh');
    expect(storage.getRefreshToken()).toBe('r2');
  });

  it('shares a single refresh call between concurrent 401s (single-flight)', async () => {
    const { client, storage } = setup();
    storage.setTokens({ accessToken: 'expired', refreshToken: 'r1', expiresIn: 1 });
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/members/me`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ ok: true })
          : problemResponse(401, 'Unauthorized', 'jwt expired'),
      ),
      http.get(`${BASE}/wishlist`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json([])
          : problemResponse(401, 'Unauthorized', 'jwt expired'),
      ),
      http.post(`${BASE}/auth/refresh`, async () => {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json({ accessToken: 'fresh', refreshToken: 'r2', expiresIn: 900 });
      }),
    );

    const results = await Promise.all([
      client.get('/members/me'),
      client.get('/wishlist'),
      client.get('/members/me'),
    ]);

    expect(results).toEqual([{ ok: true }, [], { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it('clears tokens and throws the 401 ApiError when the refresh token is rejected', async () => {
    const { client, storage } = setup();
    storage.setTokens({ accessToken: 'expired', refreshToken: 'bad', expiresIn: 1 });
    server.use(
      http.get(`${BASE}/members/me`, () => problemResponse(401, 'Unauthorized', 'jwt expired')),
      http.post(`${BASE}/auth/refresh`, () =>
        problemResponse(401, 'Unauthorized', 'invalid refresh'),
      ),
    );

    await expect(client.get('/members/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    });

    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('does not attempt a refresh when there is no refresh token', async () => {
    const { client } = setup();
    let refreshCalls = 0;
    server.use(
      http.get(`${BASE}/members/me`, () => problemResponse(401, 'Unauthorized', 'Missing token')),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(tokenPairFixture);
      }),
    );

    await expect(client.get('/members/me')).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
  });

  it('does not try to refresh when /auth/* itself returns 401 (bad login)', async () => {
    const { client, storage } = setup();
    storage.setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 1 });
    let refreshCalls = 0;
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        problemResponse(401, 'Unauthorized', 'Invalid credentials'),
      ),
      http.post(`${BASE}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json(tokenPairFixture);
      }),
    );

    await expect(
      client.post('/auth/login', { email: 'a@b.c', password: 'x' }),
    ).rejects.toMatchObject({
      status: 401,
      detail: 'Invalid credentials',
    });
    expect(refreshCalls).toBe(0);
  });

  it('keeps tokens when the refresh endpoint fails with a server error', async () => {
    const { client, storage } = setup();
    storage.setTokens({ accessToken: 'expired', refreshToken: 'r1', expiresIn: 1 });
    server.use(
      http.get(`${BASE}/members/me`, () => problemResponse(401, 'Unauthorized', 'jwt expired')),
      http.post(`${BASE}/auth/refresh`, () => problemResponse(503, 'Service Unavailable', 'down')),
    );

    await expect(client.get('/members/me')).rejects.toMatchObject({ status: 401 });
    expect(storage.getRefreshToken()).toBe('r1');
  });
});

describe('http client: errors', () => {
  it('wraps an RFC 7807 Problem into ApiError, including field errors and correlation id', async () => {
    const { client } = setup();
    server.use(
      http.post(`${BASE}/auth/register`, () =>
        problemResponse(400, 'Bad Request', 'Validation failed', [
          { field: 'body.email', message: 'Invalid email' } as never,
        ]),
      ),
    );

    const error = await client.post('/auth/register', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      title: 'Bad Request',
      detail: 'Validation failed',
      correlationId: 'corr-1',
      errors: [{ field: 'body.email', message: 'Invalid email' }],
    });
  });

  it('synthesises a Problem when the error body is not RFC 7807', async () => {
    const { client } = setup();
    server.use(
      http.get(`${BASE}/cart`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })),
    );

    await expect(client.get('/cart')).rejects.toMatchObject({
      status: 502,
      detail: '<html>Bad gateway</html>',
    });
  });

  it('wraps network failures as ApiError with status 0', async () => {
    const { client } = setup();
    server.use(http.get(`${BASE}/cart`, () => HttpResponse.error()));

    await expect(client.get('/cart')).rejects.toMatchObject({ name: 'ApiError', status: 0 });
  });
});

describe('http client: request building', () => {
  it('serialises query params, skipping empty values', async () => {
    const { client } = setup();
    let search = '';
    server.use(
      http.get(`${BASE}/catalog/books`, ({ request }) => {
        search = new URL(request.url).search;
        return HttpResponse.json({
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }),
    );

    await client.get('/catalog/books', {
      query: { q: 'dune', page: 2, category: undefined, publisher: '', minPrice: 0 },
    });

    expect(search).toBe('?q=dune&page=2&minPrice=0');
  });

  it('forwards x-correlation-id and returns undefined for 204 responses', async () => {
    const { client } = setup();
    let correlation: string | null = null;
    server.use(
      http.delete(`${BASE}/wishlist/items/x`, ({ request }) => {
        correlation = request.headers.get('x-correlation-id');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(
      client.delete('/wishlist/items/x', { correlationId: 'trace-9' }),
    ).resolves.toBeUndefined();
    expect(correlation).toBe('trace-9');
  });
});

describe('endpoint modules', () => {
  it('ordersApi.create sends Idempotency-Key and reports replays', async () => {
    const { ordersApi } = await import('./orders.api');
    const { apiClient } = await import('./client');
    apiClient.configure({ baseUrl: BASE, storage: createMemoryTokenStorage() });
    const storage = createMemoryTokenStorage();
    storage.setTokens({
      accessToken: FIXTURE_ACCESS_TOKEN,
      refreshToken: FIXTURE_REFRESH_TOKEN,
      expiresIn: 900,
    });
    apiClient.configure({ storage });
    const keys: Array<string | null> = [];
    server.use(
      http.post(`${BASE}/orders`, ({ request }) => {
        keys.push(request.headers.get('idempotency-key'));
        return HttpResponse.json(
          { id: FIXTURE_IDS.order },
          { status: keys.length === 1 ? 201 : 200 },
        );
      }),
    );

    const first = await ordersApi.create({ addressId: FIXTURE_IDS.address }, 'key-1');
    const second = await ordersApi.create({ addressId: FIXTURE_IDS.address }, 'key-1');

    expect(keys).toEqual(['key-1', 'key-1']);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
  });
});
