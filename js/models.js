// 몽글믹스 — 코드로 만드는 귀여운 3D 모델 (몽글이 12종 + 주인공)
// 외부 그림 파일 없이 동그란 도형을 조합해서 만든다. 모양을 바꾸려면 여기만 고치면 된다.
import * as THREE from '../lib/three.min.js';

// 툰 셰이딩용 3단 그라데이션
const gradTex = (() => {
  const data = new Uint8Array([90, 90, 90, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();

export function toon(hex, extra = {}) {
  return new THREE.MeshToonMaterial({ color: hex, gradientMap: gradTex, ...extra });
}

const geoCache = {};
function sphereGeo(seg = 20) {
  return geoCache['s' + seg] || (geoCache['s' + seg] = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
}
function coneGeo(seg = 14) {
  return geoCache['c' + seg] || (geoCache['c' + seg] = new THREE.ConeGeometry(1, 1, seg));
}
function cylGeo(seg = 16) {
  return geoCache['y' + seg] || (geoCache['y' + seg] = new THREE.CylinderGeometry(1, 1, 1, seg));
}

function mesh(geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy ?? sx, sz ?? sx);
  m.castShadow = true;
  return m;
}
const ball = (mat, x, y, z, sx, sy, sz) => mesh(sphereGeo(), mat, x, y, z, sx, sy, sz);
const cone = (mat, x, y, z, r, h) => mesh(coneGeo(), mat, x, y, z, r, h, r);
const cyl = (mat, x, y, z, r, h) => mesh(cylGeo(), mat, x, y, z, r, h, r);

const BLACK = () => toon(0x2b2233);
const WHITE = () => new THREE.MeshBasicMaterial({ color: 0xffffff });
const BLUSH = () => new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.75 });

// 얼굴: 동글동글 반짝이는 눈 + 볼터치 + 웃는 입
const smileGeo = new THREE.TorusGeometry(1, 0.28, 6, 14, Math.PI);
function face(g, y, z, spread = 0.17, s = 1) {
  z += 0.02;
  const eye = toon(0x3a2838), hi = WHITE(), bl = BLUSH();
  const sp = (spread + 0.02) * s;
  for (const sx of [-1, 1]) {
    const e = ball(eye, sx * sp, y - 0.01 * s, z - 0.012, 0.062 * s, 0.07 * s, 0.035 * s);
    e.castShadow = false; g.add(e);
    g.add(ball(hi, sx * sp + 0.018 * s, y + 0.017 * s, z + 0.018, 0.02 * s, 0.022 * s, 0.01 * s));
    g.add(ball(hi, sx * sp - 0.02 * s, y - 0.03 * s, z + 0.016, 0.009 * s, 0.009 * s, 0.006 * s));
    const b = ball(bl, sx * (spread + 0.12) * s, y - 0.085 * s, z - 0.03, 0.072 * s, 0.04 * s, 0.03 * s);
    b.castShadow = false;
    g.add(b);
  }
  // 작은 웃는 입 (반원)
  const m = new THREE.Mesh(smileGeo, eye);
  m.scale.setScalar(0.03 * s); m.rotation.z = Math.PI;
  m.position.set(0, y - 0.07 * s, z + 0.002);
  g.add(m);
}

// 종별 색 (기본 / 반짝이)
const PAL = {
  bulssi:   [{ a: 0xff8a5c, b: 0xffd34d }, { a: 0xffd166, b: 0xff5fa2 }],
  hotteok:  [{ a: 0xe3a46b, b: 0x9a5a32 }, { a: 0xf4f0e6, b: 0xc9a0ff }],
  mulbang:  [{ a: 0xbfe6ff, b: 0x6cc4ff }, { a: 0xffd6f2, b: 0xb48cff }],
  jogae:    [{ a: 0xff9e9e, b: 0xfff1d6 }, { a: 0x9ee8ff, b: 0xfff6a8 }],
  saessak:  [{ a: 0xfff3dc, b: 0xff7b7b }, { a: 0xfff3dc, b: 0x8f7bff }],
  ggulbeol: [{ a: 0xffe066, b: 0x4a3a2a }, { a: 0xffc6e5, b: 0x6b4aa0 }],
  bulkkot:  [{ a: 0xff9b4a, b: 0xff4f3a }, { a: 0x7ad7ff, b: 0x4f7bff }],
  pado:     [{ a: 0x3d5a80, b: 0x7fd3ff }, { a: 0xf2c4ff, b: 0xffffff }],
  supgom:   [{ a: 0xa0775a, b: 0x7ccf6a }, { a: 0xf3e2c7, b: 0xff9ecb }],
  gimmung:  [{ a: 0xfff4ec, b: 0xffb38a }, { a: 0xe6e0ff, b: 0x9fe7ff }],
  hwabun:   [{ a: 0xff8f3d, b: 0xff6fa5 }, { a: 0xf7f7f7, b: 0xffd23d }],
  ikki:     [{ a: 0x7fbf6a, b: 0x5ab4ff }, { a: 0xffd28a, b: 0x7be0c8 }],
};

const BUILD = {
  bulssi(g, c) { // 볼 빨간 콩 + 머리 불꽃
    g.add(ball(toon(c.a), 0, 0.45, 0, 0.36, 0.44, 0.34));
    const fl = toon(c.b, { emissive: c.b, emissiveIntensity: 0.6 });
    g.add(cone(fl, 0, 1.0, 0, 0.13, 0.32));
    g.add(ball(fl, 0, 0.88, 0, 0.11));
    for (const sx of [-1, 1]) g.add(ball(toon(c.a), sx * 0.16, 0.06, 0.02, 0.1, 0.07, 0.13));
    face(g, 0.52, 0.31);
  },
  hotteok(g, c) { // 호떡 무늬 아기 고양이
    const body = toon(c.a);
    g.add(ball(body, 0, 0.42, 0, 0.42, 0.38, 0.4));
    for (const sx of [-1, 1]) {
      const ear = cone(body, sx * 0.22, 0.78, 0, 0.11, 0.2); ear.rotation.z = -sx * 0.35; g.add(ear);
      g.add(ball(body, sx * 0.18, 0.08, 0.15, 0.1, 0.08, 0.12));
    }
    const sp = toon(c.b);
    g.add(ball(sp, 0, 0.62, -0.12, 0.2, 0.06, 0.2)); // 호떡 무늬
    g.add(ball(sp, 0.2, 0.42, -0.3, 0.12, 0.05, 0.1));
    const tail = cyl(body, 0, 0.35, -0.45, 0.05, 0.35); tail.rotation.x = -0.9; g.add(tail);
    face(g, 0.48, 0.37);
  },
  mulbang(g, c) { // 물방울 귀 토끼
    const body = toon(c.a);
    g.add(ball(body, 0, 0.38, 0, 0.36, 0.36, 0.34));
    const drop = toon(c.b, { transparent: true, opacity: 0.85 });
    for (const sx of [-1, 1]) {
      const e = new THREE.Group();
      e.add(ball(drop, 0, 0, 0, 0.1, 0.13, 0.08));
      e.add(cone(drop, 0, 0.18, 0, 0.085, 0.24));
      e.position.set(sx * 0.15, 0.82, -0.02); e.rotation.z = -sx * 0.2; g.add(e);
      g.add(ball(body, sx * 0.16, 0.06, 0.12, 0.1, 0.07, 0.13));
    }
    g.add(ball(toon(0xffffff), 0, 0.32, -0.36, 0.1));
    face(g, 0.44, 0.31);
  },
  jogae(g, c) { // 조개 쓴 게
    const body = toon(c.a);
    g.add(ball(body, 0, 0.32, 0.05, 0.4, 0.28, 0.32));
    const shell = toon(c.b);
    const sh = ball(shell, 0, 0.5, -0.12, 0.42, 0.34, 0.3); g.add(sh);
    for (let i = -2; i <= 2; i++) {
      const r = ball(toon(c.a), i * 0.13, 0.62, -0.1, 0.025, 0.24, 0.27); r.rotation.z = i * 0.25; g.add(r);
    }
    for (const sx of [-1, 1]) {
      g.add(ball(body, sx * 0.48, 0.32, 0.18, 0.15, 0.12, 0.12));
      g.add(ball(body, sx * 0.56, 0.4, 0.24, 0.07, 0.09, 0.07));
      for (const dz of [-0.1, 0.12]) g.add(ball(body, sx * 0.34, 0.06, dz, 0.07));
    }
    face(g, 0.4, 0.34, 0.15);
  },
  saessak(g, c) { // 새싹 달린 버섯
    g.add(ball(toon(c.a), 0, 0.3, 0, 0.3, 0.32, 0.3));
    const cap = toon(c.b);
    g.add(ball(cap, 0, 0.66, 0, 0.46, 0.26, 0.46));
    const dot = toon(0xffffff);
    for (const [x, z] of [[0.2, 0.2], [-0.24, 0.1], [0.05, -0.28], [-0.1, 0.32], [0.3, -0.12]]) {
      g.add(ball(dot, x, 0.76, z, 0.07, 0.04, 0.07));
    }
    const leaf = toon(0x6fd36a);
    g.add(cyl(leaf, 0, 0.95, 0, 0.02, 0.14));
    for (const sx of [-1, 1]) { const l = ball(leaf, sx * 0.09, 1.03, 0, 0.1, 0.035, 0.06); l.rotation.z = sx * 0.4; g.add(l); }
    face(g, 0.32, 0.28, 0.13);
  },
  ggulbeol(g, c) { // 솜뭉치 꿀벌
    const body = toon(c.a);
    g.add(ball(body, 0, 0.55, 0, 0.36, 0.34, 0.36));
    const st = toon(c.b);
    for (const dz of [-0.12, -0.26]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.3 - Math.abs(dz) * 0.4, 0.05, 8, 24), st);
      r.position.set(0, 0.55, dz); g.add(r);
    }
    const wing = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    for (const sx of [-1, 1]) {
      const w = ball(wing, sx * 0.3, 0.88, -0.05, 0.2, 0.12, 0.04); w.rotation.z = sx * 0.5; w.userData.wing = sx; g.add(w);
      const an = cyl(st, sx * 0.1, 0.92, 0.1, 0.015, 0.16); an.rotation.z = -sx * 0.3; g.add(an);
      g.add(ball(st, sx * 0.13, 1.0, 0.12, 0.04));
    }
    { const k = cone(st, 0, 0.55, -0.42, 0.05, 0.14); k.rotation.x = -Math.PI / 2; g.add(k); }
    face(g, 0.58, 0.32);
  },
  bulkkot(g, c) { // 꼬리에 불꽃이 타는 고양이
    const body = toon(c.a);
    g.add(ball(body, 0, 0.5, 0, 0.44, 0.42, 0.42));
    for (const sx of [-1, 1]) {
      const ear = cone(body, sx * 0.24, 0.92, 0, 0.13, 0.24); ear.rotation.z = -sx * 0.35; g.add(ear);
      g.add(cone(toon(c.b), sx * 0.24, 0.95, 0.02, 0.06, 0.12));
      g.add(ball(body, sx * 0.2, 0.1, 0.16, 0.11, 0.09, 0.13));
    }
    const tail = cyl(body, 0, 0.42, -0.48, 0.06, 0.4); tail.rotation.x = -0.7; g.add(tail);
    const fl = toon(c.b, { emissive: c.b, emissiveIntensity: 0.7 });
    g.add(ball(fl, 0, 0.66, -0.66, 0.14)); g.add(cone(fl, 0, 0.84, -0.68, 0.11, 0.3));
    face(g, 0.55, 0.39);
  },
  pado(g, c) { // 파도 망토 펭귄
    const body = toon(c.a);
    g.add(ball(body, 0, 0.55, 0, 0.4, 0.52, 0.38));
    g.add(ball(toon(0xffffff), 0, 0.48, 0.16, 0.3, 0.4, 0.26));
    { const k = cone(toon(0xffb347), 0, 0.66, 0.42, 0.06, 0.12); k.rotation.x = Math.PI / 2; g.add(k); }
    const cape = toon(c.b, { transparent: true, opacity: 0.9 });
    const cp = ball(cape, 0, 0.6, -0.18, 0.46, 0.5, 0.25); g.add(cp);
    for (let i = -1; i <= 1; i++) g.add(ball(cape, i * 0.25, 1.04, -0.2, 0.12));
    for (const sx of [-1, 1]) {
      const f = ball(body, sx * 0.42, 0.5, 0, 0.08, 0.26, 0.14); f.rotation.z = sx * 0.4; g.add(f);
      g.add(ball(toon(0xffb347), sx * 0.15, 0.05, 0.12, 0.12, 0.05, 0.16));
    }
    face(g, 0.78, 0.32, 0.14);
  },
  supgom(g, c) { // 등에 이끼가 난 곰
    const body = toon(c.a);
    g.add(ball(body, 0, 0.52, 0, 0.48, 0.46, 0.44));
    g.add(ball(body, 0, 1.02, 0.05, 0.32, 0.29, 0.3));
    for (const sx of [-1, 1]) {
      g.add(ball(body, sx * 0.24, 1.28, 0.02, 0.1));
      g.add(ball(body, sx * 0.38, 0.5, 0.18, 0.13, 0.18, 0.13));
      g.add(ball(body, sx * 0.22, 0.1, 0.12, 0.13, 0.1, 0.16));
    }
    g.add(ball(toon(0xf2dcc2), 0, 0.94, 0.3, 0.12, 0.09, 0.06));
    const moss = toon(c.b);
    for (const [x, y, z, s] of [[0, 0.8, -0.32, 0.22], [0.2, 0.6, -0.36, 0.17], [-0.2, 0.55, -0.36, 0.16], [0.05, 1.25, -0.1, 0.1]]) {
      g.add(ball(moss, x, y, z, s, s * 0.7, s));
    }
    g.add(ball(toon(0xff8fb0), -0.18, 0.88, -0.38, 0.05));
    face(g, 1.06, 0.29, 0.13, 0.9);
  },
  gimmung(g, c) { // 김이 나는 구름
    const body = toon(c.a);
    for (const [x, y, z, s] of [[0, 0.6, 0, 0.38], [0.3, 0.52, -0.02, 0.27], [-0.3, 0.52, -0.02, 0.27], [0.15, 0.8, -0.08, 0.25], [-0.16, 0.78, -0.06, 0.24]]) {
      g.add(ball(body, x, y, z, s));
    }
    const puff = toon(c.b, { transparent: true, opacity: 0.8, emissive: c.b, emissiveIntensity: 0.25 });
    for (const [x, y, s] of [[0.12, 1.1, 0.08], [-0.05, 1.22, 0.06], [0.08, 1.33, 0.045]]) {
      const p = ball(puff, x, y, 0, s); p.userData.puff = y; g.add(p);
    }
    face(g, 0.6, 0.36);
  },
  hwabun(g, c) { // 꼬리가 꽃화분인 여우
    const body = toon(c.a);
    g.add(ball(body, 0, 0.45, 0, 0.36, 0.34, 0.42));
    g.add(ball(body, 0, 0.82, 0.18, 0.3, 0.27, 0.27));
    g.add(ball(toon(0xffffff), 0, 0.74, 0.4, 0.13, 0.09, 0.1));
    g.add(ball(BLACK(), 0, 0.78, 0.5, 0.035));
    for (const sx of [-1, 1]) {
      const ear = cone(body, sx * 0.17, 1.1, 0.14, 0.1, 0.24); ear.rotation.z = -sx * 0.25; g.add(ear);
      for (const dz of [-0.2, 0.2]) g.add(cyl(body, sx * 0.17, 0.12, dz, 0.06, 0.24));
    }
    const pot = toon(0xc8744a);
    const p = cyl(pot, 0, 0.55, -0.56, 0.13, 0.2); g.add(p);
    g.add(cyl(toon(0x5ccf6b), 0, 0.72, -0.56, 0.02, 0.22));
    const pet = toon(c.b);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      g.add(ball(pet, Math.cos(a) * 0.09, 0.86, -0.56 + Math.sin(a) * 0.09, 0.07, 0.04, 0.07));
    }
    g.add(ball(toon(0xffe066), 0, 0.88, -0.56, 0.05));
    face(g, 0.86, 0.43, 0.13, 0.85);
  },
  ikki(g, c) { // 등에 작은 연못이 있는 거북
    const body = toon(0xb6e3a0);
    g.add(ball(body, 0, 0.42, 0.52, 0.22, 0.2, 0.22));
    for (const sx of [-1, 1]) for (const dz of [-0.25, 0.25]) g.add(ball(body, sx * 0.36, 0.12, dz, 0.13, 0.1, 0.14));
    const sh = toon(c.a);
    g.add(ball(sh, 0, 0.32, 0, 0.5, 0.32, 0.52));
    const pond = toon(c.b, { emissive: c.b, emissiveIntensity: 0.2 });
    g.add(cyl(pond, 0, 0.6, 0, 0.3, 0.04));
    const pad = toon(0x4caf50);
    g.add(cyl(pad, 0.1, 0.63, 0.05, 0.1, 0.02));
    g.add(ball(toon(0xff9ecb), 0.1, 0.67, 0.05, 0.04));
    face(g, 0.46, 0.7, 0.1, 0.8);
  },
};

// 몽글이 만들기. 반환: { root(위치용), body(흔들림용), mats(채도 조절용) }
export function makeMonggle(sp, { shiny = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pal = PAL[sp] ? PAL[sp][shiny ? 1 : 0] : { a: 0xcccccc, b: 0x999999 };
  BUILD[sp](body, pal);
  const scale = { 1: 0.9, 2: 1.05 }[spStage(sp)] || 1;
  body.scale.setScalar(scale);
  return finishModel(root, body);
}

function spStage(sp) {
  return ['bulkkot', 'pado', 'supgom', 'gimmung', 'hwabun', 'ikki'].includes(sp) ? 2 : 1;
}

// 주인공: 큰 머리 2등신
export function makeHero(look = 'boy') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = toon(0xffe0c7);
  const hairC = look === 'girl' ? 0x6b3f2a : 0x2e2430;
  const clothC = look === 'girl' ? 0xff9fc5 : 0x7cb8ff;
  const hair = toon(hairC), cloth = toon(clothC);
  body.add(ball(cloth, 0, 0.42, 0, 0.26, 0.3, 0.22));        // 몸
  { const k = cone(toon(0xffffff), 0, 0.56, 0.2, 0.07, 0.08); k.rotation.x = Math.PI / 2; body.add(k); }
  for (const sx of [-1, 1]) {
    body.add(ball(cloth, sx * 0.28, 0.45, 0, 0.08, 0.16, 0.08)); // 팔
    body.add(ball(skin, sx * 0.3, 0.3, 0.02, 0.065));
    body.add(cyl(toon(0x5a4a6a), sx * 0.1, 0.1, 0, 0.07, 0.2)); // 다리
    body.add(ball(toon(0x5a4a6a), sx * 0.1, 0.02, 0.04, 0.08, 0.05, 0.1));
  }
  body.add(ball(skin, 0, 0.98, 0, 0.37, 0.35, 0.34));        // 머리
  body.add(ball(hair, 0, 1.12, -0.1, 0.39, 0.32, 0.32));     // 머리카락
  const bang = ball(hair, 0, 1.2, 0.12, 0.33, 0.13, 0.2); bang.rotation.x = 0.25; body.add(bang); // 앞머리
  if (look === 'girl') {
    for (const sx of [-1, 1]) body.add(ball(hair, sx * 0.34, 0.86, -0.08, 0.1, 0.2, 0.1));
    const rib = toon(0xff5f8f);
    for (const sx of [-1, 1]) body.add(ball(rib, sx * 0.09, 1.38, -0.02, 0.09, 0.06, 0.05));
    body.add(ball(rib, 0, 1.38, -0.02, 0.04));
  } else {
    body.add(cone(hair, 0.05, 1.42, 0, 0.05, 0.12));
  }
  face(body, 0.95, 0.31, 0.13);
  // 망토 대신 작은 가방
  body.add(ball(toon(0xc8955a), 0, 0.45, -0.22, 0.17, 0.18, 0.08));
  return finishModel(root, body);
}

function finishModel(root, body) {
  const mats = new Set();
  root.traverse(o => { if (o.isMesh && o.material && o.material.color) mats.add(o.material); });
  const list = [...mats].map(m => ({ m, base: m.color.clone() }));
  // 발밑 그림자 원 (가볍게)
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02;
  root.add(sh);
  return {
    root, body, shadow: sh,
    // 0 = 회색(색 빠진 야생), 1 = 원래 색
    setColor(t) {
      for (const { m, base } of list) {
        const l = base.r * 0.3 + base.g * 0.59 + base.b * 0.11;
        const grey = new THREE.Color(l * 0.85 + 0.08, l * 0.85 + 0.08, l * 0.9 + 0.1);
        m.color.copy(grey).lerp(base, t);
      }
    },
    flash(on) {
      for (const { m } of list) if (m.emissive) {
        if (on) { m.userData.e = m.userData.e ?? m.emissive.getHex(); m.userData.ei = m.userData.ei ?? m.emissiveIntensity; m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.6; }
        else if (m.userData.e !== undefined) { m.emissive.setHex(m.userData.e); m.emissiveIntensity = m.userData.ei; }
      }
    },
  };
}

// 반짝가루 아이템
export function makeDust() {
  const g = new THREE.Group();
  const m = toon(0xfff27a, { emissive: 0xffd84d, emissiveIntensity: 0.8 });
  const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), m);
  s.position.y = 0.35; g.add(s);
  return g;
}
