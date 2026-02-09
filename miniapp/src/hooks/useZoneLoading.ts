import { useEffect, useRef, useState, useCallback } from 'react';
import { LoadPriority } from '../utils/imageLoader';

interface ZoneLoadingOptions {
  containerRef: React.RefObject<HTMLElement>;
  onZoneChange?: (zone: 'visible' | 'preload' | 'background') => void;
  onPriorityChange?: (packId: string, priority: LoadPriority) => void;
}

export const useZoneLoading = ({
  containerRef,
  onZoneChange,
  onPriorityChange
}: ZoneLoadingOptions) => {
  const [currentZone, setCurrentZone] = useState<'visible' | 'preload' | 'background'>('visible');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const zoneElementsRef = useRef<Map<string, HTMLElement>>(new Map());

  // Определение зоны для элемента
  const getElementZone = useCallback((element: HTMLElement) => {
    if (!containerRef.current) return 'background';

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Проверяем, в какой зоне находится элемент
    const isInVisible = 
      elementRect.top < containerRect.bottom && 
      elementRect.bottom > containerRect.top;

    const isInPreload = 
      elementRect.top < containerRect.bottom + 800 && 
      elementRect.bottom > containerRect.top - 800;

    if (isInVisible) return 'visible';
    if (isInPreload) return 'preload';
    return 'background';
  }, [containerRef]);

  // Обновление приоритета загрузки
  const updateLoadingPriority = useCallback((packId: string, zone: string) => {
    let priority: LoadPriority;
    
    switch (zone) {
      case 'visible':
        priority = LoadPriority.TIER_1_VIEWPORT;
        break;
      case 'preload':
        priority = LoadPriority.TIER_2_NEAR_VIEWPORT;
        break;
      case 'background':
        priority = LoadPriority.TIER_4_BACKGROUND;
        break;
      default:
        priority = LoadPriority.TIER_4_BACKGROUND;
    }

    onPriorityChange?.(packId, priority);
  }, [onPriorityChange]);

  // Обработка изменения видимости
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const element = entry.target as HTMLElement;
      const packId = element.dataset.packId;
      
      if (!packId) return;

      const zone = getElementZone(element);
      updateLoadingPriority(packId, zone);
      
      // Обновляем текущую зону только если она действительно изменилась
      if (entry.isIntersecting && currentZone !== zone) {
        setCurrentZone(zone);
        onZoneChange?.(zone);
      }
    });
  }, [getElementZone, updateLoadingPriority, onZoneChange, currentZone]);

  // Инициализация IntersectionObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const options = {
      root: containerRef.current,
      rootMargin: '800px 0px 800px 0px', // Предзагрузка на 800px вверх и вниз
      threshold: [0, 0.1, 0.5, 0.9, 1.0]
    };

    observerRef.current = new IntersectionObserver(handleIntersection, options);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [containerRef, handleIntersection]);

  // Регистрация элемента для отслеживания
  const observeElement = useCallback((element: HTMLElement, packId: string) => {
    if (!observerRef.current) return;

    element.dataset.packId = packId;
    zoneElementsRef.current.set(packId, element);
    observerRef.current.observe(element);
  }, []);

  // Отмена отслеживания элемента
  const unobserveElement = useCallback((packId: string) => {
    if (!observerRef.current) return;

    const element = zoneElementsRef.current.get(packId);
    if (element) {
      observerRef.current.unobserve(element);
      zoneElementsRef.current.delete(packId);
    }
  }, []);

  // Очистка всех наблюдателей
  const cleanup = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    zoneElementsRef.current.clear();
  }, []);

  // Получение статистики зон
  const getZoneStats = useCallback(() => {
    return {
      currentZone,
      observedElements: zoneElementsRef.current.size,
      isObserverActive: !!observerRef.current
    };
  }, [currentZone]);

  return {
    currentZone,
    observeElement,
    unobserveElement,
    cleanup,
    getZoneStats
  };
};




