import { CSSProperties, FC } from 'react';
import './Quantum.css';

interface QuantumProps {
  /** Diameter in px. Default: 60 */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Quantum — 6 dots orbit at two radii (r=14 inner, r=21 outer).
 * Each dot has a slightly different orbital period, so they
 * phase-drift over time: sometimes bunched, sometimes evenly spread.
 * This quantum "probability cloud" feel is the defining characteristic.
 *
 * Color waves through the brand palette independently per dot:
 * #ee449f (pink) ↔ #a855f7 (purple) ↔ #5288c1 (blue) ↔ #6ab2f2 (sky).
 *
 * Pure SVG + CSS, zero JS, zero dependencies.
 */
export const Quantum: FC<QuantumProps> = ({ size = 60, className = '', style = {} }) => (
  <span
    className={`stixly-quantum${className ? ` ${className}` : ''}`}
    style={{ width: size, height: size, ...style }}
    role="status"
    aria-label="Загрузка"
  >
    <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Subtle dashed orbit tracks */}
      <circle cx="30" cy="30" r="14" className="q-track" />
      <circle cx="30" cy="30" r="21" className="q-track" />

      {/* ── Inner orbit (r = 14) ──────────────────────────────────
          Dots pre-positioned at the top of their orbit (cy = 30-14 = 16).
          transform-box:view-box + transform-origin:center makes each
          <g> rotate around the SVG viewport center at (30, 30). */}
      <g className="q-orbit qi-a"><circle cx="30" cy="16" r="3.5" className="qd-a" /></g>
      <g className="q-orbit qi-b"><circle cx="30" cy="16" r="3"   className="qd-b" /></g>
      <g className="q-orbit qi-c"><circle cx="30" cy="16" r="3.5" className="qd-c" /></g>

      {/* ── Outer orbit (r = 21) ─────────────────────────────────
          Top of outer orbit: cy = 30-21 = 9 */}
      <g className="q-orbit qo-a"><circle cx="30" cy="9"  r="2.5" className="qd-d" /></g>
      <g className="q-orbit qo-b"><circle cx="30" cy="9"  r="2"   className="qd-e" /></g>
      <g className="q-orbit qo-c"><circle cx="30" cy="9"  r="2.5" className="qd-f" /></g>

      {/* Glowing core */}
      <circle cx="30" cy="30" r="4" className="q-core" />
    </svg>
  </span>
);
