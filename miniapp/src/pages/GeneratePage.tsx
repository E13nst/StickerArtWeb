import { useEffect, useState, useCallback, useRef, FC, ChangeEvent, ClipboardEvent, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { KeyboardArrowDownIcon } from '@/components/ui/Icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import './GeneratePage.css';
import { apiClient, GenerateModelType, GenerationStatus, StylePreset } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { useTelegram } from '@/hooks/useTelegram';
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
import { readGeneratePreferences, writeGeneratePreferences } from '@/utils/generatePreferencesStorage';
type PageState = 'idle' | 'uploading' | 'generating' | 'success' | 'error';
type ErrorKind = 'prompt' | 'upload' | 'general';


/** Сообщение для tg-spinner__message: upload -> start -> generate */
const getGeneratingSpinnerMessage = (pageState: PageState, status: GenerationStatus | null): string => {
  if (pageState === 'uploading') return 'Загружаем фото';
  if (status === 'GENERATING' || status === 'REMOVING_BACKGROUND') return 'Создаем шедевр';
  return 'Улучшаем промпт'; // PROCESSING_PROMPT, PENDING, null и остальные
};

const POLLING_INTERVAL = 2000;
const POLLING_TIMEOUT_MS = 120000;
const MAX_PROMPT_LENGTH = 1000;
const MIN_PROMPT_LENGTH = 1;
const SAVE_TO_SET_WAIT_TIMEOUT_SEC = 300;
const DEFAULT_STICKER_BOT_SUFFIX = '_by_stixlybot';
const SOURCE_IMAGE_ID_REUSE_WINDOW_MS = 5 * 60 * 1000;
const MAX_SOURCE_IMAGE_FILES = 14;
const SOURCE_IMAGE_FINGERPRINT_SAMPLE_BYTES = 64 * 1024;
const TERMINAL_GENERATION_STATUSES: GenerationStatus[] = ['COMPLETED', 'FAILED', 'TIMEOUT'];
const DEFAULT_GENERATE_MODEL: GenerateModelType = 'nanabanana';
const DEFAULT_GENERATE_EMOJI = '🎨';
const DEFAULT_REMOVE_BACKGROUND = true;
const TELEGRAM_AVATAR_DISMISSED_STORAGE_KEY = 'generate_telegram_avatar_dismissed';
const LAST_USED_SAVE_TARGET_STORAGE_PREFIX = 'stixly:generate-last-used-save-target:v1';
const LEGACY_DEFAULT_SAVE_TARGET_STORAGE_PREFIX = 'stixly:generate-default-save-target:v1';

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

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

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

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
const POPULAR_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚',
  '🙂', '🤗', '🤩', '🤔', '🫡', '🤨', '😐', '😑', '😶', '🫥', '😶‍🌫️', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯',
  '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🫤', '🙃', '🫠', '🤑', '😲',
  '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '😬', '😰', '😱', '🥵', '🥶', '😳',
  '🤯', '😵', '😵‍💫', '🥴', '😠', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🥳', '🥸', '😈', '👿',
  '👻', '💀', '☠️', '👽', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  '❤️', '🩷', '🧡', '💛', '💚', '🩵', '💙', '💜', '🤎', '🖤', '🩶', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗',
  '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '🫶', '🤝', '👏', '🙌', '👐', '👍', '👎', '👌', '✌️', '🤞', '🫰',
  '🤟', '🤘', '🤙', '👋', '🫳', '🫴', '🖐️', '✋', '🖖', '👈', '👉', '👆', '👇', '☝️', '✊', '👊', '🤛', '🤜',
  '💪', '🫵', '🙏', '✍️', '💅', '👀', '🧠', '👑', '💎', '🔥', '✨', '⭐', '🌟', '💫', '⚡', '☄️', '🌈', '☀️',
  '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '☔', '💧', '💦',
  '🌊', '🎉', '🎊', '🎁', '🎈', '🎀', '🎂', '🍰', '🧁', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🍓', '🍒', '🍑',
  '🍎', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍇', '🥝', '🍅', '🥑', '🥕', '🌽', '🌶️', '🍄', '🥐', '🍞', '🧀',
  '🍔', '🍟', '🍕', '🌭', '🌮', '🌯', '🥪', '🍝', '🍜', '🍣', '🍤', '🍙', '🍚', '🍛', '🍦', '🍧', '🍨', '☕',
  '🍵', '🧃', '🥤', '🍹', '🍸', '🍷', '🍺', '🍻', '🥂',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉',
  '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪲', '🦋', '🐌', '🐞',
  '🐢', '🐍', '🦎', '🦂', '🐙', '🦀', '🐠', '🐟', '🐬', '🦈', '🐳', '🐘', '🦒', '🦌', '🦬', '🦥', '🦦', '🦨',
  '🌸', '🌼', '🌻', '🌺', '🌹', '🥀', '🌷', '🪷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '🎮', '🕹️', '🎲', '🧩', '🎯', '🎨',
  '🎭', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🚀', '✈️', '🚗', '🏎️', '🚕', '🚌',
  '🚓', '🚑', '🚒', '🚜', '🛵', '🏍️', '🚲', '🛴', '⛵', '🚤', '🛸', '🏠', '🏡', '🏢', '🏙️', '🌆', '🗽', '🗼',
  '📱', '💻', '⌚', '📷', '📸', '📹', '🎥', '💡', '🔦', '📚', '📝', '📌', '📎', '✂️', '🔒', '🔑', '🧸', '🪄'
];

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
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<GenerateModelType>(DEFAULT_GENERATE_MODEL);
  const [selectedEmoji, setSelectedEmoji] = useState(DEFAULT_GENERATE_EMOJI);
  const [removeBackground, setRemoveBackground] = useState<boolean>(DEFAULT_REMOVE_BACKGROUND);
  const [sourceImageFiles, setSourceImageFiles] = useState<File[]>([]);
  const [sourceImagePreviews, setSourceImagePreviews] = useState<string[]>([]);
  const [sourceImageOrigin, setSourceImageOrigin] = useState<'none' | 'manual' | 'telegram-avatar'>('none');
  const [telegramAvatarDismissed, setTelegramAvatarDismissed] = useState(false);
  
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
  
  // Polling ref
  const pollingIntervalRef = useRef<number | null>(null);
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement | null>(null);
  const [emojiDropdownOpen, setEmojiDropdownOpen] = useState(false);
  const emojiDropdownRef = useRef<HTMLDivElement | null>(null);
  const promptFocusTimeoutRef = useRef<number | null>(null);
  const saveNoticeTimeoutRef = useRef<number | null>(null);
  const draggedSourceImageIndexRef = useRef<number | null>(null);
  const sourceImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedSourceImageIdsRef = useRef<string[]>([]);
  const uploadedSourceImageAtRef = useRef<number | null>(null);
  const pollingStartedAtRef = useRef<number | null>(null);
  const activeHistoryLocalIdRef = useRef<string | null>(null);
  const restoreAppliedRef = useRef(false);
  const preferencesAppliedRef = useRef(false);
  const avatarAutofillAppliedRef = useRef<string | null>(null);
  const processedAvatarTriggerRef = useRef<string | null>(null);
  const lastAvatarAutofillBlockReasonRef = useRef<string | null>(null);

  const scrollPromptIntoView = useCallback((element: HTMLElement) => {
    const alignWithinScrollContainer = () => {
      const scrollContainer = element.closest('.stixly-main-scroll');
      if (!(scrollContainer instanceof HTMLElement)) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }

      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const topGap = elementRect.top - containerRect.top;
      const bottomGap = containerRect.bottom - elementRect.bottom;
      const topPadding = 20;
      const bottomPadding = 120;

      if (topGap < topPadding) {
        scrollContainer.scrollBy({ top: topGap - topPadding, behavior: 'smooth' });
        return;
      }

      if (bottomGap < bottomPadding) {
        scrollContainer.scrollBy({ top: bottomPadding - bottomGap, behavior: 'smooth' });
      }
    };

    requestAnimationFrame(alignWithinScrollContainer);
    window.setTimeout(alignWithinScrollContainer, 220);
  }, []);

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
      setSaveNoticeText(null);
      document.body.classList.remove('generate-prompt-focused');
    };
  }, []);

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

  // Загрузка пресетов стилей при монтировании
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const presets = await apiClient.getStylePresets();
        setStylePresets(presets);
      } catch (error) {
        console.error('Ошибка загрузки пресетов стилей:', error);
        // Тихий fallback - форма будет работать без пресетов
      }
    };
    
    loadPresets();
  }, []);

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
    if (sourceImageFiles.length > 0) {
      return sourceImageOrigin === 'telegram-avatar' ? 'AVATAR_ALREADY_APPLIED' : 'MANUAL_SOURCE_PRESENT';
    }
    return null;
  }, [
    effectiveAvatarUrl,
    hasActiveGeneration,
    hasPendingAvatarTrigger,
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

    if (hasPendingAvatarTrigger) {
      processedAvatarTriggerRef.current = avatarTriggerToken;
    }

    const avatarSourceKey = profileAvatarFileId || effectiveAvatarUrl;
    const avatarUrlToFetch = effectiveAvatarUrl ?? '';
    const autofillKey = `${telegramUserId}:${avatarSourceKey}:${hasPendingAvatarTrigger ? avatarTriggerToken : 'default'}`;
    if (avatarAutofillAppliedRef.current === autofillKey) {
      return;
    }
    avatarAutofillAppliedRef.current = autofillKey;

    const abortController = new AbortController();

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

        const previewDataUrl = await blobToDataUrl(blob);
        const fileExt = mimeType.includes('png')
          ? 'png'
          : mimeType.includes('webp')
            ? 'webp'
            : 'jpg';
        const fileType = mimeType || 'image/jpeg';
        const avatarFile = new File([blob], `telegram-avatar.${fileExt}`, { type: fileType });

        if (abortController.signal.aborted) return;

        setSourceImageFiles([avatarFile]);
        setSourceImagePreviews([previewDataUrl]);
        setSourceImageOrigin('telegram-avatar');
        if (hasPendingAvatarTrigger) {
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
        uploadedSourceImageIdsRef.current = [];
        uploadedSourceImageAtRef.current = null;
        setErrorMessage(null);
        setErrorKind(null);

        if (selectedModel !== SOURCE_IMAGE_MODEL) {
          setSelectedModel(SOURCE_IMAGE_MODEL);
          persistGeneratePreferences({ selectedModel: SOURCE_IMAGE_MODEL });
        }
      } catch (error) {
        // Тихий fallback: при недоступном photo_url оставляем текущий UI без ошибки.
        if (!abortController.signal.aborted) {
          console.info('Автоподстановка Telegram-аватара недоступна:', error);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [
    avatarAutofillBlockReason,
    persistGeneratePreferences,
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

  // Разрешаем скролл для этой страницы
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

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

  // Polling статуса генерации
  const startPolling = useCallback((taskIdToCheck: string) => {
    // Очищаем предыдущий интервал
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingStartedAtRef.current = Date.now();

    const poll = async () => {
      if (
        pollingStartedAtRef.current &&
        Date.now() - pollingStartedAtRef.current >= POLLING_TIMEOUT_MS
      ) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingStartedAtRef.current = null;
        setCurrentStatus('TIMEOUT');
        setErrorMessage('Генерация заняла слишком много времени. Попробуйте снова.');
        setErrorKind('general');
        setPageState('error');
        patchHistoryEntry(
          { taskId: taskIdToCheck, localId: activeHistoryLocalIdRef.current ?? undefined },
          {
            pageState: 'error',
            generationStatus: 'TIMEOUT',
            errorMessage: 'Генерация заняла слишком много времени. Попробуйте снова.',
            isActive: false,
          }
        );
        return;
      }

      try {
        const statusData = await apiClient.getGenerationStatusV2(taskIdToCheck);
        setCurrentStatus(statusData.status);
        patchHistoryEntry(
          { taskId: taskIdToCheck, localId: activeHistoryLocalIdRef.current ?? undefined },
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
            errorMessage: statusData.errorMessage || null,
            isActive: !TERMINAL_GENERATION_STATUSES.includes(statusData.status),
          }
        );

        if (statusData.status === 'COMPLETED') {
          // Успешное завершение
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          pollingStartedAtRef.current = null;
          setResultImageUrl(statusData.imageUrl || null);
          setImageId(statusData.imageId || null);
          // Сохраняем fileId для последующей отправки боту
          const receivedFileId = statusData.telegramSticker?.fileId || null;
          setFileId(receivedFileId);
          if (receivedFileId) {
            console.log('✅ Получен fileId из ответа API:', receivedFileId);
          }
          setPageState('success');
          // Обновляем профиль/баланс в сторе, чтобы хедер сразу показал новый баланс и аватар
          refreshMyProfile();
        } else if (statusData.status === 'FAILED' || statusData.status === 'TIMEOUT') {
          // Ошибка
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          pollingStartedAtRef.current = null;
          setErrorMessage(
            statusData.errorMessage || 
            (statusData.status === 'TIMEOUT' ? 'Превышено время ожидания' : 'Произошла ошибка при генерации')
          );
          setErrorKind('general');
          setPageState('error');
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

  const ensureUploadedSourceImageIds = useCallback(async (): Promise<string[]> => {
    if (!sourceImageFiles.length) {
      return [];
    }

    const cachedImageIds = uploadedSourceImageIdsRef.current;
    const uploadedAt = uploadedSourceImageAtRef.current;
    const hasFreshCachedUpload =
      cachedImageIds.length > 0 &&
      uploadedAt != null &&
      Date.now() - uploadedAt < SOURCE_IMAGE_ID_REUSE_WINDOW_MS;

    if (hasFreshCachedUpload) {
      return cachedImageIds;
    }

    const uploadResponse = await apiClient.uploadSourceImages(sourceImageFiles);
    uploadedSourceImageIdsRef.current = uploadResponse.imageIds;
    uploadedSourceImageAtRef.current = Date.now();
    return uploadResponse.imageIds;
  }, [sourceImageFiles]);

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
    if (!activeEntry || !activeEntry.taskId) return;

    setPrompt(activeEntry.prompt);
    setSelectedModel(normalizeGenerateModel(activeEntry.model));
    setSelectedStylePresetId(activeEntry.stylePresetId);
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
    startPolling(activeEntry.taskId);
  }, [historyUserScopeId, startPolling]);

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

  // Обработка отправки формы
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    const canGenerateWithoutPrompt = sourceImageFiles.length > 0 && selectedStylePresetId != null;
    if (!canGenerateWithoutPrompt && (!trimmedPrompt || trimmedPrompt.length < MIN_PROMPT_LENGTH)) {
      setErrorMessage('Введите описание стикера');
      setErrorKind('prompt');
      setPageState('error');
      return;
    }
    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
      setErrorMessage(`Слишком длинное описание (макс. ${MAX_PROMPT_LENGTH} символов)`);
      setErrorKind('prompt');
      setPageState('error');
      return;
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
          selectedEmoji,
          removeBackground,
          hasSourceImage: sourceImageFiles.length > 0,
          pageState: sourceImageFiles.length > 0 ? 'uploading' : 'generating',
          generationStatus: sourceImageFiles.length > 0 ? null : 'PROCESSING_PROMPT',
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

      if (sourceImageFiles.length > 0) {
        setPageState('uploading');
        uploadedImageIds = await ensureUploadedSourceImageIds();
        patchHistoryEntry(
          { localId: localHistoryId },
          { pageState: 'generating', generationStatus: 'PROCESSING_PROMPT' }
        );
      }

      setPageState('generating');
      setCurrentStatus('PROCESSING_PROMPT');

      const response = await apiClient.generateStickerV2({
        prompt: trimmedPrompt,
        model: selectedModel,
        stylePresetId: selectedStylePresetId,
        num_images: 1,
        remove_background: removeBackground,
        ...(uploadedImageIds.length === 1 ? { image_id: uploadedImageIds[0] } : {}),
        ...(uploadedImageIds.length > 1 ? { image_ids: uploadedImageIds } : {}),
      });
      
      setTaskId(response.taskId);
      patchHistoryEntry({ localId: localHistoryId }, { taskId: response.taskId, pageState: 'generating', isActive: true });
      startPolling(response.taskId);
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
        uploadedSourceImageIdsRef.current = [];
        uploadedSourceImageAtRef.current = null;
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

  const appendSourceImages = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const currentSourceCount = sourceImageOrigin === 'telegram-avatar' ? 0 : sourceImageFiles.length;
    const shouldReplaceTelegramAvatar = sourceImageOrigin === 'telegram-avatar';
    const existingFiles = shouldReplaceTelegramAvatar ? [] : sourceImageFiles;
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
      return;
    }

    const remainingSlots = MAX_SOURCE_IMAGE_FILES - currentSourceCount;
    if (remainingSlots <= 0) {
      setErrorMessage(getSourceImageLimitMessage());
      setErrorKind('upload');
      setPageState('error');
      return;
    }

    const filesToAppend = uniqueIncomingFiles.slice(0, remainingSlots);
    const skippedFilesCount = uniqueIncomingFiles.length - filesToAppend.length;

    try {
      const previews = await Promise.all(filesToAppend.map((file) => blobToDataUrl(file)));
      setSourceImageFiles((prev) => shouldReplaceTelegramAvatar ? filesToAppend : [...prev, ...filesToAppend]);
      setSourceImagePreviews((prev) => shouldReplaceTelegramAvatar ? previews : [...prev, ...previews]);
      setSourceImageOrigin('manual');
      uploadedSourceImageIdsRef.current = [];
      uploadedSourceImageAtRef.current = null;
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
    } catch {
      setErrorMessage('Не удалось загрузить файл');
      setErrorKind('upload');
      setPageState('error');
    }
  }, [buildSourceImageFingerprint, pageState, persistGeneratePreferences, selectedModel, sourceImageFiles, sourceImageOrigin]);

  const clearSourceImage = useCallback((options?: { markAvatarDismissed?: boolean }) => {
    if (options?.markAvatarDismissed && sourceImageOrigin === 'telegram-avatar') {
      setTelegramAvatarDismissed(true);
      persistTelegramAvatarDismissed(true);
    }
    setSourceImageFiles([]);
    setSourceImagePreviews([]);
    setSourceImageOrigin('none');
    uploadedSourceImageIdsRef.current = [];
    uploadedSourceImageAtRef.current = null;
  }, [persistTelegramAvatarDismissed, sourceImageOrigin]);

  const removeSourceImageAt = useCallback((index: number) => {
    if (index < 0 || index >= sourceImageFiles.length) return;

    if (sourceImageFiles.length === 1) {
      clearSourceImage({ markAvatarDismissed: sourceImageOrigin === 'telegram-avatar' });
      return;
    }

    setSourceImageFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setSourceImagePreviews((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    uploadedSourceImageIdsRef.current = [];
    uploadedSourceImageAtRef.current = null;
  }, [clearSourceImage, sourceImageFiles.length, sourceImageOrigin]);

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

    setSourceImageFiles((prev) => reorder(prev));
    setSourceImagePreviews((prev) => reorder(prev));
    uploadedSourceImageIdsRef.current = [];
    uploadedSourceImageAtRef.current = null;
  }, [sourceImageFiles.length]);

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

  const handlePromptPaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
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
  }, [appendSourceImages]);

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
    if (!effectiveUserId) {
      return null;
    }

    const username = (userInfo?.username ?? user?.username ?? '').trim();
    if (!username) {
      return null;
    }

    const expectedSetName = buildDefaultStickerSetName({ username, userId: effectiveUserId }).toLowerCase();

    try {
      const response = await apiClient.getUserStickerSets(effectiveUserId, 0, 50, 'createdAt', 'DESC', true);
      const ownSets = (response.content ?? []).filter((set) => isTrustedAutoSaveStickerSet(set, effectiveUserId));
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
          userId: effectiveUserId,
        }),
      };
    } catch (error) {
      console.warn('[GeneratePage] Failed to resolve auto-save target from server', error);
      return null;
    }
  }, [effectiveUserId, user?.first_name, user?.last_name, user?.username, userInfo?.firstName, userInfo?.lastName, userInfo?.username]);

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
  const hasSourceImage = sourceImageFiles.length > 0;
  const trimmedPrompt = prompt.trim();
  const canGenerateWithoutPrompt = hasSourceImage && selectedStylePresetId != null;
  const isFormValid =
    (trimmedPrompt.length >= MIN_PROMPT_LENGTH && trimmedPrompt.length <= MAX_PROMPT_LENGTH) ||
    canGenerateWithoutPrompt;
  const isGenerating = pageState === 'generating' || pageState === 'uploading';
  const isDisabled = isGenerating || !isFormValid;
  const hasPromptText = prompt.trim().length > 0;
  const latestHistoryEntry = historyEntries[0] ?? null;
  const historyHasCurrentResultPreview = pageState === 'success' && !!resultImageUrl;
  const historyHasStoredResultPreview = !!latestHistoryEntry?.resultImageUrl;
  const historyPreviewImage = historyHasCurrentResultPreview
    ? resultImageUrl
    : latestHistoryEntry?.resultImageUrl ?? null;
  const historyPreviewFallback = latestHistoryEntry?.selectedEmoji ?? '🕘';
  const historyHasPreviewImage = !!historyPreviewImage;
  const shouldCompactHistoryToggle = historyHasCurrentResultPreview;
  const hasActiveHistoryEntry = historyEntries.some((entry) => entry.isActive);

  const generateLabel = generateCost != null ? `Сгенерировать ${generateCost} ART` : 'Сгенерировать 10 ART';
  const shouldShowPromptError = errorKind === 'prompt' && !!errorMessage;
  const shouldShowGeneralError = errorMessage && errorKind !== 'prompt';
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
    if (entry.stylePresetId == null) return 'Без стиля';
    const preset = stylePresets.find((item) => item.id === entry.stylePresetId);
    return preset ? stripPresetName(preset.name) : 'Без стиля';
  };

  const getHistoryPrimaryChip = (entry: GenerateHistoryEntry): string => {
    const styleLabel = getHistoryStyleLabel(entry);
    return styleLabel !== 'Без стиля' ? styleLabel : entry.hasSourceImage ? 'С фото' : 'Только текст';
  };

  const getHistorySecondaryChip = (entry: GenerateHistoryEntry): string | null => {
    const styleLabel = getHistoryStyleLabel(entry);
    if (styleLabel !== 'Без стиля') {
      return entry.hasSourceImage ? 'С фото' : 'Только текст';
    }
    return null;
  };

  const openHistoryEntry = (entry: GenerateHistoryEntry) => {
    setHistoryOpen(false);
    setPrompt(entry.prompt);
    setSelectedModel(normalizeGenerateModel(entry.model));
    setSelectedStylePresetId(entry.stylePresetId);
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
      startPolling(entry.taskId);
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

  const renderSourceImageStrip = (disabled: boolean) => (
    <>
      <input
        ref={sourceImageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleSourceImageChange}
      />
      <div className="generate-source-strip" aria-label="Прикрепленные изображения">
        <div
          className={cn(
            'generate-source-strip__scroll-shell',
            !hasSourceImage && 'generate-source-strip__scroll-shell--empty'
          )}
        >
          <div
            className={cn(
              'generate-source-strip__inner',
              !hasSourceImage && 'generate-source-strip__inner--empty'
            )}
          >
            {sourceImagePreviews.map((preview, index) => (
              <div
                key={`${sourceImageFiles[index]?.name ?? 'source'}-${sourceImageFiles[index]?.lastModified ?? index}-${index}`}
                className="generate-source-strip__item"
                draggable={!disabled && sourceImageFiles.length > 1}
                onDragStart={() => {
                  draggedSourceImageIndexRef.current = index;
                }}
                onDragOver={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                  const draggedIndex = draggedSourceImageIndexRef.current;
                  if (draggedIndex == null) return;
                  moveSourceImage(draggedIndex, index);
                  draggedSourceImageIndexRef.current = null;
                }}
                onDragEnd={() => {
                  draggedSourceImageIndexRef.current = null;
                }}
              >
                <img
                  src={preview}
                  alt={`Исходное изображение ${index + 1}`}
                  className="generate-source-strip__image"
                  loading="lazy"
                  decoding="async"
                />
                {!disabled && (
                  <button
                    type="button"
                    className="generate-source-strip__remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeSourceImageAt(index);
                    }}
                    aria-label={`Удалить изображение ${index + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {sourceImageFiles.length >= 2 && (
              <button
                type="button"
                className="generate-source-strip__clear-all"
                onClick={() => clearSourceImage()}
                disabled={disabled}
                aria-label="Удалить все прикрепленные изображения"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          className="generate-source-picker"
          onClick={handleSourceImagePick}
          disabled={disabled || sourceImageFiles.length >= MAX_SOURCE_IMAGE_FILES}
          aria-label={`${hasSourceImage ? 'Добавить ещё исходные изображения' : 'Добавить исходные изображения'}. Прикреплено ${sourceImageFiles.length} из ${MAX_SOURCE_IMAGE_FILES}.`}
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

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (pageState === 'error' && errorKind === 'prompt') {
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('idle');
    }
  };

  const handleStyleSelect = (presetId: number) => {
    const nextStylePresetId = selectedStylePresetId === presetId ? null : presetId;
    setSelectedStylePresetId(nextStylePresetId);
    persistGeneratePreferences({ stylePresetId: nextStylePresetId });
    setStyleDropdownOpen(false);
    tg?.HapticFeedback?.impactOccurred('light');
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    persistGeneratePreferences({ selectedEmoji: emoji });
    setEmojiDropdownOpen(false);
    tg?.HapticFeedback?.impactOccurred('light');
  };

  const handleRemoveBackgroundChange = (checked: boolean) => {
    setRemoveBackground(checked);
    persistGeneratePreferences({ removeBackground: checked });
  };

  const styleSelectOptions = stylePresets.map((p) => ({ id: p.id, name: stripPresetName(p.name) }));
  const selectedPreset = stylePresets.find((p) => p.id === selectedStylePresetId);
  const styleButtonLabel = selectedPreset ? stripPresetName(selectedPreset.name) : 'Без стиля';

  useEffect(() => {
    if (!styleDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setStyleDropdownOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [styleDropdownOpen]);

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

  const renderEmojiSelect = (disabled: boolean) => (
    <div ref={emojiDropdownRef} className="generate-model-select-wrap generate-model-select-wrap--emoji">
      <button
        type="button"
        className="generate-model-select-trigger generate-model-select-trigger--emoji"
        onClick={() => !disabled && setEmojiDropdownOpen(v => !v)}
        disabled={disabled}
        aria-label="Выбор эмодзи"
        aria-expanded={emojiDropdownOpen}
      >
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

  const renderStyleSelect = (disabled: boolean) => (
    <div ref={styleDropdownRef} className="generate-model-select-wrap generate-model-select-wrap--style">
      <button
        type="button"
        className="generate-model-select-trigger"
        onClick={() => !disabled && setStyleDropdownOpen((v) => !v)}
        disabled={disabled}
        aria-label="Выберите стиль"
        aria-expanded={styleDropdownOpen}
      >
        <span className="generate-model-select-value">{styleButtonLabel}</span>
        <KeyboardArrowDownIcon
          size={14}
          color="var(--color-text-secondary)"
          style={{ transform: styleDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>
      {styleDropdownOpen && (
        <div className="generate-model-select-dropdown generate-model-select-dropdown--style">
          {styleSelectOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={cn('generate-model-select-option', opt.id === selectedStylePresetId && 'generate-model-select-option--selected')}
              onClick={() => handleStyleSelect(opt.id)}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const primarySourcePreview = sourceImagePreviews[0] ?? null;
  const hasTelegramAvatarInForm = sourceImageOrigin === 'telegram-avatar' && !!primarySourcePreview;
  const renderBrandBlock = () => (
    <div className="generate-brand">
      {hasTelegramAvatarInForm ? (
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
                      onClick={() => openHistoryEntry(entry)}
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
      <div className="generate-form-block">
        <div className="generate-input-wrapper">
          <textarea
            className="generate-input generate-input--readonly"
            rows={4}
            readOnly
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
            onFocus={handlePromptFocusIn}
            onBlur={handlePromptFocusOut}
          />
          <div className="generate-input-footer">
            {renderStyleSelect(true)}
            {renderEmojiSelect(true)}
            <label className="generate-checkbox-label generate-checkbox-label--inline">
              <span>Удалить фон</span>
              <input type="checkbox" checked={removeBackground} disabled className="generate-checkbox" readOnly />
            </label>
          </div>
        </div>
        <Button
          variant="primary"
          size="medium"
          loading
          className="generate-button-submit"
          aria-label="Идет генерация"
        >
          Подождите
        </Button>
      </div>
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
        {saveNoticeText && (
          <Text variant="bodySmall" className="generate-save-notice" align="center">
            {saveNoticeText}
          </Text>
        )}
      </div>

      <div className="generate-success-section generate-new-request">
        {renderSourceImageStrip(isGenerating)}
        <div className="generate-form-block">
          <div
            className={cn(
              'generate-input-wrapper',
              hasPromptText && 'generate-input-wrapper--active',
              shouldShowPromptError && 'generate-input-wrapper--error',
            )}
          >
            <textarea
              className={cn('generate-input', shouldShowPromptError && 'generate-input--error')}
              rows={4}
              placeholder="Опишите стикер, например: собака летит на ракете"
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onPaste={handlePromptPaste}
              maxLength={MAX_PROMPT_LENGTH}
              disabled={isGenerating}
              onFocus={handlePromptFocusIn}
              onBlur={handlePromptFocusOut}
            />
            <div className="generate-input-footer">
              {renderStyleSelect(isGenerating)}
              {renderEmojiSelect(isGenerating)}
              <label className="generate-checkbox-label generate-checkbox-label--inline">
                <span>Удалить фон</span>
                <input
                  type="checkbox"
                  checked={removeBackground}
                  onChange={(e) => handleRemoveBackgroundChange(e.target.checked)}
                  disabled={isGenerating}
                  className="generate-checkbox"
                />
              </label>
            </div>
            {shouldShowPromptError && (
              <div className="generate-error-inline">
                <span className="generate-error-icon">!</span>
                <span className="tg-error__message">{errorMessage}</span>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="medium"
            onClick={handleGenerate}
            disabled={isDisabled}
            loading={isGenerating}
            className="generate-button-submit"
          >
            {generateLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  // Рендер ошибки (Figma: same layout as idle, red message inside input block + GENERATE 10 ART)
  const renderErrorState = () => (
    <div className="generate-error-container">
      {renderBrandBlock()}
      {renderSourceImageStrip(false)}
      {shouldShowGeneralError && (
        <div className="generate-error-banner">
          <span className="generate-error-icon">!</span>
          <span className="tg-error__message">{errorMessage}</span>
        </div>
      )}
      <div className="generate-form-block">
        <div
          className={cn(
            'generate-input-wrapper',
            hasPromptText && 'generate-input-wrapper--active',
            shouldShowPromptError && 'generate-input-wrapper--error',
          )}
        >
          <textarea
            className={cn('generate-input', shouldShowPromptError && 'generate-input--error')}
            rows={4}
            placeholder="Опишите стикер, например: собака летит на ракете"
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onPaste={handlePromptPaste}
            maxLength={MAX_PROMPT_LENGTH}
            onFocus={handlePromptFocusIn}
            onBlur={handlePromptFocusOut}
          />
          <div className="generate-input-footer">
            {renderStyleSelect(false)}
            {renderEmojiSelect(false)}
            <label className="generate-checkbox-label generate-checkbox-label--inline">
              <span>Удалить фон</span>
              <input
                type="checkbox"
                checked={removeBackground}
                onChange={(e) => handleRemoveBackgroundChange(e.target.checked)}
                className="generate-checkbox"
              />
            </label>
          </div>
          {shouldShowPromptError && (
            <div className="generate-error-inline">
              <span className="generate-error-icon">!</span>
              <span className="tg-error__message">{errorMessage}</span>
            </div>
          )}
        </div>
        <Button
          variant="primary"
          size="medium"
          onClick={handleGenerate}
          disabled={!isFormValid}
          className="generate-button-submit generate-button-retry"
        >
          {generateLabel}
        </Button>
      </div>
    </div>
  );

  // Рендер формы (Figma: Logo → Header → Inpit → Delete background → Style preview → Button)
  const renderIdleState = () => (
    <>
      {renderBrandBlock()}
      {renderSourceImageStrip(isGenerating)}

      <div className="generate-form-block">
        <div className={cn('generate-input-wrapper', hasPromptText && 'generate-input-wrapper--active')}>
          <textarea
            className="generate-input"
            rows={4}
            placeholder="Опишите стикер, например: собака летит на ракете"
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            onPaste={handlePromptPaste}
            maxLength={MAX_PROMPT_LENGTH}
            onFocus={handlePromptFocusIn}
            onBlur={handlePromptFocusOut}
          />
          <div className="generate-input-footer">
            {renderStyleSelect(isGenerating)}
            {renderEmojiSelect(isGenerating)}
            <label className="generate-checkbox-label generate-checkbox-label--inline">
              <span>Удалить фон</span>
              <input
                type="checkbox"
                checked={removeBackground}
                onChange={(e) => handleRemoveBackgroundChange(e.target.checked)}
                disabled={isGenerating}
                className="generate-checkbox"
              />
            </label>
          </div>
        </div>

        <Button
          variant="primary"
          size="medium"
          onClick={handleGenerate}
          disabled={isDisabled}
          loading={isGenerating}
          className="generate-button-submit"
        >
          {isGenerating ? 'Идет генерация...' : generateLabel}
        </Button>
      </div>
    </>
  );

  return (
    <div className={cn('page-container', 'generate-page', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      <button
        type="button"
        className={cn(
          'generate-history-toggle',
          shouldCompactHistoryToggle && 'generate-history-toggle--compact',
          historyHasPreviewImage && 'generate-history-toggle--preview-image',
          historyHasCurrentResultPreview && 'generate-history-toggle--current-preview',
          historyHasStoredResultPreview && !historyHasCurrentResultPreview && 'generate-history-toggle--history-preview'
        )}
        onClick={() => setHistoryOpen((prev) => !prev)}
        aria-label="Открыть историю генераций"
        aria-expanded={historyOpen}
        aria-controls="generate-history-modal"
      >
        <div className="generate-history-toggle__content">
          <span className="generate-history-toggle__title">История</span>
        </div>
        <div className="generate-history-toggle__preview" aria-hidden="true">
          {historyPreviewImage ? (
            <img
              className="generate-history-toggle__preview-image"
              src={historyPreviewImage}
              alt=""
            />
          ) : (
            <span className="generate-history-toggle__preview-fallback">
              {historyPreviewFallback}
            </span>
          )}
        </div>
        {hasActiveHistoryEntry && <span className="generate-history-toggle__dot" />}
      </button>
      {renderHistoryModal()}
      <StixlyPageContainer
        className={cn(
          'generate-inner',
          isCompactState && 'generate-inner--compact',
          isPromptFocused && 'generate-inner--prompt-focused'
        )}
      >
        {pageState === 'idle' && renderIdleState()}
        {pageState === 'uploading' && renderGeneratingState()}
        {pageState === 'generating' && renderGeneratingState()}
        {pageState === 'success' && renderSuccessState()}
        {pageState === 'error' && renderErrorState()}
      </StixlyPageContainer>
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
