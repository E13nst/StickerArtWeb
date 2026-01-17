import React, { useCallback } from 'react';
import { useTelegram } from '@/hooks/useTelegram';
import { useGalleryContext } from '@/contexts/GalleryContext';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import TuneIcon from '@mui/icons-material/Tune';

export const GallerySearchBar: React.FC = () => {
  const { searchTerm, setSearchTerm, handleSearch, showFilters, setShowFilters } = useGalleryContext();
  const { tg } = useTelegram();

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(searchTerm);
    }
  }, [searchTerm, handleSearch]);

  const handleFilterClick = useCallback(() => {
    setShowFilters(!showFilters);
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
  }, [showFilters, setShowFilters, tg]);

  return (
    <div className="gallery-page__search-filter">
      <div className="gallery-page__search-filter-container">
        <div className="gallery-page__search-input-wrapper">
          <input
            type="text"
            className="gallery-page__search-input"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className="gallery-page__filter-button"
          onClick={handleFilterClick}
        >
          Date
        </button>
        <div className="gallery-page__filter-icons">
          <ArrowUpwardIcon className="gallery-page__filter-icon" />
          <ArrowDownwardIcon className="gallery-page__filter-icon" />
          <TuneIcon className="gallery-page__filter-icon gallery-page__filter-icon--tune" onClick={handleFilterClick} />
        </div>
      </div>
    </div>
  );
};
