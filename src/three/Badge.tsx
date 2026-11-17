import React, { useMemo } from 'react';
import * as THREE from 'three';
import { makeFlagCanvas } from '../flag/makeFlagTexture';
import { FLAG_ASPECT } from '../flag/flagSpec';
import { critSpring, flow } from '../motion';
import { T } from '../timeline';
import { goldMaterial } from './materials';

const FACE = 2048;

/** Badge face: white border with ring text + navy field with the FULL flag letterboxed (uniform scale, uncropped). */
function makeFace(ringTop: string, ringBottom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = FACE;
  const g = c.getContext('2d')!;
  const R = FACE / 2;
  g.translate(R, R);
  // white border ring
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  // inner navy field
  const rIn = R * 0.78;
  const fg = g.createRadialGradient(0, -rIn * 0.3, rIn * 0.1, 0, 0, rIn);
  fg.addColorStop(0, '#12306a'); fg.addColorStop(1, '#071636');
  g.fillStyle = fg; g.beginPath(); g.arc(0, 0, rIn, 0, Math.PI * 2); g.fill();
  // fine gold lines
  g.strokeStyle = '#c99a3e'; g.lineWidth = 10;
  g.beginPath(); g.arc(0, 0, rIn, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 6; g.beginPath(); g.arc(0, 0, R * 0.965, 0, Math.PI * 2); g.stroke();
  // flag: inscribed in circle of radius 0.72R → width = 2·r·2/√5, exact 2:1 (FLAG_ASPECT)
  const rFlag = R * 0.72;
  const fw = Math.round((2 * rFlag * 2) / Math.sqrt(5) / 2) * 2, fh = fw / FLAG_ASPECT;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
  g.fillStyle = '#000'; g.fillRect(-fw / 2, -fh / 2, fw, fh);
  g.restore();
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(makeFlagCanvas(), -fw / 2, -fh / 2, fw, fh);
  // ring text (Montserrat 600), upright along top & bottom arcs
  const drawArc = (text: string, radius: number, top: boolean) => {
    g.save();
    g.font = `600 ${Math.round(R * 0.105)}px Montserrat`;
    g.fillStyle = '#0b2150';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const spacing = R * 0.012;
    const widths = [...text].map((ch) => g.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0) - spacing;
    let ang = (top ? -1 : 1) * (total / radius) / 2;
    [...text].forEach((ch, i) => {
      const w = widths[i];
      const a = top ? -Math.PI / 2 + ang + (w - spacing) / 2 / radius : Math.PI / 2 + ang - (w - spacing) / 2 / radius;
      g.save();
      g.rotate(a);
      g.translate(radius, 0);
      g.rotate(top ? Math.PI / 2 : -Math.PI / 2);
      g.fillText(ch, 0, 0);
      g.restore();
      ang += (top ? 1 : -1) * w / radius;
    });
    g.restore();
  };
  drawArc(ringTop, R * 0.875, true);
  drawArc(ringBottom, R * 0.875, false);
  // small dots separating the two texts
  g.fillStyle = '#c99a3e';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * R * 0.875, 0, R * 0.018, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export type BadgeProps = { frame: number; position: THREE.Vector3; quaternion: THREE.Quaternion; radius: number; ringTop: string; ringBottom: string };

export const Badge: React.FC<BadgeProps> = ({ frame, position, quaternion, radius, ringTop, ringBottom }) => {
  const r = useMemo(() => {
    const face = new THREE.MeshBasicMaterial({ map: makeFace(ringTop, ringBottom), transparent: true, toneMapped: false });
    const gold = goldMaterial({ roughness: 0.18, transparent: true, envMapIntensity: 1.5 });
    const ringMat = goldMaterial({ roughness: 0.15, transparent: true, envMapIntensity: 1.6, emissive: new THREE.Color(1, 0.7, 0.3) });
    const gloss = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: { uSweep: { value: -1.5 }, uAmt: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec2 vUv; uniform float uSweep, uAmt;
        void main(){ vec2 p = vUv*2.-1.; float r = length(p); if (r>1.) discard;
          float band = exp(-pow((p.x*0.8 + p.y*0.6) - uSweep, 2.0) / 0.018);
          float top = smoothstep(0.2, 1.0, -p.y*0.0 + p.y) * 0.0;
          float rim = smoothstep(0.75, 1.0, r) * 0.05;
          float a = (band * 0.32 + rim + top) * uAmt;
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a, a); }`,
    });
    const glow = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d')!; const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,214,140,0.55)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    })();
    return { face, gold, ringMat, gloss, glow };
  }, [ringTop, ringBottom]);

  const ringP = flow(frame, T.ring, T.ringDur);
  const badgeP = flow(frame, T.badge, T.badgeDur);
  const badgeS = critSpring(frame, T.badge, 8.5);
  const ringR = radius * (0.55 * ringP + 0.47 * badgeS);
  r.ringMat.opacity = ringP;
  r.ringMat.emissiveIntensity = 0.9 * (1 - badgeP) + 0.05;
  r.face.opacity = badgeP; r.gold.opacity = badgeP;
  r.gloss.uniforms.uAmt.value = badgeP;
  r.gloss.uniforms.uSweep.value = -1.6 + 3.2 * flow(frame, T.sweep, T.sweepDur);
  r.glow.opacity = 0.32 * badgeP;
  const faceScale = Math.max(1e-4, (ringR / 1.02) * (0.94 + 0.06 * badgeS));
  // tilt settles (no bounce) + very slow drift during the hold
  const tiltIn = critSpring(frame, T.badge, 7);
  const hold = Math.max(0, frame / 30 - T.badge);
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.10 - 0.28 * (1 - tiltIn), 0.17 + 0.32 * (1 - tiltIn) - 0.035 * hold, 0.0));
  const q = quaternion.clone().multiply(tilt);
  const spin = (1 - ringP) * 2.4 + (1 - badgeP) * 0.6;
  if (ringP <= 0.001) return null;
  return (
    <group position={position} quaternion={q}>
      <mesh material={r.glow} position={[0, 0, -0.2]} scale={[radius * 2.6, radius * 2.6, 1]} visible={badgeP > 0.002} renderOrder={3}>
        <planeGeometry />
      </mesh>
      <mesh material={r.ringMat} rotation={[0, 0, spin]} scale={[ringR, ringR, ringR]}>
        <torusGeometry args={[1, 0.05, 24, 160]} />
      </mesh>
      <group scale={[faceScale, faceScale, faceScale]} visible={badgeP > 0.002}>
        <mesh material={r.gold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.06]}>
          <cylinderGeometry args={[1.0, 1.0, 0.1, 128, 1]} />
        </mesh>
        <mesh material={r.face} position={[0, 0, 0.0]} renderOrder={4}>
          <circleGeometry args={[0.975, 128]} />
        </mesh>
        <mesh material={r.gloss} position={[0, 0, 0.003]} renderOrder={5}>
          <circleGeometry args={[0.975, 96]} />
        </mesh>
      </group>
    </group>
  );
};
