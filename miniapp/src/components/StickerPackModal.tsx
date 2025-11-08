import React from 'react';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';
import { ModalBackdrop } from './ModalBackdrop';

interface StickerPackModalProps {
  open: boolean;
  stickerSet: StickerSetResponse | null;
  onClose: () => void;
  onLike?: (id: number, title: string) => void;
  enableCategoryEditing?: boolean;
  infoVariant?: 'default' | 'minimal';
  onCategoriesUpdated?: (updated: StickerSetResponse) => void;
}

export const StickerPackModal: React.FC<StickerPackModalProps> = ({
  open,
  stickerSet,
  onClose,
  onLike,
  enableCategoryEditing = false,
  infoVariant = 'default',
  onCategoriesUpdated
}) => {
  if (!stickerSet) return null;

  return (
    <ModalBackdrop open={open} onClose={onClose}>
      <StickerSetDetail
        stickerSet={stickerSet}
        onBack={onClose}
        onShare={() => {}}
        onLike={onLike}
        isInTelegramApp={true}
        isModal={true}
        enableCategoryEditing={enableCategoryEditing}
        infoVariant={infoVariant}
        onCategoriesUpdated={onCategoriesUpdated}
      />
    </ModalBackdrop>
  );
};