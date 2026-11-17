import {
  CRESCENT, FLAG_COLORS, FLAG_H_CM, FLAG_STRIPES, FLAG_W_CM,
  STAR_INNER_R, STAR_OUTER_R, starCenters,
} from './flagSpec.ts';

/** Minimal 2D-context surface shared by browser canvas and @napi-rs/canvas (for tests). */
export type Ctx2D = Pick<CanvasRenderingContext2D,
  'save' | 'restore' | 'scale' | 'beginPath' | 'arc' | 'fill' | 'fillRect' | 'moveTo' | 'lineTo' | 'closePath'
> & { fillStyle: unknown };

/**
 * Draws the exact flag into a W × H context (W must equal 2·H).
 * Pure function of the spec in flagSpec.ts — the single source of truth for every flag in the film.
 */
export function drawFlag(ctx: Ctx2D, W: number, H: number): void {
  if (Math.abs(W / H - FLAG_W_CM / FLAG_H_CM) > 1e-9) throw new Error('drawFlag: canvas must be exactly 2:1');
  const s = W / FLAG_W_CM; // px per cm (uniform)
  ctx.save();
  ctx.scale(s, s);
  for (const st of FLAG_STRIPES) {
    ctx.fillStyle = FLAG_COLORS[st.color];
    ctx.fillRect(0, st.y0, FLAG_W_CM, st.y1 - st.y0);
  }
  // Crescent: white outer disc, then the cut-out disc in the canton blue.
  ctx.fillStyle = FLAG_COLORS.white;
  ctx.beginPath(); ctx.arc(CRESCENT.outer.cx, CRESCENT.outer.cy, CRESCENT.outer.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = FLAG_COLORS.blue;
  ctx.beginPath(); ctx.arc(CRESCENT.cut.cx, CRESCENT.cut.cy, CRESCENT.cut.r, 0, Math.PI * 2); ctx.fill();
  // Stars (upright: first point straight up).
  ctx.fillStyle = FLAG_COLORS.white;
  for (const c of starCenters()) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? STAR_OUTER_R : STAR_INNER_R;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = c.x + r * Math.cos(a), y = c.y + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Stripe-only pattern (no crescent/stars) for decorative derivatives — ribbon, shards. Vertical = across stripes. */
export function drawStripesOnly(ctx: Ctx2D, W: number, H: number): void {
  const s = H / FLAG_H_CM;
  ctx.save();
  ctx.scale(1, s);
  for (const st of FLAG_STRIPES) {
    ctx.fillStyle = FLAG_COLORS[st.color];
    ctx.fillRect(0, st.y0, W, st.y1 - st.y0);
  }
  ctx.restore();
}
