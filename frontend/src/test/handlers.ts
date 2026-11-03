import { http, HttpResponse, type RequestHandler } from 'msw';
import type { ConfirmPaymentRequest, CreateOrderRequest } from '@/api/types';
import {
  FIXTURE_GUEST_SESSION_ID,
  addressFixture,
  authResponseFixture,
  bookDetailFixture,
  bookSummary2Fixture,
  bookSummaryFixture,
  cartFixture,
  categoriesFixture,
  checkoutSummaryFixture,
  orderFixture,
  paymentFixture,
  problemFixture,
  profileFixture,
  tokenPairFixture,
} from './fixtures';

/** Matches any origin so handlers work with relative (`/api/v1`) and absolute base URLs. */
const api = (path: string) => `*/api/v1${path}`;

const problem = (status: number, title: string, detail: string) =>
  HttpResponse.json(problemFixture({ status, title, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

const unauthorized = () => problem(401, 'Unauthorized', 'Missing or invalid credentials');

const hasBearer = (request: Request) => request.headers.get('authorization')?.startsWith('Bearer ');

/** Guest endpoints echo the guest session id, creating one when the caller has none. */
const guestHeaders = (request: Request) => ({
  'x-guest-session-id': request.headers.get('x-guest-session-id') ?? FIXTURE_GUEST_SESSION_ID,
});

export const handlers: RequestHandler[] = [
  // ---- Auth
  http.post(api('/auth/register'), () => HttpResponse.json(authResponseFixture, { status: 201 })),
  http.post(api('/auth/login'), () => HttpResponse.json(authResponseFixture)),
  http.post(api('/auth/refresh'), () => HttpResponse.json(tokenPairFixture)),
  http.post(api('/auth/logout'), () => new HttpResponse(null, { status: 204 })),

  // ---- Members
  http.get(api('/members/me'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json(profileFixture) : unauthorized(),
  ),
  http.put(api('/members/me'), async ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json({ ...profileFixture, ...((await request.json()) as object) })
      : unauthorized(),
  ),
  http.get(api('/members/me/addresses'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json([addressFixture]) : unauthorized(),
  ),
  http.post(api('/members/me/addresses'), async ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json(
          { ...addressFixture, ...((await request.json()) as object) },
          { status: 201 },
        )
      : unauthorized(),
  ),
  http.delete(api('/members/me/addresses/:id'), ({ request }) =>
    hasBearer(request) ? new HttpResponse(null, { status: 204 }) : unauthorized(),
  ),

  // ---- Catalog
  http.get(api('/categories'), () => HttpResponse.json(categoriesFixture)),
  http.get(api('/catalog/featured'), () =>
    HttpResponse.json({
      recommended: [bookSummaryFixture],
      bestsellers: [bookSummary2Fixture],
      newLaunches: [bookSummaryFixture, bookSummary2Fixture],
    }),
  ),
  http.get(api('/catalog/books'), () =>
    HttpResponse.json({
      data: [bookSummaryFixture, bookSummary2Fixture],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    }),
  ),
  http.get(api('/catalog/books/:id/related'), () => HttpResponse.json([bookSummary2Fixture])),
  http.get(api('/catalog/books/:id/reviews'), ({ params }) =>
    HttpResponse.json({
      data: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          bookId: String(params.id),
          rating: 5,
          reviewerName: 'Asha R.',
          comment: 'Loved it.',
          isVerifiedPurchase: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      averageRating: 5,
      reviewCount: 1,
    }),
  ),
  http.post(api('/catalog/books/:id/reviews'), async ({ request, params }) =>
    hasBearer(request)
      ? HttpResponse.json(
          {
            id: '99999999-9999-4999-8999-999999999999',
            bookId: String(params.id),
            reviewerName: 'Asha R.',
            isVerifiedPurchase: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            ...((await request.json()) as object),
          },
          { status: 201 },
        )
      : unauthorized(),
  ),
  http.get(api('/catalog/books/:id'), ({ params }) =>
    params.id === bookDetailFixture.id
      ? HttpResponse.json(bookDetailFixture)
      : problem(404, 'Not Found', 'Book not found'),
  ),
  http.get(api('/authors/:id'), ({ params }) =>
    HttpResponse.json({
      id: String(params.id),
      name: 'Matt Haig',
      bio: 'British author.',
      avatarUrl: null,
      books: [bookSummaryFixture],
    }),
  ),

  // ---- Cart (guest or member)
  http.get(api('/cart'), ({ request }) =>
    HttpResponse.json(cartFixture, { headers: guestHeaders(request) }),
  ),
  http.post(api('/cart/items'), ({ request }) =>
    HttpResponse.json(cartFixture, { status: 201, headers: guestHeaders(request) }),
  ),
  http.put(api('/cart/items/:itemId'), () => HttpResponse.json(cartFixture)),
  http.delete(api('/cart/items/:itemId'), () =>
    HttpResponse.json({ ...cartFixture, items: [], itemCount: 0 }),
  ),
  http.post(api('/cart/merge'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json(cartFixture) : unauthorized(),
  ),

  // ---- Wishlist (member only)
  http.get(api('/wishlist'), ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json([
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            book: bookSummaryFixture,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ])
      : unauthorized(),
  ),
  http.post(api('/wishlist/items'), ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json(
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            book: bookSummaryFixture,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        )
      : unauthorized(),
  ),
  http.delete(api('/wishlist/items/:bookId'), ({ request }) =>
    hasBearer(request) ? new HttpResponse(null, { status: 204 }) : unauthorized(),
  ),
  http.post(api('/wishlist/move-to-cart/:bookId'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json(cartFixture) : unauthorized(),
  ),

  // ---- Orders
  http.post(api('/orders/checkout/summary'), () => HttpResponse.json(checkoutSummaryFixture)),
  http.post(api('/orders'), async ({ request }) => {
    if (!hasBearer(request)) return unauthorized();
    if (!request.headers.get('idempotency-key')) {
      return problem(400, 'Bad Request', 'Idempotency-Key header is required');
    }
    const body = (await request.json()) as CreateOrderRequest;
    if (!body.addressId && !body.shippingAddress) {
      return problem(400, 'Bad Request', 'addressId or shippingAddress is required');
    }
    return HttpResponse.json(orderFixture, { status: 201 });
  }),
  http.get(api('/orders'), ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json({
          data: [orderFixture],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        })
      : unauthorized(),
  ),
  http.get(api('/orders/:orderId'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json(orderFixture) : unauthorized(),
  ),
  http.post(api('/orders/:orderId/cancel'), ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json({ ...orderFixture, status: 'CANCELLED' })
      : unauthorized(),
  ),
  http.post(api('/orders/:orderId/return'), ({ request }) =>
    hasBearer(request)
      ? HttpResponse.json({ ...orderFixture, status: 'RETURN_REQUESTED' })
      : unauthorized(),
  ),
  http.post(api('/orders/:orderId/buy-again'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json(cartFixture) : unauthorized(),
  ),

  // ---- Coupons
  http.post(api('/coupons/validate'), async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    return code.toUpperCase() === 'WELCOME10'
      ? HttpResponse.json({
          code: 'WELCOME10',
          valid: true,
          discountAmount: 40,
          discountType: 'PERCENTAGE',
        })
      : problem(404, 'Not Found', 'Coupon not found');
  }),

  // ---- Payments (mock gateway: card ending 0000 fails with HTTP 200)
  http.post(api('/payments/initiate'), ({ request }) =>
    hasBearer(request) ? HttpResponse.json(paymentFixture, { status: 201 }) : unauthorized(),
  ),
  http.post(api('/payments/confirm'), async ({ request }) => {
    if (!hasBearer(request)) return unauthorized();
    const body = (await request.json()) as ConfirmPaymentRequest;
    const declined = body.card?.number.endsWith('0000') === true;
    return HttpResponse.json(
      declined
        ? {
            payment: { ...paymentFixture, status: 'FAILED', errorMessage: 'Card declined' },
            orderStatus: 'PAYMENT_PENDING',
          }
        : {
            payment: {
              ...paymentFixture,
              status: 'SUCCESS',
              gatewayPaymentId: 'MOCK_TXN_6f1d2c1e-0000-4000-8000-000000000000',
            },
            orderStatus: 'CONFIRMED',
          },
    );
  }),

  // ---- Shipping
  http.post(api('/shipping/calculate-rate'), () =>
    HttpResponse.json({
      zoneCode: 'SOUTH',
      tier: 'STANDARD',
      rate: 40,
      isFree: false,
      estimatedDelivery: '2026-01-10',
    }),
  ),
  http.get(api('/shipping/estimate-delivery'), ({ request }) =>
    HttpResponse.json({
      postalCode: new URL(request.url).searchParams.get('postalCode') ?? '',
      tier: 'STANDARD',
      deliveryDays: 5,
      estimatedDelivery: '2026-01-10',
      isServiceable: true,
    }),
  ),
  http.get(api('/shipping/track/:trackingNumber'), ({ params }) =>
    HttpResponse.json({
      trackingNumber: String(params.trackingNumber),
      carrierName: 'BlueDart',
      shippingStatus: 'IN_TRANSIT',
      dispatchedAt: '2026-01-02T00:00:00.000Z',
      estimatedDelivery: '2026-01-10',
      deliveredAt: null,
      milestones: [{ status: 'MANIFESTED', timestamp: '2026-01-02T00:00:00.000Z' }],
    }),
  ),
];
