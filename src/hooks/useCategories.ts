import { useState, useEffect } from 'react';
import { CategoryDto } from '@/types/category';
import { apiClient } from '@/api/client';

export const useCategories = (language: string = 'ru') => {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const categoriesData = await apiClient.getCategories(language);
      // Сортируем по displayOrder
      const sortedCategories = categoriesData
        .filter(cat => cat.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      
      setCategories(sortedCategories);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка загрузки категорий';
      setError(errorMessage);
      console.error('❌ Ошибка загрузки категорий:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [language]);

  return {
    categories,
    loading,
    error,
    refetch: loadCategories
  };
};

