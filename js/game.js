// 몽글믹스 — 게임 핵심 (주인공·몽글이·야생 몽글이·전투·포획)
import * as THREE from '../lib/three.min.js';
import { SPECIES, ZONES, elemMult, expToNext, MAX_LV, BOX_MAX, CAPTURE_RATE, CAPTURE_RATE_NEW, QUESTS, QUEST_REWARD } from './data.js';
import { makeMonggle, makeHero, toon } from './models.js';
import { clampToWorld, SPAWN, CAULDRON } from './world.js';
import { sfx } from './sfx.js';
import { animateModel, ATTACK_TIME } from './anim.js';

const PART_GEO = new THREE.IcosahedronGeometry(0.07, 0);
const GEM_GEO = new THREE.OctahedronGeometry(0.13, 0);
const GEM_MAT = new THREE.MeshToonMaterial({ color: 0xfff27a, emissive: 0xffc93d, emissiveIntensity: 0.7 });

const V = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function heroStats(lv) { return { maxHp: Math.round(100 + lv * 12), atk: 10 + lv * 2.2 }; }
export function petStats(m) {
  const s = SPECIES[m.sp], k = 1 + (m.lv - 1) * 0.12, sh = m.shiny ? 1.1 : 1;
  return { maxHp: Math.round(s.hp * k * sh), atk: s.atk * k * sh };
}

export class Game {
  constructor({ scene, camera, state, ui, world, fxLayer }) {
    Object.assign(this, { scene, camera, state, ui, world, fxLayer });
    this.units = [];
    this.projectiles = [];
    this.drops = [];
    this.parts = [];
    this.mode = 'solo';   // solo | host | guest (같이 사냥)
    this.nidSeq = 1;
    this.mirrors = new Map();
    this.time = 0;
    this.buffAtk = 0; // 응원 남은 시간
    this.heroSkillCd = 0;
    this.lastZone = null;
    this.marker = this.makeMarker();
    this.arrow = this.makeArrow();
    this.questT = 0;
    this.spawnHero();
    this.syncParty();
    for (const z of ZONES) if (z.spawns) for (let i = 0; i < z.count; i++) this.spawnWild(z);
    this.bossT = 0;
    this.spawnBoss();
    this.refreshVivid();
  }

  // ---------- 만들기 ----------
  makeMarker() {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.06; this.scene.add(m);
    return m;
  }

  makeArrow() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 3), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
    m.rotation.x = Math.PI / 2; g.add(m);
    g.visible = false; this.scene.add(g);
    return g;
  }

  // 할 일 진행 확인
  checkQuest() {
    const s = this.state;
    s.quest = s.quest || 0;
    while (s.quest < QUESTS.length && QUESTS[s.quest].done(s, this)) {
      s.quest++;
      s.dust += QUEST_REWARD;
      this.ui.toast(`✅ 할 일 완료! 반짝가루 ${QUEST_REWARD}개`);
      sfx.cheer();
      this.ui.renderTop(); this.ui.save();
    }
    this.ui.renderQuest();
  }

  questTarget() {
    const q = QUESTS[this.state.quest || 0];
    if (!q || !q.to) return null;
    if (q.to === 'boss') return this.boss && !this.boss.removed && !this.boss.dead ? this.boss.model.root.position : { x: 50, z: 12 };
    return q.to;
  }

  addUnit(u) {
    if (u.kind === 'wild' && !u.nid) u.nid = this.nidSeq++;
    this.scene.add(u.model.root);
    u.bar = this.ui.makeBar(u);
    this.units.push(u);
    return u;
  }

  spawnHero() {
    const st = heroStats(this.state.lv);
    const model = makeHero(this.state.look);
    model.root.position.set(SPAWN.x, 0, SPAWN.z);
    this.hero = this.addUnit({
      kind: 'hero', name: this.state.name, model, elems: [], range: 1.7, speed: 5,
      hp: st.maxHp, maxHp: st.maxHp, atk: st.atk, atkCd: 0, target: null, moveTo: null,
      buffs: {}, dead: false, face: 0,
    });
  }

  makePet(m, slot) {
    const s = SPECIES[m.sp], st = petStats(m);
    const model = makeMonggle(m.sp, { shiny: m.shiny });
    const h = this.hero.model.root.position;
    model.root.position.set(h.x + rand(-1, 1), 0, h.z + rand(-1, 1));
    return this.addUnit({
      kind: 'pet', data: m, sp: m.sp, name: s.name, model, elems: s.elems, role: s.role,
      range: s.range, speed: s.speed + 1, hp: st.maxHp, maxHp: st.maxHp, atk: st.atk,
      atkCd: rand(0, 1), skillCd: 0, target: null, slot, buffs: {}, dead: false, reviveT: 0, face: 0,
    });
  }

  partySize() { return this.state.lv >= 15 ? 3 : 2; }

  // 저장된 파티 구성에 맞춰 화면 속 몽글이를 다시 만든다
  syncParty() {
    const want = this.state.party.slice(0, this.partySize())
      .map(id => this.state.monggles.find(m => m.id === id)).filter(Boolean);
    this.state.party = want.map(m => m.id);
    for (const u of this.units.filter(u => u.kind === 'pet')) {
      if (!want.includes(u.data)) this.removeUnit(u);
    }
    want.forEach((m, i) => {
      let u = this.units.find(x => x.kind === 'pet' && x.data === m);
      if (!u) u = this.makePet(m, i);
      u.slot = i;
    });
    this.ui.renderParty();
    this.onPartyChange?.();
  }

  removeUnit(u) {
    this.scene.remove(u.model.root);
    u.bar?.remove();
    u.removed = true;
    this.units = this.units.filter(x => x !== u);
    for (const o of this.units) if (o.target === u) o.target = null;
  }

  spawnWild(zone, near) {
    const sp = zone.spawns[Math.floor(Math.random() * zone.spawns.length)];
    const s = SPECIES[sp];
    const lv = Math.floor(rand(zone.lv[0], zone.lv[1] + 0.99));
    const k = 1 + (lv - 1) * 0.12;
    const model = makeMonggle(sp);
    model.setColor(0);
    let x, z, tries = 0;
    do {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * zone.r * 0.92;
      x = zone.x + Math.cos(a) * d; z = zone.z + Math.sin(a) * d;
      tries++;
    } while (tries < 20 && (Math.hypot(x, z) < 15 || (near && dist2({ x, z }, near) < 6)));
    const p = clampToWorld({ x, z });
    model.root.position.set(p.x, 0, p.z);
    const hp = Math.round(s.hp * k * 0.85);
    // 터치하기 쉽게 투명 판정 구
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.6; model.root.add(hit);
    const u = this.addUnit({
      kind: 'wild', sp, name: s.name, lv, model, elems: s.elems, role: s.role, zone,
      range: Math.min(s.range, 4), speed: s.speed * 0.8, hp, maxHp: hp, atk: s.atk * k * 0.75,
      atkCd: 1, target: null, home: new THREE.Vector3(p.x, 0, p.z), wanderT: rand(1, 4), wanderTo: null,
      buffs: {}, dead: false, face: Math.random() * 6, hit,
    });
    hit.userData.unit = u;
    return u;
  }

  // 보스 대왕버섯 (들판 동쪽 숲 끝, 쓰러지면 10분 뒤 다시)
  makeBossModel() {
    const model = makeMonggle('saessak');
    model.body.scale.setScalar(2.5); model.base = 2.5;
    model.shadow.scale.setScalar(2.4);
    // 왕관
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 6, 1, true), toon(0xffd34d, { emissive: 0xffb300, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
    crown.position.set(0, 0.86, 0); model.body.add(crown);
    model.body.traverse(o => { if (o.isMesh && o.material.color && o.material.color.getHex() === 0xff7b7b) o.material = toon(0xd94a6a); });
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.3; model.root.add(hit);
    return { model, hit };
  }

  spawnBoss() {
    const { model, hit } = this.makeBossModel();
    const home = new THREE.Vector3(50, 0, 12);
    model.root.position.copy(home);
    const zone = ZONES.find(z => z.id === 'field');
    const u = this.addUnit({
      kind: 'wild', boss: true, sp: 'saessak', name: '대왕버섯', lv: 14, model, elems: ['grass'], role: 'tank', zone,
      range: 2.6, speed: 2.2, hp: 1500, maxHp: 1500, atk: 15, atkCd: 2, target: null, home, wanderT: 99,
      buffs: {}, dead: false, face: -Math.PI / 2, hit, sporeT: 5, summoned: false, radius: 1.3,
    });
    hit.userData.unit = u;
    this.boss = u;
  }

  updateBoss(u, dt) {
    if (!u.target) return;
    u.sporeT -= dt;
    const p = u.model.root.position;
    if (u.sporeT <= 0) {
      u.sporeT = 6;
      this.ui.ring(p, '#c8ffb0', 3.8);
      sfx.boss();
      for (const o of this.units) if ((o.kind === 'hero' || o.kind === 'pet' || o.kind === 'ally') && !o.dead && dist2(o.model.root.position, p) < 3.8) {
        this.damage(u, o, 0.8); o.buffs.slow = 2.5;
      }
    }
    if (!u.summoned && u.hp < u.maxHp / 2) {
      u.summoned = true;
      this.ui.toast('대왕버섯이 새싹버섯들을 불렀어요!');
      for (let i = 0; i < 3; i++) {
        const m = this.spawnWild({ ...u.zone, spawns: ['saessak'], lv: [8, 10], x: p.x, z: p.z, r: 3 });
        m.target = this.hero; m.minion = true;
      }
    }
  }

  // ---------- 같이 사냥 (guest 쪽) ----------
  enterGuest() {
    this.mode = 'guest';
    for (const u of [...this.units]) if (u.kind === 'wild') this.removeUnit(u);
    this.boss = null;
    this.mirrors = new Map();
  }

  leaveGuest() {
    for (const u of [...this.units]) if (u.kind === 'wild') this.removeUnit(u);
    this.mirrors = new Map();
    this.mode = 'solo';
    for (const z of ZONES) if (z.spawns) for (let i = 0; i < z.count; i++) this.spawnWild(z);
    this.spawnBoss();
    this.ui.toast('같이 사냥 연결이 끊겼어요. 혼자 사냥으로 돌아가요');
  }

  applyWorld(list) {
    const seen = new Set();
    for (const [nid, sp, lv, x, z, face, hp, maxHp, f] of list) {
      seen.add(nid);
      let u = this.mirrors.get(nid);
      const dead = f & 1, boss = f & 2;
      if (!u) {
        if (dead) continue;
        let model, hit;
        if (boss) ({ model, hit } = this.makeBossModel());
        else {
          model = makeMonggle(sp); model.setColor(0);
          hit = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
          hit.position.y = 0.6; model.root.add(hit);
        }
        model.root.position.set(x, 0, z);
        const S = SPECIES[sp];
        u = this.addUnit({
          kind: 'wild', mirror: true, nid, sp, lv, boss: !!boss, minion: !!(f & 8), name: boss ? '대왕버섯' : S.name,
          model, hit, elems: S.elems, role: S.role, hp, maxHp, atk: 0, range: 0, speed: 0,
          buffs: {}, dead: false, face, tx: x, tz: z, radius: boss ? 1.3 : 0,
          zone: ZONES.find(zz => Math.hypot(x - zz.x, z - zz.z) < zz.r) || ZONES[1],
        });
        hit.userData.unit = u;
        this.mirrors.set(nid, u);
        if (boss) this.boss = u;
      }
      u.tx = x; u.tz = z; u.tface = face; u.lv = lv;
      u.moving = !!(f & 4);
      if (!u.dead) { u.hp = hp; u.maxHp = maxHp; }
      if (dead && !u.dead) { u.dead = true; u.fadeT = 1; }
    }
    for (const [nid, u] of this.mirrors) {
      if (!seen.has(nid)) { this.mirrors.delete(nid); if (u.kind === 'wild') this.removeUnit(u); }
    }
  }

  updateMirror(u, dt) {
    const p = u.model.root.position;
    if (u.dead) {
      if (u.fadeT > 0) {
        u.fadeT -= dt;
        u.model.root.rotation.z = Math.min(1.5, (1 - u.fadeT) * 4);
        u.model.root.scale.setScalar(Math.max(0.01, u.fadeT < 0.4 ? u.fadeT / 0.4 : 1));
        if (u.fadeT <= 0) u.model.root.visible = false;
      }
      return;
    }
    const dx = u.tx - p.x, dz = u.tz - p.z, d = Math.hypot(dx, dz);
    if (d > 8) p.set(u.tx, 0, u.tz);
    else p.x += dx * Math.min(1, dt * 10), p.z += dz * Math.min(1, dt * 10);
    u.face = u.tface ?? u.face;
  }

  // host가 "몬스터가 쓰러졌어요"를 알려 줌
  remoteKill(m) {
    const u = this.mirrors.get(m.id);
    if (!u || u.kind !== 'wild') return;
    const near = Math.hypot(u.model.root.position.x - this.hero.model.root.position.x, u.model.root.position.z - this.hero.model.root.position.z) < 14;
    const helped = near || (u.hitByMe && this.time - u.hitByMe < 20);
    u.dead = true; u.hp = 0;
    for (const o of this.units) if (o.target === u) o.target = null;
    if (!helped) { u.fadeT = 1; return; }
    if (u.boss) {
      this.state.dust += 40; this.state.bossKills = (this.state.bossKills || 0) + 1;
      this.gainHeroExp(320);
      for (const p of this.units) if (p.kind === 'pet' && !p.dead) this.gainPetExp(p, 320);
      this.ui.floatText(u.model.root.position, '✦40', 'lvup', 1.4);
      this.ui.toast('🎉 둘이서 대왕버섯을 물리쳤어요! 반짝가루 40개');
      sfx.levelUp(); this.burst(u.model.root.position, 0xfff27a, 24);
      u.fadeT = 1; this.ui.renderTop(); this.ui.save();
      return;
    }
    this.reward(u);
    const rate = !this.state.dex[u.sp] ? CAPTURE_RATE_NEW : CAPTURE_RATE;
    if (!u.minion && Math.random() < rate) {
      // 나만의 친구로 바꾸기 (host 화면과 상관없이)
      this.mirrors.delete(m.id);
      u.mirror = false;
      this.makeFriend(u);
    } else u.fadeT = 1;
  }

  // host가 "몬스터가 너를 때렸어"를 알려 줌
  remoteHurt(m) {
    const to = m.who === 'h' ? this.hero : this.units.find(u => u.kind === 'pet' && u.slot === m.who);
    if (!to || to.dead) return;
    let dmg = m.dmg;
    if (to.buffs.guard > 0) dmg *= 0.5;
    if (this.shieldT > 0) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    to.hp -= dmg; to.hurtT = 0.15;
    this.ui.floatText(to.model.root.position, '-' + dmg, 'ouch');
    if (to.kind === 'hero') sfx.ouch();
    if (to.hp <= 0) this.kill(to);
  }

  // ---------- 같이 사냥 (host 쪽) ----------
  updateAllies(m) {
    this.allies = this.allies || new Map();
    const want = new Map();
    want.set('h', { x: m.h[0], z: m.h[1], dead: m.h[3], hp: m.h[4], maxHp: m.h[5], elems: [] });
    for (const [slot, sp, , x, z, , dead, , hp, maxHp] of m.pets || []) want.set(slot, { x, z, dead, hp, maxHp, elems: SPECIES[sp]?.elems || [] });
    for (const [who, v] of want) {
      let a = this.allies.get(who);
      if (!a) {
        const root = new THREE.Object3D(), body = new THREE.Object3D(); root.add(body);
        a = this.addUnit({ kind: 'ally', who, model: { root, body, shadow: body, setColor() {}, flash() {} }, buffs: {}, elems: v.elems, atk: 0 });
        this.allies.set(who, a);
      }
      a.model.root.position.set(v.x, 0, v.z);
      a.dead = !!v.dead; a.hp = v.hp; a.maxHp = v.maxHp; a.elems = v.elems;
    }
    for (const [who, a] of this.allies) if (!want.has(who)) { this.removeUnit(a); this.allies.delete(who); }
  }

  removeAllies() {
    for (const a of this.allies?.values() || []) this.removeUnit(a);
    this.allies = new Map();
    for (const u of this.units) if (u.target?.kind === 'ally') u.target = null;
  }

  // guest가 "내가 이 몬스터를 때렸어"를 알려 줌
  remoteHit(m) {
    const u = this.units.find(x => x.kind === 'wild' && x.nid === m.id && !x.dead);
    if (!u) return;
    u.hp -= m.dmg; u.hurtT = 0.15;
    this.ui.floatText(u.model.root.position, '-' + m.dmg, 'hit');
    this.burst(u.model.root.position, 0xffffff, 4);
    const ally = this.allies?.get('h');
    if (!u.target && ally && !ally.dead) u.target = ally;
    if (u.hp <= 0) this.kill(u, ally);
  }

  remoteFx() {}

  // ---------- 입력 ----------
  tapUnit(u) {
    if (u.kind === 'wild' && !u.dead) { sfx.tap(); this.hero.target = u; this.hero.moveTo = null; this.flashMarker(u.model.root.position, 0xff8080); return; }
    if (u.kind === 'friend') { this.befriend(u); }
  }
  tapGround(p, drag) {
    if (this.hero.dead) return;
    this.hero.moveTo = clampToWorld(new THREE.Vector3(p.x, 0, p.z));
    this.hero.target = null;
    if (!drag) this.flashMarker(this.hero.moveTo, 0xffffff);
  }
  flashMarker(p, color) {
    this.marker.position.set(p.x, 0.06, p.z);
    this.marker.material.color.setHex(color);
    this.marker.material.opacity = 0.9;
    this.marker.scale.setScalar(1);
  }
  pickables() { return this.units.filter(u => (u.kind === 'wild' && !u.dead) || u.kind === 'friend').map(u => u.hit); }

  // ---------- 전투 ----------
  enemyOf(u) { return u.kind === 'wild' ? ['hero', 'pet', 'ally'] : ['wild']; }

  nearestEnemy(u, maxD) {
    let best = null, bd = maxD;
    for (const o of this.units) {
      if (o.dead || !this.enemyOf(u).includes(o.kind)) continue;
      const d = dist2(u.model.root.position, o.model.root.position);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  damage(from, to, mult = 1, { silent = false } = {}) {
    if (!to || to.dead || to.removed) return 0;
    let atk = from.atk * mult;
    if (from.kind !== 'wild' && this.buffAtk > 0) atk *= 1.3;
    const em = elemMult(from.elems.length ? from.elems : ['none'], to.elems.length ? to.elems : ['none']);
    let dmg = atk * em * rand(0.9, 1.1);
    if (to.buffs.guard > 0) dmg *= 0.5;
    if (to.kind !== 'wild' && this.shieldT > 0) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    // guest: host의 몬스터를 때림 → host에게 알리고 화면엔 미리 보여 주기
    if (to.mirror) {
      this.sync?.send({ t: 'hit', id: to.nid, dmg });
      to.hitByMe = this.time;
      to.hp = Math.max(1, to.hp - dmg);
      to.hurtT = 0.15;
      if (!silent) this.ui.floatText(to.model.root.position, '-' + dmg, em > 1 ? 'big' : 'hit');
      sfx.hit(em > 1); this.burst(to.model.root.position, em > 1 ? 0xffe066 : 0xffffff, em > 1 ? 9 : 5);
      return dmg;
    }
    // host: 몬스터가 상대방(guest)을 때림 → guest에게 알리기
    if (to.kind === 'ally') {
      this.sync?.send({ t: 'hurt', who: to.who, dmg });
      if (!silent) this.ui.floatText(to.model.root.position, '-' + dmg, 'ouch');
      return dmg;
    }
    to.hp -= dmg;
    to.hurtT = 0.15;
    if (!to.boss && from.model) {
      const fp = from.model.root.position, tp = to.model.root.position, d = dist2(fp, tp) || 1;
      tp.x += (tp.x - fp.x) / d * 0.12; tp.z += (tp.z - fp.z) / d * 0.12;
    }
    if (!silent) this.ui.floatText(to.model.root.position, '-' + dmg, em > 1 ? 'big' : (to.kind === 'wild' ? 'hit' : 'ouch'));
    if (to.kind === 'wild') { sfx.hit(em > 1); this.burst(to.model.root.position, em > 1 ? 0xffe066 : 0xffffff, em > 1 ? 9 : 5); }
    else if (to.kind === 'hero') sfx.ouch();
    // 맞으면 반격
    if (to.kind === 'wild' && !to.target) to.target = from;
    if (to.kind === 'pet' && !to.target) to.target = from;
    if (to.hp <= 0) this.kill(to, from);
    return dmg;
  }

  // 반짝가루 보석이 톡 튀어나왔다가 주인공에게 쏙
  dropGems(p, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(GEM_GEO, GEM_MAT);
      m.position.set(p.x, 0.5, p.z);
      this.scene.add(m);
      const a = Math.random() * Math.PI * 2, sp = rand(1.2, 2.6);
      this.drops.push({ m, vx: Math.cos(a) * sp, vy: rand(4, 6), vz: Math.sin(a) * sp, t: 0, wait: 0.5 + i * 0.07 });
    }
  }

  burst(p, color, n = 6) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(PART_GEO, mat);
      m.position.set(p.x, 0.6, p.z);
      const a = Math.random() * Math.PI * 2, sp = rand(2, 4.5);
      this.scene.add(m);
      this.parts.push({ m, vx: Math.cos(a) * sp, vy: rand(2, 5), vz: Math.sin(a) * sp, t: 0.5 });
    }
  }

  shoot(from, to, mult, color, big = false) {
    if (from.kind !== 'wild') sfx.shoot();
    const m = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.25 : 0.14, 10, 8),
      toon(color, { emissive: color, emissiveIntensity: 0.6 }));
    m.position.copy(from.model.root.position).add(V.set(0, 0.6, 0));
    this.scene.add(m);
    this.projectiles.push({ m, from, to, mult, speed: 12 });
  }

  attack(u, t) {
    u.face = Math.atan2(t.model.root.position.x - u.model.root.position.x, t.model.root.position.z - u.model.root.position.z);
    u.atkT = ATTACK_TIME;
    if (u.range > 3) {
      const col = u.elems[0] === 'fire' ? 0xff9a4d : u.elems[0] === 'water' ? 0x6cc4ff : 0xa6e36a;
      this.shoot(u, t, 1, col);
    } else this.damage(u, t);
  }

  kill(u, killer) {
    if (u.dead) return;
    u.dead = true;
    u.hp = 0;
    if (u.kind === 'wild' && this.mode === 'host') this.sync?.send({ t: 'kill', id: u.nid });
    if (u.kind === 'wild' && u.boss) {
      this.state.dust += 40; this.state.bossKills = (this.state.bossKills || 0) + 1;
      this.gainHeroExp(320);
      for (const p of this.units) if (p.kind === 'pet' && !p.dead) this.gainPetExp(p, 320);
      this.ui.floatText(u.model.root.position, '✦40', 'lvup', 1.4);
      this.ui.toast('🎉 대왕버섯을 물리쳤어요! 반짝가루 40개');
      sfx.levelUp(); this.burst(u.model.root.position, 0xfff27a, 24);
      u.fadeT = 1; this.bossT = 600;
      for (const o of this.units) if (o.target === u) o.target = null;
      this.ui.renderTop(); this.ui.save();
      setTimeout(() => this.removeUnit(u), 1500);
      return;
    }
    if (u.kind === 'wild') {
      this.reward(u);
      const isNew = !this.state.dex[u.sp];
      const rate = isNew ? CAPTURE_RATE_NEW : CAPTURE_RATE;
      if (Math.random() < rate) this.makeFriend(u);
      else if (u.minion || u.mirror) { u.fadeT = 1; if (!u.mirror) setTimeout(() => this.removeUnit(u), 1200); }
      else { u.fadeT = 1; setTimeout(() => this.respawn(u), 9000); }
      for (const o of this.units) if (o.target === u) o.target = null;
    } else if (u.kind === 'pet') {
      u.reviveT = 8;
      u.target = null;
      this.ui.toast(`${u.name}가 지쳐서 쉬고 있어요. 곧 돌아와요!`);
    } else if (u.kind === 'hero') {
      this.ui.toast('앗, 쓰러졌어요… 마을에서 다시 일어나요');
      setTimeout(() => this.reviveHero(), 2200);
    }
  }

  respawn(u) {
    if (u.removed || this.mode === 'guest') return;
    const z = u.zone;
    this.removeUnit(u);
    this.spawnWild(z, this.hero.model.root.position);
  }

  reviveHero() {
    const h = this.hero;
    h.dead = false; h.hp = h.maxHp; h.target = null; h.moveTo = null;
    h.model.root.position.set(SPAWN.x, 0, SPAWN.z);
    h.model.root.rotation.z = 0;
    for (const p of this.units) if (p.kind === 'pet') {
      p.dead = false; p.hp = p.maxHp; p.target = null; p.reviveT = 0; p.model.root.visible = true;
      p.model.root.position.set(SPAWN.x + rand(-1.5, 1.5), 0, SPAWN.z + rand(-1, 1));
    }
  }

  reward(u) {
    const exp = Math.round(6 + u.lv * 3.5);
    const dust = 1 + Math.floor(Math.random() * 3) + Math.floor(u.lv / 6);
    this.state.dust += dust;
    this.state.kills = (this.state.kills || 0) + 1;
    this.dropGems(u.model.root.position, Math.min(6, dust));
    this.ui.floatText(u.model.root.position, `✦${dust}`, 'dust', 0.4);
    this.gainHeroExp(exp);
    for (const p of this.units) if (p.kind === 'pet' && !p.dead) this.gainPetExp(p, exp);
    this.ui.renderTop();
    this.ui.save();
  }

  gainHeroExp(n) {
    const s = this.state;
    if (s.lv >= MAX_LV) return;
    s.exp += n;
    while (s.lv < MAX_LV && s.exp >= expToNext(s.lv)) {
      s.exp -= expToNext(s.lv); s.lv++;
      const st = heroStats(s.lv);
      this.hero.maxHp = st.maxHp; this.hero.atk = st.atk; this.hero.hp = st.maxHp;
      this.ui.floatText(this.hero.model.root.position, `Lv ${s.lv}!`, 'lvup', 1.2);
      sfx.levelUp(); this.burst(this.hero.model.root.position, 0xfff27a, 14);
      if (s.lv === 15) { this.ui.toast('🎉 Lv15! 몽글이 칸이 하나 더 열렸어요'); this.ui.openBox(); }
    }
  }

  gainPetExp(u, n) {
    const m = u.data;
    if (m.lv >= MAX_LV) return;
    m.exp += n;
    let up = false;
    while (m.lv < MAX_LV && m.exp >= expToNext(m.lv)) { m.exp -= expToNext(m.lv); m.lv++; up = true; }
    if (up) {
      const st = petStats(m);
      u.maxHp = st.maxHp; u.atk = st.atk; u.hp = st.maxHp;
      this.ui.floatText(u.model.root.position, `Lv ${m.lv}!`, 'lvup', 1.0);
      sfx.levelUp();
    }
  }

  // ---------- 포획 ----------
  makeFriend(u) {
    u.kind = 'friend';
    u.dead = false;
    u.fadeT = 0; u.model.root.rotation.z = 0; u.model.root.scale.setScalar(1); u.model.root.visible = true;
    u.friendT = 20; // 20초 안에 터치
    u.colorT = 0;
    u.bar?.classList.add('friend');
    this.ui.floatText(u.model.root.position, '친구 하고 싶어해요! 터치!', 'friend', 1.3);
    sfx.friend();
  }

  befriend(u) {
    const s = this.state;
    if (s.monggles.length >= BOX_MAX) { this.ui.toast('보관함이 꽉 찼어요 (20칸). 조합으로 자리를 만들어요'); return; }
    const m = { id: s.nextId++, sp: u.sp, lv: Math.max(1, u.lv - 2), exp: 0, shiny: false };
    s.monggles.push(m);
    const isNew = !s.dex[u.sp];
    s.dex[u.sp] = (s.dex[u.sp] || 0) + 1;
    this.ui.floatText(u.model.root.position, '♥', 'heart', 1.2);
    sfx.befriend(); this.burst(u.model.root.position, 0xff8fb4, 14);
    this.ui.toast(isNew ? `✨ 새 친구! ${u.name}를 도감에 등록했어요` : `${u.name}가 친구가 됐어요!`);
    // 파티에 빈자리가 있으면 바로 데려가기
    if (s.party.length < this.partySize()) { s.party.push(m.id); this.syncParty(); }
    const z = u.zone, minion = u.minion || this.mode === 'guest';
    this.removeUnit(u);
    if (!minion) setTimeout(() => this.spawnWild(z, this.hero.model.root.position), 6000);
    this.refreshVivid();
    this.ui.save();
  }

  refreshVivid() {
    const n = Object.keys(this.state.dex).length;
    this.world.setVivid(Math.min(1, n / 12)); // 1·2단계 12종을 다 모으면 가장 선명
  }

  // ---------- 스킬 ----------
  useSkill(slot) {
    const u = this.units.find(x => x.kind === 'pet' && x.slot === slot);
    if (!u || u.dead) return false;
    if (u.skillCd > 0) return false;
    const sk = SPECIES[u.sp].skill;
    const party = this.units.filter(x => (x.kind === 'pet' || x.kind === 'hero') && !x.dead);
    if (sk.type === 'heal') {
      for (const p of party) { const h = Math.round(p.maxHp * sk.power); p.hp = Math.min(p.maxHp, p.hp + h); this.ui.floatText(p.model.root.position, '+' + h, 'heal'); }
    } else if (sk.type === 'guard') {
      u.buffs.guard = sk.dur; u.target = u.target || this.nearestEnemy(u, 6);
      // 주변 적을 끌어당김
      for (const o of this.units) if (o.kind === 'wild' && !o.dead && dist2(o.model.root.position, u.model.root.position) < 6) o.target = u;
      this.ui.floatText(u.model.root.position, '단단!', 'heal');
    } else if (sk.type === 'shield') {
      this.shieldT = sk.dur;
      for (const p of party) this.ui.floatText(p.model.root.position, '🛡', 'heal');
    } else {
      const t = (this.hero.target && !this.hero.target.dead && this.hero.target.kind === 'wild') ? this.hero.target
        : (u.target && !u.target.dead ? u.target : this.nearestEnemy(u, 9));
      if (!t) { this.ui.toast('근처에 상대가 없어요'); return false; }
      u.target = t;
      if (sk.type === 'strike') { this.dashTo(u, t); this.damage(u, t, sk.power); }
      else if (sk.type === 'proj') this.shoot(u, t, sk.power, 0xffe066, true);
      else if (sk.type === 'aoe' || (sk.type === 'slow' && sk.radius)) {
        const c = t.model.root.position;
        for (const o of this.units) if (o.kind === 'wild' && !o.dead && dist2(o.model.root.position, c) < (sk.radius || 3)) {
          if (sk.type === 'slow') { o.buffs.slow = sk.dur; this.damage(u, o, sk.power * 0.6); }
          else this.damage(u, o, sk.power);
        }
        this.ui.ring(c, sk.type === 'slow' ? '#e9f2ff' : '#ffb36b', sk.radius || 3);
      } else if (sk.type === 'slow') { t.buffs.slow = sk.dur; this.shoot(u, t, sk.power, 0xffe066); }
    }
    u.skillCd = sk.cd;
    u.atkT = ATTACK_TIME;
    if (sk.type === 'heal') sfx.heal(); else sfx.skill();
    this.ui.floatText(u.model.root.position, sk.name, 'skill', 0.9);
    return true;
  }

  heroSkill() {
    if (this.heroSkillCd > 0 || this.hero.dead) return false;
    this.buffAtk = 6;
    this.heroSkillCd = 15;
    sfx.cheer();
    for (const p of this.units) if ((p.kind === 'pet' || p.kind === 'hero') && !p.dead) this.ui.floatText(p.model.root.position, '힘내!', 'skill', 0.6);
    return true;
  }

  dashTo(u, t) {
    const a = u.model.root.position, b = t.model.root.position;
    const d = dist2(a, b);
    if (d > 1.2) { const k = (d - 1.1) / d; a.x += (b.x - a.x) * k; a.z += (b.z - a.z) * k; }
  }

  // ---------- 매 프레임 ----------
  update(dt) {
    this.time += dt;
    if (this.buffAtk > 0) this.buffAtk -= dt;
    if (this.heroSkillCd > 0) this.heroSkillCd -= dt;
    if (this.shieldT > 0) this.shieldT -= dt;
    if (this.bossT > 0 && this.mode !== 'guest') { this.bossT -= dt; if (this.bossT <= 0) { this.spawnBoss(); this.ui.toast('🍄 말랑 들판 끝에 대왕버섯이 나타났어요!'); } }

    const zone = this.zoneAt(this.hero.model.root.position);
    if (zone !== this.lastZone) { this.lastZone = zone; this.ui.showZone(zone); }

    for (const u of [...this.units]) {
      if (u.removed) continue;
      for (const k in u.buffs) if (u.buffs[k] > 0) u.buffs[k] -= dt;
      if (u.kind === 'hero') this.updateHero(u, dt, zone);
      else if (u.kind === 'pet') this.updatePet(u, dt, zone);
      else if (u.kind === 'wild' && u.mirror) this.updateMirror(u, dt);
      else if (u.kind === 'wild') this.updateWild(u, dt);
      else if (u.kind === 'ally') continue;
      else if (u.kind === 'friend') this.updateFriend(u, dt);
      this.animate(u, dt);
    }
    // 탄
    for (const p of [...this.projectiles]) {
      const tgt = p.to.model.root.position;
      V.set(tgt.x, 0.6, tgt.z).sub(p.m.position);
      const d = V.length();
      if (d < 0.4 || p.to.dead || p.to.removed) {
        if (!p.to.dead && !p.to.removed) this.damage(p.from, p.to, p.mult);
        this.scene.remove(p.m); this.projectiles.splice(this.projectiles.indexOf(p), 1);
      } else p.m.position.addScaledVector(V.normalize(), Math.min(d, p.speed * dt));
    }
    // 반짝가루 보석
    const hp1 = this.hero.model.root.position;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const q = this.drops[i]; q.t += dt;
      q.m.rotation.y += dt * 6;
      if (q.t < q.wait) {
        q.vy -= 16 * dt;
        q.m.position.x += q.vx * dt; q.m.position.z += q.vz * dt; q.m.position.y += q.vy * dt;
        if (q.m.position.y < 0.15) { q.m.position.y = 0.15; q.vy = Math.abs(q.vy) * 0.4; q.vx *= 0.6; q.vz *= 0.6; }
      } else {
        V.set(hp1.x, 0.8, hp1.z).sub(q.m.position);
        const d = V.length();
        if (d < 0.35) { this.scene.remove(q.m); this.drops.splice(i, 1); sfx.dust(); continue; }
        q.m.position.addScaledVector(V.normalize(), Math.min(d, (8 + q.t * 10) * dt));
      }
    }
    // 파티클
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.t -= dt; q.vy -= 12 * dt;
      q.m.position.x += q.vx * dt; q.m.position.y = Math.max(0.05, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt;
      q.m.scale.setScalar(Math.max(0.01, q.t * 2.2));
      if (q.t <= 0) { this.scene.remove(q.m); this.parts.splice(i, 1); }
    }
    // 할 일 화살표
    this.questT -= dt;
    if (this.questT <= 0) { this.questT = 0.5; this.checkQuest(); }
    const qt = this.questTarget(), hp0 = this.hero.model.root.position;
    if (qt && Math.hypot(qt.x - hp0.x, qt.z - hp0.z) > 6 && !this.hero.dead) {
      const a = Math.atan2(qt.x - hp0.x, qt.z - hp0.z);
      this.arrow.visible = true;
      this.arrow.position.set(hp0.x + Math.sin(a) * 1.7, 0.25 + Math.sin(this.time * 5) * 0.06, hp0.z + Math.cos(a) * 1.7);
      this.arrow.rotation.y = a;
    } else this.arrow.visible = false;
    // 표시
    if (this.marker.material.opacity > 0) { this.marker.material.opacity -= dt * 1.5; this.marker.scale.multiplyScalar(1 + dt * 0.8); }
  }

  zoneAt(p) {
    for (const z of ZONES) if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) return z;
    return null;
  }

  moveToward(u, tx, tz, dt, stopAt = 0.1) {
    const p = u.model.root.position;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d <= stopAt) { u.moving = false; return true; }
    let sp = u.speed * (u.buffs.slow > 0 ? 0.5 : 1);
    const step = Math.min(d - stopAt * 0.9, sp * dt);
    p.x += dx / d * step; p.z += dz / d * step;
    clampToWorld(p);
    u.face = Math.atan2(dx, dz);
    u.moving = true;
    return false;
  }

  updateHero(h, dt, zone) {
    if (h.dead) return;
    if (zone && zone.safe) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.12 * dt);
    else h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.008 * dt);
    h.atkCd -= dt;
    // 나를 때리는 적이 있으면 자동으로 상대
    if (!h.target && !h.moveTo) {
      const att = this.units.find(o => o.kind === 'wild' && !o.dead && (o.target === h || o.target?.kind === 'pet') && dist2(o.model.root.position, h.model.root.position) < 7);
      if (att) h.target = att;
    }
    if (h.target && (h.target.dead || h.target.removed || h.target.kind !== 'wild')) h.target = null;
    if (h.target) {
      const tp = h.target.model.root.position;
      if (this.moveToward(h, tp.x, tp.z, dt, h.range + (h.target.radius || 0)) && h.atkCd <= 0) { this.attack(h, h.target); h.atkCd = 0.75; }
    } else if (h.moveTo) {
      if (this.moveToward(h, h.moveTo.x, h.moveTo.z, dt, 0.15)) h.moveTo = null;
    } else h.moving = false;
  }

  updatePet(u, dt, zone) {
    const hp = this.hero.model.root.position;
    if (u.dead) {
      u.model.root.visible = false;
      u.reviveT -= dt;
      if (u.reviveT <= 0) {
        u.dead = false; u.hp = Math.round(u.maxHp * 0.6); u.model.root.visible = true;
        u.model.root.position.set(hp.x + rand(-1, 1), 0, hp.z + rand(-1, 1));
      }
      return;
    }
    if (zone && zone.safe) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.12 * dt);
    else u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.01 * dt);
    u.atkCd -= dt; if (u.skillCd > 0) u.skillCd -= dt;
    const dHero = dist2(u.model.root.position, hp);
    // 주인공이 멀어지면 무조건 따라감
    if (dHero > 14) u.target = null;
    if (dHero > 22) { u.model.root.position.set(hp.x + rand(-1, 1), 0, hp.z + rand(-1, 1)); }
    // 힐러: 다친 친구 회복
    if (u.role === 'healer' && u.atkCd <= 0) {
      const hurt = this.units.filter(o => (o.kind === 'pet' || o.kind === 'hero') && !o.dead && o.hp < o.maxHp * 0.7)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt && dist2(hurt.model.root.position, u.model.root.position) < 6) {
        const h = Math.round(u.atk * 1.6); hurt.hp = Math.min(hurt.maxHp, hurt.hp + h);
        this.ui.floatText(hurt.model.root.position, '+' + h, 'heal'); u.atkCd = 2.2; u.atkT = ATTACK_TIME; return;
      }
    }
    // 체력이 낮으면 뒤로 빠짐
    if (u.hp < u.maxHp * 0.3 && u.target) { u.target = null; u.retreatT = 3; }
    if (u.retreatT > 0) u.retreatT -= dt;
    // 목표: 주인공 목표 우선
    const ht = this.hero.target;
    if (ht && !ht.dead && ht.kind === 'wild' && !(u.retreatT > 0)) u.target = ht;
    if (u.target && (u.target.dead || u.target.removed || u.target.kind !== 'wild')) u.target = null;
    if (u.target) {
      const tp = u.target.model.root.position;
      if (this.moveToward(u, tp.x, tp.z, dt, u.range * 0.9 + (u.target.radius || 0)) && u.atkCd <= 0) {
        this.attack(u, u.target); u.atkCd = u.role === 'healer' ? 1.6 : 1.1;
      }
    } else {
      // 주인공 뒤쪽 졸졸
      const back = this.hero.face + Math.PI + (u.slot - (this.partySize() - 1) / 2) * 0.9;
      const fx = hp.x + Math.sin(back) * 1.6, fz = hp.z + Math.cos(back) * 1.6;
      this.moveToward(u, fx, fz, dt, 0.5);
    }
  }

  updateWild(u, dt) {
    if (u.dead) {
      if (u.fadeT > 0) {
        u.fadeT -= dt;
        const k = 1 - u.fadeT;
        u.model.root.rotation.z = Math.min(1.5, k * 4);           // 옆으로 꽈당
        u.model.root.scale.setScalar(Math.max(0.01, u.fadeT < 0.4 ? u.fadeT / 0.4 : 1));
        if (u.fadeT <= 0) u.model.root.visible = false;
      }
      return;
    }
    u.atkCd -= dt;
    if (u.target && (u.target.dead || u.target.removed)) u.target = null;
    if (u.boss) this.updateBoss(u, dt);
    const p = u.model.root.position;
    if (u.target) {
      // 너무 멀리 끌려가면 집으로
      if (p.distanceTo(u.home) > 15) { u.target = null; u.returning = true; }
      else {
        const tp = u.target.model.root.position;
        if (this.moveToward(u, tp.x, tp.z, dt, u.range * 0.9) && u.atkCd <= 0) { this.attack(u, u.target); u.atkCd = 1.5; }
        return;
      }
    }
    if (u.returning) {
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.3 * dt);
      if (this.moveToward(u, u.home.x, u.home.z, dt, 0.5)) u.returning = false;
      return;
    }
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.02 * dt);
    u.wanderT -= dt;
    if (u.wanderT <= 0) {
      u.wanderT = rand(2, 5);
      u.wanderTo = Math.random() < 0.6 ? clampToWorld(new THREE.Vector3(u.home.x + rand(-3, 3), 0, u.home.z + rand(-3, 3))) : null;
    }
    if (u.wanderTo) { const sp = u.speed; u.speed = sp * 0.35; if (this.moveToward(u, u.wanderTo.x, u.wanderTo.z, dt, 0.2)) u.wanderTo = null; u.speed = sp; }
    else u.moving = false;
  }

  updateFriend(u, dt) {
    u.colorT = Math.min(1, u.colorT + dt * 1.2);
    u.model.setColor(u.colorT);
    u.friendT -= dt;
    u.moving = false;
    // 주인공 쪽을 바라보며 깡충
    const hp = this.hero.model.root.position, p = u.model.root.position;
    u.face = Math.atan2(hp.x - p.x, hp.z - p.z);
    if (Math.random() < dt * 3) this.ui.sparkle(p);
    if (u.friendT <= 0) {
      this.ui.toast(`${u.name}가 숲으로 돌아갔어요`);
      const z = u.zone, minion = u.minion || this.mode === 'guest'; this.removeUnit(u); if (!minion) setTimeout(() => this.spawnWild(z, hp), 5000);
    }
  }

  animate(u, dt) {
    const m = u.model, t = this.time + (u.model.root.id % 10) * 0.37;
    // 방향 부드럽게
    let df = u.face - m.root.rotation.y;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    m.root.rotation.y += df * Math.min(1, dt * 10);
    if (u.dead && u.kind === 'hero') { m.root.rotation.z = Math.min(1.4, m.root.rotation.z + dt * 4); return; }
    if (u.atkT > 0) u.atkT -= dt;
    if (u.hurtT > 0) { u.hurtT -= dt; m.flash(true); if (u.hurtT <= 0) m.flash(false); }
    animateModel(m, {
      t, moving: u.moving || u.kind === 'friend', atk: u.atkT, ranged: u.range > 3 && u.kind !== 'hero',
      hurt: u.hurtT,
    }, dt);
  }


  nearCauldron() { return dist2(this.hero.model.root.position, CAULDRON) < 4; }
}
