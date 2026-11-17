// Render QA stills. Usage: node scripts/render_stills.mjs [composition=FlagDay] [frames=30,90,...] [scale=0.5] [outDir=out/stills]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const [comp = 'FlagDay', framesArg = '30,90,150,210,270,330,410', scale = '0.5', outDir = 'out/stills'] = process.argv.slice(2);
const frames = framesArg.split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts'), publicDir: path.resolve('public') });
const browserExecutable = process.env.REMOTION_BROWSER || null;
const chromiumOptions = { gl: 'swangle' };
const composition = await selectComposition({ serveUrl, id: comp, browserExecutable, chromiumOptions });
for (const frame of frames) {
  const t0 = Date.now();
  const output = path.join(outDir, `${comp}_${String(frame).padStart(3, '0')}.png`);
  await renderStill({ composition, serveUrl, frame, output, scale: Number(scale), browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000,
    onBrowserLog: (l) => { if (l.type === 'error' || l.type === 'warning') console.log('[browser]', l.text.slice(0, 300)); } });
  console.log(`frame ${frame} → ${output} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
