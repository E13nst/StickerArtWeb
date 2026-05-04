import { CSSProperties, FC } from 'react';
import './Pulsar.css';

interface PulsarProps {
  /** Diameter in px. Default: 60 */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /**
   * Color scheme for the pulse rings.
   * - 'brand' (default): оттенки --color-primary через color-mix
   * - 'warm': чуть светлее те же оттенки (--p-c2/--p-c3 иначе)
   */
  colorScheme?: 'brand' | 'warm';
}

/**
 * Pulsar — sonar-style concentric rings that expand from a glowing core.
 * Color cycles automatically through the brand palette.
 * Pure SVG + CSS, zero JS, zero dependencies.
 */
export const Pulsar: FC<PulsarProps> = ({ size = 60, className = '', style = {}, colorScheme = 'brand' }) => (
  <span
    className={`stixly-pulsar${colorScheme === 'warm' ? ' stixly-pulsar--warm' : ''}${className ? ` ${className}` : ''}`}
    style={{ width: size, height: size, ...style }}
    role="status"
    aria-label="Загрузка"
  >
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Rings rendered back-to-front so ring-1 (freshest) is on top */}
      <circle cx="30" cy="30" r="7" className="p-ring p-r3" />
      <circle cx="30" cy="30" r="7" className="p-ring p-r2" />
      <circle cx="30" cy="30" r="7" className="p-ring p-r1" />
      {/* Glowing core */}
      <circle cx="30" cy="30" r="7" className="p-core" />
    </svg>
  </span>
);
