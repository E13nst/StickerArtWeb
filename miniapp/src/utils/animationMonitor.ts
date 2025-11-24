/**
 * 🔍 Утилита для мониторинга активных анимаций и видео
 * Помогает диагностировать проблемы с производительностью
 */

interface AnimationStats {
  activeAnimations: number;
  pausedAnimations: number;
  activeVideos: number;
  pausedVideos: number;
  totalElements: number;
}

/**
 * Получить статистику активных анимаций и видео на странице
 */
export function getAnimationStats(): AnimationStats {
  // Lottie анимации (через canvas или svg)
  const lottieCanvases = document.querySelectorAll('canvas[data-lottie], svg[data-lottie]');
  const lottieElements = Array.from(lottieCanvases);
  
  // Видео элементы
  const videos = Array.from(document.querySelectorAll('video'));
  
  // Подсчитываем активные/паузированные
  let activeAnimations = 0;
  let pausedAnimations = 0;
  
  lottieElements.forEach((element) => {
    // Проверяем, виден ли элемент в viewport
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
    
    if (isVisible) {
      activeAnimations++;
    } else {
      pausedAnimations++;
    }
  });
  
  let activeVideos = 0;
  let pausedVideos = 0;
  
  videos.forEach((video) => {
    const rect = video.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
    
    if (video.paused) {
      pausedVideos++;
    } else if (isVisible) {
      activeVideos++;
    } else {
      pausedVideos++; // Видео вне viewport должно быть на паузе
    }
  });
  
  return {
    activeAnimations,
    pausedAnimations,
    activeVideos,
    pausedVideos,
    totalElements: lottieElements.length + videos.length
  };
}

/**
 * Логировать статистику анимаций (для отладки)
 */
export function logAnimationStats(): void {
  const stats = getAnimationStats();
  console.log('🎬 Статистика анимаций:', {
    ...stats,
    totalAnimations: stats.activeAnimations + stats.pausedAnimations,
    totalVideos: stats.activeVideos + stats.pausedVideos,
    shouldBePaused: stats.pausedAnimations + stats.pausedVideos,
    shouldBeActive: stats.activeAnimations + stats.activeVideos
  });
}

/**
 * Принудительно паузить все анимации и видео вне viewport
 */
export function pauseOutOfViewport(): void {
  // Lottie анимации
  const lottieCanvases = document.querySelectorAll('canvas[data-lottie], svg[data-lottie]');
  lottieCanvases.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
    
    if (!isVisible) {
      // Пытаемся найти родительский контейнер с Lottie
      const container = element.closest('[data-lottie-container]');
      if (container) {
        // Можно добавить CSS для остановки рендеринга
        (container as HTMLElement).style.display = 'none';
      }
    }
  });
  
  // Видео
  const videos = Array.from(document.querySelectorAll('video'));
  videos.forEach((video) => {
    const rect = video.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 100 && rect.bottom > -100;
    
    if (!isVisible && !video.paused) {
      video.pause();
    }
  });
}

/**
 * Экспортировать в window для доступа из консоли
 */
if (typeof window !== 'undefined') {
  (window as any).animationMonitor = {
    getStats: getAnimationStats,
    logStats: logAnimationStats,
    pauseOutOfViewport: pauseOutOfViewport
  };
  
  console.log('🔍 Animation Monitor доступен: window.animationMonitor');
}

