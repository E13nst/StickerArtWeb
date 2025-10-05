import { StickerSetResponse, Sticker } from '@/types/sticker';

// Интерфейс для предопределенного превью
interface PredefinedPreview {
  stickerSetId: number;
  stickerIndex: number;
  sticker: Sticker;
  priority: number; // 1-высший, 2-средний, 3-низкий
}

// Класс для управления предопределенными превью
export class StickerPreloader {
  private predefinedPreviews: PredefinedPreview[] = [];
  private loadedPreviews = new Set<string>();
  private loadingPromises = new Map<string, Promise<boolean>>();

  // Генерируем порядок стикерпаков и предопределяем превью
  generatePredefinedPreviews(stickerSets: StickerSetResponse[]): PredefinedPreview[] {
    logger.log('🎲 Генерируем предопределенные превью для', stickerSets.length, 'стикерпаков');
    
    this.predefinedPreviews = [];
    
    stickerSets.forEach((stickerSet, setIndex) => {
      const stickers = stickerSet.telegramStickerSetInfo?.stickers || [];
      
      if (stickers.length === 0) return;
      
      // Перемешиваем стикеры и берем первые 3
      const shuffledStickers = this.shuffleArray(stickers);
      const previewStickers = shuffledStickers.slice(0, 3);
      
      // Определяем приоритет на основе позиции стикерпака
      let basePriority = 1; // Первые 4 стикерпака - высший приоритет
      if (setIndex >= 4 && setIndex < 8) basePriority = 2; // Следующие 4 - средний
      else if (setIndex >= 8) basePriority = 3; // Остальные - низкий
      
      // Создаем предопределенные превью
      previewStickers.forEach((sticker, stickerIndex) => {
        this.predefinedPreviews.push({
          stickerSetId: stickerSet.id,
          stickerIndex,
          sticker,
          priority: basePriority
        });
      });
    });
    
    logger.log('✅ Сгенерировано', this.predefinedPreviews.length, 'предопределенных превью');
    return this.predefinedPreviews;
  }

  // Получаем превью для конкретного стикерпака
  getPreviewsForStickerSet(stickerSetId: number): Sticker[] {
    const previews = this.predefinedPreviews
      .filter(p => p.stickerSetId === stickerSetId)
      .sort((a, b) => a.stickerIndex - b.stickerIndex)
      .map(p => p.sticker);
    
    logger.log('📦 Получены превью для стикерпака', stickerSetId, ':', previews.length);
    return previews;
  }

  // Загружаем превью по приоритету
  async loadPreviewsByPriority(): Promise<void> {
    // Группируем по приоритету
    const priorityGroups = {
      1: this.predefinedPreviews.filter(p => p.priority === 1),
      2: this.predefinedPreviews.filter(p => p.priority === 2),
      3: this.predefinedPreviews.filter(p => p.priority === 3)
    };

    logger.log('📥 Начинаем загрузку по приоритету:', {
      высший: priorityGroups[1].length,
      средний: priorityGroups[2].length,
      низкий: priorityGroups[3].length
    });

    // Загружаем по приоритету
    for (const priority of [1, 2, 3] as const) {
      const group = priorityGroups[priority];
      if (group.length === 0) continue;

      logger.log(`🚀 Загружаем группу приоритета ${priority} (${group.length} превью)`);
      
      // Загружаем все превью в группе параллельно
      const loadPromises = group.map(preview => this.loadPreview(preview));
      await Promise.allSettled(loadPromises);
      
      logger.log(`✅ Группа приоритета ${priority} загружена`);
    }
  }

  // Загружаем одно превью с кешированием
  private async loadPreview(preview: PredefinedPreview): Promise<boolean> {
    const cacheKey = `${preview.stickerSetId}-${preview.stickerIndex}`;
    
    // Если уже загружено
    if (this.loadedPreviews.has(cacheKey)) {
      return true;
    }
    
    // Если уже загружается
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }
    
    // Создаем промис загрузки
    const loadPromise = this.loadSinglePreview(preview);
    this.loadingPromises.set(cacheKey, loadPromise);
    
    try {
      const success = await loadPromise;
      if (success) {
        this.loadedPreviews.add(cacheKey);
      }
      return success;
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }

  // Загружаем одно превью
  private async loadSinglePreview(preview: PredefinedPreview): Promise<boolean> {
    const sticker = preview.sticker;
    const url = sticker.is_animated 
      ? `/api/stickers/${sticker.file_id}` // Для Lottie
      : `/api/stickers/${sticker.file_id}`; // Для обычных изображений

    try {
      if (sticker.is_animated) {
        // Для Lottie загружаем JSON
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const lottieData = await response.json();
        logger.log('✅ Lottie загружен:', sticker.file_id);
        return true;
      } else {
        // Для изображений предзагружаем
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        return new Promise((resolve) => {
          img.onload = () => {
            logger.log('✅ Изображение загружено:', sticker.file_id);
            resolve(true);
          };
          img.onerror = () => {
            logger.warn('❌ Ошибка загрузки изображения:', sticker.file_id);
            resolve(false);
          };
          img.src = url;
        });
      }
    } catch (error) {
      logger.warn('❌ Ошибка загрузки превью:', sticker.file_id, error);
      return false;
    }
  }

  // Перемешивание массива
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Получить статистику загрузки
  getLoadingStats() {
    return {
      total: this.predefinedPreviews.length,
      loaded: this.loadedPreviews.size,
      loading: this.loadingPromises.size,
      progress: this.predefinedPreviews.length > 0 
        ? (this.loadedPreviews.size / this.predefinedPreviews.length * 100).toFixed(1) 
        : '0'
    };
  }
}

// Глобальный экземпляр
export const stickerPreloader = new StickerPreloader();
