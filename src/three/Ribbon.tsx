import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FPS } from '../config';
import { makeStripeTexture } from '../flag/makeFlagTexture';
import { flow, smoothstep } from '../motion';
import { T } from '../timeline';
import { RibbonPath, sampleAt } from './ribbonPath';

const NL = 280; // segments along the ribbon
const NW = 4;   // vertices across

/**
 * Long, thin, pointed pennant ribbon carrying ONLY the stripe pattern (no crescent/stars).
 * Cloth-like wave via displacement: pinned at the head, amplitude grows toward the tail.
 */
export const Ribbon: React.FC<{ path: RibbonPath; frame: number }> = ({ path, frame }) => {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((NL + 1) * NW * 3);
    const uv = new Float32Array((NL + 1) * NW * 2);
    const idx: number[] = [];
    for (let i = 0; i <= NL; i++) for (let j = 0; j < NW; j++) {
      uv[(i * NW + j) * 2] = i / NL; uv[(i * NW + j) * 2 + 1] = j / (NW - 1);
      if (i < NL && j < NW - 1) { const a = i * NW + j; idx.push(a, a + NW, a + 1, a + 1, a + NW, a + NW + 1); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const tex = makeStripeTexture();
    const m = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0.32,
      side: THREE.DoubleSide, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.6, transparent: true,
    });
    return { geo: g, mat: m };
  }, []);

  const t = frame / FPS;
  const head = path.headAt(frame), tail = path.tailAt(frame);
  const len = head - tail;
  const visible = t >= T.ribbonIn && len > 0.02;

  useLayoutEffect(() => {
    if (!visible) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const P: THREE.Vector3[] = [], U: THREE.Vector3[] = [], TR: number[] = [];
    for (let i = 0; i <= NL; i++) {
      const s = tail + (len * i) / NL;
      const smp = sampleAt(path, s);
      P.push(smp.p); U.push(smp.up); TR.push(smp.trace);
    }
    const tan = new THREE.Vector3(), side = new THREE.Vector3(), nrm = new THREE.Vector3(), up = new THREE.Vector3();
    for (let i = 0; i <= NL; i++) {
      const u = i / NL; // 0 tail → 1 head
      tan.subVectors(P[Math.min(NL, i + 1)], P[Math.max(0, i - 1)]).normalize();
      // flight: ribbon width ~ vertical with a slow twist; trace: width along z (becomes the letter side wall)
      const s = tail + len * u;
      const twist = (1 - TR[i]) * 0.85 * Math.sin(s * 0.42 + 0.6);
      up.copy(U[i]);
      up.applyAxisAngle(tan, twist);
      side.copy(up).addScaledVector(tan, -up.dot(tan)).normalize();
      nrm.crossVectors(tan, side).normalize();
      const baseW = THREE.MathUtils.lerp(0.3, 0.5, TR[i]);
      const headTaper = smoothstep(1.0, 0.92, u);                 // sharp pointed tip at the head
      const tailTaper = Math.pow(smoothstep(0.0, 0.45, u), 0.8);   // long thin tail
      const w = baseW * Math.min(headTaper * 1.0 + 0.0, 1) * tailTaper;
      const amp = 0.16 * Math.pow(1 - u, 1.4) * (1 - 0.88 * TR[i]);
      const wave = Math.sin(s * 2.4 - t * 8.0) * amp + Math.sin(s * 5.1 - t * 11.0) * amp * 0.25;
      for (let j = 0; j < NW; j++) {
        const v = j / (NW - 1) - 0.5;
        const cup = 0.035 * (1 - 4 * v * v) * (1 - TR[i]);
        const x = P[i].x + side.x * v * w + nrm.x * (wave + cup);
        const y = P[i].y + side.y * v * w + nrm.y * (wave + cup);
        const z = P[i].z + side.z * v * w + nrm.z * (wave + cup);
        pos.setXYZ(i * NW + j, x, y, z);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  });

  // transformation into gold as it is absorbed by the letters
  const toGold = flow(frame, T.traceHeadEnd - 0.4, 0.9);
  mat.color.setRGB(1, 1, 1).lerp(new THREE.Color(1.0, 0.74, 0.32), toGold);
  mat.metalness = 0.05 + 0.9 * toGold;
  mat.roughness = 0.42 - 0.2 * toGold;
  mat.emissiveIntensity = 0.32 * (1 - toGold) + 0.6 * toGold * (1 - flow(frame, T.traceTailEnd - 0.3, 0.4));
  mat.emissive.setRGB(1, 1, 1).lerp(new THREE.Color(1.0, 0.7, 0.3), toGold);
  mat.opacity = flow(frame, T.ribbonIn, 0.5) * (1 - flow(frame, T.traceTailEnd - 0.25, 0.35));

  return <mesh geometry={geo} material={mat} visible={visible} castShadow frustumCulled={false} />;
};
