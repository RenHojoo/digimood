import type { MoodEntry, Settings, MoodColor } from './types';
import { IMPORT_ENTRY_PATTERN, MONTH_NAMES } from './types';
import { parseDate, formatDate, formatDisplayDate } from './date-utils';
import { htmlToExportFormat, convertColorTags, normalizeHTML } from './rich-text';

const MOOD_EMOJIS: Record<string, string> = {
  grey: '⚪', red: '🔴', orange: '🟠', yellow: '🟡', green: '🟢', blue: '🔵', purple: '🟣',
};

const EMOJI_TO_MOOD: Record<string, MoodColor> = {
  '⚪': 'grey', '🔴': 'red', '🟠': 'orange', '🟡': 'yellow', '🟢': 'green', '🔵': 'blue', '🟣': 'purple',
};

export const sortEntriesByDate = (entries: MoodEntry[], asc = true): MoodEntry[] =>
  [...entries].sort((a, b) => {
    const d = parseDate(a.date).getTime() - parseDate(b.date).getTime();
    return asc ? d : -d;
  });

export const indexEntriesByDate = (entries: MoodEntry[]): Map<string, MoodEntry> => {
  const m = new Map<string, MoodEntry>();
  for (const e of entries) m.set(e.date, e);
  return m;
};

export const filterEntriesBySearch = (entries: MoodEntry[], query: string, settings: Settings): MoodEntry[] => {
  if (!query.trim()) return entries;
  const term = query.toLowerCase();
  return entries.filter(e => {
    const fd = formatDisplayDate(parseDate(e.date)).toLowerCase();
    const ml = settings.customLabels[e.mood].toLowerCase();
    return (e.diary || '').toLowerCase().includes(term) || fd.includes(term) || ml.includes(term);
  });
};

export const mergeImportedEntries = (existing: MoodEntry[], imported: MoodEntry[]): MoodEntry[] => {
  const dates = new Set(imported.map(e => e.date));
  return [...existing.filter(e => !dates.has(e.date)), ...imported];
};

export const compressImage = (file: File, maxW = 1920, maxH = 1080, quality = 0.85): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width: w, height: h } = img;
        if (w > maxW || h > maxH) {
          const r = w / h;
          if (w > h) { w = maxW; h = w / r; }
          else { h = maxH; w = h * r; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context failed')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

export const exportEntries = (entries: MoodEntry[]): string => {
  const nonEmpty = entries.filter(e => e.mood !== 'grey' || e.diary.trim());
  if (!nonEmpty.length) return 'No entries to export.';
  return sortEntriesByDate(nonEmpty, false).map(e =>
    `${MOOD_EMOJIS[e.mood]} ${formatDisplayDate(parseDate(e.date))}\n${htmlToExportFormat(e.diary || '')}`
  ).join('\n\n');
};

const getMonthIndex = (name: string): number => {
  const up = name.toUpperCase();
  const idx = MONTH_NAMES.findIndex(n => n.toUpperCase() === up);
  if (idx !== -1) return idx;
  for (let i = 0; i < 12; i++) {
    if (new Date(2024, i, 1).toLocaleDateString(undefined, { month: 'long' }).toUpperCase() === up) return i;
  }
  return -1;
};

export const importEntries = (content: string): MoodEntry[] => {
  if (!content?.trim()) throw new Error('File is empty or contains no valid data.');
  const entries: MoodEntry[] = [];
  const blocks: string[] = [];
  let cur = '';
  for (const line of content.trim().split('\n')) {
    const t = line.trim();
    const isNew = IMPORT_ENTRY_PATTERN.test(t);
    if (isNew && cur.trim()) { blocks.push(cur.trim()); cur = t; }
    else if (isNew) cur = t;
    else if (t || cur) { if (cur) cur += '\n'; cur += t; }
  }
  if (cur.trim()) blocks.push(cur.trim());
  for (const block of blocks) {
    const bl = block.split('\n');
    const first = bl[0];
    const diary = bl.length > 1 ? bl.slice(1).join('\n').trim() : '';
    const em = first.match(/^([⚪🔴🟠🟡🟢🔵🟣])\s+(.+)$/u);
    if (!em) continue;
    const mood = EMOJI_TO_MOOD[em[1]];
    if (!mood) continue;
    const dm = em[2].match(/^([A-Z]+)\s+(\d+)\s+(\d{4}),\s+[A-Z]+$/i);
    if (!dm) continue;
    const mi = getMonthIndex(dm[1]);
    if (mi === -1) continue;
    const d = new Date(parseInt(dm[3]), mi, parseInt(dm[2]));
    if (isNaN(d.getTime())) continue;
    entries.push({ date: formatDate(d), mood, diary: normalizeHTML(convertColorTags(diary)) });
  }
  if (!entries.length) throw new Error('No valid entries found in the file. Please check the format.');
  return entries;
};
