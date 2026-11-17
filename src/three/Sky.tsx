import React, { useMemo } from 'react';
import * as THREE from 'three';
import { SKY } from '../config';

/** Dark-blue gradient dome with 3 parallax layers of soft fbm clouds, lit from below/behind. Deterministic (uTime = frame/30). */
export const Sky: React.FC<{ time: number; glow: number }> = ({ time, glow }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 }, uGlow: { value: 1 },
      cTop: { value: new THREE.Color(SKY.top) }, cMid: { value: new THREE.Color(SKY.mid) }, cHor: { value: new THREE.Color(SKY.horizon) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uTime, uGlow; uniform vec3 cTop, cMid, cHor;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5,s=0.; mat2 r=mat2(.8,.6,-.6,.8); for(int i=0;i<5;i++){ s+=a*n2(p); p=r*p*2.02; a*=.5; } return s; }
      float layer(vec2 uv, float sc, vec2 drift, float cover){
        float n = fbm(uv*sc + drift);
        float m = fbm(uv*sc*0.5 - drift*0.5 + 7.3);
        return smoothstep(cover, cover+0.35, n*0.75 + m*0.45);
      }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        // gradient: horizon (#17407f) → mid (#0b2150) → near-navy top (#050d24)
        vec3 col = mix(cHor, cMid, smoothstep(-0.02, 0.22, y));
        col = mix(col, cTop, smoothstep(0.22, 0.6, y));
        // sky coordinates (azimuth, elevation) — layers drift at different speeds = parallax
        float az = atan(d.x, -d.z);
        vec2 uv = vec2(az, y / max(0.15, 0.35 + y));
        float c1 = layer(uv + vec2(0.0, 0.0), 2.0, vec2(uTime*0.010, 0.0), 0.62);
        float c2 = layer(uv + vec2(3.1, 0.4), 3.4, vec2(uTime*0.018, 0.0), 0.64);
        float c3 = layer(uv + vec2(9.7, 0.9), 5.2, vec2(uTime*0.030, 0.0), 0.66);
        // lit from below/behind: faint warm-blue glow centred behind the sculpture, low on the horizon
        float behind = pow(max(dot(d, normalize(vec3(0.0, 0.10, -1.0))), 0.0), 4.0);
        vec3 lightCol = vec3(0.30, 0.40, 0.70);
        float under = smoothstep(0.45, 0.0, y);
        vec3 cloudCol1 = mix(cMid*1.5, lightCol*0.30, clamp(behind*0.9 + under*0.2, 0., 1.));
        vec3 cloudCol2 = mix(cMid*1.8, lightCol*0.40, clamp(behind*0.9 + under*0.25, 0., 1.));
        vec3 cloudCol3 = mix(cHor*1.05, lightCol*0.45, clamp(behind*0.8 + under*0.2, 0., 1.));
        float fadeTop = 1.0 - smoothstep(0.55, 0.95, y);
        float fadeLow = smoothstep(-0.05, 0.06, y);
        col = mix(col, cloudCol1, c1 * 0.55 * fadeTop * fadeLow);
        col = mix(col, cloudCol2, c2 * 0.40 * fadeTop * fadeLow);
        col = mix(col, cloudCol3, c3 * 0.25 * fadeTop * fadeLow);
        // thin bright cloud rims catching the glow from behind
        col += lightCol * 0.10 * (c2 * (1.0 - c1)) * (behind + 0.25) * fadeLow;
        col += lightCol * behind * 0.10 * uGlow;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);
  mat.uniforms.uTime.value = time;
  mat.uniforms.uGlow.value = glow;
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[80, 64, 32]} />
    </mesh>
  );
};
