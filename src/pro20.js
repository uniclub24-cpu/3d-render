/* ================================================================
   v22 · 배수 기물(트렌치 · 그리스트랩 · 배수구)을 눌러 구배 자동 · 각도만 입력
         벽 디자인 수정 (꼭짓점 · 모서리 · 면 끌기, 시작/끝 높이 · 두께)
         공간 태그(종류) 이름 바꾸기 · 직접 입력
   ================================================================ */
var SLOPEPICK3 = null;

/* ---------- 1. 배수 기물로 구배 ---------- */
const isDrainItem = (it) => { const L = libGet(it.type); return !!L && (L.provides === 'drain' || L.shape === 'drainpt' || /trench|drain|trap/.test(it.type)) && !/sink|toilet|wash|basin|tub|shower|dish|ice|waste|urinal|vanity|appl/.test(L.shape + ' ' + it.type); };
function drainGeom(it) { // 길쭉하면 선(트렌치), 아니면 점
  const a = (it.rot || 0) * Math.PI / 180, long = Math.max(it.w, it.d), lw = it.w >= it.d;
  if (long / Math.max(1, Math.min(it.w, it.d)) >= 2.5) { const ux = lw ? Math.cos(a) : -Math.sin(a), uy = lw ? Math.sin(a) : Math.cos(a), h = long / 2; return { drain: [Math.round(it.x - ux * h), Math.round(it.y - uy * h)], drain2: [Math.round(it.x + ux * h), Math.round(it.y + uy * h)] }; }
  return { drain: [Math.round(it.x), Math.round(it.y)] };
}
function drainsIn(r) { return P.items.filter((it) => isDrainItem(it) && (pointInPoly(it.x, it.y, r.pts) || polyEdgeDist(r.pts, it.x, it.y) < 300)); }
function slopeToItem(r, it, keepMsg) {
  const g = drainGeom(it), deg = (r.slope && r.slope.deg) || pct2deg(1); r.slope = { deg, ...g, item: it.id };
  commit(); dirty3d = true; draw2d(); renderProps(); if (!keepMsg) toast(`"${it.tag || libGet(it.type).name}" 쪽으로 구배를 잡았어요 · 이제 각도(%)만 정하세요`);
}
// 기물이 움직이면 구배도 따라가기
{ const _sh = slopeH; slopeH = function (r, x, y) { const s = r && r.slope; if (s && s.item) { const it = P.items.find((q) => q.id === s.item); if (it) { const g = drainGeom(it); s.drain = g.drain; if (g.drain2) s.drain2 = g.drain2; else delete s.drain2; } } return _sh(r, x, y); }; }
function pickDrainAt(wx, wy) {
  const S = SLOPEPICK3, r = roomOf(S.id); SLOPEPICK3 = null; if (!r) return;
  let best = null; for (const it of P.items) { if (!isDrainItem(it)) continue; const a = (it.rot || 0) * Math.PI / 180, dx = wx - it.x, dy = wy - it.y, lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
    const d = Math.max(0, Math.abs(lx) - it.w / 2) + Math.max(0, Math.abs(ly) - it.d / 2); if (d < 350 && (!best || d < best.d)) best = { d, it }; }
  if (!best) { toast('배수 기물(트렌치 · 그리스트랩 · 배수구)을 눌러 주세요 · 없으면 기물 목록 "바닥·배관"에서 먼저 놓으세요'); renderProps(); draw2d(); return; }
  slopeToItem(r, best.it);
}
cv.addEventListener('pointerdown', (e) => { if (!SLOPEPICK3) return; e.stopImmediatePropagation(); const b = cv.getBoundingClientRect(); pickDrainAt(...toW(e.clientX - b.left, e.clientY - b.top)); }, true);
gc.addEventListener('pointerdown', (e) => { if (!SLOPEPICK3 || e.button !== 0) return; const h = rayHit(e), g = h && h.p ? [h.p[0], h.p[2]] : planeHit(e, 0); if (!g) return; e.stopImmediatePropagation(); if (h && h.sel && h.sel.kind === 'item') { const it = itemOf(h.sel.id); if (it && isDrainItem(it)) { SLOPEPICK3 = null; slopeToItem(roomOf(sel.id) || rooms()[0], it); return; } } pickDrainAt(g[0], g[1]); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && SLOPEPICK3) { e.stopImmediatePropagation(); SLOPEPICK3 = null; renderProps(); } }, true);
function startDrainPick(r) { SLOPEPICK = null; SLOPEPICK2 = null; SLOPEPICK3 = { id: r.id }; renderProps(); toast('트렌치 · 그리스트랩 · 배수구를 누르세요 (도면이나 3D) · Esc 취소'); }

/* 공간 상세: 배수 기물 목록 · 각도 입력 · 태그 이름 */
{ const _p = roomPanel; roomPanel = function () {
  let h = _p(); const r = roomOf(sel.id), M = selRooms().length > 1, sl = r.slope || {}, ds = drainsIn(r);
  const drainHtml = `<div class="drbox"><div class="row wrap" style="align-items:center"><button class="btn ${SLOPEPICK3 ? 'pri' : ''}" id="rmDrPick">${SLOPEPICK3 ? '배수 기물을 누르세요…' : '배수 기물 눌러서 구배'}</button>${ds.map((it) => `<button class="chipb ${sl.item === it.id ? 'on' : ''}" data-drit="${it.id}" aria-pressed="${sl.item === it.id}">${esc(it.tag || libGet(it.type).name)}</button>`).join('')}</div>
    ${sl.drain ? `<div class="g3"><label class="fld"><span>각도 °</span><input id="rmDegN" type="number" min="0.05" max="15" step="0.05" value="${sl.deg}"></label><label class="fld"><span>경사 %</span><input id="rmPctN" type="number" min="0.1" max="25" step="0.1" value="${deg2pct(sl.deg)}"></label><label class="fld"><span>가장 높은 곳</span><input disabled value="+${Math.round(Math.max(...r.pts.map((p) => slopeH(r, p[0], p[1]))))}mm"></label></div>` : `<p class="hint">${ds.length ? '위에서 배수 기물을 고르면 그쪽으로 바로 기울고, 각도만 넣으면 돼요' : '이 공간에 배수 기물이 없어요 · "바닥·배관"에서 트렌치 · 그리스트랩 · 배수구를 놓거나 아래에서 직접 찍으세요'}</p>`}</div>`;
  h = h.replace('<div class="lbl">구배 (물빠짐 경사)</div>', '<div class="lbl">구배 (물빠짐 경사)</div>' + drainHtml);
  if (!M) { const kinds = [...new Set([...ROOMKINDS, ...rooms().map((x) => x.kind)])];
    h = h.replace(/(<div class="g3">[^]*?id="rmKind"[^]*?<\/select><\/label><\/div>)/, `$1<div class="g3"><label class="fld" style="grid-column:span 2"><span>공간 태그 (직접 입력 · 이름 바꾸기)</span><input id="rmTag" list="rmTagL" value="${esc(r.kind)}"><datalist id="rmTagL">${kinds.map((k) => `<option value="${esc(k)}">`).join('')}</datalist></label><label class="chk" style="align-self:end"><input type="checkbox" id="rmTagAll"> 같은 태그 모두</label></div>`); }
  return h; }; }
{ const _b = bindRoomPanel; bindRoomPanel = function () { _b(); const r = roomOf(sel.id), L = selRooms(), all = (f) => { L.forEach(f); commit(); dirty3d = true; draw2d(); renderProps(); };
  const pk = $('#rmDrPick'); if (pk) pk.onclick = () => startDrainPick(r);
  $$('[data-drit]').forEach((b) => (b.onclick = () => { const it = itemOf(b.dataset.drit); if (it) { L.forEach((x) => { x.slope = { deg: (x.slope && x.slope.deg) || pct2deg(1), ...drainGeom(it), item: it.id }; }); slopeToItem(r, it); } }));
  const dn = $('#rmDegN'); if (dn) dn.onchange = () => all((x) => { if (x.slope) x.slope.deg = clamp(+dn.value || 0.5, 0.05, 15); });
  const pn = $('#rmPctN'); if (pn) pn.onchange = () => all((x) => { if (x.slope) x.slope.deg = pct2deg(clamp(+pn.value || 1, 0.1, 25)); });
  const tg = $('#rmTag'); if (tg) tg.onchange = () => { const v = tg.value.trim().slice(0, 20); if (!v) { tg.value = r.kind; return; } const old = r.kind, targets = $('#rmTagAll').checked ? rooms().filter((x) => x.kind === old) : L;
    for (const x of targets) { if (x.name === x.kind || /^공간 \d+$/.test(x.name)) x.name = v; else if (x.name.startsWith(old + ' ')) x.name = v + x.name.slice(old.length); x.kind = v; }
    if (!ROOMKINDS.includes(v)) ROOMKINDS.splice(ROOMKINDS.length - 1, 0, v); P.roomKinds = [...new Set([...(P.roomKinds || []), v])]; commit(); renderLevels(); draw2d(); renderProps(); toast(`태그를 "${v}"(으)로 바꿨어요${targets.length > 1 ? ` · ${targets.length}곳` : ''}`); };
}; }
// 저장된 직접 입력 태그 되살리기
{ const _op = openProject; openProject = function (p) { const r = _op.apply(this, arguments); try { for (const k of (P && P.roomKinds) || []) if (!ROOMKINDS.includes(k)) ROOMKINDS.splice(ROOMKINDS.length - 1, 0, k); } catch (e) {} return r; }; }
// 바닥 상세에도 바로가기
{ const _rp = renderProps0; renderProps0 = function () { _rp(); try { if (!sel || sel.kind !== 'floor' || $('#flDrain')) return; const a = $('#flDetail'); if (!a) return; a.insertAdjacentHTML('afterend', '<button class="btn" id="flDrain">배수 기물 눌러서 구배</button>'); $('#flDrain').onclick = () => { const r = floorToRoom(); if (r) { const ds = drainsIn(r); if (ds.length === 1) slopeToItem(r, ds[0]); else startDrainPick(r); } }; } catch (e) {} }; }
// 2D: 고를 때 배수 기물 강조
{ const _d = draw2d; draw2d = function () { _d(); if (!SLOPEPICK3 || !P || view === '3d') return; try { cx.save(); cx.strokeStyle = '#ff9f0a'; cx.lineWidth = 3; for (const it of P.items) { if (!isDrainItem(it)) continue; const c = toS(it.x, it.y), r = Math.max(10, Math.max(it.w, it.d) / 2 * V.s + 6); cx.beginPath(); cx.arc(c[0], c[1], r, 0, 7); cx.stroke(); } cx.restore(); } catch (e) {} }; }

/* ---------- 2. 벽 디자인 수정 ---------- */
// w.form = { o: [8 × [du, dv, dy]] } · 번호 = 끝(0 시작 · 1 끝) × 4 + 면(0 −쪽 · 1 +쪽) × 2 + 위아래(0 바닥 · 1 위)
var WBUILD = false, WDE = null;
const WFI = (s, sd, lv) => s * 4 + sd * 2 + lv;
const wformOn = (w) => w && w.form && w.form.o && w.form.o.some((q) => q[0] || q[1] || q[2]);
{ const _bw = buildWalls; buildWalls = function () { WBUILD = true; try { return _bw(); } finally { WBUILD = false; } }; }
{ const _xf = xf; xf = function (cx_, cz_, ang) { const T = _xf(cx_, cz_, ang); if (!WBUILD || !P) return T;
  const w = P.walls.find((q) => wformOn(q) && Math.abs(q.x1 - cx_) < .5 && Math.abs(q.y1 - cz_) < .5 && Math.abs(Math.atan2(q.y2 - q.y1, q.x2 - q.x1) - ang) < 1e-6); if (!w) return T;
  T.form = { o: w.form.o, L: Math.hypot(w.x2 - w.x1, w.y2 - w.y1), H: wallH(w), t: wallT(w) / 2 }; return T; }; }
function wDeform(F, x, y, z) { const u = clamp(x / F.L, 0, 1), s = clamp((z + F.t) / (2 * F.t), 0, 1), v = clamp(y / F.H, 0, 1); let d = [0, 0, 0];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) { const wgt = (a ? u : 1 - u) * (b ? s : 1 - s) * (c ? v : 1 - v); if (!wgt) continue; const o = F.o[WFI(a, b, c)]; d = [d[0] + o[0] * wgt, d[1] + o[1] * wgt, d[2] + o[2] * wgt]; }
  return [x + d[0], y + d[2], z + d[1]]; }
{ const _box = box; box = function (T, x0, x1, y0, y1, z0, z1, col, key, alpha) { if (!T || !T.form || PCAP) return _box.apply(this, arguments);
  const g = grp(key || 'plain', alpha), c = tintC(hexRGB(col)), F = T.form, v = (x, y, z) => wDeform(F, x, y, z);
  const C = [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1), v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)];
  for (const [ix, sh] of [[[4, 5, 6, 7], 1], [[3, 2, 1, 0], .9], [[3, 2, 6, 7], 1], [[1, 0, 4, 5], 1], [[0, 3, 7, 4], 1], [[2, 1, 5, 6], 1]]) { const q = ix.map((i) => C[i]);
    const n = vnorm(vcross(vsub(q[2], q[0]), vsub(q[1], q[0]))); quad(g, q.map((p) => T.P(...p)), T.N(...n), sh === 1 ? c : c.map((k) => k * sh)); } }; }
// 2D: 바뀐 벽 바닥 · 윗면 윤곽
{ const _d = draw2d; draw2d = function () { _d(); if (!P || view === '3d') return; try { for (const w of P.walls) { if (!wformOn(w) && !(WDE && WDE.id === w.id)) continue; const ring = (lv) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([s, sd]) => toS(...wPt(w, s, sd, lv).slice(0, 2)));
  cx.save(); for (const [lv, dash, a] of [[0, [], .9], [1, [5, 4], .7]]) { const R = ring(lv); cx.globalAlpha = a; cx.setLineDash(dash); cx.strokeStyle = getCss('--accent') || '#0a84ff'; cx.lineWidth = 2; cx.beginPath(); R.forEach((p, i) => (i ? cx.lineTo(...p) : cx.moveTo(...p))); cx.closePath(); cx.stroke(); } cx.restore(); } } catch (e) {} }; }
function wPt(w, s, sd, lv) { // 평면 x, y + 높이 (기준점 + 끌기 값)
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, t = wallT(w) / 2, o = (w.form && w.form.o && w.form.o[WFI(s, sd, lv)]) || [0, 0, 0];
  const u = s * L + o[0], vv = (sd ? t : -t) + o[1], y = lv * wallH(w) + o[2]; return [w.x1 + ux * u - uy * vv, w.y1 + uy * u + ux * vv, y];
}
function wW(w, s, sd, lv) { const p = wPt(w, s, sd, lv); return [p[0], p[2] + curElev(), p[1]]; }
function wS(w, s, sd, lv) { const r = gc.getBoundingClientRect(); return lastM ? proj(lastM, wW(w, s, sd, lv), r) : null; }
const WCOR = []; for (let s = 0; s < 2; s++) for (let sd = 0; sd < 2; sd++) for (let lv = 0; lv < 2; lv++) WCOR.push([s, sd, lv]);
const WEDGE = [[0, 4], [2, 6], [1, 5], [3, 7], [0, 2], [4, 6], [1, 3], [5, 7], [0, 1], [2, 3], [4, 5], [6, 7]].map(([a, b]) => [WFI(...WCOR[a]), WFI(...WCOR[b])]);
const WFACE = { 윗면: [1, 3, 7, 5], '앞면 (−)': [0, 4, 5, 1], '뒷면 (+)': [2, 3, 7, 6], 시작면: [0, 1, 3, 2], 끝면: [4, 6, 7, 5] };
function wdeEnter(w) {
  if (!w) return; if (DE) deExit(); w.form = w.form && w.form.o ? w.form : { o: Array.from({ length: 8 }, () => [0, 0, 0]) };
  WDE = { id: w.id, axis: 'y', hover: null, drag: null, view0: view }; if (view !== '3d') setView('3d'); sel = { kind: 'wall', id: w.id }; multi = [];
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), a = Math.atan2(w.y2 - w.y1, w.x2 - w.x1); cam.tx = (w.x1 + w.x2) / 2; cam.tz = (w.y1 + w.y2) / 2; cam.ty = curElev() + wallH(w) * .45; cam.dist = clamp(L * 1.7, 3500, 20000); cam.ty = curElev() + wallH(w) * .2; { const b = bounds(), mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, nx = -Math.sin(a), ny = Math.cos(a), sd = ((b[0] + b[2]) / 2 - mx) * nx + ((b[1] + b[3]) / 2 - my) * ny >= 0 ? 1 : -1; cam.yaw = Math.atan2(ny * sd, nx * sd) + .2; } cam.pitch = .5; cam.cut = false;
  syncGoal();
  document.body.classList.add('de-on'); commit(); dirty3d = true; wdeUI(); wdeLoop();
}
function wdeExit() { if (!WDE) return; const w = wallOf(WDE.id), v0 = WDE.view0; WDE = null; if (v0 && v0 !== view) setView(v0); document.body.classList.remove('de-on'); if (w && !wformOn(w)) delete w.form; commit(); dirty3d = true; draw2d(); const p = $('#wdePanel'); if (p) p.hidden = true; const c = $('#deOv'); if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); renderProps(); }
function wdeLoop() { if (!WDE) return; try { wdeDraw(); } catch (e) { console.warn(e); } requestAnimationFrame(wdeLoop); }
function wdeDraw() { const w = wallOf(WDE.id); if (!w) { wdeExit(); return; } const { c, g, dpr } = deOverlay(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, c.width, c.height); if (view === '2d') return;
  const acc = getCss('--accent') || '#0a84ff', S = (i) => wS(w, ...WCOR.find((q) => WFI(...q) === i)), h = WDE.hover;
  g.strokeStyle = acc; g.lineWidth = 1.5; for (const [a, b] of WEDGE) { const A = S(a), B = S(b); if (!A || !B) continue; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
  if (h && h.t === 'f') { const s = h.ix.map(S); if (!s.some((x) => !x)) { g.fillStyle = 'rgba(255,159,10,.22)'; g.strokeStyle = '#ff9f0a'; g.lineWidth = 2; g.beginPath(); s.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.stroke(); } }
  if (h && h.t === 'e') { const A = S(h.ix[0]), B = S(h.ix[1]); if (A && B) { g.strokeStyle = '#ff9f0a'; g.lineWidth = 4; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); } }
  for (let i = 0; i < 8; i++) { const s = S(i); if (!s) continue; const hv = h && h.t === 'v' && h.ix[0] === i; g.fillStyle = hv ? '#ff9f0a' : '#fff'; g.strokeStyle = acc; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], hv ? 7 : 5.5, 0, 7); g.fill(); g.stroke(); }
  if (WDE.drag && WDE.drag.label) { const r = gc.getBoundingClientRect(); g.font = '600 13px system-ui'; const t = WDE.drag.label, tw = g.measureText(t).width + 16; g.fillStyle = 'rgba(20,20,24,.85)'; g.fillRect(WDE.drag.mx - r.left + 14, WDE.drag.my - r.top + 10, tw, 24); g.fillStyle = '#fff'; g.fillText(t, WDE.drag.mx - r.left + 22, WDE.drag.my - r.top + 27); }
}
function wdeHit(e) { const w = wallOf(WDE.id); if (!w) return null; const r = gc.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, S = (i) => wS(w, ...WCOR.find((q) => WFI(...q) === i));
  let best = null; for (let i = 0; i < 8; i++) { const s = S(i); if (!s) continue; const d = Math.hypot(s[0] - mx, s[1] - my); if (d < 12 && (!best || d < best.d)) best = { t: 'v', ix: [i], d }; } if (best) return best;
  for (const [a, b] of WEDGE) { const A = S(a), B = S(b); if (!A || !B) continue; const L2 = (B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2; if (L2 < 4) continue; const t = ((mx - A[0]) * (B[0] - A[0]) + (my - A[1]) * (B[1] - A[1])) / L2; if (t < .1 || t > .9) continue; const d = Math.hypot(A[0] + (B[0] - A[0]) * t - mx, A[1] + (B[1] - A[1]) * t - my); if (d < 8 && (!best || d < best.d)) best = { t: 'e', ix: [a, b], d }; } if (best) return best;
  const E0 = rayOf(e).E; for (const ix of Object.values(WFACE)) { const s = ix.map(S); if (s.some((x) => !x)) continue; let ins = false; for (let i = 0, j = 3; i < 4; j = i++) if ((s[i][1] > my) !== (s[j][1] > my) && mx < (s[j][0] - s[i][0]) * (my - s[i][1]) / (s[j][1] - s[i][1] + 1e-9) + s[i][0]) ins = !ins; if (!ins) continue;
    const wc = ix.map((i) => wW(w, ...WCOR.find((q) => WFI(...q) === i))), cc = [0, 1, 2].map((k) => wc.reduce((a, q) => a + q[k], 0) / 4), d = Math.hypot(cc[0] - E0[0], cc[1] - E0[1], cc[2] - E0[2]); if (!best || d < best.d) best = { t: 'f', ix, d }; }
  return best; }
gc.addEventListener('pointerdown', (e) => { if (!WDE || e.button > 0 || view === '2d') return; const w = wallOf(WDE.id), h = wdeHit(e); if (!w || !h) return; e.stopImmediatePropagation(); e.preventDefault(); gc.setPointerCapture(e.pointerId);
  const i0 = h.ix[0], c0 = WCOR.find((q) => WFI(...q) === i0), P0 = wW(w, ...c0), E = rayOf(e).E, hn = vnorm([P0[0] - E[0], 0, P0[2] - E[2]]), vert = e.shiftKey || WDE.axis === 'y';
  WDE.drag = { ix: h.ix, orig: JSON.parse(JSON.stringify(w.form.o)), P0, nrm: vert ? hn : [0, 1, 0], mx: e.clientX, my: e.clientY }; }, true);
gc.addEventListener('pointermove', (e) => { if (!WDE || view === '2d') return; const w = wallOf(WDE.id); if (!w) return;
  if (!WDE.drag) { WDE.hover = wdeHit(e); gc.style.cursor = WDE.hover ? 'grab' : ''; return; } e.stopImmediatePropagation(); const d = WDE.drag; d.mx = e.clientX; d.my = e.clientY;
  const hit = dePlane(e, d.P0, d.nrm); if (!hit) return; const wd = vsub(hit, d.P0), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
  let du = wd[0] * ux + wd[2] * uy, dv = -wd[0] * uy + wd[2] * ux, dy = wd[1]; const ax = WDE.axis;
  if (d.nrm[1] === 1) dy = 0; else if (ax === 'free') { const hz = Math.hypot(du, dv); if (Math.abs(dy) > hz) { du = 0; dv = 0; } }
  if (ax === 'u') { dv = 0; dy = 0; } if (ax === 'v') { du = 0; dy = 0; } if (ax === 'y') { du = 0; dv = 0; }
  [du, dv, dy] = [du, dv, dy].map((v) => (e.altKey ? Math.round(v) : Math.round(v / 10) * 10));
  w.form.o = d.orig.map((q, i) => (d.ix.includes(i) ? [q[0] + du, q[1] + dv, q[2] + dy] : q.slice()));
  if (ax !== 'free' && ax !== 'y' && d.nrm[1] !== 1) {} d.label = `길이 ${du} · 두께 ${dv} · 높이 ${dy} mm`; dirty3d = true; draw2d(); }, true);
window.addEventListener('pointerup', () => { if (!WDE || !WDE.drag) return; WDE.drag = null; commit(); dirty3d = true; wdeUI(); }, true);
window.addEventListener('keydown', (e) => { if (WDE && e.key === 'Escape') { e.stopImmediatePropagation(); wdeExit(); } }, true);
function wdeUI() {
  const w = wallOf(WDE.id); if (!w) return; let el = $('#wdePanel'); if (!el) { el = document.createElement('div'); el.id = 'wdePanel'; el.className = 'depanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '벽 디자인 수정'); $('#stage').appendChild(el); }
  el.hidden = false; const o = w.form.o, H = wallH(w), T = wallT(w), L = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)), top = (s) => Math.round(H + (o[WFI(s, 0, 1)][2] + o[WFI(s, 1, 1)][2]) / 2), thk = (s, lv) => Math.round(T + o[WFI(s, 1, lv)][1] - o[WFI(s, 0, lv)][1]);
  el.innerHTML = `<div class="dehd"><b>벽 디자인 수정 · ${L}mm</b><button class="btn" id="wdeDone">완료</button></div>
  <p class="hint">꼭짓점 · 모서리 · 면을 끌어 모양을 바꿔요 · 방향을 고르고 끌기 (Shift = 위아래) · Alt = 10mm 맞춤 끄기 · Esc 끝</p>
  <div class="seg" role="group" aria-label="움직일 방향">${[['free', '자유'], ['u', '길이'], ['v', '두께'], ['y', '높이']].map(([k, n]) => `<button data-wax="${k}" aria-pressed="${WDE.axis === k}">${n}</button>`).join('')}</div>
  <div class="lbl">숫자로</div>
  <div class="g3"><label class="fld"><span>시작 쪽 높이</span><input type="number" id="wdH0" step="10" value="${top(0)}"></label><label class="fld"><span>끝 쪽 높이</span><input type="number" id="wdH1" step="10" value="${top(1)}"></label><label class="fld"><span>기본 높이</span><input disabled value="${H}"></label></div>
  <div class="g3"><label class="fld"><span>시작 쪽 두께 (위)</span><input type="number" id="wdT0" step="10" min="20" value="${thk(0, 1)}"></label><label class="fld"><span>끝 쪽 두께 (위)</span><input type="number" id="wdT1" step="10" min="20" value="${thk(1, 1)}"></label><label class="fld"><span>아래 두께</span><input disabled value="${thk(0, 0)} · ${thk(1, 0)}"></label></div>
  <div class="row wrap"><button class="btn" id="wdSlopeTop">윗면 경사 (시작 → 끝)</button><button class="btn" id="wdTaper">위로 갈수록 얇게</button><button class="btn" id="wdReset">처음 모양으로</button></div>`;
  const upd = (f) => { f(); commit(); dirty3d = true; draw2d(); wdeUI(); };
  $('#wdeDone').onclick = wdeExit; el.querySelectorAll('[data-wax]').forEach((b) => (b.onclick = () => { WDE.axis = b.dataset.wax; wdeUI(); }));
  const setTop = (s, v) => { const dy = (+v || H) - H; o[WFI(s, 0, 1)][2] = dy; o[WFI(s, 1, 1)][2] = dy; };
  $('#wdH0').onchange = (e) => upd(() => setTop(0, e.target.value)); $('#wdH1').onchange = (e) => upd(() => setTop(1, e.target.value));
  const setThk = (s, v) => { const half = (Math.max(20, +v || T) - T) / 2; o[WFI(s, 1, 1)][1] = half; o[WFI(s, 0, 1)][1] = -half; };
  $('#wdT0').onchange = (e) => upd(() => setThk(0, e.target.value)); $('#wdT1').onchange = (e) => upd(() => setThk(1, e.target.value));
  $('#wdSlopeTop').onclick = () => upd(() => { setTop(0, H); setTop(1, Math.round(H * .6)); });
  $('#wdTaper').onclick = () => upd(() => { setThk(0, Math.round(T * .5)); setThk(1, Math.round(T * .5)); });
  $('#wdReset').onclick = () => upd(() => { w.form.o = Array.from({ length: 8 }, () => [0, 0, 0]); });
}
// 속성 창 · 선택 막대
{ const _rp = renderProps0; renderProps0 = function () { _rp(); try { if (!sel || sel.kind !== 'wall' || multi.length > 1 || $('#wdeGo')) return; const w = wallOf(sel.id); if (!w) return; const el = $('#props'); const b = document.createElement('div'); b.className = 'debox';
  b.innerHTML = `<div class="lbl">디자인</div><div class="row wrap"><button class="btn pri" id="wdeGo">벽 디자인 수정 (점 끌기)</button>${wformOn(w) ? '<button class="btn" id="wdeClr">모양 되돌리기</button><span class="hint">모양을 바꾼 벽이에요</span>' : ''}</div>`; el.appendChild(b);
  $('#wdeGo').onclick = () => wdeEnter(w); const c = $('#wdeClr'); if (c) c.onclick = () => { delete w.form; commit(); dirty3d = true; draw2d(); renderProps(); }; } catch (e) { console.warn(e); } }; }
{ const _rc = renderCtx; renderCtx = function () { _rc(); if (WDE || DE) return; const b = $('#ctxbar'); if (!b || !sel || sel.kind !== 'wall' || multi.length > 1 || b.querySelector('[data-cx="wdesign"]')) return; b.insertAdjacentHTML('beforeend', '<button data-cx="wdesign" title="벽 디자인 수정" aria-label="벽 디자인 수정" class="cxtxt">디자인</button>'); }; }
$('#stage').addEventListener('click', (e) => { const bt = e.target.closest('[data-cx="wdesign"]'); if (bt && sel) wdeEnter(wallOf(sel.id)); }, true);
// 다른 디자인 수정과 겹치지 않게
{ const _de = deEnter; deEnter = function (it) { if (WDE) wdeExit(); const v0 = view; if (view === 'split') setView('3d'); const r = _de(it); if (DE) DE.view0 = v0; return r; }; }
{ const _dx = deExit; deExit = function () { const v0 = DE && DE.view0; _dx(); if (v0 && v0 !== view) setView(v0); }; }

{ const st = document.createElement('style'); st.textContent = `.drbox{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}.chipb{border:0;border-radius:999px;padding:6px 10px;background:var(--fill);color:var(--fg);font-size:12px}.chipb.on{background:var(--accent);color:var(--on-accent,#fff)}`; document.head.appendChild(st); }
function getCss(n) { try { return getComputedStyle(document.body).getPropertyValue(n).trim(); } catch (e) { return ''; } }
