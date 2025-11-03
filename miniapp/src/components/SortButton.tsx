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
        padding: '4px 8px',
        borderRadius: '13px',
        background: sortByLikes 
          ? 'var(--tg-theme-button-color, #2481cc)' 
          : 'var(--tg-theme-secondary-bg-color, #ffffff)',
        color: sortByLikes 
          ? 'var(--tg-theme-button-text-color, #ffffff)' 
          : 'var(--tg-theme-text-color, #000000)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontSize: '20px',
        fontWeight: 400,
        transition: 'all 0.2s',
        outline: 'none',
        border: 'none',
        boxShadow: 'none',
        minHeight: '32px',
        minWidth: '32px',
        userSelect: 'none'
      }}
    >
      {sortByLikes ? '❤️' : '🤍'}
    </button>
  );
};
