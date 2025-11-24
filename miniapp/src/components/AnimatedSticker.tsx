import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';
import { animationCache, imageLoader, LoadPriority, getCachedAnimation } from '../utils/imageLoader';

interface AnimatedStickerProps {
  fileId: string;
  imageUrl: string;
  emoji?: string;
  className?: string;
  hidePlaceholder?: boolean;
  onReady?: () => void;
}

export const AnimatedSticker: React.FC<AnimatedStickerProps> = ({
  fileId,
  imageUrl,
  emoji,
  className,
  hidePlaceholder,
  onReady
}) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const readyCalledRef = useRef(false);
  
  // Refs для управления анимацией и IntersectionObserver
  const animationRef = useRef<LottieRefCurrentProps>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    readyCalledRef.current = false; // Сброс при изменении fileId/imageUrl

    const loadAnimation = async () => {
      try {
        setLoading(true);
        setError(false);

        // Проверяем валидность URL
        if (!imageUrl || imageUrl === '') {
          console.log('🎬 Invalid imageUrl, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        // ✅ FIX: Используем imageLoader для дедупликации запросов
        // Проверяем кеш сначала
        const cachedData = animationCache.get(fileId) || getCachedAnimation(fileId);
        if (cachedData) {
          console.log('🎬 Loaded from cache:', fileId);
          if (!cancelled) {
            setAnimationData(cachedData);
            setLoading(false);
            // onReady будет вызван в useEffect для Lottie
          }
          return;
        }

        // Загружаем через imageLoader (с дедупликацией и приоритетом)
        try {
          await imageLoader.loadAnimation(
            fileId, 
            imageUrl, 
            LoadPriority.TIER_1_VIEWPORT // Высокий приоритет для видимых анимаций
          );
          
          // После загрузки получаем данные из кеша
          const loadedData = animationCache.get(fileId) || getCachedAnimation(fileId);
          
          if (!cancelled) {
            if (loadedData) {
              console.log('🎬 Animation loaded via imageLoader:', fileId);
              setAnimationData(loadedData);
              setLoading(false);
            } else {
              // Если данных нет в кеше после загрузки - это ошибка
              console.log('🎬 Animation not found after load, using fallback:', fileId);
              setError(true);
              setLoading(false);
            }
          }
        } catch (err) {
          console.log('🎬 Failed to load animation via imageLoader, using fallback:', fileId, err);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
        }
      } catch (err) {
        console.log('🎬 Failed to load animation, using fallback:', fileId, err);
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnimation();

    return () => {
      cancelled = true;
    };
  }, [fileId, imageUrl]);

  // IntersectionObserver для оптимизации рендеринга анимаций вне viewport
  useEffect(() => {
    if (!animationRef.current || !containerRef.current || !animationData) return;

    // Убеждаемся, что начальное состояние правильное (видимый)
    if (containerRef.current) {
      containerRef.current.style.visibility = 'visible';
      containerRef.current.style.pointerEvents = 'auto';
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!animationRef.current || !containerRef.current) return;
        
        // Не возобновляем если модальное окно открыто
        if (document.body.classList.contains('modal-open')) {
          animationRef.current.pause();
          return;
        }
        
        if (!entry.isIntersecting) {
          // 🔥 ОПТИМИЗАЦИЯ: паузим анимацию и останавливаем рендеринг, но элемент остается в DOM
          animationRef.current.pause();
          // Используем visibility: hidden вместо display: none - элемент остается в DOM и занимает место
          // Это предотвращает пустые карточки, но останавливает рендеринг (экономит CPU/GPU)
          containerRef.current.style.visibility = 'hidden';
          containerRef.current.style.pointerEvents = 'none';
          containerRef.current.setAttribute('data-lottie-paused', 'true');
        } else {
          // Возобновляем рендеринг и воспроизведение
          containerRef.current.style.visibility = 'visible';
          containerRef.current.style.pointerEvents = 'auto';
          containerRef.current.removeAttribute('data-lottie-paused');
          animationRef.current.play();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '300px' // Останавливаем только когда элемент действительно далеко от viewport (300px)
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [animationData, fileId]);

  // MutationObserver для паузы всех анимаций при открытии модального окна
  useEffect(() => {
    if (!animationRef.current || !containerRef.current) return;

    const mutationObserver = new MutationObserver(() => {
      if (!animationRef.current || !containerRef.current) return;
      
      const isModalOpen = document.body.classList.contains('modal-open');
      
      if (isModalOpen) {
        animationRef.current.pause();
      } else {
        // Возобновляем только если элемент видим в viewport (как у IntersectionObserver)
        const rect = containerRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const isVisible = rect.top < windowHeight + 50 && rect.bottom > -50;
        if (isVisible) {
          animationRef.current.play();
        }
      }
    });

    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      mutationObserver.disconnect();
    };
  }, [animationData]);

  // Вызываем onReady когда анимация/изображение готовы к показу (ВСЕГДА вызывается до return)
  useEffect(() => {
    if (!loading && !readyCalledRef.current) {
      if (animationData && animationRef.current) {
        // Для Lottie - небольшая задержка для рендеринга
        const timer = setTimeout(() => {
          if (!readyCalledRef.current) {
            readyCalledRef.current = true;
            onReady?.();
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [animationData, loading, onReady]);

  if (loading) {
    return (
      <div 
        ref={containerRef}
        className={className} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          fontSize: '48px' 
        }}
      >
        {hidePlaceholder ? null : (emoji || '🎨')}
      </div>
    );
  }

  if (error || !animationData) {
    // Fallback - пробуем показать как обычное изображение
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <img
          src={imageUrl}
          alt={emoji || ''}
          className={className}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain'
          }}
          onLoad={() => {
            if (!readyCalledRef.current) {
              readyCalledRef.current = true;
              onReady?.();
            }
          }}
          onError={(e) => {
            // Если и изображение не загрузилось - показываем эмодзи
            console.log('🎬 Image fallback failed, showing emoji:', fileId);
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 48px;">${emoji || '🎨'}</div>`;
            }
            if (!readyCalledRef.current) {
              readyCalledRef.current = true;
              onReady?.(); // Вызываем даже при ошибке
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-lottie-container="true"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Lottie
        lottieRef={animationRef}
        animationData={animationData}
        loop={true}
        autoplay={true}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
        // Добавляем атрибут для мониторинга
        onLoadedData={() => {
          const canvas = containerRef.current?.querySelector('canvas, svg');
          if (canvas) {
            canvas.setAttribute('data-lottie', 'true');
          }
        }}
      />
    </div>
  );
};

