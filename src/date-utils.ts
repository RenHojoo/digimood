const todayCache = { date: new Date(), ts: 0 };
const getToday = () => {
  const now = Date.now();
  if (now - todayCache.ts > 60000) {
    todayCache.date = new Date();
    todayCache.ts = now;
  }
  return todayCache.date;
};

const normalizeDate = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isFutureDate = (date: Date): boolean => normalizeDate(date).getTime() > normalizeDate(getToday()).getTime();

export const isCurrentMonth = (date: Date, ref: Date): boolean =>
  date.getMonth() === ref.getMonth() && date.getFullYear() === ref.getFullYear();

export const formatDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const parseDate = (str: string): Date => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const areSameDates = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isToday = (date: Date): boolean => areSameDates(date, getToday());

export const navigateDate = (date: Date, dir: number, view: 'day' | 'month' | 'year'): Date => {
  const d = new Date(date);
  if (view === 'year') d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  return d;
};

export const getMonthsInYear = (year: number): Date[] =>
  Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setFullYear(year, i, 1); return d; });

export const safeDate = (year: number, month: number, day: number): Date => {
  const d = new Date();
  d.setFullYear(year, month, day);
  return d;
};

export const getCalendarGrid = (date: Date): Date[] => {
  const y = date.getFullYear(), m = date.getMonth();
  const daysInMonth = safeDate(y, m + 1, 0).getDate();
  const firstDay = safeDate(y, m, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const prevDays = safeDate(y, m, 0).getDate();
  const result: Date[] = [];
  for (let i = offset - 1; i >= 0; i--) result.push(safeDate(y, m - 1, prevDays - i));
  for (let d = 1; d <= daysInMonth; d++) result.push(safeDate(y, m, d));
  for (let d = 1; result.length < 42; d++) result.push(safeDate(y, m + 1, d));
  return result;
};

export const formatDisplayDate = (date: Date): string =>
  `${date.toLocaleDateString(undefined, { month: 'long' }).toUpperCase()} ${date.getDate()} ${date.getFullYear()}, ${date.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}`;

export const getMoonPhase = (date: Date): number => {
  const SYNODIC = 29.53058867;
  const EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const phase = ((utc - EPOCH) / 86400000 % SYNODIC + SYNODIC) % SYNODIC / SYNODIC;
  const SNAP = 0.016;
  if (phase < SNAP || phase > 1 - SNAP) return 0;
  if (Math.abs(phase - 0.25) < SNAP) return 0.25;
  if (Math.abs(phase - 0.5) < SNAP) return 0.5;
  if (Math.abs(phase - 0.75) < SNAP) return 0.75;
  return phase;
};
