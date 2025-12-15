import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { apiClient } from '@/api/client';
import { DonationPrepareResponse } from '@/types/sticker';

interface DonateModalProps {
  open: boolean;
  onClose: () => void;
  stickerSetId: number;
  authorName?: string;
}

// Константы для конвертации TON в наноTON
const TON_TO_NANO = 1_000_000_000n;
const MIN_AMOUNT_NANO = 1_000_000n; // 0.001 TON
const MAX_AMOUNT_NANO = 1_000_000_000_000n; // 1000 TON

// Preset суммы в TON
const PRESET_AMOUNTS = [1, 5, 10];

export const DonateModal: React.FC<DonateModalProps> = ({
  open,
  onClose,
  stickerSetId,
  authorName
}) => {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const [amount, setAmount] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [prepareData, setPrepareData] = useState<DonationPrepareResponse | null>(null);

  // Обработка закрытия модального окна
  const handleClose = useCallback(() => {
    if (!isLoading) {
      setAmount('');
      setSelectedPreset(null);
      setError(null);
      setSuccess(false);
      setPrepareData(null);
      onClose();
    }
  }, [isLoading, onClose]);

  // Обработка выбора preset суммы
  const handlePresetClick = useCallback((presetAmount: number) => {
    setSelectedPreset(presetAmount);
    setAmount(presetAmount.toString());
    setError(null);
  }, []);

  // Обработка изменения суммы вручную
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Разрешаем только числа и точку
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setSelectedPreset(null);
      setError(null);
    }
  }, []);

  // Валидация суммы
  const validateAmount = useCallback((tonAmount: string): { valid: boolean; amountNano: bigint | null; error: string | null } => {
    if (!tonAmount || tonAmount.trim() === '') {
      return { valid: false, amountNano: null, error: 'Введите сумму доната' };
    }

    const numValue = parseFloat(tonAmount);
    if (isNaN(numValue) || numValue <= 0) {
      return { valid: false, amountNano: null, error: 'Сумма должна быть больше нуля' };
    }

    // Точная конвертация TON в наноTON
    const amountNano = BigInt(Math.floor(numValue * 1_000_000_000));
    
    if (amountNano < MIN_AMOUNT_NANO) {
      return { valid: false, amountNano: null, error: `Минимальная сумма: ${Number(MIN_AMOUNT_NANO) / Number(TON_TO_NANO)} TON` };
    }

    if (amountNano > MAX_AMOUNT_NANO) {
      return { valid: false, amountNano: null, error: `Максимальная сумма: ${Number(MAX_AMOUNT_NANO) / Number(TON_TO_NANO)} TON` };
    }

    return { valid: true, amountNano, error: null };
  }, []);

  // Подготовка доната
  const handlePrepareDonation = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const validation = validateAmount(amount);
      if (!validation.valid || !validation.amountNano) {
        setError(validation.error || 'Неверная сумма');
        setIsLoading(false);
        return;
      }

      // Вызываем prepare API
      const prepareResponse = await apiClient.prepareDonation(
        stickerSetId,
        Number(validation.amountNano)
      );

      setPrepareData(prepareResponse);

      // Проверяем подключение кошелька
      if (!tonAddress) {
        setError('Пожалуйста, подключите кошелёк для отправки доната');
        setIsLoading(false);
        return;
      }

      // Формируем транзакцию для TON Connect
      const transaction = {
        messages: [
          {
            address: prepareResponse.toWalletAddress,
            amount: prepareResponse.amountNano.toString()
          }
        ]
      };

      // Отправляем транзакцию через TON Connect
      const result = await tonConnectUI.sendTransaction(transaction);

      if (result.boc) {
        // Используем boc как txHash (уникальный идентификатор транзакции)
        // В TON Connect boc является сериализованной транзакцией, которая может использоваться как идентификатор
        const txHash = result.boc;
        
        // Подтверждаем транзакцию на бэкенде
        const confirmResponse = await apiClient.confirmDonation(
          prepareResponse.intentId,
          txHash,
          tonAddress
        );

        if (confirmResponse.success) {
          setSuccess(true);
        } else {
          setError(confirmResponse.message || 'Не удалось подтвердить транзакцию');
        }
      } else {
        setError('Транзакция не была отправлена');
      }
    } catch (err: any) {
      console.error('Ошибка при отправке доната:', err);
      
      // Обработка различных типов ошибок
      if (err?.message?.includes('User rejected')) {
        setError('Вы отменили транзакцию');
      } else if (err?.response?.status === 400) {
        setError(err?.response?.data?.message || 'Автор не привязал кошелёк для получения донатов');
      } else if (err?.response?.status === 404) {
        setError('Стикерсет не найден');
      } else {
        setError(err?.message || 'Произошла ошибка при отправке доната. Попробуйте позже.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [amount, stickerSetId, tonConnectUI, validateAmount]);

  // Проверка, можно ли отправить донат
  const canSend = amount.trim() !== '' && !isLoading && !success;
  const displayAuthorName = authorName || 'автора';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 1)',
          color: 'var(--tg-theme-text-color, #000000)'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" component="span">
          Поддержать автора
        </Typography>
        <IconButton
          onClick={handleClose}
          disabled={isLoading}
          size="small"
          sx={{ color: 'var(--tg-theme-text-color, #000000)' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'success.main' }}>
              Спасибо за поддержку автора ❤️
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Ваш донат успешно отправлен!
            </Typography>
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              Выберите сумму доната для {displayAuthorName}
            </Typography>

            {/* Preset кнопки */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={selectedPreset === preset ? 'contained' : 'outlined'}
                  onClick={() => handlePresetClick(preset)}
                  disabled={isLoading}
                  sx={{
                    minWidth: '80px',
                    borderRadius: '8px'
                  }}
                >
                  {preset} TON
                </Button>
              ))}
            </Box>

            {/* Поле ввода суммы */}
            <TextField
              fullWidth
              label="Сумма (TON)"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              disabled={isLoading}
              placeholder="0.0"
              InputProps={{
                endAdornment: <Typography variant="body2" sx={{ color: 'text.secondary' }}>TON</Typography>
              }}
              sx={{ mb: 2 }}
            />

            {amount && !error && validateAmount(amount).valid && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                Будет отправлено: {amount} TON
              </Typography>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {success ? (
          <Button
            onClick={handleClose}
            variant="contained"
            fullWidth
            sx={{ borderRadius: '8px' }}
          >
            Закрыть
          </Button>
        ) : (
          <Button
            onClick={handlePrepareDonation}
            disabled={!canSend}
            variant="contained"
            fullWidth
            sx={{ borderRadius: '8px' }}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Отправка...' : `Отправить ${displayAuthorName}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

