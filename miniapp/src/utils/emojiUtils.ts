// Утилиты для работы с эмодзи из стикерпаков

export interface EmojiInfo {
  emoji: string;
  count: number;
}

/**
 * Получает все уникальные эмодзи из стикерпака
 */
export function getUniqueEmojisFromPack(posters: Array<{ emoji?: string }>): string[] {
  const emojis = posters
    .map(poster => poster.emoji)
    .filter((emoji): emoji is string => Boolean(emoji) && emoji.trim() !== '') // Фильтруем пустые и null эмодзи
    .filter((emoji, index, array) => array.indexOf(emoji) === index); // Убираем дубликаты
  
  return emojis;
}

/**
 * Получает статистику эмодзи в стикерпаке
 */
export function getEmojiStats(posters: Array<{ emoji?: string }>): EmojiInfo[] {
  const emojiCount: Record<string, number> = {};
  
  posters.forEach(poster => {
    if (poster.emoji) {
      emojiCount[poster.emoji] = (emojiCount[poster.emoji] || 0) + 1;
    }
  });
  
  return Object.entries(emojiCount)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count); // Сортируем по частоте
}

/**
 * Получает случайные эмодзи из стикерпака
 */
export function getRandomEmojisFromPack(
  posters: Array<{ emoji?: string }>, 
  count: number = 3,
  seed?: string
): string[] {
  const uniqueEmojis = getUniqueEmojisFromPack(posters);
  
  if (uniqueEmojis.length === 0) return [];
  
  // Если эмодзи меньше или равно нужному количеству, возвращаем все
  if (uniqueEmojis.length <= count) {
    return uniqueEmojis;
  }
  
  // Используем seed для консистентного выбора
  let randomSeed = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) {
      randomSeed += seed.charCodeAt(i);
    }
  }
  
  // Простой алгоритм псевдослучайного выбора на основе seed
  const selectedEmojis: string[] = [];
  const availableEmojis = [...uniqueEmojis];
  
  for (let i = 0; i < count && availableEmojis.length > 0; i++) {
    const randomIndex = (randomSeed + i * 7) % availableEmojis.length;
    selectedEmojis.push(availableEmojis[randomIndex]);
    availableEmojis.splice(randomIndex, 1);
  }
  
  return selectedEmojis;
}

/**
 * Получает действительно случайные эмодзи из стикерпака (без seed)
 */
export function getTrulyRandomEmojisFromPack(
  posters: Array<{ emoji?: string }>, 
  count: number = 3
): string[] {
  const uniqueEmojis = getUniqueEmojisFromPack(posters);
  
  // Если нет эмодзи, возвращаем дефолтные
  if (uniqueEmojis.length === 0) {
    return ['🎨', '✨', '🎭'].slice(0, count);
  }
  
  // Если эмодзи меньше или равно нужному количеству, возвращаем все
  if (uniqueEmojis.length <= count) {
    return uniqueEmojis;
  }
  
  // Используем Fisher-Yates shuffle для действительно случайного выбора
  const shuffledEmojis = [...uniqueEmojis];
  for (let i = shuffledEmojis.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledEmojis[i], shuffledEmojis[j]] = [shuffledEmojis[j], shuffledEmojis[i]];
  }
  
  return shuffledEmojis.slice(0, count);
}

/**
 * Получает самые популярные эмодзи из стикерпака
 */
export function getTopEmojisFromPack(
  posters: Array<{ emoji?: string }>, 
  count: number = 3
): string[] {
  const emojiStats = getEmojiStats(posters);
  return emojiStats
    .slice(0, count)
    .map(stat => stat.emoji);
}
