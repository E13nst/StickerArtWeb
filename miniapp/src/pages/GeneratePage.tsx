import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Paper, TextField, Button, Checkbox, FormControlLabel, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import '../styles/common.css';
import '../styles/GeneratePage.css';
import { apiClient, GenerationStatus } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';

type PageState = 'idle' | 'generating' | 'success' | 'error';

interface StatusMessage {
  status: GenerationStatus;
  text: string;
}

const STATUS_MESSAGES: Record<GenerationStatus, string> = {
  PENDING: 'Ожидание...',
  GENERATING: 'Генерация изображения...',
  REMOVING_BACKGROUND: 'Удаление фона...',
  COMPLETED: 'Готово!',
  FAILED: 'Ошибка генерации',
  TIMEOUT: 'Превышено время ожидания'
};

const POLLING_INTERVAL = 2500; // 2.5 секунды
const MAX_PROMPT_LENGTH = 1000;
const MIN_PROMPT_LENGTH = 1;

export const GeneratePage: React.FC = () => {
  // Состояние формы
  const [prompt, setPrompt] = useState('');
  const [saveToStickerSet, setSaveToStickerSet] = useState(false);
  
  // Состояние генерации
  const [pageState, setPageState] = useState<PageState>('idle');
  const [currentStatus, setCurrentStatus] = useState<GenerationStatus | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [stickerSaved, setStickerSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Тарифы
  const [generateCost, setGenerateCost] = useState<number | null>(null);
  const [isLoadingTariffs, setIsLoadingTariffs] = useState(true);
  
  // Баланс пользователя
  const currentUser = useProfileStore((state) => state.currentUser);
  const artBalance = currentUser?.artBalance ?? null;
  
  // Polling ref
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          setStickerSaved(!!statusData.telegramSticker?.fileId);
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
    setCurrentStatus('PENDING');
    setErrorMessage(null);
    setResultImageUrl(null);
    setStickerSaved(false);

    try {
      const response = await apiClient.generateSticker({
        prompt: prompt.trim(),
        saveToStickerSet
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
    setStickerSaved(false);
    setErrorMessage(null);
    // Не очищаем prompt чтобы пользователь мог повторить с тем же текстом
  };

  // Генерация еще раз (очищаем всё включая prompt)
  const handleGenerateAnother = () => {
    handleReset();
    setPrompt('');
    setSaveToStickerSet(false);
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
      
      {stickerSaved && (
        <Typography className="generate-sticker-saved">
          ✨ Стикер сохранен в ваш стикерсет
        </Typography>
      )}
      
      <Button
        fullWidth
        variant="contained"
        onClick={handleGenerateAnother}
        startIcon={<RefreshIcon />}
        className="generate-button generate-button-success"
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
          {artBalance !== null ? `${artBalance} ART` : '— ART'}
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
