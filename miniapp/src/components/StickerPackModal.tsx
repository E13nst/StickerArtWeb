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
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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