// 몽글믹스 — 캐릭터 움직임 (걷기·통통·날기·공격·맞기·눈 깜빡임)
// s = { t, moving, atk(남은 공격 시간), ranged, hurt(남은 시간), dead, face }
const ATK = 0.32; // 공격 동작 길이

export function animateModel(m, s, dt) {
  const r = m.rig || {};
  const base = m.base ?? (m.base = m.body.scale.x);
  const t = s.t;
  let y = 0, pitch = 0, roll = 0, yaw = 0, sx = 1, sy = 1, z = 0;
  const kind = m.motion;
  const walkK = Math.min(1, (m.walkK = lerp(m.walkK || 0, s.moving ? 1 : 0, dt * 10)));

  if (kind === 'hop') {
    // 통통 튀기: 땅에 닿을 때 납작, 올라가면 길쭉
    const ph = t * 9;
    const h = Math.abs(Math.sin(ph));
    y = h * 0.28 * walkK;
    const sq = (h < 0.25 ? (0.25 - h) * 1.2 : -h * 0.1) * walkK;
    sy = 1 - sq; sx = 1 + sq * 0.6;
    pitch = 0.1 * walkK * Math.cos(ph);
    for (const f of r.feet || []) { f.position.y = f.userData.p0.y + (1 - h) * 0.02 * walkK; }
  } else if (kind === 'fly') {
    y = 0.18 + Math.sin(t * 3) * 0.07;
    pitch = 0.18 * walkK;
    roll = Math.sin(t * 2) * 0.06;
  } else {
    // 걷기: 다리·발 번갈아, 몸은 살짝 위아래·좌우
    const ph = t * 11;
    y = Math.abs(Math.sin(ph)) * 0.06 * walkK;
    roll = Math.sin(ph) * 0.06 * walkK;
    pitch = 0.07 * walkK;
    for (const l of r.legs || []) l.rotation.x = Math.sin(ph + l.userData.ph) * 0.75 * walkK;
    for (const f of r.feet || []) {
      const p0 = f.userData.p0, a = ph + f.userData.ph;
      f.position.z = p0.z + Math.sin(a) * 0.08 * walkK;
      f.position.y = p0.y + Math.max(0, Math.cos(a)) * 0.05 * walkK;
    }
  }
  // 숨쉬기 (멈춰 있을 때)
  const br = Math.sin(t * 2.4) * 0.03 * (1 - walkK);
  sy *= 1 + br; sx *= 1 - br * 0.6;

  // 팔 (주인공)
  for (const a of r.arms || []) {
    a.rotation.x = -Math.sin(t * 11 + a.userData.ph) * 0.7 * walkK + Math.sin(t * 2.4) * 0.05 * (1 - walkK);
  }
  // 머리 끄덕
  if (r.head) { r.head.rotation.x = Math.sin(t * 22) * 0.04 * walkK; r.head.rotation.z = Math.sin(t * 1.3) * 0.05 * (1 - walkK); }
  // 꼬리 살랑
  for (const tl of r.tails || []) tl.rotation.y = (tl.userData.r0 || 0) + Math.sin(t * (s.moving ? 14 : 5)) * 0.5;
  // 귀·머리끈 흔들
  for (const e of r.ears || []) e.rotation.z = Math.sin(t * 8 + e.userData.ear) * 0.12 * (0.4 + walkK);
  // 날개
  for (const w of r.wings || []) w.rotation.y = Math.sin(t * 34) * 0.6 * w.userData.wing;
  // 김·물보라
  for (const p of r.puffs || []) p.position.y = p.userData.puff + ((t * 0.4) % 0.3);

  // 공격
  if (s.atk > 0) {
    const k = 1 - s.atk / ATK, w = Math.sin(k * Math.PI);
    if (r.wandArm) { // 주인공: 요술봉 크게 휘두르기
      r.wandArm.rotation.x = -2.6 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) + 2.2 * Math.max(0, k - 0.6);
      yaw = Math.sin(k * Math.PI) * 0.35; z = w * 0.12;
    } else if (s.ranged) { z = -w * 0.18; sy *= 1 + w * 0.12; sx *= 1 - w * 0.06; pitch -= w * 0.2; }
    else { z = w * 0.4; pitch += w * 0.35; sy *= 1 - w * 0.12; sx *= 1 + w * 0.1; }
  }
  // 맞음
  if (s.hurt > 0) { pitch -= 0.3 * Math.min(1, s.hurt / 0.15); z -= 0.12 * Math.min(1, s.hurt / 0.15); roll += Math.sin(t * 60) * 0.06; }

  // 눈 깜빡임
  m.blinkT -= dt;
  const blink = m.blinkT < 0.12;
  if (m.blinkT <= 0) m.blinkT = 2.2 + Math.random() * 3.5;
  for (const e of r.eyes || []) e.scale.y = (e.userData.sy || e.scale.y) * (blink ? 0.12 : 1);
  for (const hh of r.his || []) hh.visible = !blink;

  const b = m.body;
  b.position.set(0, y, z);
  b.rotation.set(pitch, yaw, roll);
  b.scale.set(sx * base, sy * base, sx * base);
  if (m.shadow) m.shadow.scale.setScalar(Math.max(0.5, 1 - y * 0.8));
}

function lerp(a, b, k) { return a + (b - a) * Math.min(1, k); }
export const ATTACK_TIME = ATK;
