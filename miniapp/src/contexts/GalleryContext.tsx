import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface GalleryContextType {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSearch: (term: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

const GalleryContext = createContext<GalleryContextType | undefined>(undefined);

export const useGalleryContext = () => {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGalleryContext must be used within GalleryProvider');
  }
  return context;
};

interface GalleryProviderProps {
  children: ReactNode;
  onSearch?: (term: string) => void;
  initialSearchTerm?: string;
}

export const GalleryProvider: React.FC<GalleryProviderProps> = ({ 
  children, 
  onSearch,
  initialSearchTerm = ''
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    onSearch?.(term);
  }, [onSearch]);

  return (
    <GalleryContext.Provider value={{
      searchTerm,
      setSearchTerm,
      handleSearch,
      showFilters,
      setShowFilters
    }}>
      {children}
    </GalleryContext.Provider>
  );
};
