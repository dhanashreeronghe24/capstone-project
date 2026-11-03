import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { routerFutureFlags, routes } from '@/router';
import {
  registerSessionStorage,
  useAuthStore,
  useGuestSessionStore,
  useToastStore,
} from '@/stores';
import type { AuthResponse } from '@/api/types';
import { authResponseFixture } from './fixtures';
import { createTestQueryClient } from './test-utils';

/** Reset persisted stores and bind the HTTP client to them, as `App` does at startup. */
export function resetSession(): void {
  localStorage.clear();
  useAuthStore.setState({ user: null, tokens: null, sessionExpired: false });
  useGuestSessionStore.setState({ guestSessionId: null });
  useToastStore.getState().clear();
  registerSessionStorage();
  apiClient.configure({ baseUrl: '/api/v1' });
}

export function signInAsFixtureUser(response: AuthResponse = authResponseFixture): void {
  useAuthStore.getState().signIn(response);
}

export interface RenderedApp extends RenderResult {
  router: ReturnType<typeof createMemoryRouter>;
}

/** Renders the real route table (layout, guards, pages) at `route`. */
export function renderApp(route = '/'): RenderedApp {
  const router = createMemoryRouter(routes, {
    initialEntries: [route],
    future: routerFutureFlags,
  });
  const result = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </QueryClientProvider>,
  );
  return { ...result, router };
}
