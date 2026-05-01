import { useEffect, useLayoutEffect, useState, useCallback, useRef, FC, ChangeEvent, ClipboardEvent, DragEvent as ReactDragEvent, useMemo, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StylePresetPackGrid } from '@/components/StylePresetPackGrid';
import { StylePresetPublicationModal } from '@/components/StylePresetPublicationModal';
import { mergeCreateStylePresetRequest } from '@/utils/mergeCreateStylePresetRequest';
import {
  blueprintNeedsPresetReferenceSlot,
  buildAutoStylePresetCode,
  buildVirtualOwnStylePreset,
  isOwnStyleBlueprintVirtualPreset,
  OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID,
  resolveCreationBlueprint,
} from '@/utils/ownStyleBlueprint';
import { StylePresetCategoryChips, type StyleCategoryFilter } from '@/components/StylePresetCategoryChips';
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
  StylePreset,
  StylePresetCategoryDto,
  StylePresetField,
  StylePresetRemoveBgMode,
  UserPresetCreationBlueprintDto,
} from '@/api/client';
import {
  ensureSelectedPresetInStrip,
  sortPresetsInCategory,
  uniqueCategoriesFromPresets,
} from '@/utils/stylePresetCategoryUi';
import { useProfileStore } from '@/store/useProfileStore';
import { useGenerateHistoryHeaderStore } from '@/store/useGenerateHistoryHeaderStore';
import { useTelegram } from '@/hooks/useTelegram';
import { useHorizontalScrollStrip } from '@/hooks/useHorizontalScrollStrip';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { buildSwitchInlineQuery, buildFallbackShareUrl, removeInvisibleChars, isValidTelegramFileId, getPlatformInfo } from '@/utils/stickerUtils';
import { SaveToStickerSetModal } from '@/components/SaveToStickerSetModal';
import { ModalBackdrop } from '@/components/ModalBackdrop';
import { resolveAvatarContext } from '@/utils/resolvedAvatar';
import {
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
import { POPULAR_EMOJIS } from '@/constants/popularEmojis';
type PageState = 'idle' | 'uploading' | 'generating' | 'success' | 'error';
type ErrorKind = 'prompt' | 'upload' | 'general';


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
const BACKGROUND_REMOVE_FALLBACK_NOTICE =
  'Не удалось удалить фон, поэтому показан вариант без удаления фона.';
const DEFAULT_STICKER_BOT_SUFFIX = '_by_stixlybot';
const SOURCE_IMAGE_ID_REUSE_WINDOW_MS = 5 * 60 * 1000;
const MAX_SOURCE_IMAGE_FILES = 14;
const SOURCE_IMAGE_FINGERPRINT_SAMPLE_BYTES = 64 * 1024;
const TERMINAL_GENERATION_STATUSES: GenerationStatus[] = ['COMPLETED', 'FAILED', 'TIMEOUT'];
const HISTORY_PRESET_PREVIEW_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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

/** Категория основных пресетов: code `general` или имя General / «Общая» (локализация). */
function preferDefaultStyleCategoryId(categories: StylePresetCategoryDto[]): number {
  const generalByCode = categories.find((c) => c.code?.trim().toLowerCase() === 'general');
  if (generalByCode) return generalByCode.id;
  const generalByName = categories.find((c) => {
    const n = c.name?.trim().toLowerCase() ?? '';
    return n === 'общая' || n === 'general';
  });
  if (generalByName) return generalByName.id;
  return categories[0]!.id;
}

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

function getPresetReferenceSlotSourceId(preset: StylePreset | null | undefined): string | null {
  const raw = preset?.presetReferenceSourceImageId;
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return id || null;
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
  preset.previewWebpUrl ?? preset.previewUrl ?? null;

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
  const { isInTelegramApp, tg, user } = useTelegram();
  const location = useLocation();
  
  // Inline-режим параметры из URL
  const [, setInlineQueryId] = useState<string | null>(null);
  const [, setUserId] = useState<string | null>(null);
  
  // Состояние формы
  const [prompt, setPrompt] = useState('');
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [stylePresetCategories, setStylePresetCategories] = useState<StylePresetCategoryDto[]>([]);
  const [styleCategoryFilter, setStyleCategoryFilter] = useState<StyleCategoryFilter | null>(null);
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<number | null>(null);
  const [bootstrappingOwnStyle, setBootstrappingOwnStyle] = useState(false);
  const ownStyleBootstrapRef = useRef(false);
  const [ownStyleBlueprintSession, setOwnStyleBlueprintSession] = useState<{
    blueprint: UserPresetCreationBlueprintDto;
    virtualPreset: StylePreset;
  } | null>(null);
  const [publishPresetModalOpen, setPublishPresetModalOpen] = useState(false);
  const [publishCostHint, setPublishCostHint] = useState<number | null>(null);
  const [publishUiHints, setPublishUiHints] = useState<Record<string, unknown> | null>(null);
  const [userPresetCreationBlueprints, setUserPresetCreationBlueprints] = useState<
    UserPresetCreationBlueprintDto[]
  >([]);
  const [presetFields, setPresetFields] = useState<Record<string, string>>({});
  const [referenceAssignments, setReferenceAssignments] = useState<Record<string, string[]>>({});
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
  const [lastUsedStickerSetName, setLastUsedStickerSetName] = useState<string | null>(null);
  const [lastUsedStickerSetTitle, setLastUsedStickerSetTitle] = useState<string | null>(null);
  const [saveNoticeText, setSaveNoticeText] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [historyEntries, setHistoryEntries] = useState<GenerateHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  
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
  const restoreAppliedRef = useRef(false);
  const preferencesAppliedRef = useRef(false);

  const avatarAutofillAppliedRef = useRef<string | null>(null);
  const avatarAutofillInFlightRef = useRef(false);
  const processedAvatarTriggerRef = useRef<string | null>(null);
  const lastAvatarAutofillBlockReasonRef = useRef<string | null>(null);
  /** imageId (референс) → отпечаток файла; связь с лентой вложений (source strip) */
  const refImageIdToFingerprintRef = useRef<Record<string, string>>({});
  /** индексы 1:1 с sourceImageFiles */
  const sourceFingerprintByIndexRef = useRef<string[]>([]);
  const clearSourceImageRef = useRef<((options?: { markAvatarDismissed?: boolean }) => void) | null>(null);

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
      setKeyboardInsetPx(0);
      return;
    }

    const updateKeyboardInset = () => {
      const visualViewport = window.visualViewport;
      const nextInset = visualViewport
        ? Math.max(0, Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop))
        : 0;
      setKeyboardInsetPx(nextInset);

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.classList.contains('generate-input')) {
        scrollPromptIntoView(activeElement, nextInset > 0 ? 'auto' : 'smooth');
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

  // Загрузка пресетов стилей, категорий и blueprint создания своего стиля при монтировании
  useEffect(() => {
    const loadPresets = async () => {
      let presets: StylePreset[] = [];
      try {
        presets = await apiClient.loadStylePresetsMerged();
      } catch (error) {
        console.error('Ошибка загрузки пресетов стилей:', error);
      }
      setStylePresets(presets);

      try {
        const [categories, blueprints] = await Promise.all([
          apiClient.getStylePresetCategories().catch((err) => {
            console.warn('Категории пресетов недоступны, чипы из пресетов:', err);
            return [] as StylePresetCategoryDto[];
          }),
          apiClient.getUserPresetCreationBlueprints().catch((err) => {
            console.warn('Blueprint создания пресета недоступен:', err);
            return [] as UserPresetCreationBlueprintDto[];
          }),
        ]);
        setStylePresetCategories(categories);
        setUserPresetCreationBlueprints(blueprints);
      } catch (error) {
        console.error('Ошибка загрузки категорий или blueprint пресетов:', error);
      }
    };

    void loadPresets();
  }, []);

  const styleCategoryChipsList = useMemo(() => {
    if (stylePresetCategories.length > 0) return stylePresetCategories;
    return uniqueCategoriesFromPresets(stylePresets);
  }, [stylePresetCategories, stylePresets]);

  useLayoutEffect(() => {
    if (styleCategoryChipsList.length === 0) {
      setStyleCategoryFilter(null);
      return;
    }
    setStyleCategoryFilter((prev) => {
      const ids = new Set(styleCategoryChipsList.map((c) => c.id));
      if (prev != null && ids.has(prev)) return prev;
      return preferDefaultStyleCategoryId(styleCategoryChipsList);
    });
  }, [styleCategoryChipsList]);

  const presetsWithVirtual = useMemo(() => {
    if (!ownStyleBlueprintSession) return stylePresets;
    const v = ownStyleBlueprintSession.virtualPreset;
    if (styleCategoryFilter != null && v.category?.id !== styleCategoryFilter) return stylePresets;
    return [v, ...stylePresets];
  }, [ownStyleBlueprintSession, stylePresets, styleCategoryFilter]);

  const stripStylePresets = useMemo(() => {
    if (styleCategoryChipsList.length === 0 || styleCategoryFilter == null) {
      const strip = presetsWithVirtual.filter((p) => isPresetShownInStrip(p));
      return ensureSelectedPresetInStrip(
        sortPresetsInCategory(strip),
        presetsWithVirtual,
        selectedStylePresetId,
      );
    }
    const list = presetsWithVirtual.filter(
      (p) => isPresetShownInStrip(p) && p.category?.id === styleCategoryFilter,
    );
    return ensureSelectedPresetInStrip(
      sortPresetsInCategory(list),
      presetsWithVirtual,
      selectedStylePresetId,
    );
  }, [
    styleCategoryFilter,
    presetsWithVirtual,
    selectedStylePresetId,
    styleCategoryChipsList,
    isPresetShownInStrip,
  ]);

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

  const removeHistoryEntry = useCallback((matcher: { localId?: string; taskId?: string }) => {
    if (!historyUserScopeId) return;
    const updated = deleteGenerateHistoryEntry(historyUserScopeId, matcher);
    if (matcher.localId && activeHistoryLocalIdRef.current === matcher.localId) {
      activeHistoryLocalIdRef.current = null;
    }
    setHistoryEntries(updated);
  }, [historyUserScopeId]);

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
                : statusData.errorMessage || null,
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
            setErrorMessage(
              statusData.errorMessage ||
                (statusData.status === 'TIMEOUT' ? 'Превышено время ожидания' : 'Произошла ошибка при генерации')
            );
            setErrorKind('general');
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

  const appendSourceImages = useCallback(async (files: File[]): Promise<boolean> => {
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
    async (files: File[]): Promise<boolean> => {
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
    pageState,
    profileAvatarFileId,
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
      name: typeof name === 'string' && name.trim() ? name.trim() : 'Мой стиль',
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
    return { blueprint, virtualPreset };
  }, [stylePresetCategories, user?.id, userInfo?.id]);

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

  // Метаданные UI выбранного пресета (виртуальный карточный пресет для «своего стиля» без черновика в БД)
  const selectedPreset: StylePreset | null = useMemo(() => {
    if (isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) && ownStyleBlueprintSession) {
      return ownStyleBlueprintSession.virtualPreset;
    }
    if (selectedStylePresetId == null) return null;
    return stylePresets.find((p) => p.id === selectedStylePresetId) ?? null;
  }, [ownStyleBlueprintSession, selectedStylePresetId, stylePresets]);
  const publishStyleCostLabel = useMemo(() => {
    if (publishCostHint != null && Number.isFinite(publishCostHint)) {
      return `${publishCostHint} ART`;
    }
    return '10 ART';
  }, [publishCostHint]);
  const promptInputCfg = selectedPreset?.promptInput ?? null;
  /** Показывать ли основное поле prompt (скрывается только когда enabled явно false) */
  const showPromptInput = promptInputCfg ? promptInputCfg.enabled : true;
  /** Является ли prompt обязательным */
  const promptIsRequired = showPromptInput && (promptInputCfg ? (promptInputCfg.required ?? true) : true);
  const effectiveMaxPromptLen = promptInputCfg?.maxLength ?? MAX_PROMPT_LENGTH;
  const effectivePromptPlaceholder =
    promptInputCfg?.placeholder ?? 'Опишите свою идею или используйте готовые стили!';
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
  const lockedPresetRefFieldKeys = useMemo(
    () =>
      isLockedServerPresetReferenceSlot(selectedPreset)
        ? new Set<string>([PRESET_REF_FIELD_KEY])
        : new Set<string>(),
    [selectedPreset],
  );

  /** Синхронизация слота preset_ref с DTO пресета (после смены стиля или загрузки списка пресетов). */
  useEffect(() => {
    if (!selectedPreset) return;
    const srcId = getPresetReferenceSlotSourceId(selectedPreset);
    if (!srcId || !presetHasPresetReferenceField(selectedPreset)) return;
    setReferenceAssignments((prev) => ({ ...prev, [PRESET_REF_FIELD_KEY]: [srcId] }));
    const srcUrl =
      typeof selectedPreset.presetReferenceImageUrl === 'string'
        ? selectedPreset.presetReferenceImageUrl.trim()
        : '';
    if (srcUrl) {
      setReferencePreviewById((prev) => (prev[srcId] ? prev : { ...prev, [srcId]: srcUrl }));
    }
  }, [selectedPreset]);

  const stickerEmojiCaption = selectedPreset?.stickerEmojiLabel?.trim() || null;

  const removeBgResolved = resolveRemoveBackground(
    selectedPreset?.removeBackgroundMode,
    removeBackground,
  );
  const showRemoveBgToggle = removeBgResolved.userControlled;
  const effectiveRemoveBackground = removeBgResolved.value;

  const renderRemoveBgToggle = (disabled: boolean) =>
    showRemoveBgToggle ? (
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
    ) : null;

  const applyReferenceMove = useCallback(
    (payload: PresetReferenceMovePayload & { toKey: string; toIndex: number }) => {
      if (lockedPresetRefFieldKeys.has(payload.fromKey) || lockedPresetRefFieldKeys.has(payload.toKey)) {
        return;
      }
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
        const { imageIds } = await apiClient.uploadSourceImages(slice);
        await registerRefImageIdsForFiles(imageIds, slice);
        void appendSourceImages(slice);
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
    [appendSourceImages, effectiveReferenceMaxUnique, lockedPresetRefFieldKeys, referenceAssignments, registerRefImageIdsForFiles, selectedPresetFieldDefs],
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
        const { imageIds } = await apiClient.uploadSourceImages([file]);
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
    [effectiveReferenceMaxUnique, lockedPresetRefFieldKeys, referenceAssignments, registerRefImageIdsForFiles, selectedPresetFieldDefs, sourceImageFiles],
  );

  // Обработка отправки формы
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    const canGenerateWithoutPrompt =
      selectedStylePresetId != null && (sourceImageFiles.length > 0 || hasReferenceSlotsFilled);
    if (showPromptInput && promptIsRequired && !canGenerateWithoutPrompt) {
      if (!trimmedPrompt || trimmedPrompt.length < MIN_PROMPT_LENGTH) {
        setErrorMessage('Введите описание стикера');
        setErrorKind('prompt');
        setPageState('error');
        return;
      }
    }
    if (showPromptInput && trimmedPrompt.length > effectiveMaxPromptLen) {
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
      const isOwnStyleGeneration =
        isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) && ownStyleBlueprintSession != null;
      const stylePresetNameForHistory =
        selectedPreset?.name?.trim() || (isOwnStyleGeneration ? 'Мой стиль' : null);
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
          prompt: trimmedPrompt,
          model: selectedModel,
          stylePresetId: selectedStylePresetId,
          stylePresetName: stylePresetNameForHistory,
          stylePresetCode: stylePresetCodeForHistory,
          styleModerationStatus: styleModerationStatusForHistory,
          ownStyleBlueprintCode: ownStyleBlueprintSession?.blueprint.code ?? null,
          selectedEmoji,
          removeBackground,
          hasSourceImage: sourceImageFiles.length > 0 || hasReferenceSlotsFilled,
          pageState:
            sourceImageFiles.length > 0 && !hasReferenceSlotsFilled ? 'uploading' : 'generating',
          generationStatus:
            sourceImageFiles.length > 0 && !hasReferenceSlotsFilled ? null : 'PROCESSING_PROMPT',
          resultImageUrl: null,
          imageId: null,
          fileId: null,
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
        prompt: showPromptInput ? trimmedPrompt : '',
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
      } else if (error.message === 'INVALID_GENERATION_PARAMS') {
        message = 'Некорректные параметры генерации.';
        setErrorKind(sourceImageFiles.length > 0 ? 'upload' : 'general');
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
        const { imageIds } = await apiClient.uploadSourceImages(slice);
        await registerRefImageIdsForFiles(imageIds, slice);
        void appendSourceImages(slice);
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
    [appendSourceImages, effectiveReferenceMaxUnique, lockedPresetRefFieldKeys, referenceAssignments, registerRefImageIdsForFiles, selectedPresetFieldDefs],
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
    if (!showPromptInput) {
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
  }, [appendSourceImages, showPromptInput]);

  /* Без отдельного поля промпта — вставка в исходники (Ctrl+V) без фокуса на textarea */
  useEffect(() => {
    if (showPromptInput) return;
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
  }, [appendSourceImages, showPromptInput]);

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
  /** Опорный стиль для «своего стиля» — только загрузка в слот (img_sagref_*), без PUT черновика */
  const isBlockedByOwnStylePresetRefGate =
    ownStyleNeedsGalleryPresetRef && !ownStylePresetRefFromGalleryOk;
  const isFormValid =
    (promptOk || canGenerateWithoutPrompt) && presetFieldsOk && ownStylePresetRefFromGalleryOk;
  const isGenerating = pageState === 'generating' || pageState === 'uploading';
  const isDisabled = isGenerating || !isFormValid || isBlockedByOwnStylePresetRefGate;
  const hasPromptText = prompt.trim().length > 0;
  const hasReferenceForPublication =
    sourceImageFiles.length > 0 || collectUniqueReferenceImageIds(referenceAssignments).size > 0;
  const hasGeneratedResultForPublication = Boolean(resultImageUrl || imageId);
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
  const publicationStateLabel =
    selectedStyleModerationStatus && selectedStyleModerationStatus !== 'DRAFT'
      ? MODERATION_STATUS_LABELS[selectedStyleModerationStatus]
      : null;
  const latestHistoryEntry = historyEntries[0] ?? null;
  const historyPreviewImage = latestHistoryEntry?.resultImageUrl ?? null;
  const historyPreviewFallback = latestHistoryEntry?.selectedEmoji ?? '🕘';
  const setHistoryHeaderSlot = useGenerateHistoryHeaderStore((s) => s.setSlot);
  const toggleHistoryOpen = useCallback(() => {
    setHistoryOpen((prev) => !prev);
  }, []);
  useLayoutEffect(() => {
    setHistoryHeaderSlot({
      previewImageUrl: historyPreviewImage,
      fallbackEmoji: historyPreviewFallback,
      open: historyOpen,
      toggle: toggleHistoryOpen,
    });
    return () => {
      setHistoryHeaderSlot(null);
    };
  }, [historyPreviewImage, historyPreviewFallback, historyOpen, toggleHistoryOpen, setHistoryHeaderSlot]);

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
      return stripPresetName(entry.stylePresetName ?? 'Мой стиль');
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
    setPresetFields({});
    setReferencePreviewById({});
    refImageIdToFingerprintRef.current = {};
    sourceFingerprintByIndexRef.current = [];
    setSourceImageFiles([]);
    setSourceImagePreviews([]);
    setSourceImageOrigin('none');
    resetUploadedSourceImageCache();
    setReferenceUploadingKey(null);
    avatarAutofillAppliedRef.current = null;
    const ownStyleSessionReady = await ensureOwnStyleSessionForHistory(entry);
    {
      const entryPreset =
        entry.stylePresetId != null && !isOwnStyleBlueprintVirtualPreset(entry.stylePresetId)
          ? stylePresets.find((p) => p.id === entry.stylePresetId)
          : null;
      const nextRefs: Record<string, string[]> = {};
      for (const f of entryPreset?.fields ?? []) {
        if (f.type === 'reference') {
          nextRefs[f.key] = [];
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

    if (entry.pageState === 'success') {
      setPageState('success');
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

  const renderSourceImageStrip = (disabled: boolean) => {
    const hasAttachedImages = sourceImageFiles.length > 0;

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
          hasAttachedImages ? 'generate-source-strip--expanded' : 'generate-source-strip--collapsed'
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
                />
              ))}
            </div>
          </div>
        )}
        {hasAttachedImages && sourceImageFiles.length >= 2 && (
          <button
            type="button"
            className="generate-source-strip__clear-link"
            onClick={() => clearSourceImage()}
            disabled={disabled}
            aria-label="Удалить все прикрепленные изображения"
          >
            Удалить все
          </button>
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

  const presetPreviewById = useMemo(() => {
    const minFreshTs = Date.now() - HISTORY_PRESET_PREVIEW_TTL_MS;
    const previewMap = new Map<number, string>();
    historyEntries.forEach((entry) => {
      if (
        entry.stylePresetId != null &&
        entry.pageState === 'success' &&
        entry.updatedAt >= minFreshTs &&
        entry.resultImageUrl &&
        !previewMap.has(entry.stylePresetId)
      ) {
        previewMap.set(entry.stylePresetId, entry.resultImageUrl);
      }
    });
    return previewMap;
  }, [historyEntries]);

  const selectedStylePresetCardPreview = useMemo(() => {
    if (selectedStylePresetId == null || !selectedPreset) return null;
    return (
      presetPreviewById.get(selectedStylePresetId) ??
      (selectedPreset.code ? PRESET_PREVIEW_FALLBACK_BY_CODE[selectedPreset.code] : undefined) ??
      getServerStylePresetCardPreview(selectedPreset) ??
      null
    );
  }, [presetPreviewById, selectedPreset, selectedStylePresetId]);

  const handlePresetChange = (
    presetId: number | null,
    opts?: { skipPublishHintReset?: boolean },
  ) => {
    if (!opts?.skipPublishHintReset) {
      setPublishCostHint(null);
      setPublishUiHints(null);
    }
    if (!isOwnStyleBlueprintVirtualPreset(presetId)) {
      setOwnStyleBlueprintSession(null);
    }
    setSelectedStylePresetId(presetId);
    setPresetFields({});
    setReferenceAssignments({});
    setReferencePreviewById({});
    setReferenceUploadingKey(null);
    refImageIdToFingerprintRef.current = {};
    if (isOwnStyleBlueprintVirtualPreset(presetId)) {
      persistGeneratePreferences({ stylePresetId: null });
    } else {
      persistGeneratePreferences({ stylePresetId: presetId });
    }
  };

  /**
   * «Создать свой стиль»: blueprint без POST /generation/style-presets; виртуальная карточка и генерация по blueprint-коду.
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

  const renderEmojiSelect = (disabled: boolean, caption: string | null) => {
    const hasCaption = Boolean(caption);
    return (
      <div
        ref={emojiDropdownRef}
        className={cn(
          'generate-model-select-wrap',
          'generate-model-select-wrap--emoji',
          hasCaption && 'generate-model-select-wrap--emoji-wide',
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
        {emojiDropdownOpen && (
          <div className="generate-model-select-dropdown generate-model-select-dropdown--emoji">
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
  };

  const renderInputFooter = (disabled: boolean) => (
    <div className="generate-input-footer">
      <div className="generate-input-toolbar">
        {renderEmojiSelect(disabled, stickerEmojiCaption)}
        {renderRemoveBgToggle(disabled)}
      </div>
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
        (showPromptInput && selectedPresetFieldDefs.length > 0) && 'generate-input-wrapper--with-preset-stack',
        !showPromptInput && selectedPresetFieldDefs.length > 0 && 'generate-input-wrapper--preset-only',
      )}
      tabIndex={cfg.withWrapperHandlers && !showPromptInput ? 0 : undefined}
      onPaste={cfg.withWrapperHandlers ? handleInputWrapperPaste : undefined}
    >
      {showPromptInput && (
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
            showPromptInput && 'generate-input-preset-stack--after-prompt',
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
      onPresetChange={handlePresetChange}
      previewByPresetId={presetPreviewById}
      fallbackPreviewByPresetCode={PRESET_PREVIEW_FALLBACK_BY_CODE}
      disabled={disabled || bootstrappingOwnStyle}
      creationHighlightPresetId={
        isOwnStyleBlueprintVirtualPreset(selectedStylePresetId)
          ? OWN_STYLE_BLUEPRINT_VIRTUAL_PRESET_ID
          : null
      }
      onCreatePreset={() => void handleSelectOwnStylePreset()}
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
  }) => (
    <div
      className="generate-form-block"
      onDragOver={cfg.dropEnabled ? handleGenerateFormDragOver : undefined}
      onDrop={cfg.dropEnabled ? handleGenerateFormDrop : undefined}
    >
      <div className="generate-form-layout">
        <div className="generate-form-layout__compose">
          {renderMainInputBlock({
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
            {styleCategoryChipsList.length > 0 && styleCategoryFilter != null && (
              <StylePresetCategoryChips
                categories={styleCategoryChipsList}
                value={styleCategoryFilter}
                onChange={setStyleCategoryFilter}
                disabled={cfg.presetDisabled}
                variant="gallery"
              />
            )}
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
      </div>
    </div>
  );

  const primarySourcePreview = sourceImagePreviews[0] ?? null;
  const stripIsOnlyTelegramAvatars =
    sourceImageFiles.length > 0 && sourceImageFiles.every((f) => isTelegramAvatarSourceFile(f));
  const showAvatarCenterCard =
    selectedStylePresetId == null && stripIsOnlyTelegramAvatars && Boolean(primarySourcePreview);
  const renderBrandBlock = () => (
    <div
      className={cn(
        'generate-brand',
        selectedStylePresetId != null &&
          selectedStylePresetCardPreview &&
          'generate-brand--preset-hero',
      )}
    >
      {selectedStylePresetId != null && selectedStylePresetCardPreview ? (
        <div className="generate-result-image-wrapper">
          <img
            src={selectedStylePresetCardPreview}
            alt={selectedPreset ? stripPresetName(selectedPreset.name) : ''}
            className="generate-result-image"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : showAvatarCenterCard ? (
        <div className="generate-brand-avatar-card">
          <button
            type="button"
            className="generate-brand-avatar-remove"
            onClick={() => clearSourceImage({ markAvatarDismissed: true })}
            aria-label="Убрать Telegram-аватар"
          >
            ×
          </button>
          <img
            src={primarySourcePreview ?? ''}
            alt="Telegram-аватар"
            className="generate-brand-avatar-image"
            loading="eager"
            decoding="async"
          />
          <span className="generate-brand-avatar-label">Сгенерировать по аватару</span>
        </div>
      ) : (
        <img
          src={STIXLY_LOGO_ORANGE}
          alt=""
          className="generate-brand-logo"
          loading="eager"
          decoding="async"
          aria-hidden="true"
        />
      )}
    </div>
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
            <button
              type="button"
              className="generate-history-modal__close"
              onClick={() => setHistoryOpen(false)}
              aria-label="Закрыть историю генераций"
            >
              ×
            </button>
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
                          <img className="generate-history-item__preview" src={entry.resultImageUrl} alt="" />
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

  // Рендер состояния генерации: спиннер с сообщением "Подождите", форма readonly, кнопка в стиле submit с текстом "Подождите"
  const renderGeneratingState = () => (
    <>
      <div className="generate-status-container">
        <LoadingSpinner message={getGeneratingSpinnerMessage(pageState, currentStatus)} />
      </div>
      {renderSourceImageStrip(true)}
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
      })}
    </>
  );

  // Рендер результата (Figma: image → Save → форма readonly → GENERATE 10 ART)
  const renderSuccessState = () => (
    <div className="generate-result-container">
      <div className="generate-success-section">
        {resultImageUrl && (
          <div className="generate-result-image-wrapper">
            <img
              src={resultImageUrl}
              alt="Сгенерированный стикер"
              className="generate-result-image"
            />
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
              <span className="publish-style-btn__title">Опубликовать стиль</span>
              <span className="publish-style-btn__cost">{publishStyleCostLabel}</span>
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
        {renderSourceImageStrip(isGenerating)}
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
        })}
      </div>
    </div>
  );

  // Рендер ошибки (Figma: same layout as idle, red message inside input block + GENERATE 10 ART)
  const renderErrorState = () => (
    <div className="generate-error-container">
      {renderBrandBlock()}
      {renderSourceImageStrip(false)}
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
      })}
    </div>
  );

  // Рендер формы (Figma: Logo → Header → Inpit → Delete background → Style preview → Button)
  const renderIdleState = () => (
    <>
      {renderBrandBlock()}
      {renderSourceImageStrip(isGenerating)}

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
      <StylePresetPublicationModal
        open={publishPresetModalOpen}
        onClose={() => setPublishPresetModalOpen(false)}
        preset={selectedPreset}
        estimatedPublicationCostArt={publishCostHint}
        publishUiHints={publishUiHints}
        hasReferenceImage={hasReferenceForPublication}
        hasGeneratedResult={hasGeneratedResultForPublication}
        variant={
          isOwnStyleBlueprintVirtualPreset(selectedStylePresetId) ? 'task_completed' : 'draft_preset'
        }
        taskId={taskId}
        userStyleBlueprintCode={ownStyleBlueprintSession?.blueprint.code ?? null}
        onPublished={(updated) => void handlePublicationPublished(updated)}
      />
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
    </div>
  );
};

export default GeneratePage;
