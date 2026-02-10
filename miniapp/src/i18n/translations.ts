export type SupportedLocale = 'ru' | 'en';

export type TranslationKey = 'generate.createStickerWithAI';

type TranslationTable = Record<TranslationKey, string>;

const TRANSLATIONS: Record<SupportedLocale, TranslationTable> = {
  ru: {
    'generate.createStickerWithAI': 'Создайте Стикер с ИИ',
  },
  en: {
    'generate.createStickerWithAI': 'Create Sticker with AI',
  },
};

export const normalizeLocale = (languageCode?: string | null): SupportedLocale => {
  const normalized = (languageCode || '').trim().toLowerCase();
  if (normalized.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
};

export const t = (key: TranslationKey, languageCode?: string | null): string => {
  const locale = normalizeLocale(languageCode);
  return TRANSLATIONS[locale][key] || TRANSLATIONS.en[key];
};
