import * as THREE from 'three';

/** Shared uniforms for the bird's noise-dissolve / darkness (finale & emergence). */
export const birdUniforms = {
  uDissolve: { value: 0 },   // 0 = solid, 1 = fully dissolved
  uEdgeGlow: { value: new THREE.Color('#ffd27a') },
};

const NOISE = /* glsl */ `
  float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

/** Patches a standard/physical material so it can dissolve with a glowing gold edge (bird finale). */
export function makeDissolvable<T extends THREE.MeshStandardMaterial>(mat: T, uniforms = birdUniforms): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = uniforms.uDissolve;
    shader.uniforms.uEdgeGlow = uniforms.uEdgeGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldP = (modelMatrix * vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWorldP;\nuniform float uDissolve;\nuniform vec3 uEdgeGlow;\n${NOISE}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float dn = fbm3(vWorldP*2.2) * 0.85 + (vWorldP.y*0.02);
        float thr = uDissolve * 1.05;
        if (dn < thr) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float edge = 1.0 - smoothstep(0.0, 0.05, dn - thr);
        totalEmissiveRadiance += uEdgeGlow * edge * step(0.001, uDissolve) * 1.4;`);
  };
  mat.customProgramCacheKey = () => 'dissolve';
  return mat;
}

export function goldMaterial(opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 0.74, 0.32), metalness: 1, roughness: 0.22, envMapIntensity: 1.25,
    clearcoat: 0.25, clearcoatRoughness: 0.15, ...opts,
  });
}

export function bronzeMaterial() {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a3a20'), metalness: 0.85, roughness: 0.48, envMapIntensity: 0.9 });
}

export function stoneMaterial() {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color('#2b2a2e'), metalness: 0.05, roughness: 0.78, envMapIntensity: 0.5 });
}

/** Original geometric tile band (turquoise / lapis / ochre / white) for the pedestal edges. */
export function mosaicTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#132a4a'; g.fillRect(0, 0, 64, 512);
  const cols = ['#2aa6b8', '#1d4e8f', '#d9a441', '#e9e4d6'];
  for (let y = 0; y < 512; y += 32) {
    for (let k = 0; k < 4; k++) {
      g.fillStyle = cols[(k + y / 32) % 4];
      const s = 28 - k * 7;
      g.save(); g.translate(32, y + 16); g.rotate(Math.PI / 4); g.fillRect(-s / 2, -s / 2, s, s); g.restore();
    }
    g.fillStyle = '#e9e4d6'; g.fillRect(0, y, 6, 32); g.fillRect(58, y, 6, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
