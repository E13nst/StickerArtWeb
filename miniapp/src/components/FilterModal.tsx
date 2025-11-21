import React, { useState } from 'react';
import { Box, Drawer, Typography, Button, Divider } from '@mui/material';
import { useTelegram } from '../hooks/useTelegram';
import CloseIcon from '@mui/icons-material/Close';

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
  const scheme = tg?.colorScheme;
  const isLight = scheme ? scheme === 'light' : true;

  const [filters, setFilters] = useState<FilterState>({
    stickerType: [],
    difficulty: null,
    dateAdded: 'all',
  });

  const textColorResolved = isLight ? '#0D1B2A' : 'var(--tg-theme-button-text-color, #ffffff)';
  const glassBase = isLight ? 'rgba(164, 206, 255, 0.28)' : 'rgba(88, 138, 255, 0.20)';
  const glassSolid = isLight ? 'rgba(164, 206, 255, 0.42)' : 'rgba(78, 132, 255, 0.20)';
  const glassHover = isLight ? 'rgba(148, 198, 255, 0.38)' : 'rgba(98, 150, 255, 0.34)';
  const borderColor = isLight ? 'rgba(170, 210, 255, 0.52)' : 'rgba(118, 168, 255, 0.24)';
  const bgColor = isLight ? '#F8FBFF' : '#12161D';

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
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      sx={{
        '& .MuiDrawer-paper': {
          backgroundColor: bgColor,
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
      }}
    >
      <Box sx={{ p: '1rem' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: '1rem',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: textColorResolved,
              fontWeight: 600,
              fontSize: '1.125rem',
            }}
          >
            Фильтры
          </Typography>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: textColorResolved,
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem',
            }}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </Box>

        <Divider sx={{ mb: '1rem', borderColor: borderColor }} />

        {/* Sticker Type Section */}
        <Box sx={{ mb: '1.5rem' }}>
          <Typography
            sx={{
              color: textColorResolved,
              fontWeight: 600,
              fontSize: '0.875rem',
              mb: '0.618rem',
              opacity: 0.8,
            }}
          >
            Тип стикеров
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {STICKER_TYPES.map((type) => {
              const isSelected = filters.stickerType.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => handleToggleStickerType(type.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.75rem',
                    background: isSelected ? glassHover : glassBase,
                    backgroundColor: isSelected ? glassHover : glassSolid,
                    color: textColorResolved,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {type.label}
                </button>
              );
            })}
          </Box>
        </Box>

        {/* Difficulty Section */}
        <Box sx={{ mb: '1.5rem' }}>
          <Typography
            sx={{
              color: textColorResolved,
              fontWeight: 600,
              fontSize: '0.875rem',
              mb: '0.618rem',
              opacity: 0.8,
            }}
          >
            Сложность
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {DIFFICULTY_LEVELS.map((level) => {
              const isSelected = filters.difficulty === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => handleSelectDifficulty(level.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.75rem',
                    background: isSelected ? glassHover : glassBase,
                    backgroundColor: isSelected ? glassHover : glassSolid,
                    color: textColorResolved,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {level.label}
                </button>
              );
            })}
          </Box>
        </Box>

        {/* Date Added Section */}
        <Box sx={{ mb: '1.5rem' }}>
          <Typography
            sx={{
              color: textColorResolved,
              fontWeight: 600,
              fontSize: '0.875rem',
              mb: '0.618rem',
              opacity: 0.8,
            }}
          >
            Дата добавления
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {DATE_RANGES.map((range) => {
              const isSelected = filters.dateAdded === range.id;
              return (
                <button
                  key={range.id}
                  onClick={() => handleSelectDateRange(range.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.75rem',
                    background: isSelected ? glassHover : glassBase,
                    backgroundColor: isSelected ? glassHover : glassSolid,
                    color: textColorResolved,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {range.label}
                </button>
              );
            })}
          </Box>
        </Box>

        <Divider sx={{ mb: '1rem', borderColor: borderColor }} />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: '0.618rem' }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleReset}
            sx={{
              borderRadius: '0.75rem',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '0.75rem',
              color: textColorResolved,
              borderColor: borderColor,
              '&:hover': {
                borderColor: borderColor,
                backgroundColor: glassBase,
              },
            }}
          >
            Сбросить
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleApply}
            sx={{
              borderRadius: '0.75rem',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              padding: '0.75rem',
              background: glassHover,
              backgroundColor: glassHover,
              color: textColorResolved,
              boxShadow: 'none',
              '&:hover': {
                background: glassHover,
                backgroundColor: glassHover,
                opacity: 0.9,
                boxShadow: 'none',
              },
            }}
          >
            Применить
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

