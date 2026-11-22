// 몽글믹스 — 화면 UI (상단 정보, 스킬 버튼, 가방, 도감, 믹스 솥)
import * as THREE from '../lib/three.min.js';
import { SPECIES, ELEM, DEX_ORDER, mixResult, mixMinLv, coupleResult, COUPLE_SHINY, MIX_COST, MIX_MIN_LV, BOX_MAX, expToNext, MAX_LV, QUESTS, JOBS, SHOP, EQUIP, TIERS, ENHANCE_RATE, enhanceCost, itemStat, INV_MAX } from './data.js';
import { BOUNDS } from './world.js';
import { makeMonggle, makeHero } from './models.js';
import { sfx, isMuted, setMuted } from './sfx.js';
import { newSave } from './save.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---------- 몽글이 초상화 (3D를 작은 그림으로) ----------
const iconCache = {};
export function heroIcon(look, job) {
  const key = 'hero-' + look + '-' + job;
  if (iconCache[key]) return iconCache[key];
  icon('bulssi'); // 렌더러 준비
  const m = makeHero(look, job);
  m.shadow.visible = false; m.root.rotation.y = -0.4;
  iconScene.add(m.root);
  iconCam.position.set(0.5, 1.3, 3.4); iconCam.lookAt(0, 0.75, 0);
  iconR.render(iconScene, iconCam);
  iconCache[key] = iconR.domElement.toDataURL();
  iconScene.remove(m.root);
  return iconCache[key];
}
let iconR = null, iconScene, iconCam;
export function icon(sp, shiny = false) {
  const key = sp + (shiny ? '*' : '');
  if (iconCache[key]) return iconCache[key];
  if (!iconR) {
    iconR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    iconR.setSize(160, 160); iconR.setPixelRatio(1);
    iconScene = new THREE.Scene();
    iconScene.add(new THREE.HemisphereLight(0xffffff, 0xb8a8d8, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 3, 4); iconScene.add(d);
    iconCam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  }
  const m = makeMonggle(sp, { shiny });
  m.shadow.visible = false;
  m.root.rotation.y = -0.45;
  iconScene.add(m.root);
  const box = new THREE.Box3().setFromObject(m.root);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  iconCam.position.set(c.x + size * 0.25, c.y + size * 0.4, c.z + size * 1.3);
  iconCam.lookAt(c);
  iconR.render(iconScene, iconCam);
  iconCache[key] = iconR.domElement.toDataURL();
  iconScene.remove(m.root);
  return iconCache[key];
}

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const elemTags = sp => SPECIES[sp].elems.map(e => `<span class="el" style="--c:${ELEM[e].color}">${ELEM[e].icon}${ELEM[e].name}</span>`).join('');
// 받침에 맞는 조사 (하은과 / 광희와)
export const josa = (w, a, b) => { const c = (w || '').charCodeAt((w || '').length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };
const ROLE = { melee: '근거리', ranged: '원거리', tank: '탱커', healer: '힐러', aoe: '범위' };

export class UI {
  constructor({ camera, state, onSave }) {
    this.camera = camera; this.state = state; this.onSave = onSave;
    this.fx = $('#fx'); this.bars = $('#bars');
    this.build();
  }
  attach(game, net) { this.game = game; this.net = net; this.renderTop(); this.renderParty(); this.renderSkills(); this.drawAuto(); }
  save() { this.onSave(); }

  build() {
    const hud = $('#hud');
    hud.innerHTML = `
      <div id="me" class="card">
        <div class="row"><b id="meName"></b><span id="meLv" class="lv"></span></div>
        <div class="bar hp"><i id="meHp"></i></div>
        <div class="bar xp"><i id="meXp"></i></div>
      </div>
      <div id="party"></div>
      <div id="quest" class="hidden"></div>
      <div id="topRight">
        <div id="dust" class="pill">✦ <b>0</b></div>
        <div id="online" class="pill off"><i class="dot"></i><span>혼자 노는 중</span></div>
        <button id="micBtn" class="round" aria-label="마이크">🎤</button>
        <button id="musicBtn" class="round" aria-label="음악">🎵</button>
        <button id="muteBtn" class="round" aria-label="소리">🔊</button>
      </div>
      <canvas id="minimap" width="240" height="180"></canvas>
      <div id="bossBar" class="hidden"><b>🍄 대왕버섯</b><div class="bar"><i></i></div></div>
      <div id="zoneName"></div>
      <div id="toast"></div>
      <div id="leftBtns">
        <button id="bagBtn" class="round big">🎒<small>가방</small></button>
        <button id="dexBtn" class="round big">📖<small>도감</small></button>
        <button id="emoBtn" class="round big">😊<small>표현</small></button>
        <button id="potBtn" class="round big">🧪<small>물약</small><b class="badge2">0</b></button>
        <div id="emoTray" class="hidden"><button>❤️</button><button>😆</button><button>😠</button><button>😭</button><button class="chatOpen">✏️</button></div>
        <div id="chatRow" class="hidden"><input id="chatIn" maxlength="40" placeholder="하고 싶은 말"><button id="chatSend">보내기</button></div>
      </div>
      <div id="centerBtns"><button id="shopBtn" class="mixBtn shop hidden">🏪 상점</button><button id="mixBtn" class="mixBtn hidden">🍲 믹스 솥 열기</button></div>
      <div id="buffs"></div>
      <div id="skills"></div>
      <button id="atkBtn" class="atkBtn">⚔️<small>공격</small></button>
      <button id="autoBtn" class="pill autoBtn">🤖 자동 <b>OFF</b></button>
      <div id="panel" class="hidden"><div class="sheet"><button class="x">✕</button><div class="body"></div></div></div>
    `;
    $('#bagBtn').onclick = () => this.openBox();
    $('#dexBtn').onclick = () => this.openDex();
    $('#mixBtn').onclick = () => this.openMix();
    $('#micBtn').onclick = async () => {
      const want = !this.net.mic;
      $('#micBtn').classList.add('busy');
      const ok = await this.net.setMic(want);
      $('#micBtn').classList.remove('busy');
      if (ok) $('#micBtn').classList.toggle('on', this.net.mic);
    };
    $('#panel .x').onclick = () => this.closePanel();
    $('#emoBtn').onclick = () => { $('#emoTray').classList.toggle('hidden'); sfx.tap(); };
    $('#shopBtn').onclick = () => this.openShop();
    $('#atkBtn').onpointerdown = e => { e.stopPropagation(); if (this.game.attackNearest()) this.pulse($('#atkBtn')); };
    $('#autoBtn').onclick = () => {
      this.state.auto = !this.state.auto; this.drawAuto(); this.save(); sfx.tap();
      this.toast(this.state.auto ? '🤖 자동 사냥 켬: 가까운 몬스터를 알아서 공격하고 기술·물약도 써요' : '자동 사냥 끔');
    };
    $('#potBtn').onclick = () => { if (this.game.usePotion()) this.pulse($('#potBtn')); };
    $('.chatOpen').onclick = e => { e.stopPropagation(); $('#emoTray').classList.add('hidden'); $('#chatRow').classList.remove('hidden'); $('#chatIn').focus(); };
    const sendChat = () => {
      const t = $('#chatIn').value.trim(); if (!t) { $('#chatRow').classList.add('hidden'); return; }
      $('#chatIn').value = ''; $('#chatRow').classList.add('hidden');
      this.bubble(this.game.hero.model.root, t); this.net.sendChat(t);
    };
    $('#chatSend').onclick = sendChat;
    $('#chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
    $('#emoTray').querySelectorAll('button:not(.chatOpen)').forEach(b => b.onclick = () => {
      $('#emoTray').classList.add('hidden');
      this.emote(this.game.hero.model.root, b.textContent);
      this.net.sendEmote(b.textContent);
    });
    $('#musicBtn').onclick = () => this.openMusic();
    $('#online').onclick = () => this.openDiag();
    const mb = $('#muteBtn');
    const drawMute = () => { mb.textContent = isMuted() ? '🔇' : '🔊'; };
    drawMute();
    mb.onclick = () => { setMuted(!isMuted()); drawMute(); sfx.tap(); };
    $('#panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') this.closePanel(); });
  }

  // ---------- 상단 ----------
  drawAuto() {
    const b = $('#autoBtn'); if (!b) return;
    b.classList.toggle('on', !!this.state.auto);
    b.querySelector('b').textContent = this.state.auto ? 'ON' : 'OFF';
  }

  renderTop() {
    const s = this.state, g = this.game;
    $('#meName').textContent = s.name;
    $('#meLv').textContent = `${(JOBS[s.job] || JOBS.mage).icon} Lv ${s.lv}`;
    $('#dust b').textContent = s.dust;
    if (g) {
      $('#meHp').style.width = (g.hero.hp / g.hero.maxHp * 100) + '%';
      $('#meXp').style.width = (s.lv >= MAX_LV ? 100 : s.exp / expToNext(s.lv) * 100) + '%';
    }
  }

  renderParty() {
    if (!this.game) return;
    const box = $('#party'); box.innerHTML = '';
    for (let i = 0; i < this.game.partySize(); i++) {
      const u = this.game.units.find(x => x.kind === 'pet' && x.slot === i);
      const c = h('div', 'pcard' + (u ? '' : ' empty'));
      if (u) c.innerHTML = `<img src="${icon(u.sp, u.data.shiny)}"><div><b>${u.name}</b> <span class="lv">${u.data.lv}</span><div class="bar hp sm"><i></i></div></div>`;
      else c.innerHTML = `<span>+ 빈 칸</span>`;
      c.onclick = () => this.openBox();
      box.appendChild(c);
    }
    this.renderSkills();
  }

  renderQuest() {
    const s = this.state, q = QUESTS[s.quest || 0], el = $('#quest');
    if (!q) { el.classList.add('hidden'); return; }
    const c = q.count ? q.count(s) : null;
    const html = `<span>📜</span><div><b>할 일</b><p>${q.text}${c ? ` <em>${c[0]}/${c[1]}</em>` : ''}</p></div>`;
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
    el.classList.remove('hidden');
    const pt = $('#party');
    el.style.top = (pt.offsetTop + pt.offsetHeight + 6) + 'px';
  }

  renderSkills() {
    if (!this.game) return;
    const box = $('#skills'); box.innerHTML = '';
    const hb = h('button', 'skill hero', `<span class="ic">📣</span><small>응원</small><i class="cd"></i>`);
    hb.onpointerdown = e => { e.stopPropagation(); if (this.game.heroSkill()) this.pulse(hb); else this.shake(hb); };
    box.appendChild(hb);
    const J = JOBS[this.state.job] || JOBS.mage;
    const jb = h('button', 'skill job', `<span class="ic">${J.icon}</span><small>${J.skill.name}</small><i class="cd"></i>`);
    jb.onpointerdown = e => { e.stopPropagation(); if (this.game.jobSkill()) this.pulse(jb); else this.shake(jb); };
    box.appendChild(jb);
    for (let i = 0; i < this.game.partySize(); i++) {
      const u = this.game.units.find(x => x.kind === 'pet' && x.slot === i);
      if (!u) continue;
      const sk = SPECIES[u.sp].skill;
      const inh = u.data.inh && SPECIES[u.data.inh] ? `<span class="inh" title="물려받은 기술: ${SPECIES[u.data.inh].skill.name}"><img src="${icon(u.data.inh)}"></span>` : '';
      const b = h('button', 'skill', `<img src="${icon(u.sp, u.data.shiny)}"><small>${sk.name}</small><i class="cd"></i>${inh}`);
      b.dataset.slot = i;
      b.onpointerdown = e => { e.stopPropagation(); if (this.game.useSkill(i)) this.pulse(b); else this.shake(b); };
      box.appendChild(b);
    }
  }
  pulse(b) { b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
  shake(b) { sfx.error(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }

  // 매 프레임
  tick() {
    const g = this.game; if (!g) return;
    this.renderTop();
    const cards = $('#party').children;
    for (let i = 0; i < cards.length; i++) {
      const u = g.units.find(x => x.kind === 'pet' && x.slot === i);
      const bar = cards[i].querySelector('.bar i');
      if (u && bar) { bar.style.width = (u.hp / u.maxHp * 100) + '%'; cards[i].classList.toggle('down', u.dead); }
    }
    for (const b of $('#skills').children) {
      const cd = b.querySelector('.cd');
      let left = 0, total = 1;
      if (b.classList.contains('hero')) { left = g.heroSkillCd; total = 15; }
      else if (b.classList.contains('job')) { left = g.jobSkillCd || 0; total = (JOBS[this.state.job] || JOBS.mage).skill.cd; }
      else { const u = g.units.find(x => x.kind === 'pet' && x.slot === +b.dataset.slot); if (u) { left = u.dead ? 99 : u.skillCd; total = SPECIES[u.sp].skill.cd; b.querySelector('.inh')?.classList.toggle('ready', !u.dead && u.skill2Cd <= 0); } }
      cd.style.height = Math.max(0, Math.min(1, left / total)) * 100 + '%';
      b.classList.toggle('ready', left <= 0);
    }
    const panelOpen = !$('#panel').classList.contains('hidden');
    $('#mixBtn').classList.toggle('hidden', !g.nearCauldron() || panelOpen);
    const mixLabel = (this.state.coupleIn || []).length ? '🍲 믹스 솥 열기 💌' : '🍲 믹스 솥 열기';
    if ($('#mixBtn').textContent !== mixLabel) $('#mixBtn').textContent = mixLabel;
    $('#shopBtn').classList.toggle('hidden', !(g.lastZone?.safe) || panelOpen);
    $('#potBtn .badge2').textContent = this.state.items?.potion || 0;
    $('#potBtn').classList.toggle('empty', !this.state.items?.potion);
    const bf = [];
    if (g.candyT > 0) bf.push(`🍬 ${Math.ceil(g.candyT)}초`);
    if (g.buffAtk > 0) bf.push(`📣 ${Math.ceil(g.buffAtk)}초`);
    if (g.shieldT > 0) bf.push(`🛡 ${Math.ceil(g.shieldT)}초`);
    const bh = bf.map(x => `<span>${x}</span>`).join('');
    if ($('#buffs').dataset.h !== bh) { $('#buffs').innerHTML = bh; $('#buffs').dataset.h = bh; }
    // 머리 위 체력바
    for (const u of g.units) this.placeBar(u);
    if (this.partnerTag) this.placeTag();
    // 보스 체력
    const bs = g.boss, bb = $('#bossBar');
    const near = bs && !bs.dead && !bs.removed && Math.hypot(bs.model.root.position.x - g.hero.model.root.position.x, bs.model.root.position.z - g.hero.model.root.position.z) < 16;
    bb.classList.toggle('hidden', !near);
    if (near) bb.querySelector('i').style.width = (bs.hp / bs.maxHp * 100) + '%';
    this.mapT = (this.mapT || 0) + 1;
    if (this.mapT % 6 === 0) this.drawMap();
  }

  drawMap() {
    const c = $('#minimap'), x = c.getContext('2d'), g = this.game;
    const W = c.width, H = c.height;
    // 월드 좌표 → 미니맵
    const B = BOUNDS;
    const k = Math.min(W / (B.maxX - B.minX), H / (B.maxZ - B.minZ));
    const ox = (W - (B.maxX - B.minX) * k) / 2, oz = (H - (B.maxZ - B.minZ) * k) / 2;
    const P = (px, pz) => [ox + (px - B.minX) * k, oz + (pz - B.minZ) * k];
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(159, 224, 138, .9)'; x.beginPath(); x.roundRect(0, 0, W, H, 22); x.fill();
    const circ = (px, pz, r, col) => { const [a, b] = P(px, pz); x.fillStyle = col; x.beginPath(); x.arc(a, b, r * k, 0, 7); x.fill(); };
    circ(34, 6, 20, '#8bd977'); circ(-46, -16, 20, '#a99de0'); circ(4, -47, 13, '#f6e6b4'); circ(4, -47, 9, '#6cc8ff'); circ(0, 0, 13, '#f3e2b8');
    const dot = (px, pz, r, col, ring) => { const [a, b] = P(px, pz); x.fillStyle = col; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); if (ring) { x.lineWidth = 3; x.strokeStyle = ring; x.stroke(); } };
    for (const u of g.units) if (u.kind === 'wild' && !u.dead && !u.boss) dot(u.model.root.position.x, u.model.root.position.z, 3, 'rgba(90,70,110,.45)');
    if (g.boss && !g.boss.dead && !g.boss.removed) { const bp = g.boss.model.root.position; dot(bp.x, bp.z, 8, '#ff5f7a', '#fff'); }
    dot(0, -2, 5, '#9f78ff');
    if (this.partnerModel) { const pp = this.partnerModel.root.position; dot(pp.x, pp.z, 7, '#ff8fb4', '#fff'); }
    const hp = g.hero.model.root.position; dot(hp.x, hp.z, 7, '#fff', '#7a56d6');
  }

  // ---------- 머리 위 체력바 ----------
  makeBar(u) {
    if (u.kind === 'hero' || u.kind === 'pet' || u.kind === 'ally') return null;
    const b = h('div', 'ubar ' + u.kind, `<span class="nm">${u.kind === 'wild' ? `Lv${u.lv} ` : ''}${u.name}</span>${u.kind === 'npc' ? '' : '<div class="bar hp sm"><i></i></div>'}`);
    this.bars.appendChild(b);
    return b;
  }
  project(p, y = 1.4) {
    const v = new THREE.Vector3(p.x, y, p.z).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, vis: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }
  placeBar(u) {
    if (!u.bar) return;
    if (u.boss) { u.bar.style.display = 'none'; return; }
    if (u.kind === 'npc') {
      const s2 = this.project(u.model.root.position, 2.3);
      u.bar.style.display = s2.vis ? '' : 'none';
      u.bar.style.transform = `translate(${s2.x}px, ${s2.y}px)`;
      return;
    }
    const show = !u.dead && (u.kind === 'friend' || (u.kind === 'wild' && (u.hp < u.maxHp || this.game.hero.target === u)));
    const s = this.project(u.model.root.position, u.sp && SPECIES[u.sp].stage === 2 ? 1.75 : 1.45);
    if (!show || !s.vis) { u.bar.style.display = 'none'; return; }
    u.bar.style.display = '';
    u.bar.style.transform = `translate(${s.x}px, ${s.y}px)`;
    u.bar.querySelector('i').style.width = (u.hp / u.maxHp * 100) + '%';
    u.bar.classList.toggle('targeted', this.game.hero.target === u);
    if (u.kind === 'wild' && u.lvShown !== this.state.lv) {
      // 레벨 차이 색: 쉬움 초록 · 비슷 흰색 · 셈 주황 · 위험 빨강
      u.lvShown = this.state.lv;
      const d = u.lv - this.state.lv;
      u.bar.dataset.diff = d <= -5 ? 'easy' : d < 3 ? 'even' : d < 7 ? 'hard' : 'danger';
    }
  }

  // ---------- 효과 글자 ----------
  floatText(p, text, kind = 'hit', dur = 0.8) {
    const s = this.project(p, 1.6);
    if (!s.vis) return;
    const e = h('div', 'ft ' + kind, text);
    e.style.left = s.x + (Math.random() * 30 - 15) + 'px'; e.style.top = s.y + 'px';
    e.style.animationDuration = dur + 0.4 + 's';
    this.fx.appendChild(e);
    setTimeout(() => e.remove(), (dur + 0.4) * 1000);
  }
  sparkle(p) {
    const s = this.project(p, 0.6 + Math.random());
    const e = h('div', 'spk', '✦');
    e.style.left = s.x + (Math.random() * 60 - 30) + 'px'; e.style.top = s.y + 'px';
    this.fx.appendChild(e); setTimeout(() => e.remove(), 900);
  }
  ring(p, color, r) {
    const s = this.project(p, 0.1), s2 = this.project({ x: p.x + r, z: p.z }, 0.1);
    const e = h('div', 'ring'); const R = Math.abs(s2.x - s.x);
    Object.assign(e.style, { left: s.x - R + 'px', top: s.y - R * 0.6 + 'px', width: R * 2 + 'px', height: R * 1.2 + 'px', borderColor: color });
    this.fx.appendChild(e); setTimeout(() => e.remove(), 600);
  }
  toast(msg) {
    const t = $('#toast');
    const e = h('div', 'tmsg', msg); t.appendChild(e);
    while (t.children.length > 2) t.firstChild.remove();
    setTimeout(() => e.classList.add('out'), 2600);
    setTimeout(() => e.remove(), 3100);
  }
  showZone(z) {
    const e = $('#zoneName');
    e.innerHTML = z ? z.name + (z.lv ? `<small>Lv ${z.lv[0]}~${z.lv[1]}</small>` : '') : '';
    e.classList.remove('show'); void e.offsetWidth;
    if (z) e.classList.add('show');
  }

  // ---------- 통화 점검 ----------
  openDiag() {
    const d = this.net?.diag?.() || {};
    const ok = v => v ? '✅' : '❌';
    const b = this.openPanel('📡 같이 하기 상태');
    const vst = (d.voice || '').split(' / ')[0];
    let tip = '';
    if (!d.login) tip = '비밀번호로 로그인해야 같이 할 수 있어요.';
    else if (d.partner === '접속 안 함') tip = '상대가 아직 접속 안 했어요.';
    else if ((d.partner || '').includes('다름')) tip = '두 폰의 게임 버전이 달라요. 둘 다 앱을 완전히 껐다 켜거나 새로고침해 주세요.';
    else if (!d.myMic || !d.theirMic) tip = '둘 다 🎤를 켜야 통화가 연결돼요.';
    else if (vst === 'failed') tip = '인터넷 환경 때문에 연결이 막혔어요. 중계 서버가 필요해요 — 광희쌤한테 알려 주세요.';
    else if (vst === 'connecting' || vst === 'new') tip = '연결 중이에요. 10초쯤 기다려 보세요.';
    else if (vst === 'connected') tip = '통화 연결됐어요. 소리가 안 나면 화면을 한 번 눌러 주세요.';
    b.insertAdjacentHTML('beforeend', `
      <div class="kv"><span>로그인</span><b>${ok(d.login)}</b></div>
      <div class="kv"><span>상대</span><b>${d.partner || '-'}</b></div>
      <div class="kv"><span>내 마이크 / 상대 마이크</span><b>${ok(d.myMic)} / ${ok(d.theirMic)}</b></div>
      <div class="kv"><span>통화 연결</span><b>${d.voice || '-'}</b></div>
      <div class="kv"><span>같이 사냥 연결</span><b>${d.linked ? '✅' : d.game || '-'}</b></div>
      <div class="kv"><span>내 게임 버전</span><b>${d.version || '-'}</b></div>
      <p class="hint" style="font-size:15px;color:var(--ink)">${tip}</p>
      <div class="btns center"><button class="btn ghost" id="dgRe">다시 보기</button><button class="btn ghost" id="dgReload">새로고침</button></div>`);
    $('#dgRe', b).onclick = () => this.openDiag();
    $('#dgReload', b).onclick = () => location.reload();
  }

  newVersion() {
    if ($('#newVer')) return;
    const e = h('button', 'newVer', '✨ 새 버전이 나왔어요 · 눌러서 새로고침');
    e.id = 'newVer';
    e.onclick = () => { this.save(); setTimeout(() => location.reload(), 300); };
    $('#hud').appendChild(e);
  }

  // ---------- 🎵 음악 (유튜브 링크) ----------
  openMusic() {
    const last = localStorage.getItem('monggle-music') || '';
    const b = this.openPanel('🎵 음악 들으며 하기');
    b.insertAdjacentHTML('beforeend', `
      <p class="hint" style="text-align:left">유튜브 앱에서 노래나 재생목록의 <b>공유 → 링크 복사</b>를 한 뒤 아래에 붙여 넣어요. 게임 화면 구석의 작은 창에서 나와요.</p>
      <input id="ytIn" class="tin" placeholder="https://youtu.be/... 또는 재생목록 링크" value="${last.replace(/"/g, '')}">
      <div class="btns center"><button class="btn" id="ytGo">재생</button>${this.ytOpen ? '<button class="btn ghost" id="ytStop">끄기</button>' : ''}</div>
      <p class="hint">유튜브 프리미엄이 있으면 유튜브 앱을 켜 두고 게임으로 와도 계속 나와요. 게임 효과음은 음악을 멈추지 않아요.</p>`);
    $('#ytGo', b).onclick = () => {
      const url = $('#ytIn', b).value.trim();
      const src = this.ytEmbed(url);
      if (!src) { this.toast('유튜브 링크가 아닌 것 같아요'); return; }
      localStorage.setItem('monggle-music', url);
      this.showPlayer(src);
      this.closePanel();
    };
    const st = $('#ytStop', b); if (st) st.onclick = () => { this.hidePlayer(); this.closePanel(); };
  }
  ytEmbed(url) {
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      const list = u.searchParams.get('list');
      let id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : (u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/) || [])[2]);
      const q = 'autoplay=1&playsinline=1&rel=0';
      if (id) return `https://www.youtube.com/embed/${id}?${q}${list ? '&list=' + list : '&loop=1&playlist=' + id}`;
      if (list) return `https://www.youtube.com/embed/videoseries?list=${list}&${q}`;
    } catch {}
    return null;
  }
  showPlayer(src) {
    let w = $('#ytWin');
    if (!w) {
      w = h('div', '', `<div class="bar2"><span>🎵 음악</span><small>끌어서 옮기기</small><button class="x2">✕</button></div><iframe allow="autoplay; encrypted-media" allowfullscreen></iframe>`);
      w.id = 'ytWin';
      document.body.appendChild(w);
      $('.x2', w).onclick = () => this.hidePlayer();
      // 끌어서 옮기기
      const bar = $('.bar2', w);
      bar.addEventListener('pointerdown', e => {
        if (e.target.closest('.x2')) return;
        const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        const mv = ev => { w.style.left = Math.max(0, Math.min(innerWidth - r.width, ev.clientX - dx)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - dy)) + 'px'; };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
    }
    $('iframe', w).src = src;
    w.classList.remove('hidden');
    this.ytOpen = true;
    this.toast('노래가 안 나오면 작은 창의 ▶를 한 번 눌러 주세요');
  }
  hidePlayer() {
    const w = $('#ytWin'); if (!w) return;
    $('iframe', w).src = 'about:blank';
    w.classList.add('hidden');
    this.ytOpen = false;
  }

  // ---------- 상점 ----------
  openShop() {
    const s = this.state;
    const b = this.openPanel(`🏪 마을 상점 <small>✦ ${s.dust}</small>`);
    const list = h('div', 'shop');
    list.innerHTML = SHOP.map(it => `
      <div class="sitem"><span class="si">${it.icon}</span><div><b>${it.name}</b> <small>✦${it.price}</small><p>${it.desc}</p>
      ${it.id === 'potion' ? `<em>가진 개수: ${s.items.potion || 0}</em>` : ''}</div>
      <button class="btn" data-id="${it.id}" data-n="1">사기</button>${it.id === 'potion' ? `<button class="btn ghost" data-id="${it.id}" data-n="5">5개</button>` : ''}</div>`).join('');
    b.appendChild(list);
    list.onclick = e => {
      const btn = e.target.closest('button'); if (!btn) return;
      const it = SHOP.find(x => x.id === btn.dataset.id), n = +btn.dataset.n;
      if (s.dust < it.price * n) { this.shake(btn); this.toast('반짝가루가 모자라요'); return; }
      s.dust -= it.price * n;
      if (it.id === 'candy') { this.game.candyT = 60; this.toast('🍬 냠! 1분 동안 친구가 될 확률 2배'); }
      else { s.items[it.id] = (s.items[it.id] || 0) + n; this.toast(`${it.icon} ${it.name} ${n}개를 샀어요`); }
      sfx.dust(); this.save(); this.renderTop(); this.openShop();
    };
  }

  // ---------- 말풍선 채팅 ----------
  bubble(root, text) {
    if (!root) return;
    sfx.emote();
    const el = h('div', 'cbub'); el.textContent = text;
    this.fx.appendChild(el);
    const t0 = performance.now();
    const follow = () => {
      const k = (performance.now() - t0) / 4500;
      if (k >= 1 || !el.isConnected) { el.remove(); return; }
      const s = this.project(root.position, 2.15);
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      el.style.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
      requestAnimationFrame(follow);
    };
    follow();
  }
  partnerChat(name, text) {
    if (this.partnerModel) this.bubble(this.partnerModel.root, text);
    this.toast(`💬 ${esc(name)}: ${esc(text)}`);
  }

  // ---------- 감정표현 ----------
  emote(root, e) {
    if (!root) return;
    sfx.emote();
    const el = h('div', 'emo', e);
    this.fx.appendChild(el);
    const t0 = performance.now();
    const follow = () => {
      const k = (performance.now() - t0) / 2200;
      if (k >= 1 || !el.isConnected) { el.remove(); return; }
      const s = this.project(root.position, 2.1);
      el.style.transform = `translate(${s.x}px, ${s.y - k * 20}px) scale(${k < 0.1 ? k * 10 : 1})`;
      el.style.opacity = k > 0.8 ? (1 - k) * 5 : 1;
      requestAnimationFrame(follow);
    };
    follow();
  }
  partnerEmote(e) {
    if (this.partnerModel) this.emote(this.partnerModel.root, e);
    else this.toast(`상대가 ${e} 를 보냈어요`);
  }

  // ---------- 접속·통화 ----------
  renderOnline(p) {
    const o = $('#online');
    o.classList.toggle('off', !p);
    $('#online span').textContent = p ? (this.linked ? `${josa(p.name, '과', '와')} 같이 사냥 중` : `${p.name} 접속 중`) : (this.net?.on ? '상대 오프라인' : '혼자 노는 중');
  }
  renderCall(st) {
    const b = $('#micBtn');
    b.dataset.st = st;
    b.title = { on: '통화 중', wait: '연결 중…', 'their-off': '상대 마이크 꺼짐', alone: '상대가 접속하면 연결돼요', off: '마이크 꺼짐' }[st];
  }
  setLinked(on) {
    $('#online').classList.toggle('linked', on);
    this.linked = on;
    this.renderOnline(this.net?.partner() || (on ? { name: this.game?.sync?.partner?.n || '상대' } : null));
  }
  setMyVoice(lv) { $('#micBtn').style.setProperty('--lv', Math.min(1, lv * 4)); }
  setPartnerVoice(lv) { this.partnerVoice = lv; if (this.partnerTag) this.partnerTag.classList.toggle('talk', lv > 0.06); }
  attachPartner(model, name) {
    this.partnerModel = model;
    if (!this.partnerTag) { this.partnerTag = h('div', 'ptag'); this.bars.appendChild(this.partnerTag); }
    this.partnerTag.innerHTML = `<span class="dot"></span>${name}<span class="voice">💬</span>`;
  }
  detachPartner() { this.partnerTag?.remove(); this.partnerTag = null; this.partnerModel = null; }
  placeTag() {
    const s = this.project(this.partnerModel.root.position, 1.75);
    this.partnerTag.style.display = s.vis ? '' : 'none';
    this.partnerTag.style.transform = `translate(${s.x}px, ${s.y}px)`;
  }

  // ---------- 패널 ----------
  openPanel(title, cls = '') {
    const p = $('#panel'); p.classList.remove('hidden'); p.className = cls;
    const b = $('#panel .body'); b.innerHTML = `<h2>${title}</h2>`; b.onclick = null;
    this.panelOpen = true;
    return b;
  }
  closePanel() { $('#panel').classList.add('hidden'); this.panelOpen = false; }

  monCard(m, extra = '') {
    const s = SPECIES[m.sp];
    const inParty = this.state.party.includes(m.id);
    return `<div class="mcard ${m.shiny ? 'shiny' : ''} ${inParty ? 'inparty' : ''}" data-id="${m.id}">
      <img src="${icon(m.sp, m.shiny)}"><div class="nm">${m.shiny ? '✨' : ''}${s.name}</div>
      <div class="sub"><span class="lv">Lv ${m.lv}</span>${elemTags(m.sp)}</div>${inParty ? '<span class="badge">함께</span>' : ''}${extra}</div>`;
  }

  bagTabs(b, on) {
    const t = h('div', 'tabs', `<button data-t="mon" class="${on === 'mon' ? 'on' : ''}">🐣 몽글이</button><button data-t="eq" class="${on === 'eq' ? 'on' : ''}">🗡️ 장비 <small>${(this.state.inv || []).length}</small></button>`);
    t.onclick = e => { const x = e.target.closest('button'); if (x) (x.dataset.t === 'eq' ? this.openEquip() : this.openBox()); };
    b.querySelector('h2').after(t);
  }

  // ---------- 장비 ----------
  itemCard(it, eqd) {
    const T = TIERS[it.tier], E = EQUIP[it.type], st = itemStat(it);
    return `<div class="icard ${eqd ? 'eqd' : ''}" data-id="${it.id}" style="--tc:${T.color}">
      <span class="ii">${E.icon}</span><b>${it.plus ? `+${it.plus} ` : ''}${esc(it.name)}</b>
      <small>${st.atk ? `공격 +${st.atk}` : ''}${st.atk && st.hp ? ' · ' : ''}${st.hp ? `체력 +${st.hp}` : ''}</small>${eqd ? '<span class="badge">장착</span>' : ''}</div>`;
  }
  openEquip() {
    const s = this.state; s.inv = s.inv || []; s.eq = s.eq || {};
    const b = this.openPanel(`🎒 가방 <small>장비 ${s.inv.length}/${INV_MAX}칸</small>`);
    this.bagTabs(b, 'eq');
    const g = this.game, st = g.heroFullStats();
    const slots = h('div', 'eqslots');
    slots.innerHTML = Object.entries(EQUIP).map(([k, E]) => {
      const it = s.inv.find(x => x.id === s.eq[k]);
      return it ? this.itemCard(it, true) : `<div class="icard empty"><span class="ii">${E.icon}</span><b>${E.name} 없음</b><small>몬스터가 가끔 떨어뜨려요</small></div>`;
    }).join('') + `<div class="mystat">❤️ ${st.maxHp} · ⚔️ ${Math.round(st.atk)}</div>`;
    b.appendChild(slots);
    const grid = h('div', 'grid igrid');
    const list = s.inv.filter(it => !Object.values(s.eq).includes(it.id)).sort((a, c) => c.tier - a.tier || c.plus - a.plus);
    grid.innerHTML = list.map(it => this.itemCard(it, false)).join('') || '<p class="hint">아직 장비가 없어요. 사냥하다 보면 떨어져요!</p>';
    b.appendChild(grid);
    b.onclick = e => { const c = e.target.closest('.icard[data-id]'); if (c) this.openItem(+c.dataset.id); };
  }
  openItem(id) {
    const s = this.state, it = s.inv.find(x => x.id === id); if (!it) return;
    const T = TIERS[it.tier], E = EQUIP[it.type], st = itemStat(it);
    const eqd = s.eq[it.type] === id;
    const rate = it.plus < 10 ? ENHANCE_RATE[it.plus] : 0, cost = enhanceCost(it);
    const b = this.openPanel(`<span style="color:${T.color}">[${T.name}]</span> ${it.plus ? '+' + it.plus + ' ' : ''}${esc(it.name)}`);
    b.onclick = null;
    b.insertAdjacentHTML('beforeend', `
      <div class="idetail" style="--tc:${T.color}"><div class="bigi">${E.icon}<i>${it.plus ? '+' + it.plus : ''}</i></div>
      <div class="info">
        <div class="kv"><span>종류</span><b>${E.name} · Lv${it.lv}</b></div>
        ${st.atk ? `<div class="kv"><span>공격력</span><b>+${st.atk}</b></div>` : ''}
        ${st.hp ? `<div class="kv"><span>체력</span><b>+${st.hp}</b></div>` : ''}
        <div class="kv"><span>강화 (+${it.plus} → +${it.plus + 1})</span><b>${it.plus < 10 ? `성공 ${Math.round(rate * 100)}% · ✦${cost}` : '최대 강화!'}</b></div>
        <div class="btns">
          <button class="btn" id="iEq">${eqd ? '벗기' : '장착'}</button>
          <button class="btn enh" id="iEn" ${it.plus >= 10 ? 'disabled' : ''}>✨ 강화</button>
          <button class="btn ghost" id="iSell">분해 (✦${2 * (it.tier + 1) + it.plus})</button>
          <button class="btn ghost" id="iBack">←</button>
        </div>
      </div></div>`);
    $('#iBack', b).onclick = () => this.openEquip();
    $('#iEq', b).onclick = () => {
      if (eqd) delete s.eq[it.type]; else s.eq[it.type] = id;
      this.game.refreshHero(); this.save(); sfx.tap(); this.openEquip();
    };
    $('#iSell', b).onclick = () => {
      if (eqd) delete s.eq[it.type];
      s.inv = s.inv.filter(x => x !== it);
      s.dust += 2 * (it.tier + 1) + it.plus;
      this.game.refreshHero(); this.save(); sfx.dust(); this.renderTop(); this.openEquip();
    };
    $('#iEn', b).onclick = () => {
      if (it.plus >= 10) return;
      if (s.dust < cost) { this.toast('반짝가루가 모자라요'); this.shake($('#iEn', b)); return; }
      s.dust -= cost;
      const btn = $('#iEn', b); btn.disabled = true; btn.textContent = '두근두근…';
      sfx.bubble();
      setTimeout(() => {
        const ok = Math.random() < rate;
        if (ok) { it.plus++; sfx.born(it.plus >= 7); this.toast(`✨ 강화 성공! +${it.plus}`); this.game.burst(this.game.hero.model.root.position, 0xfff27a, 14); }
        else { sfx.error(); this.toast('💦 강화 실패… 장비는 그대로예요'); }
        this.game.refreshHero(); this.save(); this.renderTop(); this.openItem(id);
      }, 900);
    };
  }

  openBox() {
    const s = this.state, g = this.game;
    const b = this.openPanel(`🎒 가방 <small>${s.monggles.length}/${BOX_MAX}칸 · 데리고 다니기 ${s.party.length}/${g.partySize()}</small>`);
    this.bagTabs(b, 'mon');
    b.onclick = null;
    const grid = h('div', 'grid');
    grid.innerHTML = s.monggles.map(m => this.monCard(m)).join('');
    b.appendChild(grid);
    b.appendChild(h('p', 'hint', '몽글이를 누르면 자세히 보고, 데리고 다닐지 정할 수 있어요.'));
    const jbtn = h('button', 'btn ghost giftDust', `${(JOBS[s.job] || JOBS.mage).icon} 직업 바꾸기 (지금: ${(JOBS[s.job] || JOBS.mage).name})`);
    jbtn.onclick = () => (this.game.zoneAt(this.game.hero.model.root.position)?.safe ? this.openJob() : this.toast('직업은 솥단지 마을에서 바꿀 수 있어요'));
    b.appendChild(jbtn);
    const gd = h('button', 'btn ghost giftDust', '🎁 반짝가루 10개 선물하기');
    gd.onclick = () => this.giftDust();
    b.appendChild(gd);
    const rs = h('button', 'link reset', '처음부터 다시 하기');
    rs.onclick = () => this.confirmReset();
    b.appendChild(rs);
    grid.onclick = e => { const c = e.target.closest('.mcard'); if (c) this.openMon(+c.dataset.id); };
  }

  // ---------- 직업 고르기 ----------
  openJob(first = false) {
    const s = this.state;
    const b = this.openPanel(first ? '어떤 모험가가 될까요?' : '직업 바꾸기');
    const grid = h('div', 'jobs');
    grid.innerHTML = Object.entries(JOBS).map(([k, J]) => `
      <button class="jobCard ${s.job === k ? 'on' : ''}" data-job="${k}">
        <img src="${heroIcon(s.look, k)}"><b>${J.icon} ${J.name}</b><small>${J.desc}</small>
        <span class="sk">기술: ${J.skill.name}</span></button>`).join('');
    b.appendChild(grid);
    if (first) b.appendChild(h('p', 'hint', '마을에서 언제든 다시 바꿀 수 있어요 (가방 → 직업 바꾸기)'));
    grid.onclick = e => {
      const c = e.target.closest('.jobCard'); if (!c) return;
      const job = c.dataset.job;
      if (job !== s.job || first) {
        this.game.setJob(job);
        this.renderSkills(); this.renderTop(); this.save();
        this.net?.writePresence?.();
        sfx.levelUp();
        this.toast(`${JOBS[job].icon} ${JOBS[job].name}가 됐어요!`);
      }
      this.closePanel();
    };
  }

  // ---------- 선물 ----------
  giftMon(m) {
    const s = this.state, to = this.net?.giftTarget?.();
    if (!this.net?.on || !to) { this.toast('상대가 한 번이라도 접속해야 선물할 수 있어요'); return; }
    if (s.monggles.length <= 1) { this.toast('마지막 한 마리는 선물할 수 없어요'); return; }
    if (s.coupleOut?.monId === m.id) { this.toast('💞 둘이 섞기를 기다리는 몽글이예요'); return; }
    const b = this.openPanel(`🎁 ${to.name}에게 선물할까요?`);
    b.insertAdjacentHTML('beforeend', `<div class="born"><img src="${icon(m.sp, m.shiny)}"><h3>${m.shiny ? '반짝이 ' : ''}${SPECIES[m.sp].name} <span class="lv">Lv ${m.lv}</span></h3></div>
      <input id="gMsg" class="tin" maxlength="40" placeholder="한마디 (예: 귀엽게 키워 줘♥)">
      <div class="btns center"><button class="btn" id="gOk">보내기</button><button class="btn ghost" id="gNo">아니요</button></div>`);
    $('#gNo', b).onclick = () => this.openMon(m.id);
    $('#gOk', b).onclick = async () => {
      const msg = $('#gMsg', b).value.trim();
      const ok = await this.net.sendGift({ kind: 'mon', mon: { sp: m.sp, lv: m.lv, shiny: !!m.shiny, ...(m.inh ? { inh: m.inh } : {}) }, msg }).catch(() => false);
      if (!ok) { this.toast('선물을 못 보냈어요. 인터넷을 확인해 주세요'); return; }
      s.monggles = s.monggles.filter(x => x !== m);
      if (s.party.includes(m.id)) { s.party = s.party.filter(x => x !== m.id); if (!s.party.length) s.party.push(s.monggles[0].id); this.game.syncParty(); }
      this.save(); sfx.befriend();
      this.toast(`🎁 ${to.name}에게 ${SPECIES[m.sp].name}를 보냈어요`);
      this.closePanel();
    };
  }
  async giftDust() {
    const s = this.state, to = this.net?.giftTarget?.();
    if (!this.net?.on || !to) { this.toast('상대가 한 번이라도 접속해야 선물할 수 있어요'); return; }
    if (s.dust < 10) { this.toast('반짝가루가 모자라요'); return; }
    s.dust -= 10; this.save();
    const ok = await this.net.sendGift({ kind: 'dust', dust: 10 }).catch(() => false);
    if (!ok) { s.dust += 10; this.toast('선물을 못 보냈어요'); return; }
    sfx.dust(); this.toast(`🎁 ${to.name}에게 반짝가루 10개를 보냈어요`); this.renderTop();
  }
  giftArrived(g, done) {
    const s = this.state;
    if (!this.game) { setTimeout(() => this.giftArrived(g, done), 1500); return; }
    if (g.kind && g.kind.startsWith('couple')) { this.coupleMail(g, done); return; }
    if (g.kind === 'mon' && s.monggles.length >= BOX_MAX) {
      if (!this.boxWarned) { this.boxWarned = true; this.toast(`🎁 ${g.from}의 선물이 왔는데 가방이 꽉 찼어요. 자리를 만들면 받아져요`); }
      setTimeout(() => this.giftArrived(g, done), 20000); return;
    }
    this.boxWarned = false;
    let what = '';
    if (g.kind === 'mon' && g.mon && SPECIES[g.mon.sp]) {
      const m = { id: s.nextId++, sp: g.mon.sp, lv: g.mon.lv || 1, exp: 0, shiny: !!g.mon.shiny, ...(g.mon.inh ? { inh: g.mon.inh } : {}) };
      s.monggles.push(m); s.dex[m.sp] = (s.dex[m.sp] || 0) + 1;
      what = `<img src="${icon(m.sp, m.shiny)}"><h3>${m.shiny ? '반짝이 ' : ''}${SPECIES[m.sp].name} <span class="lv">Lv ${m.lv}</span></h3>`;
      this.game.refreshVivid();
    } else if (g.kind === 'dust') {
      s.dust += g.dust || 0;
      what = `<div style="font-size:70px">✦</div><h3>반짝가루 ${g.dust}개</h3>`;
    } else { done(); return; }
    this.save(); done(); sfx.born(false); this.renderTop();
    const b = this.openPanel(`🎁 ${g.from}의 선물이 도착했어요!`);
    b.insertAdjacentHTML('beforeend', `<div class="born">${what}${g.msg ? `<p class="gmsg">“${g.msg.replace(/</g, '&lt;')}”</p>` : ''}</div>
      <div class="btns center"><button class="btn" id="gThanks">고마워 ❤️</button></div>`);
    $('#gThanks', b).onclick = () => { this.closePanel(); this.emote(this.game.hero.model.root, '❤️'); this.net.sendEmote('❤️'); };
  }

  confirmReset() {
    const b = this.openPanel('처음부터 다시 할까요?');
    b.insertAdjacentHTML('beforeend', `<p class="hint">레벨, 몽글이, 반짝가루, 도감이 모두 처음으로 돌아가요. 되돌릴 수 없어요.</p>
      <div class="btns center"><button class="btn" id="rsYes">네, 처음부터</button><button class="btn ghost" id="rsNo">아니요</button></div>`);
    $('#rsNo', b).onclick = () => this.openBox();
    $('#rsYes', b).onclick = () => {
      if (this.state.coupleOut) this.net?.sendGift?.({ kind: 'coupleCancel', askKey: this.state.coupleOut.key }).catch(() => {});
      const s = this.state, fresh = newSave(s.name, s.look);
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, fresh);
      this.save();
      setTimeout(() => location.reload(), 2200); // 클라우드 저장이 끝난 뒤 새로고침
      b.innerHTML = '<h2>새로 시작하는 중…</h2>';
    };
  }

  openMon(id) {
    const s = this.state, g = this.game;
    const m = s.monggles.find(x => x.id === id); if (!m) return;
    const sp = SPECIES[m.sp];
    const inParty = s.party.includes(id);
    const b = this.openPanel(`${m.shiny ? '✨ ' : ''}${sp.name}`);
    const inh = m.inh && SPECIES[m.inh] ? `<div class="kv"><span>물려받은 기술 🧬</span><b>${SPECIES[m.inh].skill.name} <small class="auto">싸울 때 알아서 써요</small></b></div>` : '';
    const st = g ? (inParty ? g.units.find(u => u.data === m) : null) : null;
    b.insertAdjacentHTML('beforeend', `
      <div class="detail">
        <img class="big" src="${icon(m.sp, m.shiny)}">
        <div class="info">
          <div class="sub">${elemTags(m.sp)} <span class="role">${ROLE[sp.role]}</span> <span class="lv">Lv ${m.lv}</span></div>
          <div class="bar xp"><i style="width:${m.lv >= MAX_LV ? 100 : m.exp / expToNext(m.lv) * 100}%"></i></div>
          <div class="kv"><span>기술</span><b>${sp.skill.name}</b></div>${inh}
          <div class="kv"><span>단계</span><b>${sp.stage}단계</b></div>
          ${st ? `<div class="kv"><span>체력</span><b>${Math.ceil(st.hp)} / ${st.maxHp}</b></div>` : ''}
          <div class="btns">
            <button class="btn ${inParty ? 'ghost' : ''}" id="tgl">${inParty ? '쉬게 하기' : '데리고 다니기'}</button>
            <button class="btn ghost" id="gift">🎁 선물</button>
            <button class="btn ghost" id="back">← 가방</button>
          </div>
        </div>
      </div>`);
    $('#back', b).onclick = () => this.openBox();
    $('#gift', b).onclick = () => this.giftMon(m);
    $('#tgl', b).onclick = () => {
      if (inParty) {
        if (s.party.length <= 1) { this.toast('최소 한 마리는 데리고 다녀야 해요'); return; }
        s.party = s.party.filter(x => x !== id);
      } else {
        if (s.party.length >= g.partySize()) s.party.pop(); // 마지막 칸과 교체
        s.party.push(id);
      }
      g.syncParty(); this.save(); this.openBox();
    };
  }

  openDex() {
    const s = this.state;
    const n = Object.keys(s.dex).length;
    const b = this.openPanel(`📖 도감 <small>${n} / ${DEX_ORDER.length}</small>`);
    const grid = h('div', 'grid dex');
    grid.innerHTML = DEX_ORDER.map(sp => {
      const got = s.dex[sp];
      const S = SPECIES[sp];
      return got ? `<div class="mcard"><img src="${icon(sp)}"><div class="nm">${S.name}</div><div class="sub">${elemTags(sp)}</div></div>`
        : `<div class="mcard unknown"><img src="${icon(sp)}"><div class="nm">???</div><div class="sub">${S.couple ? '💞 둘이 섞어야 태어나요' : S.stage >= 2 ? '조합으로 태어나요' : '야생에서 만나요'}</div></div>`;
    }).join('');
    b.appendChild(grid);
    b.appendChild(h('p', 'hint', '새 몽글이를 만날수록 섬에 색이 돌아와요.'));
  }

  // ---------- 믹스 솥 ----------
  openMix(pick = []) {
    const s = this.state;
    const b = this.openPanel(`🍲 믹스 솥 <small>✦ ${s.dust} · 한 번에 ✦${MIX_COST}</small>`, 'mix');
    this.mixTabs(b, 'solo');
    const waitId = s.coupleOut?.monId;
    pick = pick.filter(id => id !== waitId);
    const [a, c] = pick.map(id => s.monggles.find(m => m.id === id));
    const res = a && c ? mixResult(a.sp, c.sp) : null;
    const slot = m => m ? `<div class="slot full"><img src="${icon(m.sp, m.shiny)}"><b>${SPECIES[m.sp].name}</b><span class="lv">Lv${m.lv}</span></div>` : `<div class="slot">?</div>`;
    let resHtml = '<div class="slot res">?</div>';
    if (a && c) {
      if (!res) resHtml = `<div class="slot res no">아직 없는<br>조합이에요</div>`;
      else if (s.dex[res]) resHtml = `<div class="slot res"><img src="${icon(res)}"><b>${SPECIES[res].name}</b></div>`;
      else resHtml = `<div class="slot res"><img class="sil" src="${icon(res)}"><b>???</b></div>`;
    }
    b.insertAdjacentHTML('beforeend', `
      <div class="mixrow">${slot(a)}<span class="op">+</span>${slot(c)}<span class="op">=</span>${resHtml}</div>
      <div class="btns center"><button class="btn big" id="doMix">섞기!</button></div>
      <p class="hint">Lv${MIX_MIN_LV} 이상 몽글이 두 마리를 골라요. 재료 두 마리는 새 몽글이로 다시 태어나요.</p>`);
    const grid = h('div', 'grid');
    grid.innerHTML = s.monggles.map(m => this.monCard(m, m.id === waitId ? '<span class="lock love">💞 기다리는 중</span>' : m.lv < MIX_MIN_LV ? '<span class="lock">Lv' + MIX_MIN_LV + '부터</span>' : '')).join('');
    for (const el of grid.children) {
      const id = +el.dataset.id;
      if (pick.includes(id)) el.classList.add('picked');
      if (s.monggles.find(m => m.id === id).lv < MIX_MIN_LV || id === waitId) el.classList.add('locked');
    }
    b.appendChild(grid);
    grid.onclick = e => {
      const el = e.target.closest('.mcard'); if (!el) return;
      const id = +el.dataset.id;
      if (id === waitId) { this.toast('💞 둘이 섞기를 기다리는 몽글이예요'); return; }
      if (el.classList.contains('locked')) { this.toast(`Lv${MIX_MIN_LV}부터 섞을 수 있어요`); return; }
      let p = pick.includes(id) ? pick.filter(x => x !== id) : [...pick, id].slice(-2);
      this.openMix(p);
    };
    const btn = $('#doMix', b);
    const need = a && c ? mixMinLv(a.sp, c.sp) : MIX_MIN_LV;
    const lvOk = a && c && a.lv >= need && c.lv >= need;
    const ok = a && c && res && lvOk && s.dust >= MIX_COST;
    btn.disabled = !ok;
    if (a && c && res && !lvOk) btn.textContent = `3단계는 둘 다 Lv${need}부터 섞을 수 있어요`;
    else if (a && c && res && s.dust < MIX_COST) btn.textContent = `반짝가루가 ${MIX_COST - s.dust}개 모자라요`;
    btn.onclick = () => ok && this.doMix(a, c, res);
  }

  doMix(a, c, res) {
    const s = this.state, g = this.game;
    const shinyRate = a.sp === c.sp ? 0.2 : 0.05;
    const shiny = Math.random() < shinyRate;
    const inheritFrom = Math.random() < 0.5 ? a : c;
    const m = { id: s.nextId++, sp: res, lv: 1, exp: 0, shiny, inh: inheritFrom.sp !== res ? inheritFrom.sp : undefined };
    if (!m.inh) delete m.inh;
    s.dust -= MIX_COST;
    s.mixes = (s.mixes || 0) + 1;
    s.monggles = s.monggles.filter(x => x !== a && x !== c);
    s.party = s.party.filter(id => id !== a.id && id !== c.id);
    s.monggles.push(m);
    if (s.party.length < g.partySize()) s.party.push(m.id);
    const isNew = !s.dex[res];
    s.dex[res] = (s.dex[res] || 0) + 1;
    g.syncParty(); g.refreshVivid(); this.save();
    // 연출
    sfx.bubble();
    const b = this.openPanel('🍲 보글보글…', 'mix');
    b.insertAdjacentHTML('beforeend', `<div class="brew"><div class="pot">🍲</div></div>`);
    setTimeout(() => {
      const b2 = this.openPanel(shiny ? '✨ 대성공! ✨' : (isNew ? '새 몽글이가 태어났어요!' : '몽글이가 태어났어요!'), 'mix');
      b2.insertAdjacentHTML('beforeend', `
        <div class="born ${shiny ? 'shiny' : ''}">
          <img src="${icon(res, shiny)}"><h3>${shiny ? '반짝이 ' : ''}${SPECIES[res].name}</h3>
          <div class="sub">${elemTags(res)} <span class="role">${ROLE[SPECIES[res].role]}</span></div>
          ${m.inh ? `<p>물려받은 기술: <b>${SPECIES[m.inh].skill.name}</b></p>` : ''}
          ${isNew ? '<p class="new">도감에 새로 등록됐어요 · 섬에 색이 조금 돌아왔어요</p>' : ''}
        </div>
        <div class="btns center"><button class="btn" id="again">또 섞기</button><button class="btn ghost" id="ok">닫기</button></div>`);
      sfx.born(shiny);
      $('#again', b2).onclick = () => this.openMix();
      $('#ok', b2).onclick = () => this.closePanel();
    }, 1600);
  }

  // ---------- 💞 둘이 섞기 ----------
  // 한 사람이 몽글이를 솥에 넣고 부탁(우편) → 상대가 자기 몽글이를 넣으면 둘 다 같은 아기를 하나씩 받아요.
  // 받은 아기는 상대 몽글이의 기술을 물려받아요. 우편함(mail)만 써서 둘이 동시에 접속하지 않아도 돼요.
  mixTabs(b, on) {
    const n = (this.state.coupleIn || []).length;
    const t = h('div', 'tabs', `<button data-t="solo" class="${on === 'solo' ? 'on' : ''}">🍲 혼자 섞기</button><button data-t="love" class="${on === 'love' ? 'on' : ''}">💞 둘이 섞기${n ? ` <small class="nb">${n}</small>` : ''}</button>`);
    t.onclick = e => { const x = e.target.closest('button'); if (x) (x.dataset.t === 'love' ? this.openCouple() : this.openMix()); };
    b.querySelector('h2').after(t);
  }
  coupleNeed(sp) { return SPECIES[sp].stage >= 2 ? 15 : MIX_MIN_LV; }

  openCouple(pick = null) {
    const s = this.state, to = this.net?.giftTarget?.();
    const b = this.openPanel(`🍲 믹스 솥 <small>✦ ${s.dust} · 한 번에 ✦${MIX_COST}</small>`, 'mix');
    this.mixTabs(b, 'love');
    if (!this.net?.on || !to) {
      b.insertAdjacentHTML('beforeend', `<div class="love-intro"><div class="hearts">💞</div>
        <p>둘이 섞기는 광희·하은 둘 다 <b>비밀번호로 로그인</b>하고, 상대가 한 번이라도 접속한 뒤에 할 수 있어요.</p></div>`);
      return;
    }
    const ins = s.coupleIn || [];
    // 받은 부탁
    if (ins.length) {
      const box = h('div', 'asks');
      box.innerHTML = ins.map((q, i) => `<div class="ask"><img src="${icon(q.mon.sp, q.mon.shiny)}">
        <div><b>💌 ${esc(josa(q.from, '이', '가'))} ${SPECIES[q.mon.sp]?.name || '몽글이'} Lv${q.mon.lv}를 넣고 기다려요</b>${q.msg ? `<p class="gmsg">“${esc(q.msg)}”</p>` : ''}</div>
        <button class="btn" data-i="${i}">같이 섞기</button></div>`).join('');
      box.onclick = e => { const x = e.target.closest('button'); if (x) this.openCoupleAnswer(ins[+x.dataset.i]); };
      b.appendChild(box);
    }
    // 내가 보낸 부탁
    const out = s.coupleOut, om = out && s.monggles.find(m => m.id === out.monId);
    if (out) {
      b.insertAdjacentHTML('beforeend', `<div class="ask mine">${om ? `<img src="${icon(om.sp, om.shiny)}">` : ''}
        <div><b>💞 ${om ? SPECIES[om.sp].name : '몽글이'}를 넣고 ${esc(josa(out.toName || to.name, '이', '가'))} 넣어 주길 기다리는 중…</b><p class="hint">${esc(out.toName || to.name)}이(가) 접속하면 알림이 가요. 기다리는 동안 이 몽글이는 데리고 다닐 수 있지만 섞거나 선물할 순 없어요.</p></div>
        <button class="btn ghost" id="cCancel">그만두기</button></div>`);
      $('#cCancel', b).onclick = () => this.cancelCouple();
      if (!ins.length) b.insertAdjacentHTML('beforeend', `<p class="hint center">${esc(to.name)}이(가) 몽글이를 넣으면 둘 다 💞 같은 아기를 하나씩 받아요.</p>`);
      return;
    }
    // 새로 부탁하기
    const m = pick != null && s.monggles.find(x => x.id === pick);
    const res = m && SPECIES[m.sp].stage >= 2 ? coupleResult(m.sp, m.sp) : null; // 2단계 이상을 넣으면 하트천사로 정해져요
    b.insertAdjacentHTML('beforeend', `
      <div class="mixrow">${m ? `<div class="slot full"><img src="${icon(m.sp, m.shiny)}"><b>${SPECIES[m.sp].name}</b><span class="lv">Lv${m.lv}</span></div>` : '<div class="slot">?</div>'}
        <span class="op">+</span><div class="slot partner"><b>${esc(to.name)}의<br>몽글이</b></div><span class="op">=</span>
        <div class="slot res love">${res && s.dex[res] ? `<img src="${icon(res)}"><b>${SPECIES[res].name}</b>` : '<b>💞<br>???</b>'}</div></div>
      <input id="cMsg" class="tin" maxlength="40" placeholder="한마디 (예: 우리 아기 만들자♥)">
      <div class="btns center"><button class="btn big love" id="cAsk">같이 섞자고 하기</button></div>
      <p class="hint">내 몽글이 한 마리를 넣고 ${esc(to.name)}에게 부탁해요. 둘 다 1단계면 하트몽글, 2단계 이상이 있으면 하트천사가 태어나요. 1단계는 Lv${MIX_MIN_LV}, 2단계 이상은 Lv15부터 넣을 수 있어요.</p>`);
    const grid = h('div', 'grid');
    grid.innerHTML = s.monggles.map(x => this.monCard(x, x.lv < this.coupleNeed(x.sp) ? `<span class="lock">Lv${this.coupleNeed(x.sp)}부터</span>` : '')).join('');
    for (const el of grid.children) {
      const x = s.monggles.find(q => q.id === +el.dataset.id);
      if (x.id === pick) el.classList.add('picked');
      if (x.lv < this.coupleNeed(x.sp)) el.classList.add('locked');
    }
    b.appendChild(grid);
    grid.onclick = e => {
      const el = e.target.closest('.mcard'); if (!el) return;
      const x = s.monggles.find(q => q.id === +el.dataset.id);
      if (el.classList.contains('locked')) { this.toast(`${SPECIES[x.sp].stage >= 2 ? '2단계 이상은' : '1단계는'} Lv${this.coupleNeed(x.sp)}부터 넣을 수 있어요`); return; }
      this.openCouple(x.id === pick ? null : x.id);
    };
    const btn = $('#cAsk', b);
    btn.textContent = `${to.name}에게 같이 섞자고 하기`;
    const ok = m && s.dust >= MIX_COST && s.monggles.length > 1;
    btn.disabled = !ok;
    if (m && s.dust < MIX_COST) btn.textContent = `반짝가루가 ${MIX_COST - s.dust}개 모자라요`;
    else if (m && s.monggles.length <= 1) btn.textContent = '몽글이가 두 마리 이상 있어야 해요';
    btn.onclick = async () => {
      if (!ok) return;
      btn.disabled = true;
      const msg = $('#cMsg', b).value.trim();
      const key = await this.net.sendGift({ kind: 'coupleAsk', mon: { sp: m.sp, lv: m.lv, shiny: !!m.shiny }, msg }).catch(() => false);
      if (!key) { btn.disabled = false; this.toast('부탁을 못 보냈어요. 인터넷을 확인해 주세요'); return; }
      s.dust -= MIX_COST;
      s.coupleOut = { key, monId: m.id, sp: m.sp, toName: to.name, t: Date.now() };
      this.save(); sfx.bubble(); this.renderTop();
      this.toast(`💌 ${to.name}에게 같이 섞자고 부탁했어요`);
      this.openCouple();
    };
  }

  async cancelCouple() {
    const s = this.state, out = s.coupleOut; if (!out) return;
    await this.net.sendGift({ kind: 'coupleCancel', askKey: out.key }).catch(() => {});
    s.coupleOut = null; s.dust += MIX_COST;
    this.save(); this.renderTop(); sfx.tap();
    this.toast('둘이 섞기를 그만뒀어요 (반짝가루는 돌려받았어요)');
    this.openCouple();
  }

  openCoupleAnswer(q, pick = null) {
    const s = this.state;
    const b = this.openPanel(`💞 ${esc(josa(q.from, '이랑', '랑'))} 같이 섞기 <small>✦ ${s.dust}</small>`, 'mix');
    const m = pick != null && s.monggles.find(x => x.id === pick);
    const busy = s.coupleOut?.monId;
    const res = m ? coupleResult(q.mon.sp, m.sp) : null;
    b.insertAdjacentHTML('beforeend', `
      <div class="mixrow"><div class="slot full partner"><img src="${icon(q.mon.sp, q.mon.shiny)}"><b>${SPECIES[q.mon.sp]?.name}</b><span class="lv">${esc(q.from)} · Lv${q.mon.lv}</span></div>
        <span class="op">+</span>${m ? `<div class="slot full"><img src="${icon(m.sp, m.shiny)}"><b>${SPECIES[m.sp].name}</b><span class="lv">Lv${m.lv}</span></div>` : '<div class="slot">?</div>'}
        <span class="op">=</span><div class="slot res love">${res ? (s.dex[res] ? `<img src="${icon(res)}"><b>${SPECIES[res].name}</b>` : `<img class="sil" src="${icon(res)}"><b>???</b>`) : '<b>💞<br>???</b>'}</div></div>
      <div class="btns center"><button class="btn big love" id="cDo">같이 섞기!</button><button class="btn ghost" id="cNo">이번엔 안 할래요</button></div>
      <p class="hint">내 몽글이 한 마리를 골라요. 둘 다 같은 아기를 하나씩 받고, 내 아기는 ${esc(q.from)}의 ${SPECIES[q.mon.sp]?.name} 기술을 물려받아요.</p>`);
    const grid = h('div', 'grid');
    grid.innerHTML = s.monggles.map(x => this.monCard(x, x.id === busy ? '<span class="lock love">💞 기다리는 중</span>' : x.lv < this.coupleNeed(x.sp) ? `<span class="lock">Lv${this.coupleNeed(x.sp)}부터</span>` : '')).join('');
    for (const el of grid.children) {
      const x = s.monggles.find(z => z.id === +el.dataset.id);
      if (x.id === pick) el.classList.add('picked');
      if (x.lv < this.coupleNeed(x.sp) || x.id === busy) el.classList.add('locked');
    }
    b.appendChild(grid);
    grid.onclick = e => {
      const el = e.target.closest('.mcard'); if (!el) return;
      const x = s.monggles.find(z => z.id === +el.dataset.id);
      if (x.id === busy) { this.toast('💞 다른 둘이 섞기를 기다리는 몽글이예요'); return; }
      if (el.classList.contains('locked')) { this.toast(`${SPECIES[x.sp].stage >= 2 ? '2단계 이상은' : '1단계는'} Lv${this.coupleNeed(x.sp)}부터 넣을 수 있어요`); return; }
      this.openCoupleAnswer(q, x.id === pick ? null : x.id);
    };
    const btn = $('#cDo', b);
    const ok = m && s.dust >= MIX_COST;
    btn.disabled = !ok;
    if (m && s.dust < MIX_COST) btn.textContent = `반짝가루가 ${MIX_COST - s.dust}개 모자라요`;
    btn.onclick = () => ok && this.doCoupleMix(q, m, btn);
    $('#cNo', b).onclick = async () => {
      await this.net.sendGift({ kind: 'coupleNo', askKey: q.key }).catch(() => {});
      s.coupleIn = (s.coupleIn || []).filter(x => x.key !== q.key);
      this.save(); this.toast(`${q.from}에게 다음에 하자고 전했어요`);
      this.openCouple();
    };
  }

  async doCoupleMix(q, mine, btn) {
    const s = this.state, g = this.game;
    btn.disabled = true;
    const res = coupleResult(q.mon.sp, mine.sp);
    const shiny = Math.random() < COUPLE_SHINY;
    const sent = await this.net.sendGift({ kind: 'coupleDone', askKey: q.key, res, shiny, mon: { sp: mine.sp, lv: mine.lv } }).catch(() => false);
    if (!sent) { btn.disabled = false; this.toast('못 섞었어요. 인터넷을 확인해 주세요'); return; }
    s.dust -= MIX_COST;
    s.coupleIn = (s.coupleIn || []).filter(x => x.key !== q.key);
    s.monggles = s.monggles.filter(x => x !== mine);
    s.party = s.party.filter(id => id !== mine.id);
    const baby = this.addBaby(res, shiny, q.mon.sp);
    if (!s.party.length) s.party.push(baby.id);
    g.syncParty(); this.save(); this.renderTop();
    this.coupleBorn(baby, q.from);
  }

  // 아기 몽글이 넣기 (물려받은 기술 = 상대 몽글이 기술)
  addBaby(res, shiny, fromSp) {
    const s = this.state, g = this.game;
    const m = { id: s.nextId++, sp: res, lv: 1, exp: 0, shiny: !!shiny };
    if (fromSp && fromSp !== res && SPECIES[fromSp]) m.inh = fromSp;
    s.monggles.push(m);
    if (s.party.length < g.partySize()) s.party.push(m.id);
    m.isNew = !s.dex[res];
    s.dex[res] = (s.dex[res] || 0) + 1;
    s.mixes = (s.mixes || 0) + 1;
    s.coupleMixes = (s.coupleMixes || 0) + 1;
    g.refreshVivid();
    return m;
  }

  coupleBorn(m, partner) {
    const isNew = m.isNew; delete m.isNew; this.save();
    sfx.bubble();
    const b = this.openPanel('💞 보글보글…', 'mix');
    b.insertAdjacentHTML('beforeend', `<div class="brew love"><div class="pot">🍲</div><div class="hearts">💕</div></div>`);
    setTimeout(() => {
      const b2 = this.openPanel(m.shiny ? '✨ 둘이 같이 대성공! ✨' : `💞 ${esc(josa(partner, '이랑', '랑'))} 같이 만든 아기예요!`, 'mix');
      b2.insertAdjacentHTML('beforeend', `
        <div class="born love ${m.shiny ? 'shiny' : ''}">
          <img src="${icon(m.sp, m.shiny)}"><h3>${m.shiny ? '반짝이 ' : ''}${SPECIES[m.sp].name}</h3>
          <div class="sub">${elemTags(m.sp)} <span class="role">${ROLE[SPECIES[m.sp].role]}</span></div>
          ${m.inh ? `<p>${esc(partner)}의 몽글이에게 물려받은 기술: <b>${SPECIES[m.inh].skill.name}</b></p>` : ''}
          <p class="hint">${esc(partner)}도 똑같은 아기를 하나 받았어요</p>
          ${isNew ? '<p class="new">도감에 새로 등록됐어요 · 섬에 색이 조금 돌아왔어요</p>' : ''}
        </div>
        <div class="btns center"><button class="btn" id="cHeart">고마워 ❤️</button><button class="btn ghost" id="ok">닫기</button></div>`);
      sfx.born(true);
      this.game.burst(this.game.hero.model.root.position, 0xff8fb4, 24);
      $('#cHeart', b2).onclick = () => { this.closePanel(); this.emote(this.game.hero.model.root, '❤️'); this.net.sendEmote('❤️'); };
      $('#ok', b2).onclick = () => this.closePanel();
    }, 1800);
  }

  // 둘이 섞기 우편 (coupleAsk 부탁 / coupleDone 섞었음 / coupleNo 다음에 / coupleCancel 그만둠)
  coupleMail(g, done) {
    const s = this.state;
    s.coupleIn = s.coupleIn || [];
    if (g.kind === 'coupleAsk') {
      if (!g.mon || !SPECIES[g.mon.sp]) { done(); return; }
      // 한 사람은 부탁을 하나만 → 같은 사람의 옛 부탁은 새 것으로
      s.coupleIn = s.coupleIn.filter(x => x.from !== g.from && x.key !== g.key);
      s.coupleIn.push({ key: g.key, from: g.from, mon: g.mon, msg: g.msg || '', t: g.t });
      this.save(); done(); sfx.friend();
      if (!this.panelOpen) {
        const b = this.openPanel(`💌 ${esc(g.from)}의 부탁`);
        b.insertAdjacentHTML('beforeend', `<div class="born love"><img src="${icon(g.mon.sp, g.mon.shiny)}">
          <h3>${esc(josa(g.from, '이', '가'))} ${SPECIES[g.mon.sp].name}를 솥에 넣었어요</h3>
          ${g.msg ? `<p class="gmsg">“${esc(g.msg)}”</p>` : ''}<p>내 몽글이도 넣으면 둘 다 💞 아기를 하나씩 받아요</p></div>
          <div class="btns center"><button class="btn love" id="cGo">지금 같이 섞기</button><button class="btn ghost" id="cLater">나중에 (믹스 솥에서)</button></div>`);
        const q = s.coupleIn.at(-1);
        $('#cGo', b).onclick = () => this.openCoupleAnswer(q);
        $('#cLater', b).onclick = () => this.closePanel();
      } else this.toast(`💌 ${josa(g.from, '이', '가')} 둘이 섞기를 부탁했어요 (믹스 솥 💞)`);
      return;
    }
    if (g.kind === 'coupleCancel') {
      s.coupleIn = s.coupleIn.filter(x => x.key !== g.askKey);
      this.save(); done();
      this.toast(`${josa(g.from, '이', '가')} 둘이 섞기 부탁을 거뒀어요`);
      return;
    }
    const out = s.coupleOut && s.coupleOut.key === g.askKey ? s.coupleOut : null;
    if (g.kind === 'coupleNo') {
      if (out) { s.coupleOut = null; s.dust += MIX_COST; this.renderTop(); }
      this.save(); done();
      this.toast(`${josa(g.from, '이', '가')} 다음에 같이 섞재요 (반짝가루는 돌려받았어요)`);
      return;
    }
    if (g.kind === 'coupleDone') {
      if (!SPECIES[g.res]) { done(); return; }
      if (!out && s.monggles.length >= BOX_MAX) { // 이미 그만둔 부탁이면 아기만 받아요 → 자리가 필요
        if (!this.boxWarned) { this.boxWarned = true; this.toast('💞 아기가 왔는데 가방이 꽉 찼어요. 자리를 만들면 받아져요'); }
        setTimeout(() => this.giftArrived(g, done), 20000); return;
      }
      this.boxWarned = false;
      if (out) {
        s.monggles = s.monggles.filter(x => x.id !== out.monId);
        s.party = s.party.filter(id => id !== out.monId);
        s.coupleOut = null;
      }
      const baby = this.addBaby(g.res, g.shiny, g.mon?.sp);
      if (!s.party.length) s.party.push(baby.id);
      this.game.syncParty(); this.save(); done(); this.renderTop();
      this.coupleBorn(baby, g.from);
      return;
    }
    done();
  }
}
