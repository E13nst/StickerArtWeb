import { useEffect, useState, useCallback, useRef, FC } from 'react';
import { createPortal } from 'react-dom';
import { ModalBackdrop } from '@/components/ModalBackdrop';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/api/client';
import { useProfileStore } from '@/store/useProfileStore';
import { getStickerThumbnailUrl } from '@/utils/stickerUtils';
import type { StickerSetResponse } from '@/types/sticker';
import './SaveToStickerSetModal.css';

export interface SaveToStickerSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  imageId: string | null;
  taskId: string | null;
  userId: number | null;
  onSaved: (stickerFileId?: string | null) => void;
}

function buildStickerSetName(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'my_pack';
}

function getSetPreviewUrl(set: StickerSetResponse): string {
  const stickers = set.telegramStickerSetInfo?.stickers ?? set.previewStickers;
  const first = stickers?.[0];
  const fileId = first?.file_id ?? (first as { fileId?: string })?.fileId;
  return fileId ? getStickerThumbnailUrl(fileId, 80) : '';
}

function getVisibilityLabel(set: StickerSetResponse): 'Public' | 'Private' {
  if (set.isPrivate === true) return 'Private';
  if (set.isPublished === true) return 'Public';
  if (set.visibility === 'PUBLIC' || set.visibility === 'VISIBLE') return 'Public';
  if (set.visibility === 'PRIVATE' || set.visibility === 'HIDDEN') return 'Private';
  if (set.isPublic === true) return 'Public';
  if (set.isPublic === false) return 'Private';
  return 'Private';
}

const DISMISS_THRESHOLD = 100;
const DRAG_ANIMATION_MS = 200;

export const SaveToStickerSetModal: FC<SaveToStickerSetModalProps> = ({
  isOpen,
  onClose,
  imageId,
  taskId,
  userId,
  onSaved,
}) => {
  const userInfo = useProfileStore((state) => state.userInfo);
  const [sets, setSets] = useState<StickerSetResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingDownRef = useRef(false);

  const loadSets = useCallback(async () => {
    if (!userInfo?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getUserStickerSets(userInfo.id, 0, 50, 'createdAt', 'DESC', true);
      const botSuffix = '_by_stixlybot';
      const ownSets = (res.content ?? []).filter(s => s.name.endsWith(botSuffix));
      setSets(ownSets);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить наборы');
    } finally {
      setLoading(false);
    }
  }, [userInfo?.id]);

  useEffect(() => {
    if (isOpen) {
      loadSets();
      setCreateMode(false);
      setNewSetName('');
      setCreateError(null);
    }
  }, [isOpen, loadSets]);

  // Drag-to-dismiss как у StickerSetDetail
  useEffect(() => {
    if (!isOpen) return;

    const modalElement = contentRef.current;
    if (!modalElement) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (modalElement.scrollTop <= 0) {
        touchStartYRef.current = e.touches[0].clientY;
      } else {
        touchStartYRef.current = null;
      }
      isDraggingDownRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;

      const deltaY = e.touches[0].clientY - touchStartYRef.current;

      if (deltaY > 5) {
        isDraggingDownRef.current = true;
        e.preventDefault();
        modalElement.style.transition = 'none';
        modalElement.style.transform = `translateY(${deltaY}px)`;
        modalElement.classList.add('save-to-stickerset-modal__card--dragging');
      } else if (deltaY < -5) {
        touchStartYRef.current = null;
        isDraggingDownRef.current = false;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartYRef.current === null || !isDraggingDownRef.current) {
        touchStartYRef.current = null;
        isDraggingDownRef.current = false;
        return;
      }

      e.preventDefault();

      const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
      touchStartYRef.current = null;
      isDraggingDownRef.current = false;

      const backdrop = modalElement.closest('.modal-backdrop') as HTMLElement | null;

      if (deltaY > DISMISS_THRESHOLD) {
        modalElement.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        modalElement.style.transform = 'translateY(100vh)';

        setTimeout(() => {
          modalElement.classList.remove('save-to-stickerset-modal__card--dragging');
          modalElement.classList.add('save-to-stickerset-modal__card--drag-dismissed');
          if (backdrop && !backdrop.classList.contains('modal-backdrop--keep-navbar')) {
            backdrop.classList.add('modal-backdrop--drag-dismissed');
          }
          onClose();
        }, DRAG_ANIMATION_MS);
      } else {
        modalElement.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        modalElement.style.transform = 'translateY(0)';

        setTimeout(() => {
          modalElement.style.transition = '';
          modalElement.style.transform = '';
          modalElement.classList.remove('save-to-stickerset-modal__card--dragging');
        }, DRAG_ANIMATION_MS);
      }
    };

    modalElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    modalElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    modalElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      modalElement.removeEventListener('touchstart', handleTouchStart);
      modalElement.removeEventListener('touchmove', handleTouchMove);
      modalElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, onClose]);

  const handleSelectSet = async (set: StickerSetResponse) => {
    if ((!imageId && !taskId) || saving) return;
    setSaving(true);
    setError(null);
    try {
      let stickerFileId: string | undefined;

      if (taskId && userId) {
        const response = await apiClient.saveToStickerSetV2({
          taskId,
          userId,
          name: set.name,
          title: set.title || set.name,
          emoji: '🎨',
        });
        if (response.status === '202' || response.status === 'PENDING') {
          throw new Error('Стикер ещё не готов для сохранения. Попробуйте снова через пару секунд.');
        }
        stickerFileId = response.stickerFileId;
        if (!stickerFileId && response.status !== '200') {
          const status = await apiClient.getGenerationStatusV2(taskId);
          stickerFileId = status.telegramSticker?.fileId;
        }
      } else if (imageId) {
        const res = await apiClient.saveImageToStickerSet({
          imageUuid: imageId,
          stickerSetName: set.name,
          emoji: '🎨',
        });
        stickerFileId = res.stickerFileId;
      }

      if (!stickerFileId && !taskId) {
        throw new Error('Стикер сохранён, но fileId пока недоступен. Попробуйте снова через пару секунд.');
      }

      onSaved(stickerFileId ?? null);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSave = async () => {
    const title = newSetName.trim();
    if (!title || (!imageId && !taskId) || saving) {
      setCreateError('Введите название набора');
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      let stickerFileId: string | undefined;

      if (taskId && userId) {
        const response = await apiClient.saveToStickerSetV2({
          taskId,
          userId,
          name: buildStickerSetName(title),
          title,
          emoji: '🎨',
        });
        if (response.status === '202' || response.status === 'PENDING') {
          throw new Error('Стикер ещё не готов для сохранения. Попробуйте снова через пару секунд.');
        }
        stickerFileId = response.stickerFileId;
        if (!stickerFileId && response.status !== '200') {
          const status = await apiClient.getGenerationStatusV2(taskId);
          stickerFileId = status.telegramSticker?.fileId;
        }
      } else if (imageId) {
        const created = await apiClient.createNewStickerSet({
          imageUuid: imageId,
          title,
          name: buildStickerSetName(title) || undefined,
        });
        stickerFileId =
          (created as { stickerFileId?: string }).stickerFileId ??
          created.telegramStickerSetInfo?.stickers?.[0]?.file_id;
      }

      if (stickerFileId) {
        onSaved(stickerFileId);
      } else if (taskId) {
        onSaved(null);
      } else {
        throw new Error('Стикер сохранён, но fileId пока недоступен. Попробуйте снова через пару секунд.');
      }
      onClose();
    } catch (e: any) {
      setCreateError(e?.message ?? 'Не удалось создать набор');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <ModalBackdrop open={isOpen} onClose={onClose} noBlur keepNavbarVisible>
      <div
        ref={contentRef}
        data-modal-content
        className="save-to-stickerset-modal__card"
      >
        <div className="save-to-stickerset-modal__handle" aria-hidden="true" />
        <h2 className="save-to-stickerset-modal__header">Сохранить в пак</h2>
        <div className="save-to-stickerset-modal">
          {!createMode ? (
            <>
              <div className="save-to-stickerset-modal__list">
                {loading ? (
                  <div className="save-to-stickerset-modal__list-inner">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="save-to-stickerset-modal__item save-to-stickerset-modal__item--skeleton">
                        <span className="save-to-stickerset-modal__num" />
                        <div className="save-to-stickerset-modal__thumb" />
                        <span className="save-to-stickerset-modal__title" />
                        <span className="save-to-stickerset-modal__status" />
                      </div>
                    ))}
                  </div>
                ) : sets.length === 0 ? (
                  <p className="save-to-stickerset-modal__hint">У вас пока нет наборов. Создайте новый.</p>
                ) : (
                  <div className="save-to-stickerset-modal__list-inner">
                    {sets.map((set, i) => (
                      <button
                        key={set.id}
                        type="button"
                        className="save-to-stickerset-modal__item"
                        onClick={() => handleSelectSet(set)}
                        disabled={saving}
                      >
                        <span className="save-to-stickerset-modal__num">{i + 1}</span>
                        <div className="save-to-stickerset-modal__thumb">
                          <img src={getSetPreviewUrl(set)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                        <span className="save-to-stickerset-modal__title">{set.title || set.name}</span>
                        <span className="save-to-stickerset-modal__status">
                          {getVisibilityLabel(set)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="save-to-stickerset-modal__error">{error}</p>}

              <p className="save-to-stickerset-modal__hint">Выберите набор или создайте новый</p>

              <Button
                variant="primary"
                size="medium"
                onClick={() => setCreateMode(true)}
                disabled={saving}
                className="save-to-stickerset-modal__create-btn"
              >
                Создать новый набор
              </Button>
            </>
          ) : (
            <div className="save-to-stickerset-modal__create">
              <input
                type="text"
                className="save-to-stickerset-modal__input"
                placeholder="Название набора"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                disabled={saving}
              />
              {createError && <p className="save-to-stickerset-modal__error">{createError}</p>}
              <div className="save-to-stickerset-modal__create-actions">
                <Button variant="secondary" size="medium" onClick={() => setCreateMode(false)} disabled={saving}>
                  Назад
                </Button>
                <Button
                  variant="primary"
                  size="medium"
                  onClick={handleCreateAndSave}
                  loading={saving}
                  disabled={saving}
                >
                  Создать и сохранить
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  );

  return createPortal(modal, document.body);
};
