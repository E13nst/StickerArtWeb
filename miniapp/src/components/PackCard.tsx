import React, { useCallback, memo, useState, useEffect } from 'react';
import { useNearVisible } from '../hooks/useNearVisible';
import { useStickerRotation } from '../hooks/useStickerRotation';
import { AnimatedSticker } from './AnimatedSticker';
import { InteractiveLikeCount } from './InteractiveLikeCount';
import { imageLoader } from '../utils/imageLoader';
import { prefetchAnimation, markAsGalleryAnimation, prefetchSticker, getCachedStickerUrl, markAsGallerySticker } from '../utils/animationLoader';
import { LoadPriority } from '../utils/imageLoader';
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
  isHighPriority?: boolean; // Для первых 6 паков на экране
  onClick?: (packId: string) => void;
}

const PackCardComponent: React.FC<PackCardProps> = ({ 
  pack, 
  isFirstRow = false,
  isHighPriority = false,
  onClick
}) => {
  const { ref, isNear } = useNearVisible({ rootMargin: '800px' });
  const [isHovered, setIsHovered] = useState(false);
  const [isFirstStickerReady, setIsFirstStickerReady] = useState(false);
  
  // Получаем роль пользователя для отладочной информации
  const userInfo = useProfileStore(state => state.userInfo);
  const normalizedRole = (userInfo?.role ?? '').toUpperCase();
  const isAdmin = normalizedRole.includes('ADMIN');

  // Предзагрузка первого стикера с максимальным приоритетом для видимых карточек
  useEffect(() => {
    if (pack.previewStickers.length > 0) {
      const firstSticker = pack.previewStickers[0];
      
      // Для видимых карточек используем максимальный приоритет
      // Для невидимых - стандартный приоритет
      let priority: LoadPriority;
      if (isNear) {
        // Видимая карточка - максимальный приоритет
        priority = isHighPriority ? LoadPriority.TIER_1_FIRST_6_PACKS : LoadPriority.TIER_2_FIRST_IMAGE;
      } else {
        // Невидимая карточка - более низкий приоритет, но все равно загружаем первый стикер
        priority = isHighPriority ? LoadPriority.TIER_2_FIRST_IMAGE : LoadPriority.TIER_3_ADDITIONAL;
      }

      if (firstSticker.isVideo) {
        // Для видео используем prefetchSticker для правильной загрузки и кеширования
        markAsGallerySticker(firstSticker.fileId);
        prefetchSticker(firstSticker.fileId, firstSticker.url, {
          isVideo: true,
          markForGallery: true,
          priority
        })
          .then(() => {
            if ((import.meta as any).env?.DEV) {
              console.log(`✅ First video sticker ready for pack ${pack.id} (priority: ${priority}, visible: ${isNear})`);
            }
            setIsFirstStickerReady(true);
          })
          .catch(() => {
            console.warn(`⚠️ Failed to load first video sticker for pack ${pack.id}`);
            setIsFirstStickerReady(true); // Показываем даже если ошибка
          });
        return;
      }
      
      // Загружаем изображение и JSON если анимация
      imageLoader.loadImage(firstSticker.fileId, firstSticker.url, priority)
        .then(() => {
          if ((import.meta as any).env?.DEV) {
            console.log(`✅ First sticker ready for pack ${pack.id} (priority: ${priority}, visible: ${isNear})`);
          }
          setIsFirstStickerReady(true);
          
          // Prefetch JSON для анимаций
          if (firstSticker.isAnimated) {
            prefetchAnimation(firstSticker.fileId, firstSticker.url).then(() => {
              markAsGalleryAnimation(firstSticker.fileId);
            }).catch(() => {});
          }
        })
        .catch(() => {
          console.warn(`⚠️ Failed to load first sticker for pack ${pack.id}`);
          setIsFirstStickerReady(true); // Показываем даже если ошибка
        });
    }
  }, [pack.id, pack.previewStickers, isHighPriority, isNear]);

  // Предзагрузка остальных стикеров ТОЛЬКО для видимых карточек с высоким приоритетом
  // Для невидимых карточек не загружаем дополнительные стикеры - экономим запросы
  useEffect(() => {
    // Загружаем только если карточка видима и есть стикеры для ротации
    if (pack.previewStickers.length <= 1 || !isNear) {
      return; // Не загружаем дополнительные стикеры для невидимых карточек
    }

    // Для видимых карточек загружаем 2-й и 3-й стикеры с высоким приоритетом
    // Это критично для плавной ротации
    for (let i = 1; i < Math.min(pack.previewStickers.length, 3); i++) {
      const sticker = pack.previewStickers[i];

      // Используем высокий приоритет для видимых карточек (TIER_2 или TIER_3)
      // Это гарантирует, что стикеры для ротации загрузятся быстро
      const priority = isHighPriority 
        ? LoadPriority.TIER_2_FIRST_IMAGE  // Для первых 6 паков - TIER_2
        : LoadPriority.TIER_3_ADDITIONAL;  // Для остальных видимых - TIER_3

      if (sticker.isVideo) {
        // Для видео используем prefetchSticker
        markAsGallerySticker(sticker.fileId);
        prefetchSticker(sticker.fileId, sticker.url, {
          isVideo: true,
          markForGallery: true,
          priority
        }).catch(() => {
          // Игнорируем ошибки, но не блокируем ротацию
        });
        continue;
      }

      imageLoader.loadImage(sticker.fileId, sticker.url, priority)
        .then(() => {
          // Prefetch JSON для анимаций
          if (sticker.isAnimated) {
            prefetchAnimation(sticker.fileId, sticker.url).then(() => {
              markAsGalleryAnimation(sticker.fileId);
            }).catch(() => {});
          }
        })
        .catch(() => {
          // Игнорируем ошибки, но не блокируем ротацию
        });
    }
  }, [pack.id, pack.previewStickers, isNear, isHighPriority]);

  // Используем хук для управления ротацией стикеров
  // Для видимых карточек используем высокий приоритет загрузки следующего стикера
  const rotationLoadPriority = isNear 
    ? (isHighPriority ? LoadPriority.TIER_2_FIRST_IMAGE : LoadPriority.TIER_3_ADDITIONAL)
    : LoadPriority.TIER_4_BACKGROUND;

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
                  src={getCachedStickerUrl(activeSticker.fileId) || activeSticker.url}
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
                  src={activeSticker.url}
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
  if (prevProps.isFirstRow !== nextProps.isFirstRow || 
      prevProps.isHighPriority !== nextProps.isHighPriority) {
    return false;
  }
  
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