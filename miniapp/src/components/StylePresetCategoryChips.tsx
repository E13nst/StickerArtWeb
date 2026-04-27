import { FC, KeyboardEvent } from 'react';
import type { StylePresetCategoryDto } from '@/api/client';
import { useTelegram } from '@/hooks/useTelegram';
import './StylePresetCategoryChips.css';

export type StyleCategoryFilter = 'all' | number;

interface StylePresetCategoryChipsProps {
  categories: StylePresetCategoryDto[];
  value: StyleCategoryFilter;
  onChange: (next: StyleCategoryFilter) => void;
  allLabel?: string;
  disabled?: boolean;
  compact?: boolean;
}

export const StylePresetCategoryChips: FC<StylePresetCategoryChipsProps> = ({
  categories,
  value,
  onChange,
  allLabel = 'Все',
  disabled = false,
  compact = false,
}) => {
  const { tg } = useTelegram();
  const padding = compact ? '0.35rem 0.7rem' : '0.45rem 0.9rem';
  const fontSize = compact ? '0.75rem' : '0.8125rem';
  const baseOpacityUnselected = compact ? 0.72 : 0.88;

  const handlePick = (next: StyleCategoryFilter) => {
    if (disabled) return;
    if (next === value) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onChange(next);
  };

  const onChipKey = (e: KeyboardEvent, next: StyleCategoryFilter) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePick(next);
    }
  };

  return (
    <div
      className="style-preset-category-chips horiz-scroll-bleed category-filter-scroller"
      role="tablist"
      aria-label="Категория стиля"
      aria-disabled={disabled || undefined}
    >
      <div
        role="tab"
        tabIndex={0}
        aria-selected={value === 'all'}
        className="style-preset-category-chips__chip"
        data-selected={value === 'all' ? 'true' : undefined}
        style={{
          padding,
          fontSize,
          opacity: value === 'all' ? 1 : baseOpacityUnselected,
        }}
        onClick={() => handlePick('all')}
        onKeyDown={(e) => onChipKey(e, 'all')}
        aria-disabled={disabled || undefined}
      >
        {allLabel}
      </div>
      {categories.map((c) => {
        const selected = value === c.id;
        return (
          <div
            key={c.id}
            role="tab"
            tabIndex={0}
            title={c.name}
            aria-selected={selected}
            className="style-preset-category-chips__chip"
            data-selected={selected ? 'true' : undefined}
            style={{
              padding,
              fontSize,
              opacity: selected ? 1 : baseOpacityUnselected,
            }}
            onClick={() => handlePick(c.id)}
            onKeyDown={(e) => onChipKey(e, c.id)}
            aria-disabled={disabled || undefined}
          >
            {c.name}
          </div>
        );
      })}
    </div>
  );
};
