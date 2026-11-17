import * as THREE from 'three';
import { FPS } from '../config';
import { flow, monotoneCubic } from '../motion';
import { T } from '../timeline';
import { GlyphData } from './glyphs';

/** Helix around the sculpture: one full revolution, under the wings, over the pedestal panels. */
export const HELIX = { r: 2.3, y0: 3.75, y1: 4.35, phi0: -62, turns: 1 };

type Sample = { p: THREE.Vector3; up: THREE.Vector3; trace: number; glyph: number; reveal: number };

export type RibbonPath = {
  samples: Sample[]; cum: number[]; total: number;
  keys: { helixStart: number; helixEnd: number; traceStart: number; glyphRanges: Array<[number, number]> };
  headAt: (frame: number) => number; tailAt: (frame: number) => number;
  length: number;
};

const helixPoint = (u: number) => {
  const phi = THREE.MathUtils.degToRad(HELIX.phi0 + 360 * HELIX.turns * u);
  const y = HELIX.y0 + (HELIX.y1 - HELIX.y0) * u + 0.12 * Math.sin(Math.PI * 2 * u);
  return new THREE.Vector3(HELIX.r * Math.sin(phi), y, HELIX.r * Math.cos(phi));
};

export function buildRibbonPath(big: GlyphData[]): RibbonPath {
  const samples: Sample[] = [];
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const push = (p: THREE.Vector3, trace: number, glyph = -1, reveal = 0, up = Y) => samples.push({ p, up, trace, glyph, reveal });

  // A — entrance from far left on a smooth 3D curve into the helix start (tangent-continuous)
  const h0 = helixPoint(0), h0b = helixPoint(0.02);
  const tan0 = h0b.clone().sub(h0).normalize();
  const A = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-13, 6.4, 5.5), new THREE.Vector3(-8.5, 5.6, 4.6), new THREE.Vector3(-4.6, 4.4, 3.4),
    h0.clone().addScaledVector(tan0, -1.2), h0,
  ], false, 'centripetal');
  const nA = 160;
  for (let i = 0; i < nA; i++) push(A.getPoint(i / nA), 0);
  const helixStartIdx = samples.length;
  // B — helix
  const nB = 300;
  for (let i = 0; i <= nB; i++) push(helixPoint(i / nB), 0);
  const helixEndIdx = samples.length - 1;
  // C — swoop down to the first glyph contour start
  const g0 = big[0].contour;
  const hEnd = helixPoint(1), hEndT = helixPoint(1).sub(helixPoint(0.985)).normalize();
  const c0 = g0[0], c1 = g0[3];
  const cT = c1.clone().sub(c0).normalize();
  const swoop = new THREE.CubicBezierCurve3(hEnd, hEnd.clone().addScaledVector(hEndT, 1.6), c0.clone().addScaledVector(cT, -1.4).add(new THREE.Vector3(0, 0.25, 0.9)), c0);
  const nS = 70;
  for (let i = 1; i < nS; i++) { const u = i / nS; push(swoop.getPoint(u), THREE.MathUtils.smoothstep(u, 0.15, 0.95)); }
  const traceStartIdx = samples.length;
  // D — contours of each big glyph (with short arcing connectors between glyphs)
  const glyphRanges: Array<[number, number]> = [];
  big.forEach((g, gi) => {
    const centre = new THREE.Vector2(g.origin.x + g.center2.x, g.origin.y + g.center2.y);
    const angs = g.contour.map((p) => Math.atan2(p.y - centre.y, p.x - centre.x));
    // unwrap & normalise to running-max progress 0..1 (clockwise = decreasing angle)
    const un: number[] = [0];
    for (let k = 1; k < angs.length; k++) { let d = angs[k] - angs[k - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; un.push(un[k - 1] - d); }
    const tot = Math.max(1e-3, un[un.length - 1]);
    let run = 0;
    const startIdx = samples.length;
    g.contour.forEach((p, k) => { run = Math.max(run, un[k] / tot); push(p.clone(), 1, gi, Math.min(1, run), Z); });
    glyphRanges.push([startIdx, samples.length - 1]);
    const next = big[gi + 1];
    if (next) {
      const a = g.contour[g.contour.length - 1], b = next.contour[0];
      const con = new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(0.3, 0.5, 0.8)), b.clone().add(new THREE.Vector3(-0.5, 0.5, 0.8)), b);
      for (let i = 1; i < 30; i++) push(con.getPoint(i / 30), 1);
    }
  });

  // arc length
  const cum = [0];
  for (let i = 1; i < samples.length; i++) cum.push(cum[i - 1] + samples[i].p.distanceTo(samples[i - 1].p));
  const total = cum[cum.length - 1];
  const sHS = cum[helixStartIdx], sHE = cum[helixEndIdx], sTS = cum[traceStartIdx];

  const length = 5.6;
  const fr = (s: number) => s * FPS;
  const avgA = sHS / fr(T.spiralStart - T.ribbonIn);
  const head = monotoneCubic(
    [fr(T.ribbonIn), fr(T.spiralStart), fr(T.spiralEnd), fr(T.spiralEnd + 0.35), fr(T.traceHeadEnd)],
    [0, sHS, sHE, sTS, total], [avgA * 1.7, 0],
  );
  const headAt = (frame: number) => (frame < fr(T.ribbonIn) ? -1e3 : head(frame));
  const tailAt = (frame: number) => {
    const h = headAt(frame);
    const a = h - length;
    const b = total - length + length * flow(frame, T.traceHeadEnd - 0.25, T.traceTailEnd - T.traceHeadEnd + 0.25);
    return Math.min(h, Math.max(a, frame > fr(T.traceHeadEnd - 0.25) ? b : a));
  };
  return {
    samples, cum, total, length,
    keys: { helixStart: sHS, helixEnd: sHE, traceStart: sTS, glyphRanges: glyphRanges.map(([a, b]) => [cum[a], cum[b]] as [number, number]) },
    headAt, tailAt,
  };
}

/** Interpolated sample at arc length s (extrapolates linearly before the start). */
export function sampleAt(path: RibbonPath, s: number) {
  const { samples, cum } = path;
  if (s <= 0) {
    const d = samples[1].p.clone().sub(samples[0].p).normalize();
    return { p: samples[0].p.clone().addScaledVector(d, s), up: samples[0].up, trace: 0, glyph: -1, reveal: 0 };
  }
  if (s >= path.total) { const l = samples[samples.length - 1]; return { ...l, p: l.p.clone() }; }
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const t = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
  const a = samples[lo], b = samples[hi];
  return {
    p: a.p.clone().lerp(b.p, t), up: a.up.clone().lerp(b.up, t).normalize(),
    trace: a.trace + (b.trace - a.trace) * t, glyph: a.glyph === b.glyph ? a.glyph : -1, reveal: a.reveal + (b.reveal - a.reveal) * t,
  };
}

/** Reveal progress (0..1) of each big glyph given the ribbon head position. */
export function glyphReveal(path: RibbonPath, headS: number): number[] {
  return path.keys.glyphRanges.map(([s0, s1]) => {
    if (headS <= s0) return 0;
    if (headS >= s1) return 1;
    return sampleAt(path, headS).reveal;
  });
}
