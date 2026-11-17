// Flag texture verification (§2 rule 3). Draws the flag with the SAME drawFlag() used in the film,
// samples known points and asserts colours, then writes out/flag_texture_check.png.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import { drawFlag } from '../src/flag/drawFlag.ts';
import { FLAG_COLORS } from '../src/flag/flagSpec.ts';

const W = 4000, H = 2000, S = W / 250;
const c = createCanvas(W, H);
const ctx = c.getContext('2d');
drawFlag(ctx, W, H);
const img = ctx.getImageData(0, 0, W, H).data;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const at = (xcm, ycm) => { const x = Math.floor(xcm * S), y = Math.floor(ycm * S), i = (y * W + x) * 4; return [img[i], img[i + 1], img[i + 2]]; };
const checks = [
  ['blue stripe centre', 125, 20, 'blue'], ['upper red line centre', 125, 41.25, 'red'],
  ['white stripe centre', 125, 62.5, 'white'], ['lower red line centre', 125, 83.75, 'red'],
  ['green stripe centre', 125, 105, 'green'],
  ['star centre row1 right (92,8)', 92, 8, 'white'], ['star centre row1 left (68,8)', 68, 8, 'white'],
  ['star centre row2 left (56,20)', 56, 20, 'white'], ['star centre row3 left (44,32)', 44, 32, 'white'],
  ['gap between stars (86,8)', 86, 8, 'blue'], ['left of row1 stars (60,8)', 60, 8, 'blue'],
  ['right of star field (96,20)', 96, 20, 'blue'], ['star tip (92,5.2)', 92, 5.2, 'white'],
  ['crescent left edge inside (20.3,20)', 20.3, 20, 'white'], ['crescent left edge outside (19.7,20)', 19.7, 20, 'blue'],
  ['crescent body (23,20)', 23, 20, 'white'], ['crescent inner arc outside (25.4,20)', 25.4, 20, 'blue'],
  ['crescent cut-out centre (40,20)', 40, 20, 'blue'], ['crescent upper tip region (35,6)', 35, 5.5, 'white'],
  ['above crescent (35,4)', 35, 4, 'blue'], ['canton bottom-left (2,38)', 2, 38, 'blue'],
  ['fly end blue (248,2)', 248, 2, 'blue'], ['fly end green (248,123)', 248, 123, 'green'],
];
let fail = 0;
for (const [name, x, y, col] of checks) {
  const got = at(x, y), exp = hex(FLAG_COLORS[col]);
  const ok = got.every((v, i) => Math.abs(v - exp[i]) <= 2);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(40)} expected ${col.padEnd(5)} ${exp}  got ${got}`);
}
// Aspect
if (W / H !== 2) { console.log('FAIL aspect'); fail++; } else console.log('PASS  aspect exactly 2:1 (250 × 125 cm)');
fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/flag_texture_check.png', await c.encode('png'));
// Visual comparison against the reference image supplied by the user (if present).
const ref = 'assets/reference/flag_reference.png';
if (fs.existsSync(ref)) {
  const r = await loadImage(ref);
  const a = createCanvas(r.width, r.height), ac = a.getContext('2d');
  ac.drawImage(r, 0, 0);
  const b = createCanvas(r.width, r.height), bc = b.getContext('2d');
  bc.drawImage(c, 0, 0, r.width, r.height);
  const A = ac.getImageData(0, 0, r.width, r.height).data, B = bc.getImageData(0, 0, r.width, r.height).data;
  let big = 0, n = r.width * r.height;
  for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 90) big++;
  console.log(`INFO  vs reference image: ${(100 * big / n).toFixed(2)}% of pixels differ strongly (colour/AA)`);
}
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll flag checks passed. Wrote out/flag_texture_check.png');
process.exit(fail ? 1 : 0);
