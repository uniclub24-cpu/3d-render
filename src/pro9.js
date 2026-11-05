/* ================================================================
   v12 · 이미지 시트(파사드 · 네온) · 문 없는 출입구 · 음료냉장고 문 열림 표시
   ================================================================ */
[
  { id: 'facadeH', name: '파사드 시트 (홀 타입)', cat: '인테리어', shape: 'decal', img: 'facadeH', w: 8050, d: 20, h: 3900, layer: 'deco', color: '#ffffff', mat: 'plastic', cutClip: 1 },
  { id: 'facadeD', name: '파사드 시트 (배달 타입)', cat: '인테리어', shape: 'decal', img: 'facadeD', w: 4500, d: 20, h: 3790, layer: 'deco', color: '#ffffff', mat: 'plastic', cutClip: 1 },
  { id: 'neonsign', name: '네온사인 (페리카나)', cat: '인테리어', shape: 'decal', img: 'neon', w: 2100, d: 40, h: 578, elev: 1650, layer: 'upper', color: '#ffffff', mat: 'plastic', kw: 0.08 },
  { id: 'neonstripe', name: '장식용 아크릴 띠장', cat: '인테리어', shape: 'stripe', w: 2000, d: 20, h: 70, elev: 1890, layer: 'upper', color: '#c8102e', mat: 'plastic' },
].forEach((x) => { if (DECALS[x.img]) x.aspect = DECALS[x.img].w / DECALS[x.img].h; if (!LIB.find((l) => l.id === x.id)) LIB.push(x); });
OPENTYPES.opening = '개구부 (문 없음)'; OPDEF.opening = [1000, 2100, 0]; if (!OPLIB.includes('opening')) OPLIB.push('opening');
DOOR3D.opening = () => {}; DOOR2D.opening = (o, g) => { cx.setLineDash([3, 4]); cx.beginPath(); cx.moveTo(...toS(...g.a)); cx.lineTo(...toS(...g.b)); cx.stroke(); cx.setLineDash([]); };

/* ---------- 이미지 텍스처 ---------- */
function decalTex(k) {
  const key = 'dc_' + k; if (tex[key] || tex[key] === 0 || !gl || !DECALS[k]) return; tex[key] = 0; const im = new Image();
  im.onload = () => { const c = document.createElement('canvas'); const p2 = (v) => 2 ** Math.ceil(Math.log2(Math.max(64, Math.min(2048, v)))); c.width = p2(im.width * 2); c.height = p2(im.height * 2); const cx2 = c.getContext('2d'); cx2.imageSmoothingQuality = 'high'; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    tex[key] = t; dirty3d = true; need3d = true; };
  im.src = DECALS[k].src;
}
function decalQuad(T, x0, x1, y0, y1, z, k, vf) {
  decalTex(k); const g = grp('dc_' + k), c = tintC([1.32, 1.32, 1.32]), n = T.N(0, 0, 1), V = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], U = [[0, 1], [1, 1], [1, 1 - vf], [0, 1 - vf]];
  for (const i of [0, 1, 2, 0, 2, 3]) { g.p.push(...T.P(V[i][0], V[i][1], z)); g.n.push(...n); g.c.push(...c); g.u.push(...U[i]); }
}
{ const _bi = buildItem; buildItem = function (it) {
    const s = spec(it), sh = s.L.shape; if (sh !== 'decal' && sh !== 'stripe' && sh !== 'wsheet' && sh !== 'dsheet') return _bi(it);
    const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), hw = it.w / 2, hd = it.d / 2, h = s.h;
    if (sh === 'wsheet' || sh === 'dsheet') return buildSheet(it, T, e, hw, hd, h, sh);
    if (sh === 'stripe') { box(T, -hw, hw, e, e + h, -hd, hd - 6, '#7e8389', 'steel'); for (const k of [0.08, 0.42, 0.76]) box(T, -hw, hw, e + h * k, e + h * k + h * 0.16, hd - 6, hd, s.color, 'plain'); return; }
    const top = CUT && s.L.cutClip ? Math.min(e + h, 1200) : e + h; if (top - e < 20) return;
    box(T, -hw, hw, e, top, -hd, hd - 2, '#d9d9d9', 'plain'); decalQuad(T, -hw, hw, e, top, hd, it.dk || s.L.img, (top - e) / h);
  }; }

/* ---------- 음료냉장고: 앞쪽 문 열림 공간 (2D 점선) ---------- */
{ const _d = draw2d; draw2d = function () { _d(); if (!P || view === '3d' || OFF) return;
    cx.save(); cx.strokeStyle = 'rgba(79,156,249,.75)'; cx.lineWidth = 1.2; cx.setLineDash([5, 4]);
    for (const it of P.items) { if (it.hidden || it.type !== 'showcase') continue; const a = (it.rot || 0) * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)], w = it.w, f = it.d / 2;
      const hinge = [it.x - ux[0] * w / 2 + uy[0] * f, it.y - ux[1] * w / 2 + uy[1] * f], [hx, hy] = toS(...hinge), r = w * V.s, a0 = Math.atan2(ux[1], ux[0]), a1 = Math.atan2(uy[1], uy[0]);
      cx.beginPath(); cx.moveTo(hx, hy); cx.arc(hx, hy, r, a0, a1, ((a1 - a0 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI); cx.closePath(); cx.stroke(); }
    cx.restore(); }; }


/* ================================================================
   v12.1 · 파사드를 따로따로: 출입문 · 창마다 윈도우 시트 · 간판 (모두 선택 · 이동 가능)
   시트는 연결된 창 · 문 크기를 그대로 따라가고(그림은 비율 유지 · 잘림 없음), 벽 길이가 바뀌면 같은 비율로 줄어요
   ================================================================ */
[
  { id: 'winsheet', name: '윈도우 시트 (창 연결)', cat: '인테리어', shape: 'wsheet', w: 1000, d: 12, h: 2400, layer: 'deco', color: '#828986', mat: 'plastic' },
  { id: 'doorsheet', name: '출입문 시트 (문 연결)', cat: '인테리어', shape: 'dsheet', w: 900, d: 12, h: 2400, layer: 'deco', color: '#b5121b', mat: 'plastic' },
  { id: 'pelisign', name: '페리카나 간판 (LED 파나플렉스)', cat: '인테리어', shape: 'decal', img: 'signH', w: 8000, d: 150, h: 700, elev: 2500, layer: 'upper', color: '#ffffff', mat: 'plastic', kw: 0.4 },
].forEach((x) => { if (!LIB.find((l) => l.id === x.id)) LIB.push(x); });
function sheetQuad(T, x0, x1, y0, y1, z, k, vTop, vBot) {
  decalTex(k); const g = grp('dc_' + k), c = tintC([1.25, 1.25, 1.25]), n = T.N(0, 0, 1), V = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], U = [[0, vBot], [1, vBot], [1, vTop], [0, vTop]];
  for (const i of [0, 1, 2, 0, 2, 3]) { g.p.push(...T.P(V[i][0], V[i][1], z)); g.n.push(...n); g.c.push(...c); g.u.push(...U[i]); }
}
function louver(T, x0, x1, y0, y1, z) { if (y1 - y0 < 10) return; box(T, x0, x1, y0, y1, z - 5, z - 1, '#dfe2e5', 'plain'); for (let y = y0 + 30; y + 14 < y1; y += 62) box(T, x0, x1, y, y + 14, z - 1, z + 1.5, '#a9aeb3', 'steel'); }
function buildSheet(it, T, e, hw, hd, h, sh) {
  const k = it.dk, Dk = k && DECALS[k]; const top = CUT ? Math.min(e + h, 1200) : e + h; if (top - e < 20) return;
  if (sh === 'dsheet') { if (!Dk) return; const ar = Dk.w / Dk.h; let gw = it.w, gh = gw / ar; if (gh > h) { gh = h; gw = gh * ar; } const y0 = e + (h - gh) / 2, y1 = Math.min(y0 + gh, top); if (y1 > y0) sheetQuad(T, -gw / 2, gw / 2, y0, y1, hd, k, (y0 + gh - y1) / gh, 1); return; }
  const B = (Dk && Dk.bands) || [0.215, 0.48, 0.305], hB = h * B[2], hM = h * B[1], ym = e + hB, yt = ym + hM;
  if (Dk) { // 매뉴얼 그림 그대로: 위아래 루버 띠는 창 폭에 맞춰 늘리고, 가운데 그림은 비율 유지(잘림 없음)
    if (ym > e) sheetQuad(T, -hw, hw, e, Math.min(ym, top), hd, k, 1 - B[2] * (Math.min(ym, top) - e) / hB, 1);
    if (ym < top) { box(T, -hw, hw, ym, Math.min(yt, top), hd - 5, hd - 1, it.color || '#828986', 'plain'); const ar = Dk.w / (Dk.h * B[1]); let gw = it.w, gh = gw / ar; if (gh > hM) { gh = hM; gw = gh * ar; } const g0 = ym + (hM - gh) / 2, g1 = Math.min(g0 + gh, top); if (g1 > g0) sheetQuad(T, -gw / 2, gw / 2, g0, g1, hd, k, B[0] + B[1] * (g0 + gh - g1) / gh, B[0] + B[1]); }
    if (yt < top) sheetQuad(T, -hw, hw, yt, top, hd, k, B[0] * (e + h - top) / (h * B[0]), B[0]);
    return; }
  louver(T, -hw, hw, e, Math.min(ym, top), hd); if (ym < top) box(T, -hw, hw, ym, Math.min(yt, top), hd - 5, hd - 1, it.color || '#828986', 'plain'); if (yt < top) louver(T, -hw, hw, yt, top, hd);
}
function syncFacade() {
  if (!P || !P.items) return; const b = bounds(), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  for (const w of P.walls) { if (!w.L0) continue; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 10 || Math.abs(L - w.L0) < 1) continue; const k = L / w.L0, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    for (const o of P.openings) if (o.wall === w.id && (o.pz === 'win' || o.pz === 'gate')) { o.t = Math.round(o.t * k); if (o.pz === 'win') o.w = Math.max(300, Math.round(o.w * k)); }
    for (const it of P.items) if (it.wallLink === w.id) { const t = (it.x - w.x1) * ux + (it.y - w.y1) * uy, n = -(it.x - w.x1) * uy + (it.y - w.y1) * ux, nt = t * k; it.x = Math.round(w.x1 + ux * nt - uy * n); it.y = Math.round(w.y1 + uy * nt + ux * n); it.w = Math.max(500, Math.round(it.w * k)); }
    w.L0 = L; }
  for (const it of P.items) {
    if (it.lockAR) it.h = Math.round(it.w / it.lockAR);
    if (!it.win) continue; const o = P.openings.find((q) => q.id === it.win), g = o && openingGeom(o); if (!g) continue;
    let nx = g.nx, ny = g.ny; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2]; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny > 0) { nx = -nx; ny = -ny; }
    const fr = o.fw || std().frameW || 50, off = wallT(g.w) / 2 + 30, top = Math.min(o.sill + o.h, wallH(g.w));
    it.x = Math.round(m[0] + nx * off); it.y = Math.round(m[1] + ny * off); it.rot = Math.round(((Math.atan2(-nx, ny) * 180 / Math.PI) % 360 + 360) % 360);
    it.w = Math.max(100, Math.round(Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) - 2 * fr)); it.elev = o.sill + (o.sill > 0 ? fr : 0); it.h = Math.max(100, top - fr - it.elev); it.d = 12;
  }
}
{ const _d = draw2d; draw2d = function () { try { syncFacade(); } catch (e) {} _d(); if (!P || view === '3d' || OFF) return;
    cx.save(); cx.strokeStyle = 'rgba(242,139,58,.85)'; cx.fillStyle = 'rgba(242,139,58,.08)'; cx.lineWidth = 1.2; cx.setLineDash([6, 4]); cx.font = '600 10px system-ui';
    for (const it of P.items) { if (it.hidden || !libGet(it.type).hood || libGet(it.type).layer !== 'floor') continue; const a = (it.rot || 0) * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)], hw = it.w / 2, f = it.d / 2;
      const P4 = [[-hw, f], [hw, f], [hw, f + 1000], [-hw, f + 1000]].map(([x, y]) => [it.x + ux[0] * x + uy[0] * y, it.y + ux[1] * x + uy[1] * y]); poly(P4, 'rgba(242,139,58,.07)', 'rgba(242,139,58,.8)', 1.2, [6, 4]); }
    cx.restore(); }; }
{ const _bs = buildScene; buildScene = function () { try { syncFacade(); } catch (e) {} _bs(); }; }
{ const nl = LIB.find((l) => l.id === 'neonsign'); if (nl && DECALS.neon) { nl.aspect = DECALS.neon.w / DECALS.neon.h; nl.h = Math.round(nl.w / nl.aspect); } }
window.APP_VERSION = 'v12.1 · 2026-11-05';
