/**
 * Throttle функция - ограничивает частоту вызова функции
 * @param func Функция для throttle
 * @param limit Минимальный интервал между вызовами в миллисекундах
 * @returns Throttled функция с методом cancel()
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T & { cancel: () => void } {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = func.apply(this, args);
      
      timeoutId = setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  } as T & { cancel: () => void };

  // Метод для отмены throttle (cleanup)
  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    inThrottle = false;
  };

  return throttled;
}

/**
 * Debounce функция - откладывает выполнение до окончания активности
 * @param func Функция для debounce
 * @param delay Задержка в миллисекундах
 * @returns Debounced функция с методом cancel()
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>): void {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

