export interface MoodEntry {
  date: string; // YYYY-MM-DD
  mood: MoodColor;
  diary: string;
}

export type MoodColor = 'grey' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export type CalendarView = 'month' | 'year' | 'day';
export type MoodShape = 'orb' | 'petal' | 'strawberry';
export type FontFamily = 'system' | 'serif' | 'rounded' | 'mono';

export const FONT_OPTIONS: { value: FontFamily; label: string; css: string }[] = [
  { value: 'system', label: 'System', css: 'system-ui, -apple-system, sans-serif' },
  { value: 'rounded', label: 'Rounded', css: '"SF Pro Rounded", "Nunito", "Quicksand", system-ui, sans-serif' },
  { value: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: 'Mono', css: '"SF Mono", "Fira Code", "Cascadia Code", Menlo, monospace' },
];

export const fontCss = (f: FontFamily): string =>
  FONT_OPTIONS.find(o => o.value === f)?.css ?? FONT_OPTIONS[0].css;

export interface Settings {
  customColors: {
    base: string;
    accent: string;
    text: string;
    moods: Record<MoodColor, string>;
  };
  customLabels: Record<MoodColor, string>;
  backgroundImage?: string;
  backgroundColor?: string;
  isLightMode: boolean;
  moonPhaseBrightness: number;
  savedMoonPhaseBrightness: number;
  moodShape: MoodShape;
  fontFamily: FontFamily;
  fontScale: number;
  baseOpacity: number;
  dayViewPreviewLines: number;
}

export const MOOD_COLORS: readonly MoodColor[] = ['grey', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DEFAULT_SETTINGS: Settings = {
  customColors: {
    base: '#1e1e1e',
    accent: '#d66a8c',
    text: '#bababa',
    moods: {
      grey: '#3d3d3d',
      red: '#a63939',
      orange: '#c25e28',
      yellow: '#a98d00',
      green: '#5b7d2a',
      blue: '#2b748d',
      purple: '#764398',
    },
  },
  customLabels: {
    grey: 'No Mood', red: 'Terrible', orange: 'Bad', yellow: 'Okay', green: 'Good', blue: 'Great', purple: 'Amazing',
  },
  isLightMode: false,
  moonPhaseBrightness: 0,
  savedMoonPhaseBrightness: 0.15,
  moodShape: 'orb',
  fontFamily: 'system',
  fontScale: 15 / 14,
  baseOpacity: 1,
  dayViewPreviewLines: 6,
};

const THEME_COLOR_KEYS = ['base', 'accent', 'text', 'background'] as const;
type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export const isMoodColorKey = (key: string): key is MoodColor =>
  !THEME_COLOR_KEYS.includes(key as ThemeColorKey);

export const VIEW_ORDER: Array<CalendarView> = ['day', 'month', 'year'];

export const IMPORT_ENTRY_PATTERN = /^([⚪🔴🟠🟡🟢🔵🟣])\s+[A-Z]+\s+\d+\s+\d{4},\s+[A-Z]+$/iu;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
