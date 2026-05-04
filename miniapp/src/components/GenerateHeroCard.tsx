import { FC, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import type { StylePreset } from '@/api/client';
import { Pulsar } from '@/components/ui/Pulsar';
import { DeleteIcon, ShareIcon, DownloadIcon } from '@/components/ui/Icons';
import './GenerateHeroCard.css';

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
}) => {
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

  /** Пресеты впереди по кругу для префетча и плавной колоды */
  const lookaheadUrls = useMemo(() => {
    if (presets.length === 0) return [];
    const out: string[] = [];
    for (let k = 1; k <= 4; k++) {
      const p = presets[(deckIndex + k) % presets.length];
      const u = p ? getPresetPreview(p, presetPreviewById) : null;
      if (u) out.push(u);
    }
    return [...new Set(out)];
  }, [presets, deckIndex, presetPreviewById]);

  useEffect(() => {
    for (const url of lookaheadUrls) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [lookaheadUrls]);

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

  const handleDragStart = useCallback(() => {
    hapticFiredRef.current = false;
  }, []);

  const handleDrag = useCallback((_e: PointerEvent, info: PanInfo) => {
    if (!hapticFiredRef.current && Math.abs(info.offset.x) >= HAPTIC_THRESHOLD) {
      hapticFiredRef.current = true;
      onHapticLight?.();
    }
  }, [onHapticLight]);

  const handleDragEnd = useCallback(
    (_e: PointerEvent, info: PanInfo) => {
      const dist = info.offset.x;
      const vel = info.velocity.x;
      hapticFiredRef.current = false;

      if (deckBusyRef.current) return;

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
    },
    [x, presets, deckIndex, onPresetSelect, runDeckPullAnimation],
  );

  const isGenerating = pageState === 'generating' || pageState === 'uploading';
  const isSuccess = pageState === 'success';
  const isInteractive = !isGenerating && !isSuccess;

  // Определяем текущий и следующий пресет для стека карточек
  const currentPreset = presets[deckIndex] ?? null;
  const nextPreset = presets[(deckIndex + 1) % presets.length] ?? null;
  const currentPreview = currentPreset ? getPresetPreview(currentPreset, presetPreviewById) : null;
  const nextPreview = nextPreset ? getPresetPreview(nextPreset, presetPreviewById) : null;

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
      return (
        <div
          className={
            'ghc-card__media ghc-card__media--generating' +
            (duringJobPreviousResultUrl ? ' ghc-card__media--generating-prev' : '')
          }
        >
          {duringJobPreviousResultUrl ? (
            <>
              <button
                type="button"
                className="ghc-card__media-tap"
                onClick={onResultTap}
                aria-label="Открыть прошлый результат"
              >
                <img
                  src={duringJobPreviousResultUrl}
                  alt=""
                  className="ghc-card__result-img ghc-card__result-img--prev"
                  draggable={false}
                />
              </button>
              <div className="ghc-card__generating-overlay">
                <Pulsar size={48} colorScheme="warm" />
                <p className="ghc-card__generating-msg">{generatingMessage}</p>
              </div>
            </>
          ) : (
            <div className="ghc-card__generating-center">
              <Pulsar size={80} colorScheme="warm" />
              <p className="ghc-card__generating-msg">{generatingMessage}</p>
            </div>
          )}
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
            onError={() => {
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
    if (!isInteractive || !currentPreset) return null;
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

  return (
    <div className="ghc-root">
      {/* Фоновая карточка — следующий пресет: тот же ритм 84/16, мягче чем верхняя */}
      {isInteractive && nextPreset && presets.length > 1 && (
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
              {nextPreview ? (
                <img
                  src={nextPreview}
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
        className="ghc-card"
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
          <span className="ghc-card__like-label">♥ НРАВИТСЯ</span>
        </motion.div>

        {/* Nope overlay */}
        <motion.div
          className="ghc-card__nope-overlay"
          style={{ opacity: nopeOpacity }}
          aria-hidden
        >
          <span className="ghc-card__nope-label">✕ ДАЛЬШЕ</span>
        </motion.div>

        {renderCardContent()}
        {renderPresetMeta()}
      </motion.div>

      {/* Счётчик карточек */}
      {isInteractive && presets.length > 1 && (
        <div className="ghc-deck-counter" aria-hidden>
          {deckIndex + 1} / {presets.length}
        </div>
      )}
    </div>
  );
};
