import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ModalBackdrop } from './ModalBackdrop';
import { apiClient } from '@/api/client';
import { AnimatedSticker } from './AnimatedSticker';
import { getStickerImageUrl } from '@/utils/stickerUtils';
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

  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false);

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
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleClose = () => {
    if (isSubmittingLink || isApplyingCategories) {
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
      const stickerSet = await apiClient.createStickerSet(payload);
      setCreatedStickerSet(stickerSet);

      const existingCategoryKeys = (stickerSet.categories || [])
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

  const previewSticker = useMemo(() => {
    const stickers = normalizedTelegramInfo?.stickers;
    if (!stickers || stickers.length === 0) {
      return null;
    }

    return stickers.find((sticker) => sticker != null) || stickers[0];
  }, [normalizedTelegramInfo]);

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

  const renderPreview = () => {
    if (!previewSticker) {
      return (
        <Box
          sx={{
            width: '100%',
            height: '200px',
            borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-secondary-bg-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--tg-theme-hint-color)'
          }}
        >
          Превью недоступно
        </Box>
      );
    }

    const imageUrl = getStickerImageUrl(previewSticker.file_id);

    if (previewSticker.is_animated) {
      return (
        <AnimatedSticker
          fileId={previewSticker.file_id}
          imageUrl={imageUrl}
          emoji={previewSticker.emoji}
          className="sticker-preview"
        />
      );
    }

    if (previewSticker.is_video) {
      return (
        <video
          src={imageUrl}
          style={{ width: '100%', height: '100%', borderRadius: '12px' }}
          autoPlay
          loop
          playsInline
          muted
        />
      );
    }

    return (
      <img
        src={imageUrl}
        alt={previewSticker.emoji || 'Sticker preview'}
        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }}
      />
    );
  };

  const renderCategoriesStep = () => (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => setStep('link')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
          Добавьте категории
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)', mb: 2 }}>
        Вы получите +10 ART после публикации набора. Проверьте данные, выберите категории и подтвердите.
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
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 2, gap: 2 }}>
          <Box sx={{ width: '100%', height: 200, backgroundColor: 'var(--tg-theme-secondary-bg-color)', borderRadius: '12px', overflow: 'hidden' }}>
            {renderPreview()}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
              {createdStickerSet?.title || normalizedTelegramInfo?.title || 'Новый стикерсет'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)', wordBreak: 'break-word' }}>
              @{createdStickerSet?.name || normalizedTelegramInfo?.name}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--tg-theme-text-color)', mb: 1 }}>
        Выбранные категории
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          minHeight: '40px',
          border: '1px dashed var(--tg-theme-border-color)',
          borderRadius: '12px',
          padding: '8px'
        }}
      >
        {selectedCategories.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'var(--tg-theme-hint-color)' }}>
            Категории пока не выбраны
          </Typography>
        ) : (
          selectedCategories.map((key) => {
            const category = categories.find((item) => item.key === key);
            return (
              <Chip
                key={key}
                label={category?.name || key}
                onDelete={() => handleCategoryToggle(key)}
                color="primary"
                sx={{ backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
              />
            );
          })
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

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

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 1,
          '&::-webkit-scrollbar': {
            height: '6px'
          }
        }}
      >
        {categoriesLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" sx={{ color: 'var(--tg-theme-hint-color)' }}>
              Загрузка категорий...
            </Typography>
          </Box>
        ) : categoriesError ? (
          <Alert severity="error" sx={{ width: '100%' }}>
            {categoriesError}
          </Alert>
        ) : (
          categories.map((category) => {
            const isSelected = selectedCategories.includes(category.key);
            return (
              <Chip
                key={category.key}
                label={category.name}
                onClick={() => handleCategoryToggle(category.key)}
                color={isSelected ? 'primary' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                sx={{
                  flexShrink: 0,
                  cursor: 'pointer',
                  fontWeight: isSelected ? 600 : 400
                }}
              />
            );
          })
        )}
      </Box>

      {categoriesError && !categoriesLoading && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {categoriesError}
        </Alert>
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
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--tg-theme-secondary-bg-color, #ffffff)',
          borderRadius: '16px',
          padding: '24px',
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

