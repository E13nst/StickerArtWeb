import React, { useState, useCallback, useEffect } from 'react';
import { CloseIcon } from '@/components/ui/Icons';
import { CategoryResponse } from '@/types/sticker';
import { apiClient } from '@/api/client';
import { StickerSetResponse } from '@/types/sticker';

interface CategoriesDialogProps {
  open: boolean;
  onClose: () => void;
  stickerSetId: number;
  currentCategoryKeys: string[];
  onSave: (updated: StickerSetResponse) => void;
  fullStickerSet?: StickerSetResponse | null;
  stickerSet: StickerSetResponse;
}

export const CategoriesDialog: React.FC<CategoriesDialogProps> = ({
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

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1300,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  };
  const paperStyle: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1301,
    width: '100%',
    maxWidth: 400,
    margin: 21,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    color: 'white',
    borderRadius: 21,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  };

  return (
    <>
      <div role="presentation" style={backdropStyle} onClick={handleClose} />
      <div role="dialog" aria-modal="true" style={paperStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '24px 24px 16px', color: 'white', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center' }}>
          Добавьте категории
        </div>
        <div style={{ padding: '0 24px 24px', backgroundColor: 'transparent', color: 'white' }}>
          {categorySaveError && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              backgroundColor: 'rgba(244, 67, 54, 0.15)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(244, 67, 54, 0.4)',
              borderRadius: 8,
            }}>
              {categorySaveError}
            </div>
          )}

          <p style={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 16, fontSize: '0.95rem' }}>
            Доступные категории
          </p>

          {categoriesLoading && availableCategories.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 18,
                height: 18,
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Загрузка категорий…</span>
            </div>
          ) : categoriesLoadError ? (
            <div style={{
              marginBottom: 16,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              backgroundColor: 'rgba(244, 67, 54, 0.15)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(244, 67, 54, 0.4)',
              borderRadius: 8,
            }}>
              <span>{categoriesLoadError}</span>
              <button
                type="button"
                onClick={loadCategories}
                style={{
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Повторить загрузку
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {availableCategories.map((category) => {
                const isSelected = selectedCategoryKeys.includes(category.key);
                return (
                  <button
                    type="button"
                    key={category.key}
                    onClick={() => handleToggleCategory(category.key)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 13,
                      backgroundColor: isSelected ? 'rgba(33, 150, 243, 0.3)' : 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: isSelected ? 700 : 600,
                      whiteSpace: 'nowrap',
                      border: isSelected ? '2px solid rgba(33, 150, 243, 0.6)' : '1px solid rgba(255, 255, 255, 0.25)',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          )}

          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', textAlign: 'center', fontWeight: 500, margin: 0 }}>
            Выбрано категорий: {selectedCategoryKeys.length}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 13, justifyContent: 'center', padding: '0 24px 24px' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSavingCategories}
            style={{
              width: 55,
              height: 55,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              borderRadius: 'var(--tg-radius-l)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              cursor: isSavingCategories ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CloseIcon size={24} />
          </button>
          <button
            type="button"
            onClick={handleSaveCategories}
            disabled={isSavingCategories}
            style={{
              width: 55,
              height: 55,
              backgroundColor: 'rgba(76, 175, 80, 0.3)',
              color: '#4CAF50',
              borderRadius: 'var(--tg-radius-l)',
              border: '1px solid rgba(76, 175, 80, 0.5)',
              cursor: isSavingCategories ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSavingCategories ? (
              <div style={{
                width: 24,
                height: 24,
                border: '2px solid rgba(76, 175, 80, 0.3)',
                borderTopColor: '#4CAF50',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

