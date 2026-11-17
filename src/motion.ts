/**
 * ALL motion curves live here (§2b "After Effects flow"): fast start, long soft settle, no bounce.
 * Tune globally from this file.
 */
import { Easing, interpolate } from 'remotion';
import { FPS } from './config';

/** Signature AE-style ease-out: fast start, very soft tail. */
export const easeFlow = Easing.bezier(0.16, 1, 0.3, 1);
/** Mirror for exits: still starts quickly, soft tail into invisibility. */
export const easeExit = Easing.bezier(0.5, 0, 0.75, 0); // ease-in tail for opacity only
export const easeExitFlow = Easing.bezier(0.33, 0, 0.2, 1);
/** Gentle in-out for slow camera drifts. */
export const easeDrift = Easing.bezier(0.45, 0, 0.25, 1);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const sec = (s: number) => Math.round(s * FPS);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** 0→1 progress between two times (seconds) with the flow ease. */
export function flow(frame: number, startS: number, durS: number, ease: (t: number) => number = easeFlow): number {
  return interpolate(frame, [startS * FPS, (startS + durS) * FPS], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease,
  });
}

/**
 * Critically damped spring (ζ = 1, no overshoot) step response, analytic → deterministic.
 * omega ≈ 2π / settle-period; 8–12 settles in ~0.6–0.8 s.
 */
export function critSpring(frame: number, startS: number, omega = 10): number {
  const t = (frame - startS * FPS) / FPS;
  if (t <= 0) return 0;
  return 1 - (1 + omega * t) * Math.exp(-omega * t);
}

/** Standard entrance: dissolve (opacity + blur 12→0) + small rise/scale. Returns values for any element. */
export function entrance(frame: number, startS: number, durS = 0.75) {
  const p = flow(frame, startS, durS);
  const sp = critSpring(frame, startS, 9);
  return { p, opacity: p, blur: 12 * (1 - p), rise: 40 * (1 - sp), scale: 0.92 + 0.08 * sp };
}

/** Standard exit (mirror): quick start, soft tail, dissolve out with blur and drift up. */
export function exit(frame: number, startS: number, durS = 0.7) {
  const p = flow(frame, startS, durS, easeExitFlow);
  return { p, opacity: 1 - p, blur: 12 * p, drift: -30 * p, scale: 1 + 0.04 * p };
}

/** Envelope: entrance at a, exit at b. */
export function envelope(frame: number, inS: number, outS: number, inDur = 0.75, outDur = 0.7): number {
  return flow(frame, inS, inDur) * (1 - flow(frame, outS, outDur, easeExitFlow));
}

/** Monotone cubic (Fritsch–Carlson) interpolation through keyframes — used for path travel. */
export function monotoneCubic(xs: number[], ys: number[], endSlopes?: [number, number]) {
  const n = xs.length;
  const d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  m[0] = endSlopes ? endSlopes[0] : d[0];
  m[n - 1] = endSlopes ? endSlopes[1] : d[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
