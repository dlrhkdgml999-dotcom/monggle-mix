// 몽글믹스 — 시작 화면, 렌더링, 입력, 게임 루프
import * as THREE from '../lib/three.min.js';
import { buildWorld } from './world.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Net } from './net.js';
import { Sync } from './sync.js';
import { VERSION } from './version.js';
import { makeHero, makeMonggle } from './models.js';
import { animateModel } from './anim.js';
import { unlock as unlockSound, sfx } from './sfx.js';
import { newSave, loadLocal, save, checkLogin, pinLogin, loadCloud, normalize, currentUser, useProfileStorage, profileOfUser } from './save.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const TEST = params.has('test'); // 자동 테스트용

// ---------- 렌더러 ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 140);
const hemi = new THREE.HemisphereLight(0xffffff, 0xa6d38f, 1.6);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
scene.add(sun, sun.target);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 세로 화면이면 더 멀리서
  camera.fov = w > h ? 30 : 46;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const world = buildWorld(scene);

// ---------- 시작 화면 (비밀번호 4자리) ----------
let state = null, game, ui, net, sync;
let pin = '';
const dots = [...document.querySelectorAll('.dots i')];
const who = $('#who');
function drawPin() { dots.forEach((d, i) => d.classList.toggle('on', i < pin.length)); }
document.querySelectorAll('.pad button').forEach(b => b.onclick = () => {
  if (busy) return;
  sfx.tap();
  if (b.dataset.k === 'del') pin = pin.slice(0, -1);
  else if (pin.length < 4) pin += b.textContent;
  drawPin();
  if (pin.length === 4) tryPin();
});
let busy = false;
async function tryPin() {
  busy = true;
  who.textContent = '확인 중…';
  const r = await pinLogin(pin);
  if (r.error === 'wrong') {
    who.textContent = '비밀번호가 달라요';
    $('.dots').classList.add('shake'); setTimeout(() => $('.dots').classList.remove('shake'), 400);
    pin = ''; drawPin(); busy = false; return;
  }
  if (r.error === 'auth/operation-not-allowed') $('#loginState').textContent = 'Firebase에서 이메일/비밀번호 로그인을 켜야 같이 놀 수 있어요. 지금은 이 폰에만 저장돼요';
  else if (r.offline) $('#loginState').textContent = '인터넷 연결이 안 돼서 이 폰에만 저장돼요';
  who.textContent = `${r.prof.name} 어서 와요!`;
  await startAs(r.prof);
}
async function startAs(prof) {
  useProfileStorage(prof.hash);
  let s = null;
  if (currentUser()) { try { s = await loadCloud(); } catch {} }
  const local = loadLocal();
  // 더 최근에 저장된 쪽으로
  if (s && local) s = (local.savedAt || 0) > (s.savedAt || 0) ? local : s;
  s = s || local || newSave(prof.name, prof.look);
  s.name = prof.name; s.look = prof.look;
  begin(s);
}
$('#guestBtn').onclick = () => { useProfileStorage(null); begin(loadLocal() || newSave('손님', 'boy')); };
checkLogin().then(u => {
  const prof = profileOfUser(u);
  if (!prof || state) return;
  const b = $('#resumeBtn');
  b.textContent = `🟢 ${prof.name}(으)로 이어하기`;
  b.classList.remove('hidden');
  b.onclick = () => startAs(prof);
});

function begin(s) {
  state = normalize(s);
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  try { if (!TEST) document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {}); } catch {}
  ui = new UI({ camera, state, onSave: () => save(state) });
  game = new Game({ scene, camera, state, ui, world });
  net = new Net(ui);
  ui.attach(game, net);
  game.onPartyChange = () => net.updateParty();
  sync = new Sync(game, ui, state);
  net.onLink = (link, amHost) => sync.attach(link, amHost);
  net.onUnlink = () => sync.detach();
  net.start(state);
  if (params.get('fake')) fakeLink(params.get('fake'));
  if (params.get('fakedb')) import('./fakedb.js').then(m => net.startWith(m.makeFakeDb('fake-' + params.get('fakedb')), null, 'fake-' + params.get('fakedb')));
  if (!state.job) setTimeout(() => ui.openJob(true), 600);
  else ui.toast(`어서 와요, ${state.name}! 땅을 누르면 걸어가고, 몽글이를 누르면 같이 싸워요`);
  save(state);
  window.__game = game; window.__net = net; game.ui = ui; // 디버그용
}

// ---------- 입력 ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pressing = false, dragTarget = false;
function pick(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
canvas.addEventListener('pointerdown', e => {
  if (!game || ui.panelOpen) return;
  net?.ac?.resume?.(); unlockSound();
  pick(e);
  const hits = ray.intersectObjects(game.pickables(), false);
  if (hits.length) { game.tapUnit(hits[0].object.userData.unit); pressing = false; return; }
  const g = ray.intersectObject(world.ground)[0];
  if (g) { game.tapGround(g.point, false); pressing = true; dragTarget = true; }
});
canvas.addEventListener('pointermove', e => {
  if (!pressing || !game) return;
  pick(e);
  const g = ray.intersectObject(world.ground)[0];
  if (g) game.tapGround(g.point, true);
});
addEventListener('pointerup', () => pressing = false);
addEventListener('pointercancel', () => pressing = false);

// 자동 테스트용: 같은 브라우저의 두 탭을 BroadcastChannel로 연결 (실제 계정 없이)
function fakeLink(side) {
  const bc = new BroadcastChannel('monggle-test');
  const link = { send: o => bc.postMessage(o), onmessage: null };
  let up = false;
  bc.onmessage = e => {
    const m = e.data;
    if (m.t === 'hello') { bc.postMessage({ t: 'hello2' }); if (!up) { up = true; sync.attach(link, side === 'A'); } return; }
    if (m.t === 'hello2') { if (!up) { up = true; sync.attach(link, side === 'A'); } return; }
    link.onmessage?.(m);
  };
  bc.postMessage({ t: 'hello' });
}

// ---------- 상대방 캐릭터 ----------
let partner = null;
function partnerSource() {
  const sp = sync?.partner;
  if (sp) return { name: sp.n, look: sp.l, job: sp.j, atk: sp.a, x: sp.h[0], z: sp.h[1], face: sp.h[2], dead: sp.h[3],
    party: sp.pets.map(q => ({ sp: q[1], shiny: !!q[2] })), pets: sp.pets };
  return net?.partner();
}
function updatePartner(dt) {
  const p = partnerSource();
  if (!p || p.x == null) {
    if (partner) { scene.remove(partner.model.root); partner.pets.forEach(q => scene.remove(q.model.root)); ui.detachPartner(); partner = null; }
    return;
  }
  if (!partner || partner.look !== p.look || partner.job !== (p.job || 'mage')) {
    if (partner) { scene.remove(partner.model.root); partner.pets.forEach(q => scene.remove(q.model.root)); }
    const model = makeHero(p.look || 'girl', p.job || 'mage');
    model.root.position.set(p.x, 0, p.z);
    scene.add(model.root);
    partner = { model, look: p.look, job: p.job || 'mage', t: 0, pets: [], petKey: '' };
    ui.attachPartner(model, p.name);
  }
  // 상대 몽글이
  const key = JSON.stringify(p.party || []);
  if (key !== partner.petKey) {
    partner.pets.forEach(q => scene.remove(q.model.root));
    partner.pets = (p.party || []).map((m, i) => {
      const pm = makeMonggle(m.sp, { shiny: m.shiny });
      pm.root.position.set(p.x + i - 0.5, 0, p.z + 1);
      scene.add(pm.root);
      return { model: pm, slot: i, t: Math.random() * 5 };
    });
    partner.petKey = key;
  }
  const r = partner.model.root.position;
  const dx = p.x - r.x, dz = p.z - r.z, d = Math.hypot(dx, dz);
  if (d > 25) r.set(p.x, 0, p.z);
  else if (d > 0.05) {
    const step = Math.min(d, 6 * dt);
    r.x += dx / d * step; r.z += dz / d * step;
    partner.model.root.rotation.y = p.face ?? Math.atan2(dx, dz);
  }
  partner.t += dt;
  if (p.atk && !(partner.atkT > 0)) partner.atkT = 0.32;
  if (partner.atkT > 0) partner.atkT -= dt;
  const style = { warrior: 'swing', archer: 'shoot', mage: 'cast', thief: 'swing', pirate: 'shoot' }[partner.job];
  animateModel(partner.model, { t: partner.t, moving: d > 0.08, atk: partner.atkT, style }, dt);
  const n = partner.pets.length, face = partner.model.root.rotation.y;
  if (p.pets) {
    // 같이 사냥 중: 상대 몽글이의 실제 위치
    partner.pets.forEach((q, i) => {
      const src = p.pets[i]; if (!src) return;
      const qp = q.model.root.position, qx = src[3] - qp.x, qz = src[4] - qp.z, qd = Math.hypot(qx, qz);
      q.t += dt;
      q.model.root.visible = !src[6];
      if (qd > 8) qp.set(src[3], 0, src[4]); else { qp.x += qx * Math.min(1, dt * 10); qp.z += qz * Math.min(1, dt * 10); }
      q.model.root.rotation.y = src[5];
      animateModel(q.model, { t: q.t, moving: !!src[7] }, dt);
    });
    return;
  }
  for (const q of partner.pets) {
    const back = face + Math.PI + (q.slot - (n - 1) / 2) * 0.9;
    const tx = r.x + Math.sin(back) * 1.6, tz = r.z + Math.cos(back) * 1.6;
    const qp = q.model.root.position, qx = tx - qp.x, qz = tz - qp.z, qd = Math.hypot(qx, qz);
    q.t += dt;
    if (qd > 12) qp.set(tx, 0, tz);
    else if (qd > 0.4) { const st = Math.min(qd, 6 * dt); qp.x += qx / qd * st; qp.z += qz / qd * st; q.model.root.rotation.y = Math.atan2(qx, qz); }
    animateModel(q.model, { t: q.t, moving: qd > 0.4 }, dt);
  }
}

// ---------- 루프 ----------
const clock = new THREE.Timer();
const camPos = new THREE.Vector3(0, 16, 18), look3 = new THREE.Vector3();
let saveT = 0, titleT = 0;
function loop() {
  requestAnimationFrame(loop);
  clock.update();
  const dt = Math.min(0.05, clock.getDelta());
  world.update(dt, clock.getElapsed());
  if (game) {
    game.update(dt);
    const hp = game.hero.model.root.position;
    const wide = innerWidth > innerHeight;
    const off = wide ? new THREE.Vector3(0, 14.2, 14.2) : new THREE.Vector3(0, 18, 18);
    camPos.lerp(off.add(hp), Math.min(1, dt * 5));
    camera.position.copy(camPos);
    look3.lerp(new THREE.Vector3(hp.x, 0.6, hp.z), Math.min(1, dt * 6));
    camera.lookAt(look3);
    sun.position.set(hp.x + 8, 18, hp.z + 6); sun.target.position.set(hp.x, 0, hp.z);
    updatePartner(dt);
    sync.update(dt);
    ui.tick();
    net.sendPos(hp, game.lastZone?.id, game.hero.hp, game.hero.maxHp);
    saveT += dt;
    if (saveT > 15) { saveT = 0; save(state); }
  } else {
    // 시작 화면: 천천히 마을을 도는 카메라
    titleT += dt * 0.08;
    camera.position.set(Math.sin(titleT) * 18, 12, Math.cos(titleT) * 18);
    camera.lookAt(0, 1, 0);
    sun.position.set(8, 18, 6); sun.target.position.set(0, 0, 0);
  }
  renderer.render(scene, camera);
}
loop();

document.addEventListener('visibilitychange', () => { if (document.hidden && state) save(state); else checkVersion(); });

// 새 버전 확인 (1분마다 + 앱으로 돌아올 때)
async function checkVersion() {
  try {
    const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' });
    const { v } = await r.json();
    if (v && v !== VERSION) {
      if (ui) ui.newVersion();
      else if (sessionStorage.getItem('mm-reloaded') !== v) { sessionStorage.setItem('mm-reloaded', v); location.reload(); }
    }
  } catch {}
}
if (!TEST) { checkVersion(); setInterval(checkVersion, 60000); }
if (TEST && params.get('test') === 'auto') $('#guestBtn').onclick();
