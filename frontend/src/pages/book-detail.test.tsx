import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import {
  FIXTURE_IDS,
  bookDetailFixture,
  bookSummary2Fixture,
  cartFixture,
  problemFixture,
} from '@/test/fixtures';
import { renderApp, resetSession, signInAsFixtureUser } from '@/test/render-app';
import { server } from '@/test/server';

const PDP = `/books/${bookDetailFixture.id}`;
const REVIEWS_URL = '*/api/v1/catalog/books/:id/reviews';

beforeEach(() => {
  resetSession();
});

const problemResponse = (status: number, title: string, detail: string) =>
  HttpResponse.json(problemFixture({ status, title, detail }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

const reviewOf = (n: number) => ({
  id: `99999999-9999-4999-8999-99999999999${n}`,
  bookId: bookDetailFixture.id,
  rating: 4,
  reviewerName: `Reviewer ${n}`,
  comment: `Comment ${n}`,
  isVerifiedPurchase: false,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('product detail page', () => {
  it('renders the book details, stats, author and breadcrumb', async () => {
    server.use(
      http.get('*/api/v1/catalog/books/:id', () =>
        HttpResponse.json({ ...bookDetailFixture, backCoverUrl: 'https://example.com/back.jpg' }),
      ),
      http.get('*/api/v1/authors/:id', () =>
        HttpResponse.json({
          id: FIXTURE_IDS.author,
          name: 'Matt Haig',
          bio: 'Matt writes novels about hope.',
          avatarUrl: 'https://example.com/matt.jpg',
          books: [],
        }),
      ),
    );
    renderApp(PDP);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Midnight Library' }),
    ).toBeVisible();
    expect(screen.getByRole('img', { name: 'Front cover of The Midnight Library' })).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Back cover of The Midnight Library' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Matt Haig' })).toHaveAttribute(
      'href',
      '/books?q=Matt%20Haig',
    );
    expect(screen.getByText('Published by Canongate')).toBeInTheDocument();
    expect(screen.getByText('Paperback')).toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Book details' });
    expect(within(details).getByRole('link', { name: 'Fiction' })).toHaveAttribute(
      'href',
      '/books?category=fiction',
    );
    expect(screen.getByLabelText('Price')).toHaveTextContent('₹399');
    expect(screen.getByLabelText('List price')).toHaveTextContent('₹499');
    expect(screen.getByText('In stock')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('12 reviews')).toBeInTheDocument();
    expect(screen.getByText('300 copies sold')).toBeInTheDocument();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(breadcrumb).getByRole('link', { name: 'Fiction' })).toBeVisible();

    const writer = await screen.findByRole('region', { name: 'About the writer' });
    expect(await within(writer).findByText('Matt writes novels about hope.')).toBeVisible();
    expect(within(writer).getByRole('img', { name: 'Photo of Matt Haig' })).toBeVisible();
  });

  it('adds the selected quantity to the cart', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post('*/api/v1/cart/items', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(cartFixture, { status: 201 });
      }),
    );
    renderApp(PDP);

    await screen.findByRole('heading', { level: 1, name: 'The Midnight Library' });
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByLabelText('Quantity')).toHaveValue(3);
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(await screen.findByText('Added "The Midnight Library" to your cart.')).toBeVisible();
    expect(body).toEqual({ bookId: bookDetailFixture.id, quantity: 3 });
  });

  it('caps the quantity at the available stock', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/v1/catalog/books/:id', () =>
        HttpResponse.json({ ...bookDetailFixture, stockQuantity: 2 }),
      ),
    );
    renderApp(PDP);

    expect(await screen.findByText('Only 2 left in stock')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByLabelText('Quantity')).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('disables purchase controls when the book is out of stock', async () => {
    server.use(
      http.get('*/api/v1/catalog/books/:id', () =>
        HttpResponse.json({ ...bookDetailFixture, inStock: false, stockQuantity: 0 }),
      ),
    );
    renderApp(PDP);

    expect(await screen.findByText('Out of stock', { selector: 'p' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(screen.getByLabelText('Quantity')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('prompts guests to log in instead of calling the wishlist API', async () => {
    const user = userEvent.setup();
    let wishlistCalls = 0;
    server.use(
      http.post('*/api/v1/wishlist/items', () => {
        wishlistCalls += 1;
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const { router } = renderApp(PDP);

    await user.click(await screen.findByRole('button', { name: /Add to Wishlist/ }));

    expect(await screen.findByText('Please log in to save books to your wishlist.')).toBeVisible();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe(PDP);
    expect(wishlistCalls).toBe(0);
  });

  it('lets members add the book to their wishlist', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    let added: unknown;
    server.use(
      http.get('*/api/v1/wishlist', () => HttpResponse.json([])),
      http.post('*/api/v1/wishlist/items', async ({ request }) => {
        added = await request.json();
        return HttpResponse.json({}, { status: 201 });
      }),
    );
    renderApp(PDP);

    await user.click(await screen.findByRole('button', { name: /Add to Wishlist/ }));

    expect(await screen.findByText('"The Midnight Library" added to your wishlist.')).toBeVisible();
    expect(added).toEqual({ bookId: bookDetailFixture.id });
  });

  it('lists related reads on the right', async () => {
    renderApp(PDP);

    const panel = await screen.findByRole('complementary', { name: 'Related Reads' });
    const article = await within(panel).findByRole('article', { name: 'Klara and the Sun' });
    expect(within(article).getByRole('link', { name: 'Klara and the Sun' })).toHaveAttribute(
      'href',
      `/books/${bookSummary2Fixture.id}`,
    );
    expect(within(article).getByText('₹450')).toBeInTheDocument();
  });

  it('shows a not-found state for an unknown book', async () => {
    renderApp('/books/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    expect(await screen.findByRole('heading', { name: 'Book not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse all books' })).toHaveAttribute(
      'href',
      '/books',
    );
  });

  it('shows a not-found state for an invalid id without calling the API', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/catalog/books/:id', () => {
        calls += 1;
        return problemResponse(400, 'Bad Request', 'Invalid id');
      }),
    );
    renderApp('/books/not-a-uuid');

    expect(await screen.findByRole('heading', { name: 'Book not found' })).toBeVisible();
    expect(screen.getByText('This book link is not valid.')).toBeVisible();
    expect(calls).toBe(0);
  });

  it('shows an error with retry when the book fails to load', async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get('*/api/v1/catalog/books/:id', () =>
        fail
          ? problemResponse(500, 'Internal Server Error', 'boom')
          : HttpResponse.json(bookDetailFixture),
      ),
    );
    renderApp(PDP);

    // The book query retries once (with backoff) on server errors before failing.
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Something went wrong',
    );
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Midnight Library' }),
    ).toBeVisible();
  });
});

describe('reviews', () => {
  it('lists reviews and paginates them', async () => {
    const user = userEvent.setup();
    const requestedPages: string[] = [];
    server.use(
      http.get(REVIEWS_URL, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        requestedPages.push(String(page));
        return HttpResponse.json({
          data: [reviewOf(page)],
          pagination: { page, limit: 5, total: 2, totalPages: 2 },
          averageRating: 4,
          reviewCount: 2,
        });
      }),
    );
    renderApp(PDP);

    const section = await screen.findByRole('region', { name: 'Reviews' });
    expect(await within(section).findByText('Reviewer 1')).toBeVisible();
    expect(within(section).getByText('Comment 1')).toBeVisible();
    expect(within(section).getByText('4.0 average from 2 reviews')).toBeVisible();

    await user.click(within(section).getByRole('button', { name: 'Next' }));
    expect(await within(section).findByText('Reviewer 2')).toBeVisible();
    expect(requestedPages).toEqual(['1', '2']);
  });

  it('shows an empty state when there are no reviews', async () => {
    server.use(
      http.get(REVIEWS_URL, () =>
        HttpResponse.json({
          data: [],
          pagination: { page: 1, limit: 5, total: 0, totalPages: 0 },
          averageRating: 0,
          reviewCount: 0,
        }),
      ),
    );
    renderApp(PDP);

    expect(await screen.findByText('No reviews yet. Be the first to review!')).toBeVisible();
  });

  it('lets a member submit a review', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    let body: unknown;
    server.use(
      http.post(REVIEWS_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...reviewOf(1), ...(body as object) }, { status: 201 });
      }),
    );
    renderApp(PDP);

    await screen.findByRole('heading', { level: 1, name: 'The Midnight Library' });
    await user.click(screen.getByLabelText('4 stars'));
    await user.type(screen.getByLabelText('Leave your review'), '  Beautiful read  ');
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Thanks! Your review has been posted.')).toBeVisible();
    expect(body).toEqual({ rating: 4, comment: 'Beautiful read' });
    await waitFor(() => expect(screen.getByLabelText('Leave your review')).toHaveValue(''));
  });

  it('requires a rating before submitting', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    let calls = 0;
    server.use(
      http.post(REVIEWS_URL, () => {
        calls += 1;
        return new HttpResponse(null, { status: 201 });
      }),
    );
    renderApp(PDP);

    await user.click(await screen.findByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText('Select a rating')).toBeVisible();
    expect(calls).toBe(0);
  });

  it.each([
    [403, 'Forbidden', 'Only verified buyers can review this book'],
    [409, 'Conflict', 'You have already reviewed this book'],
    [422, 'Unprocessable Entity', 'Reviews are closed for this book'],
  ])('shows the server message for a %i response', async (status, title, detail) => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    server.use(http.post(REVIEWS_URL, () => problemResponse(status, title, detail)));
    renderApp(PDP);

    await screen.findByRole('heading', { level: 1, name: 'The Midnight Library' });
    await user.click(screen.getByLabelText('5 stars'));
    await user.click(screen.getByRole('button', { name: 'Submit review' }));

    expect(await screen.findByText(detail, { selector: 'p[role="alert"]' })).toBeVisible();
  });

  it('prompts guests to log in to review', async () => {
    renderApp(PDP);

    const section = await screen.findByRole('region', { name: 'Reviews' });
    const link = within(section).getByRole('link', { name: 'Log in' });
    expect(link).toHaveAttribute('href', `/login?redirect=${encodeURIComponent(PDP)}`);
    expect(screen.queryByRole('button', { name: 'Submit review' })).not.toBeInTheDocument();
  });
});
