import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import { renderApp, resetSession, signInAsFixtureUser } from '@/test/render-app';
import { useAuthStore } from '@/stores';
import { tokenPairFixture } from '@/test/fixtures';
import { sessionTokenStorage } from '@/stores';

beforeEach(() => {
  resetSession();
});

describe('layout', () => {
  it('renders the header with logo, search, nav links, cart badge and profile', async () => {
    renderApp('/');

    expect(screen.getByRole('link', { name: 'Book Worm' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    const primaryNav = within(screen.getByRole('navigation', { name: 'Primary' }));
    expect(primaryNav.getByRole('link', { name: 'My Orders' })).toHaveAttribute('href', '/orders');
    expect(screen.getByRole('link', { name: 'My Wishlist' })).toHaveAttribute('href', '/wishlist');
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(await screen.findByTestId('cart-count')).toHaveTextContent('1');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByTestId('category-sidebar')).toBeInTheDocument();
  });

  it('submits the header search to /books?q=', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.type(screen.getByRole('searchbox', { name: 'Search books' }), 'the midnight{Enter}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/books'));
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('the midnight');
    expect(await screen.findByRole('heading', { name: 'Browse Books' })).toBeInTheDocument();
  });

  it('greets the signed-in member and offers logout instead of login', async () => {
    signInAsFixtureUser();
    renderApp('/');

    expect(await screen.findByRole('link', { name: 'Profile (Asha)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument();
  });

  it('renders a 404 page for unknown routes', async () => {
    renderApp('/no/such/page');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the bookstore' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows no sidebar on non-catalog pages', () => {
    renderApp('/login');
    expect(screen.queryByTestId('category-sidebar')).not.toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('shows a fallback instead of crashing and recovers via Try again', async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    function Bomb() {
      if (shouldThrow) throw new Error('boom');
      return <p>Recovered</p>;
    }

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});

describe('session token storage', () => {
  it('reads and rotates tokens through the auth store', () => {
    signInAsFixtureUser();
    expect(sessionTokenStorage.getAccessToken()).toBe(tokenPairFixture.accessToken);
    expect(sessionTokenStorage.getRefreshToken()).toBe(tokenPairFixture.refreshToken);

    sessionTokenStorage.setTokens({ ...tokenPairFixture, accessToken: 'rotated' });
    expect(useAuthStore.getState().tokens?.accessToken).toBe('rotated');
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('persists the session to localStorage', () => {
    signInAsFixtureUser();
    const persisted = JSON.parse(localStorage.getItem('bookworm-auth') ?? '{}') as {
      state?: { user?: { email: string }; tokens?: unknown };
    };
    expect(persisted.state?.user?.email).toBe('reader@example.com');
    expect(persisted.state?.tokens).toEqual(tokenPairFixture);
  });

  it('stores and clears the guest session id', () => {
    sessionTokenStorage.setGuestSessionId('g-1');
    expect(sessionTokenStorage.getGuestSessionId()).toBe('g-1');
    sessionTokenStorage.setGuestSessionId(null);
    expect(sessionTokenStorage.getGuestSessionId()).toBeNull();
  });
});
