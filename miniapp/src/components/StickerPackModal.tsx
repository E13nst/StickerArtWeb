import React from 'react';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';
import { ModalBackdrop } from './ModalBackdrop';

interface StickerPackModalProps {
  open: boolean;
  stickerSet: StickerSetResponse | null;
  onClose: () => void;
  onLike?: (id: number, title: string) => void;
}

export const StickerPackModal: React.FC<StickerPackModalProps> = ({ open, stickerSet, onClose, onLike }) => {
  if (!stickerSet) return null;

  return (
    <ModalBackdrop open={open}>
      <div 
        data-testid="sticker-pack-modal"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1301,
        }}
        onClick={(e) => {
          // Закрываем модальное окно при клике на фон
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <StickerSetDetail
          stickerSet={stickerSet}
          onBack={onClose}
          onShare={() => {}}
          onLike={onLike}
          isInTelegramApp={true}
        />
      </div>
    </ModalBackdrop>
  );
};