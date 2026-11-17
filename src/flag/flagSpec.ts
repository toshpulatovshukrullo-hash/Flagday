/**
 * State Flag of the Republic of Uzbekistan — geometry from Law No. 407-XII
 * "On the State Flag of the Republic of Uzbekistan" (18 Nov 1991), article 4.
 * Units: centimetres on a 250 × 125 flag, origin top-left.
 *
 * The law does not name exact hues — swap FLAG_COLORS for an official palette here
 * (this is the ONLY place flag colours are defined).
 */
export const FLAG_COLORS = {
  blue: '#0099B5',
  white: '#FFFFFF',
  green: '#1EB53A',
  red: '#CE1126',
} as const;

export const FLAG_W_CM = 250;
export const FLAG_H_CM = 125;
export const FLAG_ASPECT = FLAG_W_CM / FLAG_H_CM; // exactly 2

/** Horizontal stripes, top → bottom (y0, y1 in cm). */
export const FLAG_STRIPES: ReadonlyArray<{ y0: number; y1: number; color: keyof typeof FLAG_COLORS }> = [
  { y0: 0, y1: 40, color: 'blue' },
  { y0: 40, y1: 42.5, color: 'red' },
  { y0: 42.5, y1: 82.5, color: 'white' },
  { y0: 82.5, y1: 85, color: 'red' },
  { y0: 85, y1: 125, color: 'green' },
];

/** Crescent = outer disc minus cut-out disc. Inner arc is a fixed approximation (not defined by law). */
export const CRESCENT = {
  outer: { cx: 35, cy: 20, r: 15 },
  cut: { cx: 40, cy: 20, r: 15 },
} as const;

/** 12 upright five-point stars, each inscribed in a circle of diameter 6, fly-justified. */
export const STAR_OUTER_R = 3;
export const STAR_INNER_R = 0.381966 * STAR_OUTER_R;
export const STAR_RIGHT_X = 92;
export const STAR_SPACING = 12;
export const STAR_ROWS: ReadonlyArray<{ y: number; count: number }> = [
  { y: 8, count: 3 },
  { y: 20, count: 4 },
  { y: 32, count: 5 },
];

export const starCenters = (): Array<{ x: number; y: number }> =>
  STAR_ROWS.flatMap((row) =>
    Array.from({ length: row.count }, (_, k) => ({ x: STAR_RIGHT_X - STAR_SPACING * k, y: row.y })),
  );
