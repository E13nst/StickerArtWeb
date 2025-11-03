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
      <StickerSetDetail
        stickerSet={stickerSet}
        onBack={onClose}
        onShare={() => {}}
        onLike={onLike}
        isInTelegramApp={true}
        isModal={true}
      />
    </ModalBackdrop>
  );
};