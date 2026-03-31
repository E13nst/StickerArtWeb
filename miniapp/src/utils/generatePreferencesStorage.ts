import type { GenerateModelType } from '@/api/client';

export interface GeneratePreferences {
  selectedModel: GenerateModelType;
  stylePresetId: number | null;
  selectedEmoji: string;
  removeBackground: boolean;
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = `stixly:generate-preferences:v${STORAGE_VERSION}`;

const isBrowser = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

const getStorageKey = (userScopeId: string): string => `${STORAGE_PREFIX}:${userScopeId}`;

const isValidModel = (value: unknown): value is GenerateModelType =>
  value === 'flux-schnell' || value === 'nanabanana';

const toPreferences = (value: unknown): GeneratePreferences | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  if (!isValidModel(raw.selectedModel)) return null;
  if (!(typeof raw.stylePresetId === 'number' || raw.stylePresetId === null)) return null;
  if (typeof raw.selectedEmoji !== 'string' || raw.selectedEmoji.trim().length === 0) return null;
  if (typeof raw.removeBackground !== 'boolean') return null;

  return {
    selectedModel: raw.selectedModel,
    stylePresetId: raw.stylePresetId,
    selectedEmoji: raw.selectedEmoji,
    removeBackground: raw.removeBackground,
  };
};

export const readGeneratePreferences = (userScopeId: string): GeneratePreferences | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(userScopeId));
    if (!raw) return null;
    return toPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeGeneratePreferences = (
  userScopeId: string,
  preferences: GeneratePreferences
): GeneratePreferences => {
  if (!isBrowser()) return preferences;
  try {
    window.localStorage.setItem(getStorageKey(userScopeId), JSON.stringify(preferences));
  } catch {
    // ignore write failures for best-effort persistence
  }
  return preferences;
};
