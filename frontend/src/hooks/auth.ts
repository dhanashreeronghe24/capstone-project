import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  authApi,
  cartApi,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
} from '@/api';
import { toast, useAuthStore, useGuestSessionStore } from '@/stores';
import { cartKeys, privateKeys } from './query-keys';

/**
 * Merge the guest cart into the member cart right after authentication. The guest id is cleared
 * only once the merge succeeded (a failed merge keeps it so a later login can retry). A merge
 * failure never fails the login itself.
 */
export async function mergeGuestCart(): Promise<void> {
  const { guestSessionId, setGuestSessionId } = useGuestSessionStore.getState();
  if (!guestSessionId) return;
  try {
    await cartApi.merge(guestSessionId);
    setGuestSessionId(null);
  } catch {
    toast.error('We could not merge your guest cart. Your items are still saved as a guest cart.');
  }
}

/** Drop member-only cached data (logout / session expiry) and refetch the (guest) cart. */
export function resetPrivateQueries(queryClient: QueryClient): void {
  for (const queryKey of privateKeys) queryClient.removeQueries({ queryKey });
  void queryClient.invalidateQueries({ queryKey: cartKeys.all });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginRequest): Promise<AuthResponse> => {
      const response = await authApi.login(body);
      useAuthStore.getState().signIn(response);
      await mergeGuestCart();
      await queryClient.invalidateQueries({ queryKey: cartKeys.all });
      return response;
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: RegisterRequest): Promise<AuthResponse> => {
      const response = await authApi.register(body);
      useAuthStore.getState().signIn(response);
      await mergeGuestCart();
      await queryClient.invalidateQueries({ queryKey: cartKeys.all });
      return response;
    },
  });
}

/** Logout via the API; local state is cleared even when the call fails (expired/offline). */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const refreshToken = useAuthStore.getState().tokens?.refreshToken;
      try {
        if (refreshToken) await authApi.logout(refreshToken);
      } catch {
        // Ignore: the session is dropped locally regardless.
      } finally {
        useAuthStore.getState().signOut();
        resetPrivateQueries(queryClient);
      }
    },
  });
}
