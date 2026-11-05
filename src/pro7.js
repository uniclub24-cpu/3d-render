/* ================================================================
   v10 · 페리카나 프리셋 (FRANCHISE INTERIOR NEW CONCEPT DESIGN MANUAL 2025.01 기준)
   AI 호출 없이 규칙으로 배치: 마감 → 필수 주방 → 카운터 → 조명·에어컨 → 벽 디자인 → 테이블·의자
   ================================================================ */
// 매뉴얼 기물 (없던 것만 추가)
[
  { id: 'menuboard', name: '디지털 메뉴보드 49"', cat: '인테리어', shape: 'box', w: 1080, d: 90, h: 610, elev: 2000, layer: 'upper', color: '#111111', mat: 'gloss', kw: 0.15 },
  { id: 'domemirror', name: '돔 반사경 500Ø', cat: '인테리어', shape: 'disc', w: 500, d: 140, h: 500, elev: 1350, layer: 'upper', color: '#d4d8dc', mat: 'steel' },
  { id: 'neonband', name: '장식 띠장 (네온)', cat: '인테리어', shape: 'cube', w: 2400, d: 40, h: 70, elev: 2150, layer: 'upper', color: '#ac0610', mat: 'gloss' },
  { id: 'mainsign', name: '메인 간판', cat: '인테리어', shape: 'cube', w: 6000, d: 300, h: 900, elev: 2750, layer: 'upper', color: '#ffffff', mat: 'gloss', kw: 0.4 },
  { id: 'beer', name: '생맥주 머신', cat: '주방', shape: 'box', w: 450, d: 550, h: 900, layer: 'floor', color: '#c9ced4', mat: 'steel', kw: 0.5 },
  { id: 'metalframe', name: '금속 프레임 (기둥)', cat: '인테리어', shape: 'cube', w: 60, d: 60, h: 2700, layer: 'deco', color: '#bababa', mat: 'steel' },
].forEach((x) => { if (!LIB.find((l) => l.id === x.id)) LIB.push(x); });

const PELI = { // 매뉴얼에서 옮긴 값 (코드 · 색 · 규격)
  color: { main: '#ac0610', sub1: '#e75429', sub2: '#151418' },
  fin: { hallWall: ['paint', '#fbfaf6', 'PT-01 SH 2001 B (스노우 화이트)'], panel: ['wood', '#6e503a', 'LT-01 N703 벽패널 (효산 LPL)'], kitchenWall: ['tile', '#efefef', 'TL-04 0100 400×250 (아주타일)'],
    hallFloor: ['tile', '#b09578', 'TL-01 GRA-66843SL 600각'], hallFloor2: ['tile', '#dad8cb', 'TL-02 BLT-WHITE 600각'], kitchenFloor: ['tile', '#a7a3a2', 'TL-03 227 200각'],
    gate: ['paint', '#931506', 'PT-02 SH 2173 F (포피 레드)'], partition: ['steel', '#bababa', 'MT-01 SUS 헤어라인 금속 프레임 월'], counter: ['gloss', '#8e1c22', 'LT-02 3025 TX (카운터 전면)'],
    cushion: '#a71a17', table: '#14223a', band: '#e5a328', ceiling: '#fbfaf6' },
  chairs: { CH01: ['chair', '#aed3ca', 'CH-01 C-107-100 민트'], CH02: ['chair', '#b5121b', 'CH-02 C-101-110 레드'], CH03: ['chair', '#7f8556', 'CH-03 SC569 그린'], CH04: ['barchair', '#b5121b', 'CH-04 BT-274-110 바체어'] },
};
const PRESETS = {
  hall: { id: 'hall', name: '페리카나 홀 타입', src: '매뉴얼 2025.01 · 02) HALL TYPE', ratio: 0.3, door: ['door2', 1880, 3100], menuboards: 2,
    kitchen: [ // [종류, 가로, 깊이, 높이, 수량, 역할, 우선순위, 이름]
      ['fridge45', 1300, 800, 1900, 1, 'cold', 1, '④ 4구 냉장냉동고'], ['showcase', 650, 585, 1850, 3, 'cold', 3, '⑩ 음료냉장고'], ['tfridge', 900, 700, 850, 1, 'prep', 1, '① 받드 테이블냉장고'], ['tfridge', 1200, 700, 850, 1, 'prep', 2, '② 테이블냉장냉동고'],
      ['work', 800, 700, 850, 1, 'prep', 2, '③ 작업대'], ['range3', 900, 600, 850, 1, 'hot', 1, '④ 3구 테이블렌지'], ['fryer1', 600, 600, 1000, 1, 'hot', 1, '⑤ 1구 튀김기'], ['fryer2', 900, 600, 1000, 1, 'hot', 1, '⑥ 2구 튀김기'],
      ['work', 800, 600, 850, 1, 'hot', 2, '⑦ 작업대'], ['sink1', 600, 600, 850, 1, 'wash', 1, '⑧ 싱크대'], ['dishwasher', 650, 650, 1800, 1, 'wash', 1, '⑪ 식기세척기'], ['sink2', 900, 700, 850, 1, 'wash', 1, '⑫ 세척기 싱크대'],
      ['icemaker', 515, 650, 850, 1, 'store', 3, '⑬ 제빙기'], ['purifier', 350, 450, 1200, 1, 'store', 3, '⑭ 정수기'], ['beer', 450, 550, 900, 1, 'store', 3, '⑮ 생맥주 머신'], ['rack', 900, 450, 1800, 2, 'store', 4, '경량랙'], ['rack', 1200, 450, 1800, 1, 'store', 4, '경량랙'],
    ] },
  delivery: { id: 'delivery', name: '페리카나 배달 타입', src: '매뉴얼 2025.01 · 03) DELIVERY TYPE', ratio: 0.48, door: ['door1', 970, 3000], menuboards: 1,
    kitchen: [
      ['fridge45', 1300, 800, 1900, 1, 'cold', 1, '⑨ 4구 냉장냉동고'], ['showcase', 650, 585, 1850, 2, 'cold', 3, '⑩ 음료냉장고'], ['work', 1200, 600, 850, 2, 'prep', 2, '① 일반 작업대'], ['work2', 1500, 600, 850, 1, 'prep', 2, '② 작업대'],
      ['fryer2', 900, 600, 1000, 1, 'hot', 1, '③ 2구 튀김기'], ['fryer1', 600, 600, 1000, 1, 'hot', 1, '④ 1구 튀김기'], ['work', 700, 600, 850, 1, 'hot', 2, '⑤ 작업대'], ['range3', 900, 600, 850, 1, 'hot', 1, '⑥ 3구 테이블렌지'],
      ['work', 900, 700, 850, 1, 'wash', 2, '⑦ 작업대'], ['sink2', 900, 700, 850, 1, 'wash', 1, '⑧ 싱크대'], ['purifier', 350, 450, 1200, 1, 'store', 3, '⑪ 정수기'], ['beer', 450, 550, 900, 1, 'store', 3, '⑫ 생맥주 머신'],
      ['rack', 1000, 450, 1800, 1, 'store', 4, '⑬ 경량랙'], ['rack', 1400, 450, 1800, 1, 'store', 4, '⑬ 경량랙'], ['dishwasher', 650, 650, 1800, 0, 'wash', 1, '식기세척기 (선택)'],
    ] },
};
const ALT = { fryer2: ['fryer1', 600], tfridge: ['tfridge', 900], work2: ['work', 1200], work: ['work', 600], fridge45: ['fridge25', 700], sink2: ['sink1', 600], rack: ['rack', 900] };

/* ---------- 바닥 2톤 패턴 (매뉴얼: 홀 바닥 2톤 · 센터 기준) ---------- */
{ const _bl = buildLevel; buildLevel = function (active) { _bl(active); const fp = active && P.floorPat; if (!fp || vis.floorL === false) return;
    const [x0, y0, x1, y1] = fp.rect, s = fp.size || 600, cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, T = xf(0, 0, 0);
    for (let i = -Math.ceil((cxm - x0) / s); (cxm + i * s) < x1; i++) for (let j = -Math.ceil((cym - y0) / s); (cym + j * s) < y1; j++) {
      if (((i % 2) + 2) % 2 || ((j % 2) + 2) % 2) continue; const a = Math.max(x0, cxm + i * s - s / 2), b = Math.min(x1, cxm + i * s + s / 2), c = Math.max(y0, cym + j * s - s / 2), d = Math.min(y1, cym + j * s + s / 2);
      if (b - a > 20 && d - c > 20) box(T, a + 2, b - 2, 0, 2, c + 2, d - 2, fp.color2, 'tile'); } }; }

/* ---------- 적용 범위 ---------- */
const PSCOPE = [['finish', '타일 · 벽면 디자인'], ['kitchen', '주방 기물 · 후드 · 배수'], ['tables', '테이블 · 의자'], ['builtin', '붙박이 의자 · 바테이블'], ['counter', '카운터'], ['menu', '메뉴띠 · 메뉴보드'],
  ['lightBase', '조명 · 기본 (직부등 · 평판등)'], ['lightDeco', '조명 · 디자인 (네온 띠장)'], ['pendant', '빈티지 펜던트'], ['mirror', '반사경'], ['deco', '디자인 오브젝트 (금속 프레임)'], ['sign', '사이니지 (간판 · 윈도우 시트 · 출입문 시트)'], ['ac', '에어컨']];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const rng32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/* ---------- 매장 틀 (안쪽 사각형 · 정면 기준 좌표) ---------- */
function presetRect() {
  const ext = exteriorWalls().length ? exteriorWalls() : P.walls; if (!ext.length) return null;
  const xs = ext.flatMap((w) => [w.x1, w.x2]), ys = ext.flatMap((w) => [w.y1, w.y2]), T = (P.wallT || 150) / 2;
  return [Math.min(...xs) + T, Math.min(...ys) + T, Math.max(...xs) - T, Math.max(...ys) - T];
}
function sideNear(R, p) { const d = { N: Math.abs(p[1] - R[1]), S: Math.abs(p[1] - R[3]), W: Math.abs(p[0] - R[0]), E: Math.abs(p[0] - R[2]) }; return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0]; }
function doorOpening() { const ext = new Set(exteriorWalls().map((w) => w.id)); return P.openings.find((o) => o.pz === 'gate') || P.openings.find((o) => ext.has(o.wall) && /door|auto|slide|glass|fold/.test(o.type)); }
function defaultDoor(R) { const o = doorOpening(), g = o && openingGeom(o); return g ? [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2] : [(R[0] + R[2]) / 2, R[3]]; }
function snapSide(R, p) { const s = sideNear(R, p), cl = (v, a, b) => clamp(v, a + 500, b - 500); return s === 'N' ? [cl(p[0], R[0], R[2]), R[1]] : s === 'S' ? [cl(p[0], R[0], R[2]), R[3]] : s === 'W' ? [R[0], cl(p[1], R[1], R[3])] : [R[2], cl(p[1], R[1], R[3])]; }
function kitRect(R, ks, ratio) { const D = ks === 'N' || ks === 'S' ? R[3] - R[1] : R[2] - R[0], kd = clamp(Math.round(D * ratio / 50) * 50, 2600, Math.max(2600, D - 3000));
  return ks === 'N' ? [R[0], R[1], R[2], R[1] + kd] : ks === 'S' ? [R[0], R[3] - kd, R[2], R[3]] : ks === 'W' ? [R[0], R[1], R[0] + kd, R[3]] : [R[2] - kd, R[1], R[2], R[3]]; }
function presetFrame(F, R) {
  R = R || presetRect(); if (!R) return null; const T = (P.wallT || 150) / 2;
  if (!F || F === 'auto') F = sideNear(R, defaultDoor(R));
  const W = F === 'N' || F === 'S' ? R[2] - R[0] : R[3] - R[1], D = F === 'N' || F === 'S' ? R[3] - R[1] : R[2] - R[0];
  const toW = (u, v) => (F === 'S' ? [R[0] + u, R[3] - v] : F === 'N' ? [R[2] - u, R[1] + v] : F === 'W' ? [R[0] + v, R[1] + u] : [R[2] - v, R[3] - u]);
  const fromW = (x, y) => (F === 'S' ? [x - R[0], R[3] - y] : F === 'N' ? [R[2] - x, y - R[1]] : F === 'W' ? [y - R[1], x - R[0]] : [R[3] - y, R[2] - x]);
  const dirW = (du, dv) => { const p0 = toW(0, 0), p1 = toW(du, dv); return [p1[0] - p0[0], p1[1] - p0[1]]; };
  const rotFor = (face) => { const v = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }[face], d = dirW(v[0], v[1]); return Math.round(((Math.atan2(-d[0], d[1]) * 180 / Math.PI) % 360 + 360) % 360); };
  const sideOf = (w) => { const m = [(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2], c = { N: Math.abs(m[1] - R[1] + T), S: Math.abs(m[1] - R[3] - T), W: Math.abs(m[0] - R[0] + T), E: Math.abs(m[0] - R[2] - T) }, k = Object.entries(c).sort((a, b) => a[1] - b[1])[0];
    if (k[1] > 300) return null; const left = { S: 'W', N: 'E', W: 'N', E: 'S' }[F]; return k[0] === F ? 'front' : k[0] === OPP[F] ? 'back' : k[0] === left ? 'left' : 'right'; };
  return { R, F, W, D, T, toW, fromW, rotFor, sideOf };
}

/* ---------- 적용 (opt: kind · ratio · door · kit · scope · seed · counts · windows · clear) ---------- */
function applyPreset(opt) {
  const pr = PRESETS[opt.kind], R = presetRect(); if (!R) { toast('먼저 매장 벽을 그려 주세요'); return null; }
  const rnd = rng32(opt.seed || 1), pick = (a) => a[Math.floor(rnd() * a.length)], on = (k) => !opt.scope || opt.scope.includes(k);
  const rep = { placed: 0, seats: 0, miss: [], note: '' };
  // 출입구 · 주방 방향
  const doorP = snapSide(R, opt.door || defaultDoor(R)), ds = sideNear(R, doorP); let ks = opt.kit ? sideNear(R, opt.kit) : OPP[ds];
  if (ks === ds) { ks = OPP[ds]; rep.note = '주방과 출입구가 같은 벽이라 주방을 맞은편으로 옮겼어요'; }
  const K = presetFrame(OPP[ks], R), { W, D, T, toW, fromW, rotFor, sideOf } = K, add = [];
  const put = (pz, type, u, v, face, o = {}) => { const L = libGet(type), [x, y] = toW(u, v), it = { id: uid('i'), type, x: Math.round(x), y: Math.round(y), w: Math.round(o.w || L.w), d: Math.round(o.d || L.d), rot: rotFor(/chair$/.test(type) ? { front: 'back', back: 'front', left: 'right', right: 'left' }[face] : face), pz }; /* 의자: 등받이가 테이블 반대쪽 */ for (const k of ['h', 'elev', 'color', 'mat', 'tag', 'finish']) if (o[k] != null) it[k] = o[k]; add.push(it); if (!o.mark) rep.placed++; return it; };
  const kd = clamp(Math.round(D * opt.ratio / 50) * 50, 2600, Math.max(2600, D - 3000)), pv = D - kd;
  let [du, dv] = fromW(...doorP); const dsF = dv < 300 ? 'front' : du < 300 ? 'left' : 'right', [dt, dw, dh] = pr.door;
  if (dsF === 'front') du = clamp(du, dw / 2 + 300, W - dw / 2 - 300); else dv = clamp(dv, dw / 2 + 300, Math.max(dw / 2 + 300, pv - dw / 2 - 300));
  const freeSides = ['L', 'R'].filter((q) => !((q === 'L' && dsF === 'left') || (q === 'R' && dsF === 'right'))), bs = pick(freeSides), bu = (x) => (bs === 'L' ? x : W - x), bIn = bs === 'L' ? 'right' : 'left', bOut = bs === 'L' ? 'left' : 'right';
  // 0. 정리 (다시 적용: 고른 범위의 프리셋 기물만 지우고 다시 놓기)
  if (opt.clear) { P.items = P.items.filter((it) => libGet(it.type).shape === 'mark' && !it.pz); P.floorPat = null; }
  else P.items = P.items.filter((it) => !(it.pz && on(it.pz)));
  if (opt.clear || on('finish')) P.floorPat = null;
  const partOld = new Set(P.walls.filter((w) => w.pz === 'part').map((w) => w.id));
  P.walls = P.walls.filter((w) => !partOld.has(w.id)); P.openings = P.openings.filter((o) => !partOld.has(o.wall) && o.pz !== 'win' && P.walls.some((w) => w.id === o.wall));
  if (opt.clear) { const ext = new Set(exteriorWalls().map((w) => w.id)); P.walls = P.walls.filter((w) => ext.has(w.id)); P.openings = P.openings.filter((o) => P.walls.some((w) => w.id === o.wall)); }
  // 1. 벽 나누기 (칸막이 자리) · 마감
  const fin = (k) => ({ type: PELI.fin[k][0], color: PELI.fin[k][1] });
  for (const w of [...P.walls]) {
    const s = sideOf(w); if (s !== 'left' && s !== 'right') continue;
    const a0 = fromW(w.x1, w.y1)[1], b0 = fromW(w.x2, w.y2)[1]; if (Math.min(a0, b0) > pv - 200 || Math.max(a0, b0) < pv + 200) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), at = Math.abs(pv - a0); if (at < 200 || at > L - 200) continue;
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, a = { ...w, id: uid('w'), x2: Math.round(w.x1 + ux * at), y2: Math.round(w.y1 + uy * at), finish: { ...w.finish } }, b = { ...w, id: uid('w'), x1: a.x2, y1: a.y2, finish: { ...w.finish } };
    for (const o of P.openings.filter((q) => q.wall === w.id)) { if (o.t < at) o.wall = a.id; else { o.wall = b.id; o.t -= at; } }
    P.walls.splice(P.walls.indexOf(w), 1, a, b);
  }
  if (on('finish')) for (const w of P.walls) { const s = sideOf(w); if (!s) continue; const mv = fromW((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2)[1];
    w.finish = s === 'back' || mv > pv ? fin('kitchenWall') : (s === 'left' && bs === 'L') || (s === 'right' && bs === 'R') ? fin('panel') : fin('hallWall'); }
  if (on('finish')) { P.floor = fin('hallFloor'); P.ceiling = { ...(P.ceiling || {}), on: true, color: PELI.fin.ceiling, opacity: (P.ceiling && P.ceiling.opacity) || 0.45 }; }
  // 공간 (홀 · 주방) — 바닥 그룹
  { const old = (P.rooms || []).filter((r) => r.pz), keep = (k) => old.find((r) => r.kind === k); P.rooms = (P.rooms || []).filter((r) => !r.pz);
    const rect = (u0, v0, u1, v1) => [toW(u0, v0), toW(u1, v0), toW(u1, v1), toW(u0, v1)].map((p) => p.map(Math.round));
    const hall = { id: uid('r'), pz: 'room', name: '홀', kind: '홀', pts: rect(0, 0, W, pv), finish: on('finish') ? fin('hallFloor') : (keep('홀') || {}).finish || { type: 'tile', color: '#c9c3b8' }, lift: (keep('홀') || {}).lift || 0 };
    if (on('finish')) hall.pattern = { size: 600, color2: PELI.fin.hallFloor2[1] }; else if (keep('홀')) hall.pattern = keep('홀').pattern;
    const kit = { id: uid('r'), pz: 'room', name: '주방', kind: '주방', pts: rect(0, pv, W, D), finish: on('finish') ? fin('kitchenFloor') : (keep('주방') || {}).finish || { type: 'tile', color: '#a7a3a2' }, lift: (keep('주방') || {}).lift || 0, slope: (keep('주방') || {}).slope };
    P.rooms.push(hall, kit); }
  // 칸막이 (금속 프레임 월) · 배식창 · 주방 출입문
  const kdSide = pick(['L', 'R']), kdU = kdSide === 'L' ? 650 : W - 650, cw = clamp(Math.round(W * (pr.id === 'hall' ? 0.36 : 0.5) / 100) * 100, 1500, 3600);
  let cu = W / 2 + pick([0, 0, -1, 1]) * W * 0.12; cu = clamp(cu, cw / 2 + 250, W - cw / 2 - 250); if (Math.abs(cu - kdU) < cw / 2 + 560) cu = kdSide === 'L' ? Math.max(cu, kdU + cw / 2 + 560) : Math.min(cu, kdU - cw / 2 - 560); cu = clamp(cu, cw / 2 + 150, W - cw / 2 - 150);
  const pa = toW(0, pv), pb = toW(W, pv), part = { id: uid('w'), pz: 'part', x1: Math.round(pa[0]), y1: Math.round(pa[1]), x2: Math.round(pb[0]), y2: Math.round(pb[1]), t: 100, finish: fin('partition') }; P.walls.push(part);
  P.openings.push({ id: uid('o'), pz: 'pass', wall: part.id, t: Math.round(cu), type: 'pass', w: cw, h: 1000, sill: 1050, frame: '#bababa' });
  P.openings.push({ id: uid('o'), pz: 'kdoor', wall: part.id, t: Math.round(kdU), type: 'opening', w: 1000, h: 2100, sill: 0, frame: '#bababa' }); /* 주방↔홀 출입구는 문 없이 */
  if (on('deco')) for (let k = 1; k < Math.floor(W / 1100); k++) { const u = k * W / Math.floor(W / 1100); if (Math.abs(u - cu) < cw / 2 + 80 || Math.abs(u - kdU) < 520) continue; put('deco', 'metalframe', u, pv - 95, 'front', { h: P.ceilingH, tag: 'MT-01 금속 프레임' }); }
  // 출입문 (게이트) · 통창 · 간판
  const gp = toW(du, dsF === 'front' ? 0 : dv), gpOut = dsF === 'front' ? [du, -T] : dsF === 'left' ? [-T, dv] : [W + T, dv], gw0 = toW(...gpOut);
  let gwall = null, gt = 0; for (const w of exteriorWalls()) { const [d, t] = distPtSeg(gw0[0], gw0[1], w); if (!gwall || d < gwall.d) gwall = { d, t, w }; }
  if (gwall) {
    const w = gwall.w, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); gt = clamp(gwall.t * L, dw / 2 + 200, L - dw / 2 - 200);
    let gate = doorOpening(); if (gate && (P.walls.find((x) => x.id === gate.wall) || {}).pz === 'part') gate = null;
    if (!gate) { gate = { id: uid('o'), sill: 0 }; P.openings.push(gate); }
    Object.assign(gate, { pz: 'gate', wall: w.id, t: Math.round(gt), type: dt, w: Math.min(dw, L - 600), h: dh, sill: 0, frame: PELI.fin.gate[1] });
    // 정면 (매뉴얼 03 윈도우 시트): 레드 출입문 · 창마다 시트 · 간판 — 모두 따로 선택 · 이동
    const SH = pr.id === 'hall' ? 3100 : 3000, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; if (wallH(w) < SH) w.h = SH; gate.h = SH; gate.fw = 15; /* 매뉴얼 치수: 홀 정면 높이 3100 · 배달 3000 (간판 800은 그 위) */
    let nx = -uy, ny = ux; { const m = [w.x1 + ux * gt, w.y1 + uy * gt], c = toW(W / 2, D / 2); if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny > 0) { nx = -nx; ny = -ny; } }
    const rightS = ux * ny - uy * nx > 0, rot = Math.round(((Math.atan2(-nx, ny) * 180 / Math.PI) % 360 + 360) % 360);
    const FAC = pr.id === 'hall' ? { sign: 'signH', L: ['wH3', 'wH2', 'wH1'], R: ['wH4', 'wH5', 'wH6'], pw: 1010, plain: 'wH5', door: 'doorH' } : { sign: 'signD', L: ['wD3', 'wD2', 'wD1'], R: ['wD1', 'wD2', 'wD3'], pw: 1090, plain: 'wD2', door: 'doorD' };
    const gw2 = gate.w / 2;
    if (opt.windows && !P.openings.some((o) => o.wall === w.id && o.pz !== 'win' && /full|window/.test(o.type)))
      for (const [s0, s1, low] of [[100, gt - gw2 - 60, true], [gt + gw2 + 60, L - 100, false]]) { const len = s1 - s0; if (len < 700) continue; const n = Math.max(1, Math.round(len / FAC.pw)), pw = len / n, list = (low ? rightS : !rightS) ? FAC.L : FAC.R;
        for (let i = 0; i < n; i++) { const t = low ? s1 - pw * (i + .5) : s0 + pw * (i + .5), o = { id: uid('o'), pz: 'win', wall: w.id, t: Math.round(t), type: 'window', w: Math.round(pw - 55), h: SH, sill: 0, frame: '#9aa0a6', fw: 20 }; P.openings.push(o);
          if (on('sign')) add.push({ id: uid('i'), pz: 'sign', type: 'winsheet', dk: list[i] || FAC.plain, win: o.id, x: 0, y: 0, w: o.w, d: 12, rot: 0, tag: `윈도우 시트 ${list[i] ? (low ? '좌' : '우') + (i + 1) : '(무지)'}` }); } }
    if (on('sign') && FAC.door) add.push({ id: uid('i'), pz: 'sign', type: 'doorsheet', dk: FAC.door, win: gate.id, x: 0, y: 0, w: gate.w, d: 12, rot: 0, tag: pr.id === 'hall' ? '레드 양개 출입문 (트랜섬 포함)' : '레드 출입문 (DELIVERY · TAKE OUT)' });
    if (on('sign')) { const Dk = DECALS[FAC.sign], ar = Dk.w / Dk.h, sw0 = pr.id === 'hall' ? (L >= 8050 ? 8050 : L >= 6400 ? 6000 : 4000) : 4500, sl = Math.min(sw0, L - 100), sc = clamp(gt, sl / 2 + 50, L - sl / 2 - 50), off = wallT(w) / 2 + 100;
      add.push({ id: uid('i'), pz: 'sign', type: 'pelisign', dk: FAC.sign, x: Math.round(w.x1 + ux * sc + nx * off), y: Math.round(w.y1 + uy * sc + ny * off), w: sl, d: 150, h: Math.round(sl / ar), lockAR: ar, rot, elev: SH, wallLink: w.id, tag: `페리카나 간판 ${(sl / 1000).toFixed(1)}M (LED 파나플렉스)` }); }
    w.L0 = L;
  }
  void gp;
  // 출입구는 최대 2개 (주 출입구 + 보조 출입구)
  let subUV = null;
  { const ext = new Set(exteriorWalls().map((w) => w.id)), isDoor = (o) => o.pz !== 'win' && o.pz !== 'gate' && ext.has(o.wall) && /door|auto|slide|glass|fold|shutter|opening|arch/.test(o.type);
    const extra = P.openings.filter(isDoor); let sub = extra.find((o) => o.pz === 'sub') || extra[0] || null; const drop = extra.filter((o) => o !== sub);
    if (drop.length) { P.openings = P.openings.filter((o) => !drop.includes(o)); rep.note += (rep.note ? ' · ' : '') + `출입구가 많아 ${drop.length}개를 뺐어요 (주 + 보조 최대 2개)`; }
    if (!opt.sub && sub && sub.pz === 'sub') { P.openings = P.openings.filter((o) => o !== sub); sub = null; }
    if (opt.sub && !sub) { const sideU = bs === 'L' ? W : 0, useFront = (bs === 'L' && dsF === 'right') || (bs === 'R' && dsF === 'left'), uv = useFront ? [du > W / 2 ? 700 : W - 700, 0] : [sideU, Math.max(1200, pv - 800)], out = useFront ? [uv[0], -T] : [sideU === 0 ? -T : W + T, uv[1]], ow = toW(...out);
      let best = null; for (const w of exteriorWalls()) { const [d, t] = distPtSeg(ow[0], ow[1], w); if (!best || d < best.d) best = { d, t, w }; }
      if (best) { const L = Math.hypot(best.w.x2 - best.w.x1, best.w.y2 - best.w.y1); sub = { id: uid('o'), pz: 'sub', wall: best.w.id, t: Math.round(clamp(best.t * L, 650, L - 650)), type: 'door1', w: 900, h: 2100, sill: 0, frame: PELI.fin.gate[1] }; P.openings.push(sub); } }
    if (sub) { sub.pz = sub.pz || 'sub'; const g = openingGeom(sub); if (g) subUV = fromW((g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2); } }
  // 2. 필수 주방 기물 — 주방 매뉴얼 규칙
  //   화기(간택기·튀김기)는 한 줄에 붙여서(가스 최적화) · 식기세척기는 싱크대 바로 옆 · 주방 6평 이상에 싱크 2대면 떨어뜨리기
  //   싱크·작업대·테이블냉장고·식세기 투입부 높이 통일 · 음료냉장고 앞은 문 열림 공간 비우기 · 작업대/테이블냉장고 위 스테인리스 선반
  const placed = [], hallKeep = [], KH = opt.kh || 850;
  if (on('kitchen')) {
    const ov = opt.counts || {}, list = [];
    for (const [type, w, d, h, q, role, prio, name] of pr.kitchen) { const n = ov[name] != null ? ov[name] : q; for (let i = 0; i < n; i++) list.push({ type, w, d, h, role, prio, name }); }
    for (const it of list) { if (/^(sink\d|work2?|tfridge)$/.test(it.type)) it.h = KH; if (it.type === 'dishwasher') it.name = `식기세척기 (투입부 H${KH})`; }
    const kArea = W * kd / 1e6, sinks = list.filter((i) => /^sink/.test(i.type)), dish = list.filter((i) => i.type === 'dishwasher'), split = sinks.length >= 2 && kArea >= 19.83;
    const hotB = list.filter((i) => libGet(i.type).hood), hotSide = list.filter((i) => i.role === 'hot' && !libGet(i.type).hood);
    if (rnd() < 0.5) hotB.reverse();
    const washA = split ? [sinks.find((x) => x.type === 'sink2') || sinks[0]] : [...sinks], washB = split ? sinks.filter((x) => !washA.includes(x)) : [];
    washA.push(...dish); // 식기세척기는 싱크대 바로 옆
    const cold = list.filter((i) => i.role === 'cold' && i.type !== 'showcase'), shows = list.filter((i) => i.type === 'showcase'), prep = list.filter((i) => i.role === 'prep'), store = list.filter((i) => i.role === 'store');
    const back = pick([1, -1]), bL = kdSide === 'L' ? pv + 1100 : pv + 150, bR = kdSide === 'R' ? pv + 1100 : pv + 150;
    const runs = [
      { face: 'front', len: W, uv: (s, it) => [back > 0 ? s + it.w / 2 : W - s - it.w / 2, D - it.d / 2] },
      { face: 'left', len: D - 800 - bR, uv: (s, it) => [W - it.d / 2, D - 800 - s - it.w / 2] },
      { face: 'right', len: D - 800 - bL, uv: (s, it) => [it.d / 2, D - 800 - s - it.w / 2] },
    ].map((r, i) => ({ ...r, ri: i, lo: 0, hi: Math.max(0, r.len) }));
    const room = (r) => r.hi - r.lo;
    const putBlock = (items, r, end) => { const tw = items.reduce((a, x) => a + x.w, 0); if (!items.length || tw > room(r)) return false; const seq = end === 'hi' ? [...items].reverse() : items;
      for (const it of seq) { let st; if (end === 'hi') { r.hi -= it.w; st = r.hi; } else { st = r.lo; r.lo += it.w; } const [u, v] = r.uv(st, it); placed.push({ it, u, v, face: r.face, ri: r.ri, end, s: st }); } return true; };
    const tryBlock = (items, order, end = 'lo') => { for (const ri of order) if (putBlock(items, runs[ri], end)) return ri; return -1; };
    const shrink = (it) => { const a = ALT[it.type]; return a && a[1] < it.w ? { ...it, type: a[0], w: a[1], name: it.name + ' (작은 규격)' } : null; };
    const single = (it, order, end = 'lo') => { let x = it; for (let k = 0; k < 2 && x; k++) { const r = tryBlock([x], order, end); if (r >= 0) return r; x = shrink(x); } rep.miss.push(it.name); return -1; };
    const byRoom = (ex = []) => [0, 1, 2].filter((i) => !ex.includes(i)).sort((a, b) => room(runs[b]) - room(runs[a]));
    // ① 화기 묶음 (간택기 + 튀김기 붙여서)
    let hotRun = hotB.length ? tryBlock(hotB, [0, ...byRoom([0])]) : -1;
    if (hotB.length && hotRun < 0) { const sm = hotB.map((x) => shrink(x) || x); hotRun = tryBlock(sm, byRoom()); if (hotRun < 0) { rep.miss.push('화기 묶음이 한 줄에 안 들어가 따로 놓았어요'); hotB.forEach((x) => single(x, byRoom())); } }
    for (const x of hotSide) single(x, hotRun >= 0 ? [hotRun, ...byRoom([hotRun])] : byRoom());
    // 화구 · 튀김기 앞 1m 작업 동선: 옆줄 기물이 들어오지 않게
    if (hotRun === 0) { const hp = placed.filter((p) => p.ri === 0 && libGet(p.it.type).hood), dm = Math.max(...hp.map((p) => p.it.d)), lo = Math.min(...hp.map((p) => p.u - p.it.w / 2)), hi = Math.max(...hp.map((p) => p.u + p.it.w / 2));
      if (hi > W - 800) runs[1].lo = Math.max(runs[1].lo, 200 + dm); if (lo < 800) runs[2].lo = Math.max(runs[2].lo, 200 + dm); }
    // ② 세척 묶음 (싱크 + 식기세척기) — 화기와 다른 줄 우선
    let aRun = washA.length ? tryBlock(washA, byRoom([hotRun])) : -1; if (washA.length && aRun < 0 && hotRun >= 0) aRun = tryBlock(washA, [hotRun], 'hi');
    if (washA.length && aRun < 0) washA.forEach((x) => single(x, byRoom()));
    if (washB.length) { const other = byRoom([aRun]); let r = tryBlock(washB, other); if (r < 0 && aRun >= 0) r = tryBlock(washB, [aRun], placed.find((p) => p.it === washA[0] && p.ri === aRun)?.end === 'hi' ? 'lo' : 'hi'); if (r < 0) washB.forEach((x) => single(x, byRoom())); }
    // ③ 냉장 → 작업 → 보관
    for (const x of cold) single(x, byRoom([hotRun]).concat(hotRun >= 0 ? [hotRun] : []), 'hi');
    for (const x of prep) single(x, hotRun >= 0 ? [hotRun, ...byRoom([hotRun])] : byRoom());
    for (const x of store) single(x, byRoom(), 'hi');
    // ④ 음료냉장고: 앞쪽에 가로폭만큼 문 열림 공간이 비어 있어야 함
    const foot = (p) => { const w = p.it.w, d = p.it.d; return p.ri === 0 ? [p.u - w / 2, p.v - d / 2, p.u + w / 2, p.v + d / 2] : [p.u - d / 2, p.v - w / 2, p.u + d / 2, p.v + w / 2]; };
    const swing = (p) => { const w = p.it.w, d = p.it.d; return p.ri === 0 ? [p.u - w / 2, p.v - d / 2 - w, p.u + w / 2, p.v - d / 2] : p.ri === 1 ? [p.u - d / 2 - w, p.v - w / 2, p.u - d / 2, p.v + w / 2] : [p.u + d / 2, p.v - w / 2, p.u + d / 2 + w, p.v + w / 2]; };
    const hit = (a, b) => a[0] < b[2] - 5 && a[2] > b[0] + 5 && a[1] < b[3] - 5 && a[3] > b[1] + 5;
    const swingOK = (p) => { const z = swing(p); if (z[1] < pv + 60 || z[0] < 0 || z[2] > W) return false; return placed.every((q) => q === p || (!hit(z, foot(q)) && !(q.it.type === 'showcase' && hit(foot(p), swing(q))))); };
    let hallSc = 0;
    for (const x of shows) { let ok = false;
      for (const ri of byRoom([hotRun]).concat(hotRun >= 0 ? [hotRun] : [])) { for (const end of ['hi', 'lo']) { const r = runs[ri], keep = { lo: r.lo, hi: r.hi }; if (!putBlock([x], r, end)) continue; const p = placed[placed.length - 1]; if (swingOK(p)) { ok = true; break; } placed.pop(); r.lo = keep.lo; r.hi = keep.hi; } if (ok) break; }
      if (!ok) hallSc++; }
    // 홀로 뺀 음료냉장고: 칸막이 홀 쪽, 카운터 · 주방 출입구 피해서 · 앞은 비워 둠
    if (hallSc) { const busy = [[cu - cw / 2 - 150, cu + cw / 2 + 150], [kdU - 650, kdU + 650]]; let n = 0;
      for (let u = 1000; u + 1000 < W && n < hallSc; u += 100) { const a = u - 325, b = u + 325; if (busy.some(([p, q]) => b > p && a < q)) continue; const vv = pv - 50 - 585 / 2;
        add.push({ ...{}, id: uid('i'), pz: 'hall_sc', type: 'showcase', x: Math.round(toW(u, vv)[0]), y: Math.round(toW(u, vv)[1]), w: 650, d: 585, h: 1850, rot: rotFor('front'), tag: '음료냉장고 (홀 · 앞 650 비움)' }); rep.placed++;
        hallKeep.push([a, vv - 585 / 2 - 650 - 300, b, pv]); busy.push([a - 10, b + 10]); n++; u += 640; }
      if (n < hallSc) rep.miss.push(`음료냉장고 ${hallSc - n}대`); else rep.note += (rep.note ? ' · ' : '') + `음료냉장고 ${n}대는 문 열림 공간 때문에 홀 칸막이 쪽에 놓았어요`; }
    { const hz = placed.filter((p) => libGet(p.it.type).hood).map((p) => { const w = p.it.w, d = p.it.d; return p.ri === 0 ? [p.u - w / 2, p.v - d / 2 - 1000, p.u + w / 2, p.v - d / 2] : p.ri === 1 ? [p.u - d / 2 - 1000, p.v - w / 2, p.u - d / 2, p.v + w / 2] : [p.u + d / 2, p.v - w / 2, p.u + d / 2 + 1000, p.v + w / 2]; });
      const bad = placed.filter((q) => !libGet(q.it.type).hood && hz.some((z) => hit(z, foot(q)))); for (const q of bad) { placed.splice(placed.indexOf(q), 1); rep.miss.push(q.it.name + ' (화기 앞 1m 동선)'); } }
    for (const r of runs) { const gap = r.hi - r.lo; if (gap > 0 && gap < 100) for (const p of placed) if (p.ri === r.ri && p.end === 'hi') { p.s -= gap; [p.u, p.v] = r.uv(p.s, p.it); } } // 줄 사이 작은 틈은 붙이기
    // 놓기 · 선반 · 후드 · 가스
    const hot = [];
    for (const p of placed) { const t = p.it.type; put('kitchen', t, p.u, p.v, p.face, { w: p.it.w, d: p.it.d, h: p.it.h, tag: p.it.name.replace(/^[①-⑮]\s*/, '') }); if (libGet(t).hood) hot.push(p);
      if (/^(work2?|tfridge)$/.test(t)) { const sp = p.ri === 0 ? [p.u, D - 175] : p.ri === 1 ? [W - 175, p.v] : [175, p.v]; put('kitchen', 'shelf', sp[0], sp[1], p.face, { w: p.it.w, d: 350, h: 40, elev: 1500, color: '#c9ced4', mat: 'steel', tag: '붙박이 선반 (스테인리스)' }); } }
    for (let ri = 0; ri < 3; ri++) { const g = hot.filter((p) => p.ri === ri); if (!g.length) continue; const along = (p) => (ri === 0 ? p.u : p.v), lo = Math.max(ri === 0 ? 0 : pv + 70, Math.min(...g.map((p) => along(p) - p.it.w / 2)) - 150), hi = Math.min(ri === 0 ? W : D - 900, Math.max(...g.map((p) => along(p) + p.it.w / 2)) + 150), c = (lo + hi) / 2;
      if (ri === 0) put('kitchen', 'hood', c, D - 450, 'front', { w: Math.round(hi - lo), d: 900, tag: '후드' }); else put('kitchen', 'hood', ri === 1 ? W - 450 : 450, c, ri === 1 ? 'left' : 'right', { w: Math.round(hi - lo), d: 900, tag: '후드' });
      const gp2 = ri === 0 ? [c, D - 60] : [ri === 1 ? W - 60 : 60, c]; put('kitchen', 'gasvalve', gp2[0], gp2[1], 'front', { tag: '가스 밸브 (화기 묶음)', mark: 1 }); }
    // ⑤ 배수 (일자형 트렌치 · 사각 트렌치): 싱크에서 멀지 않게, 가능하면 주방 바닥 가운데 쪽
    const kc = [W / 2, pv + kd / 2], groups = [washA, washB].map((b) => placed.find((p) => b.includes(p.it) && /^sink/.test(p.it.type))).filter(Boolean);
    const spots = groups.map((p) => { const sp = p.ri === 0 ? [p.u, p.v - p.it.d / 2 - 150] : p.ri === 1 ? [p.u - p.it.d / 2 - 150, p.v] : [p.u + p.it.d / 2 + 150, p.v], L = Math.hypot(sp[0] - kc[0], sp[1] - kc[1]), t = L > 1200 ? 1 - 1200 / L : 0; return { at: [kc[0] + (sp[0] - kc[0]) * t, kc[1] + (sp[1] - kc[1]) * t], face: p.face }; });
    const nd = ov.drains != null ? ov.drains : Math.max(1, spots.length);
    for (let i = 0; i < nd; i++) { const s0 = spots[i] || { at: [kc[0] + (i - (nd - 1) / 2) * 1200, kc[1]], face: 'front' };
      if ((opt.drainType || 'trench') === 'trench') put('kitchen', 'trench', s0.at[0], s0.at[1], s0.face, { w: clamp(Math.round(W * .22 / 100) * 100, 1200, 1800), d: 200, tag: '일자형 트렌치 · 트랩', mark: 1 });
      else put('kitchen', 'drain', s0.at[0], s0.at[1], 'front', { w: 300, d: 300, tag: '사각 트렌치 300 · 트랩', mark: 1 }); }
    for (const p of placed.filter((q) => /^sink|dishwasher/.test(q.it.type))) put('kitchen', 'water', p.u, p.v, 'front', { tag: '급수', mark: 1 });
    if (split) rep.note += (rep.note ? ' · ' : '') + '주방 6평 이상 · 싱크 2대라 떨어뜨려 놓았어요';
  }
  // 3. 카운터 · 메뉴보드 · 메뉴 띠 · 펜던트
  if (on('counter')) put('counter', 'counter', cu, pv - 420, 'front', { w: cw, d: 700, h: 1050, color: PELI.fin.counter[1], mat: 'gloss', tag: pr.id === 'hall' ? 'FU-01 카운터' : 'FU-04 카운터테이블' });
  if (on('menu')) { const mbE = Math.max(1960, (P.ceilingH || 2700) - 680); for (let i = 0; i < pr.menuboards; i++) put('menu', 'menuboard', cu + (i - (pr.menuboards - 1) / 2) * 1150, pv - 120, 'front', { elev: mbE, tag: '디지털 메뉴보드 49"' });
    put('menu', 'shelf', cu, pv - 130, 'front', { w: cw, d: 120, h: 220, elev: 1720, color: PELI.fin.band, mat: 'gloss', tag: '메뉴 띠 SH-01 골든옐로우' }); }
  if (on('pendant')) for (let i = 0, n = Math.max(1, Math.round(cw / 1200)); i < n; i++) put('pendant', 'pendant', cu + (i - (n - 1) / 2) * 1200, pv - 450, 'front', { tag: 'LT-02 빈티지 펜던트' });
  // 4. 조명 · 에어컨 (넓이에 맞춰 수량)
  const hallA = W * pv / 1e6;
  if (on('lightBase')) { const nx = Math.max(2, Math.round(W / 1800)), ny = Math.max(1, Math.round((pv - 900) / 1800)); for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) put('lightBase', 'downlight', W * (i + .5) / nx, (pv - 900) * (j + .5) / ny, 'front', { w: 255, d: 255, tag: 'LT-01 돔 직부등' });
    const kx = Math.max(1, Math.round(W / 2200)); for (let i = 0; i < kx; i++) put('lightBase', 'downlight', W * (i + .5) / kx, pv + kd / 2, 'front', { w: 600, d: 600, color: '#f4f6f8', tag: 'LT-03 LED 평판등' }); }
  if (on('ac')) { const nac = Math.max(1, Math.ceil(hallA / 35)); for (let i = 0; i < nac; i++) put('ac', 'ac_cassette', W * (i + .5) / nac, pv * .45, 'front', { tag: '천장형 에어컨' }); }
  // 5. 붙박이 쪽 (출입구 없는 옆벽, 랜덤) · 반사경 · 네온
  const v0 = opt.windows && dsF === 'front' ? 1600 : 900, v1 = pv - 700 - 1100;
  const nv0 = pr.id === 'hall' ? v0 : 600, nv1 = pr.id === 'hall' ? Math.max(v0 + 1500, v1) : pv - 600, mcol = Math.min(pv - 500, nv1 + 475);
  if (on('mirror')) { const nm = clamp(Math.floor(((P.ceilingH || 2700) - 600) / 530), 2, 4); for (let i = 0; i < nm; i++) put('mirror', 'domemirror', bu(70), mcol, bIn, { elev: 500 + i * 530, tag: 'DP-01 돔 반사경' }); }
  if (on('lightDeco')) { const len = nv1 - nv0, vc = (nv0 + nv1) / 2, sw = clamp(Math.round(len * .42), 1200, 2100), sh = Math.round(sw * libGet('neonsign').h / libGet('neonsign').w), ey = 1650;
    if (len > sw + 400) { put('lightDeco', 'neonsign', bu(25), vc, bIn, { w: sw, h: sh, elev: ey, tag: '네온사인 (조명형 아크릴)' });
      for (const [a0, a1] of [[nv0, vc - sw / 2 - 40], [vc + sw / 2 + 40, on('mirror') ? Math.min(nv1 + 200, mcol - 320) : nv1 + 200]]) if (a1 - a0 > 300) put('lightDeco', 'neonstripe', bu(15), (a0 + a1) / 2, bIn, { w: Math.round(a1 - a0), elev: Math.round(ey + sh / 2 - 35), tag: '장식용 아크릴 띠장' }); } }
  // 6. 테이블 · 의자 (통로 900 · 출입구 앞 비우기)
  const aisle = std().aisle || 900, gw = dw / 2 + 700, ch = PELI.chairs;
  if (on('builtin') && opt.windows) {
    const segs = dsF === 'front' ? [[150, du - gw], [du + gw, W - 150]] : [[300, dv - gw], [dv + gw, pv - 1300]];
    for (const [s0, s1] of segs) { if (s1 - s0 < 1000) continue; const tg = pr.id === 'hall' ? 'FU-03 바테이블' : 'FU-05 바테이블';
      if (dsF === 'front') { put('builtin', 'tbar', (s0 + s1) / 2, 450, 'front', { w: Math.round(s1 - s0), d: 400, h: 1050, color: PELI.fin.table, tag: tg }); for (let u = s0 + 300; u + 300 <= s1; u += 600) { put('builtin', ch.CH04[0], u, 950, 'front', { color: ch.CH04[1], tag: 'CH-04 바체어' }); rep.seats++; } }
      else { const L0 = dsF === 'left', f = L0 ? 'left' : 'right', uu = (x) => (L0 ? x : W - x); put('builtin', 'tbar', uu(450), (s0 + s1) / 2, f, { w: Math.round(s1 - s0), d: 400, h: 1050, color: PELI.fin.table, tag: tg }); for (let v = s0 + 300; v + 300 <= s1; v += 600) { put('builtin', ch.CH04[0], uu(950), v, f, { color: ch.CH04[1], tag: 'CH-04 바체어' }); rep.seats++; } } }
  }
  if (pr.id === 'hall') {
    if (on('builtin') && v1 - v0 > 1500) { put('builtin', 'banquette', bu(300), (v0 + v1) / 2, bIn, { w: Math.round(v1 - v0), d: 600, color: PELI.fin.cushion, tag: 'FU-02 붙박이 의자' });
      for (let v = v0 + 700; v + 600 <= v1; v += 1900) { put('builtin', 't4', bu(950), v, bIn, { w: 1200, d: 700, color: PELI.fin.table, mat: 'gloss', tag: 'TB-01 이동테이블' }); for (const dd of [-300, 300]) { put('builtin', ch.CH02[0], bu(1560), v + dd, bOut, { color: ch.CH02[1], tag: 'CH-02' }); rep.seats++; } rep.seats += 2; } }
    if (on('tables')) {
      const sideBar = opt.windows && dsF !== 'front' ? 1350 : 0, uA = bs === 'L' ? 600 + 700 + 520 + aisle : 300 + (dsF === 'left' ? sideBar : 0), uB = bs === 'R' ? W - (600 + 700 + 520 + aisle) : W - 300 - (dsF === 'right' ? sideBar : 0);
      const vert = rnd() < 0.4, tw = vert ? 700 : 1200, td = vert ? 1200 : 700, pu = vert ? 700 + 900 + aisle * .6 : 1200 + aisle, pvv = vert ? 1200 + aisle : 700 + 900 + aisle * .6, mode = pick(['alt', 'row', 'mint', 'alt']), mods = [];
      const dU = dsF === 'front' ? du : dsF === 'left' ? 0 : W, dV = dsF === 'front' ? 0 : dv;
      for (let v = v0 + (vert ? 600 : 650); v + td / 2 + (vert ? 0 : 600) <= v1 + 300; v += pvv) for (let u = uA + (vert ? 950 : 600); u + (vert ? 950 : 600) <= uB; u += pu) { if (Math.hypot(u - dU, v - dV) < 1700 || (subUV && Math.hypot(u - subUV[0], v - subUV[1]) < 1400) || hallKeep.some((z) => u + 950 > z[0] && u - 950 < z[2] && v + 950 > z[1] && v - 950 < z[3])) continue; mods.push([u, v]); }
      mods.forEach(([u, v], i) => { const row = Math.round((v - v0) / pvv), c = mode === 'mint' ? ch.CH01 : mode === 'row' ? (row % 2 ? ch.CH03 : ch.CH01) : (i % 2 ? ch.CH03 : ch.CH01);
        put('tables', 't4', u, v, vert ? 'right' : 'front', { w: 1200, d: 700, color: PELI.fin.table, mat: 'gloss', tag: 'TB-01 이동테이블' });
        const seats = vert ? [[-600, -300, 'right'], [-600, 300, 'right'], [600, -300, 'left'], [600, 300, 'left']] : [[-300, -600, 'back'], [300, -600, 'back'], [-300, 600, 'front'], [300, 600, 'front']];
        for (const [a, b, f] of seats) { put('tables', c[0], u + a, v + b, f, { color: c[1], tag: c[2].split(' ')[0] }); rep.seats++; } });
    }
  } else if (on('tables')) put('tables', 't2', bu(W * .25), pv * .55, 'front', { w: 700, d: 700, color: PELI.fin.table, tag: '대기 테이블' });
  P.items.push(...add.map((it) => (it.pz === 'hall_sc' ? { ...it, pz: 'kitchen' } : it)));
  P.preset = { id: pr.id, name: pr.name, src: pr.src, at: Date.now(), ratio: opt.ratio, opt: { kind: opt.kind, ratio: opt.ratio, door: opt.door || doorP, kit: opt.kit || null, scope: opt.scope || null, counts: opt.counts, windows: opt.windows, kh: opt.kh, drainType: opt.drainType, sub: opt.sub } };
  { const sc = add.filter((it) => it.type === 'showcase' && it.pz === 'hall_sc'); if (sc.length) P.items = P.items.filter((it) => !(it.type === 'metalframe' && sc.some((q) => Math.hypot(q.x - it.x, q.y - it.y) < q.w / 2 + 120))); }
  return rep;
}

/* ---------- 프리셋 창 (새 프로젝트 시작 · 도구 메뉴) ---------- */
let presetFromNew = false, psPos = { door: null, kit: null };
function psPosText() { const R = presetRect(); if (!R) return ''; const N = { N: '위쪽', S: '아래쪽', W: '왼쪽', E: '오른쪽' }, d = sideNear(R, psPos.door || defaultDoor(R)), k = psPos.kit ? sideNear(R, psPos.kit) : OPP[d];
  return `주 출입구: 도면 ${N[d]} 벽 · 주방: 도면 ${N[k]} 쪽${psPos.door || psPos.kit ? '' : ' (자동)'}`; }
function openPreset(fromNew) {
  presetFromNew = !!fromNew; const R = presetRect(); if (!R) { toast('벽이 있어야 프리셋을 적용할 수 있어요'); return; }
  const W = R[2] - R[0], D = R[3] - R[1], area = W * D / 1e6, py = area / 3.3058, o = P.preset && P.preset.opt;
  $('#psInfo').textContent = `매장 안쪽 ${(W / 1000).toFixed(1)} × ${(D / 1000).toFixed(1)} m · ${area.toFixed(1)}㎡ (${py.toFixed(1)}평)`;
  psPos = o && !fromNew ? { door: o.door, kit: o.kit } : { door: null, kit: null };
  $('#psKind').value = o && !fromNew ? o.kind : py < 12 ? 'delivery' : 'hall'; psKindChange(); if (o && !fromNew) { $('#psRatio').value = Math.round(o.ratio * 100); $('#psRatioV').textContent = $('#psRatio').value + '%'; }
  $('#psScope').innerHTML = PSCOPE.map(([k, n]) => `<label class="chk"><input type="checkbox" data-pss="${k}" ${!o || !o.scope || o.scope.includes(k) || fromNew ? 'checked' : ''}> ${n}</label>`).join('');
  $('#psKH').value = (o && !fromNew && o.kh) || 850; $('#psDrain').value = (o && !fromNew && o.drainType) || 'trench'; $('#psSub').checked = o && !fromNew && o.sub != null ? o.sub : $('#psKind').value === 'hall'; $('#psClear').checked = !!fromNew; $('#psClearRow').hidden = !!fromNew; $('#psAgain').hidden = !(P.preset && P.preset.opt) || !!fromNew; $('#psPos').textContent = psPosText(); $('#presetDlg').showModal();
}
function psKindChange() {
  const pr = PRESETS[$('#psKind').value], R = presetRect(), py = R ? (R[2] - R[0]) * (R[3] - R[1]) / 1e6 / 3.3058 : 30; $('#psRatio').value = Math.round((pr.ratio + (pr.id === 'hall' && py < 20 ? 0.07 : 0)) * 100); $('#psRatioV').textContent = $('#psRatio').value + '%';
  const groups = new Map(); for (const [type, w, d, h, q, role, prio, name] of pr.kitchen) if (prio <= 3) groups.set(name, { q, type });
  $('#psCounts').innerHTML = [...groups.entries()].map(([n, g]) => `<label class="aurow on"><span>${esc(n.replace(/^[①-⑮]\s*/, ''))}</span><input type="number" min="0" max="6" value="${g.q}" data-psn="${esc(n)}"></label>`).join('') + `<label class="aurow on"><span>배수 (트렌치)</span><input type="number" min="0" max="8" placeholder="자동" data-psd></label>`;
  $('#psSrc').textContent = `${pr.src} · 바닥 TL-01/02 2톤 · 주방 TL-03/04 · 게이트 PT-02 · 벽패널 LT-01 · 카운터 LT-02`;
}
function psRead() {
  const counts = {}; $$('[data-psn]').forEach((i) => (counts[i.dataset.psn] = clamp(+i.value || 0, 0, 6))); const dr = $('[data-psd]'); if (dr && dr.value !== '') counts.drains = clamp(+dr.value || 0, 0, 8);
  const scope = $$('[data-pss]').filter((i) => i.checked).map((i) => i.dataset.pss);
  return { kind: $('#psKind').value, ratio: +$('#psRatio').value / 100, door: psPos.door, kit: psPos.kit, scope: scope.length === PSCOPE.length ? null : scope, counts, windows: $('#psWin').checked, kh: clamp(+$('#psKH').value || 850, 700, 1000), drainType: $('#psDrain').value, sub: $('#psSub').checked };
}
function presetDone(rep, name, again) {
  commit(); dirty3d = true; draw2d(); renderAgain();
  toast(`${name} ${again ? '다시 배치' : '적용'} · 기물 ${rep.placed}개 · 좌석 ${rep.seats}석${rep.miss.length ? ' · 못 넣음: ' + rep.miss.slice(0, 3).join(', ') : ''}${rep.note ? ' · ' + rep.note : ''}`);
}
function runPreset(again) {
  const o = psRead(), rep = applyPreset({ ...o, seed: Date.now() & 0xffffff, clear: !again && (presetFromNew || $('#psClear').checked) }); if (!rep) return;
  if ($('#presetDlg').open) $('#presetDlg').close(); const envT = $('#psEnv').value; if (envT !== 'keep') { envOf().type = envT; if ($('#outside')) $('#outside').checked = true; }
  fit2d(); if (view === '2d') setView(isMobile() ? '3d' : 'split'); if (!again) { cam3dDefault(); cam.cut = true; if (envT !== 'keep') envView(); }
  presetDone(rep, PRESETS[o.kind].name, again);
}
function presetAgain() { // 같은 설정 · 새 랜덤 배치
  const o = P.preset && P.preset.opt; if (!o) { openPreset(false); return; }
  const rep = applyPreset({ ...o, seed: (Date.now() * 7) & 0xffffff, clear: false }); if (rep) presetDone(rep, PRESETS[o.kind].name, true);
}
function renderAgain() { const b = $('#psAgainFab'); if (b) b.hidden = !(P && P.preset && P.preset.opt) || !!PK || document.body.classList.contains('show') || document.body.classList.contains('clean'); }
$('#psKind').onchange = psKindChange; $('#psRatio').oninput = () => { $('#psRatioV').textContent = $('#psRatio').value + '%'; };
$('#psGo').onclick = () => runPreset(false); $('#psAgain').onclick = () => runPreset(true); $('#psSkip').onclick = () => $('#presetDlg').close();
$('#psAll').onclick = () => { const all = $$('[data-pss]').every((i) => i.checked); $$('[data-pss]').forEach((i) => (i.checked = !all)); };
$('#psPick').onclick = () => pkStart();
$('#stage').insertAdjacentHTML('beforeend', `<button class="psfab glass" id="psAgainFab" hidden title="같은 설정으로 다른 배치">↻ 프리셋 다시 배치</button>
  <div class="pkbar glass" id="pkBar" hidden><b>위치 잡기</b><span>빨간 점 = 주 출입구 · 회색 칸 = 주방 · 2D나 3D에서 끌어 옮기세요</span><button class="btn pri" id="pkGo">이 위치로 적용</button><button class="btn" id="pkDlg">설정 창으로</button></div>`);
$('#psAgainFab').onclick = presetAgain;
// 새 프로젝트(사각 매장)를 만들면 바로 물어보기
{ const _cp = createPending; createPending = function (s) { const st = (pendingNew || {}).start; _cp(s); if (st === 'rect' || st === 'photos' || !st) setTimeout(() => openPreset(true), 250); }; }
{ const mm = $('#moreMenu'); mm.insertAdjacentHTML('afterbegin', '<button data-mm="preset" id="presetMM"><b>페리카나 프리셋 적용</b><small>매뉴얼 기준 마감 · 기물 자동 배치</small></button>'); mm.addEventListener('click', (e) => { if (e.target.closest('[data-mm="preset"]')) { e.stopImmediatePropagation(); mm.hidden = true; openPreset(false); } }, true); }
{ const _C = CMDS; CMDS = function () { const l = _C(); l.unshift({ g: '프로젝트', n: '페리카나 프리셋 적용', run: () => openPreset(false), k: '', kw: 'preset 매뉴얼 자동 배치 페리카나' }, { g: '프로젝트', n: '프리셋 다시 배치 (랜덤)', run: presetAgain, k: '', kw: 'preset again random 다시' }); return l; }; }
{ const _op = openProject; openProject = function (p) { _op(p); renderAgain(); }; }

/* ---------- 출입구 · 주방 위치 잡기 (2D · 3D에서 끌기) ---------- */
let PK = null;
function pkGeom() { const R = presetRect(); if (!R) return null; const door = snapSide(R, PK.door), ds = sideNear(R, door); let ks = sideNear(R, PK.kit); if (ks === ds) ks = OPP[ds]; return { R, door, ds, ks, rect: kitRect(R, ks, +$('#psRatio').value / 100) }; }
function pkStart() {
  const R = presetRect(); if (!R) return; const d = psPos.door || defaultDoor(R), ks = psPos.kit ? sideNear(R, psPos.kit) : OPP[sideNear(R, d)];
  PK = { door: snapSide(R, d), kit: psPos.kit || { N: [(R[0] + R[2]) / 2, R[1] + 600], S: [(R[0] + R[2]) / 2, R[3] - 600], W: [R[0] + 600, (R[1] + R[3]) / 2], E: [R[2] - 600, (R[1] + R[3]) / 2] }[ks], drag: null };
  $('#presetDlg').close(); $('#pkBar').hidden = false; renderAgain(); if (sel) pickSel(null); dirty3d = true; draw2d();
}
function pkEnd(go) { if (!PK) return; const g = pkGeom(); psPos = { door: g.door, kit: [(g.rect[0] + g.rect[2]) / 2, (g.rect[1] + g.rect[3]) / 2] }; PK = null; $('#pkBar').hidden = true; dirty3d = true; draw2d();
  if (go) { $('#psPos').textContent = psPosText(); runPreset(!!(P.preset && P.preset.opt) && !presetFromNew); } else { $('#psPos').textContent = psPosText(); $('#presetDlg').showModal(); } renderAgain(); }
$('#pkGo').onclick = () => pkEnd(true); $('#pkDlg').onclick = () => pkEnd(false);
{ const _d = draw2d; draw2d = function () { _d(); if (!PK || !P || view === '3d' || OFF) return; const g = pkGeom(); if (!g) return; const [x0, y0, x1, y1] = g.rect;
    cx.save(); poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 'rgba(90,96,108,.38)', '#3a3e44', 2, [8, 5]); const c = toS((x0 + x1) / 2, (y0 + y1) / 2); cx.font = '700 14px system-ui'; cx.fillStyle = '#ffffff'; cx.textAlign = 'center'; cx.fillText('주방 (끌어서 벽 고르기)', c[0], c[1]);
    const d = toS(...g.door); cx.fillStyle = '#d0021b'; cx.beginPath(); cx.arc(d[0], d[1], 12, 0, 7); cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.stroke(); cx.fillStyle = '#d0021b'; cx.font = '700 12px system-ui'; cx.fillText('주 출입구', d[0], d[1] - 18); cx.restore(); }; }
{ const _bl = buildLevel; buildLevel = function (active) { _bl(active); if (!PK || !active) return; const g = pkGeom(); if (!g) return; const T = xf(0, 0, 0), [x0, y0, x1, y1] = g.rect;
    box(T, x0, x1, 5, 60, y0, y1, '#5a606c', 'plain', .55); box(T, g.door[0] - 160, g.door[0] + 160, 0, 2600, g.door[1] - 160, g.door[1] + 160, '#d0021b', 'plain', .85); }; }
const pkWorld2d = (e) => { const r = cv.getBoundingClientRect(); return toW(e.clientX - r.left, e.clientY - r.top); };
function pkDown(e, w, near) { const g = pkGeom(); if (!g || !w) return false; const [x0, y0, x1, y1] = g.rect;
  if (Math.hypot(w[0] - g.door[0], w[1] - g.door[1]) < near) PK.drag = 'door'; else if (w[0] > x0 && w[0] < x1 && w[1] > y0 && w[1] < y1) PK.drag = 'kit'; else return false;
  e.stopImmediatePropagation(); e.preventDefault(); try { e.target.setPointerCapture(e.pointerId); } catch (er) {} return true; }
function pkMove(e, w) { if (!PK || !PK.drag || !w) return false; if (PK.drag === 'door') PK.door = snapSide(presetRect(), w); else PK.kit = w; e.stopImmediatePropagation(); dirty3d = true; draw2d(); return true; }
cv.addEventListener('pointerdown', (e) => { if (PK) pkDown(e, pkWorld2d(e), 26 / V.s); }, true);
cv.addEventListener('pointermove', (e) => { if (PK) pkMove(e, pkWorld2d(e)); }, true);
gc.addEventListener('pointerdown', (e) => { if (PK && e.button === 0) pkDown(e, planeHit(e, 0), 900); }, true);
gc.addEventListener('pointermove', (e) => { if (PK) pkMove(e, planeHit(e, 0)); }, true);
for (const el of [cv, gc]) el.addEventListener('pointerup', (e) => { if (PK && PK.drag) { PK.drag = null; e.stopImmediatePropagation(); } }, true);
window.APP_VERSION = 'v11 · 2026-11-05';
