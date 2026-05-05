import type { StylePreset } from '@/api/client';

/** Плейсхолдер свободного текста в шаблоне промпта пресета (сервер: StylePresetPromptComposer). */
export const STYLE_PRESET_PROMPT_PLACEHOLDER_TOKEN = '{{prompt}}';

const normUiMode = (raw: string | null | undefined): string => (typeof raw === 'string' ? raw.trim().toUpperCase() : '');

/**
 * Показывать ли в UI свободное поле промпта для данного пресета.
 * Отражает связку uiMode + promptSuffix + promptInput.enabled (как на бэкенде).
 * Не учитывает hideFreestylePromptAuthorSupplied и mute для чужого каталога — это отдельный слой приватности на странице генерации.
 */
export function isFreestylePromptVisibleForStylePreset(preset: StylePreset): boolean {
  const mode = normUiMode(preset.uiMode);

  if (mode === 'LOCKED_TEMPLATE') {
    return false;
  }

  const input = preset.promptInput;
  const enabled = Boolean(input?.enabled);

  if (mode === 'STRUCTURED_FIELDS') {
    const suffix = typeof preset.promptSuffix === 'string' ? preset.promptSuffix : '';
    const trimmed = suffix.trim();

    if (trimmed.includes(STYLE_PRESET_PROMPT_PLACEHOLDER_TOKEN)) {
      return enabled;
    }

    /*
     * При view=generation suffix может быть скрыт в DTO — тогда только promptInput.enabled с бэка
     * (ожидается согласование с StylePresetPromptComposer; иначе дефолты parsePromptInput дадут лишний слот).
     */
    if (!trimmed.length) {
      return enabled;
    }

    return false;
  }

  /* CUSTOM_PROMPT, STYLE_WITH_PROMPT, неизвестный/пустой uiMode — только явный enabled в DTO. */
  return enabled;
}
