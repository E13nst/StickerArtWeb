import React from 'react';
import './PageBackground.css';

/** URL картинки задаётся через CSS: --page-bg-image: url('path/to/image.png'); на родителе или в :root */
export function PageBackground() {
  return (
    <div className="page-background" aria-hidden>
      {/* Background — размытый слой по Figma */}
      <div className="page-background__blur" />
      {/* Rectangle 1 — top 151px */}
      <div className="page-background__rect" />
      {/* Rectangle 2 — top 548px, flip */}
      <div className="page-background__rect" />
      {/* Rectangle 3 — top 947px, rotate 90deg */}
      <div className="page-background__rect" />
      {/* Rectangle 4 — top 1349px, rotate -90deg */}
      <div className="page-background__rect" />
    </div>
  );
}
