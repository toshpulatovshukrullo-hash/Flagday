import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RING_C } from './Humo';

/**
 * University logo behind the bird, inside the wing ring. The PNG is only uniformly scaled, faded and placed:
 * unlit, not tone-mapped, square plane matching the image's 1:1 aspect, billboarded to the camera (no skew).
 */
export const LogoHalo: React.FC<{ logo: THREE.Texture | null; opacity: number; glow: number; camPos: THREE.Vector3 }> = ({ logo, opacity, glow, camPos }) => {
  const halo = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(200,225,255,0.55)');
    gr.addColorStop(0.7, 'rgba(120,170,255,0.12)'); gr.addColorStop(1, 'rgba(80,120,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }, []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }), []);
  const placeholder = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!; g.strokeStyle = '#fff'; g.lineWidth = 6; g.setLineDash([12, 10]);
    g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke(); g.font = '24px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('LOGO PLACEHOLDER', 128, 136);
    return new THREE.CanvasTexture(c);
  }, []);
  if (mat.map !== (logo ?? placeholder)) { mat.map = logo ?? placeholder; mat.needsUpdate = true; }
  mat.opacity = opacity;
  halo.opacity = glow;
  const pos = RING_C.clone().add(new THREE.Vector3(0, 0.02, -0.75));
  const q = useMemo(() => new THREE.Quaternion(), []);
  const m = new THREE.Matrix4().lookAt(camPos, pos, new THREE.Vector3(0, 1, 0));
  q.setFromRotationMatrix(m);
  const size = 2.25;
  return (
    <group position={pos} quaternion={q}>
      <mesh material={halo} position={[0, 0, -0.05]} scale={[size * 2.1, size * 2.1, 1]} visible={glow > 0.002} renderOrder={1}>
        <planeGeometry />
      </mesh>
      <mesh material={mat} scale={[size, size, 1]} visible={opacity > 0.002} renderOrder={2}>
        <planeGeometry />
      </mesh>
    </group>
  );
};
