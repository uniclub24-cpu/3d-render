// 바닥 구배 · 단 · 기물 높이 맞추기 — 기존 앱 v23 방식 그대로
//   구배 = 배수구(점) · 트렌치(선)를 향한 "직선" 구배. 높이 = tan(각도) × max(|v|, |u| − 반길이)
//   → 등고선이 원이 아니라 직선이라 타일 줄이 휘지 않고(원형으로 안 나옴), 공간이 평면 4조각으로 나뉜다.
//   단(lift) · 구배 때문에 바닥에 묻히는 기물은 "조정 필요"로 모아 한 번에 올린다(onSlope).

export const pct2deg = (p) => Math.round((Math.atan(p / 100) * 180) / Math.PI * 1000) / 1000;
export const deg2pct = (d) => Math.round(Math.tan((d * Math.PI) / 180) * 1000) / 10;

export function pointInPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
  return c;
}
export const polyArea = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
export const polyCenter = (p) => { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; };
export function polyEdgeDist(pts, x, y) {
  let m = Infinity; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[j], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); m = Math.min(m, Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y)); }
  return m;
}

/* ---------- 배수 기물 ---------- */
export function isDrainItem(it, lib) {
  const L = lib[it.type]; if (!L) return /trench|drain|trap/.test(it.type || '');
  return (L.drain === 'out' || L.provides === 'drain' || L.shape === 'drainpt' || /trench|drain|trap/.test(it.type)) && !/sink|toilet|wash|basin|tub|shower|dish|ice|waste|urinal|vanity|appl/.test((L.shape || '') + ' ' + it.type);
}
/** 길쭉하면 선(트렌치), 아니면 점 */
export function drainGeom(it) {
  const a = ((it.rot || 0) * Math.PI) / 180, long = Math.max(it.w, it.d), lw = it.w >= it.d;
  if (long / Math.max(1, Math.min(it.w, it.d)) >= 2.5) { const ux = lw ? Math.cos(a) : -Math.sin(a), uy = lw ? Math.sin(a) : Math.cos(a), h = long / 2; return { drain: [Math.round(it.x - ux * h), Math.round(it.y - uy * h)], drain2: [Math.round(it.x + ux * h), Math.round(it.y + uy * h)] }; }
  return { drain: [Math.round(it.x), Math.round(it.y)] };
}

/* ---------- 구배 틀 ---------- */
const roomAxis = (r) => { let best = 0, a = [1, 0]; const p = r.pts; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], L = Math.hypot(dx, dy); if (L > best) { best = L; a = [dx / L, dy / L]; } } return a; };
/** 배수 기물을 옮기면 구배도 따라간다 */
export function syncDrain(level, r) { const s = r && r.slope; if (!s || !s.item) return; const it = level.items.find((q) => q.id === s.item); if (!it) { delete s.item; return; } const g = drainGeom(it); s.drain = g.drain; if (g.drain2) s.drain2 = g.drain2; else delete s.drain2; }
export function slopeFrame(r) {
  const s = r && r.slope; if (!s || !s.deg || !s.drain) return null; const t = Math.tan((s.deg * Math.PI) / 180);
  if (s.drain2) { const a = s.drain, b = s.drain2, L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > 1) return { c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], e: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], hl: L / 2, t }; }
  return { c: s.drain, e: roomAxis(r), hl: 0, t };
}
const fUV = (F, x, y) => { const dx = x - F.c[0], dy = y - F.c[1]; return [dx * F.e[0] + dy * F.e[1], -dx * F.e[1] + dy * F.e[0]]; };
export function slopeH(r, x, y) { const F = slopeFrame(r); if (!F) return 0; const [u, v] = fUV(F, x, y); return F.t * Math.max(Math.abs(v), Math.abs(u) - F.hl); }
export const roomTop = (r) => { let m = 0; for (const p of r.pts) m = Math.max(m, slopeH(r, p[0], p[1])); return Math.round(m); };

// 4개 평면 영역 (반평면 a·u + b·v + c ≥ 0) · 높이 = t × (pu·u + pv·v + p0)
const SREG = (hl) => [
  { hp: [[-1, 1, hl], [1, 1, hl], [0, 1, 0]], h: [0, 1, 0] },
  { hp: [[-1, -1, hl], [1, -1, hl], [0, -1, 0]], h: [0, -1, 0] },
  { hp: [[1, -1, -hl], [1, 1, -hl]], h: [1, 0, -hl] },
  { hp: [[-1, -1, -hl], [-1, 1, -hl]], h: [-1, 0, -hl] }];
const clipHP = (poly, f) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };
/** 공간 다각형 → 평면 조각들 [{ pts, h(x,y) }] (triangulate = (pts) → [[i,j,k]…]) */
export function slopePieces(r, triangulate) {
  const F = slopeFrame(r), out = []; if (!F) return out;
  let tri = triangulate(r.pts).map(([a, b, c]) => [r.pts[a], r.pts[b], r.pts[c]]); if (!tri.length) tri = [r.pts];
  for (const reg of SREG(F.hl)) {
    const hf = (x, y) => { const [u, v] = fUV(F, x, y); return Math.max(0, F.t * (reg.h[0] * u + reg.h[1] * v + reg.h[2])); };
    for (const t0 of tri) { let p = t0; for (const [a, b, c] of reg.hp) { p = clipHP(p, (q) => { const [u, v] = fUV(F, q[0], q[1]); return a * u + b * v + c; }); if (p.length < 3) break; } if (p.length >= 3 && polyArea(p) > 1) out.push({ pts: p, h: hf }); }
  }
  return out;
}

/* ---------- 바닥 높이 · 기물 ---------- */
/** (x, y) 에서 바닥 윗면 높이 = 가장 작은(안쪽) 공간의 단 + 구배 */
export function roomAt(level, x, y) { let best = null; for (const r of level.rooms || []) if (pointInPoly(x, y, r.pts)) { const a = polyArea(r.pts); if (!best || a < best.a) best = { a, r }; } return best ? best.r : null; }
export function floorAt(level, x, y) { const r = roomAt(level, x, y); return r ? (r.lift || 0) + slopeH(r, x, y) : 0; }
const corners = (it) => { const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2, hd = it.d / 2; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]); };
/** 다리(네 모서리 · 변 가운데 · 중심) 중 가장 높은 바닥 */
export function footMax(level, it) { const c = corners(it); let m = floorAt(level, it.x, it.y); for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; m = Math.max(m, floorAt(level, a[0], a[1]), floorAt(level, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); } return m; }
const NOFIT = ['drainpt', 'zone', 'mark', 'light', 'decal', 'road', 'sidewalk'];
export function fitable(it, lib) { const L = lib[it.type] || {}; return (L.layer || 'floor') !== 'ceil' && (L.layer || 'floor') !== 'ceiling' && (L.layer || 'floor') !== 'upper' && !NOFIT.includes(L.shape) && !isDrainItem(it, lib) && !it.asset?.wall; }
const isFloorItem = (it, lib) => { const L = lib[it.type]; return !L || !L.layer || ['floor', 'deco', 'plumb'].includes(L.layer); };
/** 기물을 그릴 높이(mm): 바닥 기물은 단 위에, onSlope 면 구배 위 가장 높은 다리에 맞춘다 */
export function itemZ(level, it, lib) {
  if (!level || !isFloorItem(it, lib) || it.elev > 50) return it.elev;
  if (it.onSlope) return it.elev + footMax(level, it);
  const r = roomAt(level, it.x, it.y); return it.elev + (r ? r.lift || 0 : 0);
}
/** 바닥(단 · 구배)에 묻혀 높이를 맞춰야 하는 양 (0 이면 괜찮음) */
export function needFit(level, it, lib) {
  if (it.onSlope || !fitable(it, lib) || !isFloorItem(it, lib) || it.elev > 50) return 0;
  const r = roomAt(level, it.x, it.y), base = r ? r.lift || 0 : 0, d = footMax(level, it) - base; return d > 3 ? Math.round(d) : 0;
}
export const slopeBad = (level, lib) => (level.rooms || []).some((r) => r.lift || slopeFrame(r)) ? level.items.filter((it) => needFit(level, it, lib)).map((it) => it.id) : [];
export const itemsIn = (level, r, lib) => level.items.filter((it) => pointInPoly(it.x, it.y, r.pts) && fitable(it, lib));
export const drainsIn = (level, r, lib) => level.items.filter((it) => isDrainItem(it, lib) && (pointInPoly(it.x, it.y, r.pts) || polyEdgeDist(r.pts, it.x, it.y) < 400));
