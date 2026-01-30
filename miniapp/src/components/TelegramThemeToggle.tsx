import React from 'react';
import './TelegramThemeToggle.css';

// Пресеты темы в стиле Telegram WebApp
const lightTheme = {
  bg_color: '#ffffff',
  text_color: '#000000',
  hint_color: '#999999',
  link_color: '#2481cc',
  button_color: '#2481cc',
  button_text_color: '#ffffff',
  secondary_bg_color: '#f8f9fa',
  border_color: '#e0e0e0',
  shadow_color: 'rgba(0, 0, 0, 0.1)',
  overlay_color: 'rgba(0, 0, 0, 0.7)',
};

const darkTheme = {
  bg_color: '#18222d',
  text_color: '#ffffff',
  hint_color: '#708499',
  link_color: '#6ab2f2',
  button_color: '#5288c1',
  button_text_color: '#ffffff',
  secondary_bg_color: '#131415',
  border_color: '#2a3441',
  shadow_color: 'rgba(0, 0, 0, 0.3)',
  overlay_color: 'rgba(0, 0, 0, 0.8)',
};

function applyTheme(theme: typeof lightTheme, scheme: 'light' | 'dark') {
  const root = document.documentElement;
  const body = document.body;
  root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
  root.style.setProperty('--tg-theme-text-color', theme.text_color);
  root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
  root.style.setProperty('--tg-theme-button-color', theme.button_color);
  root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
  root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color);
  root.style.setProperty('--tg-theme-link-color', theme.link_color);
  root.style.setProperty('--tg-theme-border-color', theme.border_color);
  root.style.setProperty('--tg-theme-shadow-color', theme.shadow_color);
  root.style.setProperty('--tg-theme-overlay-color', theme.overlay_color);
  body.style.backgroundColor = theme.bg_color;
  body.style.color = theme.text_color;
  if (scheme === 'dark') {
    root.classList.add('tg-dark-theme');
    root.classList.remove('tg-light-theme');
  } else {
    root.classList.add('tg-light-theme');
    root.classList.remove('tg-dark-theme');
  }
}

export const TelegramThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = React.useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('stixly_tg_theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.scheme === 'dark';
      }
    } catch {}
    return document.documentElement.classList.contains('tg-dark-theme');
  });

  // При монтировании применяем сохранённую тему
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('stixly_tg_theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.scheme === 'dark') {
          applyTheme(parsed.params || darkTheme, 'dark');
          return;
        }
        if (parsed?.scheme === 'light') {
          applyTheme(parsed.params || lightTheme, 'light');
          return;
        }
      }
    } catch {}
  }, []);

  const handleToggle = () => {
    const next = !isDark;
    setIsDark(next);
    const scheme = next ? 'dark' : 'light';
    const params = next ? darkTheme : lightTheme;
    applyTheme(params, scheme);
    try {
      localStorage.setItem('stixly_tg_theme', JSON.stringify({ scheme, params }));
    } catch {}
  };

  return (
    <button 
      className="telegram-theme-toggle"
      onClick={handleToggle}
    >
      {isDark ? '☀️ Светлая' : '🌙 Тёмная'}
    </button>
  );
};
