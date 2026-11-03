import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { Cart, CartItem } from '@/api';
import {
  FIXTURE_GUEST_SESSION_ID,
  FIXTURE_IDS,
  bookSummary2Fixture,
  bookSummaryFixture,
  cartFixture,
  problemFixture,
} from '@/test/fixtures';
import { renderApp, resetSession, signInAsFixtureUser } from '@/test/render-app';
import { server } from '@/test/server';
import { useGuestSessionStore } from '@/stores';

const CART_URL = '*/api/v1/cart';
const ITEM_URL = '*/api/v1/cart/items/:itemId';
const BOOK1 = bookSummaryFixture.title;
const BOOK2 = bookSummary2Fixture.title;

beforeEach(() => {
  resetSession();
});

const problemResponse = (status: number, title: string, detail: string) =>
  HttpResponse.json(problemFixture({ status, title, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

const item1: CartItem = { ...cartFixture.items[0]! };
const item2: CartItem = {
  id: '55555555-5555-4555-8555-555555555556',
  bookId: FIXTURE_IDS.book2,
  title: BOOK2,
  author: bookSummary2Fixture.author.name,
  format: 'PAPERBACK',
  coverImageUrl: bookSummary2Fixture.frontCoverUrl,
  unitPrice: 450,
  quantity: 1,
  lineTotal: 450,
};

function buildCart(items: CartItem[]): Cart {
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return {
    ...cartFixture,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    totalAmount: subtotal,
    shippingFee: 0,
    taxAmount: 0,
  };
}

interface RecordedCall {
  method: string;
  path: string;
  body?: unknown;
}

/** In-memory cart behind MSW handlers; records mutating calls. */
function mockStatefulCart(initial: CartItem[]) {
  let items = initial.map((i) => ({ ...i }));
  const calls: RecordedCall[] = [];
  const guestHeaders = { 'x-guest-session-id': FIXTURE_GUEST_SESSION_ID };
  const respond = (status = 200) =>
    HttpResponse.json(buildCart(items), { status, headers: guestHeaders });

  server.use(
    http.get(CART_URL, () => respond()),
    http.post(`${CART_URL}/items`, async ({ request }) => {
      const body = (await request.json()) as { bookId: string; quantity?: number };
      calls.push({ method: 'POST', path: '/cart/items', body });
      const quantity = body.quantity ?? 1;
      const existing = items.find((i) => i.bookId === body.bookId);
      if (existing) {
        existing.quantity += quantity;
        existing.lineTotal = existing.unitPrice * existing.quantity;
      } else {
        const source = body.bookId === FIXTURE_IDS.book2 ? item2 : item1;
        items.push({ ...source, quantity, lineTotal: source.unitPrice * quantity });
      }
      return respond(201);
    }),
    http.put(ITEM_URL, async ({ request, params }) => {
      const body = (await request.json()) as { quantity: number };
      calls.push({ method: 'PUT', path: `/cart/items/${String(params.itemId)}`, body });
      const line = items.find((i) => i.id === params.itemId);
      if (!line) return problemResponse(404, 'Not Found', 'Cart item not found');
      line.quantity = body.quantity;
      line.lineTotal = line.unitPrice * body.quantity;
      return respond();
    }),
    http.delete(ITEM_URL, ({ params }) => {
      calls.push({ method: 'DELETE', path: `/cart/items/${String(params.itemId)}` });
      items = items.filter((i) => i.id !== params.itemId);
      return respond();
    }),
  );
  return { calls };
}

const emptyCart = () => server.use(http.get(CART_URL, () => HttpResponse.json(buildCart([]))));

describe('cart page', () => {
  it('lists items with all details, the subtotal and the item count (guest)', async () => {
    mockStatefulCart([item1, { ...item2, quantity: 2, lineTotal: 900 }]);
    renderApp('/cart');

    expect(await screen.findByRole('heading', { level: 1, name: 'Shopping Cart' })).toBeVisible();
    const row1 = await screen.findByRole('listitem', { name: BOOK1 });
    expect(within(row1).getByRole('link', { name: BOOK1 })).toHaveAttribute(
      'href',
      `/books/${FIXTURE_IDS.book1}`,
    );
    expect(within(row1).getByText('by Matt Haig')).toBeInTheDocument();
    expect(within(row1).getByText('Paperback')).toBeInTheDocument();
    expect(row1).toHaveTextContent('Unit price ₹399 each');
    // decorative cover (empty alt => presentation role); the title link names the item
    expect(row1.querySelector('img')).toHaveAttribute('src', bookSummaryFixture.frontCoverUrl);
    expect(screen.getByTestId(`line-total-${item1.id}`)).toHaveTextContent('₹399');

    expect(screen.getByTestId(`line-total-${item2.id}`)).toHaveTextContent('₹900');
    expect(screen.getByTestId('summary-item-count')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹1,299');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('3');
  });

  it('shows the empty state with a link to browse', async () => {
    emptyCart();
    renderApp('/cart');

    expect(await screen.findByText('Your cart is empty')).toBeVisible();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Browse books' })).toHaveAttribute('href', '/books');
    expect(screen.queryByRole('button', { name: 'Proceed to Checkout' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-count')).not.toBeInTheDocument();
  });

  it('shows a loading state, then an error state that can be retried', async () => {
    let requests = 0;
    server.use(
      http.get(CART_URL, () => {
        requests += 1;
        return requests === 1
          ? problemResponse(500, 'Internal Server Error', 'boom')
          : HttpResponse.json(buildCart([item1]));
      }),
    );
    const user = userEvent.setup();
    renderApp('/cart');

    expect(screen.getByRole('status', { name: 'Loading cart' })).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('listitem', { name: BOOK1 })).toBeVisible();
  });

  it('guest: adds a book from the catalogue, then updates the quantity and removes it', async () => {
    const { calls } = mockStatefulCart([]);
    const user = userEvent.setup();
    const { router } = renderApp('/books');

    await user.click(await screen.findByRole('button', { name: `Add ${BOOK1} to cart` }));
    expect(await screen.findByTestId('cart-count')).toHaveTextContent('1');
    await user.click(await screen.findByRole('button', { name: `Add ${BOOK2} to cart` }));
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('2'));
    expect(useGuestSessionStore.getState().guestSessionId).toBe(FIXTURE_GUEST_SESSION_ID);

    await user.click(screen.getByRole('link', { name: /^Cart/ }));
    expect(router.state.location.pathname).toBe('/cart');
    expect(await screen.findByRole('listitem', { name: BOOK1 })).toBeVisible();
    expect(screen.getByRole('listitem', { name: BOOK2 })).toBeVisible();
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹849');

    // update quantity
    await user.click(screen.getByRole('button', { name: `Increase quantity of ${BOOK1}` }));
    await waitFor(() =>
      expect(screen.getByTestId(`line-total-${item1.id}`)).toHaveTextContent('₹798'),
    );
    expect(calls).toContainEqual({
      method: 'PUT',
      path: `/cart/items/${item1.id}`,
      body: { quantity: 2 },
    });
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('3'));
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹1,248');

    await user.click(screen.getByRole('button', { name: `Decrease quantity of ${BOOK1}` }));
    await waitFor(() =>
      expect(screen.getByTestId(`line-total-${item1.id}`)).toHaveTextContent('₹399'),
    );
    // quantity 1 cannot be decreased further (use Remove)
    expect(screen.getByRole('button', { name: `Decrease quantity of ${BOOK1}` })).toBeDisabled();

    // remove
    await user.click(screen.getByRole('button', { name: `Remove ${BOOK1} from cart` }));
    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: BOOK1 })).not.toBeInTheDocument(),
    );
    expect(calls).toContainEqual({ method: 'DELETE', path: `/cart/items/${item1.id}` });
    expect(screen.getByRole('listitem', { name: BOOK2 })).toBeVisible();
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹450');
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('1'));

    // removing the last line leads to the empty state
    await user.click(screen.getByRole('button', { name: `Remove ${BOOK2} from cart` }));
    expect(await screen.findByText('Your cart is empty')).toBeVisible();
  });

  it('applies updates optimistically and rolls back with a message when the server rejects', async () => {
    mockStatefulCart([item1, item2]);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put(ITEM_URL, async () => {
        await gate;
        return problemResponse(409, 'Conflict', 'The cart was changed in another session');
      }),
    );
    const user = userEvent.setup();
    renderApp('/cart');
    await screen.findByRole('listitem', { name: BOOK1 });

    await user.click(screen.getByRole('button', { name: `Increase quantity of ${BOOK1}` }));

    // optimistic state while the request is still pending
    expect(await screen.findByLabelText(`Quantity of ${BOOK1}: 2`)).toBeVisible();
    expect(screen.getByTestId(`line-total-${item1.id}`)).toHaveTextContent('₹798');
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹1,248');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('3');

    await act(async () => {
      release();
      await gate;
    });

    expect(await screen.findByLabelText(`Quantity of ${BOOK1}: 1`)).toBeVisible();
    expect(screen.getByTestId(`line-total-${item1.id}`)).toHaveTextContent('₹399');
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹849');
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('2'));
    expect(await screen.findByText('The cart was changed in another session')).toBeVisible();
    expect(screen.getByRole('button', { name: `Increase quantity of ${BOOK1}` })).toBeEnabled();
  });

  it('rolls back an optimistic removal when it fails', async () => {
    mockStatefulCart([item1, item2]);
    server.use(
      http.delete(ITEM_URL, () =>
        problemResponse(409, 'Conflict', 'Could not remove this item right now'),
      ),
    );
    const user = userEvent.setup();
    renderApp('/cart');
    await screen.findByRole('listitem', { name: BOOK2 });

    await user.click(screen.getByRole('button', { name: `Remove ${BOOK2} from cart` }));

    expect(await screen.findByText('Could not remove this item right now')).toBeVisible();
    expect(screen.getByRole('listitem', { name: BOOK2 })).toBeVisible();
    expect(screen.getByTestId('summary-subtotal')).toHaveTextContent('₹849');
  });

  it('shows the stock message when the requested quantity is not available (422)', async () => {
    mockStatefulCart([item1]);
    server.use(
      http.put(ITEM_URL, () =>
        problemResponse(422, 'Unprocessable Entity', `Only 1 unit(s) of "${BOOK1}" available`),
      ),
    );
    const user = userEvent.setup();
    renderApp('/cart');
    await screen.findByRole('listitem', { name: BOOK1 });

    await user.click(screen.getByRole('button', { name: `Increase quantity of ${BOOK1}` }));

    expect(await screen.findByText(`Only 1 unit(s) of "${BOOK1}" available`)).toBeVisible();
    expect(screen.getByLabelText(`Quantity of ${BOOK1}: 1`)).toBeVisible();
    expect(screen.getByTestId(`line-total-${item1.id}`)).toHaveTextContent('₹399');
  });

  it('explains a 404 when the item is no longer in the cart', async () => {
    mockStatefulCart([item1]);
    server.use(http.put(ITEM_URL, () => problemResponse(404, 'Not Found', 'Cart item not found')));
    const user = userEvent.setup();
    renderApp('/cart');
    await screen.findByRole('listitem', { name: BOOK1 });

    await user.click(screen.getByRole('button', { name: `Increase quantity of ${BOOK1}` }));

    expect(await screen.findByText('This item is no longer in your cart.')).toBeVisible();
  });

  it('guest: Proceed to Checkout goes to login with a redirect back to /checkout', async () => {
    mockStatefulCart([item1]);
    const user = userEvent.setup();
    const { router } = renderApp('/cart');

    await user.click(await screen.findByRole('button', { name: 'Proceed to Checkout' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?redirect=%2Fcheckout');
  });

  it('member: Proceed to Checkout goes straight to /checkout', async () => {
    mockStatefulCart([item1]);
    signInAsFixtureUser();
    const user = userEvent.setup();
    const { router } = renderApp('/cart');

    await user.click(await screen.findByRole('button', { name: 'Proceed to Checkout' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/checkout'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  });
});
