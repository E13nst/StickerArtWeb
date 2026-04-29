import type { CreateStylePresetRequest } from '@/api/client';

/**
 * Сливает presetDefaults из ответа GET …/user-preset-creation-blueprints с полями POST создания
 * персонального пресета (код, название, описание, категория и т.д.).
 */
export function mergeCreateStylePresetRequest(
  presetDefaults: Partial<CreateStylePresetRequest> & Record<string, unknown>,
  overlay: Partial<CreateStylePresetRequest>,
): CreateStylePresetRequest {
  const d = presetDefaults as Partial<CreateStylePresetRequest>;
  return {
    code: String(overlay.code ?? d.code ?? ''),
    name: String(overlay.name ?? d.name ?? ''),
    promptSuffix: String(overlay.promptSuffix ?? d.promptSuffix ?? ''),
    description: (overlay.description ?? d.description) ?? null,
    categoryId: (overlay.categoryId ?? d.categoryId) ?? null,
    sortOrder: (overlay.sortOrder ?? d.sortOrder) ?? null,
    uiMode: (overlay.uiMode ?? d.uiMode) ?? null,
    promptInput: overlay.promptInput ?? d.promptInput ?? null,
    fields: overlay.fields ?? d.fields ?? null,
    removeBackground: overlay.removeBackground ?? d.removeBackground ?? null,
    removeBackgroundMode: overlay.removeBackgroundMode ?? d.removeBackgroundMode ?? null,
  };
}
