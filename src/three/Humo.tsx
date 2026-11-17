/**
 * Procedural Humo-bird sculpture + pedestal, modelled after the reference photo
 * (assets/reference/humo_monument.jpg): wings rising into an almost closed ring of openwork feathers,
 * small crested head facing right, lattice spindle body held in a lens-shaped bronze frame,
 * flared stone side panels with tile borders. This is an original stylisation, not a scan.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { bronzeMaterial, goldMaterial, makeDissolvable, mosaicTexture, stoneMaterial } from './materials';

export const RING_C = new THREE.Vector3(0, 6.3, 0); // wing-ring centre
export const RING_R = 1.32;

function latticeAlpha(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 1024);
  g.strokeStyle = '#fff'; g.lineWidth = 9;
  for (let k = -16; k <= 32; k++) {
    g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 + 512, 1024); g.stroke();
    g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64 - 512, 1024); g.stroke();
  }
  g.lineWidth = 12;
  for (let y = 0; y <= 1024; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
  return t;
}

function featherAlpha(): THREE.CanvasTexture {
  // u: base→tip (0..1), v: across vane. Openwork slits angled toward the tip.
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#000'; g.lineWidth = 7; g.lineCap = 'round';
  for (let x = 40; x < 470; x += 26) {
    g.beginPath(); g.moveTo(x, 54); g.lineTo(x + 34, 14); g.stroke();
    g.beginPath(); g.moveTo(x, 74); g.lineTo(x + 34, 114); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function featherGeometry(): THREE.BufferGeometry {
  // Unit-length lanceolate feather along +x, half-width 0.1.
  const s = new THREE.Shape();
  const N = 24, pts: THREE.Vector2[] = [];
  for (let i = 0; i <= N; i++) { const x = i / N; pts.push(new THREE.Vector2(x, 0.1 * Math.pow(Math.sin(Math.PI * Math.pow(x, 0.75)), 0.8) + 0.012 * (1 - x))); }
  for (let i = N; i >= 0; i--) { const x = i / N; pts.push(new THREE.Vector2(x, -0.1 * Math.pow(Math.sin(Math.PI * Math.pow(x, 0.75)), 0.8) - 0.012 * (1 - x))); }
  s.setFromPoints(pts);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 4 });
  // remap cap UVs from shape space to 0..1 (u along, v across)
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), (uv.getY(i) + 0.125) / 0.25);
  geo.translate(0, 0, -0.007);
  return geo;
}

type FeatherInst = { m: THREE.Matrix4 };
function buildFeathers(): FeatherInst[] {
  const out: FeatherInst[] = [];
  const C = RING_C, R = RING_R;
  const rows = [
    { n: 24, len: (u: number) => 0.7 + 1.05 * Math.pow(1 - u, 1.1), sweep: (u: number) => 0.28, hang: 0.95, z: -0.06, w: 0.6 },
    { n: 22, len: (u: number) => 0.48 + 0.62 * Math.pow(1 - u, 1.1), sweep: (u: number) => 0.24, hang: 0.8, z: 0.0, w: 0.6 },
    { n: 20, len: (u: number) => 0.3 + 0.25 * (1 - u), sweep: (u: number) => 0.2, hang: 0.55, z: 0.06, w: 0.62 },
  ];
  const P = (u: number) => {
    const th = THREE.MathUtils.degToRad(250 - 156 * u);
    return new THREE.Vector3(C.x + R * Math.cos(th), C.y + R * Math.sin(th), 0.22 * Math.sin(Math.PI * u));
  };
  for (const side of [-1, 1]) {
    rows.forEach((row, ri) => {
      for (let i = 0; i < row.n; i++) {
        const u = 0.04 + 0.95 * (i + (ri % 2) * 0.5) / row.n;
        const p = P(u);
        const nrm = new THREE.Vector3(p.x - C.x, p.y - C.y, 0).normalize();
        const back = P(Math.max(0, u - 0.01)).sub(p).normalize(); // toward shoulder
        const a = row.sweep(u);
        const dir0 = nrm.clone().multiplyScalar(Math.cos(a)).add(back.clone().multiplyScalar(Math.sin(a))).normalize();
        // feathers hang progressively downward toward the shoulder (reference silhouette)
        const dir = dir0.lerp(new THREE.Vector3(0, -1, 0), row.hang * Math.pow(1 - u, 1.05) * 0.85).normalize();
        const lenF = row.len(u);
        // basis: x = dir, z ≈ view normal tilted for volume
        const zt = new THREE.Vector3(0.25 * Math.sin(u * 9 + ri), 0, 1).normalize();
        const y = new THREE.Vector3().crossVectors(zt, dir).normalize();
        const z = new THREE.Vector3().crossVectors(dir, y).normalize();
        const basis = new THREE.Matrix4().makeBasis(dir, y, z);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(p.x, p.y, p.z + row.z), new THREE.Quaternion().setFromRotationMatrix(basis),
          new THREE.Vector3(lenF, row.w * (0.75 + 0.4 * lenF), 1),
        );
        if (side === 1) m.premultiply(new THREE.Matrix4().makeScale(-1, 1, 1));
        out.push({ m });
      }
    });
  }
  return out;
}

function vesica(w: number, h: number, inset = 0): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) { const t = i / N; const y = -h / 2 + h * t; pts.push(new THREE.Vector2((w / 2 - inset) * Math.pow(Math.sin(Math.PI * t), 0.75), y)); }
  for (let i = N - 1; i > 0; i--) { const t = i / N; const y = -h / 2 + h * t; pts.push(new THREE.Vector2(-(w / 2 - inset) * Math.pow(Math.sin(Math.PI * t), 0.75), y)); }
  return pts;
}

export const HumoSculpture: React.FC<{ birdYaw: number }> = ({ birdYaw }) => {
  const parts = useMemo(() => {
    const gold = makeDissolvable(goldMaterial());
    const goldLattice = makeDissolvable(goldMaterial({ alphaMap: latticeAlpha(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.28 }));
    const goldFeather = makeDissolvable(goldMaterial({ alphaMap: featherAlpha(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.24 }));
    const bronze = makeDissolvable(bronzeMaterial());
    const stone = makeDissolvable(stoneMaterial());
    const mosaicMat = makeDissolvable(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: mosaicTexture(), roughness: 0.45, metalness: 0.1, envMapIntensity: 0.6 }));

    // Body: lattice spindle
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40; const y = 1.15 + t * 3.95;
      const r = 0.05 + 0.33 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.9) + (t > 0.9 ? 0.06 * (t - 0.9) / 0.1 : 0);
      prof.push(new THREE.Vector2(r, y));
    }
    const body = new THREE.LatheGeometry(prof, 48);
    const core = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x * 0.45, p.y)), 24);

    // Neck & head
    const neckCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 4.95, 0), new THREE.Vector3(0.02, 5.25, 0.02), new THREE.Vector3(0.08, 5.5, 0.04)]);
    const neck = new THREE.TubeGeometry(neckCurve, 24, 0.105, 16, false);
    const head = new THREE.SphereGeometry(0.22, 32, 16); head.scale(1.55, 0.95, 0.95);
    const beak = new THREE.ConeGeometry(0.085, 0.42, 16); beak.rotateZ(-Math.PI / 2 - 0.35);
    const crest = featherGeometry();

    // Wing bones
    const bone = (sx: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
      Array.from({ length: 24 }, (_, i) => { const u = i / 23; const th = THREE.MathUtils.degToRad(250 - 156 * u);
        return new THREE.Vector3(sx * (RING_C.x + RING_R * Math.cos(th)), RING_C.y + RING_R * Math.sin(th), 0.22 * Math.sin(Math.PI * u)); })),
      96, 0.045, 10, false);
    const shoulder = (sx: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 4.9, 0), new THREE.Vector3(sx * 0.3, 5.0, 0.0),
      new THREE.Vector3(sx * (RING_R * Math.cos(THREE.MathUtils.degToRad(250))), RING_C.y + RING_R * Math.sin(THREE.MathUtils.degToRad(250)), 0)]), 16, 0.06, 10, false);

    const feathers = new THREE.InstancedMesh(featherGeometry(), goldFeather, buildFeathers().length);
    buildFeathers().forEach((f, i) => feathers.setMatrixAt(i, f.m));
    feathers.instanceMatrix.needsUpdate = true;
    feathers.castShadow = true;

    // Bronze lens frame around the body
    const fs = new THREE.Shape(vesica(1.25, 4.1)); fs.holes.push(new THREE.Path(vesica(1.25, 4.1, 0.16).reverse()));
    const frame = new THREE.ExtrudeGeometry(fs, { depth: 0.22, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 8 });
    frame.translate(0, 2.95, -0.11);

    // Flared side panels (stone) + tile border strips
    const panel = (sx: number) => {
      const s = new THREE.Shape();
      const outer = (y: number) => 0.62 + 0.78 * Math.pow(y / 3.5, 2.2);
      s.moveTo(sx * 0.42, 0);
      for (let i = 0; i <= 20; i++) { const y = (i / 20) * 3.5; s.lineTo(sx * outer(y), y); }
      s.lineTo(sx * 0.5, 3.15); s.lineTo(sx * 0.42, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 6 });
      g.translate(0, 0, -0.1);
      // border strip geometry following the outer edge
      const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
      const N = 40, bw = 0.11;
      for (let i = 0; i <= N; i++) {
        const y = (i / N) * 3.5, x = outer(y);
        const dy = 0.01, dx = outer(Math.min(3.5, y + dy)) - x;
        const nx = dy, ny = -dx; const L = Math.hypot(nx, ny);
        const ix = x - (bw * nx) / L, iy = y - (bw * ny) / L;
        pos.push(sx * x, y, 0.125, sx * ix, iy, 0.125);
        uvs.push(1, y * 1.6, 0, y * 1.6);
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const b = new THREE.BufferGeometry();
      b.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      b.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      b.setIndex(idx); b.computeVertexNormals();
      return { g, b };
    };
    const pl = panel(-1), pr = panel(1);
    const plinth = new THREE.BoxGeometry(3.2, 0.28, 1.5); plinth.translate(0, 0.14, 0);

    return { gold, goldLattice, goldFeather, bronze, stone, mosaicMat, body, core, neck, head, beak, crest, boneL: bone(-1), boneR: bone(1), shL: shoulder(-1), shR: shoulder(1), feathers, frame, pl, pr, plinth };
  }, []);

  const P = parts;
  return (
    <group>
      {/* Pedestal (static) */}
      <mesh geometry={P.plinth} material={P.stone} castShadow receiveShadow />
      {[P.pl, P.pr].map((p, i) => (
        <group key={i} rotation={[0, (i === 0 ? 1 : -1) * 0.42, 0]} position={[0, 0.0, -0.15]}>
          <mesh geometry={p.g} material={P.stone} castShadow receiveShadow />
          <mesh geometry={p.b} material={P.mosaicMat} receiveShadow />
        </group>
      ))}
      <mesh geometry={P.frame} material={P.bronze} castShadow receiveShadow />
      {/* Bird (slow rotation) */}
      <group rotation={[0, birdYaw, 0]}>
        <mesh geometry={P.body} material={P.goldLattice} castShadow />
        <mesh geometry={P.core} material={P.gold} />
        <mesh geometry={P.neck} material={P.gold} castShadow />
        <group position={[0.16, 5.56, 0.05]} rotation={[0, -0.35, 0.08]}>
          <mesh geometry={P.head} material={P.gold} castShadow />
          <mesh geometry={P.beak} material={P.gold} position={[0.5, -0.06, 0]} />
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} geometry={P.crest} material={P.goldFeather}
              position={[-0.24, 0.1, (k - 1.5) * 0.035]} rotation={[0.15 * (k - 1.5), 0, Math.PI - 0.35 - k * 0.14]}
              scale={[0.75 - k * 0.08, 1.1, 1]} />
          ))}
        </group>
        <mesh geometry={P.boneL} material={P.gold} castShadow />
        <mesh geometry={P.boneR} material={P.gold} castShadow />
        <mesh geometry={P.shL} material={P.gold} />
        <mesh geometry={P.shR} material={P.gold} />
        <primitive object={P.feathers} />
      </group>
    </group>
  );
};
