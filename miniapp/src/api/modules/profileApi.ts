import { apiClient } from '@/api/client';

export const profileApi = {
  getMyProfile: (...args: Parameters<typeof apiClient.getMyProfile>) =>
    apiClient.getMyProfile(...args),
  getProfile: (...args: Parameters<typeof apiClient.getProfile>) =>
    apiClient.getProfile(...args),
  getTelegramUser: (...args: Parameters<typeof apiClient.getTelegramUser>) =>
    apiClient.getTelegramUser(...args),
};
