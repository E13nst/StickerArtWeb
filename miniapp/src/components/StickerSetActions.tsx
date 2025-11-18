import React, { useState, useCallback } from 'react';
import {
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Alert,
  Tooltip
} from '@mui/material';
import { StickerSetResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { useStickerStore } from '@/store/useStickerStore';
import { useProfileStore } from '@/store/useProfileStore';

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
  const shouldShowDelete = availableActions.includes('DELETE');
  const shouldShowBlock = availableActions.includes('BLOCK') && !stickerSet.isBlocked;
  const shouldShowUnblock = availableActions.includes('UNBLOCK') && stickerSet.isBlocked;
  const shouldShowPublish = availableActions.includes('PUBLISH') && !stickerSet.isPublic;
  const shouldShowUnpublish = availableActions.includes('UNPUBLISH') && stickerSet.isPublic;

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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--tg-spacing-2)',
          flexShrink: 0
        }}
      >
        {shouldShowDelete && (
          <Tooltip title={getActionConfig('DELETE')?.tooltip}>
            <IconButton
              onClick={() => handleOpenDialog('DELETE')}
              sx={{
                width: 36,
                height: 36,
                fontSize: '18px',
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                border: '1px solid rgba(244, 67, 54, 0.4)',
                color: 'white',
                borderRadius: 'var(--tg-radius-s)',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.25)',
                  border: '1px solid rgba(244, 67, 54, 0.6)'
                }
              }}
            >
              ❌
            </IconButton>
          </Tooltip>
        )}

        {shouldShowBlock && (
          <Tooltip title={getActionConfig('BLOCK')?.tooltip}>
            <IconButton
              onClick={() => handleOpenDialog('BLOCK')}
              sx={{
                width: 36,
                height: 36,
                fontSize: '18px',
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                border: '1px solid rgba(244, 67, 54, 0.4)',
                color: 'white',
                borderRadius: 'var(--tg-radius-s)',
                '&:hover': {
                  backgroundColor: 'rgba(244, 67, 54, 0.25)',
                  border: '1px solid rgba(244, 67, 54, 0.6)'
                }
              }}
            >
              🚫
            </IconButton>
          </Tooltip>
        )}

        {shouldShowUnblock && (
          <Tooltip title={getActionConfig('UNBLOCK')?.tooltip}>
            <IconButton
              onClick={() => handleOpenDialog('UNBLOCK')}
              sx={{
                width: 36,
                height: 36,
                fontSize: '18px',
                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                color: 'white',
                borderRadius: 'var(--tg-radius-s)',
                '&:hover': {
                  backgroundColor: 'rgba(76, 175, 80, 0.25)',
                  border: '1px solid rgba(76, 175, 80, 0.6)'
                }
              }}
            >
              🔄
            </IconButton>
          </Tooltip>
        )}

        {shouldShowPublish && (
          <Tooltip title={getActionConfig('PUBLISH')?.tooltip}>
            <IconButton
              onClick={() => handleOpenDialog('PUBLISH')}
              sx={{
                width: 36,
                height: 36,
                fontSize: '18px',
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                border: '1px solid rgba(33, 150, 243, 0.4)',
                color: 'white',
                borderRadius: 'var(--tg-radius-s)',
                '&:hover': {
                  backgroundColor: 'rgba(33, 150, 243, 0.25)',
                  border: '1px solid rgba(33, 150, 243, 0.6)'
                }
              }}
            >
              👁️
            </IconButton>
          </Tooltip>
        )}

        {shouldShowUnpublish && (
          <Tooltip title={getActionConfig('UNPUBLISH')?.tooltip}>
            <IconButton
              onClick={() => handleOpenDialog('UNPUBLISH')}
              sx={{
                width: 36,
                height: 36,
                fontSize: '18px',
                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                border: '1px solid rgba(255, 152, 0, 0.4)',
                color: 'white',
                borderRadius: 'var(--tg-radius-s)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 152, 0, 0.25)',
                  border: '1px solid rgba(255, 152, 0, 0.6)'
                }
              }}
            >
              🙈
            </IconButton>
          </Tooltip>
        )}
      </Box>

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
              backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
              color: 'var(--tg-theme-text-color, #000000)',
              backgroundImage: 'none'
            }
          }}
          BackdropProps={{
            onClick: (e) => {
              e.stopPropagation();
              handleCloseDialog();
            }
          }}
        >
          <DialogTitle
            component="div"
            sx={{
              pb: 2,
              color: 'var(--tg-theme-text-color, #000000)',
              fontSize: '1.25rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <span style={{ fontSize: '24px' }}>{currentConfig.emoji}</span>
            {currentConfig.title}
          </DialogTitle>
          <DialogContent
            dividers
            onClick={(e) => e.stopPropagation()}
            sx={{
              backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
              color: 'var(--tg-theme-text-color, #000000)',
              borderColor: 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            {dialogState.error && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {dialogState.error}
              </Alert>
            )}

            <Typography variant="body1" sx={{ color: 'var(--tg-theme-text-color, #000000)' }}>
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
              />
            )}
          </DialogContent>
          <DialogActions
            onClick={(e) => e.stopPropagation()}
            sx={{
              backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
              borderColor: 'var(--tg-theme-border-color, rgba(0, 0, 0, 0.12))'
            }}
          >
            <Button
              onClick={handleCloseDialog}
              disabled={dialogState.loading}
              sx={{
                color: 'var(--tg-theme-button-color, #2481cc)'
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleConfirmAction}
              variant="contained"
              color={currentConfig.confirmColor}
              disabled={dialogState.loading}
            >
              {dialogState.loading ? 'Выполняем...' : currentConfig.confirmText}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

