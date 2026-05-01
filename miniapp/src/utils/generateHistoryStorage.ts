import { GenerateModelType, GenerationStatus, StylePresetModerationStatus } from '@/api/client';

export type GenerateHistoryPageState = 'uploading' | 'generating' | 'success' | 'error';
export type GenerateHistoryTerminalStatus = 'COMPLETED' | 'FAILED' | 'TIMEOUT';

export interface GenerateHistoryEntry {
  localId: string;
  taskId: string | null;
  createdAt: number;
  updatedAt: number;
  prompt: string;
  model: GenerateModelType;
  stylePresetId: number | null;
  stylePresetName?: string | null;
  stylePresetCode?: string | null;
  styleModerationStatus?: StylePresetModerationStatus | null;
  ownStyleBlueprintCode?: string | null;
  selectedEmoji: string;
  removeBackground: boolean;
  hasSourceImage: boolean;
  pageState: GenerateHistoryPageState;
  generationStatus: GenerationStatus | null;
  resultImageUrl: string | null;
  imageId: string | null;
  fileId: string | null;
  referenceAssignmentsSnapshot?: Record<string, string[]> | null;
  referencePreviewSnapshot?: Record<string, string> | null;
  savedStickerSetName?: string | null;
  savedStickerSetTitle?: string | null;
  errorMessage: string | null;
  isActive: boolean;
}

const HISTORY_STORAGE_VERSION = 1;
const HISTORY_STORAGE_PREFIX = `stixly:generate-history:v${HISTORY_STORAGE_VERSION}`;
const HISTORY_MAX_ITEMS = 20;
const HISTORY_REF_MAX_IDS = 24;
const HISTORY_REF_MAX_PER_FIELD = 6;
const HISTORY_REF_PREVIEW_MAX_CHARS = 220_000;
const HISTORY_REF_PREVIEW_BUDGET_PER_ENTRY_CHARS = 900_000;

const isBrowser = (): boolean => typeof window !== 'undefined' && !!window.localStorage;

const getStorageKey = (userScopeId: string): string => `${HISTORY_STORAGE_PREFIX}:${userScopeId}`;

const isValidPageState = (value: unknown): value is GenerateHistoryPageState =>
  value === 'uploading' || value === 'generating' || value === 'success' || value === 'error';

const isValidModel = (value: unknown): value is GenerateModelType =>
  value === 'flux-schnell' || value === 'nanabanana';

const isValidGenerationStatus = (value: unknown): value is GenerationStatus =>
  value === 'PROCESSING_PROMPT' ||
  value === 'PENDING' ||
  value === 'GENERATING' ||
  value === 'REMOVING_BACKGROUND' ||
  value === 'COMPLETED' ||
  value === 'FAILED' ||
  value === 'TIMEOUT';

const isValidModerationStatus = (value: unknown): value is StylePresetModerationStatus =>
  value === 'DRAFT' ||
  value === 'PENDING_MODERATION' ||
  value === 'APPROVED' ||
  value === 'REJECTED';

const sanitizeReferenceAssignmentsSnapshot = (value: unknown): Record<string, string[]> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string[]> = {};
  const source = value as Record<string, unknown>;
  const acceptedIds = new Set<string>();
  for (const [fieldKeyRaw, rawIds] of Object.entries(source)) {
    if (!fieldKeyRaw || typeof fieldKeyRaw !== 'string') continue;
    if (!Array.isArray(rawIds)) continue;
    const fieldKey = fieldKeyRaw.trim();
    if (!fieldKey) continue;
    const ids: string[] = [];
    for (const raw of rawIds) {
      if (typeof raw !== 'string') continue;
      const id = raw.trim();
      if (!id || acceptedIds.has(id)) continue;
      ids.push(id);
      acceptedIds.add(id);
      if (ids.length >= HISTORY_REF_MAX_PER_FIELD || acceptedIds.size >= HISTORY_REF_MAX_IDS) break;
    }
    if (ids.length > 0) out[fieldKey] = ids;
    if (acceptedIds.size >= HISTORY_REF_MAX_IDS) break;
  }
  return Object.keys(out).length > 0 ? out : null;
};

const sanitizeReferencePreviewSnapshot = (
  value: unknown,
  allowedIds: Set<string>,
): Record<string, string> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || allowedIds.size === 0) return null;
  const out: Record<string, string> = {};
  const source = value as Record<string, unknown>;
  let usedBudget = 0;
  for (const [idRaw, previewRaw] of Object.entries(source)) {
    if (typeof idRaw !== 'string' || !allowedIds.has(idRaw)) continue;
    if (typeof previewRaw !== 'string') continue;
    const preview = previewRaw.trim();
    if (!preview || preview.length > HISTORY_REF_PREVIEW_MAX_CHARS) continue;
    if (usedBudget + preview.length > HISTORY_REF_PREVIEW_BUDGET_PER_ENTRY_CHARS) break;
    out[idRaw] = preview;
    usedBudget += preview.length;
  }
  return Object.keys(out).length > 0 ? out : null;
};

const toEntry = (value: unknown): GenerateHistoryEntry | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.localId !== 'string' || raw.localId.length === 0) return null;
  if (!(typeof raw.taskId === 'string' || raw.taskId === null)) return null;
  if (typeof raw.createdAt !== 'number' || typeof raw.updatedAt !== 'number') return null;
  if (typeof raw.prompt !== 'string') return null;
  if (!isValidModel(raw.model)) return null;
  if (!(typeof raw.stylePresetId === 'number' || raw.stylePresetId === null)) return null;
  if (!('stylePresetName' in raw) || !(typeof raw.stylePresetName === 'string' || raw.stylePresetName === null)) {
    raw.stylePresetName = null;
  }
  if (!('stylePresetCode' in raw) || !(typeof raw.stylePresetCode === 'string' || raw.stylePresetCode === null)) {
    raw.stylePresetCode = null;
  }
  if (
    !('styleModerationStatus' in raw) ||
    !(raw.styleModerationStatus === null || isValidModerationStatus(raw.styleModerationStatus))
  ) {
    raw.styleModerationStatus = null;
  }
  if (
    !('ownStyleBlueprintCode' in raw) ||
    !(typeof raw.ownStyleBlueprintCode === 'string' || raw.ownStyleBlueprintCode === null)
  ) {
    raw.ownStyleBlueprintCode = null;
  }
  if (typeof raw.selectedEmoji !== 'string') return null;
  if (typeof raw.removeBackground !== 'boolean') return null;
  if (typeof raw.hasSourceImage !== 'boolean') return null;
  if (!isValidPageState(raw.pageState)) return null;
  if (!(raw.generationStatus === null || isValidGenerationStatus(raw.generationStatus))) return null;
  if (!(typeof raw.resultImageUrl === 'string' || raw.resultImageUrl === null)) return null;
  if (!(typeof raw.imageId === 'string' || raw.imageId === null)) return null;
  if (!(typeof raw.fileId === 'string' || raw.fileId === null)) return null;
  if (!('savedStickerSetName' in raw) || !(typeof raw.savedStickerSetName === 'string' || raw.savedStickerSetName === null)) {
    raw.savedStickerSetName = null;
  }
  if (!('savedStickerSetTitle' in raw) || !(typeof raw.savedStickerSetTitle === 'string' || raw.savedStickerSetTitle === null)) {
    raw.savedStickerSetTitle = null;
  }
  if (!(typeof raw.errorMessage === 'string' || raw.errorMessage === null)) return null;
  if (typeof raw.isActive !== 'boolean') return null;

  const savedStickerSetName = typeof raw.savedStickerSetName === 'string' || raw.savedStickerSetName === null
    ? raw.savedStickerSetName
    : null;
  const savedStickerSetTitle = typeof raw.savedStickerSetTitle === 'string' || raw.savedStickerSetTitle === null
    ? raw.savedStickerSetTitle
    : null;
  const stylePresetName = typeof raw.stylePresetName === 'string' || raw.stylePresetName === null
    ? raw.stylePresetName
    : null;
  const stylePresetCode = typeof raw.stylePresetCode === 'string' || raw.stylePresetCode === null
    ? raw.stylePresetCode
    : null;
  const styleModerationStatus =
    raw.styleModerationStatus === null || isValidModerationStatus(raw.styleModerationStatus)
      ? raw.styleModerationStatus
      : null;
  const ownStyleBlueprintCode =
    typeof raw.ownStyleBlueprintCode === 'string' || raw.ownStyleBlueprintCode === null
      ? raw.ownStyleBlueprintCode
      : null;
  const referenceAssignmentsSnapshot = sanitizeReferenceAssignmentsSnapshot(raw.referenceAssignmentsSnapshot);
  const referenceIds = new Set<string>();
  if (referenceAssignmentsSnapshot) {
    Object.values(referenceAssignmentsSnapshot).forEach((ids) => {
      ids.forEach((id) => referenceIds.add(id));
    });
  }
  const referencePreviewSnapshot = sanitizeReferencePreviewSnapshot(raw.referencePreviewSnapshot, referenceIds);

  return {
    localId: raw.localId,
    taskId: raw.taskId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    prompt: raw.prompt,
    model: raw.model,
    stylePresetId: raw.stylePresetId,
    stylePresetName,
    stylePresetCode,
    styleModerationStatus,
    ownStyleBlueprintCode,
    selectedEmoji: raw.selectedEmoji,
    removeBackground: raw.removeBackground,
    hasSourceImage: raw.hasSourceImage,
    pageState: raw.pageState,
    generationStatus: raw.generationStatus,
    resultImageUrl: raw.resultImageUrl,
    imageId: raw.imageId,
    fileId: raw.fileId,
    referenceAssignmentsSnapshot,
    referencePreviewSnapshot,
    savedStickerSetName,
    savedStickerSetTitle,
    errorMessage: raw.errorMessage,
    isActive: raw.isActive,
  };
};

const normalizeEntries = (entries: GenerateHistoryEntry[]): GenerateHistoryEntry[] => {
  return entries
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, HISTORY_MAX_ITEMS);
};

const writeEntries = (userScopeId: string, entries: GenerateHistoryEntry[]): GenerateHistoryEntry[] => {
  const normalized = normalizeEntries(entries);
  if (!isBrowser()) return normalized;
  try {
    window.localStorage.setItem(getStorageKey(userScopeId), JSON.stringify(normalized));
  } catch {
    // ignore write failures for best-effort persistence
  }
  return normalized;
};

export const createGenerateHistoryLocalId = (): string => {
  return `gh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const readGenerateHistory = (userScopeId: string): GenerateHistoryEntry[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(userScopeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeEntries(parsed.map(toEntry).filter((entry): entry is GenerateHistoryEntry => entry !== null));
  } catch {
    return [];
  }
};

export const upsertGenerateHistoryEntry = (
  userScopeId: string,
  nextEntry: GenerateHistoryEntry
): GenerateHistoryEntry[] => {
  const prev = readGenerateHistory(userScopeId);
  const withoutCurrent = prev.filter((entry) => entry.localId !== nextEntry.localId);
  const merged = nextEntry.isActive
    ? [nextEntry, ...withoutCurrent.map((entry) => ({ ...entry, isActive: false }))]
    : [nextEntry, ...withoutCurrent];
  return writeEntries(userScopeId, merged);
};

export const updateGenerateHistoryEntry = (
  userScopeId: string,
  matcher: { localId?: string; taskId?: string },
  patch: Partial<GenerateHistoryEntry>
): GenerateHistoryEntry[] => {
  const prev = readGenerateHistory(userScopeId);
  if (!matcher.localId && !matcher.taskId) return prev;

  let found = false;
  const updated = prev.map((entry) => {
    const isMatch =
      (matcher.localId && entry.localId === matcher.localId) ||
      (matcher.taskId && entry.taskId != null && entry.taskId === matcher.taskId);
    if (!isMatch) return entry;
    found = true;
    return {
      ...entry,
      ...patch,
      updatedAt: typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now(),
    };
  });

  if (!found) return prev;

  const withSingleActive = updated.some((entry) => entry.isActive)
    ? (() => {
        let activeUsed = false;
        return updated.map((entry) => {
          if (!entry.isActive) return entry;
          if (activeUsed) return { ...entry, isActive: false };
          activeUsed = true;
          return entry;
        });
      })()
    : updated;

  return writeEntries(userScopeId, withSingleActive);
};

export const clearActiveGenerateHistoryEntry = (userScopeId: string): GenerateHistoryEntry[] => {
  const prev = readGenerateHistory(userScopeId);
  const updated = prev.map((entry) => ({ ...entry, isActive: false }));
  return writeEntries(userScopeId, updated);
};

export const deleteGenerateHistoryEntry = (
  userScopeId: string,
  matcher: { localId?: string; taskId?: string }
): GenerateHistoryEntry[] => {
  const prev = readGenerateHistory(userScopeId);
  if (!matcher.localId && !matcher.taskId) return prev;

  const filtered = prev.filter((entry) => {
    const matchesLocalId = matcher.localId && entry.localId === matcher.localId;
    const matchesTaskId = matcher.taskId && entry.taskId != null && entry.taskId === matcher.taskId;
    return !(matchesLocalId || matchesTaskId);
  });

  return writeEntries(userScopeId, filtered);
};

export const clearGenerateHistory = (userScopeId: string): GenerateHistoryEntry[] => {
  if (!isBrowser()) return [];
  try {
    window.localStorage.removeItem(getStorageKey(userScopeId));
  } catch {
    // ignore storage failures in private mode / webview quirks
  }
  return [];
};
