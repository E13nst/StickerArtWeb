import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  NavHomeIcon,
  NavGalleryIcon,
  NavSwipeIcon,
  NavGenerationIcon,
  NavAccountIcon,
} from './Icons';
import './Navbar.css';

interface NavItem {
  path: string;
  label: string;
  Icon: React.FC<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', Icon: NavHomeIcon },
  { path: '/gallery', label: 'Gallery', Icon: NavGalleryIcon },
  { path: '/nft-soon', label: 'Swipe', Icon: NavSwipeIcon },
  { path: '/generate', label: 'Generation', Icon: NavGenerationIcon },
  { path: '/profile', label: 'Account', Icon: NavAccountIcon },
];

export const Navbar: React.FC = () => {
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
              <Icon size={20} color="currentColor" />
            </span>
            <span className="navbar__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
