import { apiClient } from '@/api/client';
import type { TokenStorage } from '@/api/token-storage';
import { useAuthStore } from './auth.store';
import { useGuestSessionStore } from './guest-session.store';

/**
 * `TokenStorage` backed by the persisted Zustand stores. Safe outside React (`getState()`).
 * `clearTokens` is only called by the client when a refresh token is rejected, so it expires
 * the session (clears the user too) and flags it for the layout to announce.
 */
export const sessionTokenStorage: TokenStorage = {
  getAccessToken: () => useAuthStore.getState().tokens?.accessToken ?? null,
  getRefreshToken: () => useAuthStore.getState().tokens?.refreshToken ?? null,
  setTokens: (tokens) => useAuthStore.getState().setTokens(tokens),
  clearTokens: () => useAuthStore.getState().expireSession(),
  getGuestSessionId: () => useGuestSessionStore.getState().guestSessionId,
  setGuestSessionId: (id) => useGuestSessionStore.getState().setGuestSessionId(id),
};

/** Register the store-backed storage with the app-wide HTTP client. Call once at startup. */
export function registerSessionStorage(): void {
  apiClient.configure({ storage: sessionTokenStorage });
}
