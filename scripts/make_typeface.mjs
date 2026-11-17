// Convert a TTF to a three.js typeface JSON (same format as facetype.js) using opentype.js.
// Usage: node scripts/make_typeface.mjs public/fonts/PlayfairDisplay-ExtraBold.ttf public/fonts/playfair-800.typeface.json
import fs from 'node:fs';
import opentype from 'opentype.js';

const [src = 'public/fonts/PlayfairDisplay-ExtraBold.ttf', dst = 'public/fonts/playfair-800.typeface.json'] = process.argv.slice(2);
const font = opentype.parse(fs.readFileSync(src).buffer);
const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 72);
const chars = ' 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-·.' + 'ʻ‘';
const glyphs = {};
// Use lining figures (OpenType 'lnum', glyph names *.lf) so big numbers sit on the baseline.
const byName = new Map();
for (let i = 0; i < font.glyphs.length; i++) { const g = font.glyphs.get(i); if (g.name) byName.set(g.name, g); }
const DIGIT_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const r = (v) => Math.round(v * scale);
for (const ch of chars) {
  const d = '0123456789'.indexOf(ch);
  const g = (d >= 0 && byName.get(DIGIT_NAMES[d] + '.lf')) || font.charToGlyph(ch);
  if (!g || g.index === 0) { console.warn('missing glyph', ch); continue; }
  const token = { ha: r(g.advanceWidth), x_min: r(g.xMin ?? 0), x_max: r(g.xMax ?? 0), o: '' };
  for (const c of g.path.commands) {
    let t = c.type.toLowerCase();
    if (t === 'c') t = 'b';
    token.o += t + ' ';
    if (c.x !== undefined && c.y !== undefined) token.o += r(c.x) + ' ' + r(c.y) + ' ';
    if (c.x1 !== undefined && c.y1 !== undefined) token.o += r(c.x1) + ' ' + r(c.y1) + ' ';
    if (c.x2 !== undefined && c.y2 !== undefined) token.o += r(c.x2) + ' ' + r(c.y2) + ' ';
  }
  glyphs[ch] = token;
}
const out = {
  glyphs, familyName: font.names.fontFamily?.en ?? 'font', ascender: r(font.ascender), descender: r(font.descender),
  underlinePosition: r(font.tables.post.underlinePosition), underlineThickness: r(font.tables.post.underlineThickness),
  boundingBox: { yMin: r(font.tables.head.yMin), xMin: r(font.tables.head.xMin), yMax: r(font.tables.head.yMax), xMax: r(font.tables.head.xMax) },
  resolution: 1000, original_font_information: { fontFamily: font.names.fontFamily?.en, license: 'SIL OFL 1.1' },
  cssFontWeight: 'bold', cssFontStyle: 'normal',
};
fs.writeFileSync(dst, JSON.stringify(out));
console.log('wrote', dst, Object.keys(glyphs).length, 'glyphs');
