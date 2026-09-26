import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { detectSwipeDirection } from './hooks';

interface ViewCarouselProps {
  views: { key: string; content: React.ReactNode }[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  zoomOrigin?: { x: number; y: number } | null;
  className?: string;
  zoomTrigger?: { direction: 'in' | 'out'; origin: { x: number; y: number } } | null;
  onZoomTriggerConsumed?: () => void;
}

type ZoomDirection = 'in' | 'out' | null;

const RUBBERBAND_RESISTANCE = 0.35;

const clampBoundaryOffset = (dx: number, activeIndex: number, viewCount: number): number => {
  if (activeIndex <= 0 && dx > 0) return dx * RUBBERBAND_RESISTANCE;
  if (activeIndex >= viewCount - 1 && dx < 0) return dx * RUBBERBAND_RESISTANCE;
  return dx;
};

const SWIPE_THRESHOLD_RATIO = 0.12;
const PINCH_OUT_THRESHOLD = 0.92;
const PINCH_IN_THRESHOLD = 1.08;
const PINCH_SCALE_MIN = 0.85;
const PINCH_SCALE_MAX = 1.15;
const PINCH_COOLDOWN_MS = 250;
const ZOOM_ANIMATION_MS = 250;
const SWIPE_ANIMATION_MS = 300;

export const CalendarCarousel: React.FC<ViewCarouselProps> = ({
  views, activeIndex, onIndexChange, onZoomIn, onZoomOut, zoomOrigin, className = '',
  zoomTrigger, onZoomTriggerConsumed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [internalIndex, setInternalIndex] = useState(activeIndex);
  const viewWidth = useRef(0);
  const gapPx = useRef(0);
  const dragRafRef = useRef<ReturnType<typeof requestAnimationFrame>>();

  // Refs to avoid stale closures in event handlers
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  useEffect(() => {
    if (!isAnimating) setInternalIndex(activeIndex);
  }, [activeIndex, isAnimating]);

  const initialPinchDistance = useRef(0);
  const isPinching = useRef(false);
  const pinchJustEnded = useRef(false);
  const [pinchScale, setPinchScale] = useState(1);
  const pinchScaleRef = useRef(1);
  const pinchRafRef = useRef<ReturnType<typeof requestAnimationFrame>>();

  const [zoomDirection, setZoomDirection] = useState<ZoomDirection>(null);
  const [activeZoomOrigin, setActiveZoomOrigin] = useState<{ x: number; y: number } | null>(null);
  const [zoomStartScale, setZoomStartScale] = useState(1);
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      const val = getComputedStyle(containerRef.current).getPropertyValue('--app-gap').trim();
      const rem = parseFloat(val);
      const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const gap = isNaN(rem) ? 0 : rem * fontSize;
      viewWidth.current = w;
      gapPx.current = gap;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => () => {
    clearTimeout(zoomTimeoutRef.current);
    clearTimeout(swipeTimeoutRef.current);
    if (pinchRafRef.current) cancelAnimationFrame(pinchRafRef.current);
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
  }, []);

  const startZoomAnimation = useCallback(
    (direction: 'in' | 'out', origin: { x: number; y: number } | null, targetIndex: number, startScale: number, onDone: () => void) => {
      setActiveZoomOrigin(origin);
      setIsAnimating(true);
      setZoomDirection(direction);
      setZoomStartScale(startScale);
      setInternalIndex(targetIndex);

      clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(() => {
        setZoomDirection(null);
        setActiveZoomOrigin(null);
        setIsAnimating(false);
        setZoomStartScale(1);
        onDone();
      }, ZOOM_ANIMATION_MS);
    },
    []
  );

  // Zoom triggered by tapping a month in year view. View change is deferred
  // until after the animation completes to avoid mid-animation re-renders.
  useEffect(() => {
    if (!zoomTrigger) return;
    if (isAnimating) {
      clearTimeout(zoomTimeoutRef.current);
      setZoomDirection(null);
      setActiveZoomOrigin(null);
      setZoomStartScale(1);
    }
    const { direction, origin } = zoomTrigger;
    const targetIndex = direction === 'in' ? activeIndex - 1 : activeIndex + 1;
    startZoomAnimation(direction, origin, targetIndex, 1, () => onIndexChangeRef.current(targetIndex));
    if (onZoomTriggerConsumed) onZoomTriggerConsumed();
  }, [zoomTrigger, isAnimating, activeIndex, startZoomAnimation, onZoomTriggerConsumed]);

  const swipeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const animateTo = useCallback(
    (targetOffset: number, newIndex: number) => {
      clearTimeout(swipeTimeoutRef.current);
      setIsAnimating(true);
      setOffsetX(targetOffset);
      swipeTimeoutRef.current = setTimeout(() => {
        onIndexChange(newIndex);
        setInternalIndex(newIndex);
        setOffsetX(0);
        setIsAnimating(false);
      }, SWIPE_ANIMATION_MS);
    },
    [onIndexChange]
  );

  const animateZoom = useCallback(
    (direction: 'in' | 'out', callback: () => void, explicitOrigin?: { x: number; y: number } | null, startScale = 1) => {
      const targetIndex = direction === 'in' ? activeIndex - 1 : activeIndex + 1;
      const isYearMonthTransition =
        (views[activeIndex]?.key === 'year' && views[targetIndex]?.key === 'month') ||
        (views[activeIndex]?.key === 'month' && views[targetIndex]?.key === 'year');
      const origin = explicitOrigin !== undefined
        ? explicitOrigin
        : (isYearMonthTransition ? (zoomOrigin || null) : null);
      startZoomAnimation(direction, origin, targetIndex, startScale, callback);
    },
    [zoomOrigin, activeIndex, views, startZoomAnimation]
  );

  const [isBouncing, setIsBouncing] = useState(false);

  const resolveSwipe = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragRafRef.current) { cancelAnimationFrame(dragRafRef.current); dragRafRef.current = undefined; }
    if (!isHorizontalSwipe.current) { setOffsetX(0); return; }
    isHorizontalSwipe.current = null;

    const w = viewWidth.current || (containerRef.current?.offsetWidth || 0);
    if (w === 0) { setOffsetX(0); return; }

    const threshold = w * SWIPE_THRESHOLD_RATIO;
    const dx = currentX.current;
    const step = w + gapPx.current;
    if (dx > threshold && activeIndex > 0) animateTo(step, activeIndex - 1);
    else if (dx < -threshold && activeIndex < views.length - 1) animateTo(-step, activeIndex + 1);
    else if (dx !== 0) {
      setIsBouncing(true);
      setOffsetX(0);
      setTimeout(() => setIsBouncing(false), 250);
    } else setOffsetX(0);
  }, [activeIndex, views.length, animateTo]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;

    if (e.touches.length === 2) {
      isDragging.current = false;
      isHorizontalSwipe.current = null;
      currentX.current = 0;
      setOffsetX(0);
      pinchJustEnded.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance.current = Math.hypot(dx, dy);
      isPinching.current = true;
      return;
    }

    if (pinchJustEnded.current) { pinchJustEnded.current = false; return; }
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    isDragging.current = true;
    isHorizontalSwipe.current = null;
  }, [isAnimating]);

  // Throttle setOffsetX with requestAnimationFrame so we only update React
  // state once per frame instead of on every touchmove event.
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPinching.current) {
      if (e.touches.length >= 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.hypot(dx, dy);
        const scale = distance / (initialPinchDistance.current || 1);
        const clamped = Math.max(PINCH_SCALE_MIN, Math.min(PINCH_SCALE_MAX, scale));
        pinchScaleRef.current = clamped;
        if (pinchRafRef.current) cancelAnimationFrame(pinchRafRef.current);
        pinchRafRef.current = requestAnimationFrame(() => {
          setPinchScale(pinchScaleRef.current);
        });
      }
      return;
    }

    if (!isDragging.current || isAnimating) return;
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isHorizontalSwipe.current === null) {
      const detected = detectSwipeDirection(dx, dy);
      if (detected) isHorizontalSwipe.current = detected === 'horizontal';
      return;
    }
    if (!isHorizontalSwipe.current) return;
    e.preventDefault();
    const clamped = clampBoundaryOffset(dx, activeIndex, views.length);
    currentX.current = clamped;
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(() => setOffsetX(clamped));
  }, [isAnimating, activeIndex, views.length]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinching.current) {
      if (e.touches.length === 1) { initialPinchDistance.current = 0; return; }
      if (e.touches.length > 0) return;

      // Read the final scale from the ref (guaranteed up-to-date even if
      // the last rAF hasn't flushed to React state yet).
      const scale = pinchScaleRef.current;
      isPinching.current = false;
      initialPinchDistance.current = 0;
      setPinchScale(1);
      pinchScaleRef.current = 1;
      pinchJustEnded.current = true;
      setTimeout(() => { pinchJustEnded.current = false; }, PINCH_COOLDOWN_MS);

      if (scale < PINCH_OUT_THRESHOLD && onZoomOut) {
        if (activeIndex >= views.length - 1) return;
        animateZoom('out', onZoomOut, undefined, scale);
      } else if (scale > PINCH_IN_THRESHOLD && onZoomIn) {
        if (activeIndex <= 0) return;
        animateZoom('in', onZoomIn, undefined, scale);
      }
      return;
    }

    resolveSwipe();
  }, [onZoomIn, onZoomOut, activeIndex, views.length, animateZoom, resolveSwipe]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isAnimating) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = 0;
    isDragging.current = true;
    isHorizontalSwipe.current = null;
  }, [isAnimating]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || isAnimating) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (isHorizontalSwipe.current === null) {
      const detected = detectSwipeDirection(dx, dy);
      if (detected) isHorizontalSwipe.current = detected === 'horizontal';
      return;
    }
    if (!isHorizontalSwipe.current) return;
    const clamped = clampBoundaryOffset(dx, activeIndex, views.length);
    currentX.current = clamped;
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(() => setOffsetX(clamped));
  }, [isAnimating, activeIndex, views.length]);

  const handleMouseUp = useCallback(() => resolveSwipe(), [resolveSwipe]);

  const trackIndex = internalIndex;
  const translateX = `calc(${-trackIndex * 100}% - ${trackIndex} * var(--app-gap) + ${offsetX}px)`;

  const originStyle: React.CSSProperties = (() => {
    if (!activeZoomOrigin) return {};
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return {};
    const xPct = ((activeZoomOrigin.x / 100) * window.innerWidth - rect.left) / rect.width * 100;
    const yPct = ((activeZoomOrigin.y / 100) * window.innerHeight - rect.top) / rect.height * 100;
    return { transformOrigin: `${xPct}% ${yPct}%` };
  })();

  const getPanelClass = (isCurrent: boolean) => {
    const base = 'carousel-panel';
    if (!isCurrent) return base;
    if (pinchScale !== 1) return `${base} pinch-active`;
    if (zoomDirection === 'in') return `${base} zoom-enter-in`;
    if (zoomDirection === 'out') return `${base} zoom-enter-out`;
    return base;
  };

  const getPanelStyle = (isCurrent: boolean): React.CSSProperties => {
    if (!isCurrent) return {};
    if (pinchScale !== 1) return { transform: `scale(${pinchScale})`, transition: 'none', ...originStyle };
    if (zoomDirection === 'in' || zoomDirection === 'out') return { ...originStyle, ['--zoom-start' as string]: String(zoomStartScale) } as React.CSSProperties;
    return {};
  };

  return (
    <div
      ref={containerRef}
      className={`carousel-container ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { isPinching.current = false; isDragging.current = false; isHorizontalSwipe.current = null; setOffsetX(0); setPinchScale(1); pinchScaleRef.current = 1; }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (isDragging.current) handleMouseUp(); }}
    >
      <div
        className={`carousel-track ${isBouncing ? 'carousel-track-bouncing' : isAnimating && !zoomDirection ? 'carousel-track-animating' : ''} ${isAnimating ? 'carousel-track-locked' : ''}`}
        style={{ transform: `translateX(${translateX})` }}
      >
        {views.map((view, i) => {
          const isVisible = Math.abs(i - trackIndex) <= 1;
          return (
          <div key={view.key} className={getPanelClass(i === trackIndex)} style={getPanelStyle(i === trackIndex)}>
            {isVisible ? view.content : null}
          </div>
          );
        })}
      </div>
    </div>
  );
};
