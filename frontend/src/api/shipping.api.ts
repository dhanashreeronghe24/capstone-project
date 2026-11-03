import { apiClient } from './client';
import type {
  DeliveryEstimate,
  EstimateDeliveryParams,
  ShippingRate,
  ShippingTier,
  Tracking,
} from './types';

export interface CalculateRateRequest {
  postalCode: string;
  weightKg: number;
  orderAmount?: number;
  tier?: ShippingTier;
}

export const shippingApi = {
  calculateRate: (body: CalculateRateRequest) =>
    apiClient.post<ShippingRate>('/shipping/calculate-rate', body),

  estimateDelivery: (params: EstimateDeliveryParams) =>
    apiClient.get<DeliveryEstimate>('/shipping/estimate-delivery', { query: params }),

  track: (trackingNumber: string) =>
    apiClient.get<Tracking>(`/shipping/track/${encodeURIComponent(trackingNumber)}`),
};
