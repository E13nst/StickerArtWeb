export type SupportedLocale = 'ru' | 'en';

export type TranslationKey = 'generate.createStickerWithAI' | 'generate.createStickerPrefix';

type TranslationTable = Record<TranslationKey, string>;

const TRANSLATIONS: Record<SupportedLocale, TranslationTable> = {
  ru: {
    'generate.createStickerWithAI': 'Создайте Стикер с ИИ',
    'generate.createStickerPrefix': 'Создайте Стикер с ',
  },
  en: {
    'generate.createStickerWithAI': 'Create Sticker with AI',
    'generate.createStickerPrefix': 'Create Sticker with ',
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
