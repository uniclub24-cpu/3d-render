/* ================================================================
   v11 · 편집 도구
   공간(바닥·천장 그룹) · 공간만 보기 · 바닥 단차 · 구배 · 석고벽 보강재
   Ctrl+끌기 크기 조절 · Ctrl+Shift+끌기 이동 · 높이 커서 · 45°/직접 회전 · Esc 두 번 · 배경 레벨
   ================================================================ */
if (!LEVEL_KEYS.includes('rooms')) LEVEL_KEYS.push('rooms');
MATS.gypsum = { n: '석고보드', tex: 'plain' }; matOpts.gypsum = '석고보드';
var ROOMKINDS = ['홀', '주방', '집 · 거실', '방', '화장실', '베란다', '테라스', '실외기실', '주차장', '창고', '사무실', '기타'];
var ISO = null, ROOMDRAW = false, SLOPEPICK = null, HGT = false;
function rooms() { return (P && P.rooms) || []; }
function roomOf(id) { return rooms().find((r) => r.id === id); }
function roomAt(x, y) { const L = rooms(); for (let i = L.length - 1; i >= 0; i--) if (pointInPoly(x, y, L[i].pts)) return L[i]; return null; }
function polyCenter(p) { const b = aabb(p); let c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; if (!pointInPoly(c[0], c[1], p)) c = p.reduce((s, q) => [s[0] + q[0] / p.length, s[1] + q[1] / p.length], [0, 0]); return c; }
function polyEdgeDist(p, x, y) { let m = 1e12; for (let i = 0, j = p.length - 1; i < p.length; j = i++) m = Math.min(m, distPtSeg(x, y, { x1: p[j][0], y1: p[j][1], x2: p[i][0], y2: p[i][1] })[0]); return m; }
function slopeH(r, x, y) { const s = r && r.slope; if (!s || !s.drain || !s.deg) return 0; return Math.tan(s.deg * Math.PI / 180) * Math.hypot(x - s.drain[0], y - s.drain[1]); }
function floorAt(x, y) { const r = roomAt(x, y); return r ? (r.lift || 0) + slopeH(r, x, y) : 0; }
function ceilOf(r) { const g = P.ceiling || {}; return { on: g.on, color: g.color || '#f4f2ee', opacity: g.opacity ?? 0.45, h: P.ceilingH, ...((r && r.ceil) || {}) }; }
function earcut2(pts) {
  const n = pts.length; if (n < 3) return []; let idx = [...Array(n).keys()]; let a = 0; for (let i = 0, j = n - 1; i < n; j = i++) a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]); if (a < 0) idx.reverse();
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]), inT = (p, a1, b1, c1) => cr(a1, b1, p) >= 0 && cr(b1, c1, p) >= 0 && cr(c1, a1, p) >= 0;
  const out = []; let guard = 0;
  while (idx.length > 3 && guard++ < 4000) { let ok = false; for (let i = 0; i < idx.length; i++) { const A = idx[(i + idx.length - 1) % idx.length], B = idx[i], C = idx[(i + 1) % idx.length]; if (cr(pts[A], pts[B], pts[C]) <= 0) continue; if (idx.some((j) => j !== A && j !== B && j !== C && inT(pts[j], pts[A], pts[B], pts[C]))) continue; out.push([A, B, C]); idx.splice(i, 1); ok = true; break; } if (!ok) break; }
  if (idx.length === 3) out.push(idx); return out;
}
/* ---------- 공간만 보기 ---------- */
function withIso(fn) {
  const r = ISO && P && roomOf(ISO); if (!r) return fn();
  const inside = (x, y) => pointInPoly(x, y, r.pts) || polyEdgeDist(r.pts, x, y) < 320, keep = { items: P.items, walls: P.walls, openings: P.openings, lines: P.lines, rooms: P.rooms };
  P.items = P.items.filter((it) => pointInPoly(it.x, it.y, r.pts)); P.walls = P.walls.filter((w) => inside(w.x1, w.y1) && inside(w.x2, w.y2)); P.openings = P.openings.filter((o) => P.walls.some((w) => w.id === o.wall)); P.lines = P.lines.filter((l) => l.pts.every((p) => inside(p[0], p[1]))); P.rooms = [r];
  try { return fn(); } finally { Object.assign(P, keep); }
}
function setIso(id) { ISO = id || null; dirty3d = true; renderLevels(); draw2d(); renderProps(); if (id) { const r = roomOf(id); toast(`${r ? r.name : ''}만 보기 · 층 메뉴에서 "전체"를 누르면 돌아와요`); } }

/* ---------- 3D: 공간 바닥 · 단차 · 구배 · 천장 ---------- */
function drawRoom3d(r, i) {
  const T = xf(0, 0, 0), lift = r.lift || 0, base = 1 + i * 0.7, key = matTex(r.finish.type), g = grp(key === 'tile' ? 'tile' : key, matA(r.finish.type)), col = tintC(hexRGB(r.finish.color)), sl = r.slope && r.slope.drain && r.slope.deg;
  TINT = isSelected('room', r.id);
  const c0 = tintC(hexRGB(r.finish.color));
  if (!sl) { for (const [a, b, c] of earcut2(r.pts)) { const P3 = (k) => T.P(r.pts[k][0], lift + base, r.pts[k][1]); quad(g, [P3(a), P3(b), P3(c), P3(c)], [0, 1, 0], c0); } }
  else { const bb = aabb(r.pts), st = 200, hmax = slopeH(r, ...r.pts.reduce((m, p) => (slopeH(r, p[0], p[1]) > slopeH(r, m[0], m[1]) ? p : m), r.pts[0])) || 1;
    for (let x = bb[0]; x < bb[2]; x += st) for (let y = bb[1]; y < bb[3]; y += st) { const x1 = Math.min(x + st, bb[2]), y1 = Math.min(y + st, bb[3]); if (!pointInPoly((x + x1) / 2, (y + y1) / 2, r.pts)) continue;
      const hh = (px, py) => lift + base + slopeH(r, px, py), q = [[x, y], [x1, y], [x1, y1], [x, y1]].map(([px, py]) => [px, hh(px, py), py]);
      const u = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], v = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], nl = Math.hypot(...n) || 1;
      const k = 0.86 + 0.14 * (hh((x + x1) / 2, (y + y1) / 2) - lift) / hmax; const sg = n[1] < 0 ? -1 : 1; quad(g, q.map((p) => T.P(...p)), n.map((z) => sg * z / nl), col.map((z) => z * k)); }
    const d = r.slope.drain; box(T, d[0] - 90, d[0] + 90, lift + base, lift + base + 4, d[1] - 90, d[1] + 90, '#2b2d31', 'steel'); }
  if (r.pattern && !r.pattern.off && !sl) { const b = aabb(r.pts), s = r.pattern.size || 600, cxm = (b[0] + b[2]) / 2, cym = (b[1] + b[3]) / 2;
    for (let ii = -Math.ceil((cxm - b[0]) / s); cxm + ii * s - s / 2 < b[2]; ii++) for (let j = -Math.ceil((cym - b[1]) / s); cym + j * s - s / 2 < b[3]; j++) { if (((ii % 2) + 2) % 2 || ((j % 2) + 2) % 2) continue;
      const a0 = Math.max(b[0], cxm + ii * s - s / 2), a1 = Math.min(b[2], cxm + ii * s + s / 2), c0_ = Math.max(b[1], cym + j * s - s / 2), c1 = Math.min(b[3], cym + j * s + s / 2); if (a1 - a0 < 20 || c1 - c0_ < 20 || !pointInPoly((a0 + a1) / 2, (c0_ + c1) / 2, r.pts)) continue;
      box(T, a0 + 2, a1 - 2, lift + base, lift + base + 1.5, c0_ + 2, c1 - 2, r.pattern.color2, 'tile'); } }
  if (lift > 0) for (let k = 0, j = r.pts.length - 1; k < r.pts.length; j = k++) { const a = r.pts[j], b = r.pts[k], ha = lift + base + slopeH(r, a[0], a[1]), hb = lift + base + slopeH(r, b[0], b[1]), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    quad(grp('plain'), [T.P(a[0], 0, a[1]), T.P(b[0], 0, b[1]), T.P(b[0], hb, b[1]), T.P(a[0], ha, a[1])], [dz / L, 0, -dx / L], c0.map((z) => z * .78)); }
  TINT = false;
}
function drawCeilings3d() {
  const T = xf(0, 0, 0); let cov = 0;
  for (const r of rooms()) { const c = ceilOf(r); cov += polyArea(r.pts); if (!c.on) continue; TINT = isSelected('ceil', r.id) || isSelected('ceil', 'all'); FADE = !!FOCUS && FOCUS !== 'ceiling';
    const g = grp('plain', Math.min(0.999, c.opacity)), col = tintC(hexRGB(c.color)); for (const [a, b, cc] of earcut2(r.pts)) { const P3 = (k, y) => T.P(r.pts[k][0], y, r.pts[k][1]); quad(g, [P3(a, c.h), P3(b, c.h), P3(cc, c.h), P3(cc, c.h)], [0, -1, 0], col); quad(g, [P3(a, c.h + 15), P3(b, c.h + 15), P3(cc, c.h + 15), P3(cc, c.h + 15)], [0, 1, 0], col); }
    TINT = false; FADE = false; }
  const b = bounds(); if (P.ceiling && P.ceiling.on && cov < (b[2] - b[0]) * (b[3] - b[1]) * 0.9) { TINT = isSelected('ceil', 'all'); box(T, b[0], b[2], P.ceilingH + 20, P.ceilingH + 35, b[1], b[3], P.ceiling.color || '#f4f2ee', 'plain', Math.min(0.999, P.ceiling.opacity ?? 0.45)); TINT = false; }
}
{ const _bl = buildLevel; buildLevel = function (active) {
    const run = () => { const ceil = P.ceiling, mine = rooms().length > 0; if (mine) P.ceiling = { ...(ceil || {}), on: false };
      try { _bl(active); } finally { P.ceiling = ceil; }
      if (!window.ROOMS_ON) return; if (vis.floorL !== false) rooms().forEach((r, i) => { FADE = !!FOCUS && FOCUS !== 'floorL'; drawRoom3d(r, i); FADE = false; });
      if (mine && vis.ceiling !== false) drawCeilings3d(); };
    return active ? withIso(run) : run(); }; }
{ const _z = zOf; zOf = function (it) { const z = _z(it); if (!window.ROOMS_ON || !P || !P.rooms || !P.rooms.length || it.elev != null) return z; const ly = spec(it).layer; return ly === 'floor' || ly === 'deco' || ly === 'plumb' ? z + floorAt(it.x, it.y) : z; }; }

/* ---------- 2D: 공간 그리기 ---------- */
function drawRooms2d() {
  if (!window.ROOMS_ON || !rooms().length || vis.floorL === false) return;
  for (const r of rooms()) { const s = isSelected('room', r.id), c = r.finish.color; poly(r.pts, hexA(c, s ? .42 : .26), s ? getCss('--accent') : hexA('#000000', .25), s ? 3 : 1, s ? null : [5, 4]);
    const m = toS(...polyCenter(r.pts)); if (V.s > 0.02) { cx.font = '700 12px system-ui'; cx.textAlign = 'center'; cx.fillStyle = getCss('--muted') || '#8a8f98'; cx.fillText(`${r.name}${r.lift ? ` (+${r.lift})` : ''}${r.slope && r.slope.deg ? ` · 구배 ${r.slope.deg}°` : ''}`, m[0], m[1] - 6); cx.textAlign = 'left'; }
    if (r.slope && r.slope.drain && r.slope.deg) { const d = r.slope.drain, b = aabb(r.pts); cx.strokeStyle = '#2f8fd6'; cx.fillStyle = '#2f8fd6'; cx.lineWidth = 1.2;
      for (let x = b[0] + 400; x < b[2]; x += 800) for (let y = b[1] + 400; y < b[3]; y += 800) { if (!pointInPoly(x, y, r.pts)) continue; const L = Math.hypot(d[0] - x, d[1] - y); if (L < 300) continue; const ux = (d[0] - x) / L, uy = (d[1] - y) / L, a = toS(x, y), e = toS(x + ux * 260, y + uy * 260);
        cx.beginPath(); cx.moveTo(...a); cx.lineTo(...e); cx.stroke(); cx.beginPath(); cx.moveTo(...e); cx.lineTo(e[0] - (ux * 6 - uy * 4), e[1] - (uy * 6 + ux * 4)); cx.lineTo(e[0] - (ux * 6 + uy * 4), e[1] - (uy * 6 - ux * 4)); cx.fill(); }
      const q = toS(...d); cx.fillStyle = '#1f6fb0'; cx.beginPath(); cx.arc(q[0], q[1], 8, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '700 10px system-ui'; cx.textAlign = 'center'; cx.fillText('D', q[0], q[1] + 3.5); cx.textAlign = 'left'; }
  }
  for (const s of selList()) if (s.kind === 'ceil') { const r = roomOf(s.id), p = r ? r.pts : (() => { const b = bounds(); return [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]; })(); poly(p, null, '#8e6cf0', 3, [10, 5]); const m = toS(...polyCenter(p)); cx.font = '700 12px system-ui'; cx.fillStyle = '#8e6cf0'; cx.textAlign = 'center'; cx.fillText('천장 선택됨', m[0], m[1] + 12); cx.textAlign = 'left'; }
}
{ const _d = draw2d; draw2d = function () { withIso(() => _d()); if (!window.ROOMS_ON || !P || view === '3d' || OFF) return; drawBacks2d(); if (SLOPEPICK) { cx.fillStyle = 'rgba(47,143,214,.12)'; const r = roomOf(SLOPEPICK); if (r) poly(r.pts, 'rgba(47,143,214,.18)', '#2f8fd6', 2, [6, 4]); } }; }

/* ---------- 선택: 바닥 · 공간 · 천장 ---------- */
{ const _ht = hitTest; hitTest = function (wx, wy) { const h = withIso(() => _ht(wx, wy)); if (h || !window.ROOMS_ON || !P) return h; const r = withIso(() => roomAt(wx, wy)); if (r) return { kind: 'room', id: r.id };
    const ext = exteriorWalls(); if (ext.length) { const b = bounds(); if (wx > b[0] && wx < b[2] && wy > b[1] && wy < b[3]) return { kind: 'floor', id: 'floor' }; } return null; }; }
function ceilHit(e) {
  if (!P || vis.ceiling === false) return null; const { E: E0, D } = rayOf(e), E = [E0[0], E0[1] - curElev(), E0[2]];
  let best = null; const test = (h, poly_, id, c) => { if (!c.on || Math.abs(D[1]) < 1e-6) return; const t = (h - E[1]) / D[1]; if (t <= 0) return; const x = E[0] + D[0] * t, z = E[2] + D[2] * t; if (!pointInPoly(x, z, poly_)) return; if (E[1] > h && c.opacity < 0.6) return; if (!best || t < best.t) best = { t, rt: t, sel: { kind: 'ceil', id }, n: [0, -1, 0], p: [x, h, z] }; };
  if (rooms().length) for (const r of rooms()) test(ceilOf(r).h, r.pts, r.id, ceilOf(r)); else { const b = bounds(); test(P.ceilingH, [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], 'all', ceilOf(null)); }
  return best;
}
{ const _rh = rayHit; rayHit = function (e) { let h = withIso(() => _rh(e)); if (!window.ROOMS_ON || !P) return h;
    const c = ROOMDRAW || build3d ? null : withIso(() => ceilHit(e)); if (c && (!h || c.t < h.rt)) h = c;
    if (h && h.sel.kind === 'floor' && h.p) { const r = withIso(() => roomAt(h.p[0], h.p[2])); if (r) h.sel = { kind: 'room', id: r.id }; } return h; }; }
{ const _sn = selName; selName = function () { if (sel && sel.kind === 'room') { const r = roomOf(sel.id); return r ? `${r.name} 바닥` : ''; } if (sel && sel.kind === 'ceil') { const r = roomOf(sel.id); return sel.id === 'all' ? '천장 (전체)' : r ? `${r.name} 천장` : ''; } return _sn(); }; }
{ const _sc = selColor; selColor = function () { if (sel.kind === 'room') return roomOf(sel.id).finish.color; if (sel.kind === 'ceil') return ceilOf(roomOf(sel.id)).color; return _sc(); }; }
{ const _sm = selMat; selMat = function () { if (sel.kind === 'room') return normMat(roomOf(sel.id).finish.type); if (sel.kind === 'ceil') return null; return _sm(); }; }
const selRooms = () => selList().filter((s) => s.kind === 'room').map((s) => roomOf(s.id)).filter(Boolean);
const selCeils = () => selList().filter((s) => s.kind === 'ceil').map((s) => s.id);
function setCeil(id, patch) { if (id === 'all' || !rooms().length) { P.ceiling = { ...(P.ceiling || {}), ...patch }; if (id === 'all') for (const r of rooms()) if (r.ceil) for (const k in patch) delete r.ceil[k]; } else { const r = roomOf(id); if (r) r.ceil = { ...(r.ceil || {}), ...patch }; } }
{ const _sc = setSelColor; setSelColor = function (c) { if (sel && sel.kind === 'room') { selRooms().forEach((r) => (r.finish = { ...r.finish, color: c })); commit(); dirty3d = true; return; } if (sel && sel.kind === 'ceil') { selCeils().forEach((id) => setCeil(id, { color: c })); commit(); dirty3d = true; return; } _sc(c); }; }
{ const _sm = setSelMat; setSelMat = function (m) { if (sel && sel.kind === 'room') { selRooms().forEach((r) => (r.finish = { ...r.finish, type: m })); commit(); dirty3d = true; return; } _sm(m); }; }
{ const _ds = delSel; delSel = function () { if (sel && sel.kind === 'room') { const ids = new Set(selRooms().map((r) => r.id)); P.rooms = rooms().filter((r) => !ids.has(r.id)); if (ids.has(ISO)) ISO = null; multi = []; sel = null; commit(); dirty3d = true; renderProps(); return; } if (sel && sel.kind === 'ceil') { selCeils().forEach((id) => setCeil(id, { on: false })); commit(); dirty3d = true; renderProps(); return; } _ds(); }; }
{ const _dp = dupSel; dupSel = function () { if (sel && (sel.kind === 'room' || sel.kind === 'ceil')) return; _dp(); }; const _cs = copySel; copySel = function () { if (sel && (sel.kind === 'room' || sel.kind === 'ceil')) return; _cs(); }; }
{ const _qd = quickDims; quickDims = function () { if (sel.kind === 'item') { const it = itemOf(sel.id); return [..._qd(), ['설치 높이', zOf(it), (v) => (it.elev = Math.max(0, v))]]; } return _qd(); }; }
function selectGroup(how) {
  const r0 = roomOf(sel.id); if (!r0) return; const L = rooms().filter((r) => (how === 'kind' ? r.kind === r0.kind : r.finish.color === r0.finish.color));
  multi = L.map((r) => ({ kind: 'room', id: r.id })); sel = multi[multi.length - 1]; if (multi.length < 2) multi = []; dirty3d = true; renderProps(); draw2d(); toast(`${how === 'kind' ? r0.kind : '같은 색'} ${L.length}곳 선택 · 색 · 재질 · 높이를 한 번에 바꿔요`);
}

/* ---------- 속성 창 · 빠른 창 (공간 · 천장) ---------- */
function roomPanel() {
  const L = selRooms(), r = roomOf(sel.id), M = L.length > 1, c = ceilOf(r), sl = r.slope || {};
  return `<div class="ph"><span class="dot" style="background:${r.finish.color}"></span><div><b>${M ? `공간 ${L.length}곳` : esc(r.name)}</b><small>${esc(r.kind)} · ${(polyArea(r.pts) / 1e6).toFixed(1)}㎡ · 바닥 그룹</small></div></div>
    ${M ? '' : `<div class="g3">${field('이름', 'rmName', r.name, 'text')}${sel_('공간 종류', 'rmKind', Object.fromEntries(ROOMKINDS.map((k) => [k, k])), r.kind)}</div>`}
    ${sel_('바닥 마감', 'rmFin', matOpts, normMat(r.finish.type))}<div class="lbl">바닥 색</div>${swatches('room', r.finish.color)}
    <div class="g3">${field('바닥 높이 (단차 mm)', 'rmLift', r.lift || 0)}</div><p class="hint">주방턱 · 단차가 있으면 높이를 넣어요. 그 위 기물도 같이 올라가요.</p>
    ${r.pattern ? `<label class="chk"><input type="checkbox" id="rmPat" ${r.pattern.off ? '' : 'checked'}> 2톤 바닥 패턴</label>` : ''}
    <div class="lbl">천장</div><div class="row wrap"><label class="chk"><input type="checkbox" id="rmCeilOn" ${c.on ? 'checked' : ''}> 천장 보이기</label></div>
    <div class="g3">${field('천장 높이', 'rmCeilH', c.h)}<label class="fld"><span>투명도 ${Math.round((1 - c.opacity) * 100)}%</span><input type="range" id="rmCeilOp" min="0.05" max="1" step="0.05" value="${c.opacity}"></label></div>
    <div class="lbl">구배 (물빠짐 경사)</div>
    <div class="g3"><label class="fld"><span>경사 <b id="rmDegV">${sl.deg || 1}°</b></span><input type="range" id="rmDeg" min="1" max="15" step="0.5" value="${sl.deg || 1}"></label><button class="btn ${SLOPEPICK ? 'pri' : ''}" id="rmSlope">${sl.drain ? '배수 위치 다시 찍기' : '구배 만들기 · 배수 위치 찍기'}</button>${sl.drain ? '<button class="btn" id="rmSlopeOff">구배 없애기</button>' : ''}</div>
    <p class="hint">${SLOPEPICK ? '도면이나 3D에서 물이 빠질 곳(배수구)을 누르세요' : sl.drain ? `배수구 쪽으로 ${sl.deg}° 기울어 있어요 · 가장 높은 곳 +${Math.round(Math.max(...r.pts.map((p) => slopeH(r, p[0], p[1]))))}mm` : '배수구를 찍으면 바닥 전체가 그쪽으로 자연스럽게 기울어요'}</p>
    <div class="row wrap"><button class="btn" id="rmSameK">같은 종류 모두 선택</button><button class="btn" id="rmSameC">같은 색 모두 선택</button><button class="btn" id="rmIso">${ISO === r.id ? '전체 보기' : '이 공간만 보기'}</button></div>
    <div class="row wrap"><button class="btn" id="rmDraw">바닥 나누기 (그려서 새 공간)</button><button class="btn danger" id="rmDel">공간 지우기</button></div>`;
}
function bindRoomPanel() {
  const L = selRooms(), r = roomOf(sel.id), all = (f) => { L.forEach(f); commit(); dirty3d = true; draw2d(); }, ch = (id, f) => { const el = $('#' + id); if (el) el.addEventListener('change', (e) => f(e.target)); };
  ch('rmName', (t) => all((x) => (x.name = t.value.trim() || x.name))); ch('rmKind', (t) => all((x) => { if (x.name === x.kind) x.name = t.value; x.kind = t.value; }));
  ch('rmFin', (t) => all((x) => (x.finish = { ...x.finish, type: t.value }))); bindSw('room', (c) => all((x) => (x.finish = { ...x.finish, color: c })));
  ch('rmLift', (t) => all((x) => (x.lift = clamp(+t.value || 0, -1000, 1500)))); ch('rmPat', (t) => all((x) => x.pattern && (x.pattern.off = !t.checked)));
  ch('rmCeilOn', (t) => all((x) => (x.ceil = { ...(x.ceil || {}), on: t.checked }))); ch('rmCeilH', (t) => all((x) => (x.ceil = { ...(x.ceil || {}), h: clamp(+t.value || P.ceilingH, 1800, 8000) })));
  const op = $('#rmCeilOp'); if (op) { op.oninput = () => { L.forEach((x) => (x.ceil = { ...(x.ceil || {}), opacity: +op.value })); dirty3d = true; }; op.onchange = () => { commit(); renderProps(); }; }
  const dg = $('#rmDeg'); if (dg) { dg.oninput = () => { $('#rmDegV').textContent = dg.value + '°'; L.forEach((x) => { if (x.slope) x.slope.deg = +dg.value; }); dirty3d = true; draw2d(); }; dg.onchange = () => { L.forEach((x) => (x.slope = { ...(x.slope || {}), deg: +dg.value })); commit(); renderProps(); }; }
  const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
  on('rmSlope', () => { SLOPEPICK = r.id; renderProps(); draw2d(); toast('물이 빠질 곳(배수구)을 누르세요 · Esc로 취소'); });
  on('rmSlopeOff', () => all((x) => (x.slope = null))); on('rmSameK', () => selectGroup('kind')); on('rmSameC', () => selectGroup('color'));
  on('rmIso', () => setIso(ISO === r.id ? null : r.id)); on('rmDraw', startRoomDraw); on('rmDel', () => delSel());
}
function ceilPanel() {
  const r = roomOf(sel.id), c = ceilOf(r);
  return `<div class="ph"><span class="dot" style="background:${c.color}"></span><div><b>${esc(selName())}</b><small>${rooms().length ? '공간별 천장 · 같은 공간 바닥과 한 그룹' : '전체 천장'}</small></div></div>
    <label class="chk"><input type="checkbox" id="ceOn" ${c.on ? 'checked' : ''}> 천장 보이기</label>
    <div class="g3">${field('천장 높이', 'ceH', c.h)}<label class="fld"><span>투명도 <b id="ceOpV">${Math.round((1 - c.opacity) * 100)}%</b></span><input type="range" id="ceOp" min="0.05" max="1" step="0.05" value="${c.opacity}"></label></div>
    <div class="lbl">천장 색</div>${swatches('ceil', c.color)}
    <div class="row wrap">${rooms().length ? '<button class="btn" id="ceAll">모든 천장 선택</button>' : ''}<button class="btn danger" id="ceOff">천장 숨기기</button></div>`;
}
function bindCeilPanel() {
  const ids = selCeils(), ap = (patch, re) => { ids.forEach((id) => setCeil(id, patch)); if (patch.h) P.ceilingH = ids.includes('all') ? patch.h : P.ceilingH; commit(); dirty3d = true; syncCeilOpt(); if (re) renderProps(); };
  $('#ceOn').onchange = (e) => ap({ on: e.target.checked }); $('#ceH').onchange = (e) => ap({ h: clamp(+e.target.value || P.ceilingH, 1800, 8000) });
  const op = $('#ceOp'); op.oninput = () => { $('#ceOpV').textContent = Math.round((1 - op.value) * 100) + '%'; ids.forEach((id) => setCeil(id, { opacity: +op.value })); dirty3d = true; }; op.onchange = () => { commit(); syncCeilOpt(); };
  bindSw('ceil', (c) => ap({ color: c }, true)); if ($('#ceAll')) $('#ceAll').onclick = () => { multi = rooms().map((r) => ({ kind: 'ceil', id: r.id })); sel = multi[multi.length - 1]; if (multi.length < 2) multi = []; dirty3d = true; renderProps(); draw2d(); };
  $('#ceOff').onclick = () => ap({ on: false }, true);
}
{ const _rp = renderProps0; renderProps0 = function () { if (P && sel && (sel.kind === 'room' || sel.kind === 'ceil') && existsSel(sel)) { renderQuick(); const el = $('#props'); if (sel.kind === 'room') { el.innerHTML = roomPanel(); bindRoomPanel(); } else { el.innerHTML = ceilPanel(); bindCeilPanel(); } return; } if (sel && (sel.kind === 'room' || sel.kind === 'ceil')) sel = null; _rp(); }; }
{ const _rq = renderQuick0; renderQuick0 = function () {
    _rq(); const q = $('#quick');
    if (q && !q.hidden && sel && sel.kind === 'item' && qTab === 'rot') { const a = $('[data-rt="-15"]', q), b = $('[data-rt="15"]', q); if (a && !$('[data-rt="-45"]', q)) { a.insertAdjacentHTML('beforebegin', '<button class="qb" data-rt="-45">↺ 45°</button>'); b.insertAdjacentHTML('afterend', '<button class="qb" data-rt="45">↻ 45°</button>'); $$('[data-rt="-45"],[data-rt="45"]', q).forEach((x) => (x.onclick = () => rotSel(+x.dataset.rt))); } }
    if (!q || !sel || (sel.kind !== 'room' && sel.kind !== 'ceil') || !existsSel(sel)) return; if (document.body.classList.contains('show') || document.body.classList.contains('clean')) { q.hidden = true; return; }
    const isR = sel.kind === 'room', r = roomOf(sel.id), col = selColor(), mat = isR ? normMat(r.finish.type) : null;
    q.hidden = false; q.innerHTML = `<div class="qhead"><b class="qn">${esc(multi.length > 1 ? `${multi.length}개 선택` : selName())}</b><button class="qb" id="qX" aria-label="선택 해제">✕</button></div><div class="qbody">
      ${isR ? `<div class="qrow wrap"><button class="qb" id="qgK">같은 종류 모두</button><button class="qb" id="qgC">같은 색 모두</button><label class="qf"><span>바닥 높이</span><input id="qLift" type="number" value="${r.lift || 0}"></label></div>`
        : `<div class="qrow"><label class="qf"><span>투명도</span><input id="qCeOp" type="range" min="0.05" max="1" step="0.05" value="${ceilOf(r).opacity}"></label><button class="qb" id="qCeOff">천장 숨기기</button></div>`}
      <div class="qpal">${PALETTE.map((c) => `<button class="swb ${c === col ? 'on' : ''}" style="background:${c}" data-qc="${c}" aria-label="${c}"></button>`).join('')}</div><label class="swc">직접 고르기<input type="color" id="qCustom" value="${col}"></label>
      <div class="qrow"><button class="qb" id="qMore">상세 속성</button></div></div>`;
    $('#qX').onclick = () => pickSel(null); $$('[data-qc]', q).forEach((b) => (b.onclick = () => setSelColor(b.dataset.qc))); $('#qCustom').onchange = (e) => setSelColor(e.target.value);
    $$('[data-mt]', q).forEach((b) => (b.onclick = () => setSelMat(b.dataset.mt))); $('#qMore').onclick = () => { if (isMobile()) openSheet('props'); else document.body.classList.remove('no-right'); };
    if (isR) { $('#qgK').onclick = () => selectGroup('kind'); $('#qgC').onclick = () => selectGroup('color'); $('#qLift').onchange = (e) => { selRooms().forEach((x) => (x.lift = clamp(+e.target.value || 0, -1000, 1500))); commit(); dirty3d = true; draw2d(); }; }
    else { const op = $('#qCeOp'); op.oninput = () => { selCeils().forEach((id) => setCeil(id, { opacity: +op.value })); dirty3d = true; }; op.onchange = () => commit(); $('#qCeOff').onclick = () => { selCeils().forEach((id) => setCeil(id, { on: false })); commit(); dirty3d = true; }; }
  }; }
// 구배: 배수 위치 찍기
function slopeAt(wx, wy) { const r = roomOf(SLOPEPICK); SLOPEPICK = null; if (!r) return; if (!pointInPoly(wx, wy, r.pts)) { toast('그 공간 안쪽을 눌러 주세요'); renderProps(); return; } r.slope = { deg: (r.slope && r.slope.deg) || 1, drain: [Math.round(wx), Math.round(wy)] }; if (!P.items.some((it) => it.type === 'drain' && Math.hypot(it.x - wx, it.y - wy) < 200)) P.items.push({ id: uid('i'), type: 'drain', x: Math.round(wx), y: Math.round(wy), w: 150, d: 150, rot: 0, tag: '배수구 (구배)' }); commit(); dirty3d = true; draw2d(); renderProps(); toast(`구배 ${r.slope.deg}° · 배수구 쪽으로 기울였어요`); }
cv.addEventListener('pointerdown', (e) => { if (!SLOPEPICK) return; e.stopImmediatePropagation(); const r = cv.getBoundingClientRect(); slopeAt(...toW(e.clientX - r.left, e.clientY - r.top)); }, true);
gc.addEventListener('pointerdown', (e) => { if (!SLOPEPICK || e.button !== 0) return; const g = planeHit(e, 0); if (!g) return; e.stopImmediatePropagation(); slopeAt(g[0], g[1]); }, true);

/* ---------- 바닥 나누기 (그리기 도구 · 보정 ON/OFF) ---------- */
function startRoomDraw() { setTool('line'); ROOMDRAW = true; $('#lineKinds').hidden = true; if ($('#lkSel')) $('#lkSel').hidden = true; $('#drawHint').textContent = '바닥 나누기 · 공간 모양대로 점을 찍거나 손으로 그려요 · 첫 점을 다시 누르거나 Esc로 닫기'; toast('바닥 나누기: 새 공간의 테두리를 그리세요'); }
function makeRoom(pts) {
  pts = pts.map((p) => [Math.round(p[0]), Math.round(p[1])]); if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 300) pts.pop();
  if (pts.length < 3 || polyArea(pts) < 250000) { toast('공간이 너무 작아요 · 세 점 이상으로 크게 그려 주세요'); return; }
  const c = polyCenter(pts), under = roomAt(c[0], c[1]), n = rooms().length + 1;
  const r = { id: uid('r'), name: `공간 ${n}`, kind: '기타', pts, finish: under ? { ...under.finish } : { ...(P.floor || { type: 'tile', color: '#c9c3b8' }) }, lift: under ? under.lift || 0 : 0 };
  if (!rooms().length) { const b = bounds(), T = (P.wallT || 150) / 2; P.rooms = [{ id: uid('r'), name: '전체 바닥', kind: '홀', pts: [[b[0] + T, b[1] + T], [b[2] - T, b[1] + T], [b[2] - T, b[3] - T], [b[0] + T, b[3] - T]], finish: { ...(P.floor || { type: 'tile', color: '#c9c3b8' }) }, lift: 0 }]; }
  P.rooms.push(r); ROOMDRAW = false; setTool('select'); commit(); dirty3d = true; pickSel({ kind: 'room', id: r.id }); toast(`${r.name}을 만들었어요 · 오른쪽에서 종류(주방 · 화장실 …)와 높이를 정하세요`);
}
{ const _st = setTool; setTool = function (t) { ROOMDRAW = false; _st(t); }; }
{ const _ap = addPath; addPath = function (pts, kind) { if (ROOMDRAW) { makeRoom(pts); return; } _ap(pts, kind); }; }
{ const _fd = finishDraft; finishDraft = function () { if (ROOMDRAW && draft && !draft.free) { const p = draft.pts; draft = null; if (p.length >= 3) makeRoom(p); else draw2d(); return; } _fd(); }; }
cv.addEventListener('pointerdown', (e) => { if (!ROOMDRAW || !draft || draft.free || draft.pts.length < 3 || drawMode !== 'line') return; const r = cv.getBoundingClientRect(), a = toS(...draft.pts[0]); if (Math.hypot(e.clientX - r.left - a[0], e.clientY - r.top - a[1]) < 14) { e.stopImmediatePropagation(); finishDraft(); } }, true);

/* ---------- Esc: 그리던 선 끝내기 → 한 번 더 누르면 그리기 창 닫기 ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return; const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; if (document.querySelector('dialog[open]')) return;
  const stop = () => { e.stopImmediatePropagation(); e.preventDefault(); };
  if (typeof PK !== 'undefined' && PK) { stop(); pkEnd(false); return; }
  if (SLOPEPICK) { stop(); SLOPEPICK = null; renderProps(); draw2d(); return; }
  if (draft) { stop(); if (draft.free) { draft = null; draw2d(); } else finishDraft(); toast('그리기 끝 · Esc를 한 번 더 누르면 그리기 창을 닫아요'); return; }
  if (draft3) { stop(); finish3(); toast('그리기 끝 · Esc를 한 번 더 누르면 그리기 창을 닫아요'); return; }
  if (build3d || tool !== 'select') { stop(); if (build3d) setBuild(false); setTool('select'); updDrawBar(); toast('그리기를 닫았어요'); return; }
  if (ISO && !sel) { stop(); setIso(null); }
}, true);

/* ---------- Ctrl + 끌기: 모서리 · 면 잡고 크기 조절 (2D · 3D) ---------- */
let EDGE = null;
const r10 = (v) => Math.round(v / 10) * 10;
function edgeStartItem(it, side, F) { const a = (it.rot || 0) * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)], ax = side === 'E' || side === 'W' ? ux : uy, s = side === 'E' || side === 'S' ? 1 : -1, size = side === 'E' || side === 'W' ? it.w : it.d;
  return { kind: 'item', it, ax, s, dim: side === 'E' || side === 'W' ? 'w' : 'd', F: F || [it.x - s * ax[0] * size / 2, it.y - s * ax[1] * size / 2] }; }
function edgeApply(E, wx, wy) {
  if (E.kind === 'item') { const it = E.it, p = (wx - E.F[0]) * E.ax[0] * E.s + (wy - E.F[1]) * E.ax[1] * E.s, size = Math.max(30, r10(p)); it[E.dim] = size; it.x = Math.round(E.F[0] + E.s * E.ax[0] * size / 2); it.y = Math.round(E.F[1] + E.s * E.ax[1] * size / 2); return `${E.dim === 'w' ? '가로' : '깊이'} ${size}mm`; }
  if (E.kind === 'wallend') { const w = E.w, L = Math.max(50, r10((wx - E.F[0]) * E.dir[0] + (wy - E.F[1]) * E.dir[1])), p = [Math.round(E.F[0] + E.dir[0] * L), Math.round(E.F[1] + E.dir[1] * L)];
    if (E.k === 2) { w.x2 = p[0]; w.y2 = p[1]; } else { w.x1 = p[0]; w.y1 = p[1]; } for (const [o, kk] of E.links) { if (kk === 1) { o.x1 = p[0]; o.y1 = p[1]; } else { o.x2 = p[0]; o.y2 = p[1]; } } return `벽 길이 ${L}mm`; }
  if (E.kind === 'wallT') { const w = E.w, [d] = distPtSeg(wx, wy, w); w.t = Math.max(50, r10(d * 2)); return `벽 두께 ${w.t}mm`; }
}
function edgeHeight(E, dy) { const k = E.wpp * -dy; if (E.kind === 'top') { E.it.h = Math.max(20, r10(E.h0 + k)); return `높이 ${E.it.h}mm`; } if (E.kind === 'bottom') { const dz = r10(k), e = Math.max(0, E.e0 + dz); E.it.elev = e; E.it.h = Math.max(20, E.h0 - (e - E.e0)); return `설치 높이 ${e}mm · 높이 ${E.it.h}mm`; } if (E.kind === 'wallH') { E.w.h = Math.max(300, r10(E.h0 + k)); return `벽 높이 ${E.w.h}mm`; } }
function wallLinks(w, k) { const ox = k === 1 ? w.x1 : w.x2, oy = k === 1 ? w.y1 : w.y2; return P.walls.filter((o) => o !== w).flatMap((o) => [[o, 1], [o, 2]]).filter(([o, kk]) => Math.abs((kk === 1 ? o.x1 : o.x2) - ox) < 2 && Math.abs((kk === 1 ? o.y1 : o.y2) - oy) < 2); }
function wallEnd(w, k) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, F = k === 2 ? [w.x1, w.y1] : [w.x2, w.y2], dir = k === 2 ? [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L] : [(w.x1 - w.x2) / L, (w.y1 - w.y2) / L]; return { kind: 'wallend', w, k, F, dir, links: wallLinks(w, k) }; }
function edge2dAt(wx, wy) {
  if (!sel || multi.length > 1) return null; const tol = 12 / V.s;
  if (sel.kind === 'item') { const it = itemOf(sel.id); if (!it) return null; const a = (it.rot || 0) * Math.PI / 180, dx = wx - it.x, dy = wy - it.y, lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const c = [['E', Math.abs(lx - it.w / 2), Math.abs(ly) < it.d / 2 + tol], ['W', Math.abs(lx + it.w / 2), Math.abs(ly) < it.d / 2 + tol], ['S', Math.abs(ly - it.d / 2), Math.abs(lx) < it.w / 2 + tol], ['N', Math.abs(ly + it.d / 2), Math.abs(lx) < it.w / 2 + tol]].filter((q) => q[2] && q[1] < tol).sort((p, q) => p[1] - q[1])[0];
    return c ? edgeStartItem(it, c[0]) : null; }
  if (sel.kind === 'wall') { const w = wallOf(sel.id); if (!w) return null; for (const k of [1, 2]) if (Math.hypot(wx - (k === 1 ? w.x1 : w.x2), wy - (k === 1 ? w.y1 : w.y2)) < Math.max(tol * 1.5, wallT(w))) return wallEnd(w, k);
    const [d] = distPtSeg(wx, wy, w); if (Math.abs(d - wallT(w) / 2) < tol) return { kind: 'wallT', w }; }
  return null;
}
const curFor = (E) => (!E ? '' : E.kind === 'wallT' ? 'col-resize' : 'ew-resize');
cv.addEventListener('pointerdown', (e) => { if (!(e.ctrlKey || e.metaKey) || e.shiftKey || tool !== 'select' || e.button !== 0) return; const r = cv.getBoundingClientRect(), [wx, wy] = toW(e.clientX - r.left, e.clientY - r.top), E = edge2dAt(wx, wy); if (!E) return;
  e.stopImmediatePropagation(); e.preventDefault(); cv.setPointerCapture(e.pointerId); EDGE = { ...E, pane: '2d' }; }, true);
cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(), [wx, wy] = toW(e.clientX - r.left, e.clientY - r.top);
  if (EDGE && EDGE.pane === '2d') { e.stopImmediatePropagation(); const t = edgeApply(EDGE, wx, wy); EDGE.moved = true; analyze(); draw2d(); dirty3d = true; showVal(t, e); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.buttons && tool === 'select') cv.style.cursor = curFor(edge2dAt(wx, wy)) || 'default'; else if (tool === 'select' && cv.style.cursor !== 'default' && !e.buttons) cv.style.cursor = 'default'; }, true);
cv.addEventListener('pointerup', (e) => { if (EDGE && EDGE.pane === '2d') { e.stopImmediatePropagation(); if (EDGE.moved) commit(); EDGE = null; hideVal(); } }, true);
gc.addEventListener('pointerdown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.button !== 0 || !sel || multi.length > 1 || build3d || SLOPEPICK) return; const h = rayHit(e); if (!h || h.sel.kind !== sel.kind || h.sel.id !== sel.id) return;
  const n = h.n, rr = gc.getBoundingClientRect(), eye_ = eye(), wpp = 2 * Math.hypot(h.p[0] - eye_[0], h.p[1] + curElev() - eye_[1], h.p[2] - eye_[2]) * Math.tan(cam.fov * Math.PI / 360) / rr.height; let E = null;
  if (sel.kind === 'item') { const it = itemOf(sel.id), s = spec(it);
    if (n[1] > .7) E = { kind: 'top', it, h0: s.h }; else if (n[1] < -.7) E = { kind: 'bottom', it, h0: s.h, e0: zOf(it) };
    else { const a = (it.rot || 0) * Math.PI / 180, dx = n[0] * Math.cos(a) + n[2] * Math.sin(a), dz = -n[0] * Math.sin(a) + n[2] * Math.cos(a); E = edgeStartItem(it, Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'E' : 'W') : (dz > 0 ? 'S' : 'N')); E.y = h.p[1]; } }
  else if (sel.kind === 'wall') { const w = wallOf(sel.id), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, d = [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L], dt = n[0] * d[0] + n[2] * d[1];
    if (n[1] > .7) E = { kind: 'wallH', w, h0: wallH(w) }; else if (Math.abs(dt) > .7) { E = wallEnd(w, dt > 0 ? 2 : 1); E.y = h.p[1]; } else { E = { kind: 'wallT', w, y: h.p[1] }; } }
  if (!E) return; e.stopImmediatePropagation(); e.preventDefault(); gc.setPointerCapture(e.pointerId); EDGE = { ...E, pane: '3d', wpp, sy: e.clientY };
}, true);
gc.addEventListener('pointermove', (e) => { if (!EDGE || EDGE.pane !== '3d') return; e.stopImmediatePropagation(); let t;
  if (EDGE.kind === 'top' || EDGE.kind === 'bottom' || EDGE.kind === 'wallH') t = edgeHeight(EDGE, e.clientY - EDGE.sy); else { const g = planeHit(e, EDGE.y || 0); if (!g) return; t = edgeApply(EDGE, g[0], g[1]); }
  EDGE.moved = true; analyze(); dirty3d = true; draw2d(); showVal(t, e); }, true);
gc.addEventListener('pointerup', (e) => { if (EDGE && EDGE.pane === '3d') { e.stopImmediatePropagation(); if (EDGE.moved) commit(); EDGE = null; hideVal(); renderProps(); } }, true);
function showVal(t, e) { let v = $('#valTip'); if (!v) { $('#stage').insertAdjacentHTML('beforeend', '<div class="valtip" id="valTip"></div>'); v = $('#valTip'); } const st = $('#stage').getBoundingClientRect(); v.textContent = t || ''; v.style.left = (e.clientX - st.left + 14) + 'px'; v.style.top = (e.clientY - st.top - 30) + 'px'; v.hidden = !t; }
function hideVal() { const v = $('#valTip'); if (v) v.hidden = true; }

/* ---------- Ctrl + Shift + 끌기: 같은 높이에서 옮기기 (끌기 OFF여도) ---------- */
for (const el of [cv, gc]) el.addEventListener('pointerdown', (e) => { if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || !sel || tool !== 'select' || build3d) return; const k = moveOn; moveOn = true; setTimeout(() => { moveOn = k; }, 0); }, true);

/* ---------- 높이 커서 (3D 메뉴 · 이동 옆) ---------- */
{ const seg = $('#v3d .bar .seg.bm'); if (seg) seg.insertAdjacentHTML('afterend', '<button class="tg" id="hgtBtn" aria-pressed="false" title="선택한 오브젝트를 위아래로 끌어 설치 높이 조절">높이 OFF</button>'); }
function setHgt(on) { HGT = !!on; const b = $('#hgtBtn'); if (b) { b.setAttribute('aria-pressed', HGT); b.textContent = HGT ? '높이 ON' : '높이 OFF'; } gc.style.cursor = HGT ? 'ns-resize' : ''; if (HGT) toast(sel ? '선택한 오브젝트를 위아래로 끌면 설치 높이가 바뀌어요' : '오브젝트를 먼저 선택하고 위아래로 끌어요'); }
if ($('#hgtBtn')) $('#hgtBtn').onclick = () => setHgt(!HGT);
gc.addEventListener('pointerdown', (e) => { if (!HGT || e.button !== 0 || e.ctrlKey || e.metaKey || !sel || build3d) return; const h = rayHit(e); if (!h || !isSelected(h.sel.kind, h.sel.id) || h.sel.kind !== 'item') return;
  const its = selList().filter((s) => s.kind === 'item').map((s) => itemOf(s.id)).filter(Boolean), rr = gc.getBoundingClientRect(), eye_ = eye(), wpp = 2 * Math.hypot(h.p[0] - eye_[0], h.p[1] + curElev() - eye_[1], h.p[2] - eye_[2]) * Math.tan(cam.fov * Math.PI / 360) / rr.height;
  e.stopImmediatePropagation(); e.preventDefault(); gc.setPointerCapture(e.pointerId); EDGE = { kind: 'elev', pane: 'h', its: its.map((it) => [it, zOf(it)]), sy: e.clientY, wpp }; }, true);
gc.addEventListener('pointermove', (e) => { if (!EDGE || EDGE.pane !== 'h') return; e.stopImmediatePropagation(); const dz = r10(-(e.clientY - EDGE.sy) * EDGE.wpp); for (const [it, e0] of EDGE.its) it.elev = Math.max(0, e0 + dz); EDGE.moved = true; dirty3d = true; showVal(`설치 높이 ${EDGE.its[0][0].elev}mm`, e); }, true);
gc.addEventListener('pointerup', (e) => { if (EDGE && EDGE.pane === 'h') { e.stopImmediatePropagation(); if (EDGE.moved) commit(); EDGE = null; hideVal(); renderProps(); } }, true);

/* ---------- 돌리기: 90° · 45° · 직접 (벽도) ---------- */
function rotWall(w, deg) { const cx_ = (w.x1 + w.x2) / 2, cy_ = (w.y1 + w.y2) / 2, a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), R = (x, y) => [Math.round(cx_ + (x - cx_) * c - (y - cy_) * s), Math.round(cy_ + (x - cx_) * s + (y - cy_) * c)]; [w.x1, w.y1] = R(w.x1, w.y1); [w.x2, w.y2] = R(w.x2, w.y2); }
{ const _rs = rotSel; rotSel = function (d) { if (sel && sel.kind === 'wall' && multi.length < 2) { rotWall(wallOf(sel.id), d); commit(); dirty3d = true; return; } _rs(d); }; }
function rotPop(btn) {
  let p = $('#rotPop'); if (!p) { $('#stage').insertAdjacentHTML('beforeend', '<div class="rotpop glass" id="rotPop" hidden></div>'); p = $('#rotPop'); }
  const cur = sel && sel.kind === 'item' ? itemOf(sel.id).rot || 0 : 0;
  p.innerHTML = `<div class="dphead"><b>돌리기</b><span class="muted">아치 · 대각선 구조물은 45° · 직접 각도로</span></div><div class="row wrap"><button class="qb" data-rp="-90">↺ 90°</button><button class="qb" data-rp="90">↻ 90°</button><button class="qb" data-rp="-45">↺ 45°</button><button class="qb" data-rp="45">↻ 45°</button><button class="qb" data-rp="-15">↺ 15°</button><button class="qb" data-rp="15">↻ 15°</button></div>
    <div class="row"><label class="qf"><span>${sel && sel.kind === 'wall' ? '더 돌릴 각도' : '각도 (0~359)'}</span><input type="number" id="rpV" value="${sel && sel.kind === 'wall' ? 30 : cur}"></label><button class="qb on" id="rpGo">직접 돌리기</button></div>`;
  p.hidden = false; const bb = btn.getBoundingClientRect(), st = $('#stage').getBoundingClientRect(); p.style.left = clamp(bb.left - st.left - 60, 8, st.width - 300) + 'px'; p.style.top = (bb.bottom - st.top + 8) + 'px';
  $$('[data-rp]', p).forEach((b) => (b.onclick = () => rotSel(+b.dataset.rp)));
  $('#rpGo').onclick = () => { const v = +$('#rpV').value || 0; if (sel.kind === 'wall') rotSel(v); else withEach(() => { const it = itemOf(sel.id); if (it) it.rot = ((v % 360) + 360) % 360; }); dirty3d = true; };
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-cx="rot"]'); if (b) { e.stopImmediatePropagation(); const p = $('#rotPop'); if (p && !p.hidden) p.hidden = true; else rotPop(b); return; } if (!e.target.closest('#rotPop') && $('#rotPop')) $('#rotPop').hidden = true; }, true);
{ const _rc = renderCtx; renderCtx = function () { _rc(); const b = $('#ctxbar'); if (!b || !sel) return; const r = $('[data-cx="rot"]', b); if (r) r.title = '돌리기 · 90° · 45° · 직접 (R)'; if (sel.kind === 'wall' && !r && multi.length < 2) { const look = $('[data-cx="look"]', b); if (look) look.insertAdjacentHTML('beforebegin', `<button data-cx="rot" title="벽 돌리기 · 45° · 직접" aria-label="돌리기">${ICO(IC.rot)}</button>`); } }; }
document.addEventListener('keydown', (e) => { if (e.code !== 'KeyR' || !e.altKey || !sel) return; const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; e.preventDefault(); e.stopImmediatePropagation(); rotSel(e.shiftKey ? -45 : 45); }, true);

/* ---------- 보기 옵션: 천장 보이기 · 투명도 ---------- */
{ const pi = $('#labels3d') && $('#labels3d').closest('label'); if (pi) pi.insertAdjacentHTML('afterend', '<label><input type="checkbox" id="ceilShow"> 천장 보이기</label><label class="rng">천장 투명도<input type="range" id="ceilOp" min="0.05" max="1" step="0.05"></label><button class="qb" id="ceilPick" type="button">천장 선택 · 색 바꾸기</button>'); }
function syncCeilOpt() { if (!P || !$('#ceilShow')) return; $('#ceilShow').checked = !!(P.ceiling && P.ceiling.on); $('#ceilOp').value = (P.ceiling && P.ceiling.opacity) ?? 0.45; }
if ($('#ceilShow')) { $('#ceilShow').onchange = (e) => { P.ceiling = { ...(P.ceiling || {}), on: e.target.checked }; if (e.target.checked) for (const r of rooms()) if (r.ceil) delete r.ceil.on; vis.ceiling = true; commit(); dirty3d = true; };
  $('#ceilOp').oninput = (e) => { P.ceiling = { ...(P.ceiling || {}), opacity: +e.target.value }; for (const r of rooms()) if (r.ceil) delete r.ceil.opacity; dirty3d = true; }; $('#ceilOp').onchange = () => commit();
  $('#ceilPick').onclick = () => { if (!P.ceiling || !P.ceiling.on) { P.ceiling = { ...(P.ceiling || {}), on: true }; commit(); dirty3d = true; } pickSel({ kind: 'ceil', id: 'all' }); if (isMobile()) openSheet('props'); else document.body.classList.remove('no-right'); };
  $('#ceilShow').closest('details').addEventListener('toggle', syncCeilOpt); }

/* ---------- 층 메뉴: 공간(하위) · 공간만 보기 ---------- */
{ const _rl = renderLevels; renderLevels = function () { _rl(); if (!P) return; const m = $('#lvlMenu'), L = rooms(), cur = ISO && roomOf(ISO);
    if (cur) $('#lvlBtn').innerHTML = $('#lvlBtn').innerHTML.replace(' <span class="tri">', ` · ${esc(cur.name)} <span class="tri">`);
    const on = $('.lvrow.on', m); if (!on) return;
    on.insertAdjacentHTML('afterend', `<div class="lvsub">${L.length ? `<button class="lvgo ${!ISO ? 'on' : ''}" data-iso="">ㄴ 전체</button>${L.map((r) => `<button class="lvgo ${ISO === r.id ? 'on' : ''}" data-iso="${r.id}">ㄴ ${esc(r.name)} <small>${esc(r.kind)}${r.lift ? ` · +${r.lift}` : ''}</small></button>`).join('')}` : '<p class="qk">공간이 없어요 · 바닥을 나누면 주방 · 홀 · 창고처럼 따로 볼 수 있어요</p>'}<button class="qb" data-iso-draw>+ 바닥 나누기 (공간 그리기)</button></div>`); }; }
$('#lvlMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-iso]'); if (b) { e.stopPropagation(); $('#lvlMenu').hidden = true; setIso(b.dataset.iso || null); return; } if (e.target.closest('[data-iso-draw]')) { e.stopPropagation(); $('#lvlMenu').hidden = true; if (ISO) setIso(null); startRoomDraw(); } });
{ const _sw = switchLevel; switchLevel = function (id) { ISO = null; _sw(id); }; const _op = openProject; openProject = function (p) { ISO = null; SLOPEPICK = null; _op(p); syncCeilOpt(); }; }

/* ---------- 석고벽 보강재 ---------- */
function backsOf(w) {
  if (!w.finish || w.finish.type !== 'gypsum') return []; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 1) return []; const c = (w.x2 - w.x1) / L, s = (w.y2 - w.y1) / L, t = wallT(w) / 2, H = wallH(w), out = [];
  for (const b of w.backs || []) out.push({ x0: clamp(b.t - b.w / 2, 0, L), x1: clamp(b.t + b.w / 2, 0, L), y0: b.y0, y1: Math.min(H, b.y1), side: b.side || 0, man: true });
  if (w.autoBack !== false) for (const it of P.items) { if (it.hidden) continue; const sp = spec(it); if (['ceil', 'ceiling', 'plumb', 'elec'].includes(sp.layer) || sp.L.shape === 'zone') continue; const z = zOf(it); if (z < 250 && sp.layer !== 'upper') continue;
    const loc = corners(it).map(([x, y]) => [(x - w.x1) * c + (y - w.y1) * s, -(x - w.x1) * s + (y - w.y1) * c]), xs = loc.map((p) => p[0]), zs = loc.map((p) => p[1]), mnx = Math.min(...xs), mxx = Math.max(...xs), mnz = Math.min(...zs), mxz = Math.max(...zs);
    if (mxx < 0 || mnx > L) continue; const side = (mnz + mxz) / 2 > 0 ? 1 : -1, gap = side > 0 ? mnz - t : -t - mxz; if (gap > 220 || gap < -t * 2) continue;
    out.push({ x0: Math.max(0, mnx - 100), x1: Math.min(L, mxx + 100), y0: Math.max(0, z - 100), y1: Math.min(H, z + sp.h + 100), side }); }
  return out;
}
{ const _bw = buildWalls; buildWalls = function () { _bw(); if (!window.ROOMS_ON) return; for (const w of P.walls) { const B = backsOf(w); if (!B.length) continue; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), T = xf(w.x1, w.y1, Math.atan2(w.y2 - w.y1, w.x2 - w.x1)), t = wallT(w) / 2, H = CUT ? Math.min(1200, wallH(w)) : wallH(w), col = shade(w.finish.color, .84); void L;
      for (const b of B) { const y1 = Math.min(b.y1, H); if (y1 - b.y0 < 10) continue; for (const sd of b.side ? [b.side] : [1, -1]) box(T, b.x0, b.x1, b.y0, y1, sd > 0 ? t : -t - 4, sd > 0 ? t + 4 : -t, col, 'plain'); } } }; }
function drawBacks2d() { cx.save(); cx.font = '600 9px system-ui'; for (const w of P.walls) { const B = backsOf(w); if (!B.length) continue; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), c = (w.x2 - w.x1) / L, s = (w.y2 - w.y1) / L, t = wallT(w) / 2 + 30;
    for (const b of B) for (const sd of b.side ? [b.side] : [1, -1]) { const nx = -s * sd * t, ny = c * sd * t, a = toS(w.x1 + c * b.x0 + nx, w.y1 + s * b.x0 + ny), e = toS(w.x1 + c * b.x1 + nx, w.y1 + s * b.x1 + ny); cx.strokeStyle = shade(w.finish.color, .6); cx.lineWidth = 4; cx.beginPath(); cx.moveTo(...a); cx.lineTo(...e); cx.stroke(); if (V.s > 0.03) { cx.fillStyle = shade(w.finish.color, .45); cx.fillText('보강재', a[0] + 2, a[1] - 4); } } } cx.restore(); }
{ const _r3 = render3d; render3d = function () { _r3(); if (!window.ROOMS_ON || !P || view === '2d' || !lastM || !$('#labels3d').checked) return; const ov = $('#ov3d'), r = gc.getBoundingClientRect(); let n = 0;
    for (const w of P.walls) { const B = backsOf(w); if (!B.length) continue; const T = xf(w.x1, w.y1, Math.atan2(w.y2 - w.y1, w.x2 - w.x1)), t = wallT(w) / 2, H = cam.cut ? Math.min(1200, wallH(w)) : wallH(w);
      for (const b of B) { if (n++ > 40) return; const y = Math.min(b.y1, H) - 60, sd = b.side || 1, p = T.P(b.x0 + 60, y, sd * (t + 6)), q = proj(lastM, [p[0], p[1] + curElev(), p[2]], r); if (!q) continue; const d = document.createElement('div'); d.className = 'pin backpin'; d.style.left = q[0] + 'px'; d.style.top = q[1] + 'px'; d.textContent = '보강재'; ov.appendChild(d); } } }; }
{ const _rp = renderProps0; renderProps0 = function () { _rp(); if (!P || !sel || sel.kind !== 'wall') return; const w = wallOf(sel.id); if (!w || w.finish.type !== 'gypsum') return; const el = $('#props'), L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
    el.insertAdjacentHTML('beforeend', `<div class="lbl">보강재 (석고벽)</div><label class="chk"><input type="checkbox" id="bkAuto" ${w.autoBack !== false ? 'checked' : ''}> 벽에 다는 기물 뒤에 자동으로 넣기</label>
      ${(w.backs || []).map((b, i) => `<div class="row" style="align-items:center"><span class="qk" style="flex:1">${b.t - b.w / 2}~${b.t + b.w / 2}mm · 높이 ${b.y0}~${b.y1}</span><button class="qb danger" data-bkdel="${i}">지우기</button></div>`).join('')}
      <div class="g3">${field('가운데 위치', 'bkT', Math.round(L / 2))}${field('폭', 'bkW', 1200)}${field('바닥에서', 'bkY0', 900)}</div><div class="g3">${field('위 끝', 'bkY1', 1800)}<button class="btn" id="bkAdd">보강재 넣기</button></div><p class="hint">진하게 보이는 부분이 보강재예요 · 위치는 벽 시작점 기준 mm</p>`);
    $('#bkAuto').onchange = (e) => { w.autoBack = e.target.checked; commit(); dirty3d = true; };
    $('#bkAdd').onclick = () => { const b = { t: +$('#bkT').value || L / 2, w: Math.max(100, +$('#bkW').value || 1200), y0: Math.max(0, +$('#bkY0').value || 0), y1: Math.max(100, +$('#bkY1').value || 1800), side: 0 }; w.backs = [...(w.backs || []), b]; commit(); dirty3d = true; renderProps(); };
    $$('[data-bkdel]').forEach((x) => (x.onclick = () => { w.backs.splice(+x.dataset.bkdel, 1); commit(); dirty3d = true; renderProps(); })); }; }

/* ---------- 배경 레벨 (주변 건물 수 · 높이 줄이기) ---------- */
const ENVLV = { 5: [1, 1], 4: [.8, .85], 3: [.6, .7], 2: [.42, .5], 1: [.25, .3] };
{ const _re = renderEnvPop; renderEnvPop = function () { _re(); const E = envOf(), hk = E.hk ?? 1, nk = E.nk ?? 1, lv = Object.entries(ENVLV).reduce((b, [k, v]) => (Math.abs(v[0] - hk) + Math.abs(v[1] - nk) < Math.abs(ENVLV[b][0] - hk) + Math.abs(ENVLV[b][1] - nk) ? k : b), '5');
    $('.envcols', $('#envPop')).insertAdjacentHTML('beforebegin', `<div class="envlv"><span>배경 레벨</span><button class="qb" data-elv="-1" aria-label="배경 줄이기">▼</button><b>${lv} / 5</b><button class="qb" data-elv="1" aria-label="배경 늘리기">▲</button><small class="muted">낮출수록 건물이 적고 낮아져 매장이 잘 보여요</small></div>
      <label class="envrow"><span>건물 높이 ${Math.round(hk * 100)}%</span><input type="range" id="envHk" min="0.2" max="1" step="0.05" value="${hk}"></label><label class="envrow"><span>건물 수 ${Math.round(nk * 100)}%</span><input type="range" id="envNk" min="0.2" max="1" step="0.05" value="${nk}"></label>`); }; }
$('#envPop').addEventListener('click', (e) => { const b = e.target.closest('[data-elv]'); if (!b) return; const E = envOf(), cur = Object.entries(ENVLV).reduce((x, [k, v]) => (Math.abs(v[0] - (E.hk ?? 1)) < Math.abs(ENVLV[x][0] - (E.hk ?? 1)) ? k : x), '5'), nx = clamp(+cur + +b.dataset.elv, 1, 5); [E.hk, E.nk] = ENVLV[nx]; dirty3d = true; commit(); renderEnvPop(); });
$('#envPop').addEventListener('input', (e) => { if (e.target.id === 'envHk' || e.target.id === 'envNk') { envOf()[e.target.id === 'envHk' ? 'hk' : 'nk'] = +e.target.value; dirty3d = true; e.target.previousElementSibling.textContent = `${e.target.id === 'envHk' ? '건물 높이' : '건물 수'} ${Math.round(e.target.value * 100)}%`; } });
$('#envPop').addEventListener('change', (e) => { if (e.target.id === 'envHk' || e.target.id === 'envNk') commit(); });

/* ---------- 명령 팔레트 ---------- */
{ const _C = CMDS; CMDS = function () { const l = _C(); l.push({ g: '그리기', n: '바닥 나누기 (공간 그리기)', run: startRoomDraw, k: '', kw: 'room floor split 공간 주방 홀 화장실' }, { g: '보기', n: '천장 보이기 · 숨기기', run: () => { P.ceiling = { ...(P.ceiling || {}), on: !(P.ceiling && P.ceiling.on) }; commit(); dirty3d = true; syncCeilOpt(); }, k: '', kw: 'ceiling 천장' }, { g: '보기', n: '높이 커서 켜기 · 끄기', run: () => setHgt(!HGT), k: '', kw: 'height elev 높이' }); return l; }; }
{ const hp = $('#helpDlg .dlg h3'); if (hp) hp.insertAdjacentHTML('afterend', '<p class="hint">Ctrl+끌기: 선택한 오브젝트 모서리 · 면을 잡고 크기 조절 (3D 윗면 = 높이) · Ctrl+Shift+끌기: 같은 높이에서 옮기기 · Alt+R: 45° 돌리기 · Esc: 그리기 끝 → 한 번 더 누르면 닫기</p>'); }
window.ROOMS_ON = true; dirty3d = true; syncCeilOpt();
