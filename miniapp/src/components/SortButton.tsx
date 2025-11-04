import React from 'react';

interface SortButtonProps {
  sortByLikes: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const SortButton: React.FC<SortButtonProps> = ({
  sortByLikes,
  onToggle,
  disabled = false
}) => {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-label={sortByLikes ? 'Сортировать по умолчанию' : 'Сортировать по лайкам'}
      data-testid="sort-button"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 0.618rem', // Отступы по горизонтали
        borderRadius: '0.59rem', // 0.236 * 2.5rem ≈ 0.59rem
        background: sortByLikes 
          ? 'var(--tg-theme-button-color, #2481cc)' 
          : 'var(--tg-theme-secondary-bg-color, #ffffff)',
        color: sortByLikes 
          ? 'var(--tg-theme-button-text-color, #ffffff)' 
          : 'var(--tg-theme-text-color, #000000)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontSize: '0.955rem', // 0.382 * 2.5rem ≈ 0.955rem
        fontWeight: 400,
        transition: 'all 0.2s',
        outline: 'none',
        border: 'none',
        boxShadow: 'none',
        height: '2.5rem', // Высота по пропорции
        minWidth: '2.5rem',
        userSelect: 'none'
      }}
    >
      {sortByLikes ? '❤️' : '🤍'}
    </button>
  );
};
