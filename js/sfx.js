// 몽글믹스 — 효과음 (파일 없이 소리를 직접 합성)
let ac = null;
let muted = localStorage.getItem('monggle-mute') === '1';

// 아이폰: 게임 소리가 유튜브·멜론 음악을 멈추지 않고 섞이게 (사파리 16.4+)
export function setAudioMode(mode) {
  try { if (navigator.audioSession) navigator.audioSession.type = mode; } catch {}
}
setAudioMode('ambient');

function ctx() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlock() { ctx(); }
export function isMuted() { return muted; }
export function setMuted(m) { muted = m; localStorage.setItem('monggle-mute', m ? '1' : '0'); }

// 짧은 음 하나
function tone(freq, { dur = 0.12, type = 'sine', vol = 0.18, slide = 0, delay = 0, attack = 0.005 } = {}) {
  if (muted) return;
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

let lastHit = 0;
export const sfx = {
  tap() { tone(660, { dur: 0.06, type: 'triangle', vol: 0.08 }); },
  hit(big) {
    const now = performance.now(); if (now - lastHit < 60) return; lastHit = now;
    tone(big ? 300 : 420 + Math.random() * 80, { dur: 0.09, type: 'square', vol: big ? 0.08 : 0.05, slide: 0.5 });
  },
  ouch() { tone(260, { dur: 0.12, type: 'triangle', vol: 0.07, slide: 0.6 }); },
  shoot() { tone(900, { dur: 0.1, type: 'sine', vol: 0.06, slide: 0.5 }); },
  skill() { tone(400, { dur: 0.22, type: 'triangle', vol: 0.12, slide: 2.2 }); tone(800, { dur: 0.15, vol: 0.06, delay: 0.08, slide: 1.5 }); },
  heal() { [784, 988, 1175].forEach((f, i) => tone(f, { dur: 0.25, vol: 0.07, delay: i * 0.06 })); },
  cheer() { [523, 659, 784].forEach((f, i) => tone(f, { dur: 0.16, type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
  dust() { tone(1400 + Math.random() * 300, { dur: 0.08, vol: 0.05 }); },
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.22, type: 'triangle', vol: 0.12, delay: i * 0.09 })); },
  friend() { [880, 1109, 1319, 1760].forEach((f, i) => tone(f, { dur: 0.3, vol: 0.08, delay: i * 0.07 })); },
  befriend() { [659, 784, 988, 1319].forEach((f, i) => tone(f, { dur: 0.35, type: 'triangle', vol: 0.1, delay: i * 0.08 })); },
  bubble() { for (let i = 0; i < 8; i++) tone(300 + Math.random() * 500, { dur: 0.08, vol: 0.06, delay: i * 0.12, slide: 1.8 }); },
  born(shiny) {
    const notes = shiny ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, { dur: 0.35, type: 'triangle', vol: 0.11, delay: i * 0.1 }));
  },
  emote() { tone(1000, { dur: 0.08, type: 'sine', vol: 0.08, slide: 1.4 }); },
  boss() { [196, 165, 147].forEach((f, i) => tone(f, { dur: 0.4, type: 'sawtooth', vol: 0.05, delay: i * 0.25 })); },
  error() { tone(220, { dur: 0.12, type: 'square', vol: 0.04 }); },
};
