import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GuestSessionState {
  guestSessionId: string | null;
  setGuestSessionId: (id: string | null) => void;
}

export const GUEST_STORAGE_KEY = 'bookworm-guest-session';

export const useGuestSessionStore = create<GuestSessionState>()(
  persist(
    (set) => ({
      guestSessionId: null,
      setGuestSessionId: (guestSessionId) => set({ guestSessionId }),
    }),
    { name: GUEST_STORAGE_KEY, version: 1 },
  ),
);
