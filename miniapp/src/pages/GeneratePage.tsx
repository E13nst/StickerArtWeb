import { useEffect, useState, useCallback, useRef, FC, ChangeEvent, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { KeyboardArrowDownIcon, RestoreIcon } from '@/components/ui/Icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import './GeneratePage.css';
import { apiClient, GenerateModelType, GenerationStatus, StylePreset } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { useTelegram } from '@/hooks/useTelegram';
import { t } from '@/i18n/translations';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { buildSwitchInlineQuery, buildFallbackShareUrl } from '@/utils/stickerUtils';
import { openTelegramUrl } from '@/utils/openTelegramUrl';
import { SaveToStickerSetModal } from '@/components/SaveToStickerSetModal';
import { getAvatarUrl } from '@/utils/avatarUtils';
import {
  clearActiveGenerateHistoryEntry,
  createGenerateHistoryLocalId,
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
const TERMINAL_GENERATION_STATUSES: GenerationStatus[] = ['COMPLETED', 'FAILED', 'TIMEOUT'];
const DEFAULT_GENERATE_MODEL: GenerateModelType = 'nanabanana';
const DEFAULT_GENERATE_EMOJI = '🎨';
const DEFAULT_REMOVE_BACKGROUND = true;
const DEFAULT_STYLE_NAME = 'telegram';
const TELEGRAM_AVATAR_DISMISSED_STORAGE_KEY = 'generate_telegram_avatar_dismissed';

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

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';
const STIXLY_LOGO_ORANGE = `${BASE}assets/stixly-logo-orange.webp`;
const MODEL_OPTIONS: Array<{ id: GenerateModelType; name: string }> = [
  { id: 'flux-schnell', name: 'Stixly' },
  { id: 'nanabanana', name: 'Nano 🍌' },
];
const SOURCE_IMAGE_MODEL: GenerateModelType = 'nanabanana';
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [historyEntries, setHistoryEntries] = useState<GenerateHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  
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
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement | null>(null);
  const [emojiDropdownOpen, setEmojiDropdownOpen] = useState(false);
  const emojiDropdownRef = useRef<HTMLDivElement | null>(null);
  const promptFocusTimeoutRef = useRef<number | null>(null);
  const sourceImageInputRef = useRef<HTMLInputElement | null>(null);
  const uploadedSourceImageIdsRef = useRef<string[]>([]);
  const uploadedSourceImageAtRef = useRef<number | null>(null);
  const pollingStartedAtRef = useRef<number | null>(null);
  const activeHistoryLocalIdRef = useRef<string | null>(null);
  const restoreAppliedRef = useRef(false);
  const preferencesAppliedRef = useRef(false);
  const avatarAutofillAppliedRef = useRef<string | null>(null);
  const processedAvatarTriggerRef = useRef<string | null>(null);

  // При фокусе на поле промпта — скрываем navbar, убираем сдвиг контента при появлении клавиатуры
  const handlePromptFocusIn = useCallback((e: React.FocusEvent) => {
    if ((e.target as HTMLElement)?.classList?.contains?.('generate-input')) {
      if (promptFocusTimeoutRef.current) {
        clearTimeout(promptFocusTimeoutRef.current);
        promptFocusTimeoutRef.current = null;
      }
      document.body.classList.add('generate-prompt-focused');
    }
  }, []);

  const handlePromptFocusOut = useCallback((e: React.FocusEvent) => {
    if ((e.target as HTMLElement)?.classList?.contains?.('generate-input')) {
      promptFocusTimeoutRef.current && clearTimeout(promptFocusTimeoutRef.current);
      promptFocusTimeoutRef.current = window.setTimeout(() => {
        document.body.classList.remove('generate-prompt-focused');
        promptFocusTimeoutRef.current = null;
      }, 250);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (promptFocusTimeoutRef.current) {
        clearTimeout(promptFocusTimeoutRef.current);
        promptFocusTimeoutRef.current = null;
      }
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

  const effectiveUserId = userInfo?.telegramId ?? userInfo?.id ?? user?.id ?? null;
  const telegramUserId = user?.id ?? null;
  const telegramPhotoUrl = user?.photo_url ?? null;
  const profileAvatarUrl = useMemo(() => {
    if (!isProfileFromAuthenticatedApi || !userInfo) return null;
    if (userInfo.avatarUrl) return userInfo.avatarUrl;
    return getAvatarUrl(userInfo.id, userInfo.profilePhotoFileId, userInfo.profilePhotos, 160) ?? null;
  }, [isProfileFromAuthenticatedApi, userInfo]);
  const effectiveAvatarUrl = telegramPhotoUrl || profileAvatarUrl;
  const avatarTriggerToken = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('avatar');
  }, [location.search]);
  const historyUserScopeId = effectiveUserId != null ? String(effectiveUserId) : null;

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

  const getDefaultStylePresetId = useCallback((): number | null => {
    const telegramPreset = stylePresets.find(
      (preset) => stripPresetName(preset.name).trim().toLowerCase() === DEFAULT_STYLE_NAME
    );
    return telegramPreset?.id ?? null;
  }, [stylePresets]);

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
    const hasPendingAvatarTrigger =
      avatarTriggerToken != null && processedAvatarTriggerRef.current !== avatarTriggerToken;
    const canAutofill =
      telegramUserId != null &&
      typeof effectiveAvatarUrl === 'string' &&
      effectiveAvatarUrl.length > 0 &&
      (hasPendingAvatarTrigger || (!telegramAvatarDismissed && sourceImageFiles.length === 0));

    if (!canAutofill) {
      return;
    }

    if (hasPendingAvatarTrigger) {
      processedAvatarTriggerRef.current = avatarTriggerToken;
    }

    const autofillKey = `${telegramUserId}:${effectiveAvatarUrl}:${hasPendingAvatarTrigger ? avatarTriggerToken : 'default'}`;
    if (avatarAutofillAppliedRef.current === autofillKey) {
      return;
    }
    avatarAutofillAppliedRef.current = autofillKey;

    const abortController = new AbortController();

    (async () => {
      try {
        const response = await fetch(effectiveAvatarUrl, {
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`AVATAR_FETCH_FAILED_${response.status}`);
        }

        const blob = await response.blob();
        const mimeType = (blob.type || '').toLowerCase();
        const looksLikeSvg = mimeType.includes('svg') || /\.svg(?:$|[?#])/i.test(effectiveAvatarUrl);
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
        uploadedSourceImageIdsRef.current = [];
        uploadedSourceImageAtRef.current = null;
        setErrorMessage(null);
        setErrorKind(null);

        if (selectedModel !== SOURCE_IMAGE_MODEL) {
          setSelectedModel(SOURCE_IMAGE_MODEL);
          persistGeneratePreferences({ selectedModel: SOURCE_IMAGE_MODEL });
          setModelDropdownOpen(false);
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
    persistGeneratePreferences,
    selectedModel,
    sourceImageFiles.length,
    telegramAvatarDismissed,
    avatarTriggerToken,
    effectiveAvatarUrl,
    telegramUserId,
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
    setSelectedModel(activeEntry.model);
    setSelectedStylePresetId(activeEntry.stylePresetId);
    setSelectedEmoji(activeEntry.selectedEmoji);
    setRemoveBackground(activeEntry.removeBackground);
    setTaskId(activeEntry.taskId);
    setCurrentStatus(activeEntry.generationStatus ?? 'PENDING');
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
      setSelectedModel(savedPreferences.selectedModel);
      setSelectedStylePresetId(savedPreferences.stylePresetId);
      setSelectedEmoji(savedPreferences.selectedEmoji);
      setRemoveBackground(savedPreferences.removeBackground);
      preferencesAppliedRef.current = true;
      return;
    }

    if (stylePresets.length === 0) return;

    setSelectedModel(DEFAULT_GENERATE_MODEL);
    setSelectedStylePresetId(getDefaultStylePresetId());
    setSelectedEmoji(DEFAULT_GENERATE_EMOJI);
    setRemoveBackground(DEFAULT_REMOVE_BACKGROUND);
    preferencesAppliedRef.current = true;
  }, [getDefaultStylePresetId, historyUserScopeId, stylePresets]);

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

  const handleSourceImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    (async () => {
      try {
        const previews = await Promise.all(files.map((file) => blobToDataUrl(file)));
        setSourceImageFiles((prev) => [...prev, ...files]);
        setSourceImagePreviews((prev) => [...prev, ...previews]);
        setSourceImageOrigin('manual');
        uploadedSourceImageIdsRef.current = [];
        uploadedSourceImageAtRef.current = null;
        if (selectedModel !== SOURCE_IMAGE_MODEL) {
          setSelectedModel(SOURCE_IMAGE_MODEL);
          persistGeneratePreferences({ selectedModel: SOURCE_IMAGE_MODEL });
          setModelDropdownOpen(false);
        }
        setErrorMessage(null);
        setErrorKind(null);
        if (pageState === 'error') {
          setPageState('idle');
        }
      } catch {
        setErrorMessage('Не удалось загрузить файл');
        setErrorKind('upload');
        setPageState('error');
      }
    })();
    event.target.value = '';
  }, [pageState, persistGeneratePreferences, selectedModel]);

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

  const openChatPicker = useCallback((stickerFileId: string) => {
    const query = buildSwitchInlineQuery(stickerFileId);
    const fallbackUrl = buildFallbackShareUrl(stickerFileId);

    const isIos = tg?.platform === 'ios' || tg?.platform === 'iphone' || tg?.platform === 'ipad';

    if (tg?.switchInlineQuery) {
      if (tg.initDataUnsafe?.chat) {
        // Уже в чате — переключаем inline query в текущем чате
        tg.switchInlineQuery(query);
        return;
      }
      if (isIos) {
        // iOS: switchInlineQuery с choose_chat ненадёжен до mid-2025 версий Telegram
        // openTelegramLink надёжно открывает нативный шаринг внутри приложения
        openTelegramUrl(fallbackUrl, tg);
        return;
      }
      // Desktop и Android: нативный пикер чатов через switchInlineQuery
      tg.switchInlineQuery(query, ['users', 'groups', 'channels', 'bots']);
      return;
    }

    if (tg?.openTelegramLink) {
      openTelegramUrl(fallbackUrl, tg);
      return;
    }
    openTelegramUrl(fallbackUrl, tg);
  }, [tg]);

  const handleSavedFromModal = useCallback((stickerFileId?: string | null) => {
    if (stickerFileId) {
      setFileId(stickerFileId);
      patchHistoryEntry(
        { taskId: taskId ?? undefined, localId: activeHistoryLocalIdRef.current ?? undefined },
        { fileId: stickerFileId }
      );
    }
    setStickerSaved(true);
    setSaveError(null);
  }, [patchHistoryEntry, taskId]);

  const handleOpenSaveModal = useCallback(() => {
    setSaveError(null);
    setSaveModalOpen(true);
  }, []);

  const handleCloseSaveModal = useCallback(() => {
    setSaveModalOpen(false);
  }, []);

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

      const defaultSetName = buildDefaultStickerSetName({
        username: userInfo?.username ?? user?.username ?? null,
        firstName: userInfo?.firstName ?? user?.first_name ?? null,
        userId: effectiveUserId,
      });
      const defaultSetTitle = buildDefaultStickerSetTitle({
        username: userInfo?.username ?? user?.username ?? null,
        firstName: userInfo?.firstName ?? user?.first_name ?? null,
        lastName: userInfo?.lastName ?? user?.last_name ?? null,
        userId: effectiveUserId,
      });

      const response = await apiClient.saveToStickerSetV2({
        taskId,
        userId: effectiveUserId,
        name: defaultSetName,
        title: defaultSetTitle,
        emoji: selectedEmoji,
        wait_timeout_sec: SAVE_TO_SET_WAIT_TIMEOUT_SEC,
      });

      if (response.status === '202' || response.status === 'PENDING') {
        throw new Error('Стикер ещё не готов для сохранения. Попробуйте снова через пару секунд.');
      }

      const savedFileId = response.stickerFileId ?? null;
      setStickerSaved(true);

      if (savedFileId) {
        setFileId(savedFileId);
        patchHistoryEntry(
          { taskId: taskId ?? undefined, localId: activeHistoryLocalIdRef.current ?? undefined },
          { fileId: savedFileId }
        );
        openChatPicker(savedFileId);
        return;
      }

      const message = 'Стикер сохранён в дефолтный пак, но Telegram fileId пока не вернулся. Попробуйте нажать "Поделиться" ещё раз.';
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

  const openHistoryEntry = (entry: GenerateHistoryEntry) => {
    setHistoryOpen(false);
    setPrompt(entry.prompt);
    setSelectedModel(entry.model);
    setSelectedStylePresetId(entry.stylePresetId);
    setSelectedEmoji(entry.selectedEmoji);
    setRemoveBackground(entry.removeBackground);
    setTaskId(entry.taskId);
    setCurrentStatus(entry.generationStatus);
    setResultImageUrl(entry.resultImageUrl);
    setImageId(entry.imageId);
    setFileId(entry.fileId);
    setStickerSaved(Boolean(entry.fileId));
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

  const createStickerPrefix = t('generate.createStickerPrefix', user?.language_code);

  const renderHeaderWithModel = (disabled: boolean) => (
    <div className="generate-header">
      <span>{createStickerPrefix}</span>
      {renderModelFileRow(disabled)}
    </div>
  );

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (pageState === 'error' && errorKind === 'prompt') {
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('idle');
    }
  };

  const handleModelChange = (rawValue: string) => {
    if (rawValue === 'flux-schnell' || rawValue === 'nanabanana') {
      if (hasSourceImage && rawValue !== SOURCE_IMAGE_MODEL) {
        return;
      }
      setSelectedModel(rawValue);
      persistGeneratePreferences({ selectedModel: rawValue });
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
    if (!modelDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [modelDropdownOpen]);

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

  const renderModelFileRow = (disabled: boolean) => {
    const selectedOption = MODEL_OPTIONS.find((option) => option.id === selectedModel) ?? MODEL_OPTIONS[0];
    return (
      <div ref={modelDropdownRef} className="generate-model-select-wrap">
        <button
          type="button"
          className="generate-model-select-trigger"
          onClick={() => !disabled && setModelDropdownOpen(v => !v)}
          disabled={disabled}
          aria-label="Выбор модели генерации"
          aria-expanded={modelDropdownOpen}
        >
          <span className="generate-model-select-value">{selectedOption.name}</span>
          <KeyboardArrowDownIcon
            size={14}
            color="var(--color-text-secondary)"
            style={{ transform: modelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>
        {modelDropdownOpen && (
          <div className="generate-model-select-dropdown">
            {MODEL_OPTIONS.map((option) => {
              const isOptionDisabled = hasSourceImage && option.id !== SOURCE_IMAGE_MODEL;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'generate-model-select-option',
                    option.id === selectedModel && 'generate-model-select-option--selected',
                    isOptionDisabled && 'generate-model-select-option--disabled',
                  )}
                  onClick={() => {
                    if (isOptionDisabled) {
                      return;
                    }
                    handleModelChange(option.id);
                    setModelDropdownOpen(false);
                  }}
                  disabled={isOptionDisabled}
                >
                  {option.name}
                  {isOptionDisabled ? ' · без фото' : ''}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
    <div ref={styleDropdownRef} className="generate-model-select-wrap">
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
        <div className="generate-model-select-dropdown">
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

  const renderSourceImageButton = (disabled: boolean) => (
    <>
      <input
        ref={sourceImageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleSourceImageChange}
      />
      <div className="generate-input-wrapper__pictures-slot">
        <button
          type="button"
          className={cn(
            'generate-input-wrapper__pictures-button',
            hasSourceImage && 'generate-input-wrapper__pictures-button--with-preview'
          )}
          onClick={handleSourceImagePick}
          disabled={disabled}
          aria-label={hasSourceImage ? 'Добавить ещё исходные изображения' : 'Добавить исходные изображения'}
        >
          {hasSourceImage ? (
            <img
              src={primarySourcePreview ?? ''}
              alt="Исходное изображение"
              className="generate-input-wrapper__pictures-preview"
            />
          ) : (
            <img
              src={`${BASE}assets/pictures-icon.svg`}
              alt=""
              className="generate-input-wrapper__pictures-icon"
              aria-hidden="true"
            />
          )}
        </button>
        {hasSourceImage && (
          sourceImageFiles.length > 1 && (
            <span className="generate-input-wrapper__pictures-count" aria-label={`Прикреплено ${sourceImageFiles.length} изображений`}>
              +{sourceImageFiles.length - 1}
            </span>
          )
        )}
        {hasSourceImage && (
          <button
            type="button"
            className="generate-source-image-preview__remove"
            onClick={() => clearSourceImage({ markAvatarDismissed: sourceImageOrigin === 'telegram-avatar' })}
            disabled={disabled}
            aria-label="Удалить исходное изображение"
          >
            ×
          </button>
        )}
      </div>
    </>
  );

  // Рендер состояния генерации: спиннер с сообщением "Подождите", форма readonly, кнопка в стиле submit с текстом "Подождите"
  const renderGeneratingState = () => (
    <>
      <div className="generate-status-container">
        <LoadingSpinner message={getGeneratingSpinnerMessage(pageState, currentStatus)} />
      </div>
      <div className="generate-form-block">
        <div className="generate-input-wrapper">
          {renderSourceImageButton(true)}
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
        <Button variant="primary" size="medium" disabled className="generate-button-submit">
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
              disabled={stickerSaved}
              className="generate-action-button save"
            >
              Сохранить
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
      </div>

      <div className="generate-success-section generate-new-request">
        {renderHeaderWithModel(isGenerating)}
        <div className="generate-form-block">
          <div
            className={cn(
              'generate-input-wrapper',
              hasPromptText && 'generate-input-wrapper--active',
              shouldShowPromptError && 'generate-input-wrapper--error',
            )}
          >
            {renderSourceImageButton(isGenerating)}
            <textarea
              className={cn('generate-input', shouldShowPromptError && 'generate-input--error')}
              rows={4}
              placeholder="Опишите стикер, например: собака летит на ракете"
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
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
      {renderHeaderWithModel(false)}
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
          {renderSourceImageButton(false)}
          <textarea
            className={cn('generate-input', shouldShowPromptError && 'generate-input--error')}
            rows={4}
            placeholder="Опишите стикер, например: собака летит на ракете"
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
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
      {renderHeaderWithModel(isGenerating)}

      <div className="generate-form-block">
        <div className={cn('generate-input-wrapper', hasPromptText && 'generate-input-wrapper--active')}>
          {renderSourceImageButton(isGenerating)}
          <textarea
            className="generate-input"
            rows={4}
            placeholder="Опишите стикер, например: собака летит на ракете"
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
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
        className="generate-history-toggle"
        onClick={() => setHistoryOpen((prev) => !prev)}
        aria-label="Открыть историю генераций"
      >
        <RestoreIcon size={18} />
        {historyEntries.some((entry) => entry.isActive) && <span className="generate-history-toggle__dot" />}
      </button>
      {historyOpen && (
        <>
          <button
            type="button"
            className="generate-history-backdrop"
            onClick={() => setHistoryOpen(false)}
            aria-label="Закрыть историю генераций"
          />
          <aside className="generate-history-panel" aria-label="История генераций">
            <div className="generate-history-panel__title">История генераций</div>
            {historyEntries.length === 0 && (
              <div className="generate-history-panel__empty">Пока нет сохраненных генераций</div>
            )}
            {historyEntries.map((entry) => (
              <button
                key={entry.localId}
                type="button"
                className={cn('generate-history-item', entry.isActive && 'generate-history-item--active')}
                onClick={() => openHistoryEntry(entry)}
              >
                <div className="generate-history-item__main">
                  <div className="generate-history-item__top">
                    <span className="generate-history-item__time">
                      {new Date(entry.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="generate-history-item__status">{formatHistoryStatus(entry)}</span>
                  </div>
                  <div className="generate-history-item__prompt">{entry.prompt}</div>
                </div>
                {entry.resultImageUrl && (
                  <img className="generate-history-item__preview" src={entry.resultImageUrl} alt="" aria-hidden="true" />
                )}
              </button>
            ))}
          </aside>
        </>
      )}
      <StixlyPageContainer className={cn('generate-inner', isCompactState && 'generate-inner--compact')}>
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
        onSaved={handleSavedFromModal}
      />
    </div>
  );
};

export default GeneratePage;
