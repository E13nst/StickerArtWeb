import {
  FC,
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
  type Ref,
  type LegacyRef,
} from 'react';
import { flushSync } from 'react-dom';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import type { StylePreset } from '@/api/client';
import type { SyntheticEvent } from 'react';
import { onApiHostedImageError } from '@/utils/apiImageFallback';
import { Pulsar } from '@/components/ui/Pulsar';
import { DeleteIcon, ShareIcon, DownloadIcon } from '@/components/ui/Icons';
import type { DeckAction, DeckActionResponse, DeckCard } from '@/types/deck';
import { deckActionForGesture, deckOverlayLabels } from '@/utils/generateDeckCardVisual';
import './GenerateHeroCard.css';

export interface DeckCardPresentation {
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkedPreset: StylePreset | null;
}

export interface GenerateHeroCardProps {
  /** Отфильтрованный список пресетов для свайп-деки */
  presets: StylePreset[];
  /** Текущий выбранный preset ID (из родителя) */
  selectedPresetId: number | null;
  /** state страницы */
  pageState: 'idle' | 'uploading' | 'generating' | 'success' | 'error';
  /** URL результата генерации */
  resultImageUrl: string | null;
  /** Предыдущий результат во время генерации */
  duringJobPreviousResultUrl: string | null;
  /** Текст спиннера при генерации */
  generatingMessage: string;
  /** URL логотипа */
  logoSrc: string;
  /** Превью пресетов из истории (presetId → url) */
  presetPreviewById: Map<number, string>;
  /** Telegram аватар как референс */
  showAvatarCard: boolean;
  avatarPreviewUrl: string | null;
  /** Можно ли удалить текущий стиль */
  canDeleteStyle: boolean;
  /** Можно ли шарить текущий стиль */
  canShareStyle: boolean;
  /** Можно ли скачать результат */
  canDownloadResult: boolean;
  isDownloadingResult: boolean;
  /** Callbacks */
  onPresetSelect: (presetId: number) => void;
  onResultTap: () => void;
  onAvatarTap: () => void;
  onAvatarRemove: () => void;
  onDeleteStyle?: () => void;
  onShareStyle?: () => void;
  onDownloadResult?: () => void;
  /** Haptic при пересечении threshold */
  onHapticLight?: () => void;
  /** Ошибка загрузки превью пресета (для инвалидации кэша истории) */
  onPresetPreviewError?: (presetId: number) => void;
  /** Ошибка загрузки результата с `/api/images/*` (родитель может удалить запись истории вместо заглушки) */
  onApiHostedResultImageError?: (event: SyntheticEvent<HTMLImageElement>) => void;
  /** Компактные поля пресета (фото слота, эмодзи) поверх карточки во время генерации */
  generatingInlineSlot?: ReactNode;
  /** Промпт, тулбар (эмодзи, удалить фон) и поля пресета — под превью внутри той же свайп-карточки */
  composeSlot?: ReactNode;
  composeSlotRef?: Ref<HTMLDivElement | null>;
  /** Тап по прошлому результату на фонe во время генерации */
  onDuringJobPreviousResultTap?: () => void;
  /** Персональная колода API `/deck/*` (страница генерации); при непустой — idle-свайп идёт через эти карточки */
  deckCards?: DeckCard[] | null;
  deckCardPresentation?: (card: DeckCard) => DeckCardPresentation;
  onDeckInteraction?: (
    card: DeckCard,
    action: DeckAction,
  ) => Promise<{ ok: boolean; data?: DeckActionResponse | null }>;
  onDeckPostSuccess?: (card: DeckCard, action: DeckAction, data: DeckActionResponse | null | undefined) => void;
  /** Снять верхнюю карточку очереди после анимации и успешного POST */
  onDeckHeadConsumed?: (cardInstanceId: string) => void;
}

// Figma: first card 370×523, aspect-ratio ≈ 370/523
const SWIPE_THRESHOLD = 90;   // px — расстояние до срабатывания
const VELOCITY_THRESHOLD = 350; // px/s — скорость для срабатывания
const HAPTIC_THRESHOLD = 70;   // px — порог тактильного отклика
const PROMOTE_MS = 0.44;
const EXIT_MS = 0.3;

const getPresetPreview = (
  preset: StylePreset,
  byHistory: Map<number, string>,
): string | null => {
  return (
    (preset.id != null ? byHistory.get(preset.id) : null) ??
    preset.previewWebpUrl ??
    preset.previewUrl ??
    preset.presetReferenceImageUrl ??
    null
  );
};

const stripPresetName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name.replace(/\s*\(.*?\)\s*$/g, '').trim();
};

/** Никнейм автора с бэка; пустой — ничего не рисуем */
const formatPresetOwnerHandle = (preset: StylePreset): string | null => {
  const ext = preset as StylePreset & {
    owner_username?: string | null;
    authorUsername?: string | null;
  };
  const s = (ext.ownerUsername ?? ext.owner_username ?? ext.authorUsername)?.trim();
  if (!s) return null;
  return s.startsWith('@') ? s : `@${s}`;
};

export const GenerateHeroCard: FC<GenerateHeroCardProps> = ({
  presets,
  selectedPresetId,
  pageState,
  resultImageUrl,
  duringJobPreviousResultUrl,
  generatingMessage,
  logoSrc,
  presetPreviewById,
  showAvatarCard,
  avatarPreviewUrl,
  canDeleteStyle,
  canShareStyle,
  canDownloadResult,
  isDownloadingResult,
  onPresetSelect,
  onResultTap,
  onAvatarTap,
  onAvatarRemove,
  onDeleteStyle,
  onShareStyle,
  onDownloadResult,
  onHapticLight,
  onPresetPreviewError,
  onApiHostedResultImageError,
  generatingInlineSlot,
  composeSlot,
  composeSlotRef,
  onDuringJobPreviousResultTap,
  deckCards,
  deckCardPresentation,
  onDeckInteraction,
  onDeckPostSuccess,
  onDeckHeadConsumed,
}) => {
  const onResultOrPrevImgError = onApiHostedResultImageError ?? onApiHostedImageError;
  // Индекс текущей карточки в деке
  const [deckIndex, setDeckIndex] = useState(0);
  const hapticFiredRef = useRef(false);

  // Синхронизируем deckIndex с выбранным presetId снаружи
  useEffect(() => {
    if (selectedPresetId == null) return;
    const idx = presets.findIndex((p) => p.id === selectedPresetId);
    if (idx >= 0 && idx !== deckIndex) {
      setDeckIndex(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPresetId]);

  // Сбрасываем индекс при смене списка пресетов (фильтр)
  useEffect(() => {
    setDeckIndex(0);
  }, [presets.length]);

  // Framer-motion x для свайпа
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10]);
  const likeOpacity = useTransform(x, [0, HAPTIC_THRESHOLD, SWIPE_THRESHOLD + 40], [0, 0.6, 1]);
  const nopeOpacity = useTransform(x, [-(SWIPE_THRESHOLD + 40), -HAPTIC_THRESHOLD, 0], [1, 0.6, 0]);
  const cardOpacity = useTransform(x, [-220, -100, 0, 100, 220], [0.88, 1, 1, 1, 0.88]);

  /** 0 = карта в колоде, 1 = «подъехала» на полный слот (медиа уже было в DOM, без remount img) */
  const bgLift = useMotionValue(0);
  const bgTop = useTransform(bgLift, [0, 1], ['11.5%', '0%']);
  const bgLeft = useTransform(bgLift, [0, 1], ['4.5%', '0%']);
  const bgWidth = useTransform(bgLift, [0, 1], ['91%', '100%']);
  const bgHeight = useTransform(bgLift, [0, 1], ['91%', '100%']);
  const bgRadius = useTransform(bgLift, [0, 1], [17, 20]);

  /** Верхняя карта скрыта на время подъёма нижней и атомарной смены индекса */
  const [hideFrontForDeck, setHideFrontForDeck] = useState(false);
  /** Нижняя карта невидима на 1 кадр при смене src на «следующий следующий» */
  const [hideBackLayer, setHideBackLayer] = useState(false);
  const [bgPromoting, setBgPromoting] = useState(false);
  const [deckTransitioning, setDeckTransitioning] = useState(false);
  const deckBusyRef = useRef(false);

  const commitAdvanceAndReset = useCallback(
    (likedPreset: StylePreset | null) => {
      flushSync(() => {
        if (likedPreset) onPresetSelect(likedPreset.id);
        setDeckIndex((prev) => {
          if (presets.length === 0) return 0;
          return (prev + 1) % presets.length;
        });
      });
      x.set(0);
      bgLift.set(0);
    },
    [presets.length, onPresetSelect, x, bgLift],
  );

  const runDeckPullAnimation = useCallback(
    async (likedPreset: StylePreset | null) => {
      if (deckBusyRef.current || presets.length <= 1) return;
      deckBusyRef.current = true;
      setDeckTransitioning(true);
      try {
        const flyTarget = likedPreset ? 400 : -400;
        await animate(x, flyTarget, { duration: EXIT_MS, ease: [0.22, 1, 0.36, 1] });
        setHideFrontForDeck(true);
        setBgPromoting(true);
        await animate(bgLift, 1, { duration: PROMOTE_MS, ease: [0.16, 1, 0.32, 1] });
        flushSync(() => {
          setHideBackLayer(true);
        });
        commitAdvanceAndReset(likedPreset);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHideBackLayer(false);
            setHideFrontForDeck(false);
            setDeckTransitioning(false);
            deckBusyRef.current = false;
          });
        });
      } catch {
        deckBusyRef.current = false;
        setDeckTransitioning(false);
        setHideFrontForDeck(false);
        setHideBackLayer(false);
        bgLift.set(0);
        x.set(0);
      } finally {
        setBgPromoting(false);
      }
    },
    [presets.length, x, bgLift, commitAdvanceAndReset],
  );

  const commitServerDeckAfterAnim = useCallback(
    (cardId: string) => {
      flushSync(() => {
        onDeckHeadConsumed?.(cardId);
      });
      x.set(0);
      bgLift.set(0);
    },
    [onDeckHeadConsumed, x, bgLift],
  );

  const runServerDeckPullAnimation = useCallback(
    async (swipeRight: boolean, cardInstanceId: string) => {
      if (deckBusyRef.current || !deckCards || deckCards.length <= 1) return;
      deckBusyRef.current = true;
      setDeckTransitioning(true);
      try {
        const flyTarget = swipeRight ? 400 : -400;
        await animate(x, flyTarget, { duration: EXIT_MS, ease: [0.22, 1, 0.36, 1] });
        setHideFrontForDeck(true);
        setBgPromoting(true);
        await animate(bgLift, 1, { duration: PROMOTE_MS, ease: [0.16, 1, 0.32, 1] });
        flushSync(() => {
          setHideBackLayer(true);
        });
        commitServerDeckAfterAnim(cardInstanceId);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHideBackLayer(false);
            setHideFrontForDeck(false);
            setDeckTransitioning(false);
            deckBusyRef.current = false;
          });
        });
      } catch {
        deckBusyRef.current = false;
        setDeckTransitioning(false);
        setHideFrontForDeck(false);
        setHideBackLayer(false);
        bgLift.set(0);
        x.set(0);
      } finally {
        setBgPromoting(false);
      }
    },
    [deckCards, x, bgLift, commitServerDeckAfterAnim],
  );

  const handleDragStart = useCallback(() => {
    hapticFiredRef.current = false;
  }, []);

  const handleDrag = useCallback((_e: PointerEvent, info: PanInfo) => {
    if (!hapticFiredRef.current && Math.abs(info.offset.x) >= HAPTIC_THRESHOLD) {
      hapticFiredRef.current = true;
      onHapticLight?.();
    }
  }, [onHapticLight]);

  const isGenerating = pageState === 'generating' || pageState === 'uploading';
  const isSuccess = pageState === 'success';
  const isInteractive = !isGenerating && !isSuccess;

  const useServerDeck = Boolean(
    deckCards &&
      deckCards.length > 0 &&
      isInteractive &&
      onDeckInteraction &&
      deckCardPresentation,
  );

  const serverHead = useServerDeck && deckCards ? deckCards[0] : null;
  const deckFlowNonStyle = Boolean(serverHead && serverHead.type !== 'STYLE_PRESET');
  const serverNext = useServerDeck && deckCards && deckCards.length > 1 ? deckCards[1] : null;
  const serverPresentCur = serverHead && deckCardPresentation ? deckCardPresentation(serverHead) : null;
  const serverPresentNext = serverNext && deckCardPresentation ? deckCardPresentation(serverNext) : null;
  const overlayLabels =
    serverHead && useServerDeck ? deckOverlayLabels(serverHead.type) : { like: '♥ НРАВИТСЯ', nope: '✕ ДАЛЬШЕ' };

  // Определяем текущий и следующий пресет для стека карточек
  const currentPreset = presets[deckIndex] ?? null;
  const nextPreset = presets[(deckIndex + 1) % presets.length] ?? null;
  const currentPreview = currentPreset ? getPresetPreview(currentPreset, presetPreviewById) : null;
  const nextPreview = nextPreset ? getPresetPreview(nextPreset, presetPreviewById) : null;

  const serverCurrentPreview = useMemo(() => {
    if (!serverPresentCur) return null;
    if (serverPresentCur.imageUrl) return serverPresentCur.imageUrl;
    if (serverPresentCur.linkedPreset) {
      return getPresetPreview(serverPresentCur.linkedPreset, presetPreviewById);
    }
    return null;
  }, [serverPresentCur, presetPreviewById]);

  const serverNextPreview = useMemo(() => {
    if (!serverPresentNext) return null;
    if (serverPresentNext.imageUrl) return serverPresentNext.imageUrl;
    if (serverPresentNext.linkedPreset) {
      return getPresetPreview(serverPresentNext.linkedPreset, presetPreviewById);
    }
    return null;
  }, [serverPresentNext, presetPreviewById]);

  /** Пресеты впереди по кругу для префетча и плавной колоды */
  const lookaheadUrls = useMemo(() => {
    if (useServerDeck && deckCards?.length) {
      const urls = [serverCurrentPreview, serverNextPreview].filter(Boolean) as string[];
      let k = 2;
      while (k < Math.min(6, deckCards.length) && deckCardPresentation) {
        const c = deckCards[k];
        const pr = c ? deckCardPresentation(c) : null;
        const u =
          pr?.imageUrl ??
          (pr?.linkedPreset ? getPresetPreview(pr.linkedPreset, presetPreviewById) : null);
        if (u) urls.push(u);
        k++;
      }
      return [...new Set(urls)];
    }
    if (presets.length === 0) return [];
    const out: string[] = [];
    for (let k = 1; k <= 4; k++) {
      const p = presets[(deckIndex + k) % presets.length];
      const u = p ? getPresetPreview(p, presetPreviewById) : null;
      if (u) out.push(u);
    }
    return [...new Set(out)];
  }, [
    useServerDeck,
    deckCards,
    serverCurrentPreview,
    serverNextPreview,
    deckCardPresentation,
    presets,
    deckIndex,
    presetPreviewById,
  ]);

  useEffect(() => {
    for (const url of lookaheadUrls) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [lookaheadUrls]);

  const handleDragEnd = useCallback(
    (_e: PointerEvent, info: PanInfo) => {
      const dist = info.offset.x;
      const vel = info.velocity.x;
      hapticFiredRef.current = false;

      if (deckBusyRef.current) return;

      const runPresetStripSwipe = () => {
        if (dist > SWIPE_THRESHOLD || vel > VELOCITY_THRESHOLD) {
          const preset = presets[deckIndex];
          if (preset) {
            if (presets.length > 1) {
              void runDeckPullAnimation(preset);
            } else {
              animate(x, 400, { duration: EXIT_MS, ease: [0.22, 1, 0.36, 1] }).then(() => {
                x.set(0);
                onPresetSelect(preset.id);
              });
            }
          } else {
            animate(x, 0, { type: 'spring', stiffness: 280, damping: 34, mass: 0.85 });
          }
        } else if (dist < -SWIPE_THRESHOLD || vel < -VELOCITY_THRESHOLD) {
          if (presets.length > 1) {
            void runDeckPullAnimation(null);
          } else {
            animate(x, 0, { type: 'spring', stiffness: 280, damping: 34, mass: 0.85 });
          }
        } else {
          animate(x, 0, { type: 'spring', stiffness: 280, damping: 34, mass: 0.85 });
        }
      };

      if (
        useServerDeck &&
        deckCards &&
        deckCards[0] &&
        onDeckInteraction
      ) {
        const swipeRight = dist > SWIPE_THRESHOLD || vel > VELOCITY_THRESHOLD;
        const swipeLeft = dist < -SWIPE_THRESHOLD || vel < -VELOCITY_THRESHOLD;
        if (!swipeRight && !swipeLeft) {
          animate(x, 0, { type: 'spring', stiffness: 280, damping: 34, mass: 0.85 });
          return;
        }
        const card = deckCards[0];
        const wantsRight = swipeRight;
        const action = deckActionForGesture(card.type, wantsRight);
        void (async () => {
          const result = await onDeckInteraction(card, action);
          if (!result.ok) {
            animate(x, 0, { type: 'spring', stiffness: 280, damping: 34, mass: 0.85 });
            return;
          }
          onDeckPostSuccess?.(card, action, result.data ?? null);
          const multi = deckCards.length > 1;
          if (multi) {
            await runServerDeckPullAnimation(wantsRight, card.cardInstanceId);
          } else {
            await animate(x, wantsRight ? 400 : -400, { duration: EXIT_MS, ease: [0.22, 1, 0.36, 1] });
            x.set(0);
            onDeckHeadConsumed?.(card.cardInstanceId);
          }
        })();
        return;
      }

      runPresetStripSwipe();
    },
    [
      x,
      presets,
      deckIndex,
      onPresetSelect,
      runDeckPullAnimation,
      useServerDeck,
      deckCards,
      onDeckInteraction,
      onDeckPostSuccess,
      onDeckHeadConsumed,
      runServerDeckPullAnimation,
    ],
  );

  // ── Контент карточки ──
  const renderCardContent = () => {
    if (isSuccess && resultImageUrl) {
      return (
        <div className="ghc-card__media ghc-card__media--result">
          <button
            type="button"
            className="ghc-card__media-tap"
            onClick={onResultTap}
            aria-label="Открыть стикер на весь экран"
          >
            <img
              src={resultImageUrl}
              alt="Сгенерированный стикер"
              className="ghc-card__result-img"
              draggable={false}
              onError={onResultOrPrevImgError}
            />
          </button>
          {canDownloadResult && (
            <button
              type="button"
              className="ghc-card__fab ghc-card__fab--download"
              onClick={onDownloadResult}
              disabled={isDownloadingResult}
              aria-label="Скачать стикер"
            >
              <DownloadIcon size={20} />
            </button>
          )}
          <div className="ghc-card__result-label">Результат</div>
        </div>
      );
    }

    if (isGenerating) {
      const showPrevBg = Boolean(duringJobPreviousResultUrl);
      const showStyleBg = !showPrevBg && Boolean(currentPreview);
      return (
        <div
          className={
            'ghc-card__media ghc-card__media--generating' +
            (generatingInlineSlot ? ' ghc-card__media--generating-inline' : '')
          }
          role="status"
          aria-live="polite"
          aria-label={generatingMessage}
        >
          {showPrevBg && duringJobPreviousResultUrl ? (
            <button
              type="button"
              className="ghc-card__media-tap ghc-card__media-tap--generating-bg"
              onClick={onDuringJobPreviousResultTap}
              aria-label="Открыть прошлый результат"
            >
              <img
                src={duringJobPreviousResultUrl}
                alt=""
                className="ghc-card__result-img ghc-card__result-img--prev ghc-card__result-img--generating-bg"
                draggable={false}
                onError={onResultOrPrevImgError}
              />
            </button>
          ) : null}
          {showStyleBg && currentPreview ? (
            <div className="ghc-card__generating-bg-preset" aria-hidden>
              <img
                src={currentPreview}
                alt=""
                className="ghc-card__preset-img ghc-card__preset-img--generating-bg"
                draggable={false}
                onError={(e) => {
                  onApiHostedImageError(e);
                  if (currentPreset?.id != null) onPresetPreviewError?.(currentPreset.id);
                }}
              />
            </div>
          ) : null}
          {generatingInlineSlot ? (
            <div className="ghc-card__generating-fields-wrap">{generatingInlineSlot}</div>
          ) : null}
        </div>
      );
    }

    if (showAvatarCard && avatarPreviewUrl) {
      return (
        <div className="ghc-card__media ghc-card__media--avatar">
          <button
            type="button"
            className="ghc-card__media-tap"
            onClick={onAvatarTap}
            aria-label="Открыть аватар"
          >
            <img
              src={avatarPreviewUrl}
              alt="Telegram-аватар"
              className="ghc-card__avatar-img"
              draggable={false}
            />
          </button>
          <button
            type="button"
            className="ghc-card__avatar-remove"
            onClick={onAvatarRemove}
            aria-label="Убрать аватар"
          >
            ×
          </button>
          <div className="ghc-card__overlay-caption">Сгенерировать по аватару</div>
        </div>
      );
    }

    if (useServerDeck && serverPresentCur) {
      if (serverCurrentPreview) {
        return (
          <div className="ghc-card__media ghc-card__media--preset">
            <img
              src={serverCurrentPreview}
              alt={serverPresentCur.title}
              className="ghc-card__preset-img"
              loading="eager"
              decoding="async"
              draggable={false}
              onError={onApiHostedImageError}
            />
          </div>
        );
      }
      if (serverHead?.type === 'STYLE_PRESET') {
        return (
          <div className="ghc-card__media ghc-card__media--preset ghc-card__media--preset-wait">
            <div className="ghc-card__preset-wait-inner" aria-hidden>
              <div className="ghc-card__preset-shimmer" />
            </div>
            <Pulsar size={40} colorScheme="warm" />
          </div>
        );
      }
      return (
        <div className="ghc-card__media ghc-card__media--deck-banner" aria-hidden>
          <span className="ghc-card__deck-banner-mark">✨</span>
        </div>
      );
    }

    if (currentPreset && currentPreview) {
      return (
        <div className="ghc-card__media ghc-card__media--preset">
          <img
            src={currentPreview}
            alt={stripPresetName(currentPreset.name)}
            className="ghc-card__preset-img"
            loading="eager"
            decoding="async"
            draggable={false}
            onError={(e) => {
              onApiHostedImageError(e);
              if (currentPreset.id != null) onPresetPreviewError?.(currentPreset.id);
            }}
          />
        </div>
      );
    }

    if (currentPreset && !currentPreview) {
      return (
        <div className="ghc-card__media ghc-card__media--preset ghc-card__media--preset-wait">
          <div className="ghc-card__preset-wait-inner" aria-hidden>
            <div className="ghc-card__preset-shimmer" />
          </div>
          <Pulsar size={40} colorScheme="warm" />
        </div>
      );
    }

    // Logo placeholder
    return (
      <div className="ghc-card__media ghc-card__media--logo">
        <div className="ghc-card__logo-stack">
          <img
            src={logoSrc}
            alt=""
            className="ghc-card__logo-img"
            loading="eager"
            draggable={false}
            aria-hidden
          />
        </div>
      </div>
    );
  };

  // Оверлей названия пресета (внизу карточки)
  const renderPresetMeta = () => {
    if (!isInteractive) return null;
    if (useServerDeck && serverPresentCur) {
      const sub = serverPresentCur.subtitle?.trim();
      return (
        <div className="ghc-card__meta">
          <span className="ghc-card__meta-name">{serverPresentCur.title}</span>
          <span
            className={
              'ghc-card__meta-author' + (sub ? '' : ' ghc-card__meta-author--empty')
            }
            aria-hidden={sub ? undefined : true}
          >
            {sub ?? ''}
          </span>
        </div>
      );
    }
    if (!currentPreset) return null;
    const name = stripPresetName(currentPreset.name);
    if (!name) return null;
    const author = formatPresetOwnerHandle(currentPreset);
    return (
      <div className="ghc-card__meta">
        <span className="ghc-card__meta-name">{name}</span>
        <span
          className={
            'ghc-card__meta-author' + (author ? '' : ' ghc-card__meta-author--empty')
          }
          aria-hidden={author ? undefined : true}
        >
          {author ?? ''}
        </span>
      </div>
    );
  };

  // Действия (share/delete) поверх карточки
  const renderActions = () => {
    if (!isInteractive) return null;
    if (useServerDeck) return null;
    if (!canDeleteStyle && !canShareStyle) return null;
    return (
      <div className="ghc-card__actions">
        <div className="ghc-card__actions-start">
          {canDeleteStyle && (
            <button
              type="button"
              className="ghc-card__action-btn ghc-card__action-btn--delete"
              onClick={onDeleteStyle}
              aria-label="Удалить стиль"
            >
              <DeleteIcon size={18} color="currentColor" />
            </button>
          )}
        </div>
        <div className="ghc-card__actions-end">
          {canShareStyle && (
            <button
              type="button"
              className="ghc-card__action-btn ghc-card__action-btn--share"
              onClick={onShareStyle}
              aria-label="Поделиться стилем"
            >
              <ShareIcon size={18} color="currentColor" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const showBgDeck = isInteractive
    ? useServerDeck
      ? Boolean(deckCards && deckCards.length > 1)
      : Boolean(nextPreset && presets.length > 1)
    : false;
  const bgPreviewUrl = useServerDeck ? serverNextPreview : nextPreview;

  return (
    <div
      className={
        (composeSlot ? 'ghc-root ghc-root--with-compose' : 'ghc-root') +
        (deckFlowNonStyle && composeSlot ? ' ghc-root--deck-flow' : '')
      }
    >
      {/* Фоновая карточка — следующий пресет: тот же ритм 84/16, мягче чем верхняя */}
      {showBgDeck && (
        <motion.div
          className={
            'ghc-bg-card' +
            (bgPromoting ? ' ghc-bg-card--promoting' : '') +
            (hideBackLayer ? ' ghc-bg-card--swap-hide' : '')
          }
          style={{
            top: bgTop,
            left: bgLeft,
            width: bgWidth,
            height: bgHeight,
            borderRadius: bgRadius,
          }}
        >
          <div className="ghc-bg-card__frame">
            <div className="ghc-bg-card__media">
              {bgPreviewUrl ? (
                <img
                  src={bgPreviewUrl}
                  alt=""
                  className="ghc-bg-card__img"
                  draggable={false}
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="ghc-bg-card__logo">
                  <img src={logoSrc} alt="" draggable={false} aria-hidden />
                </div>
              )}
            </div>
            <div className="ghc-bg-card__footer" aria-hidden />
          </div>
        </motion.div>
      )}

      {/* Основная свайп-карточка */}
      <motion.div
        className={
          'ghc-card' +
          (isGenerating && generatingInlineSlot ? ' ghc-card--generating-inline' : '') +
          (composeSlot ? ' ghc-card--compose-slot' : '')
        }
        style={{
          x: isInteractive ? x : undefined,
          rotate: isInteractive ? rotate : undefined,
          opacity:
            isInteractive
              ? hideFrontForDeck
                ? 0
                : cardOpacity
              : undefined,
          cursor: isInteractive ? 'grab' : 'default',
        }}
        drag={isInteractive && !deckTransitioning ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      >
        {renderActions()}

        {/* Like overlay */}
        <motion.div
          className="ghc-card__like-overlay"
          style={{ opacity: likeOpacity }}
          aria-hidden
        >
          <span className="ghc-card__like-label">{overlayLabels.like}</span>
        </motion.div>

        {/* Nope overlay */}
        <motion.div
          className="ghc-card__nope-overlay"
          style={{ opacity: nopeOpacity }}
          aria-hidden
        >
          <span className="ghc-card__nope-label">{overlayLabels.nope}</span>
        </motion.div>

        <div
          className={
            'ghc-card__visual' + (composeSlot ? ' ghc-card__visual--with-compose' : '')
          }
        >
          {renderCardContent()}
          {renderPresetMeta()}
        </div>
        {composeSlot ? (
          <div
            ref={composeSlotRef as LegacyRef<HTMLDivElement>}
            className="ghc-card__compose-slot"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {composeSlot}
          </div>
        ) : null}
      </motion.div>

      {/* Счётчик карточек */}
      {isInteractive && (useServerDeck ? deckCards && deckCards.length > 1 : presets.length > 1) && (
        <div className="ghc-deck-counter" aria-hidden>
          {useServerDeck && deckCards ? `1 / ${deckCards.length}` : `${deckIndex + 1} / ${presets.length}`}
        </div>
      )}
    </div>
  );
};
