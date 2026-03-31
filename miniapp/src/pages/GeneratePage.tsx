import { useEffect, useState, useCallback, useRef, FC, ChangeEvent } from 'react';
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
import {
  clearActiveGenerateHistoryEntry,
  createGenerateHistoryLocalId,
  GenerateHistoryEntry,
  readGenerateHistory,
  upsertGenerateHistoryEntry,
  updateGenerateHistoryEntry,
} from '@/utils/generateHistoryStorage';
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
  
  // Inline-режим параметры из URL
  const [, setInlineQueryId] = useState<string | null>(null);
  const [, setUserId] = useState<string | null>(null);
  
  // Состояние формы
  const [prompt, setPrompt] = useState('');
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<GenerateModelType>('flux-schnell');
  const [selectedEmoji, setSelectedEmoji] = useState('🎨');
  const [removeBackground, setRemoveBackground] = useState<boolean>(false);
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [sourceImageBase64, setSourceImageBase64] = useState<string | null>(null);
  
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
  const historyUserScopeId = effectiveUserId != null ? String(effectiveUserId) : null;

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
    if (!sourceImageFile) {
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

    const uploadResponse = await apiClient.uploadSourceImages([sourceImageFile]);
    uploadedSourceImageIdsRef.current = uploadResponse.imageIds;
    uploadedSourceImageAtRef.current = Date.now();
    return uploadResponse.imageIds;
  }, [sourceImageFile]);

  useEffect(() => {
    syncHistoryEntries();
  }, [syncHistoryEntries]);

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
    startPolling(activeEntry.taskId);
  }, [historyUserScopeId, startPolling]);

  // Обработка отправки формы
  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || trimmedPrompt.length < MIN_PROMPT_LENGTH) {
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
          hasSourceImage: !!sourceImageFile,
          pageState: sourceImageFile ? 'uploading' : 'generating',
          generationStatus: sourceImageFile ? null : 'PROCESSING_PROMPT',
          resultImageUrl: null,
          imageId: null,
          fileId: null,
          errorMessage: null,
          isActive: true,
        };
        setHistoryEntries(upsertGenerateHistoryEntry(historyUserScopeId, baseEntry));
      }

      if (sourceImageFile) {
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
        setErrorKind(sourceImageFile ? 'upload' : 'general');
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
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) {
        setErrorMessage('Не удалось прочитать изображение');
        setErrorKind('upload');
        setPageState('error');
        return;
      }
      setSourceImageFile(file);
      setSourceImageBase64(result);
      uploadedSourceImageIdsRef.current = [];
      uploadedSourceImageAtRef.current = null;
      if (selectedModel !== SOURCE_IMAGE_MODEL) {
        setSelectedModel(SOURCE_IMAGE_MODEL);
        setModelDropdownOpen(false);
      }
      setErrorMessage(null);
      setErrorKind(null);
      if (pageState === 'error') {
        setPageState('idle');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Не удалось загрузить файл');
      setErrorKind('upload');
      setPageState('error');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [pageState, selectedModel]);

  const clearSourceImage = useCallback(() => {
    setSourceImageFile(null);
    setSourceImageBase64(null);
    uploadedSourceImageIdsRef.current = [];
    uploadedSourceImageAtRef.current = null;
  }, []);

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
  const isFormValid = prompt.trim().length >= MIN_PROMPT_LENGTH && prompt.trim().length <= MAX_PROMPT_LENGTH;
  const isGenerating = pageState === 'generating' || pageState === 'uploading';
  const isDisabled = isGenerating || !isFormValid;
  const hasPromptText = prompt.trim().length > 0;
  const hasSourceImage = !!sourceImageFile;

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
    }
  };

  const handleStyleSelect = (presetId: number) => {
    setSelectedStylePresetId((prev) => (prev === presetId ? null : presetId));
    setStyleDropdownOpen(false);
    tg?.HapticFeedback?.impactOccurred('light');
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
              onClick={() => {
                setSelectedEmoji(emoji);
                setEmojiDropdownOpen(false);
                tg?.HapticFeedback?.impactOccurred('light');
              }}
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

  const renderBrandBlock = () => (
    <div className="generate-brand" aria-hidden="true">
      <img
        src={STIXLY_LOGO_ORANGE}
        alt=""
        className="generate-brand-logo"
        loading="eager"
        decoding="async"
      />
    </div>
  );

  const renderSourceImageButton = (disabled: boolean) => (
    <>
      <input
        ref={sourceImageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleSourceImageChange}
      />
      <div className="generate-input-wrapper__pictures-slot">
        <button
          type="button"
          className="generate-input-wrapper__pictures-button"
          onClick={handleSourceImagePick}
          disabled={disabled}
          aria-label={sourceImageFile ? 'Изменить исходное изображение' : 'Добавить исходное изображение'}
        >
          {sourceImageFile ? (
            <img
              src={sourceImageBase64 ?? ''}
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
        {sourceImageFile && (
          <button
            type="button"
            className="generate-source-image-preview__remove"
            onClick={clearSourceImage}
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
                  onChange={(e) => setRemoveBackground(e.target.checked)}
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
                onChange={(e) => setRemoveBackground(e.target.checked)}
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
                onChange={(e) => setRemoveBackground(e.target.checked)}
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
