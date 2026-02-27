import { useMemo } from 'react';

export interface GlassEffectTokens {
  textColor: string;
  textColorResolved: string;
  glassBase: string;
  glassSolid: string;
  glassHover: string;
  borderColor: string;
  accentShadow: string;
  accentShadowHover: string;
}

/** Единая тёмная тема — без переключения light/dark */
export const useGlassEffect = (): GlassEffectTokens => {
  return useMemo(
    () => ({
      textColor: 'var(--tg-theme-button-text-color, #ffffff)',
      textColorResolved: 'var(--tg-theme-button-text-color, #ffffff)',
      glassBase: 'color-mix(in srgb, rgba(88, 138, 255, 0.36) 60%, transparent)',
      glassSolid: 'rgba(78, 132, 255, 0.24)',
      glassHover: 'color-mix(in srgb, rgba(98, 150, 255, 0.44) 74%, transparent)',
      borderColor: 'rgba(118, 168, 255, 0.28)',
      accentShadow: '0 6px 18px rgba(30, 72, 185, 0.14)',
      accentShadowHover: '0 10px 26px rgba(30, 72, 185, 0.18)',
    }),
    []
  );
};
