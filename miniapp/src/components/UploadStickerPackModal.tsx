import { useEffect, useMemo, useState, useRef, useCallback, FC, FormEvent, KeyboardEvent, MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Tooltip } from '@/components/ui/Tooltip';
import { Chip } from '@/components/ui/Chip';
import { ModalBackdrop } from './ModalBackdrop';
import './UploadStickerPackModal.css';
import { apiClient } from '@/api/client';
import { getStickerThumbnailUrl } from '@/utils/stickerUtils';
import { imageLoader, getCachedStickerUrl, videoBlobCache, LoadPriority } from '@/utils/imageLoader';
import { useNonFlashingVideoSrc } from '@/hooks/useNonFlashingVideoSrc';
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

// Компонент для видео стикера с использованием useNonFlashingVideoSrc
const PreviewStickerVideo: FC<{
  thumbFileId: string;
  fallbackUrl: string;
}> = ({ thumbFileId, fallbackUrl }) => {
  const { src, isReady, onError, onLoadedData } = useNonFlashingVideoSrc({
    fileId: thumbFileId,
    preferredSrc: videoBlobCache.get(thumbFileId),
    fallbackSrc: fallbackUrl,
    waitForPreferredMs: 100
  });

  return (
    <video
      src={src}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'contain',
        opacity: isReady ? 1 : 0,
        transition: 'opacity 120ms ease'
      }}
      autoPlay
      loop
      muted
      playsInline
      onError={onError}
      onLoadedData={onLoadedData}
    />
  );
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

export const UploadStickerPackModal: FC<UploadStickerPackModalProps> = ({
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
  const [aiSuggestedKeys, setAiSuggestedKeys] = useState<Set<string>>(new Set());
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isCreatedPackModalOpen, setIsCreatedPackModalOpen] = useState(false);
  const [createdPackForDetail, setCreatedPackForDetail] = useState<StickerSetResponse | null>(null);
  const [linkErrorDetails, setLinkErrorDetails] = useState<string[]>([]);
  const [categoriesErrorDetails, setCategoriesErrorDetails] = useState<string[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isDraggingDownRef = useRef(false);
  const swipeCleanupRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef<() => void>(() => {});

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
    setAiSuggestedKeys(new Set());
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

  useEffect(() => {
    onCloseRef.current = handleClose;
  }, [handleClose]);

  const handleSubmitLink = async (event: FormEvent) => {
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

      // Сохраняем созданный стикерсет и переходим на шаг выбора категорий
      setCreatedStickerSet(hydratedStickerSet);
      setStep('categories');
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
      console.log('⏭️ Пропуск AI подбора:', { title, suggestionsFetched });
      return;
    }

    console.log('🤖 Запуск AI подбора для:', title);
    setSuggestionLoading(true);
    setSuggestionError(null);

    try {
      const suggestion = await apiClient.suggestCategoriesForTitle(title);
      setSuggestionsFetched(true);

      console.log('📦 AI ответ:', suggestion);

      if (suggestion?.suggestedCategories?.length) {
        const suggestionKeys = suggestion.suggestedCategories
          .map((item) => item.categoryKey)
          .filter((key): key is string => Boolean(key));

        if (suggestionKeys.length > 0) {
          setAiSuggestedKeys(new Set(suggestionKeys));
          setSelectedCategories(suggestionKeys);
          console.log('✅ AI предложил категории:', suggestionKeys);
        } else {
          console.log('⚠️ AI не вернул категории');
        }
      } else {
        console.log('⚠️ AI ответ не содержит предложений');
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'AI не смог подобрать категории.';
      console.error('❌ Ошибка AI подбора:', error);
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
      console.log('⏭️ Пропуск useEffect AI подбора:', { 
        hasCreatedStickerSet: !!createdStickerSet, 
        step, 
        suggestionsFetched 
      });
      return;
    }

    if (!suggestionBaseTitle) {
      console.log('⚠️ Нет названия для AI подбора');
      setSuggestionsFetched(true);
      return;
    }

    console.log('🎯 Триггер AI подбора через useEffect');
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

  // Предзагрузка всех preview стикеров через imageLoader
  useEffect(() => {
    if (!previewStickers.length || !open) return;
    
    previewStickers.forEach((sticker) => {
      const thumbFileId = (sticker as any)?.thumb?.file_id || sticker.file_id;
      const thumbUrl = getStickerThumbnailUrl(thumbFileId, 128);
      const priority = LoadPriority.TIER_3_ADDITIONAL;
      
      if (sticker.is_video) {
        imageLoader.loadVideo(thumbFileId, thumbUrl, priority).catch(() => {
          // Игнорируем ошибки загрузки
        });
      } else {
        imageLoader.loadImage(thumbFileId, thumbUrl, priority).catch(() => {
          // Игнорируем ошибки загрузки
        });
        if (sticker.is_animated) {
          imageLoader.loadAnimation(thumbFileId, thumbUrl, LoadPriority.TIER_4_BACKGROUND).catch(() => {
            // Игнорируем ошибки загрузки
          });
        }
      }
    });
  }, [previewStickers, open]);

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
      
      if (onComplete) {
        await onComplete(updatedStickerSet);
      }

      // После сохранения категорий открываем детальное окно стикерсета
      resetState();
      setCreatedPackForDetail(updatedStickerSet);
      setIsCreatedPackModalOpen(true);
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
      <Text variant="h4" weight="bold" style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--tg-theme-text-color, #ffffff)', textAlign: 'center' }}>
        Добавьте стикеры в Stixly
      </Text>
      <p className="upload-sticker-pack-modal__hint">
        Можно просто отправить стикер нашему боту в чат.
      </p>

      <Input
        label="Ссылка или имя стикерсета"
        placeholder="Вставьте ссылку"
        value={link}
        onChange={(event) => {
          setLink(event.target.value);
          setLinkError(null);
        }}
        disabled={isSubmittingLink}
        style={{ marginBottom: '16px' }}
      />

      {linkError && (
        <Alert severity="error" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <span>{linkError}</span>
            {linkErrorDetails.length > 0 && (
              <ul style={{ paddingLeft: '24px', margin: 0 }}>
                {linkErrorDetails.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        </Alert>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmittingLink || !link.trim()}
        style={{ width: '100%', padding: '12px 0', borderRadius: '12px', fontSize: '16px', fontWeight: 600 }}
      >
        {isSubmittingLink ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
            <Spinner size={20} />
            <span>Добавляем</span>
          </div>
        ) : (
          'Добавить (+10 ART)'
        )}
      </Button>
    </form>
  );

  const renderPreviewStrip = () => {
    if (isPreviewLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
          <Spinner size={32} />
          <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Загружаем данные из Telegram…
          </Text>
        </div>
      );
    }

    if (previewStickers.length === 0) {
      return (
        <div style={{ padding: '32px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Telegram не передал превью. Попробуйте обновить позже.
          </Text>
        </div>
      );
    }

    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            display: 'flex',
            gap: '12px',
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
            msOverflowStyle: 'none'
          }}
          className="hide-scrollbar"
        >
          {previewStickers.map((sticker, index) => {
            const isActive = index === activePreviewIndex;
            const thumbFileId = (sticker as any)?.thumb?.file_id || sticker.file_id;
            const thumbUrl = getStickerThumbnailUrl(thumbFileId, 128);

            const handleSelect = () => setActivePreviewIndex(index);

            const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setActivePreviewIndex(index);
              }
            };

            return (
              <div
                key={`${sticker.file_id}-${index}`}
                role="button"
                tabIndex={0}
                onClick={handleSelect}
                onKeyDown={handleKeyDown}
                style={{
                  flex: '0 0 auto',
                  width: '96px',
                  height: '96px',
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
                  <PreviewStickerVideo
                    thumbFileId={thumbFileId}
                    fallbackUrl={thumbUrl}
                  />
                ) : (
                  <img
                    src={getCachedStickerUrl(thumbFileId) || thumbUrl}
                    alt={sticker.emoji || `Sticker ${index + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCategoriesStep = () => (
    <>
      <Text variant="h4" weight="bold" style={{ fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '24px'}}>
        Добавьте категории
      </Text>

      <div style={{ borderRadius: '16px', border: '1px solid var(--tg-theme-border-color)', backgroundColor: 'var(--tg-theme-bg-color)', marginBottom: '16px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 16, gap: '12px'}}>
          <Text variant="h4" weight="bold" style={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
            {displayTitle}
          </Text>
          {displayName ? (
            <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)', wordBreak: 'break-word' }}>
              @{displayName}
            </Text>
          ) : null}
          <Tooltip title={createdStickerSet ? '' : 'Превью появится после загрузки данных из Telegram'}>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setIsPreviewModalOpen(true)}
              disabled={!createdStickerSet}
              style={{ alignSelf: 'flex-start', borderRadius: '10px', fontWeight: 600, fontSize: '0.8125rem', padding: '6px 12px' }}
            >
              Предпросмотр набора
            </Button>
          </Tooltip>
          {renderPreviewStrip()}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
        <Text variant="body" weight="bold" style={{ fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
          Выберите категории для стикерсета:
        </Text>
        {!suggestionLoading && aiSuggestedKeys.size > 0 && (
          <Text variant="caption" style={{ color: 'var(--tg-theme-link-color, #2481cc)', fontSize: '0.75rem', fontWeight: 500 }}>
            ✨ {aiSuggestedKeys.size} от AI
          </Text>
        )}
      </div>

      {suggestionLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px'}}>
          <Spinner size={20} />
          <Text variant="caption" style={{ color: 'var(--tg-theme-hint-color)' }}>
            AI подбирает лучшие категории...
          </Text>
        </div>
      )}

      {suggestionError && (
        <Alert severity="info" style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <span>{suggestionError}</span>
          <Button
            variant="secondary"
            size="small"
            onClick={handleRetrySuggestions}
            disabled={suggestionLoading}
            style={{ alignSelf: 'flex-start' }}
          >
            Попробовать снова
          </Button>
        </Alert>
      )}

      {categoriesLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
          <Spinner size={20} />
          <Text variant="caption" style={{ color: 'var(--tg-theme-hint-color)' }}>
            Загрузка категорий...
          </Text>
        </div>
      ) : categoriesError ? (
        <Alert severity="error" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <span>{categoriesError}</span>
          {categoriesErrorDetails.length > 0 && (
            <ul style={{ paddingLeft: '24px', margin: 0 }}>
              {categoriesErrorDetails.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            size="small"
            onClick={() => handleApplyCategories()}
            disabled={isApplyingCategories}
            style={{ alignSelf: 'flex-start' }}
          >
            Повторить попытку
          </Button>
        </Alert>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingBottom: '8px', paddingRight: '4px', borderRadius: '12px', border: '1px solid var(--tg-theme-border-color)', padding: '12px' }}>
          {categories.length === 0 ? (
            <Text variant="bodySmall" style={{ color: 'var(--tg-theme-hint-color)' }}>
              Категории не найдены. Попробуйте позже или обновите страницу.
            </Text>
          ) : (
            categories.map((category) => {
              const isSelected = selectedCategories.includes(category.key);
              const isAiSuggested = aiSuggestedKeys.has(category.key);
              return (
                <Chip
                  key={category.key}
                  label={isAiSuggested ? `✨ ${category.name}` : category.name}
                  onClick={() => handleCategoryToggle(category.key)}
                  variant={isSelected ? 'filled' : 'outlined'}
                  style={{
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'transform 0.15s ease',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    ...(isAiSuggested && !isSelected ? {
                      fontWeight: 600,
                      boxShadow: '0 0 0 1px var(--tg-theme-link-color, #2481cc)',
                      borderColor: 'var(--tg-theme-link-color, #2481cc)',
                      borderWidth: 2,
                      borderStyle: 'solid',
                      backgroundColor: 'rgba(36, 129, 204, 0.08)',
                      color: 'var(--tg-theme-link-color, #2481cc)'
                    } : {})
                  }}
                />
              );
            })
          )}
        </div>
      )}

      {step === 'categories' && selectedCategories.length === 0 && categories.length > 0 && (
        <Text variant="caption" style={{ color: 'var(--tg-theme-hint-color)', fontSize: '0.75rem', textAlign: 'center', marginTop: '8px', marginBottom: -8, opacity: 0.8 }}>
          Выберите хотя бы одну категорию
        </Text>
      )}

      <Button
        variant="primary"
        onClick={handleApplyCategories}
        disabled={isApplyingCategories || selectedCategories.length === 0}
        style={{ width: '100%', marginTop: '24px', padding: '12px 0', borderRadius: '12px', fontSize: '16px', fontWeight: 600 }}
      >
        {isApplyingCategories ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
            <Spinner size={20} />
            <span>Сохраняем...</span>
          </div>
        ) : (
          'Подтвердить категории'
        )}
      </Button>
    </>
  );

  // Свайп вниз для закрытия: подписка через callback ref, чтобы элемент точно был в DOM (портал)
  const DISMISS_THRESHOLD = 100;
  const DRAG_ANIMATION_MS = 200;

  const attachSwipeToModal = useCallback((modalElement: HTMLDivElement) => {
    const scrollEl = modalElement.querySelector<HTMLElement>('.upload-sticker-pack-modal__body');
    const handleEl = modalElement.querySelector<HTMLElement>('.upload-sticker-pack-modal__handle');

    const handleTouchStart = (e: TouchEvent) => {
      const startedOnHandle = handleEl?.contains(e.target as Node);
      const scrollAtTop = (scrollEl?.scrollTop ?? 0) <= 0;
      if (startedOnHandle || scrollAtTop) {
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
        modalElement.classList.add('upload-sticker-pack-modal--dragging');
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
          modalElement.classList.remove('upload-sticker-pack-modal--dragging');
          modalElement.classList.add('upload-sticker-pack-modal--drag-dismissed');
          if (backdrop && !backdrop.classList.contains('modal-backdrop--keep-navbar')) {
            backdrop.classList.add('modal-backdrop--drag-dismissed');
          }
          onCloseRef.current();
        }, DRAG_ANIMATION_MS);
      } else {
        modalElement.style.transition = `transform ${DRAG_ANIMATION_MS}ms ease-out`;
        modalElement.style.transform = 'translateY(0)';

        setTimeout(() => {
          modalElement.style.transition = '';
          modalElement.style.transform = '';
          modalElement.classList.remove('upload-sticker-pack-modal--dragging');
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
  }, []);

  const setModalRef = useCallback(
    (el: HTMLDivElement | null) => {
      (contentRef as MutableRefObject<HTMLDivElement | null>).current = el;
      swipeCleanupRef.current?.();
      swipeCleanupRef.current = null;
      if (el) {
        swipeCleanupRef.current = attachSwipeToModal(el);
      }
    },
    [attachSwipeToModal]
  );

  const uploadModalContent = open ? (
    <ModalBackdrop open={open} onClose={handleClose} noBlur keepNavbarVisible>
      <div
        ref={setModalRef}
        className="upload-sticker-pack-modal"
        data-modal-content
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upload-sticker-pack-modal__handle" aria-hidden />
        <div className="upload-sticker-pack-modal__body">
          <div className="upload-sticker-pack-modal__header">
            <button
              type="button"
              className="upload-sticker-pack-modal__close-btn"
              aria-label="Закрыть"
              onClick={handleClose}
              disabled={isSubmittingLink || isApplyingCategories || (step === 'categories' && selectedCategories.length === 0)}
            >
              <CloseIcon size={18} />
            </button>
            {step === 'link' ? renderLinkStep() : renderCategoriesStep()}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  ) : null;

  return (
    <>
      {typeof document !== 'undefined' && createPortal(uploadModalContent, document.body)}

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

