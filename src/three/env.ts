import * as THREE from 'three';

/**
 * Procedural "dusk studio" environment (no downloads): navy dome + a few emissive softboxes.
 * Gold reflects these as long, elegant highlights.
 */
export function buildEnvScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 64, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec3 vDir;
        void main(){
          float y = vDir.y;
          vec3 top = vec3(0.02,0.05,0.14), mid = vec3(0.05,0.12,0.30), hor = vec3(0.16,0.30,0.55), gnd = vec3(0.03,0.035,0.05);
          vec3 c = y > 0. ? mix(hor, mix(mid, top, smoothstep(0.25,0.9,y)), smoothstep(0.0,0.25,y)) : mix(hor*0.6, gnd, smoothstep(0.0,0.25,-y));
          // warm-blue glow low behind the subject (-z)
          float g = pow(max(dot(vDir, normalize(vec3(0.,0.15,-1.))),0.), 6.);
          c += vec3(0.55,0.62,0.85) * g * 1.4;
          gl_FragColor = vec4(c, 1.);
        }`,
    }),
  );
  scene.add(dome);
  const box = (w: number, h: number, color: THREE.ColorRepresentation, intensity: number, pos: THREE.Vector3Tuple) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 2, 0);
    scene.add(m);
  };
  box(14, 9, '#fff1d6', 5.0, [-16, 18, 14]);  // warm key softbox, upper left front
  box(4, 22, '#bcd6ff', 3.5, [22, 6, 4]);     // cool strip, right
  box(18, 3, '#ffd59a', 4.0, [0, 1.5, -24]);   // warm low rim behind
  box(3, 14, '#ffe7c4', 6.0, [-20, 4, -10]);   // back-left rim strip
  box(26, 2, '#9fc3ff', 1.6, [0, 26, 0]);      // faint top bar
  box(6, 6, '#ffffff', 2.5, [10, 12, 20]);     // small front-right fill
  return scene;
}

export function buildEnvMap(gl: THREE.WebGLRenderer): THREE.Texture {
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(buildEnvScene(), 0.0);
  pm.dispose();
  return rt.texture;
}
