export const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

export const parseHexToRgb = (hex: string): [number, number, number] => {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

export const rgbStringToHex = (rgb: string): string => {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  return m ? rgbToHex(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])) : rgb;
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = parseHexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const computeShade = (hex: string, amount: number): string => {
  const [r0, g0, b0] = parseHexToRgb(hex);
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hsl_h = 0, hsl_s = 0;
  const hsl_l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    hsl_s = hsl_l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hsl_h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hsl_h = (b - r) / d + 2;
    else hsl_h = (r - g) / d + 4;
    hsl_h /= 6;
  }
  const absAmt = Math.abs(amount);
  const newL = amount < 0
    ? hsl_l * (1 + amount)
    : hsl_l + amount * (1 - hsl_l);
  const satMul = amount < 0 ? 1.3 : 1.0;
  const satBoost = absAmt * satMul;
  const newS = Math.min(1, hsl_s + satBoost * (1 - hsl_s));
  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
  const p = 2 * newL - q;
  const nr = Math.round(hueToRgb(p, q, hsl_h + 1/3) * 255);
  const ng = Math.round(hueToRgb(p, q, hsl_h) * 255);
  const nb = Math.round(hueToRgb(p, q, hsl_h - 1/3) * 255);
  return rgbToHex(nr, ng, nb);
};

export const computeGradientStops = (base: string) => {
  const [r, g, b] = parseHexToRgb(base);
  const darken = (v: number, a: number) => Math.max(0, Math.floor(v * (1 - a)));
  const lighten = (v: number, a: number) => Math.min(255, Math.floor(v + (255 - v) * a));
  const edge = rgbToHex(darken(r, .06), darken(g, .06), darken(b, .06));
  return {
    from: edge,
    via: rgbToHex(lighten(r, .02), lighten(g, .02), lighten(b, .02)),
    to: edge,
  };
};

export const buildCalendarPickerIcon = (color: string): string => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'></rect><line x1='16' y1='2' x2='16' y2='6'></line><line x1='8' y1='2' x2='8' y2='6'></line><line x1='3' y1='10' x2='21' y1='10'></line></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
