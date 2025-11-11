import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';
import { ModalBackdrop } from './ModalBackdrop';
import { imageCache } from '@/utils/galleryUtils';
import { animationCache, clearStickerBlobsExcept } from '@/utils/animationLoader';
import { apiClient } from '@/api/client';

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
  const initialVisibilityRef = useRef<boolean | null>(null);
  const [pendingVisibility, setPendingVisibility] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (!stickerSet) {
      initialVisibilityRef.current = null;
      setPendingVisibility(null);
      return;
    }

    const currentVisibility =
      typeof stickerSet.isPublic === 'boolean' ? stickerSet.isPublic : true;
    initialVisibilityRef.current = currentVisibility;
    setPendingVisibility(null);
  }, [stickerSet?.id, stickerSet?.isPublic]);

  const effectiveVisibility = useMemo(() => {
    if (pendingVisibility !== null) {
      return pendingVisibility;
    }
    if (initialVisibilityRef.current !== null) {
      return initialVisibilityRef.current;
    }
    return stickerSet?.isPublic ?? true;
  }, [pendingVisibility, stickerSet?.isPublic]);

  const hasVisibilityChange =
    pendingVisibility !== null &&
    initialVisibilityRef.current !== null &&
    pendingVisibility !== initialVisibilityRef.current;

  const handleVisibilityToggle = useCallback((next: boolean) => {
    setPendingVisibility(() => {
      const initial = initialVisibilityRef.current;
      if (initial === null) {
        // Если по какой-то причине не инициализировано - считаем текущее значением по умолчанию
        initialVisibilityRef.current = next;
        return null;
      }
      return next === initial ? null : next;
    });
  }, []);

  const handleClose = useCallback(() => {
    const currentSticker = stickerSet;
    const nextVisibility =
      hasVisibilityChange && pendingVisibility !== null
        ? pendingVisibility
        : initialVisibilityRef.current ?? currentSticker?.isPublic ?? true;

    const shouldUpdate =
      Boolean(currentSticker) &&
      hasVisibilityChange &&
      pendingVisibility !== null &&
      initialVisibilityRef.current !== null;

    onClose();

    if (shouldUpdate && currentSticker) {
      const action = nextVisibility
        ? apiClient.publishStickerSet(currentSticker.id)
        : apiClient.unpublishStickerSet(currentSticker.id);

      action
        .then((updated) => {
          onStickerSetUpdated?.(updated);
        })
        .catch((error) => {
          console.error('❌ Ошибка обновления видимости стикерсета:', error);
        });
    }
  }, [hasVisibilityChange, onClose, onStickerSetUpdated, pendingVisibility, stickerSet]);

  if (!stickerSet) return null;

  return (
    <ModalBackdrop open={open} onClose={handleClose}>
      <StickerSetDetail
        stickerSet={stickerSet}
        onBack={handleClose}
        onShare={() => {}}
        onLike={onLike}
        isInTelegramApp={true}
        isModal={true}
        enableCategoryEditing={enableCategoryEditing}
        infoVariant={infoVariant}
        onCategoriesUpdated={onCategoriesUpdated}
        visibilityOverride={effectiveVisibility}
        onVisibilityToggle={handleVisibilityToggle}
        visibilityDirty={hasVisibilityChange}
      />
    </ModalBackdrop>
  );
};