import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { FPS } from '../config';
import { FLAG_COLORS, FLAG_STRIPES } from '../flag/flagSpec';
import { Easing } from 'remotion';
import { clamp01, critSpring, easeExitFlow, flow } from '../motion';
import { hash01 } from '../prng';
import { T } from '../timeline';

type CharBox = { ch: string; x: number; y: number; w: number; line: number; word: number; accent: boolean; idx: number };

const FONT_W = 600;
const streamEase = Easing.bezier(0.25, 0.55, 0.25, 1);

/** Layout per character (prefix measurement keeps kerning) so each glyph can dissolve individually. */
function layout(lines: readonly string[], W: number, H: number, accentFrom: string) {
  const fs = Math.round(Math.min(W, H * 0.75) * 0.044);
  const c = document.createElement('canvas').getContext('2d')!;
  c.font = `${FONT_W} ${fs}px Montserrat`;
  const ls = fs * 0.01;
  const lineH = fs * 1.42;
  const cy = H * 0.72;
  const boxes: CharBox[] = [];
  let word = 0, idx = 0;
  lines.forEach((line, li) => {
    const widths: number[] = [];
    let prefix = 0;
    const lw = c.measureText(line).width + ls * (line.length - 1);
    const x0 = (W - lw) / 2;
    const accentStart = line.indexOf(accentFrom);
    [...line].forEach((ch, i) => {
      const pre = c.measureText(line.slice(0, i)).width + ls * i;
      const w = c.measureText(ch).width;
      widths.push(w); prefix = pre;
      if (ch === ' ') word++;
      boxes.push({ ch, x: x0 + pre, y: cy + (li - (lines.length - 1) / 2) * lineH, w, line: li, word, accent: accentStart >= 0 && i >= accentStart, idx: idx++ });
    });
    void prefix; word++;
  });
  return { boxes, fs, lineH, cy };
}

export const LowerThird: React.FC<{ lines: readonly string[]; accent: string; width: number; height: number }> = ({ lines, accent, width, height }) => {
  const frame = useCurrentFrame();
  const L = useMemo(() => layout(lines, width, height, accent), [lines, width, height, accent]);
  const nChars = L.boxes.length;
  const bandIn = flow(frame, T.lowerThirdIn - 0.1, 0.9) * (1 - flow(frame, T.textDissolve + 0.4, 0.8));
  const lineIn = flow(frame, T.lowerThirdIn + 0.25, 0.9) * (1 - flow(frame, T.textDissolve, 0.5));
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, top: L.cy - L.lineH * 1.6, height: L.lineH * 3.2,
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(3,9,26,0.62), rgba(3,9,26,0) 100%)', opacity: bandIn,
      }} />
      <div style={{
        position: 'absolute', left: width / 2 - (width * 0.09 * lineIn), width: width * 0.18 * lineIn, top: L.cy - L.lineH * 1.25, height: 2,
        background: 'linear-gradient(90deg, rgba(242,197,107,0), #f2c56b, rgba(242,197,107,0))', opacity: lineIn,
      }} />
      {L.boxes.map((b) => {
        if (b.ch === ' ') return null;
        const start = T.lowerThirdIn + (b.line * 6 + b.word * 2.2 + (b.idx % 40) * 0.35) / FPS;
        const pin = flow(frame, start, 0.8), sp = critSpring(frame, start, 9);
        const outStart = T.textDissolve + ((b.idx / nChars) * 14) / FPS;
        const pout = flow(frame, outStart, 0.55, easeExitFlow);
        const op = pin * (1 - pout);
        if (op <= 0.001) return null;
        const blur = 12 * (1 - pin) + 10 * pout;
        const rise = 40 * (1 - sp) - 26 * pout;
        const sc = (0.92 + 0.08 * sp) * (1 + 0.15 * pout);
        return (
          <span key={b.idx} style={{
            position: 'absolute', left: b.x, top: b.y - L.fs * 0.62, fontFamily: 'Montserrat', fontWeight: FONT_W, fontSize: L.fs,
            lineHeight: `${L.fs * 1.24}px`, whiteSpace: 'pre', color: b.accent ? '#f6cf7a' : '#f4f6fb', opacity: op,
            transform: `translateY(${rise}px) scale(${sc})`, transformOrigin: '50% 60%', filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
            textShadow: b.accent ? '0 0 18px rgba(246,207,122,0.35), 0 2px 6px rgba(0,0,0,0.55)' : '0 2px 6px rgba(0,0,0,0.55)',
          }}>{b.ch}</span>
        );
      })}
      <FinaleStream boxes={L.boxes} fs={L.fs} width={width} height={height} nChars={nChars} />
    </div>
  );
};

const STREAM_COLS = [FLAG_COLORS.blue, FLAG_COLORS.white, FLAG_COLORS.green, FLAG_COLORS.red, '#f6cf7a'];

/** Letters → flag-coloured light particles + mini stripe shards streaming smoothly to the frame centre. */
const FinaleStream: React.FC<{ boxes: CharBox[]; fs: number; width: number; height: number; nChars: number }> = ({ boxes, fs, width, height, nChars }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const parts = useMemo(() => {
    const out: Array<{ x: number; y: number; delay: number; dur: number; bend: number; col: string; shard: boolean; size: number; rot: number; spin: number }> = [];
    boxes.forEach((b) => {
      if (b.ch === ' ') return;
      for (let k = 0; k < 7; k++) {
        const i = b.idx * 7 + k;
        out.push({
          x: b.x + b.w * hash01(i, 1), y: b.y + (hash01(i, 2) - 0.6) * fs * 0.7,
          delay: T.textDissolve + ((b.idx / nChars) * 14) / FPS + 0.05 + 0.25 * hash01(i, 3),
          dur: 0.85 + 0.45 * hash01(i, 4), bend: (hash01(i, 5) - 0.5) * 0.9, col: STREAM_COLS[Math.floor(hash01(i, 6) * 5)],
          shard: hash01(i, 7) < 0.28, size: 2 + 3.5 * hash01(i, 8), rot: hash01(i, 9) * 6.28, spin: (hash01(i, 10) - 0.5) * 8,
        });
      }
    });
    return out;
  }, [boxes, fs, nChars]);
  const t = frame / FPS;
  const active = t > T.textDissolve - 0.05 && t < T.badge + 1.2;
  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, width, height);
    if (!active) return;
    const cx = width / 2, cy = height / 2;
    const unit = Math.min(width, height) / 1080;
    for (const p of parts) {
      const u = clamp01((t - p.delay) / p.dur);
      if (u <= 0 || u >= 1) continue;
      const e = streamEase(u);
      // quadratic bezier: start → control (lifted & bent) → centre
      const mx = (p.x + cx) / 2 + p.bend * width * 0.35, my = Math.min(p.y, cy) + (p.y - cy) * 0.15 - height * 0.05;
      const x = (1 - e) * (1 - e) * p.x + 2 * (1 - e) * e * mx + e * e * cx;
      const y = (1 - e) * (1 - e) * p.y + 2 * (1 - e) * e * my + e * e * cy;
      const a = Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - Math.pow(u, 3));
      const s = p.size * unit * (1 - 0.5 * e);
      if (p.shard) {
        g.save(); g.translate(x, y); g.rotate(p.rot + p.spin * u); g.globalAlpha = a;
        const w = s * 4.4, h = s * 2.2; // 2:1 stripe-only shard
        for (const st of FLAG_STRIPES) { g.fillStyle = FLAG_COLORS[st.color]; g.fillRect(-w / 2, -h / 2 + (h * st.y0) / 125, w, (h * (st.y1 - st.y0)) / 125 + 0.3); }
        g.restore();
      } else {
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(x, y, 0, x, y, s * 3);
        gr.addColorStop(0, p.col); gr.addColorStop(0.35, p.col + '88'); gr.addColorStop(1, p.col + '00');
        g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 3, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.globalAlpha = 1;
  });
  return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />;
};
