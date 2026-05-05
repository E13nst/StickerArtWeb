import {
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
  FC,
  ChangeEvent,
  ClipboardEvent,
  DragEvent as ReactDragEvent,
  useMemo,
  CSSProperties,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { GenerateHeroCard } from '@/components/GenerateHeroCard';
import { StylePresetPickOverlay } from '@/components/StylePresetPickOverlay';
import { StylePresetPackGrid } from '@/components/StylePresetPackGrid';
import { StylePresetPublicationModal } from '@/components/StylePresetPublicationModal';
import { mergeCreateStylePresetRequest } from '@/utils/mergeCreateStylePresetRequest';
import { uploadPresetReference } from '@/api/stylePresets';
import {
  blueprintNeedsPresetReferenceSlot,
  buildAutoStylePresetCode,
  buildVirtualOwnStylePreset,
  isOwnStyleBlueprintVirtualPreset,
  OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID,
  resolveCreationBlueprint,
} from '@/utils/ownStyleBlueprint';
import {
  StylePresetCategoryChips,
  STYLE_CATEGORY_FILTER_MY,
  type StyleCategoryFilter,
} from '@/components/StylePresetCategoryChips';
import { PresetFieldsForm } from '@/components/PresetFieldsForm';
import { hasExternalFilesDrag, setSourceStripDragData } from '@/components/referenceDnd';
import type { PresetReferenceMovePayload } from '@/components/PresetReferenceField';
import { AttachmentPointerDragProvider } from '@/components/AttachmentPointerDragContext';
import type { DraggingPayload, DropTarget } from '@/components/AttachmentPointerDragContext';
import { SourceImageStripItem } from '@/components/SourceImageStripItem';
import './GeneratePage.css';
import {
  apiClient,
  type CreateStylePresetRequest,
  GenerateModelType,
  GenerationStatus,
  type UploadImagesResponse,
  StylePreset,
  StylePresetCategoryDto,
  StylePresetField,
  StylePresetRemoveBgMode,
  UserPresetCreationBlueprintDto,
} from '@/api/client';
import {
  ensureSelectedPresetInStrip,
  moveStylePresetIdFirst,
  sortPresetsInCategory,
  uniqueCategoriesFromPresets,
} from '@/utils/stylePresetCategoryUi';
import { useProfileStore } from '@/store/useProfileStore';
import { useGenerateLandingGateStore } from '@/store/useGenerateLandingGateStore';
import { useGenerateHistoryHeaderStore } from '@/store/useGenerateHistoryHeaderStore';
import { useTelegram } from '@/hooks/useTelegram';
import { useHorizontalScrollStrip } from '@/hooks/useHorizontalScrollStrip';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { DownloadIcon } from '@/components/ui/Icons';
import { buildSwitchInlineQuery, buildFallbackShareUrl, removeInvisibleChars, isValidTelegramFileId, getPlatformInfo } from '@/utils/stickerUtils';
import { SaveToStickerSetModal } from '@/components/SaveToStickerSetModal';
import { ModalBackdrop } from '@/components/ModalBackdrop';
import { GenerateImageLightbox } from '@/components/GenerateImageLightbox';
import { resolveAvatarContext } from '@/utils/resolvedAvatar';
import { isApiHostedArtifactUrl, onApiHostedImageError } from '@/utils/apiImageFallback';
import {
  clearGenerateHistory,
  clearActiveGenerateHistoryEntry,
  createGenerateHistoryLocalId,
  deleteGenerateHistoryEntry,
  GenerateHistoryEntry,
  readGenerateHistory,
  upsertGenerateHistoryEntry,
  updateGenerateHistoryEntry,
} from '@/utils/generateHistoryStorage';
import { readHistoryHeadAck, writeHistoryHeadAck } from '@/utils/historyHeadAckStorage';
import { readGeneratePreferences, writeGeneratePreferences } from '@/utils/generatePreferencesStorage';
import {
  GENERATE_LANDING_PRIMED_SESSION_KEY,
  getGenerateResumeLocalIdKey,
} from '@/utils/generateRouteSession';
import { waitGenerateLandingViewportMedia } from '@/utils/waitGenerateLandingViewportMedia';
import {
  parseStylePresetIdFromStartParam,
  REFERRAL_START_PARAM_PREFIX,
  resolveTelegramStartParam,
} from '@/utils/stylePresetDeepLink';
import { POPULAR_EMOJIS } from '@/constants/popularEmojis';
type PageState = 'idle' | 'uploading' | 'generating' | 'success' | 'error';
type ErrorKind = 'prompt' | 'upload' | 'general';

type GenerateImageLightboxState = {
  viewerUrl: string;
  alt?: string;
  /** Если null — FAB скачивания в полноэкранном режиме скрыт */
  downloadUrl?: string | null;
};


/** Сообщение для tg-spinner__message: upload -> start -> generate */
const getGeneratingSpinnerMessage = (pageState: PageState, status: GenerationStatus | null): string => {
  if (pageState === 'uploading') return 'Загружаем фото';
  if (status === 'GENERATING' || status === 'REMOVING_BACKGROUND') return 'Создаем шедевр';
  return 'Улучшаем промпт'; // PROCESSING_PROMPT, PENDING, null и остальные
};

const POLLING_INTERVAL = 2000;
const POLLING_TIMEOUT_MS = 600000;
const MAX_PROMPT_LENGTH = 1000;
const MIN_PROMPT_LENGTH = 1;
const PROMPT_ROWS = 3;
const SAVE_TO_SET_WAIT_TIMEOUT_SEC = 300;
const SENSITIVE_CONTENT_ERROR_MESSAGE =
  'NanoBanana считает, что генерация похожа на чувствительный контент (sensitive content). Попробуйте еще раз или немного перефразируйте промпт.';
const BACKGROUND_REMOVE_FALLBACK_NOTICE =
  'Не удалось удалить фон, поэтому показан вариант без удаления фона.';
const DEFAULT_STICKER_BOT_SUFFIX = '_by_stixlybot';
const SOURCE_IMAGE_ID_REUSE_WINDOW_MS = 5 * 60 * 1000;
const MAX_SOURCE_IMAGE_FILES = 14;
const SOURCE_IMAGE_FINGERPRINT_SAMPLE_BYTES = 64 * 1024;
const TERMINAL_GENERATION_STATUSES: GenerationStatus[] = ['COMPLETED', 'FAILED', 'TIMEOUT'];
const HISTORY_PRESET_PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HISTORY_REF_CACHE_MAX_IDS = 24;
const HISTORY_REF_CACHE_MAX_PER_FIELD = 6;
const MODERATION_STATUS_LABELS: Record<NonNullable<StylePreset['moderationStatus']>, string> = {
  DRAFT: 'Черновик',
  PENDING_MODERATION: 'На модерации',
  APPROVED: 'Опубликован',
  REJECTED: 'Отклонён',
};
const DEFAULT_GENERATE_MODEL: GenerateModelType = 'nanabanana';
const DEFAULT_GENERATE_EMOJI = '🎨';
const DEFAULT_REMOVE_BACKGROUND = true;
const TELEGRAM_AVATAR_DISMISSED_STORAGE_KEY = 'generate_telegram_avatar_dismissed';
const LAST_USED_SAVE_TARGET_STORAGE_PREFIX = 'stixly:generate-last-used-save-target:v1';
const LEGACY_DEFAULT_SAVE_TARGET_STORAGE_PREFIX = 'stixly:generate-default-save-target:v1';
const PRESET_PREVIEW_FALLBACK_BY_CODE: Partial<Record<string, string>> = {};
/** Ключ слота предустановленного референса стиля в preset_fields */
const PRESET_REF_FIELD_KEY = 'preset_ref';
/** Плейсхолдер prompt при «Черновик», если уже есть результат в истории — подменяем «создайте стиль» с бэка */
const OWN_STYLE_AFTER_LAST_RESULT_PLACEHOLDER =
  'Уточните доработку к результату последней генерации (он показан выше) или опишите новую идею…';

function assertPresetRefGalleryImageIds(ids: readonly string[]): void {
  const bad = ids.find((id) => id && !String(id).startsWith('img_sagref_'));
  if (!bad) return;
  throw new Error(
    'Опорное фото должно быть сохранено в галерее как img_sagref_* (через /style-presets/{id}/reference); сервер вернул другой идентификатор.',
  );
}

/** Категория основных пресетов: code `general` или имя General / «Общая» (локализация). */
function preferDefaultStyleCategoryId(categories: StylePresetCategoryDto[]): number {
  const generalByCode = categories.find((c) => c.code?.trim().toLowerCase() === 'general');
  if (generalByCode) return generalByCode.id;
  const generalByName = categories.find((c) => {
    const n = c.name?.trim().toLowerCase() ?? '';
    return n === 'общая' || n === 'общие' || n === 'general';
  });
  if (generalByName) return generalByName.id;
  return categories[0]!.id;
}

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

const getImageDownloadExtension = (contentType: string | null | undefined, url: string): string => {
  const normalizedType = contentType?.split(';')[0]?.trim().toLowerCase();
  if (normalizedType === 'image/jpeg') return 'jpg';
  if (normalizedType === 'image/png') return 'png';
  if (normalizedType === 'image/webp') return 'webp';
  if (normalizedType === 'image/gif') return 'gif';

  try {
    const pathname = new URL(url, window.location.href).pathname;
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    const ext = match?.[1]?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {
    // Ignore malformed URLs and fall back to PNG.
  }

  return 'png';
};

const triggerImageDownload = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function mapGenerationErrorMessage(rawMessage: string | null | undefined): string | null {
  if (!rawMessage) return null;
  const normalizedMessage = rawMessage.toLowerCase();
  if (
    normalizedMessage.includes('sensitive content') ||
    normalizedMessage.includes('sensitive') ||
    normalizedMessage.includes('content policy') ||
    normalizedMessage.includes('safety')
  ) {
    return SENSITIVE_CONTENT_ERROR_MESSAGE;
  }
  return rawMessage;
}

function getPresetReferenceSlotSourceId(preset: StylePreset | null | undefined): string | null {
  const raw = preset?.presetReferenceSourceImageId;
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  // В slot preset_ref должны уходить только gallery/processor image-id формата img_*.
  // Некоторые старые записи могут содержать UUID файла — такой id ломает /generation/v2/generate.
  if (!id || !id.startsWith('img_')) return null;
  return id;
}

function presetHasPresetReferenceField(preset: StylePreset | null | undefined): boolean {
  return Boolean(preset?.fields?.some((f) => f.key === PRESET_REF_FIELD_KEY && f.type === 'reference'));
}

function isLockedServerPresetReferenceSlot(preset: StylePreset | null | undefined): boolean {
  return Boolean(getPresetReferenceSlotSourceId(preset) && presetHasPresetReferenceField(preset));
}

function resolveRemoveBackground(
  presetMode: StylePresetRemoveBgMode | null | undefined,
  userValue: boolean,
): { value: boolean; userControlled: boolean } {
  if (presetMode === 'FORCE_ON')  return { value: true,      userControlled: false };
  if (presetMode === 'FORCE_OFF') return { value: false,     userControlled: false };
  return                                 { value: userValue, userControlled: true  };
}

const parseGenerationMetadata = (
  metadata: unknown
): { background_remove_fallback_applied?: boolean } | null => {
  if (!metadata) {
    return null;
  }

  const parsedMetadata =
    typeof metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(metadata) as unknown;
          } catch {
            return null;
          }
        })()
      : metadata;

  if (!parsedMetadata || typeof parsedMetadata !== 'object' || Array.isArray(parsedMetadata)) {
    return null;
  }

  return parsedMetadata as { background_remove_fallback_applied?: boolean };
};

const getStickerProcessorFileId = (imageId: string | null): string | undefined =>
  imageId?.startsWith('ws_') ? imageId : undefined;

const stripPresetName = (name: string) =>
  name.replace(/\s*Sticker\s*/gi, ' ').replace(/\s*Style\s*/gi, ' ').replace(/\s+/g, ' ').trim();

const normalizeStickerSetBase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildDefaultStickerSetName = (params: {
  username?: string | null;
  firstName?: string | null;
  userId?: number | null;
}): string => {
  const usernameBase = normalizeStickerSetBase(params.username ?? '');
  if (usernameBase) {
    return usernameBase.endsWith(DEFAULT_STICKER_BOT_SUFFIX)
      ? usernameBase
      : `${usernameBase}${DEFAULT_STICKER_BOT_SUFFIX}`;
  }

  const firstNameBase = normalizeStickerSetBase(params.firstName ?? '');
  if (firstNameBase) {
    return `${firstNameBase}${DEFAULT_STICKER_BOT_SUFFIX}`;
  }

  return `user_${params.userId ?? 'pack'}${DEFAULT_STICKER_BOT_SUFFIX}`;
};

const buildDefaultStickerSetTitle = (params: {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  userId?: number | null;
}): string => {
  const username = (params.username ?? '').trim();
  if (username) {
    return `@${username}`;
  }

  const fullName = `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim();
  if (fullName) {
    return fullName;
  }

  return `User ${params.userId ?? ''}`.trim();
};

const isTrustedAutoSaveStickerSet = (set: { name: string; title?: string; userId?: number }, effectiveUserId: number): boolean => {
  const normalizedName = set.name.trim().toLowerCase();
  if (!normalizedName.endsWith(DEFAULT_STICKER_BOT_SUFFIX)) {
    return false;
  }

  if (normalizedName.endsWith('_by_stickergallerybot')) {
    return false;
  }

  if (typeof set.userId === 'number' && set.userId !== effectiveUserId) {
    return false;
  }

  return true;
};

const getTelegramAvatarDismissedStorageKey = (telegramUserId: number): string =>
  `${TELEGRAM_AVATAR_DISMISSED_STORAGE_KEY}:${telegramUserId}`;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('DATA_URL_READ_FAILED'));
      }
    };
    reader.onerror = () => reject(new Error('DATA_URL_READ_FAILED'));
    reader.readAsDataURL(blob);
  });

const getSourceImageLimitMessage = (): string =>
  `Можно прикрепить не больше ${MAX_SOURCE_IMAGE_FILES} изображений. Лишние изображения не добавлены.`;

const collectUniqueReferenceImageIds = (assignments: Record<string, string[]>): Set<string> => {
  const s = new Set<string>();
  Object.values(assignments).forEach((arr) => {
    arr.forEach((id) => {
      if (id) s.add(id);
    });
  });
  return s;
};

/** Порядок: поля пресета → слоты 0…max − 1; заблокированные и excludeKeys ключи пропускаются. */
const findNextEmptyReferenceSlot = (
  assignments: Record<string, string[]>,
  fieldDefs: StylePresetField[],
  lockedKeys: Set<string>,
  excludeKeys?: ReadonlySet<string>,
): { fieldKey: string; index: number } | null => {
  for (const f of fieldDefs) {
    if (f.type !== 'reference') continue;
    if (lockedKeys.has(f.key)) continue;
    if (excludeKeys?.has(f.key)) continue;
    const maxSlot = Math.max(1, f.maxImages ?? 1);
    const list = assignments[f.key] ?? [];
    for (let i = 0; i < maxSlot; i++) {
      if (!list[i]) {
        return { fieldKey: f.key, index: i };
      }
    }
  }
  return null;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const isTelegramAvatarSourceFile = (file?: File | null): boolean =>
  Boolean(file && /^telegram-avatar\./i.test(file.name));

const computeSourceImageOriginFromFiles = (files: File[]): 'none' | 'manual' | 'telegram-avatar' => {
  if (files.length === 0) return 'none';
  if (files.every((f) => isTelegramAvatarSourceFile(f))) return 'telegram-avatar';
  return 'manual';
};

const getServerStylePresetCardPreview = (preset: StylePreset): string | null =>
  preset.previewWebpUrl ?? preset.previewUrl ?? preset.presetReferenceImageUrl ?? null;

const getLastUsedSaveTargetStorageKey = (userScopeId: string): string =>
  `${LAST_USED_SAVE_TARGET_STORAGE_PREFIX}:${userScopeId}`;

const getLegacyDefaultSaveTargetStorageKey = (userScopeId: string): string =>
  `${LEGACY_DEFAULT_SAVE_TARGET_STORAGE_PREFIX}:${userScopeId}`;

const parseSaveTargetPayload = (raw: string | null): { name: string | null; title: string | null } | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { name?: unknown; title?: unknown };
    return {
      name: typeof parsed.name === 'string' ? parsed.name : null,
      title: typeof parsed.title === 'string' ? parsed.title : null,
    };
  } catch {
    return null;
  }
};

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';
const STIXLY_LOGO_ORANGE = `${BASE}assets/stixly-logo-orange.webp`;
const MODEL_OPTIONS: Array<{ id: GenerateModelType; name: string }> = [
  { id: 'nanabanana', name: 'Nano 🍌' },
];
const SOURCE_IMAGE_MODEL: GenerateModelType = 'nanabanana';
const AVAILABLE_MODEL_IDS = new Set<GenerateModelType>(MODEL_OPTIONS.map((option) => option.id));
const normalizeGenerateModel = (model: GenerateModelType | null | undefined): GenerateModelType =>
  model && AVAILABLE_MODEL_IDS.has(model) ? model : DEFAULT_GENERATE_MODEL;

export const GeneratePage: FC = () => {
  // Telegram WebApp SDK
  const { isInTelegramApp, tg, user, initData, isMockMode } = useTelegram();
  const location = useLocation();
  
  // Inline-режим параметры из URL
  const [, setInlineQueryId] = useState<string | null>(null);
  const [, setUserId] = useState<string | null>(null);
  
  // Состояние формы
  const [prompt, setPrompt] = useState('');
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [styleCatalogLoaded, setStyleCatalogLoaded] = useState(false);
  // Объявляем здесь — до gate-эффектов, чтобы использование в dependency array
  // не попадало в TDZ (const не hoistится как var).
  const hasMyProfileLoaded = useProfileStore((state) => state.hasMyProfileLoaded);

  // Полноэкранный гейт — только сигнал для MainLayout; контент уже под оверлеем.
  const [gateMinDelayDone, setGateMinDelayDone] = useState(false);
  /** Картинки вviewport (герой / лента / шапка / видимые плитки) дорисованы — можно начинать съезд overlay. */
  const [landingViewportMediaPrimed, setLandingViewportMediaPrimed] = useState(false);
  const releaseLandingOverlay = useGenerateLandingGateStore((s) => s.release);
  const landingReleased = useGenerateLandingGateStore((s) => s.isReleased);

  useEffect(() => {
    const t = setTimeout(() => setGateMinDelayDone(true), 700);
    return () => clearTimeout(t);
  }, []);

  /** Параллельно с минимальной задержкой подгружаем видимые картинки, чтобы они были уже в кадре при анимации overlay. */
  useEffect(() => {
    if (!(styleCatalogLoaded && hasMyProfileLoaded && gateMinDelayDone)) {
      setLandingViewportMediaPrimed(false);
      return undefined;
    }
    let cancelled = false;
    setLandingViewportMediaPrimed(false);

    void waitGenerateLandingViewportMedia(11500).then(() => {
      if (!cancelled) setLandingViewportMediaPrimed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [styleCatalogLoaded, hasMyProfileLoaded, gateMinDelayDone]);

  useEffect(() => {
    if (!(styleCatalogLoaded && hasMyProfileLoaded && gateMinDelayDone && landingViewportMediaPrimed)) {
      return;
    }
    try {
      sessionStorage.setItem(GENERATE_LANDING_PRIMED_SESSION_KEY, '1');
    } catch {
      /* private mode / WebView */
    }
    releaseLandingOverlay();
  }, [
    styleCatalogLoaded,
    hasMyProfileLoaded,
    gateMinDelayDone,
    landingViewportMediaPrimed,
    releaseLandingOverlay,
  ]);

  /** Если каталог/профиль/initData залипли, не держим полноэкранный лоадер бесконечно. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!useGenerateLandingGateStore.getState().isReleased) {
        console.warn(
          '[GeneratePage] Landing gate: принудительное снятие через 15s. Проверьте initData, API профиля, загрузку JS-чанка страницы.',
        );
        releaseLandingOverlay();
      }
    }, 15_000);
    return () => window.clearTimeout(t);
  }, [releaseLandingOverlay]);

  /** После снятия загрузочного гейта «дорисовка» промпта/полей уже могла изменить scrollTop — фиксируем верх, чтобы была видна свайп-карточка стиля. */
  useLayoutEffect(() => {
    if (!landingReleased || typeof document === 'undefined') return;
    const sp = document.querySelector('.stixly-main-scroll');
    if (!(sp instanceof HTMLElement)) return;
    sp.scrollTop = 0;
  }, [landingReleased]);

  useEffect(() => {
    if (!landingReleased || typeof document === 'undefined') return;
    const sp = document.querySelector('.stixly-main-scroll');
    const pinTop = () => {
      if (sp instanceof HTMLElement) sp.scrollTop = 0;
    };
    pinTop();
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      pinTop();
      raf2 = window.requestAnimationFrame(pinTop);
    });
    const t = window.setTimeout(pinTop, 180);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [landingReleased]);

  const [deepLinkStyleBoostId, setDeepLinkStyleBoostId] = useState<number | null>(null);
  const [deepLinkPresetMissingNotice, setDeepLinkPresetMissingNotice] = useState(false);
  const [stylePresetShareNotice, setStylePresetShareNotice] = useState<string | null>(null);
  const [stylePresetDeleting, setStylePresetDeleting] = useState(false);
  const [stylePresetCategories, setStylePresetCategories] = useState<StylePresetCategoryDto[]>([]);
  const [styleCategoryFilter, setStyleCategoryFilter] = useState<StyleCategoryFilter | null>(null);
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<number | null>(null);
  const [pendingGridStylePick, setPendingGridStylePick] = useState<StylePreset | null>(null);
  const [bootstrappingOwnStyle, setBootstrappingOwnStyle] = useState(false);
  const ownStyleBootstrapRef = useRef(false);
  const [ownStyleBlueprintSession, setOwnStyleBlueprintSession] = useState<{
    blueprint: UserPresetCreationBlueprintDto;
    virtualPreset: StylePreset;
    draftPresetId: number | null;
    createRequest: CreateStylePresetRequest;
  } | null>(null);
  const [publishPresetModalOpen, setPublishPresetModalOpen] = useState(false);
  const [publishCostHint, setPublishCostHint] = useState<number | null>(null);
  const [publishUiHints, setPublishUiHints] = useState<Record<string, unknown> | null>(null);
  const [userPresetCreationBlueprints, setUserPresetCreationBlueprints] = useState<
    UserPresetCreationBlueprintDto[]
  >([]);
  const [presetFields, setPresetFields] = useState<Record<string, string>>({});
  const [referenceAssignments, setReferenceAssignments] = useState<Record<string, string[]>>({});
  const referenceAssignmentsRef = useRef(referenceAssignments);
  referenceAssignmentsRef.current = referenceAssignments;
  const [referencePreviewById, setReferencePreviewById] = useState<Record<string, string>>({});
  const [referenceUploadingKey, setReferenceUploadingKey] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<GenerateModelType>(DEFAULT_GENERATE_MODEL);
  const [selectedEmoji, setSelectedEmoji] = useState(DEFAULT_GENERATE_EMOJI);
  const [removeBackground, setRemoveBackground] = useState<boolean>(DEFAULT_REMOVE_BACKGROUND);
  const [sourceImageFiles, setSourceImageFiles] = useState<File[]>([]);
  const [sourceImagePreviews, setSourceImagePreviews] = useState<string[]>([]);
  const [sourceImageOrigin, setSourceImageOrigin] = useState<'none' | 'manual' | 'telegram-avatar'>('none');
  const [telegramAvatarDismissed, setTelegramAvatarDismissed] = useState(false);
  const [keyboardInsetPx, setKeyboardInsetPx] = useState(0);
  const [failedHistoryPresetPreviewIds, setFailedHistoryPresetPreviewIds] = useState<Set<number>>(() => new Set());
  
  // Состояние генерации
  const [pageState, setPageState] = useState<PageState>('idle');
  const [currentStatus, setCurrentStatus] = useState<GenerationStatus | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [stickerSaved, setStickerSaved] = useState(false);
  const [savedStickerSetName, setSavedStickerSetName] = useState<string | null>(null);
  const [, setSavedStickerSetTitle] = useState<string | null>(null);
  const [isDownloadingResult, setIsDownloadingResult] = useState(false);
  const [lastUsedStickerSetName, setLastUsedStickerSetName] = useState<string | null>(null);
  const [lastUsedStickerSetTitle, setLastUsedStickerSetTitle] = useState<string | null>(null);
  const [saveNoticeText, setSaveNoticeText] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [historyEntries, setHistoryEntries] = useState<GenerateHistoryEntry[]>([]);
  /** По этому localId модалка публикации черновика читает снимки истории (иначе без taskId берётся «последняя» строка и превью пустые). */
  const [pinnedHistoryLocalId, setPinnedHistoryLocalId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<GenerateImageLightboxState | null>(null);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  /** Последний успешный результат, показывается во время upload/generating при повторном запуске без «мерцания» макета. */
  const [duringJobPreviousResultUrl, setDuringJobPreviousResultUrl] = useState<string | null>(null);
  /** Не анимируем миниатюры ленты при повторной генерации с того же успешного экрана на том же наборе вложений. */
  const [suppressSourceStripItemReveal, setSuppressSourceStripItemReveal] = useState(false);
  
  // Тарифы
  const [generateCost, setGenerateCost] = useState<number | null>(null);
  const [, setIsLoadingTariffs] = useState(true);
  
  // Баланс пользователя
  const userInfo = useProfileStore((state) => state.userInfo);
  const setUserInfo = useProfileStore((state) => state.setUserInfo);
  const isProfileFromAuthenticatedApi = useProfileStore((state) => state.isProfileFromAuthenticatedApi);
  const [, setArtBalance] = useState<number | null>(userInfo?.artBalance ?? null);

  /** Глобальные пресеты по флагу enabled; свои черновики показываем владельцу даже если выключены в каталоге. */
  const isPresetShownInStrip = useCallback(
    (p: StylePreset) =>
      p.isEnabled || (userInfo?.id != null && p.ownerId === userInfo.id),
    [userInfo?.id],
  );
  
  // Polling ref
  const pollingIntervalRef = useRef<number | null>(null);
  const [emojiDropdownOpen, setEmojiDropdownOpen] = useState(false);
  const emojiDropdownRef = useRef<HTMLDivElement | null>(null);
  const promptFocusTimeoutRef = useRef<number | null>(null);
  const lastKeyboardInsetRef = useRef(0);
  const saveNoticeTimeoutRef = useRef<number | null>(null);
  const draggedSourceImageIndexRef = useRef<number | null>(null);
  const sourceImageInputRef = useRef<HTMLInputElement | null>(null);
  const sourceStripInnerRef = useRef<HTMLDivElement | null>(null);
  const previousSourceImageCountRef = useRef(0);
  const uploadedSourceImageIdsRef = useRef<string[]>([]);
  const uploadedSourceImageAtRef = useRef<number | null>(null);
  const uploadedSourceImageSignatureRef = useRef<string | null>(null);
  const pollingStartedAtRef = useRef<number | null>(null);
  const activeHistoryLocalIdRef = useRef<string | null>(null);
  const generateComposeStickyRef = useRef<HTMLDivElement | null>(null);
  const composeStickyHeightRef = useRef<number | undefined>(undefined);
  /** Когда false — не добавляем scrollTop при росте compose у верхней границы: иначе после первой сборки полей экран «прилипает» к sticky-промпту, герой уезжает вверх за кадр. */
  const composeScrollCompensationPrimedRef = useRef(false);
  const restoreAppliedRef = useRef(false);
  const preferencesAppliedRef = useRef(false);
  const resumeSessionAppliedRef = useRef(false);
  const styleDeepLinkHandledRef = useRef(false);

  const avatarAutofillAppliedRef = useRef<string | null>(null);
  const avatarAutofillInFlightRef = useRef(false);
  const processedAvatarTriggerRef = useRef<string | null>(null);
  const lastAvatarAutofillBlockReasonRef = useRef<string | null>(null);
  /** imageId (референс) → отпечаток файла; связь с лентой вложений (source strip) */
  const refImageIdToFingerprintRef = useRef<Record<string, string>>({});
  /** индексы 1:1 с sourceImageFiles */
  const sourceFingerprintByIndexRef = useRef<string[]>([]);
  const sourceImageFilesRef = useRef<File[]>([]);
  sourceImageFilesRef.current = sourceImageFiles;
  const clearSourceImageRef = useRef<((options?: { markAvatarDismissed?: boolean }) => void) | null>(null);
  const autoAssignNewSourceFilesRef = useRef<(files: File[]) => Promise<void>>(async () => {});

  const scrollPromptIntoView = useCallback((element: HTMLElement, behavior: ScrollBehavior = 'smooth') => {
    const getKeyboardInset = (): number => {
      const visualViewport = window.visualViewport;
      if (!visualViewport) return 0;
      return Math.max(0, Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop));
    };

    const alignWithinScrollContainer = () => {
      const scrollContainer = element.closest('.stixly-main-scroll');
      if (!(scrollContainer instanceof HTMLElement)) {
        element.scrollIntoView({ block: 'nearest', behavior });
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const topGap = elementRect.top - containerRect.top;
      const bottomGap = containerRect.bottom - elementRect.bottom;
      const topPadding = 20;
      const bottomPadding = Math.max(120, getKeyboardInset() + 84);

      if (topGap < topPadding) {
        scrollContainer.scrollBy({ top: topGap - topPadding, behavior });
        return;
      }

      if (bottomGap < bottomPadding) {
        scrollContainer.scrollBy({ top: bottomPadding - bottomGap, behavior });
      }
    };

    requestAnimationFrame(alignWithinScrollContainer);
    window.setTimeout(alignWithinScrollContainer, 120);
    window.setTimeout(alignWithinScrollContainer, 260);
  }, []);

  const scrollSourceStripToEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const strip = sourceStripInnerRef.current;
    if (!strip) return;
    const nextScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    strip.scrollTo({ left: nextScrollLeft, behavior });
  }, []);

  /* Колесо → горизонтальный скролл; без drag — конфликт с HTML5 reorder миниатюр. */
  useHorizontalScrollStrip(sourceStripInnerRef, { pointerDrag: false });

  const showSaveNotice = useCallback((message: string | null) => {
    if (saveNoticeTimeoutRef.current) {
      clearTimeout(saveNoticeTimeoutRef.current);
      saveNoticeTimeoutRef.current = null;
    }

    setSaveNoticeText(message);

    if (!message) {
      return;
    }

    saveNoticeTimeoutRef.current = window.setTimeout(() => {
      setSaveNoticeText(null);
      saveNoticeTimeoutRef.current = null;
    }, 3200);
  }, []);

  const shouldUsePromptKeyboardMode = useMemo(() => {
    const platformInfo = getPlatformInfo(tg);
    const hasCoarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    /* Десктоп с мышью: visualViewport даёт ложный inset при зуме страницы; клавиатура не перекрывает поле как на телефоне. */
    if (platformInfo.isDesktop && !hasCoarsePointer) {
      return false;
    }

    return platformInfo.isMobile || hasCoarsePointer;
  }, [tg]);

  // При фокусе на поле промпта — мягко переводим форму в режим клавиатуры
  const handlePromptFocusIn = useCallback((e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    if (target?.classList?.contains?.('generate-input')) {
      if (promptFocusTimeoutRef.current) {
        clearTimeout(promptFocusTimeoutRef.current);
        promptFocusTimeoutRef.current = null;
      }
      if (!shouldUsePromptKeyboardMode) {
        return;
      }
      setIsPromptFocused(true);
      document.body.classList.add('generate-prompt-focused');
      scrollPromptIntoView(target);
    }
  }, [scrollPromptIntoView, shouldUsePromptKeyboardMode]);

  const handlePromptFocusOut = useCallback((e: React.FocusEvent) => {
    if ((e.target as HTMLElement)?.classList?.contains?.('generate-input')) {
      if (!shouldUsePromptKeyboardMode) {
        return;
      }
      promptFocusTimeoutRef.current && clearTimeout(promptFocusTimeoutRef.current);
      promptFocusTimeoutRef.current = window.setTimeout(() => {
        setIsPromptFocused(false);
        document.body.classList.remove('generate-prompt-focused');
        promptFocusTimeoutRef.current = null;
      }, 250);
    }
  }, [shouldUsePromptKeyboardMode]);

  useEffect(() => {
    return () => {
      if (promptFocusTimeoutRef.current) {
        clearTimeout(promptFocusTimeoutRef.current);
        promptFocusTimeoutRef.current = null;
      }
      if (saveNoticeTimeoutRef.current) {
        clearTimeout(saveNoticeTimeoutRef.current);
        saveNoticeTimeoutRef.current = null;
      }
      setIsPromptFocused(false);
      setKeyboardInsetPx(0);
      setSaveNoticeText(null);
      document.body.classList.remove('generate-prompt-focused');
    };
  }, []);

  useEffect(() => {
    if (!shouldUsePromptKeyboardMode || !isPromptFocused) {
      lastKeyboardInsetRef.current = 0;
      setKeyboardInsetPx(0);
      return;
    }

    const updateKeyboardInset = () => {
      const visualViewport = window.visualViewport;
      let nextInset = 0;
      if (visualViewport) {
        const scale = visualViewport.scale;
        /* При pinch-zoom (и др.) scale ≠ 1 — разница высот не означает клавиатуру, иначе появляется «невидимая стена» снизу. */
        if (typeof scale === 'number' && Math.abs(scale - 1) > 0.03) {
          nextInset = 0;
        } else {
          nextInset = Math.max(
            0,
            Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop),
          );
        }
      }
      setKeyboardInsetPx(nextInset);

      const prevInset = lastKeyboardInsetRef.current;
      lastKeyboardInsetRef.current = nextInset;

      const activeElement = document.activeElement;
      const shouldRealignPrompt =
        nextInset > 0 &&
        (prevInset === 0 || Math.abs(nextInset - prevInset) >= 28);

      if (
        shouldRealignPrompt &&
        activeElement instanceof HTMLElement &&
        activeElement.classList.contains('generate-input')
      ) {
        scrollPromptIntoView(activeElement, 'auto');
      }
    };

    updateKeyboardInset();
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', updateKeyboardInset);
    visualViewport?.addEventListener('resize', updateKeyboardInset);
    visualViewport?.addEventListener('scroll', updateKeyboardInset);

    return () => {
      window.removeEventListener('resize', updateKeyboardInset);
      visualViewport?.removeEventListener('resize', updateKeyboardInset);
      visualViewport?.removeEventListener('scroll', updateKeyboardInset);
    };
  }, [isPromptFocused, scrollPromptIntoView, shouldUsePromptKeyboardMode]);

  useEffect(() => {
    const previousCount = previousSourceImageCountRef.current;
    const currentCount = sourceImageFiles.length;

    if (currentCount > previousCount) {
      const behavior: ScrollBehavior = previousCount === 0 ? 'auto' : 'smooth';
      requestAnimationFrame(() => {
        scrollSourceStripToEnd(behavior);
      });
      window.setTimeout(() => {
        scrollSourceStripToEnd(behavior);
      }, 100);
    }

    previousSourceImageCountRef.current = currentCount;
  }, [scrollSourceStripToEnd, sourceImageFiles.length]);

  // Извлечение параметров из URL при инициализации
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get('inline_query_id');
    const uid = urlParams.get('user_id');
    
    if (queryId) {
      setInlineQueryId(queryId);
      console.log('✅ Получен inline_query_id из URL:', queryId);
    }
    
    if (uid) {
      setUserId(uid);
      console.log('✅ Получен user_id из URL:', uid);
    }
  }, []);

  // Загрузка тарифов при монтировании
  useEffect(() => {
    const loadTariffs = async () => {
      try {
        const tariffs = await apiClient.getArtTariffs();
        const generateTariff = tariffs.debits?.find(d => d.code === 'GENERATE_STICKER');
        setGenerateCost(generateTariff?.amount ?? null);
      } catch (error) {
        console.error('Ошибка загрузки тарифов:', error);
      } finally {
        setIsLoadingTariffs(false);
      }
    };
    
    loadTariffs();
  }, []);

  // Загрузка пресетов стилей, категорий и blueprint — все три запроса параллельно.
  // Ранее categories/blueprints ждали завершения presets (последовательно), что добавляло
  // лишний RTT на медленном соединении. Теперь Promise.all запускает все запросы сразу.
  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        const [presets, categories, blueprints] = await Promise.all([
          apiClient.loadStylePresetsMerged().catch((err) => {
            console.error('Ошибка загрузки пресетов стилей:', err);
            return [] as StylePreset[];
          }),
          apiClient.getStylePresetCategories().catch((err) => {
            console.warn('Категории пресетов недоступны, чипы из пресетов:', err);
            return [] as StylePresetCategoryDto[];
          }),
          apiClient.getUserPresetCreationBlueprints().catch((err) => {
            console.warn('Blueprint создания пресета недоступен:', err);
            return [] as UserPresetCreationBlueprintDto[];
          }),
        ]);

        if (!cancelled) {
          setStylePresets(presets);
          setStylePresetCategories(categories);
          setUserPresetCreationBlueprints(blueprints);
        }
      } catch (error) {
        console.error('Ошибка загрузки каталога пресетов:', error);
      } finally {
        if (!cancelled) {
          setStyleCatalogLoaded(true);
        }
      }
    };

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const styleCategoryChipsList = useMemo(() => {
    if (stylePresetCategories.length > 0) return stylePresetCategories;
    return uniqueCategoriesFromPresets(stylePresets);
  }, [stylePresetCategories, stylePresets]);

  useLayoutEffect(() => {
    // Пока нет категорий с API/пресетов — не ставим «Мои», иначе после загрузки чипов
    // фильтр залипнет в MY (ниже: if (prev === MY) return prev).
    if (styleCategoryChipsList.length === 0) {
      return;
    }
    setStyleCategoryFilter((prev) => {
      if (prev === STYLE_CATEGORY_FILTER_MY) return prev;
      const ids = new Set(styleCategoryChipsList.map((c) => c.id));
      if (prev != null && ids.has(prev)) return prev;
      return preferDefaultStyleCategoryId(styleCategoryChipsList);
    });
  }, [styleCategoryChipsList]);

  const presetsWithVirtual = useMemo(() => {
    if (!ownStyleBlueprintSession) return stylePresets;
    const v = ownStyleBlueprintSession.virtualPreset;
    if (styleCategoryFilter === STYLE_CATEGORY_FILTER_MY) {
      return [v, ...stylePresets];
    }
    if (styleCategoryFilter != null && v.category?.id !== styleCategoryFilter) return stylePresets;
    return [v, ...stylePresets];
  }, [ownStyleBlueprintSession, stylePresets, styleCategoryFilter]);

  const stripStylePresets = useMemo(() => {
    const boostId = deepLinkStyleBoostId;
    const boostStrip = (s: StylePreset[]) => moveStylePresetIdFirst(s, boostId);
    /** Черновик — крайняя левая карточка: после boostStrip, иначе deep link снова ставит другой стиль первым. */
    const withDraftFirst = (s: StylePreset[]) =>
      ownStyleBlueprintSession
        ? moveStylePresetIdFirst(s, OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID)
        : s;

    if (styleCategoryChipsList.length === 0 || styleCategoryFilter == null) {
      const strip = presetsWithVirtual.filter((p) => isPresetShownInStrip(p));
      return withDraftFirst(
        boostStrip(
          ensureSelectedPresetInStrip(
            sortPresetsInCategory(strip),
            presetsWithVirtual,
            selectedStylePresetId,
          ),
        ),
      );
    }
    if (styleCategoryFilter === STYLE_CATEGORY_FILTER_MY) {
      const uid = userInfo?.id ?? null;
      const mine = presetsWithVirtual.filter(
        (p) => isPresetShownInStrip(p) && !p.isGlobal && uid != null && p.ownerId === uid,
      );
      return withDraftFirst(
        boostStrip(
          ensureSelectedPresetInStrip(
            sortPresetsInCategory(mine),
            presetsWithVirtual,
            selectedStylePresetId,
          ),
        ),
      );
    }
    const list = presetsWithVirtual.filter(
      (p) => isPresetShownInStrip(p) && p.category?.id === styleCategoryFilter,
    );
    return withDraftFirst(
      boostStrip(
        ensureSelectedPresetInStrip(
          sortPresetsInCategory(list),
          presetsWithVirtual,
          selectedStylePresetId,
        ),
      ),
    );
  }, [
    styleCategoryFilter,
    presetsWithVirtual,
    selectedStylePresetId,
    styleCategoryChipsList,
    isPresetShownInStrip,
    userInfo?.id,
    deepLinkStyleBoostId,
    ownStyleBlueprintSession,
  ]);

  const isMyCategorySelected = styleCategoryFilter === STYLE_CATEGORY_FILTER_MY;
  const myStylesEmpty = isMyCategorySelected && stripStylePresets.length === 0;

  // Актуальный баланс ART и профиль «меня» в сторе (источник истины: /api/profiles/me)
  // Всегда кладём в стор полный объект me, чтобы хедер показывал правильный аватар и баланс
  // (не смешиваем с профилем автора, иначе userInfo.telegramId !== user.id и аватар станет DU)
  const refreshMyProfile = useCallback(async () => {
    try {
      const me = await apiClient.getMyProfile();
      setArtBalance(typeof me.artBalance === 'number' ? me.artBalance : null);
      let nextUserInfo: typeof me = me;
      try {
        const photo = await apiClient.getUserPhoto(me.id);
        if (photo?.profilePhotoFileId || photo?.profilePhotos) {
          nextUserInfo = { ...me, profilePhotoFileId: photo.profilePhotoFileId, profilePhotos: photo.profilePhotos };
        }
      } catch {
        // оставляем me без фото
      }
      setUserInfo(nextUserInfo);
    } catch (error) {
      console.warn('Не удалось обновить профиль/баланс ART:', error);
    }
  }, [setUserInfo]);

  const avatarContext = useMemo(() => resolveAvatarContext({
    user,
    userInfo,
    isProfileFromAuthenticatedApi,
    targetSize: 160,
  }), [isProfileFromAuthenticatedApi, user, userInfo]);
  const effectiveUserId = userInfo?.telegramId ?? userInfo?.id ?? avatarContext.telegramUserId ?? null;
  /** В DEV mock: save-to-set в теле нужен id профиля (effectiveUserId); не getStickerAuthUserId (777000). */
  const stickerListUserId = apiClient.getStickerSetListOwnerUserId(effectiveUserId);
  const telegramUserId = avatarContext.telegramUserId;
  const profileAvatarFileId = avatarContext.profileAvatarFileId;
  const effectiveAvatarUrl = avatarContext.effectiveAvatarUrl;
  const avatarTriggerToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('avatar');
  }, [location.search]);
  const hasPendingAvatarTrigger =
    avatarTriggerToken != null && processedAvatarTriggerRef.current !== avatarTriggerToken;
  const hasActiveGeneration = pageState === 'generating' || pageState === 'uploading';
  const avatarAutofillBlockReason = useMemo(() => {
    if (hasActiveGeneration) return 'ACTIVE_GENERATION';
    if (telegramUserId == null) return 'MISSING_USER_ID';
    if (typeof effectiveAvatarUrl !== 'string' || effectiveAvatarUrl.length === 0) return 'MISSING_AVATAR_SOURCE';
    if (hasPendingAvatarTrigger) return null;
    if (telegramAvatarDismissed) return 'DISMISSED_BY_USER';
    if (Object.values(referenceAssignments).some((arr) => (arr?.length ?? 0) > 0)) {
      return 'MANUAL_SOURCE_PRESENT';
    }
    if (sourceImageFiles.length > 0) {
      return sourceImageOrigin === 'telegram-avatar' ? 'AVATAR_ALREADY_APPLIED' : 'MANUAL_SOURCE_PRESENT';
    }
    return null;
  }, [
    effectiveAvatarUrl,
    hasActiveGeneration,
    hasPendingAvatarTrigger,
    referenceAssignments,
    sourceImageFiles.length,
    sourceImageOrigin,
    telegramAvatarDismissed,
    telegramUserId,
  ]);
  const historyUserScopeId = effectiveUserId != null ? String(effectiveUserId) : null;

  const persistLastUsedSaveTarget = useCallback((name: string | null, title: string | null) => {
    if (!historyUserScopeId) return;
    try {
      window.localStorage.setItem(
        getLastUsedSaveTargetStorageKey(historyUserScopeId),
        JSON.stringify({ name, title })
      );
    } catch {
      // ignore storage failures in private mode / webview quirks
    }
  }, [historyUserScopeId]);

  useEffect(() => {
    if (!historyUserScopeId) {
      setLastUsedStickerSetName(null);
      setLastUsedStickerSetTitle(null);
      return;
    }

    try {
      const nextValue =
        parseSaveTargetPayload(window.localStorage.getItem(getLastUsedSaveTargetStorageKey(historyUserScopeId)));

      window.localStorage.removeItem(getLegacyDefaultSaveTargetStorageKey(historyUserScopeId));

      setLastUsedStickerSetName(nextValue?.name ?? null);
      setLastUsedStickerSetTitle(nextValue?.title ?? null);
    } catch {
      setLastUsedStickerSetName(null);
      setLastUsedStickerSetTitle(null);
    }
  }, [historyUserScopeId]);

  const persistGeneratePreferences = useCallback((patch: {
    selectedModel?: GenerateModelType;
    stylePresetId?: number | null;
    selectedEmoji?: string;
    removeBackground?: boolean;
  }) => {
    if (!historyUserScopeId) return;
    writeGeneratePreferences(historyUserScopeId, {
      selectedModel: patch.selectedModel ?? selectedModel,
      stylePresetId: patch.stylePresetId !== undefined ? patch.stylePresetId : selectedStylePresetId,
      selectedEmoji: patch.selectedEmoji ?? selectedEmoji,
      removeBackground: patch.removeBackground ?? removeBackground,
    });
  }, [historyUserScopeId, removeBackground, selectedEmoji, selectedModel, selectedStylePresetId]);

  const persistTelegramAvatarDismissed = useCallback((dismissed: boolean) => {
    if (!telegramUserId) return;
    try {
      const key = getTelegramAvatarDismissedStorageKey(telegramUserId);
      if (dismissed) {
        localStorage.setItem(key, '1');
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore localStorage failures in private mode/webview quirks
    }
  }, [telegramUserId]);

  const syncHistoryEntries = useCallback(() => {
    if (!historyUserScopeId) {
      setHistoryEntries([]);
      return [];
    }
    const entries = readGenerateHistory(historyUserScopeId);
    setHistoryEntries(entries);
    return entries;
  }, [historyUserScopeId]);

  const patchHistoryEntry = useCallback(
    (matcher: { localId?: string; taskId?: string }, patch: Partial<GenerateHistoryEntry>) => {
      if (!historyUserScopeId) return;
      const updated = updateGenerateHistoryEntry(historyUserScopeId, matcher, patch);
      setHistoryEntries(updated);
    },
    [historyUserScopeId]
  );

  const buildReferenceSnapshotsForHistory = useCallback(() => {
    const assignmentsSnapshot: Record<string, string[]> = {};
    const accepted = new Set<string>();

    for (const [fieldKey, idsRaw] of Object.entries(referenceAssignments)) {
      if (!Array.isArray(idsRaw) || idsRaw.length === 0) continue;
      const list: string[] = [];
      for (const raw of idsRaw) {
        if (typeof raw !== 'string') continue;
        const id = raw.trim();
        if (!id || accepted.has(id)) continue;
        list.push(id);
        accepted.add(id);
        if (list.length >= HISTORY_REF_CACHE_MAX_PER_FIELD || accepted.size >= HISTORY_REF_CACHE_MAX_IDS) break;
      }
      if (list.length > 0) assignmentsSnapshot[fieldKey] = list;
      if (accepted.size >= HISTORY_REF_CACHE_MAX_IDS) break;
    }

    const previewSnapshot: Record<string, string> = {};
    accepted.forEach((id) => {
      const preview = referencePreviewById[id];
      if (typeof preview === 'string' && preview.trim().length > 0) {
        previewSnapshot[id] = preview;
      }
    });

    return {
      referenceAssignmentsSnapshot:
        Object.keys(assignmentsSnapshot).length > 0 ? assignmentsSnapshot : null,
      referencePreviewSnapshot: Object.keys(previewSnapshot).length > 0 ? previewSnapshot : null,
    };
  }, [referenceAssignments, referencePreviewById]);

  const removeHistoryEntry = useCallback((matcher: { localId?: string; taskId?: string }) => {
    if (!historyUserScopeId) return;
    const shouldResetUi = Boolean(matcher.localId && activeHistoryLocalIdRef.current === matcher.localId);
    const updated = deleteGenerateHistoryEntry(historyUserScopeId, matcher);
    if (matcher.localId && activeHistoryLocalIdRef.current === matcher.localId) {
      activeHistoryLocalIdRef.current = null;
    }
    setPinnedHistoryLocalId((prev) => (matcher.localId && prev === matcher.localId ? null : prev));
    setHistoryEntries(updated);
    if (shouldResetUi) {
      setResultImageUrl(null);
      setImageId(null);
      setFileId(null);
      setStickerSaved(false);
      setSavedStickerSetName(null);
      setSavedStickerSetTitle(null);
      setTaskId(null);
      setCurrentStatus(null);
      setPageState('idle');
      setErrorMessage(null);
      setErrorKind(null);
      setDuringJobPreviousResultUrl(null);
      setImageLightbox(null);
    }
  }, [historyUserScopeId]);

  /** 410/истёкший CDN по `/api/images/*`: убрать запись из локальной истории вместо вечной заглушки. */
  const purgeHistoryEntryForExpiredApiImage = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const urlRaw = (e.currentTarget.currentSrc || e.currentTarget.getAttribute('src') || '').trim();
      const url = urlRaw.split('?')[0];
      if (!url || !isApiHostedArtifactUrl(url)) {
        onApiHostedImageError(e);
        return;
      }
      const match = historyEntries.find((en) => {
        const stored = typeof en.resultImageUrl === 'string' ? en.resultImageUrl.trim().split('?')[0] : '';
        if (!stored || !isApiHostedArtifactUrl(stored)) return false;
        return stored === url || url.endsWith(stored) || stored.endsWith(url);
      });
      if (match) {
        removeHistoryEntry({ localId: match.localId });
        return;
      }
      onApiHostedImageError(e);
    },
    [historyEntries, removeHistoryEntry],
  );

  /** Закреплённая запись истории — восстановить UI после remount /generate (профиль, др. вкладки). */
  useEffect(() => {
    if (!historyUserScopeId) return;
    const key = getGenerateResumeLocalIdKey(historyUserScopeId);
    try {
      if (pinnedHistoryLocalId) {
        sessionStorage.setItem(key, pinnedHistoryLocalId);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch {
      /* private mode */
    }
  }, [historyUserScopeId, pinnedHistoryLocalId]);

  const clearHistoryEntries = useCallback(() => {
    if (!historyUserScopeId) return;
    const cleared = clearGenerateHistory(historyUserScopeId);
    setHistoryEntries(cleared);
    activeHistoryLocalIdRef.current = null;
    setPinnedHistoryLocalId(null);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingStartedAtRef.current = null;

    setResultImageUrl(null);
    setDuringJobPreviousResultUrl(null);
    setSuppressSourceStripItemReveal(false);
    setImageId(null);
    setTaskId(null);
    setFileId(null);
    setStickerSaved(false);
    setSavedStickerSetName(null);
    setSavedStickerSetTitle(null);
    setCurrentStatus(null);
    setErrorMessage(null);
    setErrorKind(null);
    setPageState('idle');
    setFailedHistoryPresetPreviewIds(new Set());
    setHistoryOpen(false);
  }, [historyUserScopeId]);

  useEffect(() => {
    if (pageState === 'idle') {
      setSuppressSourceStripItemReveal(false);
      setDuringJobPreviousResultUrl(null);
    }
  }, [pageState]);

  useEffect(() => {
    refreshMyProfile();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshMyProfile();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refreshMyProfile]);

  useEffect(() => {
    if (!telegramUserId) {
      setTelegramAvatarDismissed(false);
      return;
    }
    try {
      const key = getTelegramAvatarDismissedStorageKey(telegramUserId);
      setTelegramAvatarDismissed(localStorage.getItem(key) === '1');
    } catch {
      setTelegramAvatarDismissed(false);
    }
  }, [telegramUserId]);

  useEffect(() => {
    if (!avatarTriggerToken || !telegramUserId) return;
    setTelegramAvatarDismissed(false);
    persistTelegramAvatarDismissed(false);
  }, [avatarTriggerToken, persistTelegramAvatarDismissed, telegramUserId]);

  const buildSourceImageFingerprint = useCallback(async (file: File): Promise<string> => {
    const fallbackFingerprint = [file.type, file.size, file.lastModified, file.name].join(':');
    if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') {
      return fallbackFingerprint;
    }

    try {
      const encoder = new TextEncoder();
      const metadataBytes = encoder.encode(`${file.type}:${file.size}`);
      const headBytes = new Uint8Array(
        await file.slice(0, SOURCE_IMAGE_FINGERPRINT_SAMPLE_BYTES).arrayBuffer()
      );
      const tailStart = Math.max(0, file.size - SOURCE_IMAGE_FINGERPRINT_SAMPLE_BYTES);
      const tailBytes = tailStart > 0
        ? new Uint8Array(await file.slice(tailStart).arrayBuffer())
        : new Uint8Array();
      const payload = new Uint8Array(metadataBytes.length + headBytes.length + tailBytes.length);
      payload.set(metadataBytes, 0);
      payload.set(headBytes, metadataBytes.length);
      payload.set(tailBytes, metadataBytes.length + headBytes.length);
      const digest = await crypto.subtle.digest('SHA-256', payload);
      return `${file.type}:${file.size}:${bytesToHex(new Uint8Array(digest))}`;
    } catch {
      return fallbackFingerprint;
    }
  }, []);

  const registerRefImageIdsForFiles = useCallback(
    async (imageIds: (string | null | undefined)[], files: File[]) => {
      const n = Math.min(imageIds.length, files.length);
      for (let i = 0; i < n; i++) {
        const id = imageIds[i];
        if (!id) continue;
        refImageIdToFingerprintRef.current[id] = await buildSourceImageFingerprint(files[i]);
      }
    },
    [buildSourceImageFingerprint],
  );

  // Очистка polling при размонтировании
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingStartedAtRef.current = null;
    };
  }, []);

  useEffect(() => {
    const isOnGeneratePage = location.pathname === '/generate';
    const isAvatarScenarioInactive = sourceImageOrigin !== 'telegram-avatar';
    const shouldHighlightHeaderAvatar = isOnGeneratePage && isAvatarScenarioInactive;

    if (shouldHighlightHeaderAvatar) {
      document.body.classList.add('generate-avatar-hint-active');
    } else {
      document.body.classList.remove('generate-avatar-hint-active');
    }

    return () => {
      document.body.classList.remove('generate-avatar-hint-active');
    };
  }, [location.pathname, sourceImageOrigin]);

  /** Пульс кнопки истории: голова готова и ещё не подтверждена в sessionStorage; «увидел» — при совпадении результата с head (см. write внутри). */
  useEffect(() => {
    if (!historyUserScopeId) {
      document.body.classList.remove('generate-history-hint-active');
      return;
    }
    const head = historyEntries[0];
    const headHasReadyResult = Boolean(
      head &&
        head.resultImageUrl &&
        (head.pageState === 'success' || head.generationStatus === 'COMPLETED')
    );
    const isViewingHeadResult = Boolean(
      headHasReadyResult &&
        head &&
        pageState === 'success' &&
        resultImageUrl &&
        resultImageUrl === head.resultImageUrl
    );
    if (isViewingHeadResult && head) {
      writeHistoryHeadAck(historyUserScopeId, { localId: head.localId, updatedAt: head.updatedAt });
    }
    const ack = readHistoryHeadAck(historyUserScopeId);
    const headAcked = Boolean(
      head && ack && ack.localId === head.localId && ack.updatedAt === head.updatedAt
    );
    const shouldShowHistoryReadyHint = headHasReadyResult && !headAcked;

    if (shouldShowHistoryReadyHint) {
      document.body.classList.add('generate-history-hint-active');
    } else {
      document.body.classList.remove('generate-history-hint-active');
    }
    return () => {
      document.body.classList.remove('generate-history-hint-active');
    };
  }, [historyEntries, historyUserScopeId, pageState, resultImageUrl]);

  // Polling статуса генерации
  const startPolling = useCallback((taskIdToCheck: string, historyLocalIdForPoll: string) => {
    // Очищаем предыдущий интервал
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingStartedAtRef.current = Date.now();

    const poll = async () => {
      const shouldSyncPollToUi = () => activeHistoryLocalIdRef.current === historyLocalIdForPoll;

      if (
        pollingStartedAtRef.current &&
        Date.now() - pollingStartedAtRef.current >= POLLING_TIMEOUT_MS
      ) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingStartedAtRef.current = null;
        patchHistoryEntry(
          { taskId: taskIdToCheck },
          {
            pageState: 'error',
            generationStatus: 'TIMEOUT',
            errorMessage: 'Генерация заняла слишком много времени. Попробуйте снова.',
            isActive: false,
          }
        );
        if (shouldSyncPollToUi()) {
          setCurrentStatus('TIMEOUT');
          setErrorMessage('Генерация заняла слишком много времени. Попробуйте снова.');
          setErrorKind('general');
          setPageState('error');
          setDuringJobPreviousResultUrl(null);
        }
        return;
      }

      try {
        const statusData = await apiClient.getGenerationStatusV2(taskIdToCheck);
        const generationMetadata = parseGenerationMetadata(statusData.metadata);
        const backgroundRemoveFallbackApplied =
          generationMetadata?.background_remove_fallback_applied === true;
        // Только taskId: иначе при просмотре другой записи истории OR-матч в storage затронет две строки сразу.
        patchHistoryEntry(
          { taskId: taskIdToCheck },
          {
            generationStatus: statusData.status,
            pageState:
              statusData.status === 'COMPLETED'
                ? 'success'
                : statusData.status === 'FAILED' || statusData.status === 'TIMEOUT'
                ? 'error'
                : 'generating',
            resultImageUrl: statusData.imageUrl || null,
            imageId: statusData.imageId || null,
            fileId: statusData.telegramSticker?.fileId || null,
            errorMessage:
              statusData.status === 'COMPLETED'
                ? null
                : mapGenerationErrorMessage(statusData.errorMessage) || null,
            isActive: !TERMINAL_GENERATION_STATUSES.includes(statusData.status),
          }
        );
        if (shouldSyncPollToUi()) {
          setCurrentStatus(statusData.status);
        }

        if (statusData.status === 'COMPLETED') {
          // Успешное завершение
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          pollingStartedAtRef.current = null;
          if (shouldSyncPollToUi()) {
            setResultImageUrl(statusData.imageUrl || null);
            setImageId(statusData.imageId || null);
            // Сохраняем fileId для последующей отправки боту
            const receivedFileId = statusData.telegramSticker?.fileId || null;
            setFileId(receivedFileId);
            if (receivedFileId) {
              console.log('✅ Получен fileId из ответа API:', receivedFileId);
            }
            setErrorMessage(null);
            setErrorKind(null);
            setDuringJobPreviousResultUrl(null);
            setSuppressSourceStripItemReveal(false);
            showSaveNotice(
              backgroundRemoveFallbackApplied ? BACKGROUND_REMOVE_FALLBACK_NOTICE : null
            );
            setPageState('success');
          }
          // Баланс в хедере обновляем при любом завершении задачи на сервере
          refreshMyProfile();
        } else if (statusData.status === 'FAILED' || statusData.status === 'TIMEOUT') {
          // Ошибка
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          pollingStartedAtRef.current = null;
          if (shouldSyncPollToUi()) {
            const mappedStatusErrorMessage = mapGenerationErrorMessage(statusData.errorMessage);
            setErrorMessage(
              mappedStatusErrorMessage ||
                (statusData.status === 'TIMEOUT' ? 'Превышено время ожидания' : 'Произошла ошибка при генерации')
            );
            setErrorKind('general');
            setDuringJobPreviousResultUrl(null);
            setPageState('error');
          }
        }
        // Для PENDING, GENERATING, REMOVING_BACKGROUND - продолжаем polling
      } catch (error) {
        console.error('Ошибка при проверке статуса:', error);
        // Продолжаем polling даже при ошибке сети
      }
    };

    // Первый запрос сразу
    poll();
    
    // Далее с интервалом
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL);
  }, [patchHistoryEntry, refreshMyProfile]);

  const resetUploadedSourceImageCache = useCallback(() => {
    uploadedSourceImageIdsRef.current = [];
    uploadedSourceImageAtRef.current = null;
    uploadedSourceImageSignatureRef.current = null;
  }, []);

  const appendSourceImages = useCallback(async (
    files: File[],
    opts?: { skipReferenceAutoFill?: boolean },
  ): Promise<boolean> => {
    if (!files.length) return false;

    const currentSourceCount = sourceImageFiles.length;
    const existingFiles = sourceImageFiles;
    const existingFingerprints = new Set(await Promise.all(existingFiles.map((file) => buildSourceImageFingerprint(file))));
    const uniqueIncomingFiles: File[] = [];

    for (const file of files) {
      const fingerprint = await buildSourceImageFingerprint(file);
      if (existingFingerprints.has(fingerprint)) {
        continue;
      }
      existingFingerprints.add(fingerprint);
      uniqueIncomingFiles.push(file);
    }

    if (!uniqueIncomingFiles.length) {
      return false;
    }

    const remainingSlots = MAX_SOURCE_IMAGE_FILES - currentSourceCount;
    if (remainingSlots <= 0) {
      setErrorMessage(getSourceImageLimitMessage());
      setErrorKind('upload');
      setPageState('error');
      return false;
    }

    const filesToAppend = uniqueIncomingFiles.slice(0, remainingSlots);
    const skippedFilesCount = uniqueIncomingFiles.length - filesToAppend.length;

    try {
      const previews = await Promise.all(filesToAppend.map((file) => blobToDataUrl(file)));
      const newFps = await Promise.all(filesToAppend.map((file) => buildSourceImageFingerprint(file)));
      sourceFingerprintByIndexRef.current = [...sourceFingerprintByIndexRef.current, ...newFps];
      const mergedFiles = [...sourceImageFiles, ...filesToAppend];
      setSourceImageFiles(mergedFiles);
      setSourceImagePreviews((prev) => [...prev, ...previews]);
      setSourceImageOrigin(computeSourceImageOriginFromFiles(mergedFiles));
      setSuppressSourceStripItemReveal(false);
      resetUploadedSourceImageCache();
      if (selectedModel !== SOURCE_IMAGE_MODEL) {
        setSelectedModel(SOURCE_IMAGE_MODEL);
        persistGeneratePreferences({ selectedModel: SOURCE_IMAGE_MODEL });
      }
      if (skippedFilesCount > 0) {
        setErrorMessage(getSourceImageLimitMessage());
        setErrorKind('upload');
        setPageState('error');
      } else {
        setErrorMessage(null);
        setErrorKind(null);
        if (pageState === 'error') {
          setPageState('idle');
        }
      }
      if (!opts?.skipReferenceAutoFill) {
        void autoAssignNewSourceFilesRef.current(filesToAppend);
      }
      return true;
    } catch {
      setErrorMessage('Не удалось загрузить файл');
      setErrorKind('upload');
      setPageState('error');
      return false;
    }
  }, [buildSourceImageFingerprint, pageState, persistGeneratePreferences, resetUploadedSourceImageCache, selectedModel, sourceImageFiles]);

  /** Вставка в начало ленты (явный клик по аватару в шапке с ?avatar=). */
  const prependSourceImages = useCallback(
    async (files: File[], opts?: { skipReferenceAutoFill?: boolean }): Promise<boolean> => {
      if (!files.length) return false;

      const existingFiles = sourceImageFiles;
      const existingPreviews = sourceImagePreviews;
      const existingFingerprints = new Set(
        await Promise.all(existingFiles.map((file) => buildSourceImageFingerprint(file)))
      );
      const uniqueIncoming: File[] = [];
      for (const file of files) {
        const fingerprint = await buildSourceImageFingerprint(file);
        if (existingFingerprints.has(fingerprint)) {
          continue;
        }
        existingFingerprints.add(fingerprint);
        uniqueIncoming.push(file);
      }
      if (!uniqueIncoming.length) {
        return false;
      }

      const maxTotal = MAX_SOURCE_IMAGE_FILES;
      const room = maxTotal - existingFiles.length;
      if (room <= 0) {
        setErrorMessage(getSourceImageLimitMessage());
        setErrorKind('upload');
        setPageState('error');
        return false;
      }

      const toAdd = uniqueIncoming.slice(0, room);
      const skipped = uniqueIncoming.length - toAdd.length;
      try {
        const addPreviews = await Promise.all(toAdd.map((file) => blobToDataUrl(file)));
        const nextFiles = [...toAdd, ...existingFiles].slice(0, maxTotal);
        const nextPreviews = [...addPreviews, ...existingPreviews].slice(0, nextFiles.length);
        const nextFps = await Promise.all(nextFiles.map((file) => buildSourceImageFingerprint(file)));

        sourceFingerprintByIndexRef.current = nextFps;
        setSourceImageFiles(nextFiles);
        setSourceImagePreviews(nextPreviews);
        setSourceImageOrigin(computeSourceImageOriginFromFiles(nextFiles));
        setSuppressSourceStripItemReveal(false);
        resetUploadedSourceImageCache();
        if (selectedModel !== SOURCE_IMAGE_MODEL) {
          setSelectedModel(SOURCE_IMAGE_MODEL);
          persistGeneratePreferences({ selectedModel: SOURCE_IMAGE_MODEL });
        }
        if (skipped > 0) {
          setErrorMessage(getSourceImageLimitMessage());
          setErrorKind('upload');
          setPageState('error');
        } else {
          setErrorMessage(null);
          setErrorKind(null);
          if (pageState === 'error') {
            setPageState('idle');
          }
        }
        if (!opts?.skipReferenceAutoFill) {
          void autoAssignNewSourceFilesRef.current(toAdd);
        }
        return true;
      } catch {
        setErrorMessage('Не удалось загрузить файл');
        setErrorKind('upload');
        setPageState('error');
        return false;
      }
    },
    [
      buildSourceImageFingerprint,
      pageState,
      persistGeneratePreferences,
      resetUploadedSourceImageCache,
      selectedModel,
      sourceImageFiles,
      sourceImagePreviews,
    ]
  );

  useEffect(() => {
    const canAutofill = avatarAutofillBlockReason == null;

    if (!canAutofill) {
      if (import.meta.env.DEV && avatarAutofillBlockReason && lastAvatarAutofillBlockReasonRef.current !== avatarAutofillBlockReason) {
        console.info('[GeneratePage] Автоподстановка аватара пропущена:', {
          reason: avatarAutofillBlockReason,
          hasPendingAvatarTrigger,
          telegramUserId,
          sourceImageOrigin,
          sourceImageFilesLength: sourceImageFiles.length,
          pageState,
        });
        lastAvatarAutofillBlockReasonRef.current = avatarAutofillBlockReason;
      }
      return;
    }
    lastAvatarAutofillBlockReasonRef.current = null;

    const avatarSourceKey = profileAvatarFileId || effectiveAvatarUrl;
    const avatarUrlToFetch = effectiveAvatarUrl ?? '';
    // Стабильный ключ без ?avatar= токена: иначе после обработки триггера hasPendingAvatarTrigger
    // меняется с true на false, ключ `…:ts` сменится на `…:default` и guard не сработает — повторный fetch/append.
    const stableAutofillKey = `${telegramUserId}:${avatarSourceKey}`;
    if (avatarAutofillAppliedRef.current === stableAutofillKey && !hasPendingAvatarTrigger) {
      return;
    }

    if (avatarAutofillInFlightRef.current) {
      return;
    }

    // Раньше processedAvatarTriggerRef выставляли до fetch: при повторном запуске эффекта hasPendingAvatarTrigger
    // становился false, вторая итерация делала append — в ленте два «telegram-avatar».
    const insertAsPrepend = hasPendingAvatarTrigger;
    const triggerTokenToConsume = avatarTriggerToken;

    const abortController = new AbortController();
    avatarAutofillInFlightRef.current = true;

    (async () => {
      try {
        let blob: Blob;

        if (profileAvatarFileId && userInfo?.id) {
          blob = await apiClient.getUserPhotoBlob(userInfo.id, profileAvatarFileId);
        } else {
          const response = await fetch(avatarUrlToFetch, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
            signal: abortController.signal,
          });
          if (!response.ok) {
            throw new Error(`AVATAR_FETCH_FAILED_${response.status}`);
          }

          blob = await response.blob();
        }
        const mimeType = (blob.type || '').toLowerCase();
        const looksLikeSvg =
          mimeType.includes('svg') ||
          (!profileAvatarFileId && /\.svg(?:$|[?#])/i.test(avatarUrlToFetch));
        if (looksLikeSvg) {
          throw new Error('AVATAR_SVG_UNSUPPORTED');
        }

        const fileExt = mimeType.includes('png')
          ? 'png'
          : mimeType.includes('webp')
            ? 'webp'
            : 'jpg';
        const fileType = mimeType || 'image/jpeg';
        const avatarFile = new File([blob], `telegram-avatar.${fileExt}`, { type: fileType });

        if (abortController.signal.aborted) return;

        const didAdd = insertAsPrepend
          ? await prependSourceImages([avatarFile])
          : await appendSourceImages([avatarFile]);
        if (insertAsPrepend && triggerTokenToConsume) {
          processedAvatarTriggerRef.current = triggerTokenToConsume;
        }
        if (didAdd) {
          avatarAutofillAppliedRef.current = stableAutofillKey;
        }
        if (insertAsPrepend) {
          // Сбрасываем сценарий только когда реально есть что сбрасывать.
          // Это уменьшает визуальное «мерцание» при уже idle-состоянии.
          const shouldResetScenario =
            pageState !== 'idle' ||
            currentStatus != null ||
            taskId != null ||
            resultImageUrl != null ||
            imageId != null ||
            fileId != null ||
            stickerSaved ||
            savedStickerSetName != null ||
            saveNoticeText != null ||
            saveError != null ||
            historyOpen;
          if (shouldResetScenario) {
            setPageState('idle');
            setCurrentStatus(null);
            setTaskId(null);
            setResultImageUrl(null);
            setImageId(null);
            setFileId(null);
            setStickerSaved(false);
            setSavedStickerSetName(null);
            setSavedStickerSetTitle(null);
            showSaveNotice(null);
            setSaveError(null);
            setHistoryOpen(false);
          }
        }
        // Сбрасываем кэш imageId: append вызывает reset при фактическом добавлении; при дедупе — здесь
        resetUploadedSourceImageCache();
        setErrorMessage(null);
        setErrorKind(null);

        if (selectedModel !== SOURCE_IMAGE_MODEL) {
          setSelectedModel(SOURCE_IMAGE_MODEL);
          persistGeneratePreferences({ selectedModel: SOURCE_IMAGE_MODEL });
        }
      } catch (error) {
        if (!abortController.signal.aborted && insertAsPrepend && triggerTokenToConsume) {
          processedAvatarTriggerRef.current = triggerTokenToConsume;
        }
        // Тихий fallback: при недоступном photo_url оставляем текущий UI без ошибки.
        if (!abortController.signal.aborted) {
          console.info('Автоподстановка Telegram-аватара недоступна:', error);
        }
      } finally {
        avatarAutofillInFlightRef.current = false;
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [
    appendSourceImages,
    prependSourceImages,
    avatarAutofillBlockReason,
    persistGeneratePreferences,
    resetUploadedSourceImageCache,
    selectedModel,
    avatarTriggerToken,
    effectiveAvatarUrl,
    hasPendingAvatarTrigger,
    currentStatus,
    fileId,
    historyOpen,
    imageId,
    pageState,
    profileAvatarFileId,
    resultImageUrl,
    saveError,
    saveNoticeText,
    savedStickerSetName,
    stickerSaved,
    taskId,
    telegramUserId,
    userInfo?.id,
    sourceImageFiles.length,
    sourceImageOrigin,
  ]);

  const buildSourceImageSignature = useCallback((files: File[]): string => {
    if (!files.length) {
      return 'empty';
    }
    return files
      .map((file) => `${file.type}:${file.size}:${file.lastModified}:${file.name}`)
      .join('|');
  }, []);

  const ensureUploadedSourceImageIds = useCallback(async (): Promise<string[]> => {
    if (!sourceImageFiles.length) {
      return [];
    }

    const cachedImageIds = uploadedSourceImageIdsRef.current;
    const uploadedAt = uploadedSourceImageAtRef.current;
    const currentSignature = buildSourceImageSignature(sourceImageFiles);
    const hasFreshCachedUpload =
      cachedImageIds.length > 0 &&
      uploadedSourceImageSignatureRef.current === currentSignature &&
      uploadedAt != null &&
      Date.now() - uploadedAt < SOURCE_IMAGE_ID_REUSE_WINDOW_MS;

    if (hasFreshCachedUpload) {
      return cachedImageIds;
    }

    const uploadResponse = await apiClient.uploadSourceImages(sourceImageFiles);
    uploadedSourceImageIdsRef.current = uploadResponse.imageIds;
    uploadedSourceImageAtRef.current = Date.now();
    uploadedSourceImageSignatureRef.current = currentSignature;
    return uploadResponse.imageIds;
  }, [buildSourceImageSignature, sourceImageFiles]);

  const buildOwnStyleSessionFromBlueprint = useCallback((params: {
    blueprint: UserPresetCreationBlueprintDto;
    code?: string | null;
    name?: string | null;
  }) => {
    const { blueprint, code, name } = params;
    const sortedCats = [...stylePresetCategories].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const firstCatId = sortedCats[0]?.id;
    const defaults = blueprint.presetDefaults as Partial<CreateStylePresetRequest>;
    const overlay: Partial<CreateStylePresetRequest> = {
      code: typeof code === 'string' && code.trim() ? code.trim() : buildAutoStylePresetCode(user?.id),
      name: typeof name === 'string' && name.trim() ? name.trim() : 'Черновик',
    };
    if (defaults.categoryId == null && firstCatId !== undefined) {
      overlay.categoryId = firstCatId;
    }
    const mergedReq = mergeCreateStylePresetRequest(blueprint.presetDefaults, overlay);
    const categoryDto =
      mergedReq.categoryId != null
        ? sortedCats.find((c) => c.id === mergedReq.categoryId) ?? null
        : firstCatId != null
          ? sortedCats.find((c) => c.id === firstCatId) ?? null
          : null;
    const virtualPreset = buildVirtualOwnStylePreset({
      merged: mergedReq,
      category: categoryDto,
      ownerProfileId: userInfo?.id,
    });
    return {
      blueprint,
      virtualPreset,
      draftPresetId: null,
      createRequest: mergedReq,
    };
  }, [stylePresetCategories, user?.id, userInfo?.id]);

  const ensureOwnStyleDraftPresetId = useCallback(async (): Promise<number> => {
    const session = ownStyleBlueprintSession;
    if (!session) {
      throw new Error('Сессия своего стиля не инициализирована');
    }
    if (typeof session.draftPresetId === 'number' && session.draftPresetId > 0) {
      return session.draftPresetId;
    }
    const targetCode = (session.createRequest.code ?? '').trim();
    if (!targetCode) {
      throw new Error('Не удалось определить код пользовательского пресета.');
    }
    let created: StylePreset;
    try {
      created = await apiClient.createStylePreset(session.createRequest);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.toLowerCase() : '';
      const duplicateCode = msg.includes('already exists') || msg.includes('уже существует');
      if (!duplicateCode) {
        throw e;
      }
      const merged = await apiClient.loadStylePresetsMerged();
      const existing = merged.find((item) => {
        const itemCode = (item.code ?? '').trim();
        if (!itemCode || itemCode.toLowerCase() !== targetCode.toLowerCase()) return false;
        if (item.isGlobal) return false;
        return userInfo?.id == null || item.ownerId === userInfo.id;
      });
      if (!existing) {
        throw e;
      }
      created = existing;
    }
    setOwnStyleBlueprintSession((prev) => {
      if (!prev) return prev;
      if (prev.blueprint.code !== session.blueprint.code) return prev;
      return {
        ...prev,
        draftPresetId: created.id,
        virtualPreset: {
          ...prev.virtualPreset,
          presetReferenceImageUrl: created.presetReferenceImageUrl ?? prev.virtualPreset.presetReferenceImageUrl,
          presetReferenceSourceImageId:
            created.presetReferenceSourceImageId ?? prev.virtualPreset.presetReferenceSourceImageId,
        },
      };
    });
    return created.id;
  }, [ownStyleBlueprintSession, userInfo?.id]);

  const uploadPresetReferenceSlotToGallery = useCallback(async (files: File[]): Promise<UploadImagesResponse> => {
    if (!files.length) return { imageIds: [] };
    const firstFile = files[0];
    const usingOwnStyleVirtual = isOwnStyleBlueprintVirtualPreset(selectedStylePresetId);
    const selectedPresetForUpload =
      selectedStylePresetId != null ? stylePresets.find((p) => p.id === selectedStylePresetId) ?? null : null;
    const ownerOwnsSelectedPreset =
      selectedPresetForUpload != null &&
      selectedPresetForUpload.id > 0 &&
      !selectedPresetForUpload.isGlobal &&
      userInfo?.id != null &&
      selectedPresetForUpload.ownerId === userInfo.id;

    let presetIdForUpload: number;
    if (usingOwnStyleVirtual) {
      presetIdForUpload = await ensureOwnStyleDraftPresetId();
    } else if (ownerOwnsSelectedPreset) {
      presetIdForUpload = selectedPresetForUpload!.id;
    } else {
      throw new Error('Для загрузки preset_ref нужен ваш черновик пресета.');
    }

    const updated = await uploadPresetReference(presetIdForUpload, firstFile);
    const sourceId = updated.presetReferenceSourceImageId?.trim() ?? '';
    assertPresetRefGalleryImageIds([sourceId]);
    if (!usingOwnStyleVirtual && ownerOwnsSelectedPreset) {
      setStylePresets((prev) => prev.map((item) => (item.id === presetIdForUpload ? { ...item, ...updated } : item)));
    }
    if (usingOwnStyleVirtual) {
      setOwnStyleBlueprintSession((prev) => {
        if (!prev) return prev;
        if (typeof prev.draftPresetId !== 'number' || prev.draftPresetId !== presetIdForUpload) return prev;
        return {
          ...prev,
          virtualPreset: {
            ...prev.virtualPreset,
            presetReferenceImageUrl: updated.presetReferenceImageUrl ?? prev.virtualPreset.presetReferenceImageUrl,
            presetReferenceSourceImageId:
              updated.presetReferenceSourceImageId ?? prev.virtualPreset.presetReferenceSourceImageId,
          },
        };
      });
    }
    return { imageIds: [sourceId] };
  }, [ensureOwnStyleDraftPresetId, selectedStylePresetId, stylePresets, userInfo?.id]);

  const ensureOwnStyleSessionForHistory = useCallback(async (entry: GenerateHistoryEntry): Promise<boolean> => {
    if (!isOwnStyleBlueprintVirtualPreset(entry.stylePresetId)) return true;
    const blueprintCode = entry.ownStyleBlueprintCode?.trim();
    if (!blueprintCode) return false;

    if (ownStyleBlueprintSession?.blueprint.code === blueprintCode) {
      return true;
    }

    let blueprints = userPresetCreationBlueprints;
    if (!blueprints.length) {
      try {
        blueprints = await apiClient.getUserPresetCreationBlueprints();
        setUserPresetCreationBlueprints(blueprints);
      } catch {
        blueprints = [];
      }
    }

    const bp = blueprints.find((item) => item.code === blueprintCode);
    if (!bp) return false;

    const session = buildOwnStyleSessionFromBlueprint({
      blueprint: bp,
      code: entry.stylePresetCode,
      name: entry.stylePresetName,
    });
    setOwnStyleBlueprintSession(session);
    setPublishCostHint(bp.estimatedPublicationCostArt ?? null);
    setPublishUiHints(bp.uiHints ?? null);
    return true;
  }, [
    buildOwnStyleSessionFromBlueprint,
    ownStyleBlueprintSession?.blueprint.code,
    userPresetCreationBlueprints,
  ]);

  useEffect(() => {
    syncHistoryEntries();
  }, [syncHistoryEntries]);

  useEffect(() => {
    restoreAppliedRef.current = false;
    preferencesAppliedRef.current = false;
    resumeSessionAppliedRef.current = false;
    setFailedHistoryPresetPreviewIds(new Set());
    setPinnedHistoryLocalId(null);
  }, [historyUserScopeId]);

  useEffect(() => {
    if (!historyUserScopeId || restoreAppliedRef.current) return;
    const entries = readGenerateHistory(historyUserScopeId);
    setHistoryEntries(entries);
    restoreAppliedRef.current = true;
    const activeEntry =
      entries.find((entry) => entry.isActive) ??
      entries.find((entry) => !TERMINAL_GENERATION_STATUSES.includes(entry.generationStatus ?? 'PENDING'));
    if (!activeEntry) return;

    let cancelled = false;
    (async () => {
      const ownStyleSessionReady = await ensureOwnStyleSessionForHistory(activeEntry);
      if (cancelled) return;

      setPrompt(activeEntry.prompt);
      setSelectedModel(normalizeGenerateModel(activeEntry.model));
      setSelectedStylePresetId(
        isOwnStyleBlueprintVirtualPreset(activeEntry.stylePresetId) && !ownStyleSessionReady
          ? null
          : activeEntry.stylePresetId,
      );
      setSelectedEmoji(activeEntry.selectedEmoji);
      setRemoveBackground(activeEntry.removeBackground);
      setTaskId(activeEntry.taskId);
      setCurrentStatus(activeEntry.generationStatus ?? 'PENDING');
      setFileId(activeEntry.fileId);
      setStickerSaved(Boolean(activeEntry.fileId));
      setSavedStickerSetName(activeEntry.savedStickerSetName ?? null);
      setSavedStickerSetTitle(activeEntry.savedStickerSetTitle ?? null);
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('generating');
      activeHistoryLocalIdRef.current = activeEntry.localId;
      setPinnedHistoryLocalId(activeEntry.localId);
      preferencesAppliedRef.current = true;

      if (activeEntry.taskId) {
        startPolling(activeEntry.taskId, activeEntry.localId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureOwnStyleSessionForHistory, historyUserScopeId, startPolling]);

  useEffect(() => {
    if (!historyUserScopeId || preferencesAppliedRef.current) return;

    const entries = readGenerateHistory(historyUserScopeId);
    const activeEntry =
      entries.find((entry) => entry.isActive) ??
      entries.find((entry) => !TERMINAL_GENERATION_STATUSES.includes(entry.generationStatus ?? 'PENDING'));
    if (activeEntry) {
      return;
    }

    let resumeId: string | null = null;
    try {
      resumeId = sessionStorage.getItem(getGenerateResumeLocalIdKey(historyUserScopeId));
    } catch {
      /* */
    }
    if (resumeId) {
      const resumeEntry = entries.find((e) => e.localId === resumeId);
      if (resumeEntry) {
        return;
      }
    }

    const savedPreferences = readGeneratePreferences(historyUserScopeId);
    if (savedPreferences) {
      setSelectedModel(normalizeGenerateModel(savedPreferences.selectedModel));
      setSelectedStylePresetId(savedPreferences.stylePresetId);
      setSelectedEmoji(savedPreferences.selectedEmoji);
      setRemoveBackground(savedPreferences.removeBackground);
      preferencesAppliedRef.current = true;
      return;
    }

    if (stylePresets.length === 0) return;

    setSelectedModel(DEFAULT_GENERATE_MODEL);
    setSelectedStylePresetId(null);
    setSelectedEmoji(DEFAULT_GENERATE_EMOJI);
    setRemoveBackground(DEFAULT_REMOVE_BACKGROUND);
    preferencesAppliedRef.current = true;
  }, [historyUserScopeId, stylePresets]);

  /** Deep link стиля: `start_param` = `sag_style_<id>` после GET …/style-presets (merged). `ref_` не трогаем. */
  useEffect(() => {
    if (!styleCatalogLoaded || styleDeepLinkHandledRef.current) return;

    const rawStart = resolveTelegramStartParam(tg, initData);
    if (rawStart == null || rawStart.length === 0) {
      styleDeepLinkHandledRef.current = true;
      return;
    }
    if (rawStart.startsWith(REFERRAL_START_PARAM_PREFIX)) {
      styleDeepLinkHandledRef.current = true;
      return;
    }

    const presetId = parseStylePresetIdFromStartParam(rawStart);
    if (presetId == null) {
      styleDeepLinkHandledRef.current = true;
      return;
    }

    const preset = stylePresets.find((p) => p.id === presetId);
    if (!preset) {
      setDeepLinkPresetMissingNotice(true);
      styleDeepLinkHandledRef.current = true;
      return;
    }

    setSelectedStylePresetId(presetId);
    setDeepLinkStyleBoostId(presetId);

    const uid = userInfo?.id ?? null;
    if (uid != null && !preset.isGlobal && preset.ownerId === uid) {
      setStyleCategoryFilter(STYLE_CATEGORY_FILTER_MY);
    } else if (preset.category?.id != null) {
      setStyleCategoryFilter(preset.category.id);
    }

    if (historyUserScopeId) {
      persistGeneratePreferences({ stylePresetId: presetId });
    }

    styleDeepLinkHandledRef.current = true;
  }, [
    styleCatalogLoaded,
    stylePresets,
    tg,
    initData,
    userInfo?.id,
    historyUserScopeId,
    persistGeneratePreferences,
  ]);

  useEffect(() => {
    if (!deepLinkPresetMissingNotice) return;
    const tid = window.setTimeout(() => setDeepLinkPresetMissingNotice(false), 6500);
    return () => window.clearTimeout(tid);
  }, [deepLinkPresetMissingNotice]);

  useEffect(() => {
    if (!stylePresetShareNotice) return;
    const tid = window.setTimeout(() => setStylePresetShareNotice(null), 3200);
    return () => window.clearTimeout(tid);
  }, [stylePresetShareNotice]);

  // Метаданные UI выбранного пресета (виртуальная карточка «своего стиля»; при загрузке preset_ref черновик создаётся лениво).
  const selectedPreset: StylePreset | null = useMemo(() => {
    if (isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) && ownStyleBlueprintSession) {
      return ownStyleBlueprintSession.virtualPreset;
    }
    if (selectedStylePresetId == null) return null;
    return stylePresets.find((p) => p.id === selectedStylePresetId) ?? null;
  }, [ownStyleBlueprintSession, selectedStylePresetId, stylePresets]);

  const canShareStylePresetDeepLink =
    selectedPreset != null &&
    selectedPreset.shareableAsDeepLink === true &&
    typeof selectedPreset.deepLinkStartParam === 'string' &&
    selectedPreset.deepLinkStartParam.trim().length > 0;

  const canDeleteSelectedStylePresetAsAuthor =
    selectedStylePresetId != null &&
    !isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) &&
    selectedPreset?.canDeleteAsAuthor === true;

  const handleShareSelectedStylePreset = useCallback(async () => {
    if (!canShareStylePresetDeepLink || !selectedPreset?.deepLinkStartParam) return;
    const param = selectedPreset.deepLinkStartParam.trim();
    const serverUrl =
      typeof selectedPreset.deepLinkUrl === 'string' ? selectedPreset.deepLinkUrl.trim() : '';
    const url = serverUrl.length > 0 ? serverUrl : null;
    const textToCopy = url ?? param;
    try {
      await navigator.clipboard.writeText(textToCopy);
      tg?.HapticFeedback?.impactOccurred('light');
      if (url) {
        setStylePresetShareNotice('Ссылка на стиль скопирована');
      } else {
        setStylePresetShareNotice(
          'Скопирован только параметр стиля (startapp). Полную ссылку отдаёт бэкенд в deepLinkUrl — проверьте app.telegram.bot-username и includeUi.',
        );
        console.warn('[GeneratePage] deepLinkUrl пуст — в буфер только startapp:', param);
      }
    } catch {
      tg?.showAlert?.('Не удалось скопировать ссылку.');
    }
  }, [canShareStylePresetDeepLink, selectedPreset, tg]);

  const handleDeleteSelectedStylePreset = useCallback(async () => {
    if (!canDeleteSelectedStylePresetAsAuthor || selectedStylePresetId == null) return;
    const presetId = selectedStylePresetId;
    const confirmMsg = 'Удалить этот стиль? Его нельзя будет восстановить.';
    let confirmed = false;
    if (isMockMode || typeof tg?.showConfirm !== 'function') {
      confirmed = window.confirm(confirmMsg);
    } else {
      confirmed = await new Promise<boolean>((resolve) => {
        tg.showConfirm(confirmMsg, (ok) => resolve(Boolean(ok)));
      });
    }
    if (!confirmed) return;

    setStylePresetDeleting(true);
    try {
      await apiClient.deleteStylePreset(presetId);
      tg?.HapticFeedback?.notificationOccurred('success');
      setDeepLinkStyleBoostId((prev) => (prev === presetId ? null : prev));
      setOwnStyleBlueprintSession((prev) => {
        if (!prev) return prev;
        return prev.draftPresetId === presetId ? null : prev;
      });
      setSelectedStylePresetId(null);
      persistGeneratePreferences({ stylePresetId: null });
      const list = await apiClient.loadStylePresetsMerged();
      setStylePresets(list);
    } catch (e: unknown) {
      tg?.showAlert?.(e instanceof Error ? e.message : 'Не удалось удалить стиль');
    } finally {
      setStylePresetDeleting(false);
    }
  }, [
    canDeleteSelectedStylePresetAsAuthor,
    isMockMode,
    persistGeneratePreferences,
    selectedStylePresetId,
    tg,
  ]);

  const promptInputCfg = selectedPreset?.promptInput ?? null;
  /** Показывать ли основное поле prompt по preset.promptInput (скрывается только когда enabled явно false). */
  const showPromptInput = promptInputCfg ? promptInputCfg.enabled : true;
  /** Итог для UI/submit: учитывает hideFreestylePromptAuthorSupplied с бэка (privacy авторского промпта). */
  const hideFreestylePromptAuthorSupplied = selectedPreset?.hideFreestylePromptAuthorSupplied === true;
  const effectiveShowPromptInput = showPromptInput && !hideFreestylePromptAuthorSupplied;
  /** Является ли prompt обязательным */
  const promptIsRequired = effectiveShowPromptInput && (promptInputCfg ? (promptInputCfg.required ?? true) : true);
  const effectiveMaxPromptLen = promptInputCfg?.maxLength ?? MAX_PROMPT_LENGTH;
  /** Первая в истории готовая картинка — для черновика: подсказка в промпте (не для hero-блока) */
  const latestCompletedGenerationPreviewUrl = useMemo(() => {
    for (const e of historyEntries) {
      const ready = e.generationStatus === 'COMPLETED' || e.pageState === 'success';
      if (!ready) continue;
      const url = e.resultImageUrl?.trim();
      if (url) return url;
    }
    return null;
  }, [historyEntries]);
  const effectivePromptPlaceholder = useMemo(() => {
    const baseDefault = 'Опишите свою идею или используйте готовые стили!';
    const base = promptInputCfg?.placeholder ?? baseDefault;
    const virtualOwn = isOwnStyleBlueprintVirtualPreset(selectedStylePresetId);
    if (virtualOwn && latestCompletedGenerationPreviewUrl) {
      return OWN_STYLE_AFTER_LAST_RESULT_PLACEHOLDER;
    }
    return base;
  }, [latestCompletedGenerationPreviewUrl, promptInputCfg?.placeholder, selectedStylePresetId]);
  const selectedPresetFieldDefs: StylePresetField[] = selectedPreset?.fields ?? [];
  const referenceFieldDefs = useMemo(
    () => selectedPresetFieldDefs.filter((f) => f.type === 'reference'),
    [selectedPresetFieldDefs],
  );
  const effectiveReferenceMaxUnique = useMemo(() => {
    const raw = selectedPreset?.promptInput?.referenceImages?.maxCount;
    if (raw == null || !Number.isFinite(raw) || raw <= 0) {
      return MAX_SOURCE_IMAGE_FILES;
    }
    return Math.min(MAX_SOURCE_IMAGE_FILES, Math.floor(raw));
  }, [selectedPreset]);
  const hasReferenceSlotsFilled = useMemo(
    () => referenceFieldDefs.some((f) => (referenceAssignments[f.key] ?? []).length > 0),
    [referenceAssignments, referenceFieldDefs],
  );
  useEffect(() => {
    const activeLocalId = activeHistoryLocalIdRef.current;
    if (!activeLocalId || !historyUserScopeId) return;
    const snapshots = buildReferenceSnapshotsForHistory();
    patchHistoryEntry(
      { localId: activeLocalId },
      {
        hasSourceImage: sourceImageFiles.length > 0 || hasReferenceSlotsFilled,
        referenceAssignmentsSnapshot: snapshots.referenceAssignmentsSnapshot,
        referencePreviewSnapshot: snapshots.referencePreviewSnapshot,
      },
    );
  }, [
    buildReferenceSnapshotsForHistory,
    hasReferenceSlotsFilled,
    historyUserScopeId,
    patchHistoryEntry,
    sourceImageFiles.length,
  ]);
  const lockedPresetRefFieldKeys = useMemo(
    () =>
      isLockedServerPresetReferenceSlot(selectedPreset)
        ? new Set<string>([PRESET_REF_FIELD_KEY])
        : new Set<string>(),
    [selectedPreset],
  );

  /** Сколько слотов под пользовательские референсы даёт пресет (без заблокированного preset_ref с сервера). */
  const presetUserRefSlotTotal = useMemo(() => {
    let n = 0;
    for (const f of referenceFieldDefs) {
      if (lockedPresetRefFieldKeys.has(f.key)) continue;
      n += Math.max(1, f.maxImages ?? 1);
    }
    return n;
  }, [referenceFieldDefs, lockedPresetRefFieldKeys]);

  const userRefSlotsBudgetSig = useMemo(
    () =>
      referenceFieldDefs
        .map((f) => `${f.key}:${f.maxImages ?? 1}:${lockedPresetRefFieldKeys.has(f.key) ? 1 : 0}`)
        .join('|'),
    [referenceFieldDefs, lockedPresetRefFieldKeys],
  );

  /** Синхронизация слота preset_ref с DTO пресета (после смены стиля или загрузки списка пресетов). */
  useEffect(() => {
    if (!selectedPreset) return;
    const srcId = getPresetReferenceSlotSourceId(selectedPreset);
    if (!srcId || !presetHasPresetReferenceField(selectedPreset)) return;
    setReferenceAssignments((prev) => {
      const existing = prev[PRESET_REF_FIELD_KEY] ?? [];
      if (existing.some((id) => typeof id === 'string' && id.trim().length > 0)) {
        return prev;
      }
      return { ...prev, [PRESET_REF_FIELD_KEY]: [srcId] };
    });
    const srcUrl =
      typeof selectedPreset.presetReferenceImageUrl === 'string'
        ? selectedPreset.presetReferenceImageUrl.trim()
        : '';
    if (srcUrl) {
      setReferencePreviewById((prev) => (prev[srcId] ? prev : { ...prev, [srcId]: srcUrl }));
    }
  }, [selectedPreset]);

  const autoAssignNewSourceFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (!selectedPresetFieldDefs.some((f) => f.type === 'reference')) return;

      let working: Record<string, string[]> = { ...referenceAssignmentsRef.current };
      for (const f of selectedPresetFieldDefs) {
        if (f.type === 'reference' && working[f.key] === undefined) {
          working[f.key] = [];
        }
      }

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const fingerprint = await buildSourceImageFingerprint(file);
        const existingIdForFp = Object.entries(refImageIdToFingerprintRef.current).find(
          ([, v]) => v === fingerprint,
        )?.[0];

        const avatarSkipPresetRef =
          isTelegramAvatarSourceFile(file) ?
            new Set<string>([PRESET_REF_FIELD_KEY])
          : undefined;
        let slot = findNextEmptyReferenceSlot(
          working,
          selectedPresetFieldDefs,
          lockedPresetRefFieldKeys,
          avatarSkipPresetRef,
        );
        if (!slot && avatarSkipPresetRef) {
          slot = findNextEmptyReferenceSlot(
            working,
            selectedPresetFieldDefs,
            lockedPresetRefFieldKeys,
          );
        }
        if (!slot) break;

        const uniques = collectUniqueReferenceImageIds(working);
        const listSnapshot = [...(working[slot.fieldKey] ?? [])];
        if (listSnapshot[slot.index]) continue;

        if (existingIdForFp) {
          if (uniques.has(existingIdForFp)) continue;
          if (uniques.size >= effectiveReferenceMaxUnique) break;
          const list = [...(working[slot.fieldKey] ?? [])];
          list[slot.index] = existingIdForFp;
          working = { ...working, [slot.fieldKey]: list };
          referenceAssignmentsRef.current = working;
          setReferenceAssignments(working);
          const preview = await blobToDataUrl(file);
          if (preview) {
            setReferencePreviewById((prev) =>
              prev[existingIdForFp] ? prev : { ...prev, [existingIdForFp]: preview },
            );
          }
          continue;
        }

        if (uniques.size >= effectiveReferenceMaxUnique) break;

        try {
          const uploadFn =
            slot.fieldKey === PRESET_REF_FIELD_KEY
              ? uploadPresetReferenceSlotToGallery
              : apiClient.uploadSourceImages.bind(apiClient);
          const { imageIds } = await uploadFn([file]);
          const newId = imageIds[0];
          if (!newId) continue;

          await registerRefImageIdsForFiles([newId], [file]);
          const preview = await blobToDataUrl(file);
          if (preview) {
            setReferencePreviewById((prev) => ({ ...prev, [newId]: preview }));
          }

          const list = [...(working[slot.fieldKey] ?? [])];
          list[slot.index] = newId;
          working = { ...working, [slot.fieldKey]: list };
          referenceAssignmentsRef.current = working;
          setReferenceAssignments(working);
        } catch (e) {
          console.warn('[GeneratePage] Не удалось автоматически заполнить слот референса', e);
          break;
        }
      }
    },
    [
      buildSourceImageFingerprint,
      effectiveReferenceMaxUnique,
      lockedPresetRefFieldKeys,
      registerRefImageIdsForFiles,
      selectedPresetFieldDefs,
      uploadPresetReferenceSlotToGallery,
    ],
  );

  autoAssignNewSourceFilesRef.current = autoAssignNewSourceFiles;

  /** Подставляет уже прикреплённые к ленте фото в слоты при смене пресета (добавление файлов обрабатывает appendSourceImages). */
  useEffect(() => {
    if (!selectedPresetFieldDefs.some((f) => f.type === 'reference')) return;
    const files = sourceImageFilesRef.current;
    if (!files.length) return;
    void autoAssignNewSourceFiles(files);
  }, [autoAssignNewSourceFiles, selectedStylePresetId, userRefSlotsBudgetSig]);

  const stickerEmojiCaption = selectedPreset?.stickerEmojiLabel?.trim() || null;

  const removeBgResolved = resolveRemoveBackground(
    selectedPreset?.removeBackgroundMode,
    removeBackground,
  );
  const removeBgLocked = selectedPreset?.removeBackgroundLockedToPreset === true;
  const lockedRemoveBgEffective = (() => {
    if (!removeBgLocked) return false;
    const eff = selectedPreset?.removeBackgroundEffective;
    if (typeof eff === 'boolean') return eff;
    const fromMode = resolveRemoveBackground(selectedPreset?.removeBackgroundMode, removeBackground);
    if (!fromMode.userControlled) return fromMode.value;
    return removeBackground;
  })();
  const showRemoveBgToggle = removeBgLocked || removeBgResolved.userControlled;
  const effectiveRemoveBackground = removeBgLocked ? lockedRemoveBgEffective : removeBgResolved.value;

  const renderRemoveBgToggle = (disabled: boolean) => {
    if (!showRemoveBgToggle) return null;

    if (removeBgLocked) {
      const on = effectiveRemoveBackground;
      return (
        <div
          className="generate-remove-bg-locked-pill"
          role="status"
          aria-label={
            on
              ? 'Стиль фиксирует удаление фона при генерации'
              : 'Стиль фиксирует сохранение фона при генерации'
          }
        >
          <span className="generate-remove-bg-locked-pill__text">
            {on ? 'Удаление фона · по стилю' : 'Фон сохраняется · по стилю'}
          </span>
        </div>
      );
    }

    return (
      <label className="generate-checkbox-label generate-checkbox-label--inline">
        <input
          type="checkbox"
          className="generate-checkbox"
          checked={removeBackground}
          disabled={disabled}
          onChange={(e) => {
            setRemoveBackground(e.target.checked);
            persistGeneratePreferences({ removeBackground: e.target.checked });
          }}
        />
        <span>Удалить фон</span>
      </label>
    );
  };

  const applyReferenceMove = useCallback(
    (payload: PresetReferenceMovePayload & { toKey: string; toIndex: number }) => {
      if (lockedPresetRefFieldKeys.has(payload.fromKey) || lockedPresetRefFieldKeys.has(payload.toKey)) {
        return;
      }
      setSuppressSourceStripItemReveal(false);
      const { imageId, fromKey, fromIndex, toKey, toIndex } = payload;

      setReferenceAssignments((prev) => {
        const getMax = (key: string) => {
          const f = selectedPresetFieldDefs.find((x) => x.key === key && x.type === 'reference');
          return Math.max(1, f?.maxImages ?? 1);
        };

        const clone: Record<string, string[]> = {};
        for (const k of Object.keys(prev)) {
          clone[k] = [...(prev[k] ?? [])];
        }
        for (const f of selectedPresetFieldDefs) {
          if (f.type === 'reference' && clone[f.key] === undefined) {
            clone[f.key] = [];
          }
        }

        const fromMax = getMax(fromKey);
        const fromList = [...(clone[fromKey] ?? [])];
        if (fromList[fromIndex] !== imageId) {
          return prev;
        }

        if (fromKey === toKey) {
          const list = [...fromList];
          const [moved] = list.splice(fromIndex, 1);
          if (!moved) return prev;
          let idx = toIndex;
          if (fromIndex < toIndex) idx -= 1;
          idx = Math.max(0, Math.min(idx, list.length));
          list.splice(idx, 0, moved);
          if (list.length > fromMax) return prev;
          clone[fromKey] = list;
          return clone;
        }

        fromList.splice(fromIndex, 1);
        clone[fromKey] = fromList;

        const maxTo = getMax(toKey);
        let toList = [...(clone[toKey] ?? [])].filter((x) => x !== imageId);

        if (maxTo <= 1) {
          clone[toKey] = [imageId];
          return clone;
        }

        if (toList.length >= maxTo) {
          return prev;
        }
        const idx = Math.min(Math.max(0, toIndex), toList.length);
        toList.splice(idx, 0, imageId);
        clone[toKey] = toList;
        return clone;
      });
    },
    [lockedPresetRefFieldKeys, selectedPresetFieldDefs],
  );

  /** Снимает imageId только из слота пресета. Ленту вложений не трогает; refImageId→fingerprint оставляем для удаления с ленты. */
  const handleReferenceRemove = useCallback((fieldKey: string, index: number) => {
    if (lockedPresetRefFieldKeys.has(fieldKey)) return;
    setSuppressSourceStripItemReveal(false);
    setReferenceAssignments((prev) => {
      const list = [...(prev[fieldKey] ?? [])];
      if (index < 0 || index >= list.length) return prev;
      const removedId = list[index];
      if (!removedId) return prev;
      list.splice(index, 1);
      const next = { ...prev, [fieldKey]: list };
      queueMicrotask(() => {
        setReferencePreviewById((p) => {
          if (collectUniqueReferenceImageIds(next).has(removedId)) return p;
          if (!p[removedId]) return p;
          const n = { ...p };
          delete n[removedId];
          return n;
        });
      });
      return next;
    });
  }, [lockedPresetRefFieldKeys]);

  const handleReferenceAddFiles = useCallback(
    async (fieldKey: string, files: File[]) => {
      if (lockedPresetRefFieldKeys.has(fieldKey)) return;
      const field = selectedPresetFieldDefs.find((f) => f.key === fieldKey && f.type === 'reference');
      if (!field || field.type !== 'reference' || !files.length) return;

      const maxSlot = Math.max(1, field.maxImages ?? 1);
      const listSnapshot = referenceAssignments[fieldKey] ?? [];
      const room = maxSlot - listSnapshot.length;
      if (room <= 0) return;

      const slice = files.slice(0, room);
      setReferenceUploadingKey(fieldKey);
      setErrorMessage(null);
      try {
        setSuppressSourceStripItemReveal(false);
        const uploadFn =
          fieldKey === PRESET_REF_FIELD_KEY
            ? (filesInner: File[]) => uploadPresetReferenceSlotToGallery(filesInner)
            : (filesInner: File[]) => apiClient.uploadSourceImages(filesInner);
        const { imageIds } = await uploadFn(slice);
        await registerRefImageIdsForFiles(imageIds, slice);
        // Единый UX: фото, добавленные в reference-слоты, также показываем в общей ленте вложений.
        // appendSourceImages сам убирает дубликаты по fingerprint.
        void appendSourceImages(slice, { skipReferenceAutoFill: true });
        const previews = await Promise.all(slice.map((f) => blobToDataUrl(f)));

        setReferencePreviewById((prev) => {
          const next = { ...prev };
          imageIds.forEach((id, i) => {
            if (previews[i]) next[id] = previews[i];
          });
          return next;
        });

        setReferenceAssignments((prev) => {
          const effMax = effectiveReferenceMaxUnique;
          const uniques = collectUniqueReferenceImageIds(prev);
          const list = [...(prev[fieldKey] ?? [])];
          for (let i = 0; i < imageIds.length && list.length < maxSlot; i++) {
            const id = imageIds[i];
            if (!id || list.includes(id)) continue;
            if (!uniques.has(id) && uniques.size >= effMax) {
              break;
            }
            uniques.add(id);
            list.push(id);
          }
          return { ...prev, [fieldKey]: list };
        });
      } catch (e: any) {
        setErrorMessage(typeof e?.message === 'string' ? e.message : 'Не удалось загрузить изображение');
        setErrorKind('upload');
        setPageState('error');
      } finally {
        setReferenceUploadingKey(null);
      }
    },
    [appendSourceImages, effectiveReferenceMaxUnique, lockedPresetRefFieldKeys, referenceAssignments, registerRefImageIdsForFiles, selectedPresetFieldDefs, uploadPresetReferenceSlotToGallery],
  );

  const handleReferenceAddFromSource = useCallback(
    async (fieldKey: string, toIndex: number, sourceIndex: number) => {
      if (lockedPresetRefFieldKeys.has(fieldKey)) return;
      const file = sourceImageFiles[sourceIndex];
      if (!file || !file.type.startsWith('image/')) return;

      const field = selectedPresetFieldDefs.find((f) => f.key === fieldKey && f.type === 'reference');
      if (!field || field.type !== 'reference') return;

      const maxSlot = Math.max(1, field.maxImages ?? 1);
      if (toIndex < 0 || toIndex >= maxSlot) return;

      const listSnapshot = referenceAssignments[fieldKey] ?? [];
      if (listSnapshot[toIndex]) return;
      let used = 0;
      for (let i = 0; i < maxSlot; i++) {
        if (listSnapshot[i]) used++;
      }
      if (used >= maxSlot) return;

      setReferenceUploadingKey(fieldKey);
      setErrorMessage(null);
      try {
        setSuppressSourceStripItemReveal(false);
        const uploadFn =
          fieldKey === PRESET_REF_FIELD_KEY
            ? uploadPresetReferenceSlotToGallery
            : apiClient.uploadSourceImages.bind(apiClient);
        const { imageIds } = await uploadFn([file]);
        const newId = imageIds[0];
        if (!newId) return;

        await registerRefImageIdsForFiles([newId], [file]);
        const preview = await blobToDataUrl(file);
        if (preview) {
          setReferencePreviewById((prev) => ({ ...prev, [newId]: preview }));
        }

        setReferenceAssignments((prev) => {
          const effMax = effectiveReferenceMaxUnique;
          const uniques = collectUniqueReferenceImageIds(prev);
          const list = [...(prev[fieldKey] ?? [])];
          if (list[toIndex]) return prev;
          let c = 0;
          for (let i = 0; i < maxSlot; i++) {
            if (list[i]) c++;
          }
          if (c >= maxSlot) return prev;
          if (list.includes(newId)) return prev;
          if (!uniques.has(newId) && uniques.size >= effMax) return prev;
          const next = [...list];
          next[toIndex] = newId;
          return { ...prev, [fieldKey]: next };
        });
      } catch (e: any) {
        setErrorMessage(typeof e?.message === 'string' ? e.message : 'Не удалось загрузить изображение');
        setErrorKind('upload');
        setPageState('error');
      } finally {
        setReferenceUploadingKey(null);
      }
    },
    [effectiveReferenceMaxUnique, lockedPresetRefFieldKeys, referenceAssignments, registerRefImageIdsForFiles, selectedPresetFieldDefs, sourceImageFiles, uploadPresetReferenceSlotToGallery],
  );

  // Обработка отправки формы
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    const canGenerateWithoutPrompt =
      selectedStylePresetId != null && (sourceImageFiles.length > 0 || hasReferenceSlotsFilled);
    if (effectiveShowPromptInput && promptIsRequired && !canGenerateWithoutPrompt) {
      if (!trimmedPrompt || trimmedPrompt.length < MIN_PROMPT_LENGTH) {
        setErrorMessage('Введите описание стикера');
        setErrorKind('prompt');
        setPageState('error');
        return;
      }
    }
    if (effectiveShowPromptInput && trimmedPrompt.length > effectiveMaxPromptLen) {
      setErrorMessage(`Слишком длинное описание (макс. ${effectiveMaxPromptLen} символов)`);
      setErrorKind('prompt');
      setPageState('error');
      return;
    }
    if (referenceFieldDefs.length > 0) {
      const minGlobal = selectedPreset?.promptInput?.referenceImages?.minCount ?? 0;
      if (minGlobal > 0) {
        const u = collectUniqueReferenceImageIds(referenceAssignments);
        if (u.size < minGlobal) {
          setErrorMessage(`Добавьте не меньше ${minGlobal} уникальных референсных изображений`);
          setErrorKind('prompt');
          setPageState('error');
          return;
        }
      }
    }
    for (const field of selectedPresetFieldDefs) {
      if (field.type === 'reference') {
        const n = (referenceAssignments[field.key] ?? []).length;
        const minI = field.minImages ?? (field.required ? 1 : 0);
        if (n < minI) {
          setErrorMessage(`Заполните слот «${field.label}»`);
          setErrorKind('prompt');
          setPageState('error');
          return;
        }
        continue;
      }
      if (field.required && !(presetFields[field.key]?.trim())) {
        setErrorMessage(`Заполните поле «${field.label}»`);
        setErrorKind('prompt');
        setPageState('error');
        return;
      }
    }

    if (
      isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) &&
      ownStyleBlueprintSession &&
      blueprintNeedsPresetReferenceSlot(ownStyleBlueprintSession.blueprint)
    ) {
      const pid = (referenceAssignments[PRESET_REF_FIELD_KEY] ?? [])[0] ?? '';
      if (!pid.startsWith('img_sagref_')) {
        setErrorMessage(
          'Для своего стиля загрузите опорное фото в слот стиля с устройства — серверу нужен идентификатор img_sagref_… из галереи.',
        );
        setErrorKind('prompt');
        setPageState('error');
        return;
      }
    }

    const promptForApi = effectiveShowPromptInput ? trimmedPrompt : '';

    const retryFromSuccessfulResult =
      pageState === 'success' && typeof resultImageUrl === 'string' && resultImageUrl.trim().length > 0;
    if (retryFromSuccessfulResult && resultImageUrl) {
      setDuringJobPreviousResultUrl(resultImageUrl);
      setSuppressSourceStripItemReveal(true);
    } else {
      setDuringJobPreviousResultUrl(null);
      setSuppressSourceStripItemReveal(false);
    }

    setErrorMessage(null);
    setErrorKind(null);
    setResultImageUrl(null);
    setImageId(null);
    setTaskId(null);
    setFileId(null);
    setStickerSaved(false);
    setSavedStickerSetName(null);
    setSavedStickerSetTitle(null);
    showSaveNotice(null);
    setSaveError(null);
    setCurrentStatus(null);
    setHistoryOpen(false);

    try {
      let uploadedImageIds: string[] = [];
      const localHistoryId = createGenerateHistoryLocalId();
      const now = Date.now();
      activeHistoryLocalIdRef.current = localHistoryId;
      setPinnedHistoryLocalId(localHistoryId);
      const referenceSnapshots = buildReferenceSnapshotsForHistory();
      const isOwnStyleGeneration =
        isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) && ownStyleBlueprintSession != null;
      const stylePresetNameForHistory =
        selectedPreset?.name?.trim() || (isOwnStyleGeneration ? 'Черновик' : null);
      const stylePresetCodeForHistory =
        selectedPreset?.code?.trim() || ownStyleBlueprintSession?.virtualPreset.code || null;
      const styleModerationStatusForHistory = selectedPreset?.moderationStatus ?? (isOwnStyleGeneration ? 'DRAFT' : null);

      if (historyUserScopeId) {
        clearActiveGenerateHistoryEntry(historyUserScopeId);
        const baseEntry: GenerateHistoryEntry = {
          localId: localHistoryId,
          taskId: null,
          createdAt: now,
          updatedAt: now,
          prompt: promptForApi,
          model: selectedModel,
          stylePresetId: selectedStylePresetId,
          stylePresetName: stylePresetNameForHistory,
          stylePresetCode: stylePresetCodeForHistory,
          styleModerationStatus: styleModerationStatusForHistory,
          ownStyleBlueprintCode: ownStyleBlueprintSession?.blueprint.code ?? null,
          selectedEmoji,
          removeBackground: effectiveRemoveBackground,
          hasSourceImage: sourceImageFiles.length > 0 || hasReferenceSlotsFilled,
          pageState:
            sourceImageFiles.length > 0 && !hasReferenceSlotsFilled ? 'uploading' : 'generating',
          generationStatus:
            sourceImageFiles.length > 0 && !hasReferenceSlotsFilled ? null : 'PROCESSING_PROMPT',
          resultImageUrl: null,
          imageId: null,
          fileId: null,
          referenceAssignmentsSnapshot: referenceSnapshots.referenceAssignmentsSnapshot,
          referencePreviewSnapshot: referenceSnapshots.referencePreviewSnapshot,
          savedStickerSetName: null,
          savedStickerSetTitle: null,
          errorMessage: null,
          isActive: true,
        };
        setHistoryEntries(upsertGenerateHistoryEntry(historyUserScopeId, baseEntry));
      }

      if (sourceImageFiles.length > 0 && !hasReferenceSlotsFilled) {
        setPageState('uploading');
        uploadedImageIds = await ensureUploadedSourceImageIds();
        patchHistoryEntry(
          { localId: localHistoryId },
          { pageState: 'generating', generationStatus: 'PROCESSING_PROMPT' }
        );
      }

      setPageState('generating');
      setCurrentStatus('PROCESSING_PROMPT');

      const fieldsToSend: Record<string, string | string[]> = {};
      for (const field of selectedPresetFieldDefs) {
        if (field.type === 'reference') {
          const ids = referenceAssignments[field.key] ?? [];
          if (!ids.length) continue;
          const maxI = Math.max(1, field.maxImages ?? 1);
          if (maxI <= 1) {
            fieldsToSend[field.key] = ids[0];
          } else {
            fieldsToSend[field.key] = ids;
          }
          continue;
        }
        const val = presetFields[field.key]?.trim();
        if (val) fieldsToSend[field.key] = val;
      }

      const serverPresetRefId = getPresetReferenceSlotSourceId(selectedPreset);
      if (serverPresetRefId) {
        const refField = selectedPresetFieldDefs.find(
          (f) => f.key === PRESET_REF_FIELD_KEY && f.type === 'reference',
        );
        const maxI = refField ? Math.max(1, refField.maxImages ?? 1) : 1;
        fieldsToSend[PRESET_REF_FIELD_KEY] = maxI <= 1 ? serverPresetRefId : [serverPresetRefId];
      }

      const legacyImagePayload =
        referenceFieldDefs.length > 0 && hasReferenceSlotsFilled
          ? {}
          : {
              ...(uploadedImageIds.length === 1 ? { image_id: uploadedImageIds[0] } : {}),
              ...(uploadedImageIds.length > 1 ? { image_ids: uploadedImageIds } : {}),
            };

      const response = await apiClient.generateStickerV2({
        prompt: promptForApi,
        model: selectedModel,
        ...(isOwnStyleBlueprintVirtualPreset(selectedStylePresetId)
          ? {
              stylePresetId: null,
              user_style_blueprint_code: ownStyleBlueprintSession?.blueprint.code ?? undefined,
            }
          : { stylePresetId: selectedStylePresetId }),
        num_images: 1,
        remove_background: effectiveRemoveBackground,
        ...legacyImagePayload,
        ...(Object.keys(fieldsToSend).length > 0 ? { preset_fields: fieldsToSend } : {}),
      });
      
      setTaskId(response.taskId);
      patchHistoryEntry({ localId: localHistoryId }, { taskId: response.taskId, pageState: 'generating', isActive: true });
      startPolling(response.taskId, localHistoryId);
    } catch (error: any) {
      let message = 'Не удалось запустить генерацию';
      
      if (error.message === 'INSUFFICIENT_BALANCE') {
        message = 'Недостаточно ART-баллов';
        setErrorKind('general');
      } else if (error.message === 'GENERATION_START_TIMEOUT') {
        message = 'Сервер слишком долго запускает генерацию. Попробуйте снова чуть позже.';
        setErrorKind('general');
      } else if (error.message === 'UPLOAD_TOO_LARGE') {
        message = 'Фото слишком большое. Уменьшите изображение или выберите другое и попробуйте снова.';
        setErrorKind('upload');
      } else if (error.message === 'SOURCE_IMAGE_NOT_FOUND') {
        resetUploadedSourceImageCache();
        message = 'Исходное изображение не найдено или истек срок хранения. Загрузите фото заново.';
        setErrorKind('upload');
      } else if (error.message === 'UNAUTHORIZED') {
        message = 'Требуется авторизация';
        setErrorKind('general');
      } else if (typeof error.message === 'string' && error.message.toLowerCase().includes('загруз')) {
        message = error.message;
        setErrorKind('upload');
      } else if (typeof error.message === 'string' && error.message.toLowerCase().includes('upload')) {
        message = 'Не удалось загрузить изображение. Попробуйте снова.';
        setErrorKind('upload');
      } else if (error.message) {
        message = error.message;
        setErrorKind('general');
      }
      message = mapGenerationErrorMessage(message) ?? message;

      setDuringJobPreviousResultUrl(null);
      setSuppressSourceStripItemReveal(false);

      setErrorMessage(message);
      setPageState('error');
      patchHistoryEntry(
        { localId: activeHistoryLocalIdRef.current ?? undefined },
        {
          pageState: 'error',
          generationStatus: 'FAILED',
          errorMessage: message,
          isActive: false,
        }
      );
    }
  };

  const [isSavingAndSharing, setIsSavingAndSharing] = useState(false);

  const handleSourceImagePick = useCallback(() => {
    sourceImageInputRef.current?.click();
  }, []);

  const handleReferenceAddFilesAtSlot = useCallback(
    async (fieldKey: string, toIndex: number, files: File[]) => {
      if (lockedPresetRefFieldKeys.has(fieldKey)) return;
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (!imageFiles.length) return;

      const field = selectedPresetFieldDefs.find((f) => f.key === fieldKey && f.type === 'reference');
      if (!field || field.type !== 'reference') return;

      const maxSlot = Math.max(1, field.maxImages ?? 1);
      if (toIndex < 0 || toIndex >= maxSlot) return;

      const listSnapshot = referenceAssignments[fieldKey] ?? [];
      if (listSnapshot[toIndex]) return;

      let used = 0;
      for (let i = 0; i < maxSlot; i++) {
        if (listSnapshot[i]) used++;
      }
      const room = maxSlot - used;
      if (room <= 0) return;

      const slice = imageFiles.slice(0, room);

      setReferenceUploadingKey(fieldKey);
      setErrorMessage(null);
      try {
        setSuppressSourceStripItemReveal(false);
        const uploadFn =
          fieldKey === PRESET_REF_FIELD_KEY
            ? (filesInner: File[]) => uploadPresetReferenceSlotToGallery(filesInner)
            : (filesInner: File[]) => apiClient.uploadSourceImages(filesInner);
        const { imageIds } = await uploadFn(slice);
        await registerRefImageIdsForFiles(imageIds, slice);
        // Единый UX: фото из preset-слотов отображаем в общей ленте (без дублей).
        void appendSourceImages(slice, { skipReferenceAutoFill: true });
        const previews = await Promise.all(slice.map((f) => blobToDataUrl(f)));

        setReferencePreviewById((prev) => {
          const next = { ...prev };
          imageIds.forEach((id, i) => {
            if (previews[i]) next[id] = previews[i];
          });
          return next;
        });

        setReferenceAssignments((prev) => {
          const effMax = effectiveReferenceMaxUnique;
          const uniques = collectUniqueReferenceImageIds(prev);
          const list = [...(prev[fieldKey] ?? [])];
          if (list[toIndex]) return prev;

          const placeIds = imageIds.filter(Boolean) as string[];
          const slotOrder: number[] = [];
          for (let s = toIndex; s < maxSlot; s++) slotOrder.push(s);
          for (let s = 0; s < toIndex; s++) slotOrder.push(s);

          let pi = 0;
          for (const s of slotOrder) {
            if (pi >= placeIds.length) break;
            if (list[s]) continue;
            const newId = placeIds[pi++];
            if (!newId || list.includes(newId)) continue;
            if (!uniques.has(newId) && uniques.size >= effMax) break;
            uniques.add(newId);
            list[s] = newId;
          }
          return { ...prev, [fieldKey]: list };
        });
      } catch (e: any) {
        setErrorMessage(typeof e?.message === 'string' ? e.message : 'Не удалось загрузить изображение');
        setErrorKind('upload');
        setPageState('error');
      } finally {
        setReferenceUploadingKey(null);
      }
    },
    [appendSourceImages, effectiveReferenceMaxUnique, lockedPresetRefFieldKeys, referenceAssignments, registerRefImageIdsForFiles, selectedPresetFieldDefs, uploadPresetReferenceSlotToGallery],
  );

  const handleGenerateFormDragOver = useCallback((e: ReactDragEvent) => {
    // Иначе родитель не помечает зону как допустимую для drop — дочерние слоты могут не получить drop
    e.preventDefault();
    if (hasExternalFilesDrag(e.dataTransfer)) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleGenerateFormDrop = useCallback(
    (e: ReactDragEvent) => {
      const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      void appendSourceImages(files);
    },
    [appendSourceImages],
  );

  const clearSourceImage = useCallback((options?: { markAvatarDismissed?: boolean }) => {
    setSuppressSourceStripItemReveal(false);
    const shouldMarkAvatarDismissed = options?.markAvatarDismissed ?? sourceImageFiles.some((file) => isTelegramAvatarSourceFile(file));
    if (shouldMarkAvatarDismissed) {
      setTelegramAvatarDismissed(true);
      persistTelegramAvatarDismissed(true);
    }
    avatarAutofillAppliedRef.current = null;
    refImageIdToFingerprintRef.current = {};
    sourceFingerprintByIndexRef.current = [];
    setSourceImageFiles([]);
    setSourceImagePreviews([]);
    setSourceImageOrigin('none');
    resetUploadedSourceImageCache();
    const presetForRef =
      isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) && ownStyleBlueprintSession
        ? ownStyleBlueprintSession.virtualPreset
        : selectedStylePresetId != null
          ? stylePresets.find((p) => p.id === selectedStylePresetId) ?? null
          : null;
    const presetRefId = getPresetReferenceSlotSourceId(presetForRef);
    const presetRefUrl =
      typeof presetForRef?.presetReferenceImageUrl === 'string' ? presetForRef.presetReferenceImageUrl.trim() : '';
    const keepPresetRef = Boolean(presetRefId && presetHasPresetReferenceField(presetForRef));
    setReferencePreviewById(() => {
      if (keepPresetRef && presetRefUrl && presetRefId) return { [presetRefId]: presetRefUrl };
      return {};
    });
    setReferenceAssignments((prev) => {
      const next = { ...prev };
      for (const f of selectedPresetFieldDefs) {
        if (f.type === 'reference') {
          if (keepPresetRef && presetRefId && f.key === PRESET_REF_FIELD_KEY) {
            next[f.key] = [presetRefId];
            continue;
          }
          next[f.key] = [];
        }
      }
      return next;
    });
  }, [
    persistTelegramAvatarDismissed,
    resetUploadedSourceImageCache,
    selectedPresetFieldDefs,
    selectedStylePresetId,
    ownStyleBlueprintSession,
    sourceImageFiles,
    stylePresets,
  ]);
  clearSourceImageRef.current = clearSourceImage;

  const removeSourceImageAt = useCallback((index: number) => {
    if (index < 0 || index >= sourceImageFiles.length) return;
    setSuppressSourceStripItemReveal(false);
    const removedFile = sourceImageFiles[index];
    const removedTelegramAvatar = isTelegramAvatarSourceFile(removedFile);
    const fp = sourceFingerprintByIndexRef.current[index];

    if (sourceImageFiles.length === 1) {
      clearSourceImage({ markAvatarDismissed: removedTelegramAvatar || sourceImageOrigin === 'telegram-avatar' });
      return;
    }

    if (removedTelegramAvatar) {
      setTelegramAvatarDismissed(true);
      persistTelegramAvatarDismissed(true);
    }

    if (fp) {
      const affectedIds = Object.entries(refImageIdToFingerprintRef.current)
        .filter(([, fpr]) => fpr === fp)
        .map(([id]) => id);
      for (const id of affectedIds) {
        delete refImageIdToFingerprintRef.current[id];
      }
      if (affectedIds.length) {
        const idSet = new Set(affectedIds);
        setReferencePreviewById((prev) => {
          const n = { ...prev };
          for (const id of affectedIds) {
            if (n[id]) delete n[id];
          }
          return n;
        });
        setReferenceAssignments((prev) => {
          const next: Record<string, string[]> = {};
          for (const [k, arr] of Object.entries(prev)) {
            next[k] = (arr ?? []).filter((id) => !id || !idSet.has(id));
          }
          return next;
        });
      }
    }

    sourceFingerprintByIndexRef.current = sourceFingerprintByIndexRef.current.filter((_, j) => j !== index);
    const nextFiles = sourceImageFiles.filter((_, itemIndex) => itemIndex !== index);
    const nextPreviews = sourceImagePreviews.filter((_, itemIndex) => itemIndex !== index);
    setSourceImageFiles(nextFiles);
    setSourceImagePreviews(nextPreviews);
    setSourceImageOrigin(computeSourceImageOriginFromFiles(nextFiles));
    resetUploadedSourceImageCache();
  }, [
    clearSourceImage,
    persistTelegramAvatarDismissed,
    resetUploadedSourceImageCache,
    sourceImageFiles,
    sourceImageOrigin,
    sourceImagePreviews,
  ]);

  const moveSourceImage = useCallback((fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex === toIndex ||
      fromIndex >= sourceImageFiles.length ||
      toIndex >= sourceImageFiles.length
    ) {
      return;
    }

    const reorder = <T,>(items: T[]): T[] => {
      const next = [...items];
      const [movedItem] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedItem);
      return next;
    };

    sourceFingerprintByIndexRef.current = reorder(sourceFingerprintByIndexRef.current);
    setSourceImageFiles((prev) => reorder(prev));
    setSourceImagePreviews((prev) => reorder(prev));
    resetUploadedSourceImageCache();
  }, [resetUploadedSourceImageCache, sourceImageFiles.length]);

  const handleAttachmentPointerInternalDrop = useCallback(
    (e: { drag: DraggingPayload; target: DropTarget | null; clientX: number; clientY: number }) => {
      const { drag, target } = e;
      if (!target) return;
      if (drag.kind === 'ref' && target.type === 'preset') {
        applyReferenceMove({
          ...drag.data,
          toKey: target.fieldKey,
          toIndex: target.slotIndex,
        });
        return;
      }
      if (drag.kind === 'source' && target.type === 'preset') {
        void handleReferenceAddFromSource(target.fieldKey, target.slotIndex, drag.sourceIndex);
        return;
      }
      if (drag.kind === 'source' && target.type === 'source') {
        moveSourceImage(drag.sourceIndex, target.sourceIndex);
      }
    },
    [applyReferenceMove, handleReferenceAddFromSource, moveSourceImage],
  );

  const openChatPicker = useCallback((stickerFileId: string) => {
    const cleanFileId = removeInvisibleChars(stickerFileId).trim();
    const fallbackUrl = buildFallbackShareUrl(cleanFileId);
    const isIos = tg?.platform === 'ios' || tg?.platform === 'iphone' || tg?.platform === 'ipad';

    if (isValidTelegramFileId(cleanFileId) && tg?.switchInlineQuery && !isIos) {
      try {
        // Всегда просим chooser чатов: это и есть нужный inline-сценарий с file_id.
        tg.switchInlineQuery(buildSwitchInlineQuery(cleanFileId), ['users', 'groups', 'channels', 'bots']);
        return;
      } catch (error) {
        console.warn('[GeneratePage] switchInlineQuery failed, fallback to share URL', error);
      }
    }

    // Blind spot: на iOS switchInlineQuery у Mini Apps до сих пор работает нестабильно,
    // поэтому запасной путь держим внутри Telegram, а не в браузере.
    if (tg?.openTelegramLink) {
      try {
        tg.openTelegramLink(fallbackUrl);
        return;
      } catch (error) {
        console.warn('[GeneratePage] openTelegramLink failed, fallback to openLink', error);
      }
    }

    if (tg?.openLink) {
      tg.openLink(fallbackUrl, { try_instant_view: false });
      return;
    }

    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
  }, [tg]);

  const downloadStickerByUrl = useCallback(
    async (downloadUrlRaw: string, stableIdSuffix?: string) => {
      if (!downloadUrlRaw.trim() || isDownloadingResult) return;

      const stableId = stableIdSuffix || imageId || taskId || Date.now().toString();
      setIsDownloadingResult(true);
      setSaveError(null);

      try {
        const response = await fetch(downloadUrlRaw);
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const extension = getImageDownloadExtension(blob.type, downloadUrlRaw);
        const objectUrl = URL.createObjectURL(blob);

        triggerImageDownload(objectUrl, `stixly-${stableId}.${extension}`);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
        showSaveNotice('Скачивание началось');
        tg?.HapticFeedback?.notificationOccurred('success');
      } catch (error) {
        console.warn('[GeneratePage] Failed to download image as blob, falling back to direct link', error);

        try {
          const extension = getImageDownloadExtension(null, downloadUrlRaw);
          triggerImageDownload(downloadUrlRaw, `stixly-${stableId}.${extension}`);
          showSaveNotice('Открываем файл для сохранения');
        } catch {
          if (tg?.openLink) {
            tg.openLink(downloadUrlRaw, { try_instant_view: false });
          } else {
            window.open(downloadUrlRaw, '_blank', 'noopener,noreferrer');
          }
        }
      } finally {
        setIsDownloadingResult(false);
      }
    },
    [imageId, isDownloadingResult, showSaveNotice, taskId, tg],
  );

  const handleDownloadResult = useCallback(() => {
    if (!resultImageUrl) return;
    void downloadStickerByUrl(resultImageUrl);
  }, [downloadStickerByUrl, resultImageUrl]);

  const handleSourceImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    void appendSourceImages(files);
    event.target.value = '';
  }, [appendSourceImages]);

  const handleSourcePickerAction = useCallback(() => {
    if (sourceImageFiles.length >= MAX_SOURCE_IMAGE_FILES) {
      return;
    }
    handleSourceImagePick();
  }, [handleSourceImagePick, sourceImageFiles.length]);

  const handleInputWrapperPaste = useCallback((event: ClipboardEvent<HTMLElement>) => {
    if (!effectiveShowPromptInput) {
      return;
    }
    const pastedImageFiles = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item, index) => {
        const file = item.getAsFile();
        if (!file) return null;
        if (file.name) return file;
        const extension = file.type.split('/')[1] || 'png';
        return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, { type: file.type || 'image/png' });
      })
      .filter((file): file is File => Boolean(file));

    if (!pastedImageFiles.length) {
      return;
    }

    event.preventDefault();
    void appendSourceImages(pastedImageFiles);
  }, [appendSourceImages, effectiveShowPromptInput]);

  /* Без отдельного поля промпта — вставка в исходники (Ctrl+V) без фокуса на textarea */
  useEffect(() => {
    if (effectiveShowPromptInput) return;
    const onPaste = (e: globalThis.ClipboardEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest('input:not([type="hidden"]), textarea, [contenteditable="true"]')) {
        return;
      }
      const pastedImageFiles = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item, index) => {
          const file = item.getAsFile();
          if (!file) return null;
          if (file.name) return file;
          const extension = file.type.split('/')[1] || 'png';
          return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, { type: file.type || 'image/png' });
        })
        .filter((file): file is File => Boolean(file));
      if (!pastedImageFiles.length) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      void appendSourceImages(pastedImageFiles);
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [appendSourceImages, effectiveShowPromptInput]);

  const handleSavedFromModal = useCallback((payload?: {
    stickerFileId?: string | null;
    stickerSetName?: string | null;
    stickerSetTitle?: string | null;
  }) => {
    const stickerFileId = payload?.stickerFileId ?? null;
    const stickerSetName = payload?.stickerSetName ?? null;
    const stickerSetTitle = payload?.stickerSetTitle ?? null;

    if (stickerFileId) {
      setFileId(stickerFileId);
      patchHistoryEntry(
        { taskId: taskId ?? undefined, localId: activeHistoryLocalIdRef.current ?? undefined },
        {
          fileId: stickerFileId,
          savedStickerSetName: stickerSetName,
          savedStickerSetTitle: stickerSetTitle,
        }
      );
    } else if (stickerSetName || stickerSetTitle) {
      patchHistoryEntry(
        { taskId: taskId ?? undefined, localId: activeHistoryLocalIdRef.current ?? undefined },
        {
          savedStickerSetName: stickerSetName,
          savedStickerSetTitle: stickerSetTitle,
        }
      );
    }
    setStickerSaved(true);
    setSavedStickerSetName(stickerSetName);
    setSavedStickerSetTitle(stickerSetTitle);
    if (stickerSetName || stickerSetTitle) {
      setLastUsedStickerSetName(stickerSetName);
      setLastUsedStickerSetTitle(stickerSetTitle);
      persistLastUsedSaveTarget(stickerSetName, stickerSetTitle);
    }
    showSaveNotice(stickerSetTitle ? `Сохранено в ${stickerSetTitle}` : 'Стикер сохранен');
    setSaveError(null);
    void refreshMyProfile();
  }, [patchHistoryEntry, persistLastUsedSaveTarget, refreshMyProfile, showSaveNotice, taskId]);

  const handleOpenSaveModal = useCallback(() => {
    setSaveError(null);
    setSaveModalOpen(true);
  }, []);

  const handleCloseSaveModal = useCallback(() => {
    setSaveModalOpen(false);
  }, []);

  const resolveServerAutoSaveTarget = useCallback(async () => {
    if (!stickerListUserId) {
      return null;
    }

    const username = (userInfo?.username ?? user?.username ?? '').trim();
    if (!username) {
      return null;
    }

    const expectedSetName = buildDefaultStickerSetName({ username, userId: stickerListUserId }).toLowerCase();

    try {
      const response = await apiClient.getUserStickerSets(
        stickerListUserId,
        0,
        50,
        'createdAt',
        'DESC',
        true,
        false,
        true,
      );
      const ownSets = (response.content ?? []).filter((set) => isTrustedAutoSaveStickerSet(set, stickerListUserId));
      const matchedSet = ownSets.find((set) => set.name.trim().toLowerCase() === expectedSetName);

      if (!matchedSet) {
        return null;
      }

      return {
        name: matchedSet.name,
        title: matchedSet.title || buildDefaultStickerSetTitle({
          username,
          firstName: userInfo?.firstName ?? user?.first_name ?? null,
          lastName: userInfo?.lastName ?? user?.last_name ?? null,
          userId: stickerListUserId,
        }),
      };
    } catch (error) {
      console.warn('[GeneratePage] Failed to resolve auto-save target from server', error);
      return null;
    }
  }, [stickerListUserId, user?.first_name, user?.last_name, user?.username, userInfo?.firstName, userInfo?.lastName, userInfo?.username]);

  const handleShareSticker = async () => {
    if (fileId) {
      openChatPicker(fileId);
      return;
    }
    if (!taskId) return;

    setIsSavingAndSharing(true);
    setSaveError(null);
    try {
      if (!effectiveUserId) {
        throw new Error('Не удалось определить пользователя Telegram');
      }

      const autoSaveTarget = await resolveServerAutoSaveTarget();
      if (!autoSaveTarget) {
        setSaveModalOpen(true);
        return;
      }

      const targetSetName = autoSaveTarget.name;
      const targetSetTitle = autoSaveTarget.title;

      const response = await apiClient.saveToStickerSetV2({
        taskId,
        file_id: getStickerProcessorFileId(imageId),
        userId: effectiveUserId,
        name: targetSetName,
        title: targetSetTitle,
        emoji: selectedEmoji,
        wait_timeout_sec: SAVE_TO_SET_WAIT_TIMEOUT_SEC,
      });

      if (response.status === '202' || response.status === 'PENDING') {
        throw new Error('Стикер ещё не готов для сохранения. Попробуйте снова через пару секунд.');
      }

      const savedFileId = response.stickerFileId ?? null;
      setStickerSaved(true);
      setSavedStickerSetName(response.stickerSetName ?? targetSetName);
      setSavedStickerSetTitle(response.title ?? targetSetTitle);
      setLastUsedStickerSetName(response.stickerSetName ?? targetSetName);
      setLastUsedStickerSetTitle(response.title ?? targetSetTitle);
      persistLastUsedSaveTarget(response.stickerSetName ?? targetSetName, response.title ?? targetSetTitle);
      showSaveNotice(`Сохранено в ${response.title ?? targetSetTitle}`);

      if (savedFileId) {
        setFileId(savedFileId);
        patchHistoryEntry(
          { taskId: taskId ?? undefined, localId: activeHistoryLocalIdRef.current ?? undefined },
          {
            fileId: savedFileId,
            savedStickerSetName: response.stickerSetName ?? targetSetName,
            savedStickerSetTitle: response.title ?? targetSetTitle,
          }
        );
        void refreshMyProfile();
        openChatPicker(savedFileId);
        return;
      }

      const message = 'Стикер сохранён, но Telegram fileId пока не вернулся. Попробуйте нажать "Поделиться" ещё раз.';
      if (tg?.showAlert) {
        tg.showAlert(message);
      } else {
        setSaveError(message);
      }
    } catch (e: any) {
      setSaveError(e?.message ?? 'Не удалось сохранить стикер');
    } finally {
      setIsSavingAndSharing(false);
    }
  };

  // Валидация формы
  const trimmedPrompt = prompt.trim();
  const canGenerateWithoutPrompt =
    selectedStylePresetId != null && (sourceImageFiles.length > 0 || hasReferenceSlotsFilled);
  const promptOk =
    !promptIsRequired ||
    (trimmedPrompt.length >= MIN_PROMPT_LENGTH && trimmedPrompt.length <= effectiveMaxPromptLen);
  const referenceMinGlobal = selectedPreset?.promptInput?.referenceImages?.minCount ?? 0;
  const referenceUniqueOk =
    referenceFieldDefs.length === 0 ||
    referenceMinGlobal <= 0 ||
    collectUniqueReferenceImageIds(referenceAssignments).size >= referenceMinGlobal;
  const presetFieldsOk =
    referenceUniqueOk &&
    selectedPresetFieldDefs.every((f) => {
      if (f.type === 'reference') {
        const n = (referenceAssignments[f.key] ?? []).length;
        const minI = f.minImages ?? (f.required ? 1 : 0);
        return n >= minI;
      }
      return !f.required || !!(presetFields[f.key]?.trim());
    });
  const ownStyleNeedsGalleryPresetRef =
    isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) &&
    ownStyleBlueprintSession != null &&
    blueprintNeedsPresetReferenceSlot(ownStyleBlueprintSession.blueprint);
  const presetRefGalleryId = (referenceAssignments[PRESET_REF_FIELD_KEY] ?? [])[0] ?? '';
  const ownStylePresetRefFromGalleryOk =
    !ownStyleNeedsGalleryPresetRef ||
    (typeof presetRefGalleryId === 'string' && presetRefGalleryId.startsWith('img_sagref_'));
  /** Опорный стиль для «своего стиля» — в слот должен попасть id вида img_sagref_* для последующей публикации. */
  const isBlockedByOwnStylePresetRefGate =
    ownStyleNeedsGalleryPresetRef && !ownStylePresetRefFromGalleryOk;
  const isFormValid =
    (promptOk || canGenerateWithoutPrompt) && presetFieldsOk && ownStylePresetRefFromGalleryOk;
  const isGenerating = pageState === 'generating' || pageState === 'uploading';
  const isDisabled = isGenerating || !isFormValid || isBlockedByOwnStylePresetRefGate;
  const hasPromptText = effectiveShowPromptInput && prompt.trim().length > 0;
  const hasCurrentReferenceForPublication =
    sourceImageFiles.length > 0 || collectUniqueReferenceImageIds(referenceAssignments).size > 0;
  const hasCurrentGeneratedResultForPublication = Boolean(resultImageUrl || imageId);
  const isOwnedSelectedStyle =
    selectedPreset != null &&
    userInfo?.id != null &&
    selectedPreset.ownerId === userInfo.id &&
    !selectedPreset.isGlobal;
  const selectedStyleModerationStatus =
    selectedPreset?.moderationStatus ??
    (isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) && ownStyleBlueprintSession ? 'DRAFT' : null);
  const canOpenPublishStyleModal =
    isOwnedSelectedStyle &&
    (isOwnStyleBlueprintVirtualPreset(selectedStylePresetId)
      ? Boolean(taskId && ownStyleBlueprintSession)
      : selectedStyleModerationStatus === 'DRAFT');
  const useTaskCompletedPublicationFlow = Boolean(taskId && ownStyleBlueprintSession);
  const publicationStateLabel =
    selectedStyleModerationStatus && selectedStyleModerationStatus !== 'DRAFT'
      ? MODERATION_STATUS_LABELS[selectedStyleModerationStatus]
      : null;
  const latestHistoryEntry = historyEntries[0] ?? null;
  const publicationHistoryEntry = useMemo(() => {
    if (pinnedHistoryLocalId) {
      const pinned = historyEntries.find((entry) => entry.localId === pinnedHistoryLocalId);
      if (pinned) return pinned;
    }
    const activeEntry = historyEntries.find((entry) => entry.isActive);
    if (activeEntry) return activeEntry;
    if (taskId) {
      const byTaskId = historyEntries.find((entry) => entry.taskId === taskId);
      if (byTaskId) return byTaskId;
    }
    return latestHistoryEntry;
  }, [historyEntries, latestHistoryEntry, taskId, pinnedHistoryLocalId]);
  const snapshotPresetRefId =
    (publicationHistoryEntry?.referenceAssignmentsSnapshot?.[PRESET_REF_FIELD_KEY]?.[0] ?? '').trim();
  const livePresetRefSlotId = (referenceAssignments[PRESET_REF_FIELD_KEY] ?? [])[0]?.trim() ?? '';
  /** Референс для модалки черновика: снимок в истории или текущий слот после открытия записи. */
  const publicationOwnStyleEffectiveRefId =
    snapshotPresetRefId || (livePresetRefSlotId.startsWith('img_') ? livePresetRefSlotId : '');
  const refPreviewFromHistorySnapshot =
    snapshotPresetRefId && publicationHistoryEntry?.referencePreviewSnapshot
      ? (publicationHistoryEntry.referencePreviewSnapshot[snapshotPresetRefId] ?? '').trim()
      : '';
  const refPreviewFromLiveSlots =
    livePresetRefSlotId && referencePreviewById[livePresetRefSlotId]
      ? (referencePreviewById[livePresetRefSlotId] ?? '').trim()
      : '';
  const publicationReferencePreviewUrl =
    refPreviewFromHistorySnapshot.length > 0
      ? refPreviewFromHistorySnapshot
      : refPreviewFromLiveSlots.length > 0
        ? refPreviewFromLiveSlots
        : null;
  const publicationHistoryGeneratedUrl = publicationHistoryEntry?.resultImageUrl ?? null;
  const publicationGeneratedPreviewUrl =
    typeof publicationHistoryGeneratedUrl === 'string' && publicationHistoryGeneratedUrl.trim().length > 0
      ? publicationHistoryGeneratedUrl.trim()
      : typeof resultImageUrl === 'string' && resultImageUrl.trim().length > 0
        ? resultImageUrl.trim()
        : null;
  const hasReferenceForPublication = useTaskCompletedPublicationFlow
    ? Boolean(publicationOwnStyleEffectiveRefId)
    : hasCurrentReferenceForPublication;
  const hasGeneratedResultFromHistory = Boolean(
    (typeof publicationHistoryGeneratedUrl === 'string' &&
      publicationHistoryGeneratedUrl.trim().length > 0) ||
      publicationHistoryEntry?.imageId,
  );
  const hasGeneratedResultForPublication = useTaskCompletedPublicationFlow
    ? hasGeneratedResultFromHistory ||
      Boolean(
        publicationGeneratedPreviewUrl || Boolean(imageId),
      )
    : hasCurrentGeneratedResultForPublication;
  const historyPreviewImage = latestHistoryEntry?.resultImageUrl ?? null;
  const historyPreviewFallback = latestHistoryEntry?.selectedEmoji ?? '🕘';
  const setHistoryHeaderSlot = useGenerateHistoryHeaderStore((s) => s.setSlot);
  const toggleHistoryOpen = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);
  const onHistoryHeaderPreviewImageError = useCallback(() => {
    const head = historyEntries[0];
    if (!head?.resultImageUrl || !isApiHostedArtifactUrl(head.resultImageUrl)) return;
    removeHistoryEntry({ localId: head.localId });
  }, [historyEntries, removeHistoryEntry]);
  useLayoutEffect(() => {
    setHistoryHeaderSlot({
      previewImageUrl: historyPreviewImage,
      fallbackEmoji: historyPreviewFallback,
      open: historyOpen,
      toggle: toggleHistoryOpen,
      onPreviewImageError: onHistoryHeaderPreviewImageError,
    });
    return () => {
      setHistoryHeaderSlot(null);
    };
  }, [
    historyPreviewImage,
    historyPreviewFallback,
    historyOpen,
    toggleHistoryOpen,
    setHistoryHeaderSlot,
    onHistoryHeaderPreviewImageError,
  ]);

  const referenceAssignmentsLayoutSig = useMemo(() => {
    const keys = Object.keys(referenceAssignments).sort();
    let n = 0;
    for (const k of keys) {
      n += (referenceAssignments[k] ?? []).length;
    }
    return `${keys.join(',')}:${n}`;
  }, [referenceAssignments]);

  /** Когда блок промпта/полей пресета меняет высоту — компенсируем scrollTop, чтобы сетка стилей не «прыгала» по вьюпорту. */
  const composeLayoutStabilizerKey = useMemo(
    () =>
      [
        selectedStylePresetId ?? 'none',
        String(selectedPresetFieldDefs.length),
        emojiDropdownOpen ? '1' : '0',
        effectiveShowPromptInput ? '1' : '0',
        isBlockedByOwnStylePresetRefGate ? '1' : '0',
        referenceAssignmentsLayoutSig,
      ].join('|'),
    [
      selectedStylePresetId,
      selectedPresetFieldDefs.length,
      emojiDropdownOpen,
      effectiveShowPromptInput,
      isBlockedByOwnStylePresetRefGate,
      referenceAssignmentsLayoutSig,
    ],
  );

  useLayoutEffect(() => {
    const compose = generateComposeStickyRef.current;
    if (!compose || typeof window === 'undefined') return;
    const scrollParent = compose.closest('.stixly-main-scroll');
    if (!scrollParent || !(scrollParent instanceof HTMLElement)) return;

    const nextH = compose.offsetHeight;
    const prevH = composeStickyHeightRef.current;
    composeStickyHeightRef.current = nextH;

    if (prevH === undefined || nextH === prevH) return;

    const delta = nextH - prevH;
    /** Пока не снят лендинговый гейт — не добавляем scroll при росте compose; после гейта — пауза, чтобы финальная вёрстка не утащила вьюпорт к sticky-промпту. */
    const nearHeroTop = scrollParent.scrollTop < 48;
    if (delta > 0 && nearHeroTop && !composeScrollCompensationPrimedRef.current) {
      return;
    }

    scrollParent.scrollTop = Math.max(0, scrollParent.scrollTop + delta);
  }, [composeLayoutStabilizerKey]);

  useEffect(() => {
    composeScrollCompensationPrimedRef.current = false;
    if (!landingReleased) return undefined;
    const id = window.setTimeout(() => {
      composeScrollCompensationPrimedRef.current = true;
    }, 360);
    return () => window.clearTimeout(id);
  }, [landingReleased]);

  const generateLabel =
    generateCost != null ? `Создать стикер • ${generateCost} ART` : 'Создать стикер • 10 ART';
  const shouldShowPromptError = errorKind === 'prompt' && !!errorMessage;
  const isCompactState = pageState !== 'success';
  const formatHistoryStatus = (entry: GenerateHistoryEntry): string => {
    if (entry.generationStatus === 'COMPLETED' || entry.pageState === 'success') return 'Готово';
    if (entry.generationStatus === 'FAILED' || entry.pageState === 'error') return 'Ошибка';
    if (entry.generationStatus === 'TIMEOUT') return 'Таймаут';
    return 'В процессе';
  };

  const getHistoryStatusTone = (entry: GenerateHistoryEntry): 'success' | 'error' | 'progress' => {
    if (entry.generationStatus === 'COMPLETED' || entry.pageState === 'success') return 'success';
    if (entry.generationStatus === 'FAILED' || entry.pageState === 'error' || entry.generationStatus === 'TIMEOUT') return 'error';
    return 'progress';
  };

  const getHistoryPromptLabel = (entry: GenerateHistoryEntry): string => {
    const promptValue = entry.prompt.trim();
    if (promptValue.length > 0) return promptValue;
    return entry.hasSourceImage ? 'Генерация по изображению' : 'Генерация без описания';
  };

  const getHistoryStyleLabel = (entry: GenerateHistoryEntry): string => {
    if (isOwnStyleBlueprintVirtualPreset(entry.stylePresetId)) {
      return stripPresetName(entry.stylePresetName ?? 'Черновик');
    }
    if (entry.stylePresetId == null) return 'Без стиля';
    const preset = stylePresets.find((item) => item.id === entry.stylePresetId);
    if (preset) return stripPresetName(preset.name);
    if (entry.stylePresetName?.trim()) return stripPresetName(entry.stylePresetName);
    return 'Без стиля';
  };

  const getHistoryPrimaryChip = (entry: GenerateHistoryEntry): string => {
    const styleLabel = getHistoryStyleLabel(entry);
    return styleLabel !== 'Без стиля' ? styleLabel : entry.hasSourceImage ? 'С фото' : 'Только текст';
  };

  const getHistorySecondaryChip = (entry: GenerateHistoryEntry): string | null => {
    const styleLabel = getHistoryStyleLabel(entry);
    const moderationStatus = entry.styleModerationStatus;
    if (moderationStatus && moderationStatus !== 'DRAFT') {
      return MODERATION_STATUS_LABELS[moderationStatus];
    }
    if (styleLabel !== 'Без стиля') {
      return entry.hasSourceImage ? 'С фото' : 'Только текст';
    }
    return null;
  };

  const openHistoryEntry = async (entry: GenerateHistoryEntry) => {
    setHistoryOpen(false);
    setDuringJobPreviousResultUrl(null);
    setSuppressSourceStripItemReveal(false);
    setPresetFields({});
    refImageIdToFingerprintRef.current = {};
    sourceFingerprintByIndexRef.current = [];
    setSourceImageFiles([]);
    setSourceImagePreviews([]);
    setSourceImageOrigin('none');
    resetUploadedSourceImageCache();
    setReferenceUploadingKey(null);
    avatarAutofillAppliedRef.current = null;
    const ownStyleSessionReady = await ensureOwnStyleSessionForHistory(entry);
    const cachedRefAssignments = entry.referenceAssignmentsSnapshot ?? null;
    const cachedRefPreviewById = entry.referencePreviewSnapshot ?? null;
    setReferencePreviewById(cachedRefPreviewById ?? {});
    {
      const entryPreset =
        entry.stylePresetId != null && !isOwnStyleBlueprintVirtualPreset(entry.stylePresetId)
          ? stylePresets.find((p) => p.id === entry.stylePresetId)
          : null;
      const nextRefs: Record<string, string[]> = cachedRefAssignments
        ? Object.fromEntries(
            Object.entries(cachedRefAssignments).map(([key, ids]) => [key, [...ids]]),
          )
        : {};
      if (!cachedRefAssignments) {
        for (const f of entryPreset?.fields ?? []) {
          if (f.type === 'reference') {
            nextRefs[f.key] = [];
          }
        }
      }
      setReferenceAssignments(nextRefs);
    }
    setPrompt(entry.prompt);
    setSelectedModel(normalizeGenerateModel(entry.model));
    setSelectedStylePresetId(
      isOwnStyleBlueprintVirtualPreset(entry.stylePresetId) && !ownStyleSessionReady ? null : entry.stylePresetId,
    );
    setSelectedEmoji(entry.selectedEmoji);
    setRemoveBackground(entry.removeBackground);
    setTaskId(entry.taskId);
    setCurrentStatus(entry.generationStatus);
    setResultImageUrl(entry.resultImageUrl);
    setImageId(entry.imageId);
    setFileId(entry.fileId);
    setStickerSaved(Boolean(entry.fileId));
    setSavedStickerSetName(entry.savedStickerSetName ?? null);
    setSavedStickerSetTitle(entry.savedStickerSetTitle ?? null);
    setErrorMessage(entry.errorMessage);
    setErrorKind(entry.pageState === 'error' ? 'general' : null);
    activeHistoryLocalIdRef.current = entry.localId;
    setPinnedHistoryLocalId(entry.localId);

    if (entry.pageState === 'success') {
      setPageState('success');
      const missingPreviewInHistory =
        (!(typeof entry.resultImageUrl === 'string' && entry.resultImageUrl.trim().length > 0) ||
          !(typeof entry.imageId === 'string' && entry.imageId.trim().length > 0)) &&
        typeof entry.taskId === 'string' &&
        entry.taskId.trim().length > 0;
      if (missingPreviewInHistory) {
        void (async () => {
          try {
            const status = await apiClient.getGenerationStatusV2(entry.taskId!.trim());
            if (status.status !== 'COMPLETED') return;
            const recoveredResultUrl = status.imageUrl?.trim() || null;
            const recoveredImageId = status.imageId?.trim() || null;
            if (!recoveredResultUrl && !recoveredImageId) return;

            patchHistoryEntry(
              { localId: entry.localId },
              {
                pageState: 'success',
                generationStatus: 'COMPLETED',
                resultImageUrl:
                  recoveredResultUrl ??
                  (typeof entry.resultImageUrl === 'string' ? entry.resultImageUrl : null),
                imageId:
                  recoveredImageId ??
                  (typeof entry.imageId === 'string' ? entry.imageId : null),
              },
            );
            if (activeHistoryLocalIdRef.current === entry.localId) {
              if (recoveredResultUrl) setResultImageUrl(recoveredResultUrl);
              if (recoveredImageId) setImageId(recoveredImageId);
              setCurrentStatus('COMPLETED');
            }
          } catch (e) {
            console.warn('[GeneratePage] Не удалось восстановить превью результата из task status', e);
          }
        })();
      }
      return;
    }
    if (entry.pageState === 'error') {
      setPageState('error');
      return;
    }
    setPageState('generating');
    if (entry.taskId) {
      patchHistoryEntry({ localId: entry.localId }, { isActive: true });
      startPolling(entry.taskId, entry.localId);
    }
  };

  const openHistoryEntryRef = useRef(openHistoryEntry);
  openHistoryEntryRef.current = openHistoryEntry;

  /** Восстановление последней сессии (успех/ошибка/готовый результат), если нет активного polling. */
  useEffect(() => {
    if (!historyUserScopeId || resumeSessionAppliedRef.current) return;

    const entries = readGenerateHistory(historyUserScopeId);
    const activeEntry =
      entries.find((entry) => entry.isActive) ??
      entries.find((entry) => !TERMINAL_GENERATION_STATUSES.includes(entry.generationStatus ?? 'PENDING'));
    if (activeEntry) {
      resumeSessionAppliedRef.current = true;
      return;
    }

    const resumeKey = getGenerateResumeLocalIdKey(historyUserScopeId);
    let resumeId: string | null = null;
    try {
      resumeId = sessionStorage.getItem(resumeKey);
    } catch {
      /* */
    }
    if (!resumeId) {
      resumeSessionAppliedRef.current = true;
      return;
    }

    const resumeEntry = entries.find((e) => e.localId === resumeId);
    if (!resumeEntry) {
      try {
        sessionStorage.removeItem(resumeKey);
      } catch {
        /* */
      }
      resumeSessionAppliedRef.current = true;
      return;
    }

    resumeSessionAppliedRef.current = true;
    preferencesAppliedRef.current = true;
    void openHistoryEntryRef.current(resumeEntry);
  }, [historyUserScopeId]);

  useEffect(() => {
    if (!historyOpen) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHistoryOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [historyOpen]);

  const renderSourceImageStrip = (disabled: boolean, stripOpts?: { suppressItemReveal?: boolean }) => {
    const hasAttachedImages = sourceImageFiles.length > 0;
    const suppressReveal = Boolean(stripOpts?.suppressItemReveal && hasAttachedImages);
    /**
     * После аплоада в preset_ref у черновика/«своего стиля» слот становится locked (есть presetReferenceSourceImageId),
     * но исходные File всё ещё висят на общей ленте — их нельзя вычёркивать из лимита, иначе ложное
     * «больше фотографий, чем нужно пресету».
     */
    const presetRefDef = referenceFieldDefs.find((f) => f.key === PRESET_REF_FIELD_KEY && f.type === 'reference');
    const presetRefCap = presetRefDef ? Math.max(1, presetRefDef.maxImages ?? 1) : 0;
    let stripLockedPresetRefExtra = 0;
    if (presetRefCap > 0 && lockedPresetRefFieldKeys.has(PRESET_REF_FIELD_KEY)) {
      const presetRefIds = (referenceAssignments[PRESET_REF_FIELD_KEY] ?? []).filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0,
      );
      if (presetRefIds.length) {
        const fpMap = refImageIdToFingerprintRef.current;
        const uploadedRefTracked = presetRefIds.some((id) => Boolean(fpMap[id.trim()]));
        const ownStylePresetRef =
          isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) &&
          presetRefIds.some((id) => id.trim().startsWith('img_sagref_'));
        if (uploadedRefTracked || ownStylePresetRef) {
          stripLockedPresetRefExtra = presetRefCap;
        }
      }
    }
    const sourceStripReferenceSlotBudget = presetUserRefSlotTotal + stripLockedPresetRefExtra;
    const showStripExtraPresetHint =
      sourceStripReferenceSlotBudget > 0 && sourceImageFiles.length > sourceStripReferenceSlotBudget;

    return (
    <>
      <input
        ref={sourceImageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleSourceImageChange}
      />
      <div
        className={cn(
          'generate-source-strip',
          hasAttachedImages ? 'generate-source-strip--expanded' : 'generate-source-strip--collapsed',
          suppressReveal && 'generate-source-strip--suppress-item-reveal',
        )}
        aria-label="Прикрепленные изображения"
        onDragOver={disabled ? undefined : handleGenerateFormDragOver}
        onDrop={disabled ? undefined : handleGenerateFormDrop}
      >
        {hasAttachedImages && (
          <div className="generate-source-strip__scroll-shell">
            <div ref={sourceStripInnerRef} className="generate-source-strip__inner horiz-scroll-bleed">
              {sourceImagePreviews.map((preview, index) => (
                <SourceImageStripItem
                  key={`${sourceImageFiles[index]?.name ?? 'source'}-${sourceImageFiles[index]?.lastModified ?? index}-${index}`}
                  index={index}
                  preview={preview}
                  disabled={disabled}
                  animationDelay={`${Math.max(0, sourceImagePreviews.length - index - 1) * 45}ms`}
                  onNativeDragStart={(e) => {
                    draggedSourceImageIndexRef.current = index;
                    setSourceStripDragData(e.dataTransfer, { sourceIndex: index });
                    e.dataTransfer.effectAllowed = 'copyMove';
                  }}
                  onDragOver={(event) => {
                    if (disabled) return;
                    if (hasExternalFilesDrag(event.dataTransfer)) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                      return;
                    }
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (disabled) return;
                    event.preventDefault();
                    const fromDisk = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
                    if (fromDisk.length) {
                      event.stopPropagation();
                      void appendSourceImages(fromDisk);
                      draggedSourceImageIndexRef.current = null;
                      return;
                    }
                    const draggedIndex = draggedSourceImageIndexRef.current;
                    if (draggedIndex == null) return;
                    moveSourceImage(draggedIndex, index);
                    draggedSourceImageIndexRef.current = null;
                  }}
                  onDragEnd={() => {
                    draggedSourceImageIndexRef.current = null;
                  }}
                  onRemoveClick={(event) => {
                    event.stopPropagation();
                    removeSourceImageAt(index);
                  }}
                  onTapExpand={() =>
                    setImageLightbox({
                      viewerUrl: preview,
                      downloadUrl: preview,
                      alt: `Исходное изображение ${index + 1}`,
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
        {hasAttachedImages && (showStripExtraPresetHint || sourceImageFiles.length >= 2) && (
          <div className="generate-source-strip__meta-row" aria-live="polite">
            {showStripExtraPresetHint && (
              <span className="generate-source-strip__clear-link generate-source-strip__clear-hint" role="status">
                На ленте лишние фото для этого стиля — удалите.
              </span>
            )}
            {sourceImageFiles.length >= 2 && (
              <button
                type="button"
                className="generate-source-strip__clear-link generate-source-strip__clear-all-btn"
                onClick={() => clearSourceImage()}
                disabled={disabled}
                aria-label="Удалить все прикрепленные изображения"
              >
                Удалить все
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="generate-source-picker"
          onClick={handleSourcePickerAction}
          disabled={disabled}
          aria-label={
            hasAttachedImages
              ? `Добавить ещё исходные изображения. Прикреплено ${sourceImageFiles.length} из ${MAX_SOURCE_IMAGE_FILES}.`
              : `Добавить исходные изображения. Прикреплено 0 из ${MAX_SOURCE_IMAGE_FILES}.`
          }
        >
          {sourceImageFiles.length < MAX_SOURCE_IMAGE_FILES && (
            <img
              src={`${BASE}assets/pictures-icon.svg`}
              alt=""
              className="generate-source-picker__icon"
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'generate-source-picker__badge',
              sourceImageFiles.length >= MAX_SOURCE_IMAGE_FILES && 'generate-source-picker__badge--limit',
              sourceImageFiles.length >= MAX_SOURCE_IMAGE_FILES && 'generate-source-picker__badge--full'
            )}
            aria-hidden="true"
          >
            {sourceImageFiles.length >= MAX_SOURCE_IMAGE_FILES
              ? `${MAX_SOURCE_IMAGE_FILES} max`
              : sourceImageFiles.length === 0
                ? '+'
                : sourceImageFiles.length}
          </span>
        </button>
      </div>
    </>
    );
  };

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (pageState === 'error' && errorKind === 'prompt') {
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('idle');
    }
  };

  /** Превью «как в последней удачной генерации» только для текущей закреплённой записи истории — иначе плитки/шапка тянут чужой старый результат при смене стиля после просмотра истории. */
  const presetPreviewById = useMemo(() => {
    const previewMap = new Map<number, string>();
    if (!pinnedHistoryLocalId) return previewMap;
    const entry = historyEntries.find((e) => e.localId === pinnedHistoryLocalId);
    const minFreshTs = Date.now() - HISTORY_PRESET_PREVIEW_TTL_MS;
    if (
      !entry ||
      entry.stylePresetId == null ||
      failedHistoryPresetPreviewIds.has(entry.stylePresetId) ||
      entry.pageState !== 'success' ||
      entry.updatedAt < minFreshTs ||
      !entry.resultImageUrl
    ) {
      return previewMap;
    }
    previewMap.set(entry.stylePresetId, entry.resultImageUrl);
    return previewMap;
  }, [failedHistoryPresetPreviewIds, historyEntries, pinnedHistoryLocalId]);

  const markHistoryPresetPreviewFailed = useCallback((presetId: number) => {
    setFailedHistoryPresetPreviewIds((prev) => {
      if (prev.has(presetId)) return prev;
      const next = new Set(prev);
      next.add(presetId);
      return next;
    });
  }, []);

  const selectedStylePresetCardPreview = useMemo(() => {
    if (selectedStylePresetId == null || !selectedPreset) return null;
    return (
      presetPreviewById.get(selectedStylePresetId) ??
      (selectedPreset.code ? PRESET_PREVIEW_FALLBACK_BY_CODE[selectedPreset.code] : undefined) ??
      getServerStylePresetCardPreview(selectedPreset) ??
      null
    );
  }, [presetPreviewById, selectedPreset, selectedStylePresetId]);
  const selectedStyleUsesHistoryPreview =
    selectedStylePresetId != null && presetPreviewById.has(selectedStylePresetId);

  /** Верхний блок: превью стиля; картинка из истории — только если она относится к закреплённой записи и совпадает с выбранным пресетом. */
  const compositeGenerateHeroPreviewUrl = useMemo(() => {
    return selectedStylePresetCardPreview;
  }, [selectedStylePresetCardPreview]);

  const handlePresetChange = (
    presetId: number | null,
    opts?: { skipPublishHintReset?: boolean },
  ) => {
    if (!opts?.skipPublishHintReset) {
      setPublishCostHint(null);
      setPublishUiHints(null);
    }
    const prevId = selectedStylePresetId;
    const isPresetSwitch = presetId !== prevId;

    if (!isOwnStyleBlueprintVirtualPreset(presetId)) {
      setOwnStyleBlueprintSession(null);
    }
    setSelectedStylePresetId(presetId);
    setPresetFields({});
    setSuppressSourceStripItemReveal(false);
    setReferenceAssignments({});
    setReferencePreviewById({});
    setReferenceUploadingKey(null);

    if (isPresetSwitch && pageState !== 'generating' && pageState !== 'uploading') {
      setPinnedHistoryLocalId(null);
      activeHistoryLocalIdRef.current = null;
      if (historyUserScopeId) {
        setHistoryEntries(clearActiveGenerateHistoryEntry(historyUserScopeId));
      }
      setResultImageUrl(null);
      setImageId(null);
      setDuringJobPreviousResultUrl(null);
      setTaskId(null);
      setFileId(null);
      setStickerSaved(false);
      setSavedStickerSetName(null);
      setSavedStickerSetTitle(null);
      setCurrentStatus(null);
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('idle');
    }

    if (isOwnStyleBlueprintVirtualPreset(presetId)) {
      persistGeneratePreferences({ stylePresetId: null });
    } else {
      persistGeneratePreferences({ stylePresetId: presetId });
    }
  };

  const handleGridPresetChange = useCallback(
    (presetId: number | null) => {
      setPendingGridStylePick(null);
      if (presetId == null) {
        handlePresetChange(null);
        return;
      }
      if (isOwnStyleBlueprintVirtualPreset(presetId)) {
        handlePresetChange(presetId);
        return;
      }
      const p = presetsWithVirtual.find((x) => x.id === presetId);
      if (p) {
        setPendingGridStylePick(p);
        queueMicrotask(() => {
          const sp = document.querySelector('.stixly-main-scroll');
          if (sp instanceof HTMLElement) {
            sp.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }
    },
    [handlePresetChange, presetsWithVirtual],
  );

  /**
   * «Создать свой стиль»: виртуальная карточка + генерация по blueprint-коду.
   * Черновик в БД создаётся только при первом upload в слот preset_ref.
   */
  const handleSelectOwnStylePreset = async () => {
    if (ownStyleBootstrapRef.current || bootstrappingOwnStyle) return;
    ownStyleBootstrapRef.current = true;
    setBootstrappingOwnStyle(true);
    tg?.HapticFeedback?.impactOccurred?.('light');
    try {
      let blueprints = userPresetCreationBlueprints;
      if (!blueprints.length) {
        try {
          blueprints = await apiClient.getUserPresetCreationBlueprints();
          setUserPresetCreationBlueprints(blueprints);
        } catch {
          blueprints = [];
        }
      }
      const bp = resolveCreationBlueprint(blueprints);
      if (!bp) {
        setErrorMessage('Создание своего стиля сейчас недоступно.');
        setErrorKind('general');
        return;
      }
      setOwnStyleBlueprintSession(buildOwnStyleSessionFromBlueprint({ blueprint: bp }));
      setPublishCostHint(bp.estimatedPublicationCostArt ?? null);
      setPublishUiHints(bp.uiHints ?? null);
      handlePresetChange(OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID, { skipPublishHintReset: true });
      const latestOwnStyleHistoryEntry = historyEntries.find((entry) => {
        if (isOwnStyleBlueprintVirtualPreset(entry.stylePresetId)) return true;
        const code = entry.ownStyleBlueprintCode?.trim();
        return !!code && code === bp.code;
      });
      if (latestOwnStyleHistoryEntry?.referenceAssignmentsSnapshot) {
        setReferenceAssignments(
          Object.fromEntries(
            Object.entries(latestOwnStyleHistoryEntry.referenceAssignmentsSnapshot).map(([key, ids]) => [
              key,
              [...ids],
            ]),
          ),
        );
        setReferencePreviewById(latestOwnStyleHistoryEntry.referencePreviewSnapshot ?? {});
      }
      setResultImageUrl(null);
      setDuringJobPreviousResultUrl(null);
      setImageId(null);
      setTaskId(null);
      setFileId(null);
      setStickerSaved(false);
      setSavedStickerSetName(null);
      setSavedStickerSetTitle(null);
      setCurrentStatus(null);
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('idle');
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : 'Не удалось открыть создание своего стиля');
      setErrorKind('general');
    } finally {
      ownStyleBootstrapRef.current = false;
      setBootstrappingOwnStyle(false);
    }
  };

  const handlePublicationPublished = useCallback(async (updated: StylePreset) => {
    if (activeHistoryLocalIdRef.current) {
      patchHistoryEntry(
        { localId: activeHistoryLocalIdRef.current },
        {
          stylePresetId: updated.id,
          stylePresetName: updated.name ?? null,
          stylePresetCode: updated.code ?? null,
          styleModerationStatus: updated.moderationStatus ?? null,
          ownStyleBlueprintCode: null,
        },
      );
    }
    try {
      const list = await apiClient.loadStylePresetsMerged();
      setStylePresets(list);
    } catch (e) {
      console.error('Не удалось обновить пресеты после публикации:', e);
    }
    setOwnStyleBlueprintSession(null);
    setPublishPresetModalOpen(false);
    setPublishCostHint(null);
    setPublishUiHints(null);
    setSelectedStylePresetId(updated.id);
    persistGeneratePreferences({ stylePresetId: updated.id });
    if (updated.moderationStatus === 'PENDING_MODERATION') {
      showSaveNotice('Стиль отправлен на модерацию. После одобрения он станет доступен в каталоге.');
    }
  }, [patchHistoryEntry, persistGeneratePreferences, showSaveNotice]);

  const handlePresetFieldChange = (key: string, value: string) => {
    setPresetFields((prev) => ({ ...prev, [key]: value }));
  };

  const dismissErrorToast = () => {
    setErrorMessage(null);
    setErrorKind(null);
    setPageState((prev) => (prev === 'error' ? 'idle' : prev));
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    persistGeneratePreferences({ selectedEmoji: emoji });
    setEmojiDropdownOpen(false);
    tg?.HapticFeedback?.impactOccurred('light');
  };

  useEffect(() => {
    if (!emojiDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiDropdownRef.current && !emojiDropdownRef.current.contains(e.target as Node)) {
        setEmojiDropdownOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [emojiDropdownOpen]);

  // Авто-скрытие toast-алерта через 4 секунды
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => {
      setErrorMessage(null);
      setErrorKind(null);
      setPageState((prev) => (prev === 'error' ? 'idle' : prev));
    }, 4000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  const renderEmojiSelectButton = (disabled: boolean, caption: string | null) => {
    const hasCaption = Boolean(caption);
    return (
      <div
        className={cn(
          'generate-model-select-wrap',
          'generate-model-select-wrap--emoji',
        )}
      >
        <button
          type="button"
          className={cn(
            'generate-model-select-trigger',
            'generate-model-select-trigger--emoji',
            hasCaption && 'generate-model-select-trigger--emoji--with-caption',
          )}
          onClick={() => {
            if (!disabled) {
              setEmojiDropdownOpen((v) => !v);
            }
          }}
          disabled={disabled}
          aria-label={hasCaption ? `${caption}, выбрано ${selectedEmoji}` : 'Выбор эмодзи'}
          aria-expanded={emojiDropdownOpen}
        >
          {hasCaption && <span className="generate-emoji-caption">{caption}</span>}
          <span className="generate-model-select-value generate-model-select-value--emoji">{selectedEmoji}</span>
        </button>
      </div>
    );
  };

  const renderInputFooter = (disabled: boolean) => (
    <div className="generate-input-footer" ref={emojiDropdownRef}>
      <div className="generate-input-toolbar">
        {renderRemoveBgToggle(disabled)}
        {renderEmojiSelectButton(disabled, stickerEmojiCaption)}
      </div>
      {emojiDropdownOpen && (
        <div className="generate-model-select-dropdown generate-model-select-dropdown--emoji generate-model-select-dropdown--emoji-fullwidth">
          {POPULAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={cn(
                'generate-model-select-option',
                'generate-model-select-option--emoji',
                emoji === selectedEmoji && 'generate-model-select-option--selected',
              )}
              onClick={() => handleEmojiSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderMainInputBlock = (cfg: {
    readOnly: boolean;
    textDisabled: boolean;
    referenceDndEnabled: boolean;
    showPromptError: boolean;
    withWrapperHandlers: boolean;
    withActiveState: boolean;
  }) => (
    <div
      className={cn(
        'generate-input-wrapper',
        cfg.withActiveState && hasPromptText && 'generate-input-wrapper--active',
        cfg.showPromptError && 'generate-input-wrapper--error',
        (effectiveShowPromptInput && selectedPresetFieldDefs.length > 0) && 'generate-input-wrapper--with-preset-stack',
        !effectiveShowPromptInput && selectedPresetFieldDefs.length > 0 && 'generate-input-wrapper--preset-only',
      )}
      tabIndex={cfg.withWrapperHandlers && !effectiveShowPromptInput ? 0 : undefined}
      onPaste={cfg.withWrapperHandlers ? handleInputWrapperPaste : undefined}
    >
      {effectiveShowPromptInput && (
        <textarea
          className={cn(
            'generate-input',
            cfg.showPromptError && 'generate-input--error',
            cfg.readOnly && 'generate-input--readonly',
          )}
          rows={PROMPT_ROWS}
          readOnly={cfg.readOnly}
          placeholder={effectivePromptPlaceholder}
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          maxLength={effectiveMaxPromptLen}
          disabled={cfg.textDisabled}
          onFocus={handlePromptFocusIn}
          onBlur={handlePromptFocusOut}
        />
      )}
      {selectedPresetFieldDefs.length > 0 && (
        <div
          className={cn(
            'generate-input-preset-stack',
            effectiveShowPromptInput && 'generate-input-preset-stack--after-prompt',
          )}
        >
          <PresetFieldsForm
            fields={selectedPresetFieldDefs}
            values={presetFields}
            onChange={handlePresetFieldChange}
            disabled={cfg.readOnly || cfg.textDisabled || !cfg.referenceDndEnabled}
            emojiOptions={POPULAR_EMOJIS}
            referenceAssignments={referenceAssignments}
            referencePreviewById={referencePreviewById}
            referenceUploadingKey={referenceUploadingKey}
            effectiveReferenceMaxUnique={effectiveReferenceMaxUnique}
            onReferenceRemove={handleReferenceRemove}
            onReferenceAddFiles={(key, files) => {
              void handleReferenceAddFiles(key, files);
            }}
            onReferenceAddFromSource={(key, toIndex, sourceIndex) => {
              void handleReferenceAddFromSource(key, toIndex, sourceIndex);
            }}
            onReferenceAddExternalAt={(key, toIndex, files) => {
              void handleReferenceAddFilesAtSlot(key, toIndex, files);
            }}
            onReferenceMove={applyReferenceMove}
            lockedReferenceFieldKeys={lockedPresetRefFieldKeys}
          />
        </div>
      )}
      {renderInputFooter(cfg.readOnly || cfg.textDisabled)}
    </div>
  );

  const renderPresetGrid = (disabled: boolean) => (
    <StylePresetPackGrid
      presets={stripStylePresets}
      selectedPresetId={selectedStylePresetId}
      onPresetChange={handleGridPresetChange}
      previewByPresetId={presetPreviewById}
      onHistoryPreviewError={markHistoryPresetPreviewFailed}
      fallbackPreviewByPresetCode={PRESET_PREVIEW_FALLBACK_BY_CODE}
      logoPlaceholderPresetId={OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID}
      placeholderLogoSrc={STIXLY_LOGO_ORANGE}
      disabled={disabled || bootstrappingOwnStyle}
      creationHighlightPresetId={
        isOwnStyleBlueprintVirtualPreset(selectedStylePresetId)
          ? OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID
          : null
      }
      onCreatePreset={() => void handleSelectOwnStylePreset()}
      emptyStateText={myStylesEmpty ? 'У вас еще нет собственных стилей.' : null}
    />
  );

  const renderGenerateFormBlock = (cfg: {
    readOnly: boolean;
    textDisabled: boolean;
    dropEnabled: boolean;
    referenceDndEnabled: boolean;
    presetDisabled: boolean;
    showPromptError: boolean;
    withWrapperHandlers: boolean;
    withActiveState: boolean;
    buttonDisabled: boolean;
    buttonText: string;
    buttonLoading?: boolean;
    buttonClassName?: string;
    buttonAriaLabel?: string;
    onButtonClick?: () => void;
    /** Скрыть кнопку submit (рендерится отдельно как fixed element) */
    hideSubmit?: boolean;
    /** Скрыть блок промпта и полей пресета (они показаны на hero во время задачи) */
    omitCompose?: boolean;
  }) => (
    <div
      className="generate-form-block"
      onDragOver={cfg.dropEnabled ? handleGenerateFormDragOver : undefined}
      onDrop={cfg.dropEnabled ? handleGenerateFormDrop : undefined}
    >
      <div className="generate-form-layout">
        <div
          className={cn(
            'generate-form-layout__compose',
            cfg.omitCompose && 'generate-form-layout__compose--omitted',
          )}
          ref={cfg.omitCompose ? undefined : generateComposeStickyRef}
        >
          {!cfg.omitCompose &&
            renderMainInputBlock({
              readOnly: cfg.readOnly,
              textDisabled: cfg.textDisabled,
              referenceDndEnabled: cfg.referenceDndEnabled,
              showPromptError: cfg.showPromptError,
              withWrapperHandlers: cfg.withWrapperHandlers,
              withActiveState: cfg.withActiveState,
            })}
        </div>
        <div className="generate-form-layout__preset-scroll">
          <div className="generate-form-layout__preset-heading">
            {styleCategoryFilter != null && (
              <StylePresetCategoryChips
                categories={styleCategoryChipsList}
                value={styleCategoryFilter}
                onChange={setStyleCategoryFilter}
                showMineChip
                disabled={cfg.presetDisabled}
                variant="gallery"
              />
            )}
            {deepLinkPresetMissingNotice ? (
              <Text variant="bodySmall" className="generate-form-layout__preset-deeplink-notice" align="center">
                Стиль по ссылке недоступен или удалён.
              </Text>
            ) : null}
          </div>
          {renderPresetGrid(cfg.presetDisabled)}
        </div>
        {isBlockedByOwnStylePresetRefGate ? (
          <div className="generate-form-layout__preset-ref-hint">
            <Text variant="bodySmall" align="center">
              Загрузите опорное изображение стиля в слот preset_ref с устройства (Drag-and-drop или «Добавить
              фото»). Нужен идентификатор вида img_sagref_… из галереи — так результат можно будет отправить на
              модерацию после генерации.
            </Text>
          </div>
        ) : null}
        {!cfg.hideSubmit && (
          <div className="generate-form-layout__submit">
            <Button
              variant="primary"
              size="medium"
              onClick={cfg.onButtonClick}
              disabled={cfg.buttonDisabled}
              loading={cfg.buttonLoading}
              className={cn('generate-button-submit', cfg.buttonClassName)}
              aria-label={cfg.buttonAriaLabel}
            >
              {cfg.buttonText}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const primarySourcePreview = sourceImagePreviews[0] ?? null;
  const stripIsOnlyTelegramAvatars =
    sourceImageFiles.length > 0 && sourceImageFiles.every((f) => isTelegramAvatarSourceFile(f));
  /** В потоке «Черновик» показываем аватар-слой, если нет превью стиля сверху */
  const showAvatarCenterCard =
    (selectedStylePresetId == null || isOwnStyleBlueprintVirtualPreset(selectedStylePresetId)) &&
    stripIsOnlyTelegramAvatars &&
    Boolean(primarySourcePreview) &&
    !compositeGenerateHeroPreviewUrl;

  const renderHeroCard = (opts?: { composeSlot?: React.ReactNode }) => (
    <GenerateHeroCard
      presets={stripStylePresets}
      selectedPresetId={selectedStylePresetId}
      pageState={pageState}
      resultImageUrl={resultImageUrl}
      duringJobPreviousResultUrl={duringJobPreviousResultUrl}
      generatingMessage={getGeneratingSpinnerMessage(pageState, currentStatus)}
      logoSrc={STIXLY_LOGO_ORANGE}
      presetPreviewById={presetPreviewById}
      showAvatarCard={showAvatarCenterCard}
      avatarPreviewUrl={primarySourcePreview}
      canDeleteStyle={canDeleteSelectedStylePresetAsAuthor && !stylePresetDeleting}
      canShareStyle={canShareStylePresetDeepLink}
      canDownloadResult={Boolean(resultImageUrl) && pageState === 'success'}
      isDownloadingResult={isDownloadingResult}
      composeSlot={opts?.composeSlot}
      composeSlotRef={opts?.composeSlot ? generateComposeStickyRef : undefined}
      generatingInlineSlot={
        hasActiveGeneration && selectedPresetFieldDefs.length > 0 ? (
          <div className="ghc-inline-preset-fields">
            <PresetFieldsForm
              fields={selectedPresetFieldDefs}
              values={presetFields}
              onChange={handlePresetFieldChange}
              disabled
              emojiOptions={POPULAR_EMOJIS}
              referenceAssignments={referenceAssignments}
              referencePreviewById={referencePreviewById}
              referenceUploadingKey={referenceUploadingKey}
              effectiveReferenceMaxUnique={effectiveReferenceMaxUnique}
              onReferenceRemove={handleReferenceRemove}
              onReferenceAddFiles={(key, files) => {
                void handleReferenceAddFiles(key, files);
              }}
              onReferenceAddFromSource={(key, toIndex, sourceIndex) => {
                void handleReferenceAddFromSource(key, toIndex, sourceIndex);
              }}
              onReferenceAddExternalAt={(key, toIndex, files) => {
                void handleReferenceAddFilesAtSlot(key, toIndex, files);
              }}
              onReferenceMove={applyReferenceMove}
              lockedReferenceFieldKeys={lockedPresetRefFieldKeys}
            />
          </div>
        ) : undefined
      }
      onDuringJobPreviousResultTap={
        duringJobPreviousResultUrl
          ? () =>
              setImageLightbox({
                viewerUrl: duringJobPreviousResultUrl,
                downloadUrl: duringJobPreviousResultUrl,
                alt: 'Прошлый результат',
              })
          : undefined
      }
      onPresetSelect={(id) => handlePresetChange(id)}
      onResultTap={() =>
        resultImageUrl &&
        setImageLightbox({
          viewerUrl: resultImageUrl,
          downloadUrl: resultImageUrl,
          alt: 'Сгенерированный стикер',
        })
      }
      onAvatarTap={() =>
        primarySourcePreview &&
        setImageLightbox({
          viewerUrl: primarySourcePreview,
          downloadUrl: primarySourcePreview,
          alt: 'Telegram-аватар',
        })
      }
      onAvatarRemove={() => clearSourceImage({ markAvatarDismissed: true })}
      onDeleteStyle={() => void handleDeleteSelectedStylePreset()}
      onShareStyle={() => void handleShareSelectedStylePreset()}
      onDownloadResult={() => void handleDownloadResult()}
      onHapticLight={() => tg?.HapticFeedback?.impactOccurred('light')}
      onPresetPreviewError={(presetId) => {
        if (selectedStyleUsesHistoryPreview && presetId === selectedStylePresetId) {
          markHistoryPresetPreviewFailed(presetId);
        }
      }}
      onApiHostedResultImageError={purgeHistoryEntryForExpiredApiImage}
    />
  );



  const renderHistoryModal = () => {
    if (!historyOpen || typeof document === 'undefined') {
      return null;
    }

    return createPortal(
      <ModalBackdrop open={historyOpen} onClose={() => setHistoryOpen(false)} keepNavbarVisible>
        <section
          id="generate-history-modal"
          data-modal-content
          className="generate-history-modal"
          aria-label="История генераций"
        >
          <div className="generate-history-modal__header">
            <div className="generate-history-modal__header-copy">
              <h2 className="generate-history-modal__title">История генераций</h2>
              <p className="generate-history-modal__subtitle">
                История временная. Важные стикеры сохраняйте в стикерпак.
              </p>
            </div>
            <div className="generate-history-modal__actions">
              <button
                type="button"
                className="generate-history-modal__clear"
                onClick={clearHistoryEntries}
                disabled={historyEntries.length === 0}
              >
                Очистить
              </button>
              <button
                type="button"
                className="generate-history-modal__close"
                onClick={() => setHistoryOpen(false)}
                aria-label="Закрыть историю генераций"
              >
                ×
              </button>
            </div>
          </div>

          {historyEntries.length === 0 ? (
            <div className="generate-history-modal__empty">
              <div className="generate-history-modal__empty-title">История пока пуста</div>
              <div className="generate-history-modal__empty-text">
                После первой генерации здесь появятся последние результаты.
              </div>
            </div>
          ) : (
            <div className="generate-history-modal__list" role="list">
              {historyEntries.map((entry) => {
                const secondaryChip = getHistorySecondaryChip(entry);
                const statusTone = getHistoryStatusTone(entry);
                const canRemoveEntry = statusTone === 'error';

                return (
                  <div
                    key={entry.localId}
                    role="listitem"
                    className={cn('generate-history-item-shell', canRemoveEntry && 'generate-history-item-shell--removable')}
                  >
                    <button
                      type="button"
                      className={cn('generate-history-item', entry.isActive && 'generate-history-item--active')}
                      onClick={() => void openHistoryEntry(entry)}
                    >
                      <div className="generate-history-item__preview-wrap" aria-hidden="true">
                        {entry.resultImageUrl ? (
                          <img
                            className="generate-history-item__preview"
                            src={entry.resultImageUrl}
                            alt=""
                            onError={(ev) => {
                              if (
                                entry.resultImageUrl &&
                                isApiHostedArtifactUrl(entry.resultImageUrl)
                              ) {
                                removeHistoryEntry({ localId: entry.localId });
                                return;
                              }
                              onApiHostedImageError(ev);
                            }}
                          />
                        ) : (
                          <div className="generate-history-item__preview-placeholder">{entry.selectedEmoji}</div>
                        )}
                      </div>
                      <div className="generate-history-item__main">
                        <div className="generate-history-item__top">
                          <span
                            className={cn(
                              'generate-history-item__status',
                              `generate-history-item__status--${statusTone}`
                            )}
                          >
                            {formatHistoryStatus(entry)}
                          </span>
                          {entry.isActive && <span className="generate-history-item__active-badge">Сейчас</span>}
                        </div>
                        <div className="generate-history-item__prompt">{getHistoryPromptLabel(entry)}</div>
                        <div className="generate-history-item__footer">
                          <div className="generate-history-item__chips">
                            <span className="generate-history-item__chip">{getHistoryPrimaryChip(entry)}</span>
                            {secondaryChip && (
                              <span className="generate-history-item__chip">{secondaryChip}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    {canRemoveEntry && (
                      <button
                        type="button"
                        className="generate-history-item__remove"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeHistoryEntry({ localId: entry.localId });
                        }}
                        aria-label="Удалить ошибочную запись из истории"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </ModalBackdrop>,
      document.body
    );
  };

  // Рендер состояния генерации: та же свайп-карточка с компактными полями пресета; сетка стилей и чипы категорий
  const renderGeneratingState = () => (
    <>
      {renderHeroCard()}
      {renderGenerateFormBlock({
        readOnly: true,
        textDisabled: false,
        dropEnabled: false,
        referenceDndEnabled: false,
        presetDisabled: true,
        showPromptError: false,
        withWrapperHandlers: false,
        withActiveState: false,
        buttonDisabled: true,
        buttonLoading: true,
        buttonAriaLabel: 'Идет генерация',
        buttonText: 'Подождите',
        hideSubmit: true,
        omitCompose: true,
      })}
    </>
  );

  // Рендер результата (Figma: image → Save → форма readonly → GENERATE 10 ART)
  const renderSuccessState = () => (
    <div className="generate-result-container">
      <div className="generate-success-section">
        {resultImageUrl && (
          <div className={cn('generate-result-image-wrapper', 'generate-hero-slot', 'generate-hero-slot--result')}>
            <button
              type="button"
              className="generate-result-image-tap"
              aria-label="Открыть стикер на весь экран"
              onClick={() =>
                setImageLightbox({
                  viewerUrl: resultImageUrl,
                  downloadUrl: resultImageUrl,
                  alt: 'Сгенерированный стикер',
                })
              }
            >
              <img
                src={resultImageUrl}
                alt="Сгенерированный стикер"
                className="generate-result-image"
                draggable={false}
                onError={purgeHistoryEntryForExpiredApiImage}
              />
            </button>
            <button
              type="button"
              className="generate-result-download-btn generate-result-download-btn--icon-only"
              onClick={handleDownloadResult}
              disabled={isDownloadingResult}
              aria-label="Скачать стикер на устройство"
              title="Скачать"
            >
              <DownloadIcon size={20} />
            </button>
          </div>
        )}

        {saveError && (
          <Text variant="bodySmall" style={{ color: 'var(--color-error)' }} align="center">
            {saveError}
          </Text>
        )}

        <div className="generate-actions">
          <div className="generate-actions__pair">
            {(taskId || imageId) && (
              <Button
                variant="primary"
                size="medium"
                onClick={handleOpenSaveModal}
                className="generate-action-button save"
              >
                {stickerSaved ? 'Сохранено' : 'Сохранить'}
              </Button>
            )}
            <Button
              variant="primary"
              size="medium"
              onClick={handleShareSticker}
              disabled={isSavingAndSharing}
              loading={isSavingAndSharing}
              className="generate-action-button share"
              aria-label="Поделиться"
            >
              {isSavingAndSharing ? 'Сохраняем...' : 'Отправить'}
            </Button>
          </div>
          {canOpenPublishStyleModal && (
            <Button
              variant="secondary"
              size="medium"
              type="button"
              className="generate-action-button publish-style"
              onClick={() => setPublishPresetModalOpen(true)}
            >
              Опубликовать стиль
            </Button>
          )}
          {!canOpenPublishStyleModal && isOwnedSelectedStyle && publicationStateLabel && (
            <div className="generate-style-publication-state" role="status" aria-live="polite">
              Статус стиля: {publicationStateLabel}
            </div>
          )}
        </div>
        {saveNoticeText && (
          <Text variant="bodySmall" className="generate-save-notice" align="center">
            {saveNoticeText}
          </Text>
        )}
      </div>

      <div className="generate-success-section generate-new-request">
        {renderSourceImageStrip(isGenerating, { suppressItemReveal: suppressSourceStripItemReveal })}
        {renderGenerateFormBlock({
          readOnly: false,
          textDisabled: isGenerating,
          dropEnabled: !isGenerating,
          referenceDndEnabled: !isGenerating,
          presetDisabled: isGenerating,
          showPromptError: shouldShowPromptError,
          withWrapperHandlers: true,
          withActiveState: true,
          buttonDisabled: isDisabled,
          buttonLoading: isGenerating,
          buttonText: generateLabel,
          onButtonClick: handleGenerate,
          hideSubmit: true,
        })}
      </div>
    </div>
  );

  // Рендер ошибки (Figma: same layout as idle, red message inside input block + GENERATE 10 ART)
  const renderErrorState = () => (
    <div className="generate-error-container">
      {renderHeroCard({
        composeSlot: renderMainInputBlock({
          readOnly: false,
          textDisabled: false,
          referenceDndEnabled: true,
          showPromptError: true,
          withWrapperHandlers: true,
          withActiveState: true,
        }),
      })}
      {renderSourceImageStrip(false, { suppressItemReveal: suppressSourceStripItemReveal })}
      {renderGenerateFormBlock({
        readOnly: false,
        textDisabled: false,
        dropEnabled: true,
        referenceDndEnabled: true,
        presetDisabled: false,
        showPromptError: true,
        withWrapperHandlers: true,
        withActiveState: true,
        buttonDisabled: !isFormValid,
        buttonClassName: 'generate-button-retry',
        buttonText: generateLabel,
        onButtonClick: handleGenerate,
        hideSubmit: true,
        omitCompose: true,
      })}
    </div>
  );

  // Рендер формы (Figma: Logo → Header → Inpit → Delete background → Style preview → Button)
  const renderIdleState = () => (
    <>
      {renderHeroCard({
        composeSlot: renderMainInputBlock({
          readOnly: false,
          textDisabled: isGenerating,
          referenceDndEnabled: !isGenerating,
          showPromptError: false,
          withWrapperHandlers: true,
          withActiveState: true,
        }),
      })}
      {renderSourceImageStrip(isGenerating, { suppressItemReveal: suppressSourceStripItemReveal })}

      {renderGenerateFormBlock({
        readOnly: false,
        textDisabled: isGenerating,
        dropEnabled: !isGenerating,
        referenceDndEnabled: !isGenerating,
        presetDisabled: isGenerating,
        showPromptError: false,
        withWrapperHandlers: true,
        withActiveState: true,
        buttonDisabled: isDisabled,
        buttonLoading: isGenerating,
        buttonText: isGenerating ? 'Идет генерация...' : generateLabel,
        onButtonClick: handleGenerate,
        hideSubmit: true,
        omitCompose: true,
      })}
    </>
  );

  const generatePageStyle = useMemo(
    () =>
      ({
        '--generate-keyboard-inset': `${keyboardInsetPx}px`,
      }) as CSSProperties,
    [keyboardInsetPx]
  );

  return (
    <div
      className={cn('page-container', 'generate-page', isInTelegramApp && 'telegram-app')}
      style={generatePageStyle}
    >
      <OtherAccountBackground />
      {renderHistoryModal()}
      <GenerateImageLightbox
        open={imageLightbox != null && imageLightbox.viewerUrl.length > 0}
        imageUrl={imageLightbox?.viewerUrl ?? ''}
        alt={imageLightbox?.alt ?? ''}
        onClose={() => setImageLightbox(null)}
        onDownload={
          imageLightbox?.downloadUrl ? () => void downloadStickerByUrl(imageLightbox.downloadUrl!) : undefined
        }
        downloadDisabled={isDownloadingResult}
      />
      <StylePresetPublicationModal
        open={publishPresetModalOpen}
        onClose={() => setPublishPresetModalOpen(false)}
        preset={selectedPreset}
        estimatedPublicationCostArt={publishCostHint}
        publishUiHints={publishUiHints}
        publicationReferencePreviewUrl={
          useTaskCompletedPublicationFlow ? publicationReferencePreviewUrl : null
        }
        publicationGeneratedPreviewUrl={
          useTaskCompletedPublicationFlow ? publicationGeneratedPreviewUrl : null
        }
        hasReferenceImage={hasReferenceForPublication}
        hasGeneratedResult={hasGeneratedResultForPublication}
        variant={
          useTaskCompletedPublicationFlow ? 'task_completed' : 'draft_preset'
        }
        taskId={taskId}
        userStyleBlueprintCode={ownStyleBlueprintSession?.blueprint.code ?? null}
        onPublished={(updated) => void handlePublicationPublished(updated)}
      />
      <div className="generate-page-content">
        <AttachmentPointerDragProvider enabled={!isGenerating} onInternalDrop={handleAttachmentPointerInternalDrop}>
          <StixlyPageContainer
            className={cn(
              'generate-inner',
              isCompactState && 'generate-inner--compact',
              isPromptFocused && 'generate-inner--prompt-focused',
            )}
          >
            {pageState === 'idle' && renderIdleState()}
            {pageState === 'uploading' && renderGeneratingState()}
            {pageState === 'generating' && renderGeneratingState()}
            {pageState === 'success' && renderSuccessState()}
            {pageState === 'error' && renderErrorState()}
          </StixlyPageContainer>
        </AttachmentPointerDragProvider>
      </div>
      {/* ── Фиксированная кнопка генерации: всегда над навбаром, скрывается при клавиатуре ── */}
      {!isPromptFocused && (
        <div className="generate-fixed-submit">
          <Button
            variant="primary"
            size="medium"
            onClick={isGenerating ? undefined : handleGenerate}
            disabled={isGenerating ? true : isDisabled}
            loading={isGenerating}
            className="generate-button-submit"
            aria-label={isGenerating ? 'Идет генерация' : undefined}
          >
            {isGenerating ? 'Подождите...' : generateLabel}
          </Button>
        </div>
      )}
      {errorMessage && (
        <div
          className="generate-error-toast"
          role="alert"
          aria-live="assertive"
          onClick={dismissErrorToast}
        >
          <span className="generate-error-toast__icon">!</span>
          <span>{errorMessage}</span>
        </div>
      )}
      <SaveToStickerSetModal
        isOpen={saveModalOpen}
        onClose={handleCloseSaveModal}
        imageUrl={resultImageUrl}
        imageId={imageId}
        taskId={taskId}
        userId={effectiveUserId}
        selectedEmoji={selectedEmoji}
        currentSavedStickerSetName={savedStickerSetName}
        lastUsedStickerSetName={lastUsedStickerSetName}
        lastUsedStickerSetTitle={lastUsedStickerSetTitle}
        onSaved={handleSavedFromModal}
      />
      {typeof document !== 'undefined' &&
        createPortal(
          <StylePresetPickOverlay
            preset={pendingGridStylePick}
            onAccept={() => {
              if (!pendingGridStylePick) return;
              handlePresetChange(pendingGridStylePick.id);
              setPendingGridStylePick(null);
            }}
            onDismiss={() => setPendingGridStylePick(null)}
          />,
          document.body,
        )}
    </div>
  );
};

export default GeneratePage;
