import { useEffect, useState, useCallback, useRef, FC } from 'react';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { KeyboardArrowDownIcon } from '@/components/ui/Icons';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import './GeneratePage.css';
import { apiClient, GenerationStatus, StylePreset } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { StylePresetStrip } from '@/components/StylePresetStrip';
import { useTelegram } from '@/hooks/useTelegram';
import { t } from '@/i18n/translations';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { buildSwitchInlineQuery, buildFallbackShareUrl } from '@/utils/stickerUtils';
import { SaveToStickerSetModal } from '@/components/SaveToStickerSetModal';
type PageState = 'idle' | 'generating' | 'success' | 'error';
type ErrorKind = 'prompt' | 'upload' | 'general';

const STATUS_MESSAGES: Record<GenerationStatus, string> = {
  PROCESSING_PROMPT: 'Улучшаем описание...',
  PENDING: 'Ожидание...',
  GENERATING: 'Генерируем изображение...',
  REMOVING_BACKGROUND: 'Удаляем фон...',
  COMPLETED: 'Готово!',
  FAILED: 'Ошибка генерации',
  TIMEOUT: 'Превышено время ожидания'
};

const POLLING_INTERVAL = 2500; // 2.5 секунды
const MAX_PROMPT_LENGTH = 1000;
const MIN_PROMPT_LENGTH = 1;

const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

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
  const [removeBackground, setRemoveBackground] = useState<boolean>(true);
  
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
  const shareAfterSaveRef = useRef(false);
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

  // Сброс и повторная попытка
  const handleReset = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setPageState('idle');
    setCurrentStatus(null);
    setTaskId(null);
    setResultImageUrl(null);
    setImageId(null);
    setFileId(null);
    setStickerSaved(false);
    setSaveError(null);
    setErrorMessage(null);
    setErrorKind(null);
    setIsSendingToChat(false);
    // Не очищаем prompt чтобы пользователь мог повторить с тем же текстом
    // Не очищаем inlineQueryId и userId - они нужны для повторной отправки
  };

  const handleSavedFromModal = useCallback((stickerFileId: string) => {
    setFileId(stickerFileId);
    setStickerSaved(true);
    setSaveError(null);
    if (shareAfterSaveRef.current) {
      shareAfterSaveRef.current = false;
      const query = buildSwitchInlineQuery(stickerFileId);
      const fallbackUrl = buildFallbackShareUrl(stickerFileId);
      if (tg?.switchInlineQuery) {
        if (tg.initDataUnsafe?.chat) {
          tg.switchInlineQuery(query);
        } else {
          tg.switchInlineQuery(query, ['users', 'groups', 'channels', 'bots']);
        }
      } else if (tg?.openTelegramLink) {
        tg.openTelegramLink(fallbackUrl);
      } else {
        window.open(fallbackUrl, '_blank');
      }
    }
  }, [tg]);

  const handleShareSticker = () => {
    if (fileId) {
      const query = buildSwitchInlineQuery(fileId);
      const fallbackUrl = buildFallbackShareUrl(fileId);
      if (tg?.switchInlineQuery) {
        if (tg.initDataUnsafe?.chat) {
          tg.switchInlineQuery(query);
        } else {
          tg.switchInlineQuery(query, ['users', 'groups', 'channels', 'bots']);
        }
        return;
      }
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(fallbackUrl);
        return;
      }
      window.open(fallbackUrl, '_blank');
      return;
    }
    shareAfterSaveRef.current = true;
    setSaveModalOpen(true);
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
  const createStickerTitle = t('generate.createStickerWithAI', user?.language_code);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    if (pageState === 'error' && errorKind === 'prompt') {
      setErrorMessage(null);
      setErrorKind(null);
      setPageState('idle');
    }
  };

  const modelOptions: Array<{ id: number | null; name: string }> = [
    { id: null, name: 'Model 1' },
  ];

  const handleModelChange = (rawValue: string) => {
    if (rawValue === 'none') {
      setSelectedStylePresetId(null);
      return;
    }
    const parsed = Number(rawValue);
    setSelectedStylePresetId(Number.isFinite(parsed) ? parsed : null);
  };

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

  // Рендер состояния генерации (Figma: "Please wait..." + форма readonly + CANCEL)
  const renderGeneratingState = () => (
    <>
      <div className="generate-status-container">
        <LoadingSpinner message={currentStatus ? STATUS_MESSAGES[currentStatus] : 'Идет генерация...'} />
      </div>
      <p className="generate-status-header">Пожалуйста, подождите...</p>
      <div className="generate-form-block">
        <div className="generate-input-wrapper">
          <textarea
            className="generate-input generate-input--readonly"
            rows={4}
            readOnly
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <div className="generate-input-footer">
            {renderModelFileRow(true)}
            <label className="generate-checkbox-label generate-checkbox-label--inline">
              <span>Удалить фон</span>
              <input type="checkbox" checked={removeBackground} disabled className="generate-checkbox" readOnly />
            </label>
          </div>
        </div>
        <div className="generate-style-row">
          <StylePresetStrip
            presets={stylePresets}
            selectedPresetId={selectedStylePresetId}
            onPresetChange={() => {}}
            disabled
          />
        </div>
        <Button variant="primary" size="medium" onClick={handleReset} className="generate-button-cancel">
          Отменить
        </Button>
      </div>
    </>
  );

  // Рендер результата (Figma: image → Save → форма readonly → GENERATE 10 ART)
  const renderSuccessState = () => (
    <div className="generate-result-container">
      {renderBrandBlock()}

      <div className="generate-success-section">
        <p className="generate-section-title">Последний результат</p>
        {resultImageUrl && (
          <div className="generate-result-image-wrapper">
            <img
              src={resultImageUrl}
              alt="Сгенерированный стикер"
              className="generate-result-image"
            />
          </div>
        )}

        {stickerSaved ? (
          <span className="generate-sticker-saved">Сохранено в набор</span>
        ) : saveError ? (
          <Text variant="bodySmall" style={{ color: 'var(--color-error)' }} align="center">
            {saveError}
          </Text>
        ) : null}

        <div className="generate-actions">
          {imageId && (
            <Button
              variant="primary"
              size="medium"
              onClick={() => setSaveModalOpen(true)}
              disabled={stickerSaved}
              className="generate-action-button save"
            >
              {stickerSaved ? 'Сохранено в набор' : 'Сохранить набор'}
            </Button>
          )}
          <Button
            variant="primary"
            size="medium"
            onClick={handleShareSticker}
            className="generate-action-button share"
          >
            Сохранить и поделиться
          </Button>
        </div>
      </div>

      <div className="generate-success-section generate-new-request">
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
              maxLength={MAX_PROMPT_LENGTH}
              disabled={isGenerating}
            />
            <div className="generate-input-footer">
              {renderModelFileRow(isGenerating)}
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
                <span className="generate-error-text">{errorMessage}</span>
              </div>
            )}
          </div>

          <div className="generate-style-row">
            <StylePresetStrip
              presets={stylePresets}
              selectedPresetId={selectedStylePresetId}
              onPresetChange={setSelectedStylePresetId}
              disabled={isGenerating}
            />
          </div>

          <Button
            variant="primary"
            size="medium"
            onClick={handleGenerate}
            disabled={isDisabled}
            loading={isGenerating}
            className="generate-button-regenerate"
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
      <p className="generate-header">{createStickerTitle}</p>
      {shouldShowGeneralError && (
        <div className="generate-error-banner">
          <span className="generate-error-icon">!</span>
          <span className="generate-error-text">{errorMessage}</span>
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
            maxLength={MAX_PROMPT_LENGTH}
          />
          <div className="generate-input-footer">
            {renderModelFileRow(false)}
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
              <span className="generate-error-text">{errorMessage}</span>
            </div>
          )}
        </div>
        <div className="generate-style-row">
          <StylePresetStrip
            presets={stylePresets}
            selectedPresetId={selectedStylePresetId}
            onPresetChange={setSelectedStylePresetId}
            disabled={false}
          />
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
      <p className="generate-header">{createStickerTitle}</p>

      <div className="generate-form-block">
        <div className={cn('generate-input-wrapper', hasPromptText && 'generate-input-wrapper--active')}>
          <textarea
            className="generate-input"
            rows={4}
            placeholder="Опишите стикер, например: собака летит на ракете"
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <div className="generate-input-footer">
            {renderModelFileRow(isGenerating)}
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

        <div className="generate-style-row">
          <StylePresetStrip
            presets={stylePresets}
            selectedPresetId={selectedStylePresetId}
            onPresetChange={setSelectedStylePresetId}
            disabled={isGenerating}
          />
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
