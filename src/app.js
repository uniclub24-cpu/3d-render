/* 도면 스튜디오 · 단일 파일 편집기 (오프라인 동작) */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* ---------- 레이어 ---------- */
const LAYERS = [
  { id: 'ceiling', name: '천장', color: '#a7b4c2', fixed: true },
  { id: 'floorL', name: '바닥', color: '#c8a27a', fixed: true },
  { id: 'floor', name: '바닥 설치 (1단)', color: '#7fa7c9' },
  { id: 'upper', name: '2단 설치 (벽·상부)', color: '#9bd18b' },
  { id: 'ceil', name: '천장 공사', color: '#c9a0f2' },
  { id: 'elec', name: '전기 · 전열', color: '#f2d24a' },
  { id: 'plumb', name: '배수 · 급수 · 가스', color: '#4fc3f7' },
  { id: 'deco', name: '인테리어 · 식물', color: '#7cd6a4' },
  { id: 'sketch', name: '낙서 · 메모', color: '#ff375f' }
];
const LINEKINDS = {
  wire: { name: '전기 배선', color: '#f2d24a', layer: 'elec', z: 'floor', w: 30 },
  ceilwire: { name: '천장 속 배선', color: '#c9a0f2', layer: 'ceil', z: 'above', w: 30 },
  water: { name: '급수 배관', color: '#4f9cf9', layer: 'plumb', z: 'floor', w: 40 },
  drainpipe: { name: '배수 배관', color: '#38c1b0', layer: 'plumb', z: 'floor', w: 80 },
  gas: { name: '가스 배관', color: '#f28b3a', layer: 'plumb', z: 'mid', w: 30 },
  duct: { name: '환기 덕트', color: '#a9adb5', layer: 'ceil', z: 'above', w: 300 },
  supplyDuct: { name: '급기관', color: '#7fb3d5', layer: 'ceil', z: 'above', w: 250 },
  exhaustDuct: { name: '배기관', color: '#b0a49a', layer: 'ceil', z: 'above', w: 300 },
  lan: { name: '랜선', color: '#5856d6', layer: 'ceil', z: 'above', w: 10 },
  embDrain: { name: '매립 배수관', color: '#38c1b0', layer: 'floorL', z: 'below', w: 100 },
  embWater: { name: '매립 급수관', color: '#4f9cf9', layer: 'floorL', z: 'below', w: 25 },
  embConduit: { name: '매립 전선관', color: '#f2d24a', layer: 'floorL', z: 'below', w: 22 },
  embCable: { name: '매립 케이블', color: '#ff9f0a', layer: 'floorL', z: 'below', w: 15 },
  embGas: { name: '매립 가스관', color: '#f28b3a', layer: 'floorL', z: 'below', w: 25 },
  cPipe: { name: '천장 배관', color: '#a9adb5', layer: 'ceiling', z: 'hang', w: 50 },
  cWire: { name: '천장 전선', color: '#2b2d31', layer: 'ceiling', z: 'hang', w: 12 },
  cFrame: { name: '천장틀 (M바)', color: '#8f98a3', layer: 'ceiling', z: 'frame', w: 40 }
};
const PIPEMAT = { stainless: ['스테인리스', '#c9ced4'], steel: ['철제', '#6e7378'], plastic: ['플라스틱', '#e8e8e8'], pvc: ['PVC관', '#7a9cc6'], wire: ['일반전선', '#2b2d31'] };
let lineOpts = store.get('drs_lopt', { depth: 80, dia: 0, off: 300, mat: '' });
function lineExtra(kind) { const k = LINEKINDS[kind]; if (!k || !['below', 'hang'].includes(k.z)) return {}; const o = {}; if (lineOpts.dia) o.w = lineOpts.dia; if (k.z === 'below') o.depth = lineOpts.depth; if (k.z === 'hang') o.off = lineOpts.off; if (lineOpts.mat) o.mat = lineOpts.mat; return o; }
function lineColor(l) { return l.color || (l.mat && PIPEMAT[l.mat] ? PIPEMAT[l.mat][1] : LINEKINDS[l.kind].color); }
const FINISH = {
  wall: { paint: '페인트', film: '필름 (단색)', filmwood: '필름 (우드)', tile: '타일', brick: '벽돌' },
  floor: { epoxy: '에폭시', tile: '타일', wood: '우드', concrete: '콘크리트' },
  item: { matte: '무광', gloss: '유광', wood: '우드', steel: '스테인리스' }
};
const MATS = {
  paint: { n: '페인트', tex: 'plain' }, wood: { n: '목재', tex: 'wood' }, plywood: { n: '합판', tex: 'plywood' }, marble: { n: '대리석', tex: 'marble' },
  steel: { n: '스테인리스', tex: 'steel' }, plastic: { n: '플라스틱', tex: 'plastic' }, glass: { n: '투명유리', tex: 'plain', a: 0.3 }, frosted: { n: '반투명유리', tex: 'frost', a: 0.66 },
  turf: { n: '인조잔디', tex: 'grass' }, tile: { n: '타일', tex: 'tile' }, film: { n: '필름', tex: 'plain' }, filmwood: { n: '우드 필름', tex: 'filmwood' },
  brick: { n: '벽돌', tex: 'brick' }, epoxy: { n: '에폭시', tex: 'epoxy' }, concrete: { n: '콘크리트', tex: 'concrete' }
};
const normMat = (m) => ({ matte: 'paint', gloss: 'plastic' }[m] || (MATS[m] ? m : 'paint'));
const matOpts = Object.fromEntries(Object.entries(MATS).map(([k, v]) => [k, v.n]));
const matTex = (m) => MATS[normMat(m)].tex, matA = (m) => MATS[normMat(m)].a;
const STD0 = { frameW: 50, grid: 50, tileWall: 600, tileFloor: 600, wallT: 150, aisle: 900, fryerW: 450, fryerD: 600, sizes: {} };
const STD_ITEMS = ['fridge45', 'fridge25', 'tfridge', 'work2', 'sink2', 'range', 'dishwasher', 'counter', 't4', 't2', 'chair', 'banquette'];
function std() { if (!P.std) P.std = JSON.parse(JSON.stringify(store.get('drs_std', STD0))); P.std.sizes = P.std.sizes || {}; return P.std; }
function libSize(id) {
  const L = libGet(id), s = P ? std() : STD0;
  if (L.shape === 'fryer' && L.cat === '주방') { const n = Math.max(1, Math.round(L.w / 450)); return { w: n * s.fryerW, d: s.fryerD, h: L.h }; }
  const o = (s.sizes || {})[id] || {}; return { w: o.w || L.w, d: o.d || L.d, h: o.h || L.h };
}
const PALETTE = ['#f4f2ee', '#e6e1d8', '#c9c3b8', '#8f8a82', '#4a4846', '#1f1f22', '#d8b48c', '#b48a62', '#8a5f3c', '#5e3d26',
  '#c8102e', '#e0672b', '#f2b33d', '#e9d79a', '#6b8f4e', '#2f5d50', '#9fc2d6', '#3d6a9e', '#1f3550', '#c9ccd0'];

/* ---------- 기물 라이브러리 ---------- */
const S = '#c9ced4', DK = '#3a3e44', WH = '#f4f2ee', WD = '#b48a62', RED = '#c8102e', GR = '#5d8f4e';
const LIB = [
  // 주방
  { id: 'fridge45', name: '45박스 냉장고', cat: '주방', shape: 'fridge', w: 1260, d: 800, h: 1900, layer: 'floor', color: S, mat: 'steel', kw: 0.6 },
  { id: 'fridge25', name: '25박스 냉장고', cat: '주방', shape: 'fridge', w: 700, d: 800, h: 1900, layer: 'floor', color: S, mat: 'steel', kw: 0.4 },
  { id: 'tfridge', name: '테이블 냉장고', cat: '주방', shape: 'tfridge', w: 1500, d: 700, h: 850, layer: 'floor', color: S, mat: 'steel', kw: 0.4 },
  { id: 'work', name: '작업대', cat: '주방', shape: 'work', w: 1200, d: 600, h: 850, layer: 'floor', color: S, mat: 'steel' },
  { id: 'work2', name: '2단 작업대', cat: '주방', shape: 'work2', w: 1500, d: 600, h: 850, layer: 'floor', color: S, mat: 'steel' },
  { id: 'sink1', name: '1조 싱크', cat: '주방', shape: 'sink', w: 900, d: 600, h: 850, layer: 'floor', color: S, mat: 'steel', drain: 1 },
  { id: 'sink2', name: '2조 싱크', cat: '주방', shape: 'sink', w: 1200, d: 600, h: 850, layer: 'floor', color: S, mat: 'steel', drain: 1 },
  { id: 'fryer4', name: '튀김기 4구', cat: '주방', shape: 'fryer', w: 1800, d: 600, h: 950, layer: 'floor', color: '#8b9198', mat: 'steel', gas: 1, hood: 1 },
  { id: 'fryer1', name: '튀김기 1구', cat: '주방', shape: 'fryer', w: 450, d: 600, h: 950, layer: 'floor', color: '#8b9198', mat: 'steel', gas: 1, hood: 1 },
  { id: 'fryer2', name: '튀김기 2구', cat: '주방', shape: 'fryer', w: 900, d: 600, h: 950, layer: 'floor', color: '#8b9198', mat: 'steel', gas: 1, hood: 1 },
  { id: 'range', name: '낮은 레인지', cat: '주방', shape: 'range', w: 1200, d: 700, h: 450, layer: 'floor', color: DK, mat: 'steel', gas: 1, hood: 1 },
  { id: 'range3', name: '화구 3구 레인지', cat: '주방', shape: 'range', w: 1500, d: 750, h: 800, layer: 'floor', color: DK, mat: 'steel', gas: 1, hood: 1 },
  { id: 'dishwasher', name: '식기세척기 (도어형)', cat: '주방', shape: 'box', w: 650, d: 700, h: 1450, layer: 'floor', color: S, mat: 'steel', drain: 1, kw: 6 },
  { id: 'icemaker', name: '제빙기', cat: '주방', shape: 'fridge', w: 600, d: 700, h: 1600, layer: 'floor', color: S, mat: 'steel', drain: 1, kw: 0.5 },
  { id: 'holding', name: '보관대 · 보온대', cat: '주방', shape: 'rack', w: 750, d: 350, h: 1100, layer: 'floor', color: S, mat: 'steel', kw: 1 },
  { id: 'rack', name: '4단 랙', cat: '주방', shape: 'rack', w: 1200, d: 450, h: 1800, layer: 'floor', color: S, mat: 'steel' },
  { id: 'tank', name: '물통 · 정수기', cat: '주방', shape: 'tank', w: 450, d: 450, h: 600, layer: 'floor', color: '#8cc4e8', mat: 'gloss' },
  { id: 'hood', name: '후드', cat: '주방', shape: 'hood', w: 2000, d: 900, h: 500, elev: 1900, layer: 'upper', color: S, mat: 'steel' },
  { id: 'shelf', name: '벽선반', cat: '주방', shape: 'shelf', w: 1200, d: 350, h: 40, elev: 1500, layer: 'upper', color: S, mat: 'steel' },
  { id: 'uppercab', name: '상부장', cat: '주방', shape: 'box', w: 1200, d: 350, h: 600, elev: 1500, layer: 'upper', color: S, mat: 'steel' },
  { id: 'showcase', name: '음료 쇼케이스', cat: '주방', shape: 'showcase', w: 1200, d: 650, h: 1900, layer: 'floor', color: '#2b2d31', mat: 'gloss', kw: 0.6 },
  // 홀 가구
  { id: 't2', name: '2인 테이블', cat: '테이블', shape: 'table', w: 600, d: 700, h: 750, layer: 'floor', color: WH, mat: 'matte' },
  { id: 't4', name: '4인 테이블', cat: '테이블', shape: 'table', w: 1200, d: 700, h: 750, layer: 'floor', color: WH, mat: 'matte' },
  { id: 't6', name: '6인 테이블', cat: '테이블', shape: 'table', w: 1800, d: 700, h: 750, layer: 'floor', color: WH, mat: 'matte' },
  { id: 'tround', name: '원형 테이블', cat: '테이블', shape: 'roundtable', w: 800, d: 800, h: 750, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'tbar', name: '바 테이블', cat: '테이블', shape: 'table', w: 1200, d: 500, h: 1050, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'counter', name: '카운터', cat: '테이블', shape: 'counter', w: 1800, d: 700, h: 1050, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'chair', name: '의자 (등받이)', cat: '의자', shape: 'chair', w: 420, d: 450, h: 850, layer: 'floor', color: RED, mat: 'gloss' },
  { id: 'stool', name: '스툴', cat: '의자', shape: 'stool', w: 380, d: 380, h: 450, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'barchair', name: '바 체어', cat: '의자', shape: 'barchair', w: 420, d: 420, h: 1050, layer: 'floor', color: DK, mat: 'matte' },
  { id: 'bench', name: '벤치', cat: '의자', shape: 'bench', w: 1200, d: 400, h: 450, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'banquette', name: '붙박이 소파', cat: '의자', shape: 'sofa', w: 1800, d: 600, h: 900, layer: 'floor', color: RED, mat: 'gloss' },
  { id: 'lounge', name: '라운지 체어', cat: '의자', shape: 'sofa', w: 700, d: 700, h: 750, layer: 'floor', color: '#3d6a9e', mat: 'matte' },
  // 인테리어
  { id: 'zone', name: '바닥 구역 (마감)', cat: '인테리어', shape: 'zone', w: 3000, d: 3000, h: 3, layer: 'deco', color: '#c9ccd0', mat: 'matte' },
  { id: 'glasspart', name: '유리 파티션', cat: '인테리어', shape: 'box', w: 1200, d: 40, h: 1800, layer: 'deco', color: '#bfe3f5', mat: 'glass' },
  { id: 'turfmat', name: '인조잔디 매트', cat: '인테리어', shape: 'zone', w: 2000, d: 1500, h: 3, layer: 'deco', color: '#5f9a3e', mat: 'turf' },
  { id: 'frame', name: '액자', cat: '인테리어', shape: 'frame', w: 600, d: 30, h: 800, elev: 1200, layer: 'upper', color: '#2b2d31', mat: 'wood' },
  { id: 'wallbox', name: '부착 박스', cat: '인테리어', shape: 'cube', w: 600, d: 300, h: 400, elev: 1000, layer: 'upper', color: '#e6e1d8', mat: 'paint' },
  { id: 'walldisc', name: '원형 부착물', cat: '인테리어', shape: 'disc', w: 600, d: 60, h: 600, elev: 1300, layer: 'upper', color: '#c8102e', mat: 'plastic' },
  { id: 'cube', name: '박스', cat: '인테리어', shape: 'cube', w: 600, d: 600, h: 600, layer: 'floor', color: '#d8b48c', mat: 'plywood' },
  { id: 'roundcol', name: '원형 구조물', cat: '인테리어', shape: 'cylinder', w: 600, d: 600, h: 1200, layer: 'floor', color: '#e6e1d8', mat: 'paint' },
  { id: 'wallvent', name: '환기구 (벽)', cat: '설비', shape: 'vent', w: 300, d: 40, h: 300, elev: 2300, layer: 'upper', color: '#d9dde2', mat: 'steel' },
  { id: 'brace', name: '보강재', cat: '인테리어', shape: 'cube', w: 1200, d: 40, h: 90, elev: 1000, layer: 'upper', color: '#d8b48c', mat: 'plywood' },
  // 주방 추가
  { id: 'freezer45', name: '45박스 냉동고', cat: '주방', shape: 'fridge', w: 1260, d: 800, h: 1900, layer: 'floor', color: '#b9c3cc', mat: 'steel', kw: 0.9 },
  { id: 'sink3', name: '3조 세척 싱크', cat: '주방', shape: 'sink', w: 1800, d: 600, h: 850, layer: 'floor', color: S, mat: 'steel', drain: 1 },
  { id: 'handsink', name: '손 씻기 싱크', cat: '주방', shape: 'sink', w: 450, d: 400, h: 850, layer: 'floor', color: S, mat: 'steel', drain: 1 },
  { id: 'sterilizer', name: '식기 소독고', cat: '주방', shape: 'box', w: 600, d: 450, h: 1500, layer: 'floor', color: S, mat: 'steel', kw: 1.5 },
  { id: 'soupkettle', name: '회전 국솥', cat: '주방', shape: 'cylinder', w: 900, d: 900, h: 900, layer: 'floor', color: S, mat: 'steel', gas: 1, hood: 1 },
  { id: 'griddle', name: '그리들', cat: '주방', shape: 'range', w: 900, d: 700, h: 900, layer: 'floor', color: DK, mat: 'steel', gas: 1, hood: 1 },
  { id: 'oven', name: '컨벡션 오븐', cat: '주방', shape: 'box', w: 900, d: 800, h: 1000, layer: 'floor', color: '#5a5f66', mat: 'steel', kw: 6, hood: 1 },
  { id: 'ricewarmer', name: '밥 보온고', cat: '주방', shape: 'box', w: 600, d: 600, h: 1300, layer: 'floor', color: S, mat: 'steel', kw: 1 },
  { id: 'waste', name: '음식물 처리기', cat: '주방', shape: 'cube', w: 500, d: 600, h: 900, layer: 'floor', color: '#8f8a82', mat: 'plastic', drain: 1, kw: 1 },
  { id: 'purifier', name: '정수기', cat: '주방', shape: 'cube', w: 350, d: 450, h: 1200, layer: 'floor', color: WH, mat: 'plastic', kw: 0.3 },
  { id: 'returnc', name: '퇴식대', cat: '주방', shape: 'work2', w: 1200, d: 600, h: 900, layer: 'floor', color: S, mat: 'steel' },
  // 홀
  { id: 'kiosk', name: '키오스크', cat: '테이블', shape: 'cube', w: 600, d: 400, h: 1600, layer: 'floor', color: '#2b2d31', mat: 'plastic', kw: 0.3 },
  { id: 'pos', name: '포스 · 계산대', cat: '테이블', shape: 'counter', w: 1200, d: 600, h: 1050, layer: 'floor', color: WD, mat: 'wood', kw: 0.2 },
  // 주거
  { id: 'bedQ', name: '퀸 침대', cat: '주거', sub: '침실', shape: 'bed', w: 1500, d: 2000, h: 450, layer: 'floor', color: '#b48a62', mat: 'wood' },
  { id: 'bedS', name: '싱글 침대', cat: '주거', sub: '침실', shape: 'bed', w: 1000, d: 2000, h: 450, layer: 'floor', color: '#b48a62', mat: 'wood' },
  { id: 'wardrobe', name: '붙박이장', cat: '주거', sub: '침실', shape: 'cube', w: 1800, d: 600, h: 2400, layer: 'floor', color: '#e6e1d8', mat: 'paint' },
  { id: 'desk', name: '책상', cat: '주거', sub: '침실', shape: 'table', w: 1200, d: 600, h: 740, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'sofa3', name: '3인 소파', cat: '주거', sub: '거실', shape: 'sofa', w: 2100, d: 900, h: 800, layer: 'floor', color: '#8f8a82', mat: 'paint' },
  { id: 'tvstand', name: '거실장', cat: '주거', sub: '거실', shape: 'cube', w: 1800, d: 450, h: 450, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'dtable', name: '식탁 4인', cat: '주거', sub: '거실', shape: 'table', w: 1400, d: 800, h: 750, layer: 'floor', color: WD, mat: 'wood' },
  { id: 'homesink', name: '싱크대 (가정용)', cat: '주거', sub: '주방 · 다용도', shape: 'sink', w: 2400, d: 600, h: 850, layer: 'floor', color: '#f4f2ee', mat: 'paint', drain: 1 },
  { id: 'homefridge', name: '양문형 냉장고', cat: '주거', sub: '주방 · 다용도', shape: 'fridge', w: 900, d: 750, h: 1800, layer: 'floor', color: '#c9ced4', mat: 'steel', kw: 0.5 },
  { id: 'washer', name: '세탁기', cat: '주거', sub: '주방 · 다용도', shape: 'cube', w: 600, d: 650, h: 850, layer: 'floor', color: '#f4f2ee', mat: 'plastic', drain: 1, kw: 1 },
  { id: 'toilet', name: '양변기', cat: '주거', sub: '욕실', shape: 'toilet', w: 400, d: 700, h: 780, layer: 'floor', color: '#f7f7f7', mat: 'plastic', drain: 1 },
  { id: 'washbasin', name: '세면대', cat: '주거', sub: '욕실', shape: 'sink', w: 600, d: 450, h: 850, layer: 'floor', color: '#f7f7f7', mat: 'plastic', drain: 1 },
  { id: 'bathtub', name: '욕조', cat: '주거', sub: '욕실', shape: 'tub', w: 1500, d: 750, h: 550, layer: 'floor', color: '#f7f7f7', mat: 'plastic', drain: 1 },
  { id: 'shower', name: '샤워 부스', cat: '주거', sub: '욕실', shape: 'cube', w: 900, d: 900, h: 2000, layer: 'floor', color: '#cfe8f3', mat: 'glass', drain: 1 },
  // 벽 설비
  { id: 'access', name: '벽 점검구', cat: '벽 설비', sub: '점검 · 설비', shape: 'frame', w: 450, d: 30, h: 450, elev: 1200, layer: 'upper', color: '#e6e1d8', mat: 'paint', fw: 25, art: '#f4f2ee' },
  { id: 'distbox', name: '배전함', cat: '벽 설비', sub: '점검 · 설비', shape: 'cube', w: 600, d: 200, h: 800, elev: 1000, layer: 'elec', color: '#8f8a82', mat: 'steel' },
  { id: 'holeR', name: '타공 구멍 (원형)', cat: '벽 설비', sub: '점검 · 설비', shape: 'disc', w: 150, d: 200, h: 150, elev: 1500, layer: 'upper', color: '#1d1d1f', mat: 'paint' },
  { id: 'holeS', name: '타공 구멍 (사각)', cat: '벽 설비', sub: '점검 · 설비', shape: 'cube', w: 300, d: 200, h: 200, elev: 2300, layer: 'upper', color: '#1d1d1f', mat: 'paint' },
  { id: 'aircurtain', name: '에어커튼', cat: '벽 설비', sub: '점검 · 설비', shape: 'cube', w: 900, d: 200, h: 220, elev: 2200, layer: 'upper', color: WH, mat: 'plastic', kw: 0.3 },
  { id: 'hydrant', name: '옥내 소화전', cat: '벽 설비', sub: '소방 · 안전', shape: 'cube', w: 650, d: 200, h: 1300, elev: 300, layer: 'upper', color: '#c8102e', mat: 'steel' },
  { id: 'extinguisher', name: '소화기', cat: '벽 설비', sub: '소방 · 안전', shape: 'cylinder', w: 180, d: 180, h: 500, layer: 'floor', color: '#c8102e', mat: 'gloss' },
  { id: 'exitsign', name: '비상구 유도등', cat: '벽 설비', sub: '소방 · 안전', shape: 'cube', w: 360, d: 60, h: 150, elev: 2200, layer: 'upper', color: '#34c759', mat: 'plastic', kw: 0.01 },
  { id: 'intercom', name: '인터폰', cat: '벽 설비', sub: '기타', shape: 'cube', w: 120, d: 40, h: 180, elev: 1400, layer: 'elec', color: WH, mat: 'plastic' },
  { id: 'mirror', name: '거울', cat: '벽 설비', sub: '기타', shape: 'frame', w: 600, d: 20, h: 900, elev: 900, layer: 'upper', color: '#c9ced4', mat: 'steel', fw: 15, art: '#dfe9ee' },
  // 천장 설비
  { id: 'sprinkler', name: '스프링클러 헤드', cat: '천장 설비', sub: '소방', shape: 'sprinkler', w: 90, d: 90, h: 60, layer: 'ceil', color: '#c0c4ca', mat: 'steel' },
  { id: 'smokedet', name: '화재 감지기', cat: '천장 설비', sub: '소방', shape: 'cylinder', w: 110, d: 110, h: 45, layer: 'ceil', color: '#f4f2ee', mat: 'plastic' },
  { id: 'emlight', name: '비상 조명등', cat: '천장 설비', sub: '소방', shape: 'cube', w: 300, d: 120, h: 60, layer: 'ceil', color: '#f4f2ee', mat: 'plastic', kw: 0.01 },
  { id: 'supply', name: '급기구 (디퓨저)', cat: '천장 설비', sub: '공조 · 냉난방', shape: 'cassette', w: 450, d: 450, h: 40, layer: 'ceil', color: '#e6e9ec', mat: 'steel' },
  { id: 'exhaust', name: '배기구 (그릴)', cat: '천장 설비', sub: '공조 · 냉난방', shape: 'cassette', w: 400, d: 400, h: 40, layer: 'ceil', color: '#9aa1a9', mat: 'steel' },
  { id: 'fan', name: '환기팬', cat: '천장 설비', sub: '공조 · 냉난방', shape: 'cassette', w: 300, d: 300, h: 150, layer: 'ceil', color: WH, mat: 'plastic', kw: 0.1 },
  { id: 'tracklight', name: '조명 레일', cat: '천장 설비', sub: '조명', shape: 'track', w: 2000, d: 40, h: 120, layer: 'ceil', color: '#2b2d31', mat: 'paint', kw: 0.06 },
  { id: 'ceilaccess', name: '천장 점검구', cat: '천장 설비', sub: '배관 · 배선', shape: 'cassette', w: 450, d: 450, h: 20, layer: 'ceil', color: '#f4f2ee', mat: 'paint' },
  { id: 'anchor', name: '앵커볼트', cat: '천장 설비', sub: '천장 구조', shape: 'mark', mk: 'A', w: 60, d: 60, h: 60, layer: 'ceiling', color: '#8f98a3' },
  { id: 'hanger', name: '행거볼트', cat: '천장 설비', sub: '천장 구조', shape: 'rod', mk: 'H', w: 60, d: 60, h: 60, layer: 'ceiling', color: '#8f98a3' },
  // 바닥 · 배관
  { id: 'cleanout', name: '바닥 점검구', cat: '바닥·배관', shape: 'drainpt', w: 300, d: 300, h: 6, layer: 'plumb', color: '#6f7780' },
  // 전기 · 통신
  { id: 'lanport', name: '랜 포트', cat: '전기', shape: 'mark', mk: 'L', w: 120, d: 120, h: 120, elev: 300, layer: 'elec', color: '#5856d6' },
  { id: 'tvport', name: 'TV 단자', cat: '전기', shape: 'mark', mk: 'T', w: 120, d: 120, h: 120, elev: 300, layer: 'elec', color: '#af52de' },
  { id: 'cctv', name: 'CCTV', cat: '전기', shape: 'cylinder', w: 120, d: 120, h: 120, layer: 'ceil', color: '#f4f2ee', mat: 'plastic', kw: 0.01 },
  { id: 'partition', name: '파티션', cat: '인테리어', shape: 'box', w: 1200, d: 60, h: 1500, layer: 'deco', color: WD, mat: 'wood' },
  { id: 'column', name: '기둥', cat: '인테리어', shape: 'box', w: 600, d: 600, h: 2700, layer: 'floor', color: '#d5d0c8', mat: 'matte' },
  { id: 'bulkhead', name: '천장 가벽', cat: '인테리어', shape: 'bulkhead', w: 2000, d: 150, h: 300, layer: 'ceil', color: '#ece8e1', mat: 'matte' },
  { id: 'tv', name: '벽걸이 TV', cat: '인테리어', shape: 'box', w: 1250, d: 60, h: 720, elev: 1600, layer: 'upper', color: '#111111', mat: 'gloss', kw: 0.2 },
  // 플랜테리어 10종
  { id: 'monstera', name: '몬스테라', cat: '식물', shape: 'plant', v: 'monstera', w: 600, d: 600, h: 1100, layer: 'deco', color: GR },
  { id: 'olive', name: '올리브 나무', cat: '식물', shape: 'plant', v: 'olive', w: 600, d: 600, h: 1800, layer: 'deco', color: '#8a9a6a' },
  { id: 'rubber', name: '고무나무', cat: '식물', shape: 'plant', v: 'rubber', w: 500, d: 500, h: 1500, layer: 'deco', color: '#2f5d3a' },
  { id: 'stucky', name: '스투키', cat: '식물', shape: 'plant', v: 'stucky', w: 350, d: 350, h: 800, layer: 'deco', color: '#4d6b45' },
  { id: 'hanging', name: '행잉 플랜트', cat: '식물', shape: 'plant', v: 'hanging', w: 400, d: 400, h: 700, elev: 1800, layer: 'ceil', color: '#5d8f4e' },
  { id: 'planterbox', name: '플랜터 박스', cat: '식물', shape: 'plant', v: 'box', w: 1200, d: 400, h: 900, layer: 'deco', color: '#5d8f4e' },
  { id: 'mosswall', name: '이끼 벽', cat: '식물', shape: 'plant', v: 'moss', w: 1200, d: 60, h: 900, elev: 900, layer: 'upper', color: '#6b8f3e' },
  { id: 'bamboo', name: '대나무', cat: '식물', shape: 'plant', v: 'bamboo', w: 500, d: 500, h: 2300, layer: 'deco', color: '#7aa04a' },
  { id: 'cactus', name: '선인장', cat: '식물', shape: 'plant', v: 'cactus', w: 400, d: 400, h: 1200, layer: 'deco', color: '#5f8a4a' },
  { id: 'palm', name: '아레카 야자', cat: '식물', shape: 'plant', v: 'palm', w: 800, d: 800, h: 1700, layer: 'deco', color: '#6a9a45' },
  // 에어컨 · 환기
  { id: 'ac_wall', name: '벽걸이 에어컨', cat: '설비', shape: 'acwall', w: 900, d: 250, h: 300, elev: 2200, layer: 'upper', color: WH, mat: 'gloss', kw: 1.5 },
  { id: 'ac_cassette', name: '천장형 에어컨 (4way)', cat: '설비', shape: 'cassette', w: 840, d: 840, h: 250, layer: 'ceil', color: WH, mat: 'gloss', kw: 3 },
  { id: 'ac_stand', name: '스탠드 에어컨', cat: '설비', shape: 'box', w: 500, d: 400, h: 1850, layer: 'floor', color: WH, mat: 'gloss', kw: 3 },
  { id: 'vent', name: '환기구 (천장)', cat: '설비', shape: 'cassette', w: 300, d: 300, h: 40, layer: 'ceil', color: '#d9dde2', mat: 'matte' },
  { id: 'downlight', name: '다운라이트', cat: '설비', shape: 'light', w: 150, d: 150, h: 20, layer: 'ceil', color: '#fff6d8', mat: 'gloss', kw: 0.02 },
  { id: 'linelight', name: '라인 조명', cat: '설비', shape: 'light', w: 1200, d: 60, h: 40, layer: 'ceil', color: '#fff6d8', mat: 'gloss', kw: 0.04 },
  { id: 'pendant', name: '펜던트 조명', cat: '설비', shape: 'pendant', w: 300, d: 300, h: 250, elev: 1900, layer: 'ceil', color: '#2b2d31', mat: 'matte', kw: 0.03 },
  // 전기 · 배관 (점 표시)
  { id: 'outlet', name: '콘센트 220V', cat: '전기', shape: 'mark', mk: 'C', w: 120, d: 120, h: 120, elev: 300, layer: 'elec', color: '#f2d24a' },
  { id: 'outlet3', name: '3상 380V', cat: '전기', shape: 'mark', mk: '3φ', w: 120, d: 120, h: 120, elev: 300, layer: 'elec', color: '#f28b3a', provides: 'power3' },
  { id: 'switch', name: '스위치', cat: '전기', shape: 'mark', mk: 'S', w: 100, d: 100, h: 100, elev: 1200, layer: 'elec', color: '#f2d24a' },
  { id: 'panel', name: '분전반', cat: '전기', shape: 'box', w: 600, d: 200, h: 800, elev: 1000, layer: 'elec', color: '#8f8a82', mat: 'matte' },
  { id: 'drain', name: '바닥 배수구', cat: '배관', shape: 'drainpt', mk: 'D', w: 150, d: 150, h: 6, layer: 'plumb', color: '#38c1b0', provides: 'drain' },
  { id: 'trench', name: '트렌치 배수로', cat: '배관', shape: 'drainpt', w: 1200, d: 200, h: 6, layer: 'plumb', color: '#38c1b0', provides: 'drain' },
  { id: 'trap', name: '그리스트랩', cat: '배관', shape: 'box', w: 600, d: 400, h: 400, layer: 'plumb', color: '#6b7a80', mat: 'steel', provides: 'drain' },
  { id: 'water', name: '급수 위치', cat: '배관', shape: 'mark', mk: 'W', w: 120, d: 120, h: 120, elev: 500, layer: 'plumb', color: '#4f9cf9', provides: 'water' },
  { id: 'gasvalve', name: '가스 밸브', cat: '배관', shape: 'mark', mk: 'G', w: 120, d: 120, h: 120, elev: 600, layer: 'plumb', color: '#f28b3a', provides: 'gas' }
];
const CATS = [{ k: '주방', c: ['주방'] }, { k: '홀 가구', c: ['테이블', '의자'] }, { k: '주거', c: ['주거'] }, { k: '문·창', c: ['__op'] }, { k: '벽 설비', c: ['벽 설비'] }, { k: '천장 설비', c: ['천장 설비'] }, { k: '바닥·배관', c: ['바닥·배관'] }, { k: '전기·통신', c: ['전기'] }, { k: '인테리어', c: ['식물', '인테리어'] }, { k: '내 기물', c: ['내 기물'] }];
const REMAP = { fridge45: '냉장 · 냉동', fridge25: '냉장 · 냉동', tfridge: '냉장 · 냉동', freezer45: '냉장 · 냉동', icemaker: '냉장 · 냉동', showcase: '냉장 · 냉동',
  fryer1: '화기', fryer2: '화기', fryer4: '화기', range: '화기', range3: '화기', soupkettle: '화기', griddle: '화기', oven: '화기', hood: '화기',
  work: '작업 · 세척', work2: '작업 · 세척', sink1: '작업 · 세척', sink2: '작업 · 세척', sink3: '작업 · 세척', handsink: '작업 · 세척', dishwasher: '작업 · 세척', sterilizer: '작업 · 세척', waste: '작업 · 세척', returnc: '작업 · 세척',
  holding: '보관 · 기타', rack: '보관 · 기타', shelf: '보관 · 기타', uppercab: '보관 · 기타', tank: '보관 · 기타', ricewarmer: '보관 · 기타', purifier: '보관 · 기타' };
const RECAT = { ac_wall: ['천장 설비', '공조 · 냉난방'], ac_cassette: ['천장 설비', '공조 · 냉난방'], ac_stand: ['천장 설비', '공조 · 냉난방'], vent: ['천장 설비', '공조 · 냉난방'], downlight: ['천장 설비', '조명'], linelight: ['천장 설비', '조명'], pendant: ['천장 설비', '조명'],
  wallvent: ['벽 설비', '점검 · 설비'], drain: ['바닥·배관'], trench: ['바닥·배관'], trap: ['바닥·배관'], water: ['바닥·배관'], gasvalve: ['바닥·배관'], panel: ['전기'] };
LIB.forEach((l) => { if (REMAP[l.id]) l.sub = REMAP[l.id]; if (RECAT[l.id]) { l.cat = RECAT[l.id][0]; if (RECAT[l.id][1]) l.sub = RECAT[l.id][1]; } });
const OPENTYPES = { slidepass: '미닫이 배식창', slide: '미닫이 문', pass: '배식구', arch: '아치 입구', door1: '여닫이 문', door2: '양개 문', auto: '자동문', window: '고정창', full: '통창 (바닥까지)' };
const OPDEF = { slidepass: [900, 600, 900], slide: [1800, 2100, 0], pass: [900, 600, 900], arch: [1200, 2400, 0], door1: [900, 2100, 0], door2: [1600, 2300, 0], auto: [1800, 2300, 0], window: [1800, 1500, 900], full: [2400, 2400, 0] };

/* ---------- 상태 ---------- */
let P = null;              // 현재 프로젝트
let myLib = store.get('drs_mylib', []);
let sel = null;            // {kind:'item'|'wall'|'open'|'line', id}
let tool = 'select';
let view = 'split';
let lineKind = 'wire';
let draft = null;          // 그리는 중인 벽/라인
let vis = store.get('drs_vis', {}); LAYERS.forEach((l) => { if (vis[l.id] === undefined) vis[l.id] = true; });
let undoStack = [], redoStack = [];
let conflicts = new Map(), checks = [];
const libAll = () => LIB.concat(myLib.map((m) => ({ ...m, cat: '내 기물' })));
const libGet = (t) => libAll().find((l) => l.id === t) || { id: t, name: t, shape: 'box', w: 600, d: 600, h: 800, layer: 'floor', color: '#999' };
const itemOf = (id) => P.items.find((i) => i.id === id);
const wallOf = (id) => P.walls.find((w) => w.id === id);
function spec(it) {
  const L = libGet(it.type);
  return {
    L, name: it.tag || L.name, layer: it.layer || L.layer, color: it.color || L.color, mat: normMat(it.mat || L.mat),
    h: it.h ?? L.h, elev: it.elev ?? (L.elev != null ? L.elev : 0)
  };
}
function zOf(it) {
  const s = spec(it);
  if (s.layer === 'ceil' && s.L.elev == null && it.elev == null) return P.ceilingH - s.h;
  if (s.layer === 'ceiling' && s.L.elev == null && it.elev == null) return (s.L.shape === 'rod' ? P.ceilingH : P.slabH - s.h);
  return s.elev;
}

/* ---------- 저장 · 실행취소 ---------- */
let saveT = 0;
function commit(skipUndo) {
  if (batch) return;
  if (!skipUndo) { undoStack.push(lastSnap); if (undoStack.length > 60) undoStack.shift(); redoStack = []; }
  lastSnap = JSON.stringify(P);
  dirty3d = true; analyze(); draw2d(); mark3d(); renderProps(); renderChecks(); renderObjects(); updHist(); if (typeof updFab === 'function') updFab(); if (typeof renderLevels === 'function') renderLevels();
  clearTimeout(saveT); saveT = setTimeout(saveProject, 400);
}
let lastSnap = '';
function updHist() { const u = $('#undo2'), r = $('#redo2'); if (!u) return; u.disabled = !undoStack.length; r.disabled = !redoStack.length; $('#histN').textContent = undoStack.length ? undoStack.length + '단계' : ''; }
function undo() { if (!undoStack.length) return; redoStack.push(JSON.stringify(P)); P = JSON.parse(undoStack.pop()); sel = null; commit(true); }
function redo() { if (!redoStack.length) return; undoStack.push(JSON.stringify(P)); P = JSON.parse(redoStack.pop()); sel = null; commit(true); }
let lastThumb = 0, syncT = 0;
function saveProject(force) {
  if (!P) return; P.updated = Date.now();
  if (force || Date.now() - lastThumb > 15000) saveThumb();
  const ok = store.set('drs_p_' + P.id, P);
  const idx = store.get('drs_index', []).filter((x) => x.id !== P.id);
  idx.unshift({ id: P.id, name: P.name, updated: P.updated, n: P.items.filter((i) => !i.hidden).length, lv: (P.levels || []).length });
  store.set('drs_index', idx); store.set('drs_last', P.id);
  $('#saveState').textContent = ok ? '저장됨' : '이 브라우저는 저장이 막혀 있어요 · 파일로 내보내세요';
  if (SYNC.cfg.access && SYNC.cfg.auto) { clearTimeout(syncT); syncT = setTimeout(() => syncNow(true), 15000); }
}
function saveThumb() { if (!P) return; try { const c = snapshot3d(360, 240, isoCam()); if (c) store.set('drs_t_' + P.id, c.toDataURL('image/jpeg', 0.62)); } catch (e) {} lastThumb = Date.now(); }
function openProject(p) {
  P = p; ensureLevels(); P.ceiling = P.ceiling || { on: false, opacity: 0.45, color: '#f4f2ee' }; P.floorOpacity = P.floorOpacity ?? 1; P.render = P.render || { sun: 35, alt: 55, bright: 1 }; P.lines = P.lines || []; P.openings = P.openings || []; P.scenes = P.scenes || []; P.photos = P.photos || []; P.sketches = P.sketches || []; P.std = { ...STD0, ...(P.std || {}) }; P.walls.forEach((w) => (w.finish = w.finish || { type: 'paint', color: '#ece8e1' }));
  sel = null; undoStack = []; redoStack = []; lastSnap = JSON.stringify(P);
  $('#projName').textContent = P.name; if (typeof bindRender === 'function') { bindRender(); renderLevels(); }
  bgImg = null; if (P.bg && P.bg.src) { bgImg = new Image(); bgImg.onload = () => draw2d(); bgImg.src = P.bg.src; }
  fit2d(); commit(true); cam3dDefault(); dirty3d = true;
}
function newProject(opt) {
  const W = opt.w || 8000, D = opt.d || 12000, T = 150;
  const p = { v: 1, id: uid('p'), name: opt.name || '새 프로젝트', ceilingH: opt.ceilingH || 2700, slabH: opt.slabH || 3300, soffitH: opt.soffitH || 2400, wallT: T, aisle: 900,
    floor: { type: 'epoxy', color: '#c9c3b8' }, walls: [], openings: [], items: [], lines: [], scenes: [], bg: null };
  if (opt.start === 'rect') {
    const pts = [[0, 0], [W, 0], [W, D], [0, D], [0, 0]];
    for (let i = 0; i < 4; i++) p.walls.push({ id: uid('w'), x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1], finish: { type: 'paint', color: '#ece8e1' } });
  }
  return p;
}

/* ---------- 층 (연결된 프로젝트) ---------- */
const LEVEL_KEYS = ['walls', 'openings', 'items', 'lines', 'sketches', 'ceilingH', 'soffitH', 'slabH', 'floor', 'ceiling', 'floorOpacity', 'bg', 'room', 'photos', 'scenes'];
function ensureLevels() { if (!P.levels || !P.levels.length) { P.levels = [{ id: 'L1', name: '1층', elev: 0 }]; P.levelId = 'L1'; } if (!P.levels.find((l) => l.id === P.levelId)) P.levelId = P.levels[0].id; }
const curLevel = () => (ensureLevels(), P.levels.find((l) => l.id === P.levelId));
const curElev = () => (P ? curLevel().elev || 0 : 0);
const levelPick = () => JSON.parse(JSON.stringify(Object.fromEntries(LEVEL_KEYS.map((k) => [k, P[k]]))));
function withLevel(Lv, fn) { const keep = Object.fromEntries(LEVEL_KEYS.map((k) => [k, P[k]])); for (const k of LEVEL_KEYS) P[k] = Lv.data[k]; try { return fn(); } finally { for (const k of LEVEL_KEYS) P[k] = keep[k]; } }
function switchLevel(id) {
  if (id === P.levelId) return; const cur = curLevel(), nx = P.levels.find((l) => l.id === id); if (!nx || !nx.data) return;
  cur.data = levelPick(); for (const k of LEVEL_KEYS) P[k] = JSON.parse(JSON.stringify(nx.data[k] ?? null)); nx.data = null; P.levelId = id;
  P.walls = P.walls || []; P.openings = P.openings || []; P.items = P.items || []; P.lines = P.lines || []; P.sketches = P.sketches || []; P.photos = P.photos || []; P.scenes = P.scenes || [];
  P.floor = P.floor || { type: 'epoxy', color: '#c9c3b8' }; P.ceiling = P.ceiling || { on: false, opacity: 0.45, color: '#f4f2ee' };
  sel = null; multi = []; bgImg = null; if (P.bg && P.bg.src) { bgImg = new Image(); bgImg.onload = () => draw2d(); bgImg.src = P.bg.src; }
  commit(); fit2d(); recenter(700); renderLevels(); toast(`${nx.name}로 왔어요`);
}
function exteriorWalls() {
  const cross = (p, q, w) => { const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); const A = [w.x1, w.y1], B = [w.x2, w.y2]; return d(p, q, A) * d(p, q, B) < 0 && d(A, B, p) * d(A, B, q) < 0; };
  return P.walls.filter((w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 1) return false; const m = [(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2], n = [-(w.y2 - w.y1) / L, (w.x2 - w.x1) / L];
    return [1, -1].some((sg) => { const p = [m[0] + n[0] * sg * (wallT(w) / 2 + 5), m[1] + n[1] * sg * (wallT(w) / 2 + 5)], q = [p[0] + n[0] * sg * 60000, p[1] + n[1] * sg * 60000]; return !P.walls.some((o) => o !== w && cross(p, q, o)); }); });
}
/* ---------- 기하 ---------- */
function corners(it) {
  const a = (it.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2, hd = it.d / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]);
}
function aabb(pts) { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
function satOverlap(A, B, tol) {
  for (const poly of [A, B]) for (let i = 0; i < 4; i++) {
    const p = poly[i], q = poly[(i + 1) % 4], nx = -(q[1] - p[1]), ny = q[0] - p[0];
    const pa = A.map((v) => v[0] * nx + v[1] * ny), pb = B.map((v) => v[0] * nx + v[1] * ny);
    const len = Math.hypot(nx, ny);
    if (Math.min(...pa) + tol * len >= Math.max(...pb) || Math.min(...pb) + tol * len >= Math.max(...pa)) return false;
  }
  return true;
}
const wallT = (w) => w.t || P.wallT, wallH = (w) => w.h || P.ceilingH;
function wallRect(w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy) || 1, t = wallT(w) / 2, nx = -dy / L * t, ny = dx / L * t;
  return [[w.x1 + nx, w.y1 + ny], [w.x2 + nx, w.y2 + ny], [w.x2 - nx, w.y2 - ny], [w.x1 - nx, w.y1 - ny]];
}
function distPtSeg(px, py, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - w.x1) * dx + (py - w.y1) * dy) / L2, 0, 1);
  return [Math.hypot(px - (w.x1 + t * dx), py - (w.y1 + t * dy)), t];
}
const isPoint = (it) => ['mark', 'light'].includes(libGet(it.type).shape) && it.w <= 200;
const physical = (it) => { const s = spec(it); return !['mark', 'zone', 'drainpt', 'light'].includes(s.L.shape) && !['elec', 'plumb'].includes(s.layer); };

/* ---------- 충돌 · 주방 점검 ---------- */
function analyze() {
  conflicts = new Map(); checks = [];
  const phys = P.items.filter((i) => !i.hidden && physical(i));
  const C = phys.map((it) => ({ it, c: corners(it), z0: zOf(it), z1: zOf(it) + spec(it).h, b: aabb(corners(it)) }));
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = C[i], b = C[j];
    if (a.z1 <= b.z0 + 1 || b.z1 <= a.z0 + 1) continue;
    if (satOverlap(a.c, b.c, 8)) { conflicts.set(a.it.id, '다른 기물과 겹침'); conflicts.set(b.it.id, '다른 기물과 겹침'); continue; }
    const gx = Math.max(a.b[0] - b.b[2], b.b[0] - a.b[2]), gy = Math.max(a.b[1] - b.b[3], b.b[1] - a.b[3]);
    const ovx = gx < 0, ovy = gy < 0;
    const gap = ovx && !ovy ? gy : ovy && !ovx ? gx : null;
    if (gap != null && gap > 8 && gap < 80) {
      const both = [a, b].every((q) => spec(q.it).L.cat === '주방' || spec(q.it).L.cat === '내 기물');
      if (both) { const r = `틈 ${Math.round(gap)}mm · 재실측 또는 붙이기`; conflicts.set(a.it.id, r); conflicts.set(b.it.id, r); }
    }
  }
  for (const q of C) {
    if (spec(q.it).layer === 'ceil' || q.it.type === 'column') continue;
    for (const w of P.walls) {
      if (satOverlap(q.c, wallRect(w), 12)) {
        // 문 · 창 자리는 통과 허용 안 함 → 벽을 뚫고 들어감
        conflicts.set(q.it.id, '벽을 넘어감 · 위치 조정 필요'); break;
      }
    }
  }
  const near = (it, prov, r) => P.items.some((o) => !o.hidden && libGet(o.type).provides === prov && Math.hypot(o.x - it.x, o.y - it.y) < r + Math.max(o.w, o.d) / 2);
  for (const it of P.items) {
    if (it.hidden) continue;
    const s = spec(it), L = s.L;
    if (conflicts.has(it.id)) checks.push({ lvl: 'bad', id: it.id, t: `${s.name}: ${conflicts.get(it.id)}` });
    if (L.drain && !near(it, 'drain', 1500)) checks.push({ lvl: 'warn', id: it.id, t: `${s.name}: 1.5m 안에 배수구 없음` });
    if (L.gas && !near(it, 'gas', 2500)) checks.push({ lvl: 'warn', id: it.id, t: `${s.name}: 가스 밸브 위치 필요` });
    if (L.hood) {
      const c = corners(it), ok = P.items.some((o) => !o.hidden && libGet(o.type).shape === 'hood' && satOverlap(c, corners(o), 0));
      if (!ok) checks.push({ lvl: 'warn', id: it.id, t: `${s.name}: 위에 후드 없음` });
    }
    if ((it.kw ?? L.kw ?? 0) >= 3 && !near(it, 'power3', 3000) && L.cat !== '설비') checks.push({ lvl: 'warn', id: it.id, t: `${s.name}: ${it.kw ?? L.kw}kW · 3상 전원 확인` });
    if (it.needsWork) checks.push({ lvl: 'work', id: it.id, t: `공사 필요 · ${s.name}${it.note ? ' · ' + it.note : ''}` });
  }
  // 주방 통로 폭
  const K = C.filter((q) => spec(q.it).L.cat === '주방' && spec(q.it).layer === 'floor');
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
    const a = K[i].b, b = K[j].b;
    const gx = Math.max(a[0] - b[2], b[0] - a[2]), gy = Math.max(a[1] - b[3], b[1] - a[3]);
    const fr = (it) => { const r = (it.rot || 0) * Math.PI / 180; return [-Math.sin(r), Math.cos(r)]; };
    const fa = fr(K[i].it), fb = fr(K[j].it);
    const g = gx > 0 && gy < -200 && Math.abs(fa[0]) > .7 && Math.abs(fb[0]) > .7 ? gx : gy > 0 && gx < -200 && Math.abs(fa[1]) > .7 && Math.abs(fb[1]) > .7 ? gy : null;
    if (g != null && g >= 80 && g < P.aisle) checks.push({ lvl: 'warn', id: K[i].it.id, t: `통로 ${Math.round(g)}mm · ${spec(K[i].it).name} ↔ ${spec(K[j].it).name} (기준 ${P.aisle})` });
  }
  const kw = P.items.reduce((a, it) => a + (it.kw ?? libGet(it.type).kw ?? 0), 0);
  $('#kwSum').textContent = kw.toFixed(1) + ' kW';
}

/* ---------- 2D ---------- */
const cv = $('#c2d'); let cx = cv.getContext('2d');
let V = { s: 0.05, ox: 40, oy: 40 }, bgImg = null;
const toS = (x, y) => [x * V.s + V.ox, y * V.s + V.oy];
const toW = (sx, sy) => [(sx - V.ox) / V.s, (sy - V.oy) / V.s];
function sizeCanvas(c) {
  const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  return d;
}
function bounds() {
  const xs = [], ys = [];
  P.walls.forEach((w) => { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); });
  P.items.forEach((i) => { xs.push(i.x); ys.push(i.y); });
  if (!xs.length) return [0, 0, 8000, 10000];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function fit2d() {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const b = bounds(), w = b[2] - b[0] || 1, h = b[3] - b[1] || 1;
  V.s = Math.min((r.width - 60) / w, (r.height - 60) / h);
  V.ox = (r.width - w * V.s) / 2 - b[0] * V.s; V.oy = (r.height - h * V.s) / 2 - b[1] * V.s;
}
let hatch = null;
function hatchPat() {
  if (hatch) return hatch;
  const p = document.createElement('canvas'); p.width = p.height = 12; const g = p.getContext('2d');
  g.fillStyle = 'rgba(235,40,40,.55)'; g.fillRect(0, 0, 12, 12);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-3, 15); g.lineTo(15, -3); g.moveTo(-3, 3); g.lineTo(3, -3); g.moveTo(9, 15); g.lineTo(15, 9); g.stroke();
  return (hatch = cx.createPattern(p, 'repeat'));
}
function openingGeom(o) {
  const w = wallOf(o.wall); if (!w) return null;
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const t0 = clamp(o.t - o.w / 2, 0, L), t1 = clamp(o.t + o.w / 2, 0, L);
  return { w, L, ux, uy, nx: -uy, ny: ux, a: [w.x1 + ux * t0, w.y1 + uy * t0], b: [w.x1 + ux * t1, w.y1 + uy * t1] };
}
function draw2d() {
  if (!P || (view === '3d' && !OFF)) return;
  const d = OFF ? 1 : sizeCanvas(cv); cx.setTransform(d, 0, 0, d, 0, 0);
  const r = OFF ? { width: OFF.w, height: OFF.h } : cv.getBoundingClientRect();
  cx.fillStyle = getCss('--canvas'); cx.fillRect(0, 0, r.width, r.height);
  // 그리드
  const step = V.s * 1000 > 30 ? 500 : 1000; const [wx0, wy0] = toW(0, 0), [wx1, wy1] = toW(r.width, r.height);
  cx.lineWidth = 1;
  for (let x = Math.floor(wx0 / step) * step; x < wx1; x += step) { cx.strokeStyle = x % 5000 === 0 ? getCss('--grid2') : getCss('--grid'); cx.beginPath(); cx.moveTo(toS(x, 0)[0] + .5, 0); cx.lineTo(toS(x, 0)[0] + .5, r.height); cx.stroke(); }
  for (let y = Math.floor(wy0 / step) * step; y < wy1; y += step) { cx.strokeStyle = y % 5000 === 0 ? getCss('--grid2') : getCss('--grid'); cx.beginPath(); cx.moveTo(0, toS(0, y)[1] + .5); cx.lineTo(r.width, toS(0, y)[1] + .5); cx.stroke(); }
  if (bgImg && P.bg) { cx.globalAlpha = P.bg.opacity ?? .5; const [sx, sy] = toS(P.bg.x || 0, P.bg.y || 0), sw = P.bg.wmm * V.s; cx.drawImage(bgImg, sx, sy, sw, sw * bgImg.height / bgImg.width); cx.globalAlpha = 1; }
  if (window.ROOMS_ON) drawRooms2d();
  // 바닥 구역
  for (const it of P.items) if (!it.hidden && libGet(it.type).shape === 'zone' && vis[spec(it).layer]) poly(corners(it), hexA(it.finish?.color || spec(it).color, .45), getCss('--line'), 1, [6, 4]);
  // 아래층 윤곽
  { const lv = P.levels && P.levels.filter((l) => l.id !== P.levelId && l.data && (l.elev || 0) < curElev()).sort((x, y) => y.elev - x.elev)[0]; if (lv && lv.data.walls) { cx.save(); cx.globalAlpha = 0.28; cx.strokeStyle = getCss('--muted') || '#888'; cx.setLineDash([6, 5]); cx.lineWidth = 2; for (const w of lv.data.walls) { cx.beginPath(); cx.moveTo(...toS(w.x1, w.y1)); cx.lineTo(...toS(w.x2, w.y2)); cx.stroke(); } cx.restore(); } }
  // 벽
  cx.globalAlpha = FOCUS ? 0.25 : 1;
  for (const w of P.walls) {
    const isSel = isSelected('wall', w.id);
    cx.strokeStyle = isSel ? getCss('--accent') : getCss('--wall'); cx.lineWidth = Math.max(3, wallT(w) * V.s); cx.lineCap = 'square';
    cx.beginPath(); cx.moveTo(...toS(w.x1, w.y1)); cx.lineTo(...toS(w.x2, w.y2)); cx.stroke();
  }
  cx.globalAlpha = 1;
  // 문 · 창
  for (const o of P.openings) {
    const g = openingGeom(o); if (!g) continue;
    const isSel = isSelected('open', o.id);
    cx.strokeStyle = getCss('--canvas'); cx.lineWidth = Math.max(3, wallT(g.w) * V.s) + 2; cx.lineCap = 'butt';
    cx.beginPath(); cx.moveTo(...toS(...g.a)); cx.lineTo(...toS(...g.b)); cx.stroke();
    cx.strokeStyle = isSel ? getCss('--accent') : '#4fc3c9'; cx.lineWidth = 2;
    if (/^(slide|auto|auto2|slide2)$/.test(o.type)) {
      const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2];
      for (const [p, q, k] of [[g.a, m, -1], [m, g.b, 1]]) { const off = k * wallT(g.w) * .18, ext = o.w * .08 * k; cx.beginPath(); cx.moveTo(...toS(p[0] + g.nx * off - g.ux * ext, p[1] + g.ny * off - g.uy * ext)); cx.lineTo(...toS(q[0] + g.nx * off + g.ux * ext, q[1] + g.ny * off + g.uy * ext)); cx.stroke(); }
    } else if (o.type === 'pass' || o.type === 'slidepass') {
      cx.setLineDash([5, 4]); cx.beginPath(); cx.moveTo(...toS(...g.a)); cx.lineTo(...toS(...g.b)); cx.stroke(); cx.setLineDash([]);
      const sh = wallT(g.w) / 2 + 150; cx.beginPath(); cx.moveTo(...toS(g.a[0] - g.nx * sh, g.a[1] - g.ny * sh)); cx.lineTo(...toS(g.a[0] + g.nx * sh, g.a[1] + g.ny * sh)); cx.lineTo(...toS(g.b[0] + g.nx * sh, g.b[1] + g.ny * sh)); cx.lineTo(...toS(g.b[0] - g.nx * sh, g.b[1] - g.ny * sh)); cx.closePath(); cx.stroke();
    } else if (o.type === 'arch') {
      const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], [mx, my] = toS(...m), rr = o.w / 2 * V.s, ang = Math.atan2(g.uy, g.ux);
      cx.setLineDash([4, 4]); for (const k of [-1, 1]) { const off = k * wallT(g.w) / 2; cx.beginPath(); cx.moveTo(...toS(g.a[0] + g.nx * off, g.a[1] + g.ny * off)); cx.lineTo(...toS(g.b[0] + g.nx * off, g.b[1] + g.ny * off)); cx.stroke(); }
      cx.beginPath(); cx.arc(mx, my, rr, ang, ang + Math.PI); cx.stroke(); cx.setLineDash([]);
    } else if (typeof DOOR2D !== 'undefined' && DOOR2D[o.type]) { DOOR2D[o.type](o, g);
    } else if (o.type === 'window' || o.type === 'full') {
      for (const k of [-1, 1]) { const off = k * P.wallT * .25; cx.beginPath(); cx.moveTo(...toS(g.a[0] + g.nx * off, g.a[1] + g.ny * off)); cx.lineTo(...toS(g.b[0] + g.nx * off, g.b[1] + g.ny * off)); cx.stroke(); }
    } else {
      const one = /^(door1|glass1|out1)$/.test(o.type), leaves = one ? [[g.a, 1]] : [[g.a, 1], [g.b, -1]];
      const lw = one ? o.w : o.w / 2;
      for (const [p, sgn] of leaves) {
        const ex = p[0] + g.nx * lw, ey = p[1] + g.ny * lw;
        cx.beginPath(); cx.moveTo(...toS(...p)); cx.lineTo(...toS(ex, ey)); cx.stroke();
        const [px, py] = toS(...p), a0 = Math.atan2(g.ny, g.nx), a1 = Math.atan2(g.uy * sgn, g.ux * sgn);
        let dlt = a0 - a1; while (dlt > Math.PI) dlt -= 2 * Math.PI; while (dlt < -Math.PI) dlt += 2 * Math.PI;
        cx.beginPath(); cx.setLineDash([3, 3]); cx.arc(px, py, lw * V.s, a1, a0, dlt < 0); cx.stroke(); cx.setLineDash([]);
      }
    }
  }
  // 기물
  const order = P.items.filter((it) => !it.hidden && libGet(it.type).shape !== 'zone').sort((a, b) => zOf(a) - zOf(b));
  for (const it of order) {
    const s = spec(it); if (vis[s.layer] === false) continue; cx.globalAlpha = FOCUS && s.layer !== FOCUS ? 0.2 : 1;
    const isSel = isSelected('item', it.id);
    const lc = LAYERS.find((l) => l.id === s.layer).color;
    if (isPoint(it) || s.L.shape === 'mark') {
      const [px, py] = toS(it.x, it.y), rr = Math.max(7, 130 * V.s);
      cx.fillStyle = s.color; cx.beginPath(); cx.arc(px, py, rr, 0, 7); cx.fill();
      cx.strokeStyle = isSel ? '#fff' : '#111'; cx.lineWidth = isSel ? 2.5 : 1; cx.stroke();
      cx.fillStyle = '#111'; cx.font = `700 ${Math.max(8, rr * .9)}px system-ui`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(s.L.shape === 'light' ? '' : (s.L.mk || '·'), px, py + .5);
      if (s.L.shape === 'light') { cx.strokeStyle = '#111'; cx.beginPath(); cx.moveTo(px - rr * .6, py); cx.lineTo(px + rr * .6, py); cx.moveTo(px, py - rr * .6); cx.lineTo(px, py + rr * .6); cx.stroke(); }
    } else {
      const c = corners(it), dim = s.layer === 'ceil' || s.layer === 'upper';
      poly(c, isSel ? hexA('#0a84ff', .38) : hexA(s.color, dim ? .18 : .55), isSel ? getCss('--accent') : lc, isSel ? 2.5 : 1.3, dim ? [5, 4] : null);
      symbol(it, s);
      if (it.img) drawImg(it);
    }
    if (isSel && moveOn) { const c = corners(it); cx.save(); cx.setLineDash([7, 5]); poly(c, null, getCss('--accent'), 3); cx.restore(); }
    if (conflicts.has(it.id)) { const c = corners(it); cx.save(); cx.fillStyle = hatchPat(); polyPath(c); cx.fill(); cx.restore(); }
    if (it.needsWork) { const [px, py] = toS(...corners(it)[1]); cx.fillStyle = '#f2a33a'; cx.beginPath(); cx.arc(px, py, 7, 0, 7); cx.fill(); cx.fillStyle = '#1a1205'; cx.font = '700 10px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('!', px, py + .5); }
    const quiet = ['chair', 'stool', 'barchair', 'light', 'cassette', 'drainpt'].includes(s.L.shape) || ['ceil', 'elec', 'plumb'].includes(s.layer);
    if ((isSel || (V.s > .035 && (!quiet || it.tag))) && !isPoint(it) && s.L.shape !== 'mark') label(it, s, isSel);
  }
  cx.globalAlpha = 1;
  // 라인
  for (const l of P.lines) {
    const k = { ...LINEKINDS[l.kind], color: lineColor(l) }; if (vis[k.layer] === false) continue; cx.globalAlpha = FOCUS && k.layer !== FOCUS ? 0.2 : 1;
    const isSel = isSelected('line', l.id);
    cx.strokeStyle = k.color; cx.lineWidth = isSel ? 4 : 2.2; cx.setLineDash(k.z === 'above' || k.z === 'hang' ? [8, 5] : k.z === 'below' ? [12, 4, 2, 4] : [2, 0]);
    cx.beginPath(); l.pts.forEach((p, i) => (i ? cx.lineTo(...toS(...p)) : cx.moveTo(...toS(...p)))); cx.stroke(); cx.setLineDash([]);
  }
  cx.globalAlpha = 1;
  // 낙서
  if (vis.sketch !== false) for (const sk of P.sketches || []) {
    const isSel = isSelected('sketch', sk.id); cx.strokeStyle = sk.color || '#ff375f'; cx.lineWidth = isSel ? 4 : 2; cx.lineJoin = 'round'; cx.lineCap = 'round';
    cx.beginPath(); sk.pts.forEach((p, i) => (i ? cx.lineTo(...toS(p[0], p[2])) : cx.moveTo(...toS(p[0], p[2])))); cx.stroke();
  }
  drawGrid2d();
  drawHandles();
  // 그리는 중
  if (draft) {
    let pp = null;
    if (draft.free) pp = draft.raw;
    else if (drawMode === 'arc') pp = draft.pts.length === 2 && draft.hover ? arcPts(draft.pts[0], draft.hover, draft.pts[1]) : draft.pts.concat(draft.hover ? [draft.hover] : []);
    else pp = draft.pts.concat(draft.hover ? [draft.hover] : []);
    if (pp.length) {
      cx.strokeStyle = getCss('--accent'); cx.lineWidth = draft.free ? 3 : 2; cx.setLineDash(draft.free ? [] : [6, 4]); cx.beginPath();
      pp.forEach((p, i) => (i ? cx.lineTo(...toS(...p)) : cx.moveTo(...toS(...p)))); cx.stroke(); cx.setLineDash([]);
      for (const p of draft.pts) { const [x, y] = toS(...p); cx.fillStyle = getCss('--accent'); cx.fillRect(x - 3, y - 3, 6, 6); }
      if (draft.hover && !draft.free && draft.pts.length) { const p = draft.pts[draft.pts.length - 1]; const L = Math.round(Math.hypot(draft.hover[0] - p[0], draft.hover[1] - p[1])); const [sx, sy] = toS(...draft.hover); tag(sx + 10, sy - 10, drawMode === 'arc' && draft.pts.length === 2 ? '휘어질 지점' : L + ' mm'); }
    }
  }

  // 선택된 벽 길이
  if (sel && sel.kind === 'wall') { const w = wallOf(sel.id); if (w) { const [sx, sy] = toS((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2); tag(sx + 8, sy - 8, Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)) + ' mm'); } }
  // 축척 막대
  const bar = 1000 * V.s; cx.fillStyle = getCss('--fg'); cx.fillRect(16, r.height - 22, bar, 3); cx.font = '11px system-ui'; cx.textAlign = 'left'; cx.fillText('1m', 20 + bar, r.height - 18);
}
function polyPath(c) { cx.beginPath(); c.forEach((p, i) => (i ? cx.lineTo(...toS(...p)) : cx.moveTo(...toS(...p)))); cx.closePath(); }
function poly(c, fill, stroke, lw, dash) { polyPath(c); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = lw || 1; if (dash) cx.setLineDash(dash); cx.stroke(); cx.setLineDash([]); } }
function tag(x, y, t) { cx.font = '600 11px system-ui'; const w = cx.measureText(t).width + 10; cx.fillStyle = 'rgba(16,17,20,.9)'; cx.fillRect(x, y - 15, w, 18); cx.fillStyle = '#fff'; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText(t, x + 5, y - 6); }
function label(it, s, isSel) {
  const [px, py] = toS(it.x, it.y), fs = clamp(V.s * 160, 9, 13);
  cx.font = `${isSel ? 700 : 500} ${fs}px system-ui`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.lineWidth = 3; cx.strokeStyle = getCss('--labelStroke'); cx.strokeText(s.name, px, py); cx.fillStyle = getCss('--label'); cx.fillText(s.name, px, py);
  if (isSel) { cx.font = `500 ${fs - 1}px system-ui`; cx.strokeText(`${it.w}×${it.d}×${s.h}`, px, py + fs + 2); cx.fillStyle = getCss('--accent'); cx.fillText(`${it.w}×${it.d}×${s.h}`, px, py + fs + 2); }
}
function lp(it, x, y) { const a = (it.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return toS(it.x + x * c - y * s, it.y + x * s + y * c); }
function symbol(it, s) {
  const hw = it.w / 2, hd = it.d / 2, sh = s.L.shape; cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 1;
  const circ = (x, y, rr) => { const [px, py] = lp(it, x, y); cx.beginPath(); cx.arc(px, py, Math.max(2, rr * V.s), 0, 7); cx.stroke(); };
  const ln = (a, b, c2, d2) => { cx.beginPath(); cx.moveTo(...lp(it, a, b)); cx.lineTo(...lp(it, c2, d2)); cx.stroke(); };
  if (sh === 'sink') { const n = Math.max(1, Math.round(it.w / 650)); for (let i = 0; i < n; i++) { const x0 = -hw + it.w * i / n + 60, x1 = -hw + it.w * (i + 1) / n - 60; ln(x0, -hd + 80, x1, -hd + 80); ln(x1, -hd + 80, x1, hd - 120); ln(x1, hd - 120, x0, hd - 120); ln(x0, hd - 120, x0, -hd + 80); circ((x0 + x1) / 2, 0, 30); } }
  else if (sh === 'fryer') { const n = Math.max(1, Math.round(it.w / 450)); for (let i = 0; i < n; i++) { const xc = -hw + it.w * (i + .5) / n; ln(xc - it.w / n / 2 + 40, -hd + 100, xc + it.w / n / 2 - 40, -hd + 100); ln(xc - it.w / n / 2 + 40, hd - 160, xc + it.w / n / 2 - 40, hd - 160); } }
  else if (sh === 'range') { const n = Math.max(1, Math.round(it.w / 600)); for (let i = 0; i < n; i++) { circ(-hw + it.w * (i + .5) / n, -40, Math.min(it.w / n, it.d) * .3); circ(-hw + it.w * (i + .5) / n, -40, 60); } }
  else if (sh === 'fridge' || sh === 'showcase') { ln(-hw, -hd, hw, hd); ln(-hw, hd, hw, -hd); }
  else if (sh === 'chair' || sh === 'barchair' || sh === 'sofa') { ln(-hw + 20, hd - 70, hw - 20, hd - 70); }
  else if (sh === 'roundtable' || sh === 'stool' || sh === 'tank' || sh === 'plant') { circ(0, 0, Math.min(hw, hd) * .85); }
  else if (sh === 'hood') { ln(-hw, -hd, hw, hd); }
  // 앞면 표시
  if (['fridge', 'tfridge', 'work', 'work2', 'sink', 'fryer', 'range', 'box', 'showcase', 'rack', 'counter'].includes(sh)) { cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = 2; ln(-hw + 30, hd - 25, hw - 30, hd - 25); }
}
const imgCache = {};
function drawImg(it) {
  let im = imgCache[it.img]; if (!im) { im = imgCache[it.img] = new Image(); im.onload = () => draw2d(); im.src = it.img; }
  if (!im.complete) return; const [px, py] = toS(it.x, it.y);
  cx.save(); cx.translate(px, py); cx.rotate((it.rot || 0) * Math.PI / 180); cx.globalAlpha = .9; cx.drawImage(im, -it.w * V.s / 2, -it.d * V.s / 2, it.w * V.s, it.d * V.s); cx.restore();
}
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function hexRGB(h) { const n = parseInt((h || '#999999').slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
const cssCache = {}; function getCss(n) { if (OFF && LIGHT[n]) return LIGHT[n]; if (OFF && n === '--label') return '#1d1d1f'; if (OFF && n === '--labelStroke') return 'rgba(255,255,255,.9)'; return cssCache[n] || (cssCache[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim()); }

/* ---------- 2D 입력 ---------- */
const ptrs = new Map(); let drag = null, pinch = null;
let drawMode = store.get('drs_dmode', 'line'), assist = store.get('drs_assist', true);
let moveOn = false, moveStep = store.get('drs_step', 50);
function snapGrid(v) { const g = (P && std().grid) || 50; return $('#snap').checked ? Math.round(v / g) * g : Math.round(v); }
function wallSnap(it) {
  if (!$('#snap').checked) return;
  const b = aabb(corners(it)), T = P.wallT / 2, th = 120;
  for (const w of P.walls) {
    if (w.x1 === w.x2) { const x = w.x1, y0 = Math.min(w.y1, w.y2), y1 = Math.max(w.y1, w.y2); if (b[3] < y0 || b[1] > y1) continue;
      if (Math.abs(b[0] - (x + T)) < th) it.x += x + T - b[0]; else if (Math.abs(b[2] - (x - T)) < th) it.x += x - T - b[2]; }
    else if (w.y1 === w.y2) { const y = w.y1, x0 = Math.min(w.x1, w.x2), x1 = Math.max(w.x1, w.x2); if (b[2] < x0 || b[0] > x1) continue;
      if (Math.abs(b[1] - (y + T)) < th) it.y += y + T - b[1]; else if (Math.abs(b[3] - (y - T)) < th) it.y += y - T - b[3]; }
  }
}
function hitTest(wx, wy) {
  const tol = 8 / V.s;
  const order = P.items.filter((i) => !i.hidden).sort((a, b) => zOf(b) - zOf(a));
  for (const it of order) { const s = spec(it); if (!vis[s.layer]) continue; if (isPoint(it) || s.L.shape === 'mark') { if (Math.hypot(wx - it.x, wy - it.y) < Math.max(130, 9 / V.s)) return { kind: 'item', id: it.id }; } }
  for (const o of P.openings) { const g = openingGeom(o); if (!g) continue; const [d] = distPtSeg(wx, wy, { x1: g.a[0], y1: g.a[1], x2: g.b[0], y2: g.b[1] }); if (d < wallT(g.w) + tol) return { kind: 'open', id: o.id }; }
  for (const l of P.lines) { if (!vis[LINEKINDS[l.kind].layer]) continue; for (let i = 1; i < l.pts.length; i++) { const [d] = distPtSeg(wx, wy, { x1: l.pts[i - 1][0], y1: l.pts[i - 1][1], x2: l.pts[i][0], y2: l.pts[i][1] }); if (d < tol) return { kind: 'line', id: l.id }; } }
  if (vis.sketch !== false) for (const sk of P.sketches || []) for (let i = 1; i < sk.pts.length; i++) { const [d] = distPtSeg(wx, wy, { x1: sk.pts[i - 1][0], y1: sk.pts[i - 1][2], x2: sk.pts[i][0], y2: sk.pts[i][2] }); if (d < tol) return { kind: 'sketch', id: sk.id }; }
  for (const it of order) { const s = spec(it); if (!vis[s.layer] || s.L.shape === 'zone') continue; if (pointInPoly(wx, wy, corners(it))) return { kind: 'item', id: it.id }; }
  for (const w of P.walls) { const [d] = distPtSeg(wx, wy, w); if (d < wallT(w) / 2 + tol) return { kind: 'wall', id: w.id }; }
  for (const it of order) { if (libGet(it.type).shape === 'zone' && vis[spec(it).layer] && pointInPoly(wx, wy, corners(it))) return { kind: 'item', id: it.id }; }
  return null;
}
function pointInPoly(x, y, c) { let ins = false; for (let i = 0, j = c.length - 1; i < c.length; j = i++) { if ((c[i][1] > y) !== (c[j][1] > y) && x < (c[j][0] - c[i][0]) * (y - c[i][1]) / (c[j][1] - c[i][1]) + c[i][0]) ins = !ins; } return ins; }
function evPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function orthoSnap(prev, p) { if (!prev || !$('#ortho').checked) return p; return Math.abs(p[0] - prev[0]) > Math.abs(p[1] - prev[1]) ? [p[0], prev[1]] : [prev[0], p[1]]; }
/* 선택 오브젝트 이동 (이동 ON 일 때만, 단위별) */
function nearSel(wx, wy, tolPx = 30) {
  if (!sel) return false; const tol = tolPx / V.s;
  if (sel.kind === 'item') { const it = itemOf(sel.id); if (!it) return false; const b = aabb(corners(it)); return wx > b[0] - tol && wx < b[2] + tol && wy > b[1] - tol && wy < b[3] + tol; }
  if (sel.kind === 'wall') { const w = wallOf(sel.id); return !!w && distPtSeg(wx, wy, w)[0] < wallT(w) / 2 + tol; }
  if (sel.kind === 'open') { const g = openingGeom(P.openings.find((o) => o.id === sel.id) || {}); return !!g && distPtSeg(wx, wy, { x1: g.a[0], y1: g.a[1], x2: g.b[0], y2: g.b[1] })[0] < 300 + tol; }
  if (sel.kind === 'sketch') { const k = P.sketches.find((x) => x.id === sel.id); return !!k && k.pts.some((p, i) => i && distPtSeg(wx, wy, { x1: k.pts[i - 1][0], y1: k.pts[i - 1][2], x2: p[0], y2: p[2] })[0] < tol); }
  if (sel.kind === 'line') { const l = P.lines.find((x) => x.id === sel.id); return !!l && l.pts.some((p, i) => i && distPtSeg(wx, wy, { x1: l.pts[i - 1][0], y1: l.pts[i - 1][1], x2: p[0], y2: p[1] })[0] < tol); }
  return false;
}
function beginMove(wx, wy) {
  const s = { kind: sel.kind, wx, wy };
  if (sel.kind === 'item') { const it = itemOf(sel.id); s.it = it; s.x = it.x; s.y = it.y; }
  if (sel.kind === 'wall') {
    const w = wallOf(sel.id), same = (x, y) => (Math.abs(x - w.x1) < 2 && Math.abs(y - w.y1) < 2) || (Math.abs(x - w.x2) < 2 && Math.abs(y - w.y2) < 2);
    s.w = w; s.p = [w.x1, w.y1, w.x2, w.y2];
    s.links = P.walls.filter((o) => o !== w).map((o) => ({ o, a: [o.x1, o.y1], b: [o.x2, o.y2], ma: same(o.x1, o.y1), mb: same(o.x2, o.y2) })).filter((x) => x.ma || x.mb);
  }
  if (sel.kind === 'open') { s.o = P.openings.find((o) => o.id === sel.id); s.t = s.o.t; }
  if (sel.kind === 'line') { s.l = P.lines.find((x) => x.id === sel.id); s.pts = s.l.pts.map((p) => [...p]); }
  if (sel.kind === 'sketch') { s.k = P.sketches.find((x) => x.id === sel.id); s.pts = s.k.pts.map((p) => [...p]); }
  return s;
}
function applyMove(s, wx, wy) {
  const st = moveStep, dx = Math.round((wx - s.wx) / st) * st, dy = Math.round((wy - s.wy) / st) * st;
  if (s.kind === 'item') { s.it.x = s.x + dx; s.it.y = s.y + dy; }
  if (s.kind === 'wall') { const w = s.w; w.x1 = s.p[0] + dx; w.y1 = s.p[1] + dy; w.x2 = s.p[2] + dx; w.y2 = s.p[3] + dy; for (const k of s.links) { if (k.ma) { k.o.x1 = k.a[0] + dx; k.o.y1 = k.a[1] + dy; } if (k.mb) { k.o.x2 = k.b[0] + dx; k.o.y2 = k.b[1] + dy; } } }
  if (s.kind === 'open') { const w = wallOf(s.o.wall), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, d = Math.round(((wx - s.wx) * ux + (wy - s.wy) * uy) / st) * st; s.o.t = clamp(s.t + d, s.o.w / 2, L - s.o.w / 2); }
  if (s.kind === 'line') s.l.pts = s.pts.map((p) => [p[0] + dx, p[1] + dy]);
  if (s.kind === 'sketch') s.k.pts = s.pts.map((p) => [p[0] + dx, p[1], p[2] + dy]);
  return dx || dy;
}
function beginMoveAll(wx, wy) { const keep = sel, out = selList().filter((s) => s.kind !== 'floor').map((s) => { sel = s; return beginMove(wx, wy); }); sel = keep; return out; }
function applyMoveAll(ms, wx, wy) { let m = false; for (const s of ms) if (applyMove(s, wx, wy)) m = true; return m; }
function nearAny(wx, wy, tol) { const keep = sel, r = selList().some((s) => { sel = s; return nearSel(wx, wy, tol); }); sel = keep; return r; }
function nudge(dx, dy) { if (!sel) return; applyMoveAll(beginMoveAll(0, 0), dx, dy); commit(); }
function setMove(on) { moveOn = !!on && !!sel; renderQuick(); $('#moveHint').hidden = !moveOn; draw2d(); }
/* 그리기 보조: 원호 · 손그림 보정 */
function circle3(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-6) return null;
  const s = (p) => p[0] * p[0] + p[1] * p[1];
  const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d, y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return { x, y, r: Math.hypot(a[0] - x, a[1] - y) };
}
function arcPts(a, m, b, seg = 350) {
  const c = circle3(a, m, b); if (!c || c.r > 1e6) return [a, b];
  const ang = (p) => Math.atan2(p[1] - c.y, p[0] - c.x), TAU = Math.PI * 2, norm = (x) => ((x % TAU) + TAU) % TAU;
  const a0 = ang(a), am = norm(ang(m) - a0), a1 = norm(ang(b) - a0), ccw = am < a1, span = ccw ? a1 : -(TAU - a1);
  const n = clamp(Math.round(Math.abs(span) * c.r / seg), 4, 48), out = [];
  for (let i = 0; i <= n; i++) { const t = a0 + span * i / n; out.push([Math.round(c.x + c.r * Math.cos(t)), Math.round(c.y + c.r * Math.sin(t))]); }
  out[0] = a; out[n] = b; return out;
}
function rdp(pts, tol) {
  if (pts.length < 3) return pts.map((_, i) => i);
  const keep = new Set([0, pts.length - 1]), st = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop(); let mx = 0, k = -1; for (let m = i + 1; m < j; m++) { const d = distPtSeg(pts[m][0], pts[m][1], { x1: pts[i][0], y1: pts[i][1], x2: pts[j][0], y2: pts[j][1] })[0]; if (d > mx) { mx = d; k = m; } } if (mx > tol) { keep.add(k); st.push([i, k], [k, j]); } }
  return [...keep].sort((x, y) => x - y);
}
function fitStroke(raw, on, snapWalls = tool === 'wall') {
  const b = aabb(raw), diag = Math.hypot(b[2] - b[0], b[3] - b[1]) || 1;
  if (!on) { const idx = rdp(raw, 25); return idx.map((i) => raw[i].map(Math.round)); }
  const tol = clamp(diag * 0.035, 50, 350), idx = rdp(raw, tol), pieces = [];
  let a = 0;
  while (a < idx.length - 1) {
    let best = a + 1, arc = null;
    for (let z = a + 2; z < idx.length; z++) {
      const run = raw.slice(idx[a], idx[z] + 1), m = run[Math.floor(run.length / 2)], c = circle3(run[0], m, run[run.length - 1]);
      if (!c || c.r > diag * 4) break;
      const dev = Math.max(...run.map((p) => Math.abs(Math.hypot(p[0] - c.x, p[1] - c.y) - c.r)));
      if (dev > tol * 0.8) break; best = z; arc = [run[0], m, run[run.length - 1]];
    }
    pieces.push(arc ? { arc } : { a: raw[idx[a]], b: raw[idx[best]] }); a = best;
  }
  // 모서리에 생긴 짧은 꺾임은 앞뒤 직선의 교점으로 정리
  for (let i = 1; i < pieces.length - 1; i++) {
    const p0 = pieces[i - 1], p1 = pieces[i], p2 = pieces[i + 1];
    if (p0.arc || p1.arc || p2.arc || Math.hypot(p1.b[0] - p1.a[0], p1.b[1] - p1.a[1]) > tol * 1.6) continue;
    const d1 = [p0.b[0] - p0.a[0], p0.b[1] - p0.a[1]], d2 = [p2.b[0] - p2.a[0], p2.b[1] - p2.a[1]], den = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(den) < 1e-6) continue;
    const t = ((p2.a[0] - p0.a[0]) * d2[1] - (p2.a[1] - p0.a[1]) * d2[0]) / den, X = [p0.a[0] + d1[0] * t, p0.a[1] + d1[1] * t];
    p0.b = X; p2.a = X; pieces.splice(i, 1); i--;
  }
  // 직선은 0° · 45° · 90° 로 맞추고 이어 붙이기
  const out = [raw[0].map(Math.round)]; let cur = out[0];
  for (const pc of pieces) {
    if (pc.arc) { const off = [cur[0] - pc.arc[0][0], cur[1] - pc.arc[0][1]], tr = pc.arc.map((p) => [p[0] + off[0], p[1] + off[1]]); const ap = arcPts(tr[0], tr[1], tr[2]); out.push(...ap.slice(1)); cur = ap[ap.length - 1]; continue; }
    let dx = pc.b[0] - pc.a[0], dy = pc.b[1] - pc.a[1]; const L = Math.hypot(dx, dy); if (L < tol * 0.5) continue;
    const ang = Math.atan2(dy, dx), sn = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(ang - sn) < 0.16) { dx = Math.cos(sn) * L; dy = Math.sin(sn) * L; }
    const g = (P && std().grid) || 50, np = [Math.round((cur[0] + dx) / g) * g, Math.round((cur[1] + dy) / g) * g];
    if (Math.abs(sn % (Math.PI / 2)) < 1e-6 && Math.abs(ang - sn) < 0.16) { if (Math.abs(Math.cos(sn)) > 0.5) np[1] = cur[1]; else np[0] = cur[0]; }
    out.push(np); cur = np;
  }
  const last = out[out.length - 1]; if (out.length > 2 && Math.hypot(last[0] - out[0][0], last[1] - out[0][1]) < tol * 1.5) out[out.length - 1] = [...out[0]];
  // 기존 벽 끝점에 붙이기
  if (snapWalls) for (const p of [out[0], out[out.length - 1]]) { for (const w of P.walls) for (const q of [[w.x1, w.y1], [w.x2, w.y2]]) if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 200) { p[0] = q[0]; p[1] = q[1]; } }
  return out;
}
function addPath(pts, kind = tool) {
  if (pts.length < 2) return;
  if (kind === 'wall') { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) continue; P.walls.push({ id: uid('w'), x1: a[0], y1: a[1], x2: b[0], y2: b[1], finish: { type: 'paint', color: '#ece8e1' } }); } }
  else P.lines.push({ id: uid('l'), kind: lineKind, pts, ...lineExtra(lineKind) });
  commit(); dirty3d = true;
}
let multi = [], multiMode = false, batch = false;
const selList = () => (multi.length > 1 ? multi : sel ? [sel] : []);
const isSelected = (kind, id) => selList().some((s) => s.kind === kind && s.id === id);
function toggleSel(h) {
  if (!h || h.kind === 'floor') return;
  if (!multi.length && sel && sel.kind !== 'floor') multi = [sel];
  const i = multi.findIndex((s) => s.kind === h.kind && s.id === h.id); if (i >= 0) multi.splice(i, 1); else multi.push(h);
  sel = multi[multi.length - 1] || null; if (multi.length <= 1) multi = [];
  dirty3d = true; renderProps(); renderObjects(); draw2d(); need3d = true;
}
function existsSel(s) { const k = sel; sel = s; const ok = s.kind === 'floor' || !!selName(); sel = k; return ok; }
function withEach(fn) { const list = selList(), keep = sel; batch = true; try { for (const s of list) { if (!existsSel(s)) continue; sel = s; fn(s); } } finally { batch = false; multi = multi.filter(existsSel); if (multi.length < 2) multi = []; sel = keep && existsSel(keep) ? keep : multi[multi.length - 1] || null; } commit(); }
function pickSel0(h) { multi = []; pickSel(h); }
function pickSel(h) { dirty3d = true; multi = []; setTimeout(updFab, 0); const changed = JSON.stringify(h) !== JSON.stringify(sel); sel = h; if (!sel) moveOn = false; if (changed) qTab = qTab || 'size'; $('#moveHint').hidden = !moveOn; renderProps(); renderObjects(); draw2d(); need3d = true; }
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, evPos(e));
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: V.s, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ox: V.ox, oy: V.oy }; if (draft && draft.free) draft = null; drag = null; return; }
  const [sx, sy] = evPos(e); let [wx, wy] = toW(sx, sy);
  if (tool === 'wall' || tool === 'line') {
    if (drawMode === 'free') { draft = { free: true, raw: [[wx, wy]], pts: [] }; return; }
    wx = snapGrid(wx); wy = snapGrid(wy);
    if (!draft) draft = { pts: [] };
    if (drawMode === 'arc') {
      draft.pts.push([wx, wy]);
      if (draft.pts.length === 3) { const [a, b, m] = draft.pts; addPath(arcPts(a, m, b)); draft = null; }
      draw2d(); return;
    }
    const p = orthoSnap(draft.pts[draft.pts.length - 1], [wx, wy]);
    const lastP = draft.pts[draft.pts.length - 1];
    if (lastP && Math.hypot(lastP[0] - p[0], lastP[1] - p[1]) < 1) { finishDraft(); return; }
    draft.pts.push(p);
    if (tool === 'wall' && draft.pts.length >= 2) { const a = draft.pts[draft.pts.length - 2]; P.walls.push({ id: uid('w'), x1: a[0], y1: a[1], x2: p[0], y2: p[1], finish: { type: 'paint', color: '#ece8e1' } }); commit(); }
    draw2d(); return;
  }
  if (tool === 'door' || tool === 'window') {
    let best = null; for (const w of P.walls) { const [d, t] = distPtSeg(wx, wy, w); if (d < 400 && (!best || d < best.d)) best = { d, t, w }; }
    if (best) {
      const typ = tool === 'door' ? 'door1' : 'window', L = Math.hypot(best.w.x2 - best.w.x1, best.w.y2 - best.w.y1), [ow, oh, os] = OPDEF[typ];
      const o = { id: uid('o'), wall: best.w.id, t: Math.round(clamp(best.t * L, ow / 2, L - ow / 2)), type: typ, w: Math.min(ow, L), h: oh, sill: os, frame: '#2b2d31' };
      P.openings.push(o); sel = { kind: 'open', id: o.id }; setTool('select'); commit(); dirty3d = true;
    } else toast('벽 가까이를 눌러 주세요');
    return;
  }
  const hd = handleAt(sx, sy, e.pointerType === 'touch' ? 24 : 12); if (hd) { drag = { kind: hd.type, hd, moved: false, start: JSON.stringify(P) }; return; }
  if (moveOn && sel && nearAny(wx, wy)) { drag = { kind: 'move', ms: beginMoveAll(wx, wy), moved: false }; return; }
  drag = { kind: 'pan', sx, sy, ox: V.ox, oy: V.oy, wx, wy, moved: false };
  drag.lpT = setTimeout(() => { if (drag && drag.kind === 'pan' && !drag.moved) { const h = hitTest(drag.wx, drag.wy); if (h) { drag.lp = true; lastHit = hit2d(h, drag.wx, drag.wy); pickSel(h); buzz(); toast('선택했어요 · 이 개체만 고칠 수 있어요'); } } }, 480);
});
cv.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) { if (draft && !draft.free) { const [sx, sy] = evPos(e); const [wx, wy] = toW(sx, sy); draft.hover = drawMode === 'arc' ? [snapGrid(wx), snapGrid(wy)] : orthoSnap(draft.pts[draft.pts.length - 1], [snapGrid(wx), snapGrid(wy)]); draw2d(); } return; }
  ptrs.set(e.pointerId, evPos(e));
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const ns = clamp(pinch.s * d / pinch.d, 0.005, 1); const wx = (pinch.m[0] - pinch.ox) / pinch.s, wy = (pinch.m[1] - pinch.oy) / pinch.s;
    V.s = ns; V.ox = m[0] - wx * ns; V.oy = m[1] - wy * ns; draw2d(); return;
  }
  const [sx, sy] = evPos(e), [wx, wy] = toW(sx, sy);
  if (draft && draft.free) { const l = draft.raw[draft.raw.length - 1]; if (Math.hypot(wx - l[0], wy - l[1]) * V.s > 3) draft.raw.push([wx, wy]); draw2d(); return; }
  if (draft) { draft.hover = drawMode === 'arc' ? [snapGrid(wx), snapGrid(wy)] : orthoSnap(draft.pts[draft.pts.length - 1], [snapGrid(wx), snapGrid(wy)]); draw2d(); return; }
  if (!drag) return;
  if (drag.kind === 'corner' || drag.kind === 'wallend') { dragHandle(drag, wx, wy, e.shiftKey); drag.moved = true; analyze(); draw2d(); dirty3d = true; return; }
  if (drag.kind === 'pan') { if (Math.hypot(sx - drag.sx, sy - drag.sy) > 6) { drag.moved = true; clearTimeout(drag.lpT); } if (drag.moved) { V.ox = drag.ox + sx - drag.sx; V.oy = drag.oy + sy - drag.sy; draw2d(); } }
  else if (drag.kind === 'move') { if (applyMoveAll(drag.ms, wx, wy)) drag.moved = true; analyze(); draw2d(); dirty3d = true; }
});
function endPtr(e) {
  const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (draft && draft.free && had && e.type === 'pointerup') { const pts = fitStroke(draft.raw, assist); draft = null; if (pts.length >= 2) addPath(pts); else draw2d(); return; }
  if (drag && drag.kind === 'move' && drag.moved) { commit(); dirty3d = true; }
  if (drag) clearTimeout(drag.lpT);
  if (drag && (drag.kind === 'corner' || drag.kind === 'wallend') && drag.moved) commit();
  if (drag && drag.kind === 'pan' && !drag.moved && !drag.lp && e.type === 'pointerup') { const h = hitTest(drag.wx, drag.wy); lastHit = hit2d(h, drag.wx, drag.wy); if (e.ctrlKey || e.metaKey || e.shiftKey || multiMode) toggleSel(h); else pickSel(h); }
  drag = null;
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('dblclick', () => { if (draft) finishDraft(); });
cv.addEventListener('wheel', (e) => {
  e.preventDefault(); const [sx, sy] = evPos(e), f = Math.exp(-e.deltaY * 0.0012), ns = clamp(V.s * f, 0.005, 1);
  const wx = (sx - V.ox) / V.s, wy = (sy - V.oy) / V.s; V.s = ns; V.ox = sx - wx * ns; V.oy = sy - wy * ns; draw2d();
}, { passive: false });
function finishDraft() {
  if (tool === 'line' && draft && !draft.free && drawMode === 'line' && draft.pts.length >= 2) { P.lines.push({ id: uid('l'), kind: lineKind, ...lineExtra(lineKind), pts: draft.pts }); commit(); }
  dirty3d = true; draft = null; draw2d();
}

/* ---------- 기물 놓기 ---------- */
function placeItem(type, wx, wy) {
  const L = libGet(type);
  const sz = libSize(type), it = { id: uid('i'), type, x: snapGrid(wx), y: snapGrid(wy), w: sz.w, d: sz.d, rot: 0 }; if (sz.h !== L.h) it.h = sz.h;
  if (L.cat === '내 기물') { it.tag = L.tag || L.name; it.img = L.img; }
  P.items.push(it); if (physical(it)) wallSnap(it);
  sel = { kind: 'item', id: it.id }; commit(); dirty3d = true;
  toast(`${L.name} 배치됨`);
}
let ghost = null;
let libDragging = false;
function libPointerDown(e, type) {
  const touch = e.pointerType === 'touch'; if (!touch) e.preventDefault();
  const start = [e.clientX, e.clientY]; let moved = false, armed = !touch, aborted = false;
  const begin = (x, y) => { moved = true; libDragging = true; ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = libGet(type).name; ghost.style.left = x + 'px'; ghost.style.top = y + 'px'; document.body.appendChild(ghost); if (isMobile()) closeSheet(); };
  const timer = touch ? setTimeout(() => { if (!aborted) { armed = true; begin(start[0], start[1]); } }, 380) : 0;
  const mv = (ev) => {
    const far = Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 8;
    if (!armed) { if (far) { aborted = true; clearTimeout(timer); } return; }
    if (!moved && far) begin(ev.clientX, ev.clientY);
    if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; }
  };
  const cancel = () => { clearTimeout(timer); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); if (ghost && !libDragging) { ghost.remove(); ghost = null; } };
  const up = (ev) => {
    clearTimeout(timer); libDragging = false; window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    if (aborted) return;
    if (ghost) { ghost.remove(); ghost = null; }
    const r = cv.getBoundingClientRect();
    const r3 = gc.getBoundingClientRect(), in3 = view !== '2d' && ev.clientX > r3.left && ev.clientX < r3.right && ev.clientY > r3.top && ev.clientY < r3.bottom;
    if (moved && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom && view !== '3d') {
      const [wx, wy] = toW(ev.clientX - r.left, ev.clientY - r.top); placeItem(type, wx, wy);
    } else if (moved && in3) { const g = planeHit(ev, 0); if (g) placeItem(type, g[0], g[1]); }
    else if (!moved) {
      const [wx, wy] = view === '3d' ? [cam.tx, cam.tz] : toW(r.width / 2, r.height / 2); placeItem(type, wx, wy);
      if (isMobile()) closeSheet();
    }
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
}
$('#libGrid').addEventListener('touchmove', (e) => { if (libDragging) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', (e) => { if (libDragging) e.preventDefault(); }, { passive: false });

/* ---------- 3D (WebGL) ---------- */
const gc = $('#c3d'); const gl = gc.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: true });
let dirty3d = true, meshes = [], tex = {}, prog = null;
const cam = { yaw: -0.9, pitch: 0.75, dist: 16000, tx: 4000, ty: 0, tz: 9000, cut: true, fov: 50 };
let anim = null, tour = null;
function aspect3d() { const r = gc.getBoundingClientRect(); return r.width && r.height ? r.width / r.height : 1.5; }
function fitDist(asp, fov = cam.fov || 50) { const b = bounds(), rad = 0.5 * Math.hypot(b[2] - b[0], b[3] - b[1], cam.cut ? 1200 : P.ceilingH), vf = fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp); return rad / Math.sin(Math.min(vf, hf) / 2) * 1.04; }
function clampGoal() { if (!P) return; const b = bounds(), m = 1500, lim = fitDist(aspect3d()) * 2.4; goal.tx = clamp(goal.tx, b[0] - m, b[2] + m); goal.tz = clamp(goal.tz, b[1] - m, b[3] + m); goal.ty = clamp(goal.ty, curElev(), curElev() + 2200); goal.dist = clamp(goal.dist, 700, Math.max(lim, 3000)); }
function recenter(dur = 900) { const b = bounds(); anim = { t0: performance.now(), dur, a: { ...cam }, b: { yaw: cam.yaw, pitch: Math.max(cam.pitch, 0.35), dist: fitDist(aspect3d()), tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2 } }; }
function cam3dDefault() { const b = bounds(); cam.tx = (b[0] + b[2]) / 2; cam.tz = (b[1] + b[3]) / 2; cam.ty = curElev(); cam.dist = fitDist(aspect3d()); cam.yaw = -0.9; cam.pitch = 0.75; cam.cut = true; if (typeof syncGoal === 'function') syncGoal(); }
function initGL() {
  if (!gl) { $('#v3d').innerHTML = '<p class="nogl">이 기기에서 3D를 켤 수 없어요 (WebGL 미지원)</p>'; return; }
  const vs = `attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute vec2 u;uniform mat4 M;varying vec3 vn;varying vec3 vc;varying vec2 vu;varying float vy;
  void main(){gl_Position=M*vec4(p,1.);vn=n;vc=c;vu=u;vy=p.y;}`;
  const fs = `precision mediump float;varying vec3 vn;varying vec3 vc;varying vec2 vu;varying float vy;uniform sampler2D T;uniform float useT;uniform float A;uniform vec3 L;uniform float K;
  void main(){vec3 nn=normalize(vn);float d=max(dot(nn,L),0.);float h=.5+.5*nn.y;vec3 col=vc;if(useT>.5)col*=texture2D(T,vu).rgb;
  vec3 o=col*K*(.42+.18*h+.5*d);gl_FragColor=vec4(o,A);}`;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  for (const k of ['tile', 'wood', 'epoxy', 'concrete', 'brick', 'filmwood', 'steel', 'grass', 'plywood', 'marble', 'plastic', 'frost']) tex[k] = makeTex(k);
  tex.tilew = tex.tile;
}
function makeTex(k) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  const rnd = (a) => Math.random() * a;
  if (k === 'tile') { g.strokeStyle = '#b8b8b8'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256); }
  if (k === 'brick') { g.fillStyle = '#c9c9c9'; for (let y = 0; y < 256; y += 32) { g.fillRect(0, y, 256, 4); for (let x = (y / 32) % 2 ? 0 : 64; x < 256; x += 128) g.fillRect(x, y, 4, 32); } }
  if (k === 'wood' || k === 'filmwood') { for (let y = 0; y < 256; y += 32) { g.fillStyle = `rgba(0,0,0,${.05 + rnd(.08)})`; g.fillRect(0, y, 256, 32); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, 256, 1.5); for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(80,40,10,${rnd(.12)})`; g.beginPath(); g.moveTo(0, y + rnd(32)); g.bezierCurveTo(80, y + rnd(32), 170, y + rnd(32), 256, y + rnd(32)); g.stroke(); } } }
  if (k === 'epoxy') { for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${rnd(.05)})`; g.fillRect(rnd(256), rnd(256), 2, 2); } const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); }
  if (k === 'concrete') { for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${rnd(.08)})`; g.fillRect(rnd(256), rnd(256), 1 + rnd(2), 1 + rnd(2)); } }
  if (k === 'steel') { for (let y = 0; y < 256; y++) { g.fillStyle = `rgba(0,0,0,${rnd(.06)})`; g.fillRect(0, y, 256, 1); } }
  if (k === 'plywood') { g.fillStyle = '#f3e6cf'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(150,110,60,${.05 + rnd(.12)})`; g.lineWidth = 1 + rnd(2); g.beginPath(); const y = rnd(256); g.moveTo(0, y); g.bezierCurveTo(90, y + rnd(20) - 10, 170, y + rnd(20) - 10, 256, y + rnd(10) - 5); g.stroke(); } }
  if (k === 'marble') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(90,90,100,${.08 + rnd(.25)})`; g.lineWidth = .6 + rnd(1.6); g.beginPath(); let x = rnd(256), y = rnd(256); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rnd(80) - 20; y += rnd(60) - 30; g.lineTo(x, y); } g.stroke(); } }
  if (k === 'plastic') { for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rnd(.03)})`; g.fillRect(rnd(256), rnd(256), 3, 3); } }
  if (k === 'frost') { for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${rnd(.6)})`; g.fillRect(rnd(256), rnd(256), 1.5, 1.5); } }
  if (k === 'grass') { for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,40,0,${rnd(.3)})`; g.fillRect(rnd(256), rnd(256), 2, 4); } }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); return t;
}
const TILE = { tile: 600, wood: 1200, filmwood: 1200, epoxy: 3000, concrete: 2000, brick: 1000, steel: 800, grass: 1500, plywood: 1200, marble: 1600, plastic: 1000, frost: 1000 };
function tileOf(k) { if (k === 'tile') return (P && std().tileFloor) || 600; if (k === 'tilew') return (P && std().tileWall) || 600; return TILE[k] || 1000; }
/* 지오메트리 빌더 */
let G;
function grp(key, alpha) { if (FADE) alpha = Math.min(alpha || 1, 0.16); const k = key + '|' + (alpha || 1); if (!G[k]) G[k] = { key, alpha: alpha || 1, p: [], n: [], c: [], u: [] }; return G[k]; }
function quad(g, v, nrm, col) {
  const tl = tileOf(g.key), ax = Math.abs(nrm[0]), ay = Math.abs(nrm[1]);
  const uv = (q) => ay > .5 ? [q[0] / tl, q[2] / tl] : ax > .5 ? [q[2] / tl, q[1] / tl] : [q[0] / tl, q[1] / tl];
  for (const i of [0, 1, 2, 0, 2, 3]) { g.p.push(...v[i]); g.n.push(...nrm); g.c.push(...col); g.u.push(...uv(v[i])); }
}
let CLEAR = null;
let YOFF = 0, FADE = false, FOCUS = null, CUT = false, NOENV = false, EXPORTALL = false;
function xf(cx_, cz_, ang) { const c = Math.cos(ang), s = Math.sin(ang), yo = YOFF; return { P: (x, y, z) => [cx_ + x * c - z * s, y + yo, cz_ + x * s + z * c], N: (x, y, z) => [x * c - z * s, y, x * s + z * c] }; }
/* 로컬 박스: x∈[x0,x1] (폭), z∈[z0,z1] (깊이, +z가 앞), y∈[y0,y1] */
let TINT = false;
const tintC = (c) => (TINT ? [c[0] * 0.45 + 0.04 * 0.55, c[1] * 0.45 + 0.52 * 0.55, c[2] * 0.45 + 1.0 * 0.55] : c);
function box(T, x0, x1, y0, y1, z0, z1, col, key, alpha) {
  const g = grp(key || 'plain', alpha), c = tintC(hexRGB(col));
  const v = (x, y, z) => T.P(x, y, z);
  quad(g, [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)], T.N(0, 1, 0), c);
  quad(g, [v(x0, y0, z1), v(x1, y0, z1), v(x1, y0, z0), v(x0, y0, z0)], T.N(0, -1, 0), c.map((q) => q * .9));
  quad(g, [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)], T.N(0, 0, 1), c);
  quad(g, [v(x1, y0, z0), v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0)], T.N(0, 0, -1), c);
  quad(g, [v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0)], T.N(-1, 0, 0), c);
  quad(g, [v(x1, y0, z1), v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1)], T.N(1, 0, 0), c);
}
function cyl(T, x, z, r, y0, y1, col, key, n = 14, alpha) {
  const g = grp(key || 'plain', alpha), c = tintC(hexRGB(col));
  for (let i = 0; i < n; i++) {
    const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, p0 = [x + r * Math.cos(a0), z + r * Math.sin(a0)], p1 = [x + r * Math.cos(a1), z + r * Math.sin(a1)];
    const am = (a0 + a1) / 2;
    quad(g, [T.P(p0[0], y0, p0[1]), T.P(p1[0], y0, p1[1]), T.P(p1[0], y1, p1[1]), T.P(p0[0], y1, p0[1])], T.N(Math.cos(am), 0, Math.sin(am)), c);
    quad(g, [T.P(x, y1, z), T.P(x, y1, z), T.P(p1[0], y1, p1[1]), T.P(p0[0], y1, p0[1])], T.N(0, 1, 0), c);
  }
}
function sph(T, x, y, z, rx, ry, rz, col) {
  const g = grp('plain'), c = tintC(hexRGB(col)), nu = 10, nv = 7;
  const pt = (i, j) => { const th = 2 * Math.PI * i / nu, ph = Math.PI * j / nv; return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]; const m = pt(i + .5, j + .5);
    const shade = c.map((v) => v * (0.85 + 0.15 * ((i + j) % 2)));
    quad(g, [q[0], q[3], q[2], q[1]].map((u) => T.P(x + u[0] * rx, y + u[1] * ry, z + u[2] * rz)), T.N(m[0], m[1], m[2]), shade);
  }
}
function buildItem(it) {
  const s = spec(it), sh = s.L.shape, w = it.w, d = it.d, h = s.h, e = zOf(it);
  const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), col = s.color, mk = MATS[s.mat].tex, ma = MATS[s.mat].a;
  const hw = w / 2, hd = d / 2, B = (x0, x1, y0, y1, z0, z1, c, k, a) => box(T, x0, x1, e + y0, e + y1, z0, z1, c || col, k || mk, a ?? (c ? undefined : ma));
  const legs = (H, t = 40, ins = 30, c = '#9aa1a9') => { for (const x of [-hw + ins, hw - ins - t]) for (const z of [-hd + ins, hd - ins - t]) B(x, x + t, 0, H, z, z + t, c, 'steel'); };
  const doors = (y0, y1, n) => { for (let i = 0; i < n; i++) { const a = -hw + w * i / n + 15, b = -hw + w * (i + 1) / n - 15; B(a, b, y0, y1, hd, hd + 18, '#dfe3e8', 'steel'); const hx = i % 2 ? a + 40 : b - 60; B(hx, hx + 20, y1 - 280, y1 - 60, hd + 18, hd + 45, '#3a3e44'); } };
  switch (sh) {
    case 'fridge': B(-hw, hw, 0, 100, -hd, hd, '#1e2024'); B(-hw, hw, 100, h - 60, -hd, hd - 20); B(-hw, hw, h - 60, h, -hd, hd, '#3a3e44'); { const n = Math.max(1, Math.round(w / 650)); doors(130, (h - 60) / 2 - 15, n); doors((h - 60) / 2 + 15, h - 90, n); } break;
    case 'showcase': B(-hw, hw, 0, 100, -hd, hd, '#1e2024'); B(-hw, hw, 100, h, -hd, hd - 30); B(-hw + 40, hw - 40, 140, h - 160, hd - 30, hd - 10, '#bfe3f5', 'plain', .45); for (let y = 500; y < h - 200; y += 380) B(-hw + 60, hw - 60, y, y + 15, -hd + 60, hd - 40, '#e8e8e8'); break;
    case 'tfridge': B(-hw, hw, 0, 100, -hd, hd, '#1e2024'); B(-hw, hw, 100, h - 40, -hd, hd - 20); B(-hw, hw + 0, h - 40, h, -hd, hd); doors(140, h - 70, Math.max(1, Math.round(w / 600))); break;
    case 'work': case 'work2': legs(h - 40); B(-hw, hw, h - 40, h, -hd, hd); if (sh === 'work2') B(-hw + 20, hw - 20, 160, 185, -hd + 20, hd - 20); B(-hw, hw, h, h + 100, -hd, -hd + 15); break;
    case 'sink': { const n = Math.max(1, Math.round(w / 650)); B(-hw, hw, 0, 600, -hd, hd); B(-hw, hw, 600, h, hd - 80, hd); B(-hw, hw, 600, h, -hd, -hd + 150); for (let i = 0; i <= n; i++) { const x = -hw + w * i / n; B(Math.max(-hw, x - 40), Math.min(hw, x + 40), 600, h, -hd + 150, hd - 80); } for (let i = 0; i < n; i++) { const xc = -hw + w * (i + .5) / n; B(-hw + w * i / n + 40, -hw + w * (i + 1) / n - 40, 600, 620, -hd + 150, hd - 80, '#9aa1a9'); cyl(T, xc, -hd + 75, 22, e + h, e + h + 300, '#c9ced4', 'steel', 8); box(T, xc - 15, xc + 15, e + h + 270, e + h + 300, -hd + 75, -hd + 260, '#c9ced4', 'steel'); } B(-hw, hw, h, h + 100, -hd, -hd + 15); } break;
    case 'fryer': { const n = Math.max(1, Math.round(w / 450)); B(-hw, hw, 0, 100, -hd, hd, '#1e2024'); B(-hw, hw, 100, 650, -hd, hd); B(-hw, hw, 650, 850, hd - 40, hd, '#3a3e44'); B(-hw, hw, 650, 850, -hd, -hd + 110, '#3a3e44'); B(-hw, hw, 850, h + 100, -hd, -hd + 110, '#1e2024');
      for (let i = 0; i <= n; i++) { const x = -hw + w * i / n; B(Math.max(-hw, x - 30), Math.min(hw, x + 30), 650, 850, -hd + 110, hd - 40, '#3a3e44'); }
      for (let i = 0; i < n; i++) { const a = -hw + w * i / n + 30, b = -hw + w * (i + 1) / n - 30, xc = (a + b) / 2; B(a, b, 650, 780, -hd + 110, hd - 40, '#c08a1e'); B(a + 20, b - 20, 790, 840, -hd + 130, -hd + 140, '#d9dde2'); B(a + 20, b - 20, 790, 840, hd - 70, hd - 60, '#d9dde2'); B(xc - 12, xc + 12, 860, 885, hd - 60, hd + 140, '#1e2024'); B(xc - 25, xc + 25, 450, 490, hd, hd + 25, '#1e2024'); } } break;
    case 'range': { legs(150, 50, 20); B(-hw, hw, 150, h, -hd, hd); B(-hw, hw, h, h + 20, -hd, hd, '#1e2024'); const n = Math.max(1, Math.round(w / 600));
      for (let i = 0; i < n; i++) { const xc = -hw + w * (i + .5) / n; cyl(T, xc, -40, Math.min(w / n, d) * .28, e + h + 20, e + h + 40, '#2a2c30', 'plain', 16); cyl(T, xc, -40, 70, e + h + 20, e + h + 55, '#55595f', 'plain', 10);
        for (const k of [-1, 1]) { box(T, xc - 190, xc + 190, e + h + 55, e + h + 80, -40 + k * 90 - 12, -40 + k * 90 + 12, '#1e2024'); box(T, xc + k * 90 - 12, xc + k * 90 + 12, e + h + 55, e + h + 80, -230, 150, '#1e2024'); }
        B(xc - 25, xc + 25, h - 120, h - 70, hd, hd + 30, '#b0b4ba'); } } break;
    case 'rack': for (const x of [-hw, hw - 30]) for (const z of [-hd, hd - 30]) B(x, x + 30, 0, h, z, z + 30, '#9aa1a9'); for (let y = 150; y < h; y += Math.max(300, (h - 150) / 3)) B(-hw, hw, y, y + 25, -hd, hd); if (s.L.id === 'holding') B(-hw, hw, h - 40, h, -hd, hd, '#e07b39'); break;
    case 'tank': cyl(T, 0, 0, Math.min(hw, hd) - 20, e, e + 80, '#3a3e44'); cyl(T, 0, 0, Math.min(hw, hd) - 40, e + 80, e + h - 60, col, 'plain', 18); cyl(T, 0, 0, 60, e + h - 60, e + h, '#2d6fb3', 'plain', 10); break;
    case 'hood': B(-hw, hw, 0, h, -hd, hd); B(-hw + 40, hw - 40, -5, 0, -hd + 40, hd - 40, '#7d838b'); B(-200, 200, h, h + 600, -hd, -hd + 400, '#b9bec5'); break;
    case 'shelf': B(-hw, hw, 0, h, -hd, hd); for (const x of [-hw + 80, hw - 110]) B(x, x + 30, -150, 0, -hd, -hd + 30, '#9aa1a9'); break;
    case 'table': B(-hw, hw, h - 35, h, -hd, hd); if (w > 900) { B(-hw + 40, -hw + 80, 0, h - 35, -hd + 40, -hd + 80, '#2b2d31'); B(hw - 80, hw - 40, 0, h - 35, -hd + 40, -hd + 80, '#2b2d31'); B(-hw + 40, -hw + 80, 0, h - 35, hd - 80, hd - 40, '#2b2d31'); B(hw - 80, hw - 40, 0, h - 35, hd - 80, hd - 40, '#2b2d31'); } else { cyl(T, 0, 0, 35, e, e + h - 35, '#2b2d31', 'plain', 8); cyl(T, 0, 0, Math.min(hw, hd) * .7, e, e + 20, '#2b2d31', 'plain', 12); } break;
    case 'roundtable': cyl(T, 0, 0, Math.min(hw, hd), e + h - 35, e + h, col, mk, 22, ma); cyl(T, 0, 0, 35, e, e + h - 35, '#2b2d31', 'plain', 8); cyl(T, 0, 0, Math.min(hw, hd) * .6, e, e + 20, '#2b2d31', 'plain', 14); break;
    case 'counter': B(-hw, hw, 0, h - 40, -hd + 60, hd); B(-hw, hw, h - 40, h, -hd, hd, '#e8e4dc'); B(-hw, hw, 700, 740, -hd + 60, -hd + 400, '#e8e4dc'); break;
    case 'chair': { const sh2 = 450; for (const x of [-hw + 20, hw - 45]) for (const z of [-hd + 20, hd - 45]) B(x, x + 25, 0, sh2 - 40, z, z + 25, '#2b2d31'); B(-hw, hw, sh2 - 40, sh2, -hd, hd); B(-hw + 10, hw - 10, sh2, h, hd - 50, hd - 10); } break;
    case 'stool': cyl(T, 0, 0, Math.min(hw, hd), e + h - 50, e + h, col, mk, 16, ma); cyl(T, 0, 0, 30, e, e + h - 50, '#2b2d31', 'plain', 8); cyl(T, 0, 0, Math.min(hw, hd) * .7, e, e + 15, '#2b2d31', 'plain', 12); break;
    case 'barchair': { const sh2 = 750; cyl(T, 0, 0, Math.min(hw, hd) - 10, e + sh2 - 50, e + sh2, col, mk, 16, ma); cyl(T, 0, 0, 30, e, e + sh2 - 50, '#9aa1a9', 'steel', 8); cyl(T, 0, 0, Math.min(hw, hd) * .7, e, e + 15, '#9aa1a9', 'steel', 12); B(-hw + 40, hw - 40, 280, 300, -hd + 40, hd - 40, '#9aa1a9', 'steel'); B(-hw + 30, hw - 30, sh2, h, hd - 45, hd - 15); } break;
    case 'bench': B(-hw, hw, 400, h, -hd, hd); for (const x of [-hw + 40, hw - 80]) B(x, x + 40, 0, 400, -hd + 40, hd - 40, '#2b2d31'); break;
    case 'sofa': B(-hw, hw, 0, 120, -hd + 20, hd - 20, '#2b2d31'); B(-hw, hw, 120, 450, -hd, hd); B(-hw, hw, 450, h, hd - 180, hd); if (w < 1200) { B(-hw, -hw + 120, 450, 650, -hd, hd); B(hw - 120, hw, 450, 650, -hd, hd); } break;
    case 'zone': { const fm = it.finish?.type || s.mat; box(T, -hw, hw, e, e + 4, -hd, hd, it.finish?.color || col, matTex(fm), matA(fm)); } break;
    case 'bulkhead': box(T, -hw, hw, P.soffitH, P.ceilingH, -hd, hd, col); break;
    case 'acwall': B(-hw, hw, 0, h, -hd, hd); B(-hw + 60, hw - 60, 30, 60, hd - 10, hd + 2, '#3a3e44'); break;
    case 'cassette': B(-hw, hw, h - 30, h, -hd, hd); B(-hw + 100, hw - 100, h - 35, h - 30, -hd + 100, hd - 100, '#cfd3d8'); if (w > 500) for (const [a, b, c2, d2] of [[-hw + 40, hw - 40, -hd + 40, -hd + 90], [-hw + 40, hw - 40, hd - 90, hd - 40], [-hw + 40, -hw + 90, -hd + 100, hd - 100], [hw - 90, hw - 40, -hd + 100, hd - 100]]) B(a, b, h - 34, h - 30, c2, d2, '#8a9096'); B(-hw, hw, h, h + 200, -hd, hd, '#d5d8dc'); break;
    case 'light': B(-hw, hw, h - 15, h, -hd, hd, '#fffbe8'); break;
    case 'pendant': { const top = P.ceilingH; box(T, -4, 4, e + h, top, -4, 4, '#222'); cyl(T, 0, 0, hw, e, e + h, col, 'plain', 14); cyl(T, 0, 0, hw * .5, e - 10, e, '#fff6d8', 'plain', 10); } break;
    case 'mark': B(-50, 50, 0, 100, -15, 15, s.color); break;
    case 'drainpt': B(-hw, hw, 0, 6, -hd, hd, '#6f7780'); for (let x = -hw + 20; x < hw - 20; x += 40) B(x, x + 15, 6, 8, -hd + 20, hd - 20, '#3a3e44'); break;
    case 'cube': B(-hw, hw, 0, h, -hd, hd); break;
    case 'bed': B(-hw, hw, 0, 250, -hd, hd); B(-hw + 30, hw - 30, 250, h, -hd + 80, hd - 30, '#f4f2ee', 'plain'); B(-hw, hw, 0, 1000, -hd, -hd + 70); for (const k of [-1, 1]) if (w > 1200 || k < 0) B(k < 0 ? -hw + 120 : 60, k < 0 ? (w > 1200 ? -60 : hw - 120) : hw - 120, h, h + 120, -hd + 100, -hd + 450, '#ffffff', 'plain'); break;
    case 'toilet': B(-hw + 20, hw - 20, 0, h, -hd, -hd + 200); cyl(T, 0, hd * 0.25, Math.min(hw, hd * 0.6), e, e + 400, col, mk, 18, ma); cyl(T, 0, hd * 0.25, Math.min(hw, hd * 0.6) - 30, e + 400, e + 420, '#e8e8e8', 'plain', 18); break;
    case 'tub': B(-hw, hw, 0, h, -hd, -hd + 80); B(-hw, hw, 0, h, hd - 80, hd); B(-hw, -hw + 80, 0, h, -hd, hd); B(hw - 80, hw, 0, h, -hd, hd); B(-hw + 80, hw - 80, 0, 80, -hd + 80, hd - 80); B(-hw + 80, hw - 80, h - 150, h - 140, -hd + 80, hd - 80, '#a9d6ec', 'plain', .5); break;
    case 'sprinkler': cyl(T, 0, 0, 14, e + 20, e + h, '#b0b4ba', 'steel', 8); cyl(T, 0, 0, hw, e, e + 8, col, 'steel', 12); break;
    case 'track': B(-hw, hw, h - 35, h, -20, 20); for (const x of [-hw * 0.6, 0, hw * 0.6]) { cyl(T, x, 0, 12, e + 50, e + h - 35, '#2b2d31', 'plain', 6); cyl(T, x, 0, 38, e, e + 60, '#2b2d31', 'plain', 12); cyl(T, x, 0, 26, e - 2, e, '#fff6d8', 'plain', 10); } break;
    case 'rod': cyl(T, 0, 0, 8, P.ceilingH, P.slabH, '#9aa1a9', 'steel', 6); box(T, -30, 30, P.slabH - 10, P.slabH, -30, 30, '#6e7378'); box(T, -40, 40, P.ceilingH, P.ceilingH + 12, -12, 12, '#6e7378'); break;
    case 'vent': B(-hw, hw, 0, h, -hd, hd); for (let y = 30; y < h - 30; y += 40) B(-hw + 25, hw - 25, y, y + 14, hd, hd + 8, '#8a9096', 'steel'); break;
    case 'cylinder': cyl(T, 0, 0, Math.min(hw, hd), e, e + h, col, mk, 28, ma); break;
    case 'disc': { const g = grp(mk, ma), c = hexRGB(col), r = Math.min(w, h) / 2, n = 28, yc = e + h / 2;
      for (let i = 0; i < n; i++) { const a0 = 2 * Math.PI * i / n, a1 = 2 * Math.PI * (i + 1) / n, p0 = [Math.cos(a0) * r, yc + Math.sin(a0) * r], p1 = [Math.cos(a1) * r, yc + Math.sin(a1) * r], am = (a0 + a1) / 2;
        quad(g, [T.P(p0[0], p0[1], -hd), T.P(p1[0], p1[1], -hd), T.P(p1[0], p1[1], hd), T.P(p0[0], p0[1], hd)], T.N(Math.cos(am), Math.sin(am), 0), c);
        quad(g, [T.P(0, yc, hd), T.P(0, yc, hd), T.P(p1[0], p1[1], hd), T.P(p0[0], p0[1], hd)], T.N(0, 0, 1), c); } } break;
    case 'frame': { const f = Math.min(it.fw || 40, w / 3, h / 3); B(-hw, hw, 0, f, -hd, hd); B(-hw, hw, h - f, h, -hd, hd); B(-hw, -hw + f, f, h - f, -hd, hd); B(hw - f, hw, f, h - f, -hd, hd); B(-hw + f, hw - f, f, h - f, -hd, hd - 8, it.art || '#cfe0ea', 'plain'); } break;
    case 'plant': buildPlant(it, T, e, w, d, h, col, s.L.v); break;
    default: B(-hw, hw, 0, h, -hd, hd); B(-hw + 20, hw - 20, h * .1, h * .9, hd, hd + 10, '#dfe3e8');
  }
}
function buildPlant(it, T, e, w, d, h, col, v) {
  const r = Math.min(w, d) / 2, pot = (pr, ph, c = '#e6e1d8') => { cyl(T, 0, 0, pr, e, e + ph, c, 'plain', 14); cyl(T, 0, 0, pr - 15, e + ph - 30, e + ph - 10, '#4a3626', 'plain', 12); };
  const dark = '#2f5d3a', mid = col;
  if (v === 'monstera') { pot(r * .55, 400); for (let i = 0; i < 7; i++) { const a = i * 0.9, rr = r * .55; sph(T, Math.cos(a) * rr, e + 550 + (i % 3) * 180, Math.sin(a) * rr, 220, 60, 160, i % 2 ? dark : mid); } }
  else if (v === 'olive') { pot(r * .5, 380, '#c9c3b8'); cyl(T, 0, 0, 30, e + 380, e + h - 500, '#6b5a43', 'plain', 8); sph(T, 0, e + h - 380, 0, r * .9, 420, r * .9, mid); sph(T, 120, e + h - 600, -60, r * .6, 260, r * .6, '#7a8a5a'); }
  else if (v === 'rubber') { pot(r * .6, 400, '#3a3836'); cyl(T, 0, 0, 25, e + 400, e + h - 200, '#5a4a3a', 'plain', 8); for (let y = 600; y < h; y += 170) for (let k = 0; k < 2; k++) sph(T, (k ? 1 : -1) * 110, e + y, (y % 340 ? 60 : -60), 130, 50, 80, dark); }
  else if (v === 'stucky') { pot(r * .8, 300, '#f4f2ee'); for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = (i % 3) * 40; cyl(T, Math.cos(a) * rr, Math.sin(a) * rr, 22, e + 300, e + 300 + (h - 300) * (0.6 + 0.4 * ((i * 7) % 5) / 5), '#4d6b45', 'plain', 6); } }
  else if (v === 'hanging') { const top = P.ceilingH; box(T, -3, 3, e + 300, top, -3, 3, '#444'); cyl(T, 0, 0, r * .6, e + 100, e + 300, '#d8cbb5', 'plain', 12); for (let i = 0; i < 8; i++) { const a = i * .8; sph(T, Math.cos(a) * r * .55, e + 120 - (i % 4) * 110, Math.sin(a) * r * .55, 60, 160, 60, i % 2 ? dark : mid); } }
  else if (v === 'box') { box(T, -w / 2, w / 2, e, e + 450, -d / 2, d / 2, '#5e3d26', 'wood'); for (let x = -w / 2 + 150; x < w / 2; x += 280) sph(T, x, e + 600, 0, 180, 220, d / 2 - 20, x % 560 ? mid : dark); }
  else if (v === 'moss') { box(T, -w / 2, w / 2, e, e + h, -d / 2, d / 2, '#5e3d26', 'wood'); box(T, -w / 2 + 40, w / 2 - 40, e + 40, e + h - 40, d / 2, d / 2 + 20, col, 'grass'); }
  else if (v === 'bamboo') { box(T, -r, r, e, e + 350, -r, r, '#2b2d31'); for (let i = 0; i < 7; i++) { const a = i * 2.2, rr = (i % 3) * 70 + 40, x = Math.cos(a) * rr, z = Math.sin(a) * rr; cyl(T, x, z, 18, e + 350, e + h, '#a8b860', 'plain', 6); sph(T, x, e + h - 250, z, 140, 260, 140, mid); } }
  else if (v === 'cactus') { pot(r * .7, 300, '#c57b4a'); cyl(T, 0, 0, 90, e + 300, e + h, mid, 'plain', 10); cyl(T, 150, 0, 55, e + 650, e + 950, mid, 'plain', 8); box(T, 60, 150, e + 650, e + 700, -40, 40, mid); cyl(T, -140, 0, 50, e + 800, e + 1050, mid, 'plain', 8); box(T, -140, -60, e + 800, e + 850, -40, 40, mid); }
  else if (v === 'palm') { pot(r * .45, 450, '#e6e1d8'); for (let i = 0; i < 5; i++) { const a = i * 1.25, x = Math.cos(a) * 60, z = Math.sin(a) * 60; cyl(T, x, z, 18, e + 450, e + h - 350, '#8aa04a', 'plain', 6); for (let k = 0; k < 3; k++) { const b = a + k * 2.1; sph(T, x + Math.cos(b) * 260, e + h - 300 - k * 80, z + Math.sin(b) * 260, 280, 40, 90, k % 2 ? dark : mid); } } }
  else { pot(r * .6, 400); sph(T, 0, e + h * .7, 0, r, h * .35, r, mid); }
}
function buildWalls() {
  for (const w of P.walls) {
    TINT = isSelected('wall', w.id);
    const H = CUT ? Math.min(1200, wallH(w)) : wallH(w), t = wallT(w) / 2; FADE = !!FOCUS;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = Math.hypot(dx, dy); if (L < 1) continue;
    const ang = Math.atan2(dy, dx), T = xf(w.x1, w.y1, ang), f = w.finish || { type: 'paint', color: '#ece8e1' };
    let key = matTex(f.type); if (key === 'tile') key = 'tilew'; const wa = matA(f.type);
    const ops = P.openings.filter((o) => o.wall === w.id).map((o) => ({ ...o, a: clamp(o.t - o.w / 2, 0, L), b: clamp(o.t + o.w / 2, 0, L) })).sort((a, b) => a.a - b.a);
    let x = 0;
    const seg = (x0, x1, y0, y1) => { if (x1 - x0 > 1 && y1 - y0 > 1) box(T, x0, x1, y0, y1, -t, t, f.color, key, wa); };
    for (const o of ops) {
      if (o.type === 'arch') {
        seg(x, o.a, 0, H); const r = (o.b - o.a) / 2, c = (o.a + o.b) / 2, top = o.h, spring = Math.max(0, top - r), n = 18;
        for (let i = 0; i < n; i++) { const x0 = o.a + (o.b - o.a) * i / n, x1 = o.a + (o.b - o.a) * (i + 1) / n, dx = (x0 + x1) / 2 - c, ya = spring + Math.sqrt(Math.max(0, r * r - dx * dx)); if (ya < H) seg(x0, x1, ya, H); }
        x = o.b; continue;
      }
      seg(x, o.a, 0, H); const top = o.sill + o.h;
      seg(o.a, o.b, 0, Math.min(o.sill, H)); if (top < H) seg(o.a, o.b, top, H);
      const fr = o.fw || std().frameW || 50, fc = o.frame || '#2b2d31', yTop = Math.min(top, H);
      if (o.sill < H) {
        box(T, o.a, o.a + fr, o.sill, yTop, -t - 10, t + 10, fc); box(T, o.b - fr, o.b, o.sill, yTop, -t - 10, t + 10, fc);
        if (top <= H) box(T, o.a, o.b, top - fr, top, -t - 10, t + 10, fc);
        if (o.sill > 0) box(T, o.a, o.b, o.sill, o.sill + fr, -t - 10, t + 10, fc);
        const glassTop = Math.min(top - fr, H), glassBot = o.sill + (o.sill > 0 ? fr : 0);
        if (o.type === 'window' || o.type === 'full' || o.type === 'auto') { box(T, o.a + fr, o.b - fr, glassBot, glassTop, -8, 8, '#a9d6ec', 'plain', .32); if (o.type !== 'window') box(T, (o.a + o.b) / 2 - fr / 2, (o.a + o.b) / 2 + fr / 2, glassBot, glassTop, -t, t, fc); }
        else if (o.type === 'slide') { const lw = (o.b - o.a - 2 * fr) * 0.54; box(T, o.a + fr, o.a + fr + lw, 0, glassTop, -t + 10, -t + 40, fc); box(T, o.b - fr - lw, o.b - fr, 0, glassTop, t - 40, t - 10, fc); box(T, o.a + fr + 80, o.a + fr + lw - 80, 300, glassTop - 120, -t + 8, -t + 42, '#a9d6ec', 'plain', .4); box(T, o.b - fr - lw + 80, o.b - fr - 80, 300, glassTop - 120, t - 42, t - 8, '#a9d6ec', 'plain', .4); }
        else if (o.type === 'slidepass') { const lw = (o.b - o.a - 2 * fr) * 0.54; box(T, o.a + fr, o.a + fr + lw, glassBot, glassTop, -12, -2, '#a9d6ec', 'plain', .4); box(T, o.b - fr - lw, o.b - fr, glassBot, glassTop, 2, 12, '#a9d6ec', 'plain', .4); box(T, o.a - 60, o.b + 60, o.sill - 30, o.sill, -t - 220, t + 220, '#c9ced4', 'steel'); }
        else if (o.type === 'pass') { box(T, o.a - 60, o.b + 60, o.sill - 30, o.sill, -t - 220, t + 220, '#c9ced4', 'steel'); }
        else if (typeof DOOR3D !== 'undefined' && DOOR3D[o.type]) DOOR3D[o.type](T, o, fr, glassTop, t, fc);
        else if (o.type === 'door1' || o.type === 'door2') {
          const n = o.type === 'door1' ? 1 : 2, lw = (o.b - o.a - 2 * fr) / n;
          for (let i = 0; i < n; i++) { const a0 = o.a + fr + lw * i; box(T, a0 + 5, a0 + lw - 5, 0, glassTop, -25, 25, fc); box(T, a0 + 90, a0 + lw - 90, 300, glassTop - 120, -27, 27, '#a9d6ec', 'plain', .4); const hx = i ? a0 + 70 : a0 + lw - 90; box(T, hx, hx + 20, 900, 1500, 25, 55, '#b0b4ba'); }
        }
      }
      x = o.b;
    }
    seg(x, L, 0, H); TINT = false; FADE = false;
  }
}
function buildScene() {
  G = {}; ensureLevels(); YOFF = 0; FADE = false;
  const b = bounds();
  if (!NOENV) buildEnv(b);
  const aE = curElev();
  if ((P.showLinked !== false || EXPORTALL) && P.levels.length > 1) for (const Lv of P.levels) {
    if (Lv.id === P.levelId || !Lv.data) continue; if (Lv.elev > aE && cam.cut && !EXPORTALL) continue;
    withLevel(Lv, () => { const ks = sel, km = multi, kf = FOCUS; sel = null; multi = []; FOCUS = null; YOFF = Lv.elev || 0; buildLevel(false); YOFF = 0; sel = ks; multi = km; FOCUS = kf; });
  }
  YOFF = aE; buildLevel(true); YOFF = 0; FADE = false;
  meshes.forEach((m) => ['p', 'nn', 'c', 'u'].forEach((k) => gl.deleteBuffer(m[k])));
  meshes = Object.values(G).map((g) => {
    const mk = (a) => { const bf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW); return bf; };
    return { key: g.key, alpha: g.alpha, n: g.p.length / 3, p: mk(g.p), nn: mk(g.n), c: mk(g.c), u: mk(g.u) };
  }).map((m) => ({ ...m, n_: m.nn }));
  dirty3d = false;
}
function beam(a, b, r, col) {
  const g = grp('plain'), c = hexRGB(col); let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const L = Math.hypot(...u); if (L < 1) return; u = u.map((x) => x / L);
  const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]], nz = (p) => { const l = Math.hypot(...p) || 1; return p.map((x) => x / l); };
  const v = nz(cr(u, ref)), n = cr(u, v), off = (p, sv, sn) => [p[0] + (v[0] * sv + n[0] * sn) * r, p[1] + YOFF + (v[1] * sv + n[1] * sn) * r, p[2] + (v[2] * sv + n[2] * sn) * r];
  const ring = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < 4; i++) { const [s0, t0] = ring[i], [s1, t1] = ring[(i + 1) % 4], nm = nz([v[0] * (s0 + s1) + n[0] * (t0 + t1), v[1] * (s0 + s1) + n[1] * (t0 + t1), v[2] * (s0 + s1) + n[2] * (t0 + t1)]); quad(g, [off(a, s0, t0), off(b, s0, t0), off(b, s1, t1), off(a, s1, t1)], nm, c); }
}
function buildLevel(active) {
  CUT = cam.cut && active && !EXPORTALL; const b = bounds();
  if (vis.floorL !== false) { FADE = !!FOCUS && FOCUS !== 'floorL'; const op = P.floorOpacity ?? 1; box(xf(0, 0, 0), b[0] - P.wallT / 2, b[2] + P.wallT / 2, -20, 0, b[1] - P.wallT / 2, b[3] + P.wallT / 2, P.floor.color, matTex(P.floor.type), op < 1 ? op : matA(P.floor.type)); FADE = false; }
  buildWalls();
  for (const it of P.items) { const ly = spec(it).layer; if (it.hidden || vis[ly] === false) continue; FADE = !!FOCUS && ly !== FOCUS; TINT = isSelected('item', it.id); buildItem(it); TINT = false; FADE = false; }
  for (const l of P.lines) {
    const k = { ...LINEKINDS[l.kind], color: lineColor(l), w: l.w || LINEKINDS[l.kind].w }; if (vis[k.layer] === false) continue; FADE = !!FOCUS && k.layer !== FOCUS;
    const y = k.z === 'above' ? (P.ceilingH + P.slabH) / 2 : k.z === 'mid' ? 500 : k.z === 'below' ? -(l.depth ?? 80) - k.w / 2 : k.z === 'hang' ? P.slabH - (l.off ?? 300) : k.z === 'frame' ? P.ceilingH + 30 : 20, sel_ = isSelected('line', l.id);
    for (let i = 1; i < l.pts.length; i++) { const [x1, z1] = l.pts[i - 1], [x2, z2] = l.pts[i], L = Math.hypot(x2 - x1, z2 - z1); if (L < 1) continue; box(xf(x1, z1, Math.atan2(z2 - z1, x2 - x1)), -k.w / 2, L + k.w / 2, y, y + Math.min(k.w, 120), -k.w / 2, k.w / 2, sel_ ? '#0a84ff' : k.color); }
    FADE = false;
  }
  if (active) buildGrid3d();
  if (vis.sketch !== false) for (const sk of P.sketches || []) { FADE = !!FOCUS && FOCUS !== 'sketch'; for (let i = 1; i < sk.pts.length; i++) beam(sk.pts[i - 1], sk.pts[i], (sk.w || 24) / 2 * (isSelected('sketch', sk.id) ? 1.8 : 1), isSelected('sketch', sk.id) ? '#0a84ff' : sk.color || '#ff375f'); FADE = false; }
  if (P.ceiling && P.ceiling.on && vis.ceiling !== false) { FADE = !!FOCUS && FOCUS !== 'ceiling'; box(xf(0, 0, 0), b[0], b[2], P.ceilingH, P.ceilingH + 15, b[1], b[3], P.ceiling.color || '#f4f2ee', 'plain', Math.min(0.999, P.ceiling.opacity ?? 0.45)); FADE = false; }
  CUT = false;
}
function mat4Persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]; }
function mat4Look(e, c) {
  let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map((v) => v / l);
  let x = [z[2], 0, -z[0]]; l = Math.hypot(...x) || 1; x = x.map((v) => v / l); // up=(0,1,0) 교차
  x = [1 * z[2] - 0, 0, -(1 * z[0])].map((v) => v / l);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
}
function mul(a, b) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
function eye(c = cam) { return [c.tx + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), c.ty + c.dist * Math.sin(c.pitch), c.tz + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw)]; }
function render3d() {
  if (!gl || !prog || view === '2d' || !P) return;
  const q = $('#hq').checked ? Math.min(2, (window.devicePixelRatio || 1) * 1.25) : 1;
  const r = gc.getBoundingClientRect(); if (!r.width) return;
  const W = Math.round(r.width * q), H = Math.round(r.height * q); if (gc.width !== W || gc.height !== H) { gc.width = W; gc.height = H; }
  if (dirty3d) buildScene();
  const M = drawGL(W, H, cam); lastM = M; drawOverlay();
  // 선택 표시 · 라벨
  const ov = $('#ov3d'); ov.innerHTML = '';
  if (sel && sel.kind === 'item') { const it = itemOf(sel.id); if (it) { const p = proj(M, [it.x, zOf(it) + spec(it).h + 150 + curElev(), it.y], r); if (p) { const d = document.createElement('div'); d.className = 'pin'; d.style.left = p[0] + 'px'; d.style.top = p[1] + 'px'; d.textContent = spec(it).name; ov.appendChild(d); } } }
  if ($('#labels3d').checked) for (const it of P.items) { if (conflicts.has(it.id)) { const p = proj(M, [it.x, zOf(it) + spec(it).h + 100 + curElev(), it.y], r); if (p) { const d = document.createElement('div'); d.className = 'pin bad'; d.style.left = p[0] + 'px'; d.style.top = p[1] + 'px'; d.textContent = '조정 필요'; ov.appendChild(d); } } }
}
function drawGL(W, H, C) {
  gl.viewport(0, 0, W, H); gl.clearColor(...(CLEAR || [0, 0, 0, 0])); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
  gl.useProgram(prog);
  const E = eye(C), M = mul(mat4Persp((C.fov || 50) * Math.PI / 180, W / H, 50, 200000), mat4Look(E, [C.tx, C.ty, C.tz]));
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'M'), false, new Float32Array(M));
  const rs = (P && P.render) || { sun: 35, alt: 55, bright: 1 }, az = rs.sun * Math.PI / 180, al = rs.alt * Math.PI / 180, Ld = [Math.cos(al) * Math.cos(az), Math.sin(al), Math.cos(al) * Math.sin(az)];
  gl.uniform3f(gl.getUniformLocation(prog, 'L'), Ld[0], Ld[1], Ld[2]); gl.uniform1f(gl.getUniformLocation(prog, 'K'), rs.bright || 1);
  const at = (n) => gl.getAttribLocation(prog, n);
  const draw = (m) => {
    for (const [nm, bf, sz] of [['p', m.p, 3], ['n', m.n_, 3], ['c', m.c, 3], ['u', m.u, 2]]) { const a = at(nm); gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, sz, gl.FLOAT, false, 0, 0); }
    const t = tex[m.key]; gl.uniform1f(gl.getUniformLocation(prog, 'useT'), t ? 1 : 0); if (t) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(prog, 'T'), 0); }
    gl.uniform1f(gl.getUniformLocation(prog, 'A'), m.alpha); gl.drawArrays(gl.TRIANGLES, 0, m.n);
  };
  gl.disable(gl.BLEND); meshes.filter((m) => m.alpha >= 1).forEach(draw);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); meshes.filter((m) => m.alpha < 1).forEach(draw); gl.depthMask(true);
  return M;
}
function isoCam() { const b = bounds(); return { yaw: -0.85, pitch: 0.8, dist: fitDist(1.5, 45) * 0.92, tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2, fov: 45 }; }
function snapshot3d(w, h, C, q = 0.8) {
  if (!gl || !prog || !P) return null; if (dirty3d) buildScene();
  const ow = gc.width, oh = gc.height; gc.width = w; gc.height = h;
  const ctx2 = document.createElement('canvas'); ctx2.width = w; ctx2.height = h; const g2 = ctx2.getContext('2d');
  const grd = g2.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#c9dbe8'); grd.addColorStop(1, '#eef1f2'); g2.fillStyle = grd; g2.fillRect(0, 0, w, h);
  drawGL(w, h, C || cam); g2.drawImage(gc, 0, 0);
  gc.width = ow; gc.height = oh; render3d(); need3d = true;
  return ctx2;
}
function proj(M, v, r) { const x = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], w = M[3] * v[0] + M[7] * v[1] + M[11] * v[2] + M[15]; if (w <= 0) return null; return [(x / w * .5 + .5) * r.width, (1 - (y / w * .5 + .5)) * r.height]; }
function mark3d() { need3d = true; }
let need3d = true;
const KEYS = ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz'];
const goal = { ...cam };
function syncGoal() { for (const k of KEYS) goal[k] = cam[k]; }
let lastT = performance.now();
function loop(now) {
  now = now || performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (tour) stepTour();
  panKeys(dt);
  if (anim) { const k = Math.min(1, (now - anim.t0) / anim.dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; for (const key of KEYS) cam[key] = anim.a[key] + (anim.b[key] - anim.a[key]) * e; if (k >= 1) anim = null; syncGoal(); need3d = true; }
  else {
    if (spin) goal.yaw += 0.12 * dt;
    clampGoal();
    const f = 1 - Math.exp(-7 * dt); let moving = false;
    for (const k of KEYS) { const d = goal[k] - cam[k]; if (Math.abs(d) > (k === 'dist' || k[0] === 't' ? 0.5 : 0.0002)) { cam[k] += d * f; moving = true; } else cam[k] = goal[k]; }
    if (moving) need3d = true;
  }
  if (need3d || dirty3d) { render3d(); need3d = false; }
  requestAnimationFrame(loop);
}
let spin = false;
// 3D 입력 (부드러운 회전 · 확대 · 탭해서 선택)
const p3 = new Map(); let d3 = null;
gc.addEventListener('pointerdown', (e) => { gc.setPointerCapture(e.pointerId); p3.set(e.pointerId, [e.clientX, e.clientY]); anim = null; tour = null; updTourBtn(); d3 = { btn: e.button, x: e.clientX, y: e.clientY, g: { ...goal }, moved: false, pinch: null }; if (p3.size === 1 && !document.body.classList.contains('clean')) { const ev0 = { clientX: e.clientX, clientY: e.clientY }; d3.lpT = setTimeout(() => { if (d3 && !d3.moved && p3.size === 1) { if (draft3) { draft3 = null; drawOverlay(); } const h = rayHit(ev0); if (h) { d3.lp = true; lastHit = h; pickSel(h); buzz(); } } }, 480); } else if (d3) clearTimeout(d3.lpT); if (build3d && p3.size === 1 && e.button === 0) { d3.build = true; build3Down(e); return; } if (build3d && p3.size === 2 && draft3 && draft3.free) { draft3 = null; drawOverlay(); } if (moveOn && sel && p3.size === 1) { const h = rayPick(e); if (h && isSelected(h.kind, h.id)) { const y = h.kind === 'item' ? zOf(itemOf(h.id)) : 0, g = planeHit(e, y); if (g) d3.mv = { y, ms: beginMoveAll(g[0], g[1]) }; } } if (p3.size === 2) { const [a, b] = [...p3.values()]; d3.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], g: { ...goal } }; } });
gc.addEventListener('pointermove', (e) => {
  if (build3d && draft3 && !draft3.free && !p3.has(e.pointerId)) { draft3.hover = buildPoint(e); drawOverlay(); return; }
  if (!p3.has(e.pointerId) || !d3) return; p3.set(e.pointerId, [e.clientX, e.clientY]);
  if (d3.lpT && Math.hypot(e.clientX - d3.x, e.clientY - d3.y) > 8) { clearTimeout(d3.lpT); d3.lpT = 0; }
  if (d3.lp) return;
  if (d3.build && p3.size === 1) { if (draft3 && draft3.free && Math.hypot(e.clientX - draft3.sx, e.clientY - draft3.sy) > 3) { const q = buildPoint(e); if (q) { draft3.raw.push(q); draft3.sx = e.clientX; draft3.sy = e.clientY; drawOverlay(); } } else if (draft3 && !draft3.free) { draft3.hover = buildPoint(e); drawOverlay(); } return; }
  if (d3.mv && p3.size === 1) { const g = planeHit(e, d3.mv.y); if (g && applyMoveAll(d3.mv.ms, g[0], g[1])) { d3.moved = true; analyze(); dirty3d = true; draw2d(); } return; }
  if (p3.size === 2 && d3.pinch) { d3.moved = true; const [a, b] = [...p3.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; goal.dist = clamp(d3.pinch.g.dist * d3.pinch.d / dd, 700, 80000); const pdx = m[0] - d3.pinch.m[0], pdy = m[1] - d3.pinch.m[1]; if (Math.hypot(pdx, pdy) > 14) pan(pdx * 0.8, pdy * 0.8, d3.pinch.g); return; }
  const dx = e.clientX - d3.x, dy = e.clientY - d3.y; if (Math.hypot(dx, dy) > 6) d3.moved = true; if (!d3.moved) return;
  if (d3.btn === 2 || e.shiftKey) pan(dx, dy, d3.g); else { goal.yaw = d3.g.yaw + dx * 0.0035; goal.pitch = clamp(d3.g.pitch + dy * 0.003, -0.1, 1.5); }
});
function pan(dx, dy, c0) { const k = c0.dist / 1100, s = Math.sin(c0.yaw), c = Math.cos(c0.yaw); goal.tx = c0.tx - (s * dx + c * dy) * k; goal.tz = c0.tz + (c * dx - s * dy) * k; }
const end3 = (e) => {
  if (d3) clearTimeout(d3.lpT);
  if (d3 && d3.lp) { p3.delete(e.pointerId); if (!p3.size) d3 = null; return; }
  if (d3 && d3.build) { if (e.type === 'pointerup') build3Up(); else { draft3 = null; drawOverlay(); } p3.delete(e.pointerId); if (!p3.size) d3 = null; return; }
  if (d3 && d3.mv && d3.moved) commit();
  if (d3 && !d3.moved && p3.size === 1 && e.type === 'pointerup' && !document.body.classList.contains('clean')) { if (e.ctrlKey || e.metaKey || e.shiftKey || multiMode) { const h = rayHit(e); lastHit = h; toggleSel(h && h.sel); } else pick3d(e); }
  p3.delete(e.pointerId); if (!p3.size) d3 = null;
};
gc.addEventListener('pointerup', end3); gc.addEventListener('pointercancel', end3); gc.addEventListener('contextmenu', (e) => e.preventDefault());
gc.addEventListener('wheel', (e) => { e.preventDefault(); anim = null; goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0009), 800, 80000); }, { passive: false });
function rayOf(e) {
  const r = gc.getBoundingClientRect(), E = eye(), T = [cam.tx, cam.ty, cam.tz];
  let f = [T[0] - E[0], T[1] - E[1], T[2] - E[2]]; const fl = Math.hypot(...f); f = f.map((v) => v / fl);
  let rt = [-f[2], 0, f[0]]; const rl = Math.hypot(...rt) || 1; rt = rt.map((v) => v / rl);
  const up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
  const th = Math.tan(cam.fov * Math.PI / 360), nx = (2 * (e.clientX - r.left) / r.width - 1) * th * r.width / r.height, ny = (1 - 2 * (e.clientY - r.top) / r.height) * th;
  return { E, D: [0, 1, 2].map((i) => f[i] + rt[i] * nx + up[i] * ny) };
}
function planeHit(e, y) { const { E, D } = rayOf(e); y += curElev(); if (Math.abs(D[1]) < 1e-6) return null; const t = (y - E[1]) / D[1]; return t < 0 ? null : [E[0] + D[0] * t, E[2] + D[2] * t]; }
function pick3d(e) { const h = rayHit(e); lastHit = h; pickSel(h ? h.sel : null); }
function rayPick(e) { const h = rayHit(e); return h ? h.sel : null; }
function rayHit(e) {
  const { E: E0, D } = rayOf(e), EL = curElev(), E = [E0[0], E0[1] - EL, E0[2]];
  const slab = (o, d, mn, mx) => { let t0 = -1e12, t1 = 1e12, ax = 1, sg = 1; for (let i = 0; i < 3; i++) { if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return null; continue; } let p = (mn[i] - o[i]) / d[i], q = (mx[i] - o[i]) / d[i], s = -1; if (p > q) { [p, q] = [q, p]; s = 1; } if (p > t0) { t0 = p; ax = i; sg = s; } t1 = Math.min(t1, q); if (t0 > t1) return null; } return t1 < 0 ? null : { t: Math.max(t0, 0), ax, sg }; };
  const local = (cxp, czp, ang) => { const c = Math.cos(ang), s = Math.sin(ang), ox = E[0] - cxp, oz = E[2] - czp; return [[ox * c + oz * s, E[1], -ox * s + oz * c], [D[0] * c + D[2] * s, D[1], -D[0] * s + D[2] * c], c, s]; };
  const toWorldN = (ax, sg, c, s) => { const l = [0, 0, 0]; l[ax] = sg; return [l[0] * c - l[2] * s, l[1], l[0] * s + l[2] * c]; };
  let best = null;
  for (const it of P.items) {
    const s = spec(it); if (it.hidden || !vis[s.layer]) continue;
    const [o, d, c, sn] = local(it.x, it.y, (it.rot || 0) * Math.PI / 180), z = zOf(it), pad = isPoint(it) || s.L.shape === 'mark' ? 80 : 0;
    const hh = s.L.shape === 'zone' ? 6 : Math.max(s.h, 20), r = slab(o, d, [-it.w / 2 - pad, z - pad, -it.d / 2 - pad], [it.w / 2 + pad, z + hh + pad, it.d / 2 + pad]);
    if (!r) continue; const tt = r.t + (s.L.shape === 'zone' ? 50 : 0);
    if (!best || tt < best.t) best = { t: tt, rt: r.t, sel: { kind: 'item', id: it.id }, n: toWorldN(r.ax, r.sg, c, sn) };
  }
  for (const w of P.walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), tt = wallT(w) / 2; if (L < 1) continue;
    const H = cam.cut ? Math.min(1200, wallH(w)) : wallH(w), [o, d, c, sn] = local(w.x1, w.y1, Math.atan2(w.y2 - w.y1, w.x2 - w.x1)), r = slab(o, d, [0, 0, -tt], [L, H, tt]);
    if (r && (!best || r.t < best.t)) {
      const hx = o[0] + d[0] * r.t, hy = o[1] + d[1] * r.t, op = P.openings.find((q) => q.wall === w.id && Math.abs(hx - q.t) < q.w / 2 && hy > q.sill && hy < q.sill + q.h);
      best = { t: r.t, rt: r.t, sel: op ? { kind: 'open', id: op.id } : { kind: 'wall', id: w.id }, n: toWorldN(r.ax, r.sg, c, sn), along: hx, y: hy, side: r.ax === 2 ? r.sg : 1 };
    }
  }
  if (D[1] < -1e-6) { const t = -E[1] / D[1], b = bounds(), x = E[0] + D[0] * t, z = E[2] + D[2] * t; if ((!best || t < best.t) && x > b[0] - 200 && x < b[2] + 200 && z > b[1] - 200 && z < b[3] + 200) best = { t, rt: t, sel: { kind: 'floor', id: 'floor' }, n: [0, 1, 0] }; }
  if (best) best.p = [E[0] + D[0] * best.rt, E[1] + D[1] * best.rt, E[2] + D[2] * best.rt];
  return best;
}
/* 3D에서 그리기 (Build) */
let build3d = false, b3Target = 'sketch', skColor = store.get('drs_skc', '#ff375f'), draft3 = null, lastM = null;
function buildPoint(e) {
  if (b3Target === 'sketch') { const h = rayHit(e); if (!h) return null; return { p: h.p.map((v, i) => v + h.n[i] * 10), on: h.sel.kind === 'wall' ? h.sel.id : h.sel.kind === 'floor' ? 'floor' : 'x', n: h.n }; }
  const g = planeHit(e, 0); if (!g) return null; return { p: [snapGrid(g[0]), 0, snapGrid(g[1])], on: 'floor' };
}
function setBuild(on) {
  build3d = !!on; draft3 = null; $$('[data-bm]').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.bm === 'build') === build3d)); gc.style.cursor = build3d ? 'crosshair' : '';
  if (build3d && view === '2d') setView('split'); updDrawBar(); drawOverlay();
}
function updDrawBar() {
  const drawing = tool === 'wall' || tool === 'line'; $('#drawBar').hidden = !(build3d || drawing);
  $('#b3Row').hidden = !build3d; $$('[data-b3t]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.b3t === b3Target)); $$('[data-skc]').forEach((b) => b.classList.toggle('on', b.dataset.skc === skColor));
  $('#skColors').hidden = !(build3d && b3Target === 'sketch'); $('#lkSel').hidden = !((build3d && b3Target === 'line') || (!build3d && tool === 'line'));
  $$('[data-dm2]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.dm2 === drawMode)); $('#assistBtn').setAttribute('aria-pressed', assist); $('#assistBtn').textContent = '보정 ' + (assist ? 'ON' : 'OFF');
  $('#drawHint').textContent = (build3d ? ({ sketch: '3D 화면에 바로 그려요 · 두 손가락으로 화면 이동', wall: '3D 바닥에 벽을 그려요', line: '3D 바닥에 배선·배관을 그려요' }[b3Target] + ' · ') : '') + drawHint();
}
function finish3() {
  if (!draft3) return; const d = draft3; draft3 = null;
  if (!d.free && d.pts.length >= 2) { if (b3Target === 'sketch') addSketch(d.pts.map((q) => q.p)); else if (b3Target === 'line') addPath(d.pts.map((q) => [q.p[0], q.p[2]]), 'line'); }
  drawOverlay();
}
function addSketch(pts) { if (pts.length < 2) return; P.sketches.push({ id: uid('k'), pts: pts.map((p) => p.map(Math.round)), color: skColor, w: 24 }); if (vis.sketch === false) { vis.sketch = true; store.set('drs_vis', vis); } commit(); }
function arc3(a, m, b) {
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]], dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2], cr = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const u = sub(m, a), v = sub(b, a), w = cr(u, v), ww = dot(w, w); if (ww < 1e-3) return [a, b];
  const c1 = cr(w, u).map((x) => x * dot(v, v)), c2 = cr(v, w).map((x) => x * dot(u, u)), ctr = [0, 1, 2].map((i) => a[i] + (c1[i] + c2[i]) / (2 * ww));
  const e1 = sub(a, ctr), r = Math.hypot(...e1), n = w.map((x) => x / Math.sqrt(ww)), e2 = cr(n, e1);
  const ang = (p) => { const q = sub(p, ctr); return Math.atan2(dot(q, e2), dot(q, e1)); }, TAU = Math.PI * 2, nm = (x) => ((x % TAU) + TAU) % TAU;
  const am = nm(ang(m)), ab = nm(ang(b)), span = am < ab ? ab : -(TAU - ab), N = clamp(Math.round(Math.abs(span) * r / 250), 6, 48), out = [];
  for (let i = 0; i <= N; i++) { const t = span * i / N; out.push([0, 1, 2].map((k) => ctr[k] + Math.cos(t) * e1[k] + Math.sin(t) * e2[k])); }
  return out;
}
function smooth3(raw, on) {
  if (raw.length < 3) return raw.map((q) => q.p);
  const pts = raw.map((q) => q.p), on0 = raw[0].on;
  if (on && raw.every((q) => q.on === on0) && on0 !== 'x') {
    if (on0 === 'floor') { const y = pts[0][1]; return fitStroke(pts.map((p) => [p[0], p[2]]), true, false).map((p) => [p[0], y, p[1]]); }
    const w = wallOf(on0); if (w) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, n = raw[0].n || [0, 0, 0];
      const loc = pts.map((p) => [(p[0] - w.x1) * ux + (p[2] - w.y1) * uy, p[1]]), off = [pts[0][0] - (w.x1 + ux * loc[0][0]), pts[0][2] - (w.y1 + uy * loc[0][0])];
      return fitStroke(loc, true, false).map((q) => [w.x1 + ux * q[0] + off[0], q[1], w.y1 + uy * q[0] + off[1]]); }
  }
  const keep = rdp(pts.map((p) => [p[0], p[2] + p[1] * 0.0001]), on ? 40 : 12); return keep.map((i) => pts[i]);
}
function drawOverlay() {
  const c = $('#ov3c'); if (!c) return; const r = gc.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(2, window.devicePixelRatio || 1); if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, r.width, r.height);
  if (!draft3 || !lastM) return;
  let pp = draft3.free ? draft3.raw.map((q) => q.p) : draft3.pts.map((q) => q.p).concat(draft3.hover ? [draft3.hover.p] : []);
  if (!draft3.free && drawMode === 'arc' && draft3.pts.length === 2 && draft3.hover) pp = b3Target === 'sketch' ? arc3(draft3.pts[0].p, draft3.hover.p, draft3.pts[1].p) : arcPts([draft3.pts[0].p[0], draft3.pts[0].p[2]], [draft3.hover.p[0], draft3.hover.p[2]], [draft3.pts[1].p[0], draft3.pts[1].p[2]]).map((p) => [p[0], 0, p[1]]);
  g.strokeStyle = b3Target === 'sketch' ? skColor : getCss('--accent'); g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash(draft3.free ? [] : [7, 5]); g.beginPath();
  let started = false; const EL = curElev(); for (const p0 of pp) { const p = [p0[0], p0[1] + EL, p0[2]], s = proj(lastM, p, r); if (!s) continue; started ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); started = true; } g.stroke();
  for (const q of draft3.pts || []) { const s = proj(lastM, [q.p[0], q.p[1] + curElev(), q.p[2]], r); if (s) { g.fillStyle = g.strokeStyle; g.fillRect(s[0] - 3, s[1] - 3, 6, 6); } }
}
function build3Down(e) {
  const q = buildPoint(e); if (!q) return;
  if (drawMode === 'free') { draft3 = { free: true, raw: [q], sx: e.clientX, sy: e.clientY }; drawOverlay(); return; }
  if (!draft3) draft3 = { pts: [] };
  if (drawMode === 'arc') {
    draft3.pts.push(q);
    if (draft3.pts.length === 3) { const [p0, p1, pm] = draft3.pts.map((x) => x.p); draft3 = null;
      if (b3Target === 'sketch') addSketch(arc3(p0, pm, p1)); else addPath(arcPts([p0[0], p0[2]], [pm[0], pm[2]], [p1[0], p1[2]]), b3Target); }
    drawOverlay(); return;
  }
  const last = draft3.pts[draft3.pts.length - 1];
  if (last && b3Target !== 'sketch' && $('#ortho').checked) { if (Math.abs(q.p[0] - last.p[0]) > Math.abs(q.p[2] - last.p[2])) q.p[2] = last.p[2]; else q.p[0] = last.p[0]; }
  if (last && Math.hypot(q.p[0] - last.p[0], q.p[1] - last.p[1], q.p[2] - last.p[2]) < 60) { finish3(); return; }
  draft3.pts.push(q);
  if (b3Target === 'wall' && draft3.pts.length >= 2) { const a0 = draft3.pts[draft3.pts.length - 2].p; addPath([[a0[0], a0[2]], [q.p[0], q.p[2]]], 'wall'); }
  drawOverlay();
}
function build3Up() {
  if (!draft3 || !draft3.free) return; const raw = draft3.raw; draft3 = null;
  if (raw.length >= 2) { if (b3Target === 'sketch') addSketch(smooth3(raw, assist)); else addPath(fitStroke(raw.map((q) => [q.p[0], q.p[2]]), assist, b3Target === 'wall'), b3Target); }
  drawOverlay();
}
/* ---------- 장면 (영업용 보여주기) ---------- */
function defaultScenes() {
  const b = bounds(), cxm = (b[0] + b[2]) / 2, czm = (b[1] + b[3]) / 2, big = Math.max(b[2] - b[0], b[3] - b[1]);
  const S = [{ name: '전체 모습', yaw: -0.9, pitch: 0.8, dist: fitDist(aspect3d()), tx: cxm, ty: 0, tz: czm, cut: true },
    { name: '위에서 본 배치', yaw: -Math.PI / 2, pitch: 1.48, dist: fitDist(aspect3d()) * 1.05, tx: cxm, ty: 0, tz: czm, cut: true }];
  const door = P.openings.find((o) => o.type.startsWith('door') || o.type === 'auto');
  if (door) { const g = openingGeom(door); if (g) { const mx = (g.a[0] + g.b[0]) / 2, mz = (g.a[1] + g.b[1]) / 2, into = [cxm - mx, czm - mz], l = Math.hypot(...into) || 1; const tx = mx + into[0] / l * 2500, tz = mz + into[1] / l * 2500; S.push({ name: '입구에서 본 홀', yaw: Math.atan2(mz - tz, mx - tx), pitch: 0.12, dist: 2400, tx, ty: 1300, tz, cut: false }); } }
  const k = P.items.filter((i) => libGet(i.type).cat === '주방'); if (k.length) { const kb = aabb(k.flatMap(corners)), kx = (kb[0] + kb[2]) / 2, kz = (kb[1] + kb[3]) / 2; S.push({ name: '주방 동선', yaw: -0.6, pitch: 0.95, dist: Math.max(kb[2] - kb[0], kb[3] - kb[1]) * 1.1 + 1500, tx: kx, ty: 0, tz: kz, cut: true }); S.push({ name: '주방 눈높이', yaw: -Math.PI / 2, pitch: 0.18, dist: 2600, tx: kx, ty: 1300, tz: kz + 300, cut: false }); }
  const EL = curElev(); S.forEach((s) => (s.ty = (s.ty || 0) + EL));
  return S;
}
const scenes = () => (P.scenes && P.scenes.length ? P.scenes : defaultScenes());
let sceneIdx = 0;
function goScene(i, dur = 1100) {
  const S = scenes(); sceneIdx = (i + S.length) % S.length; const s = S[sceneIdx];
  if (cam.cut !== s.cut) { cam.cut = s.cut; dirty3d = true; $('#cutWalls').checked = s.cut; }
  anim = { t0: performance.now(), dur, a: { ...cam }, b: s }; $('#sceneName').textContent = s.name; $('#sceneNo').textContent = `${sceneIdx + 1} / ${S.length}`;
}
function stepTour() { if (!anim && performance.now() - tour.t > 4200) { tour.t = performance.now(); goScene(sceneIdx + 1, 1800); } }
function updTourBtn() { $('#tourBtn').textContent = tour ? '자동 투어 멈춤' : '자동 투어'; $('#tourBtn').setAttribute('aria-pressed', !!tour); }

/* ---------- UI: 라이브러리 ---------- */
let libCat = '주방', libQ = '';
function renderLib() {
  $('#libCats').innerHTML = CATS.map((c) => `<button class="chip ${c.k === libCat ? 'on' : ''}" data-cat="${c.k}">${c.k}</button>`).join('');
  const grpC = (CATS.find((c) => c.k === libCat) || CATS[0]).c;
  if (libCat === '문·창' && !libQ) { $('#libGrid').innerHTML = OPLIB.map((t) => `<button class="card op" data-op="${t}" title="끌어서 벽에 놓기"><span class="thumb">${opSvg(t)}</span><span class="nm">${OPENTYPES[t]}</span></button>`).join(''); return; }
  let list = libAll().filter((l) => (libQ ? (l.name + (l.tag || '') + l.cat).includes(libQ) : grpC.includes(l.cat)));
  const subs = !libQ && list.some((l) => l.sub) ? [...new Set(list.map((l) => l.sub || '기타'))] : null; if (subs) list = subs.flatMap((s) => [{ __h: s }, ...list.filter((l) => (l.sub || '기타') === s)]);
  $('#libGrid').innerHTML = list.length ? list.map((l) => l.__h ? `<p class="libsub">${esc(l.__h)}</p>` : `<button class="card" data-type="${l.id}" title="${libSize(l.id).w}×${libSize(l.id).d}${l.h > 10 ? '×' + libSize(l.id).h : ''} · 눌러서 놓기 · 끌어서 원하는 위치에 놓기">
    <span class="thumb" style="--c:${l.color}">${l.img ? `<img src="${l.img}" alt="">` : thumbSvg(l)}</span>
    <span class="nm">${esc(l.name)}</span></button>`).join('')
    : `<p class="empty">${libCat === '내 기물' ? '아래 “내 기물 등록”으로 자주 쓰는 기물을 저장해 두세요.' : '찾는 기물이 없어요.'}</p>`;
}
function thumbSvg(l) {
  const sh = l.shape; const c = l.color;
  if (sh === 'plant') return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="17" r="12" fill="${c}"/><rect x="14" y="27" width="12" height="9" fill="#e6e1d8"/></svg>`;
  if (sh === 'mark' || sh === 'drainpt') return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="${c}"/><text x="20" y="24" text-anchor="middle" font-size="11" font-weight="700" fill="#111">${l.mk || ''}</text></svg>`;
  if (sh === 'chair' || sh === 'barchair' || sh === 'stool') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="11" y="12" width="18" height="18" rx="3" fill="${c}"/><rect x="11" y="28" width="18" height="4" fill="#222"/></svg>`;
  if (sh === 'roundtable') return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="${c}" stroke="#222"/></svg>`;
  const r = Math.min(30 / l.w, 22 / Math.max(l.d, 60)), w = Math.max(8, l.w * r), d = Math.max(4, l.d * r);
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="${20 - w / 2}" y="${20 - d / 2}" width="${w}" height="${d}" fill="${c}" stroke="#222" stroke-width="1"/></svg>`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('#libCats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { libCat = b.dataset.cat; libQ = ''; $('#libSearch').value = ''; renderLib(); } });
$('#libGrid').addEventListener('pointerdown', (e) => { const o = e.target.closest('[data-op]'); if (o) { opPointerDown(e, o.dataset.op); return; } const b = e.target.closest('[data-type]'); if (b) libPointerDown(e, b.dataset.type); });
$('#libSearch').addEventListener('input', (e) => { libQ = e.target.value.trim(); renderLib(); });

/* ---------- UI: 속성 패널 ---------- */
function swatches(id, cur) { return `<div class="sw" role="group" aria-label="색상">${PALETTE.map((c) => `<button class="swb ${c === cur ? 'on' : ''}" style="background:${c}" data-sw="${id}" data-c="${c}" aria-label="${c}"></button>`).join('')}<label class="swc">직접<input type="color" data-swc="${id}" value="${cur || '#999999'}"></label></div>`; }
function field(lbl, id, val, type = 'number', extra = '') { return `<label class="fld"><span>${lbl}</span><input id="${id}" type="${type}" value="${esc(val)}" ${extra}></label>`; }
function sel_(lbl, id, opts, cur) { return `<label class="fld"><span>${lbl}</span><select id="${id}">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`; }
function keepFocus(fn) { const ae = document.activeElement, id = ae && ae.id; let s = null; try { s = ae.selectionStart; } catch (e) {} fn(); if (id) { const el = document.getElementById(id); if (el && el !== ae && el.tagName === 'INPUT') { el.focus({ preventScroll: true }); try { if (s != null) el.setSelectionRange(s, s); } catch (e) {} } } }
function renderProps() { keepFocus(renderProps0); }
function renderProps0() {
  renderQuick();
  const el = $('#props'); if (!P) return;
  if (!sel) { el.innerHTML = projectPanel(); bindProject(); return; }
  if (sel.kind === 'item') {
    const it = itemOf(sel.id); if (!it) { sel = null; return renderProps(); }
    const s = spec(it), L = s.L, isZone = L.shape === 'zone';
    el.innerHTML = `<div class="ph"><span class="dot" style="background:${s.color}"></span><div><b>${esc(s.name)}</b><small>${esc(L.name)} · ${LAYERS.find((l) => l.id === s.layer).name}</small></div></div>
    ${conflicts.has(it.id) ? `<p class="alert">${esc(conflicts.get(it.id))}</p>` : ''}
    <div class="g3">${field('가로 W', 'pW', it.w)}${field('깊이 D', 'pD', it.d)}${field('높이 H', 'pH', s.h)}</div>
    <div class="g3">${field('X', 'pX', it.x)}${field('Y', 'pY', it.y)}${field('설치 높이', 'pE', zOf(it))}</div>
    <div class="g3">${field('회전°', 'pR', it.rot || 0)}<button class="btn" id="rot90">90° 돌리기</button><button class="btn" id="dup">복제</button></div>
    ${field('태그 이름', 'pTag', it.tag || '', 'text', 'placeholder="예: 튀김 라인 1번"')}
    ${sel_('레이어', 'pLayer', Object.fromEntries(LAYERS.map((l) => [l.id, l.name])), s.layer)}
    ${isZone ? sel_('바닥 마감', 'pFin', matOpts, normMat(it.finish?.type || s.mat)) : sel_('재질', 'pMat', matOpts, s.mat)}
    <div class="lbl">색상</div>${swatches('item', isZone ? it.finish?.color || s.color : s.color)}
    <label class="chk"><input type="checkbox" id="pWork" ${it.needsWork ? 'checked' : ''}> 공사 필요 부위로 표시</label>
    ${field('메모', 'pNote', it.note || '', 'text', 'placeholder="예: 3상 증설, 배수 매립"')}
    ${field('전력 kW', 'pKw', it.kw ?? L.kw ?? 0, 'number', 'step="0.1"')}
    <div class="row wrap"><button class="btn" id="saveLib">내 기물로 저장</button><button class="btn" id="hideIt">도면에서 빼기</button><button class="btn danger" id="del">삭제</button></div>`;
    const num = (id, f) => $('#' + id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { f(v); commit(); dirty3d = true; } });
    num('pW', (v) => (it.w = Math.max(10, v))); num('pD', (v) => (it.d = Math.max(10, v))); num('pH', (v) => (it.h = Math.max(1, v)));
    num('pX', (v) => (it.x = v)); num('pY', (v) => (it.y = v)); num('pE', (v) => (it.elev = v)); num('pR', (v) => (it.rot = ((v % 360) + 360) % 360)); num('pKw', (v) => (it.kw = v));
    $('#pTag').addEventListener('change', (e) => { it.tag = e.target.value; commit(); });
    $('#pNote').addEventListener('change', (e) => { it.note = e.target.value; commit(); });
    $('#pLayer').addEventListener('change', (e) => { it.layer = e.target.value; commit(); dirty3d = true; });
    if (isZone) $('#pFin').addEventListener('change', (e) => { it.finish = { ...(it.finish || { color: s.color }), type: e.target.value }; commit(); dirty3d = true; });
    else $('#pMat').addEventListener('change', (e) => { it.mat = e.target.value; commit(); dirty3d = true; });
    $('#pWork').addEventListener('change', (e) => { it.needsWork = e.target.checked; commit(); });
    $('#rot90').onclick = () => { it.rot = ((it.rot || 0) + 90) % 360; commit(); dirty3d = true; };
    $('#dup').onclick = () => { const c = { ...JSON.parse(JSON.stringify(it)), id: uid('i'), x: it.x + 300, y: it.y + 300 }; P.items.push(c); sel = { kind: 'item', id: c.id }; commit(); dirty3d = true; };
    $('#del').onclick = delSel; $('#hideIt').onclick = () => hideSel();
    $('#saveLib').onclick = () => { const m = { id: uid('my'), name: it.tag || s.name, tag: it.tag || '', shape: L.shape, v: L.v, w: it.w, d: it.d, h: s.h, elev: zOf(it), layer: s.layer, color: s.color, mat: s.mat, drain: L.drain, gas: L.gas, hood: L.hood, kw: it.kw ?? L.kw, mk: L.mk, img: it.img }; myLib.push(m); store.set('drs_mylib', myLib); it.type = m.id; libCat = '내 기물'; renderLib(); commit(); toast('내 기물에 저장했어요'); };
    bindSw('item', (c) => { if (isZone) it.finish = { ...(it.finish || { type: 'tile' }), color: c }; else it.color = c; commit(); dirty3d = true; });
    return;
  }
  if (sel.kind === 'wall') {
    const w = wallOf(sel.id); if (!w) { sel = null; return renderProps(); }
    const L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
    el.innerHTML = `<div class="ph"><span class="dot" style="background:${w.finish.color}"></span><div><b>벽</b><small>길이 ${L} mm</small></div></div>
    <div class="g3">${field('길이', 'wL', L)}${field('두께', 'wT', wallT(w))}${field('높이', 'wH', wallH(w))}</div>
    ${sel_('벽 마감', 'wFin', matOpts, normMat(w.finish.type))}<div class="lbl">색상</div>${swatches('wall', w.finish.color)}
    <div class="row"><button class="btn" id="wAll">모든 벽에 같은 마감</button><button class="btn" id="wDoor">문 넣기</button><button class="btn" id="wWin">창 넣기</button></div>
    <div class="row"><button class="btn danger" id="del">벽 삭제</button></div>`;
    $('#wL').addEventListener('change', (e) => { const nl = parseFloat(e.target.value); if (nl > 10) { const k = nl / L; w.x2 = Math.round(w.x1 + (w.x2 - w.x1) * k); w.y2 = Math.round(w.y1 + (w.y2 - w.y1) * k); commit(); dirty3d = true; } });
    $('#wT').addEventListener('change', (e) => { w.t = Math.max(20, +e.target.value || P.wallT); commit(); dirty3d = true; });
    $('#wH').addEventListener('change', (e) => { w.h = Math.max(100, +e.target.value || P.ceilingH); commit(); dirty3d = true; });
    $('#wFin').addEventListener('change', (e) => { w.finish.type = e.target.value; commit(); dirty3d = true; });
    bindSw('wall', (c) => { w.finish.color = c; commit(); dirty3d = true; });
    $('#wAll').onclick = () => { P.walls.forEach((x) => (x.finish = { ...w.finish })); commit(); dirty3d = true; toast('모든 벽에 적용했어요'); };
    const addOp = (typ) => { const [ow, oh, os] = OPDEF[typ]; const o = { id: uid('o'), wall: w.id, t: Math.round(L / 2), type: typ, w: Math.min(ow, L), h: oh, sill: os, frame: '#2b2d31' }; P.openings.push(o); sel = { kind: 'open', id: o.id }; commit(); dirty3d = true; };
    $('#wDoor').onclick = () => addOp('door1'); $('#wWin').onclick = () => addOp('window'); $('#del').onclick = delSel; return;
  }
  if (sel.kind === 'open') {
    const o = P.openings.find((x) => x.id === sel.id); if (!o) { sel = null; return renderProps(); }
    el.innerHTML = `<div class="ph"><span class="dot" style="background:#4fc3c9"></span><div><b>${OPENTYPES[o.type]}</b><small>도면에서 끌어서 위치 이동</small></div></div>
    ${sel_('종류', 'oT', OPENTYPES, o.type)}
    <div class="g3">${field('폭', 'oW', o.w)}${field('높이', 'oH', o.h)}${field('바닥에서', 'oS', o.sill)}</div>
    <div class="lbl">자주 쓰는 크기</div><div class="row wrap">${[['여닫이 900×2100', 'door1', 900, 2100, 0], ['양개 1600×2300', 'door2', 1600, 2300, 0], ['자동문 1800×2300', 'auto', 1800, 2300, 0], ['창 1800×1500', 'window', 1800, 1500, 900], ['창 1200×1200', 'window', 1200, 1200, 1000], ['통창 2400×2400', 'full', 2400, 2400, 0], ['통창 3000×2700', 'full', 3000, 2700, 0]].map((p, i) => `<button class="chip" data-pre="${i}">${p[0]}</button>`).join('')}</div>
    <div class="lbl">프레임 색</div>${swatches('frame', o.frame)}
    <p class="hint">3D에서 “바깥 풍경”을 켜고 창 쪽 눈높이 장면으로 보면 밖이 어떻게 보이는지 확인할 수 있어요.</p>
    <div class="row"><button class="btn danger" id="del">삭제</button></div>`;
    const pres = [['', 'door1', 900, 2100, 0], ['', 'door2', 1600, 2300, 0], ['', 'auto', 1800, 2300, 0], ['', 'window', 1800, 1500, 900], ['', 'window', 1200, 1200, 1000], ['', 'full', 2400, 2400, 0], ['', 'full', 3000, 2700, 0]];
    $$('[data-pre]').forEach((b) => (b.onclick = () => { const p = pres[+b.dataset.pre]; Object.assign(o, { type: p[1], w: p[2], h: p[3], sill: p[4] }); commit(); dirty3d = true; }));
    $('#oT').addEventListener('change', (e) => { const [ow, oh, os] = OPDEF[e.target.value]; Object.assign(o, { type: e.target.value, w: ow, h: oh, sill: os }); commit(); dirty3d = true; });
    for (const [id, k] of [['oW', 'w'], ['oH', 'h'], ['oS', 'sill']]) $('#' + id).addEventListener('change', (e) => { o[k] = Math.max(0, parseFloat(e.target.value) || 0); commit(); dirty3d = true; });
    bindSw('frame', (c) => { o.frame = c; commit(); dirty3d = true; }); $('#del').onclick = delSel; return;
  }
  if (sel.kind === 'line') {
    const l = P.lines.find((x) => x.id === sel.id); if (!l) { sel = null; return renderProps(); }
    let len = 0; for (let i = 1; i < l.pts.length; i++) len += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
    el.innerHTML = `<div class="ph"><span class="dot" style="background:${LINEKINDS[l.kind].color}"></span><div><b>${LINEKINDS[l.kind].name}</b><small>총 ${(len / 1000).toFixed(1)} m</small></div></div>
    ${sel_('종류', 'lK', Object.fromEntries(Object.entries(LINEKINDS).map(([k, v]) => [k, v.name])), l.kind)}${field('굵기 mm', 'lW', l.w || LINEKINDS[l.kind].w)}<div class="lbl">색상</div>${swatches('line', l.color || LINEKINDS[l.kind].color)}<div class="row"><button class="btn danger" id="del">삭제</button></div>`;
    $('#lK').addEventListener('change', (e) => { l.kind = e.target.value; commit(); dirty3d = true; }); $('#del').onclick = delSel;
    $('#lW').addEventListener('change', (e) => { l.w = Math.max(5, +e.target.value || 30); commit(); dirty3d = true; }); bindSw('line', (c) => { l.color = c; commit(); dirty3d = true; });
  }
}
function bindSw(id, f) { $$(`[data-sw="${id}"]`).forEach((b) => (b.onclick = () => f(b.dataset.c))); const c = $(`[data-swc="${id}"]`); if (c) c.addEventListener('change', (e) => f(e.target.value)); }
function projectPanel() {
  return `<div class="ph"><span class="dot" style="background:${P.floor.color}"></span><div><b>${esc(P.name)}</b><small>기물을 누르면 여기서 스펙을 고칩니다</small></div></div>
  ${field('프로젝트 이름', 'jN', P.name, 'text')}
  <div class="g3">${field('천장 마감 높이', 'jC', P.ceilingH)}${field('천장 가벽 높이', 'jS', P.soffitH)}${field('슬래브 (천장 속)', 'jB', P.slabH)}</div>
  <div class="g3">${field('벽 두께', 'jT', P.wallT)}${field('주방 통로 기준', 'jA', P.aisle)}<span></span></div>
  <button class="btn" id="jStd">기본 규격 (기물 · 타일 · 스냅)</button>
  ${sel_('바닥 마감 (전체)', 'jF', matOpts, normMat(P.floor.type))}<div class="lbl">바닥 색</div>${swatches('floor', P.floor.color)}
  <div class="lbl">배경 도면 (사진 · 스캔 따라 그리기)</div>
  <div class="row wrap"><label class="btn file">도면 이미지 불러오기<input type="file" id="bgFile" accept="image/*" hidden></label>${P.bg ? '<button class="btn" id="bgDel">배경 지우기</button>' : ''}</div>
  ${P.bg ? `<div class="g3">${field('이미지 가로 mm', 'bgW', P.bg.wmm)}${field('X', 'bgX', P.bg.x || 0)}${field('Y', 'bgY', P.bg.y || 0)}</div><label class="fld"><span>불투명도</span><input type="range" id="bgO" min="0.1" max="1" step="0.05" value="${P.bg.opacity ?? .5}"></label>` : '<p class="hint">손그림·PDF 캡처·사진을 깔고 “벽” 도구로 따라 그리면 됩니다. 도면의 긴 벽 하나 길이를 가로 mm로 넣어 축척을 맞추세요.</p>'}`;
}
function bindProject() {
  $('#jStd').onclick = () => openStd('edit');
  const n = (id, f) => $('#' + id) && $('#' + id).addEventListener('change', (e) => { f(e.target.value); commit(); dirty3d = true; });
  n('jN', (v) => { P.name = v || '이름 없음'; $('#projName').textContent = P.name; });
  n('jC', (v) => (P.ceilingH = +v || 2700)); n('jS', (v) => (P.soffitH = +v || 2400)); n('jB', (v) => (P.slabH = +v || 3300)); n('jT', (v) => (P.wallT = +v || 150)); n('jA', (v) => (P.aisle = +v || 900));
  n('jF', (v) => (P.floor.type = v)); bindSw('floor', (c) => { P.floor.color = c; commit(); dirty3d = true; });
  $('#bgFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { P.bg = { src: rd.result, wmm: 10000, x: 0, y: 0, opacity: .5 }; bgImg = new Image(); bgImg.onload = () => draw2d(); bgImg.src = rd.result; commit(); }; rd.readAsDataURL(f); });
  if (P.bg) { $('#bgDel').onclick = () => { P.bg = null; bgImg = null; commit(); }; n('bgW', (v) => (P.bg.wmm = +v || 10000)); n('bgX', (v) => (P.bg.x = +v || 0)); n('bgY', (v) => (P.bg.y = +v || 0)); $('#bgO').addEventListener('input', (e) => { P.bg.opacity = +e.target.value; draw2d(); }); $('#bgO').addEventListener('change', () => commit()); }
}
function delSel() {
  if (!sel) return;
  if (sel.kind === 'item') P.items = P.items.filter((i) => i.id !== sel.id);
  if (sel.kind === 'wall') { P.walls = P.walls.filter((w) => w.id !== sel.id); P.openings = P.openings.filter((o) => o.wall !== sel.id); }
  if (sel.kind === 'open') P.openings = P.openings.filter((o) => o.id !== sel.id);
  if (sel.kind === 'line') P.lines = P.lines.filter((l) => l.id !== sel.id);
  if (sel.kind === 'sketch') P.sketches = P.sketches.filter((l) => l.id !== sel.id);
  if (sel.kind === 'floor') return;
  sel = null; commit(); dirty3d = true;
}

/* ---------- UI: 레이어 · 점검 ---------- */
function renderLayers() {
  $('#layers').innerHTML = LAYERS.map((l) => `<label class="lay"><input type="checkbox" data-lay="${l.id}" ${vis[l.id] ? 'checked' : ''}><span class="sq" style="background:${l.color}"></span><span>${l.name}</span><small>${P ? P.items.filter((i) => spec(i).layer === l.id).length + P.lines.filter((x) => LINEKINDS[x.kind].layer === l.id).length : ''}</small></label>`).join('');
}
$('#layers').addEventListener('change', (e) => { const id = e.target.dataset.lay; if (id) { vis[id] = e.target.checked; store.set('drs_vis', vis); draw2d(); dirty3d = true; } });
function renderChecks() {
  renderLayers();
  const lv = { bad: ['조정 필요', 'bad'], warn: ['확인', 'warn'], work: ['공사', 'work'] };
  const nb = checks.filter((c) => c.lvl === 'bad').length, nw = checks.filter((c) => c.lvl === 'warn').length, nk = checks.filter((c) => c.lvl === 'work').length;
  $('#checkSum').innerHTML = `<span class="pill bad">${nb} 조정</span><span class="pill warn">${nw} 확인</span><span class="pill work">${nk} 공사</span>`;
  $('#checks').innerHTML = checks.length ? checks.map((c, i) => `<button class="chk-row" data-ci="${i}"><span class="pill ${lv[c.lvl][1]}">${lv[c.lvl][0]}</span><span>${esc(c.t)}</span></button>`).join('') : '<p class="empty">겹침·배수·가스·후드 문제가 없어요.</p>';
  $('#badgeChecks').textContent = nb + nw || '';
}
$('#checks').addEventListener('click', (e) => { const b = e.target.closest('[data-ci]'); if (!b) return; const c = checks[+b.dataset.ci]; sel = { kind: 'item', id: c.id }; const it = itemOf(c.id); if (it && view !== '3d') { const r = cv.getBoundingClientRect(); V.ox = r.width / 2 - it.x * V.s; V.oy = r.height / 2 - it.y * V.s; } renderProps(); draw2d(); mark3d(); if (isMobile()) openSheet('props'); });

/* ---------- 내 기물 등록 ---------- */
$('#myForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = new FormData(e.target);
  const shape = f.get('shape'), m = { id: uid('my'), name: f.get('name') || '내 기물', tag: f.get('tag') || '', shape, v: shape === 'plant' ? 'monstera' : undefined, w: +f.get('w') || 600, d: +f.get('d') || 600, h: +f.get('h') || 850, elev: +f.get('elev') || 0, layer: f.get('layer'), color: f.get('color'), mat: 'matte', drain: f.get('drain') ? 1 : 0, gas: f.get('gas') ? 1 : 0, hood: f.get('hood') ? 1 : 0, kw: +f.get('kw') || 0, img: myImg };
  myLib.push(m); store.set('drs_mylib', myLib); libCat = '내 기물'; renderLib(); e.target.reset(); myImg = null; $('#myImgName').textContent = '선택 안 함'; $('#myDlg').close(); toast(`${m.name} 저장 · 눌러서 배치하세요`);
});
let myImg = null;
$('#myImg').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 256 / Math.max(im.width, im.height)); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); myImg = c.toDataURL('image/png'); $('#myImgName').textContent = f.name; }; im.src = rd.result; }; rd.readAsDataURL(f); });

/* ---------- 프로젝트 목록 (큰 아이콘) ---------- */
function renderProjects() {
  const idx = store.get('drs_index', []);
  $('#projList').innerHTML = idx.length ? `<div class="pgrid">${idx.map((p) => { const t = store.get('drs_t_' + p.id, null); return `<div class="pcard ${P && p.id === P.id ? 'cur' : ''}" data-pid="${p.id}">
    <button class="pimg" data-open="${p.id}" aria-label="${esc(p.name)} 편집하기">${t ? `<img src="${t}" alt="">` : '<span>미리보기 없음</span>'}</button>
    <div class="pmeta"><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleDateString('ko-KR')} · ${p.n}개${p.lv > 1 ? ` · 연결 ${p.lv}` : ''}</small></div>
    <div class="pact"><button class="qb" data-open="${p.id}">편집하기</button><button class="qb" data-pexp="${p.id}">내보내기</button><button class="qb" data-pren="${p.id}">이름 변경</button><button class="qb" data-pshare="${p.id}">공유하기</button><button class="qb" data-ppres="${p.id}">프레젠테이션</button><button class="qb" data-copy="${p.id}">복제</button><button class="qb danger" data-delp="${p.id}">삭제</button></div></div>`; }).join('')}</div>`
    : '<p class="empty">아직 저장된 프로젝트가 없어요. 위에서 새로 시작해 보세요.</p>';
}
function openById(id) { if (P && P.id === id) return true; const p = store.get('drs_p_' + id); if (!p) return false; openProject(p); return true; }
function showHome() { if (P) saveProject(true); renderProjects(); $('#newBox').open = false; if (!$('#projDlg').open) $('#projDlg').showModal(); }
$('#projList').addEventListener('click', (e) => {
  const g = (k) => e.target.closest(`[data-${k}]`), o = g('open'), c = g('copy'), d = g('delp'), ex = g('pexp'), rn = g('pren'), sh = g('pshare'), pr = g('ppres');
  if (o) { if (openById(o.dataset.open)) $('#projDlg').close(); }
  if (ex) { if (openById(ex.dataset.pexp)) { $('#projDlg').close(); $('#exportBtn').click(); } }
  if (sh) { if (openById(sh.dataset.pshare)) { $('#projDlg').close(); expFmt = 'json'; $('#exportBtn').click(); $('#expStatus').textContent = '공유: 프로젝트 파일을 구글 드라이브로 보내세요. 받는 사람은 이 앱의 "프로젝트 파일 불러오기"로 열면 됩니다.'; } }
  if (pr) { if (openById(pr.dataset.ppres)) { $('#projDlg').close(); $('#showBtn').click(); } }
  if (rn) { const id = rn.dataset.pren, card = rn.closest('.pcard'), m = card.querySelector('.pmeta'), cur = card.querySelector('.pmeta b').textContent;
    m.innerHTML = `<input class="search" id="pRen" value="${esc(cur)}" aria-label="새 이름"><button class="qb on" id="pRenOk">저장</button>`; const inp = $('#pRen'); inp.focus(); inp.select();
    const ok = () => { const nm = inp.value.trim() || cur; if (P && P.id === id) { P.name = nm; $('#projName').textContent = nm; commit(); saveProject(); } else { const p = store.get('drs_p_' + id); if (p) { p.name = nm; store.set('drs_p_' + id, p); store.set('drs_index', store.get('drs_index', []).map((x) => (x.id === id ? { ...x, name: nm } : x))); } } renderProjects(); };
    $('#pRenOk').onclick = ok; inp.onkeydown = (ev) => { if (ev.key === 'Enter') ok(); if (ev.key === 'Escape') renderProjects(); }; }
  if (c) { const p = store.get('drs_p_' + c.dataset.copy); if (p) { const t = store.get('drs_t_' + p.id, null); p.id = uid('p'); p.name += ' (복사본)'; if (t) store.set('drs_t_' + p.id, t); openProject(p); saveProject(); renderProjects(); } }
  if (d) { if (d.dataset.confirm) { store.del('drs_p_' + d.dataset.delp); store.del('drs_t_' + d.dataset.delp); store.set('drs_index', store.get('drs_index', []).filter((x) => x.id !== d.dataset.delp)); renderProjects(); } else { d.dataset.confirm = 1; d.textContent = '정말 삭제'; } }
});
$$('[data-start]').forEach((b) => (b.onclick = () => { const r = $(`input[name="start"][value="${b.dataset.start}"]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); $('#newBox').open = true; setTimeout(() => $('#nfName').focus(), 50); }));
$('#homeBtn').onclick = showHome;
/* 새 프로젝트 → 기본 규격 설정 (건너뛰기 가능) */
let pendingNew = null, stdMode = 'new';
$('#newForm').addEventListener('submit', (e) => {
  e.preventDefault(); const f = new FormData(e.target);
  pendingNew = { photos: { N: $('#phN').files[0], E: $('#phE').files[0], S: $('#phS').files[0], W: $('#phWw').files[0] }, name: String(f.get('name') || '').trim() || '새 매장 ' + new Date().toLocaleDateString('ko-KR'), ceil: +f.get('ceil') || 2700, soffit: +f.get('soffit') || 2400, start: f.get('start'), w: +f.get('w') || 8000, d: +f.get('d') || 12000 };
  $('#projDlg').close(); openStd('new');
});
function openStd(mode) {
  stdMode = mode; const s = { ...STD0, ...JSON.parse(JSON.stringify(mode === 'new' ? store.get('drs_std', STD0) : std())) }; s.sizes = s.sizes || {};
  const f = (lbl, k, v) => `<label class="fld"><span>${lbl}</span><input type="number" data-sk="${k}" value="${v}"></label>`;
  $('#stdBody').innerHTML = `<div class="lbl">공통</div><div class="g3">${f('스냅 단위 mm', 'grid', s.grid)}${f('벽 두께', 'wallT', s.wallT)}${f('주방 통로 폭', 'aisle', s.aisle)}</div>
    <div class="g3">${f('벽 타일 한 장', 'tileWall', s.tileWall)}${f('바닥 타일 한 장', 'tileFloor', s.tileFloor)}<span></span></div>
    <div class="lbl">튀김기 1구 (2구 · 4구는 이 크기의 배수)</div><div class="g3">${f('가로', 'fryerW', s.fryerW)}${f('깊이', 'fryerD', s.fryerD)}<span></span></div>
    <div class="lbl">자주 쓰는 기물 (가로 · 깊이 · 높이 mm)</div>
    <div class="stdtbl">${STD_ITEMS.map((id) => { const L = libGet(id), o = s.sizes[id] || {}; return `<span class="stdn">${L.name}</span>${['w', 'd', 'h'].map((k) => `<input type="number" data-si="${id}" data-sd="${k}" value="${o[k] || L[k]}" aria-label="${L.name} ${k.toUpperCase()}">`).join('')}`; }).join('')}</div>`;
  $('#stdSkip').hidden = mode !== 'new'; $('#stdGo').textContent = mode === 'new' ? '이 규격으로 시작' : '저장';
  $('#stdTitle').textContent = mode === 'new' ? '기본 규격 정하기' : '기본 규격';
  $('#stdDlg').showModal();
}
function readStd() {
  const s = { ...STD0, sizes: {} };
  $$('[data-sk]').forEach((i) => (s[i.dataset.sk] = Math.max(1, +i.value || STD0[i.dataset.sk])));
  $$('[data-si]').forEach((i) => { const id = i.dataset.si, L = libGet(id), v = +i.value; if (v && v !== L[i.dataset.sd]) { s.sizes[id] = s.sizes[id] || {}; s.sizes[id][i.dataset.sd] = v; } });
  return s;
}
function createPending(s) {
  const o = pendingNew || { name: '새 프로젝트', ceil: 2700, soffit: 2400, start: 'rect', w: 8000, d: 12000 }; let p;
  if (o.start === 'sample') { p = JSON.parse(JSON.stringify(SAMPLE)); p.id = uid('p'); p.name = o.name || p.name; p.ceilingH = o.ceil; p.soffitH = o.soffit; }
  else p = newProject({ name: o.name, ceilingH: o.ceil, soffitH: o.soffit, start: o.start === 'photos' ? 'rect' : o.start, w: o.w, d: o.d });
  p.std = s; p.wallT = s.wallT; p.aisle = s.aisle; pendingNew = null;
  if (o.start === 'photos') p.room = { W: o.w, D: o.d };
  openProject(p); saveProject(true);
  if (o.start === 'photos' && o.photos && Object.values(o.photos).some(Boolean)) aiPopulate(o.photos);
  if (o.start === 'empty') { setTool('wall'); toast('벽 도구: 손그림 모드로 대충 그려도 반듯하게 다듬어요'); }
}
$('#stdGo').onclick = () => { const s = readStd(); try { store.set('drs_std', s); } catch (er) {} $('#stdDlg').close(); if (stdMode === 'new') { try { createPending(s); } catch (er) { console.error(er); toast('새 프로젝트를 만들지 못했어요: ' + (er.message || er)); } } else { P.std = s; P.wallT = s.wallT; P.aisle = s.aisle; commit(); dirty3d = true; renderLib(); toast('규격을 바꿨어요 · 새로 놓는 기물부터 적용'); } };
$('#stdSkip').onclick = () => { $('#stdDlg').close(); try { createPending({ ...STD0, ...JSON.parse(JSON.stringify(store.get('drs_std', STD0))) }); } catch (er) { console.error(er); toast('새 프로젝트를 만들지 못했어요: ' + (er.message || er)); } };
$('#importFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const p = JSON.parse(rd.result); if (!p.walls || !p.items) throw 0; p.id = p.id || uid('p'); openProject(p); saveProject(true); $('#projDlg').close(); toast('프로젝트를 불러왔어요'); } catch (er) { toast('도면 스튜디오 프로젝트 파일(.json)이 아니에요'); } }; rd.readAsText(f); });

/* ---------- 내보내기: PDF · JPEG · 저용량 · CAD · CSV · 프로젝트 ---------- */
const LIGHT = { '--canvas': '#ffffff', '--grid': '#f0f1f3', '--grid2': '#dadde1', '--wall': '#1f2023', '--fg': '#1f2023', '--line': '#8a8f96', '--accent': '#c27612' };
let OFF = null;
function planCanvas(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const keep = [cx, V, sel, vis]; cx = c.getContext('2d'); OFF = { w: W, h: H }; sel = null;
  const b = bounds(), bw = b[2] - b[0] || 1, bh = b[3] - b[1] || 1, s = Math.min((W - 160) / bw, (H - 200) / bh);
  V = { s, ox: (W - bw * s) / 2 - b[0] * s, oy: (H - bh * s) / 2 - b[1] * s + 30 };
  try { draw2d(); } finally { cx = keep[0]; V = keep[1]; sel = keep[2]; OFF = null; }
  return c;
}
function stamp(c, title, sub) {
  const g = c.getContext('2d'), h = Math.round(c.height * 0.06);
  g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, 0, c.width, h);
  g.fillStyle = '#1f2023'; g.font = `700 ${Math.round(h * 0.42)}px "Pretendard","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(title, h * 0.5, h / 2);
  g.font = `500 ${Math.round(h * 0.3)}px "Pretendard","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`; g.textAlign = 'right'; g.fillStyle = '#5a5f66'; g.fillText(sub, c.width - h * 0.5, h / 2);
  return c;
}
function dataBytes(u) { const b = atob(u.split(',')[1]), out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }
function makePDF(imgs) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (id, body) => { offs[id] = len; push(`${id} 0 obj\n${body}\nendobj\n`); };
  const PW = 842, PH = 595, n = imgs.length; push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${imgs.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`);
  imgs.forEach((im, i) => {
    const p = 3 + 3 * i, s = Math.min((PW - 36) / im.w, (PH - 36) / im.h), dw = im.w * s, dh = im.h * s, x = (PW - dw) / 2, y = (PH - dh) / 2;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
    const cs = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    obj(p + 1, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    offs[p + 2] = len; push(`${p + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`); push(im.bytes); push('\nendstream\nendobj\n');
  });
  const total = 3 + 3 * n, xref = len; push(`xref\n0 ${total}\n0000000000 65535 f \n`); for (let i = 1; i < total; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(name, data) {
  const nm = new TextEncoder().encode(name), crc = crc32(data), sz = data.length;
  const lh = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, nm.length, 2], [28, 0, 2]].forEach(([o, v, l]) => (l === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
  const ch = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, 0, 4]].forEach(([o, v, l]) => (l === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
  const cdOff = 30 + nm.length + sz, cdLen = 46 + nm.length;
  const end = new DataView(new ArrayBuffer(22)); [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, 1, 2], [10, 1, 2], [12, cdLen, 4], [16, cdOff, 4], [20, 0, 2]].forEach(([o, v, l]) => (l === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return new Blob([lh, nm, data, ch, nm, end], { type: 'application/zip' });
}
function dxfText(t) { return [...t].map((ch) => (ch.charCodeAt(0) > 127 ? '\\U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') : ch)).join(''); }
function dxfString() {
  const E = [], Y = (y) => -y;
  const line = (a, b, l) => E.push(`0\nLINE\n8\n${l}\n10\n${a[0]}\n20\n${Y(a[1])}\n30\n0\n11\n${b[0]}\n21\n${Y(b[1])}\n31\n0`);
  const text = (x, y, t, l, h = 120) => E.push(`0\nTEXT\n8\n${l}\n10\n${x}\n20\n${Y(y)}\n30\n0\n40\n${h}\n1\n${dxfText(t)}\n72\n1\n11\n${x}\n21\n${Y(y)}\n31\n0\n73\n2`);
  for (const w of P.walls) { const r = wallRect(w); for (let i = 0; i < 4; i++) line(r[i], r[(i + 1) % 4], 'WALL'); }
  for (const o of P.openings) { const g = openingGeom(o); if (g) { line(g.a, g.b, 'OPENING'); text((g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2 - 300, `${OPENTYPES[o.type]} ${o.w}x${o.h}`, 'OPENING', 100); } }
  const LN = { floor: 'L1_FLOOR', upper: 'L2_UPPER', ceil: 'L3_CEILING', elec: 'ELEC', plumb: 'PLUMB', deco: 'DECO' };
  for (const it of P.items.filter((i) => !i.hidden)) { const s = spec(it), c = corners(it), l = LN[s.layer]; for (let i = 0; i < 4; i++) line(c[i], c[(i + 1) % 4], l); text(it.x, it.y, `${s.name} ${it.w}x${it.d}x${s.h}`, l, 100); }
  for (const ln of P.lines) for (let i = 1; i < ln.pts.length; i++) line(ln.pts[i - 1], ln.pts[i], 'LINE_' + ln.kind.toUpperCase());
  const layers = ['WALL', 'OPENING', ...Object.values(LN), ...Object.keys(LINEKINDS).map((k) => 'LINE_' + k.toUpperCase())];
  const tbl = layers.map((n, i) => `0\nLAYER\n2\n${n}\n70\n0\n62\n${(i % 7) + 1}\n6\nCONTINUOUS`).join('\n');
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${tbl}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${E.join('\n')}\n0\nENDSEC\n0\nEOF\n`;
}
function dxfMulti(lv) {
  const parts = lv.map((l) => { const s = l.id === P.levelId ? dxfString() : withLevel(l, () => dxfString()), pre = l.name.replace(/\s+/g, '') + '_'; const ent = s.split('ENTITIES\n')[1].split('0\nENDSEC\n0\nEOF')[0].replace(/\n8\n([A-Z0-9_]+)\n/g, `\n8\n${pre}$1\n`); const lay = s.split('TABLE\n2\nLAYER\n')[1].split('0\nENDTAB')[0].split('\n').slice(2).join('\n').replace(/LAYER\n2\n([A-Z0-9_]+)/g, `LAYER\n2\n${pre}$1`); return { ent, lay }; });
  const n = (parts.map((p) => p.lay).join('\n').match(/LAYER\n2\n/g) || []).length;
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${n}\n${parts.map((p) => p.lay.trim()).join('\n')}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${parts.map((p) => p.ent.trim()).join('\n')}\n0\nENDSEC\n0\nEOF\n`;
}
function csvString() {
  const rows = [['태그', '기물', '레이어', '재질', 'W', 'D', 'H', '설치높이', 'X', 'Y', '회전', 'kW', '공사필요', '메모']];
  for (const it of P.items.filter((i) => !i.hidden)) { const s = spec(it); rows.push([it.tag || '', s.L.name, LAYERS.find((l) => l.id === s.layer).name, MATS[s.mat].n, it.w, it.d, s.h, zOf(it), it.x, it.y, it.rot || 0, it.kw ?? s.L.kw ?? '', it.needsWork ? 'O' : '', it.note || '']); }
  return '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}
const toBlob = (c, q) => new Promise((res) => c.toBlob(res, 'image/jpeg', q));
function levelsFor() { ensureLevels(); return P.levels.length > 1 && P.exportLinked !== false && $('#expLinked').checked ? P.levels : null; }
async function withExportAll(fn) { const k = [cam.cut, EXPORTALL]; EXPORTALL = true; cam.cut = false; dirty3d = true; try { return await fn(); } finally { cam.cut = k[0]; EXPORTALL = k[1]; dirty3d = true; } }
function objString() {
  const keep = [NOENV, G]; NOENV = true; buildScene(); const g = G; NOENV = keep[0]; dirty3d = true;
  const V = [], F = []; let n = 1;
  for (const gr of Object.values(g)) { V.push(`o ${gr.key}`); for (let i = 0; i < gr.p.length; i += 3) V.push(`v ${(gr.p[i] / 1000).toFixed(4)} ${(gr.p[i + 1] / 1000).toFixed(4)} ${(-gr.p[i + 2] / 1000).toFixed(4)} ${gr.c[i].toFixed(3)} ${gr.c[i + 1].toFixed(3)} ${gr.c[i + 2].toFixed(3)}`); for (let i = 0; i < gr.p.length / 3; i += 3) F.push(`f ${n + i} ${n + i + 2} ${n + i + 1}`); n += gr.p.length / 3; V.push(...F.splice(0)); }
  return `# 3D RENDER · ${P.name} · 단위 m, 정점 색 포함
# 햇빛 방향 ${P.render.sun}° 높이 ${P.render.alt}°
` + V.join('\n');
}
async function recordVideo(st) {
  if (!gl || !gc.captureStream || !window.MediaRecorder) throw new Error('이 기기에서는 영상 저장을 지원하지 않아요');
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'], mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
  const stream = gc.captureStream(30), rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data); const done = new Promise((r) => (rec.onstop = r));
  const k = { ...cam }, dur = 9000, t0 = performance.now(); CLEAR = [0.86, 0.9, 0.93, 1]; anim = null; spin = false; rec.start();
  await new Promise((res) => { const step = (now) => { const t = Math.min(1, (now - t0) / dur); cam.yaw = k.yaw + t * Math.PI * 2; cam.pitch = Math.max(0.45, k.pitch); syncGoal(); render3d(); if (st) st.textContent = `영상 녹화 중… ${Math.round(t * 100)}%`; if (t < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  rec.stop(); await done; CLEAR = null; Object.assign(cam, k); syncGoal(); need3d = true;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}
async function makeFile(fmt) {
  const lv = levelsFor();
  if (lv && ['pdf', 'jpg', 'small', 'mp4', 'obj', 'dxf', 'plan'].includes(fmt)) return withExportAll(() => makeFile0(fmt, lv));
  return makeFile0(fmt, null);
}
async function makeFile0(fmt, lv) {
  const base = (P.name || 'plan').replace(/[\\/:*?"<>|]/g, '_'), day = new Date().toLocaleDateString('ko-KR');
  const view3 = (w, h, C, t) => { const c = snapshot3d(w, h, C); return c ? stamp(c, P.name, t + ' · ' + day) : stamp(planCanvas(w, h), P.name, '도면 · ' + day); };
  const plans = () => (lv ? lv.map((l) => (l.id === P.levelId ? stamp(planCanvas(2400, 1697), P.name, `${l.name} 평면도 · ${day}`) : withLevel(l, () => stamp(planCanvas(2400, 1697), P.name, `${l.name} 평면도 · ${day}`)))) : [stamp(planCanvas(2400, 1697), P.name, '평면도 · ' + day)]);
  if (fmt === 'pdf') {
    const pages = [...plans(), view3(2400, 1697, { ...isoCam(), ty: lv ? 0 : curElev() }, '45° 전체'), view3(2400, 1697, { ...cam }, '현재 시점')];
    return { name: base + '.pdf', blob: makePDF(pages.map((c) => ({ bytes: dataBytes(c.toDataURL('image/jpeg', 0.85)), w: c.width, h: c.height }))) };
  }
  if (fmt === 'jpg') return { name: base + '_3D.jpg', blob: await toBlob(view3(1920, 1080, { ...cam }, '3D'), 0.9) };
  if (fmt === 'small') return { name: base + '_small.jpg', blob: await toBlob(view3(960, 540, { ...cam }, '3D'), 0.6) };
  if (fmt === 'plan') return { name: base + '_평면.jpg', blob: await toBlob(stamp(planCanvas(2400, 1697), P.name, '평면도 · ' + day), 0.88) };
  if (fmt === 'dxf') return { name: base + '.dxf', blob: new Blob([lv ? dxfMulti(lv) : dxfString()], { type: 'application/dxf' }) };
  if (fmt === 'obj') return { name: base + '_3d.obj', blob: new Blob([objString()], { type: 'text/plain' }) };
  if (fmt === 'mp4') { const v = await recordVideo($('#expStatus')); return { name: `${base}_회전.${v.ext}`, blob: v.blob }; }
  if (fmt === 'csv') return { name: base + '_기물목록.csv', blob: new Blob([csvString()], { type: 'text/csv' }) };
  if (fmt === 'json') return { name: base + '.json', blob: new Blob([JSON.stringify(P)], { type: 'application/json' }) };
}
let _dl; async function getDownloads() { if (_dl !== undefined) return _dl; try { _dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { _dl = null; } return _dl; }
async function saveLocal(f) {
  const dl = await getDownloads();
  if (dl) { let name = f.name, data = f.blob; if (/\.(dxf|obj)$/i.test(name)) { data = zipStore(name, new Uint8Array(await f.blob.arrayBuffer())); name = name.replace(/\.(dxf|obj)$/i, (m) => '_' + m.slice(1) + '.zip'); } try { await dl.save({ filename: name, data }); return true; } catch (e) { toast(e && e.code === 'declined' ? '저장을 취소했어요' : '이 화면에서는 저장할 수 없어요'); return false; } }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(f.blob); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); return true; } catch (e) { return false; }
}
const blobB64 = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(b); });
let expFmt = 'pdf';
async function deliver(dest) {
  const st = $('#expStatus'); st.textContent = '파일을 만드는 중…';
  const f = await makeFile(expFmt); if (!f || !f.blob) { st.textContent = '파일을 만들지 못했어요.'; return; }
  const where = dest === 'naver' ? '네이버 메일' : '구글 드라이브', Cap = window.Capacitor;
  try {
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.Filesystem && Cap.Plugins.Share) {
      const w = await Cap.Plugins.Filesystem.writeFile({ path: f.name, data: await blobB64(f.blob), directory: 'CACHE' });
      if (dest === 'device') { await Cap.Plugins.Filesystem.writeFile({ path: 'Download/' + f.name, data: await blobB64(f.blob), directory: 'EXTERNAL_STORAGE', recursive: true }).catch(() => Cap.Plugins.Share.share({ files: [w.uri] })); st.textContent = `${f.name} 저장했어요 (다운로드 폴더).`; return; }
      await Cap.Plugins.Share.share({ title: f.name, files: [w.uri], dialogTitle: `${where}를 고르세요` }); st.textContent = `공유 창에서 ${where}를 고르면 보내져요.`; return;
    }
    if (dest !== 'device') { const file = new File([f.blob], f.name, { type: f.blob.type }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: f.name }); st.textContent = `공유 창에서 ${where}로 보냈어요.`; return; } }
  } catch (e) { if (e && e.name === 'AbortError') { st.textContent = '취소했어요.'; return; } }
  if (!(await saveLocal(f))) { st.textContent = '저장하지 못했어요.'; return; }
  if (dest === 'drive') st.innerHTML = `${esc(f.name)} 저장 완료. <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener">구글 드라이브 열기</a>에 끌어다 놓으면 올라가요.`;
  else if (dest === 'naver') st.innerHTML = `${esc(f.name)} 저장 완료. <a href="https://mail.naver.com/" target="_blank" rel="noopener">네이버 메일 열기</a>에서 첨부하세요.`;
  else st.textContent = `${f.name} 저장했어요.`;
}
$('#exportBtn').onclick = () => { ensureLevels(); $('#expLinkedRow').hidden = P.levels.length < 2; $('#expLinked').checked = P.exportLinked !== false; $('#expStatus').textContent = ''; $$('[data-fmt]').forEach((b) => b.classList.toggle('on', b.dataset.fmt === expFmt)); $('#expDlg').showModal(); };
$$('[data-fmt]').forEach((b) => (b.onclick = () => { expFmt = b.dataset.fmt; $$('[data-fmt]').forEach((x) => x.classList.toggle('on', x === b)); }));
$$('[data-dest]').forEach((b) => (b.onclick = () => deliver(b.dataset.dest)));

/* ---------- 계정 · 동기화 (Supabase · PC와 앱이 같은 프로젝트 공유) ---------- */
const BUILT = window.APP_CONFIG || {};
const SYNC = { cfg: store.get('drs_sync', {}), busy: false };
const sbUrl = () => (SYNC.cfg.url || BUILT.supabaseUrl || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth)\/v1$/, ''), sbKey = () => SYNC.cfg.key || BUILT.supabaseKey || '';
function saveSyncCfg() { store.set('drs_sync', SYNC.cfg); renderSync(); }
async function sbAuth(path, body) {
  const r = await fetch(sbUrl() + '/auth/v1/' + path, { method: 'POST', headers: { apikey: sbKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.msg || j.message || ('로그인 실패 ' + r.status)); return j;
}
function takeSession(j) { if (!j.access_token) throw new Error('이메일 확인 후 다시 로그인하세요'); Object.assign(SYNC.cfg, { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, user: j.user && j.user.id, email: j.user && j.user.email }); saveSyncCfg(); }
async function sbFetch(path, opt = {}) {
  if (SYNC.cfg.exp && Date.now() > SYNC.cfg.exp) takeSession(await sbAuth('token?grant_type=refresh_token', { refresh_token: SYNC.cfg.refresh }));
  const r = await fetch(sbUrl() + path, { ...opt, headers: { apikey: sbKey(), Authorization: 'Bearer ' + SYNC.cfg.access, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('서버 응답 ' + r.status); return r;
}
async function syncNow(quiet) {
  if (SYNC.busy || !SYNC.cfg.access) return; SYNC.busy = true; let up = 0, down = 0;
  try {
    const remote = await (await sbFetch('/rest/v1/projects?select=id,name,updated_at&user_id=eq.' + SYNC.cfg.user)).json(), idx = store.get('drs_index', []);
    const rmap = new Map(remote.map((r) => [r.id, r]));
    for (const p of idx) {
      const r = rmap.get(p.id), rt = r ? Date.parse(r.updated_at) : 0;
      if ((p.updated || 0) > rt + 1000) { await sbFetch('/rest/v1/projects', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: p.id, user_id: SYNC.cfg.user, name: p.name, data: store.get('drs_p_' + p.id), thumb: store.get('drs_t_' + p.id, null), updated_at: new Date(p.updated).toISOString() }) }); up++; }
    }
    for (const r of remote) {
      if (r.id === 'mylib-' + SYNC.cfg.user) continue;
      const l = idx.find((x) => x.id === r.id), rt = Date.parse(r.updated_at);
      if (!l || rt > (l.updated || 0) + 1000) {
        const full = (await (await sbFetch(`/rest/v1/projects?id=eq.${encodeURIComponent(r.id)}&user_id=eq.${SYNC.cfg.user}&select=*`)).json())[0]; if (!full) continue;
        const data = { ...full.data, updated: rt }; store.set('drs_p_' + r.id, data); if (full.thumb) store.set('drs_t_' + r.id, full.thumb);
        const i2 = store.get('drs_index', []).filter((x) => x.id !== r.id); i2.push({ id: r.id, name: full.name, updated: rt, n: (data.items || []).filter((i) => !i.hidden).length }); i2.sort((x, y) => y.updated - x.updated); store.set('drs_index', i2);
        if (P && P.id === r.id) openProject(data); down++;
      }
    }
    const libId = 'mylib-' + SYNC.cfg.user, rl = rmap.get(libId), lt = store.get('drs_mylib_t', 0);
    if (rl && Date.parse(rl.updated_at) > lt + 1000) { const full = (await (await sbFetch(`/rest/v1/projects?id=eq.${encodeURIComponent(libId)}&select=*`)).json())[0]; if (full) { myLib = full.data.items || []; store.set('drs_mylib', myLib); store.set('drs_mylib_t', Date.parse(rl.updated_at)); renderLib(); } }
    else if (myLib.length && (!rl || lt > Date.parse(rl.updated_at) + 1000)) { const t = lt || Date.now(); await sbFetch('/rest/v1/projects', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: libId, user_id: SYNC.cfg.user, name: '__mylib', data: { items: myLib }, updated_at: new Date(t).toISOString() }) }); store.set('drs_mylib_t', t); }
    SYNC.cfg.last = Date.now(); saveSyncCfg(); if (!quiet || up || down) toast(`동기화 완료 · 올림 ${up} · 받음 ${down}`);
  } catch (e) { $('#syncMsg').textContent = netMsg(e); if (!quiet) toast('동기화 실패'); }
  SYNC.busy = false;
}
function netMsg(e) { const m = String(e && e.message || e); return /Failed to fetch|NetworkError|Load failed|blocked/i.test(m) ? '서버에 연결할 수 없어요. Claude 미리보기 화면에서는 외부 연결이 막혀 있으니 PC·안드로이드 앱에서 로그인하세요.' : m; }
function renderSync() {
  const c = SYNC.cfg, inn = !!c.access;
  $('#syncState').textContent = inn ? `${c.email || '로그인됨'} · ${c.last ? '마지막 동기화 ' + new Date(c.last).toLocaleString('ko-KR') : '아직 동기화 안 함'}` : '로그인하지 않음';
  $('#syncLogin').hidden = inn; $('#syncOn').hidden = !inn; $('#syncServer').hidden = !!(BUILT.supabaseUrl && BUILT.supabaseKey);
  $('#sAi').value = c.aiKey || ''; $('#sUrl').value = c.url || ''; $('#sKey').value = c.key || ''; $('#sAuto').checked = !!c.auto; $('#acctBtn').textContent = inn ? '동기화' : '로그인';
}
$('#acctBtn2').onclick = () => { $('#projDlg').close(); $('#acctBtn').click(); };
$('#exportBtn2').onclick = () => $('#exportBtn').click();
$('#acctBtn').onclick = () => { $('#syncMsg').textContent = ''; renderSync(); $('#syncDlg').showModal(); };
$('#syncForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const signup = e.submitter && e.submitter.id === 'sSignup';
  SYNC.cfg.url = $('#sUrl').value.trim(); SYNC.cfg.key = $('#sKey').value.trim();
  if (!sbUrl() || !sbKey()) { $('#syncMsg').textContent = '서버 주소와 공개 키를 넣어 주세요 (설치 안내 참고).'; return; }
  $('#syncMsg').textContent = signup ? '가입하는 중…' : '로그인하는 중…';
  try { const j = await sbAuth(signup ? 'signup' : 'token?grant_type=password', { email: $('#sEmail').value.trim(), password: $('#sPw').value }); takeSession(j); SYNC.cfg.auto = true; saveSyncCfg(); $('#syncMsg').textContent = '로그인했어요. 프로젝트를 맞추는 중…'; await syncNow(); $('#syncMsg').textContent = ''; }
  catch (er) { $('#syncMsg').textContent = netMsg(er); }
});
$('#sNow').onclick = () => syncNow(false);
$('#sAuto').addEventListener('change', (e) => { SYNC.cfg.auto = e.target.checked; saveSyncCfg(); });
$('#sOut').onclick = () => { SYNC.cfg = { url: SYNC.cfg.url, key: SYNC.cfg.key }; saveSyncCfg(); };

/* ---------- 흑백 작업 보기 · 단축키 도움말 ---------- */
function setMono(on) { document.body.classList.toggle('mono', on); $('#monoBtn').setAttribute('aria-pressed', on); store.set('drs_mono', on); }
$('#monoBtn').onclick = () => setMono(!document.body.classList.contains('mono'));
setMono(store.get('drs_mono', false));
$('#helpBtn').onclick = () => $('#helpDlg').showModal();

/* ---------- 도구 · 보기 ---------- */
function setTool(t) {
  tool = t; draft = null; $$('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === t)); $('#lineKinds').hidden = t !== 'line';
  const drawing = t === 'wall' || t === 'line'; cv.style.cursor = t === 'select' ? 'default' : 'crosshair';
  $('#toolHint').textContent = { select: '눌러서 선택 · 끌면 화면 이동 · 옮기려면 이동 ON', wall: drawHint(), door: '문을 넣을 벽을 누르세요', window: '창을 넣을 벽을 누르세요', line: drawHint() }[t];
  if (drawing && isMobile()) closeSheet(); if (drawing && view === '3d') { b3Target = t; build3d = true; setBuild(true); } updDrawBar();
  draw2d();
}
function drawHint() { return drawMode === 'arc' ? '시작점 → 끝점 → 휘어질 지점 순서로 누르세요' : drawMode === 'free' ? '손으로 그리면 ' + (assist ? '직선과 곡선으로 다듬어요' : '그린 모양 그대로 넣어요') : '점을 찍어 그리기 · 마지막 점을 한 번 더 누르면 끝'; }
function setView(v) { view = v; document.body.dataset.view = v; $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === v)); requestAnimationFrame(() => { draw2d(); need3d = true; }); }
$$('[data-tool]').forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
$$('[data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
$('#lineKinds').innerHTML = Object.entries(LINEKINDS).map(([k, v]) => `<button class="chip ${k === lineKind ? 'on' : ''}" data-lk="${k}"><span class="sq" style="background:${v.color}"></span>${v.name}</button>`).join('');
$('#lineKinds').addEventListener('click', (e) => { const b = e.target.closest('[data-lk]'); if (b) { lineKind = b.dataset.lk; $$('[data-lk]').forEach((x) => x.classList.toggle('on', x === b)); } });
$('#finishBtn').onclick = () => finishDraft();
$$('[data-dm2]').forEach((b) => (b.onclick = () => { drawMode = b.dataset.dm2; store.set('drs_dmode', drawMode); draft = null; draft3 = null; updDrawBar(); drawOverlay(); $('#toolHint').textContent = drawHint(); }));
$('#assistBtn').onclick = () => { assist = !assist; store.set('drs_assist', assist); updDrawBar(); };
$('#drawExit').onclick = () => { finishDraft(); finish3(); setBuild(false); setTool('select'); };
$('#finishBtn').onclick = () => { finishDraft(); finish3(); };
$$('[data-bm]').forEach((b) => (b.onclick = () => setBuild(b.dataset.bm === 'build')));
$$('[data-b3t]').forEach((b) => (b.onclick = () => { b3Target = b.dataset.b3t; draft3 = null; updDrawBar(); drawOverlay(); }));
$$('[data-skc]').forEach((b) => (b.onclick = () => { skColor = b.dataset.skc; store.set('drs_skc', skColor); updDrawBar(); }));
/* 2D · 3D 화면 비율 조절 */
let splitR = store.get('drs_split', 50);
function applySplit() { $('#stage').style.setProperty('--split', splitR + '%'); requestAnimationFrame(() => { draw2d(); need3d = true; drawOverlay(); }); }
$('#gutter').addEventListener('pointerdown', (e) => {
  const gtr = $('#gutter'); gtr.setPointerCapture(e.pointerId); gtr.classList.add('on'); const r = $('#stage').getBoundingClientRect();
  const mv = (ev) => { splitR = clamp((ev.clientX - r.left) / r.width * 100, 15, 85); applySplit(); };
  const up = () => { gtr.classList.remove('on'); gtr.removeEventListener('pointermove', mv); gtr.removeEventListener('pointerup', up); store.set('drs_split', splitR); };
  gtr.addEventListener('pointermove', mv); gtr.addEventListener('pointerup', up);
});
$('#gutter').addEventListener('dblclick', () => { splitR = 50; applySplit(); store.set('drs_split', splitR); });
$('#gutter').addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); splitR = clamp(splitR + (e.key === 'ArrowLeft' ? -5 : 5), 15, 85); applySplit(); store.set('drs_split', splitR); } });
applySplit();
$('#undo2').onclick = undo; $('#redo2').onclick = redo;
/* WASD · 방향키로 화면 옮기기 (시점 각도는 그대로) */
const held = new Set(); let activePane = '3d';
$('#v2d').addEventListener('pointerenter', () => (activePane = '2d')); $('#v3d').addEventListener('pointerenter', () => (activePane = '3d'));
window.addEventListener('keyup', (e) => held.delete(e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : (e.key || '').toLowerCase())); window.addEventListener('blur', () => held.clear());
function panKeys(dt) {
  if (!held.size) return; const k = (x) => held.has(x), ax = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0), ay = (k('s') || k('arrowdown') ? 1 : 0) - (k('w') || k('arrowup') ? 1 : 0);
  if (!ax && !ay) return; const pane = view === 'split' ? activePane : view;
  if (pane === '2d') { V.ox -= ax * 700 * dt; V.oy -= ay * 700 * dt; draw2d(); return; }
  const sp = goal.dist * 0.7 * dt, s = Math.sin(goal.yaw), c = Math.cos(goal.yaw);
  goal.tx += (s * ax + c * ay) * sp; goal.tz += (-c * ax + s * ay) * sp; anim = null;
}
$('#lkSel').innerHTML = Object.entries(LINEKINDS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
$('#lkSel').addEventListener('change', (e) => { lineKind = e.target.value; $$('[data-lk]').forEach((x) => x.classList.toggle('on', x.dataset.lk === lineKind)); });
$('#undoBtn').onclick = undo; $('#redoBtn').onclick = redo;
$('#fitBtn').onclick = () => { fit2d(); draw2d(); cam3dDefault(); dirty3d = true; };
$('#cutWalls').addEventListener('change', (e) => { cam.cut = e.target.checked; dirty3d = true; });
for (const id of ['outside']) $('#' + id).addEventListener('change', () => (dirty3d = true));
$('#hq').addEventListener('change', () => (need3d = true)); $('#labels3d').addEventListener('change', () => (need3d = true));
$('#spinBtn').onclick = () => { spin = !spin; $('#spinBtn').setAttribute('aria-pressed', spin); };
$('#projBtn').onclick = showHome;
$('#myBtn').onclick = () => $('#myDlg').showModal();
$$('dialog [data-close]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
// 보여주기 모드
$('#showBtn').onclick = () => { document.body.classList.add('show'); $('#showProj').textContent = P.name; setView(view === '2d' ? 'split' : view); sel = null; renderProps(); goScene(0); try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch (e) {} };
$('#showExit').onclick = () => { document.body.classList.remove('show'); tour = null; updTourBtn(); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} need3d = true; };
$('#scPrev').onclick = () => goScene(sceneIdx - 1); $('#scNext').onclick = () => goScene(sceneIdx + 1);
$('#tourBtn').onclick = () => { tour = tour ? null : { t: performance.now() - 5000 }; updTourBtn(); };
$('#scSave').onclick = () => { if (!P.scenes.length) P.scenes = defaultScenes(); P.scenes.push({ name: `장면 ${P.scenes.length + 1}`, yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, tx: cam.tx, ty: cam.ty, tz: cam.tz, cut: cam.cut }); commit(); goScene(P.scenes.length - 1, 1); toast('지금 보는 시점을 장면으로 저장했어요'); };
$('#scShot').onclick = async () => { const f = await makeFile('jpg'); if (f) saveLocal(f); };
$('#sceneNav').addEventListener('click', (e) => { const b = e.target.closest('[data-scene]'); if (b) goScene(+b.dataset.scene); });

// 키보드 (워드 단축키 기준)
window.addEventListener('keydown', (e) => {
  const inField = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName), mod = e.ctrlKey || e.metaKey, k = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : (e.key || '').toLowerCase();
  if (mod && k === 's') { e.preventDefault(); saveProject(true); toast('저장했어요'); return; }
  const ae = document.activeElement; if (inField && mod && (k === 'z' || k === 'y') && !/text|search|email|password/.test(ae.type || '') && ae.tagName !== 'TEXTAREA') { e.preventDefault(); ae.blur(); (k === 'y' || e.shiftKey) ? redo() : undo(); return; }
  if (inField || document.querySelector('dialog[open]')) return;
  if (!mod && !e.altKey && (['w', 'a', 's', 'd'].includes(k) || (!sel && e.key.startsWith('Arrow')))) { e.preventDefault(); held.add(k); return; }
  if (mod && e.shiftKey && (e.code === 'Period' || k === '>')) { e.preventDefault(); scaleSel(1.1); return; }
  if (mod && e.shiftKey && (e.code === 'Comma' || k === '<')) { e.preventDefault(); scaleSel(1 / 1.1); return; }
  if (mod && e.code === 'BracketRight') { e.preventDefault(); scaleSel(1.05); return; }
  if (mod && e.code === 'BracketLeft') { e.preventDefault(); scaleSel(1 / 1.05); return; }
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
  if (mod && k === 'c') { e.preventDefault(); copySel(); return; }
  if (mod && k === 'x') { e.preventDefault(); cutSel(); return; }
  if (mod && k === 'v') { e.preventDefault(); pasteClip(); return; }
  if (mod && k === 'd') { e.preventDefault(); dupSel(); return; }
  if (mod && k === 'o') { e.preventDefault(); $('#projBtn').click(); return; }
  if (mod && k === 'n') { e.preventDefault(); $('#projBtn').click(); return; }
  if (mod && k === 'p') { e.preventDefault(); $('#exportBtn').click(); return; }
  if (e.key === 'F1' || (mod && k === '/')) { e.preventDefault(); $('#helpDlg').showModal(); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { if (sel) { e.preventDefault(); delSel(); } return; }
  if (e.key === 'Escape' && document.body.classList.contains('clean')) { setClean(false); return; }
  if (e.key === 'Escape' && multi.length) { pickSel(null); return; }
  if (e.key === 'Escape') { if (draft) { draft = null; draw2d(); } else if (tool !== 'select') setTool('select'); else pickSel(null); return; }
  if (e.key === 'Enter' && draft) { finishDraft(); return; }
  if (k === 'm' && sel) { setMove(!moveOn); return; }
  if (k === 'r' && sel && sel.kind === 'item') { rotSel(e.shiftKey ? -90 : 90); return; }
  if (sel && e.key.startsWith('Arrow')) { e.preventDefault(); const st = moveStep * (e.shiftKey ? 10 : 1); nudge(e.key === 'ArrowLeft' ? -st : e.key === 'ArrowRight' ? st : 0, e.key === 'ArrowUp' ? -st : e.key === 'ArrowDown' ? st : 0); }
});

/* ---------- 모바일 시트 ---------- */
const isMobile = () => window.matchMedia('(max-width: 899px), (max-height: 540px)').matches;
function openSheet(n) { document.body.dataset.sheet = n; $$('[data-sheet]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sheet === n)); requestAnimationFrame(() => { draw2d(); need3d = true; }); }
function closeSheet() { document.body.dataset.sheet = ''; $$('[data-sheet]').forEach((b) => b.setAttribute('aria-pressed', 'false')); requestAnimationFrame(() => { draw2d(); need3d = true; }); }
$$('[data-sheet]').forEach((b) => (b.onclick = () => (document.body.dataset.sheet === b.dataset.sheet ? closeSheet() : openSheet(b.dataset.sheet))));
$$('[data-mview]').forEach((b) => (b.onclick = () => { closeSheet(); setView(b.dataset.mview); $$('[data-mview]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));

let toastT; function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2600); }
new ResizeObserver(() => { draw2d(); need3d = true; }).observe($('#stage'));



/* ---------- 빠른 수정 막대 (선택한 오브젝트) ---------- */
let quickPal = false;
function selName() {
  if (!sel) return '';
  if (sel.kind === 'item') { const it = itemOf(sel.id); return it ? spec(it).name : ''; }
  if (sel.kind === 'wall') return '벽'; if (sel.kind === 'open') { const o = P.openings.find((x) => x.id === sel.id); return o ? OPENTYPES[o.type] : ''; }
  if (sel.kind === 'line') { const l = P.lines.find((x) => x.id === sel.id); return l ? LINEKINDS[l.kind].name : ''; }
  if (sel.kind === 'sketch') return P.sketches.some((x) => x.id === sel.id) ? '낙서 · 메모' : '';
  if (sel.kind === 'floor') return '바닥';
}
function selColor() {
  if (sel.kind === 'item') { const it = itemOf(sel.id); return libGet(it.type).shape === 'zone' ? it.finish?.color || spec(it).color : spec(it).color; }
  if (sel.kind === 'wall') return wallOf(sel.id).finish.color;
  if (sel.kind === 'open') return P.openings.find((x) => x.id === sel.id).frame;
  if (sel.kind === 'line') { const l = P.lines.find((x) => x.id === sel.id); return l.color || LINEKINDS[l.kind].color; }
  if (sel.kind === 'sketch') return P.sketches.find((x) => x.id === sel.id).color;
  if (sel.kind === 'floor') return P.floor.color;
}
function setSelColor(c) {
  if (sel.kind === 'item') { const it = itemOf(sel.id); if (libGet(it.type).shape === 'zone') it.finish = { ...(it.finish || { type: 'tile' }), color: c }; else it.color = c; }
  if (sel.kind === 'wall') wallOf(sel.id).finish.color = c;
  if (sel.kind === 'open') P.openings.find((x) => x.id === sel.id).frame = c;
  if (sel.kind === 'line') P.lines.find((x) => x.id === sel.id).color = c;
  if (sel.kind === 'sketch') P.sketches.find((x) => x.id === sel.id).color = c;
  if (sel.kind === 'floor') P.floor.color = c;
  commit(); dirty3d = true;
}
function quickDims() {
  if (sel.kind === 'item') { const it = itemOf(sel.id); return [['W', it.w, (v) => (it.w = v)], ['D', it.d, (v) => (it.d = v)], ['H', spec(it).h, (v) => (it.h = v)]]; }
  if (sel.kind === 'wall') { const w = wallOf(sel.id), L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)); return [['길이', L, (v) => { const k = v / L; w.x2 = Math.round(w.x1 + (w.x2 - w.x1) * k); w.y2 = Math.round(w.y1 + (w.y2 - w.y1) * k); }], ['두께', wallT(w), (v) => (w.t = v)], ['높이', wallH(w), (v) => (w.h = v)]]; }
  if (sel.kind === 'open') { const o = P.openings.find((x) => x.id === sel.id); return [['폭', o.w, (v) => { o.w = v; if (o.ratio) o.h = Math.round(v / o.ratio); }], ['높이', o.h, (v) => { o.h = v; if (o.ratio) o.w = Math.round(v * o.ratio); }], ['바닥에서', o.sill, (v) => (o.sill = v)]]; }
  if (sel.kind === 'sketch') { const k = P.sketches.find((x) => x.id === sel.id); return [['굵기', k.w || 24, (v) => (k.w = v)]]; }
  if (sel.kind === 'floor') return [];
  if (sel.kind === 'line') { const l = P.lines.find((x) => x.id === sel.id), k = LINEKINDS[l.kind]; let len = 0; for (let i = 1; i < l.pts.length; i++) len += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]);
    const setLen = (v) => { const n = l.pts.length, a0 = l.pts[n - 2], b0 = l.pts[n - 1], last = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1, nl = Math.max(10, last + (v - len)); l.pts[n - 1] = [Math.round(a0[0] + (b0[0] - a0[0]) / last * nl), Math.round(a0[1] + (b0[1] - a0[1]) / last * nl)]; };
    return [['굵기 φ', l.w || k.w, (v) => (l.w = v)], ['길이', len, setLen], k.z === 'below' ? ['깊이', l.depth ?? 80, (v) => (l.depth = v)] : k.z === 'hang' ? ['천장에서', l.off ?? 300, (v) => (l.off = v)] : null].filter(Boolean); }
  if (false) { const l = null; return [['굵기', l.w || LINEKINDS[l.kind].w, (v) => (l.w = v)]]; }
  return [];
}
let qTab = 'size';
function selMat() {
  if (sel.kind === 'item') { const it = itemOf(sel.id); return libGet(it.type).shape === 'zone' ? normMat(it.finish?.type || spec(it).mat) : spec(it).mat; }
  if (sel.kind === 'wall') return normMat(wallOf(sel.id).finish.type);
  if (sel.kind === 'floor') return normMat(P.floor.type);
  return null;
}
function setSelMat(m) {
  if (sel.kind === 'item') { const it = itemOf(sel.id); if (libGet(it.type).shape === 'zone') it.finish = { ...(it.finish || { color: spec(it).color }), type: m }; else it.mat = m; }
  if (sel.kind === 'wall') wallOf(sel.id).finish.type = m;
  if (sel.kind === 'floor') P.floor.type = m;
  commit(); dirty3d = true;
}
function rotSel(d) { if (!sel || sel.kind !== 'item') return; const it = itemOf(sel.id); it.rot = (((it.rot || 0) + d) % 360 + 360) % 360; commit(); dirty3d = true; }
function scaleSel(f) {
  if (!sel) return; const r10 = (v) => Math.max(10, Math.round(v * f / 10) * 10);
  if (sel.kind === 'item') { const it = itemOf(sel.id), h = spec(it).h; it.w = r10(it.w); it.d = r10(it.d); it.h = r10(h); }
  if (sel.kind === 'open') { const o = P.openings.find((x) => x.id === sel.id); o.w = r10(o.w); o.h = r10(o.h); }
  if (sel.kind === 'wall') { const w = wallOf(sel.id), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), nl = r10(L), k = nl / L; w.x2 = Math.round(w.x1 + (w.x2 - w.x1) * k); w.y2 = Math.round(w.y1 + (w.y2 - w.y1) * k); }
  if (sel.kind === 'line') { const l = P.lines.find((x) => x.id === sel.id); l.w = r10(l.w || LINEKINDS[l.kind].w); }
  commit(); dirty3d = true; toast(f > 1 ? '크게 · 비율 유지' : '작게 · 비율 유지');
}
function renderQuick() { keepFocus(renderQuick0); }
function renderQuick0() {
  const q = $('#quick'); if (!sel || !P || document.body.classList.contains('show')) { q.hidden = true; return; }
  const M = multi.length > 1, name = M ? `${multi.length}개 선택` : selName(); if (!name || document.body.classList.contains('clean')) { q.hidden = true; return; }
  const fl = !M && sel.kind === 'floor', tabs = M ? [['size', '크기'], ['rot', '회전'], ['move', '이동'], ['look', '색·재질'], ['more', '더보기']] : [!fl && ['size', '크기'], (sel.kind === 'wall' || fl) && ['attach', '붙이기'], sel.kind === 'item' && ['rot', '회전'], !fl && ['move', '이동'], ['look', selMat() ? '색·재질' : '색'], !fl && ['more', '더보기']].filter(Boolean);
  if (!tabs.find((t) => t[0] === qTab)) qTab = 'size';
  const dims = M ? [] : quickDims(), col = selColor() || '#999999', mat = M ? 'none' : selMat();
  let body = '';
  if (qTab === 'size') body = `<div class="qgrid">${dims.map((d, i) => `<div class="qdim"><span>${d[0]}</span><button class="qb" data-dm="${i}" data-dv="-1" aria-label="${d[0]} 줄이기">−</button><input id="q${i}" type="number" inputmode="numeric" value="${Math.round(d[1])}" aria-label="${d[0]} mm"><button class="qb" data-dm="${i}" data-dv="1" aria-label="${d[0]} 늘리기">+</button></div>`).join('')}</div>
    ${!M && sel.kind === 'open' ? ratioRow(P.openings.find((x) => x.id === sel.id).ratio) + `<label class="qf"><span>프레임 두께</span><input id="qFw" type="number" value="${P.openings.find((x) => x.id === sel.id).fw || std().frameW}"></label>` : ''}
    <div class="qrow"><button class="qb" id="qSm">비율 유지 작게</button><button class="qb" id="qLg">비율 유지 크게</button><span class="qk">Ctrl+Shift+&lt; &gt;</span></div>`;
  if (qTab === 'rot') { const it = M ? { rot: 0 } : itemOf(sel.id); body = `<div class="qrow"><button class="qb" data-rt="-90">↺ 90°</button><button class="qb" data-rt="-15">↺ 15°</button><button class="qb" data-rt="15">↻ 15°</button><button class="qb" data-rt="90">↻ 90°</button><label class="qf"><span>각도</span><input id="qRotV" type="number" value="${it.rot || 0}"></label></div>`; }
  if (qTab === 'move') body = `<div class="qrow"><span class="qk">단위</span>${[10, 50, 100, 500].map((s) => `<button class="qb ${s === moveStep ? 'on' : ''}" data-st="${s}">${s}</button>`).join('')}<span class="qk">mm</span></div>
    <div class="qmove"><div class="qpad"><span></span><button class="qb" data-ng="0,-1" aria-label="위로">▲</button><span></span><button class="qb" data-ng="-1,0" aria-label="왼쪽">◀</button><button class="qb ${moveOn ? 'on' : ''}" id="qMove2">${moveOn ? '끌기 ON' : '끌기 OFF'}</button><button class="qb" data-ng="1,0" aria-label="오른쪽">▶</button><span></span><button class="qb" data-ng="0,1" aria-label="아래로">▼</button><span></span></div>
    <p class="qk">끌기 ON이면 오브젝트를 끌어서 옮겨요. ${moveStep}mm씩 움직입니다.</p></div>`;
  if (qTab === 'look') body = (mat ? `<div class="qmats">${Object.entries(MATS).map(([k, v]) => `<button class="chip ${k === mat ? 'on' : ''}" data-mt="${k}">${v.n}</button>`).join('')}</div>` : '') + (M ? '<p class="qk">재질은 바꿀 수 있는 개체에만 적용돼요</p>' : '')
    + `<div class="qpal">${PALETTE.map((c) => `<button class="swb ${c === col ? 'on' : ''}" style="background:${c}" data-qc="${c}" aria-label="${c}"></button>`).join('')}</div><label class="swc">직접 고르기<input type="color" id="qCustom" value="${col}"></label>`;
  if (qTab === 'attach') body = attachBody();
  if (qTab === 'more') body = `<div class="qrow wrap"><button class="qb" id="qCopy">복사</button><button class="qb" id="qCut">잘라내기</button><button class="qb" id="qPaste" ${clip ? '' : 'disabled'}>붙여넣기</button><button class="qb" id="qDup">복제</button>${sel.kind === 'item' ? '<button class="qb" id="qHide">도면에서 빼기</button>' : ''}<button class="qb danger" id="qDel">삭제</button>${!M && sel.kind === 'wall' ? '<button class="qb" id="qSplit">벽 나누기</button>' : ''}<button class="qb" id="qMore">상세 속성</button></div>`;
  q.hidden = false;
  q.innerHTML = `<div class="qhead"><b class="qn">${esc(name)}</b><button class="mvbtn ${multiMode ? 'on' : ''}" id="qMulti" aria-pressed="${multiMode}" title="눌러서 여러 개 고르기 (PC: Ctrl+클릭)">여러 개</button><button class="mvbtn ${moveOn ? 'on' : ''}" id="qMove" aria-pressed="${moveOn}">이동 ${moveOn ? 'ON' : 'OFF'}</button><button class="qb" id="qX" aria-label="선택 해제">✕</button></div>
    <div class="qtabs" role="tablist">${tabs.map((t) => `<button role="tab" class="qt ${t[0] === qTab ? 'on' : ''}" aria-selected="${t[0] === qTab}" data-qt="${t[0]}">${t[1]}</button>`).join('')}</div><div class="qbody">${body}</div>`;
  $$('[data-qt]', q).forEach((b) => (b.onclick = () => { qTab = b.dataset.qt; renderQuick(); }));
  $('#qMove').onclick = () => setMove(!moveOn); if ($('#qMove2')) $('#qMove2').onclick = () => setMove(!moveOn);
  $('#qX').onclick = () => { multiMode = false; pickSel(null); };
  $('#qMulti').onclick = () => { multiMode = !multiMode; toast(multiMode ? '눌러서 더 고르세요 · 다시 누르면 빠져요' : '여러 개 고르기 끝'); renderQuick(); };
  dims.forEach((d, i) => { const el = $('#q' + i); if (el) el.addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (v > 0) { d[2](v); commit(); dirty3d = true; } }); });
  $$('[data-dm]', q).forEach((b) => (b.onclick = () => { const d = dims[+b.dataset.dm], st = (P && std().grid) || 50; d[2](Math.max(10, Math.round(d[1]) + st * +b.dataset.dv)); commit(); dirty3d = true; }));
  if ($('#qSm')) { $('#qSm').onclick = () => scaleSel(1 / 1.1); $('#qLg').onclick = () => scaleSel(1.1); }
  $$('[data-rt]', q).forEach((b) => (b.onclick = () => rotSel(+b.dataset.rt)));
  if ($('#qRotV')) $('#qRotV').addEventListener('change', (e) => { const it = itemOf(sel.id); it.rot = ((+e.target.value % 360) + 360) % 360; commit(); dirty3d = true; });
  $$('[data-st]', q).forEach((b) => (b.onclick = () => { moveStep = +b.dataset.st; store.set('drs_step', moveStep); renderQuick(); }));
  $$('[data-ng]', q).forEach((b) => (b.onclick = () => { const [x, y] = b.dataset.ng.split(',').map(Number); nudge(x * moveStep, y * moveStep); }));
  $$('[data-mt]', q).forEach((b) => (b.onclick = () => setSelMat(b.dataset.mt)));
  $$('[data-qc]', q).forEach((b) => (b.onclick = () => setSelColor(b.dataset.qc)));
  const cc = $('#qCustom'); if (cc) cc.addEventListener('change', (e) => setSelColor(e.target.value));
  const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
  $$('[data-ra]', q).forEach((b) => (b.onclick = () => { const r = +b.dataset.ra || 0; if (sel.kind === 'open') { const o = P.openings.find((x) => x.id === sel.id); o.ratio = r || undefined; if (r) o.h = Math.round(o.w / r); commit(); } else { atv().ratio = r; if (r) atv().h = Math.round(atv().w / r); saveAt(); renderQuick(); } }));
  if ($('#qFw')) $('#qFw').addEventListener('change', (e) => { const o = P.openings.find((x) => x.id === sel.id); o.fw = Math.max(10, +e.target.value || 50); commit(); });
  if (qTab === 'attach') bindAttach(q);
  on('qSplit', () => { lastPtr = { x: q.getBoundingClientRect().left + 40, y: q.getBoundingClientRect().top + 20 }; updFab(); openSplit(); });
  on('qCopy', copySel); on('qCut', cutSel); on('qPaste', pasteClip); on('qDup', dupSel); on('qHide', hideSel); on('qDel', delSel);
  on('qMore', () => { if (isMobile()) openSheet('props'); else document.body.classList.remove('no-right'); });
}
/* 벽 · 바닥에 붙이기 (창 · 문 · 액자 · 박스 · 원형) */
let lastHit = null;
function hit2d(h, wx, wy) {
  if (!h) return null;
  if (h.kind === 'wall') { const w = wallOf(h.id), [, t] = distPtSeg(wx, wy, w), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), cr = (w.x2 - w.x1) * (wy - w.y1) - (w.y2 - w.y1) * (wx - w.x1); return { sel: h, along: t * L, y: 1200, side: cr < 0 ? -1 : 1 }; }
  return { sel: h, p: [wx, 0, wy] };
}
const AT = {
  window: { n: '창문', k: 'open', w: 1800, h: 1200, e: 900, ratio: 1.5 }, full: { n: '통창', k: 'open', w: 2400, h: 2400, e: 0 }, door1: { n: '여닫이 문', k: 'open', w: 900, h: 2100, e: 0 },
  door2: { n: '양개 문', k: 'open', w: 1600, h: 2300, e: 0 }, auto: { n: '자동문', k: 'open', w: 1800, h: 2300, e: 0 },
  slidepass: { n: '미닫이 배식창', k: 'open', w: 900, h: 600, e: 900 }, access: { n: '벽 점검구', k: 'item', w: 450, h: 450, d: 30, e: 1200 }, distbox: { n: '배전함', k: 'item', w: 600, h: 800, d: 200, e: 1000 }, holeR: { n: '타공 구멍', k: 'item', w: 150, h: 150, d: 200, e: 1500 }, hydrant: { n: '소화전', k: 'item', w: 650, h: 1300, d: 200, e: 300 },
  slide: { n: '미닫이 문', k: 'open', w: 1800, h: 2100, e: 0 }, arch: { n: '아치 입구', k: 'open', w: 1200, h: 2400, e: 0 }, pass: { n: '배식구', k: 'open', w: 900, h: 600, e: 900 },
  frame: { n: '액자', k: 'item', w: 600, h: 800, d: 30, e: 1200, ratio: 0.75, fw: 40 }, wallbox: { n: '부착 박스', k: 'item', w: 600, h: 400, d: 300, e: 1000 }, walldisc: { n: '원형 부착물', k: 'item', w: 600, h: 600, d: 60, e: 1300 },
  wallvent: { n: '환기구', k: 'item', w: 300, h: 300, d: 40, e: 2300 }, switch: { n: '스위치', k: 'item', w: 100, h: 100, d: 30, e: 1200 }, outlet: { n: '콘센트', k: 'item', w: 100, h: 100, d: 30, e: 300 }, brace: { n: '보강재', k: 'item', w: 1200, h: 90, d: 40, e: 1000 },
  cube: { n: '박스', k: 'floor', w: 600, h: 600, d: 600 }, roundcol: { n: '원형 구조물', k: 'floor', w: 600, h: 1200, d: 600 }, zone: { n: '바닥 구역', k: 'floor', w: 3000, h: 3, d: 3000 }
};
let atType = 'window', atSide = 1, atStore = store.get('drs_at', {});
const atv = () => (atStore[atType] = atStore[atType] || { ...AT[atType], fw: AT[atType].fw || (P ? std().frameW : 50) });
const saveAt = () => store.set('drs_at', atStore);
function ratioRow(cur) { return `<div class="qrow wrap"><span class="qk">비율</span>${[[0, '자유'], [1, '1:1'], [4 / 3, '4:3'], [3 / 4, '3:4'], [16 / 9, '16:9'], [2, '2:1'], [1.5, '3:2']].map(([r, l]) => `<button class="qb ${Math.abs((cur || 0) - r) < 0.01 ? 'on' : ''}" data-ra="${r}">${l}</button>`).join('')}</div>`; }
function attachBody() {
  const fl = sel.kind === 'floor', types = Object.entries(AT).filter(([, v]) => (fl ? v.k === 'floor' : v.k !== 'floor'));
  if (!types.find(([k]) => k === atType)) atType = types[0][0];
  const v = atv(), D = AT[atType], f = (lbl, k) => `<label class="qf"><span>${lbl}</span><input type="number" data-av="${k}" value="${Math.round(v[k] ?? 0)}"></label>`;
  let pos = '';
  if (!fl) { const w = wallOf(sel.id), L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)), al = lastHit && lastHit.sel && lastHit.sel.id === sel.id && lastHit.along != null ? Math.round(lastHit.along) : Math.round(L / 2);
    pos = `<label class="qf"><span>벽 시작에서</span><input type="number" id="atAlong" value="${al}"></label>` + (D.k === 'item' ? `<button class="qb" id="atSide">${atSide > 0 ? '앞면' : '뒷면'}에 붙이기 ⇄</button>` : ''); }
  return `<div class="qmats">${types.map(([k, t]) => `<button class="chip ${k === atType ? 'on' : ''}" data-at="${k}">${t.n}</button>`).join('')}</div>
    <div class="qrow wrap">${f('가로', 'w')}${f(D.k === 'floor' && atType !== 'zone' ? '높이' : D.k === 'floor' ? '두께' : '높이', 'h')}${D.d != null && atType !== 'zone' ? f('깊이', 'd') : atType === 'zone' ? f('세로', 'd') : ''}${D.e != null ? f(D.k === 'open' ? '바닥에서' : '설치 높이', 'e') : ''}${D.k === 'open' || atType === 'frame' ? f('프레임 두께', 'fw') : ''}</div>
    ${D.k !== 'floor' ? ratioRow(v.ratio) : ''}<div class="qrow wrap">${pos}<button class="qb on" id="atGo">${fl ? '누른 자리에 놓기' : '이 벽에 붙이기'}</button></div>`;
}
function bindAttach(q) {
  $$('[data-at]', q).forEach((b) => (b.onclick = () => { atType = b.dataset.at; renderQuick(); }));
  $$('[data-av]', q).forEach((i) => i.addEventListener('change', () => { const v = atv(), k = i.dataset.av; v[k] = +i.value || 0; if (v.ratio && k === 'w') v.h = Math.round(v.w / v.ratio); if (v.ratio && k === 'h') v.w = Math.round(v.h * v.ratio); saveAt(); renderQuick(); }));
  if ($('#atSide')) $('#atSide').onclick = () => { atSide = -atSide; renderQuick(); };
  $('#atGo').onclick = doAttach;
}
function doAttach() {
  const v = atv(), D = AT[atType];
  if (sel.kind === 'floor') {
    const p = lastHit && lastHit.p ? lastHit.p : [cam.tx, 0, cam.tz], L = libGet(atType);
    const it = { id: uid('i'), type: atType, x: snapGrid(p[0]), y: snapGrid(p[2]), w: v.w, d: v.d, rot: 0 }; if (atType !== 'zone') it.h = v.h;
    P.items.push(it); sel = { kind: 'item', id: it.id }; qTab = 'size'; commit(); toast(`${L.name} 놓았어요`); return;
  }
  const w = wallOf(sel.id), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), along = clamp(+($('#atAlong') || {}).value || L / 2, v.w / 2, Math.max(v.w / 2, L - v.w / 2));
  if (D.k === 'open') {
    if (v.w > L) { toast('벽보다 넓어요 · 폭을 줄여 주세요'); return; }
    const o = { id: uid('o'), wall: w.id, t: Math.round(along), type: atType, w: v.w, h: v.h, sill: v.e || 0, frame: '#2b2d31', fw: v.fw, ratio: v.ratio || undefined };
    P.openings.push(o); sel = { kind: 'open', id: o.id };
  } else {
    const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, nx = -uy * atSide, ny = ux * atSide, off = wallT(w) / 2 + v.d / 2 + 1;
    const it = { id: uid('i'), type: atType, x: Math.round(w.x1 + ux * along + nx * off), y: Math.round(w.y1 + uy * along + ny * off), w: v.w, d: v.d, h: v.h, elev: v.e, rot: Math.round(Math.atan2(-nx, ny) * 180 / Math.PI), fw: v.fw };
    P.items.push(it); sel = { kind: 'item', id: it.id };
  }
  qTab = 'size'; commit(); toast(`${AT[atType].n} 붙였어요`);
}
/* 복사 · 붙여넣기 */
let clip = null, pasteN = 0;
function objOf(s) { return s.kind === 'item' ? itemOf(s.id) : s.kind === 'wall' ? wallOf(s.id) : s.kind === 'line' ? P.lines.find((x) => x.id === s.id) : s.kind === 'sketch' ? P.sketches.find((x) => x.id === s.id) : s.kind === 'open' ? P.openings.find((x) => x.id === s.id) : null; }
function copySel() { const list = selList().filter((s) => s.kind !== 'floor'); if (!list.length) return; clip = list.map((s) => ({ kind: s.kind, data: JSON.parse(JSON.stringify(objOf(s) || null)) })).filter((c) => c.data); pasteN = 0; toast(clip.length > 1 ? `${clip.length}개 복사했어요` : '복사했어요'); renderQuick(); }
function cutSel() { if (!sel) return; copySel(); delSel(); toast('잘라냈어요 · Ctrl+V로 붙여넣기'); }
function pasteClip() {
  if (!clip || !clip.length) { toast('먼저 복사하세요'); return; } pasteN++; const off = 300 * pasteN, made = [];
  for (const cl of clip) {
    const c = JSON.parse(JSON.stringify(cl.data));
    if (cl.kind === 'item') { c.id = uid('i'); c.x += off; c.y += off; c.hidden = false; P.items.push(c); }
    else if (cl.kind === 'wall') { c.id = uid('w'); c.x1 += off; c.y1 += off; c.x2 += off; c.y2 += off; P.walls.push(c); }
    else if (cl.kind === 'sketch') { c.id = uid('k'); c.pts = c.pts.map((p) => [p[0] + off, p[1], p[2] + off]); P.sketches.push(c); }
    else if (cl.kind === 'line') { c.id = uid('l'); c.pts = c.pts.map((p) => [p[0] + off, p[1] + off]); P.lines.push(c); }
    else if (cl.kind === 'open') { if (!wallOf(c.wall)) continue; c.id = uid('o'); c.t += c.w + 100; P.openings.push(c); }
    else continue;
    made.push({ kind: cl.kind, id: c.id });
  }
  multi = made.length > 1 ? made : []; sel = made[made.length - 1] || null; commit();
}
function dupSel() { const k = clip; copySel(); pasteClip(); clip = k || clip; }
function hideSel() { if (!sel || sel.kind !== 'item') return; const it = itemOf(sel.id); it.hidden = true; toast(`${spec(it).name} 뺐어요 · 오브젝트 목록에서 다시 넣을 수 있어요`); sel = null; commit(); dirty3d = true; }

/* ---------- 오브젝트 목록 (빼기 · 넣기) ---------- */
let objQ = '', objFold = store.get('drs_fold', { walls: true, opens: true });
function renderObjects() {
  const el = $('#objects'); if (!el || !P) return;
  const q = objQ;
  const match = (t) => !q || t.includes(q);
  const groups = LAYERS.map((l) => ({ id: l.id, name: l.name, color: l.color, rows: P.items.filter((it) => spec(it).layer === l.id && match(spec(it).name + spec(it).L.name)) }));
  const walls = P.walls.map((w, i) => ({ w, i })).filter(() => match('벽'));
  const ops = P.openings.filter((o) => match(OPENTYPES[o.type]));
  const hiddenN = P.items.filter((i) => i.hidden).length;
  $('#objSum').textContent = `${P.items.length - hiddenN}개 배치${hiddenN ? ` · ${hiddenN}개 빠짐` : ''}`;
  const row = (it) => { const s = spec(it), on = isSelected('item', it.id);
    return `<div class="orow ${it.hidden ? 'off' : ''} ${on ? 'on' : ''}"><input type="checkbox" data-oin="${it.id}" ${it.hidden ? '' : 'checked'} aria-label="${esc(s.name)} 도면에 넣기"><button class="oname" data-osel="${it.id}"><span class="sq" style="background:${s.color}"></span>${esc(s.name)}</button><small>${it.w}×${it.d}</small>${conflicts.has(it.id) ? '<span class="pill bad">!</span>' : ''}</div>`; };
  const grp = (id, title, color, inner, n) => `<div class="ogrp"><button class="ohead" data-ofold="${id}" aria-expanded="${!objFold[id]}"><span class="sq" style="background:${color}"></span>${title}<small>${n}</small></button>${objFold[id] ? '' : inner}</div>`;
  el.innerHTML = grp('walls', '벽', '#eceae6', walls.map(({ w, i }) => `<div class="orow ${sel && sel.id === w.id ? 'on' : ''}"><span class="sq" style="background:${w.finish.color}"></span><button class="oname" data-wsel="${w.id}">벽 ${i + 1}</button><small>${Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1))}mm</small></div>`).join(''), walls.length)
    + grp('opens', '문 · 창', '#4fc3c9', ops.map((o) => `<div class="orow ${sel && sel.id === o.id ? 'on' : ''}"><span class="sq" style="background:${o.frame}"></span><button class="oname" data-opsel="${o.id}">${OPENTYPES[o.type]}</button><small>${o.w}×${o.h}</small></div>`).join(''), ops.length)
    + groups.filter((g) => g.id !== 'sketch').map((g) => grp(g.id, g.name, g.color, g.rows.map(row).join(''), g.rows.length)).join('')
    + grp('sketch', '낙서 · 메모', '#ff375f', (P.sketches || []).map((k, i) => `<div class="orow ${sel && sel.id === k.id ? 'on' : ''}"><span class="sq" style="background:${k.color}"></span><button class="oname" data-sksel="${k.id}">낙서 ${i + 1}</button><small>${k.pts.length}점</small></div>`).join(''), (P.sketches || []).length);
}
$('#objects').addEventListener('click', (e) => {
  const f = e.target.closest('[data-ofold]'); if (f) { objFold[f.dataset.ofold] = !objFold[f.dataset.ofold]; store.set('drs_fold', objFold); renderObjects(); return; }
  const s1 = e.target.closest('[data-osel]'), s2 = e.target.closest('[data-wsel]'), s3 = e.target.closest('[data-opsel]');
  if (s1) { const it = itemOf(s1.dataset.osel); if (it.hidden) { it.hidden = false; commit(); dirty3d = true; } sel = { kind: 'item', id: it.id }; focusSel(); }
  if (s2) { sel = { kind: 'wall', id: s2.dataset.wsel }; focusSel(); }
  if (s3) { sel = { kind: 'open', id: s3.dataset.opsel }; focusSel(); }
  const s4 = e.target.closest('[data-sksel]'); if (s4) { sel = { kind: 'sketch', id: s4.dataset.sksel }; focusSel(); }
});
$('#objects').addEventListener('change', (e) => { const id = e.target.dataset.oin; if (!id) return; const it = itemOf(id); it.hidden = !e.target.checked; if (it.hidden && sel && sel.id === id) sel = null; commit(); dirty3d = true; });
$('#objSearch').addEventListener('input', (e) => { objQ = e.target.value.trim(); renderObjects(); });
$('#showAll').onclick = () => { P.items.forEach((i) => (i.hidden = false)); commit(); dirty3d = true; };
function focusSel() {
  let p = null;
  if (sel.kind === 'item') { const it = itemOf(sel.id); p = [it.x, it.y]; }
  if (sel.kind === 'wall') { const w = wallOf(sel.id); p = [(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2]; }
  if (sel.kind === 'open') { const g = openingGeom(P.openings.find((o) => o.id === sel.id)); if (g) p = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2]; }
  if (p && view !== '3d') { const r = cv.getBoundingClientRect(); V.ox = r.width / 2 - p[0] * V.s; V.oy = r.height / 2 - p[1] * V.s; }
  if (p && view !== '2d') { goal.tx = p[0]; goal.tz = p[1]; }
  if (isMobile()) closeSheet();
  renderProps(); renderObjects(); draw2d(); need3d = true;
}

/* ---------- 매장 사진 → 도면에 옮기기 ---------- */
let phIdx = 0, phPick = null;
function renderPhotos() {
  P.photos = P.photos || [];
  const ph = P.photos[phIdx];
  $('#phThumbs').innerHTML = P.photos.map((p, i) => `<button class="phth ${i === phIdx ? 'on' : ''}" data-ph="${i}"><img src="${p.src}" alt="사진 ${i + 1}"></button>`).join('') + `<label class="phth add">+ 사진<input type="file" id="phFile" accept="image/*" multiple hidden></label>`;
  $('#phMain').innerHTML = ph ? `<div class="phwrap"><img id="phImg" src="${ph.src}" alt="매장 사진">${(ph.pins || []).map((pn, i) => { const it = itemOf(pn.item); return `<button class="phpin ${it ? '' : 'gone'}" style="left:${pn.x * 100}%;top:${pn.y * 100}%" data-pin="${i}">${it ? esc(spec(it).name) : '삭제됨'}</button>`; }).join('')}${phPick ? `<span class="phpin pending" style="left:${phPick.x * 100}%;top:${phPick.y * 100}%">?</span>` : ''}</div>`
    : '<p class="empty">매장 사진을 올리고, 사진 속 기물을 눌러 무엇인지 고르면 도면에 오브젝트로 들어갑니다.</p>';
  $('#phHint').textContent = phPick ? '이 자리에 있는 기물을 아래에서 고르세요' : ph ? '사진 속 기물을 누르세요 · 핀을 누르면 그 오브젝트를 선택해요' : '';
  $('#phPicker').hidden = !phPick; $('#phAiRow').hidden = !(P.room && ph); if (ph && ph.side) $('#phSide').value = ph.side;
  if (phPick) { const list = libAll().filter((l) => !phPick.q || (l.name + l.cat + (l.tag || '')).includes(phPick.q)).slice(0, 40); $('#phList').innerHTML = list.map((l) => `<button class="chip" data-phl="${l.id}">${esc(l.name)}</button>`).join(''); }
  $('#phFile').addEventListener('change', (e) => addPhotos([...e.target.files]));
}
function addPhotos(files) {
  let left = files.length;
  for (const f of files) { const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 1100 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); P.photos.push({ id: uid('ph'), src: c.toDataURL('image/jpeg', 0.72), pins: [] }); phIdx = P.photos.length - 1; if (!--left) { commit(); renderPhotos(); } }; im.src = rd.result; }; rd.readAsDataURL(f); }
}
$('#phThumbs').addEventListener('click', (e) => { const b = e.target.closest('[data-ph]'); if (b) { phIdx = +b.dataset.ph; phPick = null; renderPhotos(); } });
$('#phMain').addEventListener('click', (e) => {
  const pin = e.target.closest('[data-pin]'); const ph = P.photos[phIdx]; if (!ph) return;
  if (pin) { const pn = ph.pins[+pin.dataset.pin], it = itemOf(pn.item); if (it) { sel = { kind: 'item', id: it.id }; $('#phDlg').close(); focusSel(); } return; }
  const img = $('#phImg'); if (!img || e.target !== img) return; const r = img.getBoundingClientRect();
  phPick = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, q: '' }; renderPhotos(); $('#phQ').value = ''; $('#phQ').focus();
});
$('#phQ').addEventListener('input', (e) => { if (phPick) { phPick.q = e.target.value.trim(); const list = libAll().filter((l) => !phPick.q || (l.name + l.cat + (l.tag || '')).includes(phPick.q)).slice(0, 40); $('#phList').innerHTML = list.map((l) => `<button class="chip" data-phl="${l.id}">${esc(l.name)}</button>`).join(''); } });
$('#phList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-phl]'); if (!b || !phPick) return; const ph = P.photos[phIdx];
  const bb = bounds(), n = ph.pins.length; const wx = bb[0] + 600 + (n % 6) * 900, wy = bb[1] + 800 + Math.floor(n / 6) * 900;
  const L = libGet(b.dataset.phl), it = { id: uid('i'), type: L.id, x: snapGrid(wx), y: snapGrid(wy), w: L.w, d: L.d, rot: 0, note: `사진 ${phIdx + 1}에서` };
  P.items.push(it); ph.pins.push({ x: phPick.x, y: phPick.y, item: it.id }); phPick = null; commit(); dirty3d = true; renderPhotos(); toast(`${L.name}을 도면에 넣었어요 · 도면에서 제자리로 옮기세요`);
});
$('#phCancel').onclick = () => { phPick = null; renderPhotos(); };
$('#phDel').onclick = () => { if (!P.photos[phIdx]) return; P.photos.splice(phIdx, 1); phIdx = Math.max(0, phIdx - 1); commit(); renderPhotos(); };
$('#photoBtn').onclick = () => { phPick = null; renderPhotos(); $('#phDlg').showModal(); };
$('#photoBtn2').onclick = () => { phPick = null; renderPhotos(); $('#phDlg').showModal(); };

/* ---------- 패널 접기 · 옵션 ---------- */
$('#tglLeft').onclick = () => { document.body.classList.toggle('no-left'); store.set('drs_ui', { l: document.body.classList.contains('no-left'), r: document.body.classList.contains('no-right') }); };
$('#tglRight').onclick = () => { document.body.classList.toggle('no-right'); store.set('drs_ui', { l: document.body.classList.contains('no-left'), r: document.body.classList.contains('no-right') }); };
{ const u = store.get('drs_ui', null); if (u) { if (u.l) document.body.classList.add('no-left'); if (u.r) document.body.classList.add('no-right'); } else if (innerWidth < 1280) document.body.classList.add('no-right'); }
renderObjects();

/* ---------- 여러 개 선택에서도 그대로 쓰는 편집 동작 ---------- */
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} };
{ const f0 = setSelColor; setSelColor = (c) => (multi.length > 1 ? withEach(() => f0(c)) : f0(c)); }
{ const f0 = setSelMat; setSelMat = (m) => (multi.length > 1 ? withEach(() => { if (selMat()) f0(m); }) : f0(m)); }
{ const f0 = scaleSel; scaleSel = (f) => (multi.length > 1 ? withEach(() => f0(f)) : f0(f)); }
{ const f0 = rotSel; rotSel = (d) => (multi.length > 1 ? withEach(() => f0(d)) : f0(d)); }
{ const f0 = hideSel; hideSel = () => { if (multi.length > 1) { withEach(() => { if (sel.kind === 'item') itemOf(sel.id).hidden = true; }); multi = []; sel = null; commit(); } else f0(); }; }
{ const f0 = delSel; delSel = () => { if (multi.length > 1) { withEach(() => f0()); multi = []; sel = null; commit(); } else f0(); }; }
function selectAll() { const vs = P.items.filter((i) => !i.hidden && vis[spec(i).layer] !== false).map((i) => ({ kind: 'item', id: i.id })); if (!vs.length) return; multi = vs.length > 1 ? vs : []; sel = vs[vs.length - 1]; dirty3d = true; renderProps(); renderObjects(); draw2d(); toast(`${vs.length}개 선택`); }

/* ---------- 2D 손잡이: 모서리로 크기 · 벽 끝점으로 길이 ---------- */
let HANDLES = [];
function drawHandles() {
  HANDLES = []; if (OFF || !sel || multi.length > 1) return;
  const dot = (sx, sy, sq) => { cx.fillStyle = '#ffffff'; cx.strokeStyle = getCss('--accent'); cx.lineWidth = 2; cx.beginPath(); if (sq) cx.rect(sx - 5, sy - 5, 10, 10); else cx.arc(sx, sy, 6.5, 0, 7); cx.fill(); cx.stroke(); };
  if (sel.kind === 'item') { const it = itemOf(sel.id); if (!it || it.hidden || isPoint(it)) return; corners(it).forEach((p, i) => { const [sx, sy] = toS(...p); dot(sx, sy, true); HANDLES.push({ type: 'corner', i, sx, sy }); }); }
  if (sel.kind === 'wall') { const w = wallOf(sel.id); if (!w) return; [[w.x1, w.y1, 1], [w.x2, w.y2, 2]].forEach(([x, y, k]) => { const [sx, sy] = toS(x, y); dot(sx, sy, false); HANDLES.push({ type: 'wallend', k, sx, sy }); }); }
}
function handleAt(sx, sy, r) { return HANDLES.find((h) => Math.hypot(h.sx - sx, h.sy - sy) < r) || null; }
function dragHandle(d, wx, wy, keepRatio) {
  if (d.kind === 'corner') {
    const it = itemOf(sel.id); if (!it) return; if (!d.F) { d.F = corners(it)[(d.hd.i + 2) % 4]; d.r0 = it.d / it.w; }
    const sg = [[-1, -1], [1, -1], [1, 1], [-1, 1]][d.hd.i], a = (it.rot || 0) * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)];
    const vx = wx - d.F[0], vy = wy - d.F[1]; let w = Math.max(50, Math.round(Math.abs(vx * ux[0] + vy * ux[1]) / 10) * 10), dd = Math.max(50, Math.round(Math.abs(vx * uy[0] + vy * uy[1]) / 10) * 10);
    if (keepRatio) dd = Math.max(50, Math.round(w * d.r0 / 10) * 10);
    it.w = w; it.d = dd; it.x = Math.round(d.F[0] + ux[0] * sg[0] * w / 2 + uy[0] * sg[1] * dd / 2); it.y = Math.round(d.F[1] + ux[1] * sg[0] * w / 2 + uy[1] * sg[1] * dd / 2);
  } else {
    const w = wallOf(sel.id); if (!w) return; const k = d.hd.k;
    if (!d.links) { const ox = k === 1 ? w.x1 : w.x2, oy = k === 1 ? w.y1 : w.y2; d.links = P.walls.filter((o) => o !== w).flatMap((o) => [[o, 1], [o, 2]]).filter(([o, kk]) => Math.abs((kk === 1 ? o.x1 : o.x2) - ox) < 2 && Math.abs((kk === 1 ? o.y1 : o.y2) - oy) < 2); }
    const other = k === 1 ? [w.x2, w.y2] : [w.x1, w.y1]; let p = orthoSnap(other, [snapGrid(wx), snapGrid(wy)]);
    if (k === 1) { w.x1 = p[0]; w.y1 = p[1]; } else { w.x2 = p[0]; w.y2 = p[1]; }
    for (const [o, kk] of d.links) { if (kk === 1) { o.x1 = p[0]; o.y1 = p[1]; } else { o.x2 = p[0]; o.y2 = p[1]; } }
  }
}

/* ---------- 렌더링만 보기 (눈 아이콘) · 가운데로 · 화면 회전 ---------- */
let cleanPrev = null;
function setClean(on) {
  if (on) { cleanPrev = view; document.body.classList.add('clean'); if (view !== '3d') setView('3d'); setBuild(false); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {} }
  else { document.body.classList.remove('clean'); if (cleanPrev) setView(cleanPrev); try { document.fullscreenElement && document.exitFullscreen(); } catch (e) {} }
  setTimeout(() => recenter(600), 120);
}
$('#eyeBtn').onclick = () => setClean(true); $('#eyeExit').onclick = () => setClean(false);
$('#fit3Btn').onclick = () => recenter();
let wasLand = innerWidth > innerHeight;
window.addEventListener('resize', () => { const l = innerWidth > innerHeight; if (l !== wasLand) { wasLand = l; setTimeout(() => recenter(500), 200); } });

/* ---------- 격자 보기 (45cm · 60cm · 1m / 전체 · 벽 · 바닥 · 천장 · 주방) ---------- */
let GRID = store.get('drs_grid', { size: 0, scope: 'all' });
function renderGridMenu() {
  $('#gridMenu').innerHTML = `<div class="lbl">격자 크기</div><div class="seg">${[[0, '끄기'], [450, '45cm'], [600, '60cm'], [1000, '1m']].map(([v, l]) => `<button data-gs="${v}" aria-pressed="${GRID.size === v}">${l}</button>`).join('')}</div>
    <div class="lbl">어디에</div><div class="qmats">${[['all', '전체'], ['wall', '벽'], ['floor', '바닥'], ['ceil', '천장'], ['kitchen', '주방']].map(([v, l]) => `<button class="chip ${GRID.scope === v ? 'on' : ''}" data-gsc="${v}">${l}</button>`).join('')}</div>`;
  $('#gridBtn').setAttribute('aria-pressed', GRID.size > 0);
}
function setGrid(p) { GRID = { ...GRID, ...p }; store.set('drs_grid', GRID); renderGridMenu(); dirty3d = true; draw2d(); }
$('#gridMenu').addEventListener('click', (e) => { const s = e.target.closest('[data-gs]'), c = e.target.closest('[data-gsc]'); if (s) setGrid({ size: +s.dataset.gs }); if (c) setGrid({ scope: c.dataset.gsc, size: GRID.size || 600 }); });
{ const wrap = $('#gridWrap'); let t = 0; const open = (on) => { clearTimeout(t); $('#gridMenu').hidden = !on; };
  $('#gridBtn').onclick = () => open($('#gridMenu').hidden);
  wrap.addEventListener('mouseenter', (e) => { if (!isMobile()) open(true); }); wrap.addEventListener('mouseleave', () => { if (!isMobile()) t = setTimeout(() => open(false), 250); });
  document.addEventListener('pointerdown', (e) => { if (!wrap.contains(e.target)) open(false); }); renderGridMenu(); }
function kitchenBounds() { const k = P.items.filter((i) => !i.hidden && libGet(i.type).cat === '주방'); return k.length ? aabb(k.flatMap(corners)) : null; }
function gridRegion() { return GRID.scope === 'kitchen' ? kitchenBounds() : bounds(); }
function drawGrid2d() {
  if (!GRID.size || OFF) return; const g = GRID.size; cx.save(); cx.strokeStyle = 'rgba(10,132,255,.38)'; cx.lineWidth = 1;
  if (GRID.scope === 'wall') { for (const w of P.walls) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, n = [-uy, ux], tk = 220; for (let s = 0; s <= L + 1; s += g) { const p = [w.x1 + ux * s, w.y1 + uy * s]; cx.beginPath(); cx.moveTo(...toS(p[0] - n[0] * tk, p[1] - n[1] * tk)); cx.lineTo(...toS(p[0] + n[0] * tk, p[1] + n[1] * tk)); cx.stroke(); } } }
  else { const b = gridRegion(); if (b) { for (let x = b[0]; x <= b[2] + 1; x += g) { cx.beginPath(); cx.moveTo(...toS(x, b[1])); cx.lineTo(...toS(x, b[3])); cx.stroke(); } for (let y = b[1]; y <= b[3] + 1; y += g) { cx.beginPath(); cx.moveTo(...toS(b[0], y)); cx.lineTo(...toS(b[2], y)); cx.stroke(); } } }
  cx.restore(); const r = cv.getBoundingClientRect(); tag(r.width - 120, r.height - 12, `격자 ${g >= 1000 ? g / 1000 + 'm' : g / 10 + 'cm'}`);
}
function buildGrid3d() {
  if (!GRID.size) return; const g = GRID.size, C = '#0a84ff', A = 0.5, T0 = xf(0, 0, 0), th = 7;
  const plane = (b, y) => { for (let x = b[0]; x <= b[2] + 1; x += g) box(T0, x - th, x + th, y, y + 3, b[1], b[3], C, 'plain', A); for (let z = b[1]; z <= b[3] + 1; z += g) box(T0, b[0], b[2], y, y + 3, z - th, z + th, C, 'plain', A); };
  if (GRID.scope === 'all' || GRID.scope === 'floor') plane(bounds(), 3);
  if (GRID.scope === 'kitchen') { const k = kitchenBounds(); if (k) plane(k, 3); }
  if (GRID.scope === 'ceil') plane(bounds(), P.ceilingH - 8);
  if (GRID.scope === 'all' || GRID.scope === 'wall') for (const w of P.walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 1) continue; const T = xf(w.x1, w.y1, Math.atan2(w.y2 - w.y1, w.x2 - w.x1)), Hh = cam.cut ? Math.min(1200, wallH(w)) : wallH(w), t = wallT(w) / 2 + 3;
    for (const z of [-t, t]) { for (let s = 0; s <= L + 1; s += g) box(T, s - th, s + th, 0, Hh, z - 2, z + 2, C, 'plain', A); for (let y = g; y < Hh; y += g) box(T, 0, L, y - th, y + th, z - 2, z + 2, C, 'plain', A); }
  }
}

/* ---------- 문 · 창 도면 기호 (끌어서 벽에 놓기) ---------- */
const OPLIB = ['door1', 'door2', 'slide', 'auto', 'window', 'full', 'pass', 'slidepass', 'arch'];
function opSvg(t) {
  const W = '<path d="M2 30h8M30 30h8" stroke-width="3"/>';
  const s = { door1: '<path d="M10 30V10"/><path d="M10 10a20 20 0 0 1 20 20" stroke-dasharray="3 3"/>', door2: '<path d="M10 30V20M30 30V20"/><path d="M10 20a10 10 0 0 1 10 10M30 20a10 10 0 0 0-10 10" stroke-dasharray="3 3"/>',
    slide: '<path d="M8 28h16M16 32h16"/>', auto: '<path d="M8 28h14M18 32h14"/><path d="M12 24l-3 4 3 4M28 24l3 4-3 4"/>', window: '<path d="M10 28h20M10 32h20"/>', full: '<path d="M10 27h20M10 30h20M10 33h20"/>',
    pass: '<path d="M10 30h20" stroke-dasharray="3 3"/><rect x="10" y="24" width="20" height="12"/>', slidepass: '<path d="M10 28h12M18 32h12"/><rect x="10" y="22" width="20" height="16" stroke-dasharray="2 3"/>', arch: '<path d="M10 30a10 10 0 0 1 20 0" /><path d="M10 34h20" stroke-dasharray="3 3"/>' }[t];
  return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${W}${s}</svg>`;
}
function insertOpening(type, w, along) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), [ow, oh, os] = OPDEF[type]; if (ow > L) { toast('벽이 짧아요'); return; }
  const o = { id: uid('o'), wall: w.id, t: Math.round(clamp(along, ow / 2, L - ow / 2)), type, w: ow, h: oh, sill: os, frame: '#2b2d31', fw: std().frameW };
  P.openings.push(o); multi = []; sel = { kind: 'open', id: o.id }; qTab = 'size'; commit(); toast(`${OPENTYPES[type]} 넣었어요`);
}
function nearestWall(wx, wy, max = 900) { let best = null; for (const w of P.walls) { const [d, t] = distPtSeg(wx, wy, w); if (d < max && (!best || d < best.d)) best = { d, w, along: t * Math.hypot(w.x2 - w.x1, w.y2 - w.y1) }; } return best; }
function opPointerDown(e, type) {
  const touch = e.pointerType === 'touch'; if (!touch) e.preventDefault();
  const start = [e.clientX, e.clientY]; let moved = false, armed = !touch, aborted = false, gh = null;
  const begin = (x, y) => { moved = true; libDragging = true; gh = document.createElement('div'); gh.className = 'ghost'; gh.textContent = OPENTYPES[type] + ' · 벽에 놓기'; gh.style.left = x + 'px'; gh.style.top = y + 'px'; document.body.appendChild(gh); if (isMobile()) closeSheet(); };
  const timer = touch ? setTimeout(() => { if (!aborted) { armed = true; begin(start[0], start[1]); } }, 380) : 0;
  const mv = (ev) => { const far = Math.hypot(ev.clientX - start[0], ev.clientY - start[1]) > 8; if (!armed) { if (far) { aborted = true; clearTimeout(timer); } return; } if (!moved && far) begin(ev.clientX, ev.clientY); if (gh) { gh.style.left = ev.clientX + 'px'; gh.style.top = ev.clientY + 'px'; } };
  const up = (ev) => {
    clearTimeout(timer); libDragging = false; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (gh) gh.remove(); if (aborted) return;
    const r = cv.getBoundingClientRect(), r3 = gc.getBoundingClientRect(), in2 = view !== '3d' && ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom, in3 = view !== '2d' && ev.clientX > r3.left && ev.clientX < r3.right && ev.clientY > r3.top && ev.clientY < r3.bottom;
    if (moved && in2) { const [wx, wy] = toW(ev.clientX - r.left, ev.clientY - r.top), nw = nearestWall(wx, wy); if (nw) insertOpening(type, nw.w, nw.along); else toast('벽 가까이에 놓아 주세요'); }
    else if (moved && in3) { const h = rayHit(ev); const wid = h && (h.sel.kind === 'wall' ? h.sel.id : h.sel.kind === 'open' ? (P.openings.find((o) => o.id === h.sel.id) || {}).wall : null); if (wid) insertOpening(type, wallOf(wid), h.sel.kind === 'wall' ? h.along : P.openings.find((o) => o.id === h.sel.id).t + 1200); else toast('벽 위에 놓아 주세요'); }
    else if (!moved) {
      if (sel && sel.kind === 'wall') { const w = wallOf(sel.id), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); insertOpening(type, w, lastHit && lastHit.sel && lastHit.sel.id === w.id && lastHit.along != null ? lastHit.along : L / 2); if (isMobile()) closeSheet(); }
      else toast('끌어서 벽에 놓거나, 벽을 먼저 길게 눌러 선택하세요');
    }
  };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}

/* ---------- 실측 + 사방 사진 → AI가 기물 찾아 넣기 ---------- */
const SIDE_N = { N: '북쪽 벽', E: '동쪽 벽', S: '남쪽 벽', W: '서쪽 벽' };
const AI_TYPES = ['fridge45', 'fridge25', 'tfridge', 'work', 'work2', 'sink1', 'sink2', 'fryer1', 'fryer2', 'fryer4', 'range', 'range3', 'dishwasher', 'icemaker', 'holding', 'rack', 'tank', 'hood', 'shelf', 'uppercab', 'showcase', 't2', 't4', 't6', 'tround', 'tbar', 'counter', 'chair', 'stool', 'barchair', 'bench', 'banquette', 'lounge', 'column', 'partition', 'glasspart', 'tv', 'ac_wall', 'ac_cassette', 'ac_stand', 'wallvent', 'pendant', 'frame', 'monstera', 'olive', 'planterbox', 'panel'];
let _smp; async function getSample() { if (_smp !== undefined) return _smp; try { _smp = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { _smp = null; } return _smp; }
function shrinkImg(src, max = 1280) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob((b) => res({ blob: b, url: c.toDataURL('image/jpeg', 0.72) }), 'image/jpeg', 0.85); }; im.onerror = rej; im.src = src; }); }
const fileURL = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
function aiPrompt(side) {
  const { W, D } = P.room, H = P.ceilingH, L = side === 'N' || side === 'S' ? W : D;
  const lr = { N: ['서쪽(왼쪽) 모서리', '동쪽(오른쪽) 모서리'], E: ['북쪽 모서리', '남쪽 모서리'], S: ['동쪽 모서리', '서쪽 모서리'], W: ['남쪽 모서리', '북쪽 모서리'] }[side];
  const types = AI_TYPES.map((t) => `${t}(${libGet(t).name})`).concat(OPLIB.map((t) => `${t}(${OPENTYPES[t]})`)).join(', ');
  return `You are reading one interior photo of a restaurant/kitchen to place objects on a floor plan.
The room is ${W} mm wide (west to east) and ${D} mm deep (north to south); ceiling ${H} mm.
The photo was taken from inside the room looking at the ${{ N: 'north', E: 'east', S: 'south', W: 'west' }[side]} wall, which is ${L} mm long. The photo's left edge is the ${lr[0]} and the right edge is the ${lr[1]} of that wall.
List every distinct physical object you can see, one entry per object (three tables = three entries). Use ONLY these type ids: ${types}.
For each object give: "type" (one id from the list), "x0" and "x1" (left and right edge of the object across the photo, as fractions 0 to 1), "dist" (estimated distance in mm from the facing wall to the object's centre; 0 if it is on or built into that wall), "on_wall" (true if mounted on or built into the facing wall), "w" and "h" (estimated width and height in mm, or null), "sill" (for windows and pass-throughs, height of the bottom edge above the floor in mm, else null), "elev" (for wall-mounted things, height of the bottom edge above the floor in mm, else null).
Answer with JSON only, exactly in this shape: {"objects":[{"type":"","x0":0,"x1":0,"dist":0,"on_wall":false,"w":null,"h":null,"sill":null,"elev":null}]}`;
}
async function askVision(prompt, blob) {
  const s = await getSample();
  if (s) { const lim = await s.limits().catch(() => null); if (lim && lim.images) return await s.json(prompt, { images: [blob], modelTier: 'default' }); }
  const key = SYNC.cfg.aiKey || BUILT.anthropicKey;
  if (key) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: BUILT.aiModel || 'claude-sonnet-5-5', max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobB64(blob) } }, { type: 'text', text: prompt }] }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || 'AI 응답 ' + r.status);
    const t = (j.content || []).map((c) => c.text || '').join(''); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  }
  throw new Error('AI 인식을 쓸 수 없어요. Claude 안에서 열거나, 설치형 앱의 계정 창에 AI 키를 넣어 주세요.');
}
function placeDetected(side, objs) {
  const { W, D } = P.room, L = side === 'N' || side === 'S' ? W : D, depth = side === 'N' || side === 'S' ? D : W, wall = P.walls[{ N: 0, E: 1, S: 2, W: 3 }[side]]; let n = 0;
  for (const o of objs || []) {
    const type = String(o.type || ''), x0 = clamp(+o.x0 || 0, 0, 1), x1 = clamp(+o.x1 || x0, 0, 1), along = (x0 + x1) / 2 * L, span = Math.max(100, Math.abs(x1 - x0) * L);
    if (OPDEF[type]) { if (!wall) continue; const [ow, oh, os] = OPDEF[type], w = Math.round(clamp(+o.w || span || ow, 400, L)); P.openings.push({ id: uid('o'), wall: wall.id, t: Math.round(clamp(along, w / 2, L - w / 2)), type, w, h: Math.round(+o.h || oh), sill: Math.round(o.sill != null ? +o.sill : os), frame: '#2b2d31', fw: std().frameW }); n++; continue; }
    if (!AI_TYPES.includes(type)) continue;
    const Lb = libGet(type), sz = libSize(type), w = Math.round(clamp(+o.w || span || sz.w, 100, 9000)), d = sz.d;
    const dist = o.on_wall ? d / 2 + 1 : clamp(+o.dist || d / 2, d / 2, depth - d / 2);
    const pos = { N: [along, dist, 0], E: [W - dist, along, 90], S: [W - along, D - dist, 180], W: [dist, D - along, 270] }[side];
    const it = { id: uid('i'), type, x: Math.round(pos[0]), y: Math.round(pos[1]), w, d, rot: pos[2], note: `AI · ${SIDE_N[side]} 사진` };
    if (o.h && !['mark', 'plant'].includes(Lb.shape)) it.h = Math.round(clamp(+o.h, 50, P.ceilingH));
    if (o.on_wall && o.elev != null && Lb.layer !== 'floor') it.elev = Math.round(+o.elev);
    P.items.push(it); n++;
  }
  return n;
}
function aiLog(t, cls) { const li = document.createElement('li'); li.textContent = t; if (cls) li.className = cls; $('#aiLog').appendChild(li); return li; }
async function aiPopulate(photos) {
  $('#aiLog').innerHTML = ''; $('#aiDlg').showModal(); let total = 0;
  for (const side of ['N', 'E', 'S', 'W']) {
    const f = photos[side]; if (!f) continue; const li = aiLog(`${SIDE_N[side]} 사진 읽는 중…`);
    try {
      const sm = await shrinkImg(await fileURL(f)); P.photos.push({ id: uid('ph'), src: sm.url, pins: [], side });
      const res = await askVision(aiPrompt(side), sm.blob), n = placeDetected(side, res && res.objects); total += n;
      li.textContent = `${SIDE_N[side]}: ${n}개 넣음`; commit();
    } catch (e) { li.textContent = `${SIDE_N[side]}: ${e && e.code === 'not_granted' ? '허용하지 않아 건너뛰었어요' : e && e.code === 'rate_limited' ? '요청이 많아요 · 잠시 뒤 다시' : (e && e.message) || '읽지 못했어요'}`; li.className = 'err'; }
  }
  aiLog(total ? `모두 ${total}개를 넣었어요. 빨간 빗금은 겹친 곳이니 옮겨 주세요. 같은 물건이 두 사진에 찍혔다면 하나를 지우세요.` : '찾은 물건이 없어요.', 'sum');
  commit(); recenter();
}
$('#phAi').onclick = async () => {
  const ph = P.photos[phIdx]; if (!ph || !P.room) return; const side = $('#phSide').value; $('#phDlg').close(); $('#aiLog').innerHTML = ''; $('#aiDlg').showModal(); const li = aiLog(`${SIDE_N[side]} 사진 읽는 중…`);
  try { const sm = await shrinkImg(ph.src); const res = await askVision(aiPrompt(side), sm.blob), n = placeDetected(side, res && res.objects); li.textContent = `${SIDE_N[side]}: ${n}개 넣음`; commit(); }
  catch (e) { li.textContent = (e && e.message) || '읽지 못했어요'; li.className = 'err'; }
};
$('#sAi').addEventListener('change', (e) => { SYNC.cfg.aiKey = e.target.value.trim(); saveSyncCfg(); });
$$('input[name="start"]').forEach((r) => r.addEventListener('change', () => { $('#photoStart').hidden = !$('input[name="start"][value="photos"]').checked; }));
$$('#photoStart input[type=file]').forEach((inp) => inp.addEventListener('change', async () => { const f = inp.files[0], lab = inp.closest('label'); if (f) { lab.style.backgroundImage = `url(${await fileURL(f)})`; lab.classList.add('has'); } }));

/* 입력하는 즉시 반영 (숫자 · 글자) */
{ let liveT = 0; for (const host of ['#props', '#quick']) $(host).addEventListener('input', (e) => { const t = e.target; if (t.tagName !== 'INPUT' || !/number|text/.test(t.type) || t.type === 'range') return; if (t.type === 'number' && (t.value === '' || isNaN(+t.value) || +t.value <= 0) && !/^[XY]$|^p[XYE]$|^pR$|^qRotV$/.test(t.id)) return; clearTimeout(liveT); liveT = setTimeout(() => t.dispatchEvent(new Event('change', { bubbles: true })), 260); }); }

/* ---------- 벽 나누기 (작은 떠 있는 아이콘 · 길게 누르기) ---------- */
let lastPtr = { x: 0, y: 0 };
window.addEventListener('pointerdown', (e) => { lastPtr = { x: e.clientX, y: e.clientY }; }, true);
function updFab() {
  const f = $('#splitFab'), show = sel && sel.kind === 'wall' && multi.length < 2 && !document.body.classList.contains('clean') && !document.body.classList.contains('show') && !build3d;
  f.hidden = !show; if (!show) { $('#splitPop').hidden = true; return; }
  f.style.left = clamp(lastPtr.x + 16, 8, innerWidth - 44) + 'px'; f.style.top = clamp(lastPtr.y - 40, 8, innerHeight - 44) + 'px';
}
function openSplit() {
  const w = wallOf(sel.id); if (!w) return; const L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)), at = lastHit && lastHit.sel && lastHit.sel.id === w.id && lastHit.along != null ? Math.round(lastHit.along) : Math.round(L / 2);
  const p = $('#splitPop'); $('#spLen').textContent = `길이 ${L.toLocaleString()} mm`; $('#spAt').value = at; p.hidden = false;
  const fr = $('#splitFab').getBoundingClientRect(); p.style.left = clamp(fr.left, 8, innerWidth - 280) + 'px'; p.style.top = clamp(fr.bottom + 6, 8, innerHeight - 200) + 'px';
}
function splitWall(w, cuts) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); cuts = [...new Set(cuts.map((c) => Math.round(c)))].filter((c) => c > 30 && c < L - 30).sort((x, y) => x - y);
  if (!cuts.length) { toast('나눌 위치가 벽 끝과 너무 가까워요'); return; }
  const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, pts = [0, ...cuts, L], made = [];
  for (let i = 1; i < pts.length; i++) { const s0 = pts[i - 1], s1 = pts[i], nw = { ...JSON.parse(JSON.stringify(w)), id: uid('w'), x1: Math.round(w.x1 + ux * s0), y1: Math.round(w.y1 + uy * s0), x2: Math.round(w.x1 + ux * s1), y2: Math.round(w.y1 + uy * s1) }; made.push([nw, s0, s1]); }
  for (const o of P.openings.filter((o) => o.wall === w.id)) { const sg = made.find(([, s0, s1]) => o.t >= s0 && o.t <= s1) || made[0]; o.wall = sg[0].id; o.t = o.t - sg[1]; }
  P.walls.splice(P.walls.indexOf(w), 1, ...made.map((m) => m[0]));
  multi = []; sel = { kind: 'wall', id: made[0][0].id }; $('#splitPop').hidden = true; commit(); toast(`벽을 ${made.length}개로 나눴어요 · 각각 따로 고칠 수 있어요`);
}
$('#splitFab').onclick = () => ($('#splitPop').hidden ? openSplit() : ($('#splitPop').hidden = true));
$('#splitPop').addEventListener('click', (e) => {
  const w = sel && wallOf(sel.id); if (!w) return; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  const n = e.target.closest('[data-spn]'); if (n) { const k = +n.dataset.spn; splitWall(w, Array.from({ length: k - 1 }, (_, i) => L * (i + 1) / k)); }
  if (e.target.id === 'spRatio') { const r = $('#spRatio2').value.split(/[:\s,]+/).map(Number).filter((x) => x > 0); if (r.length < 2) { toast('비율을 1:2:1 처럼 넣어 주세요'); return; } const sum = r.reduce((s, x) => s + x, 0); let acc = 0; splitWall(w, r.slice(0, -1).map((x) => (acc += x) / sum * L)); }
  if (e.target.id === 'spAtGo') splitWall(w, [+$('#spAt').value]);
  if (e.target.id === 'spX') $('#splitPop').hidden = true;
});

/* ---------- 레이어: 체크 = 보이기, 이름 = 그 레이어만 진하게 ---------- */
function layerCount(id) { return P.items.filter((i) => spec(i).layer === id).length + P.lines.filter((x) => LINEKINDS[x.kind].layer === id).length; }
renderLayers = function () {
  $('#layers').innerHTML = LAYERS.map((l) => {
    const fx = l.fixed, op = l.id === 'ceiling' ? (P.ceiling && P.ceiling.on ? `<input type="range" class="lop" data-lop="ceiling" min="0.05" max="1" step="0.05" value="${P.ceiling.opacity ?? 0.45}" aria-label="천장 불투명도" title="불투명도">` : '<small class="muted">설정 전</small>') : l.id === 'floorL' ? `<input type="range" class="lop" data-lop="floorL" min="0.05" max="1" step="0.05" value="${P.floorOpacity ?? 1}" aria-label="바닥 불투명도" title="불투명도">` : '';
    return `<div class="lay ${FOCUS === l.id ? 'focus' : ''} ${FOCUS && FOCUS !== l.id ? 'dim' : ''}"><input type="checkbox" data-lay="${l.id}" ${vis[l.id] !== false ? 'checked' : ''} aria-label="${l.name} 보이기"><span class="sq" style="background:${l.color}"></span><button class="lname" data-lf="${l.id}" title="이 레이어만 진하게 보기">${l.name}</button>${op}<small>${fx ? '' : layerCount(l.id)}</small>${fx ? `<button class="lplus" data-lp="${l.id}" aria-label="${l.name} 도구">+</button>` : ''}</div>`;
  }).join('') + (FOCUS ? '<button class="btn" id="lfClear" style="margin-top:6px">모든 레이어 진하게</button>' : '');
};
function setFocus(id) { FOCUS = FOCUS === id ? null : id; renderLayers(); dirty3d = true; draw2d(); if (FOCUS === 'floorL') { libCat = '바닥·배관'; renderLib(); } if (FOCUS === 'ceiling') { libCat = '천장 설비'; renderLib(); } }
$('#layers').addEventListener('click', (e) => { const f = e.target.closest('[data-lf]'); if (f) setFocus(f.dataset.lf); const p = e.target.closest('[data-lp]'); if (p) openLayerPop(p.dataset.lp, p); if (e.target.id === 'lfClear') setFocus(FOCUS); });
$('#layers').addEventListener('input', (e) => { const o = e.target.dataset.lop; if (!o) return; if (o === 'ceiling') P.ceiling.opacity = +e.target.value; else P.floorOpacity = +e.target.value; dirty3d = true; });
$('#layers').addEventListener('change', (e) => { if (e.target.dataset.lop) commit(); });
function openLayerPop(id, btn) {
  const p = $('#layerPop'), MATSEL = `<select id="lpMat"><option value="">기본</option>${Object.entries(PIPEMAT).map(([k, v]) => `<option value="${k}" ${lineOpts.mat === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>`;
  if (id === 'floorL') p.innerHTML = `<b>바닥 · 매립</b><p class="qk">미장 전 바닥에 묻히는 배관 · 케이블을 그려요</p>
    <div class="qmats">${['embDrain', 'embWater', 'embConduit', 'embCable', 'embGas'].map((k) => `<button class="chip ${lineKind === k ? 'on' : ''}" data-lk2="${k}">${LINEKINDS[k].name}</button>`).join('')}</div>
    <div class="qrow"><label class="qf"><span>깊이</span><input id="lpDepth" type="number" value="${lineOpts.depth}"></label><label class="qf"><span>굵기 φ</span><input id="lpDia" type="number" value="${lineOpts.dia || 50}"></label></div>
    <div class="qrow"><label class="qf"><span>재질</span>${MATSEL}</label></div>
    <div class="qrow"><label class="qf"><span>바닥 불투명도</span><input id="lpFloorOp" type="range" min="0.05" max="1" step="0.05" value="${P.floorOpacity ?? 1}"></label></div>
    <div class="qrow"><button class="qb on" id="lpDraw">그리기 시작</button><button class="qb" id="lpClose">닫기</button></div><p class="qk">그린 뒤 선을 누르면 길이 · 깊이 · 굵기를 숫자로 고칠 수 있어요</p>`;
  else p.innerHTML = `<b>천장</b>${P.ceiling.on ? '' : '<p class="qk">천장 높이를 넣으면 천장이 생겨요</p>'}
    <div class="qrow"><label class="qf"><span>천장 높이</span><input id="lpCeilH" type="number" value="${P.ceilingH}"></label><label class="qf"><span>슬래브</span><input id="lpSlab" type="number" value="${P.slabH}"></label><button class="qb ${P.ceiling.on ? '' : 'on'}" id="lpCeilOn">${P.ceiling.on ? '적용' : '천장 만들기'}</button></div>
    ${P.ceiling.on ? `<div class="qrow"><label class="qf"><span>불투명도</span><input id="lpCeilOp" type="range" min="0.05" max="1" step="0.05" value="${P.ceiling.opacity ?? 0.45}"></label><button class="qb danger" id="lpCeilOff">천장 없애기</button></div>` : ''}
    <div class="lbl">천장 속 작업</div>
    <div class="qmats"><button class="chip" data-pl="anchor">앵커볼트</button><button class="chip" data-pl="hanger">행거볼트</button>${['cFrame', 'cPipe', 'cWire'].map((k) => `<button class="chip ${lineKind === k ? 'on' : ''}" data-lk2="${k}">${LINEKINDS[k].name}</button>`).join('')}</div>
    <div class="qrow"><label class="qf"><span>천장에서 거리</span><input id="lpOff" type="number" value="${lineOpts.off}"></label><label class="qf"><span>굵기 φ</span><input id="lpDia" type="number" value="${lineOpts.dia || 50}"></label></div>
    <div class="qrow"><label class="qf"><span>재질</span>${MATSEL}</label></div>
    <div class="qrow"><button class="qb on" id="lpDraw">선 그리기 시작</button><button class="qb" id="lpLevel">＋ 층 추가</button><button class="qb" id="lpClose">닫기</button></div>`;
  p.hidden = false; const r = btn.getBoundingClientRect(); p.style.top = clamp(r.top, 8, innerHeight - 380) + 'px'; p.style.left = clamp(r.left - 330, 8, innerWidth - 340) + 'px';
  const v = (i) => $('#' + i);
  const save = () => { if (v('lpDepth')) lineOpts.depth = +v('lpDepth').value || 80; if (v('lpDia')) lineOpts.dia = +v('lpDia').value || 0; if (v('lpOff')) lineOpts.off = +v('lpOff').value || 300; lineOpts.mat = v('lpMat').value; store.set('drs_lopt', lineOpts); };
  $$('[data-lk2]', p).forEach((b) => (b.onclick = () => { lineKind = b.dataset.lk2; $$('[data-lk2]', p).forEach((x) => x.classList.toggle('on', x === b)); }));
  $$('[data-pl]', p).forEach((b) => (b.onclick = () => { const b0 = bounds(); placeItem(b.dataset.pl, view === '3d' ? cam.tx : (b0[0] + b0[2]) / 2, view === '3d' ? cam.tz : (b0[1] + b0[3]) / 2); p.hidden = true; toast('놓은 뒤 이동 ON으로 위치를 잡으세요'); }));
  if (v('lpDraw')) v('lpDraw').onclick = () => { save(); if (!LINEKINDS[lineKind] || LINEKINDS[lineKind].layer !== id) lineKind = id === 'floorL' ? 'embDrain' : 'cPipe'; p.hidden = true; if (!FOCUS || FOCUS !== id) setFocus(id); if (view === '3d') { b3Target = 'line'; } setTool('line'); $('#lkSel').value = lineKind; };
  if (v('lpFloorOp')) v('lpFloorOp').oninput = (e) => { P.floorOpacity = +e.target.value; dirty3d = true; };
  if (v('lpCeilOp')) v('lpCeilOp').oninput = (e) => { P.ceiling.opacity = +e.target.value; dirty3d = true; };
  if (v('lpCeilOn')) v('lpCeilOn').onclick = () => { P.ceilingH = +v('lpCeilH').value || P.ceilingH; P.slabH = Math.max(P.ceilingH + 100, +v('lpSlab').value || P.slabH); P.ceiling.on = true; vis.ceiling = true; commit(); openLayerPop(id, btn); };
  if (v('lpCeilOff')) v('lpCeilOff').onclick = () => { P.ceiling.on = false; commit(); p.hidden = true; };
  if (v('lpLevel')) v('lpLevel').onclick = () => { p.hidden = true; openLevelDlg(); };
  v('lpClose').onclick = () => { save(); p.hidden = true; };
  ['lpDepth', 'lpDia', 'lpOff', 'lpMat'].forEach((i) => v(i) && v(i).addEventListener('change', save));
}

/* ---------- 층 · 연결된 프로젝트 ---------- */
function renderLevels() {
  ensureLevels(); const L = curLevel(), n = P.levels.length;
  $('#lvlBtn').innerHTML = `${esc(L.name)} <span class="tri">▾</span>${n > 1 ? `<span class="lbadge">연결 ${n}</span>` : ''}`;
  $('#lvlMenu').innerHTML = `<div class="lbl">층 · 연결된 공간</div>${P.levels.map((l) => `<div class="lvrow ${l.id === P.levelId ? 'on' : ''}"><button class="lvgo" data-lv="${l.id}">${esc(l.name)}</button><small>${((l.elev || 0) / 1000).toFixed(1)}m</small><button class="qb" data-lvren="${l.id}" aria-label="${esc(l.name)} 이름 바꾸기">✎</button>${n > 1 ? `<button class="qb danger" data-lvdel="${l.id}" aria-label="${esc(l.name)} 지우기">✕</button>` : ''}</div>`).join('')}
    <button class="btn pri" id="lvAdd">+ 층 · 공간 추가</button>
    ${n > 1 ? `<label class="chk"><input type="checkbox" id="lvShow" ${P.showLinked !== false ? 'checked' : ''}> 연결된 층 3D에 함께 보기</label><label class="chk"><input type="checkbox" id="lvExp" ${P.exportLinked !== false ? 'checked' : ''}> 내보낼 때 함께 내보내기</label>` : ''}`;
}
$('#lvlBtn').onclick = (e) => { e.stopPropagation(); renderLevels(); $('#lvlMenu').hidden = !$('#lvlMenu').hidden; };
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#lvlWrap')) $('#lvlMenu').hidden = true; if (!e.target.closest('#layerPop') && !e.target.closest('[data-lp]')) $('#layerPop').hidden = true; if (!e.target.closest('#splitPop') && !e.target.closest('#splitFab')) $('#splitPop').hidden = true; });
$('#lvlMenu').addEventListener('click', (e) => {
  const g = e.target.closest('[data-lv]'), rn = e.target.closest('[data-lvren]'), dl = e.target.closest('[data-lvdel]');
  if (g) { $('#lvlMenu').hidden = true; switchLevel(g.dataset.lv); }
  if (rn) { const l = P.levels.find((x) => x.id === rn.dataset.lvren), row = rn.closest('.lvrow'); row.innerHTML = `<input class="search" id="lvName" value="${esc(l.name)}" aria-label="층 이름"><button class="qb on" id="lvNameOk">확인</button>`; const inp = $('#lvName'); inp.focus(); inp.select(); const ok = () => { l.name = inp.value.trim() || l.name; commit(); renderLevels(); }; $('#lvNameOk').onclick = ok; inp.onkeydown = (ev) => { if (ev.key === 'Enter') ok(); }; }
  if (dl) { if (dl.dataset.ok) { const id = dl.dataset.lvdel; if (id === P.levelId) switchLevel(P.levels.find((x) => x.id !== id).id); P.levels = P.levels.filter((x) => x.id !== id); commit(); renderLevels(); } else { dl.dataset.ok = 1; dl.textContent = '지울까요?'; } }
  if (e.target.id === 'lvAdd') { $('#lvlMenu').hidden = true; openLevelDlg(); }
});
$('#lvlMenu').addEventListener('change', (e) => { if (e.target.id === 'lvShow') { P.showLinked = e.target.checked; commit(); } if (e.target.id === 'lvExp') { P.exportLinked = e.target.checked; commit(); } });
let lvPlan = null;
function openLevelDlg() {
  ensureLevels(); const top = [...P.levels].sort((x, y) => (y.elev || 0) - (x.elev || 0))[0];
  $('#lvStep1').hidden = false; $('#lvStep2').hidden = true; lvPlan = null; $('#lvNm').value = `${P.levels.length + 1}층`; $('#lvH').value = 3300;
  $('#lvFloorMat').innerHTML = Object.entries(matOpts).map(([k, v]) => `<option value="${k}" ${k === 'epoxy' ? 'selected' : ''}>${v}</option>`).join('');
  $('#lvBase').textContent = `${top.name} 위에 얹어요`; $('#levelDlg').showModal();
}
$('#lvNoPlan').onclick = () => { $('#lvStep1').hidden = true; $('#lvStep2').hidden = false; $('#lvPlanRow').hidden = true; $('#lvWalls').value = 'none'; };
$('#lvPlanFile').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; lvPlan = await fileURL(f); $('#lvStep1').hidden = true; $('#lvStep2').hidden = false; $('#lvPlanRow').hidden = false; $('#lvPlanPrev').src = lvPlan; });
$('#lvGo').onclick = async () => {
  const top = [...P.levels].sort((x, y) => (y.elev || 0) - (x.elev || 0))[0], topData = top.id === P.levelId ? levelPick() : top.data;
  const h = Math.max(2000, +$('#lvH').value || 3300), withWalls = $('#lvWalls').value === 'outer';
  let walls = [];
  if (withWalls) walls = (top.id === P.levelId ? exteriorWalls() : withLevel(top, () => exteriorWalls())).map((w) => ({ ...JSON.parse(JSON.stringify(w)), id: uid('w'), h: undefined }));
  const b = top.id === P.levelId ? bounds() : withLevel(top, () => bounds());
  const id = uid('L'), nl = { id, name: $('#lvNm').value.trim() || `${P.levels.length + 1}층`, elev: (top.elev || 0) + (topData.slabH || 3300), data: {
    walls, openings: [], items: [], lines: [], sketches: [], photos: [], scenes: [], ceilingH: h - 600, soffitH: h - 900, slabH: h,
    floor: { type: $('#lvFloorMat').value, color: '#c9c3b8' }, ceiling: { on: false, opacity: 0.45, color: '#f4f2ee' }, floorOpacity: 1, room: null,
    bg: lvPlan ? { src: lvPlan, wmm: Math.round(b[2] - b[0]) || 10000, x: b[0], y: b[1], opacity: 0.5 } : null,
    _footprint: walls.length ? null : b } };
  if (!walls.length) { const [x0, y0, x1, y1] = b; nl.data.items.push({ id: uid('i'), type: 'zone', x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2), w: Math.round(x1 - x0), d: Math.round(y1 - y0), rot: 0, tag: '바닥판', finish: { type: $('#lvFloorMat').value, color: '#c9c3b8' } }); }
  P.levels.push(nl); $('#levelDlg').close(); switchLevel(id); P.showLinked = true;
  if (lvPlan && $('#lvAiWalls').checked) aiWallsFromPlan(lvPlan, b);
  else if (lvPlan) toast('도면이 배경에 깔렸어요 · 벽 도구로 따라 그리세요');
};
async function aiWallsFromPlan(src, b) {
  $('#aiLog').innerHTML = ''; $('#aiDlg').showModal(); const li = aiLog('도면에서 벽을 읽는 중…');
  try { const sm = await shrinkImg(src, 1600), W = Math.round(b[2] - b[0]), D = Math.round(b[3] - b[1]);
    const res = await askVision(`This is an architectural floor plan image. The building footprint is ${W} mm wide and ${D} mm deep; the image spans exactly that footprint. Trace every wall as a straight segment. Answer JSON only: {"walls":[{"x1":0,"y1":0,"x2":0,"y2":0}]} with coordinates as fractions 0..1 of the image width (x) and height (y), origin top-left.`, sm.blob);
    let n = 0; for (const s of (res && res.walls) || []) { const f = (v, L, o) => Math.round(o + clamp(+v || 0, 0, 1) * L); P.walls.push({ id: uid('w'), x1: f(s.x1, W, b[0]), y1: f(s.y1, D, b[1]), x2: f(s.x2, W, b[0]), y2: f(s.y2, D, b[1]), finish: { type: 'paint', color: '#ece8e1' } }); n++; }
    li.textContent = `벽 ${n}개를 그렸어요. 배경 도면과 비교해 손잡이로 맞춰 주세요.`; commit();
  } catch (e) { li.textContent = (e && e.message) || '읽지 못했어요 · 벽 도구로 따라 그려 주세요'; li.className = 'err'; }
}

/* ---------- 3D 보기 옵션: 햇빛 · 밝기 ---------- */
function bindRender() { const r = P.render; $('#rsSun').value = r.sun; $('#rsAlt').value = r.alt; $('#rsBright').value = r.bright; }
for (const [id, k] of [['rsSun', 'sun'], ['rsAlt', 'alt'], ['rsBright', 'bright']]) { $('#' + id).addEventListener('input', (e) => { P.render[k] = +e.target.value; need3d = true; }); $('#' + id).addEventListener('change', () => commit()); }

/* 테마가 바뀌면 2D 색 다시 읽기 */
const clearCss = () => { for (const k in cssCache) delete cssCache[k]; draw2d(); };
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', clearCss); } catch (e) {}
new MutationObserver(clearCss).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
/* ---------- 시작 ---------- */
document.body.dataset.sheet = ''; initGL(); renderLib();
const last = store.get('drs_last'); const lp_ = last && store.get('drs_p_' + last);
openProject(lp_ || JSON.parse(JSON.stringify(SAMPLE)));
setView(isMobile() ? '3d' : 'split'); if (isMobile()) $$('[data-mview]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mview === '3d'));
setTool('select'); requestAnimationFrame(() => { fit2d(); draw2d(); cam3dDefault(); dirty3d = true; });
function renderSceneNav() { $('#sceneNav').innerHTML = scenes().map((s, i) => `<button class="chip" data-scene="${i}">${esc(s.name)}</button>`).join(''); }
const _gs = goScene; goScene = function (i, d) { _gs(i, d); renderSceneNav(); $$('[data-scene]').forEach((b) => b.classList.toggle('on', +b.dataset.scene === sceneIdx)); };
loop();
bindRender(); renderLevels(); setTimeout(showHome, 300);
if (SYNC.cfg.access && SYNC.cfg.auto) setTimeout(() => syncNow(true), 2500);
setInterval(() => { if (SYNC.cfg.access && SYNC.cfg.auto) syncNow(true); }, 300000);
