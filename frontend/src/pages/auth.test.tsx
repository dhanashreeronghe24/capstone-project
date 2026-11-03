import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useAuthStore, useGuestSessionStore, sessionTokenStorage } from '@/stores';
import {
  FIXTURE_GUEST_SESSION_ID,
  cartFixture,
  problemFixture,
  tokenPairFixture,
} from '@/test/fixtures';
import { renderApp, resetSession, signInAsFixtureUser } from '@/test/render-app';
import { server } from '@/test/server';

const problemHeaders = { 'content-type': 'application/problem+json' };

beforeEach(() => {
  resetSession();
});

describe('login', () => {
  it('shows client-side validation errors', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logs in, stores the session, merges the guest cart and returns to the redirect target', async () => {
    const user = userEvent.setup();
    useGuestSessionStore.getState().setGuestSessionId('guest-abc');
    const merges: unknown[] = [];
    let mergeAuthHeader: string | null = null;
    server.use(
      http.post('*/api/v1/cart/merge', async ({ request }) => {
        merges.push(await request.json());
        mergeAuthHeader = request.headers.get('authorization');
        return HttpResponse.json(cartFixture);
      }),
      // No guest header echoed, so the guest id is only cleared by the merge success.
      http.get('*/api/v1/cart', () => HttpResponse.json(cartFixture)),
    );
    const { router } = renderApp('/login?redirect=%2Forders');

    await user.type(screen.getByLabelText('Email'), 'reader@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'My Orders' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/orders');
    expect(useAuthStore.getState().user?.email).toBe('reader@example.com');
    expect(useAuthStore.getState().tokens).toEqual(tokenPairFixture);
    expect(merges).toEqual([{ guestSessionId: 'guest-abc' }]);
    expect(mergeAuthHeader).toBe(`Bearer ${tokenPairFixture.accessToken}`);
    expect(useGuestSessionStore.getState().guestSessionId).toBeNull();
    expect(await screen.findByText('Welcome back, Asha!')).toBeInTheDocument();
  });

  it('keeps the guest id when the merge fails and still completes login', async () => {
    const user = userEvent.setup();
    useGuestSessionStore.getState().setGuestSessionId('guest-abc');
    server.use(
      http.post('*/api/v1/cart/merge', () =>
        HttpResponse.json(problemFixture({ status: 500, title: 'Server Error' }), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'reader@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText(/could not merge your guest cart/i)).toBeInTheDocument();
    expect(useAuthStore.getState().user).not.toBeNull();
    expect(useGuestSessionStore.getState().guestSessionId).toBe('guest-abc');
  });

  it('shows a form-level error for rejected credentials', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(
          problemFixture({
            status: 401,
            title: 'Unauthorized',
            detail: 'Invalid email or password',
          }),
          { status: 401, headers: problemHeaders },
        ),
      ),
    );
    renderApp('/login');

    await user.type(screen.getByLabelText('Email'), 'reader@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('ignores external redirect targets', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/login?redirect=%2F%2Fevil.example');

    await user.type(screen.getByLabelText('Email'), 'reader@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('register', () => {
  it('validates password length and required names', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
  });

  it('registers (omitting an empty phone), merges the guest cart and signs in', async () => {
    const user = userEvent.setup();
    useGuestSessionStore.getState().setGuestSessionId('guest-xyz');
    let registerBody: Record<string, unknown> | null = null;
    let merged = false;
    server.use(
      http.post('*/api/v1/auth/register', async ({ request }) => {
        registerBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            user: {
              ...useAuthStore.getState().user,
              id: 'u',
              email: 'new@example.com',
              firstName: 'Nia',
              lastName: 'Shah',
              roles: ['ROLE_CUSTOMER'],
            },
            tokens: tokenPairFixture,
          },
          { status: 201 },
        );
      }),
      http.post('*/api/v1/cart/merge', () => {
        merged = true;
        return HttpResponse.json(cartFixture);
      }),
      http.get('*/api/v1/cart', () => HttpResponse.json(cartFixture)),
    );
    const { router } = renderApp('/register');

    await user.type(screen.getByLabelText('First name'), 'Nia');
    await user.type(screen.getByLabelText('Last name'), 'Shah');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'long-enough-pass');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(registerBody).toEqual({
      firstName: 'Nia',
      lastName: 'Shah',
      email: 'new@example.com',
      password: 'long-enough-pass',
    });
    expect(merged).toBe(true);
    expect(useGuestSessionStore.getState().guestSessionId).toBeNull();
    expect(useAuthStore.getState().user?.firstName).toBe('Nia');
  });

  it('maps server field errors onto the form via applyApiErrorsToForm', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/register', () =>
        HttpResponse.json(
          problemFixture({
            status: 409,
            title: 'Conflict',
            detail: 'Validation failed',
            errors: [{ field: 'body.email', message: 'Email is already registered' }],
          }),
          { status: 409, headers: problemHeaders },
        ),
      ),
    );
    renderApp('/register');

    await user.type(screen.getByLabelText('First name'), 'Nia');
    await user.type(screen.getByLabelText('Last name'), 'Shah');
    await user.type(screen.getByLabelText('Email'), 'taken@example.com');
    await user.type(screen.getByLabelText('Password'), 'long-enough-pass');
    await user.click(screen.getByRole('button', { name: 'Register' }));

    const message = await screen.findByText('Email is already registered');
    expect(message).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login with a return URL', async () => {
    const { router } = renderApp('/orders?status=CONFIRMED');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(new URLSearchParams(router.state.location.search).get('redirect')).toBe(
      '/orders?status=CONFIRMED',
    );
  });

  it('renders the protected page for authenticated users', async () => {
    signInAsFixtureUser();
    renderApp('/wishlist');

    expect(await screen.findByRole('heading', { name: 'My Wishlist' })).toBeInTheDocument();
  });

  it('returns to the original page after logging in', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/profile');

    await user.type(await screen.findByLabelText('Email'), 'reader@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('clears the user and redirects to login when the session expires', async () => {
    signInAsFixtureUser();
    const { router } = renderApp('/orders');
    expect(await screen.findByRole('heading', { name: 'My Orders' })).toBeInTheDocument();

    // The HTTP client calls clearTokens() when a refresh token is rejected.
    act(() => {
      sessionTokenStorage.clearTokens();
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().tokens).toBeNull();
    expect(
      await screen.findByText('Your session has expired. Please log in again.'),
    ).toBeInTheDocument();
  });
});

describe('logout', () => {
  it('calls the logout API with the refresh token and clears the session', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    let logoutBody: unknown = null;
    let logoutAuth: string | null = null;
    server.use(
      http.post('*/api/v1/auth/logout', async ({ request }) => {
        logoutBody = await request.json();
        logoutAuth = request.headers.get('authorization');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(logoutBody).toEqual({ refreshToken: tokenPairFixture.refreshToken });
    expect(logoutAuth).toBe(`Bearer ${tokenPairFixture.accessToken}`);
    expect(useAuthStore.getState().tokens).toBeNull();
    expect(await screen.findByText('You have been logged out.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('clears local state even when the logout call fails', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    server.use(
      http.post('*/api/v1/auth/logout', () =>
        HttpResponse.json(problemFixture({ status: 500, title: 'Server Error' }), {
          status: 500,
          headers: problemHeaders,
        }),
      ),
    );
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(useAuthStore.getState().tokens).toBeNull());
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('keeps the guest session id untouched on logout', async () => {
    const user = userEvent.setup();
    signInAsFixtureUser();
    useGuestSessionStore.getState().setGuestSessionId(FIXTURE_GUEST_SESSION_ID);
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(useGuestSessionStore.getState().guestSessionId).toBe(FIXTURE_GUEST_SESSION_ID);
  });
});
