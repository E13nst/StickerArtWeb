import { useState, useCallback, useEffect, FC } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/ui/Icons';
import { CategoryResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { StickerSetResponse } from '@/types/sticker';
import { ModalBackdrop } from '../ModalBackdrop';
import './CategoriesDialog.css';

interface CategoriesDialogProps {
  open: boolean;
  onClose: () => void;
  stickerSetId: number;
  currentCategoryKeys: string[];
  onSave: (updated: StickerSetResponse) => void;
  fullStickerSet?: StickerSetResponse | null;
  stickerSet: StickerSetResponse;
}

export const CategoriesDialog: FC<CategoriesDialogProps> = ({
  open,
  onClose,
  stickerSetId,
  currentCategoryKeys,
  onSave,
  fullStickerSet,
  stickerSet
}) => {
  const [availableCategories, setAvailableCategories] = useState<CategoryResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(null);
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<string[]>(currentCategoryKeys);
  const [isSavingCategories, setIsSavingCategories] = useState(false);
  const [categorySaveError, setCategorySaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedCategoryKeys(currentCategoryKeys);
    }
  }, [currentCategoryKeys, open]);

  const loadCategories = useCallback(async () => {
    if (availableCategories.length > 0) return;
    setCategoriesLoading(true);
    setCategoriesLoadError(null);
    try {
      const data = await apiClient.getCategories();
      setAvailableCategories(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось загрузить категории';
      setCategoriesLoadError(message);
    } finally {
      setCategoriesLoading(false);
    }
  }, [availableCategories.length]);

  useEffect(() => {
    if (open) {
      setCategorySaveError(null);
      setCategoriesLoadError(null);
      loadCategories();
    }
  }, [open, loadCategories]);

  const handleToggleCategory = useCallback((key: string) => {
    setSelectedCategoryKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  }, []);

  const handleSaveCategories = useCallback(async () => {
    setIsSavingCategories(true);
    setCategorySaveError(null);
    try {
      const updated = await apiClient.updateStickerSetCategories(stickerSetId, selectedCategoryKeys);
      const mergedUpdate = {
        ...updated,
        telegramStickerSetInfo: updated.telegramStickerSetInfo || fullStickerSet?.telegramStickerSetInfo || stickerSet.telegramStickerSetInfo,
        previewStickers: updated.previewStickers || fullStickerSet?.previewStickers || stickerSet.previewStickers
      };
      onSave(mergedUpdate);
      onClose();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось сохранить категории. Попробуйте позже.';
      setCategorySaveError(message);
    } finally {
      setIsSavingCategories(false);
    }
  }, [selectedCategoryKeys, stickerSetId, onSave, onClose, fullStickerSet, stickerSet]);

  const handleClose = useCallback(() => {
    if (isSavingCategories) return;
    onClose();
  }, [isSavingCategories, onClose]);

  if (!open) return null;

  const dialogContent = (
    <ModalBackdrop open={open} onClose={handleClose}>
      <div
        className="categories-dialog"
        data-modal-content
        onClick={(e) => e.stopPropagation()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Добавьте категории"
          className="categories-dialog__panel"
        >
          {/* Handle */}
          <div className="categories-dialog__handle" />

          {/* Шапка */}
          <div className="categories-dialog__header">
            <h2 className="categories-dialog__title">Добавьте категории</h2>
            <button
              type="button"
              className="categories-dialog__close-btn"
              onClick={handleClose}
              disabled={isSavingCategories}
              aria-label="Закрыть"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Ошибка сохранения */}
          {categorySaveError && (
            <div className="categories-dialog__error">
              {categorySaveError}
            </div>
          )}

          {/* Подзаголовок */}
          <p className="categories-dialog__subtitle">
            Доступные категории
          </p>

          {/* Область скролла с категориями */}
          <div className="categories-dialog__body">
            {categoriesLoading && availableCategories.length === 0 ? (
              <div className="categories-dialog__loading">
                <div className="categories-dialog__spinner" />
                <span className="categories-dialog__loading-text">Загрузка категорий…</span>
              </div>
            ) : categoriesLoadError ? (
              <div className="categories-dialog__load-error">
                <span className="categories-dialog__load-error-text">{categoriesLoadError}</span>
                <button
                  type="button"
                  className="categories-dialog__retry-btn"
                  onClick={loadCategories}
                >
                  Повторить загрузку
                </button>
              </div>
            ) : (
              <div className="categories-dialog__chips">
                {availableCategories.map((category) => {
                  const isSelected = selectedCategoryKeys.includes(category.key);
                  return (
                    <button
                      type="button"
                      key={category.key}
                      onClick={() => handleToggleCategory(category.key)}
                      className={`categories-dialog__chip${isSelected ? ' categories-dialog__chip--selected' : ''}`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Футер */}
          <div className="categories-dialog__footer">
            <p className="categories-dialog__count">
              Выбрано категорий: {selectedCategoryKeys.length}
            </p>
            <div className="categories-dialog__actions">
              <button
                type="button"
                className="categories-dialog__cancel-btn"
                onClick={handleClose}
                disabled={isSavingCategories}
                aria-label="Отмена"
              >
                Отмена
              </button>
              <button
                type="button"
                className="categories-dialog__save-btn"
                onClick={handleSaveCategories}
                disabled={isSavingCategories}
                aria-label="Сохранить"
              >
                {isSavingCategories ? (
                  <div className="categories-dialog__save-spinner" />
                ) : (
                  'Сохранить'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );

  return createPortal(dialogContent, document.body);
};
