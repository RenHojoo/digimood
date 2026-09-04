import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { detectSwipeDirection } from './hooks';

const SWIPE_DRAG_THRESHOLD = 5;
const SWIPE_THRESHOLD_RATIO = 0.12;
const SWIPE_ANIMATION_MS = 300;
const BOUNCE_MS = 250;
const RUBBERBAND_RESISTANCE = 0.35;

export interface VerticalSwipeTrackProps {
  items: { key: string; render: () => React.ReactNode }[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  className?: string;
  panelClassName?: string;
  contentClassName?: string;
  fitToContent?: boolean;
}

export const VerticalSwipeTrack: React.FC<VerticalSwipeTrackProps> = ({
  items, activeIndex, onIndexChange, className = '', panelClassName = '', contentClassName = '', fitToContent = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const isVerticalSwipe = useRef<boolean | null>(null);
  const isPinching = useRef(false);
  const [offsetY, setOffsetY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [containerHeight, setContainerHeight] = useState(0);
  const [internalIndex, setInternalIndex] = useState(activeIndex);
  const gapPx = useRef(0);
  const dragRafRef = useRef<ReturnType<typeof requestAnimationFrame>>();

  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  useLayoutEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      const gapVal = getComputedStyle(containerRef.current).getPropertyValue('--app-gap').trim();
      const rem = parseFloat(gapVal);
      const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      gapPx.current = isNaN(rem) ? 0 : rem * fontSize;

      if (fitToContent && trackRef.current) {
        const panels = trackRef.current.children;
        const activePanel = panels[activeIndex] as HTMLElement | undefined;
        if (activePanel) {
          const contentEl = activePanel.firstElementChild as HTMLElement | null;
          const h = contentEl ? contentEl.scrollHeight : activePanel.offsetHeight;
          setContainerHeight(prev => prev !== h ? h : prev);
          containerRef.current.style.height = `${h}px`;
        }
      } else {
        const h = containerRef.current.offsetHeight;
        setContainerHeight(prev => prev !== h ? h : prev);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { window.removeEventListener('resize', measure); ro.disconnect(); };
  }, [fitToContent, activeIndex]);

  const swipeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const animateTo = useCallback(
    (targetOffset: number, newIndex: number) => {
      clearTimeout(swipeTimeoutRef.current);
      setIsAnimating(true);
      setOffsetY(targetOffset);
      swipeTimeoutRef.current = setTimeout(() => {
        onIndexChangeRef.current(newIndex);
        setOffsetY(0);
        setIsAnimating(false);
      }, SWIPE_ANIMATION_MS);
    },
    []
  );

  const resolveSwipe = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragRafRef.current) { cancelAnimationFrame(dragRafRef.current); dragRafRef.current = undefined; }
    if (!isVerticalSwipe.current) { setOffsetY(0); return; }
    isVerticalSwipe.current = null;

    if (containerHeight === 0) { setOffsetY(0); return; }
    const threshold = containerHeight * SWIPE_THRESHOLD_RATIO;
    const dy = currentY.current;
    const step = containerHeight + gapPx.current;

    if (dy < -threshold && activeIndex < items.length - 1) animateTo(-step, activeIndex + 1);
    else if (dy > threshold && activeIndex > 0) animateTo(step, activeIndex - 1);
    else if (dy !== 0) {
      setIsBouncing(true);
      setOffsetY(0);
      setTimeout(() => setIsBouncing(false), 250);
    } else setOffsetY(0);
  }, [activeIndex, items.length, animateTo, containerHeight]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    if (e.touches.length >= 2) {
      isDragging.current = false;
      isVerticalSwipe.current = null;
      currentY.current = 0;
      setOffsetY(0);
      isPinching.current = true;
      return;
    }
    if (isPinching.current) return;
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    isDragging.current = true;
    isVerticalSwipe.current = null;
  }, [isAnimating]);

  // Throttle setOffsetY with requestAnimationFrame so we only update React
  // state once per frame instead of on every touchmove event.
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPinching.current) return;
    if (e.touches.length >= 2) {
      isDragging.current = false;
      isVerticalSwipe.current = null;
      currentY.current = 0;
      setOffsetY(0);
      isPinching.current = true;
      return;
    }
    if (!isDragging.current || isAnimating) return;
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isVerticalSwipe.current === null) {
      const detected = detectSwipeDirection(dx, dy);
      if (detected) isVerticalSwipe.current = detected === 'vertical';
      return;
    }
    if (!isVerticalSwipe.current) return;
    if (e.cancelable) e.preventDefault();

    let clamped = dy;
    if (activeIndex <= 0 && dy > 0) clamped = dy * RUBBERBAND_RESISTANCE;
    if (activeIndex >= items.length - 1 && dy < 0) clamped = dy * RUBBERBAND_RESISTANCE;

    if (Math.abs(dy) > SWIPE_DRAG_THRESHOLD) {
      currentY.current = clamped;
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = requestAnimationFrame(() => setOffsetY(clamped));
    }
  }, [isAnimating, activeIndex, items.length]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (isPinching.current) {
      if (e.touches.length === 0) isPinching.current = false;
      return;
    }
    if (e.touches.length > 0) {
      isDragging.current = false;
      isVerticalSwipe.current = null;
      currentY.current = 0;
      setOffsetY(0);
      return;
    }
    resolveSwipe();
  }, [resolveSwipe]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isAnimating) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentY.current = 0;
    isDragging.current = true;
    isVerticalSwipe.current = null;
  }, [isAnimating]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || isAnimating) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (isVerticalSwipe.current === null) {
      const detected = detectSwipeDirection(dx, dy);
      if (detected) isVerticalSwipe.current = detected === 'vertical';
      return;
    }
    if (!isVerticalSwipe.current) return;

    let clamped = dy;
    if (activeIndex <= 0 && dy > 0) clamped = dy * RUBBERBAND_RESISTANCE;
    if (activeIndex >= items.length - 1 && dy < 0) clamped = dy * RUBBERBAND_RESISTANCE;

    currentY.current = clamped;
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    dragRafRef.current = requestAnimationFrame(() => setOffsetY(clamped));
  }, [isAnimating, activeIndex, items.length]);

  const handleMouseUp = useCallback(() => resolveSwipe(), [resolveSwipe]);

  useEffect(() => () => {
    clearTimeout(swipeTimeoutRef.current);
    if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
  }, []);

  useEffect(() => {
    if (!isAnimating) setInternalIndex(activeIndex);
  }, [activeIndex, isAnimating]);

  const stepPx = containerHeight + gapPx.current;
  const translateY = `translateY(calc(${-internalIndex * stepPx}px + ${offsetY}px))`;

  return (
    <div
      ref={containerRef}
      className={`vswipe-container ${fitToContent ? 'vswipe-fit-content' : ''} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { isPinching.current = false; isDragging.current = false; isVerticalSwipe.current = null; setOffsetY(0); }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (isDragging.current) handleMouseUp(); }}
    >
      <div
        ref={trackRef}
        className={`vswipe-track ${isBouncing ? 'vswipe-track-bouncing' : isAnimating ? 'vswipe-track-animating' : ''}`}
        style={{ transform: translateY }}
      >
        {items.map((item, i) => {
          const isVisible = Math.abs(i - internalIndex) <= 1;
          return (
          <div key={item.key} className={`vswipe-panel ${panelClassName}`}>
            <div className={`vswipe-panel-content ${contentClassName}`}>
              {isVisible ? item.render() : null}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};
