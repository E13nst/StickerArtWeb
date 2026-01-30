import React, { useState, useCallback } from 'react';
;
import { CloseIcon } from '@/components/ui/Icons';;
import { CheckCircleIcon } from '@/components/ui/Icons';;
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

// Акцентный цвет для донатов (золотой)
const DONATE_ACCENT_COLOR = '#FFD700';
const DONATE_ACCENT_COLOR_DARK = '#FFC107';

export const DonateModal: React.FC<DonateModalProps> = ({
  open,
  onClose,
  stickerSetId,
  authorName
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const [amount, setAmount] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [prepareData, setPrepareData] = useState<DonationPrepareResponse | null>(null);

  // Обработка закрытия модального окна
  const handleClose = useCallback((event?: {}, reason?: string) => {
    // Предотвращаем закрытие при клике на backdrop или Escape во время загрузки
    if (isLoading) {
      return;
    }
    
    // Разрешаем закрытие только через кнопку закрытия или после успешного доната
    // backdropClick и escapeKeyDown блокируем, если не success
    if (reason === 'backdropClick' && !success) {
      return;
    }
    
    if (reason === 'escapeKeyDown' && !success) {
      return;
    }
    
    setAmount('');
    setSelectedPreset(null);
    setError(null);
    setSuccess(false);
    setPrepareData(null);
    onClose();
  }, [isLoading, onClose, success]);

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

      // Валидация наличия legs в ответе
      if (!prepareResponse.legs || prepareResponse.legs.length === 0) {
        setError('Не удалось получить данные для транзакции');
        setIsLoading(false);
        return;
      }

      // Получаем первый leg (основная транзакция)
      const leg = prepareResponse.legs[0];

      // Формируем транзакцию для TON Connect
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут
        messages: [
          {
            address: leg.toWalletAddress,
            amount: leg.amountNano.toString()
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
      disableEscapeKeyDown={isLoading || !success}
      sx={{
        '& .MuiBackdrop-root': {
          backgroundColor: 'var(--tg-theme-overlay-color, rgba(0, 0, 0, 0.7))',
          backdropFilter: 'blur(4px)',
        }
      }}
      PaperProps={{
        onClick: (e) => {
          e.stopPropagation();
        },
        onMouseDown: (e) => {
          e.stopPropagation();
        },
        sx: {
          borderRadius: 'var(--tg-radius-l, 16px)',
          backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
          color: 'var(--tg-theme-text-color, #000000)',
          boxShadow: '0 8px 32px var(--tg-theme-shadow-color, rgba(0, 0, 0, 0.2))',
          margin: isMobile ? '16px' : '24px',
          maxHeight: isMobile ? 'calc(100vh - 32px)' : 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.3s ease-out',
          '@keyframes fadeIn': {
            from: {
              opacity: 0,
              transform: 'scale(0.95) translateY(-10px)'
            },
            to: {
              opacity: 1,
              transform: 'scale(1) translateY(0)'
            }
          }
        }
      }}
    >
      <DialogTitle 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          px: isMobile ? 2 : 3,
          pt: isMobile ? 2 : 3,
          pb: 2,
          borderBottom: '1px solid var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))'
        }}
      >
        <Typography 
          variant="h6" 
          component="span"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            fontWeight: 600,
            fontSize: isMobile ? '18px' : '20px',
            color: 'var(--tg-theme-text-color, #000000)',
            lineHeight: 1.2
          }}
        >
          Поддержать автора
        </Typography>
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleClose(e, 'buttonClick');
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          disabled={isLoading}
          size="small"
          sx={{ 
            color: 'var(--tg-theme-hint-color, #999999)',
            transition: 'all 0.2s ease',
            '&:hover': {
              color: 'var(--tg-theme-text-color, #000000)',
              backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)'
            }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        sx={{
          px: isMobile ? 2 : 3,
          pt: 3,
          pb: 2,
          flex: 1,
          overflowY: 'auto'
        }}
      >
        {success ? (
          <div 
            sx={{ 
              textAlign: 'center', 
              py: isMobile ? 4 : 5,
              px: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              sx={{
                animation: 'scaleIn 0.4s ease-out',
                '@keyframes scaleIn': {
                  from: {
                    opacity: 0,
                    transform: 'scale(0.5)'
                  },
                  to: {
                    opacity: 1,
                    transform: 'scale(1)'
                  }
                }
              }}
            >
              <CheckCircleIcon 
                sx={{ 
                  fontSize: 64, 
                  color: DONATE_ACCENT_COLOR,
                  filter: 'drop-shadow(0 2px 8px rgba(255, 215, 0, 0.3))'
                }} 
              />
            </div>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 1, 
                color: DONATE_ACCENT_COLOR,
                fontWeight: 600,
                fontSize: isMobile ? '20px' : '24px'
              }}
            >
              Спасибо за поддержку автора ❤️
            </Typography>
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'var(--tg-theme-hint-color, #999999)',
                fontSize: isMobile ? '14px' : '16px',
                maxWidth: '300px'
              }}
            >
              Ваш донат успешно отправлен!
            </Typography>
          </div>
        ) : (
          <>
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 'var(--tg-radius-m, 12px)',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  border: '1px solid rgba(244, 67, 54, 0.2)',
                  color: 'var(--tg-theme-text-color, #000000)',
                  '& .MuiAlert-icon': {
                    color: '#f44336'
                  }
                }} 
                onClose={(e) => {
                  e?.stopPropagation();
                  setError(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {error}
              </Alert>
            )}

            <Typography 
              variant="body2" 
              sx={{ 
                mb: 3, 
                color: 'var(--tg-theme-hint-color, #999999)',
                fontSize: isMobile ? '14px' : '15px',
                lineHeight: 1.5,
                textAlign: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Выберите сумму доната для <strong style={{ color: 'var(--tg-theme-text-color, #000000)' }}>{displayAuthorName}</strong>
            </Typography>

            {/* Preset кнопки */}
            <div 
              sx={{ 
                display: 'flex', 
                gap: 1.5, 
                mb: 3, 
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {PRESET_AMOUNTS.map((preset) => {
                const isSelected = selectedPreset === preset;
                return (
                  <Button
                    key={preset}
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handlePresetClick(preset);
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    disabled={isLoading}
                    sx={{
                      flex: isMobile ? '1 1 calc(33.333% - 8px)' : '0 1 auto',
                      minWidth: isMobile ? '80px' : '100px',
                      minHeight: '44px',
                      borderRadius: 'var(--tg-radius-m, 12px)',
                      fontWeight: 600,
                      fontSize: isMobile ? '14px' : '15px',
                      textTransform: 'none',
                      transition: 'all 0.2s ease',
                      ...(isSelected ? {
                        backgroundColor: DONATE_ACCENT_COLOR,
                        color: '#000000',
                        border: `2px solid ${DONATE_ACCENT_COLOR}`,
                        boxShadow: `0 2px 8px rgba(255, 215, 0, 0.3)`,
                        '&:hover': {
                          backgroundColor: DONATE_ACCENT_COLOR_DARK,
                          borderColor: DONATE_ACCENT_COLOR_DARK,
                          transform: 'translateY(-1px)',
                          boxShadow: `0 4px 12px rgba(255, 215, 0, 0.4)`
                        }
                      } : {
                        backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
                        color: 'var(--tg-theme-text-color, #000000)',
                        border: `2px solid var(--tg-theme-border-color, #e0e0e0)`,
                        '&:hover': {
                          backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
                          borderColor: DONATE_ACCENT_COLOR,
                          transform: 'translateY(-1px)',
                          boxShadow: `0 2px 8px rgba(255, 215, 0, 0.2)`
                        }
                      }),
                      '&:active': {
                        transform: 'translateY(0) scale(0.98)'
                      }
                    }}
                  >
                    {preset} TON
                  </Button>
                );
              })}
            </div>

            {/* Поле ввода суммы */}
            <TextField
              fullWidth
              label="Сумма (TON)"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              disabled={isLoading}
              placeholder="0.0"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onFocus={(e) => {
                e.stopPropagation();
              }}
              inputProps={{
                onClick: (e: React.MouseEvent<HTMLInputElement>) => {
                  e.stopPropagation();
                },
                onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => {
                  e.stopPropagation();
                },
                onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
                  e.stopPropagation();
                },
                style: {
                  fontSize: isMobile ? '16px' : '18px',
                  fontWeight: 500
                }
              }}
              InputProps={{
                onClick: (e) => {
                  e.stopPropagation();
                },
                onMouseDown: (e) => {
                  e.stopPropagation();
                },
                endAdornment: (
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: 'var(--tg-theme-hint-color, #999999)',
                      fontWeight: 500,
                      fontSize: isMobile ? '14px' : '15px',
                      mr: 1
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    TON
                  </Typography>
                )
              }}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 'var(--tg-radius-m, 12px)',
                  backgroundColor: 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
                  border: '2px solid var(--tg-theme-border-color, #e0e0e0)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: DONATE_ACCENT_COLOR,
                  },
                  '&.Mui-focused': {
                    borderColor: DONATE_ACCENT_COLOR,
                    boxShadow: `0 0 0 3px rgba(255, 215, 0, 0.1)`
                  },
                  '& fieldset': {
                    border: 'none'
                  }
                },
                '& .MuiInputLabel-root': {
                  color: 'var(--tg-theme-hint-color, #999999)',
                  '&.Mui-focused': {
                    color: DONATE_ACCENT_COLOR
                  }
                },
                '& .MuiInputBase-input': {
                  color: 'var(--tg-theme-text-color, #000000)',
                  '&::placeholder': {
                    color: 'var(--tg-theme-hint-color, #999999)',
                    opacity: 0.6
                  }
                }
              }}
            />

            {amount && !error && validateAmount(amount).valid && (
              <div
                sx={{
                  mb: 2,
                  p: 2,
                  borderRadius: 'var(--tg-radius-m, 12px)',
                  backgroundColor: 'rgba(255, 215, 0, 0.1)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  textAlign: 'center'
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'var(--tg-theme-hint-color, #999999)',
                    fontSize: '13px',
                    mb: 0.5
                  }}
                >
                  Будет отправлено
                </Typography>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: DONATE_ACCENT_COLOR,
                    fontWeight: 700,
                    fontSize: isMobile ? '20px' : '24px',
                    lineHeight: 1.2
                  }}
                >
                  {amount} TON
                </Typography>
              </div>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions 
        sx={{ 
          px: isMobile ? 2 : 3, 
          pt: 2,
          pb: isMobile ? 2 : 3,
          gap: 1.5,
          borderTop: '1px solid var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))'
        }} 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {success ? (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleClose(e, 'buttonClick');
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            variant="contained"
            fullWidth
            sx={{ 
              borderRadius: 'var(--tg-radius-m, 12px)',
              minHeight: '48px',
              backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
              color: 'var(--tg-theme-button-text-color, #ffffff)',
              fontWeight: 600,
              fontSize: isMobile ? '15px' : '16px',
              textTransform: 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                opacity: 0.9,
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              },
              '&:active': {
                transform: 'translateY(0) scale(0.98)'
              }
            }}
          >
            Закрыть
          </Button>
        ) : (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handlePrepareDonation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            disabled={!canSend}
            variant="contained"
            fullWidth
            sx={{ 
              borderRadius: 'var(--tg-radius-m, 12px)',
              minHeight: '48px',
              backgroundColor: canSend ? DONATE_ACCENT_COLOR : 'var(--tg-theme-secondary-bg-color, #f8f9fa)',
              color: canSend ? '#000000' : 'var(--tg-theme-hint-color, #999999)',
              fontWeight: 600,
              fontSize: isMobile ? '15px' : '16px',
              textTransform: 'none',
              border: canSend ? `2px solid ${DONATE_ACCENT_COLOR}` : '2px solid var(--tg-theme-border-color, #e0e0e0)',
              boxShadow: canSend ? `0 2px 8px rgba(255, 215, 0, 0.3)` : 'none',
              transition: 'all 0.2s ease',
              '&:hover:not(:disabled)': {
                backgroundColor: DONATE_ACCENT_COLOR_DARK,
                borderColor: DONATE_ACCENT_COLOR_DARK,
                transform: 'translateY(-1px)',
                boxShadow: `0 4px 12px rgba(255, 215, 0, 0.4)`
              },
              '&:active:not(:disabled)': {
                transform: 'translateY(0) scale(0.98)'
              },
              '&:disabled': {
                cursor: 'not-allowed',
                opacity: 0.6
              }
            }}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" sx={{ color: '#000000' }} /> : null}
          >
            {isLoading ? 'Отправка...' : `Отправить ${displayAuthorName}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

