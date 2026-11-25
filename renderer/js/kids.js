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
