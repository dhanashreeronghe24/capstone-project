import type { TokenPair } from './types';

/**
 * Persistence boundary between the HTTP client and the app's auth/guest-session state.
 *
 * The client only depends on this interface. Sub-task 3 implements it on top of the Zustand
 * auth store (tokens, persisted) and guest-session store, then registers it with
 * `apiClient.configure({ storage })`. Until then an in-memory implementation is used.
 *
 * Methods are synchronous and must be safe to call outside React (Zustand's `getState()`).
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  /** Called after a successful token refresh with the rotated pair. */
  setTokens(tokens: TokenPair): void;
  /** Called when the session can no longer be refreshed (refresh token rejected). */
  clearTokens(): void;
  getGuestSessionId(): string | null;
  /** Called with the `x-guest-session-id` response header value when the server sends one. */
  setGuestSessionId(id: string | null): void;
}

export function createMemoryTokenStorage(): TokenStorage {
  let tokens: TokenPair | null = null;
  let guestSessionId: string | null = null;
  return {
    getAccessToken: () => tokens?.accessToken ?? null,
    getRefreshToken: () => tokens?.refreshToken ?? null,
    setTokens: (next) => {
      tokens = next;
    },
    clearTokens: () => {
      tokens = null;
    },
    getGuestSessionId: () => guestSessionId,
    setGuestSessionId: (id) => {
      guestSessionId = id;
    },
  };
}
