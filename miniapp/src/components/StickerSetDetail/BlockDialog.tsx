import { useState, useCallback, CSSProperties, FC } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
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

export const BlockDialog: FC<BlockDialogProps> = ({
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

  if (!open) return null;

  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1300,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  };
  const paperStyle: CSSProperties = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1301,
    width: '100%',
    maxWidth: 400,
    margin: 21,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    color: 'white',
    borderRadius: 21,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  };

  return (
    <>
      <div role="presentation" style={backdropStyle} onClick={handleClose} />
      <div role="dialog" aria-modal="true" style={paperStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '24px 24px 16px', color: 'white', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}>
          Заблокировать стикерсет
        </div>
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {blockError && (
            <div style={{
              padding: 12,
              backgroundColor: 'rgba(244, 67, 54, 0.15)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(244, 67, 54, 0.4)',
              borderRadius: 8,
            }}>
              {blockError}
            </div>
          )}
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
            Стикерсет будет скрыт из галереи для всех пользователей. Укажите причину блокировки
            (опционально), чтобы авторам было понятно, что нужно исправить.
          </p>
          <textarea
            placeholder="Например: Нарушение авторских прав"
            rows={3}
            value={blockReasonInput}
            onChange={(e) => setBlockReasonInput(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 13,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: 12,
              fontSize: 14,
              resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '13px', justifyContent: 'center', padding: '0 24px 24px' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isBlocking}
            style={{
              width: 55,
              height: 55,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              borderRadius: 'var(--tg-radius-l)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              cursor: isBlocking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={24} />
          </button>
          <button
            type="button"
            onClick={handleBlock}
            disabled={isBlocking}
            style={{
              width: 55,
              height: 55,
              backgroundColor: 'rgba(244, 67, 54, 0.3)',
              color: '#f44336',
              borderRadius: 'var(--tg-radius-l)',
              border: '1px solid rgba(244, 67, 54, 0.5)',
              cursor: isBlocking ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isBlocking ? (
              <div style={{
                width: 24,
                height: 24,
                border: '2px solid rgba(244, 67, 54, 0.3)',
                borderTopColor: '#f44336',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 11c-.55 0-1-.45-1-1V8c0-.55.45-1 1-1s1 .45 1 1v4c0 .55-.45 1-1 1zm1 4h-2v-2h2v2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

