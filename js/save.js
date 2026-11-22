// 몽글믹스 — 저장 (이 폰 localStorage + 구글 로그인 시 Firebase)
const FB_VER = '11.0.2';
export const firebaseConfig = {
  apiKey: 'AIzaSyAnim3bVDkAAyfkxkQgsOb8VzTEQngJevI',
  authDomain: 'monggle-mix.firebaseapp.com',
  databaseURL: 'https://monggle-mix-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'monggle-mix',
  storageBucket: 'monggle-mix.firebasestorage.app',
  messagingSenderId: '124895701918',
  appId: '1:124895701918:web:1eed4dd661af0016b3048f',
};

const LS_BASE = 'monggle-mix-save-v1';
let LS_KEY = LS_BASE;

// 비밀번호(4자리) → 사람. 번호 자체는 코드에 남기지 않고 해시만 둔다.
export const PROFILES = {
  f930e552ed9a52a4: { name: '광희', look: 'boy' },
  '13cc2081f0e84ad7': { name: '하은', look: 'girl' },
};
export async function pinHash(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('monggle-mix:' + pin));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
export function useProfileStorage(hash) { LS_KEY = hash ? LS_BASE + '-' + hash : LS_BASE; }
export function profileOfUser(u) {
  const m = u?.email?.match(/^u([0-9a-f]{16})@/);
  return m && PROFILES[m[1]] ? { hash: m[1], ...PROFILES[m[1]] } : null;
}

// 비밀번호 로그인: 처음이면 계정을 자동으로 만든다
export async function pinLogin(pin) {
  const hash = await pinHash(pin);
  const prof = PROFILES[hash];
  if (!prof) return { error: 'wrong' };
  useProfileStorage(hash);
  let f;
  try { f = await loadFirebase(); } catch { return { prof: { hash, ...prof }, offline: true }; }
  const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = f.mod.auth;
  const email = `u${hash}@monggle-mix.app`, pw = `mm-${hash}-mix`;
  try {
    user = (await signInWithEmailAndPassword(f.auth, email, pw)).user;
  } catch (e) {
    if (['auth/invalid-credential', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(e.code)) {
      try { user = (await createUserWithEmailAndPassword(f.auth, email, pw)).user; }
      catch (e2) { return { prof: { hash, ...prof }, offline: true, error: e2.code }; }
    } else return { prof: { hash, ...prof }, offline: true, error: e.code };
  }
  return { prof: { hash, ...prof }, user };
}
let fb = null;      // { auth, db, mod }
let user = null;    // 로그인한 사용자

export function newSave(name, look) {
  return {
    v: 1, name, look,
    lv: 1, exp: 0, dust: 15,
    nextId: 3,
    monggles: [
      { id: 1, sp: 'bulssi', lv: 1, exp: 0, shiny: false },
      { id: 2, sp: 'saessak', lv: 1, exp: 0, shiny: false },
    ],
    party: [1, 2],
    dex: { bulssi: 1, saessak: 1 },
    items: { potion: 3 },
    created: Date.now(),
  };
}

export function loadLocal() {
  try { const s = JSON.parse(localStorage.getItem(LS_KEY)); return s && s.v ? s : null; }
  catch { return null; }
}

let pending = null;
export function save(state) {
  state.savedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  if (!user || !fb || location.search.includes('test')) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    const { ref, set } = fb.mod.db;
    set(ref(fb.db, 'users/' + user.uid + '/save'), state).catch(e => console.warn('클라우드 저장 실패', e));
  }, 1500);
}

async function loadFirebase() {
  if (fb) return fb;
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [app, auth, db] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js'),
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { auth: auth.getAuth(a), db: db.getDatabase(a), mod: { auth, db } };
  return fb;
}

// 이미 로그인돼 있으면 사용자 정보, 아니면 null
export async function checkLogin() {
  try {
    const f = await loadFirebase();
    return await new Promise(res => {
      const off = f.mod.auth.onAuthStateChanged(f.auth, u => { off(); user = u; res(u); });
      setTimeout(() => res(null), 4000);
    });
  } catch (e) { console.warn('Firebase를 못 불러옴(오프라인?)', e); return null; }
}

export async function googleLogin() {
  const f = await loadFirebase();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = f.mod.auth;
  const p = new GoogleAuthProvider();
  try {
    const r = await signInWithPopup(f.auth, p);
    user = r.user; return user;
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(f.auth, p); return null;
    }
    throw e;
  }
}

export async function loadCloud() {
  if (!user || !fb) return null;
  const { ref, get } = fb.mod.db;
  const snap = await get(ref(fb.db, 'users/' + user.uid + '/save'));
  return snap.exists() ? snap.val() : null;
}

export function currentUser() { return user; }
export function fbHandle() { return fb; }

// Firebase는 빈 배열/객체를 지우므로 복원 시 채워 준다
export function normalize(s) {
  s.monggles = Array.isArray(s.monggles) ? s.monggles.filter(Boolean) : Object.values(s.monggles || {});
  s.party = Array.isArray(s.party) ? s.party.filter(x => x != null) : Object.values(s.party || {});
  s.dex = s.dex || {};
  s.dust = s.dust || 0;
  s.items = s.items || { potion: 3 };
  s.inv = Array.isArray(s.inv) ? s.inv.filter(Boolean) : Object.values(s.inv || {});
  s.eq = s.eq || {};
  s.nextItem = s.nextItem || 1;
  s.coupleIn = Array.isArray(s.coupleIn) ? s.coupleIn.filter(Boolean) : Object.values(s.coupleIn || {});
  if (s.coupleOut && !s.monggles.some(m => m.id === s.coupleOut.monId)) s.coupleOut = null;
  return s;
}
