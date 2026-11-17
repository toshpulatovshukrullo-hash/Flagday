/** Global constants & text — everything derives from `year`. */
export const FPS = 30;
export const DURATION_FRAMES = 420; // 14.0 s
export const FLAG_LAW_YEAR = 1991; // Law No. 407-XII, adopted 18 Nov 1991

export const yearsFor = (year: number) => year - FLAG_LAW_YEAR;

/** U+02BB MODIFIER LETTER TURNED COMMA — the proper Uzbek oʻ / gʻ letter mark. */
export const OKINA = 'ʻ';

export const texts = (year: number) => {
  const YEARS = yearsFor(year);
  return {
    YEARS,
    big: String(YEARS),
    bigSub: 'yilligi',
    lowerThird: [
      `O${OKINA}zbekiston Respublikasi Davlat bayrog${OKINA}i`,
      `qabul qilinganligining ${YEARS} yilligi`,
    ] as const,
    badgeRing: '18-noyabr · 1991',
  };
};

export type FlagDayProps = { year: number; width: number; height: number };
export const defaultProps: FlagDayProps = { year: 2026, width: 1080, height: 1920 };

/** Palette for the scene (flag colours live in src/flag/flagSpec.ts only). */
export const SKY = { top: '#050d24', mid: '#0b2150', horizon: '#17407f' } as const;
export const GOLD = { base: '#ffc96b', deep: '#b07a1c' } as const;
