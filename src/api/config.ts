import axios from 'axios';

export interface AppConfig {
  botName: string;
  miniAppUrl: string;
}

class ConfigService {
  private config: AppConfig | null = null;

  async getConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const response = await axios.get<AppConfig>('/api/config');
      this.config = response.data;
      return this.config;
    } catch (error) {
      console.error('❌ Ошибка получения конфигурации:', error);
      // Возвращаем конфигурацию по умолчанию
      return {
        botName: 'StickerGallery',
        miniAppUrl: window.location.origin
      };
    }
  }

  getBotName(): string {
    return this.config?.botName || 'StickerGallery';
  }
}

export const configService = new ConfigService();
