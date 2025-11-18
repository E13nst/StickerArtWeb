import React, { useCallback, memo, useState, useEffect } from 'react';
import { useNearVisible } from '../hooks/useNearVisible';
import { useViewportVisibility } from '../hooks/useViewportVisibility';
import { useStickerRotation } from '../hooks/useStickerRotation';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { imageLoader, LoadPriority, videoBlobCache, imageCache } from '../utils/imageLoader';
import { useProfileStore } from '../store/useProfileStore';

interface Pack {
  id: string;
  title: string;
  previewStickers: Array<{
    fileId: string;
    url: string;
    isAnimated: boolean;
    isVideo: boolean;
    emoji: string;
  }>;
  // Информация о типах файлов в сете для отладки (видна только админу)
  stickerTypes?: {
    hasWebp: boolean;
    hasWebm: boolean;
    hasTgs: boolean;
  };
  // Количество стикеров в паке (видно только админу)
  stickerCount?: number;
  // Публичность стикерсета
  isPublic?: boolean;
}

interface PackCardProps {
  pack: Pack;
  isFirstRow?: boolean;
  isHighPriority?: boolean; // ⚠️ DEPRECATED: Теперь приоритет определяется автоматически через viewport
  onClick?: (packId: string) => void;
}

const PackCardComponent: React.FC<PackCardProps> = ({ 
  pack, 
  isFirstRow = false,
  isHighPriority = false, // Оставлено для обратной совместимости, но не используется
  onClick
}) => {
  const { ref, isNear } = useNearVisible({ rootMargin: '800px' });
  
  // 🔥 НОВОЕ: Динамическое определение видимости в viewport
  const { isInViewport, isNearViewport } = useViewportVisibility(ref, {
    rootMargin: '800px',
    threshold: 0.1
  });
  
  const [isHovered, setIsHovered] = useState(false);
  const [isFirstStickerReady, setIsFirstStickerReady] = useState(false);
  
  // Получаем роль пользователя для отладочной информации
  const userInfo = useProfileStore(state => state.userInfo);
  const normalizedRole = (userInfo?.role ?? '').toUpperCase();
  const isAdmin = normalizedRole.includes('ADMIN');

  // 🔥 УНИФИЦИРОВАННАЯ предзагрузка первого стикера через единую систему
  useEffect(() => {
    if (pack.previewStickers.length > 0) {
      const firstSticker = pack.previewStickers[0];
      
      // 🔥 НОВАЯ ЛОГИКА: Приоритет зависит от положения в viewport
      let priority: LoadPriority;
      if (isInViewport) {
        // Карточка видима прямо сейчас - максимальный приоритет
        priority = LoadPriority.TIER_1_VIEWPORT;
      } else if (isNearViewport) {
        // Карточка близко к viewport (в пределах 800px) - высокий приоритет
        priority = LoadPriority.TIER_2_NEAR_VIEWPORT;
      } else if (isNear) {
        // Карточка далеко, но в зоне предзагрузки - средний приоритет
        priority = LoadPriority.TIER_3_ADDITIONAL;
      } else {
        // Карточка совсем далеко - низкий приоритет
        priority = LoadPriority.TIER_4_BACKGROUND;
      }

      // 🔥 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Единая точка входа для всех типов ресурсов
      const loadPromise = firstSticker.isVideo
        ? imageLoader.loadVideo(firstSticker.fileId, firstSticker.url, priority)
        : imageLoader.loadImage(firstSticker.fileId, firstSticker.url, priority);

      // 🔥 ФИКС: Добавляем timeout для промисов загрузки (10 секунд)
      // Если промис зависает - показываем контент все равно
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000); // 🔥 УВЕЛИЧЕНО: с 3s до 10s
      });

      Promise.race([loadPromise, timeoutPromise])
        .then(() => {
          if ((import.meta as any).env?.DEV) {
            const type = firstSticker.isVideo ? 'video' : firstSticker.isAnimated ? 'animated' : 'static';
            console.log(`✅ First ${type} sticker ready for pack ${pack.id} (priority: ${priority}, visible: ${isNear})`);
          }
          setIsFirstStickerReady(true);
          
          // 🔥 Для анимаций загружаем JSON ПОСЛЕ изображения
          // Это гарантирует что изображение покажется быстро, а анимация подгрузится
          if (firstSticker.isAnimated && !firstSticker.isVideo) {
            imageLoader.loadAnimation(firstSticker.fileId, firstSticker.url, LoadPriority.TIER_3_ADDITIONAL)
              .catch(() => {
                // Игнорируем ошибки загрузки JSON - изображение уже есть
              });
          }
        })
        .catch((error) => {
          if ((import.meta as any).env?.DEV) {
            console.warn(`⚠️ Failed to load first sticker for pack ${pack.id} (timeout or error):`, error.message);
          }
          setIsFirstStickerReady(true); // 🔥 КРИТИЧНО: Показываем контент даже при timeout/ошибке
        });
    }
  }, [pack.id, pack.previewStickers, isInViewport, isNearViewport, isNear]);

  // 🔥 НОВОЕ: Обновление приоритета при изменении видимости
  useEffect(() => {
    if (pack.previewStickers.length === 0) return;
    
    const firstSticker = pack.previewStickers[0];
    
    // Определяем новый приоритет на основе видимости
    let newPriority: LoadPriority;
    if (isInViewport) {
      newPriority = LoadPriority.TIER_1_VIEWPORT;
    } else if (isNearViewport) {
      newPriority = LoadPriority.TIER_2_NEAR_VIEWPORT;
    } else if (isNear) {
      newPriority = LoadPriority.TIER_3_ADDITIONAL;
    } else {
      newPriority = LoadPriority.TIER_4_BACKGROUND;
    }
    
    // Обновляем приоритет загрузки
    imageLoader.updatePriority(firstSticker.fileId, newPriority);
  }, [pack.previewStickers, isInViewport, isNearViewport, isNear, pack.id]);

  // 🔥 УНИФИЦИРОВАННАЯ предзагрузка остальных стикеров для плавной ротации
  useEffect(() => {
    // Загружаем только если карточка видима и есть стикеры для ротации
    if (pack.previewStickers.length <= 1 || !isNear) {
      return; // Не загружаем дополнительные стикеры для невидимых карточек
    }

    // Для видимых карточек загружаем 2-й и 3-й стикеры с высоким приоритетом
    // Это критично для плавной ротации
    for (let i = 1; i < Math.min(pack.previewStickers.length, 3); i++) {
      const sticker = pack.previewStickers[i];

      // 🔥 НОВАЯ ЛОГИКА: Приоритет для ротирующихся стикеров зависит от видимости
      const priority = isInViewport
        ? LoadPriority.TIER_2_NEAR_VIEWPORT  // Видимая карточка - высокий приоритет для ротации
        : LoadPriority.TIER_3_ADDITIONAL;     // Невидимая - средний приоритет

      // 🔥 УНИФИЦИРОВАНО: Единая точка входа через imageLoader
      const loadPromise = sticker.isVideo
        ? imageLoader.loadVideo(sticker.fileId, sticker.url, priority)
        : imageLoader.loadImage(sticker.fileId, sticker.url, priority);

      loadPromise
        .then(() => {
          // Для анимаций подгружаем JSON после изображения
          if (sticker.isAnimated && !sticker.isVideo) {
            imageLoader.loadAnimation(sticker.fileId, sticker.url, LoadPriority.TIER_4_BACKGROUND)
              .catch(() => {
                // Игнорируем ошибки - изображение уже есть
              });
          }
        })
        .catch(() => {
          // Игнорируем ошибки, но не блокируем ротацию
        });
    }
  }, [pack.id, pack.previewStickers, isNear, isInViewport]);

  // Используем хук для управления ротацией стикеров
  // 🔥 НОВАЯ ЛОГИКА: Приоритет для следующего стикера в ротации
  const rotationLoadPriority = isInViewport
    ? LoadPriority.TIER_2_NEAR_VIEWPORT  // Видимая карточка - высокий приоритет
    : (isNearViewport 
        ? LoadPriority.TIER_3_ADDITIONAL  // Близко к viewport - средний
        : LoadPriority.TIER_4_BACKGROUND); // Далеко - низкий

  const { currentIndex: currentStickerIndex } = useStickerRotation({
    stickersCount: pack.previewStickers.length,
    autoRotateInterval: 2333,
    hoverRotateInterval: 618,
    isHovered,
    isVisible: isNear,
    stickerSources: pack.previewStickers.map(s => ({ fileId: s.fileId, url: s.url, isAnimated: s.isAnimated, isVideo: s.isVideo })),
    minDisplayDuration: 2000,
    loadPriority: rotationLoadPriority
  });

  // useStickerRotation гарантирует готовность стикера перед переключением индекса
  // Поэтому мы можем напрямую использовать currentStickerIndex без дополнительных проверок

  // Мемоизированный обработчик клика
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(pack.id);
    }
  }, [onClick, pack.id]);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="pack-card"
      data-testid="pack-card"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        aspectRatio: '1 / 1.618', // Золотое сечение (φ = 1.618)
        borderRadius: '13px', // Число Фибоначчи
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        border: '1px solid var(--tg-theme-border-color)',
        boxShadow: '0 3px 13px var(--tg-theme-shadow-color)', // 3 и 13 - числа Фибоначчи
        touchAction: 'manipulation',
        transition: 'transform 0.233s ease, box-shadow 0.233s ease' // 0.233 ≈ 1/φ
      }}
    >
      {/* Сменяющиеся превью стикеров - ОПТИМИЗИРОВАНО: рендерим только активный */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!isFirstStickerReady ? (
          // Skeleton loader пока первый стикер загружается
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              color: 'var(--tg-theme-hint-color)',
              backgroundColor: 'var(--tg-theme-secondary-bg-color)',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          >
            {pack.previewStickers[0]?.emoji || '🎨'}
          </div>
        ) : (() => {
          const activeSticker = pack.previewStickers[currentStickerIndex] || pack.previewStickers[0];
          if (!activeSticker) return null;
          
          // useStickerRotation гарантирует готовность перед переключением
          // Поэтому показываем стикер сразу по currentStickerIndex
          const baseStyles: React.CSSProperties = {
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            opacity: 1,
            willChange: 'opacity',
            transition: 'opacity 0.2s ease-in-out'
          };

          return (
            <div
              key={`${pack.id}-${activeSticker.fileId}-${currentStickerIndex}`}
              data-testid="sticker-preview"
              style={baseStyles}
            >
              {activeSticker.isAnimated ? (
                <AnimatedSticker
                  fileId={activeSticker.fileId}
                  imageUrl={activeSticker.url}
                  emoji={activeSticker.emoji}
                  className="pack-card-animated-sticker"
                  hidePlaceholder={true}
                />
              ) : activeSticker.isVideo ? (
                <video
                  src={videoBlobCache.get(activeSticker.fileId) || activeSticker.url}
                  className="pack-card-video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <img
                  src={imageCache.get(activeSticker.fileId) || activeSticker.url}
                  alt={activeSticker.emoji}
                  className="pack-card-image"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              )}
            </div>
          );
        })()}
      </div>
      
      {/* Заголовок пака */}
      <div
        data-testid="pack-title"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: `linear-gradient(transparent, var(--tg-theme-overlay-color))`,
          color: 'white',
          padding: '13px 8px 8px', // 13 - число Фибоначчи
          fontSize: '13px', // Число Фибоначчи
          fontWeight: '500',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {pack.title}
      </div>

      {/* Интерактивный лайк в правом верхнем углу */}
      <InteractiveLikeCount
        packId={pack.id}
        size="medium"
        placement="top-right"
      />

      {/* Badge с типами стикеров и количеством - только для админа */}
      {isAdmin && (pack.stickerTypes || pack.stickerCount || pack.isPublic !== undefined) && (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            display: 'flex',
            flexDirection: 'row',
            gap: '4px',
            pointerEvents: 'none',
            flexWrap: 'wrap'
          }}
        >
          {/* Количество стикеров */}
          {pack.stickerCount !== undefined && (
            <div
              style={{
                backgroundColor: 'rgba(33, 150, 243, 0.6)',
                color: 'white',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600',
                lineHeight: 1,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <span style={{ fontSize: '8px' }}>📊</span>
              {pack.stickerCount}
            </div>
          )}
          
          {/* Типы файлов */}
          {pack.stickerTypes?.hasTgs && (
            <div
              style={{
                backgroundColor: 'rgba(156, 39, 176, 0.6)',
                color: 'white',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600',
                lineHeight: 1,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
              }}
            >
              TGS
            </div>
          )}
          {pack.stickerTypes?.hasWebm && (
            <div
              style={{
                backgroundColor: 'rgba(244, 67, 54, 0.6)',
                color: 'white',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600',
                lineHeight: 1,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
              }}
            >
              WEBM
            </div>
          )}
          {pack.stickerTypes?.hasWebp && (
            <div
              style={{
                backgroundColor: 'rgba(76, 175, 80, 0.6)',
                color: 'white',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600',
                lineHeight: 1,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
              }}
            >
              WEBP
            </div>
          )}
          
          {/* Бейдж состояния isPublic с иконкой глаза */}
          {pack.isPublic !== undefined && (
            <div
              style={{
                backgroundColor: pack.isPublic ? 'rgba(76, 175, 80, 0.6)' : 'rgba(158, 158, 158, 0.6)',
                color: 'white',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600',
                lineHeight: 1,
                backdropFilter: 'blur(8px)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <svg 
                width="10" 
                height="10" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Кастомная функция сравнения для оптимизации memo
const arePropsEqual = (prevProps: PackCardProps, nextProps: PackCardProps): boolean => {
  // Быстрая проверка по id (самое важное)
  if (prevProps.pack.id !== nextProps.pack.id) {
    return false;
  }
  
  // Проверка флагов
  if (prevProps.isFirstRow !== nextProps.isFirstRow) {
    return false;
  }
  // isHighPriority больше не используется - приоритет определяется динамически
  
  // Проверка onClick (обычно стабильная функция)
  if (prevProps.onClick !== nextProps.onClick) {
    return false;
  }
  
  // Проверка title (может измениться при обновлении)
  if (prevProps.pack.title !== nextProps.pack.title) {
    return false;
  }
  
  // Проверка количества previewStickers (массив может измениться)
  if (prevProps.pack.previewStickers.length !== nextProps.pack.previewStickers.length) {
    return false;
  }
  
  // Глубокая проверка только первого стикера (самый важный для отображения)
  const prevFirst = prevProps.pack.previewStickers[0];
  const nextFirst = nextProps.pack.previewStickers[0];
  if (prevFirst?.fileId !== nextFirst?.fileId) {
    return false;
  }
  
  // Если всё совпало — не ре-рендерим
  return true;
};

export const PackCard = memo(PackCardComponent, arePropsEqual);