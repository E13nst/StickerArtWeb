import { useCallback, memo, CSSProperties, FC, MouseEvent } from 'react';
import { useGlassEffect } from '../hooks/useGlassEffect';
import { useTelegram } from '../hooks/useTelegram';

interface SortButtonProps {
  sortByLikes: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const SortButtonComponent: FC<SortButtonProps> = ({
  sortByLikes,
  onToggle,
  disabled = false
}) => {
  const {
    glassBase,
    glassSolid,
    glassHover,
    borderColor,
    textColorResolved,
    accentShadow,
    accentShadowHover,
  } = useGlassEffect();
  const { tg } = useTelegram();

  const handleClick = useCallback(() => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onToggle();
  }, [disabled, onToggle, tg?.HapticFeedback]);

  const baseBackground = sortByLikes ? glassHover : glassBase;
  const baseSolid = sortByLikes ? glassHover : glassSolid;
  const baseShadow = sortByLikes ? accentShadowHover : accentShadow;
  const baseTransform = sortByLikes ? 'scale(0.98)' : 'scale(1)';

  const baseStyles: CSSProperties = {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 0.75rem',
    borderRadius: '0.75rem',
    background: baseBackground,
    backgroundColor: baseSolid,
    color: textColorResolved,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.52 : 1,
    fontSize: '0.875rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    outline: 'none',
    border: `1px solid ${borderColor}`,
    boxShadow: baseShadow,
    height: '2.2rem',
    minWidth: '2.8rem',
    userSelect: 'none',
    gap: '0.42rem',
    transform: baseTransform,
  };

  const applyHoverStyles = (element: HTMLButtonElement) => {
    Object.assign(element.style, {
      background: glassHover,
      backgroundColor: glassHover,
      transform: 'scale(0.98)',
      boxShadow: accentShadowHover,
    });
  };

  const applyBaseStyles = (element: HTMLButtonElement) => {
    Object.assign(element.style, {
      background: baseBackground,
      backgroundColor: baseSolid,
      transform: baseTransform,
      boxShadow: baseShadow,
    });
  };

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    applyHoverStyles(event.currentTarget);
  };

  const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    applyBaseStyles(event.currentTarget);
  };

  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    if (disabled) return;
    applyHoverStyles(event.currentTarget);
  };

  const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    if (disabled) return;
    applyBaseStyles(event.currentTarget);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={sortByLikes ? 'Сортировать по умолчанию' : 'Сортировать по лайкам'}
      data-testid="sort-button"
      style={baseStyles}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>{sortByLikes ? '❤️' : '🔥'}</span>
      <span style={{ fontSize: '0.75rem', opacity: 0.86 }}>
        {sortByLikes ? 'Топ' : 'Новые'}
      </span>
    </button>
  );
};

// Мемоизация для предотвращения ререндера при изменении других пропсов родителя
export const SortButton = memo(SortButtonComponent);
