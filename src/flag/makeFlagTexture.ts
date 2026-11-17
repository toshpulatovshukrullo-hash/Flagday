import * as THREE from 'three';
import { drawFlag, drawStripesOnly } from './drawFlag.ts';

export const FLAG_TEX_W = 4000;
export const FLAG_TEX_H = 2000;

let flagCanvas: HTMLCanvasElement | null = null;
/** Supersampled 4000×2000 canvas of the exact flag — generated once, reused everywhere. */
export function makeFlagCanvas(): HTMLCanvasElement {
  if (flagCanvas) return flagCanvas;
  const c = document.createElement('canvas');
  c.width = FLAG_TEX_W; c.height = FLAG_TEX_H;
  drawFlag(c.getContext('2d')!, FLAG_TEX_W, FLAG_TEX_H);
  flagCanvas = c;
  return c;
}

let flagTex: THREE.CanvasTexture | null = null;
export function makeFlagTexture(): THREE.CanvasTexture {
  if (flagTex) return flagTex;
  const t = new THREE.CanvasTexture(makeFlagCanvas());
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  flagTex = t;
  return t;
}

let stripeTex: THREE.CanvasTexture | null = null;
/** Stripe-only texture: v (0..1) runs across the stripes, u is constant. */
export function makeStripeTexture(): THREE.CanvasTexture {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 8; c.height = 1000;
  drawStripesOnly(c.getContext('2d')!, 8, 1000);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  stripeTex = t;
  return t;
}
