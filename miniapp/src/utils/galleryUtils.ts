// Seeded shuffle для детерминированного перемешивания
export function seededShuffle<T>(seed: string, array: T[]): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let random: number;
  
  // Простой линейный конгруэнтный генератор
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = ((state << 5) - state + seed.charCodeAt(i)) & 0xffffffff;
  }
  
  const seededRandom = () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return state / 0x100000000;
  };
  
  while (currentIndex !== 0) {
    random = Math.floor(seededRandom() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[random]] = [shuffled[random], shuffled[currentIndex]];
  }
  
  return shuffled;
}

// LRU Cache для изображений
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private maxMemoryMB: number;
  private currentMemoryMB = 0;

  constructor(maxSize: number = 100, maxMemoryMB: number = 20) {
    this.maxSize = maxSize;
    this.maxMemoryMB = maxMemoryMB;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Переместить в конец (самый недавно использованный)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V, sizeMB?: number): void {
    // Если ключ уже существует, удалить старый
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Проверить лимиты
    while (
      (this.cache.size >= this.maxSize || 
       (sizeMB && this.currentMemoryMB + sizeMB > this.maxMemoryMB)) &&
      this.cache.size > 0
    ) {
      const firstKey = this.cache.keys().next().value;
      this.evict(firstKey);
    }

    this.cache.set(key, value);
    if (sizeMB) {
      this.currentMemoryMB += sizeMB;
    }
  }

  private evict(key: K): void {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      
      // Не отзываем blob URLs, так как теперь используем прямые URL
      // Примерная оценка размера (0.1MB на URL)
      this.currentMemoryMB = Math.max(0, this.currentMemoryMB - 0.1);
    }
  }

  delete(key: K): boolean {
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      
      // Не отзываем blob URLs, так как теперь используем прямые URL
      // Примерная оценка размера (0.1MB на URL)
      this.currentMemoryMB = Math.max(0, this.currentMemoryMB - 0.1);
      return true;
    }
    return false;
  }

  clear(): void {
    // Не отзываем blob URLs, так как теперь используем прямые URL
    this.cache.clear();
    this.currentMemoryMB = 0;
  }

  size(): number {
    return this.cache.size;
  }
}

// Глобальный LRU кеш для изображений
export const imageCache = new LRUCache<string, string>(100, 20);
