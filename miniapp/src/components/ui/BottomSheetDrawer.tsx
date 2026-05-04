import { FC, ReactNode, useRef, useCallback, useState, useLayoutEffect } from 'react';
import { motion, useMotionValue, animate, PanInfo, useTransform } from 'framer-motion';
import './BottomSheetDrawer.css';

export interface BottomSheetDrawerProps {
  children: ReactNode;
  /** Подсказка в peek-режиме (под handle-bar) */
  peekLabel?: string;
  /** Высота открытого состояния (CSS-значение). Default: 'min(68vh, 540px)' */
  expandedHeight?: string;
  /** Высота peek-зоны в px (handle + подпись). Default: 52 */
  peekHeight?: number;
  /** Отступ от нижнего края (высота таскбара/навбара) в px. Default: 96 */
  bottomOffset?: number;
  /** Дополнительный класс */
  className?: string;
  /** Controlled expanded state */
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

const VELOCITY_OPEN  = -350;  // px/s — резкий свайп вверх
const VELOCITY_CLOSE =  350;  // px/s — резкий свайп вниз
const DISTANCE_OPEN  =  80;   // px — медленный длинный свайп вверх
const DISTANCE_CLOSE =  60;   // px — медленный длинный свайп вниз

export const BottomSheetDrawer: FC<BottomSheetDrawerProps> = ({
  children,
  peekLabel,
  expandedHeight = 'min(68vh, 540px)',
  peekHeight = 52,
  bottomOffset = 96,
  className = '',
  expanded: controlledExpanded,
  onExpandChange,
}) => {
  const isControlled = controlledExpanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const sheetRef = useRef<HTMLDivElement>(null);
  // y = 0: element in natural position (fully visible above taskbar)
  // y = (height - peekHeight): only peekHeight visible above taskbar
  const y = useMotionValue(9999); // 9999 = invisible until measured
  const heightPxRef = useRef(0);

  const measureAndCollapse = useCallback((immediate = true) => {
    const el = sheetRef.current;
    if (!el) return;
    heightPxRef.current = el.offsetHeight;
    const collapsed = Math.max(0, heightPxRef.current - peekHeight);
    if (immediate) {
      y.set(collapsed);
    } else {
      animate(y, collapsed, { type: 'spring', stiffness: 380, damping: 38, mass: 1 });
    }
  }, [y, peekHeight]);

  // Initial position after first render — collapse immediately without animation
  useLayoutEffect(() => {
    const initial = isControlled ? controlledExpanded : false;
    if (initial) {
      const el = sheetRef.current;
      if (el) heightPxRef.current = el.offsetHeight;
      y.set(0);
    } else {
      measureAndCollapse(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapTo = useCallback((open: boolean) => {
    const el = sheetRef.current;
    if (el) heightPxRef.current = el.offsetHeight;
    const maxY = Math.max(0, heightPxRef.current - peekHeight);
    animate(y, open ? 0 : maxY, { type: 'spring', stiffness: 380, damping: 38, mass: 1 });
    if (!isControlled) setInternalExpanded(open);
    onExpandChange?.(open);
  }, [y, peekHeight, isControlled, onExpandChange]);

  // Sync controlled state changes
  const prevControlledRef = useRef(controlledExpanded);
  useLayoutEffect(() => {
    if (!isControlled) return;
    if (prevControlledRef.current !== controlledExpanded) {
      prevControlledRef.current = controlledExpanded;
      snapTo(!!controlledExpanded);
    }
  });

  const handleDragEnd = useCallback((_e: PointerEvent, info: PanInfo) => {
    const { velocity, offset } = info;
    if (velocity.y < VELOCITY_OPEN || offset.y < -DISTANCE_OPEN) {
      snapTo(true);
    } else if (velocity.y > VELOCITY_CLOSE || offset.y > DISTANCE_CLOSE) {
      snapTo(false);
    } else {
      // snap to nearest
      snapTo(isExpanded);
    }
  }, [isExpanded, snapTo]);

  const handleHandleClick = useCallback(() => {
    snapTo(!isExpanded);
  }, [isExpanded, snapTo]);

  // Indicator opacity: fully transparent when expanded, visible when collapsed
  const arrowOpacity = useTransform(y, (val) => {
    const h = heightPxRef.current;
    if (!h) return 1;
    const maxY = h - peekHeight;
    if (maxY <= 0) return 0;
    return Math.min(1, val / maxY);
  });

  return (
    <motion.div
      ref={sheetRef}
      className={`bottom-sheet-drawer ${isExpanded ? 'bottom-sheet-drawer--expanded' : ''} ${className}`}
      style={{
        y,
        bottom: bottomOffset,
        height: expandedHeight,
      }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.15, bottom: 0.06 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {/* ── Handle area: tap или drag ── */}
      <div
        className="bottom-sheet-drawer__handle-area"
        onClick={handleHandleClick}
        role="button"
        aria-label={isExpanded ? 'Свернуть' : 'Стили и категории'}
        aria-expanded={isExpanded}
      >
        <div className="bottom-sheet-drawer__handle-bar" />
        <motion.div
          className="bottom-sheet-drawer__peek-hint"
          style={{ opacity: arrowOpacity }}
        >
          {peekLabel && <p className="bottom-sheet-drawer__peek-label">{peekLabel}</p>}
        </motion.div>
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="bottom-sheet-drawer__content"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </motion.div>
  );
};
