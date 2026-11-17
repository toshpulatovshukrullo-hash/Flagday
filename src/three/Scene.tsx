import { ContactShadows, MeshReflectorMaterial } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import React, { useLayoutEffect, useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { FPS, texts } from '../config';
import { clamp01, easeExitFlow, easeFlow, flow, lerp, smoothstep } from '../motion';
import { T } from '../timeline';
import { Badge } from './Badge';
import { cameraPose, centrePoint, vfovFor } from './camera';
import { BIG, BIG_CENTER, SUB, buildWord } from './glyphs';
import { BigNumber, BigTransform, SubWord } from './Letters';
import { LogoHalo } from './Logo';
import { Ribbon } from './Ribbon';
import { buildRibbonPath, glyphReveal } from './ribbonPath';
import { Streaks } from './Streaks';
import { buildEnvMap } from './env';
import { HumoSculpture } from './Humo';
import { birdUniforms } from './materials';
import { PostFX } from './PostFX';
import { Sky } from './Sky';

export type SceneProps = { year: number; aspect: number; font3d: unknown; logo: THREE.Texture | null };

const CameraRig: React.FC<{ frame: number; aspect: number }> = ({ frame, aspect }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const { position, target } = cameraPose(frame);
    cam.position.copy(position);
    cam.fov = vfovFor(aspect);
    cam.near = 0.5; cam.far = 300;
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }, [camera, frame, aspect]);
  return null;
};

const Environment: React.FC<{ intensity: number }> = ({ intensity }) => {
  const { gl, scene } = useThree();
  const env = useMemo(() => buildEnvMap(gl), [gl]);
  useLayoutEffect(() => { scene.environment = env; }, [scene, env]);
  scene.environmentIntensity = intensity;
  return null;
};

const BADGE_DIST = 12;

export const Scene: React.FC<SceneProps> = ({ aspect, year, font3d, logo }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tx = texts(year);
  const words = useMemo(() => {
    const font = new Font(font3d as ConstructorParameters<typeof Font>[0]);
    const big = buildWord(font, tx.big, BIG, true);
    const sub = buildWord(font, tx.bigSub, SUB, false);
    return { big, sub, path: buildRibbonPath(big) };
  }, [font3d, tx.big, tx.bigSub]);
  const cam = cameraPose(frame);
  const camQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(cam.position, cam.target, new THREE.Vector3(0, 1, 0)));

  // ribbon → letters
  const headS = words.path.headAt(frame);
  const reveal = glyphReveal(words.path, headS);

  // finale: big number glides to the exact frame centre, faces the camera, then becomes the ring
  const glide = flow(frame, T.glide, T.glideDur);
  const toRing = flow(frame, T.ring, T.ringDur);
  const centre = centrePoint(frame, BADGE_DIST);
  const startDist = cam.position.distanceTo(BIG_CENTER);
  const bigXf: BigTransform = {
    position: BIG_CENTER.clone().lerp(centre, glide),
    quaternion: new THREE.Quaternion().slerp(camQ, glide),
    scale: lerp(1, BADGE_DIST / startDist, glide) * (1 - 0.35 * toRing),
    opacity: 1 - toRing,
  };
  const visH = 2 * BADGE_DIST * Math.tan(THREE.MathUtils.degToRad(vfovFor(aspect)) / 2);
  const badgeR = Math.min(0.31 * visH * aspect, 0.25 * visH);

  // logo: dissolves in behind the bird during the spiral, then stays subtly; out in the finale
  const logoIn = flow(frame, T.logoIn, T.logoInDur);
  const logoOut = flow(frame, T.finale, 0.9);
  const logoOpacity = logoIn * (1 - 0.12 * flow(frame, 6.0, 1.5)) * (1 - logoOut);
  const logoGlow = (0.55 * logoIn + 0.25 * Math.sin(Math.PI * logoIn)) * (1 - 0.4 * flow(frame, 6.0, 1.5)) * (1 - logoOut);

  // streaks/particles orbiting the letters
  const streaks = flow(frame, T.streaksIn, T.streaksDur) * (1 - flow(frame, T.finale, 0.8));

  // 0–2.2 s emergence from darkness
  const emerge = flow(frame, 0.0, 2.2);
  const rimIn = flow(frame, 0.1, 1.4);
  const sweepX = lerp(-6, 6, smoothstep(0.3, 2.3, t));
  const sweepI = Math.sin(Math.PI * clamp01((t - 0.3) / 2.0)) * 22;

  // bird slow rotation, decelerating in the finale
  const birdYaw = THREE.MathUtils.degToRad(-14 + 30 * easeFlow(clamp01(t / 12.5)));
  // finale: sink + dissolve
  const sink = flow(frame, T.birdOut, T.birdOutDur);
  birdUniforms.uDissolve.value = flow(frame, T.birdOut + 0.15, T.birdOutDur + 0.3, easeExitFlow);

  return (
    <>
      <CameraRig frame={frame} aspect={aspect} />
      <Environment intensity={0.08 + 1.1 * emerge} />
      <fog attach="fog" args={['#17407f', 18, 50]} />
      <Sky time={t} glow={0.4 + 0.6 * emerge} />

      <hemisphereLight args={['#6f8fd6', '#05070c', 0.12 + 0.2 * emerge]} />
      <directionalLight
        position={[-7, 10, 9]} intensity={3.2 * emerge} color="#ffe6c2" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={6}
        shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={9} shadow-camera-bottom={-3}
        shadow-camera-near={1} shadow-camera-far={40}
      />
      <directionalLight position={[6, 7, -9]} intensity={4.5 * rimIn} color="#9fbaff" />
      <directionalLight position={[-6, 4, -8]} intensity={3.5 * rimIn} color="#ffd29a" />
      <pointLight position={[sweepX, 6.4, 5.5]} intensity={sweepI} distance={12} decay={1.6} color="#fff0cf" />

      <group position={[0, -2.6 * sink, 0]}>
        <HumoSculpture birdYaw={birdYaw} />
      </group>

      <LogoHalo logo={logo} opacity={logoOpacity} glow={logoGlow} camPos={cam.position} />
      <Ribbon path={words.path} frame={frame} />
      <BigNumber glyphs={words.big} reveal={reveal} frame={frame} xf={bigXf} glow={0.25 * toRing} />
      <SubWord glyphs={words.sub} frame={frame} />
      <Streaks frame={frame} amount={streaks} />
      <Badge frame={frame} position={centre} quaternion={camQ} radius={badgeR} ringTop={tx.badgeRing} ringBottom={`${tx.big} ${tx.bigSub}`} />
      <ContactShadows position={[0, 0.005, 1.4]} scale={[9, 5]} resolution={512} blur={2.6} opacity={0.75 * (1 - glide)} far={3.5} frames={Infinity} color="#000000" />

      {/* Polished dark plaza floor with soft reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <MeshReflectorMaterial
          resolution={1024} blur={[300, 100]} mixBlur={0.9} mixStrength={0.9} mirror={0.5}
          depthScale={1.0} minDepthThreshold={0.4} maxDepthThreshold={1.3} roughness={0.9} metalness={0.5}
          color="#050a18" envMapIntensity={0.12}
        />
      </mesh>

      <PostFX frame={frame} edge={flow(frame, T.edgeIn, 1.2) * (1 - flow(frame, T.badge, 0.8)) * 0.9}
        focus={lerp(lerp(cam.position.distanceTo(new THREE.Vector3(0, 4.5, 0)), cam.position.distanceTo(BIG_CENTER), flow(frame, T.traceStart, 2.0)), cam.position.distanceTo(bigXf.position), glide)} focusRange={7} bokeh={2.2} bloom={0.55 + 0.6 * emerge} />
    </>
  );
};
