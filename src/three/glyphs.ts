import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';

export const BIG = { size: 1.95, baseline: 1.62, z: 1.9, depth: 0.42, bevel: 0.05 };
export const SUB = { size: 0.92, baseline: 0.34, z: 1.9, depth: 0.3, bevel: 0.035 };
/** Visual centre of the big number (used for orbits, glide, shadow card). */
export const BIG_CENTER = new THREE.Vector3(0, BIG.baseline + 0.95, BIG.z + BIG.depth / 2);

export type GlyphData = {
  char: string;
  geometry: THREE.ExtrudeGeometry; // in group-local coords (group placed at `origin`)
  origin: THREE.Vector3;           // world position of glyph group origin
  center2: THREE.Vector2;          // glyph bbox centre (local xy)
  contour: THREE.Vector3[];        // outer outline in WORLD coords, offset outward, z = mid-depth (big only)
  contourDir: number;              // +1 CCW, -1 CW (as traced)
};

function signedArea(pts: THREE.Vector2[]) {
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2;
}

/** Builds per-glyph extruded geometry for a string, centred horizontally at x = 0. */
export function buildWord(font: Font, text: string, spec: typeof BIG, withContours: boolean): GlyphData[] {
  const data = (font as unknown as { data: { glyphs: Record<string, { ha: number }>; resolution: number } }).data;
  const scale = spec.size / data.resolution;
  // tracking: slight extra spacing for the display word
  const track = spec === BIG ? 0.04 : 0.03;
  const advances = [...text].map((ch) => (data.glyphs[ch]?.ha ?? 500) * scale + track);
  const total = advances.reduce((a, b) => a + b, 0) - track;
  let x = -total / 2;
  const out: GlyphData[] = [];
  [...text].forEach((ch, i) => {
    const shapes = font.generateShapes(ch, spec.size);
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: spec.depth, bevelEnabled: true, bevelThickness: spec.bevel, bevelSize: spec.bevel * 0.8,
      bevelSegments: 5, curveSegments: 14,
    });
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    const center2 = new THREE.Vector2((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2);
    const origin = new THREE.Vector3(x, spec.baseline, spec.z);
    let contour: THREE.Vector3[] = [], contourDir = 1;
    if (withContours && shapes.length) {
      // largest outer contour
      const shape = shapes.slice().sort((a, b) => Math.abs(signedArea(b.getPoints(8))) - Math.abs(signedArea(a.getPoints(8))))[0];
      let pts = shape.getSpacedPoints(220);
      if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-4) pts.pop();
      const area = signedArea(pts);
      // trace clockwise (rightward along the top) — reverse CCW contours
      if (area > 0) pts = pts.reverse();
      contourDir = -1;
      // start at the top-left-most point
      let best = 0, bestScore = -Infinity;
      pts.forEach((p, k) => { const s = p.y * 1.0 - p.x * 0.6; if (s > bestScore) { bestScore = s; best = k; } });
      pts = [...pts.slice(best), ...pts.slice(0, best)];
      pts.push(pts[0].clone());
      const n = pts.length;
      contour = pts.map((p, k) => {
        const a = pts[(k - 1 + n) % n], b = pts[(k + 1) % n];
        const t = new THREE.Vector2().subVectors(b, a).normalize();
        // clockwise loop → outward normal is to the left of travel: (-t.y, t.x)
        const nrm = new THREE.Vector2(-t.y, t.x);
        const off = spec.bevel * 0.8 + 0.035;
        return new THREE.Vector3(origin.x + p.x + nrm.x * off, origin.y + p.y + nrm.y * off, origin.z + spec.depth / 2);
      });
    }
    out.push({ char: ch, geometry, origin, center2, contour, contourDir });
    x += advances[i];
  });
  return out;
}
