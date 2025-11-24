import React from 'react';
import { Box, IconButton, Typography, Tooltip, Popover } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DownloadIcon from '@mui/icons-material/Download';
import StarBorderIcon from '@mui/icons-material/StarBorder';

interface StickerSetActionsBarProps {
  liked: boolean;
  likes: number;
  likeAnim: boolean;
  onLikeClick: () => void;
  onShareClick: () => void;
  starsInfoAnchor: HTMLElement | null;
  onStarsInfoOpen: (anchor: HTMLElement) => void;
  onStarsInfoClose: () => void;
}

export const StickerSetActionsBar: React.FC<StickerSetActionsBarProps> = ({
  liked,
  likes,
  likeAnim,
  onLikeClick,
  onShareClick,
  starsInfoAnchor,
  onStarsInfoOpen,
  onStarsInfoClose
}) => {
  return (
    <>
      <Box 
        onClick={(e) => e.stopPropagation()}
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '13px', 
          flexShrink: 0,
          height: '100%',
          justifyContent: 'space-between'
        }}
      >
        <Tooltip title="Поддержать Stars" arrow>
          <IconButton
            aria-label="donate-stars"
            onClick={(e) => {
              e.stopPropagation();
              onStarsInfoOpen(e.currentTarget);
            }}
            sx={{
              width: 55,
              flex: 1,
              backgroundColor: 'rgba(255, 215, 0, 0.2)',
              color: '#FFD700',
              borderRadius: 'var(--tg-radius-l)',
              border: '1px solid rgba(255, 215, 0, 0.4)',
              transition: 'transform 150ms ease, background-color 150ms ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px',
              '&:hover': {
                backgroundColor: 'rgba(255, 215, 0, 0.3)',
                border: '1px solid rgba(255, 215, 0, 0.6)',
                transform: 'scale(1.05)'
              }
            }}
          >
            <StarBorderIcon sx={{ fontSize: '32px' }} />
            <Typography variant="caption" sx={{
              fontSize: '13px',
              lineHeight: 1,
              fontWeight: 700,
              color: '#FFD700',
              textShadow: '0 1px 2px rgba(0,0,0,0.9)',
              letterSpacing: '-0.5px'
            }}>
              {/* Placeholder */}
            </Typography>
          </IconButton>
        </Tooltip>
        
        <IconButton
          aria-label="like"
          onClick={(e) => {
            e.stopPropagation();
            onLikeClick();
          }}
          sx={{
            width: 55,
            flex: 1,
            backgroundColor: liked ? 'error.light' : 'rgba(255, 255, 255, 0.2)',
            color: liked ? 'error.main' : 'white',
            borderRadius: 'var(--tg-radius-l)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
            transform: likeAnim ? 'scale(1.2)' : 'scale(1.0)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px',
            '&:hover': {
              backgroundColor: liked ? 'error.light' : 'rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.5)'
            }
          }}
        >
          <FavoriteIcon sx={{ fontSize: '32px' }} />
          <Typography variant="caption" sx={{
            fontSize: '13px',
            lineHeight: 1,
            fontWeight: 700,
            color: 'white !important',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
            letterSpacing: '-0.5px'
          }}>
            {likes}
          </Typography>
        </IconButton>
        
        <IconButton
          aria-label="share"
          onClick={(e) => {
            e.stopPropagation();
            onShareClick();
          }}
          sx={{
            width: 55,
            flex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            borderRadius: 'var(--tg-radius-l)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              transform: 'scale(1.05)'
            }
          }}
        >
          <DownloadIcon sx={{ fontSize: '32px' }} />
        </IconButton>
      </Box>

      <Popover
        open={Boolean(starsInfoAnchor)}
        anchorEl={starsInfoAnchor}
        onClose={onStarsInfoClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          onClick: (e) => e.stopPropagation(),
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            color: 'white',
            borderRadius: '13px',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            padding: '16px 20px',
            maxWidth: '280px',
            mt: 1
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography
          variant="body2"
          sx={{
            fontSize: '14px',
            lineHeight: 1.5,
            color: 'white',
            textAlign: 'center',
            fontWeight: 500
          }}
        >
          Скоро вы сможете поддержать автора и продвинуть его стикерпак за Telegram Stars
        </Typography>
      </Popover>
    </>
  );
};

