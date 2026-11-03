import { apiClient } from './client';
import type { CouponValidation } from './types';

export const couponsApi = {
  /** Validates against the current cart (guest or member). 404/422 for unknown/ineligible codes. */
  validate: (code: string) => apiClient.post<CouponValidation>('/coupons/validate', { code }),
};
