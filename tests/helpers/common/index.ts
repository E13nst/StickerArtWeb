/**
 * Экспорт всех общих helper функций
 */

// Auth helpers
export { setupAuth } from './auth-helpers';

// Gallery helpers
export {
  navigateToGallery,
  searchStickerSet,
  openStickerSet,
  checkThumbnails
} from './gallery-helpers';

// Media helpers
export {
  waitForFirstMedia,
  hasFallbackInMainArea,
  getMediaStatus,
  waitForAnimation,
  waitForVideo,
  clickThumbnailAndCheckMedia,
  type MediaStatus
} from './media-helpers';

