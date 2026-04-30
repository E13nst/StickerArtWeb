/**
 * Поток создания персонального пресета по blueprint с бэка
 * (GET /api/generation/user-preset-creation-blueprints). Не конструктор на фронте.
 */
import type {
  CreateStylePresetRequest,
  StylePreset,
  StylePresetCategoryDto,
  StylePresetField,
  UserPresetCreationBlueprintDto,
} from '@/api/client';

/** Виртуальный пресет в UI без строки в БД (поток «свой стиль без черновика»). */
export const OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID = -9_000_001;

const PRESET_REF_KEY = 'preset_ref';

export function isOwnStyleBlueprintVirtualPreset(presetId: number | null | undefined): boolean {
  return presetId === OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID;
}

/** Карточка стиля только для формы генерации; POST /generation/style-presets не вызывается. */
export function buildVirtualOwnStylePreset(params: {
  merged: CreateStylePresetRequest;
  category: StylePresetCategoryDto | null;
  ownerProfileId: number | null | undefined;
}): StylePreset {
  const { merged, category, ownerProfileId } = params;
  return {
    id: OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID,
    code: merged.code,
    name: merged.name,
    description: merged.description ?? '',
    promptSuffix: merged.promptSuffix,
    isGlobal: false,
    isEnabled: true,
    sortOrder: typeof merged.sortOrder === 'number' ? merged.sortOrder : 0,
    category,
    uiMode: merged.uiMode ?? undefined,
    removeBackgroundMode: merged.removeBackgroundMode ?? undefined,
    promptInput: merged.promptInput ?? null,
    fields: merged.fields ?? null,
    presetReferenceImageUrl: null,
    presetReferenceSourceImageId: null,
    ownerId: ownerProfileId ?? undefined,
  };
}

function promptTemplateImpliesPresetRef(tpl: string | null | undefined): boolean {
  if (typeof tpl !== 'string' || !tpl.trim()) return false;
  return tpl.includes('{{preset_ref}}') || tpl.includes('preset_ref');
}

export function blueprintNeedsPresetReferenceSlot(
  blueprint: UserPresetCreationBlueprintDto | null | undefined,
): boolean {
  if (!blueprint) return false;
  const fields = blueprint.presetDefaults?.fields as StylePresetField[] | null | undefined;
  if (!Array.isArray(fields)) return false;
  return fields.some(
    (f) =>
      f?.type === 'reference' &&
      f?.key === PRESET_REF_KEY &&
      (Boolean(f?.system) || promptTemplateImpliesPresetRef(f?.promptTemplate)),
  );
}

/** code для POST: user_{telegramId}_{shortUuid} */
export function buildAutoStylePresetCode(telegramUserId: number | null | undefined): string {
  const u =
    telegramUserId != null && Number.isFinite(telegramUserId)
      ? String(Math.trunc(telegramUserId))
      : 'anon';
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `user_${u}_${rnd}`;
}

/**
 * Какой blueprint использовать при «+ Создать свой стиль».
 * Если задан VITE_USER_PRESET_CREATION_BLUEPRINT_ID и id найден в ответе — берём его.
 * Иначе — первый элемент после сортировки по числовому id (стабильно для UI).
 */
export function resolveCreationBlueprint(
  blueprints: UserPresetCreationBlueprintDto[],
): UserPresetCreationBlueprintDto | null {
  if (!blueprints.length) return null;
  const raw = import.meta.env.VITE_USER_PRESET_CREATION_BLUEPRINT_ID;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(n)) {
      const found = blueprints.find((b) => b.id === n);
      if (found) return found;
      if (import.meta.env.DEV) {
        console.warn(
          '[preset creation] VITE_USER_PRESET_CREATION_BLUEPRINT_ID=%s нет в списке с бэка, берём первый по id',
          raw,
        );
      }
    }
  }
  const sorted = [...blueprints].sort((a, b) => {
    const ida = typeof a.id === 'number' ? a.id : Number.MAX_SAFE_INTEGER;
    const idb = typeof b.id === 'number' ? b.id : Number.MAX_SAFE_INTEGER;
    return ida - idb;
  });
  return sorted[0] ?? null;
}
