import { CSSProperties, FC } from 'react';
import { FavoriteIcon, DownloadIcon, StarBorderIcon } from '@/components/ui/Icons';

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
  starsInfoAnchor: HTMLElement | null;
  onStarsInfoOpen: (anchor: HTMLElement) => void;
  onStarsInfoClose: () => void;
}> = ({
  liked,
  likes,
  likeAnim,
  onLikeClick,
  onShareClick,
  starsInfoAnchor,
  onStarsInfoOpen,
  onStarsInfoClose,
}) => {
  return (
    <>
      <div onClick={(e) => e.stopPropagation()} style={actionsBarStyle}>
        <button
          type="button"
          title="Поддержать Stars"
          aria-label="donate-stars"
          onClick={(e) => {
            e.stopPropagation();
            onStarsInfoOpen(e.currentTarget);
          }}
          style={iconButtonStyle({
            backgroundColor: 'rgba(255, 215, 0, 0.2)',
            color: '#FFD700',
            border: '1px solid rgba(255, 215, 0, 0.4)',
          })}
        >
          <StarBorderIcon size={32} color="#FFD700" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFD700', lineHeight: 1 }}>Stars</span>
        </button>

        <button
          type="button"
          aria-label="like"
          onClick={(e) => {
            e.stopPropagation();
            onLikeClick();
          }}
          style={iconButtonStyle({
            background: 'transparent',
            color: liked ? '#f44336' : 'white',
            border: liked ? '1px solid rgba(244, 67, 54, 0.4)' : '1px solid rgba(255, 255, 255, 0.25)',
            transform: likeAnim ? 'scale(1.2)' : 'scale(1.0)',
          })}
        >
          <FavoriteIcon size={32} color={liked ? '#f44336' : 'white'} />
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

      {starsInfoAnchor && (
        <>
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
            }}
            onClick={onStarsInfoClose}
          />
          <div
            role="dialog"
            aria-label="Stars"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1301,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'white',
              borderRadius: 13,
              border: '1px solid rgba(255, 215, 0, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              padding: '16px 20px',
              maxWidth: 280,
            }}
          >
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'white', textAlign: 'center', fontWeight: 500, margin: 0 }}>
              Скоро вы сможете поддержать автора и продвинуть его стикерпак за Telegram Stars
            </p>
          </div>
        </>
      )}
    </>
  );
};
