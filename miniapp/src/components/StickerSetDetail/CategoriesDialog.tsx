import React, { useState, useCallback, useEffect } from 'react';
;
import { CloseIcon } from '@/components/ui/Icons';;
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

  const dialogStyles = {
    PaperProps: {
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      sx: {
        backgroundColor: 'rgba(var(--tg-theme-bg-color-rgb, 255, 255, 255), 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        color: 'white',
        backgroundImage: 'none',
        borderRadius: '21px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        margin: '21px',
        position: 'relative'
      }
    },
    sx: {
      '& .MuiDialog-container': {
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
    BackdropProps: {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        handleClose();
      },
      sx: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      {...dialogStyles}
    >
      <DialogTitle 
        component="div"
        sx={{ 
          pb: 2,
          pt: 3,
          px: 3,
          color: 'white',
          fontSize: '1.4rem',
          fontWeight: 700,
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          textAlign: 'center'
        }}
      >
        Добавьте категории
      </DialogTitle>
      <DialogContent 
        dividers={false}
        onClick={(e) => e.stopPropagation()}
        sx={{
          backgroundColor: 'transparent',
          color: 'white',
          borderColor: 'transparent',
          px: 3,
          py: 2
        }}
      >
        {categorySaveError && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              backgroundColor: 'rgba(244, 67, 54, 0.15)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(244, 67, 54, 0.4)',
              '& .MuiAlert-icon': {
                color: '#ff6b6b'
              }
            }}
          >
            {categorySaveError}
          </Alert>
        )}

        <Typography 
          variant="subtitle2" 
          sx={{ 
            fontWeight: 600, 
            color: 'rgba(255, 255, 255, 0.9)', 
            mb: 2,
            fontSize: '0.95rem',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)'
          }}
        >
          Доступные категории
        </Typography>
        
        {categoriesLoading && availableCategories.length === 0 ? (
          <div sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CircularProgress size={18} sx={{ color: 'white' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Загрузка категорий…
            </Typography>
          </div>
        ) : categoriesLoadError ? (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1,
              backgroundColor: 'rgba(244, 67, 54, 0.15)',
              backdropFilter: 'blur(8px)',
              color: 'white',
              border: '1px solid rgba(244, 67, 54, 0.4)',
              '& .MuiAlert-icon': {
                color: '#ff6b6b'
              }
            }}
          >
            <span>{categoriesLoadError}</span>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={loadCategories}
              sx={{
                color: 'white',
                borderColor: 'rgba(255, 255, 255, 0.3)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Повторить загрузку
            </Button>
          </Alert>
        ) : (
          <div sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', mb: 2 }}>
            {availableCategories.map((category) => {
              const isSelected = selectedCategoryKeys.includes(category.key);
              return (
                <div
                  key={category.key}
                  onClick={() => handleToggleCategory(category.key)}
                  sx={{
                    padding: '8px 16px',
                    borderRadius: '13px',
                    backgroundColor: isSelected 
                      ? 'rgba(33, 150, 243, 0.3)' 
                      : 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: isSelected ? 700 : 600,
                    whiteSpace: 'nowrap',
                    border: isSelected 
                      ? '2px solid rgba(33, 150, 243, 0.6)' 
                      : '1px solid rgba(255, 255, 255, 0.25)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    '&:hover': {
                      backgroundColor: isSelected 
                        ? 'rgba(33, 150, 243, 0.4)' 
                        : 'rgba(255, 255, 255, 0.25)',
                      border: isSelected 
                        ? '2px solid rgba(33, 150, 243, 0.8)' 
                        : '1px solid rgba(255, 255, 255, 0.4)',
                      transform: 'scale(1.03)'
                    }
                  }}
                >
                  {category.name}
                </div>
              );
            })}
          </div>
        )}

        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.9rem',
            textAlign: 'center',
            fontWeight: 500
          }}
        >
          Выбрано категорий: {selectedCategoryKeys.length}
        </Typography>
      </DialogContent>
      <DialogActions 
        onClick={(e) => e.stopPropagation()}
        sx={{
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          px: 3,
          pb: 3,
          pt: 2,
          gap: '13px',
          justifyContent: 'center'
        }}
      >
        <IconButton
          onClick={handleClose} 
          disabled={isSavingCategories}
          sx={{
            width: 55,
            height: 55,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            borderRadius: 'var(--tg-radius-l)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            transition: 'transform 150ms ease, background-color 150ms ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              transform: 'scale(1.05)'
            },
            '&:disabled': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.4)'
            }
          }}
        >
          <CloseIcon sx={{ fontSize: '24px' }} />
        </IconButton>
        <IconButton
          onClick={handleSaveCategories}
          disabled={isSavingCategories}
          sx={{
            width: 55,
            height: 55,
            backgroundColor: 'rgba(76, 175, 80, 0.3)',
            color: '#4CAF50',
            borderRadius: 'var(--tg-radius-l)',
            border: '1px solid rgba(76, 175, 80, 0.5)',
            transition: 'transform 150ms ease, background-color 150ms ease',
            '&:hover': {
              backgroundColor: 'rgba(76, 175, 80, 0.4)',
              border: '1px solid rgba(76, 175, 80, 0.7)',
              transform: 'scale(1.05)'
            },
            '&:disabled': {
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              color: 'rgba(76, 175, 80, 0.4)'
            }
          }}
        >
          {isSavingCategories ? (
            <CircularProgress size={24} sx={{ color: '#4CAF50' }} />
          ) : (
            <SvgIcon sx={{ fontSize: '24px' }}>
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </SvgIcon>
          )}
        </IconButton>
      </DialogActions>
    </Dialog>
  );
};

