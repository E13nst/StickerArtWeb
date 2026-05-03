import type { StylePreset, StylePresetCategoryDto } from '@/api/client';

/** Сколько пресетов с категории показывать в витрине «Все» (round-robin). */
export const STYLE_PRESET_SHOWCASE_K = 1;

const nameCompare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function sortPresetsInCategory(presets: StylePreset[]): StylePreset[] {
  return [...presets].sort((a, b) => {
    const d = a.sortOrder - b.sortOrder;
    if (d !== 0) return d;
    return nameCompare(a.name, b.name);
  });
}

/** Только isEnabled; пресеты без category пропускаются (с предупреждением). */
export function groupByCategoryId(presets: StylePreset[]): Map<number, StylePreset[]> {
  const map = new Map<number, StylePreset[]>();
  let skipped = 0;
  for (const p of presets) {
    if (!p.isEnabled) continue;
    const c = p.category;
    if (c == null) {
      skipped += 1;
      continue;
    }
    const id = c.id;
    const list = map.get(id);
    if (list) list.push(p);
    else map.set(id, [p]);
  }
  if (skipped > 0) {
    console.warn(`[stylePresetCategoryUi] ${skipped} пресет(ов) без category пропущено при группировке`);
  }
  for (const [id, list] of map) {
    map.set(id, sortPresetsInCategory(list));
  }
  return map;
}

export function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Каждая категория даёт максимум k пресетов (сверху вниз по sortOrder).
 * Чередование: круг 0 — по `categoryOrder` взять индекс 0, круг 1 — индекс 1, и т.д.
 */
export function roundRobinFromGroups(
  groups: Map<number, StylePreset[]>,
  categoryOrder: number[],
  k: number,
): StylePreset[] {
  const cap = Math.max(0, k);
  const truncated = new Map<number, StylePreset[]>();
  for (const [id, list] of groups) {
    truncated.set(id, list.slice(0, cap));
  }
  const result: StylePreset[] = [];
  const seen = new Set<number>();
  let round = 0;
  for (;;) {
    let any = false;
    for (const catId of categoryOrder) {
      const list = truncated.get(catId);
      const p = list?.[round];
      if (p != null) {
        any = true;
        if (!seen.has(p.id)) {
          result.push(p);
          seen.add(p.id);
        }
      }
    }
    if (!any) break;
    round += 1;
  }
  return result;
}

export function uniqueCategoriesFromPresets(presets: StylePreset[]): StylePresetCategoryDto[] {
  const byId = new Map<number, StylePresetCategoryDto>();
  for (const p of presets) {
    const c = p.category;
    if (c == null) continue;
    if (!byId.has(c.id)) byId.set(c.id, c);
  }
  return Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/**
 * Если выбранный пресет не попал в ленту (смена категории-фильтра), показать его первым.
 */
export function ensureSelectedPresetInStrip(
  strip: StylePreset[],
  fullPresets: StylePreset[],
  selectedPresetId: number | null,
): StylePreset[] {
  if (selectedPresetId == null) return strip;
  if (strip.some((p) => p.id === selectedPresetId)) return strip;
  const p = fullPresets.find((x) => x.id === selectedPresetId);
  if (p == null) return strip;
  return [p, ...strip];
}

/** Локально поднять карточку пресета в начало ленты (после загрузки по deep link). */
export function moveStylePresetIdFirst(strip: StylePreset[], presetId: number | null): StylePreset[] {
  if (presetId == null) return strip;
  const idx = strip.findIndex((p) => p.id === presetId);
  if (idx <= 0) return strip;
  const next = [...strip];
  const [item] = next.splice(idx, 1);
  return [item, ...next];
}
