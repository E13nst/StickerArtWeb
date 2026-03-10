import { useEffect, useState, useCallback, useRef, FC } from 'react';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { KeyboardArrowDownIcon } from '@/components/ui/Icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import './GeneratePage.css';
import { apiClient, GenerationStatus, StylePreset } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { useTelegram } from '@/hooks/useTelegram';
import { t } from '@/i18n/translations';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { buildSwitchInlineQuery, buildFallbackShareUrl } from '@/utils/stickerUtils';
import { SaveToStickerSetModal } from '@/components/SaveToStickerSetModal';
type PageState = 'idle' | 'generating' | 'success' | 'error';
type ErrorKind = 'prompt' | 'upload' | 'general';


/** Сообщение для tg-spinner__message: сначала "Улучшаем промпт", потом "Создаем шедевр" */
const getGeneratingSpinnerMessage = (status: GenerationStatus | null): string => {
  if (status === 'GENERATING' || status === 'REMOVING_BACKGROUND') return 'Создаем шедевр';
  return 'Улучшаем промпт'; // PROCESSING_PROMPT, PENDING, null и остальные
};

const POLLING_INTERVAL = 2500; // 2.5 секунды
const MAX_PROMPT_LENGTH = 1000;
const MIN_PROMPT_LENGTH = 1;

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

const stripPresetName = (name: string) =>
  name.replace(/\s*Sticker\s*/gi, ' ').replace(/\s*Style\s*/gi, ' ').replace(/\s+/g, ' ').trim();

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';
const STIXLY_LOGO_ORANGE = `${BASE}assets/stixly-logo-orange.webp`;

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
  const [removeBackground, setRemoveBackground] = useState<boolean>(false);
  
  // Состояние генерации
  const [pageState, setPageState] = useState<PageState>('idle');
  const [currentStatus, setCurrentStatus] = useState<GenerationStatus | null>(null);
  const [, setTaskId] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [stickerSaved, setStickerSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [, setIsSendingToChat] = useState(false);
  
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
  const promptFocusTimeoutRef = useRef<number | null>(null);

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
    };
  }, []);

  // Polling статуса генерации
  const startPolling = useCallback((taskIdToCheck: string) => {
    // Очищаем предыдущий интервал
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const poll = async () => {
      try {
        const statusData = await apiClient.getGenerationStatus(taskIdToCheck);
        setCurrentStatus(statusData.status);

        if (statusData.status === 'COMPLETED') {
          // Успешное завершение
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setResultImageUrl(statusData.imageUrl || null);
          setImageId(statusData.imageId || null);
          // Сохраняем fileId для последующей отправки боту
          const receivedFileId = statusData.telegramSticker?.fileId || null;
          setFileId(receivedFileId);
          setStickerSaved(!!receivedFileId);
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
          setErrorMessage(
            statusData.errorMessage || 
            (statusData.status === 'TIMEOUT' ? 'Превышено время ожидания' : 'Произошла ошибка при генерации')
          );
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
  }, [refreshMyProfile]);

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

    setPageState('generating');
    setCurrentStatus('PROCESSING_PROMPT');
    setErrorMessage(null);
    setErrorKind(null);
    setResultImageUrl(null);
    setImageId(null);
    setStickerSaved(false);
    setSaveError(null);

    try {
      const response = await apiClient.generateSticker({
        prompt: trimmedPrompt,
        stylePresetId: selectedStylePresetId,
        removeBackground: removeBackground
      });
      
      setTaskId(response.taskId);
      startPolling(response.taskId);
    } catch (error: any) {
      let message = 'Не удалось запустить генерацию';
      
      if (error.message === 'INSUFFICIENT_BALANCE') {
        message = 'Недостаточно ART-баллов';
        setErrorKind('general');
      } else if (error.message === 'INVALID_PROMPT') {
        message = 'Неверное описание';
        setErrorKind('prompt');
      } else if (error.message === 'UNAUTHORIZED') {
        message = 'Требуется авторизация';
        setErrorKind('general');
      } else if (typeof error.message === 'string' && error.message.toLowerCase().includes('upload')) {
        message = 'Не удалось загрузить файл';
        setErrorKind('upload');
      } else if (error.message) {
        message = error.message;
        setErrorKind('general');
      }
      
      setErrorMessage(message);
      setPageState('error');
    }
  };


  const handleSavedFromModal = useCallback((stickerFileId: string) => {
    setFileId(stickerFileId);
    setStickerSaved(true);
    setSaveError(null);
  }, []);

  const [isSavingAndSharing, setIsSavingAndSharing] = useState(false);

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
        if (tg.openTelegramLink) {
          tg.openTelegramLink(fallbackUrl);
          return;
        }
      }
      // Desktop и Android: нативный пикер чатов через switchInlineQuery
      tg.switchInlineQuery(query, ['users', 'groups', 'channels', 'bots']);
      return;
    }

    if (tg?.openTelegramLink) {
      tg.openTelegramLink(fallbackUrl);
      return;
    }
    window.open(fallbackUrl, '_blank');
  }, [tg]);

  const handleShareSticker = async () => {
    if (fileId) {
      openChatPicker(fileId);
      return;
    }
    if (!imageId) return;

    setIsSavingAndSharing(true);
    setSaveError(null);
    try {
      const res = await apiClient.saveImageToStickerSet({
        imageUuid: imageId,
        emoji: '🎨',
      });
      setFileId(res.stickerFileId);
      setStickerSaved(true);
      openChatPicker(res.stickerFileId);
    } catch (e: any) {
      setSaveError(e?.message ?? 'Не удалось сохранить стикер');
    } finally {
      setIsSavingAndSharing(false);
    }
  };

  // Валидация формы
  const isFormValid = prompt.trim().length >= MIN_PROMPT_LENGTH && prompt.trim().length <= MAX_PROMPT_LENGTH;
  const isGenerating = pageState === 'generating';
  const isDisabled = isGenerating || !isFormValid;
  const hasPromptText = prompt.trim().length > 0;

  const generateLabel = generateCost != null ? `Сгенерировать ${generateCost} ART` : 'Сгенерировать 10 ART';
  const shouldShowPromptError = errorKind === 'prompt' && !!errorMessage;
  const shouldShowGeneralError = errorMessage && errorKind !== 'prompt';
  const isCompactState = pageState !== 'success';
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

  const modelOptions: Array<{ id: number | null; name: string }> = [
    { id: null, name: 'Stixly' },
  ];

  const handleModelChange = (rawValue: string) => {
    if (rawValue === 'none') {
      setSelectedStylePresetId(null);
      return;
    }
    const parsed = Number(rawValue);
    setSelectedStylePresetId(Number.isFinite(parsed) ? parsed : null);
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

  const renderModelFileRow = (disabled: boolean) => {
    const selectedOption = modelOptions.find(o => o.id === selectedStylePresetId || (o.id == null && selectedStylePresetId == null))
      ?? modelOptions[0];
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
            {modelOptions.map((option) => (
              <button
                key={option.id ?? 'none'}
                type="button"
                className={cn('generate-model-select-option', (option.id === selectedStylePresetId || (option.id == null && selectedStylePresetId == null)) && 'generate-model-select-option--selected')}
                onClick={() => {
                  handleModelChange(option.id == null ? 'none' : String(option.id));
                  setModelDropdownOpen(false);
                }}
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

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

  // Рендер состояния генерации: спиннер с сообщением "Подождите", форма readonly, кнопка в стиле submit с текстом "Подождите"
  const renderGeneratingState = () => (
    <>
      <div className="generate-status-container">
        <LoadingSpinner message={getGeneratingSpinnerMessage(currentStatus)} />
      </div>
      <div className="generate-form-block">
        <div className="generate-input-wrapper">
          <img src={`${BASE}assets/pictures-icon.svg`} alt="" className="generate-input-wrapper__pictures-icon" aria-hidden="true" />
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
          {imageId && (
            <Button
              variant="primary"
              size="medium"
              onClick={() => setSaveModalOpen(true)}
              disabled={stickerSaved}
              className="generate-action-button save"
            >
              {stickerSaved ? 'Сохранено в пак' : 'Сохранить в пак'}
            </Button>
          )}
          <Button
            variant="primary"
            size="medium"
            onClick={handleShareSticker}
            disabled={isSavingAndSharing}
            loading={isSavingAndSharing}
            className="generate-action-button share"
          >
            {isSavingAndSharing ? 'Сохраняем...' : 'Поделиться'}
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
            <img src={`${BASE}assets/pictures-icon.svg`} alt="" className="generate-input-wrapper__pictures-icon" aria-hidden="true" />
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
          <img src={`${BASE}assets/pictures-icon.svg`} alt="" className="generate-input-wrapper__pictures-icon" aria-hidden="true" />
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
          <img src={`${BASE}assets/pictures-icon.svg`} alt="" className="generate-input-wrapper__pictures-icon" aria-hidden="true" />
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
      <StixlyPageContainer className={cn('generate-inner', isCompactState && 'generate-inner--compact')}>
        {pageState === 'idle' && renderIdleState()}
        {pageState === 'generating' && renderGeneratingState()}
        {pageState === 'success' && renderSuccessState()}
        {pageState === 'error' && renderErrorState()}
      </StixlyPageContainer>
      <SaveToStickerSetModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        imageUrl={resultImageUrl}
        imageId={imageId}
        onSaved={handleSavedFromModal}
      />
    </div>
  );
};

export default GeneratePage;
