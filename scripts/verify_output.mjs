// QA for rendered videos: duration 14.0 s, 30 fps, resolution, pixel format, year text = 35,
// and no bright (text-like) pixels in the bottom 15 % safe zone before the badge frames.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { texts, DURATION_FRAMES, FPS } from '../src/config.ts';

let fail = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`); if (!c) fail++; };
const tx = texts(2026);
ok(tx.YEARS === 35, `YEARS for 2026 = ${tx.YEARS} (law adopted 18 Nov 1991)`);
ok(tx.lowerThird.join(' ') === 'Oʻzbekiston Respublikasi Davlat bayrogʻi qabul qilinganligining 35 yilligi', `lower third: "${tx.lowerThird.join(' / ')}"`);
ok(DURATION_FRAMES / FPS === 14, `composition = ${DURATION_FRAMES} frames @ ${FPS} fps = ${DURATION_FRAMES / FPS} s`);

for (const [file, w, h] of [['out/flagday_9x16.mp4', 1080, 1920], ['out/flagday_1x1.mp4', 1080, 1080]]) {
  if (!fs.existsSync(file)) { ok(false, `${file} missing`); continue; }
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
    'stream=width,height,r_frame_rate,pix_fmt,codec_name,nb_read_frames:format=duration', '-of', 'json', file]).toString());
  const s = j.streams[0];
  ok(s.width === w && s.height === h, `${file} ${s.width}×${s.height}`);
  ok(s.r_frame_rate === '30/1', `${file} fps ${s.r_frame_rate}`);
  ok(Number(s.nb_read_frames) === 420, `${file} frames ${s.nb_read_frames}`);
  ok(Math.abs(Number(j.format.duration) - 14) < 0.05, `${file} duration ${Number(j.format.duration).toFixed(3)} s`);
  ok(s.pix_fmt === 'yuv420p' && s.codec_name === 'h264', `${file} ${s.codec_name} ${s.pix_fmt}`);
  // bottom-15 % safe zone: sample frames 0..355 every 15 (badge from ~12 s may glow there)
  const y0 = Math.floor(h * 0.85), bh = h - y0;
  let worst = 0, worstF = -1;
  for (let f = 0; f <= 355; f += 15) {
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${f}),crop=${w}:${bh}:0:${y0},format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 });
    let bright = 0; for (const v of raw) if (v > 170) bright++;
    const frac = bright / raw.length; if (frac > worst) { worst = frac; worstF = f; }
  }
  ok(worst < 0.002, `${file} bottom-15% safe zone: max bright-pixel fraction ${(worst * 100).toFixed(3)}% (frame ${worstF})`);
}
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll output checks passed.');
process.exit(fail ? 1 : 0);
