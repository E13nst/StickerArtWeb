// Мок данные для тестирования без API
import { StickerSetResponse } from '@/types/sticker';

export const mockStickerSets: StickerSetResponse[] = [
  {
    id: 1,
    name: "test_stickers_by_StickerGalleryBot",
    title: "Тестовые стикеры",
    createdAt: "2025-09-29T10:00:00Z",
    updatedAt: "2025-09-29T10:00:00Z",
    telegramStickerSetInfo: {
      name: "test_stickers_by_StickerGalleryBot",
      title: "Тестовые стикеры",
      is_animated: false,
      is_video: false,
      contains_masks: false,
      stickers: [
        {
          file_id: "CAACAgIAAxkBAAIBY2VjZWVjZWVjZWVjZWVjZWVjZWVj",
          file_unique_id: "AgADZWVjZWVjZWVjZWVjZWVjZWVjZWVj",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: "😀",
          set_name: "test_stickers_by_StickerGalleryBot"
        },
        {
          file_id: "CAACAgIAAxkBAAIBZGVjZWVjZWVjZWVjZWVjZWVjZWVj",
          file_unique_id: "AgADZ WVjZWVjZWVjZWVjZWVjZWVjZWVj",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: "😂",
          set_name: "test_stickers_by_StickerGalleryBot"
        },
        {
          file_id: "CAACAgIAAxkBAAIBZWVjZWVjZWVjZWVjZWVjZWVjZWVj",
          file_unique_id: "AgADZWVjZWVjZWVjZWVjZWVjZWVjZWVj",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: "🤣",
          set_name: "test_stickers_by_StickerGalleryBot"
        }
      ]
    }
  },
  {
    id: 2,
    name: "animated_stickers_by_StickerGalleryBot",
    title: "Анимированные стикеры",
    createdAt: "2025-09-29T11:00:00Z",
    updatedAt: "2025-09-29T11:00:00Z",
    telegramStickerSetInfo: {
      name: "animated_stickers_by_StickerGalleryBot",
      title: "Анимированные стикеры",
      is_animated: true,
      is_video: false,
      contains_masks: false,
      stickers: [
        {
          file_id: "CAACAgIAAxkBAAIBZmVjZWVjZWVjZWVjZWVjZWVjZWVj",
          file_unique_id: "AgADZWVjZWVjZWVjZWVjZWVjZWVjZWVj",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: true,
          is_video: false,
          emoji: "🎉",
          set_name: "animated_stickers_by_StickerGalleryBot"
        },
        {
          file_id: "CAACAgIAAxkBAAIBZ2VjZWVjZWVjZWVjZWVjZWVjZWVj",
          file_unique_id: "AgADZWVjZWVjZWVjZWVjZWVjZWVjZWVj",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: true,
          is_video: false,
          emoji: "🎊",
          set_name: "animated_stickers_by_StickerGalleryBot"
        }
      ]
    }
  },
  {
    id: 3,
    name: "video_stickers_by_StickerGalleryBot",
    title: "Видео стикеры",
    createdAt: "2025-09-29T12:00:00Z",
    updatedAt: "2025-09-29T12:00:00Z",
    telegramStickerSetInfo: {
      name: "video_stickers_by_StickerGalleryBot",
      title: "Видео стикеры",
      is_animated: false,
      is_video: true,
      contains_masks: false,
      stickers: [
        {
          file_id: "CAACAgIAAxkBAAIBaGVjZWVjZWVjZWVjZWVjZWVjZWVj",
          file_unique_id: "AgADZWVjZWVjZWVjZWVjZWVjZWVjZWVj",
          type: "regular",
          width: 512,
          height: 512,
          is_animated: false,
          is_video: true,
          emoji: "🎬",
          set_name: "video_stickers_by_StickerGalleryBot"
        }
      ]
    }
  }
];

export const mockUserStickerSets: StickerSetResponse[] = [
  mockStickerSets[0], // Только первый набор для пользователя
];

export const mockAuthResponse = {
  authenticated: true,
  role: "USER",
  user: {
    id: 123456789,
    username: "testuser",
    first_name: "Test",
    last_name: "User"
  }
};
