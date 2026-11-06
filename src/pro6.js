/* ================================================================
   v9 · 배경(상권) · 출입문 종류 · Realistic Render(블렌더) 내보내기
   ================================================================ */
/* ---------- 배경: 상권별 러프 조감도 ---------- */
function env0() { return { type: 'basic', front: 'auto', colors: { bld: '#cfd3d8', glass: '#7fa3bf', apt: '#e6e2da', road: '#4a4d52', walk: '#bdbab3', green: '#6e9a55' } }; }
var ENVTYPES = [
  ['basic', '기본 거리', '<path d="M3 30h34M6 30V14h8v16M18 30V8h8v22M29 30V18h7v12"/>'],
  ['plaza', '프라자상권', '<path d="M4 34h32M10 34V6h20v28M10 14h20M10 22h20M14 34v-6h12v6"/>'],
  ['apt', '아파트상가', '<path d="M3 34h34M5 34v-8h30v8M8 26V6h9v20M22 26V9h9v17"/>'],
  ['main', '메인상권', '<path d="M3 34h34M4 34V16h6v18M11 34V10h6v24M23 34V12h6v22M30 34V18h6v16M17 34h6"/>'],
  ['park', '공원 앞 상가', '<path d="M3 34h34M5 34V20h12v14"/><circle cx="27" cy="20" r="6"/><path d="M27 26v8"/>'],
  ['none', '배경 없음', '<rect x="6" y="6" width="28" height="28" rx="4"/><path d="M8 32L32 8"/>'],
];
function envOf() { if (!P.env) P.env = env0(); P.env.colors = { ...env0().colors, ...(P.env.colors || {}) }; return P.env; }
function shade(hex, k) { const c = hexRGB(hex).map((v) => clamp(v * k, 0, 1)); return '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
function envFront(b) {
  const E = envOf(); if (E.front && E.front !== 'auto') return E.front;
  const doors = P.openings.filter((o) => /door|auto|slide|glass|fold|shutter|arch|full/.test(o.type));
  let best = null;
  for (const o of doors) { const g = openingGeom(o); if (!g) continue; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], d = { N: Math.abs(m[1] - b[1]), S: Math.abs(m[1] - b[3]), W: Math.abs(m[0] - b[0]), E: Math.abs(m[0] - b[2]) };
    for (const [k, v] of Object.entries(d)) if (!best || v < best.v) best = { k, v }; }
  return best && best.v < 1500 ? best.k : 'S';
}
function buildEnv(b) {
  const E = envOf(), C = E.colors, T0 = xf(0, 0, 0), type = $('#outside') && !$('#outside').checked ? 'ground' : E.type;
  if (type === 'none') return;
  if (type === 'basic') { // 처음부터 있던 거리 그대로
    box(T0, b[0] - 20000, b[2] + 20000, -60, -40, b[1] - 20000, b[3] + 20000, '#9a9c98', 'concrete');
    box(T0, b[0] - 20000, b[2] + 20000, -40, -20, b[1] - 9000, b[1] - 3500, '#4a4c50', 'concrete');
    const rnd = (i) => ((i * 9301 + 49297) % 233280) / 233280, EK = { h: E.hk ?? 1, n: E.nk ?? 1 }; for (let i = 0; i < 9; i++) { if (rnd(i + 3) >= EK.n) continue; const x = b[0] - 6000 + i * 3200, hh = (6000 + rnd(i) * 9000) * EK.h; box(T0, x, x + 2800, 0, hh, b[1] - 16000, b[1] - 10000, ['#c9c3b8', '#a9b4bd', '#d8d2c6', '#8f99a3'][i % 4], 'concrete'); sph(T0, x + 1400, 3200, b[1] - 3000, 1100, 1500, 1100, '#5d7f45'); cyl(T0, x + 1400, b[1] - 3000, 90, 0, 2200, '#5a4a3a', 'plain', 8); }
    return;
  }
  const F = envFront(b), L = F === 'N' || F === 'S' ? b[2] - b[0] : b[3] - b[1], D = F === 'N' || F === 'S' ? b[3] - b[1] : b[2] - b[0];
  const M = (a, o) => (F === 'S' ? [b[0] + a, b[3] + o] : F === 'N' ? [b[2] - a, b[1] - o] : F === 'E' ? [b[2] + o, b[3] - a] : [b[0] - o, b[1] + a]);
  const lb = (a0, a1, o0, o1, y0, y1, col, key = 'plain', al) => { const p = M(a0, o0), q = M(a1, o1); box(T0, Math.min(p[0], q[0]), Math.max(p[0], q[0]), y0, y1, Math.min(p[1], q[1]), Math.max(p[1], q[1]), col, key, al); };
  const tree = (a, o, h = 5200) => { const [x, z] = M(a, o); cyl(T0, x, z, 110, -20, h * .45, '#5a4a3a', 'plain', 8); sph(T0, x, h * .62, z, h * .2, h * .3, h * .2, shade(C.green, .9 + ((a * 7 + o * 3) % 5) * .05)); };
  const bands = (a0, a1, o0, o1, base, h, col, fh = 3400) => { for (let y = base + 900; y + 1300 < base + h; y += fh) lb(a0 - 30, a1 + 30, o0 - 30, o1 + 30, y, y + 1500, col, 'plain'); };
  const ghostOK = cam.cut && !EXPORTALL; // 위에서 내려다볼 때 길 건너 건물은 1층만 진하게, 위는 투명하게
  const EK = { h: E.hk ?? 1, n: E.nk ?? 1 }, near = (a0, a1, o0) => o0 > -D - 9000 && o0 < 12000 && a1 > -20000 && a0 < L + 20000;
  const bld = (a0, a1, o0, o1, h, col, base = 0, glass = C.glass) => {
    if (EK.n < 1 && !near(a0, a1, o0) && ((Math.abs(Math.round(a0 * 0.37 + o0 * 0.61)) >> 7) % 100) / 100 >= EK.n) return; if (base < 1000 || base > 4000) h = Math.max(3200, h * EK.h); else h = Math.max(1500, h * EK.h);
    if (ghostOK && o0 > 0 && base === 0 && h > 5000) { lb(a0, a1, o0, o1, 0, 4200, col, 'concrete'); lb(a0 - 30, a1 + 30, o0 - 30, o1 + 30, 900, 3000, glass, 'plain'); lb(a0, a1, o0, o1, 4200, h, col, 'plain', .14); return; }
    lb(a0, a1, o0, o1, base, base + h, col, 'concrete'); bands(a0, a1, o0, o1, base, h, glass); lb(a0 - 40, a1 + 40, o0 - 40, o1 + 40, base + h, base + h + 400, shade(col, .85)); };
  const road = (o0, o1, lanes, a0 = -90000, a1 = L + 90000) => {
    lb(a0, a1, o0, o1, -40, -25, C.road); lb(a0, a1, o0 - 220, o0, -40, 130, '#d9d6cf'); lb(a0, a1, o1, o1 + 220, -40, 130, '#d9d6cf');
    const lw = (o1 - o0) / lanes; for (let k = 1; k < lanes; k++) { const o = o0 + lw * k, mid = k === lanes / 2; if (mid) { lb(a0, a1, o - 110, o - 20, -25, -18, '#e9c43a'); lb(a0, a1, o + 20, o + 110, -25, -18, '#e9c43a'); } else for (let a = a0; a < a1; a += 6000) lb(a, a + 3000, o - 60, o + 60, -25, -18, '#f2f2f2'); }
    const cw = clamp(L / 2, 2000, L - 2000); for (let s = -2; s <= 2; s++) lb(cw + s * 1000 - 250, cw + s * 1000 + 250, o0 + 300, o1 - 300, -25, -17, '#f2f2f2');
  };
  const cut = cam.cut && !EXPORTALL, above = !cut && !(P.levels && P.levels.length > 1), hs = Math.max(P.slabH || 3300, (P.ceilingH || 2700) + 400);
  lb(-120000, L + 120000, -D - 120000, 120000, -60, -40, C.walk, 'concrete');
  const aptRow = (o0, n, a0, h0, dep = 13000, gap = 9000) => { for (let i = 0; i < n; i++) { const a = a0 + i * (30000 + gap); bld(a, a + 30000, o0, o0 + dep, h0 + ((i * 7) % 3) * 6000, shade(C.apt, 1 - (i % 2) * .05), 0, shade(C.glass, .8)); } };
  if (type === 'plaza') {
    for (const [a0, a1] of [[-17000, -8500], [-8500, 0], [L, L + 8500], [L + 8500, L + 17000]]) { lb(a0, a1, -D, 0, 0, 4500, C.bld, 'concrete'); lb(a0 + 250, a1 - 250, -15, 40, 200, 4000, C.glass, 'plain', .55); }
    for (const [a0, a1] of [[-17000, 0], [L, L + 17000]]) bld(a0, a1, -D - 2500, 0, 36000, C.bld, 4500);
    if (above) bld(0, L, -D - 2500, 0, 40500 - hs, C.bld, hs); else lb(0, L, -D - 2500, -D, 0, 4500, C.bld, 'concrete');
    lb(-30000, L + 30000, 0, 9500, -40, -12, shade(C.walk, 1.08), 'tile');
    for (let a = -14000; a < L + 14000; a += 7000) { lb(a - 700, a + 700, 6200, 7600, -12, 450, '#9aa0a6', 'concrete'); tree(a, 6900, 4600); }
    road(9500, 30500, 6); road(-90000, 9500, 6, L + 19000, L + 40000);
    bld(-45000, -18000, 34000, 52000, 48000, shade(C.bld, .95)); bld(-12000, 14000, 34000, 50000, 30000, shade(C.bld, 1.05)); bld(18000, 44000, 34000, 54000, 62000, C.apt, 0, shade(C.glass, .8)); bld(L + 44000, L + 70000, 34000, 52000, 40000, shade(C.bld, .9));
    aptRow(60000, 5, -60000, 50000); aptRow(-D - 30000, 4, -50000, 55000); bld(L + 44000, L + 66000, -D - 6000, 6000, 28000, shade(C.bld, .92));
  }
  if (type === 'apt') {
    const H2 = 7800; for (const [a0, a1] of [[-30000, 0], [L, L + 30000]]) { lb(a0, a1, -D, 0, 0, H2, C.bld, 'concrete'); lb(a0, a1, -D, 0, H2, H2 + 500, shade(C.bld, .85)); for (let a = a0; a < a1; a += 6000) { lb(a + 250, Math.min(a + 5750, a1 - 250), -15, 40, 150, 3000, C.glass, 'plain', .55); lb(a + 250, Math.min(a + 5750, a1 - 250), -15, 40, 4300, 6800, shade(C.glass, .85), 'plain', .7); } lb(a0, a1, 0, 120, 3150, 3950, shade(C.bld, 1.08)); }
    if (above) { lb(0, L, -D, 0, hs, H2, C.bld, 'concrete'); lb(0, L, -D, 0, H2, H2 + 500, shade(C.bld, .85)); lb(250, L - 250, -15, 40, 4300, 6800, shade(C.glass, .85), 'plain', .7); }
    lb(0, L, 0, 120, 3150, 3950, shade(C.bld, 1.08));
    for (let a = -30000; a < L + 30000; a += 1500) { const [x, z] = M(a, 5200); cyl(T0, x, z, 60, -20, 900, '#3a3d42', 'plain', 8); }
    for (let a = -26000; a < L + 30000; a += 9000) tree(a, 4000, 5600);
    road(5600, 19600, 4); lb(-90000, L + 90000, 21500, 22100, -20, 1200, shade(C.apt, .8), 'concrete');
    aptRow(30000, 5, -70000, 50000); aptRow(58000, 5, -55000, 62000); aptRow(-D - 26000, 5, -60000, 58000); aptRow(-D - 56000, 5, -45000, 70000);
  }
  if (type === 'main') {
    const ws = [6000, 8500, 7000, 9000, 6500], hs2 = [9000, 13500, 16500, 11000, 20000], pal = [1, .92, 1.06, .86, .98];
    const row = (o0, o1, from, to, k0, faceO) => { let a = from, i = k0; while (from < to ? a < to : a > to) { const w = ws[i % 5], a0 = from < to ? a : a - w, a1 = from < to ? a + w : a; bld(a0, a1, o0, o1, hs2[i % 5], shade(C.bld, pal[i % 5]), 0); if (!(ghostOK && o0 > 0)) lb(a0 + 300, a0 + 800, faceO - (faceO > 0 ? 700 : 0), faceO + (faceO > 0 ? 0 : 700), 3600, 8200, shade(C.bld, 1.15)); a = from < to ? a + w : a - w; i++; } };
    row(-D, 0, 0, -60000, 0, 0); row(-D, 0, L, L + 60000, 2, 0);
    if (above) bld(0, L, -D, 0, 12000 - hs, C.bld, hs);
    lb(-70000, L + 70000, 0, 9000, -40, -12, shade(C.walk, 1.1), 'tile');
    for (let a = -50000; a < L + 50000; a += 12000) { const [x, z] = M(a, 8300); cyl(T0, x, z, 70, -12, 4600, '#3a3d42', 'plain', 8); const [x2, z2] = M(a, 7800); box(T0, Math.min(x, x2) - 120, Math.max(x, x2) + 120, 4500, 4650, Math.min(z, z2) - 120, Math.max(z, z2) + 120, '#3a3d42'); }
    row(9000, 21000, L + 4000, -60000, 3, 9000); row(9000, 21000, L + 4000, L + 60000, 1, 9000);
    road(21000, 28000, 2); row(28500, 42000, 0, -60000, 4, 28500); row(28500, 42000, 0, L + 60000, 0, 28500); aptRow(-D - 30000, 4, -50000, 50000);
  }
  if (type === 'park') {
    for (const [a0, a1] of [[-20000, 0], [L, L + 20000]]) bld(a0, a1, -D, 0, 11000, C.bld, 0);
    for (const [a0, a1] of [[-20000, 0], [L, L + 20000]]) for (let a = a0; a < a1; a += 5000) lb(a + 250, Math.min(a + 4750, a1 - 250), -15, 40, 150, 3000, C.glass, 'plain', .55);
    if (above) bld(0, L, -D, 0, 11000 - hs, C.bld, hs);
    for (let a = -18000; a < L + 20000; a += 8000) tree(a, 2600, 5000);
    road(4200, 11200, 2);
    lb(-80000, L + 80000, 12000, 90000, -40, -22, C.green, 'grass'); lb(-80000, L + 80000, 11400, 12000, -40, 300, '#c9c6bd');
    lb(-80000, L + 80000, 16500, 19500, -22, -14, shade(C.walk, 1.12), 'tile'); lb(L / 2 - 1500, L / 2 + 1500, 12000, 90000, -22, -14, shade(C.walk, 1.12), 'tile');
    let k = 0; for (let o = 23000; o < 86000; o += 6500) for (let a = -70000; a < L + 70000; a += 6500) { k++; const ja = ((k * 37) % 19 - 9) * 260, jo = ((k * 53) % 17 - 8) * 260; if (Math.abs(a + ja - L / 2) < 3500) continue; if ((k * 13) % 7 === 0) continue; tree(a + ja, o + jo, 4800 + ((k * 7) % 5) * 700); }
    for (let a = -40000; a < L + 40000; a += 9000) lb(a, a + 1600, 20200, 20700, -14, 450, '#8a6a4a', 'wood');
    aptRow(-D - 26000, 5, -60000, 55000); aptRow(-D - 56000, 5, -45000, 65000);
  }
  if (type === 'ground') { /* 바닥만 */ }
}

/* ---------- 출입문 종류 ---------- */
Object.assign(OPENTYPES, { door1: '외도어 (여닫이)', door2: '양개도어', glass1: '강화유리 여닫이', glass2: '강화유리 양개', auto: '자동문 (편개)', auto2: '자동문 (양개)', slide: '미닫이 (슬라이딩)', slide2: '양미닫이', fold: '폴딩도어', shutter: '셔터' });
Object.assign(OPDEF, { glass1: [900, 2200, 0], glass2: [1800, 2400, 0], auto2: [2000, 2400, 0], slide2: [2400, 2200, 0], fold: [3600, 2400, 0], shutter: [3000, 2700, 0] });
OPLIB.splice(0, OPLIB.length, 'door1', 'door2', 'glass1', 'glass2', 'auto', 'auto2', 'slide', 'slide2', 'fold', 'shutter', 'window', 'full', 'pass', 'slidepass', 'arch');
const DOORS = ['door1', 'door2', 'glass1', 'glass2', 'auto', 'auto2', 'slide', 'slide2', 'fold', 'shutter', 'arch', 'full'];
{ const SV = { glass1: '<path d="M11 30V11" stroke-width="3"/><path d="M11 11a19 19 0 0 1 19 19" stroke-dasharray="3 3"/>', glass2: '<path d="M10 30V20M30 30V20" stroke-width="3"/><path d="M10 20a10 10 0 0 1 10 10M30 20a10 10 0 0 0-10 10" stroke-dasharray="3 3"/>',
    auto2: '<path d="M8 28h11M21 28h11"/><path d="M12 24l-4 4 4 4M28 24l4 4-4 4"/>', slide2: '<path d="M8 27h13M19 31h13"/><path d="M8 34h24" stroke-dasharray="2 3"/>', fold: '<path d="M8 30l4-6 4 6 4-6 4 6 4-6 4 6"/>', shutter: '<path d="M8 26h24" stroke-dasharray="3 2"/><rect x="8" y="30" width="24" height="4"/>' };
  const _os = opSvg; opSvg = function (t) { if (!SV[t]) return _os(t); return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 30h8M30 30h8" stroke-width="3"/>${SV[t]}</svg>`; }; }
var GLS = '#a9d6ec', STL = '#c9ced4';
var DOOR3D = {
  glass1: (T, o, fr, top, t, fc) => DOOR3D._glass(T, o, fr, top, 1),
  glass2: (T, o, fr, top, t, fc) => DOOR3D._glass(T, o, fr, top, 2),
  _glass(T, o, fr, top, n) { const lw = (o.b - o.a - 2 * fr) / n; for (let i = 0; i < n; i++) { const a0 = o.a + fr + lw * i + 6, a1 = a0 + lw - 12; box(T, a0, a1, 15, top - 10, -6, 6, GLS, 'plain', .3); for (const y of [15, top - 160]) { box(T, a0, a0 + 170, y, y + 140, -18, 18, STL, 'steel'); box(T, a1 - 170, a1, y, y + 140, -18, 18, STL, 'steel'); } const hx = i ? a0 + 70 : a1 - 100; box(T, hx, hx + 30, 650, 1950, 30, 60, STL, 'steel'); box(T, hx, hx + 30, 650, 1950, -60, -30, STL, 'steel'); } },
  auto2: (T, o, fr, top, t, fc) => { const m = (o.a + o.b) / 2, hb = top - 220; box(T, o.a, o.b, hb, top, t, t + 160, fc); box(T, m - 120, m + 120, hb - 60, hb, t + 40, t + 120, '#22262b'); for (const [a0, a1] of [[o.a + fr, m - 5], [m + 5, o.b - fr]]) { box(T, a0, a1, 0, hb, -22, 22, fc); box(T, a0 + 45, a1 - 45, 45, hb - 45, -24, 24, GLS, 'plain', .38); } },
  slide2: (T, o, fr, top, t, fc) => { const m = (o.a + o.b) / 2; box(T, o.a, o.b, top - 120, top, -t + 5, t - 5, fc); [[o.a + fr, m + 40, -34, -10], [m - 40, o.b - fr, 10, 34]].forEach(([a0, a1, z0, z1], i) => { box(T, a0, a1, 0, top - 120, z0, z1, fc); box(T, a0 + 70, a1 - 70, 250, top - 230, z0 - 2, z1 + 2, GLS, 'plain', .4); const hx = i ? a0 + 90 : a1 - 110; box(T, hx, hx + 22, 850, 1350, z1, z1 + 30, STL, 'steel'); }); },
  fold: (T, o, fr, top, t, fc) => { const n = Math.max(4, Math.round((o.b - o.a) / 520)), w = (o.b - o.a - 2 * fr) / n; box(T, o.a, o.b, top - 110, top, -t + 5, t - 5, fc); for (let i = 0; i < n; i++) { const a0 = o.a + fr + w * i, z = i % 2 ? 55 : -55; box(T, a0, a0 + w, 0, top - 110, z - 18, z + 18, fc); box(T, a0 + 45, a0 + w - 45, 120, top - 230, z - 20, z + 20, GLS, 'plain', .4); } },
  shutter: (T, o, fr, top, t, fc) => { const hb = top - 420; box(T, o.a - 60, o.b + 60, hb, top, t, t + 380, '#8a9098', 'steel'); for (const a of [o.a, o.b - 90]) box(T, a, a + 90, 0, hb, t, t + 110, '#7c828a', 'steel'); box(T, o.a + 90, o.b - 90, 0, hb, t + 30, t + 70, '#a7adb4', 'steel'); for (let y = 100; y < hb; y += 110) box(T, o.a + 90, o.b - 90, y, y + 18, t + 70, t + 76, '#7c828a', 'steel'); },
};
var DOOR2D = {
  fold(o, g) { const n = Math.max(4, Math.round(o.w / 520)), sw = wallT(g.w) * .45; cx.beginPath(); for (let i = 0; i <= n; i++) { const t = i / n, k = i % 2 ? sw : -sw, p = [g.a[0] + (g.b[0] - g.a[0]) * t + g.nx * k, g.a[1] + (g.b[1] - g.a[1]) * t + g.ny * k]; i ? cx.lineTo(...toS(...p)) : cx.moveTo(...toS(...p)); } cx.stroke(); },
  shutter(o, g) { const off = wallT(g.w) / 2 + 120; cx.setLineDash([6, 4]); cx.beginPath(); cx.moveTo(...toS(g.a[0] + g.nx * off, g.a[1] + g.ny * off)); cx.lineTo(...toS(g.b[0] + g.nx * off, g.b[1] + g.ny * off)); cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.moveTo(...toS(...g.a)); cx.lineTo(...toS(...g.b)); cx.stroke(); },
};
// 선택한 출입구 옆 도구 막대에 "문 종류"
{ const _rc = renderCtx; renderCtx = function () { _rc(); const b = $('#ctxbar'); if (!b || !sel || sel.kind !== 'open' || multi.length > 1) return; const look = $('[data-cx="look"]', b); if (look && !$('[data-cx="dtype"]', b)) look.insertAdjacentHTML('beforebegin', `<button data-cx="dtype" class="cxmore" title="문 종류 바꾸기">${ICO('<rect x="6" y="3" width="12" height="18" rx="1"/><circle cx="15" cy="12" r="1" fill="currentColor"/>', 16)}<span>문 종류</span></button>`); }; }
function doorPop(show) {
  const p = $('#doorPop'); if (!show || !sel || sel.kind !== 'open') { p.hidden = true; return; }
  const o = P.openings.find((x) => x.id === sel.id); if (!o) return;
  p.innerHTML = `<div class="dphead"><b>출입문 종류</b><span class="muted">${o.w}×${o.h}mm 그대로 바꿔요</span></div><div class="dpgrid">${DOORS.map((t) => `<button class="dpc ${t === o.type ? 'on' : ''}" data-dt="${t}"><span class="thumb">${opSvg(t)}</span><span>${OPENTYPES[t]}</span></button>`).join('')}</div>`;
  p.hidden = false; const bb = $('#ctxbar').getBoundingClientRect(), st = $('#stage').getBoundingClientRect();
  p.style.left = clamp(bb.left - st.left, 8, st.width - p.offsetWidth - 8) + 'px'; p.style.top = (bb.bottom - st.top + 8 + p.offsetHeight > st.height ? Math.max(8, bb.top - st.top - p.offsetHeight - 8) : bb.bottom - st.top + 8) + 'px';
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-cx="dtype"]')) { e.stopPropagation(); doorPop($('#doorPop').hidden); return; }
  const d = e.target.closest('[data-dt]'); if (d) { const o = P.openings.find((x) => x.id === sel.id); if (o) { o.type = d.dataset.dt; if (o.type === 'shutter' || o.type === 'fold') o.sill = 0; commit(); dirty3d = true; doorPop(true); toast(`${OPENTYPES[o.type]}로 바꿨어요`); } return; }
  if (!e.target.closest('#doorPop')) $('#doorPop').hidden = true;
}, true);
{ const _ps2 = pickSel; pickSel = function (h) { _ps2(h); $('#doorPop').hidden = true; }; }

/* ---------- 배경 고르기 창 ---------- */
function envView() { // 정면 길 건너에서 내려다보는 조감도
  const b = bounds(), F = envFront(b), base = { S: Math.PI / 2, N: -Math.PI / 2, E: 0, W: Math.PI }[F];
  anim = { t0: performance.now(), dur: 1100, a: { ...cam }, b: { yaw: base + .55, pitch: .5, dist: fitDist(aspect3d()) * 2.0, tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2 } };
}
function renderEnvPop() {
  const E = envOf(), p = $('#envPop'), CL = [['bld', '주변 건물'], ['glass', '유리 · 창'], ['apt', '아파트'], ['road', '도로'], ['walk', '보도 · 바닥'], ['green', '나무 · 잔디']];
  p.innerHTML = `<div class="dphead"><b>배경 넣기</b><span class="muted">러프한 조감도 · 색은 바꿀 수 있어요</span></div>
    <div class="envgrid">${ENVTYPES.map(([k, n, d]) => `<button class="dpc ${E.type === k ? 'on' : ''}" data-env="${k}"><span class="thumb"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${d}</svg></span><span>${n}</span></button>`).join('')}</div>
    <label class="envrow"><span>매장 정면</span><select id="envFront"><option value="auto">자동 (출입문 쪽)</option><option value="N">도면 위쪽</option><option value="E">도면 오른쪽</option><option value="S">도면 아래쪽</option><option value="W">도면 왼쪽</option></select></label>
    <div class="envcols">${CL.map(([k, n]) => `<label><input type="color" data-envc="${k}" value="${E.colors[k]}"><span>${n}</span></label>`).join('')}</div>
    <div class="row"><button class="qb" id="envReset">기본 색으로</button><span class="muted" style="font-size:11px">벽 낮춰 보기를 끄면 매장 위층 건물도 보여요</span></div>`;
  $('#envFront').value = E.front || 'auto';
}
$('#envBtn').onclick = (e) => { e.stopPropagation(); const p = $('#envPop'); p.hidden = !p.hidden; if (!p.hidden) renderEnvPop(); };
$('#envPop').addEventListener('click', (e) => { const b = e.target.closest('[data-env]'); if (b) { envOf().type = b.dataset.env; if (!$('#outside').checked) $('#outside').checked = true; dirty3d = true; commit(); renderEnvPop(); if (b.dataset.env !== 'none' && b.dataset.env !== 'basic') envView(); } if (e.target.id === 'envReset') { envOf().colors = { ...env0().colors }; dirty3d = true; commit(); renderEnvPop(); } });
$('#envPop').addEventListener('input', (e) => { const k = e.target.dataset.envc; if (k) { envOf().colors[k] = e.target.value; dirty3d = true; } });
$('#envPop').addEventListener('change', (e) => { if (e.target.dataset.envc) commit(); if (e.target.id === 'envFront') { envOf().front = e.target.value; dirty3d = true; commit(); } });
document.addEventListener('pointerdown', (e) => { const p = $('#envPop'); if (!p.hidden && !p.contains(e.target) && !e.target.closest('#envBtn')) p.hidden = true; });
// 조감도로 볼 때 카메라를 더 멀리 뺄 수 있게
{ const _cg2 = clampGoal; clampGoal = function () { if (WALK.on) return; const t = P && P.env && P.env.type; if (t && !['basic', 'none'].includes(t)) { const d = goal.dist; _cg2(); goal.dist = clamp(d, 700, 260000); } else _cg2(); }; }

/* ---------- Realistic Render: 블렌더(Cycles) 패키지 내보내기 ---------- */
const MAT_KEYS = ['tile', 'tilew', 'wood', 'filmwood', 'plywood', 'epoxy', 'concrete', 'brick', 'steel', 'grass', 'marble', 'plastic', 'frost', 'plain', 'turf', 'paint', 'gloss', 'matte'];
function realGLB(C, W, H) {
  const ks = [sel, multi, FOCUS]; sel = null; multi = []; FOCUS = null; dirty3d = true; buildScene();
  const groups = Object.values(G); sel = ks[0]; multi = ks[1]; FOCUS = ks[2]; dirty3d = true;
  // (재질, 색, 투명도)마다 따로 나눠 블렌더에서 재질을 바로 고를 수 있게
  const parts = new Map();
  for (const g of groups) {
    const n = g.p.length / 3; for (let v = 0; v < n; v += 3) {
      const c = [g.c[v * 3], g.c[v * 3 + 1], g.c[v * 3 + 2]].map((x) => Math.round(clamp(x, 0, 1) * 255)), hex = c.map((x) => x.toString(16).padStart(2, '0')).join(''), key = `${g.key}~${hex}~${(+g.alpha).toFixed(2)}`;
      let pt = parts.get(key); if (!pt) parts.set(key, (pt = { key: g.key, hex, alpha: +g.alpha, p: [], n: [] }));
      for (let j = 0; j < 3; j++) { const i = (v + j) * 3; pt.p.push(g.p[i] / 1000, g.p[i + 1] / 1000, g.p[i + 2] / 1000); pt.n.push(g.n[i], g.n[i + 1], g.n[i + 2]); }
    }
  }
  const bin = [], bviews = [], accs = [], meshes = [], mats = [], nodes = []; let off = 0;
  const addBuf = (arr, target) => { const f = new Float32Array(arr); bin.push(f); bviews.push({ buffer: 0, byteOffset: off, byteLength: f.byteLength, target }); off += f.byteLength; return bviews.length - 1; };
  for (const pt of parts.values()) {
    if (!pt.p.length) continue; const cnt = pt.p.length / 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < pt.p.length; i++) { const k = i % 3; mn[k] = Math.min(mn[k], pt.p[i]); mx[k] = Math.max(mx[k], pt.p[i]); }
    for (let i = 0; i < pt.n.length; i += 3) { const l = Math.hypot(pt.n[i], pt.n[i + 1], pt.n[i + 2]) || 1; pt.n[i] /= l; pt.n[i + 1] /= l; pt.n[i + 2] /= l; }
    const bp = addBuf(pt.p, 34962), bn = addBuf(pt.n, 34962);
    accs.push({ bufferView: bp, componentType: 5126, count: cnt, type: 'VEC3', min: mn, max: mx }, { bufferView: bn, componentType: 5126, count: cnt, type: 'VEC3' });
    const lin = hexRGB('#' + pt.hex).map((c) => Math.pow(c, 2.2));
    mats.push({ name: `${pt.key}~${pt.hex}~${pt.alpha.toFixed(2)}`, doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [...lin, pt.alpha], metallicFactor: 0, roughnessFactor: .6 }, ...(pt.alpha < 1 ? { alphaMode: 'BLEND' } : {}) });
    meshes.push({ name: pt.key, primitives: [{ attributes: { POSITION: accs.length - 2, NORMAL: accs.length - 1 }, material: mats.length - 1 }] });
    nodes.push({ name: `${pt.key}_${nodes.length}`, mesh: meshes.length - 1 });
  }
  // 카메라
  const E = eye(C), Tg = [C.tx, C.ty, C.tz], f = [Tg[0] - E[0], Tg[1] - E[1], Tg[2] - E[2]], fl = Math.hypot(...f); f.forEach((v, i) => (f[i] = v / fl));
  let r = [f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]; const rl = Math.hypot(...r) || 1; r = r.map((v) => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], bk = f.map((v) => -v);
  const quat = (c0, c1, c2) => { const m00 = c0[0], m10 = c0[1], m20 = c0[2], m01 = c1[0], m11 = c1[1], m21 = c1[2], m02 = c2[0], m12 = c2[1], m22 = c2[2], tr = m00 + m11 + m22; let x, y, z, w;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = .25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; } else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = .25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; } else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = .25 * s; z = (m12 + m21) / s; } else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = .25 * s; } return [x, y, z, w]; };
  nodes.push({ name: 'Camera', camera: 0, translation: E.map((v) => v / 1000), rotation: quat(r, u, bk) });
  const json = { asset: { version: '2.0', generator: '3D RENDER' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes, materials: mats, accessors: accs, bufferViews: bviews, buffers: [{ byteLength: off }],
    cameras: [{ type: 'perspective', perspective: { yfov: (C.fov || 50) * Math.PI / 180, aspectRatio: W / H, znear: .05, zfar: 400 } }] };
  let js = new TextEncoder().encode(JSON.stringify(json)); const jpad = (4 - js.length % 4) % 4; if (jpad) { const t = new Uint8Array(js.length + jpad); t.set(js); t.fill(32, js.length); js = t; }
  const total = 12 + 8 + js.length + 8 + off, out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true); dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
  let o2 = 20 + js.length; dv.setUint32(o2, off, true); dv.setUint32(o2 + 4, 0x004e4942, true); o2 += 8; for (const f32 of bin) { out.set(new Uint8Array(f32.buffer), o2); o2 += f32.byteLength; }
  dirty3d = true; return { glb: out, parts: parts.size };
}
function realLights() { // 조명 기물 → 블렌더 조명
  const out = []; for (const it of P.items) { if (it.hidden) continue; const s = spec(it), sh = s.L.shape; if (!['light', 'pendant', 'track'].includes(sh)) continue; const y = zOf(it) + curElev() - 20; out.push({ p: [it.x / 1000, y / 1000, it.y / 1000], kind: sh, w: it.w / 1000, d: it.d / 1000, rot: it.rot || 0 }); } return out;
}
const RENDER_PY = String.raw`# 3D RENDER · Realistic Render (Blender Cycles)
# 사용법: 이 폴더의 render.bat(윈도우) 또는 render.command(맥)를 더블클릭.
# 직접 실행: blender -b -P render.py   (Blender 3.6 이상, 4.2 LTS 권장)
import bpy, os, json, math
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, 'scene.json'), encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, 'scene.glb'))
sc = bpy.context.scene
cams = [o for o in sc.objects if o.type == 'CAMERA']
if cams:
    sc.camera = cams[0]
    cams[0].data.clip_start, cams[0].data.clip_end = 0.05, 2000
for o in [o for o in sc.objects if o.type == 'LIGHT']:
    bpy.data.objects.remove(o, do_unlink=True)

def gl2bl(v):  # glTF(Y 위) -> Blender(Z 위)
    return Vector((v[0], -v[2], v[1]))

# 해
Lb = gl2bl(P['sun_dir']).normalized()
sd = bpy.data.lights.new('Sun', 'SUN'); sd.energy = P.get('sun_strength', 3.5); sd.angle = math.radians(1.2); sd.color = P.get('sun_color', (1.0, 0.95, 0.88))
sun = bpy.data.objects.new('Sun', sd); sc.collection.objects.link(sun)
sun.rotation_euler = (-Lb).to_track_quat('-Z', 'Y').to_euler()

# 하늘
w = bpy.data.worlds.new('Sky'); sc.world = w; w.use_nodes = True
nt = w.node_tree; bg = nt.nodes.get('Background')
try:
    sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_disc = False
    sky.sun_elevation = max(0.05, math.asin(max(-1, min(1, Lb.z)))); sky.sun_rotation = math.atan2(Lb.x, Lb.y)
    nt.links.new(sky.outputs['Color'], bg.inputs['Color']); bg.inputs['Strength'].default_value = P.get('sky_strength', 0.35)
except Exception as e:
    bg.inputs['Color'].default_value = (0.62, 0.74, 0.9, 1); bg.inputs['Strength'].default_value = 0.8

# 조명 기물
def kcol(k):
    t = k / 100.0
    r = 1.0 if t <= 66 else min(1, max(0, 1.292936 * ((t - 60) ** -0.1332047592)))
    g = min(1, max(0, (0.39008157 * math.log(t) - 0.63184144) if t <= 66 else 1.129890861 * ((t - 60) ** -0.0755148492)))
    b = 1.0 if t >= 66 else (0.0 if t <= 19 else min(1, max(0, 0.543206789 * math.log(t - 10) - 1.19625408)))
    return (r, g, b)
for i, L in enumerate(P.get('lights', [])):
    p = gl2bl(L['p'])
    if L['kind'] == 'light' and max(L['w'], L['d']) > 0.4:
        ld = bpy.data.lights.new('Line%d' % i, 'AREA'); ld.shape = 'RECTANGLE'; ld.size = max(L['w'], 0.05); ld.size_y = max(L['d'], 0.05); ld.energy = 60
    else:
        ld = bpy.data.lights.new('Down%d' % i, 'SPOT' if L['kind'] != 'pendant' else 'POINT'); ld.energy = 35 if L['kind'] != 'pendant' else 25
        if ld.type == 'SPOT': ld.spot_size = math.radians(110); ld.spot_blend = 0.6
    ld.color = kcol(L.get('k', 3500)); ld.energy *= L.get('pw', 1); ld.shadow_soft_size = 0.05
    ob = bpy.data.objects.new(ld.name, ld); sc.collection.objects.link(ob); ob.location = p; ob.rotation_euler = (0, 0, math.radians(-L.get('rot', 0)))

# 재질: 이름 = 종류~색~투명도
def srgb2lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def setin(node, names, val):
    for n in names:
        if n in node.inputs:
            node.inputs[n].default_value = val; return
PRE = {'steel': (0.28, 0.85, 0), 'epoxy': (0.18, 0, 0), 'tile': (0.25, 0, 0), 'tilew': (0.25, 0, 0), 'marble': (0.12, 0, 0), 'wood': (0.45, 0, 0), 'filmwood': (0.4, 0, 0),
       'plywood': (0.55, 0, 0), 'plastic': (0.35, 0, 0), 'concrete': (0.85, 0, 0), 'grass': (0.95, 0, 0), 'turf': (0.95, 0, 0), 'brick': (0.8, 0, 0), 'frost': (0.35, 0, 1), 'plain': (0.5, 0, 0)}
def texfac(nt, key):
    tc = nt.nodes.new('ShaderNodeTexCoord'); src = tc.outputs['Object']
    if key.startswith('ux_'):
        fp = os.path.join(HERE, 'textures', key + '.jpg')
        if os.path.exists(fp):
            sz = max(0.05, float(P.get('textures', {}).get(key, 0.6)))
            mp = nt.nodes.new('ShaderNodeMapping'); nt.links.new(src, mp.inputs['Vector']); mp.inputs['Scale'].default_value = (1 / sz, 1 / sz, 1 / sz)
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(fp); t.projection = 'BOX'; t.projection_blend = 0.15
            nt.links.new(mp.outputs['Vector'], t.inputs['Vector']); return t.outputs['Color']
        return None
    if key in ('tile', 'tilew', 'brick'):
        t = nt.nodes.new('ShaderNodeTexBrick'); nt.links.new(src, t.inputs['Vector'])
        sz = 0.6 if key == 'tile' else (0.3 if key == 'tilew' else 0.24)
        t.offset = 0.0 if key != 'brick' else 0.5; t.inputs['Scale'].default_value = 1.0
        t.inputs['Brick Width'].default_value = sz; t.inputs['Row Height'].default_value = sz if key != 'brick' else 0.065
        t.inputs['Mortar Size'].default_value = 0.004; t.inputs['Color1'].default_value = (1, 1, 1, 1); t.inputs['Color2'].default_value = (0.94, 0.94, 0.94, 1); t.inputs['Mortar'].default_value = (0.55, 0.55, 0.55, 1)
        return t.outputs['Color']
    if key in ('wood', 'filmwood', 'plywood'):
        t = nt.nodes.new('ShaderNodeTexWave'); nt.links.new(src, t.inputs['Vector']); t.inputs['Scale'].default_value = 6; t.inputs['Distortion'].default_value = 6; t.inputs['Detail'].default_value = 3
        m = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(t.outputs['Fac'], m.inputs['Value']); m.inputs['To Min'].default_value = 0.78; m.inputs['To Max'].default_value = 1.05
        return m.outputs['Result']
    if key in ('concrete', 'marble', 'grass', 'turf', 'epoxy'):
        t = nt.nodes.new('ShaderNodeTexNoise'); nt.links.new(src, t.inputs['Vector']); t.inputs['Scale'].default_value = {'concrete': 18, 'marble': 4, 'grass': 40, 'turf': 40, 'epoxy': 9}[key]; t.inputs['Detail'].default_value = 8
        m = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(t.outputs['Fac'], m.inputs['Value']); lo = {'concrete': 0.82, 'marble': 0.9, 'grass': 0.65, 'turf': 0.65, 'epoxy': 0.93}[key]; m.inputs['To Min'].default_value = lo; m.inputs['To Max'].default_value = 1.06
        return m.outputs['Result']
    return None
for mat in bpy.data.materials:
    parts = mat.name.split('.')[0].split('~')
    if len(parts) < 3: continue
    key, hx, al = parts[0], parts[1], float(parts[2])
    col = [srgb2lin(int(hx[i:i + 2], 16) / 255) for i in (0, 2, 4)]
    mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    rough, metal, trans = PRE.get(key, (0.5, 0, 0))
    glass = al < 0.6 and key in ('plain', 'frost', 'glass')
    b.inputs['Base Color'].default_value = (*col, 1)
    f = texfac(nt, key)
    if f is not None:
        vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY'; vm.inputs[0].default_value = col
        nt.links.new(f, vm.inputs[1]); nt.links.new(vm.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.03 if glass and key != 'frost' else rough
    b.inputs['Metallic'].default_value = metal
    if glass or trans:
        setin(b, ['Transmission Weight', 'Transmission'], 1.0); b.inputs['IOR'].default_value = 1.45
    elif al < 0.999:
        b.inputs['Alpha'].default_value = al
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])

# 렌더 설정
sc.render.engine = 'CYCLES'; cy = sc.cycles; cy.samples = int(P.get('samples', 256)); cy.use_denoising = True
try:
    pr = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA', 'HIP', 'METAL', 'ONEAPI'):
        try:
            pr.compute_device_type = t; pr.get_devices()
            if [d for d in pr.devices if d.type != 'CPU']:
                for d in pr.devices: d.use = True
                cy.device = 'GPU'; print('GPU:', t); break
        except Exception:
            pass
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = P['width'], P['height'], 100
try:
    sc.view_settings.view_transform = 'AgX'
except Exception:
    sc.view_settings.view_transform = 'Filmic'
sc.view_settings.exposure = P.get('exposure', 0.0)
sc.render.image_settings.file_format = 'PNG'
sc.render.filepath = os.path.join(HERE, P.get('out', 'render.png'))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'scene.blend'))
bpy.ops.render.render(write_still=True)
print('DONE', sc.render.filepath)
`;
const RENDER_BAT = '@echo off\r\nset "B="\r\nfor /d %%D in ("%ProgramFiles%\\Blender Foundation\\Blender*") do if exist "%%D\\blender.exe" set "B=%%D\\blender.exe"\r\nif not defined B where blender >nul 2>nul && set "B=blender"\r\nif not defined B (\r\n  echo Blender not found. Install Blender 4.2 LTS or newer from https://www.blender.org/download/ and run this again.\r\n  pause\r\n  exit /b 1\r\n)\r\necho Rendering with %B% ... this can take a few minutes.\r\n"%B%" -b -P "%~dp0render.py"\r\nif exist "%~dp0render.png" start "" "%~dp0render.png"\r\npause\r\n';
const RENDER_CMD = '#!/bin/bash\ncd "$(dirname "$0")"\nB="/Applications/Blender.app/Contents/MacOS/Blender"\n[ -x "$B" ] || B="$(command -v blender)"\n[ -n "$B" ] || { echo "Blender not found: https://www.blender.org/download/"; read; exit 1; }\n"$B" -b -P render.py && open render.png\n';
const README_REAL = '﻿3D RENDER · Realistic Render (실사 렌더) 패키지\r\n\r\n1) 블렌더(무료)를 설치하세요: https://www.blender.org/download/  (4.2 LTS 이상 권장)\r\n2) 이 압축을 풀고 render.bat(윈도우) 또는 render.command(맥)를 더블클릭하세요.\r\n3) 몇 분 뒤 같은 폴더에 render.png(실사 이미지)와 scene.blend(블렌더 파일)가 생겨요.\r\n   - 그래픽카드(NVIDIA RTX 등)가 있으면 자동으로 빨라져요. 없으면 CPU로 더 오래 걸려요.\r\n   - scene.blend를 블렌더로 열면 카메라·조명·재질을 직접 다듬을 수 있어요.\r\n\r\n들어 있는 것\r\n- scene.glb   : 앱 3D 장면 (단위 m, 재질 이름 = 종류~색~투명도)\r\n- scene.json  : 크기·품질·햇빛·조명 위치\r\n- render.py   : 블렌더가 재질(나무결·타일줄눈·금속·유리)과 조명을 만들고 렌더하는 스크립트\r\n\r\n품질을 바꾸려면 scene.json의 samples(128 빠름 · 256 보통 · 1024 최고)를 고치세요.\r\n';
async function realPackage(o) {
  const { W, H, N, C } = o, rs = P.render || { sun: 35, alt: 55, bright: 1 }, t = o.tm && TIMES[o.tm] && TIMES[o.tm].sun != null ? TIMES[o.tm] : { sun: rs.sun, alt: rs.alt, c: [1, .95, .88] };
  const az = t.sun * Math.PI / 180, al = clamp(t.alt, 3, 89) * Math.PI / 180, Ld = [Math.cos(al) * Math.cos(az), Math.sin(al), Math.cos(al) * Math.sin(az)];
  const keepCut = cam.cut; cam.cut = C.cut != null ? C.cut : cam.cut;
  let r; try { r = realGLB(C, W, H); } finally { cam.cut = keepCut; dirty3d = true; }
  const sceneJson = { width: W, height: H, samples: N, sun_dir: Ld, sun_color: t.c, sun_strength: 3.5 * (rs.bright || 1), sky_strength: .35, exposure: 0, out: 'render.png', lights: realLights(), project: P.name, made: new Date().toISOString() };
  const txf = [], txs = {}; for (const k of Object.keys(typeof TEXCV === 'object' ? TEXCV : {})) { if (!k.startsWith('ux_')) continue; const b = await new Promise((res) => TEXCV[k].toBlob(res, 'image/jpeg', .9)); txf.push({ name: 'textures/' + k + '.jpg', data: new Uint8Array(await b.arrayBuffer()) }); txs[k] = (TILE[k] || 600) / 1000; }
  sceneJson.textures = txs;
  const z = zipFiles([...txf, { name: 'scene.glb', data: r.glb }, { name: 'scene.json', data: JSON.stringify(sceneJson, null, 1) }, { name: 'render.py', data: RENDER_PY }, { name: 'render.bat', data: RENDER_BAT }, { name: 'render.command', data: RENDER_CMD }, { name: 'README_실사렌더.txt', data: README_REAL }]);
  return { name: `${(P.name || 'plan').replace(/[\\/:*?"<>|]/g, '_')}_RealisticRender.zip`, blob: new Blob([await z.arrayBuffer()], { type: 'application/zip' }), parts: r.parts };
}
async function runReal() {
  const st = $('#realStatus'); st.textContent = '장면을 꾸리는 중…'; $('#realGo').disabled = true;
  try { const [W, H] = $('#hqRes').value.split('x').map(Number), C = hqCam($('#hqScene').value); C.cut = $('#hqCut').checked;
    const f = await realPackage({ W, H, N: +$('#realN').value, C, tm: $('#hqTime').value }); st.textContent = `재질 ${f.parts}개 · ${(f.blob.size / 1048576).toFixed(1)}MB · 저장 창에서 받으세요`;
    if (await saveLocal(f)) st.textContent = `${f.name} 저장 · 압축을 풀고 render.bat을 더블클릭하세요 (블렌더 필요)`;
  } catch (e) { console.error(e); st.textContent = '만들지 못했어요: ' + (e.message || e); }
  $('#realGo').disabled = false;
}
$('#realGo').onclick = runReal;
{ const _mf1 = makeFile0; makeFile0 = async function (fmt, lv) { if (fmt === 'real') return realPackage({ W: 2560, H: 1440, N: 256, C: { ...cam }, tm: 'now' }); return _mf1(fmt, lv); }; }
$$('[data-fmt]').forEach((b) => (b.onclick = () => { expFmt = b.dataset.fmt; $$('[data-fmt]').forEach((x) => x.classList.toggle('on', x === b)); }));

/* ---------- 버전 · 오류 알림 (문제가 생기면 화면에 보이게) ---------- */
window.APP_VERSION = 'v9 · 2026-11-05';
{ let last = 0; addEventListener('error', (e) => { if (Date.now() - last < 4000) return; last = Date.now(); try { toast('오류: ' + String(e.message || e).slice(0, 90) + ' · 캡처해서 보내 주세요'); } catch (er) {} }); }
{ const h = $('#helpDlg .dlg h3'); if (h) h.insertAdjacentHTML('afterend', `<p class="hint">3D RENDER ${window.APP_VERSION}</p>`); }
