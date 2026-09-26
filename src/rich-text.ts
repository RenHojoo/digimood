import React from 'react';
import type { Settings, MoodColor } from './types';
import { DEFAULT_SETTINGS } from './types';
import { rgbStringToHex } from './color-utils';

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'BR', 'DIV']);

function extractColorFromElement(el: HTMLElement): string | null {
  const styleColor = el.getAttribute('style');
  if (styleColor) {
    const m = styleColor.match(/color\s*:\s*([^;]+)/i);
    if (m) {
      const c = m[1].trim();
      return c === 'null' ? null : c;
    }
  }
  const attrColor = el.getAttribute('color');
  if (attrColor && attrColor !== 'null') return attrColor.trim();
  return null;
}

function sanitizeNode(node: HTMLElement): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      node.removeChild(child);
      continue;
    }
    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();

    // Convert <font color="..."> to <span style="color:..."> before sanitization
    if (tag === 'FONT') {
      const color = extractColorFromElement(el);
      const mood = el.getAttribute('data-mood');
      const span = document.createElement('span');
      if (color) span.style.color = color;
      if (mood) span.setAttribute('data-mood', mood);
      while (el.firstChild) span.appendChild(el.firstChild);
      node.replaceChild(span, el);
      sanitizeNode(span);
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      while (el.firstChild) node.insertBefore(el.firstChild, el);
      node.removeChild(el);
      continue;
    }

    if (tag === 'SPAN') {
      const color = extractColorFromElement(el);
      const moodAttr = el.getAttribute('data-mood');
      const mood = moodAttr && moodAttr !== 'null' ? moodAttr : null;
      while (el.attributes.length > 0) el.removeAttribute(el.attributes[0].name);
      if (color) el.style.color = color;
      if (mood) el.setAttribute('data-mood', mood);
    } else {
      while (el.attributes.length > 0) el.removeAttribute(el.attributes[0].name);
    }

    sanitizeNode(el);
  }
}

function parseHTML(html: string): HTMLDivElement {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  sanitizeNode(tmp);
  return tmp;
}

export function extractHTML(element: HTMLElement): string {
  return parseHTML(element.innerHTML).innerHTML;
}

const COLOR_TAG_RE = /<color="(#[0-9a-fA-F]{3,8}|[a-z]+)">/g;

export function convertColorTags(html: string): string {
  if (!html) return '';
  return html
    .replace(COLOR_TAG_RE, (_m, c: string) => {
      if (!c || c === 'null') return '<span>';
      if (c.startsWith('#')) return `<span style="color:${c}">`;
      const moodColor = DEFAULT_SETTINGS.customColors.moods[c as MoodColor];
      if (moodColor) return `<span style="color:${moodColor}" data-mood="${c}">`;
      return `<span style="color:${c}">`;
    })
    .replace(/<\/color>/g, '</span>')
    .replace(/\n/g, '<br>');
}

export function normalizeHTML(html: string): string {
  if (!html) return '';
  const tmp = parseHTML(html);

  const empties = tmp.querySelectorAll('b:empty, i:empty, u:empty, span:empty');
  empties.forEach((e) => e.remove());

  tmp.querySelectorAll('div').forEach((div) => {
    const br = document.createElement('br');
    div.replaceWith(br);
  });

  return tmp.innerHTML;
}

const getTagStyles = (el: HTMLElement): React.CSSProperties => {
  const styles: React.CSSProperties = {};
  const tag = el.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') styles.fontWeight = 'bold';
  if (tag === 'i' || tag === 'em') styles.fontStyle = 'italic';
  if (tag === 'u') styles.textDecoration = 'underline';
  return styles;
};

const getColorFromElement = (el: HTMLElement): string | null => {
  const rawColor = el.style.color;
  if (!rawColor || rawColor === 'null') return null;
  return rgbStringToHex(rawColor);
};

const resolveColor = (el: HTMLElement, settings?: Settings): string | null => {
  const moodName = el.getAttribute('data-mood');
  if (moodName && moodName !== 'null' && settings && settings.customColors.moods[moodName as MoodColor]) {
    return settings.customColors.moods[moodName as MoodColor];
  }
  return getColorFromElement(el);
};

const segmentCache = new Map<string, React.ReactNode[]>();
const MAX_CACHE_SIZE = 500;

interface TextSegment {
  text: string;
  style: React.CSSProperties;
}

function collectLineSegments(
  node: Node,
  style: React.CSSProperties,
  lines: TextSegment[][],
  settings?: Settings
): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text) lines[lines.length - 1].push({ text, style });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        lines.push([]);
        continue;
      }

      let childStyle = { ...style, ...getTagStyles(el) };
      if (tag === 'span') {
        const color = resolveColor(el, settings);
        if (color) childStyle = { ...childStyle, color };
      }

      collectLineSegments(el, childStyle, lines, settings);
    }
  }
}

function renderHTMLToNodes(
  html: string,
  settings?: Settings,
  transformText?: (text: string) => React.ReactNode,
  compactBreaks = false
): React.ReactNode[] {
  const tmp = parseHTML(html);

  if (compactBreaks) {
    const lines: TextSegment[][] = [[]];
    collectLineSegments(tmp, {}, lines, settings);

    return lines.map((segments, lineIdx) => {
      const isEmpty = segments.length === 0;
      const children = segments.map((seg, segIdx) => {
        const content = transformText ? transformText(seg.text) : seg.text;
        return React.createElement('span', { key: `seg-${segIdx}`, style: seg.style }, content);
      });
      return React.createElement('div', {
        key: `line-${lineIdx}`,
        style: {
          lineHeight: isEmpty ? 0.6 : 1.625,
          marginBottom: lineIdx < lines.length - 1 ? (isEmpty ? '0.1em' : '0.15em') : undefined,
        },
      }, children);
    });
  }

  const processChildren = (
    node: Node,
    parentStyle: React.CSSProperties,
    parentKey: string,
    settings?: Settings
  ): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let childKey = 0;

    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || '';
        if (!text) continue;
        const content = transformText ? transformText(text) : text;
        result.push(
          React.createElement('span', { key: `${parentKey}-${childKey++}`, style: parentStyle }, content)
        );
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        let style = { ...parentStyle, ...getTagStyles(el) };

        if (tag === 'span') {
          const color = resolveColor(el, settings);
          if (color) style = { ...style, color };
        }

        if (tag === 'br') {
          result.push(React.createElement('br', { key: `${parentKey}-${childKey++}` }));
          continue;
        }

        const childNodes = processChildren(el, style, `${parentKey}-${childKey}`, settings);
        result.push(
          React.createElement(React.Fragment, { key: `${parentKey}-${childKey++}` }, childNodes)
        );
      }
    }
    return result;
  };

  return processChildren(tmp, {}, 'root', settings);
}

export function applyMoodColors(html: string, settings: Settings): string {
  if (!html) return '';
  const tmp = parseHTML(html);
  tmp.querySelectorAll('span[data-mood]').forEach(span => {
    const mood = span.getAttribute('data-mood');
    if (mood && mood !== 'null' && settings.customColors.moods[mood as MoodColor]) {
      span.style.color = settings.customColors.moods[mood as MoodColor];
    }
  });
  return tmp.innerHTML;
}

export const renderDiaryContent = (
  diary: string,
  settings?: Settings,
  transformText?: (text: string) => React.ReactNode,
  cacheKeySuffix?: string,
  compactBreaks = false
): React.ReactNode => {
  if (!diary) return null;

  const moodColorKey = settings ? Object.values(settings.customColors.moods).join(',') : '';
  const cacheKey = diary + moodColorKey + (cacheKeySuffix ? `|${cacheKeySuffix}` : transformText ? '|transform' : '') + (compactBreaks ? '|cb' : '');

  const cached = segmentCache.get(cacheKey);
  if (cached) return cached;

  const nodes = renderHTMLToNodes(diary, settings, transformText, compactBreaks);

  while (segmentCache.size >= MAX_CACHE_SIZE) {
    const firstKey = segmentCache.keys().next().value;
    if (firstKey) segmentCache.delete(firstKey);
  }
  segmentCache.set(cacheKey, nodes);
  return nodes;
};

const HIGHLIGHT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--color-accent, #fbbf24)',
  color: '#000',
  padding: '0',
  borderRadius: '0',
};

interface StyledSegment {
  text: string;
  style: React.CSSProperties;
  start: number;
}

function collectStyledSegments(
  node: Node,
  style: React.CSSProperties,
  segments: StyledSegment[],
  offset: { pos: number },
  settings?: Settings
): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (text) {
        segments.push({ text, style, start: offset.pos });
        offset.pos += text.length;
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        segments.push({ text: '\n', style, start: offset.pos });
        offset.pos += 1;
        continue;
      }

      let childStyle = { ...style, ...getTagStyles(el) };
      if (tag === 'span') {
        const color = resolveColor(el, settings);
        if (color) childStyle = { ...childStyle, color };
      }

      collectStyledSegments(el, childStyle, segments, offset, settings);
    }
  }
}

export const renderSearchExcerpt = (
  diary: string,
  searchTerm: string,
  settings?: Settings,
  contextBefore = 100,
  contextAfter = 120
): React.ReactNode => {
  const term = searchTerm.toLowerCase();
  if (!term) return renderDiaryContent(diary, settings);

  const tmp = parseHTML(diary);
  const segments: StyledSegment[] = [];
  collectStyledSegments(tmp, {}, segments, { pos: 0 }, settings);
  const plainText = segments.map(s => s.text).join('');
  const matchIndex = plainText.toLowerCase().indexOf(term);
  if (matchIndex === -1) return renderDiaryContent(diary, settings, undefined, 'nosearch');

  const excerptStart = Math.max(0, matchIndex - contextBefore);
  const excerptEnd = Math.min(plainText.length, matchIndex + term.length + contextAfter);
  const prefix = excerptStart > 0 ? '\u2026' : '';
  const suffix = excerptEnd < plainText.length ? '\u2026' : '';

  const nodes: React.ReactNode[] = [];
  if (prefix) nodes.push(prefix);

  let partKey = 0;
  let cursor = excerptStart;

  for (const seg of segments) {
    const segEnd = seg.start + seg.text.length;
    if (segEnd <= excerptStart || seg.start >= excerptEnd) continue;

    const overlapStart = Math.max(seg.start, excerptStart);
    const overlapEnd = Math.min(segEnd, excerptEnd);
    const segSlice = seg.text.substring(overlapStart - seg.start, overlapEnd - seg.start);
    if (!segSlice) continue;

    const relEnd = cursor + segSlice.length;
    const lowerSlice = segSlice.toLowerCase();
    let lastIdx = 0;
    let searchIdx = lowerSlice.indexOf(term);

    if (searchIdx === -1) {
      nodes.push(
        React.createElement('span', { key: `seg-${partKey++}`, style: seg.style }, segSlice)
      );
    } else {
      while (searchIdx !== -1) {
        if (searchIdx > lastIdx) {
          nodes.push(
            React.createElement('span', { key: `seg-${partKey++}`, style: seg.style }, segSlice.substring(lastIdx, searchIdx))
          );
        }
        nodes.push(
          React.createElement(
            'mark',
            { key: `hl-${partKey++}`, style: HIGHLIGHT_STYLE },
            segSlice.substring(searchIdx, searchIdx + term.length)
          )
        );
        lastIdx = searchIdx + term.length;
        searchIdx = lowerSlice.indexOf(term, lastIdx);
      }
      if (lastIdx < segSlice.length) {
        nodes.push(
          React.createElement('span', { key: `seg-${partKey++}`, style: seg.style }, segSlice.substring(lastIdx))
        );
      }
    }

    cursor = relEnd;
  }

  if (suffix) nodes.push(suffix);
  return nodes;
};

export const htmlToExportFormat = (html: string): string => {
  if (!html) return '';
  const tmp = parseHTML(html);

  const traverse = (node: Node): string => {
    let result = '';
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'b' || tag === 'strong') {
      result += '<b>';
      for (const child of Array.from(node.childNodes)) result += traverse(child);
      result += '</b>';
    } else if (tag === 'i' || tag === 'em') {
      result += '<i>';
      for (const child of Array.from(node.childNodes)) result += traverse(child);
      result += '</i>';
    } else if (tag === 'u') {
      result += '<u>';
      for (const child of Array.from(node.childNodes)) result += traverse(child);
      result += '</u>';
    } else if (tag === 'span') {
      const color = getColorFromElement(el);
      const moodName = el.getAttribute('data-mood');
      const colorValue = (moodName && moodName !== 'null') ? moodName : color;
      if (colorValue) {
        result += `<color="${colorValue}">`;
        for (const child of Array.from(node.childNodes)) result += traverse(child);
        result += '</color>';
      } else {
        for (const child of Array.from(node.childNodes)) result += traverse(child);
      }
    } else if (tag === 'br') {
      result += '\n';
    } else {
      for (const child of Array.from(node.childNodes)) result += traverse(child);
    }
    return result;
  }

  let result = '';
  for (const child of Array.from(tmp.childNodes)) result += traverse(child);
  return result;
};
