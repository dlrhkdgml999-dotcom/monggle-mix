// 몽글믹스 — 게임 데이터 (몽글이, 조합표, 맵)
// 새 몽글이·조합·맵을 더할 때는 이 파일만 고치면 된다.

export const ELEM = {
  fire:  { name: '불', color: '#ff7a59', icon: '🔥' },
  water: { name: '물', color: '#4fb3ff', icon: '💧' },
  grass: { name: '풀', color: '#5ccf6b', icon: '🌿' },
};

// 불 > 풀 > 물 > 불
const BEATS = { fire: 'grass', grass: 'water', water: 'fire' };

export function elemMult(atkElems, defElems) {
  let best = 1;
  for (const a of atkElems) {
    for (const d of defElems) {
      if (BEATS[a] === d) best = Math.max(best, 1.5);
    }
  }
  if (best > 1) return best;
  // 불리한지 확인 (모든 공격 속성이 상대에게 약할 때만)
  let weak = true;
  for (const a of atkElems) {
    if (!defElems.some(d => BEATS[d] === a)) weak = false;
  }
  return weak ? 0.7 : 1;
}

// role: melee 근거리, ranged 원거리, tank 탱커, healer 힐러, aoe 범위
// skill.type: strike 강타, proj 큰 탄, aoe 범위, heal 파티 회복, shield 보호막, slow 둔화, guard 자기 방어
export const SPECIES = {
  bulssi:   { name: '불씨콩', stage: 1, elems: ['fire'], role: 'melee',
              hp: 60, atk: 9, range: 1.5, speed: 3.4,
              skill: { name: '콩콩 박치기', type: 'strike', power: 3.0, cd: 7 } },
  hotteok:  { name: '호떡냥', stage: 1, elems: ['fire'], role: 'ranged',
              hp: 48, atk: 8, range: 5.5, speed: 3.2,
              skill: { name: '뜨끈 호떡 던지기', type: 'proj', power: 3.2, cd: 8 } },
  mulbang:  { name: '물방울토끼', stage: 1, elems: ['water'], role: 'ranged',
              hp: 50, atk: 8, range: 5.5, speed: 3.6,
              skill: { name: '물총 발사', type: 'proj', power: 3.0, cd: 7 } },
  jogae:    { name: '조개말랑', stage: 1, elems: ['water'], role: 'tank',
              hp: 90, atk: 6, range: 1.5, speed: 2.8,
              skill: { name: '껍데기 막기', type: 'guard', power: 0.5, cd: 12, dur: 5 } },
  saessak:  { name: '새싹버섯', stage: 1, elems: ['grass'], role: 'healer',
              hp: 55, atk: 5, range: 4.5, speed: 3.0,
              skill: { name: '포자 치유', type: 'heal', power: 0.3, cd: 10 } },
  ggulbeol: { name: '꿀벌솜', stage: 1, elems: ['grass'], role: 'ranged',
              hp: 46, atk: 8, range: 5.5, speed: 3.8,
              skill: { name: '꿀침', type: 'slow', power: 2.2, cd: 8, dur: 4 } },

  bulkkot:  { name: '불꽃냥', stage: 2, elems: ['fire'], role: 'aoe',
              hp: 80, atk: 13, range: 1.8, speed: 3.6,
              skill: { name: '불꽃 회오리', type: 'aoe', power: 2.6, cd: 9, radius: 3 } },
  pado:     { name: '파도펭귄', stage: 2, elems: ['water'], role: 'tank',
              hp: 130, atk: 9, range: 1.6, speed: 3.0,
              skill: { name: '파도 밀치기', type: 'aoe', power: 2.0, cd: 10, radius: 3.2 } },
  supgom:   { name: '숲곰', stage: 2, elems: ['grass'], role: 'healer',
              hp: 110, atk: 9, range: 1.6, speed: 3.0,
              skill: { name: '숲의 포옹', type: 'heal', power: 0.45, cd: 11 } },
  gimmung:  { name: '김뭉게', stage: 2, elems: ['fire', 'water'], role: 'ranged',
              hp: 72, atk: 12, range: 6, speed: 3.4,
              skill: { name: '증기 안개', type: 'slow', power: 2.6, cd: 9, dur: 5, radius: 3 } },
  hwabun:   { name: '화분여우', stage: 2, elems: ['fire', 'grass'], role: 'melee',
              hp: 84, atk: 14, range: 1.6, speed: 4.0,
              skill: { name: '꽃불 할퀴기', type: 'strike', power: 3.6, cd: 7 } },
  ikki:     { name: '이끼거북', stage: 2, elems: ['water', 'grass'], role: 'tank',
              hp: 140, atk: 8, range: 1.6, speed: 2.6,
              skill: { name: '연잎 방패', type: 'shield', power: 0.5, cd: 14, dur: 6 } },

  // 달빛 버섯숲 1단계
  banjjak:  { name: '반짝반디', stage: 1, elems: ['fire'], role: 'ranged',
              hp: 52, atk: 9, range: 5.5, speed: 3.8,
              skill: { name: '반딧불 폭죽', type: 'aoe', power: 2.2, cd: 8, radius: 2.6 } },
  iseul:    { name: '이슬달팽', stage: 1, elems: ['water'], role: 'tank',
              hp: 95, atk: 6, range: 1.5, speed: 2.4,
              skill: { name: '이슬 방울막', type: 'shield', power: 0.5, cd: 13, dur: 5 } },
  dotori:   { name: '도토리다람', stage: 1, elems: ['grass'], role: 'melee',
              hp: 60, atk: 10, range: 1.5, speed: 4.2,
              skill: { name: '도토리 던지기', type: 'proj', power: 3.2, cd: 7 } },

  // 3단계 (2단계끼리 섞기, Lv15 이상)
  haenim:   { name: '해님사자', stage: 3, elems: ['fire'], role: 'aoe',
              hp: 170, atk: 21, range: 1.9, speed: 3.8,
              skill: { name: '해님 폭발', type: 'aoe', power: 3.4, cd: 9, radius: 3.6 } },
  gorae:    { name: '구름고래', stage: 3, elems: ['water'], role: 'tank',
              hp: 240, atk: 13, range: 1.9, speed: 3.0,
              skill: { name: '고래 분수', type: 'heal', power: 0.5, cd: 11 } },
  saseum:   { name: '숲사슴', stage: 3, elems: ['grass'], role: 'healer',
              hp: 190, atk: 15, range: 4.5, speed: 3.6,
              skill: { name: '숲의 축복', type: 'heal', power: 0.6, cd: 11 } },
  unicorn:  { name: '무지개유니콘', stage: 3, elems: ['fire', 'water', 'grass'], role: 'ranged',
              hp: 200, atk: 22, range: 6, speed: 4.2,
              skill: { name: '무지개 빛', type: 'aoe', power: 3.0, cd: 9, radius: 4 } },
};

export const DEX_ORDER = ['bulssi', 'hotteok', 'mulbang', 'jogae', 'saessak', 'ggulbeol',
  'banjjak', 'iseul', 'dotori',
  'bulkkot', 'pado', 'supgom', 'gimmung', 'hwabun', 'ikki',
  'haenim', 'gorae', 'saseum', 'unicorn'];

// 조합: 정확한 짝 먼저, 없으면 속성 짝으로
const EXACT = {
  'bulssi+hotteok': 'bulkkot',
  'jogae+mulbang': 'pado',
  'ggulbeol+saessak': 'supgom',
  // 3단계
  'bulkkot+hwabun': 'haenim', 'bulkkot+gimmung': 'haenim',
  'gimmung+pado': 'gorae', 'ikki+pado': 'gorae',
  'hwabun+supgom': 'saseum', 'ikki+supgom': 'saseum',
  'bulkkot+pado': 'unicorn', 'bulkkot+supgom': 'unicorn', 'pado+supgom': 'unicorn',
};
const BY_ELEM = {
  'fire+water': 'gimmung',
  'fire+grass': 'hwabun',
  'grass+water': 'ikki',
};

export function mixResult(spA, spB) {
  if (spA === spB) return spA; // 같은 종 → 같은 종 (반짝이 확률 업)
  const key = [spA, spB].sort().join('+');
  if (EXACT[key]) return EXACT[key];
  const a = SPECIES[spA], b = SPECIES[spB];
  if (a.stage === 1 && b.stage === 1) {
    const ek = [a.elems[0], b.elems[0]].sort().join('+');
    if (BY_ELEM[ek]) return BY_ELEM[ek];
  }
  return null; // 아직 없는 조합 (3단계는 업데이트로 추가)
}

export const MIX_COST = 10;      // 반짝가루
export const MIX_MIN_LV = 10;    // 재료 최소 레벨
export const MIX_MIN_LV3 = 15;   // 3단계 재료 최소 레벨
export function mixMinLv(spA, spB) { return Math.max(SPECIES[spA].stage, SPECIES[spB].stage) >= 2 ? MIX_MIN_LV3 : MIX_MIN_LV; }
export const BOX_MAX = 20;       // 보관함 칸
export const MAX_LV = 30;

export function expToNext(lv) { return Math.round(14 + lv * lv * 2.2); }

// 맵 구역 (x,z 평면). 마을이 가운데, 들판은 동쪽, 호숫가는 북쪽.
export const ZONES = [
  { id: 'village', name: '솥단지 마을', x: 0, z: 0, r: 13, safe: true },
  { id: 'field', name: '말랑 들판', x: 34, z: 6, r: 20, lv: [1, 8],
    spawns: ['bulssi', 'hotteok', 'saessak', 'ggulbeol'], count: 11 },
  { id: 'lake', name: '물방울 호숫가', x: 4, z: -38, r: 20, lv: [6, 15],
    spawns: ['mulbang', 'jogae', 'saessak'], count: 10 },
  { id: 'moon', name: '달빛 버섯숲', x: -46, z: -16, r: 20, lv: [14, 24],
    spawns: ['banjjak', 'banjjak', 'iseul', 'iseul', 'dotori', 'dotori', 'bulkkot', 'pado', 'supgom'], count: 12 },
];

export const CAPTURE_RATE = 0.10;      // 기획서 기본 확률
export const CAPTURE_RATE_NEW = 0.25;  // 도감에 없는 몽글이는 조금 더 잘 잡힘

// 처음 하는 사람을 위한 할 일 (차례대로)
export const QUESTS = [
  { text: '말랑 들판으로 가 보기', to: { x: 26, z: 5 }, done: (s, g) => g.lastZone?.id === 'field' },
  { text: '야생 몽글이 3마리 쓰러뜨리기', count: s => [Math.min(3, s.kills || 0), 3], done: s => (s.kills || 0) >= 3 },
  { text: '새 친구 사귀기 (쓰러뜨리면 가끔 친구가 돼요)', done: s => s.monggles.length >= 3 || Object.keys(s.dex).length >= 3 },
  { text: '몽글이 한 마리를 Lv10까지 키우기', count: s => [Math.min(10, Math.max(...s.monggles.map(m => m.lv))), 10], done: s => s.monggles.some(m => m.lv >= 10) },
  { text: '믹스 솥에서 두 마리 섞어 보기', to: { x: 0, z: 1 }, done: s => (s.mixes || 0) >= 1 },
  { text: '물방울 호숫가에서 물 몽글이 만나기', to: { x: 6, z: -32 }, done: s => s.dex.mulbang || s.dex.jogae },
  { text: '대왕버섯 물리치기 (들판 동쪽 끝)', to: 'boss', done: s => (s.bossKills || 0) >= 1 },
  { text: '서쪽 달빛 버섯숲 가 보기 (Lv14 이상 추천)', to: { x: -30, z: -12 }, done: (s, g) => g.lastZone?.id === 'moon' },
  { text: '2단계 몽글이 둘을 섞어 3단계 만들기 (Lv15 둘)', done: s => ['haenim', 'gorae', 'saseum', 'unicorn'].some(k => s.dex[k]) },
  { text: '무지개유니콘 만나기', done: s => !!s.dex.unicorn },
  { text: '도감 모두 채우기', count: s => [Object.keys(s.dex).length, DEX_ORDER.length], done: s => Object.keys(s.dex).length >= DEX_ORDER.length },
];
export const QUEST_REWARD = 10;

// 주인공 직업
export const JOBS = {
  warrior: { name: '전사', icon: '⚔️', desc: '검으로 가까이서 싸워요. 체력이 튼튼해요.', hp: 1.3, atk: 1.15, range: 1.8, cd: 0.75, style: 'swing',
    skill: { name: '회오리 베기', type: 'spin', power: 2.4, radius: 2.8, cd: 8 } },
  archer: { name: '궁수', icon: '🏹', desc: '활로 멀리서 빠르게 쏴요.', hp: 0.95, atk: 0.95, range: 6, cd: 0.6, style: 'shoot', proj: 'arrow',
    skill: { name: '화살비', type: 'rain', power: 1.9, radius: 3, cd: 9 } },
  mage: { name: '법사', icon: '🪄', desc: '마법 별탄으로 멀리서 세게 때려요.', hp: 0.9, atk: 1.25, range: 5, cd: 0.9, style: 'cast', proj: 'star',
    skill: { name: '별똥별', type: 'meteor', power: 3.6, radius: 2.4, cd: 9 } },
  thief: { name: '도적', icon: '🗡️', desc: '단검으로 아주 빠르게 찔러요. 가끔 치명타!', hp: 1.0, atk: 0.8, range: 1.6, cd: 0.42, style: 'swing', crit: 0.25,
    skill: { name: '그림자 찌르기', type: 'dash', power: 3.4, cd: 7 } },
  pirate: { name: '해적', icon: '🏴‍☠️', desc: '권총으로 중간 거리에서 탕탕 쏴요.', hp: 1.1, atk: 1.05, range: 4.2, cd: 0.7, style: 'shoot', proj: 'bullet',
    skill: { name: '대포 쾅', type: 'cannon', power: 3.0, radius: 3, cd: 10 } },
};

// 마을 상점
export const SHOP = [
  { id: 'potion', name: '체력 물약', icon: '🧪', price: 5, desc: '주인공과 몽글이 체력을 절반 채워요' },
  { id: 'candy', name: '친구 사탕', icon: '🍬', price: 12, desc: '1분 동안 친구가 될 확률이 2배! (바로 먹어요)' },
];

// 장비 (무기·옷·목걸이)
export const TIERS = [
  { name: '보통', color: '#9a8fb0', mult: 1 },
  { name: '고급', color: '#3fbf5f', mult: 1.5 },
  { name: '희귀', color: '#3f8fff', mult: 2.2 },
  { name: '전설', color: '#b04fff', mult: 3.2 },
];
export const EQUIP = {
  weapon: { name: '무기', icon: '🗡️', prefix: ['나무', '반짝 철', '별빛', '무지개'] },
  armor: { name: '옷', icon: '👕', prefix: ['포근한', '단단한', '구름', '무지개'] },
  charm: { name: '목걸이', icon: '📿', prefix: ['도토리', '조개', '달빛', '무지개'] },
};
export const ENHANCE_RATE = [0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]; // +1 ~ +10
export const enhanceCost = it => 5 * (it.plus + 1) * (it.tier + 1);
export const INV_MAX = 30;

export function rollEquip(lv, boss = false) {
  const r = Math.random() + (boss ? 0.35 : 0);
  const tier = r > 0.99 ? 3 : r > 0.92 ? 2 : r > 0.7 ? 1 : 0;
  const types = Object.keys(EQUIP), type = types[Math.floor(Math.random() * types.length)];
  const m = TIERS[tier].mult;
  const it = { type, tier, lv, plus: 0, name: `${EQUIP[type].prefix[tier]} ${EQUIP[type].name}` };
  if (type === 'weapon') it.atk = Math.round((2 + lv * 0.6) * m);
  if (type === 'armor') it.hp = Math.round((10 + lv * 4) * m);
  if (type === 'charm') { it.atk = Math.round((1 + lv * 0.25) * m); it.hp = Math.round((5 + lv * 1.5) * m); }
  return it;
}
export function itemStat(it) {
  const k = 1 + it.plus * 0.1;
  return { atk: Math.round((it.atk || 0) * k), hp: Math.round((it.hp || 0) * k) };
}
export function equipBonus(s) {
  const b = { atk: 0, hp: 0 };
  for (const id of Object.values(s.eq || {})) {
    const it = (s.inv || []).find(x => x.id === id);
    if (it) { const st = itemStat(it); b.atk += st.atk; b.hp += st.hp; }
  }
  return b;
}
