import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Settings } from './types';
import { computeGradientStops, buildCalendarPickerIcon, rgbStringToHex, hexToRgba, computeShade } from './utils';
import { fontCss } from './types';

export const usePersistentStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (!item) return initialValue;
      const parsed = JSON.parse(item);
      if (Array.isArray(initialValue) && Array.isArray(parsed)) return parsed;
      if (typeof initialValue === 'object' && parsed && typeof parsed === 'object') return { ...initialValue, ...parsed };
      return parsed;
    } catch {
      localStorage.removeItem(key);
      return initialValue;
    }
  });

  const valueRef = useRef(storedValue);
  valueRef.current = storedValue;

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    const newValue = typeof value === 'function' ? (value as (prev: T) => T)(valueRef.current) : value;
    setStoredValue(newValue);
    valueRef.current = newValue;
    clearTimeout(timeoutRef.current!);
    timeoutRef.current = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(newValue)); } catch {}
    }, 100);
  }, [key]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  return [storedValue, setValue];
};

export const useUndoRedo = <T,>(maxHistory = 500) => {
  const historyRef = useRef<T[]>([]);
  const indexRef = useRef(-1);
  const suppressCountRef = useRef(0);
  const [updateCount, forceUpdate] = useState(0);

  const initHistory = useCallback((initial: T) => {
    historyRef.current = [initial];
    indexRef.current = 0;
    suppressCountRef.current = 0;
    forceUpdate(n => n + 1);
  }, []);

  const addToHistory = useCallback((state: T) => {
    if (suppressCountRef.current > 0) { suppressCountRef.current--; return; }
    const history = historyRef.current;
    const idx = indexRef.current;
    if (idx >= 0 && JSON.stringify(history[idx]) === JSON.stringify(state)) return;
    const newHistory = history.slice(0, idx + 1);
    newHistory.push(state);
    if (newHistory.length > maxHistory) newHistory.shift();
    indexRef.current = newHistory.length - 1;
    historyRef.current = newHistory;
    forceUpdate(n => n + 1);
  }, [maxHistory]);

  const undo = useCallback((): T | null => {
    if (indexRef.current > 0) {
      indexRef.current--;
      suppressCountRef.current = 1;
      forceUpdate(n => n + 1);
      return historyRef.current[indexRef.current];
    }
    return null;
  }, []);

  const redo = useCallback((): T | null => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current++;
      suppressCountRef.current = 1;
      forceUpdate(n => n + 1);
      return historyRef.current[indexRef.current];
    }
    return null;
  }, []);

  return useMemo(() => ({
    initHistory, addToHistory, undo, redo,
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1
  }), [initHistory, addToHistory, undo, redo, updateCount]);
};

export const useStatusMessage = () => {
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const showMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(timeoutRef.current!);
    setStatusMessage({ text: message, type });
    timeoutRef.current = setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current!), []);
  return { statusMessage, showMessage };
};

export const useApplyTheme = (settings: Settings) => {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const { customColors } = settings;

    root.style.setProperty('--c-base', customColors.base);
    root.style.setProperty('--c-base-dark', computeShade(customColors.base, -0.35));
    root.style.setProperty('--c-base-light', computeShade(customColors.base, 0.25));
    root.style.setProperty('--c-accent', customColors.accent);
    root.style.setProperty('--c-text', customColors.text);
    root.style.setProperty('--calendar-icon-svg', buildCalendarPickerIcon(customColors.text));

    // Adjusted base color with opacity (for surfaces), modals stay opaque
    const opacity = settings.baseOpacity ?? 1;
    root.style.setProperty('--c-base-adj', hexToRgba(customColors.base, opacity));

    // Font family + scale
    root.style.setProperty('--app-font', fontCss(settings.fontFamily));
    root.style.setProperty('--app-font-scale', String(settings.fontScale ?? 1));

    const base = settings.backgroundColor && !settings.backgroundImage ? settings.backgroundColor : customColors.base;
    const g = computeGradientStops(base);
    root.style.setProperty('--g-from', g.from);
    root.style.setProperty('--g-via', g.via);
    root.style.setProperty('--g-to', g.to);

    if (settings.backgroundImage) {
      body.style.setProperty('background-image', `url(${settings.backgroundImage})`, 'important');
      body.style.setProperty('background-size', 'cover', 'important');
      body.style.setProperty('background-position', 'center', 'important');
      body.style.setProperty('background-attachment', 'fixed', 'important');
    } else {
      body.style.removeProperty('background-image');
      body.style.removeProperty('background-size');
      body.style.removeProperty('background-position');
      body.style.removeProperty('background-attachment');
    }
  }, [settings]);
};

const SWIPE_DEADZONE = 8;

const detectSwipeDirection = (dx: number, dy: number): 'horizontal' | 'vertical' | null =>
  Math.abs(dx) <= SWIPE_DEADZONE && Math.abs(dy) <= SWIPE_DEADZONE
    ? null
    : Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';

export function useHorizontalSwipe(options: { threshold?: number; onSwipe: (direction: 'forward' | 'backward') => void }) {
  const { threshold = 60, onSwipe } = options;
  const stateRef = useRef({ startX: 0, startY: 0, isDragging: false, isLocked: null as 'horizontal' | 'vertical' | null, lastOffset: 0 });

  const begin = (clientX: number, clientY: number) => {
    stateRef.current.startX = clientX;
    stateRef.current.startY = clientY;
    stateRef.current.isDragging = false;
    stateRef.current.isLocked = null;
    stateRef.current.lastOffset = 0;
  };

  const move = (clientX: number, clientY: number): number | null => {
    const s = stateRef.current;
    const dx = clientX - s.startX;
    if (s.isLocked === null && (Math.abs(dx) > SWIPE_DEADZONE || Math.abs(clientY - s.startY) > SWIPE_DEADZONE)) {
      s.isLocked = detectSwipeDirection(dx, clientY - s.startY);
    }
    if (s.isLocked === 'horizontal') {
      s.isDragging = true;
      s.lastOffset = dx;
      return dx;
    }
    return null;
  };

  const end = (): { didSwipe: boolean; offset: number } => {
    const s = stateRef.current;
    if (!s.isDragging || s.isLocked !== 'horizontal') {
      s.isDragging = false;
      return { didSwipe: false, offset: 0 };
    }
    const offset = s.lastOffset;
    s.isDragging = false;
    if (Math.abs(offset) > threshold) {
      onSwipe(offset < 0 ? 'forward' : 'backward');
      return { didSwipe: true, offset: 0 };
    }
    return { didSwipe: false, offset: 0 };
  };

  return { begin, move, end, isDragging: stateRef };
}

export { detectSwipeDirection };

export function useRichTextEditor(
  contentRef: React.RefObject<HTMLDivElement>,
  onContentChange: (text: string) => void,
  extractHTML: (element: HTMLElement) => string,
  isOpen: boolean = true,
) {
  const savedSelectionRef = useRef<Range | null>(null);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false });
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<string | null>(null);

  const detectMoodFromNode = useCallback((anchorNode: Node | null): string | null => {
    const el = contentRef.current;
    if (!anchorNode || !el) return null;
    let cur: Node | null = anchorNode;
    while (cur && cur !== el) {
      if (cur.nodeType === Node.ELEMENT_NODE) {
        const e = cur as HTMLElement;
        const mood = e.getAttribute('data-mood');
        if (mood && mood !== 'null') return mood;
      }
      cur = cur.parentNode;
    }
    return null;
  }, [contentRef]);

  const detectColorFromNode = useCallback((anchorNode: Node | null): string | null => {
    const el = contentRef.current;
    if (!anchorNode || !el) return null;
    let cur: Node | null = anchorNode;
    while (cur && cur !== el) {
      if (cur.nodeType === Node.ELEMENT_NODE) {
        const e = cur as HTMLElement;
        const tag = e.tagName?.toLowerCase();
        if ((tag === 'span' || tag === 'font') && (e.style.color || e.getAttribute('color'))) {
          const raw = e.style.color || e.getAttribute('color') || '';
          return raw.startsWith('#') ? raw : rgbStringToHex(raw);
        }
      }
      cur = cur.parentNode;
    }
    return null;
  }, [contentRef]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedSelectionRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  }, [contentRef]);

  const updateActiveFormats = useCallback((forceClear = false) => {
    if (forceClear) {
      setActiveFormats({ bold: false, italic: false, underline: false });
      setActiveColor(null);
      setActiveMood(null);
      return;
    }
    const el = contentRef.current;
    if (!el || (!el.contains(document.activeElement) && document.activeElement !== el)) return;
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline')
      });
    } catch {
      const sel = window.getSelection();
      if (!sel) return;
      const f = { bold: false, italic: false, underline: false };
      let node: Node | null = sel.anchorNode;
      while (node && node !== el) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const t = (node as HTMLElement).tagName?.toLowerCase();
          if (t === 'b' || t === 'strong') f.bold = true;
          if (t === 'i' || t === 'em') f.italic = true;
          if (t === 'u') f.underline = true;
        }
        node = node.parentNode;
      }
      setActiveFormats(f);
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setActiveColor(detectColorFromNode(sel.anchorNode));
      setActiveMood(detectMoodFromNode(sel.anchorNode));
    }
  }, [contentRef, detectColorFromNode, detectMoodFromNode]);

  const suppressSelChangeRef = useRef(false);

  const applyFormatting = useCallback((command: 'bold' | 'italic' | 'underline') => {
    const el = contentRef.current;
    if (!el) return;
    if (document.activeElement !== el) el.focus();
    restoreSelection();
    suppressSelChangeRef.current = true;
    try {
      const sel = window.getSelection();
      const collapsedBefore = !sel || sel.rangeCount === 0 || sel.getRangeAt(0).collapsed;
      document.execCommand(command, false, undefined);
      onContentChange(extractHTML(el));
      saveSelection();
      if (collapsedBefore) {
        setActiveFormats(prev => ({ ...prev, [command]: !prev[command] }));
      } else {
        updateActiveFormats();
      }
    } catch {}
    setTimeout(() => { suppressSelChangeRef.current = false; }, 50);
  }, [restoreSelection, saveSelection, updateActiveFormats, onContentChange, extractHTML]);

  const applyColor = useCallback((color: string | null, moodName?: string, removeFakeHighlight?: () => void) => {
    const el = contentRef.current;
    if (!el) return;
    if (removeFakeHighlight) removeFakeHighlight();
    el.focus();
    const sel = window.getSelection();
    if (savedSelectionRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
    if (!sel || sel.rangeCount === 0) return;

    if (color === null) {
      try { document.execCommand('removeFormat', false); } catch {}
      setActiveColor(null);
      setActiveMood(null);
    } else {
      try {
        document.execCommand('foreColor', false, color);
      } catch {
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        span.style.color = color;
        if (moodName) span.setAttribute('data-mood', moodName);
        try { range.surroundContents(span); }
        catch {
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
        }
      }
      if (moodName) {
        const cs = window.getSelection();
        if (cs && cs.rangeCount > 0) {
          let node: Node | null = cs.anchorNode;
          while (node && node !== el) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const e = node as HTMLElement;
              const tag = e.tagName?.toLowerCase();
              if ((tag === 'span' || tag === 'font') && (e.style.color || e.getAttribute('color'))) {
                e.setAttribute('data-mood', moodName);
                break;
              }
            }
            node = node.parentNode;
          }
        }
      }
      setActiveColor(color);
      setActiveMood(moodName || null);
    }
    const ns = window.getSelection();
    if (ns && ns.rangeCount > 0) savedSelectionRef.current = ns.getRangeAt(0).cloneRange();
    onContentChange(extractHTML(el));
  }, [onContentChange, extractHTML]);

  useEffect(() => {
    if (!isOpen) return;
    const onSelChange = () => {
      if (suppressSelChangeRef.current) return;
      const el = contentRef.current;
      if (!el || (!el.contains(document.activeElement) && document.activeElement !== el)) return;
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
        setActiveColor(detectColorFromNode(sel.anchorNode));
        setActiveMood(detectMoodFromNode(sel.anchorNode));
      }
      try {
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline')
        });
      } catch {}
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [contentRef, detectColorFromNode, isOpen]);

  return {
    savedSelectionRef,
    activeFormats,
    activeColor,
    activeMood,
    setActiveColor,
    saveSelection,
    restoreSelection,
    updateActiveFormats,
    applyFormatting,
    applyColor
  };
}
