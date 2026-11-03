import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast, useAuthStore } from '@/stores';
import { resetPrivateQueries } from './auth';

/**
 * Reacts to involuntary session expiry (the HTTP client cleared tokens after a rejected refresh).
 * The auth store already cleared the user; here we drop member-only cached data and tell the
 * user. `ProtectedRoute` handles the redirect to login because `isAuthenticated` flips to false.
 */
export function useSessionExpiryWatcher(): void {
  const queryClient = useQueryClient();
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const acknowledge = useAuthStore((s) => s.acknowledgeSessionExpiry);

  useEffect(() => {
    if (!sessionExpired) return;
    resetPrivateQueries(queryClient);
    toast.info('Your session has expired. Please log in again.');
    acknowledge();
  }, [sessionExpired, acknowledge, queryClient]);
}
