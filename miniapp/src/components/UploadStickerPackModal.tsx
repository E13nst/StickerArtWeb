import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';
import { ModalBackdrop } from './ModalBackdrop';

interface UploadStickerPackModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (link: string) => Promise<void>;
}

export const UploadStickerPackModal: React.FC<UploadStickerPackModalProps> = ({
  open,
  onClose,
  onUpload
}) => {
  const [link, setLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!link.trim()) {
      setError('Пожалуйста, введите ссылку на стикерпак');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpload(link.trim());
      // Успех - закрываем модалку и очищаем форму
      setLink('');
      onClose();
    } catch (err: any) {
      // Ошибка - показываем сообщение, не закрываем модалку
      const errorMessage = err?.response?.data?.message || 
                          err?.message || 
                          'Не удалось загрузить стикерпак. Проверьте ссылку и попробуйте снова.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setLink('');
      setError(null);
      onClose();
    }
  };

  return (
    <ModalBackdrop open={open} onClose={handleClose}>
      <Box
        sx={{
          width: '90%',
          maxWidth: '400px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          animation: open ? 'modalSlideIn 0.3s ease-out' : 'modalSlideOut 0.2s ease-in',
          '@keyframes modalSlideIn': {
            '0%': {
              opacity: 0,
              transform: 'translateY(-20px) scale(0.95)'
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0) scale(1)'
            }
          },
          '@keyframes modalSlideOut': {
            '0%': {
              opacity: 1,
              transform: 'translateY(0) scale(1)'
            },
            '100%': {
              opacity: 0,
              transform: 'translateY(-20px) scale(0.95)'
            }
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            marginBottom: '20px',
            color: 'var(--tg-theme-text-color, #000000)',
            textAlign: 'center'
          }}
        >
          Загрузите стикеры в галерею Stixly!
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Ссылка на стикерпак"
            placeholder="https://t.me/addstickers/..."
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setError(null); // Очищаем ошибку при вводе
            }}
            disabled={isLoading}
            sx={{
              marginBottom: '16px',
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
                color: 'var(--tg-theme-text-color, #000000)',
                '& fieldset': {
                  borderColor: 'var(--tg-theme-border-color, #e0e0e0)'
                },
                '&:hover fieldset': {
                  borderColor: 'var(--tg-theme-button-color, #2481cc)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--tg-theme-button-color, #2481cc)'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'var(--tg-theme-hint-color, #999999)'
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--tg-theme-button-color, #2481cc)'
              }
            }}
          />

          {error && (
            <Alert
              severity="error"
              sx={{
                marginBottom: '16px',
                backgroundColor: 'rgba(211, 47, 47, 0.1)',
                color: 'var(--tg-theme-text-color, #000000)',
                '& .MuiAlert-icon': {
                  color: '#d32f2f'
                }
              }}
            >
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={isLoading || !link.trim()}
            sx={{
              py: 1.5,
              borderRadius: '12px',
              backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
              color: 'var(--tg-theme-button-text-color, #ffffff)',
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              '&:hover': {
                backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
                opacity: 0.9,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
              },
              '&:disabled': {
                backgroundColor: 'var(--tg-theme-hint-color, #999999)',
                opacity: 0.5
              }
            }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <CircularProgress size={16} sx={{ color: 'var(--tg-theme-button-text-color, #ffffff)' }} />
                <span>Загрузка...</span>
              </Box>
            ) : (
              'Загрузить'
            )}
          </Button>
        </form>
      </Box>
    </ModalBackdrop>
  );
};

