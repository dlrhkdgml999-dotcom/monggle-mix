// 몽글믹스 — 맵 만들기 (마을, 말랑 들판, 물방울 호숫가)
import * as THREE from '../lib/three.min.js';
import { toon } from './models.js';

export const BOUNDS = { minX: -30, maxX: 60, minZ: -64, maxZ: 26 };
export const POND = { x: 4, z: -47, r: 9 };
export const CAULDRON = { x: 0, z: -2 };
export const HOME = { x: -7, z: 6 };
export const SPAWN = { x: 0, z: 5 };
const HOUSES = [{ x: -9, z: -7, r: 2.2 }, { x: 9, z: -8, r: 2.2 }, { x: 10, z: 8, r: 2.2 }, { x: -7, z: 9, r: 2.5 }];

function rng(seed) { // 고정 난수 → 맵이 매번 같게
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function buildWorld(scene) {
  const colorMats = []; // 색 되찾기용
  const track = (m) => { colorMats.push({ m, base: m.color.clone() }); return m; };
  const R = rng(7);

  // 하늘·안개
  scene.background = new THREE.Color(0xcfeeff);
  scene.fog = new THREE.Fog(0xcfeeff, 38, 80);

  // 바닥
  const groundMat = track(toon(0x9fe08a));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'ground';
  ground.position.set(15, 0, -19);
  scene.add(ground);

  const disc = (x, z, r, color, y = 0.01) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), track(toon(color)));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m;
  };
  // 마을 광장
  disc(0, 0, 13, 0xf3e2b8, 0.02);
  disc(CAULDRON.x, CAULDRON.z, 3.2, 0xe6cfa0, 0.03);
  // 길
  const path = (x1, z1, x2, z2, w = 2.6) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), track(toon(0xf0dcae)));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(x2 - x1, z2 - z1);
    m.position.set((x1 + x2) / 2, 0.015, (z1 + z2) / 2); m.receiveShadow = true; scene.add(m);
  };
  path(12, 1, 22, 4);
  path(2, -12, 4, -28);
  // 들판 (조금 더 진한 초록)
  disc(34, 6, 20, 0x8bd977, 0.008);
  // 호숫가 모래 + 물
  disc(POND.x, POND.z, POND.r + 4, 0xf6e6b4, 0.012);
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48),
    track(toon(0x6cc8ff, { transparent: true, opacity: 0.9 })));
  water.rotation.x = -Math.PI / 2; water.position.set(POND.x, 0.05, POND.z); scene.add(water);
  for (let i = 0; i < 7; i++) { // 연잎
    const a = R() * Math.PI * 2, d = R() * (POND.r - 2);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 16), track(toon(0x5cbf5a)));
    pad.position.set(POND.x + Math.cos(a) * d, 0.08, POND.z + Math.sin(a) * d); scene.add(pad);
    if (i % 2 === 0) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), track(toon(0xff9ecb)));
      f.position.copy(pad.position).add(new THREE.Vector3(0.2, 0.12, 0)); scene.add(f);
    }
  }

  // 나무
  const tree = (x, z, s = 1, kind = 0) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.2, 8), track(toon(0xa8744f)));
    trunk.position.y = 0.6; trunk.castShadow = true; g.add(trunk);
    const leafC = [0x6fcf6a, 0x8adf73, 0x5fbf8f][kind % 3];
    if (kind === 2) {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.25, 1.1, 10), track(toon(leafC)));
        c.position.y = 1.4 + i * 0.6; c.castShadow = true; g.add(c);
      }
    } else {
      for (const [dx, dy, dz, r] of [[0, 1.8, 0, 0.95], [0.5, 1.55, 0.2, 0.6], [-0.45, 1.6, -0.2, 0.62]]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), track(toon(leafC)));
        b.position.set(dx, dy, dz); b.castShadow = true; g.add(b);
      }
      if (kind === 1) for (let i = 0; i < 3; i++) {
        const ap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), track(toon(0xff6b6b)));
        ap.position.set(Math.cos(i * 2) * 0.7, 1.6 + i * 0.15, Math.sin(i * 2) * 0.7); g.add(ap);
      }
    }
    g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
  };
  // 맵 테두리 숲
  for (let i = 0; i < 90; i++) {
    const side = i % 4;
    let x, z;
    if (side === 0) { x = BOUNDS.minX - 2 + R() * 3; z = BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ); }
    else if (side === 1) { x = BOUNDS.maxX - 1 + R() * 3; z = BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ); }
    else if (side === 2) { z = BOUNDS.minZ - 2 + R() * 3; x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX); }
    else { z = BOUNDS.maxZ - 1 + R() * 3; x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX); }
    tree(x, z, 1 + R() * 0.6, Math.floor(R() * 3));
  }
  // 구역 사이 나무
  for (const [x, z, k] of [[14, -10, 0], [17, -14, 2], [-16, -10, 1], [-20, -20, 2], [24, -22, 0], [20, -30, 1],
    [-14, -32, 0], [-18, 12, 2], [10, 16, 1], [46, 20, 0], [52, -8, 2], [28, -8, 1], [-24, 0, 0], [40, -14, 0]]) {
    tree(x, z, 1.1, k);
  }

  // 꽃
  const flowerCols = [0xff9ecb, 0xffe066, 0xffffff, 0xb48cff, 0xff8a5c];
  for (let i = 0; i < 140; i++) {
    const x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX);
    const z = BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (Math.hypot(x, z) < 12 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 1) continue;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), track(toon(flowerCols[i % 5])));
    f.position.set(x, 0.18, z); scene.add(f);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), track(toon(0x5cbf5a)));
    st.position.set(x, 0.09, z); scene.add(st);
  }
  // 덤불
  for (let i = 0; i < 40; i++) {
    const x = BOUNDS.minX + 3 + R() * (BOUNDS.maxX - BOUNDS.minX - 6);
    const z = BOUNDS.minZ + 3 + R() * (BOUNDS.maxZ - BOUNDS.minZ - 6);
    if (Math.hypot(x, z) < 14 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2) continue;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), track(toon(0x76c96a)));
    b.scale.set(1.2, 0.7, 1); b.position.set(x, 0.3, z); b.castShadow = true; scene.add(b);
  }

  // 마을 집
  const house = (x, z, wall, roof, rot = 0, big = 1) => {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.BoxGeometry(3 * big, 2.2, 2.6 * big), track(toon(wall)));
    w.position.y = 1.1; w.castShadow = true; w.receiveShadow = true; g.add(w);
    const r = new THREE.Mesh(new THREE.ConeGeometry(2.6 * big, 1.8, 4), track(toon(roof)));
    r.position.y = 3.0; r.rotation.y = Math.PI / 4; r.scale.z = 0.85; r.castShadow = true; g.add(r);
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), track(toon(0x9a6a45)));
    d.position.set(0, 0.6, 1.31 * big); g.add(d);
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), track(toon(0xfff3a8, { emissive: 0xfff3a8, emissiveIntensity: 0.3 })));
      win.position.set(sx * 0.95 * big, 1.35, 1.31 * big); g.add(win);
    }
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), track(toon(0xc98b6b)));
    ch.position.set(0.7 * big, 3.3, -0.3); g.add(ch);
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
    return g;
  };
  house(-9, -7, 0xfff1e0, 0xff8f8f, 0.6);
  house(9, -8, 0xe8f4ff, 0x7cb8ff, -0.6);
  house(10, 8, 0xfff8d6, 0x8fd18f, -2.4);
  house(HOME.x, HOME.z + 3, 0xffe8f2, 0xff9ecb, 2.6, 1.15); // 우리 집

  // 표지판
  const sign = (x, z, rot) => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), track(toon(0xa8744f)));
    p.position.y = 0.7; g.add(p);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.1), track(toon(0xf3d9a8)));
    b.position.y = 1.3; g.add(b);
    g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
  };
  sign(13, 4, -1.2); sign(4, -13, 0.1);

  // 믹스 솥
  const caul = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65),
    track(toon(0x5b5170)));
  pot.position.y = 1.05; pot.castShadow = true; caul.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 10, 32), track(toon(0x7a6f92)));
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.6; caul.add(rim);
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(1.08, 32),
    new THREE.MeshToonMaterial({ color: 0xb48cff, emissive: 0xb48cff, emissiveIntensity: 0.15 }));
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = 1.5; caul.add(liquid);
  for (const a of [0, 2.1, 4.2]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 6), track(toon(0x5b5170)));
    leg.position.set(Math.cos(a) * 0.8, 0.2, Math.sin(a) * 0.8); caul.add(leg);
  }
  const bubbles = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xe2d4ff, transparent: true, opacity: 0.8 }));
    b.userData.t = i / 6; caul.add(b); bubbles.push(b);
  }
  caul.position.set(CAULDRON.x, 0, CAULDRON.z);
  scene.add(caul);

  // 구름 (멀리 떠다님)
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(1.4 + R(), 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      p.position.set(j * 1.5 - 2, R() * 0.6, R()); c.add(p);
    }
    c.position.set(BOUNDS.minX + R() * 90, 16 + R() * 5, BOUNDS.minZ + R() * 90);
    scene.add(c); clouds.push(c);
  }

  // 색 되찾기: 0(파스텔·빛바램) → 1(선명)
  function setVivid(t) {
    const s = 0.45 + 0.55 * t;
    for (const { m, base } of colorMats) {
      const hsl = {}; base.getHSL(hsl);
      m.color.setHSL(hsl.h, hsl.s * s, Math.min(0.95, hsl.l + (1 - s) * 0.12));
    }
    liquid.material.emissiveIntensity = 0.15 + 0.5 * t;
  }

  function update(dt, time) {
    for (const b of bubbles) {
      b.userData.t = (b.userData.t + dt * 0.5) % 1;
      const t = b.userData.t;
      b.position.set(Math.sin(t * 20 + b.id) * 0.5, 1.5 + t * 1.2, Math.cos(t * 17 + b.id) * 0.5);
      b.material.opacity = 0.8 * (1 - t);
    }
    for (const c of clouds) {
      c.position.x += dt * 0.6;
      if (c.position.x > BOUNDS.maxX + 20) c.position.x = BOUNDS.minX - 20;
    }
    water.material.color.offsetHSL(0, 0, Math.sin(time * 1.5) * 0.0004);
  }

  return { ground, setVivid, update, liquid };
}

export function clampToWorld(p) {
  p.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, p.x));
  p.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, p.z));
  // 연못 안으로 못 들어가게
  const dx = p.x - POND.x, dz = p.z - POND.z, d = Math.hypot(dx, dz);
  if (d < POND.r - 0.3) {
    const k = (POND.r - 0.3) / (d || 1);
    p.x = POND.x + dx * k; p.z = POND.z + dz * k;
  }
  // 집
  for (const hs of HOUSES) {
    const hx = p.x - hs.x, hz = p.z - hs.z, hd = Math.hypot(hx, hz);
    if (hd < hs.r) { const k = hs.r / (hd || 1); p.x = hs.x + hx * k; p.z = hs.z + hz * k; }
  }
  // 솥
  const cx = p.x - CAULDRON.x, cz = p.z - CAULDRON.z, cd = Math.hypot(cx, cz);
  if (cd < 1.6) { const k = 1.6 / (cd || 1); p.x = CAULDRON.x + cx * k; p.z = CAULDRON.z + cz * k; }
  return p;
}
