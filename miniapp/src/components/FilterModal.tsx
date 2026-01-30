import React, { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { BottomSheet } from './ui/BottomSheet';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import './FilterModal.css';

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  onApply?: (filters: FilterState) => void;
}

// Placeholder filter state structure
export interface FilterState {
  stickerType: string[];
  difficulty: string | null;
  dateAdded: string | null;
}

const STICKER_TYPES = [
  { id: 'static', label: 'Статичные' },
  { id: 'animated', label: 'Анимированные' },
  { id: 'video', label: 'Видео' },
];

const DIFFICULTY_LEVELS = [
  { id: 'easy', label: 'Легкий' },
  { id: 'medium', label: 'Средний' },
  { id: 'hard', label: 'Сложный' },
];

const DATE_RANGES = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'За неделю' },
  { id: 'month', label: 'За месяц' },
  { id: 'all', label: 'Все время' },
];

export const FilterModal: React.FC<FilterModalProps> = ({
  open,
  onClose,
  onApply,
}) => {
  const { tg } = useTelegram();

  const [filters, setFilters] = useState<FilterState>({
    stickerType: [],
    difficulty: null,
    dateAdded: 'all',
  });

  const handleToggleStickerType = (typeId: string) => {
    setFilters((prev) => ({
      ...prev,
      stickerType: prev.stickerType.includes(typeId)
        ? prev.stickerType.filter((id) => id !== typeId)
        : [...prev.stickerType, typeId],
    }));
  };

  const handleSelectDifficulty = (difficultyId: string) => {
    setFilters((prev) => ({
      ...prev,
      difficulty: prev.difficulty === difficultyId ? null : difficultyId,
    }));
  };

  const handleSelectDateRange = (dateId: string) => {
    setFilters((prev) => ({
      ...prev,
      dateAdded: dateId,
    }));
  };

  const handleApply = () => {
    tg?.HapticFeedback?.impactOccurred('medium');
    onApply?.(filters);
    onClose();
  };

  const handleReset = () => {
    tg?.HapticFeedback?.impactOccurred('light');
    setFilters({
      stickerType: [],
      difficulty: null,
      dateAdded: 'all',
    });
  };

  const handleClose = () => {
    tg?.HapticFeedback?.impactOccurred('light');
    onClose();
  };

  return (
    <BottomSheet
      isOpen={open}
      onClose={handleClose}
      title="Фильтры"
      showCloseButton={true}
    >
      <div className="filter-modal-content">
        {/* Sticker Type Section */}
        <div className="filter-section">
          <Text variant="bodySmall" weight="semibold" color="secondary" className="filter-section-title">
            Тип стикеров
          </Text>
          <div className="filter-options">
            {STICKER_TYPES.map((type) => {
              const isSelected = filters.stickerType.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => handleToggleStickerType(type.id)}
                  className={`filter-option ${isSelected ? 'filter-option--selected' : ''}`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty Section */}
        <div className="filter-section">
          <Text variant="bodySmall" weight="semibold" color="secondary" className="filter-section-title">
            Сложность
          </Text>
          <div className="filter-options">
            {DIFFICULTY_LEVELS.map((level) => {
              const isSelected = filters.difficulty === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => handleSelectDifficulty(level.id)}
                  className={`filter-option ${isSelected ? 'filter-option--selected' : ''}`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Added Section */}
        <div className="filter-section">
          <Text variant="bodySmall" weight="semibold" color="secondary" className="filter-section-title">
            Дата добавления
          </Text>
          <div className="filter-options">
            {DATE_RANGES.map((range) => {
              const isSelected = filters.dateAdded === range.id;
              return (
                <button
                  key={range.id}
                  onClick={() => handleSelectDateRange(range.id)}
                  className={`filter-option ${isSelected ? 'filter-option--selected' : ''}`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="filter-divider" />

        {/* Action Buttons */}
        <div className="filter-actions">
          <Button
            variant="outline"
            onClick={handleReset}
            className="filter-action-button"
          >
            Сбросить
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            className="filter-action-button"
          >
            Применить
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};
