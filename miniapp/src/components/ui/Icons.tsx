import { CSSProperties, FC } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export const CloseIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M18 6L6 18M6 6L18 18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SearchIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2"/>
    <path d="m21 21-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TuneIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <line x1="4" y1="21" x2="4" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4" y1="10" x2="4" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="21" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="8" x2="12" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="20" y1="21" x2="20" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="20" y1="12" x2="20" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="1" y1="14" x2="7" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="9" y1="8" x2="15" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="17" y1="16" x2="23" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const KeyboardArrowDownIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M7 10l5 5 5-5z"/>
  </svg>
);

export const CheckCircleIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
    <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ArrowBackIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const MoreVertIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <circle cx="12" cy="5" r="2"/>
    <circle cx="12" cy="12" r="2"/>
    <circle cx="12" cy="19" r="2"/>
  </svg>
);

export const ShareIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2"/>
    <circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2"/>
    <circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2"/>
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={color} strokeWidth="2"/>
  </svg>
);

export const FavoriteIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

export const DeleteIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const EditIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const BlockIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/>
    <path d="M4.93 4.93l14.14 14.14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export const VisibilityIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2"/>
  </svg>
);

export const TelegramIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
  </svg>
);

export const PersonIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

export const AccountBalanceWalletIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
  </svg>
);

export const DeveloperModeIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M7 5h10v2h2V3c0-1.1-.9-1.99-2-1.99L7 1c-1.1 0-2 .9-2 2v4h2V5zm8.41 11.59L20 12l-4.59-4.59L14 8.83 17.17 12 14 15.17l1.41 1.42zM10 15.17L6.83 12 10 8.83 8.59 7.41 4 12l4.59 4.59L10 15.17zM17 19H7v-2H5v4c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-4h-2v2z"/>
  </svg>
);

export const DownloadIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
  </svg>
);

export const StarBorderIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style}>
    <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" stroke={color} strokeWidth="2" fill="none"/>
  </svg>
);

export const CollectionsIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
  </svg>
);

export const EmojiEventsIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
  </svg>
);

export const MenuIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
  </svg>
);

export const RestoreIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
  </svg>
);

export const DragIndicatorIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>
);

export const AddIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);

export const CheckIcon: FC<IconProps> = ({ size = 24, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} style={style}>
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
  </svg>
);

/* --- Navbar icons (Figma: stroke/fill, specific sizes) --- */

export const NavHomeIcon: FC<IconProps> = ({ size = 20, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 19 20" fill="none" className={className} style={style}>
    <path d="M2 8l7.5-6 7.5 6v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8z" stroke={color} strokeWidth="1.48" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 20V11h5v9" stroke={color} strokeWidth="1.48" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const NavGalleryIcon: FC<IconProps> = ({ size = 20, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={style}>
    <rect x="1" y="1" width="6" height="6" rx="1" stroke={color} strokeWidth="1.25"/>
    <rect x="13" y="1" width="6" height="6" rx="1" stroke={color} strokeWidth="1.25"/>
    <rect x="1" y="13" width="6" height="6" rx="1" stroke={color} strokeWidth="1.25"/>
    <rect x="13" y="13" width="6" height="6" rx="1" stroke={color} strokeWidth="1.25"/>
  </svg>
);

export const NavSwipeIcon: FC<IconProps> = ({ size = 20, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 18 20" fill={color} className={className} style={style}>
    <path d="M9 2L2 11h4v7h6v-7h4L9 2z"/>
  </svg>
);

export const NavGenerationIcon: FC<IconProps> = ({ size = 20, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="4 1 12 12" fill="none" className={className} style={{ ...style, transform: 'scaleX(-1)' }}>
    <path d="M10 2l1.5 3 3.5.5-2.5 2.5.6 3.5L10 9.5l-3.1 1.5.6-3.5L5 5.5l3.5-.5L10 2z" stroke={color} strokeWidth="1.48" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const NavAccountIcon: FC<IconProps> = ({ size = 20, color = 'currentColor', className, style }) => (
  <svg width={size} height={size} viewBox="0 0 15 20" fill="none" className={className} style={style}>
    <circle cx="7.1" cy="5.5" r="3.5" stroke={color} strokeWidth="1.48"/>
    <path d="M1 18.5c0-2.5 2.9-4.5 6.1-4.5s6.1 2 6.1 4.5" stroke={color} strokeWidth="1.48" strokeLinecap="round"/>
  </svg>
);
