import { FC } from 'react';
import './StickerSetsTabs.css';

interface StickerSetsTabsProps {
  activeTab: number;
  onChange: (newValue: number) => void;
  disabled?: boolean;
}

/** По Figma ACCOUNT: Create, Likes, Upload */
const TABS = [
  { index: 0, label: 'Create' },
  { index: 1, label: 'Likes' },
  { index: 2, label: 'Upload' },
];

export const StickerSetsTabs: FC<StickerSetsTabsProps> = ({
  activeTab,
  onChange,
  disabled = false
}) => {
  return (
    <div
      className={`sticker-sets-tabs ${disabled ? 'sticker-sets-tabs--disabled' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <div role="tablist" className="sticker-sets-tabs__list">
        {TABS.map(({ index, label }) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            id={`sticker-sets-tab-${index}`}
            aria-controls={`sticker-sets-tabpanel-${index}`}
            disabled={disabled}
            onClick={() => onChange(index)}
            className={`sticker-sets-tabs__tab ${activeTab === index ? 'sticker-sets-tabs__tab--active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
