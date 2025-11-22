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
    .filter((emoji): emoji is string => Boolean(emoji) && emoji.trim() !== ''); // Фильтруем пустые и null эмодзи 
  
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
