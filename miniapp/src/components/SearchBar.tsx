import { memo, FC, KeyboardEvent } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import './SearchBar.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

// SVG Icons
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.35-4.35"></path>
  </svg>
);

const ClearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SearchBarComponent: FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "Поиск стикеров...",
  disabled = false,
  compact = false
}) => {
  const { tg } = useTelegram();
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;

  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const textColor = isLight ? 'rgba(13,27,42,0.64)' : 'var(--tg-theme-hint-color, rgba(255,255,255,0.64))';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.58)' : 'rgba(118, 168, 255, 0.28)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.48)' : 'rgba(78, 132, 255, 0.24)';

  const handleClear = () => {
    onChange('');
    onSearch?.('');
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  const handleSearchClick = () => {
    if (onSearch && !disabled) {
      onSearch(value);
    }
  };

  return (
    <div className={`search-bar ${compact ? 'search-bar--compact' : ''}`}>
      <button
        type="button"
        onClick={handleSearchClick}
        disabled={disabled}
        className="search-bar__icon-button search-bar__search"
        style={{ color: disabled ? 'var(--tg-theme-hint-color)' : textColorResolved }}
      >
        <SearchIcon />
      </button>
      
      <input
        type="text"
        className="search-bar__input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        data-testid="search-input"
        style={{
          color: textColorResolved,
          backgroundColor: glassSolid,
          borderColor: borderColor,
        }}
      />
      
      {value && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="search-bar__icon-button search-bar__clear"
          style={{ color: textColor }}
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
};

export const SearchBar = memo(SearchBarComponent);
