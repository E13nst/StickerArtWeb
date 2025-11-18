import React, { useEffect, useState, useRef } from 'react';
import Lottie from 'lottie-react';
import type { LottieRefCurrentProps } from 'lottie-react';
import { animationCache } from '../utils/imageLoader';

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

        // Проверяем кеш
        if (animationCache.has(fileId)) {
          console.log('🎬 Loaded from cache:', fileId);
          if (!cancelled) {
            setAnimationData(animationCache.get(fileId));
            setLoading(false);
            // onReady будет вызван в useEffect для Lottie
          }
          return;
        }

        // Загружаем JSON анимации
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
          // Если 404 или другая ошибка, сразу переходим к fallback
          console.log('🎬 Animation not found, using fallback:', fileId);
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        const contentType = response.headers.get('content-type');
        
        // Проверяем, что это JSON
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          
          if (!cancelled) {
            // Сохраняем в кеш
            animationCache.set(fileId, data);
            console.log('🎬 Cached animation:', fileId);
            setAnimationData(data);
            setLoading(false);
            // onReady будет вызван в useEffect для Lottie
          }
        } else {
          // Если это не JSON (webp/png/gif), используем fallback к <img>
          console.log('🎬 Not a JSON animation, will use fallback image:', fileId);
          if (!cancelled) {
            setError(true);
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

  // IntersectionObserver для паузы анимаций вне viewport
  useEffect(() => {
    if (!animationRef.current || !containerRef.current || !animationData) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!animationRef.current) return;
        
        // Не возобновляем если модальное окно открыто
        if (document.body.classList.contains('modal-open')) return;
        
        if (!entry.isIntersecting) {
          animationRef.current.pause();
        } else {
          animationRef.current.play();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
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
      />
    </div>
  );
};

