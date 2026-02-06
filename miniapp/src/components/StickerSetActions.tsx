import React, { useState, useCallback } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
import { StickerSetResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useStickerStore } from '@/store/useStickerStore';
import { useProfileStore } from '@/store/useProfileStore';

/** Кнопка-иконка без MUI: принимает sx-подобный объект, отображает только простые CSS-свойства. */
function IconButton({
  children,
  onClick,
  disabled,
  sx = {},
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  sx?: Record<string, unknown>;
}) {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    padding: 0,
    background: 'transparent',
    width: (sx.width as number) ?? 36,
    height: (sx.height as number) ?? 36,
    fontSize: (sx.fontSize as string) ?? '18px',
    borderRadius: (sx.borderRadius as string) ?? 'var(--tg-radius-s)',
    backgroundColor: sx.backgroundColor as string,
    color: sx.color as string,
    border: (sx.border as string) ?? 'none',
    transition: (sx.transition as string) ?? 'transform 150ms ease, background-color 150ms ease',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

interface StickerSetActionsProps {
  stickerSet: StickerSetResponse;
  availableActions: string[];
  onActionComplete: (action: string, updatedData?: StickerSetResponse) => void;
}

type ActionType = 'DELETE' | 'BLOCK' | 'UNBLOCK' | 'PUBLISH' | 'UNPUBLISH';

interface ActionDialogState {
  open: boolean;
  action: ActionType | null;
  loading: boolean;
  error: string | null;
  blockReason: string;
}

export const StickerSetActions: React.FC<StickerSetActionsProps> = ({
  stickerSet,
  availableActions,
  onActionComplete
}) => {
  const [dialogState, setDialogState] = useState<ActionDialogState>({
    open: false,
    action: null,
    loading: false,
    error: null,
    blockReason: ''
  });

  // Логика отображения кнопок - бэкенд уже проверил права, показываем только на основе availableActions
  // Полагаемся ТОЛЬКО на availableActions от бэкенда, так как он содержит актуальное состояние
  const shouldShowDelete = availableActions.includes('DELETE');
  const shouldShowBlock = availableActions.includes('BLOCK');
  const shouldShowUnblock = availableActions.includes('UNBLOCK');
  const shouldShowPublish = availableActions.includes('PUBLISH');
  const shouldShowUnpublish = availableActions.includes('UNPUBLISH');

  // Отладочный лог для E2E тестов
  console.log('🎯 StickerSetActions render:', {
    stickerSetId: stickerSet.id,
    availableActions,
    shouldShowBlock,
    shouldShowUnblock,
    shouldShowPublish,
    shouldShowUnpublish,
    shouldShowDelete
  });

  // Общий адаптивный стиль для кнопок действий
  const baseButtonSx = {
    width: 36,
    height: 36,
    fontSize: '18px',
    borderRadius: 'var(--tg-radius-s)',
    '@media (max-width: 400px)': {
      width: 32,
      height: 32,
      fontSize: '16px'
    },
    '@media (max-width: 350px)': {
      width: 28,
      height: 28,
      fontSize: '14px'
    }
  };

  // Открытие диалога
  const handleOpenDialog = useCallback((action: ActionType) => {
    setDialogState({
      open: true,
      action,
      loading: false,
      error: null,
      blockReason: ''
    });
  }, []);

  // Закрытие диалога
  const handleCloseDialog = useCallback(() => {
    if (dialogState.loading) return; // Не закрываем во время загрузки
    setDialogState({
      open: false,
      action: null,
      loading: false,
      error: null,
      blockReason: ''
    });
  }, [dialogState.loading]);

  // Выполнение действия
  const handleConfirmAction = useCallback(async () => {
    if (!dialogState.action) return;

    setDialogState(prev => ({ ...prev, loading: true, error: null }));

    // Оптимистичное обновление UI в stores перед вызовом API
    const galleryStore = useStickerStore.getState();
    const profileStore = useProfileStore.getState();
    
    switch (dialogState.action) {
      case 'BLOCK':
        galleryStore.markAsBlocked(stickerSet.id, dialogState.blockReason.trim() || undefined);
        profileStore.markUserStickerAsBlocked(stickerSet.id, dialogState.blockReason.trim() || undefined);
        break;
      case 'UNBLOCK':
        galleryStore.markAsUnblocked(stickerSet.id);
        profileStore.markUserStickerAsUnblocked(stickerSet.id);
        break;
      case 'DELETE':
        galleryStore.markAsDeleted(stickerSet.id);
        profileStore.markUserStickerAsDeleted(stickerSet.id);
        break;
      case 'PUBLISH':
        galleryStore.markAsPublished(stickerSet.id);
        profileStore.markUserStickerAsPublished(stickerSet.id);
        break;
      case 'UNPUBLISH':
        galleryStore.markAsUnpublished(stickerSet.id);
        profileStore.markUserStickerAsUnpublished(stickerSet.id);
        break;
    }

    try {
      let updatedData: StickerSetResponse | undefined;

      switch (dialogState.action) {
        case 'DELETE':
          await apiClient.deleteStickerSet(stickerSet.id);
          break;

        case 'BLOCK':
          updatedData = await apiClient.blockStickerSet(
            stickerSet.id,
            dialogState.blockReason.trim() || undefined
          );
          break;

        case 'UNBLOCK':
          updatedData = await apiClient.unblockStickerSet(stickerSet.id);
          break;

        case 'PUBLISH':
          updatedData = await apiClient.publishStickerSet(stickerSet.id);
          break;

        case 'UNPUBLISH':
          updatedData = await apiClient.unpublishStickerSet(stickerSet.id);
          break;
      }

      // Уведомляем родительский компонент об успешном действии
      onActionComplete(dialogState.action, updatedData);

      // Закрываем диалог
      setDialogState({
        open: false,
        action: null,
        loading: false,
        error: null,
        blockReason: ''
      });
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Не удалось выполнить действие. Попробуйте позже.';
      
      setDialogState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
      
      console.error(`❌ Ошибка при выполнении действия ${dialogState.action}:`, error);
    }
  }, [dialogState.action, dialogState.blockReason, stickerSet.id, onActionComplete]);

  // Получение конфигурации для текущего действия
  const getActionConfig = (action: ActionType | null) => {
    switch (action) {
      case 'DELETE':
        return {
          emoji: '❌',
          title: 'Удалить стикерсет',
          description: 'Удалить стикерсет? Это действие необратимо. Стикерсет будет полностью удален из системы.',
          confirmText: 'Удалить',
          confirmColor: 'error' as const,
          tooltip: 'Удалить стикерсет'
        };
      case 'BLOCK':
        return {
          emoji: '🚫',
          title: 'Заблокировать стикерсет',
          description: 'Заблокировать стикерсет? Он будет скрыт для всех пользователей в галерее.',
          confirmText: 'Заблокировать',
          confirmColor: 'error' as const,
          tooltip: 'Заблокировать'
        };
      case 'UNBLOCK':
        return {
          emoji: '🔄',
          title: 'Разблокировать стикерсет',
          description: 'Разблокировать стикерсет? Он снова станет доступен в галерее.',
          confirmText: 'Разблокировать',
          confirmColor: 'success' as const,
          tooltip: 'Разблокировать'
        };
      case 'PUBLISH':
        return {
          emoji: '👁️',
          title: 'Опубликовать стикерсет',
          description: 'Опубликовать стикерсет? Он будет виден всем пользователям в галерее.',
          confirmText: 'Опубликовать',
          confirmColor: 'primary' as const,
          tooltip: 'Опубликовать'
        };
      case 'UNPUBLISH':
        return {
          emoji: '🙈',
          title: 'Скрыть стикерсет',
          description: 'Скрыть стикерсет из галереи? Он станет приватным и будет виден только вам.',
          confirmText: 'Скрыть',
          confirmColor: 'warning' as const,
          tooltip: 'Скрыть из галереи'
        };
      default:
        return null;
    }
  };

  const currentConfig = getActionConfig(dialogState.action);

  // Если нет доступных действий, ничего не рендерим
  if (!shouldShowDelete && !shouldShowBlock && !shouldShowUnblock && !shouldShowPublish && !shouldShowUnpublish) {
    return null;
  }

  return (
    <>
      <div
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--tg-spacing-2)',
          flexShrink: 0,
          '@media (max-width: 400px)': {
            gap: '4px'
          }
        }}
      >
        {shouldShowDelete && (
          <span title={getActionConfig('DELETE')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('DELETE')}
              sx={{
                ...baseButtonSx,
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                border: '1px solid rgba(244, 67, 54, 0.4)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.25)',
                  border: '1px solid rgba(244, 67, 54, 0.6)'
                }
              }}
            >
              ❌
            </IconButton>
          </span>
        )}

        {shouldShowBlock && (
          <span title={getActionConfig('BLOCK')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('BLOCK')}
              sx={{
                ...baseButtonSx,
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                border: '1px solid rgba(244, 67, 54, 0.4)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.25)',
                  border: '1px solid rgba(244, 67, 54, 0.6)'
                }
              }}
            >
              🚫
            </IconButton>
          </span>
        )}

        {shouldShowUnblock && (
          <span title={getActionConfig('UNBLOCK')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('UNBLOCK')}
              sx={{
                ...baseButtonSx,
                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(76, 175, 80, 0.25)',
                  border: '1px solid rgba(76, 175, 80, 0.6)'
                }
              }}
            >
              🔄
            </IconButton>
          </span>
        )}

        {shouldShowPublish && (
          <span title={getActionConfig('PUBLISH')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('PUBLISH')}
              sx={{
                ...baseButtonSx,
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                border: '1px solid rgba(33, 150, 243, 0.4)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(33, 150, 243, 0.25)',
                  border: '1px solid rgba(33, 150, 243, 0.6)'
                }
              }}
            >
              👁️
            </IconButton>
          </span>
        )}

        {shouldShowUnpublish && (
          <span title={getActionConfig('UNPUBLISH')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('UNPUBLISH')}
              sx={{
                ...baseButtonSx,
                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                border: '1px solid rgba(255, 152, 0, 0.4)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 152, 0, 0.25)',
                  border: '1px solid rgba(255, 152, 0, 0.6)'
                }
              }}
            >
              🙈
            </IconButton>
          </span>
        )}
      </div>

      {/* Модальное окно подтверждения */}
      {currentConfig && (
        <Dialog
          open={dialogState.open}
          onClose={handleCloseDialog}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            onClick: (e) => e.stopPropagation(),
            sx: {
              backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'white',
              backgroundImage: 'none',
              borderRadius: '21px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              margin: '21px',
              position: 'relative'
            }
          }}
          sx={{
            '& .MuiDialog-container': {
              alignItems: 'center',
              justifyContent: 'center'
            }
          }}
          BackdropProps={{
            onClick: (e) => {
              e.stopPropagation();
              handleCloseDialog();
            },
            sx: {
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)'
            }
          }}
        >
          <DialogTitle
            component="div"
            sx={{
              pb: 2,
              pt: 3,
              px: 3,
              color: 'white',
              fontSize: '1.4rem',
              fontWeight: 700,
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}
          >
            <span style={{ fontSize: '32px' }}>{currentConfig.emoji}</span>
            {currentConfig.title}
          </DialogTitle>
          <DialogContent
            dividers={false}
            onClick={(e) => e.stopPropagation()}
            sx={{
              backgroundColor: 'transparent',
              color: 'white',
              borderColor: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              px: 3,
              py: 2
            }}
          >
            {dialogState.error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 1,
                  backgroundColor: 'rgba(244, 67, 54, 0.15)',
                  backdropFilter: 'blur(8px)',
                  color: 'white',
                  border: '1px solid rgba(244, 67, 54, 0.4)',
                  '& .MuiAlert-icon': {
                    color: '#ff6b6b'
                  }
                }}
              >
                {dialogState.error}
              </Alert>
            )}

            <Typography 
              variant="body1" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                textAlign: 'center'
              }}
            >
              {currentConfig.description}
            </Typography>

            {dialogState.action === 'BLOCK' && (
              <TextField
                label="Причина блокировки"
                placeholder="Например: Нарушение авторских прав"
                multiline
                minRows={3}
                value={dialogState.blockReason}
                onChange={(e) =>
                  setDialogState(prev => ({ ...prev, blockReason: e.target.value }))
                }
                fullWidth
                helperText="Опционально. Укажите причину, чтобы автору было понятно, что нужно исправить."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '13px',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.3)'
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.5)'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.7)'
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.7)'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: 'white'
                  },
                  '& .MuiFormHelperText-root': {
                    color: 'rgba(255, 255, 255, 0.6)'
                  }
                }}
              />
            )}
          </DialogContent>
          <DialogActions
            onClick={(e) => e.stopPropagation()}
            sx={{
              backgroundColor: 'transparent',
              borderColor: 'transparent',
              px: 3,
              pb: 3,
              pt: 2,
              gap: '13px',
              justifyContent: 'center'
            }}
          >
            <IconButton
              onClick={handleCloseDialog}
              disabled={dialogState.loading}
              sx={{
                width: 55,
                height: 55,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                borderRadius: 'var(--tg-radius-l)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                transition: 'transform 150ms ease, background-color 150ms ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  transform: 'scale(1.05)'
                },
                '&:disabled': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.4)'
                }
              }}
            >
              <CloseIcon sx={{ fontSize: '24px' }} />
            </IconButton>
            <IconButton
              onClick={handleConfirmAction}
              disabled={dialogState.loading}
              sx={{
                width: 55,
                height: 55,
                backgroundColor: 
                  currentConfig.confirmColor === 'error' ? 'rgba(244, 67, 54, 0.3)' :
                  currentConfig.confirmColor === 'success' ? 'rgba(76, 175, 80, 0.3)' :
                  currentConfig.confirmColor === 'warning' ? 'rgba(255, 152, 0, 0.3)' :
                  'rgba(33, 150, 243, 0.3)',
                color: 
                  currentConfig.confirmColor === 'error' ? '#f44336' :
                  currentConfig.confirmColor === 'success' ? '#4CAF50' :
                  currentConfig.confirmColor === 'warning' ? '#ff9800' :
                  '#2196F3',
                borderRadius: 'var(--tg-radius-l)',
                border: 
                  currentConfig.confirmColor === 'error' ? '1px solid rgba(244, 67, 54, 0.5)' :
                  currentConfig.confirmColor === 'success' ? '1px solid rgba(76, 175, 80, 0.5)' :
                  currentConfig.confirmColor === 'warning' ? '1px solid rgba(255, 152, 0, 0.5)' :
                  '1px solid rgba(33, 150, 243, 0.5)',
                transition: 'transform 150ms ease, background-color 150ms ease',
                '&:hover': {
                  backgroundColor: 
                    currentConfig.confirmColor === 'error' ? 'rgba(244, 67, 54, 0.4)' :
                    currentConfig.confirmColor === 'success' ? 'rgba(76, 175, 80, 0.4)' :
                    currentConfig.confirmColor === 'warning' ? 'rgba(255, 152, 0, 0.4)' :
                    'rgba(33, 150, 243, 0.4)',
                  border: 
                    currentConfig.confirmColor === 'error' ? '1px solid rgba(244, 67, 54, 0.7)' :
                    currentConfig.confirmColor === 'success' ? '1px solid rgba(76, 175, 80, 0.7)' :
                    currentConfig.confirmColor === 'warning' ? '1px solid rgba(255, 152, 0, 0.7)' :
                    '1px solid rgba(33, 150, 243, 0.7)',
                  transform: 'scale(1.05)'
                },
                '&:disabled': {
                  backgroundColor: 
                    currentConfig.confirmColor === 'error' ? 'rgba(244, 67, 54, 0.1)' :
                    currentConfig.confirmColor === 'success' ? 'rgba(76, 175, 80, 0.1)' :
                    currentConfig.confirmColor === 'warning' ? 'rgba(255, 152, 0, 0.1)' :
                    'rgba(33, 150, 243, 0.1)',
                  color: 
                    currentConfig.confirmColor === 'error' ? 'rgba(244, 67, 54, 0.4)' :
                    currentConfig.confirmColor === 'success' ? 'rgba(76, 175, 80, 0.4)' :
                    currentConfig.confirmColor === 'warning' ? 'rgba(255, 152, 0, 0.4)' :
                    'rgba(33, 150, 243, 0.4)'
                }
              }}
            >
              {dialogState.loading ? (
                <CircularProgress 
                  size={24} 
                  sx={{ 
                    color: 
                      currentConfig.confirmColor === 'error' ? '#f44336' :
                      currentConfig.confirmColor === 'success' ? '#4CAF50' :
                      currentConfig.confirmColor === 'warning' ? '#ff9800' :
                      '#2196F3'
                  }} 
                />
              ) : (
                <SvgIcon sx={{ fontSize: '24px' }}>
                  {currentConfig.confirmColor === 'error' ? (
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 11c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z" />
                  ) : currentConfig.confirmColor === 'success' ? (
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  ) : (
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  )}
                </SvgIcon>
              )}
            </IconButton>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

