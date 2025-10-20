import React, { useCallback } from 'react';
import { Box } from '@mui/material';
import { StickerSetResponse } from '../types/sticker';
import { TelegramStickerCard } from './TelegramStickerCard';
import { getStickerThumbnailUrl } from '../utils/stickerUtils';

interface StickerSetListProps {
  stickerSets: StickerSetResponse[];
  onView: (id: number, name: string) => void;
  isInTelegramApp?: boolean;
}

export const StickerSetList: React.FC<StickerSetListProps> = ({
  stickerSets,
  onView,
  isInTelegramApp = false
}) => {
  // Мемоизируем обработчики для предотвращения лишних ре-рендеров
  const handleView = useCallback((id: number, name: string) => {
    onView(id, name);
  }, [onView]);

  // Отображаем все элементы; кнопку "Показать ещё" контролирует страница
  const visibleStickerSets = stickerSets;

  console.log('🔍 StickerSetList рендер (telegram-style):', {
    stickerSetsCount: stickerSets.length,
    visibleCount: visibleStickerSets.length,
    isInTelegramApp
  });

  return (
    <Box sx={{ pb: isInTelegramApp ? 0 : 8, px: 0 }}>
      <div className="fade-in" style={{ paddingBottom: '60px' }}>
        {visibleStickerSets.map((stickerSet) => (
          <TelegramStickerCard
            key={stickerSet.id}
            title={stickerSet.title}
            description={`Создано: ${new Date(stickerSet.createdAt).toLocaleDateString()}`}
            stickerCount={stickerSet.telegramStickerSetInfo?.stickers?.length || 0}
            previewStickers={(stickerSet.telegramStickerSetInfo?.stickers || []).slice(0, 4).map((s: any) => ({
              id: s.file_id,
              thumbnailUrl: getStickerThumbnailUrl(s.file_id),
              emoji: s.emoji,
              isAnimated: s.is_animated
            }))}
            onClick={() => handleView(stickerSet.id, stickerSet.name)}
            priority={'auto'}
          />
        ))}
      </div>
    </Box>
  );
};
