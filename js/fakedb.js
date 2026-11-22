// 자동 테스트 전용: Firebase Realtime Database 흉내 (같은 브라우저 탭끼리 BroadcastChannel로 공유)
// 실제 계정을 쓰지 않고 접속 표시·통화·같이 사냥 연결을 시험하기 위해 쓴다.
export function makeFakeDb(uid) {
  const bc = new BroadcastChannel('monggle-fakedb');
  let tree = {};
  const listeners = [];
  const parts = p => p.split('/').filter(Boolean);
  const get = p => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), tree);
  const setAt = (p, val) => {
    const ks = parts(p);
    if (!ks.length) { tree = val || {}; return; }
    let o = tree;
    for (const k of ks.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
    if (val === null || val === undefined) delete o[ks.at(-1)]; else o[ks.at(-1)] = val;
  };
  const snap = v => ({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v != null });
  function notify() {
    for (const l of [...listeners]) {
      if (l.type === 'value') {
        const v = get(l.path), j = JSON.stringify(v ?? null);
        if (j !== l.last) { l.last = j; l.cb(snap(v)); }
      } else {
        const v = get(l.path) || {};
        for (const k of Object.keys(v)) if (!l.seen.has(k)) { l.seen.add(k); l.cb({ ...snap(v[k]), key: k }); }
      }
    }
  }
  function apply(op) {
    if (op.op === 'set') setAt(op.path, op.val);
    else if (op.op === 'update') for (const [k, v] of Object.entries(op.val)) setAt(op.path + '/' + k, v);
    else if (op.op === 'remove') setAt(op.path, null);
    notify();
  }
  const local = op => { apply(op); bc.postMessage(op); return Promise.resolve(); };
  const merge = (a, b) => {
    for (const [k, v] of Object.entries(b)) {
      if (v && typeof v === 'object' && a[k] && typeof a[k] === 'object') merge(a[k], v); else if (!(k in a)) a[k] = v;
    }
    return a;
  };
  bc.onmessage = e => {
    const m = e.data;
    if (m.op === 'hello') bc.postMessage({ op: 'tree', tree });
    else if (m.op === 'tree') { merge(tree, m.tree); notify(); }
    else apply(m);
  };
  bc.postMessage({ op: 'hello' });
  let pushN = 0;
  const off = l => () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
  return {
    ref: (db, path) => ({ path }),
    set: (r, v) => local({ op: 'set', path: r.path, val: JSON.parse(JSON.stringify(v)) }),
    update: (r, v) => local({ op: 'update', path: r.path, val: JSON.parse(JSON.stringify(v)) }),
    remove: r => local({ op: 'remove', path: r.path }),
    push: (r, v) => local({ op: 'set', path: `${r.path}/${uid}_${Date.now()}_${pushN++}`, val: JSON.parse(JSON.stringify(v)) }),
    onValue: (r, cb) => {
      if (r.path === '.info/connected') { setTimeout(() => cb(snap(true))); return () => {}; }
      const l = { path: r.path, cb, type: 'value' }; listeners.push(l); setTimeout(notify); return off(l);
    },
    onChildAdded: (r, cb) => { const l = { path: r.path, cb, type: 'child', seen: new Set() }; listeners.push(l); setTimeout(notify); return off(l); },
    onDisconnect: r => ({ remove: () => addEventListener('pagehide', () => bc.postMessage({ op: 'remove', path: r.path })) }),
    serverTimestamp: () => Date.now(),
  };
}
