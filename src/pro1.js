/* ================================================================
   v7 · 편집 보조 — 정렬선·거리, 떠 있는 도구 막대, 미니맵, 명령 검색, 작업 기록
   (기존 기능은 그대로 두고 함수를 감싸서 덧붙임)
   ================================================================ */
const PINK = '#ff2d75';
let GUIDES = null, ALTK = false, NUDGING = false, ctxPane = '2d';
const WALK = { on: false };
addEventListener('keydown', (e) => { if (e.key === 'Alt') ALTK = true; }, true);
addEventListener('keyup', (e) => { if (e.key === 'Alt') ALTK = false; }, true);
addEventListener('blur', () => (ALTK = false));
cv.addEventListener('pointerdown', () => (ctxPane = '2d'), true);
gc.addEventListener('pointerdown', () => (ctxPane = '3d'), true);

/* ---------- 1. 정렬선 · 거리 표시 ---------- */
function obstacleBoxes(skip, layer) {
  const out = [];
  for (const it of P.items) {
    if (skip.has(it.id) || it.hidden) continue; const s = spec(it);
    if (!vis[s.layer] || !physical(it) || s.layer !== layer) continue;
    out.push({ b: aabb(corners(it)), k: 'item', n: s.name });
  }
  for (const w of P.walls) {
    if (w.x1 !== w.x2 && w.y1 !== w.y2) continue; const T = wallT(w) / 2;
    out.push({ b: [Math.min(w.x1, w.x2) - T, Math.min(w.y1, w.y2) - T, Math.max(w.x1, w.x2) + T, Math.max(w.y1, w.y2) + T], k: 'wall', n: '벽' });
  }
  return out;
}
function guideSnap(it) {
  const tol = 8 / V.s, skip = new Set(selList().map((s) => s.id)), layer = spec(it).layer, obs = obstacleBoxes(skip, layer);
  let me = aabb(corners(it)); const g = { lines: [], dims: [] };
  const ax = (m) => [m[0], (m[0] + m[2]) / 2, m[2]], ay = (m) => [m[1], (m[1] + m[3]) / 2, m[3]];
  let bx = null, by = null;
  for (const o of obs) {
    if (o.k !== 'item') continue;
    for (const a of ax(me)) for (const c of ax(o.b)) { const d = c - a; if (Math.abs(d) < tol && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: c, o }; }
    for (const a of ay(me)) for (const c of ay(o.b)) { const d = c - a; if (Math.abs(d) < tol && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, y: c, o }; }
  }
  if (bx) it.x += bx.d; if (by) it.y += by.d;
  me = aabb(corners(it));
  if (bx) g.lines.push([bx.x, Math.min(me[1], bx.o.b[1]) - 200, bx.x, Math.max(me[3], bx.o.b[3]) + 200]);
  if (by) g.lines.push([Math.min(me[0], by.o.b[0]) - 200, by.y, Math.max(me[2], by.o.b[2]) + 200, by.y]);
  // 네 방향 가장 가까운 기물 · 벽까지 거리
  const aisle = (std().aisle || P.aisle || 900);
  const best = { l: null, r: null, t: null, b: null };
  for (const o of obs) {
    const b = o.b, oy = b[1] < me[3] && b[3] > me[1], ox = b[0] < me[2] && b[2] > me[0];
    if (oy && b[2] <= me[0] + 1) { const d = me[0] - b[2]; if (!best.l || d < best.l.d) best.l = { d, o }; }
    if (oy && b[0] >= me[2] - 1) { const d = b[0] - me[2]; if (!best.r || d < best.r.d) best.r = { d, o }; }
    if (ox && b[3] <= me[1] + 1) { const d = me[1] - b[3]; if (!best.t || d < best.t.d) best.t = { d, o }; }
    if (ox && b[1] >= me[3] - 1) { const d = b[1] - me[3]; if (!best.b || d < best.b.d) best.b = { d, o }; }
  }
  for (const [k, v] of Object.entries(best)) {
    if (!v || v.d > 6000 || v.d < 1) continue; const b = v.o.b;
    const my = (Math.max(me[1], b[1]) + Math.min(me[3], b[3])) / 2, mx = (Math.max(me[0], b[0]) + Math.min(me[2], b[2])) / 2;
    const seg = k === 'l' ? [b[2], my, me[0], my] : k === 'r' ? [me[2], my, b[0], my] : k === 't' ? [mx, b[3], mx, me[1]] : [mx, me[3], mx, b[1]];
    g.dims.push({ seg, d: Math.round(v.d), low: v.d > 50 && v.d < aisle && v.o.k === 'item' });
  }
  return g;
}
const _ama = applyMoveAll;
applyMoveAll = function (ms, wx, wy) {
  const r = _ama(ms, wx, wy); GUIDES = null;
  if (!NUDGING && ms.length === 1 && ms[0].kind === 'item' && !ALTK && P) { GUIDES = guideSnap(ms[0].it); return true; }
  return r;
};
const _nudge = nudge; nudge = function (dx, dy) { NUDGING = true; try { _nudge(dx, dy); } finally { NUDGING = false; } };
function drawGuides() {
  if (!GUIDES || OFF) return; cx.save(); cx.strokeStyle = PINK; cx.lineWidth = 1; cx.setLineDash([]);
  for (const l of GUIDES.lines) { const a = toS(l[0], l[1]), b = toS(l[2], l[3]); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke(); }
  cx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
  for (const d of GUIDES.dims) {
    const a = toS(d.seg[0], d.seg[1]), b = toS(d.seg[2], d.seg[3]); const c = d.low ? getCss('--bad') : PINK;
    cx.strokeStyle = c; cx.setLineDash([4, 3]); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke(); cx.setLineDash([]);
    for (const p of [a, b]) { cx.beginPath(); cx.arc(p[0], p[1], 2.5, 0, 7); cx.fillStyle = c; cx.fill(); }
    const t = d.d.toLocaleString() + (d.low ? ' · 통로 부족' : ''), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], w = cx.measureText(t).width + 10;
    cx.fillStyle = c; cx.beginPath(); cx.roundRect ? cx.roundRect(m[0] - w / 2, m[1] - 9, w, 18, 5) : cx.rect(m[0] - w / 2, m[1] - 9, w, 18); cx.fill();
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, m[0], m[1] + .5);
  }
  cx.restore();
}

/* ---------- 2. 선택 시 개체 옆 도구 막대 ---------- */
let DETAIL = store.get('drs_detail', false);
const ICO = (d, w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rot: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  look: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor"/><path d="M12 21a3 3 0 0 1 0-6h2"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  more: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  split: '<path d="M4 12h16M12 4v16"/>',
};
function selBox2d() {
  const pts = [];
  for (const s of selList()) {
    if (s.kind === 'item') { const it = itemOf(s.id); if (it) pts.push(...corners(it)); }
    if (s.kind === 'wall') { const w = wallOf(s.id); if (w) pts.push([w.x1, w.y1], [w.x2, w.y2]); }
    if (s.kind === 'open') { const g = openingGeom(P.openings.find((o) => o.id === s.id) || {}); if (g) pts.push(g.a, g.b); }
    if (s.kind === 'line') { const l = P.lines.find((x) => x.id === s.id); if (l) pts.push(...l.pts); }
    if (s.kind === 'sketch') { const k = P.sketches.find((x) => x.id === s.id); if (k) pts.push(...k.pts.map((p) => [p[0], p[2]])); }
  }
  return pts.length ? aabb(pts) : null;
}
function selTop3d() {
  let t = 0; for (const s of selList()) {
    if (s.kind === 'item') { const it = itemOf(s.id); if (it) t = Math.max(t, zOf(it) + spec(it).h); }
    if (s.kind === 'wall') { const w = wallOf(s.id); if (w) t = Math.max(t, cam.cut ? Math.min(1200, wallH(w)) : wallH(w)); }
    if (s.kind === 'open') { const o = P.openings.find((x) => x.id === s.id); if (o) t = Math.max(t, o.sill + o.h); }
  }
  return t;
}
function renderCtx() {
  const b = $('#ctxbar'); if (!b || !sel) return;
  const M = multi.length > 1, it = sel.kind === 'item';
  b.innerHTML = `<b class="cxn">${esc(M ? multi.length + '개 선택' : selName() || '')}</b><span class="cxsep"></span>
    <button data-cx="move" aria-pressed="${moveOn}" title="끌어서 옮기기 (M)" aria-label="이동">${ICO(IC.move)}</button>
    ${it ? `<button data-cx="rot" title="90° 돌리기 (R)" aria-label="돌리기">${ICO(IC.rot)}</button>` : ''}
    ${!M && sel.kind === 'wall' ? `<button data-cx="split" title="벽 나누기" aria-label="벽 나누기">${ICO(IC.split)}</button>` : ''}
    <button data-cx="look" title="색 · 재질" aria-label="색과 재질">${ICO(IC.look)}</button>
    <button data-cx="dup" title="복제 (Ctrl+D)" aria-label="복제">${ICO(IC.dup)}</button>
    <button data-cx="del" class="cxdel" title="삭제 (Delete)" aria-label="삭제">${ICO(IC.del)}</button>
    <span class="cxsep"></span><button data-cx="more" class="cxmore" aria-pressed="${DETAIL}" title="치수 · 상세 수정">${ICO(IC.more, 16)}<span>상세</span></button>`;
}
$('#stage').addEventListener('click', (e) => {
  const bt = e.target.closest('[data-cx]'); if (!bt) return; const k = bt.dataset.cx;
  if (k === 'move') setMove(!moveOn);
  if (k === 'rot') rotSel(90);
  if (k === 'dup') dupSel();
  if (k === 'del') delSel();
  if (k === 'split') { const r = bt.getBoundingClientRect(); lastPtr = { x: r.left, y: r.bottom + 6 }; updFab(); openSplit(); }
  if (k === 'look') { qTab = 'look'; DETAIL = true; store.set('drs_detail', true); renderQuick(); }
  if (k === 'more') { DETAIL = !DETAIL; store.set('drs_detail', DETAIL); renderQuick(); }
  renderCtx(); placeCtx();
});
function placeCtx() {
  const b = $('#ctxbar'); if (!b) return; const bd = document.body.classList;
  const show = P && sel && sel.kind !== 'floor' && !bd.contains('clean') && !bd.contains('show') && !WALK.on && !draft && !draft3 && tool === 'select' && !(isMobile() && document.body.dataset.sheet);
  if (!show) { b.hidden = true; return; }
  const box2 = selBox2d(), st = $('#stage').getBoundingClientRect(); if (!box2) { b.hidden = true; return; }
  const can2 = view === '2d' || (view === 'split' && !isMobile()), can3 = view !== '2d';
  const use2 = can2 && (!can3 || ctxPane === '2d');
  let pt = null, low = null;
  if (use2) { const r = cv.getBoundingClientRect(), mx = (box2[0] + box2[2]) / 2; const [sx, sy] = toS(mx, box2[1]); pt = [r.left - st.left + sx, r.top - st.top + sy]; low = r.top - st.top + toS(mx, box2[3])[1]; }
  else if (lastM) { const r = gc.getBoundingClientRect(), c = [(box2[0] + box2[2]) / 2, (box2[1] + box2[3]) / 2]; const p = proj(lastM, [c[0], selTop3d() + curElev(), c[1]], r), q = proj(lastM, [c[0], curElev(), c[1]], r); if (p) pt = [r.left - st.left + p[0], r.top - st.top + p[1]]; if (q) low = r.top - st.top + Math.max(q[1], p ? p[1] : 0); }
  if (b.hidden) { b.hidden = false; renderCtx(); }
  const bw = b.offsetWidth, bh = b.offsetHeight;
  if (!pt || pt[0] < 0 || pt[0] > st.width || pt[1] < -40 || pt[1] > st.height) { pt = [st.width / 2, 70 + bh]; low = null; }
  let y = pt[1] - bh - 16; if (y < 52) y = Math.min(st.height - bh - 8, (low != null ? low : pt[1]) + 16);
  b.style.left = clamp(pt[0] - bw / 2, 8, Math.max(8, st.width - bw - 8)) + 'px'; b.style.top = Math.max(8, y) + 'px';
}
const _rq0 = renderQuick0;
renderQuick0 = function () {
  _rq0(); const q = $('#quick');
  if (!DETAIL || WALK.on) q.hidden = true;
  else if (!q.hidden && !$('#qDetX', q)) { const h = $('.qhead', q); if (h) h.insertAdjacentHTML('beforeend', '<button class="qb" id="qDetX" aria-label="상세 접기" title="상세 접기">⌄</button>'); const x = $('#qDetX'); if (x) x.onclick = () => { DETAIL = false; store.set('drs_detail', false); renderQuick(); renderCtx(); }; }
  const b = $('#ctxbar'); if (b && !b.hidden) renderCtx(); placeCtx();
};

/* ---------- 3. 미니맵 ---------- */
let MINI = store.get('drs_mini', { w: 190, on: true }), miniReq = 0;
function reqMini() { if (!miniReq) miniReq = requestAnimationFrame(() => { miniReq = 0; drawMini(); }); }
function miniXf() {
  const c = $('#miniC'), b = bounds(), pad = 10, W = c.clientWidth, H = c.clientHeight;
  const bw = Math.max(1, b[2] - b[0]), bh = Math.max(1, b[3] - b[1]), s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
  const ox = (W - bw * s) / 2 - b[0] * s, oy = (H - bh * s) / 2 - b[1] * s;
  return { s, ox, oy, W, H, to: (x, y) => [x * s + ox, y * s + oy], from: (x, y) => [(x - ox) / s, (y - oy) / s] };
}
function drawMini() {
  const box = $('#mini'); if (!box || !P) return;
  const hide = !MINI.on || document.body.classList.contains('show') || (isMobile() && document.body.dataset.sheet);
  box.hidden = hide; $('#miniOn').hidden = !(!MINI.on && !document.body.classList.contains('show')); if (hide) return;
  const mw = Math.round(Math.min(MINI.w, ($('#stage').clientWidth || 800) * 0.42)); box.style.width = mw + 'px'; box.style.height = Math.round(mw * 0.74) + 'px';
  const c = $('#miniC'), d = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight; if (!W) return;
  if (c.width !== Math.round(W * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  const X = miniXf();
  g.fillStyle = getCss('--muted'); g.globalAlpha = .45;
  for (const it of P.items) { if (it.hidden || !physical(it) || spec(it).layer !== 'floor') continue; const c4 = corners(it).map((p) => X.to(...p)); g.beginPath(); c4.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill(); }
  g.globalAlpha = 1; g.strokeStyle = getCss('--fg'); g.lineWidth = 1.6; g.lineCap = 'round';
  for (const w of P.walls) { g.beginPath(); g.moveTo(...X.to(w.x1, w.y1)); g.lineTo(...X.to(w.x2, w.y2)); g.stroke(); }
  const bx = sel && selBox2d(); if (bx) { const a = X.to(bx[0], bx[1]), b = X.to(bx[2], bx[3]); g.fillStyle = getCss('--accent'); g.globalAlpha = .55; g.fillRect(a[0], a[1], Math.max(3, b[0] - a[0]), Math.max(3, b[1] - a[1])); g.globalAlpha = 1; }
  const ac = getCss('--accent');
  if (view !== '3d' && !isMobile() || view === '2d') { const r = cv.getBoundingClientRect(); if (r.width) { const a = X.to(...toW(0, 0)), b = X.to(...toW(r.width, r.height)); g.strokeStyle = ac; g.lineWidth = 1.5; g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); } }
  if (view !== '2d') {
    const E = eye(), f = Math.atan2(cam.tz - E[2], cam.tx - E[0]), p = X.to(E[0], E[2]), fov = (cam.fov || 50) * Math.PI / 180 * aspect3d() * .5, L = 26;
    const q = [clamp(p[0], 4, W - 4), clamp(p[1], 4, H - 4)];
    g.fillStyle = ac; g.globalAlpha = .22; g.beginPath(); g.moveTo(...q); g.arc(q[0], q[1], L, f - Math.min(1.2, fov), f + Math.min(1.2, fov)); g.closePath(); g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.arc(q[0], q[1], 4.5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
  }
}
function miniGo(e) {
  const c = $('#miniC'), r = c.getBoundingClientRect(), X = miniXf(), [wx, wy] = X.from(e.clientX - r.left, e.clientY - r.top);
  if (WALK.on) { walkTeleport(wx, wy); return; }
  if (view !== '3d') { const rr = cv.getBoundingClientRect(); V.ox = rr.width / 2 - wx * V.s; V.oy = rr.height / 2 - wy * V.s; draw2d(); }
  if (view !== '2d') { anim = null; goal.tx = wx; goal.tz = wy; }
  reqMini();
}

/* ---------- 4. 명령 검색 (Ctrl+K) ---------- */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const choOf = (s) => [...s].map((ch) => { const c = ch.charCodeAt(0) - 44032; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch; }).join('');
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
function viewCenter() { if (view === '3d' || (isMobile() && view !== '2d')) return [cam.tx, cam.tz]; const r = cv.getBoundingClientRect(); return toW(r.width / 2, r.height / 2); }
function CMDS() {
  const c = (g, n, run, k = '', kw = '') => ({ g, n, run, k, kw });
  const has = !!sel, wall = sel && sel.kind === 'wall';
  const list = [
    c('보기', '2D 도면만', () => setView('2d'), '', 'view plan'), c('보기', '2D + 3D 나란히', () => setView('split'), '', 'split'), c('보기', '3D만', () => setView('3d'), '', '3d'),
    c('보기', '렌더링만 크게 보기', () => setClean(true), '', '눈 clean'), c('보기', '걷기 모드 (1인칭)', () => walkStart(), 'G', 'walk 워크스루 눈높이'),
    c('보기', '보여주기 (영업용)', () => $('#showBtn').click(), '', 'present'), c('보기', '흑백 보기 켜기·끄기', () => $('#monoBtn').click(), '', 'mono'),
    c('보기', '격자 45cm', () => setGrid({ size: 450 })), c('보기', '격자 60cm', () => setGrid({ size: 600 })), c('보기', '격자 1m', () => setGrid({ size: 1000 })), c('보기', '격자 끄기', () => setGrid({ size: 0 })),
    c('보기', MINI.on ? '미니맵 끄기' : '미니맵 켜기', () => { MINI.on = !MINI.on; store.set('drs_mini', MINI); reqMini(); }, '', 'minimap'),
    c('보기', '화면 밝게 (라이트)', () => setTheme('light'), '', 'theme'), c('보기', '화면 어둡게 (다크)', () => setTheme('dark'), '', 'theme'),
    c('편집', '되돌리기', () => undo(), 'Ctrl+Z', 'undo'), c('편집', '다시 실행', () => redo(), 'Ctrl+Y', 'redo'), c('편집', '작업 기록 보기', () => openHist(), '', 'history 히스토리'),
    c('편집', '모두 선택', () => selectAll(), 'Ctrl+A'), c('편집', '벽 그리기', () => setTool('wall'), '', 'wall'), c('편집', '문 달기', () => setTool('door')), c('편집', '창 달기', () => setTool('window')), c('편집', '배선 · 배관 그리기', () => setTool('line'), '', 'pipe wire'),
    c('프로젝트', '홈 · 프로젝트 목록', () => showHome(), 'Ctrl+O'), c('프로젝트', '저장', () => { saveProject(true); toast('저장했어요'); }, 'Ctrl+S'), c('프로젝트', '내보내기', () => $('#exportBtn').click(), 'Ctrl+P', 'export pdf jpg dxf'),
    c('프로젝트', '층 · 공간 추가', () => openLevelDlg(), '', 'level floor'), c('프로젝트', '기본 규격', () => openStd('edit'), '', 'standard'),
    c('프로젝트', '새 안 만들기 (A안 · B안)', () => varAdd(), '', 'variant 비교'), c('프로젝트', '안 비교하기', () => varCompare(), '', 'variant compare'),
    c('프로젝트', '자재 · 물량 · 견적표', () => openBom(), '', 'bom 견적 물량 엑셀'), c('프로젝트', 'DXF 도면 불러오기', () => openDxfIn(), '', 'cad import 캐드'),
    c('프로젝트', '내 3D 모델 올리기 (GLB · OBJ)', () => openModelIn(), '', 'glb obj model'), c('프로젝트', '주방 자동 배치 제안', () => openAuto(), '', 'auto layout 자동'),
    c('프로젝트', '360° 파노라마 저장', () => panoExport(), '', 'panorama vr'), c('프로젝트', '실사 렌더 (고화질)', () => openHQ(), '', 'render 렌더링 photoreal'),
    c('프로젝트', '댓글 달기 (3D 위에 핀)', () => commentMode(true), '', 'comment 메모'), c('프로젝트', '링크 공유', () => openShare(), '', 'share link'),
    c('도움말', '단축키 보기', () => $('#helpDlg').showModal(), 'F1'),
  ];
  if (has) list.unshift(c('선택한 것', '복제', () => dupSel(), 'Ctrl+D'), c('선택한 것', '삭제', () => delSel(), 'Delete'), c('선택한 것', moveOn ? '이동 끄기' : '이동 켜기', () => setMove(!moveOn), 'M'), c('선택한 것', '90° 돌리기', () => rotSel(90), 'R'), c('선택한 것', '상세 수정 열기', () => { DETAIL = true; store.set('drs_detail', true); renderQuick(); }));
  if (wall) list.unshift(c('선택한 것', '벽 나누기', () => openSplit()));
  for (const L of libAll()) list.push(c('기물 놓기', L.name, () => { const [x, y] = viewCenter(); placeItem(L.id, x, y); }, L.w ? `${L.w}×${L.d}` : '', (L.tags || '') + ' ' + (L.sub || '') + ' ' + L.cat));
  for (const it of P.items) list.push(c('도면에 있는 것', spec(it).name, () => { pickSel({ kind: 'item', id: it.id }); focusSel(); }, `${it.w}×${it.d}`, it.type));
  return list;
}
let cmdItems = [], cmdIdx = 0;
function openCmd() { const k = $('#cmdk'); k.hidden = false; $('#cmdQ').value = ''; runCmdSearch(); setTimeout(() => $('#cmdQ').focus(), 0); }
function closeCmd() { $('#cmdk').hidden = true; }
function runCmdSearch() {
  const q = norm($('#cmdQ').value), isCho = q && [...q].every((ch) => CHO.includes(ch)), all = CMDS();
  let res = all.map((x) => { const n = norm(x.n), kw = norm(x.kw + x.g); let s = -1;
    if (!q) s = x.g === '기물 놓기' || x.g === '도면에 있는 것' ? -1 : 1;
    else if (n.startsWith(q)) s = 3; else if (n.includes(q)) s = 2; else if (kw.includes(q)) s = 1.2; else if (isCho && choOf(n).includes(q)) s = 1.5;
    return { x, s }; }).filter((o) => o.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map((o) => o.x);
  cmdItems = res; cmdIdx = 0; let lastG = '';
  $('#cmdList').innerHTML = res.length ? res.map((x, i) => { const h = x.g !== lastG ? `<li class="cmdg" role="presentation">${esc(x.g)}</li>` : ''; lastG = x.g; return h + `<li role="option" class="cmdi ${i === 0 ? 'on' : ''}" data-ci="${i}" aria-selected="${i === 0}"><span>${esc(x.n)}</span>${x.k ? `<kbd>${esc(x.k)}</kbd>` : ''}</li>`; }).join('') : '<li class="cmdg">찾는 것이 없어요</li>';
}
function cmdMove(d) { if (!cmdItems.length) return; cmdIdx = (cmdIdx + d + cmdItems.length) % cmdItems.length; $$('#cmdList .cmdi').forEach((li) => { const on = +li.dataset.ci === cmdIdx; li.classList.toggle('on', on); li.setAttribute('aria-selected', on); if (on) li.scrollIntoView({ block: 'nearest' }); }); }
function cmdRun(i) { const x = cmdItems[i]; if (!x) return; closeCmd(); try { x.run(); } catch (e) { console.error(e); toast('실행하지 못했어요'); } }

/* ---------- 5. 작업 기록 (이름 붙은 되돌리기) ---------- */
let undoMeta = [], redoMeta = [];
const OPN = (t) => (/door|auto|slide|pass/.test(t || '') ? '문' : '창');
const COLS = { items: (o) => o.tag || libGet(o.type).name, walls: () => '벽', openings: (o) => OPN(o.type), lines: (o) => (LINEKINDS[o.kind] || {}).name || '선', sketches: () => '낙서' };
const VERB = (keys) => keys.some((k) => ['x', 'y', 'x1', 'y1', 'x2', 'y2', 't', 'pts'].includes(k)) ? '이동' : keys.includes('rot') ? '회전' : keys.some((k) => ['w', 'd', 'h', 'elev', 'sill', 'ratio', 'fw'].includes(k)) ? '크기' : keys.some((k) => ['color', 'mat', 'finish', 'frame'].includes(k)) ? '색 · 재질' : keys.includes('hidden') ? '빼기 · 넣기' : keys.includes('tag') ? '이름' : '수정';
function diffLabel(prevStr) {
  let A; try { A = JSON.parse(prevStr); } catch (e) { return '작업'; } if (!A) return '작업';
  for (const [k, nm] of Object.entries(COLS)) {
    const a = new Map((A[k] || []).map((o) => [o.id, o])), b = new Map((P[k] || []).map((o) => [o.id, o]));
    const add = [...b.keys()].filter((id) => !a.has(id)), rem = [...a.keys()].filter((id) => !b.has(id));
    const many = (ids, m, v) => `${nm(m.get(ids[0]))}${ids.length > 1 ? ` 외 ${ids.length - 1}개` : ''} ${v}`;
    if (add.length) return many(add, b, '추가'); if (rem.length) return many(rem, a, '삭제');
    const ch = []; let keys = new Set();
    for (const [id, o] of b) { const p = a.get(id); if (JSON.stringify(p) === JSON.stringify(o)) continue; ch.push(id); for (const kk of new Set([...Object.keys(o), ...Object.keys(p)])) if (JSON.stringify(o[kk]) !== JSON.stringify(p[kk])) keys.add(kk); }
    if (ch.length) return many(ch, b, VERB([...keys]));
  }
  const top = Object.keys({ ...A, ...P }).filter((k) => !COLS[k] && k !== 'updated' && JSON.stringify(A[k]) !== JSON.stringify(P[k]));
  const T = { levels: '층', levelId: '층 바꾸기', std: '기본 규격', render: '햇빛 · 밝기', ceiling: '천장', floorOpacity: '바닥', variants: '안 관리', varId: '안 바꾸기', comments: '댓글', name: '이름 바꾸기', scenes: '장면 저장', photos: '사진' };
  return top.length ? (T[top[0]] || '설정') + ' 변경' : '작업';
}
function syncMeta() { while (undoMeta.length < undoStack.length) undoMeta.unshift({ l: '작업' }); while (undoMeta.length > undoStack.length) undoMeta.shift(); while (redoMeta.length < redoStack.length) redoMeta.unshift({ l: '작업' }); while (redoMeta.length > redoStack.length) redoMeta.shift(); }
commit = function (skipUndo) {
  if (batch) return;
  if (!skipUndo) { syncMeta(); undoMeta.push({ l: diffLabel(lastSnap), t: Date.now() }); undoStack.push(lastSnap); if (undoStack.length > 60) { undoStack.shift(); undoMeta.shift(); } redoStack = []; redoMeta = []; }
  lastSnap = JSON.stringify(P); GUIDES = null;
  dirty3d = true; analyze(); draw2d(); mark3d(); renderProps(); renderChecks(); renderObjects(); updHist(); if (typeof updFab === 'function') updFab(); if (typeof renderLevels === 'function') renderLevels();
  clearTimeout(saveT); saveT = setTimeout(saveProject, 400);
  if (typeof renderVariants === 'function') renderVariants(); if ($('#histPop') && !$('#histPop').hidden) renderHist();
};
undo = function () { if (!undoStack.length) return; syncMeta(); redoStack.push(JSON.stringify(P)); redoMeta.push(undoMeta.pop() || { l: '작업' }); P = JSON.parse(undoStack.pop()); sel = null; multi = []; commit(true); };
redo = function () { if (!redoStack.length) return; syncMeta(); undoStack.push(JSON.stringify(P)); undoMeta.push(redoMeta.pop() || { l: '작업' }); P = JSON.parse(redoStack.pop()); sel = null; multi = []; commit(true); };
$('#undoBtn').onclick = () => undo(); $('#redoBtn').onclick = () => redo(); $('#undo2').onclick = () => undo(); $('#redo2').onclick = () => redo();
function histGo(n) { batch = false; for (let i = 0; i < Math.abs(n); i++) n < 0 ? undo() : redo(); }
function renderHist() {
  syncMeta(); const pop = $('#histPop'), ago = (t) => { if (!t) return ''; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? '방금' : s < 3600 ? Math.round(s / 60) + '분 전' : Math.round(s / 3600) + '시간 전'; };
  const N = undoStack.length, rows = [];
  for (let i = redoMeta.length - 1, k = 1; i >= 0; i--, k++) rows.push(`<button class="hrow redo" data-hg="${redoMeta.length - i}"><span>${esc(redoMeta[i].l)}</span><small>다시 하기</small></button>`);
  rows.reverse();
  rows.push(`<div class="hrow now"><span>${N ? esc(undoMeta[N - 1].l) : '처음 상태'}</span><small>지금</small></div>`);
  for (let i = N - 2; i >= 0; i--) rows.push(`<button class="hrow" data-hg="${-(N - 1 - i)}"><span>${esc(undoMeta[i].l)}</span><small>${ago(undoMeta[i].t)}</small></button>`);
  if (N) rows.push(`<button class="hrow first" data-hg="${-N}"><span>열었을 때 상태</span><small>처음</small></button>`);
  pop.innerHTML = `<div class="hphead"><b>작업 기록</b><span class="muted">${N}단계 · 눌러서 그때로</span><button class="qb" data-hx aria-label="닫기">✕</button></div><div class="hlist">${rows.join('')}</div>`;
}
function openHist() { const p = $('#histPop'); p.hidden = !p.hidden; if (!p.hidden) renderHist(); }
{ let t = 0; const ub = $('#undoBtn'); ub.addEventListener('pointerdown', () => { t = setTimeout(() => { t = -1; openHist(); }, 520); }); ub.addEventListener('pointerup', (e) => { if (t === -1) e.stopImmediatePropagation(); clearTimeout(t); }, true); ub.addEventListener('click', (e) => { if (t === -1) { e.stopImmediatePropagation(); t = 0; } }, true); }
