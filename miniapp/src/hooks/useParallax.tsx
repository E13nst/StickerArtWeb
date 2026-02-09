import { useState, useEffect, useCallback, useRef, ReactNode, CSSProperties, FC } from 'react';
import { useScrollElement } from '../contexts/ScrollContext';

interface ParallaxOptions {
  speed?: number; // Скорость параллакса (0-1, где 0 = статично, 1 = обычная скорость)
  direction?: 'up' | 'down' | 'left' | 'right';
  offset?: number; // Начальное смещение
  enabled?: boolean;
}

interface ParallaxElement {
  id: string;
  element: HTMLElement;
  speed: number;
  direction: 'up' | 'down' | 'left' | 'right';
  offset: number;
  initialTransform: string;
}

export const useParallax = (options: ParallaxOptions = {}) => {
  const {
    speed = 0.5,
    direction = 'up',
    offset = 0,
    enabled = true
  } = options;

  const scrollElement = useScrollElement();
  const [scrollY, setScrollY] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);
  const elementsRef = useRef<Map<string, ParallaxElement>>(new Map());
  const animationFrameRef = useRef<number>();

  // Обновление позиции скролла
  const updateScrollPosition = useCallback(() => {
    const scrollTop = scrollElement 
      ? scrollElement.scrollTop 
      : (window.scrollY || document.documentElement.scrollTop);
    setScrollY(scrollTop);
    setWindowHeight(scrollElement?.clientHeight || window.innerHeight);
  }, [scrollElement]);

  // Обработчик скролла с requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      updateScrollPosition();
      updateParallaxElements();
    });
  }, [updateScrollPosition]);

  // Обновление элементов параллакса
  const updateParallaxElements = useCallback(() => {
    if (!enabled) return;

    elementsRef.current.forEach((elementData) => {
      const { element, speed: elementSpeed, direction: elementDirection, offset: elementOffset } = elementData;
      
      const parallaxY = scrollY * elementSpeed;
      const parallaxX = scrollY * elementSpeed;
      
      let translateX = 0;
      let translateY = 0;
      
      switch (elementDirection) {
        case 'up':
          translateY = -parallaxY + elementOffset;
          break;
        case 'down':
          translateY = parallaxY + elementOffset;
          break;
        case 'left':
          translateX = -parallaxX + elementOffset;
          break;
        case 'right':
          translateX = parallaxX + elementOffset;
          break;
      }
      
      element.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    });
  }, [scrollY, enabled]);

  // Добавление элемента для параллакса
  const addParallaxElement = useCallback((
    id: string,
    element: HTMLElement,
    customOptions: Partial<ParallaxOptions> = {}
  ) => {
    const elementOptions = {
      speed: customOptions.speed ?? speed,
      direction: customOptions.direction ?? direction,
      offset: customOptions.offset ?? offset
    };

    // Сохраняем начальное состояние
    const initialTransform = element.style.transform;
    
    const parallaxElement: ParallaxElement = {
      id,
      element,
      speed: elementOptions.speed,
      direction: elementOptions.direction,
      offset: elementOptions.offset,
      initialTransform
    };

    elementsRef.current.set(id, parallaxElement);
    
    // Применяем начальные стили
    element.style.willChange = 'transform';
    element.style.backfaceVisibility = 'hidden';
  }, [speed, direction, offset]);

  // Удаление элемента параллакса
  const removeParallaxElement = useCallback((id: string) => {
    const elementData = elementsRef.current.get(id);
    if (elementData) {
      // Восстанавливаем начальное состояние
      elementData.element.style.transform = elementData.initialTransform;
      elementsRef.current.delete(id);
    }
  }, []);

  // Очистка всех элементов
  const clearParallaxElements = useCallback(() => {
    elementsRef.current.forEach((elementData) => {
      elementData.element.style.transform = elementData.initialTransform;
    });
    elementsRef.current.clear();
  }, []);

  // Инициализация
  useEffect(() => {
    updateScrollPosition();
    
    const targetElement = scrollElement || window;
    targetElement.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollPosition, { passive: true });
    
    return () => {
      targetElement.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollPosition);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleScroll, updateScrollPosition, scrollElement]);

  // Обновление элементов при изменении скролла
  useEffect(() => {
    updateParallaxElements();
  }, [updateParallaxElements]);

  return {
    scrollY,
    windowHeight,
    addParallaxElement,
    removeParallaxElement,
    clearParallaxElements,
    isEnabled: enabled
  };
};

// Хук для создания параллакс-эффекта с разными слоями
export const useLayeredParallax = () => {
  const [layers, setLayers] = useState<Array<{
    id: string;
    speed: number;
    direction: 'up' | 'down';
    elements: HTMLElement[];
  }>>([]);

  const addLayer = useCallback((id: string, speed: number, direction: 'up' | 'down' = 'up') => {
    setLayers(prev => [...prev, { id, speed, direction, elements: [] }]);
  }, []);

  const addElementToLayer = useCallback((layerId: string, element: HTMLElement) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, elements: [...layer.elements, element] }
          : layer
      )
    );
  }, []);

  const removeElementFromLayer = useCallback((layerId: string, element: HTMLElement) => {
    setLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, elements: layer.elements.filter(el => el !== element) }
          : layer
      )
    );
  }, []);

  return {
    layers,
    addLayer,
    addElementToLayer,
    removeElementFromLayer
  };
};

// Компонент для создания параллакс-слоев
interface ParallaxLayerProps {
  speed: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  offset?: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const ParallaxLayer: FC<ParallaxLayerProps> = ({
  speed,
  direction = 'up',
  offset = 0,
  children,
  className = '',
  style = {}
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const { addParallaxElement, removeParallaxElement } = useParallax();

  useEffect(() => {
    if (elementRef.current) {
      addParallaxElement(`layer-${Date.now()}`, elementRef.current, {
        speed,
        direction,
        offset
      });

      return () => {
        removeParallaxElement(`layer-${Date.now()}`);
      };
    }
  }, [speed, direction, offset, addParallaxElement, removeParallaxElement]);

  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        ...style
      }}
    >
      {children}
    </div>
  );
};
