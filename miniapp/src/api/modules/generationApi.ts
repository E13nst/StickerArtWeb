import { apiClient } from '@/api/client';

export const generationApi = {
  generateSticker: (...args: Parameters<typeof apiClient.generateSticker>) =>
    apiClient.generateSticker(...args),
  getGenerationStatus: (...args: Parameters<typeof apiClient.getGenerationStatus>) =>
    apiClient.getGenerationStatus(...args),
  getGenerationStatusV2: (...args: Parameters<typeof apiClient.getGenerationStatusV2>) =>
    apiClient.getGenerationStatusV2(...args),
  uploadSourceImages: (...args: Parameters<typeof apiClient.uploadSourceImages>) =>
    apiClient.uploadSourceImages(...args),
  uploadPresetStyleReferenceGalleryImages: (
    ...args: Parameters<typeof apiClient.uploadPresetStyleReferenceGalleryImages>
  ) => apiClient.uploadPresetStyleReferenceGalleryImages(...args),
  getStylePresetCategories: (...args: Parameters<typeof apiClient.getStylePresetCategories>) =>
    apiClient.getStylePresetCategories(...args),
  getStylePresets: (...args: Parameters<typeof apiClient.getStylePresets>) =>
    apiClient.getStylePresets(...args),
  createStylePreset: (...args: Parameters<typeof apiClient.createStylePreset>) =>
    apiClient.createStylePreset(...args),
  publishUserStyleFromTask: (...args: Parameters<typeof apiClient.publishUserStyleFromTask>) =>
    apiClient.publishUserStyleFromTask(...args),
};
