import React, { useEffect, useRef } from 'react';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';
import { ModalBackdrop } from './ModalBackdrop';
import { imageCache } from '@/utils/galleryUtils';
import { animationCache, clearStickerBlobsExcept } from '@/utils/animationLoader';

interface StickerPackModalProps {
  open: boolean;
  stickerSet: StickerSetResponse | null;
  onClose: () => void;
  onLike?: (id: number, title: string) => void;
  enableCategoryEditing?: boolean;
  infoVariant?: 'default' | 'minimal';
  onCategoriesUpdated?: (updated: StickerSetResponse) => void;
  onStickerSetUpdated?: (updated: StickerSetResponse) => void;
}

export const StickerPackModal: React.FC<StickerPackModalProps> = ({
  open,
  stickerSet,
  onClose,
  onLike,
  enableCategoryEditing = false,
  infoVariant = 'default',
  onCategoriesUpdated,
  onStickerSetUpdated
}) => {
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return () => undefined;
    }

    const applyLock = (shouldLock: boolean) => {
      if (shouldLock) {
        document.body.classList.add('modal-lock');
        document.documentElement.classList.add('modal-lock');
      } else {
        document.body.classList.remove('modal-lock');
        document.documentElement.classList.remove('modal-lock');
      }
    };

    applyLock(open);

    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }

    if (!open && stickerSet) {
      const preserveIds = new Set<string>();
      stickerSet.previewStickers?.forEach((preview: any) => {
        const id = preview?.fileId || preview?.file_id || preview?.telegramFileId || preview?.telegram_file_id;
        if (id) {
          preserveIds.add(id);
        }
      });

      cleanupTimeoutRef.current = setTimeout(() => {
        const stickers = stickerSet.telegramStickerSetInfo?.stickers ?? [];
        stickers.forEach((sticker: any) => {
          const fileId = sticker?.file_id;
          if (fileId && !preserveIds.has(fileId)) {
            imageCache.delete(fileId);
            animationCache.delete(fileId);
          }
          const thumbId = sticker?.thumb?.file_id;
          if (thumbId && !preserveIds.has(thumbId)) {
            imageCache.delete(thumbId);
          }
        });
        clearStickerBlobsExcept(preserveIds);
        cleanupTimeoutRef.current = null;
      }, 5000);
    }

    return () => {
      applyLock(false);
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, [open, stickerSet]);

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
        onStickerSetUpdated={onStickerSetUpdated}
      />
    </ModalBackdrop>
  );
};