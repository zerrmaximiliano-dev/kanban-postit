// src/modules/boards/domain/palette.ts
// Derives a Trello-like 3-tone palette (dark/medium/light) from a single base
// color: dark for the board title bar and sidebar, medium for column accents,
// light for the board background.

export interface BoardPalette {
  dark: string;
  medium: string;
  light: string;
}

const DEFAULT_BASE = '#5B6B8C';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBoardPalette(baseColor: string | null): BoardPalette {
  const { h, s } = hexToHsl(baseColor ?? DEFAULT_BASE);
  return {
    dark: hslToHex(h, clamp(s, 25, 60), 38),
    medium: hslToHex(h, clamp(s, 20, 55), 58),
    light: hslToHex(h, clamp(s, 15, 40), 95),
  };
}

export const BOARD_COLOR_PRESETS = [
  '#5B6B8C', // slate blue (default)
  '#2E7D5B', // green
  '#B5541E', // terracotta
  '#7C4FA0', // purple
  '#C0392B', // red
  '#1E6091', // ocean blue
];
