import { useState, useCallback, useEffect, FC, KeyboardEvent } from 'react';
import { useDebounce } from '../hooks/useDebounce';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'suggestion';
  count?: number;
}

interface SearchWithSuggestionsProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export const SearchWithSuggestions: FC<SearchWithSuggestionsProps> = ({
  onSearch,
  placeholder = "Поиск стикерпаков..."
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const debouncedQuery = useDebounce(query, 300);

  // Популярные запросы
  const popularSuggestions: SearchSuggestion[] = [
    { id: '1', text: 'кот', type: 'popular', count: 150 },
    { id: '2', text: 'собака', type: 'popular', count: 120 },
    { id: '3', text: 'смешные', type: 'popular', count: 200 }
  ];

  // Получение подсказок
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      return [...popularSuggestions];
    }

    // Фильтруем популярные по запросу
    const filtered = popularSuggestions.filter(s => 
      s.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    return [
      ...filtered,
      { id: 'new-1', text: `${searchQuery} стикеры`, type: 'suggestion' as const }
    ];
  }, [popularSuggestions]);

  // Обновление подсказок
  useEffect(() => {
    const loadSuggestions = async () => {
      const newSuggestions = await fetchSuggestions(query);
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    };
    
    loadSuggestions();
  }, [debouncedQuery, fetchSuggestions]);

  // Обработка выбора подсказки
  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    onSearch(suggestion.text);
  }, [onSearch]);

  // Клавиатурная навигация
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, handleSuggestionClick]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          fontSize: '16px',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          outline: 'none'
        }}
      />
      
      {/* Подсказки */}
      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px var(--color-shadow)',
          zIndex: 'var(--z-dropdown, 300)',
          marginTop: '4px'
        }}>
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: selectedIndex === index 
                  ? 'var(--color-button)' 
                  : 'transparent',
                color: selectedIndex === index 
                  ? 'white' 
                  : 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: index < suggestions.length - 1 
                  ? '1px solid var(--color-border)' 
                  : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{suggestion.type === 'popular' ? '🔥' : '💡'}</span>
                <span>{suggestion.text}</span>
              </div>
              {suggestion.count && (
                <span style={{ 
                  fontSize: '12px', 
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-border)',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  {suggestion.count}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};