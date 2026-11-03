import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, TokenPair, UserSummary } from '@/api/types';

export interface AuthState {
  user: UserSummary | null;
  tokens: TokenPair | null;
  /** True after the session ended involuntarily (refresh rejected); consumed by the layout. */
  sessionExpired: boolean;
  /** Store the result of a successful login/register. */
  signIn: (response: AuthResponse) => void;
  /** Store a rotated token pair (called by the HTTP client's refresh flow). */
  setTokens: (tokens: TokenPair) => void;
  /** Voluntary logout: clears the session without flagging expiry. */
  signOut: () => void;
  /** Involuntary end of session (tokens cleared by a failed refresh): clears user and tokens. */
  expireSession: () => void;
  acknowledgeSessionExpiry: () => void;
}

export const AUTH_STORAGE_KEY = 'bookworm-auth';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      sessionExpired: false,
      signIn: ({ user, tokens }) => set({ user, tokens, sessionExpired: false }),
      setTokens: (tokens) => set({ tokens }),
      signOut: () => set({ user: null, tokens: null, sessionExpired: false }),
      expireSession: () => {
        if (get().tokens === null && get().user === null) return;
        set({ user: null, tokens: null, sessionExpired: true });
      },
      acknowledgeSessionExpiry: () => set({ sessionExpired: false }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: 1,
      partialize: ({ user, tokens }) => ({ user, tokens }),
    },
  ),
);

export const selectIsAuthenticated = (state: AuthState): boolean =>
  state.tokens !== null && state.user !== null;
