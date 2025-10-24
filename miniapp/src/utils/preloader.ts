// Утилиты для предзагрузки критических ресурсов

/**
 * Предзагружает изображения для первых N паков
 */
export const preloadCriticalImages = async (packs: Array<{ randomSticker: { url: string } }>, count: number = 6): Promise<void> => {
  const criticalPacks = packs.slice(0, count);
  const imageUrls = criticalPacks
    .map(pack => pack.randomSticker.url)
    .filter(url => url);

  const preloadPromises = imageUrls.map(url => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // Игнорируем ошибки
      img.src = url;
    });
  });

  await Promise.allSettled(preloadPromises);
};

/**
 * Создает placeholder изображение для быстрого отображения
 */
export const createPlaceholder = (emoji: string, size: number = 200): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Градиентный фон
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(1, '#e0e0e0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Эмодзи в центре
    ctx.font = `${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);
  }
  
  return canvas.toDataURL();
};
