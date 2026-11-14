// 5차 (기존 앱 v7~v10): 설비 점검 · 전력 합계 · 견적(엑셀 · CSV) · 자동 배치(업종 · 페리카나 홀/배달 · 주방 비율) · A안/B안 비교용 지표
import { pointInPoly, polyArea } from './slope.js';
import { LINEKINDS } from './lines.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;
export const corners = (it) => { const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2, hd = it.d / 2; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]); };
const aabb = (c) => [Math.min(...c.map((p) => p[0])), Math.min(...c.map((p) => p[1])), Math.max(...c.map((p) => p[0])), Math.max(...c.map((p) => p[1]))];
/** 볼록 사각형 두 개가 pad(mm) 이상 파고들면 겹침 */
function sat(A, B, pad = 0) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], nx = -(b[1] - a[1]), ny = b[0] - a[0], l = hyp(nx, ny) || 1, ux = nx / l, uy = ny / l;
    const pa = A.map((p) => p[0] * ux + p[1] * uy), pb = B.map((p) => p[0] * ux + p[1] * uy);
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= pad) return false;
  }
  return true;
}
function wallRect(w) { const L = hyp(w.x2 - w.x1, w.y2 - w.y1) || 1, t = (w.t || 150) / 2, nx = (-(w.y2 - w.y1) / L) * t, ny = ((w.x2 - w.x1) / L) * t; return [[w.x1 + nx, w.y1 + ny], [w.x2 + nx, w.y2 + ny], [w.x2 - nx, w.y2 - ny], [w.x1 - nx, w.y1 - ny]]; }
const SEAT = /chair|stool|bench|banquette|lounge|h_ch|h_st|f_dchair|f_och|f_mch|f_kchair/, TABLE = /^t\d|tround|tbar|counter|h_t|h_bar|h_round|h_booth|desk|f_dtable|f_rtable|f_mtable|f_ctable/;
const layerOf = (L) => (L && L.layer) || 'floor';
const isPhys = (L) => L && !/^(zone|mark|drainpt)$/.test(L.shape || '') && !/^(elec|plumb)$/.test(layerOf(L));
/* 필요한 설비를 "주는" 기물 · 선 */
const PROV = { drain: /^(drain|b_drain|trench|trap)$/, gas: /^(gasvalve|e_gas)$/, power3: /^(outlet3|panel)$/ };
const LPROV = { drain: /^drain/, gas: /^gas/, power3: /wire/ };
const needHood = (it, L) => !!L && layerOf(L) === 'floor' && (L.gas || /fryer|range|wok|grill|griddle|noodle|salam/.test(`${it.type} ${L.shape || ''}`));
const isHood = (it, L) => (L && L.shape === 'hood') || /hood/.test(it.type);
export const itemKw = (it, lib) => +(it.kw ?? (lib[it.type] || {}).kw ?? 0) || 0;

/** 설비 점검: 겹침 · 벽 넘어감 · 틈 · 배수 · 가스 · 후드 · 3상 전원 · 주방 통로 폭 */
export function analyze(L, lib, aisle = 900) {
  const checks = [], bad = new Map(), items = L.items.filter((it) => !it.hidden);
  const C = items.filter((it) => isPhys(lib[it.type])).map((it) => { const z0 = it.elev || 0, c = corners(it); return { it, L: lib[it.type], c, b: aabb(c), z0, z1: z0 + (it.h || 0) }; });
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = C[i], b = C[j]; if (a.z1 <= b.z0 + 1 || b.z1 <= a.z0 + 1) continue;
    if (SEAT.test(a.it.type + ' ' + b.it.type) && TABLE.test(a.it.type + ' ' + b.it.type) && SEAT.test(a.it.type) !== SEAT.test(b.it.type)) continue; /* 의자는 테이블 밑으로 들어가도 됨 */
    if (sat(a.c, b.c, 8)) { bad.set(a.it.id, '다른 기물과 겹침'); bad.set(b.it.id, '다른 기물과 겹침'); continue; }
    const gx = Math.max(a.b[0] - b.b[2], b.b[0] - a.b[2]), gy = Math.max(a.b[1] - b.b[3], b.b[1] - a.b[3]), gap = gx < 0 && gy >= 0 ? gy : gy < 0 && gx >= 0 ? gx : null;
    if (gap != null && gap > 8 && gap < 80 && a.L.cat === '주방' && b.L.cat === '주방') { const r = `틈 ${Math.round(gap)}mm · 재실측 또는 붙이기`; if (!bad.has(a.it.id)) bad.set(a.it.id, r); if (!bad.has(b.it.id)) bad.set(b.it.id, r); }
  }
  const WR = L.walls.map(wallRect);
  for (const q of C) { if (layerOf(q.L) !== 'floor' || q.it.type === 'column' || /sheet|sign|sticker|mirror|menuboard|shelf|frame/.test(q.it.type)) continue; if (WR.some((r) => sat(q.c, r, 12))) bad.set(q.it.id, '벽을 넘어감 · 위치 조정 필요'); }
  const pts = (k) => [...items.filter((o) => PROV[k].test(o.type)).map((o) => [o.x, o.y, Math.max(o.w, o.d) / 2]), ...(L.lines || []).filter((l) => LPROV[k].test(l.kind)).flatMap((l) => l.pts.map((p) => [p[0], p[1], 0]))];
  const P = { drain: pts('drain'), gas: pts('gas'), power3: pts('power3') }, near = (k, it, r) => P[k].some(([x, y, e]) => hyp(x - it.x, y - it.y) < r + e);
  for (const r of L.rooms || []) { const d = r.slope && r.slope.item && items.find((o) => o.id === r.slope.item); if (d) P.drain.push([d.x, d.y, 0]); }
  const hoods = items.filter((o) => isHood(o, lib[o.type])).map(corners); const n = { gas: 0, drain: 0, hot: 0, kw3: 0 };
  for (const it of items) {
    const Li = lib[it.type]; if (!Li) continue; const nm = it.name || Li.name, kw = itemKw(it, lib);
    if (bad.has(it.id)) checks.push({ lvl: 'bad', id: it.id, t: `${nm}: ${bad.get(it.id)}` });
    if (Li.drain) { n.drain++; if (!near('drain', it, 1500)) checks.push({ lvl: 'warn', id: it.id, t: `${nm}: 1.5m 안에 배수구 없음` }); }
    if (Li.gas) { n.gas++; if (!near('gas', it, 2500)) checks.push({ lvl: 'warn', id: it.id, t: `${nm}: 가스 밸브(배관) 위치 필요` }); }
    if (needHood(it, Li)) { n.hot++; const c = corners(it); if (!hoods.some((h) => sat(c, h, 0))) checks.push({ lvl: 'warn', id: it.id, t: `${nm}: 위에 후드 없음` }); }
    if (kw >= 3 && Li.cat !== '설비') { n.kw3++; if (!near('power3', it, 3000)) checks.push({ lvl: 'warn', id: it.id, t: `${nm}: ${kw}kW · 3상 전원 확인` }); }
    if (it.needsWork) checks.push({ lvl: 'work', id: it.id, t: `공사 필요 · ${nm}${it.note ? ' · ' + it.note : ''}` });
  }
  // 주방 통로 폭 (마주 보는 주방 기물 사이)
  const kitR = (L.rooms || []).filter((r) => r.kind === '주방'), K = C.filter((q) => q.L.cat === '주방' && layerOf(q.L) === 'floor' && (!kitR.length || kitR.some((r) => pointInPoly(q.it.x, q.it.y, r.pts))));
  const seen = new Set();
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
    const a = K[i].b, b = K[j].b, ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
    const g = ox > 200 ? Math.max(a[1] - b[3], b[1] - a[3]) : oy > 200 ? Math.max(a[0] - b[2], b[0] - a[2]) : null;
    if (g == null || g < 80 || g >= aisle || seen.has(K[i].it.id)) continue;
    const t1 = ox > 200 ? (a[3] <= b[1] ? a : b) : (a[2] <= b[0] ? a : b), t2 = t1 === a ? b : a, gr = ox > 200 ? [Math.max(a[0], b[0]), t1[3], Math.min(a[2], b[2]), t2[1]] : [t1[2], Math.max(a[1], b[1]), t2[0], Math.min(a[3], b[3])];
    if (K.some((q, k) => k !== i && k !== j && q.b[0] < gr[2] - 1 && q.b[2] > gr[0] + 1 && q.b[1] < gr[3] - 1 && q.b[3] > gr[1] + 1)) continue; /* 사이에 다른 기물 → 마주 보는 통로 아님 */
    { seen.add(K[i].it.id); checks.push({ lvl: 'warn', id: K[i].it.id, t: `통로 ${Math.round(g)}mm · ${K[i].it.name || K[i].L.name} ↔ ${K[j].it.name || K[j].L.name} (기준 ${aisle})` }); }
  }
  const byCat = {}; let kw = 0; for (const it of items) { const k = itemKw(it, lib); if (!k) continue; kw += k; const c = (lib[it.type] || {}).cat || '기타'; byCat[c] = (byCat[c] || 0) + k; }
  return { checks, bad, kw: Math.round(kw * 10) / 10, byCat, n };
}

/* ---------- 견적 (물량 · 단가 · 합계) ---------- */
const FN = { paint: '벽 도장 (페인트)', tile: '벽 타일', wood: '벽 목재 마감', brick: '벽돌 마감', concrete: '노출 콘크리트', wallpaper: '벽지', steel: '스테인리스 판', glass: '유리벽' };
const FLN = { tile: '타일', wood: '마루', concrete: '콘크리트', epoxy: '에폭시', paint: '도장', carpet: '카펫', stone: '석재' };
const OPN = { door1: '여닫이문', door2: '양개문', auto: '자동문', slide: '미닫이문', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', arch: '개구부' };
export function bounds(L) { const xs = [], ys = []; for (const w of L.walls) { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); } if (!xs.length) return [0, 0, 0, 0]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
const isExt = (w, b) => { const m = [(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2], t = 250; return (Math.abs(w.y1 - w.y2) < 5 && (Math.abs(m[1] - b[1]) < t || Math.abs(m[1] - b[3]) < t)) || (Math.abs(w.x1 - w.x2) < 5 && (Math.abs(m[0] - b[0]) < t || Math.abs(m[0] - b[2]) < t)); };
export function bomRows(L, lib, std = {}) {
  const rows = [], add = (g, n, sp, q, u, key, note = '') => { if (q > 0) rows.push({ g, n, sp, q: Math.round(q * 100) / 100, u, key, note }); };
  const groups = new Map(), r10 = (v) => Math.round((v || 0) / 10) * 10;
  for (const it of L.items) { if (it.hidden) continue; const Li = lib[it.type] || { name: it.name || it.type, cat: '내 기물' }; if (Li.shape === 'zone') continue; const k = `${it.type}|${r10(it.w)}x${r10(it.d)}x${r10(it.h)}|${it.name || ''}`; const g = groups.get(k) || { it, L: Li, q: 0 }; g.q++; groups.set(k, g); }
  for (const g of groups.values()) { const Li = g.L, kw = itemKw(g.it, lib), mark = Li.shape === 'mark' || Li.shape === 'drainpt';
    add(Li.cat === '전기' || layerOf(Li) === 'elec' ? '전기' : /배관/.test(Li.cat || '') ? '설비 · 배관' : /설비/.test(Li.cat || '') ? '설비' : '기물 · 가구', g.it.name || Li.name, mark ? '' : `${r10(g.it.w)}×${r10(g.it.d)}×${r10(g.it.h)}`, g.q, mark ? '개소' : '대', 'it:' + g.it.type + ':' + r10(g.it.w), kw ? `${kw}kW` : ''); }
  const ops = new Map(); for (const o of L.openings) { const k = `${o.type}|${o.w}x${o.h}`; ops.set(k, (ops.get(k) || 0) + 1); }
  for (const [k, q] of ops) { const [t, sz] = k.split('|'); add('문 · 창', `${OPN[t] || t}`, sz.replace('x', '×'), q, '개', 'op:' + t + ':' + sz); }
  const b = bounds(L), fin = {}; let partL = 0, perim = 0;
  for (const w of L.walls) { const len = hyp(w.x2 - w.x1, w.y2 - w.y1), H = w.h || L.ceilingH || 2700, hole = L.openings.filter((o) => o.wall === w.id).reduce((s, o) => s + o.w * o.h, 0), ext = isExt(w, b), faces = ext ? 1 : 2, a = Math.max(0, len * H - hole) * faces / 1e6;
    const t = w.finish || 'paint'; fin[t] = (fin[t] || 0) + a; if (!ext) partL += len; perim += len * faces; }
  for (const [t, a] of Object.entries(fin)) { add('벽 마감', FN[t] || '벽 마감 · ' + t, '', a, '㎡', 'wall:' + t);
    if (t === 'paint') add('벽 마감', '└ 페인트 양 (2회 · 9㎡/L)', '', (a * 2) / 9, 'L', 'paintL');
    if (t === 'tile') { const ts = std.tileWall || 300; add('벽 마감', `└ 타일 장수 (${ts}각 · 로스 8%)`, `${ts}×${ts}`, Math.ceil(((a * 1e6) / ts / ts) * 1.08), '장', 'tileWn'); } }
  if (partL) add('벽체', '칸막이 벽 (경량)', '', partL / 1000, 'm', 'part');
  const rooms = L.rooms || [], ra = rooms.reduce((s, r) => s + polyArea(r.pts), 0) / 1e6, area = ra || ((b[2] - b[0]) * (b[3] - b[1])) / 1e6;
  if (rooms.length) for (const r of rooms) { const a = polyArea(r.pts) / 1e6; add('바닥', `바닥 마감 · ${r.name} (${FLN[r.finish] || r.finish || '타일'})`, '', a, '㎡', 'floor:' + (r.finish || 'tile'));
    if ((r.finish || 'tile') === 'tile') { const ts = std.tileFloor || 600; add('바닥', `└ 바닥 타일 (${ts}각 · 로스 6%)`, `${ts}×${ts}`, Math.ceil(((a * 1e6) / ts / ts) * 1.06), '장', 'tileFn'); }
    for (const f of r.layers || []) add('바닥', `└ 채움층 · ${f.name || f.k || ''} ${f.t || ''}mm`, '', a * (f.t || 0) / 1000, '㎥', 'fill:' + (f.k || f.name)); }
  else add('바닥', `바닥 마감 (${FLN[L.floor && L.floor.finish] || '타일'}) · 외곽 사각형 기준`, '', area, '㎡', 'floor:' + ((L.floor && L.floor.finish) || 'tile'));
  add('바닥', '걸레받이', '', perim / 1000, 'm', 'base');
  if (!L.ceiling || L.ceiling.on !== false) { add('천장', '천장 마감 (텍스 · 석고)', '', area, '㎡', 'ceil'); add('천장', '└ 경량 천장틀', '', area, '㎡', 'ceilframe'); }
  const lk = {}; for (const l of L.lines || []) { let len = 0; for (let i = 1; i < l.pts.length; i++) len += hyp(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]); lk[l.kind] = (lk[l.kind] || 0) + len; }
  for (const [k, len] of Object.entries(lk)) { const K = LINEKINDS[k] || {}; add(K.layer === 'elec' ? '전기' : '설비 · 배관', K.name || k, '', (len / 1000) * 1.1, 'm', 'ln:' + k, '여유 10%'); }
  return rows;
}
export function bomTotals(rows, price, etcPct = 0, vat = true) { const sub = rows.reduce((s, r) => s + r.q * (price[r.key] || 0), 0), etc = Math.round((sub * etcPct) / 100), v = vat ? Math.round((sub + etc) * 0.1) : 0; return { sub: Math.round(sub), etc, vat: v, all: Math.round(sub) + etc + v }; }
export function bomCsv(rows, price) { const q = (s) => `"${String(s).replace(/"/g, '""')}"`; return '﻿' + [['구분', '항목', '규격', '수량', '단위', '단가', '금액', '비고'].join(','), ...rows.map((r) => [r.g, r.n, r.sp, r.q, r.u, price[r.key] || 0, Math.round(r.q * (price[r.key] || 0)), r.note].map(q).join(','))].join('\r\n'); }
let CRC; const crc32 = (d) => { if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } } let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** 압축 없는 zip (xlsx 용) → Uint8Array */
export function zip(files) {
  const te = new TextEncoder(), parts = [], cds = []; let off = 0;
  const hdr = (n, f) => { const v = new DataView(new ArrayBuffer(n)); f.forEach(([o, x, l]) => (l === 4 ? v.setUint32(o, x, true) : v.setUint16(o, x, true))); return new Uint8Array(v.buffer); };
  for (const f of files) { const nm = te.encode(f.name), data = typeof f.data === 'string' ? te.encode(f.data) : f.data, crc = crc32(data), sz = data.length;
    parts.push(hdr(30, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, nm.length, 2], [28, 0, 2]]), nm, data);
    cds.push(hdr(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]]), nm); off += 30 + nm.length + sz; }
  const cdLen = cds.reduce((s, x) => s + x.length, 0), all = [...parts, ...cds, hdr(22, [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdLen, 4], [16, off, 4], [20, 0, 2]])];
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of all) { out.set(x, p); p += x.length; } return out;
}
export function bomXlsx(rows, price, { title = '견적서', sub = '', etcPct = 0, vat = true } = {}) {
  const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const S = (r, c, v, st = 0) => `<c r="${c}${r}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t>${x(v)}</t></is></c>`, N = (r, c, v, st = 2) => `<c r="${c}${r}" s="${st}"><v>${v}</v></c>`, F = (r, c, f, v, st = 2) => `<c r="${c}${r}" s="${st}"><f>${f}</f><v>${v}</v></c>`;
  const out = [`<row r="1">${S(1, 'A', title, 1)}</row>`, `<row r="2">${S(2, 'A', sub)}</row>`, `<row r="4">${['구분', '항목', '규격', '수량', '단위', '단가', '금액', '비고'].map((h, i) => S(4, 'ABCDEFGH'[i], h, 1)).join('')}</row>`];
  let r = 5; for (const o of rows) { const p = price[o.key] || 0; out.push(`<row r="${r}">${S(r, 'A', o.g)}${S(r, 'B', o.n)}${S(r, 'C', o.sp)}${N(r, 'D', o.q, 3)}${S(r, 'E', o.u)}${N(r, 'F', p)}${F(r, 'G', `D${r}*F${r}`, Math.round(o.q * p))}${S(r, 'H', o.note)}</row>`); r++; }
  const t = bomTotals(rows, price, etcPct, vat), last = Math.max(5, r - 1);
  out.push(`<row r="${r + 1}">${S(r + 1, 'F', '소계', 1)}${F(r + 1, 'G', `SUM(G5:G${last})`, t.sub)}</row>`, `<row r="${r + 2}">${S(r + 2, 'F', `공과잡비 ${etcPct}%`, 1)}${F(r + 2, 'G', `ROUND(G${r + 1}*${etcPct / 100},0)`, t.etc)}</row>`,
    `<row r="${r + 3}">${S(r + 3, 'F', '부가세', 1)}${F(r + 3, 'G', vat ? `ROUND((G${r + 1}+G${r + 2})*0.1,0)` : '0', t.vat)}</row>`, `<row r="${r + 4}">${S(r + 4, 'F', '합계', 1)}${F(r + 4, 'G', `G${r + 1}+G${r + 2}+G${r + 3}`, t.all, 4)}</row>`);
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', RS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const sheet = `${X}<worksheet xmlns="${NS}"><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="36" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="5" width="8" customWidth="1"/><col min="6" max="7" width="14" customWidth="1"/><col min="8" max="8" width="14" customWidth="1"/></cols><sheetData>${out.join('')}</sheetData></worksheet>`;
  const styles = `${X}<styleSheet xmlns="${NS}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="3" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="3" fontId="1" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>`;
  return zip([
    { name: '[Content_Types].xml', data: `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `${X}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${RS}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `${X}<workbook xmlns="${NS}" xmlns:r="${RS}"><sheets><sheet name="견적" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `${X}<Relationships xmlns="${PR}"><Relationship Id="rId1" Type="${RS}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${RS}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }, { name: 'xl/styles.xml', data: styles },
  ]);
}

/* ---------- 자동 배치 (업종 프리셋 · 페리카나 매뉴얼 2025.01) ---------- */
// 주방 기물: [종류, 가로, 깊이, 수량, 역할]  역할 순서대로 뒷벽 → 옆벽 → 칸막이 쪽에 붙인다
export const PELI = { main: '#ac0610', hallWall: '#fbfaf6', panel: '#6e503a', kitWall: '#efefef', hallFloor: '#b09578', hallFloor2: '#dad8cb', kitFloor: '#a7a3a2', gate: '#931506', part: '#bababa', counter: '#8e1c22', chair: '#b5121b', ceiling: '#fbfaf6' };
export const BIZ = {
  pel_hall: { name: '페리카나 홀 타입', pel: 1, ratio: 0.3, door: ['door2', 1880, 2400], menu: 2, table: ['t4', 'chair', 900], counter: 'counter',
    kitchen: [['fryer1', 600, 600, 1, 'hot'], ['fryer2', 900, 600, 1, 'hot'], ['range3', 900, 600, 1, 'hot'], ['work', 800, 600, 1, 'hot'], ['sink1', 600, 600, 1, 'wash'], ['dishwasher', 650, 650, 1, 'wash'], ['sink2', 900, 700, 1, 'wash'],
      ['fridge45', 1300, 800, 1, 'cold'], ['tfridge', 900, 700, 1, 'prep'], ['tfridge', 1200, 700, 1, 'prep'], ['work', 800, 700, 1, 'prep'], ['showcase', 650, 585, 3, 'cold'], ['icemaker', 515, 650, 1, 'store'], ['purifier', 350, 450, 1, 'store'], ['beer', 450, 550, 1, 'store'], ['rack', 900, 450, 2, 'store']] },
  pel_delivery: { name: '페리카나 배달 타입', pel: 1, ratio: 0.48, door: ['door1', 970, 2400], menu: 1, table: ['t2', 'chair', 800], counter: 'counter',
    kitchen: [['fryer2', 900, 600, 1, 'hot'], ['fryer1', 600, 600, 1, 'hot'], ['work', 700, 600, 1, 'hot'], ['range3', 900, 600, 1, 'hot'], ['work', 900, 700, 1, 'wash'], ['sink2', 900, 700, 1, 'wash'],
      ['fridge45', 1300, 800, 1, 'cold'], ['work', 1200, 600, 2, 'prep'], ['work2', 1500, 600, 1, 'prep'], ['showcase', 650, 585, 2, 'cold'], ['purifier', 350, 450, 1, 'store'], ['rack', 1000, 450, 1, 'store'], ['rack', 1400, 450, 1, 'store']] },
  chicken: { name: '치킨 (일반)', ratio: 0.4, door: ['door1', 900, 2100], table: ['t4', 'chair', 900], counter: 'counter',
    kitchen: [['fryer2', 0, 0, 2, 'hot'], ['work', 0, 0, 1, 'hot'], ['range3', 0, 0, 1, 'hot'], ['sink2', 0, 0, 1, 'wash'], ['handsink', 0, 0, 1, 'wash'], ['fridge45', 0, 0, 1, 'cold'], ['tfridge', 0, 0, 1, 'prep'], ['work', 0, 0, 1, 'prep'], ['showcase', 0, 0, 1, 'cold'], ['rack', 0, 0, 1, 'store']] },
  cafe: { name: '카페', ratio: 0.25, door: ['door1', 900, 2100], table: ['t2', 'chair', 800], counter: 'counter', hot: false,
    kitchen: [['k_espresso', 0, 0, 1, 'prep'], ['k_grinder', 0, 0, 1, 'prep'], ['k_blender', 0, 0, 1, 'prep'], ['tfridge', 0, 0, 2, 'prep'], ['sink2', 0, 0, 1, 'wash'], ['icemaker', 0, 0, 1, 'wash'], ['k_waterD', 0, 0, 1, 'store'], ['showcase', 0, 0, 1, 'cold'], ['oven', 0, 0, 1, 'prep'], ['rack', 0, 0, 1, 'store']] },
  snack: { name: '분식', ratio: 0.4, door: ['door1', 900, 2100], table: ['t4', 'chair', 850], counter: 'counter',
    kitchen: [['griddle', 0, 0, 1, 'hot'], ['fryer1', 0, 0, 1, 'hot'], ['range3', 0, 0, 1, 'hot'], ['soupkettle', 0, 0, 1, 'hot'], ['sink2', 0, 0, 1, 'wash'], ['k_ricecook', 0, 0, 1, 'prep'], ['tfridge', 0, 0, 2, 'prep'], ['work', 0, 0, 1, 'prep'], ['fridge45', 0, 0, 1, 'cold'], ['rack', 0, 0, 1, 'store']] },
  korean: { name: '한식', ratio: 0.38, door: ['door2', 1600, 2300], table: ['t4', 'chair', 950], counter: 'counter',
    kitchen: [['range3', 0, 0, 2, 'hot'], ['soupkettle', 0, 0, 1, 'hot'], ['k_steam', 0, 0, 1, 'hot'], ['sink3', 0, 0, 1, 'wash'], ['dishwasher', 0, 0, 1, 'wash'], ['k_ricecook', 0, 0, 1, 'prep'], ['tfridge', 0, 0, 2, 'prep'], ['work', 0, 0, 1, 'prep'], ['fridge45', 0, 0, 2, 'cold'], ['rack', 0, 0, 2, 'store']] },
};
const ROLE = ['hot', 'wash', 'prep', 'cold', 'store'];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** 정면(F) 기준 좌표계: u = 정면 따라, v = 정면에서 안쪽으로 */
function frame(R, F) {
  const W = F === 'N' || F === 'S' ? R[2] - R[0] : R[3] - R[1], D = F === 'N' || F === 'S' ? R[3] - R[1] : R[2] - R[0];
  const toW = (u, v) => (F === 'S' ? [R[0] + u, R[3] - v] : F === 'N' ? [R[2] - u, R[1] + v] : F === 'W' ? [R[0] + v, R[1] + u] : [R[2] - v, R[3] - u]);
  const dirW = (du, dv) => { const a = toW(0, 0), b = toW(du, dv); return [b[0] - a[0], b[1] - a[1]]; };
  const rot = (du, dv) => { const d = dirW(du, dv); return Math.round((((Math.atan2(-d[0], d[1]) * 180) / Math.PI) % 360 + 360) % 360); }; /* 기물 앞(+y)이 (du,dv) 쪽 */
  return { W, D, toW, rot };
}
const DOORISH = /door|auto|slide|full|glass|fold/;
/** 출입구 쪽 벽 (N/E/S/W) */
export function frontSide(L) {
  const b = bounds(L); let best = null;
  for (const o of L.openings) { if (!DOORISH.test(o.type) || /pass/.test(o.type)) continue; const w = L.walls.find((q) => q.id === o.wall); if (!w || w.pz === 'part') continue; const len = hyp(w.x2 - w.x1, w.y2 - w.y1) || 1, x = w.x1 + ((w.x2 - w.x1) * o.t) / len, y = w.y1 + ((w.y2 - w.y1) * o.t) / len;
    const d = { N: Math.abs(y - b[1]), S: Math.abs(y - b[3]), W: Math.abs(x - b[0]), E: Math.abs(x - b[2]) }, k = Object.entries(d).sort((p, q) => p[1] - q[1])[0]; if (k[1] < 400 && (!best || o.w > best.w)) best = { side: k[0], w: o.w, o, x, y }; }
  return best;
}
/**
 * 자동 배치. make(type, x, y, rot, over) → 기물 (app 쪽에서 기본값 채움)
 * opt: { kind, ratio(0.15~1), front('auto'|N|E|S|W), aisle, clear, scope:{kitchen,hall,finish,mep} }
 */
export function autoLayout(L, lib, opt, make, uid) {
  const pr = BIZ[opt.kind]; if (!pr) return { error: '업종을 고르세요' };
  const outer = L.walls.filter((w) => w.pz !== 'part'); if (outer.length < 3) return { error: '먼저 매장 벽을 그려 주세요' };
  const T = (L.walls[0].t || 150) / 2, b = bounds({ walls: outer }), R = [b[0] + T, b[1] + T, b[2] - T, b[3] - T];
  const fd = frontSide({ ...L, walls: outer }), F = opt.front && opt.front !== 'auto' ? opt.front : fd ? fd.side : 'S';
  const { W, D, toW, rot } = frame(R, F), ratio = clamp(opt.ratio ?? pr.ratio, 0.15, 1), noHall = ratio >= 0.95, aisle = opt.aisle || 900, sc = { kitchen: 1, hall: 1, finish: 1, mep: 1, ...(opt.scope || {}) };
  if (W < 2500 || D < 3000) return { error: '매장이 너무 좁아요 (가로 2.5m · 깊이 3m 이상)' };
  const rep = { placed: 0, seats: 0, miss: [], note: '', F, W, D };
  // 0. 정리: 프리셋으로 놓은 것만 (clear 면 기물 전부)
  const partIds = new Set(L.walls.filter((w) => w.pz === 'part').map((w) => w.id));
  L.walls = L.walls.filter((w) => !partIds.has(w.id)); L.openings = L.openings.filter((o) => !partIds.has(o.wall));
  L.items = opt.clear ? [] : L.items.filter((it) => !it.pz); L.rooms = (L.rooms || []).filter((r) => !r.pz);
  // 1. 주방 깊이
  const kd = noHall ? Math.max(1500, D - 1200) : clamp(Math.round((D * ratio) / 50) * 50, 2400, Math.max(2400, D - 1800)), pv = D - kd;
  const rect = (u0, v0, u1, v1) => [toW(u0, v0), toW(u1, v0), toW(u1, v1), toW(u0, v1)].map((p) => p.map(Math.round));
  const hall = { id: uid('r'), pz: 'auto', name: '홀', kind: '홀', pts: rect(0, 0, W, pv), lift: 0, finish: 'tile', color: pr.pel ? PELI.hallFloor : '#c9c3b8', slope: null };
  const kit = { id: uid('r'), pz: 'auto', name: noHall ? '주방 (배달 전용)' : '주방', kind: '주방', pts: rect(0, noHall ? 0 : pv, W, D), lift: 0, finish: 'tile', color: pr.pel ? PELI.kitFloor : '#a7a3a2', slope: null };
  if (!noHall) L.rooms.push(hall); L.rooms.push(kit);
  rep.kitchenA = polyArea(kit.pts) / 1e6; rep.hallA = noHall ? 0 : polyArea(hall.pts) / 1e6;
  const put = (pz, type, u, v, ru, rv, over = {}) => { const Li = lib[type]; if (!Li) { rep.miss.push(type); return null; } const [x, y] = toW(u, v), it = make(type, x, y, rot(ru, rv), over); it.pz = pz; L.items.push(it); rep.placed++; return it; };
  // 2. 칸막이 · 배식구 · 주방 출입구
  const cw = clamp(Math.round((W * (pr.pel === 1 && opt.kind === 'pel_hall' ? 0.36 : 0.4)) / 100) * 100, 1200, 3200), kdU = W > 6000 ? W - 700 : 650;
  let cu = clamp(W / 2, cw / 2 + 250, W - cw / 2 - 250); if (Math.abs(cu - kdU) < cw / 2 + 650) cu = kdU > W / 2 ? kdU - cw / 2 - 650 : kdU + cw / 2 + 650; cu = clamp(cu, cw / 2 + 150, W - cw / 2 - 150);
  if (!noHall) { const a = toW(0, pv), c = toW(W, pv), part = { id: uid('w'), pz: 'part', x1: Math.round(a[0]), y1: Math.round(a[1]), x2: Math.round(c[0]), y2: Math.round(c[1]), t: 100, h: L.ceilingH || 2700, color: pr.pel ? PELI.part : '#ece8e1', finish: pr.pel ? 'steel' : 'paint' };
    L.walls.push(part); L.openings.push({ id: uid('o'), pz: 'auto', wall: part.id, type: 'pass', t: Math.round(cu), w: cw, h: 900, sill: 1050, frost: null }, { id: uid('o'), pz: 'auto', wall: part.id, type: 'arch', t: Math.round(kdU), w: 1000, h: 2100, sill: 0, frost: null }); }
  // 3. 출입문 (없으면 정면 가운데에)
  let gateU = W / 2;
  if (fd && F === fd.side) { const p = fd; gateU = F === 'S' ? p.x - R[0] : F === 'N' ? R[2] - p.x : F === 'W' ? p.y - R[1] : R[3] - p.y; }
  else { const m = toW(W / 2, -T), wl = outer.map((w) => { const len = hyp(w.x2 - w.x1, w.y2 - w.y1) || 1, t = clamp(((m[0] - w.x1) * (w.x2 - w.x1) + (m[1] - w.y1) * (w.y2 - w.y1)) / len, 0, len); return { w, t, len, d: hyp(w.x1 + ((w.x2 - w.x1) * t) / len - m[0], w.y1 + ((w.y2 - w.y1) * t) / len - m[1]) }; }).sort((p, q) => p.d - q.d)[0];
    if (wl && wl.d < 400) { const [dt, dw, dh] = pr.door, ww = Math.min(dw, wl.len - 400); L.openings.push({ id: uid('o'), pz: 'auto', wall: wl.w.id, type: dt, t: Math.round(clamp(wl.t, ww / 2 + 200, wl.len - ww / 2 - 200)), w: ww, h: dh, sill: 0, frost: null, ...(pr.pel ? { frame: PELI.gate } : {}) }); } }
  // 4. 주방 기물 (뒷벽 → 오른쪽 → 왼쪽 → 칸막이)
  const list = []; for (const [type, w, d, q, role] of pr.kitchen) { const Li = lib[type]; if (!Li) { rep.miss.push(type); continue; } for (let k = 0; k < q; k++) list.push({ type, w: w || Li.w, d: d || Li.d, role, gas: !!Li.gas, drain: !!Li.drain, kw: Li.kw || 0 }); }
  list.sort((a, b) => ROLE.indexOf(a.role) - ROLE.indexOf(b.role));
  const v0 = noHall ? 0 : pv + 50, backD = Math.max(0, ...list.slice(0, 6).map((q) => q.d)), partD = 720, usePart = !noHall && kd >= backD + partD + aisle + 100;
  const segs = [ // 시작점(u,v) · 진행 방향 · 안쪽 방향 · 길이 · 막힌 구간
    { u: 0, v: D, du: 1, dv: 0, nu: 0, nv: -1, len: W, block: [] },
    { u: W, v: D - backD + 50, du: 0, dv: -1, nu: -1, nv: 0, len: D - backD + 50 - v0 - (usePart ? partD + 50 : 0), block: [] },
    { u: 0, v: D - backD + 50, du: 0, dv: -1, nu: 1, nv: 0, len: D - backD + 50 - v0 - (usePart ? partD + 50 : 0), block: [] },
  ];
  if (usePart) segs.push({ u: 0, v: pv + 50, du: 1, dv: 0, nu: 0, nv: 1, len: W, block: [[cu - cw / 2 - 50, cu + cw / 2 + 50], [kdU - 500 - 450, kdU + 500 + 450]] });
  if (noHall) segs[1].len = segs[2].len = D - backD + 50 - 1200; /* 배달 전용: 앞 1.2m 는 픽업 자리 */
  const placed = []; let si = 0, s = 50;
  if (sc.kitchen) for (const q of list) { let ok = false;
    while (si < segs.length) { const g = segs[si], hit = g.block.find(([a, c]) => s < c && s + q.w > a); if (hit) { s = hit[1]; continue; } if (s + q.w <= g.len - 50 && q.d < 1200) { ok = true; break; }
      if (si === 0) { const row = placed.filter((p) => p.si === 0), first = row[0], last = row[row.length - 1]; /* 모서리: 뒷벽 끝 기물 깊이에 딱 붙여 옆벽 시작 */
        for (const [k, p] of [[1, last], [2, first]]) { if (!p) continue; const top = D - (p.d + 10); segs[k].len += segs[k].v - top - 50; segs[k].v = top + 50; } }
      si++; s = 50; }
    if (!ok) { rep.miss.push((lib[q.type] || {}).name || q.type); continue; }
    const g = segs[si], c = s + q.w / 2, off = q.d / 2 + 10, u = g.u + g.du * c + g.nu * off, v = g.v + g.dv * c + g.nv * off;
    const it = put('kit', q.type, u, v, g.nu, g.nv, { w: q.w, d: q.d }); if (it) placed.push({ ...q, it, si, s, u, v, g }); s += q.w; }
  // 5. 후드 · 배수 · 가스 · 3상 (설비)
  if (sc.mep && sc.kitchen) {
    const runs = []; for (const p of placed) { if (!(p.role === 'hot' || p.gas || /fryer|range|griddle|wok|noodle|steam|soup/.test(p.type))) continue; const r = runs[runs.length - 1]; if (r && r.si === p.si && p.s - r.e < 120) { r.e = p.s + p.w; r.n++; } else runs.push({ si: p.si, s: p.s, e: p.s + p.w, g: p.g, n: 1 }); }
    for (const r of runs) { const Hd = lib.hood; if (!Hd) break; const len = r.e - r.s + 200, c = (r.s + r.e) / 2, off = Hd.d / 2 + 10, g = r.g;
      put('mep', 'hood', g.u + g.du * c + g.nu * off, g.v + g.dv * c + g.nv * off, g.nu, g.nv, { w: Math.round(len), elev: Hd.elev ?? 1900 });
      if (pr.hot !== false && lib.gasvalve) put('mep', 'gasvalve', g.u + g.du * (r.s + 100) + g.nu * 60, g.v + g.dv * (r.s + 100) + g.nv * 60, g.nu, g.nv); }
    for (const p of placed) { if (p.drain && lib.drain) put('mep', 'drain', p.u + p.g.nu * (p.d / 2 + 300), p.v + p.g.nv * (p.d / 2 + 300), p.g.nu, p.g.nv);
      if (p.kw >= 3 && lib.outlet3) put('mep', 'outlet3', p.u - p.g.nu * (p.d / 2 - 20), p.v - p.g.nv * (p.d / 2 - 20), p.g.nu, p.g.nv, { elev: 1100 }); }
    if (lib.exhaustfan && kd > 2000) put('mep', 'exhaustfan', W - 400, D - 300, 0, -1);
  }
  // 6. 홀: 카운터 · 메뉴보드 · 테이블
  if (!noHall && sc.hall) {
    const Cn = lib[pr.counter]; let cd = 0;
    if (Cn) { const cwid = Math.min(cw + 400, W - 1200); cd = Cn.d; put('hall', pr.counter, cu, pv - Cn.d / 2 - 60, 0, -1, { w: Math.round(cwid), ...(pr.pel ? { color: PELI.counter } : {}) }); }
    if (pr.menu && lib.menuboard) { const Mb = lib.menuboard; for (let k = 0; k < pr.menu; k++) put('hall', 'menuboard', cu + (k - (pr.menu - 1) / 2) * (Mb.w + 100), pv - 60 - Mb.d / 2, 0, -1, { elev: 2000 }); }
    const [tt, ch, gap] = pr.table, Tb = lib[tt], Ch = lib[ch];
    if (Tb && Ch) { const vMax = pv - cd - 60 - Math.max(aisle, 1000), uM = 500, cwid = Tb.w + gap, crow = Tb.d + 2 * (Ch.d - 60) + gap;
      for (let v = 1300 + Ch.d + Tb.d / 2; v + Tb.d / 2 + Ch.d <= vMax; v += crow) for (let u = uM + Tb.w / 2; u + Tb.w / 2 <= W - uM; u += cwid) {
        if (Math.abs(u - gateU) < Tb.w / 2 + 700 && v < 2600) continue; /* 출입구 앞 비움 */
        put('hall', tt, u, v, 0, -1, pr.pel ? { color: '#14223a' } : {}); const per = Tb.w > 900 ? 2 : 1;
        for (let k = 0; k < per; k++) { const cu2 = u - Tb.w / 2 + (Tb.w * (k + 0.5)) / per, co = pr.pel ? { color: PELI.chair } : {}; if (put('hall', ch, cu2, v - Tb.d / 2 - Ch.d / 2 + 60, 0, -1, co)) rep.seats++; if (put('hall', ch, cu2, v + Tb.d / 2 + Ch.d / 2 - 60, 0, 1, co)) rep.seats++; } }
      if (!rep.seats) rep.miss.push('테이블 (홀이 좁아요)'); }
    if (sc.mep && lib.ac_cassette && rep.hallA > 15) put('hall', 'ac_cassette', W / 2, pv / 2, 0, -1);
  }
  // 설비 빠진 곳 채우기 (가스 · 3상)
  if (sc.mep) for (const c of analyze(L, lib, aisle).checks) { const it = L.items.find((q) => q.id === c.id); if (!it) continue; const a = ((it.rot || 0) * Math.PI) / 180, bx = Math.sin(a), by = -Math.cos(a), o = it.d / 2 - 20; /* 기물 뒤쪽 */
    const add = (type, over) => { if (!lib[type]) return; const n = make(type, it.x + bx * o, it.y + by * o, it.rot || 0, over); n.pz = 'mep'; L.items.push(n); rep.placed++; };
    if (/가스 밸브/.test(c.t)) add('gasvalve'); else if (/3상/.test(c.t)) add('outlet3', { elev: 1100 }); }
  // 7. 마감 (페리카나 매뉴얼 색)
  if (sc.finish) for (const w of L.walls) { if (w.pz === 'part') continue; const m = [(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2], inK = pointInPoly(m[0], m[1], kit.pts) || (() => { const c = rect(0, noHall ? 0 : pv, W, D + 400); return pointInPoly(m[0], m[1], c); })();
    if (inK) { w.finish = 'tile'; w.color = pr.pel ? PELI.kitWall : '#efefef'; } else if (pr.pel) { w.finish = 'paint'; w.color = PELI.hallWall; } }
  if (sc.finish && pr.pel) { L.ceiling = { ...(L.ceiling || {}), on: true, color: PELI.ceiling }; }
  rep.miss = [...new Set(rep.miss)]; if (!usePart && !noHall) rep.note = '주방 깊이가 얕아 칸막이 쪽 줄은 비웠어요';
  return rep;
}

/* ---------- A안 · B안 지표 ---------- */
export function metrics(L, lib, price = {}) {
  const a = analyze(L, lib), rows = bomRows(L, lib), t = bomTotals(rows, price, 0, false), rooms = L.rooms || [], ar = (k) => rooms.filter((r) => r.kind === k).reduce((s, r) => s + polyArea(r.pts), 0) / 1e6;
  const b = bounds(L), total = rooms.reduce((s, r) => s + polyArea(r.pts), 0) / 1e6 || ((b[2] - b[0]) * (b[3] - b[1])) / 1e6;
  return { items: L.items.length, seats: L.items.filter((it) => /chair|stool|bench|banquette|h_ch|h_st|f_dchair/.test(it.type)).length, kw: a.kw, bad: a.checks.filter((c) => c.lvl === 'bad').length, warn: a.checks.filter((c) => c.lvl === 'warn').length, kitchen: ar('주방'), hall: ar('홀'), total, cost: t.sub };
}
/** 작은 평면 그림 (안 비교용) */
export function thumb(cv, L, lib) {
  const g = cv.getContext('2d'), b = bounds(L), pad = 10, s = Math.min((cv.width - pad * 2) / (b[2] - b[0] || 1), (cv.height - pad * 2) / (b[3] - b[1] || 1)), X = (x) => pad + (x - b[0]) * s, Y = (y) => pad + (y - b[1]) * s;
  g.clearRect(0, 0, cv.width, cv.height);
  for (const r of L.rooms || []) { g.fillStyle = r.kind === '주방' ? 'rgba(80,140,220,.16)' : 'rgba(200,170,120,.16)'; g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill(); }
  for (const it of L.items) { const Li = lib[it.type] || {}; if (/^(ceil|ceiling|elec|plumb)$/.test(Li.layer || '')) continue; const c = corners(it); g.fillStyle = Li.cat === '주방' ? '#7c8794' : /테이블|의자/.test(Li.cat || '') ? '#c59a62' : '#9aa3ad'; g.beginPath(); c.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill(); }
  g.strokeStyle = '#3a4048'; g.lineCap = 'round'; for (const w of L.walls) { g.lineWidth = Math.max(1.5, (w.t || 150) * s); g.beginPath(); g.moveTo(X(w.x1), Y(w.y1)); g.lineTo(X(w.x2), Y(w.y2)); g.stroke(); }
}
