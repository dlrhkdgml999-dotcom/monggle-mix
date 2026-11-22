// 몽글믹스 — 둘이 같이 (접속 표시 🟢, 상대 캐릭터 보기, 음성 통화 🎤, 같이 사냥 데이터 연결)
// 연결 신호만 Firebase로 주고받고, 목소리와 게임 데이터는 폰끼리 바로(WebRTC) 간다.
import { fbHandle, currentUser } from './save.js';
import { setAudioMode } from './sfx.js';
import { VERSION } from './version.js';

const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // 연결이 안 되는 통신사/와이파이용 중계(TURN) 서버는 여기에 추가
];

// 폰끼리 연결 하나 (kind: 'voice' 또는 'game')
class Peer {
  constructor(net, otherUid, kind, { setup, onOpen, onFail }) {
    Object.assign(this, { net, otherUid, kind, setup, onOpen, onFail });
    this.subs = [];
    this.closed = false;
    this.start();
  }

  async start() {
    const { ref, set, remove, onValue, push, onChildAdded } = this.net.M;
    const db = this.net.db;
    const ids = [this.net.uid, this.otherUid].sort();
    const caller = this.net.uid === ids[0];
    const base = `rtc/${ids.join('_')}/${this.kind}`;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.pc = pc;
    this.setup(pc, caller);
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') { this.connected = true; this.onOpen?.(); }
      if (s === 'failed' || (s === 'disconnected' && this.kind === 'game')) { if (!this.closed) this.onFail?.(); }
    };
    const listen = (r, cb) => this.subs.push(onValue(r, cb));
    const listenAdd = (r, cb) => this.subs.push(onChildAdded(r, cb));
    if (caller) {
      const sid = Date.now().toString(36);
      await remove(ref(db, base));
      if (this.closed) return;
      pc.onicecandidate = e => e.candidate && push(ref(db, `${base}/${sid}/a`), e.candidate.toJSON());
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await set(ref(db, `${base}/offer`), { sid, sdp: offer.sdp });
      listen(ref(db, `${base}/answer`), async snap => {
        const v = snap.val();
        if (!v || v.sid !== sid || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: v.sdp }).catch(() => {});
      });
      listenAdd(ref(db, `${base}/${sid}/b`), snap => pc.addIceCandidate(snap.val()).catch(() => {}));
    } else {
      let handled = null;
      listen(ref(db, `${base}/offer`), async snap => {
        const v = snap.val();
        if (!v || v.sid === handled) return;
        if (handled) { this.onFail?.(true); return; } // 상대가 다시 걸었음 → 새로 연결
        handled = v.sid;
        pc.onicecandidate = e => e.candidate && push(ref(db, `${base}/${v.sid}/b`), e.candidate.toJSON());
        try {
          await pc.setRemoteDescription({ type: 'offer', sdp: v.sdp });
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await set(ref(db, `${base}/answer`), { sid: v.sid, sdp: ans.sdp });
        } catch { this.onFail?.(); return; }
        listenAdd(ref(db, `${base}/${v.sid}/a`), s => pc.addIceCandidate(s.val()).catch(() => {}));
      });
    }
  }

  close() {
    this.closed = true;
    this.subs.forEach(u => { try { u(); } catch {} });
    this.subs = [];
    try { this.pc?.close(); } catch {}
  }
}

export class Net {
  constructor(ui) {
    this.ui = ui;
    this.others = {};
    this.mic = false;
    this.voice = null;
    this.game = null;
    this.seenEmote = {};
    this.onLink = null;    // (link, amHost) — 같이 사냥 연결됨
    this.onUnlink = null;
  }

  partyList() {
    const s = this.state;
    if (!s) return [];
    return s.party.map(id => s.monggles.find(m => m.id === id)).filter(Boolean).map(m => ({ sp: m.sp, shiny: !!m.shiny }));
  }
  updateParty() { if (this.on) this.M.update(this.meRef, { party: this.partyList() }).catch(() => {}); }
  sendEmote(e) { if (this.on) this.M.update(this.meRef, { emote: e, emoteT: Date.now() }).catch(() => {}); }
  sendChat(text) { if (this.on) this.M.update(this.meRef, { chat: text.slice(0, 40), chatT: Date.now() }).catch(() => {}); }

  get on() { return !!this.uid; }
  get connected() { return !!this.voice?.connected; }

  start(state) {
    const fb = fbHandle(), user = currentUser();
    this.state = state;
    if (!fb || !user) return;
    this.startWith(fb.mod.db, fb.db, user.uid);
  }

  startWith(M, db, uid) {
    const state = this.state;
    this.uid = uid; this.db = db; this.M = M;
    const { ref, set, onValue, onDisconnect, serverTimestamp } = this.M;
    this.meRef = ref(this.db, 'presence/' + this.uid);
    this.writePresence = () => set(this.meRef, {
      name: state.name, look: state.look, mic: this.mic, t: serverTimestamp(), party: this.partyList(),
      ...(this.lx != null ? { x: this.lx, z: this.lz } : {}), lv: state.lv, v: VERSION, job: state.job || 'mage',
    }).catch(() => {});
    onValue(ref(this.db, '.info/connected'), snap => {
      if (!snap.val()) return;
      onDisconnect(this.meRef).remove();
      this.writePresence();
    });
    // 혹시 접속 표시가 지워져도 15초마다 다시 켜기
    setInterval(() => { if (!document.hidden) this.writePresence(); }, 15000);
    // 선물 우편함
    this.M.onChildAdded(ref(this.db, 'mail/' + this.uid), snap => {
      const v = snap.val(); if (!v) return;
      this.ui.giftArrived(v, () => this.M.remove(ref(this.db, `mail/${this.uid}/${snap.key ?? v.key}`)).catch(() => {}));
    });
    onValue(ref(this.db, 'presence'), snap => {
      const all = snap.val() || {};
      const next = {};
      for (const [uid, v] of Object.entries(all)) if (uid !== this.uid) next[uid] = v;
      this.others = next;
      for (const [uid, v] of Object.entries(next)) {
        if (v.emoteT && this.seenEmote[uid] !== undefined && v.emoteT !== this.seenEmote[uid]) this.ui.partnerEmote(v.emote);
        this.seenEmote[uid] = v.emoteT || 0;
        if (v.chatT && this.seenChat?.[uid] !== undefined && v.chatT !== this.seenChat[uid]) this.ui.partnerChat(v.name, v.chat);
        (this.seenChat ||= {})[uid] = v.chatT || 0;
      }
      this.ui.renderOnline(this.partner());
      const p = this.partner();
      if (p) { this.partnerUid = p.uid; this.partnerName = p.name; try { localStorage.setItem('monggle-partner', JSON.stringify({ uid: p.uid, name: p.name })); } catch {} }
      if (p && p.v && p.v !== VERSION && this.warnedV !== p.v) {
        this.warnedV = p.v;
        this.ui.toast(`${p.name}와 게임 버전이 달라요. 둘 다 앱을 껐다 켜 주세요`);
      }
      this.checkCall();
      this.checkGame();
    });
  }

  partner() {
    const e = Object.entries(this.others)[0];
    return e ? { uid: e[0], ...e[1] } : null;
  }

  sendPos(p, zoneId, hp, maxHp) {
    if (!this.on) return;
    const now = performance.now();
    // 같이 사냥 연결 중이면 위치는 데이터 연결로 가니까 드물게만
    const gap = this.linked ? 3000 : 400;
    if (now - (this.lastSend || 0) < gap) return;
    const x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10;
    if (x === this.lx && z === this.lz && now - this.lastSend < 3000) return;
    this.lastSend = now; this.lx = x; this.lz = z;
    this.M.update(this.meRef, { x, z, zone: zoneId || '', hp: Math.round(hp), maxHp, lv: this.state.lv }).catch(() => {});
  }

  // ---------- 같이 사냥 (데이터 연결) ----------
  checkGame() {
    const p = this.partner();
    if (p && !this.game && !this.gameRetry) this.openGame(p.uid);
    if (!p && this.game) this.closeGame();
  }

  openGame(otherUid) {
    const amHost = this.uid < otherUid;
    const peer = new Peer(this, otherUid, 'game', {
      setup: (pc, caller) => {
        const wire = ch => {
          ch.onopen = () => {
            if (peer.closed) return;
            const link = {
              send: obj => { if (ch.readyState === 'open') ch.send(JSON.stringify(obj)); },
              onmessage: null,
            };
            ch.onmessage = e => { try { link.onmessage?.(JSON.parse(e.data)); } catch {} };
            ch.onclose = () => this.dropGame();
            this.linked = true;
            this.onLink?.(link, amHost);
          };
        };
        if (caller) wire(pc.createDataChannel('g', { ordered: true }));
        else pc.ondatachannel = ev => wire(ev.channel);
      },
      onFail: quick => this.dropGame(quick),
    });
    this.game = peer;
  }

  dropGame(quick) {
    if (!this.game) return;
    this.closeGame();
    // 잠시 뒤 다시 시도
    this.gameRetry = setTimeout(() => { this.gameRetry = null; this.checkGame(); }, quick ? 300 : 6000);
  }

  closeGame() {
    this.game?.close();
    this.game = null;
    if (this.linked) { this.linked = false; this.onUnlink?.(); }
  }

  // ---------- 음성 통화 ----------
  async setMic(on) {
    if (!this.on) { this.ui.toast('음성 통화는 비밀번호로 로그인하면 쓸 수 있어요'); return false; }
    if (on) {
      try {
        setAudioMode('play-and-record');
        this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        setAudioMode('ambient');
        this.ui.toast('마이크 사용을 허용해 주세요 (주소창 왼쪽 자물쇠 → 마이크)');
        return false;
      }
      this.mic = true;
      setAudioMode('play-and-record');
      this.watchLevel(this.local, lv => this.ui.setMyVoice(lv));
    } else {
      this.mic = false;
      setAudioMode('ambient');
      this.hangup();
      this.local?.getTracks().forEach(t => t.stop());
      this.local = null;
    }
    this.M.update(this.meRef, { mic: this.mic }).catch(() => {});
    this.checkCall();
    return true;
  }

  checkCall() {
    const p = this.partner();
    const want = this.mic && p && p.mic;
    if (want && !this.voice) this.call(p.uid);
    else if (!want && this.voice) this.hangup();
    this.ui.renderCall(this.voice ? (this.connected ? 'on' : 'wait') : (this.mic ? (p ? (p.mic ? 'wait' : 'their-off') : 'alone') : 'off'));
  }

  call(otherUid) {
    this.voice = new Peer(this, otherUid, 'voice', {
      setup: pc => {
        this.local.getTracks().forEach(t => pc.addTrack(t, this.local));
        pc.ontrack = ev => {
          if (!this.audio) { this.audio = new Audio(); this.audio.autoplay = true; this.audio.setAttribute('playsinline', ''); }
          this.audio.srcObject = ev.streams[0];
          this.audio.play().catch(() => this.ui.toast('화면을 한 번 눌러 주면 상대 목소리가 나와요'));
          this.watchLevel(ev.streams[0], lv => this.ui.setPartnerVoice(lv));
        };
      },
      onOpen: () => { this.ui.toast('🎤 통화 연결됐어요'); this.checkCall(); },
      onFail: quick => {
        if (!quick) this.ui.toast('통화 연결이 안 돼요. 와이파이를 바꿔 보거나 잠시 후 다시 켜 주세요');
        this.hangup(); if (quick) this.checkCall();
      },
    });
  }

  hangup() {
    this.voice?.close();
    this.voice = null;
    if (this.audio) this.audio.srcObject = null;
    this.ui.setPartnerVoice(0);
  }

  // ---------- 선물 ----------
  giftTarget() {
    if (this.partnerUid) return { uid: this.partnerUid, name: this.partnerName };
    try { return JSON.parse(localStorage.getItem('monggle-partner')); } catch { return null; }
  }
  async sendGift(gift) {
    const to = this.giftTarget();
    if (!this.on || !to) return false;
    const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await this.M.set(this.M.ref(this.db, `mail/${to.uid}/${key}`), { ...gift, key, from: this.state.name, t: Date.now() });
    return key; // 둘이 섞기에서 부탁 번호로 씀
  }

  // 통화·같이 사냥 상태 (점검용)
  diag() {
    const p = this.partner();
    const st = pc => pc ? `${pc.connectionState} / ${pc.iceConnectionState}` : '없음';
    return {
      login: this.on, version: VERSION,
      partner: p ? `${p.name} (버전 ${p.v || '옛날'}${p.v && p.v !== VERSION ? ' ⚠ 다름' : ''})` : '접속 안 함',
      myMic: this.mic, theirMic: !!p?.mic,
      voice: st(this.voice?.pc), game: st(this.game?.pc), linked: !!this.linked,
    };
  }

  // 말하는 소리 크기 (말풍선 표시용)
  watchLevel(stream, cb) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = this.ac || new AC();
      this.ac.resume?.();
      const src = this.ac.createMediaStreamSource(stream);
      const an = this.ac.createAnalyser(); an.fftSize = 256;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        if (!stream.active) { cb(0); return; }
        an.getByteFrequencyData(buf);
        let s = 0; for (const v of buf) s += v;
        cb(s / buf.length / 255);
        requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }
}
