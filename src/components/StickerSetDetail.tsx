import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton,
  Card,
  CardContent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShareIcon from '@mui/icons-material/Share';
import { StickerSetResponse } from '@/types/sticker';
import { StickerGrid } from './StickerGrid';
import { StickerSetCategories } from './StickerSetCategories';

interface StickerSetDetailProps {
  stickerSet: StickerSetResponse;
  onBack: () => void;
  onShare: (name: string, title: string) => void;
  onLike?: (id: number, title: string) => void;
  isInTelegramApp?: boolean;
}

export const StickerSetDetail: React.FC<StickerSetDetailProps> = ({
  stickerSet,
  onBack,
  onShare,
  onLike,
  isInTelegramApp = false
}) => {
  // Защита от undefined stickerSet
  if (!stickerSet) {
    return <div>Стикерсет не найден</div>;
  }
  
  const stickerCount = stickerSet.telegramStickerSetInfo?.stickers?.length || stickerSet.stickers?.length || 0;
  const createdDate = new Date(stickerSet.createdAt).toLocaleDateString();

  const handleShare = () => {
    onShare(stickerSet.name, stickerSet.title);
  };

  const handleLike = () => {
    if (onLike) {
      onLike(stickerSet.id, stickerSet.title);
    }
  };

  return (
    <Box sx={{ pb: 2 }}>
      {/* Заголовок с кнопкой назад */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        mb: 3,
        gap: 2
      }}>
        <IconButton 
          onClick={onBack}
          sx={{ 
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        
        <Box sx={{ flexGrow: 1 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom
            sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
          >
            {stickerSet.title}
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            {stickerCount} стикер{stickerCount === 1 ? '' : stickerCount < 5 ? 'а' : 'ов'}
          </Typography>
        </Box>
      </Box>

      {/* Информационная карточка */}
      <Card 
        className="fx-glass fx-lite"
        sx={{ 
          mb: 3,
          backgroundColor: 'transparent',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 3
        }}
      >
        <CardContent sx={{ backgroundColor: 'transparent' }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2
          }}>
            <Typography 
              variant="h6" 
              component="h2"
              sx={{ color: 'rgba(255, 255, 255, 0.9)' }}
            >
              О наборе стикеров
            </Typography>
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography 
              variant="body2" 
              gutterBottom
              sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              <strong>Название:</strong> {stickerSet.name}
            </Typography>
            <Typography 
              variant="body2" 
              gutterBottom
              sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              <strong>Создан:</strong> {createdDate}
            </Typography>
            <Typography 
              variant="body2" 
              gutterBottom
              sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              <strong>Количество стикеров:</strong> {stickerCount}
            </Typography>
            <Typography 
              variant="body2"
              sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              <strong>Тип:</strong> {
                stickerSet.telegramStickerSetInfo?.is_animated ? 'Анимированные' : 
                stickerSet.telegramStickerSetInfo?.is_video ? 'Видео' :
                stickerSet.telegramStickerSetInfo?.contains_masks ? 'Маски' : 'Обычные'
              }
            </Typography>
          </Box>

          {/* Категории стикерсета */}
          {stickerSet.categories && stickerSet.categories.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography 
                variant="body2" 
                gutterBottom 
                sx={{ 
                  mb: 1,
                  color: 'rgba(255, 255, 255, 0.8)'
                }}
              >
                <strong>Категории:</strong>
              </Typography>
              <StickerSetCategories 
                categories={stickerSet.categories}
                maxVisible={5}
                size="medium"
                showLabel={false}
              />
            </Box>
          )}

          {/* Кнопки действий */}
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <Button
              variant="contained"
              onClick={handleShare}
              sx={{ 
                flex: 1, 
                minWidth: 140,
                backgroundColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                }
              }}
            >
              <ShareIcon />
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleLike}
              sx={{ 
                flex: 1, 
                minWidth: 140,
                borderColor: 'secondary.main',
                color: 'secondary.main',
                '&:hover': {
                  backgroundColor: 'secondary.light',
                  borderColor: 'secondary.dark',
                  color: 'secondary.dark',
                }
              }}
            >
              ❤️
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Сетка стикеров */}
      <Box>
        <Typography 
          variant="h6" 
          component="h2" 
          gutterBottom 
          sx={{ 
            mb: 2,
            color: 'rgba(255, 255, 255, 0.9)'
          }}
        >
          Стикеры в наборе
        </Typography>
        
        {stickerCount > 0 ? (
          <StickerGrid 
            stickers={stickerSet.telegramStickerSetInfo?.stickers || []}
            isInTelegramApp={isInTelegramApp}
          />
        ) : (
          <Card 
            className="fx-glass fx-lite"
            sx={{ 
              backgroundColor: 'transparent',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 3
            }}
          >
            <CardContent sx={{ backgroundColor: 'transparent' }}>
              <Typography 
                variant="body1" 
                textAlign="center"
                sx={{ 
                  py: 4,
                  color: 'rgba(255, 255, 255, 0.8)'
                }}
              >
                🎨 В этом наборе пока нет стикеров
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};
