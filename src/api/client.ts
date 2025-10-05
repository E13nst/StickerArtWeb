import axios, { AxiosInstance } from 'axios';
import { StickerSetListResponse, StickerSetResponse, AuthResponse } from '@/types/sticker';
import { UserInfo } from '@/store/useProfileStore';
import { CategoryDto } from '@/types/category';
import { mockStickerSets, mockAuthResponse, mockCategories } from '@/data/mockData';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Production-ready interceptors (minimal logging)
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  // Устанавливаем заголовки аутентификации
  setAuthHeaders(initData: string, botName: string = 'StickerGallery') {
    this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
    this.client.defaults.headers.common['X-Telegram-Bot-Name'] = botName;
  }

  // Удаляем заголовки аутентификации
  clearAuthHeaders() {
    delete this.client.defaults.headers.common['X-Telegram-Init-Data'];
    delete this.client.defaults.headers.common['X-Telegram-Bot-Name'];
  }

  // Проверка статуса авторизации
  async checkAuthStatus(): Promise<AuthResponse> {
    try {
      const response = await this.client.get<AuthResponse>('/auth/status');
      return response.data;
    } catch (error) {
      console.warn('Auth check failed, using mock data');
      return mockAuthResponse;
    }
  }

  // Получение списка стикерсетов с пагинацией
  async getStickerSets(page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>('/stickersets', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch sticker sets, using mock data');
      return {
        content: mockStickerSets,
        totalElements: mockStickerSets.length,
        totalPages: 1,
        size: mockStickerSets.length,
        number: 0,
        first: true,
        last: true,
        numberOfElements: mockStickerSets.length
      };
    }
  }

  // Метод для React Query infinite scroll
  async fetchStickerSets({ pageParam = 0 }: { pageParam?: number }): Promise<StickerSetResponse[]> {
    const response = await this.getStickerSets(pageParam, 20);
    return response.content || [];
  }

  // Поиск стикерсетов по названию
  async searchStickerSets(query: string, page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>('/stickersets/search', {
        params: { name: query, page, size }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Search failed for "${query}"`);
    }
  }

  // Получение стикерсета по ID
  async getStickerSet(id: number): Promise<StickerSetResponse> {
    const response = await this.client.get<StickerSetResponse>(`/stickersets/${id}`);
    return response.data;
  }

  // Удаление стикерсета
  async deleteStickerSet(id: number): Promise<void> {
    await this.client.delete(`/stickersets/${id}`);
  }


  // Получение стикера по file_id
  async getSticker(fileId: string): Promise<Blob> {
    const response = await this.client.get(`/stickers/${fileId}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Создание URL для стикера
  getStickerUrl(fileId: string): string {
    return `/api/stickers/${fileId}`;
  }

  // ============ МЕТОДЫ ДЛЯ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ============

  // Получение информации о пользователе по ID
  async getUserInfo(userId: number): Promise<UserInfo> {
    try {
      const response = await this.client.get<UserInfo>(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch user ${userId}`);
    }
  }

  // Получение информации о текущем пользователе по Telegram ID
  async getUserByTelegramId(telegramId: number): Promise<UserInfo> {
    try {
      const response = await this.client.get<UserInfo>(`/users/${telegramId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch user ${telegramId}`);
    }
  }

  // Получение стикерсетов пользователя по userId
  async getUserStickerSets(userId: number, page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>(`/stickersets/user/${userId}`, {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch user sticker sets for ${userId}`);
    }
  }

  // Поиск стикерсетов пользователя по названию
  async searchUserStickerSets(userId: number, query: string, page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>(`/stickersets/user/${userId}/search`, {
        params: { name: query, page, size }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search user sticker sets for ${userId}`);
    }
  }

  // ============ МЕТОДЫ ДЛЯ РАБОТЫ С КАТЕГОРИЯМИ ============

  // Получение всех активных категорий
  async getCategories(language: string = 'ru'): Promise<CategoryDto[]> {
    try {
      const response = await this.client.get<CategoryDto[]>('/categories', {
        params: { language }
      });
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch categories, using mock data');
      return mockCategories;
    }
  }

  // Получение стикерсетов с фильтрацией по категориям
  async getStickerSetsWithCategories(
    page: number = 0, 
    size: number = 20, 
    categoryKeys?: string[], 
    language: string = 'ru'
  ): Promise<StickerSetListResponse> {
    try {
      const params: { page: number; size: number; language: string; categoryKeys?: string } = { page, size, language };
      if (categoryKeys && categoryKeys.length > 0) {
        params.categoryKeys = categoryKeys.join(',');
      }
      
      const response = await this.client.get<StickerSetListResponse>('/stickersets', { params });
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch filtered sticker sets, using mock data');
      return {
        content: mockStickerSets,
        totalElements: mockStickerSets.length,
        totalPages: 1,
        size: mockStickerSets.length,
        number: 0,
        first: true,
        last: true,
        numberOfElements: mockStickerSets.length
      };
    }
  }
}

export const apiClient = new ApiClient();
