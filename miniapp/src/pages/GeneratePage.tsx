import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import './GeneratePage.css';
import { apiClient, GenerationStatus, StylePreset } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { StylePresetStrip } from '@/components/StylePresetStrip';
import { useTelegram } from '@/hooks/useTelegram';
import { OtherAccountBackground } from '@/components/OtherAccountBackground';
import { StixlyPageContainer } from '@/components/layout/StixlyPageContainer';
import { 
  buildSwitchInlineQuery,
  buildFallbackShareUrl, 
  removeInvisibleChars,
  isValidTelegramFileId,
  getPlatformInfo
} from '@/utils/stickerUtils';

type PageState = 'idle' | 'generating' | 'success' | 'error';

const STATUS_MESSAGES: Record<GenerationStatus, string> = {
  PROCESSING_PROMPT: '🤖 Улучшаем промпт...',
  PENDING: 'Ожидание...',
  GENERATING: '🎨 Генерируем изображение...',
  REMOVING_BACKGROUND: '✂️ Удаляем фон...',
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

export const GeneratePage: React.FC = () => {
  // Telegram WebApp SDK
  const { tg, isInTelegramApp } = useTelegram();
  
  // Inline-режим параметры из URL
  const [inlineQueryId, setInlineQueryId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Состояние формы
  const [prompt, setPrompt] = useState('');
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<number | null>(null);
  const [removeBackground, setRemoveBackground] = useState<boolean>(true);
  
  // Состояние генерации
  const [pageState, setPageState] = useState<PageState>('idle');
  const [currentStatus, setCurrentStatus] = useState<GenerationStatus | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [stickerSaved, setStickerSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingToChat, setIsSendingToChat] = useState(false);
  
  // Тарифы
  const [generateCost, setGenerateCost] = useState<number | null>(null);
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(true);
  
  // Баланс пользователя
  const userInfo = useProfileStore((state) => state.userInfo);
  const setUserInfo = useProfileStore((state) => state.setUserInfo);
  const [artBalance, setArtBalance] = useState<number | null>(userInfo?.artBalance ?? null);
  
  // Polling ref
  const pollingIntervalRef = useRef<number | null>(null);
  
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
    if (!prompt.trim() || prompt.length < MIN_PROMPT_LENGTH || prompt.length > MAX_PROMPT_LENGTH) {
      return;
    }

    setPageState('generating');
    setCurrentStatus('PROCESSING_PROMPT');
    setErrorMessage(null);
    setResultImageUrl(null);
    setImageId(null);
    setStickerSaved(false);
    setSaveError(null);

    try {
      const response = await apiClient.generateSticker({
        prompt: prompt.trim(),
        stylePresetId: selectedStylePresetId,
        removeBackground: removeBackground
      });
      
      setTaskId(response.taskId);
      startPolling(response.taskId);
    } catch (error: any) {
      let message = 'Не удалось запустить генерацию';
      
      if (error.message === 'INSUFFICIENT_BALANCE') {
        message = 'Недостаточно ART-баллов';
      } else if (error.message === 'INVALID_PROMPT') {
        message = 'Неверный промпт';
      } else if (error.message === 'UNAUTHORIZED') {
        message = 'Требуется авторизация';
      } else if (error.message) {
        message = error.message;
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
    setIsSaving(false);
    setSaveError(null);
    setErrorMessage(null);
    setIsSendingToChat(false);
    // Не очищаем prompt чтобы пользователь мог повторить с тем же текстом
    // Не очищаем inlineQueryId и userId - они нужны для повторной отправки
  };

  // Генерация еще раз (очищаем всё включая prompt)
  const handleGenerateAnother = () => {
    handleReset();
    setPrompt('');
    setSelectedStylePresetId(null);
    setRemoveBackground(true);
  };

  // Сохранение стикера в стикерсет
  const handleSaveToStickerSet = async () => {
    if (!imageId || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await apiClient.saveImageToStickerSet({
        imageUuid: imageId,
        stickerSetName: null,
        emoji: '🎨'
      });
      
      // Обновляем fileId из ответа, если он есть
      if (response.stickerFileId) {
        setFileId(response.stickerFileId);
        console.log('✅ Получен stickerFileId из ответа сохранения:', response.stickerFileId);
      }
      
      setStickerSaved(true);
    } catch (error: any) {
      let message = 'Не удалось сохранить стикер';
      
      if (error.message?.includes('полон') || error.message?.includes('120')) {
        message = 'Стикерсет полон. Максимум 120 стикеров в одном наборе';
      } else if (error.message?.includes('не найдено') || error.message?.includes('404')) {
        message = 'Изображение не найдено';
      } else if (error.message) {
        message = error.message;
      }
      
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Отправка результата обратно боту через sendData (для inline режима)
  const handleSendToChat = async () => {
    if (!inlineQueryId || !tg) {
      console.warn('⚠️ Недостаточно данных для отправки:', { inlineQueryId, hasTg: !!tg });
      setErrorMessage('Недостаточно данных для отправки стикера в чат');
      return;
    }

    // Если нет imageId, не можем сохранить
    if (!imageId) {
      console.warn('⚠️ Нет imageId для сохранения');
      setErrorMessage('Стикер еще не готов для отправки');
      return;
    }

    setIsSendingToChat(true);
    setErrorMessage(null);

    try {
      let stickerFileId = fileId;

      // Если fileId еще нет, сначала сохраняем стикер
      if (!stickerFileId) {
        console.log('💾 Сохранение стикера перед отправкой...');
        const saveResponse = await apiClient.saveImageToStickerSet({
          imageUuid: imageId,
          stickerSetName: null,
          emoji: '🎨'
        });

        stickerFileId = saveResponse.stickerFileId;
        if (!stickerFileId) {
          throw new Error('Не получен stickerFileId из ответа сохранения');
        }

        // Обновляем локальное состояние
        setFileId(stickerFileId);
        setStickerSaved(true);
        console.log('✅ Стикер сохранен, получен stickerFileId:', stickerFileId);
      }

      const dataToSend = {
        file_id: stickerFileId,
        inline_query_id: inlineQueryId
      };

      console.log('📤 Отправка данных боту через sendData:', dataToSend);
      tg.sendData(JSON.stringify(dataToSend));
      
      // Опционально: закрыть MiniApp после отправки
      // Можно раскомментировать, если нужно автоматически закрывать
      // setTimeout(() => {
      //   tg.close();
      // }, 500);
      
      console.log('✅ Данные успешно отправлены боту');
    } catch (error: any) {
      console.error('❌ Ошибка отправки результата боту:', error);
      let message = 'Не удалось отправить стикер в чат';
      
      if (error.message?.includes('полон') || error.message?.includes('120')) {
        message = 'Стикерсет полон. Максимум 120 стикеров в одном наборе';
      } else if (error.message?.includes('не найдено') || error.message?.includes('404')) {
        message = 'Изображение не найдено';
      } else if (error.message) {
        message = error.message;
      }
      
      setErrorMessage(message);
    } finally {
      setIsSendingToChat(false);
    }
  };

  // Отправить стикер в чат (открыть выбор чата с предзаполненным текстом)
  // Стикер всегда сохраняется перед отправкой, чтобы гарантированно получить file_id
  const handleShareSticker = async () => {
    if (!tg) {
      console.warn('⚠️ Telegram WebApp недоступен');
      setErrorMessage('Telegram WebApp недоступен');
      return;
    }

    // Проверяем, что есть либо fileId, либо imageId для сохранения
    if (!fileId && !imageId) {
      console.warn('⚠️ Нет данных для отправки стикера:', { fileId, imageId });
      setErrorMessage('Стикер еще не готов для отправки');
      return;
    }

    setIsSendingToChat(true);
    setErrorMessage(null);

    try {
      let stickerFileId = fileId;

      // ВАЖНО: Если fileId еще нет, обязательно сохраняем стикер в стикерсет для получения file_id
      // Это необходимо для подстановки file_id в инлайн сообщение "@stixlybot [StickerFileId]"
      if (!stickerFileId && imageId) {
        console.log('💾 Сохранение стикера перед отправкой для получения file_id...');
        const saveResponse = await apiClient.saveImageToStickerSet({
          imageUuid: imageId,
          stickerSetName: null,
          emoji: '🎨'
        });

        stickerFileId = saveResponse.stickerFileId;
        if (!stickerFileId) {
          throw new Error('Не получен stickerFileId из ответа сохранения');
        }

        console.log('✅ Стикер сохранен, получен stickerFileId:', stickerFileId);

        // Обновляем локальное состояние
        setFileId(stickerFileId);
        setStickerSaved(true);
      }

      // Финальная проверка: file_id должен быть обязательно
      if (!stickerFileId) {
        throw new Error('Не удалось получить stickerFileId. Стикер должен быть сохранен перед отправкой.');
      }

      // Валидация и очистка fileId
      const cleanFileId = removeInvisibleChars(stickerFileId);
      if (!isValidTelegramFileId(cleanFileId)) {
        console.warn('⚠️ Нестандартный формат stickerFileId:', cleanFileId);
        // Не блокируем отправку, но логируем для отладки
      }

      // Если есть inlineQueryId, отправляем стикер напрямую в чат через inline режим
      if (inlineQueryId) {
        const dataToSend = {
          file_id: cleanFileId,
          inline_query_id: inlineQueryId
        };

        console.log('📤 Отправка стикера в inline чат через sendData:', dataToSend);
        tg.sendData(JSON.stringify(dataToSend));
        console.log('✅ Стикер успешно отправлен в чат');
        return;
      }
      
      // ОСНОВНОЙ ПУТЬ: Используем switchInlineQuery если доступен
      // ВАЖНО: switchInlineQuery автоматически добавляет "@bot" к query,
      // поэтому передаем только fileId без "@bot"
      // ВАЖНО: Второй параметр ['users','groups','channels'] обязателен для показа окна выбора чата!
      // Без него Telegram вставляет в текущий чат (или в чат с ботом на Desktop)
      const query = buildSwitchInlineQuery(cleanFileId);
      
      // Проверяем длину query (максимум 256 символов по документации)
      if (query.length > 256) {
        console.warn('⚠️ Query слишком длинный (>256 символов), используем fallback');
      } else if (tg && typeof tg.switchInlineQuery === 'function') {
        console.log('📤 Используем switchInlineQuery с выбором чата (только fileId, без @bot):', query);
        try {
          // ВАЖНО: Второй параметр ['users','groups','channels'] показывает окно выбора чата
          tg.switchInlineQuery(query, ['users', 'groups', 'channels']);
          return;
        } catch (error) {
          console.warn('⚠️ switchInlineQuery не сработал, используем fallback:', error);
          // Продолжаем к fallback
        }
      }
      
      // FALLBACK: Если WebApp API недоступен, используем share URL
      console.log('📤 Используем fallback share URL');
      const shareUrl = buildFallbackShareUrl(cleanFileId, 'stixlybot');
      
      // Определяем платформу для выбора оптимального метода открытия
      const platformInfo = getPlatformInfo(tg);
      const isInTelegram = tg && tg.initData && tg.initData.trim() !== '';
      
      console.log('📱 Платформа:', platformInfo);
      
      // На Desktop всегда используем window.open для надежности
      // openTelegramLink на Desktop может не открывать окно выбора чата корректно
      if (platformInfo.isDesktop) {
        console.log('🖥️ Desktop: используем window.open');
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      
      // На мобильных устройствах внутри Telegram используем openTelegramLink
      if (isInTelegram && tg?.openTelegramLink) {
        console.log('📱 Мобильное устройство в Telegram: используем openTelegramLink');
        try {
          tg.openTelegramLink(shareUrl);
        } catch (error) {
          console.warn('⚠️ openTelegramLink не сработал, используем window.open:', error);
          window.open(shareUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      
      // Вне Telegram или если openTelegramLink недоступен - используем window.open
      console.log('🌐 Вне Telegram или fallback: используем window.open');
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      console.error('❌ Ошибка при отправке стикера в чат:', error);
      let message = 'Не удалось отправить стикер в чат';
      
      if (error.message?.includes('полон') || error.message?.includes('120')) {
        message = 'Стикерсет полон. Максимум 120 стикеров в одном наборе';
      } else if (error.message?.includes('не найдено') || error.message?.includes('404')) {
        message = 'Изображение не найдено';
      } else if (error.message) {
        message = error.message;
      }
      
      setErrorMessage(message);
    } finally {
      setIsSendingToChat(false);
    }
  };

  // Валидация формы
  const isFormValid = prompt.trim().length >= MIN_PROMPT_LENGTH && prompt.trim().length <= MAX_PROMPT_LENGTH;
  const isDisabled = pageState === 'generating' || !isFormValid;

  // Рендер состояния генерации (Figma: "Please wait..." + форма readonly + CANCEL)
  const renderGeneratingState = () => (
    <>
      <p className="generate-logo-label">Generation</p>
      <p className="generate-status-header">Подождите...</p>
      <div className="generate-form-block">
        <div className="generate-input-wrapper">
          <textarea
            className="generate-input generate-input--readonly"
            rows={4}
            readOnly
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <span className="generate-char-counter-inline">
            {prompt.length}/{MAX_PROMPT_LENGTH}
          </span>
        </div>
        <label className="generate-checkbox-label">
          <input type="checkbox" checked={removeBackground} disabled className="generate-checkbox" readOnly />
          <span>Удалить фон</span>
        </label>
        <div className="generate-style-row">
          <StylePresetStrip
            presets={stylePresets}
            selectedPresetId={selectedStylePresetId}
            onPresetChange={() => {}}
            disabled
          />
        </div>
        <div className="generate-status-container">
          <LoadingSpinner message={currentStatus ? STATUS_MESSAGES[currentStatus] : 'Инициализация...'} />
          <Button variant="secondary" size="medium" onClick={handleReset} className="generate-button-cancel">
            Отмена
          </Button>
        </div>
      </div>
    </>
  );

  // Рендер результата (Figma: image → Save → форма readonly → GENERATE 10 ART)
  const renderSuccessState = () => (
    <div className="generate-result-container">
      <p className="generate-logo-label">Generation</p>
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
        <span className="generate-sticker-saved">Сохранено в стикерсет</span>
      ) : saveError ? (
        <Text variant="bodySmall" style={{ color: 'var(--color-error)' }} align="center">
          {saveError}
        </Text>
      ) : null}

      {imageId && !stickerSaved && (
        <Button
          variant="secondary"
          size="medium"
          onClick={handleSaveToStickerSet}
          disabled={isSaving}
          loading={isSaving}
          className="generate-action-button save"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить в стикерсет'}
        </Button>
      )}

      <div className="generate-form-block generate-form-block--readonly">
        <div className="generate-input-wrapper">
          <textarea
            className="generate-input generate-input--readonly"
            rows={3}
            readOnly
            value={prompt}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <span className="generate-char-counter-inline">
            {prompt.length}/{MAX_PROMPT_LENGTH}
          </span>
        </div>
        <label className="generate-checkbox-label">
          <input type="checkbox" checked={removeBackground} disabled className="generate-checkbox" readOnly />
          <span>Удалить фон</span>
        </label>
        <div className="generate-style-row">
          <StylePresetStrip
            presets={stylePresets}
            selectedPresetId={selectedStylePresetId}
            onPresetChange={() => {}}
            disabled
          />
        </div>
        <Button
          variant="primary"
          size="medium"
          onClick={handleGenerateAnother}
          className="generate-button-regenerate"
        >
          {generateCost != null ? `Сгенерировать ${generateCost} ART` : 'Сгенерировать ещё'}
        </Button>
      </div>
    </div>
  );

  // Рендер ошибки
  const renderErrorState = () => (
    <div className="generate-error-container">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 'var(--spacing-md)' }}>
        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <Text variant="h3" weight="semibold" style={{ color: 'var(--color-error)' }} align="center">
        {errorMessage || 'Произошла ошибка'}
      </Text>
      
      <Button
        variant="primary"
        size="large"
        onClick={handleReset}
        className="generate-button-retry"
        style={{ marginTop: 'var(--spacing-lg)' }}
      >
        🔄 Попробовать снова
      </Button>
    </div>
  );

  // Рендер формы (Figma: Logo → Header → Inpit → Delete background → Style preview → Button)
  const renderIdleState = () => (
    <>
      <p className="generate-logo-label">Generation</p>
      <p className="generate-header">Создайте стикер с Stixly Generation</p>

      <div className="generate-form-block">
        <div className="generate-input-wrapper">
          <textarea
            className="generate-input"
            rows={4}
            placeholder="Подробно опишите стикер, например: собака летит на ракете"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <span className="generate-char-counter-inline">
            {prompt.length}/{MAX_PROMPT_LENGTH}
          </span>
        </div>

        <label className="generate-checkbox-label">
          <input
            type="checkbox"
            checked={removeBackground}
            onChange={(e) => setRemoveBackground(e.target.checked)}
            disabled={pageState === 'generating'}
            className="generate-checkbox"
          />
          <span>Удалить фон</span>
        </label>

        <div className="generate-style-row">
          <StylePresetStrip
            presets={stylePresets}
            selectedPresetId={selectedStylePresetId}
            onPresetChange={setSelectedStylePresetId}
            disabled={pageState === 'generating'}
          />
        </div>

        <Button
          variant="primary"
          size="medium"
          onClick={handleGenerate}
          disabled={isDisabled}
          loading={pageState === 'generating'}
          className="generate-button-submit"
        >
          {pageState === 'generating'
            ? 'Инициализация...'
            : generateCost != null
              ? `Сгенерировать ${generateCost} ART`
              : 'Сгенерировать'}
        </Button>
      </div>
    </>
  );

  return (
    <div className={cn('page-container', 'generate-page', isInTelegramApp && 'telegram-app')}>
      <OtherAccountBackground />
      <StixlyPageContainer className="generate-inner">
        {pageState === 'idle' && renderIdleState()}
        {pageState === 'generating' && renderGeneratingState()}
        {pageState === 'success' && renderSuccessState()}
        {pageState === 'error' && renderErrorState()}
      </StixlyPageContainer>
    </div>
  );
};

export default GeneratePage;
