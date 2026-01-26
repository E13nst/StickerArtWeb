import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Paper, TextField, Button, Checkbox, FormControlLabel, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SendIcon from '@mui/icons-material/Send';
import '../styles/common.css';
import '../styles/GeneratePage.css';
import { apiClient, GenerationStatus, StylePreset } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { StylePresetDropdown } from '@/components/StylePresetDropdown';
import { useTelegram } from '@/hooks/useTelegram';

type PageState = 'idle' | 'generating' | 'success' | 'error';

interface StatusMessage {
  status: GenerationStatus;
  text: string;
}

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

export const GeneratePage: React.FC = () => {
  // Telegram WebApp SDK
  const { tg } = useTelegram();
  
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Актуальный баланс ART (источник истины: /api/profiles/me как на MyProfilePage)
  useEffect(() => {
    let isCancelled = false;

    const refreshBalance = async () => {
      try {
        const me = await apiClient.getMyProfile();
        if (isCancelled) return;
        setArtBalance(typeof me.artBalance === 'number' ? me.artBalance : null);
        // Поддерживаем стор в актуальном виде, чтобы другие страницы тоже могли переиспользовать баланс
        setUserInfo(userInfo ? { ...userInfo, artBalance: me.artBalance } : me);
      } catch (error) {
        // Не шумим UI ошибкой: бейдж просто останется со старым значением / '—'
        console.warn('Не удалось обновить баланс ART:', error);
      }
    };

    // Первый запрос сразу
    refreshBalance();

    // Обновляем баланс при возврате на вкладку/страницу
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshBalance();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, []);

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

      // Если есть inlineQueryId, отправляем стикер напрямую в чат через inline режим
      if (inlineQueryId) {
        const dataToSend = {
          file_id: stickerFileId,
          inline_query_id: inlineQueryId
        };

        console.log('📤 Отправка стикера в inline чат через sendData:', dataToSend);
        tg.sendData(JSON.stringify(dataToSend));
        console.log('✅ Стикер успешно отправлен в чат');
      } else {
        // Открываем выбор чата с предзаполненным текстом "@stixlybot [StickerFileId]"
        // file_id необходим для того, чтобы бот мог обработать инлайн-запрос
        const messageText = `@stixlybot ${stickerFileId}`;
        
        // Используем правильный формат share URL для открытия выбора чата
        // Формат: https://t.me/share/url?url={url}&text={text}
        // Используем ссылку на бота в качестве URL
        const botUrl = 'https://t.me/stixlybot';
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(messageText)}`;
        
        // Альтернативный вариант с deep link схемой (для мобильных устройств)
        const deepLinkUrl = `tg://msg_url?url=${encodeURIComponent(botUrl)}&text=${encodeURIComponent(messageText)}`;
        
        console.log('📤 Открытие выбора чата с предзаполненным текстом');
        console.log('📋 Share URL (https):', shareUrl);
        console.log('📋 Deep Link URL (tg://):', deepLinkUrl);
        console.log('📋 StickerFileId для инлайн:', stickerFileId);
        console.log('📋 Текст сообщения:', messageText);
        
        // В WebApp контексте openTelegramLink должен открывать ссылку в основном приложении Telegram
        // Это должно открыть окно выбора чата с предзаполненным текстом
        // Используем небольшую задержку, чтобы убедиться, что состояние обновлено
        setTimeout(() => {
          try {
            console.log('🔄 Вызов openTelegramLink...');
            tg.openTelegramLink(shareUrl);
            console.log('✅ openTelegramLink вызван успешно');
          } catch (error) {
            console.warn('⚠️ openTelegramLink не сработал, пробуем openLink:', error);
            // Fallback: используем openLink
            try {
              tg.openLink(shareUrl, { try_instant_view: false });
            } catch (linkError) {
              console.error('❌ Оба метода не сработали:', linkError);
              // Последний fallback: пробуем через window.location (только для отладки)
              console.warn('⚠️ Пробуем открыть через window.location (fallback)');
              window.location.href = shareUrl;
            }
          }
        }, 100);
      }
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

  // Рендер состояния генерации
  const renderGeneratingState = () => (
    <Box className="generate-status-container">
      <CircularProgress 
        size={64}
        thickness={3}
        sx={{ 
          color: '#ff6b35',
          mb: 3
        }}
      />
      <Typography className="generate-status-text">
        {currentStatus ? STATUS_MESSAGES[currentStatus] : 'Инициализация...'}
      </Typography>
      <Typography className="generate-status-hint">
        Это может занять некоторое время
      </Typography>
    </Box>
  );

  // Рендер результата
  const renderSuccessState = () => (
    <Box className="generate-result-container">
      {resultImageUrl && (
        <Box className="generate-result-image-wrapper">
          <img 
            src={resultImageUrl} 
            alt="Сгенерированный стикер" 
            className="generate-result-image"
          />
        </Box>
      )}
      
      <Box className="generate-success-info">
        <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 32, mr: 1 }} />
        <Typography className="generate-success-text">
          Стикер успешно создан!
        </Typography>
      </Box>
      
      {stickerSaved ? (
        <Typography className="generate-sticker-saved">
          ✅ Сохранено в стикерсет
        </Typography>
      ) : saveError ? (
        <Typography
          sx={{
            color: 'var(--tg-theme-error-color, #f44336)',
            fontSize: '14px',
            textAlign: 'center',
            mt: 1,
            mb: 1,
          }}
        >
          {saveError}
        </Typography>
      ) : null}

      {/* Кнопки действий: Сохранить и Отправить в чат */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        {imageId && !stickerSaved && (
          <Button
            fullWidth
            variant="contained"
            onClick={handleSaveToStickerSet}
            disabled={isSaving}
            className="generate-button"
            sx={{
              py: 1.5,
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
              color: '#ffffff',
              flex: 1,
              '&:hover': {
                backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
                opacity: 0.9,
              },
              '&:disabled': {
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)',
                color: 'var(--tg-theme-hint-color)',
              },
            }}
          >
            {isSaving ? 'Сохранение...' : '💾 Сохранить в стикерсет'}
          </Button>
        )}

        {/* Кнопка "Поделиться" - показывается если есть fileId или imageId */}
        {(fileId || imageId) && (
          <Button
            fullWidth
            variant="contained"
            onClick={fileId && inlineQueryId ? handleSendToChat : handleShareSticker}
            disabled={isSendingToChat}
            startIcon={<SendIcon />}
            className="generate-button"
            sx={{
              py: 1.5,
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
              color: '#ffffff',
              flex: 1,
              '&:hover': {
                backgroundColor: 'var(--tg-theme-button-color, #3390ec)',
                opacity: 0.9,
              },
              '&:disabled': {
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)',
                color: 'var(--tg-theme-hint-color)',
              },
            }}
          >
            {isSendingToChat 
              ? 'Отправка...' 
              : '📤 Отправить в чат'}
          </Button>
        )}
      </Box>
      
      <Button
        fullWidth
        variant="contained"
        onClick={handleGenerateAnother}
        startIcon={<RefreshIcon />}
        className="generate-button generate-button-success"
        sx={{
          mt: 2,
          py: 1.5,
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          textTransform: 'none',
          backgroundColor: '#ff6b35',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#ff5722',
          },
        }}
      >
        Сгенерировать ещё
      </Button>
    </Box>
  );

  // Рендер ошибки
  const renderErrorState = () => (
    <Box className="generate-error-container">
      <ErrorOutlineIcon 
        sx={{ 
          fontSize: 64, 
          color: 'var(--tg-theme-error-color, #f44336)',
          mb: 2
        }} 
      />
      <Typography className="generate-error-text">
        {errorMessage || 'Произошла ошибка'}
      </Typography>
      
      <Button
        fullWidth
        variant="contained"
        onClick={handleReset}
        startIcon={<RefreshIcon />}
        className="generate-button"
        sx={{
          mt: 3,
          py: 1.5,
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: 600,
          textTransform: 'none',
          backgroundColor: '#ff6b35',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#ff5722',
          },
        }}
      >
        Попробовать снова
      </Button>
    </Box>
  );

  // Рендер формы
  const renderIdleState = () => (
    <>
      <Box className="generate-icon-wrapper">
        <AutoAwesomeIcon className="generate-icon" />
      </Box>
      
      <Typography variant="h4" className="generate-title">
        Создайте стикер
      </Typography>

      {/* Стоимость генерации */}
      <Box className="generate-cost-info">
        {isLoadingTariffs ? (
          <Typography className="generate-cost-text">
            Загрузка тарифов...
          </Typography>
        ) : generateCost !== null ? (
          <Typography className="generate-cost-text">
            Стоимость генерации: <span className="generate-cost-value">{generateCost} ART</span>
          </Typography>
        ) : null}
      </Box>

      <Box className="generate-form-container">
        <Box sx={{ position: 'relative' }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Подробно опишите стикер, например: пушистый кот в очках сидит на окне и смотрит на закат"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="generate-input"
            inputProps={{
              maxLength: MAX_PROMPT_LENGTH
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 40%, transparent)',
                color: 'var(--tg-theme-text-color)',
                border: '1px solid color-mix(in srgb, var(--tg-theme-border-color) 30%, transparent)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                paddingBottom: '24px', // Space for the inline counter
                '&:hover': {
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 60%, transparent)',
                },
                '&.Mui-focused': {
                  backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 60%, transparent)',
                  borderColor: 'var(--tg-theme-button-color)',
                  boxShadow: '0 0 0 2px color-mix(in srgb, var(--tg-theme-button-color) 20%, transparent)',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  border: 'none',
                },
                '& .MuiInputBase-input': {
                  color: 'var(--tg-theme-text-color)',
                  fontSize: '15px',
                  lineHeight: '1.5',
                  '&::placeholder': {
                    color: 'var(--tg-theme-hint-color)',
                    opacity: 0.5,
                  },
                },
              },
            }}
          />
          
          {/* Полупрозрачный счетчик символов внутри поля */}
          <Typography className="generate-char-counter-inline">
            {prompt.length}/{MAX_PROMPT_LENGTH}
          </Typography>
        </Box>

        {/* Выбор пресета стиля */}
        {stylePresets.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <StylePresetDropdown
              presets={stylePresets}
              selectedPresetId={selectedStylePresetId}
              onPresetChange={setSelectedStylePresetId}
              disabled={pageState === 'generating'}
            />
          </Box>
        )}

        {/* Подсказка об энхансерах */}
        <Box sx={{ mt: 1, mb: 1 }}>
          <Typography
            sx={{
              fontSize: '13px',
              color: 'var(--tg-theme-hint-color, rgba(0, 0, 0, 0.6))',
              fontStyle: 'italic',
              textAlign: 'center',
            }}
          >
            💡 Ваш промпт будет автоматически улучшен с помощью AI
          </Typography>
        </Box>

        {/* Чекбокс удаления фона */}
        <FormControlLabel
          control={
            <Checkbox
              checked={removeBackground}
              onChange={(e) => setRemoveBackground(e.target.checked)}
              disabled={pageState === 'generating'}
              sx={{
                color: 'var(--tg-theme-button-color, #3390ec)',
                '&.Mui-checked': {
                  color: 'var(--tg-theme-button-color, #3390ec)',
                },
              }}
            />
          }
          label={
            <Typography
              sx={{
                fontSize: '14px',
                color: 'var(--tg-theme-text-color)',
              }}
            >
              Удалить фон
            </Typography>
          }
          sx={{ mt: 1, mb: 1 }}
        />

        <Button
          fullWidth
          variant="contained"
          onClick={handleGenerate}
          disabled={isDisabled}
          className="generate-button"
          sx={{
            mt: 3,
            py: 1.8,
            borderRadius: '16px',
            fontSize: '16px',
            fontWeight: 700,
            textTransform: 'none',
            background: 'linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%)',
            color: '#ffffff',
            boxShadow: '0 8px 20px rgba(255, 107, 53, 0.25)',
            '&:hover': {
              background: 'linear-gradient(135deg, #ff5722 0%, #ff7a45 100%)',
              transform: 'translateY(-1px)',
              boxShadow: '0 10px 24px rgba(255, 107, 53, 0.35)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
            '&:disabled': {
              background: 'color-mix(in srgb, var(--tg-theme-hint-color) 20%, transparent)',
              color: 'var(--tg-theme-hint-color)',
              boxShadow: 'none',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {pageState === 'generating' ? 'Инициализация...' : 'Нарисовать'}
        </Button>
      </Box>
    </>
  );

  return (
    <Box className="generate-page">
      {/* Баланс ART в правом верхнем углу */}
      <Box className="generate-balance-badge">
        <Typography className="generate-balance-text">
          {artBalance !== null ? `🎨 ${artBalance} ART` : '🎨 — ART'}
        </Typography>
      </Box>

      <Paper elevation={0} className="generate-card" sx={{ mb: '100px' }}>
        {pageState === 'idle' && renderIdleState()}
        {pageState === 'generating' && renderGeneratingState()}
        {pageState === 'success' && renderSuccessState()}
        {pageState === 'error' && renderErrorState()}
      </Paper>
    </Box>
  );
};

export default GeneratePage;
