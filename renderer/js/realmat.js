// 블렌더 실사 재질 (Poly Haven · CC0): 재질 목록 · 자동 추천 · 기물/벽/바닥별 "세트"(같은 설정값끼리) · 점검 대시보드 · 내보내기 연결
// 재질 그림은 렌더할 때만 2K 로 받고 PC 에 보관한다 (PC 앱 = 메인 프로세스 · 그 밖 = 블렌더 스크립트가 직접 받음).
// 저장: 기물 it.rmat / 벽 w.rmat / 바닥 r.rmat = { [부분 키]: 재질 id | 'keep'(BYR 그대로) | 'proc'(BYR 절차 재질) } · 세트 이름 = .rset
import * as THREE from 'three';
import * as SITE from './site.js';

const API = 'https://api.polyhaven.com', CDN = 'https://cdn.polyhaven.com';
const CAT_KEY = 'byr.phCat', CAT_TTL = 7 * 864e5;
let CAT = null, catP = null;
const thumbs = new Map();

/* ---------- 재질 목록 (Poly Haven 텍스처) ---------- */
export async function catalog(force = false) {
  if (CAT && !force) return CAT; if (catP && !force) return catP;
  catP = (async () => {
    try { const c = JSON.parse(localStorage.getItem(CAT_KEY) || 'null'); if (c && !force && Date.now() - c.t < CAT_TTL && c.list && c.list.length) return (CAT = c.list); } catch {}
    const t = await SITE.netGet(`${API}/assets?t=textures`); const j = JSON.parse(t);
    const list = Object.entries(j).map(([id, a]) => ({ id, name: a.name || id, cats: (a.categories || []).map((x) => String(x).toLowerCase()), tags: (a.tags || []).map((x) => String(x).toLowerCase()), dim: Array.isArray(a.dimensions) ? a.dimensions : null, th: a.thumbnail_url || null }));
    try { localStorage.setItem(CAT_KEY, JSON.stringify({ t: Date.now(), list })); } catch {}
    return (CAT = list);
  })().catch((e) => { catP = null; throw e; });
  return catP;
}
export const asset = (id) => (CAT || []).find((a) => a.id === id) || null;
/** 실제 크기 (m) — Poly Haven dimensions(mm) 가 있으면 그것, 없으면 2m */
export const realSize = (id) => { const a = asset(id); const d = a && a.dim; return d && d[0] > 0 ? Math.max(0.1, Math.min(20, d[0] / 1000)) : 2; };
export const thumbUrl = (id, big) => `${CDN}/asset_img/${big ? 'primary' : 'thumbs'}/${id}.png?${big ? 'height=520' : 'width=160&height=160'}`;
/** 미리보기 그림 → blob URL (앱 보안 규칙상 외부 그림은 직접 못 띄워서 받아서 보여 준다) */
export async function thumb(id, big = false) {
  const k = id + (big ? '|b' : ''); if (thumbs.has(k)) return thumbs.get(k);
  const p = SITE.netBin(thumbUrl(id, big)).then((b) => URL.createObjectURL(new Blob([b], { type: 'image/png' }))).catch(() => null); thumbs.set(k, p); return p;
}
/** 낱말로 찾기 (id · 태그 · 분류 · 이름 점수) */
export function search(q, n = 40) {
  const toks = String(q || '').toLowerCase().split(/[\s,]+/).filter(Boolean); if (!CAT) return []; if (!toks.length) return CAT.slice(0, n);
  const sc = (a) => { let s = 0; for (const t of toks) { if (a.id.includes(t)) s += 3; if (a.tags.some((x) => x === t)) s += 2.5; else if (a.tags.some((x) => x.includes(t))) s += 1.2; if (a.cats.some((x) => x.includes(t))) s += 2; if (a.name.toLowerCase().includes(t)) s += 1; } return s; };
  return CAT.map((a) => [sc(a), a]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}
export const similar = (id, n = 6) => { const a = asset(id); if (!a) return []; return search([...a.cats, ...a.tags.slice(0, 4)].join(' '), n + 1).filter((x) => x.id !== id).slice(0, n); };

/* ---------- 자동 추천 규칙 (매뉴얼 스펙 먼저) ---------- */
const H = (c) => (c || '').toLowerCase();
const RULES = [
  { st: 'manual', code: 'LPM01', q: 'wood veneer dark walnut', tint: 0.55, t: (x) => /LPM|N703|우드 ?패널|벽패널/.test(x.name) },
  { st: 'manual', code: 'TL01', q: 'floor tiles square large', tint: 0.8, t: (x) => x.role === 'floor' && /홀|키즈|룸/.test(x.space) && x.kind !== 'wood' },
  { st: 'manual', code: 'TL03', q: 'floor tiles small grey', tint: 0.8, t: (x) => x.role === 'floor' && /주방/.test(x.space) },
  { st: 'manual', code: 'TL04', q: 'white wall tiles', tint: 0.85, t: (x) => x.role === 'wall' && /^벽면/.test(x.part) && H(x.color) === '#eeeeec' },
  { st: 'manual', code: 'IL-01', q: 'leather', tint: 0.9, t: (x) => /가죽|붙박이|IL-0|banquette/.test(x.name) && x.part !== '다리' && x.kind !== 'steel' },
  { st: 'manual', code: 'MT01', q: 'brushed metal steel', tint: 0, t: (x) => H(x.color) === '#b9bcbf' },
  { st: 'auto', q: 'brushed metal steel', tint: 0, t: (x) => x.kind === 'steel' },
  { st: 'auto', q: 'leather', tint: 0.9, t: (x) => /가죽|leather/i.test(x.name) && x.part !== '다리' },
  { st: 'auto', q: 'fabric', tint: 0.85, t: (x) => x.kind === 'fabric' || /패브릭|쿠션|소파/.test(x.name) },
  { st: 'auto', q: 'wood planks floor', tint: 0.5, t: (x) => x.role === 'floor' && x.kind === 'wood' },
  { st: 'auto', q: 'wood fine', tint: 0.6, t: (x) => x.kind === 'wood' || x.kind === 'plywood' || /원목|우드|목재/.test(x.name) },
  { st: 'auto', q: 'marble', tint: 0.4, t: (x) => x.kind === 'marble' || /대리석/.test(x.name) },
  { st: 'auto', q: 'concrete floor', tint: 0.5, t: (x) => x.kind === 'concrete' || x.kind === 'epoxy' },
  { st: 'auto', q: 'asphalt road', tint: 0, t: (x) => x.kind === 'asphalt' },
  { st: 'auto', q: 'grass', tint: 0.3, t: (x) => x.kind === 'grass' },
  { st: 'auto', q: 'floor tiles', tint: 0.8, t: (x) => x.role === 'floor' || x.kind === 'tile' },
  { st: 'auto', q: 'painted plaster wall', tint: 0.95, t: (x) => (x.role === 'wall' && /^벽면/.test(x.part)) || x.role === 'ceil' },
];
const BRAND = (x) => /^pel_|^led_flex/.test(x.type || '') || x.sign || x.kind === 'emit' || x.keepImg;
/** 부분 하나 → 기본 추천 { v, st, code, tint } · v = 재질 id | 'keep' | 'proc' | null(⚠) */
export function suggest(x) {
  if (BRAND(x)) return { v: 'keep', st: 'brand' };
  if (x.kind === 'glass' || x.kind === 'frost') return { v: 'proc', st: 'auto' };
  for (const r of RULES) if (r.t(x)) { const hit = CAT ? search(r.q, 1)[0] : null; return hit ? { v: hit.id, st: r.st, code: r.code, tint: r.tint, q: r.q } : { v: null, st: 'check', q: r.q, tint: r.tint }; }
  return { v: 'proc', st: 'auto' }; /* 플라스틱 · 칠 · 소품: BYR 절차 재질로 충분 */
}

/* ---------- 장면 → 세트(같은 설정값끼리) ---------- */
const MM = 0.001, inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const SPACE_ORDER = ['홀', '주방', '키즈룸', '룸'];
export const spaceRank = (s) => { const i = SPACE_ORDER.findIndex((k) => s.startsWith(k)); return i < 0 ? (s === '외부' || s === '기타' ? 98 : 50) : i; };
function spaceAt(L, x, y) { let best = null; for (const r of L.rooms || []) if (r.pts && r.pts.length > 2 && inPoly(x, y, r.pts)) { const nm = r.name || r.kind || '공간'; if (!best || nm.length > best.length) best = nm; } return best; }
/** 메쉬 하나의 재질 → 부분 키 (색 · 종류) */
const matKey = (m) => { if (!m) return 'x'; const c = m.color ? '#' + m.color.getHexString() : ''; return `${m.userData.kind || (m.metalness > 0.6 ? 'steel' : m.map ? 'img' : 'plain')}|${c}|${m.transparent && m.opacity < 0.6 ? 'glass' : ''}|${m.emissiveIntensity > 0.05 && m.emissive && m.emissive.getHex() ? 'emit' : ''}`; };
const kindOfKey = (k) => { const [kind, , g, e] = k.split('|'); return e ? 'emit' : g ? 'glass' : kind === 'img' ? 'plain' : kind; };
function partLabel(cat, parts, key, bb, top, own) {
  const k = kindOfKey(key); if (cat === '벽') { if (k === 'glass') return '유리'; const c = key.split('|')[1]; return own && c && c.toLowerCase() === String(own).toLowerCase() ? '벽면' : parts.size === 1 ? '벽면' : '문 · 창틀'; }
  if (parts.size === 1) return '—'; const h = bb.max.y - bb.min.y;
  if (k === 'glass') return '유리'; if (k === 'emit') return '빛나는 면';
  if (bb.max.y < top * 0.6 && h > top * 0.25) return '다리'; if (h < top * 0.14 && bb.max.y > top * 0.3) return cat === '의자' ? '좌판' : '상판';
  if (bb.min.y > top * 0.5) return cat === '의자' ? '등판' : '윗부분'; return cat === '의자' ? '프레임' : '본체';
}
/**
 * 장면을 훑어 세트 목록을 만든다 → rows: [{ key, space, kind:'item'|'wall'|'room'|'ceil', name, count, objs, parts: [{ pk, label, color, kind, mats:[mesh] }] }]
 * 같은 기물이라도 색 · 마감 · 재질 태그가 다르면 다른 세트. 벽 · 바닥은 이름(없으면 위치로 지은 이름) + 설정값.
 */
export function buildRows(engine, S, L) {
  const rows = new Map(), lib = S.lib, add = (rk, base) => { if (!rows.has(rk)) rows.set(rk, { ...base, key: rk, objs: [], parts: new Map() }); return rows.get(rk); };
  const wb = new THREE.Box3(), tmp = new THREE.Box3();
  const collect = (row, g, obj, top) => { const per = new Map(); g.traverse((o) => { if (!o.isMesh || !o.visible || o.userData.poche) return; let v = true; for (let p = o; p && p !== g.parent; p = p.parent) if (!p.visible) { v = false; break; } if (!v) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { const k = matKey(m); if (!per.has(k)) per.set(k, { meshes: [], bb: new THREE.Box3(), m }); const e = per.get(k); e.meshes.push(o); tmp.setFromObject(o); e.bb.union(tmp); } });
    const base = g.getWorldPosition(new THREE.Vector3()).y; for (const [k, e] of per) { const lb = e.bb.clone(); lb.min.y -= base; lb.max.y -= base; if (!row.parts.has(k)) row.parts.set(k, { pk: k, label: partLabel(row.cat, per, k, lb, top, obj && obj.color), color: e.m && e.m.color ? '#' + e.m.color.getHexString() : '', kind: kindOfKey(k), keepImg: !!(e.m && e.m.map && !e.m.userData.kind), meshes: [] }); row.parts.get(k).meshes.push(...e.meshes); } row.objs.push(obj); };
  /* 기물 */
  if (engine.items) for (const g of engine.items.children) {
    const it = L.items.find((q) => q.id === g.userData.itemId); if (!it || !g.visible) continue; const Lb = lib[it.type] || {};
    const sig = [it.type, it.color || '', it.color2 || '', it.color3 || '', it.finish || '', JSON.stringify(it.rmat || {})].join('|');
    const row = add('i:' + sig, { kind: 'item', type: it.type, cat: Lb.cat || '', sign: !!Lb.sign, space: spaceAt(L, it.x, it.y) || '외부', name: it.rset || it.name || Lb.name || it.type, base: Lb.name || it.type });
    wb.setFromObject(g); collect(row, g, it, Math.max(0.05, wb.max.y - wb.min.y));
  }
  /* 벽 (이름 없으면 위치로 이름 짓기) */
  if (engine.structure) engine.structure.traverse((g) => {
    if (!g.userData.wallId) return; const w = L.walls.find((q) => q.id === g.userData.wallId); if (!w) return;
    const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, nx = -(w.y2 - w.y1) / len, ny = (w.x2 - w.x1) / len, off = (w.t || 150) / 2 + 250;
    const a = spaceAt(L, mx + nx * off, my + ny * off), b = spaceAt(L, mx - nx * off, my - ny * off), sp = a && b && a !== b ? `${a} | ${b}` : a || b || '외벽';
    const ops = (L.openings || []).filter((o) => o.wall === w.id), feat = ops.some((o) => /door/.test(o.type)) ? ' · 문' : ops.length ? ' · 창' : '';
    const auto = w.pz === 'glass' ? `${sp} 강화유리 벽` : `${sp} 벽${feat}`, nm = w.name || auto;
    const sig = [nm, w.color || '', w.finish || '', w.pz || '', JSON.stringify(w.rmat || {})].join('|');
    const row = add('w:' + sig, { kind: 'wall', cat: '벽', space: (a || b || '외부').split(' | ')[0], name: w.rset || nm, base: nm }); collect(row, g, w, (w.h || 2700) * MM);
  });
  /* 바닥 */
  if (engine.structure) engine.structure.traverse((m) => {
    if (!m.isMesh || !m.userData.roomId) return; const r = (L.rooms || []).find((q) => q.id === m.userData.roomId); if (!r) return; const nm = r.name || r.kind || '바닥';
    const sig = [nm, r.finish || '', r.color || '', r.tex ? 'tex' : '', JSON.stringify(r.rmat || {})].join('|');
    const row = add('r:' + sig, { kind: 'room', cat: '바닥', space: nm, name: r.rset || `${nm} 바닥`, base: `${nm} 바닥` }); collect(row, m, r, 0.1);
  });
  /* 천장 */
  if (engine.structure) for (const c of engine.structure.getObjectsByProperty('name', '천장')) { const row = add('c:' + (L.id || 'L'), { kind: 'ceil', cat: '천장', space: '천장', name: '천장', base: '천장' }); collect(row, c, L, 0.1); }
  const out = [...rows.values()].map((r) => ({ ...r, count: r.objs.length, parts: [...r.parts.values()] }));
  for (const r of out) { const seen = {}; for (const p of r.parts) { if (seen[p.label]) p.label += ' ' + ++seen[p.label]; else seen[p.label] = 1; } }
  /* 같은 기물인데 세트가 여럿이면 "세트1 · 세트2" 표시 */
  const byBase = {}; for (const r of out) (byBase[r.kind + r.base] ||= []).push(r); for (const g of Object.values(byBase)) if (g.length > 1) g.forEach((r, i) => { r.setNo = i + 1; });
  return out;
}
/** 세트의 저장소(rmat 을 가진 객체들) */
const holders = (row) => (row.kind === 'ceil' ? row.objs.map((L) => (L.ceiling ||= { on: true })) : row.objs);
export const getAssign = (row, pk) => { const h = holders(row)[0]; return h && h.rmat ? h.rmat[pk] : undefined; };
export function setAssign(row, pk, v) { for (const h of holders(row)) { h.rmat ||= {}; if (v === undefined) delete h.rmat[pk]; else h.rmat[pk] = v; } }
export function setSetName(row, name) { for (const h of row.kind === 'ceil' ? [] : row.objs) { if (name) h.rset = name; else delete h.rset; } }
export function ctxOf(row, p) { return { role: row.kind === 'item' ? 'item' : row.kind === 'room' ? 'floor' : row.kind, kind: p.kind, color: p.color, part: p.label, name: `${row.name} ${row.base}`, space: row.space, type: row.type, sign: row.sign, keepImg: p.keepImg }; }
/** 부분 하나의 최종 값 { v, st, tint, code } */
export function resolve(row, p) { const a = getAssign(row, p.pk), sg = suggest(ctxOf(row, p)); if (a === undefined) return sg; return { v: a, st: 'set', tint: sg.tint ?? (a === 'keep' || a === 'proc' ? 0 : 0.6), code: sg.code }; }
/** 내보내기용: 메쉬 → { id, tint, size } (Poly Haven 재질만) */
export function meshPlan(rows) {
  const map = new Map(); for (const r of rows) for (const p of r.parts) { const R = resolve(r, p); if (!R.v || R.v === 'keep' || R.v === 'proc') continue; const col = r.kind === 'room' || r.kind === 'wall' ? r.objs[0] && r.objs[0].color : p.keepImg || /^#f{6}$/i.test(p.color) ? null : p.color; for (const m of p.meshes) map.set(m, { id: R.v, tint: col ? R.tint ?? 0.6 : 0, size: realSize(R.v), color: col || null }); } return map;
}
