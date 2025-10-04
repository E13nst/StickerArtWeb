// Временные mock данные для демонстрации glassmorphism дизайна
import { StickerSetResponse } from '@/types/sticker';
import { CategoryDto } from '@/types/category';

// Тестовые стикерсеты для демонстрации glassmorphism
export const mockStickerSets: StickerSetResponse[] = [
  {
    id: 1,
    name: 'test_stickers',
    title: 'Тестовые стикеры',
    description: 'Набор тестовых стикеров для демонстрации glassmorphism',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    isPublic: true,
    isAnimated: false,
    stickerCount: 4,
    telegramStickerSetInfo: {
      name: 'test_stickers',
      title: 'Тестовые стикеры',
      is_animated: false,
      is_video: false,
      contains_masks: false,
      stickers: [
        {
          file_id: 'test_1',
          file_unique_id: 'test_1_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: '😀',
          url: 'https://via.placeholder.com/512x512/FF6B6B/FFFFFF?text=😀'
        },
        {
          file_id: 'test_2',
          file_unique_id: 'test_2_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: '😂',
          url: 'https://via.placeholder.com/512x512/4ECDC4/FFFFFF?text=😂'
        },
        {
          file_id: 'test_3',
          file_unique_id: 'test_3_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: '🤔',
          url: 'https://via.placeholder.com/512x512/45B7D1/FFFFFF?text=🤔'
        },
        {
          file_id: 'test_4',
          file_unique_id: 'test_4_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: true,
          is_video: false,
          emoji: '🎉',
          url: 'https://lottie.host/4c7c4a8a-8b2a-4c3d-9e1f-2a3b4c5d6e7f/party.json'
        }
      ]
    },
    categories: []
  },
  {
    id: 2,
    name: 'emoji_faces',
    title: 'Эмодзи лица',
    description: 'Различные выражения лиц',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    isPublic: true,
    isAnimated: false,
    stickerCount: 6,
    telegramStickerSetInfo: {
      name: 'emoji_faces',
      title: 'Эмодзи лица',
      is_animated: false,
      is_video: false,
      contains_masks: false,
      stickers: [
        {
          file_id: 'emoji_1',
          file_unique_id: 'emoji_1_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: '😊',
          url: 'https://via.placeholder.com/512x512/FFEAA7/FFFFFF?text=😊'
        },
        {
          file_id: 'emoji_2',
          file_unique_id: 'emoji_2_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: '😍',
          url: 'https://via.placeholder.com/512x512/DDA0DD/FFFFFF?text=😍'
        },
        {
          file_id: 'emoji_3',
          file_unique_id: 'emoji_3_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: false,
          is_video: false,
          emoji: '😎',
          url: 'https://via.placeholder.com/512x512/98D8C8/FFFFFF?text=😎'
        },
        {
          file_id: 'emoji_4',
          file_unique_id: 'emoji_4_unique',
          type: 'regular' as const,
          width: 512,
          height: 512,
          is_animated: true,
          is_video: false,
          emoji: '🤗',
          url: 'https://lottie.host/3b2a1c9d-7e8f-4a5b-9c6d-1e2f3a4b5c6d/hug.json'
        }
      ]
    },
    categories: []
  }
];

export const mockUserStickerSets: StickerSetResponse[] = mockStickerSets;

// Тестовые категории
export const mockCategories: CategoryDto[] = [
  { 
    id: 1,
    key: 'animals', 
    name: 'Животные', 
    description: 'Стикеры с животными',
    displayOrder: 1,
    isActive: true
  },
  { 
    id: 2,
    key: 'memes', 
    name: 'Мемы', 
    description: 'Мемные стикеры',
    displayOrder: 2,
    isActive: true
  },
  { 
    id: 3,
    key: 'emotions', 
    name: 'Эмоции', 
    description: 'Эмоциональные стикеры',
    displayOrder: 3,
    isActive: true
  },
  { 
    id: 4,
    key: 'cute', 
    name: 'Милые', 
    description: 'Милые и кавайные стикеры',
    displayOrder: 4,
    isActive: true
  },
  { 
    id: 5,
    key: 'animated', 
    name: 'Анимированные', 
    description: 'Анимированные стикеры',
    displayOrder: 5,
    isActive: true
  }
];

// Тестовый ответ аутентификации
export const mockAuthResponse = {
  authenticated: true,
  role: 'user',
  user: {
    id: 1,
    username: 'test_user',
    firstName: 'Тест',
    lastName: 'Пользователь'
  }
};