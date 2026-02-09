import { useState, useRef, useEffect, FC } from 'react';
import { createPortal } from 'react-dom';
import { useTelegram } from '../hooks/useTelegram';
import './SortDropdown.css';

interface SortDropdownProps {
  sortByLikes: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Компактный режим: на кнопке показывать только эту подпись (например "Date") и иконку стрелки */
  triggerLabel?: string;
}

const SORT_OPTIONS = [
  { id: 'likes', label: 'По популярности', value: true },
  { id: 'new', label: 'Новые', value: false },
];

const ArrowDownIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transition: 'transform 0.3s',
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      flexShrink: 0,
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const SortDropdown: FC<SortDropdownProps> = ({
  sortByLikes,
  onToggle,
  disabled = false,
  triggerLabel,
}) => {
  const { tg } = useTelegram();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (typeof document !== 'undefined' && (target as Element).closest?.('[data-sort-dropdown-panel]')) return;
      if ((target as Element).closest?.('.sort-dropdown__backdrop')) setIsOpen(false);
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleMenu = () => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    setIsOpen(!isOpen);
  };

  const handleSortSelect = (newValue: boolean) => {
    if (disabled) return;
    tg?.HapticFeedback?.impactOccurred('light');
    if (sortByLikes !== newValue) {
      onToggle();
    }
    setIsOpen(false);
  };

  const currentOption = SORT_OPTIONS.find((opt) => opt.value === sortByLikes);
  const displayLabel = triggerLabel ?? (currentOption?.label ?? 'Новые');

  return (
    <div ref={dropdownRef} className="sort-dropdown">
      <button
        type="button"
        onClick={handleToggleMenu}
        disabled={disabled}
        className="sort-dropdown__trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={displayLabel}
      >
        <span>{displayLabel}</span>
        <ArrowDownIcon isOpen={isOpen} />
      </button>

      {isOpen &&
        createPortal(
          <>
            <div
              className="sort-dropdown__backdrop"
              aria-hidden
              onClick={() => {
                tg?.HapticFeedback?.impactOccurred('light');
                setIsOpen(false);
              }}
            />
            <div
              data-sort-dropdown-panel
              className="sort-dropdown__panel"
              role="listbox"
              aria-label="Сортировка"
            >
              <div className="sort-dropdown__inner">
                <div className="sort-dropdown__header">
                  <span className="sort-dropdown__title">Сортировка</span>
                </div>
                {SORT_OPTIONS.map((option) => {
                  const isSelected = sortByLikes === option.value;
                  return (
                    <div
                      key={option.id}
                      role="option"
                      aria-selected={isSelected}
                      className={`sort-dropdown__option${isSelected ? ' sort-dropdown__option--active' : ''}`}
                      onClick={() => handleSortSelect(option.value)}
                    >
                      <span
                        className={`sort-dropdown__option-label${isSelected ? ' sort-dropdown__option-label--active' : ''}`}
                      >
                        {option.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};
