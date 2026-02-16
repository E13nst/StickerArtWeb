import { useEffect, useState, useCallback, FC } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
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
  onSaved: (stickerFileId: string) => void;
}

function getSetPreviewUrl(set: StickerSetResponse): string {
  const stickers = set.telegramStickerSetInfo?.stickers ?? set.previewStickers;
  const first = stickers?.[0];
  const fileId = first?.file_id ?? (first as { fileId?: string })?.fileId;
  return fileId ? getStickerThumbnailUrl(fileId, 80) : '';
}

function getStickerCount(set: StickerSetResponse): number {
  return set.stickerCount ?? set.telegramStickerSetInfo?.stickers?.length ?? 0;
}

export const SaveToStickerSetModal: FC<SaveToStickerSetModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageId,
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

  const handleSelectSet = async (set: StickerSetResponse) => {
    if (!imageId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.saveImageToStickerSet({
        imageUuid: imageId,
        stickerSetName: set.name,
        emoji: '🎨',
      });
      onSaved(res.stickerFileId);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAndSave = async () => {
    const name = newSetName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    if (!name || !imageId || saving) {
      setCreateError('Введите название набора');
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const created = await apiClient.createStickerSet({
        name: name.toLowerCase(),
        title: newSetName.trim(),
      });
      const res = await apiClient.saveImageToStickerSet({
        imageUuid: imageId,
        stickerSetName: created.name,
        emoji: '🎨',
      });
      onSaved(res.stickerFileId);
      onClose();
    } catch (e: any) {
      setCreateError(e?.message ?? 'Не удалось создать набор');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Сохранить в пак" showCloseButton>
      <div className="save-to-stickerset-modal">
        {imageUrl && (
          <div className="save-to-stickerset-modal__preview">
            <img src={imageUrl} alt="Превью" />
          </div>
        )}

        {!createMode ? (
          <>
            <div className="save-to-stickerset-modal__list">
              {loading ? (
                <p className="save-to-stickerset-modal__hint">Загрузка наборов...</p>
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
                      <span className="save-to-stickerset-modal__count">
                        {getStickerCount(set)} стикеров
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
    </BottomSheet>
  );
};
