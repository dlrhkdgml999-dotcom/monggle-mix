// 몽글믹스 — 화면 UI (상단 정보, 스킬 버튼, 가방, 도감, 믹스 솥)
import * as THREE from '../lib/three.min.js';
import { SPECIES, ELEM, DEX_ORDER, mixResult, MIX_COST, MIX_MIN_LV, BOX_MAX, expToNext, MAX_LV, QUESTS } from './data.js';
import { makeMonggle } from './models.js';
import { sfx, isMuted, setMuted } from './sfx.js';
import { newSave } from './save.js';

const $ = (s, el = document) => el.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---------- 몽글이 초상화 (3D를 작은 그림으로) ----------
const iconCache = {};
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

const elemTags = sp => SPECIES[sp].elems.map(e => `<span class="el" style="--c:${ELEM[e].color}">${ELEM[e].icon}${ELEM[e].name}</span>`).join('');
const ROLE = { melee: '근거리', ranged: '원거리', tank: '탱커', healer: '힐러', aoe: '범위' };

export class UI {
  constructor({ camera, state, onSave }) {
    this.camera = camera; this.state = state; this.onSave = onSave;
    this.fx = $('#fx'); this.bars = $('#bars');
    this.build();
  }
  attach(game, net) { this.game = game; this.net = net; this.renderTop(); this.renderParty(); this.renderSkills(); }
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
        <div id="emoTray" class="hidden"><button>❤️</button><button>😆</button><button>😠</button><button>😭</button></div>
      </div>
      <button id="mixBtn" class="mixBtn hidden">🍲 믹스 솥 열기</button>
      <div id="skills"></div>
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
    $('#emoTray').querySelectorAll('button').forEach(b => b.onclick = () => {
      $('#emoTray').classList.add('hidden');
      this.emote(this.game.hero.model.root, b.textContent);
      this.net.sendEmote(b.textContent);
    });
    const mb = $('#muteBtn');
    const drawMute = () => { mb.textContent = isMuted() ? '🔇' : '🔊'; };
    drawMute();
    mb.onclick = () => { setMuted(!isMuted()); drawMute(); sfx.tap(); };
    $('#panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') this.closePanel(); });
  }

  // ---------- 상단 ----------
  renderTop() {
    const s = this.state, g = this.game;
    $('#meName').textContent = s.name;
    $('#meLv').textContent = 'Lv ' + s.lv;
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
    for (let i = 0; i < this.game.partySize(); i++) {
      const u = this.game.units.find(x => x.kind === 'pet' && x.slot === i);
      if (!u) continue;
      const sk = SPECIES[u.sp].skill;
      const b = h('button', 'skill', `<img src="${icon(u.sp, u.data.shiny)}"><small>${sk.name}</small><i class="cd"></i>`);
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
      else { const u = g.units.find(x => x.kind === 'pet' && x.slot === +b.dataset.slot); if (u) { left = u.dead ? 99 : u.skillCd; total = SPECIES[u.sp].skill.cd; } }
      cd.style.height = Math.max(0, Math.min(1, left / total)) * 100 + '%';
      b.classList.toggle('ready', left <= 0);
    }
    $('#mixBtn').classList.toggle('hidden', !g.nearCauldron() || !$('#panel').classList.contains('hidden'));
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
    const B = { minX: -30, maxX: 60, minZ: -64, maxZ: 26 };
    const k = Math.min(W / (B.maxX - B.minX), H / (B.maxZ - B.minZ));
    const ox = (W - (B.maxX - B.minX) * k) / 2, oz = (H - (B.maxZ - B.minZ) * k) / 2;
    const P = (px, pz) => [ox + (px - B.minX) * k, oz + (pz - B.minZ) * k];
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(159, 224, 138, .9)'; x.beginPath(); x.roundRect(0, 0, W, H, 22); x.fill();
    const circ = (px, pz, r, col) => { const [a, b] = P(px, pz); x.fillStyle = col; x.beginPath(); x.arc(a, b, r * k, 0, 7); x.fill(); };
    circ(34, 6, 20, '#8bd977'); circ(4, -47, 13, '#f6e6b4'); circ(4, -47, 9, '#6cc8ff'); circ(0, 0, 13, '#f3e2b8');
    const dot = (px, pz, r, col, ring) => { const [a, b] = P(px, pz); x.fillStyle = col; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); if (ring) { x.lineWidth = 3; x.strokeStyle = ring; x.stroke(); } };
    for (const u of g.units) if (u.kind === 'wild' && !u.dead && !u.boss) dot(u.model.root.position.x, u.model.root.position.z, 3, 'rgba(90,70,110,.45)');
    if (g.boss && !g.boss.dead && !g.boss.removed) { const bp = g.boss.model.root.position; dot(bp.x, bp.z, 8, '#ff5f7a', '#fff'); }
    dot(0, -2, 5, '#9f78ff');
    if (this.partnerModel) { const pp = this.partnerModel.root.position; dot(pp.x, pp.z, 7, '#ff8fb4', '#fff'); }
    const hp = g.hero.model.root.position; dot(hp.x, hp.z, 7, '#fff', '#7a56d6');
  }

  // ---------- 머리 위 체력바 ----------
  makeBar(u) {
    if (u.kind === 'hero' || u.kind === 'pet') return null;
    const b = h('div', 'ubar ' + u.kind, `<span class="nm">${u.kind === 'wild' ? `Lv${u.lv} ` : ''}${u.name}</span><div class="bar hp sm"><i></i></div>`);
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
    const show = !u.dead && (u.kind === 'friend' || (u.kind === 'wild' && (u.hp < u.maxHp || this.game.hero.target === u)));
    const s = this.project(u.model.root.position, u.sp && SPECIES[u.sp].stage === 2 ? 1.75 : 1.45);
    if (!show || !s.vis) { u.bar.style.display = 'none'; return; }
    u.bar.style.display = '';
    u.bar.style.transform = `translate(${s.x}px, ${s.y}px)`;
    u.bar.querySelector('i').style.width = (u.hp / u.maxHp * 100) + '%';
    u.bar.classList.toggle('targeted', this.game.hero.target === u);
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
    while (t.children.length > 3) t.firstChild.remove();
    setTimeout(() => e.classList.add('out'), 2600);
    setTimeout(() => e.remove(), 3100);
  }
  showZone(z) {
    const e = $('#zoneName');
    e.textContent = z ? z.name : '';
    e.classList.remove('show'); void e.offsetWidth;
    if (z) e.classList.add('show');
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
    $('#online span').textContent = p ? `${p.name} 접속 중` : (this.net?.on ? '상대 오프라인' : '혼자 노는 중');
  }
  renderCall(st) {
    const b = $('#micBtn');
    b.dataset.st = st;
    b.title = { on: '통화 중', wait: '연결 중…', 'their-off': '상대 마이크 꺼짐', alone: '상대가 접속하면 연결돼요', off: '마이크 꺼짐' }[st];
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
    const b = $('#panel .body'); b.innerHTML = `<h2>${title}</h2>`;
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

  openBox() {
    const s = this.state, g = this.game;
    const b = this.openPanel(`🎒 가방 <small>${s.monggles.length}/${BOX_MAX}칸 · 데리고 다니기 ${s.party.length}/${g.partySize()}</small>`);
    const grid = h('div', 'grid');
    grid.innerHTML = s.monggles.map(m => this.monCard(m)).join('');
    b.appendChild(grid);
    b.appendChild(h('p', 'hint', '몽글이를 누르면 자세히 보고, 데리고 다닐지 정할 수 있어요.'));
    const rs = h('button', 'link reset', '처음부터 다시 하기');
    rs.onclick = () => this.confirmReset();
    b.appendChild(rs);
    grid.onclick = e => { const c = e.target.closest('.mcard'); if (c) this.openMon(+c.dataset.id); };
  }

  confirmReset() {
    const b = this.openPanel('처음부터 다시 할까요?');
    b.insertAdjacentHTML('beforeend', `<p class="hint">레벨, 몽글이, 반짝가루, 도감이 모두 처음으로 돌아가요. 되돌릴 수 없어요.</p>
      <div class="btns center"><button class="btn" id="rsYes">네, 처음부터</button><button class="btn ghost" id="rsNo">아니요</button></div>`);
    $('#rsNo', b).onclick = () => this.openBox();
    $('#rsYes', b).onclick = () => {
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
    const inh = m.inh ? `<div class="kv"><span>물려받은 기술</span><b>${SPECIES[m.inh].skill.name}</b></div>` : '';
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
            <button class="btn ghost" id="back">← 가방</button>
          </div>
        </div>
      </div>`);
    $('#back', b).onclick = () => this.openBox();
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
        : `<div class="mcard unknown"><img src="${icon(sp)}"><div class="nm">???</div><div class="sub">${S.stage === 2 ? '조합으로 태어나요' : '야생에서 만나요'}</div></div>`;
    }).join('');
    b.appendChild(grid);
    b.appendChild(h('p', 'hint', '새 몽글이를 만날수록 섬에 색이 돌아와요.'));
  }

  // ---------- 믹스 솥 ----------
  openMix(pick = []) {
    const s = this.state;
    const b = this.openPanel(`🍲 믹스 솥 <small>✦ ${s.dust} · 한 번에 ✦${MIX_COST}</small>`, 'mix');
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
    grid.innerHTML = s.monggles.map(m => this.monCard(m, m.lv < MIX_MIN_LV ? '<span class="lock">Lv' + MIX_MIN_LV + '부터</span>' : '')).join('');
    for (const el of grid.children) {
      const id = +el.dataset.id;
      if (pick.includes(id)) el.classList.add('picked');
      if (s.monggles.find(m => m.id === id).lv < MIX_MIN_LV) el.classList.add('locked');
    }
    b.appendChild(grid);
    grid.onclick = e => {
      const el = e.target.closest('.mcard'); if (!el) return;
      const id = +el.dataset.id;
      if (el.classList.contains('locked')) { this.toast(`Lv${MIX_MIN_LV}부터 섞을 수 있어요`); return; }
      let p = pick.includes(id) ? pick.filter(x => x !== id) : [...pick, id].slice(-2);
      this.openMix(p);
    };
    const btn = $('#doMix', b);
    const ok = a && c && res && s.dust >= MIX_COST;
    btn.disabled = !ok;
    if (a && c && res && s.dust < MIX_COST) btn.textContent = `반짝가루가 ${MIX_COST - s.dust}개 모자라요`;
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
}
