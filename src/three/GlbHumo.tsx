import { useGLTF } from '@react-three/drei';
import React, { useMemo } from 'react';
import { staticFile } from 'remotion';
import * as THREE from 'three';
import { makeDissolvable } from './materials';

/** Optional user-supplied model (assets/humo.glb → public/humo.glb): normalised to ~8.6 units tall, base on the floor. */
export const GlbHumo: React.FC<{ birdYaw: number }> = ({ birdYaw }) => {
  const gltf = useGLTF(staticFile('humo.glb'));
  const obj = useMemo(() => {
    const root = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = 8.6 / Math.max(1e-6, size.y);
    root.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => { if ((mt as THREE.MeshStandardMaterial).isMeshStandardMaterial) makeDissolvable(mt as THREE.MeshStandardMaterial); });
    });
    return root;
  }, [gltf]);
  return <group rotation={[0, birdYaw, 0]}><primitive object={obj} /></group>;
};
