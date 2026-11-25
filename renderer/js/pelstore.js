// 페리카나 리뉴얼 매뉴얼(2025.01) 그대로 만든 가상 매장 (홀 · 배달 · 키즈형) — 평면도 · 천장도 · 입면도 · 주방집기 리스트 · 머티리얼 스펙 수치
import { kidsItems, placeKids } from './kids.js';
/** kind: 'hall' | 'delivery' · kids: null | 'L' | 'I' (홀 타입 + 키즈룸) */
export function pelStore(kind, { emptyProject, mkItem, uid, kids = null, theme = 'brown' }) {
  const T = 150, H = 75;
  const C = { /* 매뉴얼 04 MATERIAL SPEC */
    PT01: '#f4f2ec', /* Snow White SH 2001B (벽 · 천장) */ PT02: '#9a1a10', /* Poppy Red SH 2173F (게이트) */
    TL01: '#a8805f', /* 홀바닥 GRA-66843SL 600각 */ TL02: '#dedad0', /* 홀바닥 BLT-WHITE 600각 */ TL03: '#9b9996', /* 주방바닥 227 200각 */ TL04: '#eeeeec', /* 주방벽 0100 400x250 */
    LPM01: '#5b3d29', /* 벽패널 N703 (월넛) */ LPM02: '#6e1a20', /* 카운터 전면 3025TX */ IL01: '#a3141a', /* 붙박이 의자 쿠션 SH4686 */ IL02: '#1e1b1a', /* SH4690 */
    MT01: '#b9bcbf', /* SUS 헤어라인 금속프레임 */ SH01: '#e6a22a', /* 골든옐로우 시트 */ TB: '#151c2c', /* 테이블 상판 블랙 · 실버엣지 */
    CH01: '#8fd3b9', /* 민트 */ CH02: '#a3141a', CH03: '#8a7a55', /* 그린(올리브) */ CH04: '#a3141a',
  };
  const K = (k) => (k >= 5500 ? '#f4f6ff' : k >= 4500 ? '#fff4e6' : k >= 3800 ? '#ffe9d2' : '#ffd9b0');
  if (kind !== 'hall') kids = null; /* 키즈룸은 홀 매장만 */
  const KX = kids ? 4600 : 0; /* 키즈룸 · 룸 구역 폭 (홀 왼쪽, 벽 포함) */
  const hall = kind === 'hall', IW = hall ? 7950 : 4350, ID = hall ? 11950 : 7100, W = IW + KX + T, D = ID + T;
  const M = emptyProject(kids ? `페리카나 키즈형 (${kids === 'L' ? 'ㄱ자' : '일자'} 키즈룸 · 매뉴얼 2025.01 홀 타입 기준)` : hall ? '페리카나 홀 타입 (리뉴얼 매뉴얼 2025.01)' : '페리카나 배달 타입 (리뉴얼 매뉴얼 2025.01)', W, D);
  const L = M.levels[0]; L.ceilingH = 3000; L.slabH = 3600; L.ceiling = { on: true, color: C.PT01 };
  M.render = { style: 'real', ssao: true, fxaa: true, shadows: true, sunHour: 14, sunPower: 1.6, exposure: 0.9, itemLights: true };
  const [wB, wR, wF, wL] = L.walls; /* 뒤 · 오른쪽 · 앞 · 왼쪽 (emptyProject 순서) */
  for (const w of L.walls) { w.h = 3000; w.color = C.PT01; w.finish = 'paint'; }
  const X = (x) => H + KX + x, Y = (y) => H + y, XK = (x) => H + x; /* X = 홀 · 주방 (키즈형이면 오른쪽으로 밀림) · XK = 키즈 구역 */
  const add = (type, x, y, rot, over = {}) => { const it = mkItem(type, Math.round(X(x)), Math.round(Y(y)), rot, over); L.items.push(it); return it; };
  const op = (wall, t, type, w, h, sill = 0, over = {}) => L.openings.push({ id: uid('o'), wall: wall.id, type, t: Math.round(t), w, h, sill, frost: null, ...over });
  const tFront = (xc) => W - X(xc), tLeft = (yc) => D - Y(yc), tBack = (xc) => X(xc), tRight = (yc) => Y(yc);
  const lt = (type, x, y, elev, name, k, power, over = {}) => add(type, x, y, 0, { elev, name, light: { on: true, kind: type === 'l_vintage' ? 'point' : 'spot', color: K(k), power, k, type: 'led' }, ...over });
  /* 바닥: 홀 600각 2톤 패턴(센터 기준 · 2×2 칸 중 한 칸 흰색) · 주방 200각 */
  const tile = (a, b, mode) => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = a; g.fillRect(0, 0, 128, 128);
    if (mode === 'one') { g.fillStyle = b; g.fillRect(0, 0, 64, 64); } else { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 32, j * 32, 32, 32); } }
    g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 1.2; for (let k = 0; k <= 128; k += mode === 'one' ? 64 : 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 128); g.moveTo(0, k); g.lineTo(128, k); g.stroke(); } return c.toDataURL('image/png'); };
  const rect = (x0, y0, x1, y1, fx = X) => [[fx(x0), Y(y0)], [fx(x1), Y(y0)], [fx(x1), Y(y1)], [fx(x0), Y(y1)]];
  const PY = hall ? 2930 : 4900; /* 주방 | 홀 경계 (금속프레임 월 중심) */
  L.rooms.push({ id: uid('r'), name: '주방', kind: '주방', pts: rect(0, 0, IW, PY - 50), lift: 0, finish: 'tile', color: C.TL03, slope: null, tex: { img: tile('#a3a19e', '#959390'), size: 400 } });
  L.rooms.push({ id: uid('r'), name: '홀', kind: '홀', pts: rect(0, PY + 50, IW, ID), lift: 0, finish: 'tile', color: C.TL01, slope: null, tex: { img: tile(C.TL01, C.TL02, 'one'), size: 1200 } });
  /* 주방과 홀 사이 금속프레임 월 (동일 등분) */
  const part = { id: uid('w'), pz: 'part', x1: X(0) - H, y1: Y(PY), x2: X(IW) + H, y2: Y(PY), t: 100, h: 3000, color: C.MT01, finish: 'paint' }; L.walls.push(part);
  const tPart = (xc) => X(xc) + H;
  /* 주방 벽 타일 */
  const kitWalls = [wB]; for (const w of kitWalls) { w.finish = 'tile'; w.color = C.TL04; }

  if (hall) {
    /* ---------- 주방 (매뉴얼 p36 · p44 주방집기 리스트) ---------- */
    add('fridge45', 1957, 400, 0, { w: 1300, d: 800, h: 1900, name: '⑨ 4구 냉장냉동고 1300×800×1900 (350W)', kw: 0.35 });
    add('sink1', 2908, 300, 0, { w: 600, d: 600, h: 850, name: '⑧ 싱크대 600×600×850' });
    add('work', 3616, 300, 0, { w: 800, d: 600, h: 850, name: '⑦ 작업대 800×600×850' });
    add('fryer2', 4471, 300, 0, { w: 900, d: 600, h: 1000, name: '⑥ 2구 튀김기 900×600×1000 (31W)', kw: 0.031 });
    add('fryer1', 5226, 300, 0, { w: 600, d: 600, h: 1000, name: '⑤ 1구 튀김기 600×600×1000 (16W)', kw: 0.016 });
    add('range3', 5981, 300, 0, { w: 900, d: 600, h: 850, name: '④ 3구 테이블 렌지 900×600×850' });
    add('sink2', 6880, 350, 0, { w: 900, d: 700, h: 850, name: '⑫ 세척기 싱크대 900×700×850' });
    add('dishwasher', 7625, 325, 0, { w: 650, d: 650, h: 1800, name: '⑪ 식기세척기 650×650×1800 (단상 220V 5kW)', kw: 4.6 });
    add('hood', 5226, 450, 0, { w: 2600, d: 900, h: 500, elev: 1950, name: '후드 (튀김기 · 렌지)' });
    add('hood', 7625, 400, 0, { w: 800, d: 800, h: 450, elev: 2000, name: '후드 (식기세척기)' });
    add('rack', 225, 900, 270, { w: 900, d: 450, h: 2100, name: '⑮ 경량랙 900×450×2100' });
    add('rack', 225, 1800, 270, { w: 900, d: 450, h: 2100, name: '⑮ 경량랙 900×450×2100' });
    add('rack', 1052, 2075, 180, { w: 1200, d: 450, h: 2100, name: '⑮ 경량랙 1200×450×2100' });
    add('k_work18', 2768, PY - 50 - 350, 180, { w: 1800, d: 700, h: 850, name: '③ 작업대 1800×700×850' });
    add('tfridge', 4281, PY - 50 - 350, 180, { w: 1200, d: 700, h: 850, name: '② 테이블 냉장/냉동고 1200×700×850 (253W)', kw: 0.253 });
    add('tfridge', 5334, PY - 50 - 350, 180, { w: 900, d: 700, h: 850, name: '① 밧드 테이블 냉장고 900×700×850 (253W)', kw: 0.253 });
    add('icemaker', 7625, 1150, 90, { w: 515, d: 650, h: 850, name: '⑬ 제빙기 515×650×850' });
    add('showcase', 7650, 1950, 90, { w: 650, d: 585, h: 1850, name: '⑩ 음료 냉장고 650×585×1850 (111.86W)', kw: 0.112 });
    add('purifier', 7720, 2600, 90, { name: '⑭ 정수기' });
    /* 홀 쪽에서 보이는 음료 냉장고 2대 (금속프레임 월 1칸) */
    add('showcase', 700, PY - 343, 0, { w: 650, d: 585, h: 1850, name: '⑩ 음료 냉장고 650×585×1850', kw: 0.112 });
    add('showcase', 1380, PY - 343, 0, { w: 650, d: 585, h: 1850, name: '⑩ 음료 냉장고 650×585×1850', kw: 0.112 });
    op(part, tPart(1040), 'arch', 1400, 1900, 0); /* 음료 냉장고 노출 칸 */
    op(part, tPart(6840), 'arch', 1100, 2250, 0); /* 주방 출입 (5번째 칸) */
    /* ---------- 카운터 · 메뉴 시트커팅 · 천장구조물 (p20 · p37 · p41) ---------- */
    add('counter', 3686, PY + 50 + 350, 0, { w: 4400, d: 700, h: 1050, color: C.LPM02, name: '카운터 FU-01 (전면 LPM 3025TX 메라톤)' });
    add('pel_redpanel', 3686, PY + 50 + 712, 0, { w: 4400, h: 1000, name: '카운터 전면 레드 타공 패널' });
    add('k_beer', 1750, PY + 50 + 300, 0, { elev: 1050, name: '⑮ 생맥주 머신' });
    add('e_pos', 2600, PY + 50 + 250, 0, { elev: 1050, name: 'POS' });
    const menus = ['Beer & Drink', 'Spicy Red Chicken|Soy Sauce Chicken', 'Spicy Red & Sweet Soy Chicken|Hot Devil Chicken', 'Sweet Soy Chicken|Seasoned Chicken'];
    menus.forEach((t, i) => add('pel_menu', 20 + i * 1486 + 733, PY + 60, 0, { w: 1466, h: 600, elev: 2250, signText: t, name: `메뉴 시트커팅 ${i + 1} (골든옐로우 SH-01)` }));
    add('menuboard', 3146, 3450, 0, { elev: 2050, name: '49" 디지털 메뉴보드 (천장구조물 행잉) 1' });
    add('menuboard', 4226, 3450, 0, { elev: 2050, name: '49" 디지털 메뉴보드 (천장구조물 행잉) 2' });
    /* ---------- 홀 오른쪽 벽: 우드 패널 · 가로 네온 · 장식 띠장 · 붙박이 의자 · 돔 미러 (p22 · p39 · p42) ---------- */
    for (let y = 3200; y + 1200 <= 11800; y += 1200) add('pel_wood', IW - 9, y + 600, 90, { w: 1200, h: 3000, elev: 0, name: '벽패널 LPM N703' });
    add('banquette', IW - 300, 7000, 90, { w: 6000, d: 600, h: 950, color: C.IL01, name: '붙박이 의자 FU-02 (인조가죽 IL-01 SH4686)' });
    add('pel_neon_h', IW - 25, 7000, 90, { w: 2100, h: 540, elev: 1600, name: '내부 네온사인 (가로형 · 로고)' });
    add('pel_band', IW - 22, 7000, 90, { w: 5000, elev: 1890, name: '장식 띠장 (레드 아크릴)' });
    for (let k = 0; k < 4; k++) add('pel_dome', IW - 75, 10950, 90, { elev: 650 + k * 560, name: `돔 반사경 360° 500Ø (DP-01) ${k + 1}` });
    /* ---------- 테이블: 붙박이 쪽(CH-02) · 가운데(CH-03) · 창 쪽(CH-01) — 이동가구 TB-01 700×1200 ---------- */
    const rows = [4700, 6300, 7900, 9500];
    const chairs = (cx, cy, rot, color, name, n2 = true) => { /* 테이블 긴 변(가로 1200) 양쪽 2개씩 */ for (const dx of [-300, 300]) { add('chair', cx + dx, cy - 580, 0, { color, name }); if (n2) add('chair', cx + dx, cy + 580, 180, { color, name }); } };
    const midX = 3900;
    for (const y of rows) {
      add('t4', 1000, y, 0, { w: 1200, d: 700, h: 720, color: C.TB, name: '이동 테이블 TB-01 700×1200 (블랙 · 실버엣지)' }); chairs(1000, y, 0, C.CH01, '의자 CH-01 (민트)');
      add('t4', midX, y, 0, { w: 1200, d: 700, h: 720, color: C.TB, name: '이동 테이블 TB-01 700×1200' }); chairs(midX, y, 0, C.CH03, '의자 CH-03 (그린 · 크롬)');
      add('t4', IW - 600 - 350 - 60, y + 150, 90, { w: 1200, d: 700, h: 720, color: C.TB, name: '이동 테이블 TB-01 (붙박이 앞)' });
      for (const dy of [-150, 450]) add('chair', IW - 600 - 700 - 60 - 270, y + dy, 270, { color: C.CH02, name: '의자 CH-02 (레드 회전)' });
    }
    if (kids) { /* ---------- 키즈룸 (벽으로 막힌 별도 공간) + 붙은 룸 · 홀 쪽 벽 = 강화유리 ---------- */
      const YK = 6800, xw = XK(KX - 50), wall = (x1, y1, x2, y2, o = {}) => { const w = { id: uid('w'), x1: Math.round(x1), y1: Math.round(y1), x2: Math.round(x2), y2: Math.round(y2), t: 100, h: 3000, color: C.PT01, finish: 'paint', ...o }; L.walls.push(w); return w; };
      const len = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      const wK = wall(xw, 0, xw, Y(PY + 50), { name: '키즈룸 | 주방 벽' }); void wK;
      const gH = wall(xw, Y(PY + 50), xw, Y(YK), { color: C.MT01, t: 60, pz: 'glass', name: '키즈룸 | 홀 강화유리 벽' });
      const wR = wall(xw, Y(YK), xw, D, { name: '룸 | 홀 벽' });
      const gK = wall(0, Y(YK), xw, Y(YK), { color: C.MT01, t: 60, pz: 'glass', name: '키즈룸 | 룸 강화유리 벽' });
      /* 강화유리 벽: 거의 통째로 유리 + 유리문 */
      const gl = (w, door, dw = 900) => { const Lw = len(w), a = door - dw / 2 - 40, b = door + dw / 2 + 40; op(w, door, 'door1', dw, 2400, 0, { frame: C.MT01, tint: '#d8eef6', glassLeaf: true, name: '강화유리 문' });
        if (a > 500) op(w, a / 2 + 30, 'full', Math.round(a - 80), 2600, 0, { frame: C.MT01, tint: '#d8eef6', fw: 30, name: '강화유리' }); if (Lw - b > 500) op(w, (b + Lw) / 2 - 30, 'full', Math.round(Lw - b - 80), 2600, 0, { frame: C.MT01, tint: '#d8eef6', fw: 30, name: '강화유리' }); };
      gl(gH, 700); gl(gK, len(gK) - 800);
      op(wR, 900, 'door1', 900, 2100, 0, { frame: C.LPM01, name: '룸 출입문' });
      /* 바깥 통창: 키즈룸 · 룸 옆벽 + 룸 앞벽 */
      op(wL, D - Y(YK / 2 + 200), 'full', 4400, 2400, 300, { frame: C.MT01 }); op(wL, D - Y((YK + ID) / 2), 'full', 3800, 2400, 300, { frame: C.MT01 });
      op(wF, W - XK((KX - 100) / 2), 'full', KX - 900, 2400, 300, { frame: C.MT01 });
      /* 바닥: 키즈룸 쿠션 매트 · 룸 우드 */
      L.rooms.push({ id: uid('r'), name: '키즈룸', kind: '키즈룸', pts: rect(0, 0, KX - 100, YK - 30, XK), lift: 0, finish: 'tile', color: '#e6dccf', slope: null, tex: { img: tile('#e9dfd2', '#d9c8b4', 'one'), size: 1000 } });
      L.rooms.push({ id: uid('r'), name: '룸', kind: '룸', pts: rect(0, YK + 30, KX - 100, ID, XK), lift: 0, finish: 'wood', color: '#9a7356', slope: null });
      /* 키즈룸 벽면: 인테리어 시안 (우드 월 패널 LPM N703 · 레드 띠장) */
      for (let x = 0; x + 1200 <= KX - 100; x += 1200) L.items.push(mkItem('pel_wood', Math.round(XK(x + 600)), Math.round(Y(9)), 0, { w: 1200, h: 3000, name: '키즈룸 벽패널 LPM N703' }));
      for (let y = 0; y + 1200 <= PY; y += 1200) L.items.push(mkItem('pel_wood', Math.round(xw - 59), Math.round(Y(y + 600)), 90, { w: 1200, h: 3000, name: '키즈룸 벽패널 LPM N703' }));
      L.items.push(mkItem('pel_band', Math.round(XK((KX - 100) / 2)), Math.round(Y(22)), 0, { w: KX - 200, elev: 2450, name: '키즈룸 장식 띠장 (레드 아크릴)' }));
      L.items.push(mkItem('pel_neon_h', Math.round(xw - 75), Math.round(Y(PY / 2 + 300)), 90, { w: 1700, h: 430, elev: 2000, name: '키즈룸 네온사인 (로고)' }));
      /* 놀이 구조물: 뒷벽을 따라 2단 + 미끄럼틀 (ㄱ자 / 일자) */
      const res = kidsItems({ form: kids, len: KX - 500, theme });
      for (const it of placeKids(res, { ax: XK(0), ay: Y(0), ux: 1, uy: 0, nx: 0, ny: 1, off: 150, gap: 40 }, mkItem)) L.items.push(it);
      L.items.push(mkItem('f_shoe', Math.round(xw - 250), Math.round(Y(PY + 50 + 1400)), 90, { w: 1000, d: 380, h: 1000, color: '#f2efe8', name: '키즈룸 신발장' }));
      L.items.push(mkItem('bench', Math.round(xw - 270), Math.round(Y(YK - 900)), 90, { w: 1500, d: 400, h: 450, color: C.IL01, name: '보호자 벤치' }));
      /* 룸: 단체 테이블 · 우드 벽 · TV */
      for (const [cx, cy] of [[(KX - 100) / 2, YK + 1500], [(KX - 100) / 2, YK + 3300]]) { L.items.push(mkItem('t6', Math.round(XK(cx)), Math.round(Y(cy)), 0, { w: 1800, d: 800, h: 720, color: C.TB, name: '룸 6인 테이블' }));
        for (const dx of [-600, 0, 600]) { L.items.push(mkItem('chair', Math.round(XK(cx + dx)), Math.round(Y(cy - 620)), 0, { color: C.CH03, name: '의자 CH-03' })); L.items.push(mkItem('chair', Math.round(XK(cx + dx)), Math.round(Y(cy + 620)), 180, { color: C.CH03, name: '의자 CH-03' })); } }
      for (let y = YK + 1500; y + 1200 <= ID; y += 1200) L.items.push(mkItem('pel_wood', Math.round(xw - 59), Math.round(Y(y + 600)), 90, { w: 1200, h: 3000, name: '룸 벽패널 LPM N703' }));
      L.items.push(mkItem('tv', Math.round(xw - 90), Math.round(Y(YK + 2400)), 90, { elev: 1300, name: '룸 벽걸이 TV' }));
      const lk = (x, y, n) => L.items.push(mkItem('l_mold', Math.round(XK(x)), Math.round(Y(y)), 0, { elev: 2920, w: 255, d: 255, h: 80, name: n, light: { on: true, kind: 'spot', color: K(4000), power: 1.1, k: 4000, type: 'led' } }));
      for (const x of [1100, 3300]) { for (const y of [1500, 3300, 5300]) lk(x, y, 'LT-01 키즈룸 직부등'); for (const y of [YK + 1500, YK + 3300]) lk(x, y, 'LT-01 룸 직부등'); }
    }
    /* ---------- 창가 바테이블 FU-03 (W400) + CH-04 ---------- */
    for (const [x0, x1] of [[150, 2900], [5050, 7800]]) { const bw = x1 - x0; add('tbar', (x0 + x1) / 2, ID - 200, 180, { w: bw, d: 400, h: 1050, color: C.TB, name: `바테이블 TB-02 W400×${bw}` }); for (let x = x0 + 330; x < x1 - 200; x += 640) add('barchair', x, ID - 650, 0, { color: C.CH04, name: '바 의자 CH-04 (레드)' }); }
    /* ---------- 앞 · 옆 창 · 게이트 (p17 · p27 · p29) ---------- */
    op(wF, tFront(3975), 'door2', 1880, 2400, 0, { frame: C.PT02, fw: 110, name: '게이트 (Poppy Red)' });
    op(wF, tFront(1525), 'full', 2750, 2400, 0, { frame: C.MT01 }); op(wF, tFront(6425), 'full', 2750, 2400, 0, { frame: C.MT01 });
    if (!kids) { op(wL, tLeft(5300), 'full', 3600, 2400, 300, { frame: C.MT01 }); op(wL, tLeft(9050), 'full', 2800, 2400, 300, { frame: C.MT01 }); }
    add('pel_window', 900, ID - 6, 180, { w: 1000, h: 1500, elev: 700, name: '윈도우 시트 (그래픽 문구)' }); add('pel_glass', 7000, ID - 6, 180, { w: 1000, h: 2000, elev: 200, name: '유리 시트커팅 (로고)' });
    add('pel_neon_v', 260, ID - 1200, 0, { elev: 300, name: '내부 네온사인 (세로형 · 기둥)' });
    for (const y of [3260, 10300]) for (const x of kids ? [IW - 250] : [250, IW - 250]) add('column', x, y, 0, { w: 500, d: 700, h: 3000, color: C.PT01, name: '기둥' });
    add('pel_flex', IW / 2, ID + T + 160, 0, { w: 8050, h: 700, elev: 2400, light: { on: true, kind: 'point', color: '#ffffff', power: 1 }, name: '메인간판 LED 플렉스 8M (밝기 조절)' });
    /* ---------- 조명 (p37 천장도 · p58 LIGHTING) ---------- */
    const lx = [940, 2426, 3927, 5428, 6930];
    for (const y of [6280, 9000, 11410]) for (const x of lx) lt('l_mold', x, y, 2920, 'LT-01 LED 몰딩직부 15W (Ø255)', 4000, 1.1, { w: 255, d: 255, h: 80, color: '#d8dadc', kw: 0.015 });
    for (const x of [940, 6930]) lt('l_mold', x, 3800, 2920, 'LT-01 LED 몰딩직부 15W (Ø255)', 4000, 1.1, { w: 255, d: 255, h: 80, color: '#d8dadc', kw: 0.015 });
    for (const x of [2904, 4926]) lt('l_vintage', x, 3627, 2500, 'LT-02 빈티지 형광등 (체인형 · 은색) 1260', 4000, 1.3, { w: 1260, d: 170, h: 120, color: '#c3c7cb', kw: 0.036 });
    for (const x of [1205, 3020, 4835, 6650]) lt('l_flat', x, 1530, 2970, 'LT-03 LED 평판등 600×600 (주방)', 5700, 1.2, { w: 600, d: 600, h: 30, kw: 0.05 });
  } else {
    /* ---------- 배달 타입 주방 (p47 · p53) ---------- */
    add('rack', 500, 225, 0, { w: 1000, d: 450, h: 1800, name: '⑬ 경량랙 1000×450×1800' });
    add('purifier', 1150, 230, 0, { name: '⑪ 정수기' });
    add('fridge45', 1980, 400, 0, { w: 1300, d: 800, h: 1900, name: '⑨ 4구 냉장냉동고 1300×800×1900 (350W)', kw: 0.35 });
    add('sink2', 3045, 350, 0, { w: 900, d: 700, h: 850, name: '⑧ 싱크대 900×700×850' });
    add('work', 3915, 350, 0, { w: 900, d: 700, h: 850, name: '⑦ 작업대 900×700×850' });
    add('range3', IW - 300, 1170, 90, { w: 900, d: 600, h: 850, name: '⑥ 3구 테이블 렌지 900×600×850' });
    add('work', IW - 300, 1820, 90, { w: 700, d: 600, h: 850, name: '⑤ 일반작업대 700×600×850' });
    add('fryer1', IW - 300, 2545, 90, { w: 600, d: 600, h: 1000, name: '④ 1구 튀김기 600×600×1000 (16W)', kw: 0.016 });
    add('fryer2', IW - 300, 3337, 90, { w: 900, d: 600, h: 1000, name: '③ 2구 튀김기 900×600×1000 (31W)', kw: 0.031 });
    add('hood', IW - 450, 2250, 90, { w: 2800, d: 900, h: 500, elev: 1950, name: '후드 (렌지 · 튀김기)' });
    add('work', 2319, 2270, 90, { w: 1500, d: 600, h: 850, name: '② 작업대 1500×600×850 (아일랜드)' });
    add('rack', 678, 2098, 0, { w: 1400, d: 450, h: 1800, name: '⑬ 경량랙 1400×450×1800' });
    add('showcase', 360, 2620, 0, { w: 650, d: 585, h: 1850, name: '⑩ 음료 냉장고 650×585×1850', kw: 0.112 });
    add('showcase', 1010, 2620, 0, { w: 650, d: 585, h: 1850, name: '⑩ 음료 냉장고 650×585×1850', kw: 0.112 });
    L.rooms.push({ id: uid('r'), name: '휴식공간 및 창고', kind: '창고', pts: rect(0, 470, 1100, 1870), lift: 0, finish: 'tile', color: '#b9b6b2', slope: null });
    /* 카운터 줄 (주방 쪽): POS · 생맥주 · 일반작업대 ×2 */
    add('e_pos', 1300, PY - 50 - 250, 180, { elev: 850, name: 'POS' }); add('beer', 1750, PY - 50 - 300, 180, { name: '⑫ 생맥주 머신' });
    add('work', 2611, PY - 50 - 300, 180, { w: 1200, d: 600, h: 850, name: '① 일반작업대 1200×600×850' });
    add('work', 3771, PY - 50 - 300, 180, { w: 1200, d: 600, h: 850, name: '① 일반작업대 1200×600×850' });
    /* 금속프레임 월: 스윙도어 · ORDER · PICK UP 창 · 메뉴 시트커팅 (p21 · p49) */
    op(part, tPart(585), 'door1', 900, 2100, 0, { frame: C.MT01, name: '스윙도어' });
    op(part, tPart(1700), 'pass', 1000, 700, 1050, { frame: C.MT01, name: 'ORDER' }); op(part, tPart(3770), 'pass', 1000, 700, 1050, { frame: C.MT01, name: 'PICK UP' });
    const bays = [[1170, 2230], [2230, 3290], [3290, 4350]], txt = ['Fried Chicken|Order', 'Half & Half Chicken|Beer & Drink', 'Seasoned Chicken|Pick Up'];
    bays.forEach(([a, b], i) => { add('pel_menu', (a + b) / 2, PY + 60, 0, { w: b - a - 20, h: 600, elev: 2250, signText: txt[i], name: `메뉴 시트커팅 ${i + 1}` }); add('pel_redpanel', (a + b) / 2, PY + 62, 0, { w: b - a - 20, h: 1050, name: '레드 하부 판넬 IL-01' }); });
    add('tbar', 2760, PY + 50 + 200, 0, { w: 3180, d: 400, h: 1050, elev: 0, color: C.TB, name: '카운터 상판 FU-04 (블랙 · 실버 엣지)' });
    add('menuboard', 2760, PY + 95, 0, { elev: 1250, name: '49" 디지털 메뉴보드' });
    /* 홀: 창가 바테이블 FU-05 + CH-04 */
    add('tbar', 1550, ID - 200, 180, { w: 3000, d: 400, h: 1050, color: C.TB, name: '바테이블 TB-02 W400×3000' });
    for (let x = 400; x < 3000; x += 640) add('barchair', x, ID - 650, 0, { color: C.CH04, name: '바 의자 CH-04 (레드)' });
    op(wF, tFront(3830), 'door1', 900, 2400, 0, { frame: C.PT02, fw: 100, name: '게이트 (Poppy Red)' });
    op(wF, tFront(1600), 'full', 3100, 2400, 0, { frame: C.MT01 });
    add('pel_window', 800, ID - 6, 180, { w: 1000, h: 1500, elev: 700, name: '윈도우 시트 (그래픽 문구)' }); add('pel_glass', 2300, ID - 6, 180, { w: 1000, h: 2000, elev: 200, name: '유리 시트커팅 (로고)' });
    add('pel_wood', 9, 6000, 270, { w: 2000, h: 3000, name: '벽패널 LPM N703' }); add('pel_wood', IW - 9, 6000, 90, { w: 2000, h: 3000, name: '벽패널 LPM N703' });
    add('pel_flex', IW / 2, ID + T + 160, 0, { w: 4500, h: 700, elev: 2400, light: { on: true, kind: 'point', color: '#ffffff', power: 1 }, name: '메인간판 LED 플렉스 4.5M (밝기 조절)' });
    /* 조명 (p48 천장도) */
    for (const [x, y] of [[1300, 1250], [3000, 1250], [1300, 3400], [3000, 3400]]) lt('l_flat', x, y, 2970, 'LT-03 LED 평판등 600×600 (주방)', 5700, 1.2, { w: 600, d: 600, h: 30, kw: 0.05 });
    for (const x of [800, 2175, 3550]) lt('l_mold', x, 6000, 2920, 'LT-01 LED 몰딩직부 15W (Ø255)', 4000, 1.1, { w: 255, d: 255, h: 80, color: '#d8dadc', kw: 0.015 });
    lt('l_vintage', 2300, PY + 450, 2500, 'LT-02 빈티지 형광등 1260 (카운터 상부)', 4000, 1.2, { w: 1260, d: 170, h: 120, color: '#c3c7cb', kw: 0.036 });
  }
  return M;
}
