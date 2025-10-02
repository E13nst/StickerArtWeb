import axios, { AxiosInstance } from 'axios';
import { StickerSetListResponse, StickerSetResponse, AuthResponse } from '@/types/sticker';
import { UserInfo } from '@/store/useProfileStore';
import { CategoryDto, CategoriesResponse } from '@/types/category';

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
      console.error('❌ Ошибка получения списка стикерсетов:', error);
      throw new Error(`Не удалось загрузить стикерсеты. Проверьте подключение к серверу и попробуйте снова.`);
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
      console.error('❌ Ошибка поиска стикерсетов:', error);
      throw new Error(`Не удалось выполнить поиск стикерсетов по запросу "${query}". Проверьте подключение к серверу и попробуйте снова.`);
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
      console.error('❌ Ошибка проверки статуса аутентификации:', error);
      throw new Error(`Не удалось проверить статус аутентификации. Проверьте подключение к серверу и попробуйте снова.`);
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
      console.error('❌ Ошибка получения информации о пользователе:', error);
      throw new Error(`Не удалось получить информацию о пользователе с ID ${userId}. Проверьте подключение к серверу и попробуйте снова.`);
    }
  }

  // Получение информации о текущем пользователе по Telegram ID
  // Примечание: API использует telegramId как основной ID
  async getUserByTelegramId(telegramId: number): Promise<UserInfo> {
    try {
      // API endpoint: /api/users/{id} где id = telegramId
      const response = await this.client.get<UserInfo>(`/users/${telegramId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка получения информации о пользователе:', error);
      throw new Error(`Не удалось получить информацию о пользователе с ID ${telegramId}. Проверьте подключение к серверу и попробуйте снова.`);
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
      console.error('❌ Ошибка получения стикерсетов пользователя:', error);
      throw new Error(`Не удалось загрузить стикерсеты пользователя с ID ${userId}. Проверьте подключение к серверу и попробуйте снова.`);
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
      console.error('❌ Ошибка поиска стикерсетов пользователя:', error);
      throw new Error(`Не удалось выполнить поиск стикерсетов пользователя с ID ${userId} по запросу "${query}". Проверьте подключение к серверу и попробуйте снова.`);
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
      console.error('❌ Ошибка получения категорий:', error);
      throw new Error(`Не удалось загрузить категории. Проверьте подключение к серверу и попробуйте снова.`);
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
      const params: any = { page, size, language };
      if (categoryKeys && categoryKeys.length > 0) {
        params.categoryKeys = categoryKeys.join(',');
      }
      
      const response = await this.client.get<StickerSetListResponse>('/stickersets', { params });
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка получения стикерсетов с фильтрацией:', error);
      throw new Error(`Не удалось загрузить стикерсеты с фильтрацией по категориям. Проверьте подключение к серверу и попробуйте снова.`);
    }
  }
}

export const apiClient = new ApiClient();
