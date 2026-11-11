/* ================================================================
   v23 · 구배 단순화 (직선 구배 · 평면 조각 메시 · 타일 그대로) · 구배 간단 설정(각도 → 배수구 찍기)
         조정 필요 · 일괄조정 (기물을 구배 · 단 위로)
         기물 추가 (GLB · GLTF · OBJ · STL · PLY · DAE · 3MF · OFF · 서버 보관) · 사진 / 그림으로 기물 만들기
         튀김기 · 화구 열압력 · 연기 흐름 · 벽 그림 · 시트지 · 새 기물 · 배경 소품 · 지게차
   ================================================================ */
{
/* ---------- 1. 구배 모델: 배수구(점) · 트렌치(선)를 향한 직선 구배 ----------
   높이 = tan(각도) × max(|v|, |u| − 반길이)  (u: 배수 방향 축, v: 수직)
   → 등고선이 원이 아니라 직선이라 타일 줄이 휘지 않고, 공간이 4개의 평면 조각으로 나뉘어요 */
const syncDrain = (r) => { const s = r && r.slope; if (!s || !s.item) return; const it = P.items.find((q) => q.id === s.item); if (!it) { delete s.item; return; } const g = drainGeom(it); s.drain = g.drain; if (g.drain2) s.drain2 = g.drain2; else delete s.drain2; };
const roomAxis = (r) => { let best = 0, a = [1, 0]; const p = r.pts; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], L = Math.hypot(dx, dy); if (L > best) { best = L; a = [dx / L, dy / L]; } } return a; };
function slopeFrame(r) {
  const s = r && r.slope; if (!s || !s.deg) return null; syncDrain(r); if (!s.drain) return null; const t = Math.tan(s.deg * Math.PI / 180);
  if (s.drain2) { const a = s.drain, b = s.drain2, L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > 1) return { c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], e: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], hl: L / 2, t }; }
  return { c: s.drain, e: roomAxis(r), hl: 0, t };
}
window.slopeFrame = slopeFrame;
const fUV = (F, x, y) => { const dx = x - F.c[0], dy = y - F.c[1]; return [dx * F.e[0] + dy * F.e[1], -dx * F.e[1] + dy * F.e[0]]; };
slopeH = function (r, x, y) { const F = slopeFrame(r); if (!F) return 0; const [u, v] = fUV(F, x, y); return F.t * Math.max(Math.abs(v), Math.abs(u) - F.hl); };
// 4개 평면 영역 (반평면 a·u + b·v + c ≥ 0) · 높이 = t × (pu·u + pv·v + p0)
const SREG = (hl) => [
  { hp: [[-1, 1, hl], [1, 1, hl], [0, 1, 0]], h: [0, 1, 0] },
  { hp: [[-1, -1, hl], [1, -1, hl], [0, -1, 0]], h: [0, -1, 0] },
  { hp: [[1, -1, -hl], [1, 1, -hl]], h: [1, 0, -hl] },
  { hp: [[-1, -1, -hl], [-1, 1, -hl]], h: [-1, 0, -hl] }];
const clipHP = (poly, f) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; };
const area2 = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function slopePieces(r) {
  const F = slopeFrame(r), out = []; if (!F) return out;
  let tri = earcut2(r.pts).map(([a, b, c]) => [r.pts[a], r.pts[b], r.pts[c]]); if (!tri.length) tri = [r.pts];
  for (const reg of SREG(F.hl)) {
    const hf = (x, y) => { const [u, v] = fUV(F, x, y); return Math.max(0, F.t * (reg.h[0] * u + reg.h[1] * v + reg.h[2])); };
    for (const t0 of tri) { let p = t0; for (const [a, b, c] of reg.hp) { p = clipHP(p, (q) => { const [u, v] = fUV(F, q[0], q[1]); return a * u + b * v + c; }); if (p.length < 3) break; } if (p.length >= 3 && area2(p) > 1) out.push({ pts: p, h: hf }); }
  }
  return out;
}
/* 3D: 구배 바닥 — 평면 조각마다 위에서 투영한 UV라 타일 · 패턴이 그대로 이어져요 */
{ const _dr = drawRoom3d; drawRoom3d = function (r, i) {
  if (!slopeFrame(r)) return _dr(r, i);
  const T = xf(0, 0, 0), lift = r.lift || 0, base = 1 + i * 0.7, key = matTex(r.finish.type), g = grp(key === 'tile' ? 'tile' : key, matA(r.finish.type));
  TINT = isSelected('room', r.id); const col = tintC(hexRGB(r.finish.color)), pieces = slopePieces(r);
  const P3 = (pc, q, dy) => T.P(q[0], lift + base + pc.h(q[0], q[1]) + (dy || 0), q[1]);
  const fan = (gg, pc, pts, c, dy) => { for (let k = 1; k + 1 < pts.length; k++) { const A = P3(pc, pts[0], dy), B = P3(pc, pts[k], dy), C = P3(pc, pts[k + 1], dy), u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1; n = n.map((z) => z / l); if (n[1] < 0) n = n.map((z) => -z); quad(gg, [A, B, C, C], n, c); } };
  for (const pc of pieces) fan(g, pc, pc.pts, col);
  if (r.pattern && !r.pattern.off) { const b = aabb(r.pts), s = r.pattern.size || 600, cxm = (b[0] + b[2]) / 2, cym = (b[1] + b[3]) / 2, g2 = grp('tile'), c2 = tintC(hexRGB(r.pattern.color2 || '#888888'));
    for (let ii = -Math.ceil((cxm - b[0]) / s); cxm + ii * s - s / 2 < b[2]; ii++) for (let j = -Math.ceil((cym - b[1]) / s); cym + j * s - s / 2 < b[3]; j++) { if (((ii % 2) + 2) % 2 || ((j % 2) + 2) % 2) continue;
      const x0 = cxm + ii * s - s / 2 + 2, x1 = cxm + ii * s + s / 2 - 2, y0 = cym + j * s - s / 2 + 2, y1 = cym + j * s + s / 2 - 2;
      for (const pc of pieces) { let p = pc.pts; for (const f of [(q) => q[0] - x0, (q) => x1 - q[0], (q) => q[1] - y0, (q) => y1 - q[1]]) { p = clipHP(p, f); if (p.length < 3) break; } if (p.length >= 3 && area2(p) > 100) fan(g2, pc, p, c2, 1.5); } } }
  const s = r.slope; if (!s.item && !s.drain2) { const d = s.drain; box(T, d[0] - 90, d[0] + 90, lift + base, lift + base + 4, d[1] - 90, d[1] + 90, '#2b2d31', 'steel'); }
  if (lift > 0) { const c0 = tintC(hexRGB(r.finish.color)).map((z) => z * .78), gp = grp('plain');
    for (let k = 0, j = r.pts.length - 1; k < r.pts.length; j = k++) { const a = r.pts[j], b = r.pts[k], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, n = Math.max(1, Math.ceil(L / 200));
      for (let q = 0; q < n; q++) { const p0 = [a[0] + dx * q / n, a[1] + dz * q / n], p1 = [a[0] + dx * (q + 1) / n, a[1] + dz * (q + 1) / n];
        quad(gp, [T.P(p0[0], 0, p0[1]), T.P(p1[0], 0, p1[1]), T.P(p1[0], lift + base + slopeH(r, ...p1), p1[1]), T.P(p0[0], lift + base + slopeH(r, ...p0), p0[1])], [dz / L, 0, -dx / L], c0); } } }
  TINT = false;
}; }
/* 2D: 물 흐름 화살표 · 꺾이는 선(골) · 라벨 */
const pctOf = (deg) => Math.round(Math.tan(deg * Math.PI / 180) * 1000) / 10;
const roomTop = (r) => { let m = 0; for (const p of r.pts) m = Math.max(m, slopeH(r, p[0], p[1])); return Math.round(m); };
{ const _d2 = drawRooms2d; drawRooms2d = function () {
  const keep = rooms().map((r) => [r, r.slope]); for (const r of rooms()) if (r.slope) r.slope = { ...r.slope, deg: 0 };
  try { _d2(); } finally { for (const [r, s] of keep) r.slope = s; }
  if (!window.ROOMS_ON || vis.floorL === false) return;
  for (const r of rooms()) { const F = slopeFrame(r); if (!F) continue; cx.save(); const n = [-F.e[1], F.e[0]], W = (u, v) => [F.c[0] + F.e[0] * u + n[0] * v, F.c[1] + F.e[1] * u + n[1] * v];
    cx.strokeStyle = 'rgba(31,111,176,.55)'; cx.lineWidth = 1; cx.setLineDash([4, 4]); // 골(꺾이는 선)
    for (const su of [-1, 1]) for (const sv of [-1, 1]) { let L = 0; const a = W(su * F.hl, 0); while (L < 40000) { const q = W(su * (F.hl + L + 100), sv * (L + 100)); if (!pointInPoly(q[0], q[1], r.pts)) break; L += 100; } if (L > 0) { const q = W(su * (F.hl + L), sv * L); cx.beginPath(); cx.moveTo(...toS(...a)); cx.lineTo(...toS(...q)); cx.stroke(); } }
    cx.setLineDash([]); cx.strokeStyle = '#2f8fd6'; cx.fillStyle = '#2f8fd6'; cx.lineWidth = 1.2; const b = aabb(r.pts), st = Math.max(500, Math.min(900, (b[2] - b[0] + b[3] - b[1]) / 12));
    for (let x = b[0] + st / 2; x < b[2]; x += st) for (let y = b[1] + st / 2; y < b[3]; y += st) { if (!pointInPoly(x, y, r.pts)) continue; const [u, v] = fUV(F, x, y); if (Math.max(Math.abs(v), Math.abs(u) - F.hl) < 250) continue;
      const dir = Math.abs(v) >= Math.abs(u) - F.hl ? n.map((z) => -Math.sign(v) * z) : F.e.map((z) => -Math.sign(u) * z), a0 = toS(x, y), e0 = toS(x + dir[0] * 240, y + dir[1] * 240), ux = e0[0] - a0[0], uy = e0[1] - a0[1], l = Math.hypot(ux, uy) || 1;
      cx.beginPath(); cx.moveTo(...a0); cx.lineTo(...e0); cx.stroke(); cx.beginPath(); cx.moveTo(...e0); cx.lineTo(e0[0] - ux / l * 6 + uy / l * 4, e0[1] - uy / l * 6 - ux / l * 4); cx.lineTo(e0[0] - ux / l * 6 - uy / l * 4, e0[1] - uy / l * 6 + ux / l * 4); cx.fill(); }
    if (!F.hl) { const q = toS(...F.c); cx.fillStyle = '#1f6fb0'; cx.beginPath(); cx.arc(q[0], q[1], 8, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 10px system-ui'; cx.textAlign = 'center'; cx.fillText('D', q[0], q[1] + 3.5); }
    if (V.s > 0.02) { const m = toS(...polyCenter(r.pts)); cx.font = '600 11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = '#1f6fb0'; cx.fillText(`구배 ${pctOf(r.slope.deg)}% · 가장 높은 곳 +${roomTop(r)}mm`, m[0], m[1] + 10); }
    cx.restore(); }
}; }

/* ---------- 2. 기물 높이: 조정 필요 · 일괄조정 ---------- */
const footMax = (it) => { const c = corners(it); let m = floorAt(it.x, it.y); for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; m = Math.max(m, floorAt(a[0], a[1]), floorAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)); } return m; };
const FITLY = ['floor', 'deco', 'plumb'];
const fitable = (it) => { if (it.hidden) return false; const s = spec(it); return FITLY.includes(s.layer) && !['drainpt', 'zone', 'mark', 'light', 'decal', 'wsheet', 'dsheet', 'wallfilm', 'wallpic', 'road', 'sidewalk'].includes(s.L.shape) && !isDrainItem(it) && !it.film; };
function needFit(it) { if (it.onSlope || !fitable(it)) return 0; const s = spec(it); if ((s.L.elev || 0) > 50 && it.elev == null) return 0; if (it.elev != null && it.elev > 50) return 0;
  const base = it.elev != null ? 0 : floorAt(it.x, it.y), d = footMax(it) - base; return d > 3 ? d : 0; }
var SLOPEBAD = [];
window.slopeBad = () => SLOPEBAD;
{ const _z = zOf; zOf = function (it) { const z = _z(it); if (!it.onSlope || !window.ROOMS_ON || !P || !rooms().length) return z; const s = spec(it); if (!FITLY.includes(s.layer)) return z; return s.elev + footMax(it); }; }
{ const _an = analyze; analyze = function () { _an(); SLOPEBAD = []; try { if (window.ROOMS_ON && P && rooms().some((r) => r.lift || slopeFrame(r))) for (const it of P.items) { const d = needFit(it); if (!d) continue; SLOPEBAD.push(it.id);
    if (!conflicts.has(it.id)) { conflicts.set(it.id, `구배 · 단 높이와 ${Math.round(d)}mm 어긋남 · 조정 필요`); checks.push({ lvl: 'bad', id: it.id, t: `${spec(it).name}: 바닥 구배 · 단과 ${Math.round(d)}mm 어긋남 → "조정 필요 · 일괄조정"` }); } } } catch (e) { console.warn(e); }
  try { renderSlopeFab(); } catch (e) {} }; }
function fitItems(ids, msg) { let n = 0; for (const id of ids) { const it = itemOf(id); if (it && fitable(it)) { it.onSlope = true; n++; } } if (!n) { toast('맞출 기물이 없어요'); return; } commit(); dirty3d = true; renderSW(); toast(msg || `기물 ${n}개를 구배 · 단 위로 올렸어요 (다리 가장 높은 곳 기준)`); }
const itemsIn = (r) => P.items.filter((it) => pointInPoly(it.x, it.y, r.pts) && fitable(it));

/* ---------- 3. 구배 간단 설정 (구배 → 각도 → 배수구 찍기) ---------- */
const SW = { rid: null, pick: null, a: null, pct: 1 };
function wholeFloor() { const b = bounds(), T = (P.wallT || 150) / 2; if (b[2] - b[0] < 500) return null; const r = makeRoomQuiet([[b[0] + T, b[1] + T], [b[2] - T, b[1] + T], [b[2] - T, b[3] - T], [b[0] + T, b[3] - T]], '기타'); r.name = '전체 바닥'; return r; }
function slopeRoomFor(src) {
  if (src && src.kind === 'room') return roomOf(src.id);
  if (src && src.kind === 'item') { const it = itemOf(src.id); if (!it) return null; let r = smallestRoomAt(it.x, it.y); if (!r) { let best = null; for (const q of rooms()) { const d = polyEdgeDist(q.pts, it.x, it.y); if (d < 400 && (!best || d < best.d)) best = { d, q }; } r = best && best.q; } return r || roomForPoint(it.x, it.y) || wholeFloor(); }
  const p = LASTPT || (() => { const b = bounds(); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; })(); return roomForPoint(p[0], p[1]) || wholeFloor();
}
function openSlopeWiz(src) {
  src = src || sel; if (!P) return; if (!window.ROOMS_ON) window.ROOMS_ON = true;
  const r = slopeRoomFor(src); if (!r) { toast('먼저 벽을 그려 주세요'); return; }
  SW.rid = r.id; SW.pick = null; SW.a = null; SW.pct = r.slope && r.slope.deg ? pctOf(r.slope.deg) : SW.pct || 1;
  if (src && src.kind === 'item') { const it = itemOf(src.id); if (it && isDrainItem(it)) { P.items = P.items.filter((x) => x === it || !((x.tag === '바닥 배수구 (구배)' || x.tag === '트렌치 (구배)') && x.room === r.id)); r.slope = { deg: pct2deg(SW.pct), ...drainGeom(it), item: it.id }; commit(); dirty3d = true; toast(`"${it.tag || libGet(it.type).name}" 쪽으로 ${SW.pct}% 구배 · 각도만 바꾸면 돼요`); } }
  else commit(true);
  renderSW(); draw2d();
}
window.openSlopeWiz = openSlopeWiz;
function applyPct(p) { const r = roomOf(SW.rid); if (!r) return; SW.pct = clamp(Math.round((+p || 1) * 100) / 100, 0.1, 25); if (r.slope && r.slope.drain) { r.slope.deg = pct2deg(SW.pct); commit(); dirty3d = true; renderSW(); }
  else { startPick('pt'); } }
function startPick(k) { SW.pick = k; SW.a = null; renderSW(); draw2d(); toast(k === 'line' ? '트렌치 시작점을 누르세요 (도면 · 3D) · Esc 취소' : '배수구 위치를 누르세요 (도면 · 3D) · 이미 놓인 배수구 · 트렌치를 눌러도 돼요 · Esc 취소'); }
function setDrain(r, it, msg) { P.items = P.items.filter((x) => x === it || !((x.tag === '바닥 배수구 (구배)' || x.tag === '트렌치 (구배)') && x.room === r.id)); r.slope = { deg: pct2deg(SW.pct), ...drainGeom(it), item: it.id }; SW.pick = null; SW.a = null; commit(); dirty3d = true; draw2d(); renderSW();
  const bad = itemsIn(r).filter((x) => needFit(x)).length; toast(`${msg || '구배를 잡았어요'} · ${SW.pct}% · 가장 높은 곳 +${roomTop(r)}mm${bad ? ` · 높이 맞출 기물 ${bad}개` : ''}`); }
function pickAt(wx, wy, hitItem) {
  const r = roomOf(SW.rid); if (!r) { SW.pick = null; return; }
  let near = hitItem && isDrainItem(hitItem) ? hitItem : null;
  if (!near) { let best = null; for (const it of P.items) { if (!isDrainItem(it)) continue; const a = (it.rot || 0) * Math.PI / 180, dx = wx - it.x, dy = wy - it.y, lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a), d = Math.max(0, Math.abs(lx) - it.w / 2) + Math.max(0, Math.abs(ly) - it.d / 2); if (d < 250 && (!best || d < best.d)) best = { d, it }; } near = best && best.it; }
  if (near && SW.pick === 'pt') { setDrain(r, near, `"${near.tag || libGet(near.type).name}" 쪽으로 구배를 잡았어요`); return; }
  const inside = pointInPoly(wx, wy, r.pts) || polyEdgeDist(r.pts, wx, wy) < 400; if (!inside) { toast(`"${r.name}" 안쪽을 눌러 주세요`); return; }
  const q = [Math.round(wx), Math.round(wy)];
  if (SW.pick === 'pt') { P.items = P.items.filter((it) => !((it.tag === '바닥 배수구 (구배)' || it.tag === '트렌치 (구배)') && it.room === r.id));
    const it = { id: uid('i'), type: 'drain', x: q[0], y: q[1], w: 150, d: 150, rot: 0, tag: '바닥 배수구 (구배)', room: r.id }; P.items.push(it); setDrain(r, it, '배수구를 놓고 구배를 잡았어요'); return; }
  if (!SW.a) { SW.a = q; toast('트렌치 끝점을 누르세요'); draw2d(); return; }
  const a = SW.a, L = Math.hypot(q[0] - a[0], q[1] - a[1]); if (L < 200) { toast('트렌치가 너무 짧아요 · 끝점을 다시 누르세요'); return; }
  P.items = P.items.filter((it) => !((it.tag === '바닥 배수구 (구배)' || it.tag === '트렌치 (구배)') && it.room === r.id));
  const it = { id: uid('i'), type: 'trench', x: Math.round((a[0] + q[0]) / 2), y: Math.round((a[1] + q[1]) / 2), w: Math.round(L), d: 200, rot: Math.round(Math.atan2(q[1] - a[1], q[0] - a[0]) * 180 / Math.PI), tag: '트렌치 (구배)', room: r.id };
  P.items.push(it); setDrain(r, it, '트렌치를 놓고 구배를 잡았어요');
}
cv.addEventListener('pointerdown', (e) => { if (!SW.pick || e.button > 0) return; e.stopImmediatePropagation(); e.preventDefault(); const b = cv.getBoundingClientRect(); pickAt(...toW(e.clientX - b.left, e.clientY - b.top)); }, true);
gc.addEventListener('pointerdown', (e) => { if (!SW.pick || e.button > 0) return; const r = roomOf(SW.rid), h = rayHit(e); let it = null, g = null;
  if (h && h.sel && h.sel.kind === 'item') { it = itemOf(h.sel.id); if (it && !isDrainItem(it)) it = null; }
  g = h && h.p && h.sel && (h.sel.kind === 'room' || h.sel.kind === 'floor' || it) ? [h.p[0], h.p[2]] : planeHit(e, (r && r.lift) || 0); if (!g) return; e.stopImmediatePropagation(); e.preventDefault(); pickAt(g[0], g[1], it); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && SW.pick) { e.stopImmediatePropagation(); SW.pick = null; SW.a = null; renderSW(); draw2d(); } }, true);
{ const _d = draw2d; draw2d = function () { _d(); try { if (!P || view === '3d' || !SW.rid || OFF) return; const r = roomOf(SW.rid); if (!r) return; cx.save(); poly(r.pts, SW.pick ? 'rgba(10,132,255,.10)' : null, '#0a84ff', 2.5, [8, 5]);
  if (SW.pick) { cx.strokeStyle = '#ff9f0a'; cx.lineWidth = 3; for (const it of P.items) { if (!isDrainItem(it)) continue; const c = toS(it.x, it.y); cx.beginPath(); cx.arc(c[0], c[1], Math.max(10, Math.max(it.w, it.d) / 2 * V.s + 6), 0, 7); cx.stroke(); } }
  if (SW.a) { const a = toS(...SW.a); cx.fillStyle = '#1f6fb0'; cx.beginPath(); cx.arc(a[0], a[1], 6, 0, 7); cx.fill(); } cx.restore(); } catch (e) {} }; }

function renderSW() {
  let el = $('#swz'); const r = SW.rid && P ? roomOf(SW.rid) : null;
  if (!r) { if (el) el.hidden = true; SW.rid = null; try { renderSlopeFab(); } catch (e) {} return; }
  if (!el) { $('#stage').insertAdjacentHTML('beforeend', '<div class="depanel swz" id="swz" role="dialog" aria-label="구배 간단 설정"></div>'); el = $('#swz');
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-sw]'); if (!b) return; const k = b.dataset.sw, R = roomOf(SW.rid); if (!R) return;
      if (k === 'x') { SW.rid = null; SW.pick = null; renderSW(); draw2d(); }
      if (k === 'pct') applyPct(+b.dataset.v);
      if (k === 'pt' || k === 'line') { if (SW.pick === k) { SW.pick = null; renderSW(); } else startPick(k); }
      if (k === 'dr') { const it = itemOf(b.dataset.id); if (it) setDrain(R, it, `"${it.tag || libGet(it.type).name}" 쪽으로 구배를 잡았어요`); }
      if (k === 'fit') fitItems(itemsIn(R).filter((x) => needFit(x)).map((x) => x.id));
      if (k === 'fitall') fitItems(itemsIn(R).map((x) => x.id), `"${R.name}" 안 기물을 모두 구배 · 단 위에 올렸어요`);
      if (k === 'unfit') { let n = 0; for (const it of itemsIn(R)) if (it.onSlope) { delete it.onSlope; n++; } commit(); dirty3d = true; renderSW(); toast(n ? `${n}개를 원래 높이로 돌렸어요` : '올린 기물이 없어요'); }
      if (k === 'off') { R.slope = null; P.items = P.items.filter((it) => !((it.tag === '바닥 배수구 (구배)') && it.room === R.id)); commit(); dirty3d = true; renderSW(); toast('구배를 지웠어요'); }
      if (k === 'sel') pickSel({ kind: 'room', id: R.id }); });
    el.addEventListener('change', (e) => { if (e.target.id === 'swPct') applyPct(e.target.value); if (e.target.id === 'swDeg') applyPct(Math.tan((+e.target.value || 0.5) * Math.PI / 180) * 100); }); }
  const s = r.slope && r.slope.drain && r.slope.deg ? r.slope : null, ds = drainsIn(r), its = itemsIn(r), bad = its.filter((x) => needFit(x)), on = its.filter((x) => x.onSlope).length, pct = s ? pctOf(s.deg) : SW.pct;
  const cur = s ? (s.drain2 ? `트렌치 ${(Math.hypot(s.drain2[0] - s.drain[0], s.drain2[1] - s.drain[1]) / 1000).toFixed(2)}m 쪽으로` : '배수구(점) 쪽으로') + ` · 가장 높은 곳 +${roomTop(r)}mm` : '아직 배수구 위치가 없어요';
  el.hidden = false; try { renderSlopeFab(); } catch (e) {}
  el.innerHTML = `<div class="dehd"><b>구배 · ${esc(r.name)}</b><button class="btn" data-sw="x" aria-label="닫기">닫기</button></div>
    <p class="hint">${esc(r.kind || '')}${r.lift ? ` · 단 +${r.lift}mm 위에서 기울여요` : ''} · <button class="linkb" data-sw="sel">공간 상세</button></p>
    <div class="lbl">① 각도</div>
    <div class="row wrap">${[0.5, 1, 1.5, 2, 3].map((v) => `<button class="chipb ${Math.abs(v - pct) < 0.01 ? 'on' : ''}" data-sw="pct" data-v="${v}" aria-pressed="${Math.abs(v - pct) < 0.01}">${v}%</button>`).join('')}</div>
    <div class="g3"><label class="fld"><span>경사 %</span><input id="swPct" type="number" min="0.1" max="25" step="0.1" value="${pct}"></label><label class="fld"><span>각도 °</span><input id="swDeg" type="number" min="0.05" max="14" step="0.05" value="${Math.round(Math.atan(pct / 100) * 180 / Math.PI * 1000) / 1000}"></label><label class="fld"><span>1m당</span><input disabled value="${Math.round(pct * 10)}mm"></label></div>
    <div class="lbl">② 배수구 위치</div>
    <div class="row wrap"><button class="btn ${SW.pick === 'pt' ? 'pri' : s ? '' : 'pri'}" data-sw="pt">${SW.pick === 'pt' ? '누르세요… (Esc 취소)' : '배수구 위치 찍기'}</button><button class="btn ${SW.pick === 'line' ? 'pri' : ''}" data-sw="line">${SW.pick === 'line' ? (SW.a ? '끝점을 누르세요…' : '시작점을 누르세요…') : '트렌치 선 그리기'}</button></div>
    ${ds.length ? `<div class="row wrap">${ds.map((it) => `<button class="chipb ${s && s.item === it.id ? 'on' : ''}" data-sw="dr" data-id="${it.id}" aria-pressed="${!!(s && s.item === it.id)}">${esc(it.tag || libGet(it.type).name)}</button>`).join('')}</div>` : ''}
    <p class="hint">${cur}</p>
    <div class="lbl">③ 기물 높이</div>
    <p class="hint">${bad.length ? `<b style="color:var(--bad,#e5484d)">조정 필요 ${bad.length}개</b> · 구배 · 단 때문에 다리가 바닥에 묻혀요` : on ? `${on}개가 구배 위에 올라가 있어요` : its.length ? '충돌 없음' : '이 공간에 기물이 없어요'}</p>
    <div class="row wrap"><button class="btn ${bad.length ? 'pri' : ''}" data-sw="fit" ${bad.length ? '' : 'disabled'}>조정 필요 · 일괄조정</button><button class="btn" data-sw="fitall" ${its.length ? '' : 'disabled'}>모두 올리기</button><button class="btn" data-sw="unfit" ${on ? '' : 'disabled'}>원래 높이로</button></div>
    <div class="row"><button class="btn danger" data-sw="off" ${s ? '' : 'disabled'}>구배 지우기</button></div>`;
}
window.renderSW = renderSW;
// 바닥 · 공간 · 배수 기물을 고르면 떠 있는 "구배" 단추 + 조정 필요 단추
function renderSlopeFab() {
  let f = $('#slopeFab'); if (!f) { $('#stage').insertAdjacentHTML('beforeend', '<div class="slopefab glass" id="slopeFab" hidden></div>'); f = $('#slopeFab');
    f.addEventListener('click', (e) => { const b = e.target.closest('[data-sf]'); if (!b) return; if (b.dataset.sf === 'sw') openSlopeWiz(sel); if (b.dataset.sf === 'fit') fitItems([...SLOPEBAD]); }); }
  const bd = document.body.classList, it = sel && sel.kind === 'item' ? itemOf(sel.id) : null, can = sel && multi.length <= 1 && (sel.kind === 'floor' || sel.kind === 'room' || (it && isDrainItem(it)));
  const show = P && !(SW.rid && $('#swz') && !$('#swz').hidden) && !bd.contains('clean') && !bd.contains('show') && !(typeof WALK !== 'undefined' && WALK.on) && (can || SLOPEBAD.length);
  if (!show) { f.hidden = true; return; }
  f.hidden = false; f.innerHTML = `${can ? `<button class="btn pri" data-sf="sw">${it ? '이 배수 기물로 구배' : '구배'}</button>` : ''}${SLOPEBAD.length ? `<button class="btn warn" data-sf="fit" title="구배 · 단 때문에 바닥에 묻힌 기물을 바닥 위로">조정 필요 ${SLOPEBAD.length} · 일괄조정</button>` : ''}`;
}
{ const _ps = pickSel; pickSel = function (h) { _ps(h); try { renderSlopeFab(); } catch (e) {} }; }
// 공간 상세 · 바닥 · 배수 기물 속성에도 바로가기
{ const _p = roomPanel; roomPanel = function () { return _p().replace('<div class="lbl">구배 (물빠짐 경사)</div>', '<div class="lbl">구배 (물빠짐 경사)</div><button class="btn pri" id="rmSWz">구배 간단 설정 (각도 → 배수구 찍기)</button>'); }; }
{ const _b = bindRoomPanel; bindRoomPanel = function () { _b(); const b = $('#rmSWz'); if (b) b.onclick = () => openSlopeWiz(sel); }; }
{ const _rp = renderProps0; renderProps0 = function () { _rp(); try { if (!P || !sel || multi.length > 1) return; const el = $('#props'); if (!el || $('#pSWz')) return; const it = sel.kind === 'item' ? itemOf(sel.id) : null;
  if (sel.kind === 'floor' || (it && isDrainItem(it))) { el.insertAdjacentHTML(sel.kind === 'floor' ? 'afterbegin' : 'beforeend', `<div class="flbox"><button class="btn pri" id="pSWz">${it ? '이 배수 기물로 구배 (바닥 전체)' : '구배 간단 설정 (각도 → 배수구 찍기)'}</button></div>`); $('#pSWz').onclick = () => openSlopeWiz(sel); }
  if (it && it.onSlope) { el.insertAdjacentHTML('beforeend', '<div class="row wrap"><span class="hint">구배 · 단 위에 올려져 있어요</span><button class="btn" id="pUnfit">원래 높이로</button></div>'); $('#pUnfit').onclick = () => { delete it.onSlope; commit(); dirty3d = true; }; } } catch (e) { console.warn(e); } }; }
{ const _rc = renderCtx; renderCtx = function () { _rc(); const b = $('#ctxbar'); if (!b || !sel || multi.length > 1 || b.querySelector('[data-cx="swz"]')) return; const it = sel.kind === 'item' ? itemOf(sel.id) : null;
  if (sel.kind === 'room' || (it && isDrainItem(it))) b.insertAdjacentHTML('beforeend', '<button data-cx="swz" class="cxtxt" title="구배 간단 설정">구배</button>'); }; }
$('#stage').addEventListener('click', (e) => { if (e.target.closest('[data-cx="swz"]')) openSlopeWiz(sel); }, true);
{ const _op = openProject; openProject = function (p) { SW.rid = null; SW.pick = null; const r = _op.apply(this, arguments); try { renderSW(); } catch (e) {} return r; }; }
{ const st = document.createElement('style'); st.textContent = `.slopefab{position:absolute;left:50%;top:58px;transform:translateX(-50%);z-index:25;display:flex;gap:6px;padding:6px;border-radius:14px}
  .slopefab .btn.warn{background:#ff9f0a;color:#1a1200;border:0}
  .swz{top:58px}.swz .chipb{min-width:48px}.swz .linkb{border:0;background:none;color:var(--accent);padding:0;font:inherit;text-decoration:underline;cursor:pointer}
  @media (max-width:899px){.slopefab{top:10px}.swz{top:8px!important;bottom:auto!important;max-height:52%!important}}`; document.head.appendChild(st); }

/* ---------- 4. 기물 추가: 여러 3D 확장자 · 서버(Storage) 보관 ---------- */
let MFILES = [];
const zupRot = (raw) => ({ tris: raw.tris.map((t) => t.map((p) => [p[0], p[2], -p[1]])), cols: raw.cols });
function glbFromGltf(json, bufs) { // .gltf (+ .bin · data URI) → 하나의 GLB
  const parts = (json.buffers || []).map((b, i) => { if (b.uri && /^data:/.test(b.uri)) return b64d(b.uri.split(',')[1]).buffer; const nm = decodeURIComponent((b.uri || '').split('/').pop()); const f = bufs[nm] || bufs[Object.keys(bufs)[i]]; if (!f) throw new Error(`"${nm}" 파일을 같이 골라 주세요 (.gltf와 .bin을 함께)`); return f; });
  const offs = []; let n = 0; for (const p of parts) { offs.push(n); n += Math.ceil(p.byteLength / 4) * 4; }
  const bin = new Uint8Array(n); parts.forEach((p, i) => bin.set(new Uint8Array(p), offs[i]));
  const j = JSON.parse(JSON.stringify(json)); for (const bv of j.bufferViews || []) { bv.byteOffset = (bv.byteOffset || 0) + offs[bv.buffer || 0]; bv.buffer = 0; } j.buffers = [{ byteLength: n }];
  if ((j.images || []).length) j.images = []; if (j.textures) j.textures = [];
  let js = new TextEncoder().encode(JSON.stringify(j)); const pad = (4 - js.length % 4) % 4; if (pad) { const t = new Uint8Array(js.length + pad); t.set(js); t.fill(32, js.length); js = t; }
  const out = new Uint8Array(12 + 8 + js.length + 8 + n), dv = new DataView(out.buffer); dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20); dv.setUint32(20 + js.length, n, true); dv.setUint32(24 + js.length, 0x004e4942, true); out.set(bin, 28 + js.length);
  return out.buffer;
}
function parsePly(buf) {
  const u8 = new Uint8Array(buf); let hEnd = -1; for (let i = 0; i < Math.min(u8.length - 10, 65536); i++) if (u8[i] === 101 && String.fromCharCode(...u8.subarray(i, i + 10)) === 'end_header') { hEnd = i + 10; while (u8[hEnd] === 13 || u8[hEnd] === 10) { hEnd++; if (u8[hEnd - 1] === 10) break; } break; }
  if (hEnd < 0) throw new Error('PLY 머리글을 찾지 못했어요');
  const head = new TextDecoder().decode(u8.subarray(0, hEnd)).split(/\r?\n/), els = []; let fmt = 'ascii';
  for (const l of head) { const p = l.trim().split(/\s+/); if (p[0] === 'format') fmt = p[1]; if (p[0] === 'element') els.push({ name: p[1], n: +p[2], props: [] }); if (p[0] === 'property' && els.length) els[els.length - 1].props.push(p[1] === 'list' ? { list: true, ct: p[2], t: p[3], name: p[4] } : { t: p[1], name: p[2] }); }
  const SZ = { char: 1, int8: 1, uchar: 1, uint8: 1, short: 2, int16: 2, ushort: 2, uint16: 2, int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8 };
  const le = fmt !== 'binary_big_endian', dv = new DataView(buf); let off = hEnd, toks = null, ti = 0;
  if (fmt === 'ascii') { toks = new TextDecoder().decode(u8.subarray(hEnd)).trim().split(/\s+/); }
  const rd = (t) => { if (toks) return +toks[ti++]; let v; switch (t) { case 'char': case 'int8': v = dv.getInt8(off); break; case 'uchar': case 'uint8': v = dv.getUint8(off); break; case 'short': case 'int16': v = dv.getInt16(off, le); break; case 'ushort': case 'uint16': v = dv.getUint16(off, le); break; case 'int': case 'int32': v = dv.getInt32(off, le); break; case 'uint': case 'uint32': v = dv.getUint32(off, le); break; case 'float': case 'float32': v = dv.getFloat32(off, le); break; default: v = dv.getFloat64(off, le); } off += SZ[t] || 4; return v; };
  const V = [], VC = [], tris = [], cols = [];
  for (const el of els) for (let k = 0; k < el.n; k++) { const o = {}; for (const pr of el.props) { if (pr.list) { const c = rd(pr.ct), a = []; for (let q = 0; q < c; q++) a.push(rd(pr.t)); o[pr.name] = a; } else o[pr.name] = rd(pr.t); }
    if (el.name === 'vertex') { V.push([o.x, o.y, o.z]); VC.push(o.red != null ? rgbHex([o.red, o.green, o.blue].map((c) => (c > 1 ? c / 255 : c))) : null); }
    else if (el.name === 'face') { const ix = o.vertex_indices || o.vertex_index || []; const fc = o.red != null ? rgbHex([o.red, o.green, o.blue].map((c) => (c > 1 ? c / 255 : c))) : null; for (let q = 1; q + 1 < ix.length; q++) { tris.push([V[ix[0]], V[ix[q]], V[ix[q + 1]]]); cols.push(fc || VC[ix[0]] || '#b8bcc2'); } } }
  if (!tris.length) throw new Error('PLY에 면(face)이 없어요 · 점(포인트 클라우드)만 있는 파일은 못 읽어요'); return { tris, cols };
}
function parseOff(text) {
  const L = text.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean); if (!/OFF$/.test(L[0])) throw new Error('OFF 파일이 아니에요'); let i = 1, h = L[0].length > 3 ? L[0].slice(3).trim().split(/\s+/) : L[i++].split(/\s+/); if (!h[0]) h = L[i++].split(/\s+/);
  const nv = +h[0], nf = +h[1], V = [], tris = [], cols = []; for (let k = 0; k < nv; k++) { const p = L[i++].split(/\s+/).map(Number); V.push([p[0], p[1], p[2]]); }
  for (let k = 0; k < nf; k++) { const p = L[i++].split(/\s+/).map(Number), n = p[0], ix = p.slice(1, 1 + n), c = p.slice(1 + n, 4 + n); const col = c.length === 3 ? rgbHex(c.map((v) => (v > 1 ? v / 255 : v))) : '#b8bcc2'; for (let q = 1; q + 1 < n; q++) { tris.push([V[ix[0]], V[ix[q]], V[ix[q + 1]]]); cols.push(col); } }
  return { tris, cols };
}
function parseDae(text) {
  const X = new DOMParser().parseFromString(text, 'application/xml'), q = (el, s) => [...el.getElementsByTagName(s)], id = (s) => X.getElementById ? X.getElementById(s) || q(X, '*').find((e) => e.getAttribute('id') === s) : null;
  const unit = +(q(X, 'unit')[0] && q(X, 'unit')[0].getAttribute('meter')) || 1, zup = /Z_UP/i.test((q(X, 'up_axis')[0] || {}).textContent || '');
  const effCol = {}; for (const ef of q(X, 'effect')) { const d = q(ef, 'diffuse')[0], c = d && q(d, 'color')[0]; if (c) effCol[ef.getAttribute('id')] = rgbHex(c.textContent.trim().split(/\s+/).slice(0, 3).map(Number).map((v) => Math.pow(v, 1 / 2.2))); }
  const matCol = {}; for (const m of q(X, 'material')) { const ie = q(m, 'instance_effect')[0]; if (ie) matCol[m.getAttribute('id')] = effCol[(ie.getAttribute('url') || '').slice(1)]; }
  const geo = {}; for (const g of q(X, 'geometry')) { const mesh = q(g, 'mesh')[0]; if (!mesh) continue; const src = {}; for (const s of q(mesh, 'source')) { const fa = q(s, 'float_array')[0], ac = q(s, 'accessor')[0]; if (fa) src[s.getAttribute('id')] = { a: fa.textContent.trim().split(/\s+/).map(Number), st: +(ac && ac.getAttribute('stride')) || 3 }; }
    const vx = {}; for (const v of q(mesh, 'vertices')) { const ip = q(v, 'input').find((i) => i.getAttribute('semantic') === 'POSITION'); if (ip) vx[v.getAttribute('id')] = ip.getAttribute('source').slice(1); }
    const prims = []; for (const tag of ['triangles', 'polylist', 'polygons']) for (const pr of q(mesh, tag)) { const ins = q(pr, 'input'), stride = Math.max(...ins.map((i) => +i.getAttribute('offset') || 0)) + 1, vi = ins.find((i) => i.getAttribute('semantic') === 'VERTEX'), pos = vi && src[vx[vi.getAttribute('source').slice(1)] || vi.getAttribute('source').slice(1)]; if (!pos) continue;
      const vo = +vi.getAttribute('offset') || 0, P_ = (k) => [pos.a[k * pos.st], pos.a[k * pos.st + 1], pos.a[k * pos.st + 2]], polys = [];
      if (tag === 'triangles') { const p = q(pr, 'p')[0].textContent.trim().split(/\s+/).map(Number); for (let k = 0; k + 3 * stride <= p.length; k += 3 * stride) polys.push([0, 1, 2].map((j) => P_(p[k + j * stride + vo]))); }
      else if (tag === 'polylist') { const p = q(pr, 'p')[0].textContent.trim().split(/\s+/).map(Number), vc = q(pr, 'vcount')[0].textContent.trim().split(/\s+/).map(Number); let k = 0; for (const c of vc) { polys.push([...Array(c).keys()].map((j) => P_(p[k + j * stride + vo]))); k += c * stride; } }
      else for (const pe of q(pr, 'p')) { const p = pe.textContent.trim().split(/\s+/).map(Number); polys.push([...Array(Math.floor(p.length / stride)).keys()].map((j) => P_(p[j * stride + vo]))); }
      prims.push({ polys, mat: pr.getAttribute('material') }); }
    geo[g.getAttribute('id')] = prims; }
  const tris = [], cols = [], m4 = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j]; return o; }, I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const nodeM = (n) => { let M = I; for (const c of n.children) { const v = c.textContent.trim().split(/\s+/).map(Number); let T = null;
      if (c.tagName === 'matrix') T = v; else if (c.tagName === 'translate') T = [1, 0, 0, v[0], 0, 1, 0, v[1], 0, 0, 1, v[2], 0, 0, 0, 1]; else if (c.tagName === 'scale') T = [v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0, 0, 0, 0, 1];
      else if (c.tagName === 'rotate') { const [x, y, z] = v, a = v[3] * Math.PI / 180, l = Math.hypot(x, y, z) || 1, ux = x / l, uy = y / l, uz = z / l, C = Math.cos(a), S = Math.sin(a), t = 1 - C; T = [t * ux * ux + C, t * ux * uy - S * uz, t * ux * uz + S * uy, 0, t * ux * uy + S * uz, t * uy * uy + C, t * uy * uz - S * ux, 0, t * ux * uz - S * uy, t * uy * uz + S * ux, t * uz * uz + C, 0, 0, 0, 0, 1]; }
      if (T) M = m4(M, T); } return M; };
  const walk = (n, Mp) => { const M = m4(Mp, nodeM(n)); for (const c of n.children) { if (c.tagName === 'node') walk(c, M); if (c.tagName === 'instance_node') { const t = id((c.getAttribute('url') || '').slice(1)); if (t) walk(t, M); }
      if (c.tagName === 'instance_geometry') { const g = geo[(c.getAttribute('url') || '').slice(1)]; if (!g) continue; const bind = {}; for (const im of q(c, 'instance_material')) bind[im.getAttribute('symbol')] = matCol[(im.getAttribute('target') || '').slice(1)];
        for (const pr of g) { const col = bind[pr.mat] || matCol[pr.mat] || '#b8bcc2'; for (const pl of pr.polys) { const W = pl.map((p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]].map((v) => v * unit)); for (let k = 1; k + 1 < W.length; k++) { tris.push([W[0], W[k], W[k + 1]]); cols.push(col); } } } } } };
  const vs = q(X, 'visual_scene')[0]; if (vs) for (const n of [...vs.children].filter((c) => c.tagName === 'node')) walk(n, I);
  if (!tris.length) for (const g of Object.values(geo)) for (const pr of g) for (const pl of pr.polys) for (let k = 1; k + 1 < pl.length; k++) { tris.push([pl[0], pl[k], pl[k + 1]].map((p) => p.map((v) => v * unit))); cols.push(matCol[pr.mat] || '#b8bcc2'); }
  if (!tris.length) throw new Error('DAE 안에서 면을 찾지 못했어요'); const raw = { tris, cols }; return zup ? zupRot(raw) : raw;
}
async function unzipEntry(buf, test) { // 아주 작은 zip 읽기 (3MF)
  const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('zip 구조를 못 읽었어요');
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true), out = {};
  for (let k = 0; k < n; k++) { const meth = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true), name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (!test(name)) continue; const ln = dv.getUint16(lo + 26, true), lx = dv.getUint16(lo + 28, true), data = u8.subarray(lo + 30 + ln + lx, lo + 30 + ln + lx + cs);
    if (meth === 0) out[name] = new TextDecoder().decode(data); else if (meth === 8) { const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); out[name] = await new Response(ds).text(); } }
  return out;
}
async function parse3mf(buf) {
  const ent = await unzipEntry(buf, (n) => /\.model$/i.test(n)), names = Object.keys(ent); if (!names.length) throw new Error('3MF 안에 모델이 없어요');
  const tris = [], cols = [], objs = {}; let unit = 1;
  for (const nm of names) { const X = new DOMParser().parseFromString(ent[nm], 'application/xml'), mdl = X.documentElement; unit = { micron: 0.001, millimeter: 1, centimeter: 10, inch: 25.4, foot: 304.8, meter: 1000 }[mdl.getAttribute('unit') || 'millimeter'] || 1;
    const bm = {}; for (const b of X.getElementsByTagName('basematerials')) bm[b.getAttribute('id')] = [...b.getElementsByTagName('base')].map((x) => (x.getAttribute('displaycolor') || '#b8bcc2').slice(0, 7));
    for (const o of X.getElementsByTagName('object')) { const mesh = o.getElementsByTagName('mesh')[0], comps = [...o.getElementsByTagName('component')]; const V = mesh ? [...mesh.getElementsByTagName('vertex')].map((v) => [+v.getAttribute('x'), +v.getAttribute('y'), +v.getAttribute('z')]) : [];
      const defc = o.getAttribute('pid') && bm[o.getAttribute('pid')] ? bm[o.getAttribute('pid')][+o.getAttribute('pindex') || 0] : '#b8bcc2';
      objs[o.getAttribute('id')] = { T: mesh ? [...mesh.getElementsByTagName('triangle')].map((t) => ({ v: [+t.getAttribute('v1'), +t.getAttribute('v2'), +t.getAttribute('v3')], c: t.getAttribute('pid') && bm[t.getAttribute('pid')] ? bm[t.getAttribute('pid')][+t.getAttribute('p1') || 0] : defc })) : [], V, comps: comps.map((c) => ({ id: c.getAttribute('objectid'), m: c.getAttribute('transform') })) }; }
    const tm = (s) => { if (!s) return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; return s.trim().split(/\s+/).map(Number); }, ap = (m, p) => [m[0] * p[0] + m[3] * p[1] + m[6] * p[2] + m[9], m[1] * p[0] + m[4] * p[1] + m[7] * p[2] + m[10], m[2] * p[0] + m[5] * p[1] + m[8] * p[2] + m[11]];
    const emit = (id, f, depth) => { const o = objs[id]; if (!o || depth > 8) return; for (const t of o.T) { tris.push(t.v.map((k) => f(o.V[k]).map((v) => v * unit / 1000))); cols.push(t.c); } for (const c of o.comps) { const m = tm(c.m); emit(c.id, (p) => f(ap(m, p)), depth + 1); } };
    const items = [...X.getElementsByTagName('item')]; if (items.length) for (const it of items) { const m = tm(it.getAttribute('transform')); emit(it.getAttribute('objectid'), (p) => ap(m, p), 0); } else for (const id of Object.keys(objs)) emit(id, (p) => p, 0); }
  if (!tris.length) throw new Error('3MF 안에서 면을 찾지 못했어요'); return zupRot({ tris, cols });
}
const M3 = /\.(gltf|ply|dae|3mf|off)$/i, MBAD = /\.(fbx|skp|3ds|max|blend|c4d|dwg|ifc|rvt|step|stp|igs|iges)$/i;
{ const _ml = modelLoad; modelLoad = async function (files) {
  const fs = [...files]; MFILES = fs; const f = fs.find((x) => M3.test(x.name));
  if (!f) { const bad = fs.find((x) => MBAD.test(x.name)); if (bad && !fs.some((x) => /\.(glb|obj|stl)$/i.test(x.name))) { $('#mdInfo').textContent = `${bad.name.split('.').pop().toUpperCase()} 파일은 앱 안에서 바로 못 읽어요 · 블렌더(무료) · 스케치업 · 3ds Max에서 "GLB" 또는 "OBJ"로 내보낸 뒤 올려 주세요`; return; } return _ml(files); }
  try { $('#mdInfo').textContent = '읽는 중…'; const ext = f.name.split('.').pop().toLowerCase(); let raw, meters = false;
    if (ext === 'gltf') { const bufs = {}; for (const x of fs) if (x !== f && !/\.(png|jpe?g|ktx2|webp)$/i.test(x.name)) bufs[x.name] = await x.arrayBuffer(); raw = parseGlb(glbFromGltf(JSON.parse(await f.text()), bufs)); meters = true; }
    else if (ext === 'ply') raw = parsePly(await f.arrayBuffer());
    else if (ext === 'off') raw = parseOff(await f.text());
    else if (ext === 'dae') { raw = parseDae(await f.text()); meters = true; }
    else { raw = await parse3mf(await f.arrayBuffer()); meters = true; }
    const all = raw.tris.flat(), span = Math.max(...[0, 1, 2].map((k) => { let a = Infinity, b = -Infinity; for (const p of all) { if (p[k] < a) a = p[k]; if (p[k] > b) b = p[k]; } return b - a; }));
    MODEL = { raw, name: f.name.replace(M3, ''), glb: meters, span }; $('#mdUnit').value = meters ? '1000' : span < 30 ? '1000' : span < 400 ? '10' : '1'; $('#mdName').value = MODEL.name; const z = $('#mdZup'); if (z) z.checked = false; modelPrev();
  } catch (e) { console.error(e); $('#mdInfo').textContent = '읽지 못했어요: ' + e.message; } }; }
{ const f = $('#mdFile'); if (f) { f.setAttribute('accept', '.glb,.gltf,.bin,.obj,.mtl,.stl,.ply,.dae,.3mf,.off,.fbx,.skp'); const lb = f.closest('label'); if (lb && lb.firstChild && lb.firstChild.nodeType === 3) lb.firstChild.nodeValue = '파일 고르기 (GLB · GLTF · OBJ · STL · PLY · DAE · 3MF · OFF)'; }
  const u = $('#mdUnit'); if (u && !$('#mdZup')) { u.closest('.g3').insertAdjacentHTML('afterend', '<label class="chk"><input type="checkbox" id="mdZup"> 누워 있으면 세우기 (Z축이 위인 파일)</label>');
    $('#mdZup').onchange = () => { if (!MODEL) return; MODEL.raw = $('#mdZup').checked ? zupRot(MODEL.raw) : { tris: MODEL.raw.tris.map((t) => t.map((p) => [p[0], -p[2], p[1]])), cols: MODEL.raw.cols }; modelPrev(); }; }
  const h = $('#mdDlg h3'); if (h) h.textContent = '기물 추가 · 3D 파일'; const hp = $('#mdDlg .hint'); if (hp) hp.textContent = '제조사 · 3D 웨어하우스 등에서 받은 3D 파일을 내 기물로 저장해요 (GLB · GLTF · OBJ+MTL · STL · PLY · DAE · 3MF · OFF). 로그인돼 있으면 서버에도 보관돼 PC · 폰에서 같이 써요. FBX · SKP는 GLB로 내보내 올려 주세요.'; }
async function uploadOriginals(m, files) {
  if (!SYNC.cfg.access || !files || !files.length) return false; const paths = [];
  for (const f of files.slice(0, 8)) { if (f.size > 45e6) continue; const path = `${SYNC.cfg.user}/${m.id}/${f.name.replace(/[^\w.\-가-힣]/g, '_')}`;
    await sbFetch('/storage/v1/object/models/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: { 'Content-Type': f.type || 'application/octet-stream', 'x-upsert': 'true' }, body: f }); paths.push(path); }
  m.src = paths; store.set('drs_mylib', myLib); store.set('drs_mylib_t', Date.now()); return true;
}
async function afterMyLib(m, files) { // 내 기물 → 서버 (동기화 + 원본 파일)
  if (!SYNC.cfg.access) { toast('내 기물에 저장했어요 · 로그인(계정 · 동기화)하면 서버에도 보관돼요'); return; }
  let up = false; try { up = await uploadOriginals(m, files); } catch (e) { console.warn(e); toast('기물은 저장됐어요 · 원본 파일 보관은 Supabase에서 schema.sql을 한 번 더 Run 하면 돼요'); }
  try { await syncNow(true); toast(up ? '서버에 저장했어요 (원본 파일 + 내 기물)' : '서버의 내 기물에 저장했어요'); } catch (e) { toast('서버 저장은 다음 동기화 때 다시 시도해요'); }
}
{ const _ms = modelSave; modelSave = function () { const n = myLib.length; _ms(); if (myLib.length > n) afterMyLib(myLib[myLib.length - 1], MFILES); }; const ok = $('#mdOk'); if (ok) ok.onclick = () => modelSave(); }

/* ---------- 5. 사진 · 그림(JPG · PNG)으로 기물 만들기: 배경을 지우고 외곽선을 따서 3D로 ---------- */
const IMI = { img: null, file: null, res: null };
function imiOpen() {
  let d = $('#imiDlg');
  if (!d) { document.body.insertAdjacentHTML('beforeend', `<dialog id="imiDlg" class="wide"><div class="dlg">
    <div class="row" style="align-items:center"><h3 style="flex:1">사진 · 그림으로 기물 만들기</h3><button class="btn" data-close>닫기</button></div>
    <p class="hint">2D 도면 기호나 실사 사진(JPG · PNG)을 올리면 배경을 지우고 외곽선을 따서 비슷한 모양 · 색의 3D 기물을 만들어요. 세부 모양은 만든 뒤 <b>디자인 수정</b>으로 다듬으세요.</p>
    <div class="row wrap"><label class="btn pri">사진 · 그림 고르기<input type="file" id="imiFile" accept="image/png,image/jpeg,image/webp" hidden></label><span class="hint" id="imiMsg" role="status"></span></div>
    <div class="imiwrap"><canvas id="imiCv" width="520" height="360" aria-label="외곽선 미리보기"></canvas></div>
    <div class="g3"><label class="fld"><span>어느 쪽에서 본 그림?</span><select id="imiView"><option value="front">정면 (앞에서)</option><option value="top">위에서 (평면 · 도면 기호)</option><option value="side">옆에서</option></select></label>
      <label class="fld"><span>배경 지우기 민감도 <b id="imiThV">40</b></span><input type="range" id="imiTh" min="8" max="140" value="40"></label>
      <label class="fld"><span>디테일 <b id="imiNV">72</b></span><input type="range" id="imiN" min="32" max="120" step="4" value="72"></label></div>
    <div class="g3"><label class="fld"><span>가로 W mm</span><input id="imiW" type="number" value="600"></label><label class="fld"><span>깊이 D mm</span><input id="imiD" type="number" value="600"></label><label class="fld"><span>높이 H mm</span><input id="imiH" type="number" value="850"></label></div>
    <div class="g3"><label class="fld"><span>이름</span><input id="imiName"></label><label class="fld"><span>레이어</span><select id="imiLayer"><option value="floor">바닥 설치</option><option value="deco">인테리어</option><option value="upper">벽 · 상부</option></select></label><label class="chk" style="align-self:end"><input type="checkbox" id="imiBg" checked> 배경 지우기</label></div>
    <div class="row"><button class="btn pri" id="imiOk" disabled>내 기물로 저장 · 배치</button></div></div></dialog>`);
    d = $('#imiDlg'); d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); });
    $('#imiFile').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) imiLoad(f); };
    for (const k of ['imiTh', 'imiN', 'imiView', 'imiBg']) $('#' + k).addEventListener('input', () => { $('#imiThV').textContent = $('#imiTh').value; $('#imiNV').textContent = $('#imiN').value; if (k === 'imiView') imiDims(); imiRun(); });
    $('#imiOk').onclick = imiSave;
    const st = document.createElement('style'); st.textContent = '.imiwrap{background:repeating-conic-gradient(#d9dce1 0 25%,#f4f5f7 0 50%) 50%/16px 16px;border-radius:12px;display:flex;justify-content:center;padding:6px;margin:6px 0}#imiCv{max-width:100%;height:auto}'; document.head.appendChild(st); }
  d.showModal();
}
function imiLoad(f) { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { IMI.img = im; IMI.file = f; $('#imiName').value = f.name.replace(/\.[^.]+$/, ''); imiDims(); imiRun(); }; im.onerror = () => { $('#imiMsg').textContent = '이미지를 열 수 없어요'; }; im.src = r.result; }; r.readAsDataURL(f); }
function imiDims() { if (!IMI.img) return; const R = IMI.res && IMI.res.cnt && IMI.res.img === IMI.img ? IMI.res : null, ar = R ? ((R.bb[3] - R.bb[1] + 1) / (R.bb[2] - R.bb[0] + 1)) * (IMI.img.height / R.M) / (IMI.img.width / R.N) : IMI.img.height / IMI.img.width, v = $('#imiView').value, W = +$('#imiW').value || 600;
  if (v === 'front') $('#imiH').value = Math.round(W * ar); else if (v === 'top') $('#imiD').value = Math.round(W * ar); else $('#imiH').value = Math.round((+$('#imiD').value || 600) * ar); }
function imiRun() {
  const im = IMI.img; if (!im) return; const N = +$('#imiN').value, M = Math.max(4, Math.round(N * im.height / im.width)), S = 4, cw = N * S, ch = M * S;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, cw, ch); const D = g.getImageData(0, 0, cw, ch).data;
  const th = +$('#imiTh').value, useBg = $('#imiBg').checked, bord = []; for (let x = 0; x < cw; x++) bord.push(x, x + (ch - 1) * cw); for (let y = 0; y < ch; y++) bord.push(y * cw, y * cw + cw - 1);
  const tr = bord.filter((i) => D[i * 4 + 3] < 40).length / bord.length, med = (k) => { const a = bord.filter((i) => D[i * 4 + 3] >= 40).map((i) => D[i * 4 + k]).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 255; }, bg = [med(0), med(1), med(2)];
  const isBg = (i) => D[i * 4 + 3] < 40 || (tr < 0.5 && Math.hypot(D[i * 4] - bg[0], D[i * 4 + 1] - bg[1], D[i * 4 + 2] - bg[2]) < th);
  const pm = new Uint8Array(cw * ch).fill(1);
  if (useBg) { const st = bord.filter(isBg), seen = new Uint8Array(cw * ch); for (const i of st) seen[i] = 1; while (st.length) { const i = st.pop(); pm[i] = 0; const x = i % cw, y = (i / cw) | 0; for (const j of [x > 0 ? i - 1 : -1, x < cw - 1 ? i + 1 : -1, y > 0 ? i - cw : -1, y < ch - 1 ? i + cw : -1]) if (j >= 0 && !seen[j]) { seen[j] = 1; if (isBg(j)) st.push(j); } } }
  // 칸(셀)으로: 절반 이상이 물체면 물체 · 색은 물체 픽셀 평균
  const cm = new Uint8Array(N * M), col = new Array(N * M);
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { let n = 0, r = 0, gg = 0, b = 0; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const p = (j * S + y) * cw + i * S + x; if (pm[p]) { n++; r += D[p * 4]; gg += D[p * 4 + 1]; b += D[p * 4 + 2]; } } if (n * 2 >= S * S) { cm[j * N + i] = 1; col[j * N + i] = [r / n, gg / n, b / n]; } }
  // 작은 조각 지우기
  const lab = new Int32Array(N * M).fill(-1), sizes = []; for (let k = 0; k < N * M; k++) { if (!cm[k] || lab[k] >= 0) continue; const id = sizes.length, st = [k]; lab[k] = id; let n = 0; while (st.length) { const q = st.pop(); n++; const x = q % N, y = (q / N) | 0; for (const j of [x > 0 ? q - 1 : -1, x < N - 1 ? q + 1 : -1, y > 0 ? q - N : -1, y < M - 1 ? q + N : -1]) if (j >= 0 && cm[j] && lab[j] < 0) { lab[j] = id; st.push(j); } } sizes.push(n); }
  const big = Math.max(0, ...sizes); for (let k = 0; k < N * M; k++) if (cm[k] && sizes[lab[k]] < Math.max(3, big * 0.02)) cm[k] = 0;
  // 색 줄이기 (최대 40색)
  const key = (c) => c.map((v) => Math.min(255, Math.round(v / 20) * 20)).join(','), freq = new Map(); for (let k = 0; k < N * M; k++) if (cm[k]) { const q = key(col[k]); freq.set(q, (freq.get(q) || 0) + 1); }
  const pal = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([q]) => q.split(',').map(Number)), ci = new Int16Array(N * M).fill(-1);
  for (let k = 0; k < N * M; k++) if (cm[k]) { let best = 0, bd = 1e9; for (let p = 0; p < pal.length; p++) { const d = (pal[p][0] - col[k][0]) ** 2 + (pal[p][1] - col[k][1]) ** 2 + (pal[p][2] - col[k][2]) ** 2; if (d < bd) { bd = d; best = p; } } ci[k] = best; }
  const cnt = cm.reduce((a, b) => a + b, 0), bb = [N, M, -1, -1]; for (let k = 0; k < N * M; k++) if (cm[k]) { const i = k % N, j = (k / N) | 0; bb[0] = Math.min(bb[0], i); bb[1] = Math.min(bb[1], j); bb[2] = Math.max(bb[2], i); bb[3] = Math.max(bb[3], j); }
  const fresh = !IMI.res || IMI.res.img !== im; IMI.res = { N, M, cm, ci, pal, cnt, bb, img: im }; if (fresh && cnt) imiDims();
  // 미리보기: 사진 흐리게 + 물체 칸 + 외곽선(주황)
  const pv = $('#imiCv'), k = Math.min(520 / im.width, 360 / im.height, 3); pv.width = Math.round(im.width * k); pv.height = Math.round(im.height * k); const x = pv.getContext('2d'); x.clearRect(0, 0, pv.width, pv.height); x.globalAlpha = 0.25; x.drawImage(im, 0, 0, pv.width, pv.height); x.globalAlpha = 1;
  const sx = pv.width / N, sy = pv.height / M; for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const q = j * N + i; if (!cm[q]) continue; const p = pal[ci[q]]; x.fillStyle = `rgb(${p.join(',')})`; x.fillRect(i * sx, j * sy, sx + .5, sy + .5); }
  x.strokeStyle = '#ff7a00'; x.lineWidth = 2; x.beginPath(); for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { if (!cm[j * N + i]) continue; const on = (a, b) => a >= 0 && b >= 0 && a < N && b < M && cm[b * N + a];
    if (!on(i - 1, j)) { x.moveTo(i * sx, j * sy); x.lineTo(i * sx, (j + 1) * sy); } if (!on(i + 1, j)) { x.moveTo((i + 1) * sx, j * sy); x.lineTo((i + 1) * sx, (j + 1) * sy); } if (!on(i, j - 1)) { x.moveTo(i * sx, j * sy); x.lineTo((i + 1) * sx, j * sy); } if (!on(i, j + 1)) { x.moveTo(i * sx, (j + 1) * sy); x.lineTo((i + 1) * sx, (j + 1) * sy); } } x.stroke();
  $('#imiMsg').textContent = cnt ? `외곽선을 땄어요 · ${pal.length}색 · 배경 ${useBg ? (tr >= 0.5 ? '투명' : `rgb(${bg.join(',')})`) : '안 지움'}` : '물체를 못 찾았어요 · 민감도를 낮추거나 "배경 지우기"를 끄세요'; $('#imiOk').disabled = !cnt;
}
function imiMesh() {
  const { N, M, cm, ci, pal, bb } = IMI.res, v = $('#imiView').value, W = +$('#imiW').value || 600, Dp = +$('#imiD').value || 600, H = +$('#imiH').value || 850;
  const NN = bb[2] - bb[0] + 1, MM = bb[3] - bb[1] + 1, [A, B, C] = v === 'front' ? [W, H, Dp] : v === 'top' ? [W, Dp, H] : [Dp, H, W], ca = A / NN, cb = B / MM;
  const map = (a, b, c) => (v === 'front' ? [a, B - b, c] : v === 'top' ? [a, c, b] : [c, B - b, a]);
  const tris = [], cols = [], hex = pal.map((p) => rgbHex(p.map((z) => z / 255))), dk = pal.map((p) => rgbHex(p.map((z) => z * .78 / 255)));
  const Q = (p0, p1, p2, p3, c) => { const m = [p0, p1, p2, p3].map((p) => map(...p)); tris.push([m[0], m[1], m[2]], [m[0], m[2], m[3]]); cols.push(c, c); };
  const K = (i, j) => (j + bb[1]) * N + i + bb[0], on = (i, j) => i >= 0 && j >= 0 && i < NN && j < MM && cm[K(i, j)];
  for (let j = 0; j < MM; j++) { let i = 0; while (i < NN) { if (!on(i, j)) { i++; continue; } const c0 = ci[K(i, j)]; let e = i; while (e + 1 < NN && on(e + 1, j) && ci[K(e + 1, j)] === c0) e++;
      Q([i * ca, j * cb, C], [(e + 1) * ca, j * cb, C], [(e + 1) * ca, (j + 1) * cb, C], [i * ca, (j + 1) * cb, C], hex[c0]); i = e + 1; } // 보이는 면 (색 그대로)
    i = 0; while (i < NN) { if (!on(i, j)) { i++; continue; } let e = i; while (e + 1 < NN && on(e + 1, j)) e++; Q([i * ca, j * cb, 0], [i * ca, (j + 1) * cb, 0], [(e + 1) * ca, (j + 1) * cb, 0], [(e + 1) * ca, j * cb, 0], dk[ci[K(i, j)]]); i = e + 1; } } // 뒷면
  for (let j = 0; j < MM; j++) for (let i = 0; i < NN; i++) { if (!on(i, j)) continue; const c = dk[ci[K(i, j)]], a0 = i * ca, a1 = (i + 1) * ca, b0 = j * cb, b1 = (j + 1) * cb; // 옆면 (외곽선을 따라 세우기)
    if (!on(i - 1, j)) Q([a0, b0, 0], [a0, b0, C], [a0, b1, C], [a0, b1, 0], c); if (!on(i + 1, j)) Q([a1, b0, 0], [a1, b1, 0], [a1, b1, C], [a1, b0, C], c);
    if (!on(i, j - 1)) Q([a0, b0, 0], [a1, b0, 0], [a1, b0, C], [a0, b0, C], c); if (!on(i, j + 1)) Q([a0, b1, 0], [a0, b1, C], [a1, b1, C], [a1, b1, 0], c); }
  return { tris, cols };
}
function imiThumb() { const { N, M, cm, ci, pal } = IMI.res, k = Math.min(1, 128 / Math.max(N, M)) * 4, c = document.createElement('canvas'); c.width = Math.max(8, Math.round(N * k)); c.height = Math.max(8, Math.round(M * k)); const x = c.getContext('2d'), sx = c.width / N, sy = c.height / M;
  for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const q = j * N + i; if (!cm[q]) continue; x.fillStyle = `rgb(${pal[ci[q]].join(',')})`; x.fillRect(i * sx, j * sy, sx + .5, sy + .5); } return c.toDataURL('image/png'); }
function imiSave() {
  if (!IMI.res || !IMI.res.cnt) return; let raw = imiMesh(); if (raw.tris.length > 12000) { $('#imiN').value = Math.max(32, +$('#imiN').value - 16); $('#imiNV').textContent = $('#imiN').value; imiRun(); raw = imiMesh(); }
  let pk; try { pk = modelPack(raw, 1); } catch (e) { $('#imiMsg').textContent = e.message; return; }
  const m = { id: uid('my'), name: $('#imiName').value.trim() || '사진 기물', tag: '', shape: 'mesh', mesh: pk.mesh, w: pk.w, d: pk.d, h: pk.h, elev: 0, layer: $('#imiLayer').value, color: pk.mesh.pal[0] || '#b8bcc2', mat: 'matte', img: imiThumb(), from: 'image' };
  myLib.push(m); try { store.set('drs_mylib', myLib); store.set('drs_mylib_t', Date.now()); } catch (e) { myLib.pop(); toast('저장 공간이 부족해요 · 디테일을 낮춰 주세요'); return; }
  libCat = '내 기물'; renderLib(); const [x, y] = viewCenter(); placeItem(m.id, x, y); $('#imiDlg').close(); afterMyLib(m, IMI.file ? [IMI.file] : []);
}
// 기물 목록 아래 "기물 추가" (3D 파일 · 사진)
function addChooser() { let d = $('#addDlg'); if (!d) { document.body.insertAdjacentHTML('beforeend', `<dialog id="addDlg"><div class="dlg"><h3>기물 추가</h3><p class="hint">추가한 기물은 "내 기물"에 저장되고, 로그인돼 있으면 서버에도 보관돼요.</p>
  <div class="addgrid"><button class="addc" data-add="3d"><b>3D 파일</b><small>GLB · GLTF · OBJ · STL · PLY · DAE · 3MF · OFF</small></button><button class="addc" data-add="img"><b>사진 · 그림으로 만들기</b><small>JPG · PNG 외곽선을 따서 3D로</small></button><button class="addc" data-add="box"><b>치수로 등록</b><small>상자 모양 · 이미지 아이콘</small></button></div>
  <div class="row"><button class="btn" data-close>닫기</button></div></div></dialog>`); d = $('#addDlg');
  d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); const b = e.target.closest('[data-add]'); if (!b) return; d.close(); const k = b.dataset.add; if (k === '3d') openModelIn(); if (k === 'img') imiOpen(); if (k === 'box') { const mb = $('#myBtn'); if (mb) mb.click(); } });
  const st = document.createElement('style'); st.textContent = '.addgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}.addc{border:0;border-radius:14px;padding:14px;text-align:left;background:var(--fill);color:var(--fg);display:flex;flex-direction:column;gap:4px;cursor:pointer}.addc:hover{outline:2px solid var(--accent)}.addc small{color:var(--muted)}'; document.head.appendChild(st); }
  d.showModal(); }
{ const mb = $('#myBtn'); if (mb && !$('#libAdd')) { mb.insertAdjacentHTML('beforebegin', '<button class="btn pri" id="libAdd">+ 기물 추가 (3D 파일 · 사진)</button>'); $('#libAdd').onclick = addChooser; } }
{ const _C = CMDS; CMDS = function () { const l = _C(); l.push({ g: '도구', n: '기물 추가 (3D 파일 · 사진)', run: addChooser, k: '', kw: 'add model glb fbx obj 사진 기물 추가 업로드' }, { g: '도구', n: '사진 · 그림으로 기물 만들기', run: imiOpen, k: '', kw: 'image trace photo png jpg 외곽선' }); return l; }; }

/* ---------- 6. 튀김기 · 화구 열압력 ↑ · 연기 흐름 (후드 포집 / 새는 연기 → 순환 공기와 섞임) ---------- */
const HEATK = (it) => { const L = libGet(it.type), s = it.type + ' ' + (L.shape || ''); let k = /fryer|noodle/.test(s) ? 1.7 : /wok|range|grill|fire/.test(s) ? 1.5 : /griddle/.test(s) ? 1.15 : /oven|combi|pizza|salam|steam/.test(s) ? 0.6 : 0; if (!k && (L.gas || L.hood) && L.layer === 'floor') k = 1; if (k) k *= 1 + Math.min(0.8, (L.kw || 0) / 40) + (L.gas ? 0.2 : 0); return k; };
const heatItems = () => (P ? P.items.filter((it) => !it.hidden && spec(it).layer !== 'ceil' && HEATK(it) > 0) : []);
const SMK = { on: true, parts: [], acc: 0, cap: 0, esc: 0, hist: [], dir: [0, 0] };
const hoodsNow = () => P.items.filter((it) => !it.hidden && libGet(it.type).shape === 'hood').map((it) => ({ it, c: corners(it), z0: zOf(it), q: it.hp ?? libGet(it.type).hp ?? 1, x: it.x, y: it.y, ex: corners({ ...it, w: it.w + 500, d: it.d + 500 }) }));
// 열 기둥: 부력을 더 세게 (화력 · 가스 · kW에 비례), 올라가며 옆으로 퍼짐
{ const _av = airV; airV = function (p, t, H, sups, sinks) { const v = _av(p, t, H, sups, sinks); if (p.k === 'heat') { const k = p.hk || 1.3, top = 1 - sstep((p.z - (H - 300)) / 250); v[2] += 900 * k * top; if (p.sx != null) { const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy) + 1; v[0] += dx / d * 180 * k; v[1] += dy / d * 180 * k; } } return v; }; }
{ const _as = airStep; airStep = function (dt) { _as(dt); try { if (!P || !AF) return; const H = P.ceilingH || 2700, hs = heatItems(); if (!hs.length) { SMK.parts = []; return; }
  const sinks = AF.src.filter((s) => s.q < 0), sups = AF.src.filter((s) => s.q > 0), hoods = hoodsNow(), R = presetRect() || bounds(), tot = hs.reduce((a, h) => a + HEATK(h), 0);
  // 후드마다 포집 확률: 후드 배기량 vs 열기둥(연기) 양 · 후드가 화기보다 충분히 넓은지 · 옆바람(급기 · 출입구)
  for (const hd of hoods) { const under = hs.filter((h) => pointInPoly(h.x, h.y, hd.ex)), qp = under.reduce((a, h) => a + HEATK(h) * 1500, 0), qh = hd.q * CMH_HP, ratio = qp ? qh / qp : 9;
    const short = under.some((h) => corners(h).some((c) => !pointInPoly(c[0], c[1], corners({ ...hd.it, w: hd.it.w - 300, d: hd.it.d - 300 })))), draft = AF.src.some((s) => s.q > 0 && Math.hypot(s.x - hd.x, s.y - hd.y) < 1800);
    hd.qp = qp; hd.qh = qh; hd.pc = clamp(ratio / (ratio + 0.35) - (short ? 0.18 : 0) - (draft ? 0.12 : 0), 0.15, 0.97); }
  SMK.hoods = hoods.filter((h) => h.qp);
  // 열 입자 추가 (열압력 ↑)
  if (AIR.parts.length < 700) for (let n = 0; n < Math.min(4, Math.ceil(tot)); n++) { if (Math.random() > dt * 22) continue; const h = hs[Math.floor(Math.random() * hs.length)], s = spec(h), k = HEATK(h); AIR.parts.push({ x: h.x + (Math.random() - .5) * h.w * .7, y: h.y + (Math.random() - .5) * h.d * .7, z: zOf(h) + s.h + 20, vx: 0, vy: 0, vz: 700 * k, k: 'heat', hk: k, sx: h.x, sy: h.y, age: 0, tr: [] }); }
  if (!SMK.on) { SMK.parts = []; return; }
  // 연기 내보내기 (조리 중이라고 가정)
  SMK.acc += dt * Math.min(40, 10 * tot); while (SMK.acc > 1 && SMK.parts.length < 260) { SMK.acc -= 1; let r = Math.random() * tot, h = hs[0]; for (const q of hs) { r -= HEATK(q); if (r <= 0) { h = q; break; } } const s = spec(h), k = HEATK(h);
    SMK.parts.push({ x: h.x + (Math.random() - .5) * h.w * .6, y: h.y + (Math.random() - .5) * h.d * .6, z: zOf(h) + s.h + 30, vx: 0, vy: 0, vz: 600 * k, k: 'smoke', hk: k, sx: h.x, sy: h.y, age: 0, tr: [], esc: false }); }
  SMK.parts = SMK.parts.filter((p) => {
    const v = airV({ x: p.x, y: p.y, z: p.z, k: 'amb' }, AIR.t || 0, H, sups, sinks), warm = Math.exp(-p.age / 2.8);
    v[2] += (1000 * p.hk * warm + 140) * (1 - sstep((p.z - (H - 260)) / 200)); // 뜨거운 연기는 위로
    v[0] += (Math.random() - .5) * 700 * p.hk * warm; v[1] += (Math.random() - .5) * 700 * p.hk * warm; // 기둥이 올라가며 퍼짐 (열압력)
    if (p.z > H - 380) { const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy) + 1; v[0] += dx / d * 650 * p.hk * Math.exp(-p.age / 7); v[1] += dy / d * 650 * p.hk * Math.exp(-p.age / 7); } // 천장에 닿으면 옆으로 퍼짐
    if (!p.spill) for (const hd of hoods) { if (pointInPoly(p.x, p.y, hd.ex) && p.z > hd.z0 - 700) { const dx = hd.x - p.x, dy = hd.y - p.y, d = Math.hypot(dx, dy) + 1, w = 700 * hd.q / (1 + p.hk * 0.35); v[0] += dx / d * w; v[1] += dy / d * w; v[2] += 500 * hd.q; } }
    const ip = 1 - Math.exp(-dt * 2.2); p.vx += (v[0] - p.vx) * ip; p.vy += (v[1] - p.vy) * ip; p.vz += (v[2] - p.vz) * ip; const sp = Math.hypot(p.vx, p.vy, p.vz); if (sp > 2600) { p.vx *= 2600 / sp; p.vy *= 2600 / sp; p.vz *= 2600 / sp; }
    const nx_ = p.x + p.vx * dt, ny_ = p.y + p.vy * dt; if (afWall(nx_, ny_)) { if (!afWall(nx_, p.y)) { p.x = nx_; p.vy *= -0.2; } else if (!afWall(p.x, ny_)) { p.y = ny_; p.vx *= -0.2; } else { p.vx *= -.3; p.vy *= -.3; } } else { p.x = nx_; p.y = ny_; }
    p.z = clamp(p.z + p.vz * dt, 60, H - 40); p.age += dt; p.tt = (p.tt || 0) + dt; if (p.tt > 0.06) { p.tt = 0; p.tr.push([p.x, p.y, p.z]); if (p.tr.length > 18) p.tr.shift(); }
    if (!p.spill) for (const hd of hoods) if (pointInPoly(p.x, p.y, hd.c) && p.z >= hd.z0 - 30) { if (Math.random() < hd.pc) { SMK.cap++; SMK.hist.push(1); return false; } // 후드로 빨려 들어감
      const dx = p.x - hd.x, dy = p.y - hd.y, d = Math.hypot(dx, dy) + 1; p.spill = true; p.esc = true; p.cnt = 1; SMK.esc++; SMK.hist.push(0); p.vx = dx / d * 1100; p.vy = dy / d * 1100; p.vz = 300; break; } // 넘쳐서 후드 밖으로
    if (!p.esc && ((p.z > Math.min(...hoods.map((h) => h.z0), H - 300) - 80 && !hoods.some((hd) => pointInPoly(p.x, p.y, hd.ex))) || (!hoods.length && p.z > H - 400))) { p.esc = true; p.cnt = 1; SMK.esc++; SMK.hist.push(0); }
    const out = p.x < R[0] - 600 || p.x > R[2] + 600 || p.y < R[1] - 600 || p.y > R[3] + 600 || p.age > 24;
    if (out || (p.esc && p.age > 16)) { if (!p.cnt) { SMK.esc++; SMK.hist.push(0); } SMK.dir = [SMK.dir[0] * .97 + (p.x - p.sx) * .03, SMK.dir[1] * .97 + (p.y - p.sy) * .03]; return false; }
    return true; });
  if (SMK.hist.length > 400) SMK.hist.splice(0, SMK.hist.length - 400);
} catch (e) { console.warn('smoke', e); } }; }
{ const _ad = airDraw; airDraw = function () { _ad(); if (!AIR.on || !SMK.on || !P) return; const Tz = xf(0, 0, 0);
  for (const p of SMK.parts) { const pts = chaikin([...p.tr, [p.x, p.y, p.z]]), n = pts.length; if (n < 2) continue; const C = tintC(hexRGB(p.esc ? '#8a6a52' : '#7d8086'));
    for (let k = 1; k < n; k++) { const a = pts[k - 1], c = pts[k], L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]); if (L < 3) continue; const f = k / n, w = Math.min(130, 30 + p.age * 22) * (0.45 + 0.55 * f), al = Math.min(0.999, Math.round((0.2 + 0.45 * f) * 5) / 5), g = grp('plain', al), ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L;
      quad(g, [[a[0] - uy * w, a[2], a[1] + ux * w], [c[0] - uy * w, c[2], c[1] + ux * w], [c[0] + uy * w, c[2], c[1] - ux * w], [a[0] + uy * w, a[2], a[1] - ux * w]].map((q) => Tz.P(q[0], q[1], q[2])), [0, 1, 0], C);
      quad(g, [[a[0], a[2] - w, a[1]], [c[0], c[2] - w, c[1]], [c[0], c[2] + w, c[1]], [a[0], a[2] + w, a[1]]].map((q) => Tz.P(q[0], q[1], q[2])), [-uy, 0, ux], C); } } }; }
{ const _d = draw2d; draw2d = function () { _d(); if (!P || view === '3d' || OFF || !AIR.on || !SMK.on) return; cx.save(); for (const p of SMK.parts) { const q = toS(p.x, p.y); cx.fillStyle = p.esc ? 'rgba(138,106,82,.55)' : 'rgba(110,113,120,.4)'; cx.beginPath(); cx.arc(q[0], q[1], Math.max(2, Math.min(90, 22 + p.age * 16) * V.s), 0, 7); cx.fill(); } cx.restore(); }; }
{ const _rh = renderAirHud; renderAirHud = function () { _rh(); const h = $('#airHud'); if (!h || h.hidden || !P) return; const hs = heatItems(); if (!hs.length) return;
  const n = SMK.hist.length, cap = n ? SMK.hist.reduce((a, b) => a + b, 0) / n : null, d = SMK.dir, dd = Math.hypot(...d), dirT = dd > 150 ? ({ E: '도면 오른쪽', W: '도면 왼쪽', N: '도면 위쪽', S: '도면 아래쪽' })[Math.abs(d[0]) > Math.abs(d[1]) ? (d[0] > 0 ? 'E' : 'W') : (d[1] > 0 ? 'S' : 'N')] : '';
  const hk = Math.round(hs.reduce((a, it) => a + HEATK(it), 0) * 10) / 10;
  const hdT = (SMK.hoods || []).map((x) => `${esc(spec(x.it).name)} ${Math.round(x.qh)} CMH vs 열기둥 ${Math.round(x.qp)} CMH`).join(' · ');
  h.insertAdjacentHTML('beforeend', `<div class="smkline"><b>열 · 연기</b> <span>화기 ${hs.length}대 · 열압력 지수 ${hk}</span>${hdT ? `<span>${hdT}</span>` : ''}${SMK.on ? `<span>${cap == null ? '연기 계산 중…' : `후드 포집 약 ${Math.round(cap * 100)}%${cap < 0.9 ? ` · 새는 연기 ${Math.round((1 - cap) * 100)}%${dirT ? ` → ${dirT}로 퍼짐` : ''} (갈색)` : ' · 거의 다 빨려 들어가요'}`}</span>` : ''}
    <small class="muted">빨강 = 열 기둥 · 회색 = 연기 · 갈색 = 후드를 벗어나 순환 공기를 타는 연기</small><button class="qb" id="smkTg">${SMK.on ? '연기 끄기' : '연기 보기'}</button></div>`);
  const b = $('#smkTg'); if (b) b.onclick = (e) => { e.stopPropagation(); SMK.on = !SMK.on; SMK.parts = []; SMK.hist = []; renderAirHud(); }; }; }
{ const _s = airSet; airSet = function (on) { SMK.parts = []; SMK.hist = []; SMK.cap = SMK.esc = 0; _s(on); }; }
{ const st = document.createElement('style'); st.textContent = '.airhud .smkline{display:flex;flex-direction:column;gap:2px;margin-top:6px;padding-top:6px;border-top:1px solid var(--line)}.airhud .smkline .qb{align-self:flex-start;margin-top:4px}'; document.head.appendChild(st); }

/* ---------- 7. 벽에 그림 넣기 · 시트지 붙이기 (JPG · PNG → 가벼운 해상도로) ---------- */
[
  { id: 'wallpic', name: '벽 그림 (액자)', cat: '인테리어', shape: 'wallpic', w: 900, d: 30, h: 600, elev: 1200, layer: 'deco', color: '#2b2d31', mat: 'paint' },
  { id: 'wallfilm', name: '벽 시트지 (벽 전체)', cat: '인테리어', shape: 'wallfilm', w: 3000, d: 4, h: 2700, layer: 'deco', color: '#ffffff', mat: 'plastic' },
].forEach((x) => { if (!LIB.find((l) => l.id === x.id)) LIB.push(x); });
const PICFR = { none: ['액자 없음', null], black: ['검정 액자', '#1f2023'], wood: ['원목 액자', '#a5774a'], white: ['흰 액자', '#f2f2f0'], gold: ['골드 액자', '#c8a24a'] };
function shrinkImg(f, mx, q) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
  const k = Math.min(1, mx / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(2, Math.round(im.width * k)); c.height = Math.max(2, Math.round(im.height * k)); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
  let alpha = false; if (/png|webp|gif/.test(f.type)) { const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 16) if (d[i] < 250) { alpha = true; break; } }
  const src = alpha ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', q); res({ src, w: c.width, h: c.height, kb: Math.round(src.length * 0.75 / 1024), name: f.name.replace(/\.[^.]+$/, '') }); }; im.onerror = () => rej(new Error('이미지를 열 수 없어요')); im.src = r.result; }; r.readAsDataURL(f); }); }
function pickFile(accept) { return new Promise((res) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); }); }
const wallFrame = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; return { L, ux, uy, nx: -uy, ny: ux }; };
function viewSide(w) { const F = wallFrame(w); if (view !== '2d' && lastM) { const E = eye(); return (E[0] - w.x1) * F.nx + (E[2] - w.y1) * F.ny >= 0 ? 1 : -1; }
  if (lastHit && lastHit.sel && lastHit.sel.kind === 'wall' && lastHit.sel.id === w.id && lastHit.side) return lastHit.side; const b = bounds(), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; return (c[0] - w.x1) * F.nx + (c[1] - w.y1) * F.ny >= 0 ? 1 : -1; }
function addAssetSrc(a) { const id = uid('a'); P.assets = P.assets || {}; P.assets[id] = { name: a.name, src: a.src, w: a.w, h: a.h }; regAssets(); return 'u_' + id; }
async function wallPicture(w) {
  w = w || (sel && sel.kind === 'wall' && wallOf(sel.id)); if (!w) { toast('그림을 넣을 벽을 먼저 고르세요'); return; } const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return;
  let a; try { a = await shrinkImg(f, 1600, 0.85); } catch (e) { toast(e.message); return; } const key = addAssetSrc(a), F = wallFrame(w), side = viewSide(w), H = wallH(w), ar = a.w / a.h;
  const hit = lastHit && lastHit.sel && lastHit.sel.kind === 'wall' && lastHit.sel.id === w.id ? lastHit : null, t = clamp(hit && hit.along != null ? hit.along : F.L / 2, 300, F.L - 300);
  let pw = Math.min(1200, F.L * 0.6), ph = pw / ar; if (ph > Math.min(1400, H * 0.6)) { ph = Math.min(1400, H * 0.6); pw = ph * ar; } const cy = clamp(hit && hit.y > 300 ? hit.y : 1500, ph / 2 + 100, H - ph / 2 - 50), off = wallT(w) / 2 + 15;
  const it = { id: uid('i'), type: 'wallpic', dk: key, frame: 'black', x: Math.round(w.x1 + F.ux * t + F.nx * side * off), y: Math.round(w.y1 + F.uy * t + F.ny * side * off), w: Math.round(pw), d: 30, h: Math.round(ph), lockAR: ar, rot: rotOf(F.nx * side, F.ny * side), elev: Math.round(cy - ph / 2), tag: '벽 그림 · ' + a.name, wallLink: w.id };
  P.items.push(it); w.L0 = w.L0 || F.L; commit(); dirty3d = true; pickSel({ kind: 'item', id: it.id }); toast(`그림을 걸었어요 · ${a.w}×${a.h}px · ${a.kb}KB · Ctrl+끌기로 크기(비율 유지)`);
}
async function wallFilm(w, mode) {
  w = w || (sel && sel.kind === 'wall' && wallOf(sel.id)); if (!w) { toast('시트지를 붙일 벽을 먼저 고르세요'); return; } const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return;
  let a; try { a = await shrinkImg(f, mode === 'tile' ? 1024 : 2048, 0.82); } catch (e) { toast(e.message); return; } const key = addAssetSrc(a), side = viewSide(w);
  P.items = P.items.filter((x) => !(x.film && x.film.wall === w.id && x.film.side === side));
  const it = { id: uid('i'), type: 'wallfilm', dk: key, film: { wall: w.id, side, mode: mode || 'fit', tw: 1000 }, x: 0, y: 0, w: 1000, d: 4, h: 1000, rot: 0, elev: 0, tag: '시트지 · ' + a.name };
  P.items.push(it); syncFilms(); commit(); dirty3d = true; pickSel({ kind: 'item', id: it.id }); toast(`시트지를 붙였어요 · ${a.w}×${a.h}px · ${a.kb}KB · 오른쪽에서 반복(타일) · 반대쪽 면 · 크기`);
}
function syncFilms() { if (!P) return; for (const it of P.items) { if (!it.film) continue; const w = wallOf(it.film.wall); if (!w) { it.hidden = true; continue; } const F = wallFrame(w), s = it.film.side || 1, off = wallT(w) / 2 + 3;
  it.x = Math.round((w.x1 + w.x2) / 2 + F.nx * s * off); it.y = Math.round((w.y1 + w.y2) / 2 + F.ny * s * off); it.w = Math.round(F.L); it.h = Math.round(wallH(w)); it.rot = rotOf(F.nx * s, F.ny * s); it.elev = 0; it.d = 4; } }
{ const _bs = buildScene; buildScene = function () { try { syncFilms(); } catch (e) {} _bs(); }; }
{ const _d = draw2d; draw2d = function () { try { syncFilms(); } catch (e) {} _d(); }; }
function repTex(k) { const key = 'dc_rep_' + k; if (tex[key] || tex[key] === 0 || !gl || !DECALS[k]) return key; tex[key] = 0; DECALS['rep_' + k] = DECALS[k]; const im = new Image();
  im.onload = () => { const c = document.createElement('canvas'), p2 = (v) => 2 ** Math.round(Math.log2(Math.max(64, Math.min(1024, v)))); c.width = p2(im.width); c.height = p2(im.height); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    tex[key] = t; dirty3d = true; need3d = true; }; im.src = DECALS[k].src; return key; }
function buildFilm(it) { const w = wallOf(it.film.wall), Dk = DECALS[it.dk]; if (!w || !Dk) return; const F = wallFrame(w), s = it.film.side || 1, off = wallT(w) / 2 + 2.5 + (it.film.lay || 0), H = CUT ? Math.min(1200, wallH(w)) : wallH(w), Hf = wallH(w);
  const tile = it.film.mode === 'tile', key = tile ? repTex(it.dk) : (decalTex(it.dk), 'dc_' + it.dk), g = grp(key), c = tintC([1.22, 1.22, 1.22]), N = [F.nx * s, 0, F.ny * s], tw = it.film.tw || 1000, th = tw * Dk.h / Dk.w;
  const P0 = (t, y) => [w.x1 + F.ux * t + F.nx * s * off, y + YOFF, w.y1 + F.uy * t + F.ny * s * off], UV = (t, y) => { const tt = s > 0 ? t : F.L - t; return tile ? [tt / tw, 1 - y / th] : [tt / F.L, 1 - y / Hf]; };
  const ops = P.openings.filter((o) => o.wall === w.id).map((o) => [clamp(o.t - o.w / 2, 0, F.L), clamp(o.t + o.w / 2, 0, F.L), o.sill || 0, (o.sill || 0) + o.h]);
  const xs = [...new Set([0, F.L, ...ops.flatMap((o) => [o[0], o[1]])])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) { const t0 = xs[i], t1 = xs[i + 1]; if (t1 - t0 < 1) continue; const m = (t0 + t1) / 2, cut = ops.filter((o) => o[0] <= m && o[1] >= m).map((o) => [o[2], o[3]]).sort((a, b) => a[0] - b[0]); let y = 0; const spans = [];
    for (const [a, b] of cut) { if (a > y) spans.push([y, a]); y = Math.max(y, b); } if (y < H) spans.push([y, H]);
    for (const [y0, y1r] of spans) { const y1 = Math.min(y1r, H); if (y1 - y0 < 1) continue; const V = [[t0, y0], [t1, y0], [t1, y1], [t0, y1]]; for (const k of [0, 1, 2, 0, 2, 3]) { g.p.push(...P0(...V[k])); g.n.push(...N); g.c.push(...c); g.u.push(...UV(...V[k])); } } } }
{ const _bi = buildItem; buildItem = function (it) { const s = spec(it), sh = s.L.shape;
  if (sh === 'wallfilm') { if (it.film) buildFilm(it); return; }
  if (sh !== 'wallpic') return _bi(it);
  const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), hw = it.w / 2, hd = it.d / 2, h = s.h, fr = PICFR[it.frame || 'black'], fw = fr[1] ? Math.min(45, it.w / 12) : 0;
  if (fr[1]) { box(T, -hw, hw, e, e + fw, -hd, hd, fr[1], it.frame === 'wood' ? 'wood' : it.frame === 'gold' ? 'steel' : 'plain'); box(T, -hw, hw, e + h - fw, e + h, -hd, hd, fr[1], it.frame === 'wood' ? 'wood' : it.frame === 'gold' ? 'steel' : 'plain'); box(T, -hw, -hw + fw, e, e + h, -hd, hd, fr[1], it.frame === 'wood' ? 'wood' : 'plain'); box(T, hw - fw, hw, e, e + h, -hd, hd, fr[1], it.frame === 'wood' ? 'wood' : 'plain'); }
  box(T, -hw + fw, hw - fw, e + fw, e + h - fw, -hd, hd - 8, '#e8e6e1', 'plain'); if (it.dk && DECALS[it.dk]) decalQuad(T, -hw + fw, hw - fw, e + fw, e + h - fw, hd - 7, it.dk, 1); }; }
{ const _rp = renderProps0; renderProps0 = function () { _rp(); try { if (!P || !sel || multi.length > 1) return; const el = $('#props'); if (!el) return;
  if (sel.kind === 'wall' && !$('#wPic')) { el.insertAdjacentHTML('beforeend', '<div class="lbl">벽 꾸미기 (보는 쪽 면)</div><div class="row wrap"><button class="btn pri" id="wPic">그림 넣기 (JPG · PNG)</button><button class="btn" id="wFilm">시트지 (벽 전체 · 한 장)</button><button class="btn" id="wFilmT">시트지 (반복 무늬)</button></div><p class="hint">3D에서 보고 있는 쪽 면에 붙어요 · 이미지는 가볍게 줄여서 넣어요 (그림 1600px · 시트지 2048 / 무늬 1024px)</p>');
    $('#wPic').onclick = () => wallPicture(); $('#wFilm').onclick = () => wallFilm(null, 'fit'); $('#wFilmT').onclick = () => wallFilm(null, 'tile'); }
  const it = sel.kind === 'item' ? itemOf(sel.id) : null; if (!it) return;
  if (it.film && !$('#fmMode')) { el.insertAdjacentHTML('beforeend', `<div class="lbl">시트지</div><div class="g3">${sel_('붙이는 방식', 'fmMode', { fit: '벽 전체에 한 장', tile: '반복 (타일 · 무늬)' }, it.film.mode || 'fit')}${field('무늬 폭 mm', 'fmTw', it.film.tw || 1000)}<button class="btn" id="fmSide">반대쪽 면으로</button></div><div class="row wrap"><button class="btn" id="fmImg">이미지 바꾸기</button></div>`);
    $('#fmMode').onchange = (e) => { it.film.mode = e.target.value; commit(); dirty3d = true; renderProps(); }; $('#fmTw').onchange = (e) => { it.film.tw = clamp(+e.target.value || 1000, 50, 20000); commit(); dirty3d = true; };
    $('#fmSide').onclick = () => { it.film.side = -(it.film.side || 1); syncFilms(); commit(); dirty3d = true; renderProps(); };
    $('#fmImg').onclick = async () => { const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return; const a = await shrinkImg(f, it.film.mode === 'tile' ? 1024 : 2048, 0.82); it.dk = addAssetSrc(a); commit(); dirty3d = true; toast(`바꿨어요 · ${a.kb}KB`); }; }
  if (it.type === 'wallpic' && !$('#wpFr')) { el.insertAdjacentHTML('beforeend', `<div class="lbl">그림</div><div class="g3">${sel_('액자', 'wpFr', Object.fromEntries(Object.entries(PICFR).map(([k, v]) => [k, v[0]])), it.frame || 'black')}<button class="btn" id="wpImg">그림 바꾸기</button></div>`);
    $('#wpFr').onchange = (e) => { it.frame = e.target.value; commit(); dirty3d = true; };
    $('#wpImg').onclick = async () => { const f = await pickFile('image/png,image/jpeg,image/webp'); if (!f) return; const a = await shrinkImg(f, 1600, 0.85); it.dk = addAssetSrc(a); it.lockAR = a.w / a.h; it.h = Math.round(it.w / it.lockAR); commit(); dirty3d = true; toast(`바꿨어요 · ${a.kb}KB`); }; } } catch (e) { console.warn(e); } }; }
{ const _rc = renderCtx; renderCtx = function () { _rc(); const b = $('#ctxbar'); if (!b || !sel || sel.kind !== 'wall' || multi.length > 1 || b.querySelector('[data-cx="wpic"]')) return; b.insertAdjacentHTML('beforeend', '<button data-cx="wpic" class="cxtxt" title="벽에 그림 넣기">그림</button><button data-cx="wfilm" class="cxtxt" title="벽 전체에 시트지">시트지</button>'); }; }
$('#stage').addEventListener('click', (e) => { if (e.target.closest('[data-cx="wpic"]')) wallPicture(); if (e.target.closest('[data-cx="wfilm"]')) wallFilm(null, 'fit'); }, true);
// 2D: 시트지는 벽 면에 색 띠로
{ const _sym = symbol; symbol = function (it, s) { if (it.film) { const w = wallOf(it.film.wall); if (!w) return; const c = corners(it); poly(c, 'rgba(242,139,58,.35)', 'rgba(242,139,58,.9)', 1.5); return; } _sym(it, s); }; }

/* ---------- 8. 새 기물: 스피커 · 카드 단말기 · 샐러드 / 토핑 냉장고 · 배경 소품 · 지게차 ---------- */
const SH4 = {}, KSS = '#c9ced4', KBK = '#24272c', GL = '#bfe3f2';
{ const _bi = buildItem; buildItem = function (it) { const s = spec(it), f = SH4[s.L.shape]; if (!f) return _bi(it);
  const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), w = it.w, d = it.d, h = s.h, hw = w / 2, hd = d / 2, col = s.color, mk = MATS[s.mat].tex, ma = MATS[s.mat].a;
  const B = (x0, x1, y0, y1, z0, z1, c, k, a) => box(T, x0, x1, e + y0, e + y1, z0, z1, c || col, k || mk, a ?? (c ? undefined : ma));
  const C = (x, z, r, y0, y1, c, k, n = 14, a) => cyl(T, x, z, r, e + y0, e + y1, c || col, k || mk, n, a ?? (c ? undefined : ma));
  const S = (x, y, z, rx, ry, rz, c) => sph(T, x, e + y, z, rx, ry, rz, c || col);
  const Wh = (x, y, z, r, len, c) => { B(x - len / 2, x + len / 2, y - r * .72, y + r * .72, z - r, z + r, c || '#1d1f22', 'plain'); B(x - len / 2, x + len / 2, y - r, y + r, z - r * .72, z + r * .72, c || '#1d1f22', 'plain'); B(x - len / 2 - 2, x + len / 2 + 2, y - r * .4, y + r * .4, z - r * .4, z + r * .4, '#9aa1a9', 'steel'); };
  try { f({ B, C, S, Wh, w, d, h, hw, hd, col, v: it.v || s.L.v || '', it }); } catch (er) { console.warn('shape', s.L.shape, er); B(-hw, hw, 0, h, -hd, hd); } }; }
Object.assign(SH4, {
  speaker({ B, C, w, h, hw, hd, v, col }) { const k = v === 'ceil';
    if (k) { C(0, 0, Math.min(hw, hd), h - 12, h, '#f2f2f0', 'plain', 20); C(0, 0, Math.min(hw, hd) * .82, h - 14, h - 11, '#d5d8dc', 'plain', 20); return; }
    if (v === 'pa') { C(0, 0, 18, 0, h * .55, '#2b2d31', 'steel', 8); for (const a of [0, 2.1, 4.2]) B(Math.cos(a) * 160 - 12, Math.cos(a) * 160 + 12, 0, 30, Math.sin(a) * 160 - 12, Math.sin(a) * 160 + 12, '#2b2d31', 'steel'); B(-hw, hw, h * .55, h, -hd, hd); C(0, hd + 1, hw * .55, h * .62, h * .62 + 2, '#111317', 'plain', 18); return; }
    if (v === 'wall') B(-30, 30, h * .4, h * .6, -hd - 60, -hd, '#2b2d31', 'steel');
    B(-hw, hw, v === 'floor' ? 40 : 0, h, -hd, hd); if (v === 'floor') B(-hw + 10, hw - 10, 0, 40, -hd + 10, hd - 10, '#1d1f22', 'plain');
    const y0 = v === 'floor' ? 40 : 0, H = h - y0, gw = hw * .72; B(-hw + 8, hw - 8, y0 + 8, h - 8, hd - 2, hd + 1, '#3a3e44', 'plain'); // 그릴
    B(-gw * .5, gw * .5, y0 + H * .72, y0 + H * .72 + gw, hd + 1, hd + 4, '#111317', 'plain'); B(-gw, gw, y0 + H * .18, y0 + H * .18 + gw * 2, hd + 1, hd + 4, '#111317', 'plain'); },
  cardterm({ B, C, w, d, h, hw, hd, v, col }) { if (v === 'stand') { C(0, 0, Math.min(hw, hd) * .9, 0, 12, '#3a3e44', 'plain', 14); C(0, 0, 14, 12, h - 120, '#9aa1a9', 'steel', 8); const y = h - 130; B(-45, 45, y, y + 22, -85, 85, col); B(-40, 40, y + 22, y + 26, -80, -5, '#2f3a44', 'plain'); B(-40, 40, y + 22, y + 24, 5, 80, '#d5d8dc', 'plain'); return; }
    B(-hw, hw, 0, h * .55, -hd, hd); B(-hw + 6, hw - 6, h * .55, h * .6, -hd + 8, -hd + d * .45, '#2f3a44', 'plain'); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) B(-hw + 12 + c * (w - 24) / 3, -hw + 12 + (c + 1) * (w - 24) / 3 - 4, h * .55, h * .58, hd - 10 - (r + 1) * d * .11, hd - 10 - r * d * .11 - 4, '#c9ced4', 'plastic');
    B(-hw + 10, hw - 10, h * .55, h * .62, hd - d * .05, hd, '#1a1c20', 'plain'); },
  saladfr({ B, w, h, hw, hd, col }) { const t = 850; B(-hw, hw, 0, 80, -hd + 20, hd - 40, '#2b2d31', 'plain'); B(-hw, hw, 80, t - 40, -hd, hd); const n = Math.max(2, Math.round(w / 600)); for (let i = 0; i < n; i++) { const x0 = -hw + w * i / n + 10, x1 = -hw + w * (i + 1) / n - 10; B(x0, x1, 120, t - 80, hd - 2, hd + 3, col); B(x1 - 60, x1 - 40, t - 300, t - 120, hd + 3, hd + 25, '#9aa1a9', 'steel'); }
    B(-hw, hw, t - 40, t, -hd, hd, KSS, 'steel'); const pc = ['#6fae4a', '#d84a3a', '#f2c230', '#e9e4d4', '#8a5a3a', '#4f8f3a']; const m = Math.max(3, Math.round(w / 260)); for (let i = 0; i < m; i++) { const x0 = -hw + 40 + (w - 80) * i / m, x1 = -hw + 40 + (w - 80) * (i + 1) / m - 14; B(x0, x1, t - 30, t + 2, -hd + 90, hd - 220, '#e8eaee', 'steel'); B(x0 + 10, x1 - 10, t - 10, t + 6, -hd + 100, hd - 230, pc[i % pc.length], 'plain'); }
    B(-hw + 20, hw - 20, t, t + 20, hd - 200, hd - 160, KSS, 'steel'); // 도마 받침
    for (const x of [-hw + 15, hw - 30]) B(x, x + 15, t, h, -hd + 60, -hd + 75, KSS, 'steel'); B(-hw + 15, hw - 15, h - 20, h, -hd + 60, hd - 160, GL, 'plain', .45); B(-hw + 15, hw - 15, t + 140, h - 20, hd - 175, hd - 160, GL, 'plain', .45); },
  toppingfr({ B, w, h, hw, hd, col }) { const t = h - 140; B(-hw, hw, 0, 80, -hd + 20, hd - 40, '#2b2d31', 'plain'); B(-hw, hw, 80, t, -hd, hd); const n = Math.max(2, Math.round(w / 700)); for (let i = 0; i < n; i++) { const x0 = -hw + w * i / n + 10, x1 = -hw + w * (i + 1) / n - 10; B(x0, x1, 120, t - 40, hd - 2, hd + 3, col); B(x1 - 60, x1 - 40, t - 260, t - 100, hd + 3, hd + 25, '#9aa1a9', 'steel'); }
    B(-hw, hw, t, t + 30, -hd + 220, hd, '#e8e6e1', 'plastic'); // 도마
    B(-hw, hw, t, h, -hd, -hd + 220, KSS, 'steel'); const pc = ['#d84a3a', '#f2c230', '#6fae4a', '#e9e4d4', '#3a3e44', '#c97a3a', '#8a3a50']; const m = Math.max(4, Math.round(w / 200)); for (let i = 0; i < m; i++) { const x0 = -hw + 30 + (w - 60) * i / m, x1 = -hw + 30 + (w - 60) * (i + 1) / m - 10; B(x0, x1, h - 30, h + 4, -hd + 30, -hd + 200, pc[i % pc.length], 'plain'); }
    B(-hw, hw, h, h + 12, -hd, -hd + 220, KSS, 'steel', .35); },
  person({ B, C, S, h, v, col }) { const k = h / 1750, ch = v === 'child', skin = ['#e8c4a0', '#c99a72', '#f0d2b4'][(col.charCodeAt(2) || 0) % 3], pants = v === 'f' ? '#3a3e44' : ch ? '#3e6eb5' : '#2b2f36', walk = v === 'walk', sw = walk ? 120 * k : 0;
    if (v === 'group') { for (const [x, z, c, hh, va] of [[-480, 0, '#2f4f7f', 1760, 'm'], [0, 150, '#b5475b', 1620, 'f'], [470, -60, '#4f7a52', 1700, 'walk']]) { const kk = hh / 1750; B(x - 120 * kk, x - 20 * kk, 0, 820 * kk, z - 60 * kk, z + 60 * kk, '#2b2f36', 'plain'); B(x + 20 * kk, x + 120 * kk, 0, 820 * kk, z - 60 * kk, z + 60 * kk, '#2b2f36', 'plain'); B(x - 190 * kk, x + 190 * kk, 820 * kk, 1450 * kk, z - 110 * kk, z + 110 * kk, c, 'plain'); S(x, 1580 * kk, z, 105 * kk, 125 * kk, 110 * kk, '#e8c4a0'); S(x, 1640 * kk, z - 10, 112 * kk, 80 * kk, 112 * kk, '#2a2420'); } return; }
    B(-120 * k, -20 * k, 0, 820 * k, -60 * k + sw, 60 * k + sw, pants, 'plain'); B(20 * k, 120 * k, 0, 820 * k, -60 * k - sw, 60 * k - sw, pants, 'plain'); B(-130 * k, -10 * k, 0, 60 * k, -50 * k + sw, 130 * k + sw, '#1d1f22', 'plain'); B(10 * k, 130 * k, 0, 60 * k, -50 * k - sw, 130 * k - sw, '#1d1f22', 'plain');
    if (v === 'f') B(-170 * k, 170 * k, 600 * k, 900 * k, -120 * k, 120 * k, col, 'plain');
    B(-185 * k, 185 * k, 820 * k, 1450 * k, -110 * k, 110 * k, col, 'plain'); if (v === 'staff') B(-150 * k, 150 * k, 700 * k, 1350 * k, 110 * k, 125 * k, '#2b2d31', 'plain');
    B(-250 * k, -185 * k, 900 * k, 1430 * k, -50 * k - sw * .8, 50 * k - sw * .8, col, 'plain'); B(185 * k, 250 * k, 900 * k, 1430 * k, -50 * k + sw * .8, 50 * k + sw * .8, col, 'plain'); S(-218 * k, 860 * k, -sw * .8, 40 * k, 50 * k, 40 * k, skin); S(218 * k, 860 * k, sw * .8, 40 * k, 50 * k, 40 * k, skin);
    C(0, 0, 45 * k, 1450 * k, 1520 * k, skin, 'plain', 10); S(0, 1600 * k, 0, 100 * k, 120 * k, 108 * k, skin); S(0, 1655 * k, -12 * k, 108 * k, 78 * k, 110 * k, v === 'f' ? '#3a2a20' : '#1f1b18'); if (v === 'f') B(-95 * k, 95 * k, 1380 * k, 1640 * k, -115 * k, -40 * k, '#3a2a20', 'plain'); if (v === 'staff') B(-110 * k, 110 * k, 1680 * k, 1740 * k, -110 * k, 110 * k, '#f4f2ee', 'plain'); },
  car({ B, Wh, w, d, h, hw, hd, v, col }) { const r = v === 'bus' ? 500 : v === 'truck' ? 380 : 330, wl = 140, gz = '#2f3a44', axF = hd - (v === 'bus' ? 2400 : 900), axR = -hd + (v === 'bus' ? 2600 : 950), base = r * .55;
    if (v === 'bus') { B(-hw, hw, base, h, -hd, hd); B(-hw - 2, hw + 2, h * .45, h * .85, -hd + 300, hd - 200, gz, 'plain', .85); B(-hw + 40, hw - 40, h * .35, h * .9, hd - 2, hd + 2, gz, 'plain', .85); B(-hw, hw, base, base + 250, -hd, hd, '#e8eaee', 'paint'); }
    else if (v === 'truck') { const cab = 1700; B(-hw, hw, base, h * .78, hd - cab, hd); B(-hw + 30, hw - 30, h * .5, h * .74, hd - 30, hd + 2, gz, 'plain', .85); B(-hw - 2, hw + 2, h * .5, h * .74, hd - cab + 200, hd - 300, gz, 'plain', .85);
      B(-hw, hw, base, base + 120, -hd, hd - cab, '#3a3e44', 'steel'); B(-hw - 40, hw + 40, base + 120, h, -hd, hd - cab - 80, '#e8eaee', 'paint'); }
    else { const bh = v === 'van' ? h * .92 : v === 'suv' ? h * .55 : h * .5, f0 = v === 'van' ? hd - 500 : hd - 1050, r0 = v === 'van' ? -hd + 80 : -hd + 750; B(-hw, hw, base, bh, -hd, hd); B(-hw + 40, hw - 40, bh, h, r0, f0); B(-hw + 70, hw - 70, bh + 20, h - 50, f0 - 2, f0 + 2 + (v === 'van' ? 0 : 0), gz, 'plain', .85);
      B(-hw + 38, hw - 38, bh + 40, h - 60, r0 + 120, f0 - 120, gz, 'plain', .85); if (v !== 'van') B(-hw + 60, hw - 60, bh, h - 40, f0 - 10, f0 + 300, gz, 'plain', .8); B(-hw + 60, hw - 60, bh + 40, h - 60, r0 - 2, r0 + 2, gz, 'plain', .85); }
    for (const z of [axF, axR]) { Wh(-hw + wl / 2 - 10, r, z, r, wl); Wh(hw - wl / 2 + 10, r, z, r, wl); }
    B(-hw + 80, -hw + 320, base + 300, base + 400, hd - 2, hd + 6, '#fff6d8', 'plain'); B(hw - 320, hw - 80, base + 300, base + 400, hd - 2, hd + 6, '#fff6d8', 'plain'); B(-hw + 80, -hw + 320, base + 300, base + 400, -hd - 6, -hd + 2, '#d84a3a', 'plain'); B(hw - 320, hw - 80, base + 300, base + 400, -hd - 6, -hd + 2, '#d84a3a', 'plain'); },
  moto({ B, C, Wh, w, d, h, hw, hd, v, col }) { const r = v === 'bicycle' ? 330 : 280; Wh(0, r, hd - r, r, 70); Wh(0, r, -hd + r, r, 70);
    if (v === 'bicycle') { B(-15, 15, r, r + 30, -hd + r, hd - r, col); B(-15, 15, r, h * .78, -40, -10, col); B(-20, 20, h * .8, h * .84, -120, 40, '#1d1f22', 'plain'); B(-15, 15, r, h * .9, hd - r - 30, hd - r, '#9aa1a9', 'steel'); B(-280, 280, h * .9, h * .93, hd - r - 40, hd - r - 10, '#1d1f22', 'plain'); return; }
    B(-hw * .7, hw * .7, r * .8, r * 1.6, -hd + r, hd - r * .6, col); B(-hw * .6, hw * .6, r * 1.6, r * 2.2, -hd + r * 1.2, 100, '#1d1f22', 'plain'); B(-hw * .8, hw * .8, r * 1.5, h * .75, hd - r * 1.4, hd - r * 1.0, col); B(-hw, hw, h * .82, h * .86, hd - r * 1.3, hd - r * 1.1, '#1d1f22', 'plain');
    B(-hw * .9, hw * .9, r * 2.2, r * 2.2 + 420, -hd + 40, -hd + 480, v === 'deliv' ? '#c8102e' : '#e8eaee', 'plastic'); },
  road({ B, w, d, h, hw, hd, v, col }) { if (v === 'park') { B(-hw, hw, 0, 4, -hd, hd, '#55585e', 'concrete'); for (const x of [-hw, hw - 100]) B(x, x + 100, 4, 6, -hd, hd, '#f4f2ee', 'plain'); B(-hw, hw, 4, 6, -hd, -hd + 100, '#f4f2ee', 'plain'); return; }
    B(-hw, hw, 0, h, -hd, hd, '#4a4d52', 'concrete'); const y = h + 1;
    if (v === 'cross') { for (let x = -hw + 250; x + 450 < hw; x += 900) B(x, x + 450, h, y + 1, -hd + 100, hd - 100, '#f4f2ee', 'plain'); return; }
    const n = +v || 2, lw = w / n; for (let i = 1; i < n; i++) { const x = -hw + lw * i, c = i === n / 2 ? '#f2c230' : '#f4f2ee'; if (i === n / 2) { B(x - 80, x - 20, h, y, -hd, hd, c, 'plain'); B(x + 20, x + 80, h, y, -hd, hd, c, 'plain'); } else for (let z = -hd; z + 3000 <= hd + 1; z += 9000) B(x - 50, x + 50, h, y, z, Math.min(hd, z + 3000), c, 'plain'); }
    B(-hw + 100, -hw + 250, h, y, -hd, hd, '#f4f2ee', 'plain'); B(hw - 250, hw - 100, h, y, -hd, hd, '#f4f2ee', 'plain'); },
  sidewalk({ B, w, d, h, hw, hd, col }) { B(-hw, hw, 0, h, -hd, hd, col, 'concrete'); B(hw - 150, hw, 0, h + 30, -hd, hd, '#b9b6ae', 'concrete'); for (let z = -hd + 300; z < hd; z += 300) B(-hw, hw - 150, h, h + 1, z - 6, z + 6, '#9d9a92', 'plain'); },
  tree({ C, S, h, hw, col }) { C(0, 0, Math.max(60, hw * .12), 0, h * .5, '#6b4a33', 'wood', 10); S(0, h * .62, 0, hw, h * .2, hw, col); S(hw * .3, h * .78, -hw * .2, hw * .8, h * .17, hw * .8, col); S(-hw * .25, h * .8, hw * .25, hw * .7, h * .15, hw * .7, col); C(0, 0, hw * .8, 0, 30, '#6f6a60', 'concrete', 14); },
  streetlight({ B, C, h, hw, hd }) { C(0, -hd + 150, 80, 0, 300, '#3a3e44', 'steel', 10); C(0, -hd + 150, 50, 300, h, '#3a3e44', 'steel', 10); B(-25, 25, h - 60, h - 20, -hd + 150, hd - 150, '#3a3e44', 'steel'); B(-110, 110, h - 120, h - 40, hd - 400, hd, '#3a3e44', 'steel'); B(-90, 90, h - 125, h - 118, hd - 380, hd - 20, '#fff6d8', 'plain'); },
  bench({ B, w, h, hw, hd }) { for (const x of [-hw + 80, hw - 140]) { B(x, x + 60, 0, h, -hd + 40, -hd + 100, '#3a3e44', 'steel'); B(x, x + 60, 0, h, hd - 100, hd - 40, '#3a3e44', 'steel'); } for (let z = -hd; z < hd - 60; z += 110) B(-hw, hw, h - 40, h, z, z + 90, '#a5774a', 'wood'); B(-hw, hw, h + 80, h + 380, -hd, -hd + 40, '#a5774a', 'wood'); },
  signal({ B, C, h }) { C(0, 0, 60, 0, h, '#5a5f66', 'steel', 10); B(-140, 140, h - 300, h - 200, -60, 900, '#5a5f66', 'steel'); B(-160, 160, h - 360, h - 140, 900, 1000, '#2b2d31', 'plain'); for (const [x, c] of [[-100, '#d84a3a'], [0, '#f2c230'], [100, '#3fae5a']]) B(x - 35, x + 35, h - 285, h - 215, 1000, 1010, c, 'plain'); },
  cone({ C, h, hw }) { C(0, 0, hw, 0, 40, '#1d1f22', 'plain', 4); for (let i = 0; i < 6; i++) { const r = hw * .75 * (1 - i / 6), y = 40 + (h - 40) * i / 6; C(0, 0, Math.max(10, r), y, y + (h - 40) / 6, i === 2 || i === 4 ? '#f4f2ee' : '#ff6a1a', 'plain', 12); } },
  forklift({ B, C, Wh, w, d, h, hw, hd, v, col }) { // +z = 포크(앞)
    const dk = '#2b2d31', mast = '#3a3e44', st = v === 'stand', dz = v === 'diesel', r = dz ? 330 : 260, bodyH = dz ? 1250 : 1050, fl = st ? 1150 : 1100, bodyF = hd - fl - 200, bodyR = -hd;
    Wh(-hw + 90, r, bodyF - r, r, 180); Wh(hw - 90, r, bodyF - r, r, 180); Wh(-hw + 90, r * .85, bodyR + r + 120, r * .85, 160); Wh(hw - 90, r * .85, bodyR + r + 120, r * .85, 160);
    if (st) { B(-hw + 60, hw - 60, 150, bodyH + 300, bodyR, bodyF - 400); B(-hw + 60, hw - 60, 150, 260, bodyF - 400, bodyF, dk, 'plain'); B(-hw + 80, -hw + 140, 260, 1900, bodyF - 400, bodyF - 340, dk, 'steel'); B(hw - 140, hw - 80, 260, 1900, bodyF - 400, bodyF - 340, dk, 'steel'); B(-hw + 80, hw - 80, 1880, 1940, bodyR + 200, bodyF - 340, dk, 'steel');
      B(-hw + 100, -hw + 160, 150, 1400, bodyF + 50, hd - 200, mast, 'steel'); B(hw - 160, hw - 100, 150, 1400, bodyF + 50, hd - 200, mast, 'steel'); for (const x of [-hw + 40, hw - 120]) B(x, x + 80, 0, 160, bodyF, hd - 150, dk, 'steel'); C(0, bodyF - 500, 120, bodyH + 300, bodyH + 320, '#1d1f22', 'plain', 12); }
    else { B(-hw, hw, r * .9, bodyH, bodyR + 450, bodyF); B(-hw - 10, hw + 10, r * .5, bodyH + 120, bodyR, bodyR + 450, dk, 'steel'); // 뒤 카운터웨이트
      B(-hw + 160, hw - 160, bodyH, bodyH + 100, bodyR + 450, bodyR + 900, '#1d1f22', 'plain'); B(-hw + 160, hw - 160, bodyH + 100, bodyH + 520, bodyR + 450, bodyR + 560, '#1d1f22', 'plain'); // 의자
      C(0, bodyF - 380, 140, bodyH + 520, bodyH + 540, '#1d1f22', 'plain', 12); B(-20, 20, bodyH, bodyH + 520, bodyF - 380, bodyF - 340, dk, 'steel');
      for (const x of [-hw + 40, hw - 100]) { B(x, x + 60, bodyH, 2100, bodyR + 380, bodyR + 440, dk, 'steel'); B(x, x + 60, bodyH, 2100, bodyF - 120, bodyF - 60, dk, 'steel'); } for (let z = bodyR + 380; z < bodyF - 60; z += 140) B(-hw + 40, hw - 40, 2080, 2120, z, z + 50, dk, 'steel'); // 헤드 가드
      if (dz) { C(hw - 160, bodyR + 300, 45, bodyH + 120, bodyH + 700, '#3a3e44', 'steel', 8); B(-hw + 60, hw - 60, bodyH - 200, bodyH - 60, bodyR - 10, bodyR, '#f2c230', 'plain'); } }
    const mz = st ? hd - 1150 - 80 : bodyF + 40; B(-hw * .7, -hw * .7 + 90, 80, Math.min(h, 2300), mz, mz + 120, mast, 'steel'); B(hw * .7 - 90, hw * .7, 80, Math.min(h, 2300), mz, mz + 120, mast, 'steel'); B(-hw * .7, hw * .7, 80, 600, mz + 120, mz + 160, mast, 'steel'); // 마스트 · 백레스트
    for (const x of [-hw * .45, hw * .45 - 120]) { B(x, x + 120, 80, 600, mz + 160, mz + 210, '#1d1f22', 'steel'); B(x, x + 120, 80, 125, mz + 160, hd, '#1d1f22', 'steel'); } // 포크
    B(-hw + 40, -hw + 160, bodyH - 260, bodyH - 180, bodyF - 10, bodyF + 4, '#fff6d8', 'plain'); },
});
const ADD4 = (cat, sub, layer, rows) => rows.forEach(([id, name, shape, w, d, h, color, mat, x]) => { if (LIB.some((l) => l.id === id)) return; LIB.push({ id, name, cat, sub, shape, w, d, h, layer, color, mat, ...(x || {}) }); });
ADD4('주방', '냉장 · 냉동', 'floor', [['k_saladfr', '샐러드 냉장고 (밧드 · 유리 덮개)', 'saladfr', 1500, 700, 1250, KSS, 'steel', { kw: 0.4 }], ['k_saladfr12', '샐러드 냉장고 1200', 'saladfr', 1200, 700, 1250, KSS, 'steel', { kw: 0.35 }],
  ['k_toppingfr', '토핑 냉장고 (밧드 레일 · 도마)', 'toppingfr', 1500, 800, 1050, KSS, 'steel', { kw: 0.45 }], ['k_toppingfr18', '토핑 냉장고 1800', 'toppingfr', 1800, 800, 1050, KSS, 'steel', { kw: 0.5 }]]);
ADD4('가전', '영상 · 음향', 'floor', [['e_card', '카드 단말기 (카운터)', 'cardterm', 90, 180, 70, KBK, 'plastic', { elev: 1000, kw: 0.01 }], ['e_cardS', '카드 단말기 (거치대 · 서명패드)', 'cardterm', 160, 160, 330, KBK, 'plastic', { v: 'stand', elev: 1000, kw: 0.01 }],
  ['e_spkW', '벽걸이 스피커', 'speaker', 220, 200, 340, KBK, 'plastic', { v: 'wall', elev: 2150, layer: 'upper', kw: 0.03 }], ['e_spkC', '천장 매립 스피커', 'speaker', 220, 220, 80, '#f2f2f0', 'plain', { v: 'ceil', layer: 'ceil', kw: 0.02 }],
  ['e_spkB', '블루투스 스피커 (소형)', 'speaker', 200, 110, 230, KBK, 'plastic', { v: 'small', elev: 900, kw: 0.01 }], ['e_spkP', 'PA 스피커 (삼각대)', 'speaker', 420, 360, 1850, KBK, 'plastic', { v: 'pa', kw: 0.3 }]]);
{ const sp = LIB.find((l) => l.id === 'e_spk'); if (sp && sp.shape === 'cube') { sp.shape = 'speaker'; sp.v = 'floor'; } }
ADD4('공장', '운반', 'floor', [['m_fkStand', '스탠딩 지게차 (입식 · 리치형)', 'forklift', 1100, 2400, 2300, '#f2c230', 'paint', { v: 'stand' }], ['m_fkRear', '후방 지게차 (전동 · 좌식)', 'forklift', 1100, 3000, 2150, '#e2702a', 'paint', { v: 'counter' }], ['m_fkDiesel', '디젤 지게차 (3톤)', 'forklift', 1250, 3700, 2250, '#f2c230', 'paint', { v: 'diesel' }]]);
const ENVPROPS = [['x_man', '사람 (남)', 'person', 520, 300, 1750, '#2f4f7f', { v: 'm' }], ['x_woman', '사람 (여)', 'person', 480, 300, 1620, '#b5475b', { v: 'f' }], ['x_walk', '걷는 사람', 'person', 520, 500, 1720, '#4f7a52', { v: 'walk' }], ['x_child', '아이', 'person', 420, 260, 1150, '#e2a13a', { v: 'child' }], ['x_staff', '직원 (앞치마)', 'person', 520, 300, 1720, '#c8102e', { v: 'staff' }], ['x_group', '사람 3명', 'person', 1500, 600, 1760, '#2f4f7f', { v: 'group' }],
  ['x_sedan', '승용차', 'car', 1850, 4800, 1450, '#d9dde2', { v: 'sedan' }], ['x_suv', 'SUV', 'car', 1900, 4700, 1750, '#2b2d31', { v: 'suv' }], ['x_van', '승합차', 'car', 1950, 5100, 1990, '#f2f2f2', { v: 'van' }], ['x_truck', '1톤 트럭', 'car', 1750, 5100, 2000, '#3e6eb5', { v: 'truck' }], ['x_bus', '버스', 'car', 2500, 11000, 3200, '#3fae5a', { v: 'bus' }], ['x_moto', '배달 오토바이', 'moto', 700, 1900, 1150, '#c8102e', { v: 'deliv' }], ['x_bicycle', '자전거', 'moto', 600, 1750, 1000, '#2f5c9e', { v: 'bicycle' }],
  ['x_road2', '도로 2차선 (10m)', 'road', 7000, 10000, 20, '#4a4d52', { v: '2' }], ['x_road4', '도로 4차선 (10m)', 'road', 14000, 10000, 20, '#4a4d52', { v: '4' }], ['x_cross', '횡단보도', 'road', 7000, 3000, 20, '#4a4d52', { v: 'cross' }], ['x_parkL', '주차 칸', 'road', 2500, 5000, 6, '#55585e', { v: 'park' }], ['x_side', '보도 (10m)', 'sidewalk', 3000, 10000, 150, '#c9c3b8'],
  ['x_tree', '가로수', 'tree', 1800, 1800, 5500, '#5f8f4a'], ['x_tree2', '작은 나무', 'tree', 1000, 1000, 2800, '#6e9a55'], ['x_light', '가로등', 'streetlight', 400, 1600, 6000, '#3a3e44'], ['x_bench', '벤치', 'bench', 1500, 550, 430, '#a5774a'], ['x_signal', '신호등', 'signal', 400, 400, 3600, '#5a5f66'], ['x_cone', '라바콘', 'cone', 350, 350, 700, '#ff6a1a'],
  ['m_fkStand', '스탠딩 지게차'], ['m_fkRear', '후방 지게차'], ['m_fkDiesel', '디젤 지게차']];
ENVPROPS.forEach(([id, name, shape, w, d, h, color, x]) => { if (!shape || LIB.some((l) => l.id === id)) return; LIB.push({ id, name, cat: '배경', sub: /person/.test(shape) ? '사람' : /car|moto/.test(shape) ? '차량' : /road|sidewalk/.test(shape) ? '도로' : '거리', shape, w, d, h, layer: 'deco', color, mat: shape === 'car' || shape === 'moto' ? 'gloss' : 'plain', ...(x || {}) }); });
if (!CATS.some((c) => c.k === '배경')) { const i = CATS.findIndex((c) => c.k === '내 기물'); CATS.splice(i < 0 ? CATS.length : i, 0, { k: '배경', c: ['배경'] }); }
// 목록 그림
{ const _ts = thumbSvg; thumbSvg = function (l) { const sh = l.shape, c = l.color, sv = (b) => `<svg viewBox="0 0 40 40" aria-hidden="true">${b}</svg>`;
  if (sh === 'person') return sv(`<circle cx="20" cy="8" r="4.5" fill="#e8c4a0"/><rect x="14" y="13" width="12" height="13" rx="3" fill="${c}"/><rect x="15" y="26" width="4" height="11" fill="#2b2f36"/><rect x="21" y="26" width="4" height="11" fill="#2b2f36"/>`);
  if (sh === 'car') return sv(`<rect x="4" y="18" width="32" height="10" rx="3" fill="${c}" stroke="#555" stroke-width=".6"/><path d="M10 18l4-7h12l5 7z" fill="${c}" stroke="#555" stroke-width=".6"/><path d="M15 12h5v6h-8zM22 12h4l4 6h-8z" fill="#2f3a44"/><circle cx="11" cy="29" r="3.5" fill="#1d1f22"/><circle cx="29" cy="29" r="3.5" fill="#1d1f22"/>`);
  if (sh === 'moto') return sv(`<circle cx="9" cy="28" r="6" fill="none" stroke="#1d1f22" stroke-width="2.5"/><circle cx="31" cy="28" r="6" fill="none" stroke="#1d1f22" stroke-width="2.5"/><path d="M9 28l9-10h8l5 10" stroke="${c}" stroke-width="3" fill="none"/>`);
  if (sh === 'road') return sv(`<rect x="4" y="4" width="32" height="32" fill="#4a4d52"/>${l.v === 'cross' ? '<path d="M8 10h24M8 16h24M8 22h24M8 28h24" stroke="#fff" stroke-width="3"/>' : '<path d="M20 4v8M20 16v8M20 28v8" stroke="#f2c230" stroke-width="2"/>'}`);
  if (sh === 'sidewalk') return sv(`<rect x="6" y="4" width="28" height="32" fill="${c}"/><path d="M6 12h28M6 20h28M6 28h28" stroke="#9d9a92"/>`);
  if (sh === 'tree') return sv(`<rect x="18" y="22" width="4" height="14" fill="#6b4a33"/><circle cx="20" cy="15" r="11" fill="${c}"/>`);
  if (sh === 'streetlight' || sh === 'signal') return sv(`<rect x="18" y="8" width="3" height="28" fill="#3a3e44"/><rect x="18" y="6" width="14" height="3" fill="#3a3e44"/><rect x="27" y="9" width="7" height="4" fill="${sh === 'signal' ? '#3fae5a' : '#fff6d8'}"/>`);
  if (sh === 'bench') return sv(`<rect x="5" y="15" width="30" height="4" fill="${c}"/><rect x="5" y="21" width="30" height="4" fill="${c}"/><rect x="8" y="25" width="3" height="9" fill="#3a3e44"/><rect x="29" y="25" width="3" height="9" fill="#3a3e44"/>`);
  if (sh === 'cone') return sv(`<path d="M20 5l9 28H11z" fill="${c}"/><path d="M15 21h10M13 27h14" stroke="#fff" stroke-width="2"/><rect x="8" y="33" width="24" height="3" fill="#1d1f22"/>`);
  if (sh === 'forklift') return sv(`<rect x="7" y="16" width="16" height="12" fill="${c}"/><path d="M9 16V7h12v9" stroke="#2b2d31" stroke-width="2" fill="none"/><path d="M26 6v24M26 30h10" stroke="#3a3e44" stroke-width="2.5"/><circle cx="11" cy="30" r="4" fill="#1d1f22"/><circle cx="22" cy="30" r="4" fill="#1d1f22"/>`);
  if (sh === 'speaker') return sv(`<rect x="12" y="5" width="16" height="30" rx="2" fill="${c}"/><circle cx="20" cy="12" r="3" fill="#555"/><circle cx="20" cy="25" r="6" fill="#555"/>`);
  if (sh === 'cardterm') return sv(`<rect x="13" y="5" width="14" height="30" rx="3" fill="${c}"/><rect x="15" y="8" width="10" height="8" fill="#2f3a44"/><path d="M16 20h2M20 20h2M24 20h0M16 24h2M20 24h2M16 28h2M20 28h2" stroke="#c9ced4" stroke-width="2"/>`);
  if (sh === 'saladfr' || sh === 'toppingfr') return sv(`<rect x="4" y="18" width="32" height="17" fill="${c}" stroke="#777" stroke-width=".6"/><rect x="6" y="14" width="6" height="4" fill="#6fae4a"/><rect x="13" y="14" width="6" height="4" fill="#d84a3a"/><rect x="20" y="14" width="6" height="4" fill="#f2c230"/><rect x="27" y="14" width="6" height="4" fill="#e9e4d4"/>${sh === 'saladfr' ? '<path d="M5 6h30v6" stroke="#7fb8d6" fill="none" stroke-width="1.5"/>' : ''}`);
  if (sh === 'wallpic') return sv(`<rect x="6" y="9" width="28" height="22" fill="#2b2d31"/><rect x="9" y="12" width="22" height="16" fill="#9fc4d9"/><path d="M9 26l7-7 5 5 4-3 6 5" fill="#6e9a55"/>`);
  if (sh === 'wallfilm') return sv(`<rect x="6" y="5" width="28" height="30" fill="#f2e6d6"/><path d="M6 12h28M6 19h28M6 26h28" stroke="#c9a77a" stroke-width="2"/>`);
  return _ts(l); }; }
// 배경 단추: 소품을 끌어다 놓기
{ const _re = renderEnvPop; renderEnvPop = function () { _re(); const p = $('#envPop'); if (!p || $('#envProps', p)) return; const L = ENVPROPS.map((r) => LIB.find((l) => l.id === r[0])).filter(Boolean);
  p.insertAdjacentHTML('beforeend', `<div class="lbl" style="margin-top:6px">소품 · 사람 · 차량 · 도로 (끌어다 놓기)</div><div class="envprops" id="envProps">${L.map((l) => `<button class="epc" data-ep="${l.id}" title="${esc(l.name)} · 끌어서 놓거나 눌러서 가운데에">${thumbSvg(l)}<span>${esc(l.name)}</span></button>`).join('')}</div>`);
  $('#envProps', p).addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-ep]'); if (!b) return; libPointerDown(e, b.dataset.ep); }); }; }
{ const st = document.createElement('style'); st.textContent = '.envprops{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:4px;max-height:220px;overflow:auto;touch-action:pan-y}.envprops .epc{border:0;border-radius:10px;background:var(--fill);color:var(--fg);padding:4px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;cursor:grab}.envprops .epc svg{width:34px;height:34px}.envprops .epc span{line-height:1.15;text-align:center}'; document.head.appendChild(st); }
renderLib();
window.__p21 = { pickAt, setDrain, fitItems, itemsIn, needFit, footMax, slopePieces, SW, SMK, IMI, imiRun, imiMesh, syncFilms, heatItems, HEATK };
window.APP_VERSION = 'v23 · 2026-11-11';
}
