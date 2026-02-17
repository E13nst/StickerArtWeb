import { CSSProperties, FC } from 'react';
import { FavoriteIcon, DownloadIcon } from '@/components/ui/Icons';

const actionsBarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '13px',
  flexShrink: 0,
  height: '100%',
  justifyContent: 'space-between',
};

const iconButtonStyle = (overrides?: CSSProperties): CSSProperties => ({
  width: 55,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px',
  borderRadius: 'var(--tg-radius-l)',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  transition: 'transform 150ms ease, background-color 150ms ease, color 150ms ease, border-color 150ms ease',
  cursor: 'pointer',
  background: 'transparent',
  color: 'white',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  ...overrides,
});

export const StickerSetActionsBar: FC<{
  liked: boolean;
  likes: number;
  likeAnim: boolean;
  onLikeClick: () => void;
  onShareClick: () => void;
}> = ({
  liked,
  likes,
  likeAnim,
  onLikeClick,
  onShareClick,
}) => {
  return (
    <div onClick={(e) => e.stopPropagation()} style={actionsBarStyle}>
      <button
        type="button"
        aria-label="like"
        onClick={(e) => {
          e.stopPropagation();
          onLikeClick();
        }}
        style={iconButtonStyle({
          background: 'transparent',
          color: liked ? '#ee449f' : 'white',
          border: liked ? '1px solid rgba(238, 68, 159, 0.4)' : '1px solid rgba(255, 255, 255, 0.25)',
          transform: likeAnim ? 'scale(1.2)' : 'scale(1.0)',
        })}
      >
        <FavoriteIcon size={32} color={liked ? '#ee449f' : 'white'} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'inherit', lineHeight: 1 }}>{likes}</span>
      </button>

      <button
        type="button"
        aria-label="share"
        onClick={(e) => {
          e.stopPropagation();
          onShareClick();
        }}
        style={iconButtonStyle()}
      >
        <DownloadIcon size={32} />
      </button>
    </div>
  );
};
