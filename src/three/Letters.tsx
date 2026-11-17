import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FPS } from '../config';
import { critSpring, easeExitFlow, flow } from '../motion';
import { T } from '../timeline';
import { BIG_CENTER, GlyphData, SUB } from './glyphs';
import { goldMaterial } from './materials';

type RevealUniforms = { uReveal: { value: number }; uCenter: { value: THREE.Vector2 }; uA0: { value: number }; uGlow: { value: number } };

function revealGold(center: THREE.Vector2, a0: number) {
  const m = goldMaterial({ roughness: 0.2, envMapIntensity: 1.35, transparent: true, clearcoat: 0.4 });
  const u: RevealUniforms = { uReveal: { value: 0 }, uCenter: { value: center }, uA0: { value: a0 }, uGlow: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocalP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocalP;\nuniform float uReveal, uA0, uGlow;\nuniform vec2 uCenter;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float revEdge = 0.0;
        if (uReveal < 0.999) {
          vec2 dd = vLocalP.xy - uCenter;
          float prog = mod(uA0 - atan(dd.y, dd.x), 6.2831853) / 6.2831853;
          if (prog > uReveal) discard;
          revEdge = 1.0 - smoothstep(0.0, 0.08, uReveal - prog);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * (revEdge * 2.2 + uGlow);`);
  };
  m.customProgramCacheKey = () => 'reveal-gold';
  return { m, u };
}

function shadowCard(): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 64, 4, 128, 64, 120);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false });
}

export type BigTransform = { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number; opacity: number };

export const BigNumber: React.FC<{ glyphs: GlyphData[]; reveal: number[]; frame: number; xf: BigTransform; glow: number }> = ({ glyphs, reveal, frame, xf, glow }) => {
  const mats = useMemo(() => glyphs.map((g) => {
    const c0 = g.contour[0];
    const a0 = Math.atan2(c0.y - g.origin.y - g.center2.y, c0.x - g.origin.x - g.center2.x);
    return revealGold(g.center2.clone(), a0);
  }), [glyphs]);
  const card = useMemo(shadowCard, []);
  mats.forEach((mm, i) => {
    mm.u.uReveal.value = reveal[i];
    mm.u.uGlow.value = glow;
    mm.m.opacity = xf.opacity;
  });
  const anyVisible = reveal.some((r) => r > 0.001) && xf.opacity > 0.002;
  const settle = flow(frame, T.traceStart, 2.5);
  card.opacity = 0.55 * settle * xf.opacity * (1 - flow(frame, T.glide, 0.4));
  return (
    <group position={xf.position} quaternion={xf.quaternion} scale={xf.scale} visible={anyVisible}>
      {glyphs.map((g, i) => (
        <mesh key={i} geometry={g.geometry} material={mats[i].m} position={g.origin.clone().sub(BIG_CENTER)} castShadow receiveShadow />
      ))}
      <mesh material={card} position={[0, -0.05, -0.75]} scale={[4.6, 3.0, 1]}>
        <planeGeometry />
      </mesh>
    </group>
  );
};

export const SubWord: React.FC<{ glyphs: GlyphData[]; frame: number }> = ({ glyphs, frame }) => {
  const mats = useMemo(() => glyphs.map(() => goldMaterial({ roughness: 0.2, envMapIntensity: 1.35, transparent: true, clearcoat: 0.4 })), [glyphs]);
  const card = useMemo(shadowCard, []);
  card.opacity = 0.45 * flow(frame, T.yilligiIn, 1.2) * (1 - flow(frame, T.textDissolve, 0.8));
  return (
    <group>
      {glyphs.map((g, i) => {
        const start = T.yilligiIn + (i * 4) / FPS;
        const pin = flow(frame, start, 0.8), sp = critSpring(frame, start, 9);
        const outStart = T.textDissolve - 0.1 + (i * 2) / FPS;
        const pout = flow(frame, outStart, 0.6, easeExitFlow);
        const op = pin * (1 - pout);
        mats[i].opacity = op;
        mats[i].emissive.setRGB(1, 0.7, 0.3);
        mats[i].emissiveIntensity = 0.6 * (1 - pin) + 1.2 * pout;
        const sc = (0.92 + 0.08 * sp) * (1 + 0.06 * pout);
        const yOff = -0.35 * (1 - sp) + 0.45 * pout;
        // scale about the glyph centre
        const cx = g.center2.x, cy = g.center2.y;
        return (
          <group key={i} position={[g.origin.x + cx, g.origin.y + cy + yOff, g.origin.z]} scale={[sc, sc, sc]} visible={op > 0.002}>
            <mesh geometry={g.geometry} material={mats[i]} position={[-cx, -cy, 0]} castShadow />
          </group>
        );
      })}
      <mesh material={card} position={[0, SUB.baseline + 0.35, SUB.z - 0.4]} scale={[5.0, 1.6, 1]}>
        <planeGeometry />
      </mesh>
    </group>
  );
};
