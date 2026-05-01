import { FC, KeyboardEvent } from 'react';
import type { StylePresetCategoryDto } from '@/api/client';
import { useTelegram } from '@/hooks/useTelegram';
import './StylePresetCategoryChips.css';

export const STYLE_CATEGORY_FILTER_MY = 'my' as const;
export type StyleCategoryFilter = number | typeof STYLE_CATEGORY_FILTER_MY;

interface StylePresetCategoryChipsProps {
  categories: StylePresetCategoryDto[];
  value: StyleCategoryFilter;
  onChange: (next: StyleCategoryFilter) => void;
  showMineChip?: boolean;
  mineChipLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  variant?: 'default' | 'gallery';
}

export const StylePresetCategoryChips: FC<StylePresetCategoryChipsProps> = ({
  categories,
  value,
  onChange,
  showMineChip = false,
  mineChipLabel = 'Мои',
  disabled = false,
  compact = false,
  variant = 'default',
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
      className={[
        'style-preset-category-chips',
        'horiz-scroll-bleed',
        'category-filter-scroller',
        variant === 'gallery' && 'style-preset-category-chips--gallery',
      ]
        .filter(Boolean)
        .join(' ')}
      role="tablist"
      aria-label="Категория стиля"
      aria-disabled={disabled || undefined}
    >
      {showMineChip && (
        <div
          role="tab"
          tabIndex={0}
          title={mineChipLabel}
          aria-selected={value === STYLE_CATEGORY_FILTER_MY}
          className="style-preset-category-chips__chip"
          data-selected={value === STYLE_CATEGORY_FILTER_MY ? 'true' : undefined}
          style={{
            padding,
            fontSize,
            opacity: value === STYLE_CATEGORY_FILTER_MY ? 1 : baseOpacityUnselected,
          }}
          onClick={() => handlePick(STYLE_CATEGORY_FILTER_MY)}
          onKeyDown={(e) => onChipKey(e, STYLE_CATEGORY_FILTER_MY)}
          aria-disabled={disabled || undefined}
        >
          {mineChipLabel}
        </div>
      )}
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
