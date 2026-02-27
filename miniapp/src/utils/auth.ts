/**
 * Глобальное хранение initData для запросов к стикерам (unpublished и т.д.).
 * Используется в imageLoader при fetch к sticker processor / API.
 */
let initData: string | null = null;

export const setInitData = (data: string | null): void => {
  initData = data;
};

export const getInitData = (): string | null => initData;
