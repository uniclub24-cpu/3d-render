// 6차: DXF 가져오기(캐드 선 → 벽) · 내보내기(벽 · 문/창 · 공간 · 기물 블록 · 배관/배선 · 치수) — 기존 앱 v10 · v16
export function parseDxf(text) {
  const L = text.split(/\r?\n/), pr = []; for (let i = 0; i + 1 < L.length; i += 2) pr.push([+L[i].trim(), L[i + 1].trim()]);
  let units = 0, sec = '', ents = [], cur = null, poly = null;
  for (let i = 0; i < pr.length; i++) {
    const [c, v] = pr[i];
    if (c === 9 && v === '$INSUNITS') { const n = pr[i + 1]; if (n && n[0] === 70) units = +n[1]; }
    if (c === 0 && v === 'SECTION') { const n = pr[i + 1]; sec = n ? n[1] : ''; continue; }
    if (c === 0 && v === 'ENDSEC') { sec = ''; continue; }
    if (sec !== 'ENTITIES') continue;
    if (c === 0) {
      if (cur && cur.t !== 'VERTEX' && cur.t !== 'SEQEND') ents.push(cur);
      if (v === 'VERTEX' && poly) { cur = { t: 'VERTEX' }; poly.pts.push(cur.p = [0, 0]); continue; }
      if (v === 'SEQEND') { poly = null; cur = { t: 'SEQEND' }; continue; }
      cur = { t: v, layer: '0', pts: [], x: [], y: [] }; if (v === 'POLYLINE') poly = cur; continue;
    }
    if (!cur) continue;
    if (cur.t === 'VERTEX') { if (c === 10) cur.p[0] = +v; if (c === 20) cur.p[1] = +v; continue; }
    if (c === 8) cur.layer = v;
    if (cur.t === 'LWPOLYLINE') { if (c === 10) cur.pts.push([+v, 0]); if (c === 20 && cur.pts.length) cur.pts[cur.pts.length - 1][1] = +v; if (c === 70) cur.closed = (+v & 1) === 1; continue; }
    if (cur.t === 'POLYLINE' && c === 70) cur.closed = (+v & 1) === 1;
    if (c === 10) cur.x10 = +v; if (c === 20) cur.y20 = +v; if (c === 11) cur.x11 = +v; if (c === 21) cur.y21 = +v; if (c === 40) cur.r = +v; if (c === 50) cur.a0 = +v; if (c === 51) cur.a1 = +v;
  }
  if (cur && cur.t !== 'VERTEX' && cur.t !== 'SEQEND') ents.push(cur);
  const segs = [];
  for (const e of ents) {
    const push = (a, b) => segs.push({ a, b, layer: e.layer });
    if (e.t === 'LINE') push([e.x10, e.y20], [e.x11, e.y21]);
    else if (e.t === 'LWPOLYLINE' || e.t === 'POLYLINE') { const p = e.pts; for (let i = 1; i < p.length; i++) push(p[i - 1], p[i]); if (e.closed && p.length > 2) push(p[p.length - 1], p[0]); }
    else if (e.t === 'ARC' || e.t === 'CIRCLE') { const a0 = (e.t === 'ARC' ? e.a0 : 0) * Math.PI / 180; let a1 = (e.t === 'ARC' ? e.a1 : 360) * Math.PI / 180; if (a1 <= a0) a1 += Math.PI * 2; const n = Math.max(6, Math.round((a1 - a0) / (Math.PI / 12))); let pv = null; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, q = [e.x10 + e.r * Math.cos(a), e.y20 + e.r * Math.sin(a)]; if (pv) push(pv, q); pv = q; } }
  }
  return { units, segs: segs.filter((s) => isFinite(s.a[0] + s.a[1] + s.b[0] + s.b[1])), layers: [...new Set(segs.map((s) => s.layer))] };
}

export const UNIT_MM = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };
/** 단위 (mm 배수): unit = 'auto' | 숫자 */
export function dxfScale(D, unit = 'auto') { if (unit !== 'auto') return +unit; if (UNIT_MM[D.units]) return UNIT_MM[D.units]; const xs = D.segs.flatMap((s) => [s.a[0], s.b[0]]), ys = D.segs.flatMap((s) => [s.a[1], s.b[1]]), span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); return span < 200 ? 1000 : span < 5000 ? 10 : 1; }
/** 캐드 선 → 벽: 평행한 두 줄(60~400mm 간격)은 벽 하나로 · 모서리는 중심선 교점으로 */
export function dxfWalls(DXF, { unit = 'auto', layers, merge = true, rest = true, wallT = 150 } = {}) {
  const sc = dxfScale(DXF, unit), on = new Set(layers || DXF.layers);
  let S = DXF.segs.filter((s) => on.has(s.layer)).map((s) => [s.a[0] * sc, -s.a[1] * sc, s.b[0] * sc, -s.b[1] * sc]).filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) > 80).slice(0, 4000);
  if (!S.length) return { walls: [], S };
  const mx = Math.min(...S.flatMap((s) => [s[0], s[2]])), my = Math.min(...S.flatMap((s) => [s[1], s[3]])); S = S.map((s) => [s[0] - mx, s[1] - my, s[2] - mx, s[3] - my]);
  const used = new Set(), walls = [], dT = wallT;
  if (merge) {
    const info = S.map((s) => { const L = Math.hypot(s[2] - s[0], s[3] - s[1]), u = [(s[2] - s[0]) / L, (s[3] - s[1]) / L]; return { L, u, n: [-u[1], u[0]] }; });
    const pairs = [];
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const A = info[i], B = info[j]; if (Math.abs(A.u[0] * B.u[1] - A.u[1] * B.u[0]) > .03) continue;
      const d = (S[j][0] - S[i][0]) * A.n[0] + (S[j][1] - S[i][1]) * A.n[1], d2 = (S[j][2] - S[i][0]) * A.n[0] + (S[j][3] - S[i][1]) * A.n[1]; if (Math.abs(d - d2) > 15) continue;
      const ad = Math.abs(d); if (ad < 60 || ad > 400) continue;
      const pj = (x, y) => (x - S[i][0]) * A.u[0] + (y - S[i][1]) * A.u[1], t0 = Math.max(0, Math.min(pj(S[j][0], S[j][1]), pj(S[j][2], S[j][3]))), t1 = Math.min(A.L, Math.max(pj(S[j][0], S[j][1]), pj(S[j][2], S[j][3])));
      if (t1 - t0 < Math.max(200, .5 * Math.min(A.L, B.L))) continue; pairs.push({ i, j, d, t0, t1, ov: t1 - t0 });
    }
    pairs.sort((a, b) => b.ov - a.ov || Math.abs(a.d) - Math.abs(b.d));
    for (const p of pairs) {
      if (used.has(p.i) || used.has(p.j)) continue; used.add(p.i); used.add(p.j); const A = info[p.i], o = [S[p.i][0] + A.n[0] * p.d / 2, S[p.i][1] + A.n[1] * p.d / 2];
      walls.push({ x1: o[0] + A.u[0] * p.t0, y1: o[1] + A.u[1] * p.t0, x2: o[0] + A.u[0] * p.t1, y2: o[1] + A.u[1] * p.t1, t: Math.round(Math.abs(p.d)) });
    }
  }
  if (rest || !merge) S.forEach((s, i) => { if (!used.has(i)) walls.push({ x1: s[0], y1: s[1], x2: s[2], y2: s[3], t: dT }); });
  // 거의 수평/수직은 반듯하게 → 모서리는 중심선 교점으로 · T자는 상대 벽 중심선까지
  for (const w of walls) { if (Math.abs(w.y2 - w.y1) < 8) w.y2 = w.y1 = (w.y1 + w.y2) / 2; if (Math.abs(w.x2 - w.x1) < 8) w.x2 = w.x1 = (w.x1 + w.x2) / 2; }
  const isect = (a, b) => { const d1 = [a.x2 - a.x1, a.y2 - a.y1], d2 = [b.x2 - b.x1, b.y2 - b.y1], den = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(den) < 1e-6 * Math.hypot(...d1) * Math.hypot(...d2)) return null; const t = ((b.x1 - a.x1) * d2[1] - (b.y1 - a.y1) * d2[0]) / den; return [a.x1 + d1[0] * t, a.y1 + d1[1] * t]; };
  const ends = (w) => [['x1', 'y1'], ['x2', 'y2']];
  for (const a of walls) for (const [ax, ay] of ends(a)) {
    let best = null;
    for (const b of walls) { if (b === a) continue; const p = isect(a, b); if (!p) continue; const dEnd = Math.hypot(p[0] - a[ax], p[1] - a[ay]); if (dEnd > Math.max(a.t, b.t) * 1.2 + 30) continue;
      const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), tb = ((p[0] - b.x1) * (b.x2 - b.x1) + (p[1] - b.y1) * (b.y2 - b.y1)) / (L * L); if (tb < -(a.t / L) - .02 || tb > 1 + a.t / L + .02) continue;
      if (!best || dEnd < best.d) best = { d: dEnd, p }; }
    if (best) { a[ax] = best.p[0]; a[ay] = best.p[1]; }
  }
  for (const w of walls) for (const k of ['x1', 'y1', 'x2', 'y2']) w[k] = Math.round(w[k]);
  return { walls: walls.filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 50), S };
}

/* ---------- DXF 내보내기 (R12 · mm · 기물은 BLOCK/INSERT + 이름 · 규격 속성) ---------- */
export const dxfText = (t) => [...String(t)].map((ch) => (ch.charCodeAt(0) > 127 ? '\\U+' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0') : ch)).join('');
const wallRect = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, t = (w.t || 150) / 2, nx = (-(w.y2 - w.y1) / L) * t, ny = ((w.x2 - w.x1) / L) * t; return [[w.x1 + nx, w.y1 + ny], [w.x2 + nx, w.y2 + ny], [w.x2 - nx, w.y2 - ny], [w.x1 - nx, w.y1 - ny]]; };
const OPN = { door1: '여닫이문', door2: '양개문', auto: '자동문', slide: '미닫이문', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', arch: '개구부' };
/**
 * levels: [{ level, pre }] — 층마다 앞글자(pre)를 붙인 레이어로 (여러 층을 한 파일에)
 * lib: 기물 사전 · zOf(level, it): 바닥에서 높이 (선택)
 */
export function dxfDoc(levels, lib, zOf = (L, it) => it.elev || 0) {
  const BL = new Map(), layers = new Set(['0']), ENT = [], Y = (y) => -y, n = (v) => +(+v).toFixed(2);
  const line = (E, a, b, l) => E.push(`0\nLINE\n8\n${l}\n10\n${n(a[0])}\n20\n${n(Y(a[1]))}\n30\n0\n11\n${n(b[0])}\n21\n${n(Y(b[1]))}\n31\n0`);
  const text = (E, x, y, t, l, h = 120, rot = 0) => E.push(`0\nTEXT\n8\n${l}\n10\n${n(x)}\n20\n${n(Y(y))}\n30\n0\n40\n${h}\n1\n${dxfText(t)}\n50\n${n(rot)}\n72\n1\n11\n${n(x)}\n21\n${n(Y(y))}\n31\n0\n73\n2`);
  const LN = { floor: 'L1_FLOOR', upper: 'L2_UPPER', ceil: 'L3_CEILING', ceiling: 'L3_CEILING', elec: 'ELEC', plumb: 'PLUMB', deco: 'DECO' };
  const blk = (it, Li) => (`${it.type}_${Math.round(it.w)}X${Math.round(it.d)}`).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 60);
  for (const { level: Lv, pre = '' } of levels) {
    const L = (x) => { const v = pre + x; layers.add(v); return v; };
    for (const w of Lv.walls) { const r = wallRect(w); for (let i = 0; i < 4; i++) line(ENT, r[i], r[(i + 1) % 4], L('WALL')); }
    for (const o of Lv.openings) { const w = Lv.walls.find((q) => q.id === o.wall); if (!w) continue; const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, a = [w.x1 + ux * (o.t - o.w / 2), w.y1 + uy * (o.t - o.w / 2)], b = [w.x1 + ux * (o.t + o.w / 2), w.y1 + uy * (o.t + o.w / 2)];
      line(ENT, a, b, L('OPENING')); text(ENT, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 300, `${OPN[o.type] || o.type} ${o.w}x${o.h}`, L('OPENING'), 100); }
    for (const r of Lv.rooms || []) { const p = r.pts; ENT.push(`0\nPOLYLINE\n8\n${L('ROOM')}\n66\n1\n70\n1\n10\n0\n20\n0\n30\n0\n${p.map((q) => `0\nVERTEX\n8\n${L('ROOM')}\n10\n${n(q[0])}\n20\n${n(Y(q[1]))}\n30\n0`).join('\n')}\n0\nSEQEND\n8\n${L('ROOM')}`);
      const c = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]; text(ENT, c[0], c[1], r.name, L('ROOM'), 200); }
    for (const it of Lv.items.filter((i) => !i.hidden)) {
      const Li = lib[it.type] || { name: it.name || it.type, layer: 'floor' }, nm = blk(it, Li), l = L(LN[Li.layer] || 'L1_FLOOR');
      if (!BL.has(nm)) { const E = [], hw = it.w / 2, hd = it.d / 2, c = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]; for (let i = 0; i < 4; i++) line(E, c[i], c[(i + 1) % 4], '0');
        line(E, [-hw, hd - Math.min(80, hd / 3)], [hw, hd - Math.min(80, hd / 3)], '0'); /* 앞면 표시 */
        const th = Math.max(60, Math.min(140, Math.min(it.w, it.d) / 6));
        E.push(`0\nATTDEF\n8\n0\n10\n0\n20\n${n(th * 0.6)}\n30\n0\n40\n${n(th)}\n1\n\n3\nNAME\n2\nNAME\n70\n0\n72\n1\n11\n0\n21\n${n(th * 0.6)}\n31\n0`, `0\nATTDEF\n8\n0\n10\n0\n20\n${n(-th * 0.9)}\n30\n0\n40\n${n(th * 0.7)}\n1\n\n3\nSIZE\n2\nSIZE\n70\n0\n72\n1\n11\n0\n21\n${n(-th * 0.9)}\n31\n0`);
        BL.set(nm, { E, th }); }
      const { th } = BL.get(nm), a = -(it.rot || 0), ar = (a * Math.PI) / 180, wpt = (lx, ly) => [it.x + lx * Math.cos(ar) - ly * Math.sin(ar), Y(it.y) + lx * Math.sin(ar) + ly * Math.cos(ar)];
      ENT.push(`0\nINSERT\n8\n${l}\n66\n1\n2\n${nm}\n10\n${n(it.x)}\n20\n${n(Y(it.y))}\n30\n${n(zOf(Lv, it))}\n41\n1\n42\n1\n43\n1\n50\n${n(a)}`);
      for (const [tag, val, ly, h] of [['NAME', it.name || Li.name, th * 0.6, th], ['SIZE', `${Math.round(it.w)}x${Math.round(it.d)}x${Math.round(it.h || Li.h || 0)}`, -th * 0.9, th * 0.7]]) { const p = wpt(0, ly); ENT.push(`0\nATTRIB\n8\n${l}\n10\n${n(p[0])}\n20\n${n(p[1])}\n30\n0\n40\n${n(h)}\n1\n${dxfText(val)}\n2\n${tag}\n70\n0\n50\n${n(a)}\n72\n1\n11\n${n(p[0])}\n21\n${n(p[1])}\n31\n0`); }
      ENT.push(`0\nSEQEND\n8\n${l}`);
    }
    for (const ln of Lv.lines || []) for (let i = 1; i < ln.pts.length; i++) line(ENT, ln.pts[i - 1], ln.pts[i], L('LINE_' + String(ln.kind).toUpperCase()));
    for (const d of Lv.dims || []) { const lay = L('DIM'), a = [d.x1, d.y1], b = [d.x2, d.y2], ang = (Math.atan2(-(b[1] - a[1]), b[0] - a[0]) * 180) / Math.PI, up = ang > 90 || ang < -90 ? ang + 180 : ang; line(ENT, a, b, lay);
      text(ENT, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 90, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])).toLocaleString(), lay, 110, up); for (const p of [a, b]) line(ENT, [p[0] - 60, p[1] + 60], [p[0] + 60, p[1] - 60], lay); }
  }
  const ly = [...layers], tbl = ly.map((nm, i) => `0\nLAYER\n2\n${nm}\n70\n0\n62\n${nm.endsWith('DIM') ? 30 : (i % 7) + 1}\n6\nCONTINUOUS`).join('\n');
  const blocks = [...BL.entries()].map(([nm, b]) => `0\nBLOCK\n8\n0\n2\n${nm}\n70\n2\n10\n0\n20\n0\n30\n0\n3\n${nm}\n${b.E.join('\n')}\n0\nENDBLK\n8\n0`).join('\n');
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${ly.length}\n${tbl}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n${blocks}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${ENT.join('\n')}\n0\nENDSEC\n0\nEOF\n`;
}
