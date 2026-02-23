import { useEffect, useRef, FC } from 'react';
import { createPortal } from 'react-dom';
import { StickerSetResponse } from '@/types/sticker';
import { StickerSetDetail } from './StickerSetDetail';
import { ModalBackdrop } from './ModalBackdrop';
import { imageCache, animationCache, clearStickerBlobsExcept } from '@/utils/imageLoader';

interface StickerPackModalProps {
  open: boolean;
  stickerSet: StickerSetResponse | null;
  onClose: () => void;
  enableCategoryEditing?: boolean;
  infoVariant?: 'default' | 'minimal';
  onCategoriesUpdated?: (updated: StickerSetResponse) => void;
  onStickerSetUpdated?: (updated: StickerSetResponse) => void;
}

export const StickerPackModal: FC<StickerPackModalProps> = ({
  open,
  stickerSet,
  onClose,
  enableCategoryEditing = false,
  infoVariant = 'default',
  onCategoriesUpdated,
  onStickerSetUpdated
}) => {
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Сохраняем последний stickerSet, чтобы ModalBackdrop не размонтировался мгновенно
  // при onClose (родитель ставит stickerSet=null одновременно с open=false).
  // Без этого ModalBackdrop не успевает отыграть 350ms close-анимацию,
  // body.modal-open снимается сразу, и CSS-защита (pointer-events:none) пропадает.
  const lastSetRef = useRef<StickerSetResponse | null>(null);
  if (stickerSet) lastSetRef.current = stickerSet;
  const displaySet = stickerSet || lastSetRef.current;

  // Пауза/возобновление фоновых видео
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (open) {
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        if (!video.closest('[data-modal-content]')) {
          video.setAttribute('data-was-playing', !video.paused ? 'true' : 'false');
          if (!video.paused) video.pause();
        }
      });
    }

    return () => {
      const videos = document.querySelectorAll('video[data-was-playing="true"]');
      videos.forEach((video) => {
        const rect = video.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          (video as HTMLVideoElement).play().catch(() => {});
        }
        video.removeAttribute('data-was-playing');
      });
    };
  }, [open]);

  // Очистка кэша стикеров после закрытия
  useEffect(() => {
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }

    if (!open && stickerSet) {
      const preserveIds = new Set<string>();
      stickerSet.previewStickers?.forEach((preview: any) => {
        const id = preview?.fileId || preview?.file_id || preview?.telegramFileId || preview?.telegram_file_id;
        if (id) preserveIds.add(id);
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
        clearStickerBlobsExcept();
        cleanupTimeoutRef.current = null;
      }, 5000);
    }

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };
  }, [open, stickerSet]);

  // Очищаем lastSetRef после завершения close-анимации
  useEffect(() => {
    if (!open && !stickerSet) {
      const timer = setTimeout(() => { lastSetRef.current = null; }, 400);
      return () => clearTimeout(timer);
    }
  }, [open, stickerSet]);

  if (!displaySet) return null;

  // Рендер в portal (как у панели фильтров): модалка поверх всего, navbar не скрывается
  const modal = (
    <ModalBackdrop open={open} onClose={onClose} noBlur keepNavbarVisible>
      <StickerSetDetail
        stickerSet={displaySet}
        onBack={onClose}
        onShare={() => {}}
        isInTelegramApp={true}
        isModal={true}
        enableCategoryEditing={enableCategoryEditing}
        infoVariant={infoVariant}
        onCategoriesUpdated={onCategoriesUpdated}
        onStickerSetUpdated={onStickerSetUpdated}
      />
    </ModalBackdrop>
  );
  return createPortal(modal, document.body);
};