import React, { useState, useCallback } from 'react';
;
import { CloseIcon } from '@/components/ui/Icons';;
import { StickerSetResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';

interface BlockDialogProps {
  open: boolean;
  onClose: () => void;
  stickerSetId: number;
  onBlock: (updated: StickerSetResponse) => void;
  fullStickerSet?: StickerSetResponse | null;
  stickerSet: StickerSetResponse;
}

export const BlockDialog: React.FC<BlockDialogProps> = ({
  open,
  onClose,
  stickerSetId,
  onBlock,
  fullStickerSet,
  stickerSet
}) => {
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isBlocking) return;
    onClose();
    setBlockError(null);
    setBlockReasonInput('');
  }, [isBlocking, onClose]);

  const handleBlock = useCallback(async () => {
    if (!stickerSetId) return;
    setIsBlocking(true);
    setBlockError(null);
    try {
      const updated = await apiClient.blockStickerSet(
        stickerSetId,
        blockReasonInput.trim() ? blockReasonInput.trim() : undefined
      );
      const mergedUpdate: StickerSetResponse = {
        ...(fullStickerSet ?? stickerSet),
        ...updated,
        telegramStickerSetInfo:
          updated.telegramStickerSetInfo || fullStickerSet?.telegramStickerSetInfo || stickerSet.telegramStickerSetInfo,
        previewStickers: updated.previewStickers || fullStickerSet?.previewStickers || stickerSet.previewStickers,
        availableActions: updated.availableActions
      };
      onBlock(mergedUpdate);
      handleClose();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось заблокировать стикерсет.';
      setBlockError(message);
    } finally {
      setIsBlocking(false);
    }
  }, [stickerSetId, blockReasonInput, fullStickerSet, stickerSet, onBlock, handleClose]);

  const dialogStyles = {
    PaperProps: {
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      sx: {
        backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        color: 'white',
        backgroundImage: 'none',
        borderRadius: '21px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        margin: '21px'
      }
    },
    BackdropProps: {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        handleClose();
      },
      sx: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      {...dialogStyles}
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
          textAlign: 'center'
        }}
      >
        Заблокировать стикерсет
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
        {blockError && (
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
            {blockError}
          </Alert>
        )}
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '0.95rem',
            lineHeight: 1.5
          }}
        >
          Стикерсет будет скрыт из галереи для всех пользователей. Укажите причину блокировки
          (опционально), чтобы авторам было понятно, что нужно исправить.
        </Typography>
        <TextField
          label="Причина блокировки"
          placeholder="Например: Нарушение авторских прав"
          multiline
          minRows={3}
          value={blockReasonInput}
          onChange={(event) => setBlockReasonInput(event.target.value)}
          fullWidth
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
            }
          }}
        />
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
          onClick={handleClose}
          disabled={isBlocking}
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
          onClick={handleBlock}
          disabled={isBlocking}
          sx={{
            width: 55,
            height: 55,
            backgroundColor: 'rgba(244, 67, 54, 0.3)',
            color: '#f44336',
            borderRadius: 'var(--tg-radius-l)',
            border: '1px solid rgba(244, 67, 54, 0.5)',
            transition: 'transform 150ms ease, background-color 150ms ease',
            '&:hover': {
              backgroundColor: 'rgba(244, 67, 54, 0.4)',
              border: '1px solid rgba(244, 67, 54, 0.7)',
              transform: 'scale(1.05)'
            },
            '&:disabled': {
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: 'rgba(244, 67, 54, 0.4)'
            }
          }}
        >
          {isBlocking ? (
            <CircularProgress size={24} sx={{ color: '#f44336' }} />
          ) : (
            <SvgIcon sx={{ fontSize: '24px' }}>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 11c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z" />
            </SvgIcon>
          )}
        </IconButton>
      </DialogActions>
    </Dialog>
  );
};

