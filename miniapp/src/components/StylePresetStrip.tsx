import React from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { StylePreset } from '@/api/client';
import './StylePresetStrip.css';

interface StylePresetStripProps {
  presets: StylePreset[];
  selectedPresetId: number | null;
  onPresetChange: (presetId: number | null) => void;
  disabled?: boolean;
}

/** Figma: horizontal row 70×70 preview + 12px label, 16px radius, #262626 */
export const StylePresetStrip: React.FC<StylePresetStripProps> = ({
  presets,
  selectedPresetId,
  onPresetChange,
  disabled = false,
}) => {
  const { tg } = useTelegram();

  const options: { id: number | null; name: string }[] = [
    { id: null, name: 'Без стиля' },
    ...presets.map((p) => ({ id: p.id, name: p.name })),
  ];

  const handleSelect = (presetId: number | null) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    onPresetChange(presetId);
  };

  return (
    <div className="style-preset-strip">
      <div className="style-preset-strip__scroll" role="listbox" aria-label="Стиль">
        {options.map((opt) => {
          const isSelected = selectedPresetId === opt.id;
          return (
            <button
              key={opt.id === null ? 'none' : opt.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={disabled}
              className={['style-preset-strip__card', isSelected && 'style-preset-strip__card--selected']
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleSelect(opt.id)}
            >
              <div className="style-preset-strip__preview" />
              <span className="style-preset-strip__label">{opt.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
