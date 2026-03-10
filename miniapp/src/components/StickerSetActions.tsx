import { useState, useCallback, useEffect, ReactNode, CSSProperties, FC, MouseEvent, ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/ui/Icons';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@/components/ui/Dialog';
import { Text } from '@/components/ui/Text';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
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
  style = {},
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  sx?: Record<string, unknown>;
  style?: CSSProperties;
}) {
  const computedStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: (sx.border as string) ?? 'none',
    padding: 0,
    background: 'transparent',
    width: (sx.width as number) ?? 36,
    height: (sx.height as number) ?? 36,
    fontSize: (sx.fontSize as string) ?? '18px',
    borderRadius: (sx.borderRadius as string) ?? 'var(--tg-radius-s)',
    backgroundColor: sx.backgroundColor as string,
    color: sx.color as string,
    transition: (sx.transition as string) ?? 'transform 150ms ease, background-color 150ms ease',
    ...style,
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={computedStyle}>
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

export const StickerSetActions: FC<StickerSetActionsProps> = ({
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

  // Общий адаптивный стиль для кнопок действий
  const baseButtonSx = {
    width: '36px',
    height: '36px',
    fontSize: '18px',
    borderRadius: 'var(--tg-radius-s)',
    '@media (max-width: 400px)': {
      width: '32px',
      height: '32px',
      fontSize: '16px'
    },
    '@media (max-width: 350px)': {
      width: '28px',
      height: '28px',
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

  // Закрытие диалога — action оставляем до конца анимации, чтобы Dialog успел отыграть
  const DIALOG_CLOSE_MS = 350;
  const handleCloseDialog = useCallback(() => {
    if (dialogState.loading) return;
    setDialogState(prev => ({ ...prev, open: false }));
  }, [dialogState.loading]);

  // Сброс action после анимации закрытия (чтобы размонтировать portal)
  useEffect(() => {
    if (!dialogState.open && dialogState.action) {
      const t = setTimeout(() => {
        setDialogState(prev => ({ ...prev, action: null, loading: false, error: null, blockReason: '' }));
      }, DIALOG_CLOSE_MS);
      return () => clearTimeout(t);
    }
  }, [dialogState.open, dialogState.action]);

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

      onActionComplete(dialogState.action, updatedData);
      setDialogState(prev => ({ ...prev, open: false }));
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--tg-spacing-2)',
          flexShrink: 0
        }}
      >
        {shouldShowDelete && (
          <span title={getActionConfig('DELETE')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('DELETE')}
              style={{
                ...baseButtonSx,
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                border: '1px solid rgba(244, 67, 54, 0.4)',
                color: 'white'
              }}
            >
              🗑️
            </IconButton>
          </span>
        )}

        {shouldShowBlock && (
          <span title={getActionConfig('BLOCK')?.tooltip ?? ''} style={{ display: 'inline-flex' }}>
            <IconButton
              onClick={() => handleOpenDialog('BLOCK')}
              style={{
                ...baseButtonSx,
                backgroundColor: 'rgba(244, 67, 54, 0.15)',
                border: '1px solid rgba(244, 67, 54, 0.4)',
                color: 'white'
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
              style={{
                ...baseButtonSx,
                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                color: 'white'
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
              style={{
                ...baseButtonSx,
                backgroundColor: 'rgba(33, 150, 243, 0.15)',
                border: '1px solid rgba(33, 150, 243, 0.4)',
                color: 'white'
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
              style={{
                ...baseButtonSx,
                backgroundColor: 'rgba(255, 152, 0, 0.15)',
                border: '1px solid rgba(255, 152, 0, 0.4)',
                color: 'white'
              }}
            >
              🙈
            </IconButton>
          </span>
        )}
      </div>

      {/* Модальное окно подтверждения — в портал, чтобы открывалось над StickerSetDetail и было кликабельно */}
      {currentConfig && typeof document !== 'undefined' && createPortal(
        <Dialog open={dialogState.open} onClose={handleCloseDialog}>
          <DialogTitle style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 24px 16px' }}>
            <span style={{ fontSize: '32px' }}>{currentConfig.emoji}</span>
            {currentConfig.title}
          </DialogTitle>
          <DialogContent style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 24px 16px' }} onClick={(e: MouseEvent) => e.stopPropagation()}>
            {dialogState.error && (
              <Alert severity="error" style={{ marginBottom: '8px', backgroundColor: 'rgba(244, 67, 54, 0.15)', color: 'white', border: '1px solid rgba(244, 67, 54, 0.4)' }}>
                {dialogState.error}
              </Alert>
            )}

            <Text variant="body" style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', lineHeight: 1.5, textAlign: 'center' }}>
              {currentConfig.description}
            </Text>

            {dialogState.action === 'BLOCK' && (
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.7)', fontSize: '14px'}}>Причина блокировки</label>
                <textarea
                  placeholder="Например: Нарушение авторских прав"
                  rows={3}
                  value={dialogState.blockReason}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDialogState(prev => ({ ...prev, blockReason: e.target.value }))}
                  style={{ width: '100%', padding: 12, color: 'white', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '13px', border: 'none', boxSizing: 'border-box' }}
                />
                <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Опционально. Укажите причину, чтобы автору было понятно, что нужно исправить.</span>
              </div>
            )}
          </DialogContent>
          <DialogActions style={{ padding: '8px 24px 24px', gap: '13px', justifyContent: 'center' }} onClick={(e: MouseEvent) => e.stopPropagation()}>
            <IconButton
              onClick={handleCloseDialog}
              disabled={dialogState.loading}
              style={{ width: '55px', height: '55px', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white', borderRadius: 'var(--tg-radius-l)', border: 'none' }}
            >
              <CloseIcon size={24} />
            </IconButton>
            <IconButton
              onClick={handleConfirmAction}
              disabled={dialogState.loading}
              style={{
                width: '55px',
                height: '55px',
                backgroundColor: currentConfig.confirmColor === 'error' ? 'rgba(244, 67, 54, 0.3)' : currentConfig.confirmColor === 'success' ? 'rgba(76, 175, 80, 0.3)' : currentConfig.confirmColor === 'warning' ? 'rgba(255, 152, 0, 0.3)' : 'rgba(33, 150, 243, 0.3)',
                color: currentConfig.confirmColor === 'error' ? '#f44336' : currentConfig.confirmColor === 'success' ? '#4CAF50' : currentConfig.confirmColor === 'warning' ? '#ff9800' : '#2196F3',
                borderRadius: 'var(--tg-radius-l)',
                border: currentConfig.confirmColor === 'error' ? '1px solid rgba(244, 67, 54, 0.5)' : currentConfig.confirmColor === 'success' ? '1px solid rgba(76, 175, 80, 0.5)' : currentConfig.confirmColor === 'warning' ? '1px solid rgba(255, 152, 0, 0.5)' : '1px solid rgba(33, 150, 243, 0.5)'
              }}
            >
              {dialogState.loading ? (
                <Spinner size={24} style={{ color: currentConfig.confirmColor === 'error' ? '#f44336' : currentConfig.confirmColor === 'success' ? '#4CAF50' : currentConfig.confirmColor === 'warning' ? '#ff9800' : '#2196F3' }} />
              ) : dialogState.action === 'DELETE' ? (
                <span style={{ fontSize: '22px', lineHeight: 1 }}>🗑️</span>
              ) : dialogState.action === 'BLOCK' ? (
                <span style={{ fontSize: '22px', lineHeight: 1 }}>🚫</span>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </IconButton>
          </DialogActions>
        </Dialog>,
        document.body
      )}
    </>
  );
};

