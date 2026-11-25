// 키즈룸(놀이방) 프리셋: 2단 파이프 프레임 + 위층 쿠션 발판 + 미끄럼틀 · 웨이브 롤러 + 볼풀 · X 롤러 · 링 터널 · 타공 오르기 · 샌드백 · 경사 쿠션 · 매트
// 형태: 'L' = ㄱ자 (한쪽 끝에 미끄럼틀 날개가 앞으로 꺾여 나옴) · 'I' = 일자 (미끄럼틀이 앞으로 바로 내려옴)
// 지역 좌표: x = 벽을 따라 (0 → len), y = 벽에서 앞으로 (0 = 벽면). 기물 rot 0 = 앞(+y)을 봄.
export const KID_THEMES = {
  brown: { name: '브라운 · 크림 (직영점 톤)', a: '#b5866a', b: '#efe6dc', pipe: '#f4f4f2', accent: '#b67a2c', slide: '#ddd3d3', mat: '#d9cfc4' },
  pastel: { name: '옐로 · 스카이 (파스텔)', a: '#e9cf6a', b: '#eef3f6', pipe: '#f4f4f2', accent: '#6fb7e6', slide: '#f2c230', mat: '#f1e6b8' },
  mint: { name: '민트 · 화이트', a: '#8fd3b9', b: '#f3f1ea', pipe: '#f4f4f2', accent: '#e7a8a0', slide: '#cfe9df', mat: '#dfeee7' },
};
const BAY = 900, DEP = 1850, MID = 1100, H = 2200;

/** → [{ type, x, y, rot, over }] (지역 좌표 · 기물 가운데) */
export function kidsItems({ form = 'L', len = 5400, flip = false, theme = 'brown' } = {}) {
  const T = KID_THEMES[theme] || KID_THEMES.brown, out = [], put = (type, x, y, rot, over = {}) => out.push({ type, x, y, rot, over });
  const n = Math.max(4, Math.round(len / BAY)), bay = len / n, poolN = n >= 6 ? 2 : 1, deckN = n - poolN;
  /* 1) 본체: 위층(1100) 발판 칸 + 끝 볼풀 칸 — 파이프 프레임 2개 */
  put('kz_pipe', (deckN * bay) / 2, DEP / 2, 0, { w: Math.round(deckN * bay), d: DEP, h: H, nx: deckN, nz: 2, mid: MID, color: T.pipe, name: `키즈룸 파이프 프레임 2단 (${deckN}×2칸)` });
  put('kz_pipe', deckN * bay + (poolN * bay) / 2, DEP / 2, 0, { w: Math.round(poolN * bay), d: DEP, h: H, nx: poolN, nz: 2, mid: MID, color: T.pipe, name: '키즈룸 파이프 프레임 (볼풀 칸)' });
  put('kz_mat', len / 2, DEP / 2, 0, { w: Math.round(len + 200), d: DEP + 200, h: 40, elev: 0, color: T.mat, name: '키즈룸 안전 매트 (바닥)' });
  for (let i = 0; i < deckN; i++) for (let k = 0; k < 2; k++) put((i + k) % 2 ? 'kz_deck' : 'kz_deck2', bay * (i + 0.5), (DEP / 2) * (k + 0.5), 0, { w: Math.round(bay - 20), d: Math.round(DEP / 2 - 20), h: 100, elev: MID, color: (i + k) % 2 ? T.a : T.b, name: '키즈룸 쿠션 발판 (위층)' });
  put('kz_pool', deckN * bay + (poolN * bay) / 2, DEP / 2, 0, { w: Math.round(poolN * bay - 80), d: DEP - 80, h: 600, color: T.b, name: '키즈룸 볼풀' });
  /* 2) 놀이 요소: X 롤러(위층) · 링 터널 판 · 타공 오르기 · 샌드백 · 경사 쿠션(볼풀 앞으로 내려오기) · 소프트 블록 */
  if (deckN >= 3) put('kz_xroll', bay * 1.5, DEP * 0.45, 0, { w: 1000, d: 1000, h: 500, elev: MID + 150, color: T.accent, name: '키즈룸 X 롤러' });
  put('kz_ring', bay * Math.min(deckN - 1.5, 2.5), DEP - 40, 0, { w: Math.round(bay - 60), d: 150, h: 1000, elev: MID + 50, color: T.b, name: '키즈룸 링 터널 판 (위층 앞)' });
  put('kz_perf', bay * Math.min(deckN - 0.5, 2.5), DEP - 15, 0, { w: Math.round(bay - 60), d: 20, h: MID - 50, elev: 0, color: T.b, name: '키즈룸 타공 오르기 판' });
  put('kz_bag', bay * 0.9, DEP * 0.3, 0, { w: 260, d: 260, h: 850, elev: 200, color: T.accent, name: '키즈룸 샌드백' });
  if (deckN >= 4) put('kz_bag', bay * (deckN - 0.6), DEP * 0.3, 0, { w: 260, d: 260, h: 850, elev: 200, color: T.accent, name: '키즈룸 샌드백' });
  put('kz_wedge', bay * (deckN - 0.5), DEP + 450, 0, { w: Math.round(bay - 40), d: 900, h: MID, color: T.b, name: '키즈룸 쿠션 경사 (위층 → 바닥)' });
  put('kz_soft', bay * (deckN - 1.6), DEP + 260, 0, { w: 800, d: 420, h: 300, color: T.b, name: '키즈룸 소프트 블록' });
  /* 3) 미끄럼틀 · 웨이브 롤러 */
  if (form === 'L') { /* ㄱ자: 0번 칸 앞으로 날개 프레임(2단) · 날개 끝 발판에서 앞으로 내려오는 미끄럼틀 + 웨이브 */
    const ww = 1560, wd = 1960;
    put('kz_pipe', ww / 2, DEP + wd / 2, 0, { w: ww, d: wd, h: H, nx: 2, nz: 2, mid: MID, color: T.pipe, name: '키즈룸 파이프 프레임 (ㄱ자 날개 · 미끄럼틀 칸)' });
    put('kz_deck', ww / 2, DEP + 200, 0, { w: ww - 40, d: 380, h: 100, elev: MID, color: T.a, name: '키즈룸 발판 (미끄럼틀 위)' });
    put('kz_slide', ww * 0.27, DEP + 390 + 830, 0, { w: 600, d: 1662, h: MID, color: T.slide, name: '키즈룸 미끄럼틀' });
    put('kz_wave', ww * 0.74, DEP + 390 + 800, 0, { w: 700, d: 1596, h: MID, color: T.a, name: '키즈룸 웨이브 롤러 경사' });
    put('kz_mat', ww * 0.27, DEP + wd + 260, 0, { w: 720, d: 480, h: 60, color: T.a, name: '착지 매트' }); put('kz_mat', ww * 0.74, DEP + wd + 260, 0, { w: 720, d: 480, h: 60, color: T.a, name: '착지 매트' });
    put('kz_mat', ww / 2, DEP + wd / 2, 0, { w: ww + 100, d: wd, h: 40, color: T.mat, name: '키즈룸 안전 매트 (날개)' });
  } else { /* 일자: 0번 칸 앞 가장자리에서 바로 앞으로 내려오는 미끄럼틀 + 1번 칸 웨이브 */
    put('kz_slide', bay * 0.5, DEP + 831, 0, { w: 600, d: 1662, h: MID, color: T.slide, name: '키즈룸 미끄럼틀' });
    put('kz_wave', bay * 1.5, DEP + 798, 0, { w: 700, d: 1596, h: MID, color: T.a, name: '키즈룸 웨이브 롤러 경사' });
    put('kz_mat', bay, DEP + 1662 + 260, 0, { w: Math.round(bay * 2), d: 480, h: 60, color: T.a, name: '착지 매트' });
  }
  if (flip) for (const o of out) { o.x = len - o.x; }
  return { items: out, len, depth: DEP + (form === 'L' ? 1960 + 500 : 1662 + 500), poolN, deckN };
}

/** 벽을 따라 놓기: 벽 시작점(ax, ay) → 끝 방향(ux, uy), 안쪽 법선(nx, ny). 시작점에서 off 만큼 떨어져, 벽면에서 gap 만큼 앞으로 */
export function placeKids(res, { ax, ay, ux, uy, nx, ny, off = 300, gap = 30 }, mkItem) {
  const ang = Math.atan2(ny, nx), rotBase = Math.round(((Math.atan2(-nx, ny) * 180) / Math.PI + 360) % 360); /* 지역 +y(앞) = 안쪽 법선 → rot */
  void ang; const its = [];
  for (const o of res.items) {
    const lx = o.x + off, ly = o.y + gap, X = ax + ux * lx + nx * ly, Y = ay + uy * lx + ny * ly;
    its.push(mkItem(o.type, Math.round(X), Math.round(Y), (o.rot + rotBase) % 360, o.over));
  }
  return its;
}

/* ---------- 키즈 구역 (직영점 참고): 벽으로 막힌 키즈룸 + 붙은 룸 ----------
 * 고른 바깥벽 안쪽 면을 따라: [키즈룸 Lk] [룸 Lr] · 깊이 Dk. 홀 쪽 = 강화유리 벽 + 유리문, 키즈룸 | 룸 = 강화유리 벽 + 유리문, 룸 | 홀 = 벽 + 문.
 * 키즈룸 벽면 = 인테리어 시안 (우드 월 패널 LPM N703 · 레드 띠장). frame: { ax, ay (벽 안쪽 면 시작점), ux, uy, nx, ny, wallLen } */
const Z = { wood: '#5b3d29', metal: '#b9bcbf', paint: '#f4f2ec', red: '#a3141a', tb: '#151c2c', ch: '#8a7a55', glass: '#d8eef6' };
const rotOf = (dx, dy) => Math.round((((Math.atan2(-dx, dy) * 180) / Math.PI) % 360 + 360) % 360);
export function kidsZone(o, F, { mkItem, uid }) {
  const { form = 'L', theme = 'brown', Lk = 5000, Dk = 4600, room = true, Lr = 4000, atEnd = false } = o;
  const total = Lk + (room ? Lr : 0), wl = F.wallLen || total + 200, off = atEnd ? Math.max(75, wl - 75 - total) : 75;
  const P = (lx, ly) => [Math.round(F.ax + F.ux * lx + F.nx * ly), Math.round(F.ay + F.uy * lx + F.ny * ly)];
  const walls = [], openings = [], items = [], rooms = [];
  const wall = (a, b, opt = {}) => { const w = { id: uid('w'), x1: a[0], y1: a[1], x2: b[0], y2: b[1], t: 100, h: 3000, color: Z.paint, finish: 'paint', ...opt }; walls.push(w); return w; };
  const len = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  const op = (w, t, type, ww, hh, sill = 0, x = {}) => openings.push({ id: uid('o'), wall: w.id, type, t: Math.round(t), w: Math.round(ww), h: hh, sill, frost: null, ...x });
  const glass = (w, door, dw = 900) => { const Lw = len(w), a = door - dw / 2 - 40, b = door + dw / 2 + 40; op(w, door, 'door1', dw, 2400, 0, { frame: Z.metal, tint: Z.glass, glassLeaf: true, name: '강화유리 문' });
    if (a > 500) op(w, a / 2 + 30, 'full', a - 80, 2600, 0, { frame: Z.metal, tint: Z.glass, fw: 30, name: '강화유리' }); if (Lw - b > 500) op(w, (b + Lw) / 2 - 30, 'full', Lw - b - 80, 2600, 0, { frame: Z.metal, tint: Z.glass, fw: 30, name: '강화유리' }); };
  const x0 = off, x1 = off + Lk, x2 = x1 + (room ? Lr : 0), add = (type, lx, ly, rot, over) => { const p = P(lx, ly); const it = mkItem(type, p[0], p[1], rot, over); items.push(it); return it; };
  const fN = rotOf(F.nx, F.ny), fU = rotOf(F.ux, F.uy), fUm = rotOf(-F.ux, -F.uy), fNm = rotOf(-F.nx, -F.ny); /* 보는 방향 → rot */
  /* 벽 */
  if (x0 > 300) wall(P(x0 - 50, 0), P(x0 - 50, Dk + 50), { name: '키즈룸 옆벽' });
  const gFront = wall(P(x0 - 50, Dk + 30), P(x1, Dk + 30), { color: Z.metal, t: 60, pz: 'glass', name: '키즈룸 | 홀 강화유리 벽' }); glass(gFront, len(gFront) - 800);
  if (room) {
    const gMid = wall(P(x1, 0), P(x1, Dk), { color: Z.metal, t: 60, pz: 'glass', name: '키즈룸 | 룸 강화유리 벽' }); glass(gMid, Dk - 800);
    const rFront = wall(P(x1, Dk + 50), P(x2 + 50, Dk + 50), { name: '룸 | 홀 벽' }); op(rFront, 800, 'door1', 900, 2100, 0, { frame: Z.wood, name: '룸 출입문' });
    if (wl - 75 - x2 > 300) wall(P(x2 + 50, 0), P(x2 + 50, Dk + 50), { name: '룸 옆벽' });
  } else if (wl - 75 - x1 > 300) { const s = wall(P(x1 + 30, 0), P(x1 + 30, Dk + 30), { color: Z.metal, t: 60, pz: 'glass', name: '키즈룸 | 홀 강화유리 벽 (옆)' }); glass(s, Dk / 2); }
  /* 바닥 */
  const poly = (a, b, c, d) => [P(a, b), P(c, b), P(c, d), P(a, d)];
  rooms.push({ id: uid('r'), name: '키즈룸', kind: '키즈룸', pts: poly(x0, 0, x1, Dk), lift: 0, finish: 'tile', color: '#e6dccf', slope: null });
  if (room) rooms.push({ id: uid('r'), name: '룸', kind: '룸', pts: poly(x1, 0, x2, Dk), lift: 0, finish: 'wood', color: '#9a7356', slope: null });
  /* 키즈룸 벽면: 우드 월 패널 · 레드 띠장 · 로고 네온 */
  for (let x = x0; x + 1200 <= x1 - 60; x += 1200) add('pel_wood', x + 600, 9, fN, { w: 1200, h: 3000, name: '키즈룸 벽패널 LPM N703' });
  add('pel_band', (x0 + x1) / 2, 22, fN, { w: Math.max(1200, Lk - 300), elev: 2450, name: '키즈룸 장식 띠장 (레드 아크릴)' });
  for (let y = 0; y + 1200 <= Dk - 100; y += 1200) add('pel_wood', x0 + 9, y + 600, fU, { w: 1200, h: 3000, name: '키즈룸 벽패널 LPM N703 (옆)' });
  add('pel_neon_h', x0 + 25, Dk / 2, fU, { w: 1700, h: 430, elev: 2050, name: '키즈룸 네온사인 (로고)' });
  /* 놀이 구조물: 바깥벽을 따라 2단 + 미끄럼틀 */
  const res = kidsItems({ form, len: Math.max(3600, Lk - 500), theme, flip: false });
  for (const it of placeKids(res, { ax: P(x0 + 200, 0)[0], ay: P(x0 + 200, 0)[1], ux: F.ux, uy: F.uy, nx: F.nx, ny: F.ny, off: 0, gap: 40 }, mkItem)) items.push(it);
  add('f_shoe', x1 - 1900, Dk - 250, fNm, { w: 1000, d: 380, h: 1000, color: '#f2efe8', name: '키즈룸 신발장 (유리문 옆)' });
  add('bench', x1 - 300, Math.max(1000, Dk - 2700), fUm, { w: 1500, d: 400, h: 450, color: Z.red, name: '보호자 벤치' });
  /* 룸: 단체 테이블 · TV · 우드 벽 */
  if (room) {
    const n = Math.max(1, Math.floor((Dk - 600) / 1800)), cx = (x1 + x2) / 2;
    for (let k = 0; k < n; k++) { const cy = 900 + (k + 0.5) * ((Dk - 1200) / n); add('t6', cx, cy, fU, { w: 1800, d: 800, h: 720, color: Z.tb, name: '룸 6인 테이블' });
      for (const d of [-600, 0, 600]) { add('chair', cx - 620, cy + d, fU, { color: Z.ch, name: '의자 CH-03' }); add('chair', cx + 620, cy + d, fUm, { color: Z.ch, name: '의자 CH-03' }); } }
    for (let x = x1 + 100; x + 1200 <= x2 - 100; x += 1200) add('pel_wood', x + 600, 9, fN, { w: 1200, h: 3000, name: '룸 벽패널 LPM N703' });
    add('tv', cx, 40, fN, { elev: 1300, name: '룸 벽걸이 TV' });
  }
  /* 조명 LT-01 */
  const lt = (lx, ly, name) => add('l_mold', lx, ly, 0, { elev: 2920, name, light: { on: true, kind: 'spot', color: '#ffe9d2', power: 1.1, k: 4000, type: 'led' } });
  for (let x = x0 + 1100; x < x1 - 500; x += 2200) for (let y = 1200; y < Dk - 300; y += 1800) lt(x, y, 'LT-01 키즈룸 직부등');
  if (room) for (let x = x1 + 1000; x < x2 - 400; x += 2000) for (let y = 1200; y < Dk - 300; y += 1800) lt(x, y, 'LT-01 룸 직부등');
  return { walls, openings, items, rooms };
}
