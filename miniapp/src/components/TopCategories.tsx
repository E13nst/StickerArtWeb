import { FC } from 'react';
import { Text } from '@/components/ui/Text';

interface Category {
  name: string;
  count: number;
  emoji: string;
}

interface TopCategoriesProps {
  categories: Category[];
}

export const TopCategories: FC<TopCategoriesProps> = ({ categories }) => {
  return (
    <div style={{ marginTop: 32 }}>
      <Text variant="h4" weight="bold" style={{ color: 'var(--tg-theme-text-color)', marginBottom: 16, fontSize: '1.25rem' }}>
        ТОП-8 КАТЕГОРИЙ
      </Text>
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: 'calc(1rem * 0.382)',
          padding: 'calc(1rem * 0.382)',
          scrollbarWidth: 'none',
          maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
        }}
        className="top-categories-scroll"
      >
        {categories.map((category) => (
          <div
            key={category.name}
            role="button"
            tabIndex={0}
            onClick={() => {}}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}
            style={{
              flexShrink: 0,
              padding: '4px 8px',
              borderRadius: '13px',
              backgroundColor: 'color-mix(in srgb, var(--tg-theme-secondary-bg-color) 25%, transparent)',
              color: 'var(--tg-theme-text-color)',
              fontSize: '14px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: '1px solid color-mix(in srgb, var(--tg-theme-hint-color) 40%, transparent)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              userSelect: 'none',
            }}
          >
            {category.name} ({category.count})
          </div>
        ))}
      </div>
    </div>
  );
};
