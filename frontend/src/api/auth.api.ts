import { apiClient } from './client';
import type { AuthResponse, LoginRequest, RegisterRequest, TokenPair } from './types';

export const authApi = {
  register: (body: RegisterRequest) =>
    apiClient.post<AuthResponse>('/auth/register', body, { auth: false }),

  login: (body: LoginRequest) => apiClient.post<AuthResponse>('/auth/login', body, { auth: false }),

  /** Normally called by the client's 401 interceptor; exposed for explicit use. */
  refresh: (refreshToken: string) =>
    apiClient.post<TokenPair>('/auth/refresh', { refreshToken }, { auth: false }),

  /** Invalidates the refresh token server-side (204). */
  logout: (refreshToken: string) => apiClient.post<void>('/auth/logout', { refreshToken }),
};
