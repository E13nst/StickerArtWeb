import type { SyntheticEvent } from 'react';

const APPLIED_ATTR = 'data-api-img-fb';

/** Проверка URL артефакта с бэка (в т.ч. `/api/images/{uuid}.webp`, абсолютный или относительный). */
export function isApiHostedArtifactUrl(url: string): boolean {
  if (!url || url.startsWith('data:')) return false;
  return url.toLowerCase().includes('/api/images/');
}

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#2a2a2a"/>
  <path d="M20 40 L32 24 L44 40 Z" fill="none" stroke="#5a5a5a" stroke-width="2"/>
  <circle cx="26" cy="22" r="3" fill="#5a5a5a"/>
</svg>`;

export const API_IMAGE_FALLBACK_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FALLBACK_SVG)}`;

/** Один раз подменяет сломанный `/api/images/*` на нейтральную заглушку (410, истёкший CDN и т.д.). */
export function onApiHostedImageError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.getAttribute(APPLIED_ATTR) === '1') return;
  const src = img.currentSrc || img.getAttribute('src') || '';
  if (!isApiHostedArtifactUrl(src)) return;
  img.setAttribute(APPLIED_ATTR, '1');
  img.src = API_IMAGE_FALLBACK_SRC;
}
