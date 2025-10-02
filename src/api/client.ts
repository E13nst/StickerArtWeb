import axios, { AxiosInstance } from 'axios';
import { StickerSetListResponse, StickerSetResponse, AuthResponse } from '@/types/sticker';
import { UserInfo } from '@/store/useProfileStore';
import { mockStickerSets, mockAuthResponse } from '@/data/mockData';

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

    // Добавляем interceptor для логирования
    this.client.interceptors.request.use(
      (config) => {
        console.log('🌐 API запрос:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('❌ Ошибка запроса:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log('✅ API ответ:', response.status, response.config.url);
        return response;
      },
      (error) => {
        console.error('❌ Ошибка ответа:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

      // Добавляем заголовки аутентификации
      setAuthHeaders(initData: string, botName: string = 'StickerGallery') {
        this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
        this.client.defaults.headers.common['X-Telegram-Bot-Name'] = botName;
        console.log('✅ Заголовки аутентификации установлены:');
        console.log('  X-Telegram-Init-Data:', initData ? `${initData.length} chars` : 'empty');
        console.log('  X-Telegram-Bot-Name:', botName);
      }

      // Проверяем заголовки от Chrome расширений (ModHeader и т.п.)
      checkExtensionHeaders() {
        // ModHeader добавляет заголовки в fetch requests
        // Проверяем, есть ли заголовки от расширений
        const extensionInitData = this.client.defaults.headers.common['X-Telegram-Init-Data-Extension'];
        const extensionBotName = this.client.defaults.headers.common['X-Telegram-Bot-Name-Extension'];
        
        if (extensionInitData) {
          console.log('🔧 Обнаружены заголовки от Chrome расширения:');
          console.log('  X-Telegram-Init-Data-Extension:', extensionInitData);
          console.log('  X-Telegram-Bot-Name-Extension:', extensionBotName);
          
          // Используем заголовки от расширения
          this.client.defaults.headers.common['X-Telegram-Init-Data'] = extensionInitData;
          this.client.defaults.headers.common['X-Telegram-Bot-Name'] = extensionBotName || 'StickerGallery';
          
          return true;
        }
        
        return false;
      }

  // Удаляем заголовки аутентификации
  clearAuthHeaders() {
    delete this.client.defaults.headers.common['X-Telegram-Init-Data'];
    delete this.client.defaults.headers.common['X-Telegram-Bot-Name'];
    console.log('🧹 Заголовки аутентификации удалены');
  }

  // Получение списка стикерсетов с пагинацией
  async getStickerSets(page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>('/stickersets', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      console.warn('⚠️ API недоступен, используем мок данные');
      // Возвращаем мок данные если API недоступен
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

  // Поиск стикерсетов по названию
  async searchStickerSets(query: string, page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>('/stickersets/search', {
        params: { name: query, page, size }
      });
      return response.data;
    } catch (error) {
      console.warn('⚠️ API поиска недоступен, используем локальную фильтрацию мок данных');
      // Фильтруем мок данные локально
      const filteredMockData = mockStickerSets.filter(stickerSet =>
        stickerSet.title.toLowerCase().includes(query.toLowerCase()) ||
        stickerSet.name.toLowerCase().includes(query.toLowerCase())
      );
      
      return {
        content: filteredMockData,
        totalElements: filteredMockData.length,
        totalPages: 1,
        size: filteredMockData.length,
        number: 0,
        first: true,
        last: true,
        numberOfElements: filteredMockData.length
      };
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

  // Проверка статуса аутентификации
  async checkAuthStatus(): Promise<AuthResponse> {
    try {
      const response = await this.client.get<AuthResponse>('/auth/status');
      return response.data;
    } catch (error) {
      console.warn('⚠️ API недоступен, используем мок данные для аутентификации');
      return mockAuthResponse;
    }
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
      console.warn('⚠️ API недоступен, используем мок данные для пользователя');
      // Мок данные для пользователя
      return {
        id: 1,
        telegramId: userId,
        username: 'mockuser',
        firstName: 'Mock',
        lastName: 'User',
        avatarUrl: 'https://via.placeholder.com/64x64/2481cc/ffffff?text=MU',
        role: 'USER',
        artBalance: 150,
        createdAt: '2025-09-15T10:30:00Z'
      };
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
      console.warn('⚠️ API недоступен, используем мок данные для стикерсетов пользователя');
      // Фильтруем мок данные по userId (для демонстрации)
             const userMockSets = mockStickerSets.filter(set => (set as any).userId === userId || userId === 123456789);
      
      return {
        content: userMockSets,
        totalElements: userMockSets.length,
        totalPages: Math.ceil(userMockSets.length / size),
        size: size,
        number: page,
        first: page === 0,
        last: page >= Math.ceil(userMockSets.length / size) - 1,
        numberOfElements: userMockSets.length
      };
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
      console.warn('⚠️ API поиска недоступен, используем локальную фильтрацию');
      // Локальная фильтрация мок данных
       const userMockSets = mockStickerSets.filter(set => 
         ((set as any).userId === userId || userId === 123456789) &&
        (set.title.toLowerCase().includes(query.toLowerCase()) ||
         set.name.toLowerCase().includes(query.toLowerCase()))
      );
      
      return {
        content: userMockSets,
        totalElements: userMockSets.length,
        totalPages: Math.ceil(userMockSets.length / size),
        size: size,
        number: page,
        first: page === 0,
        last: page >= Math.ceil(userMockSets.length / size) - 1,
        numberOfElements: userMockSets.length
      };
    }
  }
}

export const apiClient = new ApiClient();
