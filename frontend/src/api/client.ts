import { ApiError } from './errors';
import { createMemoryTokenStorage, type TokenStorage } from './token-storage';
import type { TokenPair } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  query?: QueryParams;
  /** JSON-serialisable request body. */
  body?: unknown;
  /** Extra request headers (e.g. `Idempotency-Key`). */
  headers?: Record<string, string>;
  /** Set to `false` for public endpoints that must never carry the Bearer token (login...). */
  auth?: boolean;
  /** Sent as `x-correlation-id` so a request can be traced through backend logs. */
  correlationId?: string;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface HttpClientConfig {
  baseUrl: string;
  storage: TokenStorage;
  fetchImpl?: typeof fetch;
}

export const GUEST_SESSION_HEADER = 'x-guest-session-id';
export const CORRELATION_HEADER = 'x-correlation-id';
const AUTH_PATH_PREFIX = '/auth/';

function resolveUrl(baseUrl: string, path: string, query?: QueryParams): string {
  let url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  // Node's fetch rejects relative URLs; the browser resolves them itself. Resolve explicitly
  // so the same client works under jsdom/Vitest.
  if (url.startsWith('/') && typeof window !== 'undefined') {
    url = new URL(url, window.location.origin).toString();
  }
  if (query) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') search.append(key, String(value));
    }
    const qs = search.toString();
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`;
  }
  return url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export interface HttpClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  requestRaw<T>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>;
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
  /** Swap the token/guest-session storage (sub-task 3 registers the Zustand-backed one). */
  configure(config: Partial<Pick<HttpClientConfig, 'storage' | 'baseUrl'>>): void;
}

export function createHttpClient(initial: HttpClientConfig): HttpClient {
  let { baseUrl, storage } = initial;
  const fetchFn: typeof fetch = initial.fetchImpl ?? ((...args) => fetch(...args));

  /** Single-flight guard: concurrent 401s share one refresh call. */
  let refreshInFlight: Promise<boolean> | null = null;

  async function send(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
    accessToken: string | null,
  ): Promise<Response> {
    const headers = new Headers({ Accept: 'application/json', ...options.headers });
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    const guestId = storage.getGuestSessionId();
    if (guestId) headers.set(GUEST_SESSION_HEADER, guestId);
    if (options.correlationId) headers.set(CORRELATION_HEADER, options.correlationId);

    try {
      return await fetchFn(resolveUrl(baseUrl, path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      throw ApiError.fromNetworkError(cause);
    }
  }

  /** Resolves true when new tokens are stored, false when the session is gone. */
  function refreshTokens(): Promise<boolean> {
    refreshInFlight ??= (async () => {
      const refreshToken = storage.getRefreshToken();
      if (!refreshToken) return false;
      try {
        const response = await send('POST', '/auth/refresh', { body: { refreshToken } }, null);
        if (!response.ok) {
          // Only a definitive rejection ends the session; 5xx leaves tokens for a later retry.
          if (response.status >= 400 && response.status < 500) storage.clearTokens();
          return false;
        }
        storage.setTokens((await parseBody(response)) as TokenPair);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function requestRaw<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const useAuth = options.auth !== false;
    const sentToken = useAuth ? storage.getAccessToken() : null;
    let response = await send(method, path, options, sentToken);

    if (response.status === 401 && useAuth && !path.startsWith(AUTH_PATH_PREFIX)) {
      const currentToken = storage.getAccessToken();
      // Another request may already have rotated the token; only refresh if ours is still current.
      const tokenRotated = currentToken !== null && currentToken !== sentToken;
      if (tokenRotated || (storage.getRefreshToken() !== null && (await refreshTokens()))) {
        response = await send(method, path, options, storage.getAccessToken());
      }
    }

    const guestSessionId = response.headers.get(GUEST_SESSION_HEADER);
    if (guestSessionId) storage.setGuestSessionId(guestSessionId);

    const body = await parseBody(response);
    if (!response.ok) throw ApiError.fromResponse(response, body);
    return { data: body as T, status: response.status, headers: response.headers };
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    return (await requestRaw<T>(method, path, options)).data;
  }

  return {
    request,
    requestRaw,
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
    configure(config) {
      if (config.storage) storage = config.storage;
      if (config.baseUrl) baseUrl = config.baseUrl;
    },
  };
}

/** App-wide client. Base URL comes from `VITE_API_BASE_URL` (default `/api/v1`, Vite-proxied). */
export const apiClient: HttpClient = createHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  storage: createMemoryTokenStorage(),
});
