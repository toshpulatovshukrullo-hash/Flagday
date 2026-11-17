import * as THREE from 'three';
import { FPS } from '../config';
import { monotoneCubic } from '../motion';

/** World-space framing: visible height (world units) at FRAME_DIST from the target. Layout is designed for 9:16. */
export const VIEW_H = 16.4;
export const FRAME_DIST = 21;
export const vfovFor = (aspect: number) => {
  // Portrait/square/4:5 all keep the full vertical composition; very wide frames also keep min width.
  const h = Math.max(VIEW_H, 7.7 / aspect);
  return THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / FRAME_DIST));
};

const K = (pairs: Array<[number, number]>) => monotoneCubic(pairs.map((p) => p[0] * FPS), pairs.map((p) => p[1]), [0, 0]);
const dist = K([[0, 27.5], [2.2, 23.5], [5.5, 22], [8, 21], [11, 20.7], [14, 21.4]]);
const yaw = K([[0, -16], [2.2, -11], [5.5, -4], [8, 2], [11, 6], [14, 9]]);
const pitch = K([[0, 2], [2.2, 4], [8, 5], [14, 5]]);
const targetY = K([[0, 5.0], [2.2, 4.6], [5.5, 3.0], [7.6, 2.15], [14, 2.15]]);

export type CamPose = { position: THREE.Vector3; target: THREE.Vector3 };
export function cameraPose(frame: number): CamPose {
  const d = dist(frame), yw = THREE.MathUtils.degToRad(yaw(frame)), pt = THREE.MathUtils.degToRad(pitch(frame));
  const target = new THREE.Vector3(0, targetY(frame), 0);
  const position = new THREE.Vector3(
    d * Math.cos(pt) * Math.sin(yw), target.y + d * Math.sin(pt), d * Math.cos(pt) * Math.cos(yw),
  );
  return { position, target };
}

/** A point on the optical axis at distance `d` from the camera → projects to the exact frame centre. */
export function centrePoint(frame: number, d: number): THREE.Vector3 {
  const { position, target } = cameraPose(frame);
  return position.clone().add(target.clone().sub(position).normalize().multiplyScalar(d));
}
