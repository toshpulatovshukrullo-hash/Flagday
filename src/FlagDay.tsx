import { ThreeCanvas } from '@remotion/three';
import React, { useEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import * as THREE from 'three';
import { FlagDayProps, SKY, texts } from './config';
import { LowerThird } from './overlay/LowerThird';
import { Scene } from './three/Scene';

/** Loads fonts (CSS + 3D typeface) and the logo once; blocks rendering until ready. */
function useAssets() {
  const [handle] = useState(() => delayRender('Loading fonts & logo'));
  const [state, setState] = useState<{ font3d: unknown; logo: THREE.Texture | null; ready: boolean }>({ font3d: null, logo: null, ready: false });
  useEffect(() => {
    const faces = [
      new FontFace('Montserrat', `url(${staticFile('fonts/Montserrat-SemiBold.ttf')})`, { weight: '600' }),
      new FontFace('Montserrat', `url(${staticFile('fonts/Montserrat-Regular.ttf')})`, { weight: '400' }),
      new FontFace('Playfair Display', `url(${staticFile('fonts/PlayfairDisplay-ExtraBold.ttf')})`, { weight: '800' }),
    ];
    Promise.all([
      ...faces.map((f) => f.load().then((ff) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(ff))),
      fetch(staticFile('fonts/playfair-800.typeface.json')).then((r) => r.json()),
      new THREE.TextureLoader().loadAsync(staticFile('logo_terdu.png')).catch(() => null),
    ]).then((res) => {
      const font3d = res[faces.length];
      const logo = res[faces.length + 1] as THREE.Texture | null;
      if (logo) { logo.colorSpace = THREE.SRGBColorSpace; logo.anisotropy = 8; }
      setState({ font3d, logo, ready: true });
      continueRender(handle);
    });
  }, [handle]);
  return state;
}

export const FlagDay: React.FC<FlagDayProps> = ({ year, width, height }) => {
  const assets = useAssets();
  useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: SKY.top }}>
      {assets.ready ? (
        <ThreeCanvas width={width} height={height} shadows="soft" dpr={1}
          gl={{ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
          camera={{ fov: 35, position: [0, 4, 24], near: 0.5, far: 300 }}>
          <Scene year={year} aspect={width / height} font3d={assets.font3d} logo={assets.logo} />
        </ThreeCanvas>
      ) : null}
      {assets.ready ? <LowerThird lines={texts(year).lowerThird} accent={`${texts(year).YEARS} yilligi`} width={width} height={height} /> : null}
    </AbsoluteFill>
  );
};
