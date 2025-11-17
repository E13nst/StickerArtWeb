import axios, { AxiosInstance } from 'axios';
import { StickerSetListResponse, StickerSetResponse, AuthResponse, StickerSetMeta, ProfileResponse, CategoryResponse, CreateStickerSetRequest, CategorySuggestionResult } from '../types/sticker';
import { UserInfo } from '../store/useProfileStore';
import { mockStickerSets, mockAuthResponse } from '../data/mockData';
import { buildStickerUrl } from '@/utils/stickerUtils';
import { requestDeduplicator } from '@/utils/requestDeduplication';

interface TelegramApiUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  isPremium?: boolean;
}

class ApiClient {
  private client: AxiosInstance;
  private language: string;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000, // Увеличен с 10 до 30 секунд для медленных серверов
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    this.language = this.detectLanguage();
    
    // ✅ Автоматическая инициализация auth заголовков из localStorage (для тестирования)
    this.initializeAuthFromLocalStorage();

    // Добавляем interceptor для логирования
    this.client.interceptors.request.use(
      (config) => {
        const headers = config.headers ?? {};

        if (!headers['X-Telegram-Init-Data']) {
          const defaultInitData = this.client.defaults.headers.common['X-Telegram-Init-Data'];
          if (defaultInitData) {
            headers['X-Telegram-Init-Data'] = defaultInitData as string;
          }
        }

        const effectiveLanguage =
          (headers['X-Language'] as string | undefined) ||
          this.language ||
          this.detectLanguage();
        headers['X-Language'] = effectiveLanguage;

        config.headers = headers;

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

  // ✅ Инициализация auth заголовков из localStorage (для тестирования с ModHeader)
  private initializeAuthFromLocalStorage() {
    try {
      const storedInitData = localStorage.getItem('dev_telegram_init_data');
      if (storedInitData) {
        console.log('🔐 Используется initData из localStorage для API запросов');
        this.setAuthHeaders(storedInitData);
      }
    } catch (e) {
      console.warn('Ошибка чтения dev_telegram_init_data из localStorage:', e);
    }
  }

  // Добавляем заголовки аутентификации (botName не отправляем)
  setAuthHeaders(initData: string, language?: string) {
    this.client.defaults.headers.common['X-Telegram-Init-Data'] = initData;
    this.setLanguage(language);
    console.log('✅ Заголовки аутентификации установлены:');
    console.log('  X-Telegram-Init-Data:', initData ? `${initData.length} chars` : 'empty');
  }

  setLanguage(language?: string) {
    const normalized = (language || '').trim().split('-')[0]?.toLowerCase();
    this.language = normalized || this.detectLanguage();
    this.client.defaults.headers.common['X-Language'] = this.language;
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
      this.setLanguage();
      
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

  // Общая статистика платформы
  async getStatistics(): Promise<any> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/statistics',
      async () => {
        const response = await this.client.get('/statistics');
        return response.data;
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Удаляем заголовки аутентификации
  clearAuthHeaders() {
    delete this.client.defaults.headers.common['X-Telegram-Init-Data'];
    delete this.client.defaults.headers.common['X-Telegram-Bot-Name'];
    delete this.client.defaults.headers.common['X-Language'];
    console.log('🧹 Заголовки аутентификации удалены');
  }

  private detectLanguage(): string {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0]?.toLowerCase() || 'en';
    }
    return 'en';
  }

  // Получение категорий стикеров
  // API возвращает список CategoryDto с локализованными названиями
  // Поддерживает заголовок X-Language (ru/en) для локализации
  async getCategories(): Promise<CategoryResponse[]> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/categories',
      async () => {
        try {
          const response = await this.client.get<CategoryResponse[]>('/categories');
          // API возвращает массив активных категорий, отсортированных по displayOrder
          return response.data.filter(cat => cat.isActive);
        } catch (error) {
          console.warn('⚠️ Не удалось загрузить категории с API, используем fallback');
          // Fallback категории, если API недоступен
          return [
        { id: 1, key: 'animals', name: 'Animals', description: 'Stickers with animals', displayOrder: 1, isActive: true },
        { id: 2, key: 'memes', name: 'Memes', description: 'Popular memes', displayOrder: 2, isActive: true },
        { id: 3, key: 'emotions', name: 'Emotions', description: 'Express emotions', displayOrder: 3, isActive: true },
        { id: 4, key: 'cute', name: 'Cute', description: 'Cute and funny stickers', displayOrder: 4, isActive: true },
        { id: 5, key: 'anime', name: 'Anime', description: 'Anime characters', displayOrder: 5, isActive: true },
        { id: 6, key: 'cartoons', name: 'Cartoons', description: 'Cartoon characters', displayOrder: 6, isActive: true },
        { id: 7, key: 'food', name: 'Food', description: 'Food and drinks stickers', displayOrder: 7, isActive: true },
        { id: 8, key: 'nature', name: 'Nature', description: 'Nature and landscapes', displayOrder: 8, isActive: true },
        { id: 9, key: 'people', name: 'People', description: 'People and celebrities', displayOrder: 9, isActive: true },
        { id: 10, key: 'holidays', name: 'Holidays', description: 'Holiday stickers', displayOrder: 10, isActive: true },
        { id: 11, key: 'work', name: 'Work', description: 'Work-related stickers', displayOrder: 11, isActive: true },
        { id: 12, key: 'love', name: 'Love', description: 'Romantic stickers', displayOrder: 12, isActive: true },
        { id: 13, key: 'funny', name: 'Funny', description: 'Humorous stickers', displayOrder: 13, isActive: true },
        { id: 14, key: 'sports', name: 'Sports', description: 'Sports stickers', displayOrder: 14, isActive: true },
        { id: 15, key: 'music', name: 'Music', description: 'Music stickers', displayOrder: 15, isActive: true },
        { id: 16, key: 'technology', name: 'Technology', description: 'Technology and electronics stickers', displayOrder: 16, isActive: true },
        { id: 17, key: 'movies', name: 'Movies', description: 'Movie and TV series stickers', displayOrder: 17, isActive: true }
          ];
        }
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение списка стикерсетов с пагинацией и фильтрацией
  async getStickerSets(
    page: number = 0, 
    size: number = 20,
    options?: {
      categoryKeys?: string[]; // Фильтр по категориям (массив ключей)
      authorId?: number;
      userId?: number;          // Фильтр по пользователю (Telegram ID)
      hasAuthorOnly?: boolean;
      officialOnly?: boolean;
      likedOnly?: boolean;     // Только лайкнутые
      sort?: string;           // Поле для сортировки
      direction?: 'ASC' | 'DESC'; // Направление сортировки
    }
  ): Promise<StickerSetListResponse> {
    const params: Record<string, any> = { page, size };
    
    if (options?.categoryKeys && options.categoryKeys.length > 0) {
      // API ожидает строку через запятую
      params.categoryKeys = options.categoryKeys.join(',');
    }
    
    if (options?.likedOnly) {
      params.likedOnly = true;
    }
    
    if (options?.sort) {
      params.sort = options.sort;
    }
    
    if (options?.direction) {
      params.direction = options.direction;
    }

    if (typeof options?.authorId === 'number') {
      params.authorId = options.authorId;
    }

    if (typeof options?.userId === 'number') {
      params.userId = options.userId;
    }

    if (typeof options?.hasAuthorOnly === 'boolean') {
      params.hasAuthorOnly = options.hasAuthorOnly;
    }

    if (typeof options?.officialOnly === 'boolean') {
      params.officialOnly = options.officialOnly;
    }
    
    // ✅ P1 OPTIMIZATION: Request deduplication для предотвращения дублирующихся запросов
    // ⚠️ FIX: Запросы с likedOnly не кэшируем (они часто меняются)
    const shouldSkipCache = options?.likedOnly === true;
    
    return requestDeduplicator.fetch(
      `/stickersets`,
      async () => {
    const response = await this.client.get<StickerSetListResponse>('/stickersets', { params });
    return response.data;
      },
      params,
      { skipCache: shouldSkipCache }
    );
  }

  async getStickerSetsByAuthor(authorId: number, page: number = 0, size: number = 20, sort: string = 'createdAt', direction: 'ASC' | 'DESC' = 'DESC'): Promise<StickerSetListResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/stickersets/author/${authorId}`,
      async () => {
        const response = await this.client.get<StickerSetListResponse>(`/stickersets/author/${authorId}`, {
          params: { page, size, sort, direction }
        });
        return response.data;
      },
      { authorId, page, size, sort, direction }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  async getTelegramUser(userId: number): Promise<TelegramApiUser> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}`,
      async () => {
        const response = await this.client.get<TelegramApiUser>(`/users/${userId}`);
        return response.data;
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Создание нового стикерсета
  async createStickerSet(payload: CreateStickerSetRequest): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>('/stickersets', payload);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка при создании стикерсета:', error);
      throw error;
    }
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
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/stickersets/${id}`,
      async () => {
        const response = await this.client.get<StickerSetResponse>(`/stickersets/${id}`);
        return response.data;
      },
      { id }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
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

  // Обновление категорий стикерсета
  async updateStickerSetCategories(id: number, categoryKeys: string[]): Promise<StickerSetResponse> {
    try {
      const response = await this.client.put<StickerSetResponse>(`/stickersets/${id}/categories`, categoryKeys);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при обновлении категорий стикерсета ${id}:`, error);
      throw error;
    }
  }

  async publishStickerSet(id: number): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>(`/stickersets/${id}/publish`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при публикации стикерсета ${id}:`, error);
      throw error;
    }
  }

  async unpublishStickerSet(id: number): Promise<StickerSetResponse> {
    try {
      const response = await this.client.post<StickerSetResponse>(`/stickersets/${id}/unpublish`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при скрытии стикерсета ${id}:`, error);
      throw error;
    }
  }

  // AI-подбор категорий по заголовку
  async suggestCategoriesForTitle(title: string): Promise<CategorySuggestionResult> {
    try {
      const response = await this.client.get<CategorySuggestionResult>('/categories/ai/suggest', {
        params: { title }
      });
      return response.data;
    } catch (error: any) {
      console.warn('⚠️ Не удалось получить рекомендации категорий от AI:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async suggestCategoriesForStickerSet(
    id: number,
    options: { apply?: boolean; minConfidence?: number } = {}
  ): Promise<CategorySuggestionResult> {
    try {
      const response = await this.client.post<CategorySuggestionResult>(
        `/stickersets/${id}/ai/suggest-categories`,
        null,
        {
          params: {
            apply: options.apply ?? false,
            minConfidence: options.minConfidence
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при запросе AI категорий для стикерсета ${id}:`, error);
      throw error;
    }
  }

  // Удаление стикерсета
  async deleteStickerSet(id: number): Promise<void> {
    await this.client.delete(`/stickersets/${id}`);
  }

  // Проверка статуса аутентификации
  async checkAuthStatus(): Promise<AuthResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/auth/status',
      async () => {
        console.log('🔐 Проверка статуса авторизации...');
        const response = await this.client.get<AuthResponse>('/auth/status');
        console.log('✅ Статус авторизации получен:', response.data);
        return response.data;
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение стикера по file_id
  async getSticker(fileId: string): Promise<Blob> {
    const response = await axios.get(buildStickerUrl(fileId), {
      responseType: 'blob'
    });
    return response.data;
  }

  // Создание URL для стикера
  getStickerUrl(fileId: string): string {
    return buildStickerUrl(fileId);
  }

  // ============ МЕТОДЫ ДЛЯ ЛАЙКОВ ============

  // Переключить лайк стикерсета (только для fallback-сценариев)
  // API endpoint: PUT /api/likes/stickersets/{stickerSetId}/toggle
  // Если лайк есть - убирает, если нет - ставит
  // Response: { isLiked: boolean, totalLikes: number }
  async toggleLike(stickerSetId: number): Promise<{ isLiked: boolean; totalLikes: number }> {
    try {
      const response = await this.client.put<{ isLiked: boolean; totalLikes: number }>(
        `/likes/stickersets/${stickerSetId}/toggle`
      );
      console.log(`✅ Лайк переключен для стикерсета ${stickerSetId}:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при переключении лайка стикерсета ${stickerSetId}:`, error);
      throw new Error('Не удалось изменить лайк. Попробуйте позже.');
    }
  }

  // Поставить лайк стикерсету (явная установка isLiked=true)
  // API endpoint: POST /api/likes/stickersets/{stickerSetId}
  async likeStickerSet(stickerSetId: number): Promise<{ isLiked: boolean; totalLikes: number }> {
    try {
      const response = await this.client.post<{ isLiked: boolean; totalLikes: number }>(
        `/likes/stickersets/${stickerSetId}`
      );
      console.log(`✅ Лайк установлен для стикерсета ${stickerSetId}:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при установке лайка для стикерсета ${stickerSetId}:`, error);
      throw new Error('Не удалось поставить лайк. Попробуйте позже.');
    }
  }

  // Убрать лайк стикерсета (явная установка isLiked=false)
  // API endpoint: DELETE /api/likes/stickersets/{stickerSetId}
  async unlikeStickerSet(stickerSetId: number): Promise<{ isLiked: boolean; totalLikes: number }> {
    try {
      const response = await this.client.delete<{ isLiked: boolean; totalLikes: number }>(
        `/likes/stickersets/${stickerSetId}`
      );
      console.log(`✅ Лайк снят для стикерсета ${stickerSetId}:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Ошибка при снятии лайка для стикерсета ${stickerSetId}:`, error);
      throw new Error('Не удалось убрать лайк. Попробуйте позже.');
    }
  }

  // Получить все лайкнутые стикерсеты текущего пользователя
  // API endpoint: GET /api/likes/stickersets
  async getLikedStickerSets(page: number = 0, size: number = 20): Promise<StickerSetListResponse> {
    try {
      const response = await this.client.get<StickerSetListResponse>('/likes/stickersets', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка при получении лайкнутых стикерсетов:', error);
      throw error;
    }
  }

  // Получить топ стикерсетов по лайкам
  // API endpoint: GET /api/likes/top-stickersets
  async getTopStickerSetsByLikes(limit: number = 10): Promise<StickerSetResponse[]> {
    try {
      const response = await this.client.get<StickerSetResponse[]>('/likes/top-stickersets', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка при получении топ стикерсетов:', error);
      throw error;
    }
  }

  // ============ МЕТОДЫ ДЛЯ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ ============

  // Получение профиля пользователя по userId: GET /api/profiles/{userId}
  // Вспомогательная функция для маппинга ProfileResponse → UserInfo
  private mapProfileToUserInfo(data: ProfileResponse): UserInfo {
    return {
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
  }

  async getProfile(userId: number): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/profiles/${userId}`,
      async () => {
        try {
          const response = await this.client.get<ProfileResponse>(`/profiles/${userId}`);
          return this.mapProfileToUserInfo(response.data);
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
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  async getProfileStrict(userId: number): Promise<ProfileResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/profiles/${userId}`,
      async () => {
        const response = await this.client.get<ProfileResponse>(`/profiles/${userId}`);
        return response.data;
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // ✅ REFACTORED: Профиль текущего пользователя через /api/profiles/me
  // Возвращает UserInfo для единообразия с getProfile(userId)
  async getMyProfile(): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      '/profiles/me',
      async () => {
        const response = await this.client.get<ProfileResponse>('/profiles/me');
        return this.mapProfileToUserInfo(response.data);
      },
      {}, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получить raw ProfileResponse текущего пользователя (если нужен полный ответ)
  async getMyProfileRaw(): Promise<ProfileResponse> {
    const response = await this.client.get<ProfileResponse>('/profiles/me');
    return response.data;
  }

  // Фото профиля: GET /api/users/{userId}/photo
  async getUserPhoto(userId: number): Promise<{ profilePhotoFileId?: string; profilePhotos?: any } | null> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/users/${userId}/photo`,
      async () => {
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
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Загрузка фото профиля как blob: через sticker-processor (как для стикеров)
  async getUserPhotoBlob(userId: number, fileId?: string): Promise<Blob> {
    if (!fileId) {
      throw new Error('fileId is required for getUserPhotoBlob');
    }
    
    // ✅ FIX: Используем sticker-processor для загрузки изображения
    // Точно так же как для стикеров: используем buildStickerUrl напрямую с axios
    const url = buildStickerUrl(fileId, { file: true });
    
    // ✅ FIX: Используем дедупликацию запросов для предотвращения двойной загрузки
    return requestDeduplicator.fetch(
      url,
      async () => {
        const response = await axios.get(url, {
          responseType: 'blob'
        });
        return response.data;
      },
      { fileId, userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем blob (TTL 5 минут)
    );
  }

  // Получение информации о пользователе по ID (использует новый API /profiles/{userId})
  async getUserInfo(userId: number): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/profiles/${userId}`,
      async () => {
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
      },
      { userId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение информации о текущем пользователе по Telegram ID (использует новый API /profiles/{userId})
  async getUserByTelegramId(telegramId: number): Promise<UserInfo> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/profiles/${telegramId}`,
      async () => {
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
      },
      { telegramId }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
  }

  // Получение стикерсетов пользователя по userId
  async getUserStickerSets(
    userId: number,
    page: number = 0,
    size: number = 20,
    sort: 'createdAt' | 'title' | 'name' = 'createdAt',
    direction: 'ASC' | 'DESC' = 'DESC'
  ): Promise<StickerSetListResponse> {
    // ✅ FIX: Дедупликация запросов для предотвращения множественных вызовов
    return requestDeduplicator.fetch(
      `/stickersets/user/${userId}`,
      async () => {
        try {
          const response = await this.client.get<StickerSetListResponse>(`/stickersets/user/${userId}`, {
            params: { page, size, sort, direction }
          });
          return response.data;
        } catch (error) {
          console.warn('⚠️ API недоступен, используем мок данные для стикерсетов пользователя');
          // Фильтруем мок данные по userId (для демонстрации)
          const userMockSets = mockStickerSets.filter(set => (set as any).userId === userId || userId === 777000);
          
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
      },
      { userId, page, size, sort, direction }, // Параметры для ключа кэша
      { skipCache: false } // Кэшируем на 5 минут
    );
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
        ((set as any).userId === userId || userId === 777000) &&
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

  // Загрузка стикерпака по ссылке
  // API endpoint: POST /api/stickersets/import или POST /api/stickersets с параметром link
  // Параметр: link - ссылка на стикерпак (например, https://t.me/addstickers/...)
  async uploadStickerPackByLink(link: string): Promise<StickerSetResponse> {
    try {
      // Пробуем несколько возможных endpoints
      let response;
      try {
        // Вариант 1: POST /api/stickersets/import
        response = await this.client.post<StickerSetResponse>('/stickersets/import', { link });
      } catch (err: any) {
        if (err?.response?.status === 404) {
          // Вариант 2: POST /api/stickersets с параметром link
          response = await this.client.post<StickerSetResponse>('/stickersets', null, {
            params: { link }
          });
        } else {
          throw err;
        }
      }
      console.log('✅ Стикерпак загружен:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Ошибка загрузки стикерпака:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          'Не удалось загрузить стикерпак. Проверьте ссылку и попробуйте снова.';
      throw new Error(errorMessage);
    }
  }
}

export const apiClient = new ApiClient();
