import type {
  Address,
  AuthResponse,
  BookDetail,
  BookSummary,
  Cart,
  CategoryNode,
  CheckoutSummary,
  Order,
  PaymentTransaction,
  Problem,
  Profile,
  TokenPair,
} from '@/api/types';

export const FIXTURE_IDS = {
  user: '11111111-1111-4111-8111-111111111111',
  book1: '22222222-2222-4222-8222-222222222221',
  book2: '22222222-2222-4222-8222-222222222222',
  author: '33333333-3333-4333-8333-333333333333',
  cart: '44444444-4444-4444-8444-444444444444',
  cartItem: '55555555-5555-4555-8555-555555555555',
  order: '66666666-6666-4666-8666-666666666666',
  payment: '77777777-7777-4777-8777-777777777777',
  address: '88888888-8888-4888-8888-888888888888',
} as const;

export const FIXTURE_GUEST_SESSION_ID = 'guest-session-fixture';
export const FIXTURE_ACCESS_TOKEN = 'access-token-fixture';
export const FIXTURE_REFRESH_TOKEN = 'refresh-token-fixture';

export const tokenPairFixture: TokenPair = {
  accessToken: FIXTURE_ACCESS_TOKEN,
  refreshToken: FIXTURE_REFRESH_TOKEN,
  expiresIn: 900,
};

export const userFixture: AuthResponse['user'] = {
  id: FIXTURE_IDS.user,
  email: 'reader@example.com',
  firstName: 'Asha',
  lastName: 'Rao',
  roles: ['ROLE_CUSTOMER'],
};

export const authResponseFixture: AuthResponse = { user: userFixture, tokens: tokenPairFixture };

export const addressFixture: Address = {
  id: FIXTURE_IDS.address,
  recipientName: 'Asha Rao',
  phoneNumber: '9876543210',
  addressLine1: '12 MG Road',
  addressLine2: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const profileFixture: Profile = {
  ...userFixture,
  phoneNumber: '9876543210',
  rewardPoints: 120,
  addresses: [addressFixture],
};

export const categoriesFixture: CategoryNode[] = [
  {
    id: 1,
    name: 'Fiction',
    slug: 'fiction',
    children: [{ id: 2, name: 'Mystery', slug: 'mystery', children: [] }],
  },
];

export const bookSummaryFixture: BookSummary = {
  id: FIXTURE_IDS.book1,
  title: 'The Midnight Library',
  subtitle: null,
  author: { id: FIXTURE_IDS.author, name: 'Matt Haig' },
  format: 'PAPERBACK',
  language: 'English',
  price: 399,
  listPrice: 499,
  frontCoverUrl: 'https://example.com/covers/midnight-library.jpg',
  averageRating: 4.5,
  reviewCount: 12,
  inStock: true,
  categories: [{ id: 1, name: 'Fiction', slug: 'fiction' }],
};

export const bookSummary2Fixture: BookSummary = {
  ...bookSummaryFixture,
  id: FIXTURE_IDS.book2,
  title: 'Klara and the Sun',
  author: { id: FIXTURE_IDS.author, name: 'Kazuo Ishiguro' },
  price: 450,
  listPrice: null,
};

export const bookDetailFixture: BookDetail = {
  ...bookSummaryFixture,
  isbn: '9780525559474',
  description: 'Between life and death there is a library.',
  backCoverUrl: null,
  publisher: { id: FIXTURE_IDS.author, name: 'Canongate', description: null },
  authorBio: 'British author.',
  stockQuantity: 25,
  totalSalesCount: 300,
  publicationDate: '2020-08-13',
};

export const cartFixture: Cart = {
  id: FIXTURE_IDS.cart,
  guestSessionId: FIXTURE_GUEST_SESSION_ID,
  items: [
    {
      id: FIXTURE_IDS.cartItem,
      bookId: FIXTURE_IDS.book1,
      title: bookSummaryFixture.title,
      author: bookSummaryFixture.author.name,
      format: 'PAPERBACK',
      coverImageUrl: bookSummaryFixture.frontCoverUrl,
      unitPrice: 399,
      quantity: 1,
      lineTotal: 399,
    },
  ],
  itemCount: 1,
  subtotal: 399,
  taxAmount: 0,
  shippingFee: 40,
  totalAmount: 439,
};

export const checkoutSummaryFixture: CheckoutSummary = {
  itemCount: 1,
  subtotal: 399,
  taxAmount: 0,
  shippingFee: 40,
  discountAmount: 0,
  pointsRedeemed: 0,
  pointsDiscount: 0,
  totalAmount: 439,
  couponCode: null,
  estimatedDelivery: '2026-01-10',
};

export const paymentFixture: PaymentTransaction = {
  id: FIXTURE_IDS.payment,
  orderId: FIXTURE_IDS.order,
  gatewayOrderId: 'MOCK_ORDER_1',
  gatewayPaymentId: null,
  paymentMethod: 'CREDIT_CARD',
  amount: 439,
  currency: 'INR',
  status: 'PENDING',
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const orderFixture: Order = {
  id: FIXTURE_IDS.order,
  orderNumber: 'BW-0001',
  status: 'PAYMENT_PENDING',
  subtotalAmount: 399,
  taxAmount: 0,
  shippingFee: 40,
  discountAmount: 0,
  totalAmount: 439,
  couponCode: null,
  pointsRedeemed: 0,
  shippingAddress: addressFixture,
  estimatedDelivery: '2026-01-10',
  items: [
    {
      id: FIXTURE_IDS.cartItem,
      bookId: FIXTURE_IDS.book1,
      bookTitle: bookSummaryFixture.title,
      bookAuthor: bookSummaryFixture.author.name,
      bookFormat: 'PAPERBACK',
      coverImageUrl: bookSummaryFixture.frontCoverUrl,
      unitPrice: 399,
      quantity: 1,
      totalPrice: 399,
    },
  ],
  statusHistory: [
    { status: 'PAYMENT_PENDING', comments: null, createdAt: '2026-01-01T00:00:00.000Z' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** Builds an RFC 7807 body as returned by the backend. */
export function problemFixture(overrides: Partial<Problem> = {}): Problem {
  return {
    status: 400,
    title: 'Bad Request',
    detail: 'Validation failed',
    errors: [],
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
