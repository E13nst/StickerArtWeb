import { apiClient } from '@/api/client';

export const stickerSetsApi = {
  getStickerSets: (...args: Parameters<typeof apiClient.getStickerSets>) =>
    apiClient.getStickerSets(...args),
  getUserStickerSets: (...args: Parameters<typeof apiClient.getUserStickerSets>) =>
    apiClient.getUserStickerSets(...args),
  saveToStickerSetV2: (...args: Parameters<typeof apiClient.saveToStickerSetV2>) =>
    apiClient.saveToStickerSetV2(...args),
  uploadStickerPackByLink: (...args: Parameters<typeof apiClient.uploadStickerPackByLink>) =>
    apiClient.uploadStickerPackByLink(...args),
};
