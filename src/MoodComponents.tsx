import { useId, memo, CSSProperties, KeyboardEvent } from 'react';
import { MoodColor, Settings, MOOD_COLORS } from './types';
import type { MoodShape as MoodShapeType } from './types';
import { getMoonPhase, isFutureDate } from './utils';

const MOOD_SHAPE_PATHS: Record<MoodShapeType, string> = {
  orb: 'M 100 50 A 50 50 0 0 1 50 100 A 50 50 0 0 1 0 50 A 50 50 0 0 1 50 0 A 50 50 0 0 1 100 50',
  petal: 'M 50 0 L 85 0 L 85 14 L 100 14 L 100 50 A 50 50 0 0 1 50 100 L 0 100 L 0 50 A 50 50 0 0 1 50 0',
  strawberry: 'M 100 50 L 100 80 A 20 20 0 0 1 80 100 L 50 100 A 50 50 0 0 1 0 50 C -3 55 -15 46 2 35 C -20 30 0 15 13 16 L 0 5 A 2 2 0 0 1 5 0 L 16 13 C 15 0 30 -20 35 2 C 46 -15 55 -3 50 0 A 50 50 0 0 1 100 50',
};

const MOON_SEGMENTS = 32;
const moonPathCache = new Map<number, string>();

function buildLitPath(phase: number): string {
  const cached = moonPathCache.get(phase);
  if (cached) return cached;

  const cosVal = Math.cos(phase * 2 * Math.PI);
  const absCos = Math.abs(cosVal);
  const mapped = 1 - Math.sqrt(1 - absCos);
  const rx = mapped * 50;
  const points: string[] = [];
  const isWaxing = phase < 0.5;
  const isCrescent = cosVal > 0;

  if (isWaxing) {
    for (let i = 0; i <= MOON_SEGMENTS; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / MOON_SEGMENTS;
      points.push(`${(50 + 50 * Math.cos(t)).toFixed(2)},${(50 + 50 * Math.sin(t)).toFixed(2)}`);
    }
    if (isCrescent) {
      for (let i = MOON_SEGMENTS; i >= 0; i--) {
        const t = -Math.PI / 2 + (Math.PI * i) / MOON_SEGMENTS;
        points.push(`${(50 + rx * Math.cos(t)).toFixed(2)},${(50 + 50 * Math.sin(t)).toFixed(2)}`);
      }
    } else {
      for (let i = MOON_SEGMENTS; i >= 0; i--) {
        const t = -Math.PI / 2 + (Math.PI * i) / MOON_SEGMENTS;
        points.push(`${(50 - rx * Math.cos(t)).toFixed(2)},${(50 + 50 * Math.sin(t)).toFixed(2)}`);
      }
    }
  } else {
    for (let i = 0; i <= MOON_SEGMENTS; i++) {
      const t = -Math.PI / 2 - (Math.PI * i) / MOON_SEGMENTS;
      points.push(`${(50 + 50 * Math.cos(t)).toFixed(2)},${(50 + 50 * Math.sin(t)).toFixed(2)}`);
    }
    if (isCrescent) {
      for (let i = 0; i <= MOON_SEGMENTS; i++) {
        const t = Math.PI / 2 + (Math.PI * i) / MOON_SEGMENTS;
        points.push(`${(50 + rx * Math.cos(t)).toFixed(2)},${(50 + 50 * Math.sin(t)).toFixed(2)}`);
      }
    } else {
      for (let i = 0; i <= MOON_SEGMENTS; i++) {
        const t = Math.PI / 2 + (Math.PI * i) / MOON_SEGMENTS;
        points.push(`${(50 - rx * Math.cos(t)).toFixed(2)},${(50 + 50 * Math.sin(t)).toFixed(2)}`);
      }
    }
  }
  const path = `M${points[0]} L${points.slice(1).join(' ')} Z`;
  moonPathCache.set(phase, path);
  return path;
}

const MoonPhaseSVG = memo<{ phase: number; brightness: number; uid: string }>(({ phase, brightness, uid }) => {
  const absB = Math.min(Math.abs(brightness), 2);
  const opacity = absB * 0.4;
  const litOpacity = brightness > 0 ? opacity : 0;
  const darkOpacity = brightness < 0 ? opacity : 0;

  const litPath = buildLitPath(phase);

  if (phase === 0.5) return <circle cx="50" cy="50" r="50" fill={`rgba(255,255,255,${litOpacity})`} style={{ mixBlendMode: 'overlay' }} />;

  const maskId = `moon-lit-${uid}`;
  const darkMaskId = `moon-dark-${uid}`;

  return (
    <>
      <defs>
        <mask id={maskId}><rect x="0" y="0" width="100" height="100" fill="black" /><path d={litPath} fill="white" /></mask>
        <mask id={darkMaskId}><rect x="0" y="0" width="100" height="100" fill="white" /><path d={litPath} fill="black" /></mask>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`rgba(0,0,0,${darkOpacity})`} mask={`url(#${darkMaskId})`} style={{ mixBlendMode: 'overlay' }} />
      <circle cx="50" cy="50" r="50" fill={`rgba(255,255,255,${litOpacity})`} mask={`url(#${maskId})`} style={{ mixBlendMode: 'overlay' }} />
    </>
  );
});

const SHAPE_TRANSFORM_STYLE: CSSProperties = { transformOrigin: '50px 50px' };

export const MoodShape = memo<{
  date: Date;
  mood: MoodColor;
  settings: Settings;
  className?: string;
  style?: CSSProperties;
  selectedBorder?: string;
  outline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  previewMoonPhase?: number;
}>(({ date, mood, settings, className = '', style: extraStyle, selectedBorder, outline, size = 'lg', previewMoonPhase }) => {
  const isFuture = isFutureDate(date);
  const moodColor = settings.customColors.moods[mood];
  const moonEnabled = settings.moonPhaseBrightness !== 0;
  const moonPhase = (moonEnabled || previewMoonPhase !== undefined)
    ? (previewMoonPhase !== undefined ? previewMoonPhase : getMoonPhase(date))
    : 0;

  const shapePath = MOOD_SHAPE_PATHS[settings.moodShape];

  const uid = useId();

  const showMoon = moonPhase !== 0 && settings.moonPhaseBrightness !== 0;
  const containerStyle: CSSProperties = { position: 'relative', ...extraStyle };

  const hollowStrokeWidth = size === 'sm' ? 14 : size === 'md' ? 8 : 5;
  const ringStrokeWidth = 4;
  const hollowScale = (50 - hollowStrokeWidth / 2) / 50;

  const isHollow = isFuture;
  const shapeScale = isHollow ? hollowScale : 1;
  const showRing = !!(selectedBorder || outline);
  const ringColor = selectedBorder ? settings.customColors.text : 'var(--tint-border-strong)';

  const clipId = `shape-clip-${uid}`;
  const moonClipId = `moon-clip-${uid}`;

  return (
    <div className={`mood-shape ${className}`} style={containerStyle}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: 'block', overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
        {showMoon && (
          <defs>
            <clipPath id={clipId}><path d={shapePath} /></clipPath>
            {shapeScale !== 1 && (
              <clipPath id={moonClipId}><path d={shapePath} style={SHAPE_TRANSFORM_STYLE} transform={`scale(${shapeScale.toFixed(4)})`} /></clipPath>
            )}
          </defs>
        )}
        <path d={shapePath} fill={isHollow ? 'transparent' : moodColor} />
        {showMoon && (
          <g clipPath={`url(#${shapeScale !== 1 ? moonClipId : clipId})`}>
            <MoonPhaseSVG phase={moonPhase} brightness={settings.moonPhaseBrightness} uid={`${uid}-moon`} />
          </g>
        )}
        {isHollow && (
          <path d={shapePath} fill="none" stroke={moodColor} strokeWidth={hollowStrokeWidth} style={SHAPE_TRANSFORM_STYLE} transform={`scale(${hollowScale.toFixed(4)})`} />
        )}
      </svg>
      {showRing && (
        <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
          <path d={shapePath} fill="none" stroke={ringColor} strokeWidth={ringStrokeWidth} style={SHAPE_TRANSFORM_STYLE} transform={`scale(${shapeScale.toFixed(4)})`} />
        </svg>
      )}
    </div>
  );
});

const PALETTE_BORDER = 'rgba(128,128,128,0.3)';
const PALETTE_BORDER_STYLE: CSSProperties = { borderColor: PALETTE_BORDER, borderWidth: 1 };

export const MoodPalette = memo<{
  moodColors: Record<MoodColor, string>;
  moodLabels: Record<MoodColor, string>;
  activeColor: string | null;
  activeMood?: string | null;
  onColorSelect: (color: string, moodName?: string) => void;
  onColorClear?: () => void;
}>(({ moodColors, moodLabels, activeColor, activeMood, onColorSelect, onColorClear }) => (
  <div className="p-2 rounded-lg shadow-lg flex items-center gap-1.5">
    {onColorClear && (
      <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={onColorClear} className="flex items-center justify-center rounded border transition-transform hover:scale-110" style={{ ...PALETTE_BORDER_STYLE, width: 28, height: 28, backgroundColor: 'var(--c-base)', flexShrink: 0 }} title="No Color" type="button">
        <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>&#x2715;</span>
      </button>
    )}
    {MOOD_COLORS.map(m => {
      const isActiveMood = activeMood === m;
      return (
        <button
          key={m}
          onMouseDown={e => e.preventDefault()}
          onTouchStart={e => e.preventDefault()}
          onClick={() => onColorSelect(moodColors[m], m)}
          className="rounded-full border transition-transform hover:scale-110"
          style={{
            ...PALETTE_BORDER_STYLE,
            width: 24,
            height: 24,
            backgroundColor: moodColors[m],
            flexShrink: 0,
            ...(isActiveMood ? { boxShadow: `0 0 0 2px var(--c-text)` } : {}),
          }}
          title={moodLabels[m]}
          type="button"
        />
      );
    })}
    <label className="rounded border flex-shrink-0 cursor-pointer hover:scale-110 transition-transform" style={{ ...PALETTE_BORDER_STYLE, width: 28, height: 28, backgroundColor: activeColor || 'var(--color-base-bg)', display: 'inline-block', position: 'relative', overflow: 'hidden' }} title="Custom Color" onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}>
      <input type="color" value={activeColor || '#000000'} onChange={e => onColorSelect(e.target.value)} className="color-input-overlay" />
    </label>
  </div>
));

export const MoodSelector = memo<{
  selectedMood: MoodColor;
  onMoodChange: (mood: MoodColor) => void;
  customLabels: Record<MoodColor, string>;
  date: Date;
  settings: Settings;
}>(({ selectedMood, onMoodChange, customLabels, date, settings }) => {
  const selectedIndex = MOOD_COLORS.indexOf(selectedMood);

  const getWrapperStyle = (index: number) => {
    const sel = index === selectedIndex;
    const distance = Math.abs(index - selectedIndex);
    if (!sel && distance <= 2) {
      const direction = index < selectedIndex ? -1 : 1;
      return { transform: `translateX(${direction * (distance === 1 ? 4 : 2)}px)`, zIndex: 1 };
    }
    return { transform: '', zIndex: sel ? 10 : 1 };
  };

  const handleKeyNav = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const idx = Math.max(0, Math.min(MOOD_COLORS.length - 1, selectedIndex + (e.key === 'ArrowLeft' ? -1 : 1)));
      onMoodChange(MOOD_COLORS[idx]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onMoodChange(selectedMood);
    }
  };

  return (
    <div className="grid-mood-selector gap-4 sm:gap-5 md:gap-6">
      {MOOD_COLORS.map((color, index) => {
        const sel = selectedMood === color;
        return (
          <button
            key={color}
            onClick={() => onMoodChange(color)}
            onKeyDown={handleKeyNav}
            className={`mood-selector-shape ${sel ? 'mood-selector-shape-selected' : 'mood-selector-shape-unselected'}`}
            style={getWrapperStyle(index)}
            aria-label={`Select ${customLabels[color]} mood`}
            aria-pressed={sel}
            tabIndex={sel ? 0 : -1}
            type="button"
          >
            <MoodShape date={date} mood={color} settings={settings} />
          </button>
        );
      })}
    </div>
  );
});
