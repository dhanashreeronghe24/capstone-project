import { apiClient } from './client';
import type { Address, AddressInput, Profile, UpdateProfileRequest } from './types';

export const membersApi = {
  getProfile: () => apiClient.get<Profile>('/members/me'),

  updateProfile: (body: UpdateProfileRequest) => apiClient.put<Profile>('/members/me', body),

  listAddresses: () => apiClient.get<Address[]>('/members/me/addresses'),

  addAddress: (body: AddressInput) => apiClient.post<Address>('/members/me/addresses', body),

  deleteAddress: (id: string) =>
    apiClient.delete<void>(`/members/me/addresses/${encodeURIComponent(id)}`),
};
