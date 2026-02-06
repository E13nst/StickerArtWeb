import React from 'react';
import './OtherAccountBackground.css';

/**
 * Фон страницы профиля по Figma «#Other account background».
 * SVG задаётся через CSS: --other-account-bg-image (url или data:image/svg+xml,...)
 * в стилях страницы (MyProfilePage.css / AuthorPage.css) или :root.
 */
export function OtherAccountBackground() {
  return (
    <div className="other-account-background" aria-hidden>
      {/* Слой под контентом; картинка/ SVG — через CSS переменную --other-account-bg-image */}
    </div>
  );
}
