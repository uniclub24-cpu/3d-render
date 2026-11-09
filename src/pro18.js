/* ================================================================
   v20 · 기물 디자인 수정 (부품 · 면 · 모서리 · 꼭짓점 끌어 변형, 부품별 색, 턱)
         배식구 · 통창 디자인 수정 (반투명 범위 · 시트 범위 · 구멍 높이)
         벽 이어붙이기 · 상판 색 · 기본 기물 확장 · 왼쪽 큰 카테고리 · STL
   ================================================================ */

/* ---------- 1. 부품(parts) : 기물을 편집 가능한 도형으로 ----------
   부품 = { k:'pr', n, v:[아래 고리 n개, 위 고리 n개], c, m, a, nm }  (상자 = n 4, 원기둥 = n 12~)
          { k:'poly', f:[[p,p,p,p], …], c, m, a, nm }                 (구 · 곡면 등 그 밖의 면)
   좌표: 기물 가운데가 0, x = 폭(오른쪽 +), y = 바닥에서 위, z = 깊이(앞 +), mm */
var PCAP = null;
{ const _box = box; box = function (T, x0, x1, y0, y1, z0, z1, col, key, alpha) {
  if (PCAP) { PCAP.push({ k: 'pr', n: 4, v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], c: col, m: key || 'plain', a: alpha }); return; }
  return _box.apply(this, arguments); }; }
{ const _cyl = cyl; cyl = function (T, x, z, r, y0, y1, col, key, n = 14, alpha) {
  if (PCAP) { const v = []; for (const y of [y0, y1]) for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; v.push([x + r * Math.cos(a), y, z + r * Math.sin(a)]); } PCAP.push({ k: 'pr', n, v, c: col, m: key || 'plain', a: alpha }); return; }
  return _cyl.apply(this, arguments); }; }
{ const _q = quad; quad = function (g, v, nrm, col) {
  if (PCAP) { const hex = rgbHex(col.slice(0, 3)), last = PCAP[PCAP.length - 1], m = g.key || 'plain', a = g.alpha === 1 ? undefined : g.alpha;
    if (last && last.k === 'poly' && last.c === hex && last.m === m) last.f.push(v.map((p) => p.slice())); else PCAP.push({ k: 'poly', f: [v.map((p) => p.slice())], c: hex, m, a }); return; }
  return _q.apply(this, arguments); }; }
function partsCapture(it) {
  const s = spec(it), clone = JSON.parse(JSON.stringify(it)); clone.x = 0; clone.y = 0; clone.rot = 0; clone.tilt = 0; delete clone.parts;
  const e = zOf(clone), keep = [G, YOFF, FADE, TINT, FOCUS, CUT]; G = {}; YOFF = 0; FADE = false; TINT = false; FOCUS = null; CUT = false; PCAP = [];
  try { buildItem(clone); } finally { const out = PCAP; PCAP = null; [G, YOFF, FADE, TINT, FOCUS, CUT] = keep; it._cap = out; }
  const parts = it._cap; delete it._cap;
  for (const p of parts) { if (p.k === 'pr') p.v.forEach((q) => (q[1] -= e)); else p.f.forEach((f) => f.forEach((q) => (q[1] -= e))); if (typeof p.c !== 'string') p.c = s.color; }
  partsName(parts, it); return parts;
}
function pBox(p) { const pts = p.k === 'pr' ? p.v : p.f.flat(); const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const q of pts) for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i]); } return b; }
function partsName(parts, it) { // 상판 · 턱 · 다리 · 문 이름 짐작
  const fw = it.w * it.d; let top = null;
  parts.forEach((p, i) => { const b = pBox(p), w = b[3] - b[0], h = b[4] - b[1], d = b[5] - b[2]; p.nm = p.nm || '';
    if (p.k !== 'pr') { p.nm = p.nm || '곡면'; return; }
    if (w * d >= fw * 0.45 && h <= 90 && (!top || b[4] > pBox(top)[4])) top = p;
    if (h <= 60 && w <= 70 && d <= 70) p.nm = p.nm || '부품';
    if (h > 300 && w <= 70 && d <= 70) p.nm = '다리'; });
  if (top) top.nm = '상판';
  const tb = top ? pBox(top) : null;
  parts.forEach((p) => { if (p.k !== 'pr' || p === top) return; const b = pBox(p), w = b[3] - b[0], h = b[4] - b[1], d = b[5] - b[2];
    if (tb && b[1] >= tb[4] - 6 && h <= 320 && Math.min(w, d) <= 45 && Math.max(w, d) >= Math.max(it.w, it.d) * .4) p.nm = '턱'; });
  parts.forEach((p, i) => { if (!p.nm) p.nm = '부품 ' + (i + 1); });
}
function partsOf(it) { return it.parts || (libGet(it.type) || {}).parts || null; }
function partsScale(it) { const pb = it.pb || (libGet(it.type) || {}).pb || { w: it.w, d: it.d, h: spec(it).h }; return [it.w / (pb.w || it.w), spec(it).h / (pb.h || spec(it).h || 1), it.d / (pb.d || it.d)]; }
function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vcross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function vnorm(a) { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function prFaces(p) { // 상자형 부품의 면 목록 (꼭짓점 번호)
  const n = p.n, F = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; F.push([i, j, n + j, n + i]); }
  F.push([...Array(n).keys()].map((i) => n + i)); F.push([...Array(n).keys()].reverse());
  return F;
}
function partFaces(p) { return p.k === 'pr' ? prFaces(p).map((ix) => ix.map((i) => p.v[i])) : p.f; }
function buildParts(it, parts) {
  const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), [sx, sy, sz] = partsScale(it), hi = DE && DE.id === it.id; const tint0 = TINT; if (hi) TINT = false; try {
  for (let pi = 0; pi < parts.length; pi++) { const p = parts[pi]; if (p.hide) continue;
    const g = grp(p.m || 'plain', p.a), c = tintC(hexRGB(p.c || '#b8bcc2')), S = (q) => [q[0] * sx, q[1] * sy, q[2] * sz];
    const cen = (() => { const pts = (p.k === 'pr' ? p.v : p.f.flat()).map(S); return [0, 1, 2].map((k) => pts.reduce((s, q) => s + q[k], 0) / pts.length); })();
    for (const f0 of partFaces(p)) { let f = f0.map(S); if (f.length < 3) continue;
      let n = vnorm(vcross(vsub(f[1], f[0]), vsub(f[f.length - 1], f[0]))); if (!isFinite(n[0]) || Math.hypot(...n) < .5) { n = vnorm(vcross(vsub(f[2], f[0]), vsub(f[1], f[0]))); }
      const fc = [0, 1, 2].map((k) => f.reduce((s, q) => s + q[k], 0) / f.length); if (p.k === 'pr' && (n[0] * (fc[0] - cen[0]) + n[1] * (fc[1] - cen[1]) + n[2] * (fc[2] - cen[2])) < 0) { n = n.map((x) => -x); f = f.slice().reverse(); }
      const W = (q) => T.P(q[0], e + q[1], q[2]), N = T.N(...n), cc = hi && DE.part === pi ? c.map((x) => Math.min(1, x * .85 + .15)) : n[1] < -.5 ? c.map((x) => x * .9) : c;
      if (f.length === 4) quad(g, f.map(W), N, cc); else for (let i = 1; i + 1 < f.length; i++) quad(g, [W(f[0]), W(f[i]), W(f[i + 1]), W(f[i + 1])], N, cc);
    } } } finally { TINT = tint0; }
}
{ const _bi = buildItem; buildItem = function (it) { if (!PCAP) { const ps = partsOf(it); if (ps && ps.length) return buildParts(it, ps); } return _bi(it); }; }

/* ---------- 2. 디자인 수정 모드 ---------- */
var DE = null; // { id, part, axis, hover, drag }
function deEnter(it) {
  if (!it) return; const s = spec(it);
  if (s.L.shape === 'mesh' || s.L.shape === 'zone') { toast('이 기물은 디자인 수정을 할 수 없어요 (올린 3D 모델 · 바닥판)'); return; }
  if (!it.parts) { const lp0 = (libGet(it.type) || {}).parts; it.parts = lp0 ? JSON.parse(JSON.stringify(lp0)) : partsCapture(it); }
  // 크기 조절을 부품에 굽기 (편집은 1:1로)
  const [sx, sy, sz] = partsScale(it); if (Math.abs(sx - 1) + Math.abs(sy - 1) + Math.abs(sz - 1) > 1e-6) it.parts.forEach((p) => (p.k === 'pr' ? p.v : p.f.flat()).forEach((q) => { q[0] *= sx; q[1] *= sy; q[2] *= sz; }));
  it.pb = { w: it.w, d: it.d, h: s.h };
  DE = { id: it.id, part: -1, axis: 'free', hover: null, drag: null, fit: true };
  if (view === '2d') setView('split'); sel = { kind: 'item', id: it.id }; multi = [];
  cam.tx = it.x; cam.tz = it.y; cam.ty = curElev() + zOf(it) + s.h * .4; cam.dist = Math.max(1800, Math.max(it.w, it.d, s.h) * 2.4); cam.pitch = .5; { const a0 = (it.rot || 0) * Math.PI / 180; cam.yaw = Math.atan2(Math.cos(a0), -Math.sin(a0)) + 0.6; } if (gc.getBoundingClientRect().width > 760) { const k = cam.dist * .17; cam.tx += Math.sin(cam.yaw) * k; cam.tz -= Math.cos(cam.yaw) * k; } cam.cut = true; syncGoal();
  commit(); dirty3d = true; document.body.classList.add('de-on'); deUI(); deLoop();
}
function deExit() { if (!DE) return; document.body.classList.remove('de-on'); const it = itemOf(DE.id); DE = null; if (it) partsFit(it); commit(); dirty3d = true; const p = $('#dePanel'); if (p) p.hidden = true; const c = $('#deOv'); if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height); renderProps(); }
function partsFit(it) { // 부품 바깥 크기에 맞춰 기물 가로 · 깊이 · 높이 · 위치 다시 잡기
  if (!it.parts || !it.parts.length) return; const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const p of it.parts) { const q = pBox(p); for (let i = 0; i < 3; i++) { b[i] = Math.min(b[i], q[i]); b[i + 3] = Math.max(b[i + 3], q[i + 3]); } }
  const cx0 = (b[0] + b[3]) / 2, cz0 = (b[2] + b[5]) / 2, y0 = b[1];
  if (Math.abs(cx0) > .5 || Math.abs(cz0) > .5 || Math.abs(y0) > .5) { it.parts.forEach((p) => (p.k === 'pr' ? p.v : p.f.flat()).forEach((q) => { q[0] -= cx0; q[2] -= cz0; q[1] -= y0; }));
    const a = (it.rot || 0) * Math.PI / 180; it.x = Math.round(it.x + cx0 * Math.cos(a) - cz0 * Math.sin(a)); it.y = Math.round(it.y + cx0 * Math.sin(a) + cz0 * Math.cos(a)); if (y0) it.elev = Math.round(zOf(it) + y0); }
  it.w = Math.max(10, Math.round(b[3] - b[0])); it.d = Math.max(10, Math.round(b[5] - b[2])); it.h = Math.max(5, Math.round(b[4] - b[1])); it.pb = { w: it.w, d: it.d, h: it.h };
}
function deItem() { return DE && itemOf(DE.id); }
function deW(it, q) { const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), p = T.P(q[0], zOf(it) + q[1], q[2]); return [p[0], p[1] + curElev(), p[2]]; }
function deS(it, q) { const r = gc.getBoundingClientRect(); return lastM ? proj(lastM, deW(it, q), r) : null; }
function deLoop() { if (!DE) return; try { deDraw(); } catch (e) { console.warn(e); } requestAnimationFrame(deLoop); }
function deOverlay() {
  let c = $('#deOv'); if (!c) { c = document.createElement('canvas'); c.id = 'deOv'; c.setAttribute('aria-hidden', 'true'); c.style.cssText = 'position:absolute;pointer-events:none;z-index:6'; gc.parentNode.appendChild(c); }
  const r = gc.getBoundingClientRect(), pr = gc.parentNode.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  c.style.left = r.left - pr.left + 'px'; c.style.top = r.top - pr.top + 'px'; c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  return { c, g: c.getContext('2d'), dpr };
}
function deDraw() {
  const it = deItem(); if (!it || !it.parts) { deExit(); return; } const { c, g, dpr } = deOverlay(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, c.width, c.height);
  if (view === '2d') return;
  const acc = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#0a84ff';
  it.parts.forEach((p, pi) => { if (p.hide) return; const on = pi === DE.part; g.strokeStyle = on ? acc : 'rgba(255,255,255,.55)'; g.lineWidth = on ? 2 : 1;
    for (const f of partFaces(p)) { const s = f.map((q) => deS(it, q)); if (s.some((x) => !x)) continue; g.beginPath(); s.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.stroke(); } });
  const h = DE.hover, p = it.parts[DE.part];
  if (p && p.k === 'pr') { p.v.forEach((q, i) => { const s = deS(it, q); if (!s) return; const hv = h && h.t === 'v' && h.i === i; g.fillStyle = hv ? '#ff9f0a' : '#fff'; g.strokeStyle = acc; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], hv ? 6 : 4.5, 0, 7); g.fill(); g.stroke(); }); }
  if (h && p) { g.lineWidth = 4; g.strokeStyle = '#ff9f0a';
    if (h.t === 'e') { const a = deS(it, p.v[h.i[0]]), b = deS(it, p.v[h.i[1]]); if (a && b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    if (h.t === 'f') { const s = h.f.map((q) => deS(it, q)); if (!s.some((x) => !x)) { g.fillStyle = 'rgba(255,159,10,.22)'; g.beginPath(); s.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); g.lineWidth = 2; g.stroke(); } } }
  if (DE.drag && DE.drag.label) { const r = gc.getBoundingClientRect(); g.font = '600 13px system-ui'; const t = DE.drag.label, w = g.measureText(t).width + 16; g.fillStyle = 'rgba(20,20,24,.85)'; g.fillRect(DE.drag.mx - r.left + 14, DE.drag.my - r.top + 10, w, 24); g.fillStyle = '#fff'; g.fillText(t, DE.drag.mx - r.left + 22, DE.drag.my - r.top + 27); }
}
function deHit(e) { // 눌린 곳: 꼭짓점 · 모서리 · 면
  const it = deItem(); if (!it) return null; const r = gc.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, p = it.parts[DE.part];
  if (p && p.k === 'pr') {
    let best = null; p.v.forEach((q, i) => { const s = deS(it, q); if (!s) return; const d = Math.hypot(s[0] - mx, s[1] - my); if (d < 11 && (!best || d < best.d)) best = { t: 'v', i, d }; }); if (best) return best;
    const n = p.n, E = []; for (let i = 0; i < n; i++) { E.push([i, (i + 1) % n], [n + i, n + (i + 1) % n], [i, n + i]); }
    for (const [a, b] of E) { const A = deS(it, p.v[a]), B = deS(it, p.v[b]); if (!A || !B) continue; const L2 = (B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2; if (L2 < 4) continue; let t = ((mx - A[0]) * (B[0] - A[0]) + (my - A[1]) * (B[1] - A[1])) / L2; if (t < .08 || t > .92) continue; const d = Math.hypot(A[0] + (B[0] - A[0]) * t - mx, A[1] + (B[1] - A[1]) * t - my); if (d < 7 && (!best || d < best.d)) best = { t: 'e', i: [a, b], d }; }
    if (best) return best;
  }
  // 면: 화면에서 안에 들어가는 면 중 가장 가까운 것
  const E0 = rayOf(e).E; let best = null;
  it.parts.forEach((pp, pi) => { if (pp.hide) return; const faces = pp.k === 'pr' ? prFaces(pp) : pp.f.map((_, k) => k);
    faces.forEach((fx, fi) => { const f = pp.k === 'pr' ? fx.map((i) => pp.v[i]) : pp.f[fx]; const s = f.map((q) => deS(it, q)); if (s.some((x) => !x)) return;
      let inside = false; for (let i = 0, j = s.length - 1; i < s.length; j = i++) { if ((s[i][1] > my) !== (s[j][1] > my) && mx < (s[j][0] - s[i][0]) * (my - s[i][1]) / (s[j][1] - s[i][1] + 1e-9) + s[i][0]) inside = !inside; }
      if (!inside) return; const wc = f.map((q) => deW(it, q)), nn = vnorm(vcross(vsub(wc[1], wc[0]), vsub(wc[wc.length - 1], wc[0]))), RD = rayOf(e).D, den = RD[0] * nn[0] + RD[1] * nn[1] + RD[2] * nn[2];
      const dist = Math.abs(den) < 1e-6 ? 1e12 : ((wc[0][0] - E0[0]) * nn[0] + (wc[0][1] - E0[1]) * nn[1] + (wc[0][2] - E0[2]) * nn[2]) / den; if (dist < 0) return;
      if (!best || dist < best.dist) best = { t: 'f', pi, fi, ix: pp.k === 'pr' ? fx : null, f, dist }; }); });
  return best;
}
function deLocalDelta(it, wd) { const a = (it.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [wd[0] * c + wd[2] * s, wd[1], -wd[0] * s + wd[2] * c]; }
function dePlane(e, P0, nrm) { const { E, D } = rayOf(e), den = D[0] * nrm[0] + D[1] * nrm[1] + D[2] * nrm[2]; if (Math.abs(den) < 1e-6) return null; const t = ((P0[0] - E[0]) * nrm[0] + (P0[1] - E[1]) * nrm[1] + (P0[2] - E[2]) * nrm[2]) / den; return t > 0 ? [E[0] + D[0] * t, E[1] + D[1] * t, E[2] + D[2] * t] : null; }
const snapV = (v, alt) => (alt ? Math.round(v) : Math.round(v / 5) * 5);
gc.addEventListener('pointerdown', (e) => {
  if (!DE || e.button > 0 || view === '2d') return; const it = deItem(); if (!it) return; const h = deHit(e); if (!h) return;
  if (h.t === 'f' && h.pi !== DE.part) { DE.part = h.pi; deUI(); dirty3d = true; e.stopImmediatePropagation(); e.preventDefault(); return; }
  const p = it.parts[DE.part]; if (!p) return;
  const idx = h.t === 'v' ? [h.i] : h.t === 'e' ? h.i : h.ix ? h.ix : null; e.stopImmediatePropagation(); e.preventDefault(); gc.setPointerCapture(e.pointerId);
  const orig = JSON.parse(JSON.stringify(p)), cam0 = rayOf(e).E;
  if (h.t === 'f') { // 면 밀고 당기기: 면의 바깥 방향으로
    const f = h.f, n0 = vnorm(vcross(vsub(f[1], f[0]), vsub(f[f.length - 1], f[0]))), fc = [0, 1, 2].map((k) => f.reduce((s, q) => s + q[k], 0) / f.length), pc = pBox(p);
    const cen = [(pc[0] + pc[3]) / 2, (pc[1] + pc[4]) / 2, (pc[2] + pc[5]) / 2], n = (n0[0] * (fc[0] - cen[0]) + n0[1] * (fc[1] - cen[1]) + n0[2] * (fc[2] - cen[2])) < 0 ? n0.map((x) => -x) : n0;
    DE.drag = { t: 'f', idx, n, fc, orig, mx: e.clientX, my: e.clientY, poly: p.k === 'poly' ? h.fi : null };
  } else { const it2 = it, P0 = deW(it2, p.v[idx[0]]); const vert = e.shiftKey || DE.axis === 'y'; const camD = vsub(P0, cam0), hn = vnorm([camD[0], 0, camD[2]]);
    DE.drag = { t: h.t, idx, orig, P0, nrm: vert ? hn : [0, 1, 0], mx: e.clientX, my: e.clientY }; }
}, true);
gc.addEventListener('pointermove', (e) => {
  if (!DE || view === '2d') return; const it = deItem(); if (!it) return;
  if (!DE.drag) { DE.hover = deHit(e); gc.style.cursor = DE.hover ? (DE.hover.t === 'f' ? 'move' : 'grab') : ''; return; }
  e.stopImmediatePropagation(); const d = DE.drag, p = it.parts[DE.part]; if (!p) return; d.mx = e.clientX; d.my = e.clientY;
  if (d.t === 'f') { const s0 = deS(it, d.fc), s1 = deS(it, d.fc.map((v, i) => v + d.n[i] * 100)); if (!s0 || !s1) return; const r = gc.getBoundingClientRect(), dv = [s1[0] - s0[0], s1[1] - s0[1]], L2 = dv[0] ** 2 + dv[1] ** 2 || 1;
    const mv = [e.clientX - r.left - s0[0] - (d.ox ?? (d.ox = e.clientX - r.left - s0[0], 0)), 0]; const dm = [e.clientX - (d.sx ?? (d.sx = e.clientX)), e.clientY - (d.sy ?? (d.sy = e.clientY))];
    const amt = snapV((dm[0] * dv[0] + dm[1] * dv[1]) / L2 * 100, e.altKey);
    if (p.k === 'pr') { p.v = d.orig.v.map((q, i) => (d.idx.includes(i) ? q.map((v, k) => v + d.n[k] * amt) : q.slice())); }
    else { p.f = d.orig.f.map((f, k) => (k === d.poly ? f.map((q) => q.map((v, j) => v + d.n[j] * amt)) : f)); }
    d.label = `${amt > 0 ? '+' : ''}${amt} mm`; }
  else { const hit = dePlane(e, d.P0, d.nrm); if (!hit) return; let wd = vsub(hit, d.P0); let ld = deLocalDelta(it, wd);
    if (d.nrm[1] !== 1) ld = [DE.axis === 'y' ? 0 : ld[0], ld[1], DE.axis === 'y' ? 0 : ld[2]]; else ld[1] = 0;
    if (DE.axis === 'x') ld = [ld[0], 0, 0]; if (DE.axis === 'z') ld = [0, 0, ld[2]]; if (DE.axis === 'y') ld = [0, ld[1], 0];
    ld = ld.map((v) => snapV(v, e.altKey)); p.v = d.orig.v.map((q, i) => (d.idx.includes(i) ? [q[0] + ld[0], q[1] + ld[1], q[2] + ld[2]] : q.slice()));
    d.label = `X ${ld[0]} · Y ${ld[1]} · Z ${ld[2]} mm`; }
  dirty3d = true;
}, true);
window.addEventListener('pointerup', () => { if (!DE || !DE.drag) return; DE.drag = null; commit(); dirty3d = true; deUI(); }, true);
window.addEventListener('keydown', (e) => { if (!DE) return; if (e.key === 'Escape') { e.stopImmediatePropagation(); deExit(); } }, true);

/* 디자인 수정 패널 */
function deUI() {
  const it = deItem(); if (!it) return; let el = $('#dePanel');
  if (!el) { el = document.createElement('div'); el.id = 'dePanel'; el.className = 'depanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '디자인 수정'); $('#stage').appendChild(el); }
  el.hidden = false; const p = it.parts[DE.part], s = spec(it), MOPT = Object.entries(MATS).filter(([k]) => !['frosted'].includes(k)).map(([k, v]) => `<option value="${k}" ${p && (p.m === MATS[k].tex || p.mk === k) ? 'selected' : ''}>${v.n}</option>`).join('');
  const tuk = it.parts.filter((q) => q.nm === '턱'), tukH = tuk.length ? Math.round(pBox(tuk[0])[4] - pBox(tuk[0])[1]) : 0;
  el.innerHTML = `<div class="dehd"><b>디자인 수정 · ${esc(s.name)}</b><button class="btn" id="deDone">완료</button></div>
  <p class="hint">면을 끌면 늘리고 줄이기 · 꼭짓점 · 모서리를 끌면 모양 바꾸기 (Shift = 위아래) · 다른 부품은 눌러서 고르기 · Alt = 5mm 맞춤 끄기 · Esc 끝</p>
  <div class="seg" role="group" aria-label="움직일 방향">${[['free', '자유'], ['x', '가로'], ['y', '높이'], ['z', '깊이']].map(([k, n]) => `<button data-deax="${k}" aria-pressed="${DE.axis === k}">${n}</button>`).join('')}</div>
  <div class="departs">${it.parts.map((q, i) => `<button data-dep="${i}" aria-pressed="${i === DE.part}" class="${q.hide ? 'off' : ''}"><i style="background:${esc(q.c || '#999')}"></i>${esc(q.nm || '부품 ' + (i + 1))}</button>`).join('')}</div>
  ${p ? `<div class="desel"><label class="fld"><span>부품 이름</span><input id="deNm" value="${esc(p.nm || '')}"></label>
    <div class="g3"><label class="fld"><span>색</span><input type="color" id="deCol" value="${/^#[0-9a-f]{6}$/i.test(p.c || '') ? p.c : '#b8bcc2'}"></label><label class="fld"><span>재질</span><select id="deMat">${MOPT}</select></label><label class="fld"><span>불투명도</span><input type="range" id="deA" min="0.15" max="1" step="0.05" value="${p.a ?? 1}"></label></div>
    <div class="row wrap"><button class="btn" id="deDup">부품 복제</button><button class="btn" id="deHide">${p.hide ? '보이기' : '숨기기'}</button><button class="btn danger" id="deDel">부품 지우기</button></div></div>` : '<p class="hint">3D에서 바꿀 부품을 누르세요 (예: 상판)</p>'}
  <div class="lbl">기물 전체</div>
  <div class="row wrap" style="align-items:center"><label class="fld" style="flex:0 0 auto"><span>전체 한 색</span><input type="color" id="deAll" value="${/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#c9ced4'}"></label><button class="btn" id="deAllGo">모든 부품에 적용</button><button class="btn" id="deAdd">상자 추가</button></div>
  <div class="row wrap" style="align-items:center"><label class="fld" style="flex:0 0 120px"><span>턱 높이 mm</span><input type="number" id="deTuk" min="0" max="1200" step="10" value="${tukH}"></label><button class="btn" id="deTukOff" ${tuk.length ? '' : 'disabled'}>턱 없애기</button><button class="btn" id="deTukOn">${tuk.length ? '턱 높이 적용' : '턱 만들기'}</button></div>
  <div class="lbl">새 기물로 저장</div>
  <div class="row wrap" style="align-items:center"><input id="deSaveNm" placeholder="예: 턱 없는 작업대 1500" value="${esc((it.tag || s.name) + ' (수정)')}" style="flex:1;min-width:140px"><button class="btn pri" id="deSave">내 기물에 저장</button></div>
  <div class="row"><button class="btn" id="deReset">처음 모양으로</button></div>`;
  const P_ = () => it.parts[DE.part], upd = (fn) => { fn(); commit(); dirty3d = true; deUI(); };
  $('#deDone').onclick = deExit;
  el.querySelectorAll('[data-deax]').forEach((b) => (b.onclick = () => { DE.axis = b.dataset.deax; deUI(); }));
  el.querySelectorAll('[data-dep]').forEach((b) => (b.onclick = () => { DE.part = +b.dataset.dep; dirty3d = true; deUI(); }));
  if (p) {
    $('#deNm').onchange = (e) => upd(() => (P_().nm = e.target.value.trim()));
    $('#deCol').oninput = (e) => { P_().c = e.target.value; dirty3d = true; }; $('#deCol').onchange = () => upd(() => {});
    $('#deMat').onchange = (e) => upd(() => { const k = e.target.value; P_().m = MATS[k].tex; P_().mk = k; if (MATS[k].a != null) P_().a = MATS[k].a; });
    $('#deA').oninput = (e) => { P_().a = +e.target.value >= 1 ? undefined : +e.target.value; dirty3d = true; }; $('#deA').onchange = () => upd(() => {});
    $('#deDup').onclick = () => upd(() => { const c = JSON.parse(JSON.stringify(P_())); (c.k === 'pr' ? c.v : c.f.flat()).forEach((q) => (q[0] += 60)); c.nm = (c.nm || '부품') + ' 복제'; it.parts.push(c); DE.part = it.parts.length - 1; });
    $('#deHide').onclick = () => upd(() => (P_().hide = !P_().hide));
    $('#deDel').onclick = () => upd(() => { it.parts.splice(DE.part, 1); DE.part = -1; });
  }
  $('#deAllGo').onclick = () => upd(() => { const c = $('#deAll').value; it.parts.forEach((q) => (q.c = c)); it.color = c; });
  $('#deAdd').onclick = () => upd(() => { const b = it.parts.reduce((a, q) => { const x = pBox(q); return [Math.min(a[0], x[0]), Math.min(a[1], x[1]), Math.min(a[2], x[2]), Math.max(a[3], x[3]), Math.max(a[4], x[4]), Math.max(a[5], x[5])]; }, [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
    const y = b[4]; it.parts.push({ k: 'pr', n: 4, v: [[-100, y, -100], [100, y, -100], [100, y, 100], [-100, y, 100], [-100, y + 200, -100], [100, y + 200, -100], [100, y + 200, 100], [-100, y + 200, 100]], c: spec(it).color, m: 'plain', nm: '새 상자' }); DE.part = it.parts.length - 1; });
  $('#deTukOff').onclick = () => upd(() => { it.parts = it.parts.filter((q) => q.nm !== '턱'); DE.part = -1; });
  $('#deTukOn').onclick = () => upd(() => tukSet(it, Math.max(0, +$('#deTuk').value || 100)));
  $('#deSave').onclick = () => deSaveLib(it, $('#deSaveNm').value.trim());
  $('#deReset').onclick = () => upd(() => { const lp0 = (libGet(it.type) || {}).parts; delete it.parts; delete it.pb; if (!lp0) { it.parts = partsCapture(it); it.pb = { w: it.w, d: it.d, h: spec(it).h }; } DE.part = -1; });
}
function tukSet(it, H) { // 턱 높이 바꾸기 · 없으면 상판 뒤쪽에 만들기
  const tuk = it.parts.filter((q) => q.nm === '턱');
  if (!H) { it.parts = it.parts.filter((q) => q.nm !== '턱'); return; }
  if (tuk.length) { for (const q of tuk) { const n = q.n, y0 = Math.min(...q.v.slice(0, n).map((v) => v[1])); q.v.forEach((v, i) => { if (i >= n) v[1] = y0 + H; }); } return; }
  const top = it.parts.find((q) => q.nm === '상판') || it.parts.reduce((a, q) => (q.k === 'pr' && (!a || pBox(q)[4] > pBox(a)[4]) ? q : a), null); if (!top) return; const b = pBox(top), y = b[4];
  it.parts.push({ k: 'pr', n: 4, v: [[b[0], y, b[2]], [b[3], y, b[2]], [b[3], y, b[2] + 15], [b[0], y, b[2] + 15], [b[0], y + H, b[2]], [b[3], y + H, b[2]], [b[3], y + H, b[2] + 15], [b[0], y + H, b[2] + 15]], c: top.c, m: top.m, mk: top.mk, nm: '턱' });
}
function deSaveLib(it, name) {
  partsFit(it); const s = spec(it), L = s.L;
  const m = { id: uid('my'), name: name || s.name + ' (수정)', tag: name || '', shape: L.shape, v: L.v, w: it.w, d: it.d, h: it.h || s.h, elev: zOf(it), layer: s.layer, color: s.color, mat: s.mat, drain: L.drain, gas: L.gas, hood: L.hood, kw: it.kw ?? L.kw, mk: L.mk, parts: JSON.parse(JSON.stringify(it.parts)), pb: { w: it.w, d: it.d, h: it.h || s.h } };
  myLib.push(m); try { store.set('drs_mylib', myLib); store.set('drs_mylib_t', Date.now()); } catch (e) { myLib.pop(); toast('저장 공간이 부족해요'); return; }
  it.type = m.id; libCat = '내 기물'; renderLib(); commit(); dirty3d = true; toast(`"${m.name}"을 내 기물에 저장했어요 · 기물 목록 "내 기물"에서 다시 쓸 수 있어요`); deUI();
}

/* 속성 창 · 선택 막대에 "디자인 수정" · 상판 색 · 턱 높이 */
const TOPSH = { work: 1, work2: 1, table: 1, counter: 1, sink: 0, bench: 0 };
{ const _rp = renderProps0; renderProps0 = function () { _rp();
  try {
    const el = $('#props'); if (!sel || !el) return;
    if (sel.kind === 'item') { const it = itemOf(sel.id); if (!it) return; const s = spec(it), sh = s.L.shape; if (sh === 'zone' || sh === 'mesh') return;
      const ps = partsOf(it), top = ps && ps.find((q) => q.nm === '상판'), topC = top ? top.c : it.topColor || (sh === 'counter' ? '#e8e4dc' : s.color), tukP = ps && ps.find((q) => q.nm === '턱');
      const tukH = ps ? (tukP ? Math.round(pBox(tukP)[4] - pBox(tukP)[1]) : 0) : sh.startsWith('work') ? it.back ?? s.L.back ?? 100 : null;
      const html = `<div class="lbl">디자인</div><div class="row wrap"><button class="btn pri" id="deGo">디자인 수정 (부품 · 꼭짓점 끌기)</button>${ps ? '<span class="hint">이 기물은 모양을 바꾼 기물이에요</span>' : ''}</div>
        ${TOPSH[sh] != null || top ? `<div class="g3"><label class="fld"><span>상판 색</span><input type="color" id="topC" value="${/^#[0-9a-f]{6}$/i.test(topC) ? topC : '#c9ced4'}"></label><label class="fld"><span>상판 재질</span><select id="topM"><option value="">그대로</option>${Object.entries(MATS).filter(([k]) => !['glass', 'frosted'].includes(k)).map(([k, v]) => `<option value="${k}" ${it.topMat === k ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label>${tukH != null ? `<label class="fld"><span>턱 높이 mm (0 = 없음)</span><input type="number" id="tukH" min="0" max="1200" step="10" value="${tukH}"></label>` : ''}</div>` : ''}`;
      const anchor = el.querySelector('#saveLib'); const box_ = document.createElement('div'); box_.className = 'debox'; box_.innerHTML = html; (anchor ? anchor.closest('.row') : el.lastElementChild).insertAdjacentElement('beforebegin', box_);
      $('#deGo').onclick = () => deEnter(it);
      const tc = $('#topC'), tm = $('#topM'), th = $('#tukH');
      const setTop = (c, mk) => { const P2 = it.parts || null; if (P2) { const t = P2.find((q) => q.nm === '상판'); if (t) { if (c) t.c = c; if (mk) { t.m = MATS[mk].tex; t.mk = mk; } } } else { if (c) it.topColor = c; if (mk !== undefined) it.topMat = mk || undefined; } dirty3d = true; };
      if (tc) { tc.oninput = (e) => setTop(e.target.value); tc.onchange = () => commit(); }
      if (tm) tm.onchange = (e) => { setTop(null, e.target.value); commit(); };
      if (th) th.onchange = (e) => { const v = Math.max(0, +e.target.value || 0); if (it.parts) tukSet(it, v); else if (ps) { it.parts = JSON.parse(JSON.stringify(ps)); it.pb = { w: it.w, d: it.d, h: spec(it).h }; tukSet(it, v); } else it.back = v; commit(); dirty3d = true; };
    }
    if (sel.kind === 'open') { const o = P.openings.find((q) => q.id === sel.id); if (!o) return; const b = document.createElement('div'); b.className = 'debox'; b.innerHTML = `<div class="row wrap"><button class="btn pri" id="opDeGo">디자인 수정 (반투명 · 시트 · 높이)</button></div>`; el.appendChild(b); $('#opDeGo').onclick = () => opDesign(o); }
  } catch (e) { console.warn('design props', e); }
}; }
{ const _rc = renderCtx; renderCtx = function () { _rc(); const b = $('#ctxbar'); if (DE) return; if (!b || !sel) return;
  const ws = multi.length === 2 && multi.every((m) => m.kind === 'wall');
  if (ws) b.insertAdjacentHTML('beforeend', '<span class="cxsep"></span><button data-cx="join" title="두 벽 이어붙이기" aria-label="벽 이어붙이기" class="cxtxt">벽 잇기</button>');
  if (sel.kind === 'item' && multi.length <= 1) { const it = itemOf(sel.id); if (it && !['zone', 'mesh'].includes(spec(it).L.shape)) b.insertAdjacentHTML('beforeend', '<button data-cx="design" title="디자인 수정" aria-label="디자인 수정" class="cxtxt">디자인</button>'); }
  if (sel.kind === 'open' && multi.length <= 1) b.insertAdjacentHTML('beforeend', '<button data-cx="opdesign" title="디자인 수정" aria-label="디자인 수정" class="cxtxt">디자인</button>');
}; }
$('#stage').addEventListener('click', (e) => { const bt = e.target.closest('[data-cx]'); if (!bt) return; const k = bt.dataset.cx;
  if (k === 'design') deEnter(itemOf(sel && sel.id)); if (k === 'join') joinWalls(wallOf(multi[0].id), wallOf(multi[1].id)); if (k === 'opdesign') { const o = P.openings.find((q) => q.id === (sel && sel.id)); if (o) opDesign(o); } }, true);

/* 작업대 · 테이블 · 카운터 상판 색 / 턱 (부품으로 바꾸지 않은 기물) */
{ const _bi = buildItem; buildItem = function (it) {
  const s = spec(it), sh = s.L.shape; if (PCAP || partsOf(it) || !(it.topColor || it.topMat || it.back != null || s.L.back != null) || !TOPSH.hasOwnProperty(sh)) return _bi(it);
  const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), w = it.w, d = it.d, h = s.h, hw = w / 2, hd = d / 2, col = s.color, mk = MATS[s.mat].tex, ma = MATS[s.mat].a;
  const tc = it.topColor || (sh === 'counter' ? '#e8e4dc' : col), tk = it.topMat ? MATS[it.topMat].tex : sh === 'counter' ? undefined : mk, ta = it.topMat ? MATS[it.topMat].a : undefined;
  const B = (x0, x1, y0, y1, z0, z1, c, k, a) => box(T, x0, x1, e + y0, e + y1, z0, z1, c || col, k || mk, a ?? (c ? undefined : ma));
  const legs = (H, t = 40, ins = 30, c = '#9aa1a9') => { for (const x of [-hw + ins, hw - ins - t]) for (const z of [-hd + ins, hd - ins - t]) B(x, x + t, 0, H, z, z + t, c, 'steel'); };
  if (sh === 'work' || sh === 'work2') { legs(h - 40); B(-hw, hw, h - 40, h, -hd, hd, tc, tk, ta); if (sh === 'work2') B(-hw + 20, hw - 20, 160, 185, -hd + 20, hd - 20); const bk = it.back ?? s.L.back ?? 100; if (bk > 0) B(-hw, hw, h, h + bk, -hd, -hd + 15, tc, tk, ta); return; }
  if (sh === 'table') { B(-hw, hw, h - 35, h, -hd, hd, tc, tk, ta); if (w > 900) { for (const [x, z] of [[-hw + 40, -hd + 40], [hw - 80, -hd + 40], [-hw + 40, hd - 80], [hw - 80, hd - 80]]) B(x, x + 40, 0, h - 35, z, z + 40, '#2b2d31'); } else cyl(T, 0, 0, 35, e, e + h - 35, '#2b2d31', 'plain', 8); return; }
  if (sh === 'counter') { B(-hw, hw, 0, h - 40, -hd + 60, hd); B(-hw, hw, h - 40, h, -hd, hd, tc, tk, ta); B(-hw, hw, 700, 740, -hd + 60, -hd + 400, tc, tk, ta); return; }
  return _bi(it);
}; }

/* ---------- 3. 배식구 · 통창 디자인 수정 ---------- */
function glassBand(T, o, x0, x1, y0, y1, z0, z1, alpha) { // 반투명(간유리) 범위
  const fr = o.frost; if (!fr || !fr.on) return box(T, x0, x1, y0, y1, z0, z1, '#a9d6ec', 'plain', alpha);
  const a = clamp(fr.b ?? y0, y0, y1), b = clamp(fr.t ?? y1, y0, y1), l = clamp(x0 + (fr.l || 0), x0, x1), r = clamp(x1 - (fr.r || 0), x0, x1), fa = fr.a ?? .82;
  if (a > y0) box(T, x0, x1, y0, a, z0, z1, '#a9d6ec', 'plain', alpha); if (b < y1) box(T, x0, x1, b, y1, z0, z1, '#a9d6ec', 'plain', alpha);
  if (l > x0) box(T, x0, l, a, b, z0, z1, '#a9d6ec', 'plain', alpha); if (r < x1) box(T, r, x1, a, b, z0, z1, '#a9d6ec', 'plain', alpha);
  if (b > a && r > l) box(T, l, r, a, b, z0 - 1, z1 + 1, fr.c || '#eef2f4', 'frost', fa);
}
{ const _sf = syncFacade; syncFacade = function () { _sf(); if (!P || !P.items) return;
  for (const it of P.items) { if (!it.win || !it.sr) continue; const o = P.openings.find((q) => q.id === it.win), g = o && openingGeom(o); if (!g) continue; const r = it.sr, L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) || 1, ux = (g.b[0] - g.a[0]) / L, uy = (g.b[1] - g.a[1]) / L;
    const w0 = it.w, h0 = it.h; it.w = Math.max(50, w0 - (r.l || 0) - (r.r || 0)); it.elev = it.elev + (r.b || 0); it.h = Math.max(50, h0 - (r.b || 0) - (r.t || 0)); const sh = ((r.l || 0) - (r.r || 0)) / 2;
    const a = (it.rot || 0) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), sg = Math.sign(dx * ux + dy * uy) || 1; it.x = Math.round(it.x + ux * sh * sg); it.y = Math.round(it.y + uy * sh * sg); } }; }
function opDesign(o) {
  let el = $('#opPanel'); if (!el) { el = document.createElement('div'); el.id = 'opPanel'; el.className = 'depanel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '배식구 · 창 디자인 수정'); $('#stage').appendChild(el); }
  const glassy = ['window', 'full', 'auto', 'slidepass'].includes(o.type), w = wallOf(o.wall), H = w ? wallH(w) : P.ceilingH, sheets = P.items.filter((i) => i.win === o.id);
  const fr = o.frost || { on: false, b: o.sill, t: o.sill + Math.round(o.h / 2), a: .82, l: 0, r: 0 }, sr = (sheets[0] && sheets[0].sr) || { b: 0, t: 0, l: 0, r: 0 };
  const rng = (id, lbl, min, max, v, st = 10) => `<label class="fld"><span>${lbl} <b id="${id}V">${v}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${st}" value="${v}"></label>`;
  el.hidden = false; el.innerHTML = `<div class="dehd"><b>디자인 수정 · ${esc(OPENTYPES[o.type] || o.type)}</b><button class="btn" id="opDone">완료</button></div>
  <div class="lbl">${o.type === 'pass' || o.type === 'slidepass' ? '뚫린 구멍' : '크기 · 높이'}</div>
  ${rng('opW', '폭 mm', 300, Math.max(600, Math.round((w ? Math.hypot(w.x2 - w.x1, w.y2 - w.y1) : 6000) - 100)), o.w)}
  ${rng('opH', (o.type === 'pass' || o.type === 'slidepass' ? '구멍 높이' : '높이') + ' mm', 200, H, o.h)}
  ${rng('opS', '바닥에서 높이 mm', 0, Math.max(0, H - 200), o.sill)}
  ${glassy ? `<div class="lbl">반투명 (간유리) 범위</div><label class="chk"><input type="checkbox" id="frOn" ${fr.on ? 'checked' : ''}> 일부를 반투명으로</label>
    ${rng('frB', '아래 끝 (바닥에서) mm', 0, H, fr.b ?? o.sill)}${rng('frT', '위 끝 (바닥에서) mm', 0, H, fr.t ?? o.sill + o.h)}${rng('frL', '왼쪽 비움 mm', 0, o.w, fr.l || 0)}${rng('frR', '오른쪽 비움 mm', 0, o.w, fr.r || 0)}
    <label class="fld"><span>반투명 정도 <b id="frAV">${Math.round((fr.a ?? .82) * 100)}%</b></span><input type="range" id="frA" min="0.3" max="0.97" step="0.01" value="${fr.a ?? .82}"></label>` : ''}
  ${glassy || o.type === 'door1' || o.type === 'door2' ? `<div class="lbl">시트지 적용 범위</div>${sheets.length ? `${rng('srB', '아래 비움 mm', 0, o.h, sr.b || 0)}${rng('srT', '위 비움 mm', 0, o.h, sr.t || 0)}${rng('srL', '왼쪽 비움 mm', 0, o.w, sr.l || 0)}${rng('srR', '오른쪽 비움 mm', 0, o.w, sr.r || 0)}` : '<div class="row"><button class="btn" id="srAdd">시트지 붙이기</button></div>'}` : ''}`;
  const live = () => { syncFacade(); dirty3d = true; draw2d(); }, done = () => { commit(); dirty3d = true; };
  const bind = (id, fn, fmt = (v) => v) => { const i = $('#' + id); if (!i) return; i.oninput = () => { $('#' + id + 'V').textContent = fmt(+i.value); fn(+i.value); live(); }; i.onchange = done; };
  bind('opW', (v) => (o.w = v)); bind('opH', (v) => (o.h = v)); bind('opS', (v) => (o.sill = v));
  const F = () => (o.frost = o.frost || { ...fr });
  if ($('#frOn')) $('#frOn').onchange = (e) => { F().on = e.target.checked; live(); done(); };
  bind('frB', (v) => (F().b = v)); bind('frT', (v) => (F().t = v)); bind('frL', (v) => (F().l = v)); bind('frR', (v) => (F().r = v)); bind('frA', (v) => (F().a = v), (v) => Math.round(v * 100) + '%');
  const SR = (k, v) => sheets.forEach((s) => { s.sr = { ...(s.sr || {}), [k]: v }; }); bind('srB', (v) => SR('b', v)); bind('srT', (v) => SR('t', v)); bind('srL', (v) => SR('l', v)); bind('srR', (v) => SR('r', v));
  if ($('#srAdd')) $('#srAdd').onclick = () => { P.items.push({ id: uid('i'), pz: 'sheet', type: 'winsheet', win: o.id, x: 0, y: 0, w: o.w, d: 12, rot: 0, tag: '윈도우 시트' }); syncFacade(); commit(); dirty3d = true; opDesign(o); };
  $('#opDone').onclick = () => { el.hidden = true; };
  if (view === '2d') setView('split');
}

/* ---------- 4. 벽 이어붙이기 ---------- */
function joinWalls(a, b) {
  if (!a || !b || a === b) return; const L = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1), da = [(a.x2 - a.x1) / L(a), (a.y2 - a.y1) / L(a)], db = [(b.x2 - b.x1) / L(b), (b.y2 - b.y1) / L(b)];
  const ends = (w) => [[w.x1, w.y1, 1], [w.x2, w.y2, 2]], near = (() => { let best = null; for (const p of ends(a)) for (const q of ends(b)) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (!best || d < best.d) best = { d, p, q }; } return best; })();
  const cross = da[0] * db[1] - da[1] * db[0], ta = wallT(a), tb = wallT(b);
  const setEnd = (w, k, x, y) => { // 시작점을 옮기면 문 · 창 위치도 같이
    x = Math.round(x); y = Math.round(y);
    if (k === 1) { const ux = (w.x2 - w.x1) / L(w), uy = (w.y2 - w.y1) / L(w), sh = (w.x1 - x) * ux + (w.y1 - y) * uy; for (const o of P.openings) if (o.wall === w.id) o.t = Math.round(o.t + sh); w.x1 = x; w.y1 = y; } else { w.x2 = x; w.y2 = y; } };
  if (Math.abs(cross) < 0.05) { // 나란함
    const off = Math.abs((b.x1 - a.x1) * da[1] - (b.y1 - a.y1) * da[0]);
    if (off <= Math.max(ta, tb) * 0.75) { // 한 줄 → 한 벽으로 합치기
      if (near.d > 1000) { toast('두 벽이 1m 넘게 떨어져 있어요'); return; }
      const pts = [[a.x1, a.y1], [a.x2, a.y2], [b.x1, b.y1], [b.x2, b.y2]], pr = (p) => (p[0] - a.x1) * da[0] + (p[1] - a.y1) * da[1], tt = pts.map(pr), lo = Math.min(...tt), hi = Math.max(...tt);
      const sA = pr([a.x1, a.y1]), sB = (o) => pr([b.x1, b.y1]) + (pr([b.x2, b.y2]) > pr([b.x1, b.y1]) ? 1 : -1) * o.t;
      for (const o of P.openings) { if (o.wall === a.id) o.t = Math.round(sA + o.t - lo); else if (o.wall === b.id) { o.t = Math.round(sB(o) - lo); o.wall = a.id; } }
      a.x1 = Math.round(a.x1 + da[0] * (lo - 0)); a.y1 = Math.round(a.y1 + da[1] * (lo - 0)); const x2 = a.x1 + da[0] * (hi - lo), y2 = a.y1 + da[1] * (hi - lo); a.x2 = Math.round(x2); a.y2 = Math.round(y2);
      P.walls = P.walls.filter((w) => w !== b); sel = { kind: 'wall', id: a.id }; multi = []; commit(); dirty3d = true; draw2d(); toast('한 벽으로 합쳤어요'); return;
    }
    if (near.d > 1000) { toast('두 벽이 1m 넘게 떨어져 있어요'); return; }
    // 나란히 어긋난 두 벽 → 끝을 잇는 벽 하나
    { const ka = near.p[2], out = ka === 2 ? da : [-da[0], -da[1]], dq = [near.q[0] - near.p[0], near.q[1] - near.p[1]], so = dq[0] * out[0] + dq[1] * out[1]; let p0 = [near.p[0], near.p[1]];
      if (so > 0) { p0 = [near.p[0] + out[0] * so, near.p[1] + out[1] * so]; setEnd(a, ka, p0[0], p0[1]); } // a 끝을 늘려 b 끝과 맞추고 직각으로 잇기
      const q0 = so > 0 ? [near.q[0], near.q[1]] : [near.p[0] + dq[0] - out[0] * so, near.p[1] + dq[1] - out[1] * so];
      P.walls.push({ id: uid('w'), x1: Math.round(p0[0]), y1: Math.round(p0[1]), x2: Math.round(q0[0]), y2: Math.round(q0[1]), finish: a.finish ? JSON.parse(JSON.stringify(a.finish)) : undefined, t: a.t, h: a.h }); }
    multi = []; commit(); dirty3d = true; draw2d(); toast('어긋난 두 벽 사이를 잇는 벽을 넣었어요'); return;
  }
  // 두 직선이 만나는 점
  const t1 = ((b.x1 - a.x1) * db[1] - (b.y1 - a.y1) * db[0]) / cross, X = [a.x1 + da[0] * t1, a.y1 + da[1] * t1];
  const endOf = (w, P0) => (Math.hypot(w.x1 - P0[0], w.y1 - P0[1]) <= Math.hypot(w.x2 - P0[0], w.y2 - P0[1]) ? 1 : 2);
  const ka = endOf(a, X), kb = endOf(b, X), ea = ka === 1 ? [a.x1, a.y1] : [a.x2, a.y2], eb = kb === 1 ? [b.x1, b.y1] : [b.x2, b.y2], dA = Math.hypot(ea[0] - X[0], ea[1] - X[1]), dB = Math.hypot(eb[0] - X[0], eb[1] - X[1]);
  const along = (w, d, P0) => (P0[0] - w.x1) * d[0] + (P0[1] - w.y1) * d[1], inA = along(a, da, X), inB = along(b, db, X);
  const insideA = inA > ta && inA < L(a) - ta, insideB = inB > tb && inB < L(b) - tb;
  if (insideB && !insideA) { if (dA > 1000) { toast('두 벽이 1m 넘게 떨어져 있어요'); return; } // T자: a 끝을 b 면에 붙이기
    const s = ka === 1 ? -1 : 1, back = tb / 2 / Math.abs(Math.sin(Math.asin(Math.min(1, Math.abs(cross))))); setEnd(a, ka, X[0] - da[0] * s * back, X[1] - da[1] * s * back); }
  else if (insideA && !insideB) { if (dB > 1000) { toast('두 벽이 1m 넘게 떨어져 있어요'); return; } const s = kb === 1 ? -1 : 1, back = ta / 2 / Math.abs(cross); setEnd(b, kb, X[0] - db[0] * s * back, X[1] - db[1] * s * back); }
  else { if (Math.max(dA, dB) > 1000) { toast('두 벽이 1m 넘게 떨어져 있어요'); return; } setEnd(a, ka, X[0], X[1]); setEnd(b, kb, X[0], X[1]); } // ㄱ자: 두 끝을 한 점에
  sel = { kind: 'wall', id: a.id }; multi = []; commit(); dirty3d = true; draw2d(); toast('두 벽을 이어붙였어요');
}

/* ---------- 5. STL 가져오기 ---------- */
function parseStl(buf) {
  const u8 = new Uint8Array(buf), head = new TextDecoder().decode(u8.slice(0, 256)), dv = new DataView(buf), tris = [], cols = [];
  const nb = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (nb && 84 + nb * 50 === buf.byteLength) { for (let i = 0; i < nb; i++) { const o = 84 + i * 50 + 12, t = []; for (let k = 0; k < 3; k++) t.push([dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 8, true), dv.getFloat32(o + k * 12 + 4, true)]); tris.push(t); cols.push('#b8bcc2'); } }
  else if (/^\s*solid/.test(head)) { const txt = new TextDecoder().decode(u8), vs = [...txt.matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g)].map((m) => [+m[1], +m[3], +m[2]]); for (let i = 0; i + 2 < vs.length; i += 3) { tris.push([vs[i], vs[i + 1], vs[i + 2]]); cols.push('#b8bcc2'); } }
  if (!tris.length) throw new Error('STL 안에서 삼각형을 찾지 못했어요');
  return { tris, cols };
}
{ const _ml = modelLoad; modelLoad = async function (files) {
  const fs = [...files], stl = fs.find((f) => /\.stl$/i.test(f.name)); if (!stl) return _ml(files);
  try { const raw = parseStl(await stl.arrayBuffer()), all = raw.tris.flat(), span = Math.max(...[0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])) - Math.min(...all.map((p) => p[k]))));
    MODEL = { raw, name: stl.name.replace(/\.stl$/i, ''), glb: false, span }; $('#mdUnit').value = span < 30 ? '1000' : span < 400 ? '10' : '1'; $('#mdName').value = MODEL.name; modelPrev();
  } catch (e) { console.error(e); $('#mdInfo').textContent = '읽지 못했어요: ' + e.message; } }; }
{ const f = $('#mdFile'); if (f) f.setAttribute('accept', '.glb,.obj,.mtl,.stl'); const lb = f && f.closest('label'); if (lb && lb.firstChild && lb.firstChild.nodeType === 3) lb.firstChild.nodeValue = '파일 고르기 (GLB · OBJ · MTL · STL)'; }

/* ---------- 6. 기본 기물 확장 · 새 모양 ---------- */
var SH3 = {};
{ const _bi = buildItem; buildItem = function (it) {
  const s = spec(it), f = SH3[s.L.shape]; if (!f || (!PCAP && partsOf(it))) return _bi(it);
  const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), w = it.w, d = it.d, h = s.h, hw = w / 2, hd = d / 2, col = s.color, mk = MATS[s.mat].tex, ma = MATS[s.mat].a;
  const B = (x0, x1, y0, y1, z0, z1, c, k, a) => box(T, x0, x1, e + y0, e + y1, z0, z1, c || col, k || mk, a ?? (c ? undefined : ma));
  const C = (x, z, r, y0, y1, c, k, n = 14, a) => cyl(T, x, z, r, e + y0, e + y1, c || col, k || mk, n, a ?? (c ? undefined : ma));
  try { f({ B, C, w, d, h, hw, hd, col, v: s.L.v || it.v || '', it }); } catch (er) { console.warn('shape', s.L.shape, er); B(-hw, hw, 0, h, -hd, hd); }
}; }
const DKG = '#2b2d31', MET = '#9aa1a9', GLS2 = '#a9d6ec';
Object.assign(SH3, {
  cab({ B, w, h, hw, hd, v }) { const kick = h > 1200 || v === 'wall' ? 0 : 90, n = +v || Math.max(1, Math.round(w / 450)); if (kick) B(-hw + 20, hw - 20, 0, kick, -hd, hd - 50, DKG);
    B(-hw, hw, kick, h - (v === 'wall' || h > 1200 ? 0 : 25), -hd, hd - 20); if (!(v === 'wall' || h > 1200)) B(-hw, hw, h - 25, h, -hd, hd);
    if (v !== 'open') for (let i = 0; i < n; i++) { const x0 = -hw + w * i / n + 3, x1 = -hw + w * (i + 1) / n - 3; B(x0, x1, kick + 5, h - 30, hd - 20, hd - 2); const hx = i % 2 ? x0 + 40 : x1 - 50; B(hx, hx + 12, h - 260, h - 120, hd - 2, hd + 18, MET, 'steel'); }
    else for (let y = kick + 300; y < h - 60; y += 330) B(-hw + 20, hw - 20, y, y + 20, -hd + 20, hd - 20); },
  drawer({ B, h, hw, hd, v }) { const n = +v || Math.max(2, Math.round(h / 220)), k = 60; B(-hw, hw, 0, k, -hd, hd - 30, DKG); B(-hw, hw, k, h, -hd, hd - 20);
    for (let i = 0; i < n; i++) { const y0 = k + (h - k) * i / n + 4, y1 = k + (h - k) * (i + 1) / n - 4; B(-hw + 4, hw - 4, y0, y1, hd - 20, hd - 2); B(-60, 60, (y0 + y1) / 2 - 8, (y0 + y1) / 2 + 8, hd - 2, hd + 16, MET, 'steel'); } },
  bookcase({ B, h, hw, hd, v }) { const t = 22, n = +v || Math.max(3, Math.round(h / 350)); B(-hw, -hw + t, 0, h, -hd, hd); B(hw - t, hw, 0, h, -hd, hd); B(-hw, hw, 0, 60, -hd, hd); B(-hw, hw, h - t, h, -hd, hd); B(-hw + t, hw - t, 60, h - t, -hd, -hd + 8);
    for (let i = 1; i < n; i++) { const y = 60 + (h - 60) * i / n; B(-hw + t, hw - t, y - 10, y + 10, -hd + 8, hd); }
    const cols = ['#7a4b3a', '#3e5c76', '#c2a14d', '#5f7a52', '#8a3a50']; for (let i = 0; i < n; i++) { const y = 60 + (h - 60) * i / n + 10, top = 60 + (h - 60) * (i + 1) / n - 10; let x = -hw + t + 10, k = i; while (x < hw - t - 80 && (i + k) % 4 !== 3) { const bw = 25 + ((k * 7) % 4) * 8; B(x, x + bw, y, y + Math.min(top - y - 20, 230 + (k % 3) * 25), -hd + 20, hd - 40, cols[k % 5], 'plain'); x += bw + 2; k++; if (x > -hw + t + (hw * 2 - 2 * t) * .7) break; } } },
  urinal({ B, C, h, hw, hd }) { B(-hw + 30, hw - 30, 0, h, -hd, -hd + 40); C(0, -hd + hw, hw, h * .12, h * .85, null, null, 18); C(0, -hd + hw, hw * .78, h * .2, h * .86, '#dfe3e6', 'plain', 18); C(0, -hd + 30, 14, h, h + 320, MET, 'steel', 8); C(0, -hd + 40, 30, h + 280, h + 330, MET, 'steel', 10); },
  faucet({ B, C, h, hw, hd, v }) { B(-hw, hw, 0, h, -hd, -hd + 12, '#c9ced4', 'steel'); if (v !== 'shower') { B(-14, 14, h * .45, h * .62, -hd + 12, hd, MET, 'steel'); C(-hw * .5, -hd + 40, 22, h * .65, h * .8, MET, 'steel', 10); C(hw * .5, -hd + 40, 22, h * .65, h * .8, MET, 'steel', 10); }
    else { C(0, -hd + 30, 14, 0, h, MET, 'steel', 8); B(-14, 14, h - 30, h - 10, -hd + 12, -hd + 260, MET, 'steel'); C(0, -hd + 280, 110, h - 40, h - 20, MET, 'steel', 18); C(-hw * .5, -hd + 40, 26, h * .35, h * .45, MET, 'steel', 10); } },
  armchair({ B, h, hw, hd, v }) { const sh = v === 'lounge' ? 380 : 420; for (const x of [-hw + 30, hw - 60]) for (const z of [-hd + 30, hd - 60]) B(x, x + 30, 0, 120, z, z + 30, DKG);
    B(-hw, hw, 120, sh, -hd, hd); B(-hw, hw, sh, h, hd - 160, hd); B(-hw, -hw + 120, sh, sh + 220, -hd, hd); B(hw - 120, hw, sh, sh + 220, -hd, hd); },
  ochair({ B, C, h, hw, hd }) { B(-hw, hw, 40, 70, -25, 25, DKG); B(-25, 25, 40, 70, -hd, hd, DKG); for (const [x, z] of [[-hw, 0], [hw, 0], [0, -hd], [0, hd]]) C(x * .92, z * .92, 25, 0, 45, DKG, 'plain', 8);
    C(0, 0, 28, 70, 430, MET, 'steel', 10); B(-hw + 30, hw - 30, 430, 500, -hd + 40, hd - 60); B(-hw + 50, hw - 50, 560, h, hd - 70, hd - 30); B(-30, 30, 480, 600, hd - 60, hd - 40, DKG);
    B(-hw + 20, -hw + 50, 500, 650, -hd + 80, hd - 120, DKG); B(hw - 50, hw - 20, 500, 650, -hd + 80, hd - 120, DKG); },
  sofal({ B, w, d, h, hw, hd, v }) { const dp = 900, r = v === 'r'; B(-hw, hw, 0, 100, hd - dp, hd, DKG); B(-hw, hw, 100, 430, hd - dp, hd); B(-hw, hw, 430, h, hd - 180, hd);
    const x0 = r ? hw - dp : -hw, x1 = r ? hw : -hw + dp; B(x0, x1, 0, 100, -hd, hd - dp, DKG); B(x0, x1, 100, 430, -hd, hd - dp); B(r ? hw - 150 : -hw, r ? hw : -hw + 150, 430, 620, -hd, hd - 180); B(r ? -hw : hw - 150, r ? -hw + 150 : hw, 430, 620, hd - dp, hd - 180); },
  appl({ B, C, w, h, hw, hd, v, col }) { const dark = '#22262b';
    if (v === 'tv') { B(-hw, hw, h * .12, h, -hd + 10, -hd + 45, dark); B(-hw + 12, hw - 12, h * .12 + 12, h - 12, -hd + 45, -hd + 47, '#14171b', 'plain'); B(-60, 60, 0, h * .12 + 20, -hd + 10, -hd + 40, dark); B(-hw * .4, hw * .4, 0, 15, -hd, hd, dark); return; }
    if (v === 'walltv') { B(-hw, hw, 0, h, -hd, hd, dark); B(-hw + 12, hw - 12, 12, h - 12, hd, hd + 2, '#14171b', 'plain'); return; }
    if (v === 'rice' || v === 'pot') { C(0, 0, Math.min(hw, hd), 0, h * .85); C(0, 0, Math.min(hw, hd) * .9, h * .85, h, v === 'pot' ? MET : '#3b3f45', 'steel'); return; }
    if (v === 'fan') { C(0, 0, Math.min(hw, hd) * .7, 0, 30, dark, 'plain', 14); C(0, 0, 15, 30, h * .75, MET, 'steel', 8); B(-hw, hw, h * .6, h, -15, 15, '#e8eaee', 'plastic'); return; }
    if (v === 'cook') { B(-hw, hw, 0, h, -hd, hd); B(-hw, hw, h, h + 8, -hd, hd, '#14171b', 'plain'); for (const [x, z] of [[-.5, -.4], [.5, -.4], [-.5, .4], [.5, .4]]) C(x * hw, z * hd, Math.min(hw, hd) * .32, h + 8, h + 10, '#3a3e44', 'plain', 16); return; }
    B(-hw, hw, 0, h, -hd, hd);
    if (v === 'dw' || v === 'oven' || v === 'micro' || v === 'combi') { B(-hw + 10, hw - 10, h - 90, h - 15, hd, hd + 4, dark); if (v !== 'dw') B(-hw + 30, hw - (v === 'micro' ? 180 : 30), 40, h - 110, hd, hd + 6, '#2f3a44', 'plain', .7); B(-hw + 50, hw - 50, h - 130, h - 108, hd, hd + 30, MET, 'steel'); return; }
    if (v === 'washer' || v === 'dryer') { B(-hw + 20, hw - 20, h - 110, h - 20, hd, hd + 4, '#dfe3e8'); B(-hw * .6, hw * .6, h * .18, h * .18 + w * .6, hd, hd + 25, v === 'dryer' ? '#c9ced4' : '#8fb8cc', 'plain', .8); return; }
    if (v === 'stand' || v === 'purifier') { for (let y = h * .55; y < h - 60; y += 40) B(-hw + 30, hw - 30, y, y + 15, hd, hd + 6, '#c9ced4'); B(-hw + 40, hw - 40, h * .25, h * .35, hd, hd + 4, dark); return; }
    if (v === 'coffee') { B(-hw + 40, hw - 40, h * .25, h * .32, hd, hd + 120, MET, 'steel'); C(-hw * .4, hd + 60, 35, h * .4, h * .55, dark, 'plain', 10); C(hw * .4, hd + 60, 35, h * .4, h * .55, dark, 'plain', 10); B(-hw + 20, hw - 20, h - 80, h - 20, hd, hd + 4, dark); return; }
    if (v === 'fridge2') { B(-1, 1, 10, h - 10, hd, hd + 4, dark); B(-60, -40, h * .4, h * .7, hd + 4, hd + 30, MET, 'steel'); B(40, 60, h * .4, h * .7, hd + 4, hd + 30, MET, 'steel'); return; }
    B(-hw + 20, hw - 20, h * .1, h * .9, hd, hd + 8, '#dfe3e8'); },
  prack({ B, w, h, hw, hd, v }) { const up = '#2f5c9e', bm = '#e2702a', bays = Math.max(1, Math.round(w / 2700)), lv = +v || Math.max(2, Math.round(h / 1500));
    for (let i = 0; i <= bays; i++) { const x = -hw + w * i / bays - (i === bays ? 80 : 0); for (const z of [-hd, hd - 80]) B(x, x + 80, 0, h, z, z + 80, up, 'steel'); B(x + 20, x + 60, 300, h - 100, -hd + 80, hd - 80, up, 'steel'); }
    for (let k = 1; k <= lv; k++) { const y = Math.min(h - 120, 150 + (h - 150) * (k - 1) / lv); for (const z of [-hd, hd - 60]) B(-hw, hw, y, y + 120, z, z + 60, bm, 'steel');
      for (let i = 0; i < bays; i++) for (let j = 0; j < 2; j++) { const x0 = -hw + w * i / bays + 120 + j * ((w / bays - 240) / 2), x1 = x0 + (w / bays - 300) / 2; B(x0, x1, y + 120, y + 260, -hd + 40, hd - 40, '#c09a63', 'wood'); if ((i + j + k) % 3) B(x0 + 30, x1 - 30, y + 260, y + Math.min(900, (h - 150) / lv - 120), -hd + 80, hd - 80, '#c8b08a', 'plain'); } } },
  conveyor({ B, C, w, h, hw, hd }) { for (let x = -hw + 40; x <= hw - 80; x += Math.max(600, (w - 120) / Math.ceil(w / 1500))) for (const z of [-hd + 20, hd - 60]) B(x, x + 40, 0, h - 120, z, z + 40, MET, 'steel');
    B(-hw, hw, h - 140, h - 30, -hd, -hd + 30, '#c9ced4', 'steel'); B(-hw, hw, h - 140, h - 30, hd - 30, hd, '#c9ced4', 'steel'); B(-hw, hw, h - 60, h - 40, -hd + 30, hd - 30, '#2a2c30', 'plain'); B(-hw, hw, h - 30, h, -hd, -hd + 30, '#c9ced4', 'steel'); B(-hw, hw, h - 30, h, hd - 30, hd, '#c9ced4', 'steel'); },
  machine({ B, h, hw, hd, v, col }) { B(-hw, hw, 0, 100, -hd, hd, DKG); B(-hw, hw, 100, h, -hd, hd); B(-hw * .6, hw * .4, h * .35, h * .75, hd, hd + 6, '#2f3a44', 'plain', .7); B(hw * .55, hw - 40, h * .45, h * .8, hd, hd + 60, '#3a3e44'); B(hw * .6, hw - 60, h * .7, h * .76, hd + 60, hd + 64, '#59c27a', 'plain'); B(hw * .6, hw * .7, h * .6, h * .65, hd + 60, hd + 70, '#d84a3a', 'plain');
    if (v === 'stripe') for (let x = -hw; x < hw - 100; x += 200) B(x, x + 100, 100, 160, hd, hd + 3, '#f2c230', 'plain'); },
  mixer({ B, C, h, hw, hd }) { B(-hw, hw, 0, h * .45, -hd, hd); B(-hw * .5, hw * .5, h * .45, h, -hd, -hd + hd * .7); B(-hw * .5, hw * .5, h * .8, h, -hd, hd * .4); C(0, hd * .25, Math.min(hw, hd) * .6, h * .45, h * .75, '#c9ced4', 'steel', 18); C(0, hd * .25, 18, h * .55, h * .8, MET, 'steel', 8); },
  locker({ B, w, h, hw, hd, v }) { const n = +v || Math.max(1, Math.round(w / 300)), rows = h > 1500 ? (w / n < 350 ? 2 : 1) : 1; B(-hw, hw, 0, 80, -hd, hd - 20, DKG); B(-hw, hw, 80, h, -hd, hd - 15);
    for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++) { const x0 = -hw + w * i / n + 4, x1 = -hw + w * (i + 1) / n - 4, y0 = 84 + (h - 84) * r / rows, y1 = 80 + (h - 80) * (r + 1) / rows - 4; B(x0, x1, y0, y1, hd - 15, hd - 2); for (let k = 0; k < 3; k++) B(x0 + 30, x1 - 30, y1 - 90 - k * 30, y1 - 80 - k * 30, hd - 2, hd, '#5a5f66', 'plain'); B(x1 - 50, x1 - 30, (y0 + y1) / 2 - 40, (y0 + y1) / 2 + 40, hd - 2, hd + 15, MET, 'steel'); } },
  cart({ B, C, h, hw, hd, v }) { const n = +v || 3; for (const x of [-hw + 10, hw - 40]) for (const z of [-hd + 10, hd - 40]) { B(x, x + 30, 120, h, z, z + 30, MET, 'steel'); C(x + 15, z + 15, 55, 0, 110, DKG, 'plain', 10); }
    for (let i = 0; i < n; i++) { const y = 160 + (h - 220) * i / Math.max(1, n - 1); B(-hw, hw, y, y + 30, -hd, hd); B(-hw, hw, y + 30, y + 70, -hd, -hd + 10); B(-hw, hw, y + 30, y + 70, hd - 10, hd); }
    if (v !== 'flat') B(hw - 20, hw + 60, h - 30, h, -hd + 60, hd - 60, MET, 'steel'); },
  vanity({ B, C, w, h, hw, hd, v }) { const top = Math.min(h, 860); if (v !== 'wall') B(-hw, hw, 0, 120, -hd, hd - 40, DKG); B(-hw, hw, v === 'wall' ? top - 450 : 120, top - 30, -hd, hd - 15, null);
    B(-hw + 5, hw - 5, (v === 'wall' ? top - 445 : 125), top - 35, hd - 15, hd - 2, null); B(-hw, hw, top - 30, top, -hd, hd, '#f4f2ee', 'marble'); C(0, 0, Math.min(hw * .45, 220), top - 20, top + 10, '#ffffff', 'plastic', 18); C(0, -hd + 60, 15, top, top + 220, MET, 'steel', 8);
    if (h > top + 200) B(-hw + 40, hw - 40, top + 250, h, -hd, -hd + 20, '#cfe3ee', 'plain', .75); },
  lamp({ B, C, h, hw, hd, v }) { const r = Math.min(hw, hd); C(0, 0, r * .6, 0, 25, DKG, 'plain', 14); C(0, 0, 12, 25, h - r * 1.1, MET, 'steel', 8); C(0, 0, r, h - r * 1.1, h, v === 'paper' ? '#f4ecdc' : '#efe7d6', 'plain', 18, .9); C(0, 0, r * .55, h - r * 1.1 - 2, h - r * 1.1, '#fff6d8', 'plain', 12); },
  bunk({ B, w, h, hw, hd }) { for (const x of [-hw, hw - 60]) for (const z of [-hd, hd - 60]) B(x, x + 60, 0, h, z, z + 60); for (const y of [250, 1250]) { B(-hw, hw, y, y + 60, -hd, hd); B(-hw + 60, hw - 60, y + 60, y + 220, -hd + 60, hd - 60, '#f2efe8', 'plain'); }
    B(-hw, hw, h - 300, h - 260, -hd, -hd + 40); B(-hw, hw, h - 300, h - 260, hd - 40, hd); for (let y = 400; y < 1300; y += 280) B(hw - 400, hw - 80, y, y + 35, hd, hd + 40); },
  odesk({ B, h, hw, hd, v }) { B(-hw, hw, h - 30, h, -hd, hd); B(-hw, -hw + 30, 0, h - 30, -hd + 20, hd - 20, null); if (v === 'ped') { B(hw - 420, hw, 0, h - 30, -hd + 20, hd - 40); for (let i = 0; i < 3; i++) B(hw - 410, hw - 10, 30 + i * 230, 240 + i * 230, hd - 40, hd - 25, null); } else B(hw - 30, hw, 0, h - 30, -hd + 20, hd - 20, null); B(-hw + 30, hw - (v === 'ped' ? 420 : 30), h - 400, h - 30, -hd + 20, -hd + 38); },
  rbed({ B, w, h, hw, hd, v }) { B(-hw, hw, 0, 300, -hd, hd); B(-hw + 20, hw - 20, 300, h, -hd + 20, hd - 20, '#f2efe8', 'plain'); B(-hw, hw, 0, 1000, -hd, -hd + 70); for (let i = 0; i < Math.max(1, Math.round(w / 700)); i++) { const n = Math.max(1, Math.round(w / 700)), x0 = -hw + 60 + (w - 120) * i / n, x1 = -hw + 60 + (w - 120) * (i + 1) / n - 40; B(x0, x1, h, h + 120, -hd + 100, -hd + 450, '#ffffff', 'plain'); } },
  stall({ B, w, h, hw, hd }) { const t = 25; B(-hw, -hw + t, 120, h, -hd, hd); B(hw - t, hw, 120, h, -hd, hd); B(-hw + t, hw - t, 120, h, hd - t, hd, null); B(-hw + 80, hw - 80, h * .45, h * .5, hd, hd + 25, MET, 'steel'); for (const x of [-hw, hw - t]) B(x, x + t, 0, 120, hd - 60, hd, MET, 'steel'); },
  gbar({ B, C, w, h, hw, hd }) { C(-hw + 25, -hd + 40, 20, h - 20, h + 20, MET, 'steel', 8); C(hw - 25, -hd + 40, 20, h - 20, h + 20, MET, 'steel', 8); B(-hw + 25, hw - 25, h - 15, h + 15, -hd + 40, -hd + 70, MET, 'steel'); },
  hand({ B, C, h, hw, hd, v }) { B(-hw, hw, 0, h, -hd, hd); if (v === 'dryer') B(-hw + 20, hw - 20, 0, 30, -hd + 20, hd, '#3a3e44'); if (v === 'paper') B(-hw + 30, hw - 30, 20, 50, hd - 10, hd + 5, '#3a3e44'); if (v === 'soap') C(0, hd + 10, 10, -40, 0, MET, 'steel', 6); },
  extinguisher({ C, h, hw }) { C(0, 0, hw, 0, h * .82, '#d23c2e', 'gloss', 14); C(0, 0, hw * .5, h * .82, h * .9, DKG, 'plain', 10); C(hw * .3, 0, hw * .2, h * .9, h, DKG, 'plain', 6); },
});

// 기본 기물 목록 · [id, 이름, 소분류, 모양, 폭, 깊이, 높이, 색, 재질, {그 밖}]
{ const WDc = '#b48a62', OAK = '#c8a57a', WAL = '#6e4a35', WHT = '#f4f2ee', GRY = '#8f8a82', SS = '#c9ced4', BLK = '#2b2d31', POR = '#f7f7f7';
  const ADD = (cat, layer, rows) => rows.forEach(([id, name, sub, shape, w, d, h, color, mat, x]) => { if (LIB.some((l) => l.id === id)) return; LIB.push({ id, name, cat, sub, shape, w, d, h, layer, color, mat, ...(x || {}) }); });
  ADD('가구', 'floor', [
    ['f_sofa2', '2인 소파', '거실', 'sofa', 1600, 880, 800, GRY, 'paint'], ['f_sofa1', '1인 소파', '거실', 'armchair', 850, 850, 800, GRY, 'paint'], ['f_sofaL', 'ㄱ자 소파 (왼쪽)', '거실', 'sofal', 2600, 1700, 800, GRY, 'paint'], ['f_sofaLr', 'ㄱ자 소파 (오른쪽)', '거실', 'sofal', 2600, 1700, 800, GRY, 'paint', { v: 'r' }],
    ['f_lounge', '라운지 체어', '거실', 'armchair', 780, 820, 760, '#a36b4f', 'paint', { v: 'lounge' }], ['f_ctable', '거실 테이블', '거실', 'table', 1100, 600, 400, WDc, 'wood'], ['f_side', '사이드 테이블', '거실', 'stool', 450, 450, 550, WDc, 'wood'],
    ['f_tv18', 'TV장 1800', '거실', 'cab', 1800, 420, 450, WHT, 'paint', { v: '3' }], ['f_tv24', 'TV장 2400', '거실', 'cab', 2400, 420, 400, OAK, 'wood', { v: '4' }], ['f_tvwall', '거실 벽면 수납장', '거실', 'cab', 2400, 400, 2100, WHT, 'paint', { v: '4' }],
    ['f_disp', '장식장 (유리문)', '거실', 'bookcase', 900, 400, 1800, WAL, 'wood'], ['f_rug', '러그 2000×1400', '거실', 'cube', 2000, 1400, 10, '#cbbfa8', 'paint', { layer: 'deco' }],
    ['f_bedK', '킹 침대', '침실', 'bed', 1650, 2100, 450, WDc, 'wood'], ['f_bedSS', '슈퍼싱글 침대', '침실', 'bed', 1100, 2000, 450, WDc, 'wood'], ['f_bedD', '더블 침대', '침실', 'bed', 1400, 2000, 450, WDc, 'wood'],
    ['f_bunk', '2층 침대', '침실', 'bunk', 1100, 2050, 1700, OAK, 'wood'], ['f_ward12', '옷장 1200', '침실', 'cab', 1200, 600, 2100, WHT, 'paint', { v: '2' }], ['f_ward24', '옷장 2400', '침실', 'cab', 2400, 600, 2300, WHT, 'paint', { v: '4' }],
    ['f_chest4', '4단 서랍장', '침실', 'drawer', 800, 450, 900, WHT, 'paint', { v: '4' }], ['f_chest5', '5단 서랍장 (높은)', '침실', 'drawer', 600, 450, 1200, OAK, 'wood', { v: '5' }], ['f_night', '협탁', '침실', 'drawer', 450, 400, 500, OAK, 'wood', { v: '2' }],
    ['f_dresser', '화장대', '침실', 'odesk', 1000, 450, 750, WHT, 'paint'], ['f_mirror', '전신 거울', '침실', 'cube', 500, 40, 1700, '#cfe3ee', 'glass'], ['f_hanger', '행거', '침실', 'rack', 1200, 450, 1700, BLK, 'steel'],
    ['f_desk14', '책상 1400', '서재 · 사무', 'odesk', 1400, 700, 740, OAK, 'wood'], ['f_desk16p', '서랍 책상 1600', '서재 · 사무', 'odesk', 1600, 800, 740, WHT, 'paint', { v: 'ped' }], ['f_desk12', '컴퓨터 책상 1200', '서재 · 사무', 'odesk', 1200, 600, 740, BLK, 'paint'],
    ['f_lshape', 'ㄱ자 책상', '서재 · 사무', 'sofal', 1800, 1500, 740, WHT, 'paint'], ['f_mtable', '회의 테이블 6인', '서재 · 사무', 'table', 2400, 1200, 740, WHT, 'paint'], ['f_mtable10', '회의 테이블 10인', '서재 · 사무', 'table', 3600, 1400, 740, WAL, 'wood'],
    ['f_och', '사무용 의자', '서재 · 사무', 'ochair', 620, 620, 1050, BLK, 'paint'], ['f_och2', '중역 의자', '서재 · 사무', 'ochair', 680, 680, 1200, '#3a2a22', 'paint'], ['f_mch', '회의 의자', '서재 · 사무', 'chair', 520, 540, 850, BLK, 'plastic'],
    ['f_book8', '책장 800', '서재 · 사무', 'bookcase', 800, 300, 1800, WHT, 'paint'], ['f_book12', '책장 1200', '서재 · 사무', 'bookcase', 1200, 300, 2000, OAK, 'wood'], ['f_book4', '낮은 책장', '서재 · 사무', 'bookcase', 1200, 300, 800, WHT, 'paint', { v: '2' }],
    ['f_file', '서류 캐비닛 3단', '서재 · 사무', 'drawer', 450, 600, 1000, '#cfd3d8', 'steel', { v: '3' }], ['f_cabinet', '사무용 캐비닛', '서재 · 사무', 'cab', 900, 450, 1800, '#cfd3d8', 'steel', { v: '2' }], ['f_part', '사무실 파티션', '서재 · 사무', 'cube', 1200, 50, 1200, '#9aa3ad', 'paint'],
    ['f_reception', '안내 데스크', '서재 · 사무', 'counter', 1800, 700, 1100, WHT, 'paint'], ['f_locker', '개인 사물함', '서재 · 사무', 'locker', 900, 450, 1800, '#cfd3d8', 'steel', { v: '3' }],
    ['f_shoe', '신발장', '수납', 'cab', 1000, 380, 1200, WHT, 'paint', { v: '2' }], ['f_shoeT', '신발장 (키큰)', '수납', 'cab', 1000, 380, 2200, WHT, 'paint', { v: '2' }], ['f_bench', '현관 벤치', '수납', 'bench', 1000, 350, 450, OAK, 'wood'],
    ['f_storage', '수납장 900', '수납', 'cab', 900, 450, 900, WHT, 'paint', { v: '2' }], ['f_open', '오픈 수납장', '수납', 'cab', 1200, 400, 1800, OAK, 'wood', { v: 'open' }], ['f_wallcab', '벽 수납장 (상부)', '수납', 'cab', 900, 350, 700, WHT, 'paint', { v: 'wall', elev: 1500, layer: 'upper' }],
    ['f_steelsh', '앵글 선반', '수납', 'rack', 900, 450, 1800, '#9aa1a9', 'steel'], ['f_cube', '큐브 수납장 3×3', '수납', 'bookcase', 1100, 350, 1100, WHT, 'paint', { v: '3' }],
    ['f_kdesk', '어린이 책상', '어린이', 'odesk', 1000, 550, 600, '#f3e2b8', 'paint'], ['f_kchair', '어린이 의자', '어린이', 'chair', 350, 350, 600, '#e98b6b', 'plastic'], ['f_kbed', '어린이 침대', '어린이', 'bed', 900, 1700, 400, '#f3e2b8', 'paint'],
    ['f_toy', '장난감 수납장', '어린이', 'bookcase', 900, 300, 900, '#f3e2b8', 'paint', { v: '2' }], ['f_crib', '아기 침대', '어린이', 'cart', 700, 1250, 950, WHT, 'paint', { v: 'flat' }],
    ['f_dtable6', '식탁 6인', '식탁 · 의자', 'table', 1800, 900, 750, WAL, 'wood'], ['f_dtable2', '식탁 2인', '식탁 · 의자', 'table', 800, 700, 750, OAK, 'wood'], ['f_rtable', '원형 식탁', '식탁 · 의자', 'roundtable', 1100, 1100, 750, WHT, 'marble'],
    ['f_dchair', '식탁 의자 (원목)', '식탁 · 의자', 'chair', 450, 500, 850, OAK, 'wood'], ['f_dchair2', '패브릭 의자', '식탁 · 의자', 'armchair', 520, 560, 800, '#b9b0a2', 'paint'], ['f_bench2', '식탁 벤치', '식탁 · 의자', 'bench', 1400, 380, 450, OAK, 'wood'],
    ['f_stoolW', '원목 스툴', '식탁 · 의자', 'stool', 380, 380, 450, OAK, 'wood'], ['f_island', '아일랜드 식탁', '식탁 · 의자', 'counter', 1800, 900, 900, WHT, 'paint'],
  ]);
  ADD('욕실', 'floor', [
    ['b_urinal', '남성용 소변기', '위생도기', 'urinal', 380, 340, 650, POR, 'plastic', { elev: 450, drain: 1 }], ['b_urinalF', '남성용 소변기 (바닥형)', '위생도기', 'urinal', 420, 380, 1100, POR, 'plastic', { drain: 1 }],
    ['b_toiletW', '벽걸이 양변기', '위생도기', 'toilet', 380, 550, 400, POR, 'plastic', { elev: 0, drain: 1 }], ['b_toiletB', '비데 일체형 양변기', '위생도기', 'toilet', 420, 720, 560, POR, 'plastic', { drain: 1, kw: 0.6 }],
    ['b_toiletK', '유아용 변기', '위생도기', 'toilet', 320, 500, 500, POR, 'plastic', { drain: 1 }], ['b_squat', '화변기', '위생도기', 'cube', 450, 700, 20, POR, 'plastic', { drain: 1 }],
    ['b_basinW', '벽걸이 세면기', '위생도기', 'sink', 550, 430, 850, POR, 'plastic', { drain: 1 }], ['b_basin2', '이중 세면대', '위생도기', 'sink', 1300, 520, 850, POR, 'plastic', { drain: 1 }], ['b_slop', '청소용 싱크 (오수)', '위생도기', 'sink', 600, 500, 700, SS, 'steel', { drain: 1 }],
    ['b_vanity6', '세면대 하부장 600', '욕실 가구', 'vanity', 600, 480, 1800, WHT, 'paint', { drain: 1 }], ['b_vanity9', '세면대 하부장 900', '욕실 가구', 'vanity', 900, 500, 1900, OAK, 'wood', { drain: 1 }], ['b_vanityW', '벽걸이 세면장', '욕실 가구', 'vanity', 800, 460, 1800, WHT, 'paint', { v: 'wall', drain: 1 }],
    ['b_mirror', '욕실 거울', '욕실 가구', 'cube', 800, 25, 900, '#cfe3ee', 'glass', { elev: 1100, layer: 'upper' }], ['b_mcab', '거울 수납장', '욕실 가구', 'cab', 800, 150, 750, WHT, 'paint', { v: 'wall', elev: 1150, layer: 'upper' }], ['b_tall', '욕실 키큰장', '욕실 가구', 'cab', 400, 350, 1800, WHT, 'paint', { v: '1' }],
    ['b_stall', '화장실 칸막이 (1칸)', '공용 화장실', 'stall', 900, 1500, 2000, '#a9b4bf', 'paint'], ['b_stallW', '화장실 칸막이 (장애인)', '공용 화장실', 'stall', 1800, 2000, 2000, '#a9b4bf', 'paint'], ['b_urpart', '소변기 칸막이', '공용 화장실', 'cube', 30, 450, 900, '#a9b4bf', 'paint', { elev: 500 }],
    ['b_gbar', '안전 손잡이', '공용 화장실', 'gbar', 700, 100, 800, SS, 'steel', { layer: 'upper' }], ['b_handdry', '핸드 드라이어', '공용 화장실', 'hand', 300, 220, 650, WHT, 'plastic', { v: 'dryer', elev: 1000, layer: 'upper', kw: 1.2 }],
    ['b_paper', '페이퍼 타올함', '공용 화장실', 'hand', 300, 120, 400, WHT, 'plastic', { v: 'paper', elev: 1200, layer: 'upper' }], ['b_soap', '비누 디스펜서', '공용 화장실', 'hand', 120, 100, 200, WHT, 'plastic', { v: 'soap', elev: 1100, layer: 'upper' }], ['b_diaper', '기저귀 교환대', '공용 화장실', 'cube', 850, 500, 550, WHT, 'plastic', { elev: 300, layer: 'upper' }],
    ['b_fauW', '매립형 수전 (세면)', '수전 · 샤워', 'faucet', 180, 180, 120, SS, 'steel', { elev: 1000, layer: 'plumb' }], ['b_fauK', '매립형 수전 (주방)', '수전 · 샤워', 'faucet', 220, 250, 160, SS, 'steel', { elev: 1050, layer: 'plumb' }], ['b_fauT', '매립형 욕조 수전', '수전 · 샤워', 'faucet', 250, 200, 140, SS, 'steel', { elev: 650, layer: 'plumb' }],
    ['b_shower', '매립 샤워 (해바라기)', '수전 · 샤워', 'faucet', 300, 350, 2100, SS, 'steel', { v: 'shower', layer: 'plumb' }], ['b_showerB', '샤워 부스 (사각)', '수전 · 샤워', 'cube', 1000, 1000, 2000, '#cfe8f3', 'glass', { drain: 1 }], ['b_showerP', '샤워 파티션 (고정 유리)', '수전 · 샤워', 'cube', 1000, 10, 2000, '#cfe8f3', 'glass'],
    ['b_tub17', '욕조 1700', '수전 · 샤워', 'tub', 1700, 750, 560, POR, 'plastic', { drain: 1 }], ['b_tubF', '독립 욕조', '수전 · 샤워', 'tub', 1600, 800, 600, POR, 'gloss', { drain: 1 }], ['b_drain', '욕실 바닥 배수구', '수전 · 샤워', 'drainpt', 150, 150, 8, SS, 'steel', { drain: 1, layer: 'plumb' }],
    ['b_heater', '욕실 온풍기 (천장)', '수전 · 샤워', 'vent', 400, 400, 60, WHT, 'plastic', { elev: 2300, layer: 'ceil', kw: 2 }],
  ]);
  ADD('가전', 'floor', [
    ['e_dwB', '식기세척기 (빌트인)', '주방 가전', 'appl', 600, 580, 820, SS, 'steel', { v: 'dw', drain: 1, kw: 1.8 }], ['e_dwT', '식기세척기 (6인 카운터)', '주방 가전', 'appl', 550, 500, 450, WHT, 'plastic', { v: 'dw', drain: 1, kw: 1.3, elev: 900 }],
    ['e_fr4', '4도어 냉장고', '주방 가전', 'appl', 910, 930, 1850, SS, 'steel', { v: 'fridge2', kw: 0.5 }], ['e_frK', '김치냉장고 (스탠드)', '주방 가전', 'appl', 700, 800, 1850, '#e8e4dc', 'steel', { v: 'fridge2', kw: 0.3 }], ['e_frS', '소형 냉장고', '주방 가전', 'appl', 480, 500, 850, WHT, 'plastic', { kw: 0.1 }],
    ['e_wine', '와인 냉장고', '주방 가전', 'appl', 600, 580, 850, BLK, 'gloss', { v: 'oven', kw: 0.2 }], ['e_ind3', '인덕션 3구 (빌트인)', '주방 가전', 'appl', 590, 520, 60, BLK, 'gloss', { v: 'cook', elev: 840, kw: 7 }], ['e_gas', '가스레인지 3구', '주방 가전', 'appl', 600, 520, 100, BLK, 'gloss', { v: 'cook', elev: 840, gas: 1 }],
    ['e_ovenB', '빌트인 오븐', '주방 가전', 'appl', 595, 560, 595, BLK, 'gloss', { v: 'oven', kw: 3 }], ['e_micro', '전자레인지', '주방 가전', 'appl', 480, 380, 280, BLK, 'plastic', { v: 'micro', elev: 900, kw: 1.1 }], ['e_microB', '빌트인 전자레인지', '주방 가전', 'appl', 595, 400, 390, BLK, 'gloss', { v: 'micro', elev: 1400, kw: 1.1 }],
    ['e_hoodH', '주방 후드 (가정용)', '주방 가전', 'hood', 900, 500, 350, SS, 'steel', { elev: 1700, layer: 'upper', kw: 0.2 }], ['e_rice', '전기밥솥', '주방 가전', 'appl', 300, 400, 300, WHT, 'plastic', { v: 'rice', elev: 900, kw: 1.2 }], ['e_water', '정수기', '주방 가전', 'appl', 260, 450, 450, WHT, 'plastic', { v: 'coffee', elev: 900, kw: 0.1 }],
    ['e_coffee', '커피 머신 (가정용)', '주방 가전', 'appl', 300, 420, 380, BLK, 'steel', { v: 'coffee', elev: 900, kw: 1.4 }], ['e_air', '에어프라이어', '주방 가전', 'appl', 300, 350, 330, BLK, 'plastic', { v: 'rice', elev: 900, kw: 1.5 }], ['e_disp', '음식물 처리기', '주방 가전', 'appl', 300, 400, 450, WHT, 'plastic', { kw: 0.5 }],
    ['e_wash', '드럼 세탁기', '생활 가전', 'appl', 600, 650, 850, WHT, 'plastic', { v: 'washer', drain: 1, kw: 2 }], ['e_washT', '통돌이 세탁기', '생활 가전', 'appl', 650, 680, 1000, WHT, 'plastic', { drain: 1, kw: 0.5 }], ['e_dry', '건조기', '생활 가전', 'appl', 600, 650, 850, WHT, 'plastic', { v: 'dryer', kw: 2.5 }],
    ['e_stack', '세탁기 + 건조기 (직렬)', '생활 가전', 'appl', 600, 700, 1750, WHT, 'plastic', { v: 'washer', drain: 1, kw: 4.5 }], ['e_styler', '의류 관리기', '생활 가전', 'appl', 450, 600, 1850, '#8f8a82', 'gloss', { v: 'fridge2', kw: 1.5 }],
    ['e_acS', '스탠드 에어컨', '생활 가전', 'appl', 380, 330, 1850, WHT, 'plastic', { v: 'stand', kw: 2.2 }], ['e_acW', '벽걸이 에어컨', '생활 가전', 'acwall', 900, 250, 300, WHT, 'plastic', { elev: 2100, layer: 'upper', kw: 0.8 }], ['e_purif', '공기청정기', '생활 가전', 'appl', 350, 350, 700, WHT, 'plastic', { v: 'purifier', kw: 0.05 }],
    ['e_dehum', '제습기', '생활 가전', 'appl', 380, 300, 650, WHT, 'plastic', { v: 'purifier', kw: 0.4 }], ['e_fan', '선풍기', '생활 가전', 'appl', 400, 400, 1100, WHT, 'plastic', { v: 'fan', kw: 0.05 }], ['e_heater', '전기 난로', '생활 가전', 'appl', 400, 250, 600, '#c9ced4', 'plastic', { v: 'purifier', kw: 1.5 }],
    ['e_vac', '로봇청소기 스테이션', '생활 가전', 'appl', 350, 400, 450, WHT, 'plastic', { v: 'purifier', kw: 0.1 }], ['e_boiler', '가스 보일러', '생활 가전', 'appl', 440, 300, 700, WHT, 'plastic', { elev: 1200, layer: 'upper', gas: 1, kw: 0.15 }], ['e_whtr', '전기 온수기 50L', '생활 가전', 'tank', 450, 450, 700, WHT, 'plastic', { elev: 1500, layer: 'upper', kw: 2 }],
    ['e_tv55', 'TV 55" (스탠드)', '영상 · 음향', 'appl', 1230, 260, 780, BLK, 'gloss', { v: 'tv', elev: 450, kw: 0.15 }], ['e_tv65', 'TV 65" (스탠드)', '영상 · 음향', 'appl', 1450, 290, 900, BLK, 'gloss', { v: 'tv', elev: 450, kw: 0.2 }], ['e_tv75w', 'TV 75" (벽걸이)', '영상 · 음향', 'appl', 1680, 40, 970, BLK, 'gloss', { v: 'walltv', elev: 900, layer: 'upper', kw: 0.25 }],
    ['e_mon', '모니터 27"', '영상 · 음향', 'appl', 620, 200, 480, BLK, 'plastic', { v: 'tv', elev: 740, kw: 0.04 }], ['e_pc', '데스크톱 PC', '영상 · 음향', 'appl', 200, 450, 450, BLK, 'plastic', { kw: 0.4 }], ['e_print', '복합기', '영상 · 음향', 'appl', 550, 550, 1100, '#e8eaee', 'plastic', { v: 'purifier', kw: 0.8 }],
    ['e_spk', '스탠드 스피커', '영상 · 음향', 'cube', 250, 300, 1000, BLK, 'paint', { kw: 0.1 }], ['e_sbar', '사운드바', '영상 · 음향', 'cube', 950, 110, 65, BLK, 'plastic', { elev: 460 }], ['e_proj', '빔 프로젝터 (천장)', '영상 · 음향', 'cube', 350, 300, 150, WHT, 'plastic', { elev: 2400, layer: 'ceil', kw: 0.3 }],
    ['e_screen', '전동 스크린 100"', '영상 · 음향', 'cube', 2400, 100, 100, WHT, 'paint', { elev: 2500, layer: 'ceil' }], ['e_kiosk', '키오스크', '영상 · 음향', 'appl', 500, 450, 1600, BLK, 'gloss', { v: 'walltv', kw: 0.2 }], ['e_pos', 'POS 단말기', '영상 · 음향', 'appl', 380, 300, 380, BLK, 'plastic', { v: 'tv', elev: 1000, kw: 0.05 }],
  ]);
  ADD('공장', 'floor', [
    ['m_prack', '파렛트 랙 2단', '랙 · 보관', 'prack', 2700, 1100, 3000, '#2f5c9e', 'steel', { v: '2' }], ['m_prack3', '파렛트 랙 3단', '랙 · 보관', 'prack', 2700, 1100, 4500, '#2f5c9e', 'steel', { v: '3' }], ['m_prack2b', '파렛트 랙 2연 3단', '랙 · 보관', 'prack', 5400, 1100, 4500, '#2f5c9e', 'steel', { v: '3' }],
    ['m_lrack', '경량 랙 (앵글)', '랙 · 보관', 'rack', 1500, 600, 2100, '#9aa1a9', 'steel'], ['m_mrack', '중량 랙', '랙 · 보관', 'rack', 1800, 900, 2400, '#2f5c9e', 'steel'], ['m_canti', '캔틸레버 랙', '랙 · 보관', 'rack', 2000, 1200, 3000, '#e2702a', 'steel'],
    ['m_pallet', '파렛트 (목재)', '랙 · 보관', 'cube', 1100, 1100, 150, '#c09a63', 'wood'], ['m_palletP', '파렛트 (플라스틱)', '랙 · 보관', 'cube', 1100, 1100, 150, '#3e6eb5', 'plastic'], ['m_box', '적재 박스', '랙 · 보관', 'cube', 600, 400, 300, '#c8b08a', 'paint'],
    ['m_crate', '플라스틱 상자 (적재)', '랙 · 보관', 'cube', 530, 360, 1200, '#3e6eb5', 'plastic'], ['m_drum', '드럼통 200L', '랙 · 보관', 'tank', 580, 580, 880, '#2f5c9e', 'steel'], ['m_ibc', 'IBC 탱크 1000L', '랙 · 보관', 'cube', 1200, 1000, 1160, '#e8eaee', 'plastic'],
    ['m_tankS', '스테인리스 저장 탱크', '랙 · 보관', 'tank', 1200, 1200, 2200, SS, 'steel'], ['m_cold', '조립식 냉동 창고', '랙 · 보관', 'cube', 3000, 2400, 2400, '#e8eaee', 'paint', { kw: 4 }], ['m_mlocker', '공구 캐비닛', '랙 · 보관', 'drawer', 900, 600, 1000, '#d23c2e', 'steel', { v: '6' }],
    ['m_bench', '작업대 (중량)', '생산 설비', 'work', 1800, 750, 850, '#3e5c76', 'steel'], ['m_benchW', '목재 작업대', '생산 설비', 'table', 1800, 800, 850, '#c09a63', 'wood'], ['m_conv3', '컨베이어 3m', '생산 설비', 'conveyor', 3000, 600, 850, SS, 'steel', { kw: 0.4 }],
    ['m_conv6', '컨베이어 6m', '생산 설비', 'conveyor', 6000, 800, 850, SS, 'steel', { kw: 0.75 }], ['m_cnc', 'CNC 가공기', '생산 설비', 'machine', 2200, 1800, 2200, '#e8eaee', 'paint', { v: 'stripe', kw: 15 }], ['m_lathe', '선반 (공작기계)', '생산 설비', 'machine', 2400, 1000, 1500, '#5f7a52', 'paint', { kw: 7.5 }],
    ['m_press', '프레스', '생산 설비', 'machine', 1400, 1400, 2600, '#2f5c9e', 'paint', { v: 'stripe', kw: 11 }], ['m_drill', '드릴 프레스', '생산 설비', 'machine', 600, 800, 1700, '#5f7a52', 'paint', { kw: 1.5 }], ['m_pack', '포장기', '생산 설비', 'machine', 1600, 1000, 1700, SS, 'steel', { kw: 3 }],
    ['m_seal', '실링기', '생산 설비', 'machine', 800, 600, 1300, SS, 'steel', { kw: 1.5 }], ['m_fill', '충진기', '생산 설비', 'machine', 1500, 900, 1900, SS, 'steel', { kw: 2.2 }], ['m_label', '라벨 부착기', '생산 설비', 'machine', 1200, 700, 1400, SS, 'steel', { kw: 1 }],
    ['m_mixer', '반죽기 (스파이럴)', '생산 설비', 'mixer', 700, 1100, 1350, '#e8eaee', 'paint', { kw: 4.5 }], ['m_mixer2', '대형 믹서', '생산 설비', 'mixer', 1100, 1500, 1800, SS, 'steel', { kw: 7.5 }], ['m_kettle', '스팀 회전솥', '생산 설비', 'tank', 1300, 1300, 1100, SS, 'steel', { kw: 3, drain: 1 }],
    ['m_tumbler', '진공 텀블러 (염지기)', '생산 설비', 'tank', 1200, 1600, 1500, SS, 'steel', { kw: 2.2 }], ['m_fryC', '연속식 튀김기', '생산 설비', 'conveyor', 4000, 1200, 1200, SS, 'steel', { kw: 60 }], ['m_spiral', '스파이럴 냉동기', '생산 설비', 'machine', 3500, 3000, 2800, SS, 'steel', { kw: 30 }],
    ['m_metal', '금속 검출기', '생산 설비', 'machine', 1500, 800, 1300, SS, 'steel', { kw: 0.3 }], ['m_scale', '바닥 저울', '생산 설비', 'cube', 1200, 1200, 80, '#3a3e44', 'steel'], ['m_comp', '공기 압축기', '생산 설비', 'machine', 900, 700, 1100, '#2f5c9e', 'paint', { kw: 7.5 }],
    ['m_pjack', '핸드 파렛트 트럭', '운반', 'cart', 550, 1550, 1200, '#d23c2e', 'steel', { v: 'flat' }], ['m_fork', '지게차', '운반', 'machine', 1150, 3200, 2200, '#f2c230', 'paint', { v: 'stripe' }], ['m_cart', '대차 (평판)', '운반', 'cart', 600, 900, 900, '#3e6eb5', 'steel', { v: '1' }],
    ['m_cart3', '3단 운반 카트', '운반', 'cart', 500, 850, 950, SS, 'steel', { v: '3' }], ['m_trolley', '랙 트롤리 (오븐용)', '운반', 'rack', 600, 800, 1800, SS, 'steel'], ['m_dolly', '롤 테이너', '운반', 'cart', 800, 600, 1700, '#9aa1a9', 'steel', { v: '4' }],
    ['m_hoist', '천장 호이스트 레일', '운반', 'track', 4000, 200, 300, '#f2c230', 'steel', { elev: 3200, layer: 'ceil' }], ['m_dock', '도크 레벨러', '운반', 'cube', 2000, 2500, 100, '#3a3e44', 'steel'],
    ['m_wash', '작업자 손세척대 (발판)', '작업 · 안전', 'sink', 1500, 500, 850, SS, 'steel', { drain: 1 }], ['m_boot', '장화 세척기', '작업 · 안전', 'machine', 1200, 900, 1100, SS, 'steel', { drain: 1, kw: 0.5 }], ['m_airsh', '에어 샤워', '작업 · 안전', 'stall', 1100, 1500, 2200, SS, 'steel', { kw: 2 }],
    ['m_ext', '소화기', '작업 · 안전', 'extinguisher', 180, 180, 550, '#d23c2e', 'gloss'], ['m_hydrant', '옥내 소화전함', '작업 · 안전', 'cab', 750, 200, 1300, '#d23c2e', 'gloss', { v: '1', elev: 300 }], ['m_eyew', '비상 세안기', '작업 · 안전', 'faucet', 400, 300, 1100, '#f2c230', 'plastic', { v: 'shower' }],
    ['m_guard', '안전 펜스 2m', '작업 · 안전', 'cube', 2000, 40, 1100, '#f2c230', 'steel'], ['m_bollard', '안전 볼라드', '작업 · 안전', 'tank', 150, 150, 1000, '#f2c230', 'gloss'], ['m_mlock', '작업복 사물함 (6칸)', '작업 · 안전', 'locker', 900, 450, 1800, '#cfd3d8', 'steel', { v: '3' }],
    ['m_aisle', '통로 표시 (노란 선)', '작업 · 안전', 'cube', 3000, 100, 2, '#f2c230', 'paint', { layer: 'deco' }], ['m_office', '현장 사무실 (컨테이너)', '작업 · 안전', 'cube', 6000, 2400, 2600, '#e8eaee', 'paint'],
  ]);
  ADD('조명', 'ceil', [
    ['l_down', '매입 다운라이트', '천장', 'light', 120, 120, 30, '#fffbe8', 'plain', { elev: 2600, kw: 0.012 }], ['l_flat', '평판 LED 640', '천장', 'light', 640, 640, 30, '#fffbe8', 'plain', { elev: 2600, kw: 0.05 }], ['l_line', '라인 조명 1200', '천장', 'light', 1200, 60, 40, '#fffbe8', 'plain', { elev: 2600, kw: 0.03 }],
    ['l_line2', '라인 조명 2400', '천장', 'light', 2400, 60, 40, '#fffbe8', 'plain', { elev: 2600, kw: 0.06 }], ['l_fact', '공장등 (하이베이)', '천장', 'pendant', 450, 450, 300, '#9aa1a9', 'steel', { elev: 4500, kw: 0.15 }], ['l_exit', '비상구 유도등', '천장', 'cube', 360, 60, 150, '#3fae5a', 'plastic', { elev: 2300, layer: 'upper', kw: 0.005 }],
    ['l_track3', '레일 조명 3구', '천장', 'track', 1500, 60, 200, '#2b2d31', 'paint', { elev: 2500, kw: 0.06 }], ['l_ring', '링 펜던트', '펜던트', 'pendant', 800, 800, 60, '#2b2d31', 'paint', { elev: 2000, kw: 0.04 }], ['l_globe', '구형 펜던트', '펜던트', 'pendant', 350, 350, 350, '#f4ecdc', 'plain', { elev: 1900, kw: 0.02 }],
    ['l_bar', '바 펜던트 (소형)', '펜던트', 'pendant', 180, 180, 250, '#c08452', 'steel', { elev: 1900, kw: 0.01 }], ['l_wall', '벽 조명 (브라켓)', '벽 · 바닥', 'cube', 200, 120, 250, '#efe7d6', 'plain', { elev: 1800, layer: 'upper', kw: 0.01 }], ['l_floor', '플로어 스탠드', '벽 · 바닥', 'lamp', 450, 450, 1600, '#efe7d6', 'plain', { layer: 'floor', kw: 0.02 }],
    ['l_paper', '한지 스탠드', '벽 · 바닥', 'lamp', 400, 400, 1300, '#f4ecdc', 'plain', { v: 'paper', layer: 'floor', kw: 0.015 }], ['l_table', '탁상 스탠드', '벽 · 바닥', 'lamp', 260, 260, 450, '#efe7d6', 'plain', { elev: 740, layer: 'floor', kw: 0.01 }], ['l_strip', '간접 조명 (LED 바)', '벽 · 바닥', 'cube', 2000, 20, 20, '#fff6d8', 'plain', { elev: 2550, layer: 'upper', kw: 0.02 }],
  ]);
  ADD('주방', 'floor', [
    ['k_work18', '작업대 1800', '작업 · 세척', 'work', 1800, 700, 850, SS, 'steel'], ['k_work09', '작업대 900', '작업 · 세척', 'work', 900, 600, 850, SS, 'steel'], ['k_worknb', '턱 없는 작업대 1200', '작업 · 세척', 'work', 1200, 600, 850, SS, 'steel', { back: 0 }],
    ['k_cabS', '하부장 (스텐 여닫이)', '작업 · 세척', 'cab', 1200, 600, 850, SS, 'steel'], ['k_drawS', '서랍 작업대', '작업 · 세척', 'drawer', 1200, 600, 850, SS, 'steel', { v: '3' }], ['k_upper', '상부장 (스텐)', '작업 · 세척', 'cab', 1200, 350, 600, SS, 'steel', { v: 'wall', elev: 1500, layer: 'upper' }],
    ['k_dwDoor', '도어형 식기세척기', '작업 · 세척', 'appl', 650, 750, 1500, SS, 'steel', { v: 'dw', drain: 1, kw: 9 }], ['k_dwU', '언더카운터 식기세척기', '작업 · 세척', 'appl', 600, 600, 820, SS, 'steel', { v: 'dw', drain: 1, kw: 4 }], ['k_dwC', '컨베이어 식기세척기', '작업 · 세척', 'conveyor', 2500, 800, 1500, SS, 'steel', { drain: 1, kw: 20 }],
    ['k_prerinse', '프리린스 수전', '작업 · 세척', 'faucet', 250, 300, 1000, SS, 'steel', { v: 'shower', layer: 'plumb' }], ['k_potsink', '깊은 세척 싱크', '작업 · 세척', 'sink', 900, 700, 850, SS, 'steel', { drain: 1 }], ['k_trolley', '식기 카트', '작업 · 세척', 'cart', 500, 800, 900, SS, 'steel', { v: '3' }],
    ['k_combi', '콤비 오븐 10단', '화기', 'appl', 900, 800, 1050, SS, 'steel', { v: 'combi', kw: 18, elev: 700 }], ['k_conv', '컨벡션 오븐', '화기', 'appl', 800, 750, 650, SS, 'steel', { v: 'oven', kw: 6, elev: 850 }], ['k_pizza', '피자 오븐 (데크)', '화기', 'appl', 1300, 1000, 1600, SS, 'steel', { v: 'oven', kw: 12 }],
    ['k_wok', '중화 레인지 (웍)', '화기', 'range', 1200, 900, 800, SS, 'steel', { gas: 1 }], ['k_salam', '샐러맨더', '화기', 'appl', 900, 450, 500, SS, 'steel', { v: 'micro', kw: 4, elev: 1500, layer: 'upper' }], ['k_steam', '스팀 컨벡션 (소형)', '화기', 'appl', 600, 650, 800, SS, 'steel', { v: 'combi', kw: 9, elev: 850 }],
    ['k_ricecook', '대형 가스 밥솥', '화기', 'tank', 700, 700, 1100, SS, 'steel', { gas: 1 }], ['k_noodle', '면 삶는 기계', '화기', 'fryer', 600, 700, 850, SS, 'steel', { kw: 9, drain: 1 }], ['k_grill', '숯불 그릴', '화기', 'range', 900, 700, 850, SS, 'steel'],
    ['k_reach', '리치인 냉장고 (유리)', '냉장 · 냉동', 'showcase', 700, 800, 2000, SS, 'steel', { kw: 0.5 }], ['k_blast', '급속 냉동고', '냉장 · 냉동', 'fridge', 800, 800, 1800, SS, 'steel', { kw: 2 }], ['k_walkin', '워크인 냉장실', '냉장 · 냉동', 'cube', 2400, 2000, 2300, '#e8eaee', 'paint', { kw: 2.5 }],
    ['k_bev', '음료 쇼케이스 2도어', '냉장 · 냉동', 'showcase', 1200, 700, 2000, BLK, 'gloss', { kw: 0.6 }], ['k_prep', '샌드위치 냉장 테이블', '냉장 · 냉동', 'tfridge', 1500, 750, 1000, SS, 'steel', { kw: 0.4 }], ['k_icecr', '아이스크림 쇼케이스', '냉장 · 냉동', 'tfridge', 1200, 700, 900, WHT, 'plastic', { kw: 0.6 }],
    ['k_espresso', '에스프레소 머신 2그룹', '음료 · 홀 서비스', 'appl', 750, 560, 520, SS, 'steel', { v: 'coffee', elev: 900, kw: 4.5 }], ['k_grinder', '커피 그라인더', '음료 · 홀 서비스', 'appl', 200, 350, 600, BLK, 'steel', { v: 'rice', elev: 900, kw: 0.4 }], ['k_blender', '블렌더', '음료 · 홀 서비스', 'appl', 200, 220, 450, BLK, 'plastic', { v: 'rice', elev: 900, kw: 1.5 }],
    ['k_beer', '생맥주 디스펜서', '음료 · 홀 서비스', 'appl', 300, 500, 500, SS, 'steel', { v: 'coffee', elev: 900, kw: 0.3 }], ['k_waterD', '업소용 정수기', '음료 · 홀 서비스', 'appl', 350, 500, 1200, SS, 'steel', { v: 'coffee', kw: 0.4 }], ['k_warmer', '보온 쇼케이스', '음료 · 홀 서비스', 'showcase', 900, 600, 700, SS, 'steel', { kw: 1.2, elev: 850 }],
    ['k_tray', '반납대 (트레이)', '음료 · 홀 서비스', 'cab', 1200, 500, 1000, SS, 'steel', { v: 'open' }], ['k_cutlery', '수저 · 냅킨 스테이션', '음료 · 홀 서비스', 'drawer', 600, 450, 900, WAL, 'wood', { v: '3' }], ['k_highch', '유아용 의자', '음료 · 홀 서비스', 'chair', 450, 500, 950, OAK, 'wood'],
  ]);
  CATS.splice(CATS.findIndex((c) => c.k === '내 기물'), 0, { k: '가구', c: ['가구'] }, { k: '욕실', c: ['욕실'] }, { k: '가전', c: ['가전'] }, { k: '공장', c: ['공장'] }, { k: '조명', c: ['조명'] });
  // 업소 · 음식점: 홀 가구에도 추가
  ADD('테이블', 'floor', [['h_t2', '2인 테이블 600', '테이블', 'table', 600, 600, 720, WAL, 'wood'], ['h_t4w', '4인 테이블 (원목)', '테이블', 'table', 1200, 700, 720, OAK, 'wood'], ['h_t6', '6인 단체 테이블', '테이블', 'table', 1800, 800, 720, WAL, 'wood'], ['h_bar', '바 테이블 (하이)', '테이블', 'table', 1200, 500, 1050, BLK, 'paint'], ['h_round', '원형 테이블 900', '테이블', 'roundtable', 900, 900, 720, WHT, 'marble'], ['h_booth', '부스 소파 (2인)', '테이블', 'sofa', 1200, 600, 1100, '#7a3b2e', 'paint'], ['h_boothL', '부스 소파 (ㄱ자)', '테이블', 'sofal', 2000, 1600, 1100, '#7a3b2e', 'paint']]);
  ADD('의자', 'floor', [['h_ch1', '카페 의자 (철제)', '의자', 'chair', 420, 470, 820, BLK, 'steel'], ['h_ch2', '원목 의자', '의자', 'chair', 430, 480, 800, OAK, 'wood'], ['h_ch3', '패브릭 암체어', '의자', 'armchair', 600, 620, 780, '#6b7a5a', 'paint'], ['h_bst', '바 스툴 (등받이)', '의자', 'barchair', 420, 420, 1050, BLK, 'steel'], ['h_st', '사각 스툴', '의자', 'stool', 350, 350, 450, OAK, 'wood'], ['h_bench', '홀 벤치', '의자', 'bench', 1500, 400, 450, WAL, 'wood']]);
}
// 새 모양 2D 기호 · 목록 그림
{ const _sym = symbol; symbol = function (it, s) { _sym(it, s); const sh = s.L.shape; if (!SH3[sh]) return; const hw = it.w / 2, hd = it.d / 2; cx.save(); cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.lineWidth = 1;
  const ln = (a, b, c2, d2) => { cx.beginPath(); cx.moveTo(...lp(it, a, b)); cx.lineTo(...lp(it, c2, d2)); cx.stroke(); }, ci = (x, y, r) => { const [px, py] = lp(it, x, y); cx.beginPath(); cx.arc(px, py, Math.max(2, r * V.s), 0, 7); cx.stroke(); };
  if (sh === 'urinal' || sh === 'vanity') ci(0, -hd + Math.min(hw, hd) * .9, Math.min(hw, hd) * .6);
  else if (sh === 'cab' || sh === 'locker' || sh === 'drawer') { ln(-hw, hd - 25, hw, hd - 25); const n = Math.max(1, Math.round(it.w / 450)); for (let i = 1; i < n; i++) ln(-hw + it.w * i / n, hd - 25, -hw + it.w * i / n, hd); }
  else if (sh === 'bookcase' || sh === 'prack') { ln(-hw, -hd, hw, hd); ln(-hw, hd, hw, -hd); }
  else if (sh === 'conveyor') for (let x = -hw + 100; x < hw; x += 200) ln(x, -hd + 30, x, hd - 30);
  else if (sh === 'ochair' || sh === 'lamp' || sh === 'extinguisher') ci(0, 0, Math.min(hw, hd) * .8);
  else if (sh === 'appl') ln(-hw + 30, hd - 40, hw - 30, hd - 40);
  else if (sh === 'sofal' || sh === 'armchair') ln(-hw, hd - 160, hw, hd - 160);
  cx.restore(); }; }
{ const _ts = thumbSvg; thumbSvg = function (l) { const sh = l.shape, c = l.color;
  if (sh === 'urinal') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="12" y="6" width="16" height="26" rx="8" fill="${c}" stroke="#9aa1a9"/><ellipse cx="20" cy="16" rx="5" ry="6" fill="#dfe3e6"/><rect x="19" y="2" width="2" height="5" fill="#9aa1a9"/></svg>`;
  if (sh === 'faucet') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="10" width="24" height="18" rx="3" fill="#c9ced4"/><rect x="18" y="16" width="4" height="16" fill="#8a9096"/><circle cx="13" cy="15" r="3" fill="#8a9096"/><circle cx="27" cy="15" r="3" fill="#8a9096"/></svg>`;
  if (sh === 'bookcase') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="5" width="22" height="30" fill="${c}" stroke="#555" stroke-width=".6"/><path d="M9 13h22M9 21h22M9 29h22" stroke="#555"/><rect x="12" y="7" width="3" height="6" fill="#7a4b3a"/><rect x="16" y="15" width="3" height="6" fill="#3e5c76"/><rect x="21" y="23" width="3" height="6" fill="#c2a14d"/></svg>`;
  if (sh === 'cab' || sh === 'drawer' || sh === 'locker' || sh === 'vanity') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="8" width="26" height="26" rx="2" fill="${c}" stroke="#555" stroke-width=".6"/>${sh === 'drawer' ? '<path d="M7 16h26M7 25h26" stroke="#555"/>' : '<path d="M20 8v26" stroke="#555"/>'}${sh === 'vanity' ? '<ellipse cx="20" cy="9" rx="7" ry="2.5" fill="#fff" stroke="#9aa1a9"/>' : ''}</svg>`;
  if (sh === 'armchair' || sh === 'sofal' || sh === 'ochair') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="10" width="24" height="9" rx="3" fill="${c}"/><rect x="6" y="18" width="28" height="10" rx="3" fill="${c}"/><rect x="10" y="28" width="3" height="5" fill="#222"/><rect x="27" y="28" width="3" height="5" fill="#222"/></svg>`;
  if (sh === 'appl') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="6" width="22" height="28" rx="2" fill="${c}" stroke="#555" stroke-width=".6"/><rect x="12" y="10" width="16" height="3" fill="#333"/><rect x="12" y="16" width="16" height="14" fill="#2f3a44" opacity=".6"/></svg>`;
  if (sh === 'prack') return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 4v32M34 4v32M20 4v32" stroke="#2f5c9e" stroke-width="2"/><path d="M6 14h28M6 26h28" stroke="#e2702a" stroke-width="2"/><rect x="9" y="8" width="8" height="6" fill="#c8b08a"/><rect x="23" y="20" width="8" height="6" fill="#c8b08a"/></svg>`;
  if (sh === 'conveyor' || sh === 'cart') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="16" width="32" height="6" fill="#2a2c30"/><circle cx="10" cy="29" r="3" fill="#555"/><circle cx="30" cy="29" r="3" fill="#555"/><path d="M8 22v5M32 22v5" stroke="#9aa1a9" stroke-width="2"/></svg>`;
  if (sh === 'machine' || sh === 'mixer') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="8" width="30" height="26" fill="${c}" stroke="#555" stroke-width=".6"/><rect x="9" y="13" width="14" height="10" fill="#2f3a44" opacity=".7"/><rect x="27" y="13" width="5" height="12" fill="#3a3e44"/><circle cx="29.5" cy="16" r="1.3" fill="#59c27a"/></svg>`;
  if (sh === 'lamp') return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M13 6h14l3 9H10z" fill="${c}" stroke="#999"/><path d="M20 15v17" stroke="#777" stroke-width="2"/><rect x="14" y="32" width="12" height="3" fill="#333"/></svg>`;
  if (sh === 'bunk' || sh === 'rbed') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="6" width="26" height="28" fill="${c}"/><rect x="9" y="8" width="22" height="9" fill="#f2efe8"/><rect x="9" y="22" width="22" height="9" fill="#f2efe8"/></svg>`;
  if (sh === 'odesk') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="12" width="30" height="4" fill="${c}"/><rect x="6" y="16" width="3" height="16" fill="${c}"/><rect x="25" y="16" width="9" height="16" fill="${c}" stroke="#555" stroke-width=".5"/></svg>`;
  if (sh === 'extinguisher') return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="15" y="10" width="10" height="24" rx="4" fill="${c}"/><rect x="17" y="6" width="6" height="5" fill="#333"/></svg>`;
  if (sh === 'stall') return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 8v26M32 8v26M8 34h24" stroke="${c}" stroke-width="3" fill="none"/><path d="M12 34a14 14 0 0 1 14-14" stroke="#888" stroke-dasharray="2 2" fill="none"/></svg>`;
  return _ts(l); }; }

/* ---------- 7. 왼쪽 도구 막대: 큰 카테고리 ---------- */
{ const tl = $('.tools'); const RC = [['주방', '<path d="M5 10h14v10H5z"/><path d="M8 10V6M12 10V4M16 10V6"/>'], ['가구', '<path d="M4 12h16v5H4z"/><path d="M6 12V8h12v4M6 17v3M18 17v3"/>'], ['욕실', '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M7 12V5a2 2 0 0 1 4 0"/>'], ['가전', '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/>'], ['공장', '<path d="M3 20V10l6 4V10l6 4V6h6v14z"/>'], ['조명', '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>']];
  if (tl) { tl.insertAdjacentHTML('beforeend', '<span class="railsep" aria-hidden="true"></span>' + RC.map(([k, p]) => `<button data-railcat="${k}" title="${k} 기물 보기" aria-pressed="false"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${p}</svg>${k}</button>`).join(''));
    tl.addEventListener('click', (e) => { const b = e.target.closest('[data-railcat]'); if (!b) return; libCat = b.dataset.railcat; libQ = ''; const q = $('#libSearch'); if (q) q.value = ''; renderLib(); const g = $('#libGrid'); if (g) g.scrollTop = 0; railSync(); }); }
  const st = document.createElement('style'); st.textContent = `.tools .railsep{grid-column:1/-1;height:1px;background:var(--line);margin:2px 4px}
  .tools [data-railcat]{min-height:42px}
  @media (min-width:900px) and (min-height:541px){.left .tools{overflow-y:auto;max-height:100%}.left .tools [data-railcat]{min-height:44px}}
  .depanel{position:absolute;right:12px;top:12px;z-index:30;width:min(340px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;background:var(--solid,var(--chrome));color:var(--fg);border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25),inset 0 0 0 1px var(--line);padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px}
  .depanel .dehd{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .depanel .departs{display:flex;flex-wrap:wrap;gap:4px}
  .depanel .departs button{border:0;border-radius:8px;padding:5px 8px;background:var(--fill);color:var(--fg);display:flex;align-items:center;gap:5px;font-size:12px}
  .depanel .departs button i{width:10px;height:10px;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
  .depanel .departs button[aria-pressed=true]{background:var(--accent);color:var(--on-accent,#fff)}
  .depanel .departs button.off{opacity:.45}
  .depanel .seg{display:flex;gap:2px;background:var(--fill);border-radius:9px;padding:2px}
  .depanel .seg button{flex:1;border:0;background:transparent;border-radius:7px;padding:5px;color:var(--fg)}
  .depanel .seg button[aria-pressed=true]{background:var(--solid,#fff);box-shadow:0 1px 3px rgba(0,0,0,.15);font-weight:600}
  .depanel .g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  .depanel .fld{display:flex;flex-direction:column;gap:3px;min-width:0}.depanel .fld span{font-size:11px;color:var(--muted)}
  .depanel input[type=range]{width:100%}.depanel .row{display:flex;gap:6px}.depanel .row.wrap{flex-wrap:wrap}
  .debox{display:flex;flex-direction:column;gap:6px;margin:6px 0}
  .debox .g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
  body.de-on #ctxbar{display:none!important}
  body.de-on .quick{display:none!important}
  #ctxbar .cxtxt{font-size:12px;font-weight:600;padding:0 10px;width:auto}
  @media (max-width:899px){.depanel{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:48%;z-index:60}}`; document.head.appendChild(st);
}
function railSync() { $$('[data-railcat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.railcat === libCat))); }
{ const _rl = renderLib; renderLib = function () { _rl(); railSync(); }; }
renderLib();
