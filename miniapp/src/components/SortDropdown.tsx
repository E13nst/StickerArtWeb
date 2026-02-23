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

export const SortDropdown: FC<SortDropdownProps> = ({
  sortByLikes,
  onToggle,
  disabled = false,
  triggerLabel,
}) => {
  const { tg, user } = useTelegram();
  const isRu = (user?.language_code || 'ru').toLowerCase().startsWith('ru');
  const sortOptions = [
    { id: 'likes', label: isRu ? 'Сначала популярные' : 'By popularity', value: true },
    { id: 'new', label: isRu ? 'Сначала новые' : 'Date (new)', value: false },
  ];
  const sortAriaLabel = isRu ? 'Сортировка' : 'Sort';
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

  const currentOption = sortOptions.find((opt) => opt.value === sortByLikes);
  const displayLabel = triggerLabel ?? (currentOption?.label ?? (isRu ? 'Сначала новые' : 'Date (new)'));

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
              aria-label={sortAriaLabel}
            >
              <div className="sort-dropdown__inner">
                <div className="sort-dropdown__header">
                  <span className="sort-dropdown__title">{isRu ? 'Сортировка' : 'Sort By'}</span>
                </div>
                {sortOptions.map((option) => {
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
