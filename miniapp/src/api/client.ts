import axios, { AxiosInstance } from 'axios';
import { StickerSetListResponse, StickerSetResponse, AuthResponse, StickerSetMeta, ProfileResponse } from '../types/sticker';
import { UserInfo } from '../store/useProfileStore';
import { mockStickerSets, mockAuthResponse } from '../data/mockData';

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
        
        // Детальное логирование для авторизации
        if (config.url?.includes('/auth/')) {
          console.log('🔐 Auth запрос детали:', {
            url: config.url,
            headers: {
              'X-Telegram-Init-Data': config.headers['X-Telegram-Init-Data'] ? 'present' : 'missing',
              'Content-Type': config.headers['Content-Type'],
              'Accept': config.headers['Accept']
            },
            timeout: config.timeout
          });
        }
        
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
        
        // Детальное логирование для авторизации
        if (response.config.url?.includes('/auth/')) {
          console.log('🔐 Auth ответ детали:', {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            headers: response.headers
          });
        }
        
        return response;
      },
      (error) => {
        console.error('❌ Ошибка ответа:', error.response?.status, error.response?.data);
        
        // Детальное логирование ошибок авторизации
        if (error.config?.url?.includes('/auth/')) {
          console.error('🔐 Auth ошибка детали:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message,
            code: error.code,
            config: {
              url: error.config.url,
              method: error.config.method,
              headers: error.config.headers
            }
          });
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Добавляем заголовки аутентификации (botName не отправляем)
  setAuthHeaders(initData: string) {
    this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
    console.log('✅ Заголовки аутентификации установлены:');
    console.log('  X-Telegram-Init-Data:', initData ? `${initData.length} chars` : 'empty');
  }

  // Проверяем заголовки от Chrome расширений (ModHeader и т.п.)
  checkExtensionHeaders() {
    // ModHeader добавляет заголовки в fetch requests
    // Проверяем, есть ли заголовки от расширений
    const extensionInitData = this.client.defaults.headers.common['X-Telegram-Init-Data-Extension'];
    
    if (extensionInitData) {
      console.log('🔧 Обнаружены заголовки от Chrome расширения:');
      console.log('  X-Telegram-Init-Data-Extension:', extensionInitData);
      
      // Используем заголовки от расширения
      this.client.defaults.headers.common['X-Telegram-Init-Data'] = extensionInitData;
      
      return true;
    }
    
    return false;
  }

  // Получение текущих заголовков
  getHeaders(): Record<string, string> {
    return this.client.defaults.headers.common as Record<string, string>;
  }

  // Получение базового URL
  getBaseURL(): string {
    return this.client.defaults.baseURL || '';
  }

  // Получение таймаута
  getTimeout(): number {
    return this.client.defaults.timeout || 0;
  }

  // Генерация ключа кеша для запроса
  getCacheKey(url: string, params?: any): string {
    if (!params || Object.keys(params).length === 0) {
      return url;
    }
    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `${url}?${queryString}`;
  }

  // Удаляем заголовки аутентификации
  clearAuthHeaders() {
    delete this.client.defaults.headers.common['X-Telegram-Init-Data'];
    delete this.client.defaults.headers.common['X-Telegram-Bot-Name'];
    console.log('🧹 Заголовки аутентификации удалены');
  }

  // Получение списка стикерсетов с пагинацией
  async getStickerSets(page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    const response = await this.client.get<StickerSetListResponse>('/stickersets', {
      params: { page, size }
    });
    return response.data;
  }

  // Поиск стикерсетов по названию
  async searchStickerSets(query: string, page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    const response = await this.client.get<StickerSetListResponse>('/stickersets/search', {
      params: { name: query, page, size }
    });
    return response.data;
  }

  // Получение стикерсета по ID
  async getStickerSet(id: number): Promise<StickerSetResponse> {
    const response = await this.client.get<StickerSetResponse>(`/stickersets/${id}`);
    return response.data;
  }

  // Метаданные набора: автор и лайки
  async getStickerSetMeta(id: number): Promise<StickerSetMeta> {
    try {
      // Сначала пытаемся получить полную информацию о стикерсете
      const stickerSet = await this.getStickerSet(id);
      
      // Извлекаем метаданные из основного объекта стикерсета
      // Используем type assertion для доступа к дополнительным полям
      const extendedStickerSet = stickerSet as StickerSetResponse & {
        userId?: number;
        username?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
        likes?: number;
      };
      
      return {
        stickerSetId: id,
        author: {
          id: extendedStickerSet.userId || 1,
          username: extendedStickerSet.username || 'unknown',
          firstName: extendedStickerSet.firstName || 'Unknown',
          lastName: extendedStickerSet.lastName || '',
          avatarUrl: extendedStickerSet.avatarUrl
        },
        likes: extendedStickerSet.likes || Math.floor(100 + Math.random() * 900)
      };
    } catch (error) {
      console.warn('⚠️ API метаданных недоступен, используем мок значения');
      return {
        stickerSetId: id,
        author: {
          id: 1,
          username: 'mockauthor',
          firstName: 'Mock',
          lastName: 'Author',
          avatarUrl: 'https://via.placeholder.com/64x64/1976d2/ffffff?text=MA'
        },
        likes: Math.floor(100 + Math.random() * 900)
      };
    }
  }

  // Удаление стикерсета
  async deleteStickerSet(id: number): Promise<void> {
    await this.client.delete(`/stickersets/${id}`);
  }

  // Проверка статуса аутентификации
  async checkAuthStatus(): Promise<AuthResponse> {
    console.log('🔐 Проверка статуса авторизации...');
    const response = await this.client.get<AuthResponse>('/auth/status');
    console.log('✅ Статус авторизации получен:', response.data);
    return response.data;
  }

  // Получение стикера по file_id
  async getSticker(fileId: string): Promise<Blob> {
    const response = await this.client.get(`/proxy/stickers/${fileId}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Создание URL для стикера
  getStickerUrl(fileId: string): string {
    return `/api/proxy/stickers/${fileId}`;
  }

  // ============ МЕТОДЫ ДЛЯ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ============

  // Получение профиля пользователя по userId: GET /api/profiles/{userId}
  async getProfile(userId: number): Promise<UserInfo> {
    try {
      const response = await this.client.get<ProfileResponse>(`/profiles/${userId}`);
      const data = response.data;
      
      // Маппинг новой структуры ответа в UserInfo
      const mapped: UserInfo = {
        id: data.userId,
        telegramId: data.userId,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        avatarUrl: undefined,
        role: data.role,
        artBalance: data.artBalance,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        telegramUserInfo: {
          user: {
            id: data.userId,
            is_bot: false,
            first_name: data.user.firstName || '',
            last_name: data.user.lastName || '',
            username: data.user.username || '',
            language_code: data.user.languageCode || '',
            is_premium: !!data.user.isPremium
          },
          status: 'ok'
        }
      };
      return mapped;
    } catch (error) {
      console.warn('⚠️ API недоступен, используем мок данные для профиля');
      // Фоллбек к мокам при девелопменте вне Telegram
      return {
        id: userId,
        telegramId: userId,
        username: 'mockuser',
        firstName: 'Mock',
        lastName: 'User',
        avatarUrl: undefined,
        role: 'USER',
        artBalance: 100,
        createdAt: new Date().toISOString()
      } as UserInfo;
    }
  }

  // Профиль текущего пользователя (роль, баланс): GET /api/profiles/me
  async getMyProfile(): Promise<{ role: string; artBalance: number; userId: number } | null> {
    try {
      const response = await this.client.get<any>('/profiles/me');
      const data = response.data;
      return {
        role: data.role,
        artBalance: data.artBalance,
        userId: data.userId
      };
    } catch (error) {
      return null;
    }
  }

  // Фото профиля: GET /api/users/{userId}/photo
  async getUserPhoto(userId: number): Promise<{ profilePhotoFileId?: string; profilePhotos?: any } | null> {
    try {
      const response = await this.client.get<any>(`/users/${userId}/photo`);
      const data = response.data;
      return {
        profilePhotoFileId: data.profilePhotoFileId,
        profilePhotos: data.profilePhotos
      };
    } catch (error: any) {
      // 404 — нет фото
      if (error?.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Получение информации о пользователе по ID (использует новый API /profiles/{userId})
  async getUserInfo(userId: number): Promise<UserInfo> {
    try {
      const response = await this.client.get<ProfileResponse>(`/profiles/${userId}`);
      const data = response.data;
      
      // Маппинг новой структуры ответа в UserInfo
      const mapped: UserInfo = {
        id: data.userId,
        telegramId: data.userId,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        avatarUrl: undefined,
        role: data.role,
        artBalance: data.artBalance,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        telegramUserInfo: {
          user: {
            id: data.userId,
            is_bot: false,
            first_name: data.user.firstName || '',
            last_name: data.user.lastName || '',
            username: data.user.username || '',
            language_code: data.user.languageCode || '',
            is_premium: !!data.user.isPremium
          },
          status: 'ok'
        }
      };
      return mapped;
    } catch (error) {
      console.warn('⚠️ API недоступен, используем мок данные для пользователя');
      // Мок данные для пользователя
      return {
        id: userId,
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

  // Получение информации о текущем пользователе по Telegram ID (использует новый API /profiles/{userId})
  async getUserByTelegramId(telegramId: number): Promise<UserInfo> {
    try {
      // API endpoint: /api/profiles/{userId} где userId = telegramId
      const response = await this.client.get<ProfileResponse>(`/profiles/${telegramId}`);
      const data = response.data;
      
      // Маппинг новой структуры ответа в UserInfo
      const mapped: UserInfo = {
        id: data.userId,
        telegramId: data.userId,
        username: data.user.username,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        avatarUrl: undefined,
        role: data.role,
        artBalance: data.artBalance,
        createdAt: data.user.createdAt,
        updatedAt: data.user.updatedAt,
        telegramUserInfo: {
          user: {
            id: data.userId,
            is_bot: false,
            first_name: data.user.firstName || '',
            last_name: data.user.lastName || '',
            username: data.user.username || '',
            language_code: data.user.languageCode || '',
            is_premium: !!data.user.isPremium
          },
          status: 'ok'
        }
      };
      return mapped;
    } catch (error) {
      console.warn('⚠️ API недоступен, используем мок данные для текущего пользователя');
      // Мок данные для текущего пользователя
      return {
        id: telegramId,
        telegramId: telegramId,
        username: 'currentuser',
        firstName: 'Current',
        lastName: 'User',
        avatarUrl: 'https://via.placeholder.com/64x64/4CAF50/ffffff?text=CU',
        role: 'USER',
        artBalance: 250,
        createdAt: '2025-09-15T10:30:00Z'
      };
    }
  }

  // Получение стикерсетов пользователя по userId
  async getUserStickerSets(
    userId: number,
    page: number = 0,
    size: number = 20,
    sort: 'createdAt' | 'title' | 'name' = 'createdAt',
    direction: 'ASC' | 'DESC' = 'DESC'
  ): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>(`/stickersets/user/${userId}`, {
        params: { page, size, sort, direction }
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
