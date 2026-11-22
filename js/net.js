// 몽글믹스 — 둘이 같이 (접속 표시 🟢, 상대 캐릭터 보기, 음성 통화 🎤)
// 연결 신호만 Firebase로 주고받고, 목소리는 폰끼리 바로(WebRTC) 간다.
import { fbHandle, currentUser } from './save.js';

const ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // 연결이 안 되는 통신사/와이파이용 중계(TURN) 서버는 여기에 추가
];

export class Net {
  constructor(ui) {
    this.ui = ui;
    this.others = {};   // uid → {name, look, mic, x, z, online}
    this.mic = false;
    this.pc = null;
    this.subs = [];
    this.seenEmote = {};
  }

  partyList() {
    const s = this.state;
    if (!s) return [];
    return s.party.map(id => s.monggles.find(m => m.id === id)).filter(Boolean).map(m => ({ sp: m.sp, shiny: !!m.shiny }));
  }
  updateParty() { if (this.on) this.M.update(this.meRef, { party: this.partyList() }).catch(() => {}); }
  sendEmote(e) { if (this.on) this.M.update(this.meRef, { emote: e, emoteT: Date.now() }).catch(() => {}); }

  get on() { return !!this.uid; }

  start(state) {
    const fb = fbHandle(), user = currentUser();
    if (!fb || !user) return;
    this.fb = fb; this.uid = user.uid; this.db = fb.db; this.M = fb.mod.db;
    const { ref, set, onValue, onDisconnect, serverTimestamp } = this.M;
    this.meRef = ref(this.db, 'presence/' + this.uid);
    this.state = state;
    onValue(ref(this.db, '.info/connected'), snap => {
      if (!snap.val()) return;
      onDisconnect(this.meRef).remove();
      set(this.meRef, { name: state.name, look: state.look, mic: this.mic, t: serverTimestamp(), party: this.partyList() });
    });
    onValue(ref(this.db, 'presence'), snap => {
      const all = snap.val() || {};
      const next = {};
      for (const [uid, v] of Object.entries(all)) if (uid !== this.uid) next[uid] = v;
      this.others = next;
      // 상대 감정표현
      for (const [uid, v] of Object.entries(next)) {
        if (v.emoteT && this.seenEmote[uid] !== undefined && v.emoteT !== this.seenEmote[uid]) this.ui.partnerEmote(v.emote);
        this.seenEmote[uid] = v.emoteT || 0;
      }
      this.ui.renderOnline(this.partner());
      this.checkCall();
    });
  }

  partner() {
    const e = Object.entries(this.others)[0];
    return e ? { uid: e[0], ...e[1] } : null;
  }

  // 0.4초마다 내 위치 보내기
  sendPos(p, zoneId, hp, maxHp) {
    if (!this.on) return;
    const now = performance.now();
    if (now - (this.lastSend || 0) < 400) return;
    const x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10;
    if (x === this.lx && z === this.lz && now - this.lastSend < 3000) return;
    this.lastSend = now; this.lx = x; this.lz = z;
    this.M.update(this.meRef, { x, z, zone: zoneId || '', hp: Math.round(hp), maxHp, lv: this.state.lv }).catch(() => {});
  }

  // ---------- 음성 통화 ----------
  async setMic(on) {
    if (!this.on) { this.ui.toast('음성 통화는 구글 로그인을 하면 쓸 수 있어요'); return false; }
    if (on) {
      try {
        this.local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) {
        this.ui.toast('마이크 사용을 허용해 주세요 (주소창 왼쪽 자물쇠 → 마이크)');
        return false;
      }
      this.mic = true;
      this.watchLevel(this.local, lv => this.ui.setMyVoice(lv));
    } else {
      this.mic = false;
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
    if (want && !this.pc) this.connect(p.uid);
    else if (!want && this.pc) this.hangup();
    this.ui.renderCall(this.pc ? (this.connected ? 'on' : 'wait') : (this.mic ? (p ? (p.mic ? 'wait' : 'their-off') : 'alone') : 'off'));
  }

  async connect(otherUid) {
    const { ref, set, remove, onValue, push, onChildAdded, off } = this.M;
    const ids = [this.uid, otherUid].sort();
    const caller = this.uid === ids[0];
    const roomRef = ref(this.db, 'rtc/' + ids.join('_'));
    const pc = new RTCPeerConnection({ iceServers: ICE });
    this.pc = pc; this.connected = false;
    this.local.getTracks().forEach(t => pc.addTrack(t, this.local));
    pc.ontrack = ev => {
      if (!this.audio) { this.audio = new Audio(); this.audio.autoplay = true; this.audio.setAttribute('playsinline', ''); }
      this.audio.srcObject = ev.streams[0];
      this.audio.play().catch(() => this.ui.toast('화면을 한 번 눌러 주면 상대 목소리가 나와요'));
      this.watchLevel(ev.streams[0], lv => this.ui.setPartnerVoice(lv));
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') { this.connected = true; this.ui.toast('🎤 통화 연결됐어요'); this.checkCall(); }
      if (s === 'failed') { this.ui.toast('통화 연결이 안 돼요. 와이파이를 바꿔 보거나 잠시 후 다시 켜 주세요'); this.hangup(); }
    };
    const listen = (r, cb) => { const u = onValue(r, cb); this.subs.push(u); };
    const listenAdd = (r, cb) => { const u = onChildAdded(r, cb); this.subs.push(u); };

    if (caller) {
      const sid = Date.now().toString(36);
      await remove(roomRef);
      pc.onicecandidate = e => e.candidate && push(ref(this.db, `rtc/${ids.join('_')}/${sid}/a`), e.candidate.toJSON());
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await set(ref(this.db, `rtc/${ids.join('_')}/offer`), { sid, sdp: offer.sdp });
      listen(ref(this.db, `rtc/${ids.join('_')}/answer`), async snap => {
        const v = snap.val();
        if (!v || v.sid !== sid || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: v.sdp });
      });
      listenAdd(ref(this.db, `rtc/${ids.join('_')}/${sid}/b`), snap => pc.addIceCandidate(snap.val()).catch(() => {}));
    } else {
      let handled = null;
      listen(ref(this.db, `rtc/${ids.join('_')}/offer`), async snap => {
        const v = snap.val();
        if (!v || v.sid === handled) return;
        if (handled) { this.hangup(); this.checkCall(); return; } // 상대가 다시 걸었음
        handled = v.sid;
        pc.onicecandidate = e => e.candidate && push(ref(this.db, `rtc/${ids.join('_')}/${v.sid}/b`), e.candidate.toJSON());
        await pc.setRemoteDescription({ type: 'offer', sdp: v.sdp });
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        await set(ref(this.db, `rtc/${ids.join('_')}/answer`), { sid: v.sid, sdp: ans.sdp });
        listenAdd(ref(this.db, `rtc/${ids.join('_')}/${v.sid}/a`), s => pc.addIceCandidate(s.val()).catch(() => {}));
      });
    }
  }

  hangup() {
    this.subs.forEach(u => { try { u(); } catch {} });
    this.subs = [];
    if (this.pc) { try { this.pc.close(); } catch {} }
    this.pc = null; this.connected = false;
    if (this.audio) this.audio.srcObject = null;
    this.ui.setPartnerVoice(0);
  }

  // 말하는 소리 크기 (말풍선 표시용)
  watchLevel(stream, cb) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = this.ac || new AC();
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
