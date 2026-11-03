import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { useGuestSessionStore } from '@/stores';
import {
  FIXTURE_GUEST_SESSION_ID,
  FIXTURE_IDS,
  bookSummary2Fixture,
  bookSummaryFixture,
  cartFixture,
} from '@/test/fixtures';
import { renderApp, resetSession, signInAsFixtureUser } from '@/test/render-app';
import { server } from '@/test/server';
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  parseBookFilters,
  toSearchParams,
} from '@/utils/book-filters';

const BOOKS_URL = '*/api/v1/catalog/books';

beforeEach(() => {
  resetSession();
});

const pageOf = (data: unknown[], page = 1, totalPages = 1, total = data.length) => ({
  data,
  pagination: { page, limit: 12, total, totalPages },
});

/** Records the query string of every `GET /catalog/books` call. */
function recordBookSearches(respond: (params: URLSearchParams) => JsonBodyType) {
  const searches: URLSearchParams[] = [];
  server.use(
    http.get(BOOKS_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      searches.push(params);
      return HttpResponse.json(respond(params));
    }),
  );
  return searches;
}

const currentSearch = (router: { state: { location: { search: string } } }) =>
  new URLSearchParams(router.state.location.search);

describe('home page', () => {
  it('renders Recommended, Bestsellers and New Launches from /catalog/featured', async () => {
    renderApp('/');

    const recommended = await screen.findByRole('region', { name: 'Recommended for You' });
    const bestsellers = screen.getByRole('region', { name: 'Bestsellers this Month' });
    const launches = screen.getByRole('region', { name: 'New Launches' });

    await within(recommended).findByRole('heading', { name: 'The Midnight Library' });
    expect(within(bestsellers).getByRole('heading', { name: 'Klara and the Sun' })).toBeVisible();
    expect(within(launches).getAllByRole('article')).toHaveLength(2);
    expect(within(recommended).getByText('by Matt Haig')).toBeInTheDocument();
    expect(within(recommended).getByText('₹399')).toBeInTheDocument();
    expect(within(recommended).getByText('₹499')).toBeInTheDocument();
    expect(within(recommended).getByRole('link', { name: 'Fiction' })).toHaveAttribute(
      'href',
      '/books?category=fiction',
    );
  });

  it('shows skeletons while loading and an error state with retry on failure', async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get('*/api/v1/catalog/featured', () =>
        fail
          ? HttpResponse.json(
              { status: 500, title: 'Server Error', detail: 'x', errors: [], timestamp: 't' },
              { status: 500, headers: { 'content-type': 'application/problem+json' } },
            )
          : HttpResponse.json({
              recommended: [bookSummaryFixture],
              bestsellers: [],
              newLaunches: [],
            }),
      ),
    );
    renderApp('/');

    expect(screen.getByRole('status', { name: 'Loading Recommended for You' })).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');

    fail = false;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'The Midnight Library' })).toBeVisible();
    expect(screen.getAllByText('No bestsellers yet.')).toHaveLength(1);
  });
});

describe('category sidebar', () => {
  it('shows All plus the hierarchical categories and links to /books?category=', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Category navigation' });
    expect(within(nav).getByRole('link', { name: 'All' })).toHaveAttribute('href', '/books');
    expect(await within(nav).findByRole('link', { name: 'Fiction' })).toBeVisible();
    const mystery = within(nav).getByRole('link', { name: 'Mystery' });
    expect(mystery.closest('ul')?.closest('li')).toHaveTextContent('Fiction');

    const searches = recordBookSearches(() => pageOf([bookSummary2Fixture]));
    await user.click(mystery);

    await waitFor(() => expect(currentSearch(router).get('category')).toBe('mystery'));
    expect(router.state.location.pathname).toBe('/books');
    await waitFor(() => expect(searches.at(-1)?.get('category')).toBe('mystery'));
    expect(await screen.findByRole('heading', { name: 'Klara and the Sun' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mystery' })).toHaveAttribute('aria-current', 'true');
  });

  it('shows an error state when categories fail to load', async () => {
    server.use(
      http.get('*/api/v1/categories', () =>
        HttpResponse.json(
          { status: 404, title: 'Not Found', detail: 'Categories unavailable', errors: [] },
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderApp('/books');

    const sidebar = await screen.findByTestId('category-sidebar');
    expect(await within(sidebar).findByRole('alert')).toHaveTextContent('Categories unavailable');
  });
});

describe('browse page', () => {
  it('requests books with every filter parsed from the URL', async () => {
    const searches = recordBookSearches(() => pageOf([bookSummaryFixture]));
    renderApp(
      '/books?q=night&category=fiction&minPrice=100&maxPrice=500&format=HARDCOVER&language=English&sort=price_asc&page=2&limit=24',
    );

    await screen.findByRole('heading', { name: 'The Midnight Library' });
    const params = Object.fromEntries(searches.at(-1) ?? []);
    expect(params).toEqual({
      q: 'night',
      category: 'fiction',
      minPrice: '100',
      maxPrice: '500',
      format: 'HARDCOVER',
      language: 'English',
      sort: 'price_asc',
      page: '2',
      limit: '24',
    });
    expect(screen.getByRole('combobox', { name: 'Format' })).toHaveValue('HARDCOVER');
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('price_asc');
  });

  it('updates the URL and the results when filters change', async () => {
    const user = userEvent.setup();
    const searches = recordBookSearches((params) =>
      params.get('format') === 'HARDCOVER'
        ? pageOf([bookSummary2Fixture])
        : pageOf([bookSummaryFixture, bookSummary2Fixture]),
    );
    const { router } = renderApp('/books');

    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('2 books found')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Format' }), 'HARDCOVER');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(currentSearch(router).get('format')).toBe('HARDCOVER');
    expect(screen.getByRole('heading', { name: 'Klara and the Sun' })).toBeVisible();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'Hindi');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'price_desc');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'mystery');
    await user.type(screen.getByLabelText('Min price (₹)'), '100');
    await user.type(screen.getByLabelText('Max price (₹)'), '600');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(currentSearch(router).get('maxPrice')).toBe('600'));
    expect(Object.fromEntries(currentSearch(router))).toEqual({
      format: 'HARDCOVER',
      language: 'Hindi',
      sort: 'price_desc',
      category: 'mystery',
      minPrice: '100',
      maxPrice: '600',
    });
    await waitFor(() =>
      expect(Object.fromEntries(searches.at(-1) ?? [])).toMatchObject({
        format: 'HARDCOVER',
        language: 'Hindi',
        sort: 'price_desc',
        category: 'mystery',
        minPrice: '100',
        maxPrice: '600',
        page: '1',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.getByLabelText('Min price (₹)')).toHaveValue(null);
  });

  it('rejects a min price above the max price', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/books');
    await screen.findAllByRole('article');

    await user.type(screen.getByLabelText('Min price (₹)'), '900');
    await user.type(screen.getByLabelText('Max price (₹)'), '100');

    expect(screen.getByRole('alert')).toHaveTextContent('Min price must not exceed max price.');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(router.state.location.search).toBe('');
  });

  it('paginates through the URL page param and resets to page 1 on filter change', async () => {
    const user = userEvent.setup();
    const searches = recordBookSearches((params) => {
      const page = Number(params.get('page') ?? '1');
      return pageOf([page === 2 ? bookSummary2Fixture : bookSummaryFixture], page, 3, 30);
    });
    const { router } = renderApp('/books');

    const pager = await screen.findByRole('navigation', { name: 'Pagination' });
    expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(within(pager).getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(pager).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(currentSearch(router).get('page')).toBe('2'));
    expect(await screen.findByRole('heading', { name: 'Klara and the Sun' })).toBeVisible();
    expect(searches.at(-1)?.get('page')).toBe('2');

    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    await waitFor(() => expect(currentSearch(router).get('page')).toBe('3'));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'rating');
    await waitFor(() => expect(currentSearch(router).get('sort')).toBe('rating'));
    expect(currentSearch(router).has('page')).toBe(false);
  });

  it('shows an empty state with a way to clear filters', async () => {
    const user = userEvent.setup();
    recordBookSearches((params) =>
      params.get('q') ? pageOf([], 1, 0, 0) : pageOf([bookSummaryFixture]),
    );
    const { router } = renderApp('/books?q=zzz');

    expect(await screen.findByText('No books found')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByRole('heading', { name: 'The Midnight Library' })).toBeVisible();
  });

  it('shows an error state and recovers on retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get(BOOKS_URL, () =>
        fail
          ? HttpResponse.json(
              { status: 400, title: 'Bad Request', detail: 'Invalid price range', errors: [] },
              { status: 400, headers: { 'content-type': 'application/problem+json' } },
            )
          : HttpResponse.json(pageOf([bookSummaryFixture])),
      ),
    );
    renderApp('/books');

    const results = await screen.findByText('Invalid price range');
    fail = false;
    await user.click(within(results.closest('[role="alert"]') as HTMLElement).getByRole('button'));

    expect(await screen.findByRole('heading', { name: 'The Midnight Library' })).toBeVisible();
  });
});

describe('header search sync', () => {
  it('reflects ?q= in the header input and follows URL changes', async () => {
    const { router } = renderApp('/books?q=first');
    const input = screen.getByRole('searchbox', { name: 'Search books' });
    expect(input).toHaveValue('first');

    await act(() => router.navigate('/books?q=second'));
    await waitFor(() => expect(input).toHaveValue('second'));

    await act(() => router.navigate('/books'));
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('searching keeps other filters out and drives the browse results', async () => {
    const user = userEvent.setup();
    const searches = recordBookSearches(() => pageOf([bookSummaryFixture]));
    const { router } = renderApp('/');

    await user.type(screen.getByRole('searchbox', { name: 'Search books' }), 'haig{Enter}');

    await waitFor(() => expect(searches.at(-1)?.get('q')).toBe('haig'));
    expect(router.state.location.pathname).toBe('/books');
    expect(await screen.findByText(/Results for “haig”/)).toBeVisible();
  });
});

describe('card actions', () => {
  it('adds to cart as a guest, stores the guest session and refreshes the header badge', async () => {
    const user = userEvent.setup();
    let itemCount = 0;
    const added: unknown[] = [];
    server.use(
      http.get('*/api/v1/cart', () =>
        HttpResponse.json(
          { ...cartFixture, itemCount },
          { headers: { 'x-guest-session-id': FIXTURE_GUEST_SESSION_ID } },
        ),
      ),
      http.post('*/api/v1/cart/items', async ({ request }) => {
        added.push(await request.json());
        itemCount = 1;
        return HttpResponse.json(
          { ...cartFixture, itemCount },
          { status: 201, headers: { 'x-guest-session-id': FIXTURE_GUEST_SESSION_ID } },
        );
      }),
    );
    renderApp('/');
    const recommended = await screen.findByRole('region', { name: 'Recommended for You' });
    expect(screen.queryByTestId('cart-count')).not.toBeInTheDocument();

    await user.click(
      await within(recommended).findByRole('button', {
        name: 'Add The Midnight Library to cart',
      }),
    );

    expect(await screen.findByTestId('cart-count')).toHaveTextContent('1');
    expect(added).toEqual([{ bookId: FIXTURE_IDS.book1, quantity: 1 }]);
    expect(useGuestSessionStore.getState().guestSessionId).toBe(FIXTURE_GUEST_SESSION_ID);
    expect(await screen.findByText('Added "The Midnight Library" to your cart.')).toBeVisible();
  });

  it('disables add to cart for out-of-stock books', async () => {
    recordBookSearches(() => pageOf([{ ...bookSummaryFixture, inStock: false }]));
    renderApp('/books');

    expect(
      await screen.findByRole('button', { name: 'Add The Midnight Library to cart' }),
    ).toBeDisabled();
  });

  it('shows the server message when add to cart fails', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/cart/items', () =>
        HttpResponse.json(
          { status: 422, title: 'Unprocessable', detail: 'Only 0 copies left', errors: [] },
          { status: 422, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderApp('/books');

    await user.click(await screen.findByRole('button', { name: 'Add Klara and the Sun to cart' }));

    expect(await screen.findByText('Only 0 copies left')).toBeVisible();
  });

  it('prompts guests to log in instead of calling the wishlist API', async () => {
    const user = userEvent.setup();
    let wishlistCalls = 0;
    server.use(
      http.post('*/api/v1/wishlist/items', () => {
        wishlistCalls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { router } = renderApp('/books?q=night');

    await user.click(
      await screen.findByRole('button', { name: 'Add The Midnight Library to wishlist' }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(currentSearch(router).get('redirect')).toBe('/books?q=night');
    expect(await screen.findByText('Please log in to save books to your wishlist.')).toBeVisible();
    expect(wishlistCalls).toBe(0);
  });

  it('lets members toggle the wishlist and reflects the state on the card', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    let wishlisted: string[] = [];
    const wishlistItem = (bookId: string) => ({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      book: bookId === FIXTURE_IDS.book1 ? bookSummaryFixture : bookSummary2Fixture,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    server.use(
      http.get('*/api/v1/wishlist', () => HttpResponse.json(wishlisted.map(wishlistItem))),
      http.post('*/api/v1/wishlist/items', async ({ request }) => {
        const { bookId } = (await request.json()) as { bookId: string };
        wishlisted = [...wishlisted, bookId];
        return HttpResponse.json(wishlistItem(bookId), { status: 201 });
      }),
      http.delete('*/api/v1/wishlist/items/:bookId', ({ params }) => {
        wishlisted = wishlisted.filter((id) => id !== params.bookId);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/books');

    await user.click(
      await screen.findByRole('button', { name: 'Add The Midnight Library to wishlist' }),
    );
    const remove = await screen.findByRole('button', {
      name: 'Remove The Midnight Library from wishlist',
    });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    expect(wishlisted).toEqual([FIXTURE_IDS.book1]);

    await user.click(remove);
    expect(
      await screen.findByRole('button', { name: 'Add The Midnight Library to wishlist' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(wishlisted).toEqual([]);
  });
});

describe('book filter helpers', () => {
  it('drops invalid values and clamps the page size', () => {
    const filters = parseBookFilters(
      new URLSearchParams(
        'format=PDF&sort=bogus&page=0&limit=500&minPrice=-5&maxPrice=abc&q=%20%20&category=x',
      ),
    );
    expect(filters).toEqual({
      ...DEFAULT_FILTERS,
      q: undefined,
      category: 'x',
      format: undefined,
      language: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      limit: 100,
    });
  });

  it('round-trips filters and omits defaults', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    const filters = parseBookFilters(new URLSearchParams('q=a&sort=rating&page=3&minPrice=0'));
    expect(toSearchParams(filters).toString()).toBe('q=a&minPrice=0&sort=rating&page=3');
    expect(hasActiveFilters(filters)).toBe(true);
  });
});
