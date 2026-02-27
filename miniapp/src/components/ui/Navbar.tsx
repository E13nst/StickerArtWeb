import { CSSProperties, FC } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Navbar.css';

const BASE = (import.meta as any).env?.BASE_URL || '/miniapp/';

const navMaskIcon = (svgFile: string): FC<{ size?: number; color?: string; className?: string; style?: CSSProperties }> => {
  const Component: FC<{ size?: number; color?: string; className?: string; style?: CSSProperties }> = ({ size = 20, className, style }) => (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${BASE}${svgFile})`,
        maskImage: `url(${BASE}${svgFile})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...style,
      }}
    />
  );
  return Component;
};

const NavArtIcon = navMaskIcon('art-icon.svg');
const NavLikeIcon = navMaskIcon('like-icon.svg');
const NavHomeIcon = navMaskIcon('assets/home-icon.svg');
const NavGalleryIcon = navMaskIcon('assets/gallery-icon.svg');
const NavAccountIcon = navMaskIcon('assets/account-icon.svg');

interface NavItem {
  path: string;
  label: string;
  Icon: FC<{ size?: number; color?: string; className?: string; style?: CSSProperties }>;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', Icon: NavHomeIcon },
  { path: '/gallery', label: 'Gallery', Icon: NavGalleryIcon },
  { path: '/nft-soon', label: 'Swipe', Icon: NavLikeIcon },
  { path: '/generate', label: 'Stixly AI', Icon: NavArtIcon },
  { path: '/profile', label: 'Profile', Icon: NavAccountIcon },
];

export const Navbar: FC = () => {
  const location = useLocation();

  const isActive = (path: string): boolean => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="navbar">
      {navItems.map((item) => {
        const active = isActive(item.path);
        const Icon = item.Icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`navbar__tab ${active ? 'navbar__tab--active' : ''}`}
          >
            <span className="navbar__icon">
              <Icon size={24} color="currentColor" />
            </span>
            <span className="navbar__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
