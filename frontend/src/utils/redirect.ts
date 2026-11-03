/** Only same-origin absolute paths are valid post-login targets (blocks open redirects). */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}

export const REDIRECT_PARAM = 'redirect';

export function loginPathWithRedirect(from: string): string {
  return `/login?${REDIRECT_PARAM}=${encodeURIComponent(from)}`;
}
