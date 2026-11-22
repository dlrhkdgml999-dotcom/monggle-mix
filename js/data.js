// 몽글믹스 — 게임 데이터 (몽글이, 조합표, 맵)
// 새 몽글이·조합·맵을 더할 때는 이 파일만 고치면 된다.

export const ELEM = {
  fire:  { name: '불', color: '#ff7a59', icon: '🔥' },
  water: { name: '물', color: '#4fb3ff', icon: '💧' },
  grass: { name: '풀', color: '#5ccf6b', icon: '🌿' },
  earth: { name: '땅', color: '#c8955a', icon: '🪨' },
  wind:  { name: '바람', color: '#6fd6c6', icon: '🍃' },
};
export const ELEM_ORDER = ['fire', 'water', 'grass', 'earth', 'wind'];

// 상성 (화살표 방향이 1.5배): 불 → 풀 → 땅 → 바람 → 물 → 불
export const BEATS = { fire: 'grass', grass: 'earth', earth: 'wind', wind: 'water', water: 'fire' };

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

  // ---- 땅·바람 1단계 ----
  moraedu:  { name: '모래두더지', stage: 1, elems: ['earth'], role: 'melee',
              hp: 62, atk: 9, range: 1.5, speed: 3.4,
              skill: { name: '땅굴 박치기', type: 'strike', power: 3.0, cd: 7 } },
  jinheuk:  { name: '진흙개굴', stage: 1, elems: ['earth'], role: 'ranged',
              hp: 52, atk: 8, range: 5.5, speed: 3.2,
              skill: { name: '진흙 공', type: 'slow', power: 2.2, cd: 8, dur: 4 } },
  bawikong: { name: '바위콩', stage: 1, elems: ['earth'], role: 'tank',
              hp: 96, atk: 6, range: 1.5, speed: 2.6,
              skill: { name: '단단 바위', type: 'guard', power: 0.5, cd: 12, dur: 5 } },
  somteol:  { name: '솜털새', stage: 1, elems: ['wind'], role: 'ranged',
              hp: 46, atk: 9, range: 5.5, speed: 4.0,
              skill: { name: '깃털 화살', type: 'proj', power: 3.1, cd: 7 } },
  mindle:   { name: '민들레솜', stage: 1, elems: ['wind'], role: 'healer',
              hp: 52, atk: 5, range: 4.5, speed: 3.4,
              skill: { name: '솜털 바람', type: 'heal', power: 0.3, cd: 10 } },
  mungeyang:{ name: '뭉게양', stage: 1, elems: ['wind'], role: 'tank',
              hp: 92, atk: 6, range: 1.5, speed: 2.8,
              skill: { name: '폭신 구름막', type: 'shield', power: 0.5, cd: 13, dur: 5 } },

  // ---- 2단계 (새 속성 짝) ----
  gongbeol: { name: '데굴공벌레', stage: 2, elems: ['earth'], role: 'tank',
              hp: 140, atk: 9, range: 1.6, speed: 3.0,
              skill: { name: '데굴데굴 구르기', type: 'aoe', power: 2.0, cd: 10, radius: 3 } },
  bueong:   { name: '바람부엉', stage: 2, elems: ['wind'], role: 'ranged',
              hp: 76, atk: 13, range: 6, speed: 3.8,
              skill: { name: '회오리 날개', type: 'aoe', power: 2.4, cd: 9, radius: 2.8 } },
  magma:    { name: '용암도롱', stage: 2, elems: ['fire', 'earth'], role: 'melee',
              hp: 92, atk: 14, range: 1.6, speed: 3.6,
              skill: { name: '용암 꼬리', type: 'strike', power: 3.6, cd: 7 } },
  bulsae:   { name: '아기불새', stage: 2, elems: ['fire', 'wind'], role: 'ranged',
              hp: 74, atk: 13, range: 6, speed: 4.2,
              skill: { name: '불꽃 깃털', type: 'proj', power: 3.4, cd: 7 } },
  hama:     { name: '진흙하마', stage: 2, elems: ['water', 'earth'], role: 'tank',
              hp: 150, atk: 8, range: 1.6, speed: 2.6,
              skill: { name: '진흙 목욕', type: 'shield', power: 0.5, cd: 14, dur: 6 } },
  dolgorae: { name: '물보라돌고래', stage: 2, elems: ['water', 'wind'], role: 'ranged',
              hp: 78, atk: 12, range: 6, speed: 4.0,
              skill: { name: '물보라 바람', type: 'slow', power: 2.6, cd: 9, dur: 5, radius: 3 } },
  metdwaeji:{ name: '도토리멧돼지', stage: 2, elems: ['grass', 'earth'], role: 'melee',
              hp: 100, atk: 14, range: 1.6, speed: 3.8,
              skill: { name: '돌진', type: 'strike', power: 3.8, cd: 8 } },
  kkotnabi: { name: '꽃나비', stage: 2, elems: ['grass', 'wind'], role: 'healer',
              hp: 84, atk: 10, range: 4.5, speed: 4.0,
              skill: { name: '꽃가루 바람', type: 'heal', power: 0.42, cd: 11 } },
  nakta:    { name: '모래바람낙타', stage: 2, elems: ['earth', 'wind'], role: 'aoe',
              hp: 110, atk: 12, range: 1.8, speed: 3.4,
              skill: { name: '모래 폭풍', type: 'slow', power: 2.4, cd: 9, dur: 4, radius: 3.2 } },
  // 숨은 조합
  byeolnyang:{ name: '별빛고양이', stage: 2, secret: true, elems: ['fire', 'wind'], role: 'ranged',
              hp: 82, atk: 15, range: 6, speed: 4.2,
              skill: { name: '별가루 펀치', type: 'aoe', power: 2.6, cd: 8, radius: 3 } },
  daltokki: { name: '달토끼', stage: 2, secret: true, elems: ['water', 'wind'], role: 'healer',
              hp: 92, atk: 11, range: 4.5, speed: 4.2,
              skill: { name: '달빛 떡', type: 'heal', power: 0.48, cd: 11 } },

  // ---- 3단계 (새) ----
  golem:    { name: '바위골렘', stage: 3, elems: ['earth'], role: 'tank',
              hp: 260, atk: 14, range: 1.9, speed: 2.8,
              skill: { name: '땅 울림', type: 'aoe', power: 2.8, cd: 10, radius: 3.6 } },
  pokpung:  { name: '폭풍독수리', stage: 3, elems: ['wind'], role: 'ranged',
              hp: 170, atk: 22, range: 6.5, speed: 4.4,
              skill: { name: '폭풍 다이브', type: 'strike', power: 4.2, cd: 8 } },
  girin:    { name: '번개기린', stage: 3, elems: ['wind', 'fire'], role: 'aoe',
              hp: 190, atk: 21, range: 2, speed: 4.0,
              skill: { name: '번개 쾅', type: 'aoe', power: 3.2, cd: 9, radius: 3.4 } },
  namu:     { name: '할아버지나무', stage: 3, elems: ['grass', 'earth'], role: 'healer',
              hp: 250, atk: 13, range: 4.5, speed: 2.8,
              skill: { name: '나무 그늘', type: 'heal', power: 0.6, cd: 12 } },
  yongam:   { name: '용암거북', stage: 3, elems: ['earth', 'fire'], role: 'tank',
              hp: 270, atk: 15, range: 1.9, speed: 2.6,
              skill: { name: '화산 등껍질', type: 'shield', power: 0.55, cd: 14, dur: 7 } },
  kkulgom:  { name: '꿀곰', stage: 3, secret: true, elems: ['grass', 'wind'], role: 'healer',
              hp: 240, atk: 17, range: 1.9, speed: 3.4,
              skill: { name: '꿀단지 파티', type: 'love', power: 0.45, buff: 5, cd: 12 } },

  // ---- 4단계 전설 (3단계끼리, Lv22) ----
  phoenix:  { name: '불사조', stage: 4, elems: ['fire'], role: 'aoe',
              hp: 320, atk: 34, range: 6, speed: 4.6,
              skill: { name: '불사의 날개', type: 'aoe', power: 3.8, cd: 9, radius: 4.2 } },
  mulyong:  { name: '물빛용', stage: 4, elems: ['water'], role: 'ranged',
              hp: 340, atk: 31, range: 6.5, speed: 4.2,
              skill: { name: '물빛 숨결', type: 'slow', power: 3.4, cd: 9, dur: 5, radius: 4 } },
  kkotjeong:{ name: '꽃의 정령', stage: 4, elems: ['grass'], role: 'healer',
              hp: 330, atk: 26, range: 5, speed: 4.2,
              skill: { name: '봄날의 노래', type: 'love', power: 0.6, buff: 6, dmg: 2.6, radius: 4, cd: 11 } },
  daeji:    { name: '대지거북', stage: 4, elems: ['earth'], role: 'tank',
              hp: 460, atk: 24, range: 2, speed: 2.8,
              skill: { name: '산을 짊어진 등', type: 'shield', power: 0.65, cd: 13, dur: 8 } },
  cheondung:{ name: '천둥새', stage: 4, elems: ['wind'], role: 'aoe',
              hp: 310, atk: 35, range: 6, speed: 4.8,
              skill: { name: '천둥 번개', type: 'aoe', power: 4.0, cd: 9, radius: 4.2 } },

  // ---- 5단계 (전설끼리, Lv28) ----
  dragon:   { name: '무지개드래곤', stage: 5, elems: ['fire', 'water', 'grass', 'earth', 'wind'], role: 'aoe',
              hp: 480, atk: 46, range: 6, speed: 4.8,
              skill: { name: '무지개 브레스', type: 'aoe', power: 4.4, cd: 9, radius: 4.8 } },

  // 💞 둘이 섞기로만 태어나는 커플 몽글이 (couple: true)
  // love: 파티 체력 회복 + 공격력 응원(buff초), dmg가 있으면 대상 주변 범위 공격도
  heartmong: { name: '하트몽글', stage: 2, couple: true, elems: ['fire', 'water', 'grass'], role: 'healer',
              hp: 105, atk: 11, range: 4.5, speed: 3.8,
              skill: { name: '두근두근 하트', type: 'love', power: 0.3, buff: 4, cd: 11 } },
  heartangel: { name: '하트천사', stage: 3, couple: true, elems: ['fire', 'water', 'grass'], role: 'healer',
              hp: 210, atk: 19, range: 5, speed: 4.2,
              skill: { name: '사랑의 별비', type: 'love', power: 0.45, buff: 6, dmg: 2.6, radius: 3.6, cd: 11 } },
};

export const DEX_ORDER = ['bulssi', 'hotteok', 'mulbang', 'jogae', 'saessak', 'ggulbeol',
  'banjjak', 'iseul', 'dotori', 'moraedu', 'jinheuk', 'bawikong', 'somteol', 'mindle', 'mungeyang',
  'bulkkot', 'pado', 'supgom', 'gimmung', 'hwabun', 'ikki',
  'gongbeol', 'bueong', 'magma', 'bulsae', 'hama', 'dolgorae', 'metdwaeji', 'kkotnabi', 'nakta', 'byeolnyang', 'daltokki',
  'haenim', 'gorae', 'saseum', 'unicorn', 'golem', 'pokpung', 'girin', 'namu', 'yongam', 'kkulgom',
  'phoenix', 'mulyong', 'kkotjeong', 'daeji', 'cheondung',
  'dragon',
  'heartmong', 'heartangel'];

// 조합 규칙 (믹스마스터처럼 단계가 이어지는 나무)
// 1) 같은 종 → 같은 종 (반짝이 확률 업)
// 2) 정해진 짝(EXACT, 숨은 조합 포함)
// 3) 그 밖에는 '낮은 쪽 단계 + 1' 단계에서 두 몽글이의 대표 속성(elems[0]) 짝으로 정한다
export const EXACT = {
  'bulssi+hotteok': 'bulkkot',
  'jogae+mulbang': 'pado',
  'ggulbeol+saessak': 'supgom',
  // 3단계 (예전 조합 그대로)
  'bulkkot+hwabun': 'haenim', 'bulkkot+gimmung': 'haenim',
  'gimmung+pado': 'gorae', 'ikki+pado': 'gorae',
  'hwabun+supgom': 'saseum', 'ikki+supgom': 'saseum',
  'bulkkot+pado': 'unicorn', 'bulkkot+supgom': 'unicorn', 'pado+supgom': 'unicorn',
  // 숨은 조합
  'banjjak+hotteok': 'byeolnyang',
  'iseul+mulbang': 'daltokki',
  'kkotnabi+supgom': 'kkulgom',
};
const pairKey = (a, b) => [a, b].sort().join('+');
// 단계별 속성 짝 표 (키는 속성 이름을 가나다 아닌 영문 정렬)
const TIER = {
  2: { 'fire+fire': 'bulkkot', 'water+water': 'pado', 'grass+grass': 'supgom', 'earth+earth': 'gongbeol', 'wind+wind': 'bueong',
       'fire+water': 'gimmung', 'fire+grass': 'hwabun', 'grass+water': 'ikki', 'earth+fire': 'magma', 'fire+wind': 'bulsae',
       'earth+water': 'hama', 'water+wind': 'dolgorae', 'earth+grass': 'metdwaeji', 'grass+wind': 'kkotnabi', 'earth+wind': 'nakta' },
  3: { 'fire+fire': 'haenim', 'water+water': 'gorae', 'grass+grass': 'saseum', 'earth+earth': 'golem', 'wind+wind': 'pokpung',
       'fire+water': 'unicorn', 'fire+grass': 'unicorn', 'grass+water': 'unicorn', 'fire+wind': 'girin', 'water+wind': 'girin',
       'earth+grass': 'namu', 'grass+wind': 'namu', 'earth+fire': 'yongam', 'earth+water': 'yongam', 'earth+wind': 'golem' },
  4: { 'fire+fire': 'phoenix', 'water+water': 'mulyong', 'grass+grass': 'kkotjeong', 'earth+earth': 'daeji', 'wind+wind': 'cheondung',
       'fire+grass': 'phoenix', 'earth+grass': 'kkotjeong', 'earth+wind': 'daeji', 'water+wind': 'cheondung', 'fire+water': 'mulyong',
       'earth+fire': 'phoenix', 'fire+wind': 'cheondung', 'grass+water': 'mulyong', 'earth+water': 'daeji', 'grass+wind': 'kkotjeong' },
};

export function mixResult(spA, spB) {
  const a = SPECIES[spA], b = SPECIES[spB];
  if (!a || !b || a.couple || b.couple) return null; // 하트는 💞 둘이 섞기에서만
  if (spA === spB) return spA; // 같은 종 → 같은 종 (반짝이 확률 업)
  const key = pairKey(spA, spB);
  if (EXACT[key]) return EXACT[key];
  const st = Math.min(a.stage, b.stage) + 1;
  if (st >= 5) return 'dragon';
  return TIER[st]?.[pairKey(a.elems[0], b.elems[0])] || null;
}

// 결과 단계별 재료 최소 레벨
const LV_REQ = { 1: 10, 2: 10, 3: 15, 4: 22, 5: 28 };
export const MIX_MIN_LV = 10;    // 재료 최소 레벨
export const MIX_MIN_LV3 = 15;   // 3단계 재료 최소 레벨
export function mixMinLv(spA, spB) {
  const r = mixResult(spA, spB);
  return LV_REQ[r ? SPECIES[r].stage : 2];
}

// 도감에서 보여 줄 '이렇게 태어나요'
export function recipesFor(sp) {
  const S = SPECIES[sp]; if (!S) return [];
  const out = [];
  for (const [k, v] of Object.entries(EXACT)) if (v === sp) out.push({ exact: k.split('+'), secret: !!S.secret });
  if (S.stage === 5) out.push({ text: '4단계 전설 두 마리 (서로 다른 전설)' });
  const t = TIER[S.stage];
  if (t) for (const [k, v] of Object.entries(t)) if (v === sp) out.push({ elems: k.split('+'), stage: S.stage - 1 });
  return out;
}

export const MIX_COST = 10;      // 반짝가루
// 💞 둘이 섞기: 광희·하은이 한 마리씩 넣으면 둘 다 같은 아기를 하나씩 받는다.
// 1단계끼리 → 하트몽글, 2단계 이상이 하나라도 있으면 → 하트천사
export function coupleResult(spA, spB) {
  return Math.max(SPECIES[spA].stage, SPECIES[spB].stage) >= 2 ? 'heartangel' : 'heartmong';
}
export const COUPLE_SHINY = 0.1; // 둘이 섞으면 반짝이 확률 10% (둘 다 같이 반짝이)

// 물려받은 기술: 몽글이가 알아서 쓴다 (원래 기술보다 조금 약하고 느리게)
export const INH_POWER = 0.8;
export const INH_CD = 1.4;

export const BOX_MAX = 20;       // 보관함 칸
export const CORE_MAX = 60;      // 💎 코어 보관함 칸
export const CORE_RATE = 0.05;   // 몬스터가 코어를 떨어뜨릴 확률
export const BOSS_CORES = ['bulkkot', 'pado', 'supgom', 'gongbeol', 'bueong']; // 보스는 2단계 코어를 꼭 줘요
export const coreDust = c => 2 + SPECIES[c.sp].stage * 3; // 코어를 반짝가루로 바꾸면
export const MAX_LV = 40;       // 주인공 최대 레벨
export const PET_MAX_LV = 50;   // 몽글이 최대 레벨
export const STAT_PER_LV = 3;   // 주인공 레벨업마다 능력치 점수


export function expToNext(lv) { return Math.round(14 + lv * lv * 2.2); }

// 맵 구역 (x,z 평면). 마을이 가운데, 들판은 동쪽, 호숫가는 북쪽.
export const ZONES = [
  { id: 'village', name: '솥단지 마을', x: 0, z: 0, r: 13, safe: true },
  { id: 'field', name: '말랑 들판', x: 34, z: 6, r: 20, lv: [1, 8],
    spawns: ['bulssi', 'hotteok', 'saessak', 'ggulbeol', 'moraedu', 'somteol'], count: 12 },
  { id: 'lake', name: '물방울 호숫가', x: 4, z: -38, r: 20, lv: [6, 15],
    spawns: ['mulbang', 'jogae', 'saessak', 'jinheuk', 'mindle', 'bawikong'], count: 12 },
  { id: 'moon', name: '달빛 버섯숲', x: -46, z: -16, r: 20, lv: [14, 24],
    spawns: ['banjjak', 'banjjak', 'iseul', 'iseul', 'dotori', 'dotori', 'mungeyang', 'mungeyang', 'bulkkot', 'pado', 'supgom', 'gongbeol', 'bueong'], count: 14 },
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
  { text: '2단계 몽글이 둘을 섞어 3단계 만들기 (Lv15 둘)', done: s => Object.keys(s.dex).some(k => SPECIES[k]?.stage === 3 && !SPECIES[k].couple) },
  { text: '몬스터를 쓰러뜨려 💎 코어 얻기', done: s => (s.coresGot || 0) >= 1 },
  { text: '무지개유니콘 만나기', done: s => !!s.dex.unicorn },
  { text: '3단계 둘을 섞어 4단계 전설 만나기 (Lv22 둘)', done: s => Object.keys(s.dex).some(k => SPECIES[k]?.stage === 4) },
  { text: '믹스 솥 💞 둘이 섞기로 하트몽글 만나기', to: { x: 0, z: 1 }, done: s => !!(s.dex.heartmong || s.dex.heartangel) },
  { text: '전설 둘을 섞어 무지개드래곤 만나기 (Lv28 둘)', done: s => !!s.dex.dragon },
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
