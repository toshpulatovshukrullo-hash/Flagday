import { useFrame, useThree } from '@react-three/fiber';
import {
  BloomEffect, DepthOfFieldEffect, Effect, EffectAttribute, EffectComposer, EffectPass, RenderPass,
} from 'postprocessing';
import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Final grade in ONE pass: subtle chromatic aberration, frame-edge blur, highlight-only soft knee
 * (values ≤ 0.95 untouched so flag/logo colours are not re-graded), vignette, seeded film grain.
 */
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */`
      uniform float uFrame, uEdge, uCA, uVig, uGrain, uAspect;
      float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec2 d = uv - 0.5; d.x *= uAspect;
        float r = length(d);
        vec2 dir = (uv - 0.5);
        // chromatic aberration grows toward the edges
        vec2 off = dir * uCA * r;
        vec3 col = vec3(texture2D(inputBuffer, uv + off).r, inputColor.g, texture2D(inputBuffer, uv - off).b);
        // edge blur (radial mask)
        float m = smoothstep(0.28, 0.72, r) * uEdge;
        if (m > 0.002) {
          vec3 acc = col; float wsum = 1.0;
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996;
            float rr = sqrt(float(i) + 0.5) / 3.5;
            vec2 o = vec2(cos(a), sin(a)) * rr * m * 0.018 * vec2(1.0 / uAspect, 1.0);
            acc += texture2D(inputBuffer, uv + o).rgb; wsum += 1.0;
          }
          col = mix(col, acc / wsum, clamp(m * 1.6, 0.0, 1.0));
          col *= 1.0 - 0.18 * m;
        }
        // highlight-only soft knee (preserves hue)
        float mx = max(col.r, max(col.g, col.b));
        if (mx > 0.95) { float k = 0.95 + 0.05 * (1.0 - exp(-(mx - 0.95) / 0.05)); col *= k / mx; }
        // vignette
        col *= mix(1.0, smoothstep(1.05, 0.25, r), uVig);
        // seeded grain (changes per frame deterministically)
        float g = gh(uv * resolution + vec2(uFrame * 17.0, uFrame * 31.0)) - 0.5;
        col += g * uGrain * (0.35 + 0.65 * (1.0 - mx));
        outputColor = vec4(max(col, 0.0), inputColor.a);
      }`, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['uFrame', new THREE.Uniform(0)], ['uEdge', new THREE.Uniform(0)], ['uCA', new THREE.Uniform(0.006)],
        ['uVig', new THREE.Uniform(0.55)], ['uGrain', new THREE.Uniform(0.022)], ['uAspect', new THREE.Uniform(0.5625)],
      ]),
    });
  }
}

export type PostParams = { frame: number; edge: number; focus: number; focusRange: number; bokeh: number; bloom: number };

export const PostFX: React.FC<PostParams> = (p) => {
  const { gl, scene, camera, size } = useThree();
  const fx = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, { focusDistance: 21, focusRange: 6, bokehScale: 2.0, resolutionScale: 0.5 });
    const bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.25, intensity: 0.9, mipmapBlur: true, radius: 0.7 });
    const grade = new GradeEffect();
    composer.addPass(new EffectPass(camera, dof));
    composer.addPass(new EffectPass(camera, bloom));
    composer.addPass(new EffectPass(camera, grade));
    return { composer, dof, bloom, grade };
  }, [gl, scene, camera]);

  useLayoutEffect(() => { fx.composer.setSize(size.width, size.height); }, [fx, size.width, size.height]);

  // Per-frame parameters (deterministic, set before the R3F advance renders)
  fx.dof.cocMaterial.focusDistance = p.focus;
  fx.dof.cocMaterial.focusRange = p.focusRange;
  fx.dof.bokehScale = p.bokeh;
  fx.bloom.intensity = p.bloom;
  fx.grade.uniforms.get('uFrame')!.value = p.frame;
  fx.grade.uniforms.get('uEdge')!.value = p.edge;
  fx.grade.uniforms.get('uAspect')!.value = size.width / size.height;

  useFrame(() => { fx.composer.render(1 / 30); }, 1);
  return null;
};
