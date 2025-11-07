import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Typography
} from '@mui/material';
import { ModalBackdrop } from './ModalBackdrop';
import { apiClient } from '@/api/client';
import { getStickerImageUrl, getStickerThumbnailUrl } from '@/utils/stickerUtils';
import type { Sticker, StickerSetResponse, CategoryResponse } from '@/types/sticker';

interface UploadStickerPackModalProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (stickerSet: StickerSetResponse) => Promise<void> | void;
}

type Step = 'link' | 'categories';

type TelegramStickerSetInfo = {
  name?: string;
  title?: string;
  stickers?: Sticker[];
};

export const UploadStickerPackModal: React.FC<UploadStickerPackModalProps> = ({
  open,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<Step>('link');
  const [link, setLink] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [createdStickerSet, setCreatedStickerSet] = useState<StickerSetResponse | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isApplyingCategories, setIsApplyingCategories] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);

  const resetState = () => {
    setStep('link');
    setLink('');
    setIsSubmittingLink(false);
    setLinkError(null);
    setCreatedStickerSet(null);
    setCategories([]);
    setCategoriesError(null);
    setSelectedCategories([]);
    setIsApplyingCategories(false);
    setSuggestionLoading(false);
    setSuggestionError(null);
    setSuggestionsFetched(false);
    setIsPreviewLoading(false);
    setActivePreviewIndex(0);
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleClose = () => {
    if (isSubmittingLink || isApplyingCategories || step === 'categories') {
      return;
    }
    resetState();
    onClose();
  };

  const handleSubmitLink = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!link.trim()) {
      setLinkError('Пожалуйста, введите ссылку или имя стикерсета');
      return;
    }

    setIsSubmittingLink(true);
    setLinkError(null);
    setSuggestionError(null);
    setSuggestionsFetched(false);
    setSelectedCategories([]);

    try {
      const payload = { name: link.trim() };
      setIsPreviewLoading(true);
      const stickerSet = await apiClient.createStickerSet(payload);

      let hydratedStickerSet = stickerSet;
      try {
        if (!stickerSet.telegramStickerSetInfo?.stickers?.length && stickerSet.id) {
          hydratedStickerSet = await apiClient.getStickerSet(stickerSet.id);
        }
      } catch (fetchError) {
        console.warn('⚠️ Не удалось загрузить полные данные стикерсета сразу после создания', fetchError);
      }

      setCreatedStickerSet(hydratedStickerSet);

      const existingCategoryKeys = (hydratedStickerSet.categories || [])
        .map((category) => category?.key)
        .filter((key): key is string => Boolean(key));
      setSelectedCategories(existingCategoryKeys);

      setStep('categories');
    } catch (error: any) {
      const message = error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Не удалось создать стикерсет. Проверьте ссылку и попробуйте снова.';
      setLinkError(message);
    } finally {
      setIsPreviewLoading(false);
      setIsSubmittingLink(false);
    }
  };

  const loadCategories = async () => {
    if (categoriesLoading || categories.length > 0) {
      return;
    }

    setCategoriesLoading(true);
    setCategoriesError(null);

    try {
      const data = await apiClient.getCategories();
      setCategories(data);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Не удалось загрузить категории';
      setCategoriesError(message);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadSuggestions = async (title: string | undefined) => {
    if (!title || suggestionsFetched) {
      return;
    }

    setSuggestionLoading(true);
    setSuggestionError(null);

    try {
      const suggestion = await apiClient.suggestCategoriesForTitle(title);
      setSuggestionsFetched(true);

      if (suggestion?.suggestedCategories?.length) {
        const suggestionKeys = suggestion.suggestedCategories
          .map((item) => item.categoryKey)
          .filter((key): key is string => Boolean(key));

        if (suggestionKeys.length > 0) {
          setSelectedCategories(suggestionKeys);
        }
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'AI не смог подобрать категории.';
      setSuggestionError(message);
    } finally {
      setSuggestionLoading(false);
    }
  };

  useEffect(() => {
    if (open && step === 'categories') {
      loadCategories();
    }
  }, [open, step]);

  const normalizedTelegramInfo = useMemo<TelegramStickerSetInfo | null>(() => {
    if (!createdStickerSet?.telegramStickerSetInfo) {
      return null;
    }

    const info = createdStickerSet.telegramStickerSetInfo as unknown;
    if (typeof info === 'string') {
      try {
        return JSON.parse(info) as TelegramStickerSetInfo;
      } catch (error) {
        console.warn('⚠️ Не удалось распарсить telegramStickerSetInfo', error);
        return null;
      }
    }

    return info as TelegramStickerSetInfo;
  }, [createdStickerSet]);

  useEffect(() => {
    if (!createdStickerSet || step !== 'categories') {
      return;
    }

    const fallbackTitle = createdStickerSet.title || normalizedTelegramInfo?.title;
    if (!fallbackTitle) {
      setSuggestionsFetched(true);
      return;
    }

    loadSuggestions(fallbackTitle);
  }, [createdStickerSet, step, normalizedTelegramInfo]);

  const previewStickers = useMemo(() => {
    const stickers = normalizedTelegramInfo?.stickers;
    if (!stickers || stickers.length === 0) {
      return [];
    }

    return stickers.filter((sticker): sticker is Sticker => Boolean(sticker));
  }, [normalizedTelegramInfo?.stickers]);

  const displayTitle = useMemo(() => {
    return createdStickerSet?.title
      || normalizedTelegramInfo?.title
      || 'Новый стикерсет';
  }, [createdStickerSet?.title, normalizedTelegramInfo?.title]);

  const displayName = useMemo(() => {
    return createdStickerSet?.name
      || normalizedTelegramInfo?.name;
  }, [createdStickerSet?.name, normalizedTelegramInfo?.name]);

  useEffect(() => {
    if (previewStickers.length === 0) {
      setActivePreviewIndex(0);
      return;
    }

    setActivePreviewIndex((prev) => {
      if (prev < previewStickers.length) {
        return prev;
      }
      return previewStickers.length - 1;
    });
  }, [previewStickers.length]);

  useEffect(() => {
    if (!open) {
      setActivePreviewIndex(0);
    }
  }, [open]);

  const handleCategoryToggle = (key: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(key)) {
        return prev.filter((categoryKey) => categoryKey !== key);
      }
      return [...prev, key];
    });
  };

  const handleApplyCategories = async () => {
    if (!createdStickerSet) {
      return;
    }

    setIsApplyingCategories(true);
    setCategoriesError(null);

    try {
      const updatedStickerSet = await apiClient.updateStickerSetCategories(createdStickerSet.id, selectedCategories);
      setCreatedStickerSet(updatedStickerSet);

      if (onComplete) {
        await onComplete(updatedStickerSet);
      }

      resetState();
      onClose();
    } catch (error: any) {
      const message = error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Не удалось сохранить категории. Попробуйте позже.';
      setCategoriesError(message);
    } finally {
      setIsApplyingCategories(false);
    }
  };

  const renderLinkStep = () => (
    <form onSubmit={handleSubmitLink}>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 600,
          marginBottom: '20px',
          color: 'var(--tg-theme-text-color, #000000)',
          textAlign: 'center'
        }}
      >
        Создайте новый стикерсет
      </Typography>

      <TextField
        fullWidth
        label="Ссылка или имя стикерсета"
        placeholder="https://t.me/addstickers/..."
        value={link}
        onChange={(event) => {
          setLink(event.target.value);
          setLinkError(null);
        }}
        disabled={isSubmittingLink}
        sx={{
          marginBottom: '16px',
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
            color: 'var(--tg-theme-text-color, #000000)',
            '& fieldset': {
              borderColor: 'var(--tg-theme-border-color, #e0e0e0)'
            },
            '&:hover fieldset': {
              borderColor: 'var(--tg-theme-button-color, #2481cc)'
            },
            '&.Mui-focused fieldset': {
              borderColor: 'var(--tg-theme-button-color, #2481cc)'
            }
          },
          '& .MuiInputLabel-root': {
            color: 'var(--tg-theme-hint-color, #999999)'
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: 'var(--tg-theme-button-color, #2481cc)'
          }
        }}
      />

      {linkError && (
        <Alert
          severity="error"
          sx={{
            marginBottom: '16px',
            backgroundColor: 'rgba(211, 47, 47, 0.1)',
            color: 'var(--tg-theme-text-color, #000000)',
            '& .MuiAlert-icon': {
              color: '#d32f2f'
            }
          }}
        >
          {linkError}
        </Alert>
      )}

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={isSubmittingLink || !link.trim()}
        sx={{
          py: 1.5,
          borderRadius: '12px',
          backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
          color: 'var(--tg-theme-button-text-color, #ffffff)',
          fontSize: '16px',
          fontWeight: 600,
          textTransform: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          '&:hover': {
            backgroundColor: 'var(--tg-theme-button-color, #2481cc)',
            opacity: 0.9,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          },
          '&:disabled': {
            backgroundColor: 'var(--tg-theme-hint-color, #999999)',
            opacity: 0.5
          }
        }}
      >
        {isSubmittingLink ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: 'var(--tg-theme-button-text-color, #ffffff)' }} />
            <span>Создание...</span>
          </Box>
        ) : (
          'Создать стикерсет'
        )}
      </Button>
    </form>
  );

  const renderPreviewStrip = () => {
    if (isPreviewLoading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: 'var(--tg-theme-hint-color)' }} />
        </Box>
      );
    }

    if (previewStickers.length === 0) {
      return (
        <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
            Превью недоступно
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Box
          sx={{
            width: '100%',
            maxWidth: 420,
            display: 'flex',
            gap: 1.5,
            overflowX: 'auto',
            overflowY: 'hidden',
            padding: '12px 10px',
            borderRadius: '16px',
            border: '1px solid var(--tg-theme-border-color)',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            scrollSnapType: 'x proximity',
            maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {previewStickers.map((sticker, index) => {
            const isActive = index === activePreviewIndex;
            const thumbFileId = (sticker as any)?.thumb?.file_id || sticker.file_id;
            const thumbUrl = getStickerThumbnailUrl(thumbFileId, 128);

            const handleSelect = () => setActivePreviewIndex(index);

            const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActivePreviewIndex(index);
              }
            };

            return (
              <Box
                key={`${sticker.file_id}-${index}`}
                role="button"
                tabIndex={0}
                onClick={handleSelect}
                onKeyDown={handleKeyDown}
                sx={{
                  flex: '0 0 auto',
                  width: 96,
                  height: 96,
                  borderRadius: '16px',
                  border: isActive ? '2px solid var(--tg-theme-button-color, #2481cc)' : '1px solid var(--tg-theme-border-color, rgba(0,0,0,0.12))',
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  outline: 'none',
                  overflow: 'hidden',
                  transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isActive ? '0 8px 24px rgba(30, 72, 185, 0.22)' : '0 2px 10px rgba(0,0,0,0.12)',
                  scrollSnapAlign: 'center'
                }}
              >
                {sticker.is_video ? (
                  <video
                    src={thumbUrl || getStickerImageUrl(sticker.file_id)}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={thumbUrl || getStickerImageUrl(sticker.file_id)}
                    alt={sticker.emoji || `Sticker ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  const renderCategoriesStep = () => (
    <>
      <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color)', mb: 2 }}>
        Добавьте категории
      </Typography>

      <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)', mb: 2 }}>
        Вы получите +10 ART после публикации набора
      </Typography>

      <Box
        sx={{
          borderRadius: '16px',
          border: '1px solid var(--tg-theme-border-color)',
          backgroundColor: 'var(--tg-theme-bg-color)',
          mb: 2,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 2, gap: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
            {displayTitle}
          </Typography>
          {displayName ? (
            <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)', wordBreak: 'break-word' }}>
              @{displayName}
            </Typography>
          ) : null}
          {renderPreviewStrip()}
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color)', mb: 1 }}>
        Выберите категории для стикерсета:
      </Typography>

      {suggestionLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" sx={{ color: 'var(--tg-theme-hint-color)' }}>
            AI подбирает лучшие категории...
          </Typography>
        </Box>
      )}

      {suggestionError && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {suggestionError}
        </Alert>
      )}

      {categoriesLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" sx={{ color: 'var(--tg-theme-hint-color)' }}>
            Загрузка категорий...
          </Typography>
        </Box>
      ) : categoriesError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {categoriesError}
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            maxHeight: '220px',
            overflowY: 'auto',
            pb: 1,
            pr: 0.5,
            borderRadius: '12px',
            border: '1px solid var(--tg-theme-border-color)',
            padding: '12px'
          }}
        >
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.key);
            return (
              <Chip
                key={category.key}
                label={category.name}
                onClick={() => handleCategoryToggle(category.key)}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  cursor: 'pointer',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'transform 0.15s ease',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  '&:hover': {
                    transform: 'scale(1.05)'
                  }
                }}
              />
            );
          })}
        </Box>
      )}

      <Button
        fullWidth
        variant="contained"
        onClick={handleApplyCategories}
        disabled={isApplyingCategories}
        sx={{
          mt: 3,
          py: 1.5,
          borderRadius: '12px',
          backgroundColor: 'var(--tg-theme-button-color)',
          color: 'var(--tg-theme-button-text-color)',
          fontSize: '16px',
          fontWeight: 600,
          textTransform: 'none'
        }}
      >
        {isApplyingCategories ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: 'var(--tg-theme-button-text-color)' }} />
            <span>Сохраняем...</span>
          </Box>
        ) : (
          'Подтвердить категории'
        )}
      </Button>
    </>
  );

  return (
    <ModalBackdrop open={open} onClose={handleClose}>
      <Box
        sx={{
          width: '90%',
          maxWidth: '440px',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
          borderRadius: '16px',
          padding: { xs: '20px 18px', sm: '24px' },
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          animation: open ? 'modalSlideIn 0.3s ease-out' : 'modalSlideOut 0.2s ease-in',
          '@keyframes modalSlideIn': {
            '0%': {
              opacity: 0,
              transform: 'translateY(-20px) scale(0.95)'
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0) scale(1)'
            }
          },
          '@keyframes modalSlideOut': {
            '0%': {
              opacity: 1,
              transform: 'translateY(0) scale(1)'
            },
            '100%': {
              opacity: 0,
              transform: 'translateY(-20px) scale(0.95)'
            }
          }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {step === 'link' ? renderLinkStep() : renderCategoriesStep()}
      </Box>
    </ModalBackdrop>
  );
};

