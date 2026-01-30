import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Navbar.css';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: '⌂' },
  { path: '/gallery', label: 'Gallery', icon: '🖼' },
  { path: '/nft-soon', label: 'Swipe', icon: '⚡' },
  { path: '/generate', label: 'Generation', icon: '✨' },
  { path: '/profile', label: 'Account', icon: '👤' },
];

export const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string): boolean => {
    // Для Home учитываем также корневой путь
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    // Для остальных путей проверяем точное совпадение или начало пути
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="navbar">
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`navbar__tab ${active ? 'navbar__tab--active' : ''}`}
          >
            <span className="navbar__icon">{item.icon}</span>
            <span className="navbar__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
