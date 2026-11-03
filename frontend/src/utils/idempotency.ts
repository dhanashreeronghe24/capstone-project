/**
 * Generates a fresh `Idempotency-Key` (UUID v4). Create ONE per checkout attempt and reuse it
 * for every retry of that attempt's `POST /orders`; create a new one only when the user changes
 * the order inputs (address, coupon, tier, points) or starts a new checkout.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (plain-http LAN dev) where randomUUID is unavailable.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
