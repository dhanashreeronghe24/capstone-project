import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { WishlistItem } from '@/api';
import {
  FIXTURE_IDS,
  bookSummary2Fixture,
  bookSummaryFixture,
  cartFixture,
  problemFixture,
} from '@/test/fixtures';
import { renderApp, resetSession, signInAsFixtureUser } from '@/test/render-app';
import { server } from '@/test/server';

const WISHLIST_URL = '*/api/v1/wishlist';
const REMOVE_URL = '*/api/v1/wishlist/items/:bookId';
const MOVE_URL = '*/api/v1/wishlist/move-to-cart/:bookId';
const CART_URL = '*/api/v1/cart';
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

const wishlistEntry = (id: string, book: WishlistItem['book']): WishlistItem => ({
  id,
  book,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const entry1 = wishlistEntry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', bookSummaryFixture);
const entry2 = wishlistEntry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', bookSummary2Fixture);

/** In-memory wishlist + cart count behind MSW handlers. */
function mockStatefulWishlist(initial: WishlistItem[]) {
  let entries = [...initial];
  let cartCount = 0;
  const removed: string[] = [];
  const moved: string[] = [];
  server.use(
    http.get(WISHLIST_URL, () => HttpResponse.json(entries)),
    http.get(CART_URL, () =>
      HttpResponse.json({ ...cartFixture, itemCount: cartCount }, { status: 200 }),
    ),
    http.delete(REMOVE_URL, ({ params }) => {
      removed.push(String(params.bookId));
      entries = entries.filter((e) => e.book.id !== params.bookId);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(MOVE_URL, ({ params }) => {
      moved.push(String(params.bookId));
      entries = entries.filter((e) => e.book.id !== params.bookId);
      cartCount += 1;
      return HttpResponse.json({ ...cartFixture, itemCount: cartCount });
    }),
  );
  return { removed, moved };
}

describe('wishlist page', () => {
  it('redirects guests to login and returns them after signing in', async () => {
    const { router } = renderApp('/wishlist');

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?redirect=%2Fwishlist');
  });

  it('lists the wishlisted books with details', async () => {
    mockStatefulWishlist([entry1, entry2]);
    signInAsFixtureUser();
    renderApp('/wishlist');

    expect(await screen.findByRole('heading', { level: 1, name: 'My Wishlist' })).toBeVisible();
    const row1 = await screen.findByRole('listitem', { name: BOOK1 });
    expect(within(row1).getByRole('link', { name: BOOK1 })).toHaveAttribute(
      'href',
      `/books/${FIXTURE_IDS.book1}`,
    );
    expect(within(row1).getByText('by Matt Haig')).toBeInTheDocument();
    expect(within(row1).getByText('Paperback')).toBeInTheDocument();
    expect(within(row1).getByText('₹399')).toBeInTheDocument();
    expect(within(row1).getByText('₹499')).toBeInTheDocument();
    expect(within(row1).getByText('In stock')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: BOOK2 })).toBeVisible();
  });

  it('removes a book from the wishlist', async () => {
    const { removed } = mockStatefulWishlist([entry1, entry2]);
    signInAsFixtureUser();
    const user = userEvent.setup();
    renderApp('/wishlist');

    await user.click(await screen.findByRole('button', { name: `Remove ${BOOK1} from wishlist` }));

    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: BOOK1 })).not.toBeInTheDocument(),
    );
    expect(removed).toEqual([FIXTURE_IDS.book1]);
    expect(screen.getByRole('listitem', { name: BOOK2 })).toBeVisible();
    expect(await screen.findByText(`"${BOOK1}" removed from your wishlist.`)).toBeVisible();
  });

  it('moves a book to the cart, updating both the wishlist and the header badge', async () => {
    const { moved } = mockStatefulWishlist([entry1, entry2]);
    signInAsFixtureUser();
    const user = userEvent.setup();
    renderApp('/wishlist');
    await screen.findByRole('listitem', { name: BOOK1 });
    expect(screen.queryByTestId('cart-count')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Move ${BOOK1} to cart` }));

    await waitFor(() =>
      expect(screen.queryByRole('listitem', { name: BOOK1 })).not.toBeInTheDocument(),
    );
    expect(moved).toEqual([FIXTURE_IDS.book1]);
    expect(await screen.findByTestId('cart-count')).toHaveTextContent('1');
    expect(screen.getByRole('listitem', { name: BOOK2 })).toBeVisible();
    expect(await screen.findByText(`Moved "${BOOK1}" to your cart.`)).toBeVisible();
  });

  it('shows the server message when moving to the cart fails with 422 (out of stock)', async () => {
    mockStatefulWishlist([entry1]);
    server.use(
      http.post(MOVE_URL, () =>
        problemResponse(422, 'Unprocessable Entity', `Only 0 unit(s) of "${BOOK1}" available`),
      ),
    );
    signInAsFixtureUser();
    const user = userEvent.setup();
    renderApp('/wishlist');

    await user.click(await screen.findByRole('button', { name: `Move ${BOOK1} to cart` }));

    expect(await screen.findByText(`Only 0 unit(s) of "${BOOK1}" available`)).toBeVisible();
    // the book stays on the wishlist and the row is usable again
    expect(screen.getByRole('listitem', { name: BOOK1 })).toBeVisible();
    expect(screen.getByRole('button', { name: `Move ${BOOK1} to cart` })).toBeEnabled();
    expect(screen.queryByTestId('cart-count')).not.toBeInTheDocument();
  });

  it('disables move-to-cart for out-of-stock books', async () => {
    mockStatefulWishlist([wishlistEntry(entry1.id, { ...bookSummaryFixture, inStock: false })]);
    signInAsFixtureUser();
    renderApp('/wishlist');

    expect(await screen.findByText('Out of stock')).toBeVisible();
    expect(screen.getByRole('button', { name: `Move ${BOOK1} to cart` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `Remove ${BOOK1} from wishlist` })).toBeEnabled();
  });

  it('shows the empty state', async () => {
    mockStatefulWishlist([]);
    signInAsFixtureUser();
    renderApp('/wishlist');

    expect(await screen.findByText('Your wishlist is empty')).toBeVisible();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Browse books' })).toHaveAttribute('href', '/books');
  });

  it('shows an error state that can be retried', async () => {
    let requests = 0;
    server.use(
      http.get(WISHLIST_URL, () => {
        requests += 1;
        return requests === 1
          ? problemResponse(500, 'Internal Server Error', 'boom')
          : HttpResponse.json([entry1]);
      }),
    );
    signInAsFixtureUser();
    const user = userEvent.setup();
    renderApp('/wishlist');

    expect(screen.getByRole('status', { name: 'Loading wishlist' })).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('listitem', { name: BOOK1 })).toBeVisible();
  });
});
