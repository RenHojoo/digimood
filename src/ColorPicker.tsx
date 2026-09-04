import { useRef, useCallback, useEffect } from 'react';
import { rgbToHex, parseHexToRgb } from './utils';

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function hsvToHex(h: number, s: number, v: number): string {
  return rgbToHex(...hsvToRgb(h, s, v));
}

function parseHexToHsv(hex: string): [number, number, number] {
  const h = (hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h) && !/^[0-9a-fA-F]{3}$/.test(h)) return [0, 0, 1];
  const [r0, g0, b0] = parseHexToRgb(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return [hue, max === 0 ? 0 : d / max, max];
}

export const ColorPicker: React.FC<{
  color: string;
  onChange: (hex: string) => void;
}> = ({ color, onChange }) => {
  const squareRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingSquare = useRef(false);
  const draggingSlider = useRef(false);
  const hsvRef = useRef<[number, number, number]>(parseHexToHsv(color));
  const lastColorRef = useRef<string>(color);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame>>();
  const pendingHexRef = useRef<string | null>(null);

  if (color !== lastColorRef.current) {
    hsvRef.current = parseHexToHsv(color);
    lastColorRef.current = color;
  }
  const [h, s, v] = hsvRef.current;

  const flushChange = useCallback(() => {
    rafRef.current = undefined;
    if (pendingHexRef.current !== null) {
      const hex = pendingHexRef.current;
      pendingHexRef.current = null;
      lastColorRef.current = hex;
      onChangeRef.current(hex);
    }
  }, []);

  const scheduleChange = useCallback((hex: string) => {
    pendingHexRef.current = hex;
    if (rafRef.current === undefined) {
      rafRef.current = requestAnimationFrame(flushChange);
    }
  }, [flushChange]);

  const updateFromSquare = useCallback((clientX: number, clientY: number) => {
    const el = squareRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const newS = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newV = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    hsvRef.current = [hsvRef.current[0], newS, newV];
    const hex = hsvToHex(hsvRef.current[0], newS, newV);
    scheduleChange(hex);
  }, [scheduleChange]);

  const updateFromSlider = useCallback((clientY: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const newH = Math.max(0, Math.min(360, ((clientY - rect.top) / rect.height) * 360));
    hsvRef.current = [newH, hsvRef.current[1], hsvRef.current[2]];
    const hex = hsvToHex(newH, hsvRef.current[1], hsvRef.current[2]);
    scheduleChange(hex);
  }, [scheduleChange]);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (draggingSquare.current) updateFromSquare(e.clientX, e.clientY);
      else if (draggingSlider.current) updateFromSlider(e.clientY);
    };
    const handleUp = () => {
      const wasDragging = draggingSquare.current || draggingSlider.current;
      draggingSquare.current = false;
      draggingSlider.current = false;
      if (wasDragging) {
        // Flush any pending change immediately on release
        if (rafRef.current !== undefined) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = undefined;
        }
        if (pendingHexRef.current !== null) {
          const hex = pendingHexRef.current;
          pendingHexRef.current = null;
          lastColorRef.current = hex;
          onChangeRef.current(hex);
        }
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [updateFromSquare, updateFromSlider]);

  const fullColor = hsvToHex(h, 1, 1);

  return (
    <div className="color-square-container">
      <div
        ref={squareRef}
        className="color-square"
        style={{
          backgroundColor: fullColor,
          backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          draggingSquare.current = true;
          updateFromSquare(e.clientX, e.clientY);
        }}
      >
        <div
          className="color-square-indicator"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, backgroundColor: color }}
        />
      </div>
      <div
        ref={sliderRef}
        className="color-hue-slider"
        onPointerDown={(e) => {
          e.preventDefault();
          draggingSlider.current = true;
          updateFromSlider(e.clientY);
        }}
      >
        <div
          className="color-hue-thumb"
          style={{ top: `${(h / 360) * 100}%` }}
        />
      </div>
    </div>
  );
};
