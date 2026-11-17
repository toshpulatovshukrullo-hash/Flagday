import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FLAG_COLORS } from '../flag/flagSpec';
import { hash01 } from '../prng';
import { BIG_CENTER } from './glyphs';

const COLS = [FLAG_COLORS.blue, FLAG_COLORS.white, FLAG_COLORS.green, FLAG_COLORS.red].map((c) => new THREE.Color(c));
const GOLD = new THREE.Color(1.0, 0.8, 0.45);

function spriteTex(kind: 'dot' | 'star') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  if (kind === 'star') {
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [[128, 5], [5, 128]]) {
      const lg = g.createLinearGradient(64 - w / 2, 64 - h / 2, 64 + w / 2, 64 + h / 2);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(64 - w / 2, 64 - h / 2, w, h);
    }
  }
  return new THREE.CanvasTexture(c);
}

const NSTREAK = 8, SEG = 48, NP = 170;

/** Flag-coloured light streaks + particles + glints orbiting the big number. All seeded / frame-driven. */
export const Streaks: React.FC<{ frame: number; amount: number; center?: THREE.Vector3 }> = ({ frame, amount, center = BIG_CENTER }) => {
  const res = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(NSTREAK * (SEG + 1) * 2 * 3), col = new Float32Array(NSTREAK * (SEG + 1) * 2 * 3);
    const idx: number[] = [];
    for (let k = 0; k < NSTREAK; k++) for (let i = 0; i < SEG; i++) { const a = (k * (SEG + 1) + i) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    pgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    const pmat = new THREE.PointsMaterial({ size: 0.14, map: spriteTex('dot'), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const gmat = new THREE.SpriteMaterial({ map: spriteTex('star'), color: new THREE.Color(1.6, 1.4, 1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const orbits = Array.from({ length: NSTREAK }, (_, k) => ({
      r: 1.75 + 0.55 * hash01(k, 1), tiltX: (hash01(k, 2) - 0.5) * 1.1, tiltZ: (hash01(k, 3) - 0.5) * 0.9,
      speed: (0.9 + 0.7 * hash01(k, 4)) * (k % 2 ? 1 : -1), phase: hash01(k, 5) * Math.PI * 2, color: COLS[k % 4],
      arc: 0.9 + 0.6 * hash01(k, 6), squash: 0.55 + 0.2 * hash01(k, 7),
    }));
    const parts = Array.from({ length: NP }, (_, i) => ({
      r: 1.3 + 1.5 * hash01(i, 11), tilt: (hash01(i, 12) - 0.5) * 1.4, speed: (0.25 + 0.5 * hash01(i, 13)) * (hash01(i, 14) > 0.5 ? 1 : -1),
      phase: hash01(i, 15) * Math.PI * 2, y: (hash01(i, 16) - 0.5) * 1.6, color: hash01(i, 17) < 0.35 ? GOLD : COLS[i % 4],
      tw: hash01(i, 18) * 6.28,
    }));
    const glints = Array.from({ length: 6 }, (_, i) => ({ x: (hash01(i, 21) - 0.5) * 2.4, y: (hash01(i, 22) - 0.5) * 1.6, t0: 8.1 + i * 0.45, s: 0.5 + 0.4 * hash01(i, 23) }));
    return { geo, mat, pgeo, pmat, gmat, orbits, parts, glints };
  }, []);
  const t = frame / 30;

  useLayoutEffect(() => {
    if (amount <= 0.001) return;
    const pos = res.geo.attributes.position as THREE.BufferAttribute, col = res.geo.attributes.color as THREE.BufferAttribute;
    const e = new THREE.Euler(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), cam = new THREE.Vector3(0, 0, 1);
    res.orbits.forEach((o, k) => {
      e.set(o.tiltX, 0, o.tiltZ);
      const head = o.phase + o.speed * t * 1.6;
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG; // 0 tail → 1 head
        const a = head - o.arc * (1 - u);
        v.set(Math.cos(a) * o.r, Math.sin(a) * o.r * o.squash * 0.35, Math.sin(a) * o.r * 0.6).applyEuler(e);
        const a2 = a + 0.01;
        v2.set(Math.cos(a2) * o.r, Math.sin(a2) * o.r * o.squash * 0.35, Math.sin(a2) * o.r * 0.6).applyEuler(e).sub(v).normalize();
        const side = new THREE.Vector3().crossVectors(v2, cam).normalize();
        const w = 0.035 * Math.pow(u, 0.6) * (1 - Math.pow(u, 12) * 0.6);
        const b = (k * (SEG + 1) + i) * 2;
        pos.setXYZ(b, center.x + v.x + side.x * w, center.y + v.y + side.y * w, center.z + v.z + side.z * w);
        pos.setXYZ(b + 1, center.x + v.x - side.x * w, center.y + v.y - side.y * w, center.z + v.z - side.z * w);
        const inten = Math.pow(u, 1.5) * 2.2 * amount;
        col.setXYZ(b, o.color.r * inten, o.color.g * inten, o.color.b * inten);
        col.setXYZ(b + 1, o.color.r * inten, o.color.g * inten, o.color.b * inten);
      }
    });
    pos.needsUpdate = true; col.needsUpdate = true; res.geo.computeBoundingSphere();
    const pp = res.pgeo.attributes.position as THREE.BufferAttribute, pc = res.pgeo.attributes.color as THREE.BufferAttribute;
    res.parts.forEach((p, i) => {
      const a = p.phase + p.speed * t;
      const x = Math.cos(a) * p.r, z = Math.sin(a) * p.r * 0.6, y = p.y + Math.sin(a) * p.tilt * 0.6;
      pp.setXYZ(i, center.x + x, center.y + y, center.z + z);
      const tw = (0.55 + 0.45 * Math.sin(t * 3 + p.tw)) * amount * 1.6;
      pc.setXYZ(i, p.color.r * tw, p.color.g * tw, p.color.b * tw);
    });
    pp.needsUpdate = true; pc.needsUpdate = true; res.pgeo.computeBoundingSphere();
  });
  res.mat.opacity = 1; res.pmat.opacity = 1;
  return (
    <group visible={amount > 0.001}>
      <mesh geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={5} />
      <points geometry={res.pgeo} material={res.pmat} frustumCulled={false} renderOrder={5} />
      {res.glints.map((g, i) => {
        const k = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (t - g.t0) / 0.7))));
        if (k <= 0.001 || amount <= 0.001) return null;
        return <sprite key={i} material={res.gmat} position={[center.x + g.x, center.y + g.y, center.z + 0.3]} scale={[g.s * k * 1.2, g.s * k * 1.2, 1]} renderOrder={6} />;
      })}
    </group>
  );
};
