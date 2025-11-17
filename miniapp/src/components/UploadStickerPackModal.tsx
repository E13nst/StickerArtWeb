import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  TextField,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ModalBackdrop } from './ModalBackdrop';
import { apiClient } from '@/api/client';
import { getStickerImageUrl, getStickerThumbnailUrl } from '@/utils/stickerUtils';
import type { Sticker, StickerSetResponse, CategoryResponse } from '@/types/sticker';
import { StickerPackModal } from './StickerPackModal';

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

const normalizeStickerSetName = (raw: string): string => {
  return raw.trim()
    .replace(/^https?:\/\/t\.me\/addstickers\//i, '')
    .replace(/^https?:\/\/t\.me\//i, '')
    .replace(/^@/, '')
    .trim();
};

const extractErrorMessages = (error: any, defaultMessage: string): string[] => {
  const messages: string[] = [];

  const validation = error?.response?.data?.validationErrors;
  if (validation && typeof validation === 'object') {
    Object.values(validation).forEach((value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string') messages.push(item);
        });
      } else if (typeof value === 'string') {
        messages.push(value);
      }
    });
  }

  const message = error?.response?.data?.message || error?.message;
  if (message && typeof message === 'string') {
    messages.push(message);
  }

  if (messages.length === 0) {
    messages.push(defaultMessage);
  }

  return messages
    .map((msg) => {
      if (/No primary or single unique constructor/i.test(msg)) {
        return 'Не удалось сохранить категории. Попробуйте ещё раз через пару секунд.';
      }
      return msg;
    })
    .filter(Boolean);
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
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isCreatedPackModalOpen, setIsCreatedPackModalOpen] = useState(false);
  const [createdPackForDetail, setCreatedPackForDetail] = useState<StickerSetResponse | null>(null);
  const [linkErrorDetails, setLinkErrorDetails] = useState<string[]>([]);
  const [categoriesErrorDetails, setCategoriesErrorDetails] = useState<string[]>([]);

  const resetState = () => {
    setStep('link');
    setLink('');
    setIsSubmittingLink(false);
    setLinkError(null);
    setLinkErrorDetails([]);
    setCreatedStickerSet(null);
    setCategories([]);
    setCategoriesError(null);
    setCategoriesErrorDetails([]);
    setSelectedCategories([]);
    setIsApplyingCategories(false);
    setSuggestionLoading(false);
    setSuggestionError(null);
    setSuggestionsFetched(false);
    setIsPreviewLoading(false);
    setActivePreviewIndex(0);
    setIsPreviewModalOpen(false);
  };

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const handleClose = () => {
    // Не закрываем только если идет процесс отправки
    if (isSubmittingLink || isApplyingCategories) {
      return;
    }
    // На шаге категорий требуем, чтобы была выбрана хотя бы одна категория
    if (step === 'categories' && selectedCategories.length === 0) {
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

    const normalizedName = normalizeStickerSetName(link);
    if (!normalizedName) {
      setLinkError('Пожалуйста, введите корректное имя или ссылку на стикерсет');
      return;
    }

    setIsSubmittingLink(true);
    setLinkError(null);
    setLinkErrorDetails([]);
    setSuggestionError(null);
    setSuggestionsFetched(false);
    setSelectedCategories([]);

    try {
      const payload = { name: normalizedName };
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

      if (onComplete) {
        await onComplete(hydratedStickerSet);
      }

      resetState();
      setCreatedPackForDetail(hydratedStickerSet);
      setIsCreatedPackModalOpen(true);
    } catch (error: any) {
      const messages = extractErrorMessages(error, 'Не удалось создать стикерсет. Проверьте ссылку и попробуйте снова.');
      setLinkError(messages[0]);
      setLinkErrorDetails(messages.slice(1));
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

  const displayTitle = useMemo(() => {
    return createdStickerSet?.title
      || normalizedTelegramInfo?.title
      || 'Новый стикерсет';
  }, [createdStickerSet?.title, normalizedTelegramInfo?.title]);

  const displayName = useMemo(() => {
    return createdStickerSet?.name
      || normalizedTelegramInfo?.name
      || normalizeStickerSetName(link);
  }, [createdStickerSet?.name, normalizedTelegramInfo?.name, link]);

  const suggestionBaseTitle = useMemo(() => {
    return createdStickerSet?.title || normalizedTelegramInfo?.title || '';
  }, [createdStickerSet?.title, normalizedTelegramInfo?.title]);

  useEffect(() => {
    if (!createdStickerSet || step !== 'categories' || suggestionsFetched) {
      return;
    }

    if (!suggestionBaseTitle) {
      setSuggestionsFetched(true);
      return;
    }

    loadSuggestions(suggestionBaseTitle);
  }, [createdStickerSet, step, suggestionBaseTitle, suggestionsFetched]);

  const previewStickers = useMemo(() => {
    const stickers = normalizedTelegramInfo?.stickers;
    if (!stickers || stickers.length === 0) {
      return [];
    }

    return stickers.filter((sticker): sticker is Sticker => Boolean(sticker));
  }, [normalizedTelegramInfo?.stickers]);

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

  const handleRetrySuggestions = () => {
    if (!suggestionBaseTitle) {
      return;
    }
    setSuggestionsFetched(false);
    loadSuggestions(suggestionBaseTitle);
  };

  const handleApplyCategories = async () => {
    if (!createdStickerSet) {
      return;
    }

    setIsApplyingCategories(true);
    setCategoriesError(null);
    setCategoriesErrorDetails([]);

    try {
      const updatedStickerSet = await apiClient.updateStickerSetCategories(createdStickerSet.id, selectedCategories);
      setCreatedStickerSet(updatedStickerSet);

      if (onComplete) {
        await onComplete(updatedStickerSet);
      }

      resetState();
      onClose();
    } catch (error: any) {
      const messages = extractErrorMessages(error, 'Не удалось сохранить категории. Попробуйте позже.');
      setCategoriesError(messages[0]);
      setCategoriesErrorDetails(messages.slice(1));
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
        Добавьте стикеры в Stixly
      </Typography>

      <TextField
        fullWidth
        label="Ссылка или имя стикерсета"
        placeholder="Вставьте ссылку"
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <span>{linkError}</span>
            {linkErrorDetails.length > 0 && (
              <Box component="ul" sx={{ pl: 3, m: 0 }}>
                {linkErrorDetails.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </Box>
            )}
          </Box>
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
            <span>Добавляем</span>
          </Box>
        ) : (
          'Добавить (+10 ART)'
        )}
      </Button>
    </form>
  );

  const renderPreviewStrip = () => {
    if (isPreviewLoading) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: 'var(--tg-theme-hint-color)' }} />
          <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
            Загружаем данные из Telegram…
          </Typography>
        </Box>
      );
    }

    if (previewStickers.length === 0) {
      return (
        <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
            Telegram не передал превью. Попробуйте обновить позже.
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
          <Tooltip
            title={createdStickerSet ? '' : 'Превью появится после загрузки данных из Telegram'}
            disableHoverListener={Boolean(createdStickerSet)}
          >
            <span>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setIsPreviewModalOpen(true)}
                disabled={!createdStickerSet}
                sx={{
                  alignSelf: 'flex-start',
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  px: 1.5,
                  py: 0.75
                }}
              >
                Предпросмотр набора
              </Button>
            </span>
          </Tooltip>
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
        <Alert severity="info" sx={{ mb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span>{suggestionError}</span>
          <Button
            variant="outlined"
            size="small"
            onClick={handleRetrySuggestions}
            disabled={suggestionLoading}
            sx={{ alignSelf: 'flex-start' }}
          >
            Попробовать снова
          </Button>
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
        <Alert severity="error" sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span>{categoriesError}</span>
          {categoriesErrorDetails.length > 0 && (
            <Box component="ul" sx={{ pl: 3, m: 0 }}>
              {categoriesErrorDetails.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </Box>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => handleApplyCategories()}
            disabled={isApplyingCategories}
            sx={{ alignSelf: 'flex-start' }}
          >
            Повторить попытку
          </Button>
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
          {categories.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--tg-theme-hint-color)' }}>
              Категории не найдены. Попробуйте позже или обновите страницу.
            </Typography>
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
            })
          )}
        </Box>
      )}

      {step === 'categories' && selectedCategories.length === 0 && categories.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            color: 'var(--tg-theme-hint-color)',
            fontSize: '0.75rem',
            textAlign: 'center',
            mt: 1,
            mb: -1,
            opacity: 0.8
          }}
        >
          Выберите хотя бы одну категорию
        </Typography>
      )}

      <Button
        fullWidth
        variant="contained"
        onClick={handleApplyCategories}
        disabled={isApplyingCategories || selectedCategories.length === 0}
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
    <>
      {open && !isCreatedPackModalOpen && (
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
            <Box sx={{ position: 'relative', width: '100%' }}>
              <IconButton
                aria-label="close"
                onClick={handleClose}
                disabled={isSubmittingLink || isApplyingCategories || (step === 'categories' && selectedCategories.length === 0)}
                sx={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  zIndex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
                  '&:disabled': { opacity: 0.5 }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
              {step === 'link' ? renderLinkStep() : renderCategoriesStep()}
            </Box>
          </Box>
        </ModalBackdrop>
      )}

      <StickerPackModal
        open={isPreviewModalOpen && Boolean(createdStickerSet)}
        stickerSet={createdStickerSet}
        onClose={() => setIsPreviewModalOpen(false)}
      />

      <StickerPackModal
        open={isCreatedPackModalOpen && Boolean(createdPackForDetail)}
        stickerSet={createdPackForDetail}
        onClose={() => {
          setIsCreatedPackModalOpen(false);
          setCreatedPackForDetail(null);
          resetState();
          onClose();
        }}
        enableCategoryEditing
        infoVariant="minimal"
        onCategoriesUpdated={async (updated) => {
          setCreatedPackForDetail(updated);
          setCreatedStickerSet(updated);
          if (onComplete) {
            await onComplete(updated);
          }
        }}
      />
    </>
  );
};

