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
  im.onload = () => { const c = document.createElement('canvas'); c.width = 2048; c.height = k === 'neon' ? 512 : 1024; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
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
    const s = spec(it), sh = s.L.shape; if (sh !== 'decal' && sh !== 'stripe') return _bi(it);
    const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), hw = it.w / 2, hd = it.d / 2, h = s.h;
    if (sh === 'stripe') { box(T, -hw, hw, e, e + h, -hd, hd - 6, '#7e8389', 'steel'); for (const k of [0.08, 0.42, 0.76]) box(T, -hw, hw, e + h * k, e + h * k + h * 0.16, hd - 6, hd, s.color, 'plain'); return; }
    const top = CUT && s.L.cutClip ? Math.min(e + h, 1200) : e + h; if (top - e < 20) return;
    box(T, -hw, hw, e, top, -hd, hd - 2, '#d9d9d9', 'plain'); decalQuad(T, -hw, hw, e, top, hd, s.L.img, (top - e) / h);
  }; }

/* ---------- 음료냉장고: 앞쪽 문 열림 공간 (2D 점선) ---------- */
{ const _d = draw2d; draw2d = function () { _d(); if (!P || view === '3d' || OFF) return;
    cx.save(); cx.strokeStyle = 'rgba(79,156,249,.75)'; cx.lineWidth = 1.2; cx.setLineDash([5, 4]);
    for (const it of P.items) { if (it.hidden || it.type !== 'showcase') continue; const a = (it.rot || 0) * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)], w = it.w, f = it.d / 2;
      const hinge = [it.x - ux[0] * w / 2 + uy[0] * f, it.y - ux[1] * w / 2 + uy[1] * f], [hx, hy] = toS(...hinge), r = w * V.s, a0 = Math.atan2(ux[1], ux[0]), a1 = Math.atan2(uy[1], uy[0]);
      cx.beginPath(); cx.moveTo(hx, hy); cx.arc(hx, hy, r, a0, a1, ((a1 - a0 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI); cx.closePath(); cx.stroke(); }
    cx.restore(); }; }
window.APP_VERSION = 'v12 · 2026-11-05';
