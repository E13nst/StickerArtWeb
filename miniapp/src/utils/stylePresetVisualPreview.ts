import type { StylePreset } from '@/api/client';

const PRESET_REF_FIELD_KEY = 'preset_ref';

/**
 * Бэкенд в view=generation для «чужого» зрителя убирает слот preset_ref из fields и режет presetReference* .
 * Для превью карточки нельзя подставлять presetReferenceImageUrl как запасной вариант к previewUrl,
 * иначе визуально «протекает» опорное фото, не совпадающее с публичным превью каталога.
 * Разрешаем URL опорника только если в DTO ещё есть системное поле preset_ref (владелец / полная выдача).
 */
export function presetExposesPresetRefFieldForViewer(preset: StylePreset | null | undefined): boolean {
  return Boolean(preset?.fields?.some((f) => f.key === PRESET_REF_FIELD_KEY && f.type === 'reference'));
}

/** Только каталожное превью (без presetReferenceImageUrl) — для фона во время генерации. */
export function getStylePresetCatalogPreviewUrl(preset: StylePreset | null | undefined): string | null {
  if (!preset) return null;
  const fromCatalog =
    (typeof preset.previewWebpUrl === 'string' && preset.previewWebpUrl.trim()) ||
    (typeof preset.previewUrl === 'string' && preset.previewUrl.trim()) ||
    '';
  return fromCatalog || null;
}

/** Единая цепочка URL для миниатюр/ карточек стиля — согласовано с consumer privacy на бэке. */
export function getStylePresetVisualPreviewUrl(preset: StylePreset | null | undefined): string | null {
  const fromCatalog = getStylePresetCatalogPreviewUrl(preset);
  if (fromCatalog) return fromCatalog;
  if (presetExposesPresetRefFieldForViewer(preset)) {
    const ref = preset?.presetReferenceImageUrl?.trim();
    if (ref) return ref;
  }
  return null;
}
