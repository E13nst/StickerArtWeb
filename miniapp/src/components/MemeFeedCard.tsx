import { FC, useCallback, useRef, useState } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { useTelegram } from '@/hooks/useTelegram';
import { useMemeFeed, MemeFeedVoteType } from '@/hooks/useMemeFeed';
import { MemeCandidateDto } from '@/types/meme';
import './MemeFeedCard.css';

// ──────────────────────────────────────────────
// Вспомогательный компонент: карточка-изображение
// ──────────────────────────────────────────────

const SWIPE_THRESHOLD = 120;
const ROTATION_MAX = 15;

interface CardProps {
  candidate: MemeCandidateDto;
  onVote: (type: MemeFeedVoteType, isSwipe: boolean) => void;
}

const MemeCard: FC<CardProps> = ({ candidate, onVote }) => {
  const { tg } = useTelegram();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-ROTATION_MAX, 0, ROTATION_MAX]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const dislikeOpacity = useTransform(x, [-100, -20], [1, 0]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      setIsDragging(false);
      const { offset, velocity } = info;
      const isSwipe =
        Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500;

      if (!isSwipe) {
        x.set(0);
        return;
      }

      tg?.HapticFeedback?.impactOccurred('medium');

      const direction: MemeFeedVoteType = offset.x > 0 ? 'like' : 'dislike';
      x.set(direction === 'like' ? 600 : -600);

      setTimeout(() => {
        onVote(direction, true);
        x.set(0);
      }, 200);
    },
    [onVote, tg, x]
  );

  const imageUrl = candidate.imageUrl;

  return (
    <motion.div
      className="meme-feed-card"
      drag="x"
      dragConstraints={{ left: -300, right: 300 }}
      dragElastic={0.7}
      dragMomentum={false}
      style={{ x, rotate, touchAction: 'none', userSelect: 'none' }}
      animate={!isDragging ? { x: 0 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
    >
      {/* Индикатор лайка (правый свайп) */}
      <motion.div
        className="meme-feed-card__indicator meme-feed-card__indicator--like"
        style={{ opacity: likeOpacity }}
        aria-hidden="true"
      >
        👍
      </motion.div>

      {/* Индикатор дизлайка (левый свайп) */}
      <motion.div
        className="meme-feed-card__indicator meme-feed-card__indicator--dislike"
        style={{ opacity: dislikeOpacity }}
        aria-hidden="true"
      >
        👎
      </motion.div>

      {/* Изображение */}
      <div className="meme-feed-card__image-wrap">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Мем-кандидат"
            className="meme-feed-card__image"
            draggable={false}
          />
        ) : (
          <div className="meme-feed-card__image-placeholder">🖼️</div>
        )}
      </div>

      {/* Мета-информация */}
      <div className="meme-feed-card__footer">
        {candidate.stylePresetName && (
          <span className="meme-feed-card__preset">{candidate.stylePresetName}</span>
        )}
        <div className="meme-feed-card__counts">
          <span className="meme-feed-card__count meme-feed-card__count--like">
            👍 {candidate.likesCount}
          </span>
          <span className="meme-feed-card__count meme-feed-card__count--dislike">
            👎 {candidate.dislikesCount}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ──────────────────────────────────────────────
// Вспомогательные экраны
// ──────────────────────────────────────────────

const EmptyScreen: FC<{ onReset: () => void }> = ({ onReset }) => (
  <div className="meme-feed__state-screen">
    <div className="meme-feed__state-icon">🎉</div>
    <h3 className="meme-feed__state-title">Всё просмотрено!</h3>
    <p className="meme-feed__state-desc">Возвращайся позже — появятся новые мемы.</p>
    <button className="meme-feed__state-btn" onClick={onReset}>
      Обновить
    </button>
  </div>
);

const LimitScreen: FC<{ resetAt: string | null; onReset: () => void }> = ({
  resetAt,
  onReset,
}) => {
  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="meme-feed__state-screen">
      <div className="meme-feed__state-icon">⏳</div>
      <h3 className="meme-feed__state-title">Лимит свайпов на сегодня исчерпан</h3>
      {resetTime && (
        <p className="meme-feed__state-desc">Лимит сбросится в {resetTime}</p>
      )}
      <button className="meme-feed__state-btn" onClick={onReset}>
        Попробовать снова
      </button>
    </div>
  );
};

// ──────────────────────────────────────────────
// Основной компонент: MemeFeedCard
// ──────────────────────────────────────────────

/**
 * Полноценный экран ленты мем-кандидатов.
 *
 * Использование:
 * ```tsx
 * <MemeFeedCard />
 * ```
 */
export const MemeFeedCard: FC = () => {
  const { current, isLoading, error, isEmpty, isLimitReached, limitResetAt, vote, reset, clearError } =
    useMemeFeed();

  const isVotingRef = useRef(false);

  const handleVote = useCallback(
    async (type: MemeFeedVoteType, isSwipe: boolean) => {
      if (isVotingRef.current) return;
      isVotingRef.current = true;
      try {
        await vote(type, isSwipe);
      } finally {
        isVotingRef.current = false;
      }
    },
    [vote]
  );

  if (isLoading) {
    return (
      <div className="meme-feed__state-screen">
        <div className="meme-feed__spinner" aria-label="Загрузка" />
      </div>
    );
  }

  if (isLimitReached) {
    return <LimitScreen resetAt={limitResetAt} onReset={reset} />;
  }

  if (isEmpty || current === null) {
    return <EmptyScreen onReset={reset} />;
  }

  return (
    <div className="meme-feed">
      {error && (
        <div className="meme-feed__error" role="alert">
          <span>{error}</span>
          <button className="meme-feed__error-close" onClick={clearError} aria-label="Закрыть">
            ✕
          </button>
        </div>
      )}

      {/* Карточка с горизонтальным свайпом */}
      <MemeCard candidate={current} onVote={handleVote} />

      {/* Кнопки голосования (без isSwipe) */}
      <div className="meme-feed__actions">
        <button
          className="meme-feed__action-btn meme-feed__action-btn--dislike"
          onClick={() => handleVote('dislike', false)}
          aria-label="Дизлайк"
        >
          👎
        </button>
        <button
          className="meme-feed__action-btn meme-feed__action-btn--like"
          onClick={() => handleVote('like', false)}
          aria-label="Лайк"
        >
          👍
        </button>
      </div>

      <p className="meme-feed__hint">Свайп вправо — лайк · влево — дизлайк</p>
    </div>
  );
};
