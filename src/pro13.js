/* ================================================================
   v16 · 통짜 마네킹 (관절 · 마디 없는 하나의 매끈한 몸) · 부드럽게 휘어지는 공기 흐름
   ================================================================ */

/* ---------- 1. 매끈한 몸: 점마다 법선을 따로 줘서 각진 면 없이 ---------- */
function emitGrid(T, grid, col, wrap) { // grid[행][열] = 로컬 점 · 열은 둘레(감싸기)
  const g = grp('plain'), c = tintC(hexRGB(col)), R = grid.length, C = grid[0].length, N = [];
  for (let i = 0; i < R; i++) { N[i] = []; for (let j = 0; j < C; j++) {
      const jp = wrap ? (j + 1) % C : Math.min(C - 1, j + 1), jm = wrap ? (j - 1 + C) % C : Math.max(0, j - 1), ip = Math.min(R - 1, i + 1), im = Math.max(0, i - 1);
      const a = grid[i][jp], b = grid[i][jm], u = grid[ip][j], d = grid[im][j], tj = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ti = [u[0] - d[0], u[1] - d[1], u[2] - d[2]];
      let n = [tj[1] * ti[2] - tj[2] * ti[1], tj[2] * ti[0] - tj[0] * ti[2], tj[0] * ti[1] - tj[1] * ti[0]]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l); N[i][j] = T.N(n[0], n[1], n[2]); } }
  const P = grid.map((r) => r.map((p) => T.P(p[0], p[1], p[2])));
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < (wrap ? C : C - 1); j++) { const j2 = (j + 1) % C; for (const [a, b] of [[i, j], [i + 1, j], [i + 1, j2], [i, j], [i + 1, j2], [i, j2]]) { g.p.push(...P[a][b]); g.n.push(...N[a][b]); g.c.push(...c); g.u.push(0, 0); } }
}
const cr = (p0, p1, p2, p3, t) => p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
function spline(pts, per) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p3 = pts[Math.min(pts.length - 1, i + 2)]; for (let s = 0; s < per; s++) out.push(cr(p0, pts[i], pts[i + 1], p3, s / per)); } out.push(pts[pts.length - 1]); return out; }
function tube(T, chain, radii, col, seg = 16) { // 관절 사슬을 한 줄기 관으로 (양끝 둥근 마감)
  const per = 5, C = spline(chain, per), Rr = spline(radii.map((r) => [r, 0, 0]), per).map((v) => v[0]), n = C.length, tang = C.map((p, i) => { const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1; return d.map((v) => v / l); });
  let nr = Math.abs(tang[0][1]) < .9 ? [0, 1, 0] : [1, 0, 0]; const frames = [];
  for (let i = 0; i < n; i++) { const t = tang[i], dt = nr[0] * t[0] + nr[1] * t[1] + nr[2] * t[2]; let a = [nr[0] - t[0] * dt, nr[1] - t[1] * dt, nr[2] - t[2] * dt]; const l = Math.hypot(...a) || 1; a = a.map((v) => v / l); const b = [t[1] * a[2] - t[2] * a[1], t[2] * a[0] - t[0] * a[2], t[0] * a[1] - t[1] * a[0]]; frames.push([a, b]); nr = a; }
  const ring = (c, a, b, r) => Array.from({ length: seg }, (_, j) => { const th = 2 * Math.PI * j / seg; return [c[0] + (a[0] * Math.cos(th) + b[0] * Math.sin(th)) * r, c[1] + (a[1] * Math.cos(th) + b[1] * Math.sin(th)) * r, c[2] + (a[2] * Math.cos(th) + b[2] * Math.sin(th)) * r]; });
  const grid = [], cap = (i, sgn) => { const out = []; for (let k = 4; k >= 1; k--) { const ph = (Math.PI / 2) * k / 5, r = Rr[i] * Math.cos(ph), o = Rr[i] * Math.sin(ph) * sgn; out.push(ring([C[i][0] + tang[i][0] * o, C[i][1] + tang[i][1] * o, C[i][2] + tang[i][2] * o], frames[i][0], frames[i][1], r)); } return out; };
  const tip = (i, sgn) => { const o = Rr[i] * sgn; return Array(seg).fill([C[i][0] + tang[i][0] * o, C[i][1] + tang[i][1] * o, C[i][2] + tang[i][2] * o]); };
  grid.push(tip(0, -1), ...cap(0, -1)); for (let i = 0; i < n; i++) grid.push(ring(C[i], frames[i][0], frames[i][1], Rr[i])); grid.push(...cap(n - 1, 1).reverse(), tip(n - 1, 1));
  emitGrid(T, grid, col, true);
}
function bodyLathe(T, bob, col) { // 골반 → 허리 → 가슴 → 목 → 머리를 하나의 몸통으로
  const prof = [[820, 0, 0, 0], [835, 120, 85, 0], [880, 165, 112, 0], [960, 172, 118, 0], [1060, 150, 102, 4], [1160, 148, 100, 6], [1260, 178, 112, 8], [1350, 192, 116, 6], [1410, 160, 100, 4], [1450, 92, 78, 4], [1480, 56, 58, 8], [1520, 56, 58, 12], [1560, 82, 92, 16], [1620, 96, 106, 16], [1680, 92, 102, 14], [1725, 70, 80, 12], [1752, 38, 44, 10], [1764, 0, 0, 10]];
  const S = spline(prof, 3), seg = 22, grid = S.map(([y, rx, rz, f]) => Array.from({ length: seg }, (_, j) => { const th = 2 * Math.PI * j / seg; return [Math.cos(th) * rx, y + bob, Math.sin(th) * rz + f]; }));
  emitGrid(T, grid, col, true);
}
drawMan = function (A) {
  const ang = Math.atan2(-A.hd[0], A.hd[1]), T = xf(A.pos[0], A.pos[1], ang), walk = A.wait <= 0 && !A.blocked, ph = A.ph, y0 = floorAt(A.pos[0], A.pos[1]), bob = (walk ? Math.abs(Math.sin(ph)) * 16 : Math.sin((SIM.t || 0) * 2 + (A.i || 0)) * 4) + y0, C = MANC;
  bodyLathe(T, bob, C);
  for (const s of [1, -1]) { const q = walk ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) : 0, th = q * 0.42, kn = walk ? Math.max(0, -Math.cos(ph + (s > 0 ? 0 : Math.PI))) * 0.65 : 0.05;
    const hip = [s * 92, 900 + bob, -5], knee = [hip[0] + s * 4, hip[1] - Math.cos(th) * 440, hip[2] + Math.sin(th) * 440], a2 = th - kn, ank = [hip[0] + s * 6, knee[1] - Math.cos(a2) * 420, knee[2] + Math.sin(a2) * 420], heel = [ank[0], Math.max(y0 + 45, ank[1] - 40), ank[2] - 10], toe = [ank[0] + s * 6, Math.max(y0 + 38, heel[1] - 8), heel[2] + 175];
    tube(T, [[s * 72, 950 + bob, 0], hip, knee, ank, heel, toe], [100, 88, 58, 46, 44, 36], C); }
  for (const s of [1, -1]) { const q = walk ? Math.sin(ph + (s > 0 ? Math.PI : 0)) : 0, th = q * 0.36, sh = [s * 200, 1395 + bob, 0], el = [s * 232, sh[1] - Math.cos(th) * 290, Math.sin(th) * 290], a2 = th + (walk ? 0.22 : 0.08), wr = [s * 242, el[1] - Math.cos(a2) * 255, el[2] + Math.sin(a2) * 255], hd = [s * 245, wr[1] - Math.cos(a2) * 120, wr[2] + Math.sin(a2) * 120];
    tube(T, [[s * 150, 1405 + bob, 0], sh, el, wr, hd], [72, 54, 42, 34, 30], C); }
  if (A.a.color) { const g = grp('plain', 0.85), c = tintC(hexRGB(A.a.color)), N = 24; for (let k = 0; k < N; k++) { const t0 = 2 * Math.PI * k / N, t1 = 2 * Math.PI * (k + 1) / N; quad(g, [[300, t0], [360, t0], [360, t1], [300, t1]].map(([r, t]) => T.P(Math.cos(t) * r, y0 + 8, Math.sin(t) * r)), [0, 1, 0], c); } }
};

/* ---------- 2. 부드럽게 휘어지는 공기 흐름 ---------- */
const sstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function airV(p, t, H, sups, sinks) { // 점 p에서의 목표 속도 (mm/s)
  const [fx, fy] = afVel(p.x, p.y); let vx = fx, vy = fy, vz = 0;
  vx += Math.sin(p.y / 900 + t * 0.35) * 110 + Math.sin(p.z / 700 + t * .2) * 50; vy += Math.cos(p.x / 1100 + t * 0.28) * 110; vz += Math.sin((p.x + p.y) / 1300 + t * .4) * 60; // 잔잔한 소용돌이
  for (const s of sups) { const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) + 1, k = 1 - sstep(d / 1600);
    vz -= 1500 * k * sstep((p.z - 200) / 600); const flo = (1 - sstep(p.z / 900)) * (1 - sstep(d / 3500)); vx += dx / d * 900 * flo; vy += dy / d * 900 * flo; } // 내려와서 바닥 타고 퍼짐
  for (const s of sinks) { const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) + 1, rr = s.hood ? 2600 : 1900, k = 1 - sstep(d / rr), w = k * (s.hood ? 1700 : 1100);
    vx += (dx / d) * w - (dy / d) * w * 0.45; vy += (dy / d) * w + (dx / d) * w * 0.45; vz += (s.z - p.z) * k * 1.4; } // 나선으로 빨려 들어감
  if (p.k === 'heat') vz += (1 - sstep((p.z - (H - 300)) / 250)) * 700;
  return [vx, vy, vz];
}
airStep = function (dt) {
  if (!AF || AF.sig !== afSig()) { afBuild(); AIR.src = airSources(); renderAirHud(); }
  const H = P.ceilingH || 2700, R = presetRect() || bounds(), sinks = AF.src.filter((s) => s.q < 0), sups = AF.src.filter((s) => s.q > 0), heats = heatSrc(); AIR.t = (AIR.t || 0) + dt; AIR.acc += dt;
  while (AIR.acc > 0.012 && AIR.parts.length < 560) { AIR.acc -= 0.012; const r = Math.random();
    if (r < 0.3 && sups.length) { const s = sups[Math.floor(Math.random() * sups.length)], a = Math.random() * 6.28; AIR.parts.push({ x: s.x + Math.cos(a) * 140, y: s.y + Math.sin(a) * 140, z: s.z - 30, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, vz: -1200, k: 'sup', age: 0, tr: [] }); }
    else if (r < 0.52 && heats.length) { const h = heats[Math.floor(Math.random() * heats.length)], s = spec(h); AIR.parts.push({ x: h.x + (Math.random() - .5) * h.w * .7, y: h.y + (Math.random() - .5) * h.d * .7, z: zOf(h) + s.h + 20, vx: 0, vy: 0, vz: 350, k: 'heat', age: 0, tr: [] }); }
    else { const x = R[0] + Math.random() * (R[2] - R[0]), y = R[1] + Math.random() * (R[3] - R[1]); if (afWall(x, y)) continue; AIR.parts.push({ x, y, z: 120 + Math.random() * (H - 240), vx: 0, vy: 0, vz: 0, k: 'amb', age: 0, tr: [] }); } }
  AIR.parts = AIR.parts.filter((p) => { // 반 걸음 앞 속도로 적분(RK2) + 관성 → 부드러운 곡선
    const v1 = airV(p, AIR.t, H, sups, sinks), mid = { x: p.x + v1[0] * dt * .5, y: p.y + v1[1] * dt * .5, z: p.z + v1[2] * dt * .5, k: p.k }, v2 = airV(mid, AIR.t, H, sups, sinks), ip = 1 - Math.exp(-dt * (p.k === 'sup' ? 1.1 : 1.6));
    p.vx += (v2[0] - p.vx) * ip; p.vy += (v2[1] - p.vy) * ip; p.vz += (v2[2] - p.vz) * ip; const sp = Math.hypot(p.vx, p.vy, p.vz), cap = 2400; if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; p.vz *= cap / sp; }
    const nx_ = p.x + p.vx * dt, ny_ = p.y + p.vy * dt; if (afWall(nx_, ny_)) { if (!afWall(nx_, p.y)) { p.x = nx_; p.vy *= -0.15; } else if (!afWall(p.x, ny_)) { p.y = ny_; p.vx *= -0.15; } else { p.vx *= -.25; p.vy *= -.25; } } else { p.x = nx_; p.y = ny_; }
    p.z = p.z + p.vz * dt; if (p.z < 50) { p.z = 50; p.vz = Math.abs(p.vz) * .2; } if (p.z > H - 50) { p.z = H - 50; p.vz = -Math.abs(p.vz) * .2; }
    p.age += dt; p.tt = (p.tt || 0) + dt; if (p.tt > 0.04) { p.tt = 0; p.tr.push([p.x, p.y, p.z]); if (p.tr.length > 22) p.tr.shift(); }
    for (const s of sinks) if (Math.hypot(p.x - s.x, p.y - s.y, (p.z - s.z) * .6) < (s.hood ? 480 : 340)) return false;
    if (p.x < R[0] - 600 || p.x > R[2] + 600 || p.y < R[1] - 600 || p.y > R[3] + 600) return false; return p.age < (p.k === 'amb' ? 10 : 18); });
};
function chaikin(pts) { if (pts.length < 3) return pts; const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push(a.map((v, k) => v * .75 + b[k] * .25), a.map((v, k) => v * .25 + b[k] * .75)); } o.push(pts[pts.length - 1]); return o; }
airDraw = function () { if (!AIR.on) return; const Tz = xf(0, 0, 0);
  for (const p of AIR.parts) { const pts = chaikin([...p.tr, [p.x, p.y, p.z]]), n = pts.length; if (n < 2) continue; const col = p.k === 'heat' ? '#e5484d' : p.k === 'sup' ? '#2f8fd6' : '#5aa9e6', C = tintC(hexRGB(col)), w = p.k === 'amb' ? 11 : 15, a0 = p.k === 'amb' ? 0.25 : 0.35;
    for (let k = 1; k < n; k++) { const a = pts[k - 1], c = pts[k], L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]); if (L < 3) continue; const f = k / n, al = Math.min(0.999, Math.round((a0 + 0.7 * f * f) * 5) / 5), g = grp('plain', al), ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, ww = w * (0.5 + 0.5 * f);
      quad(g, [[a[0] - uy * ww, a[2], a[1] + ux * ww], [c[0] - uy * ww, c[2], c[1] + ux * ww], [c[0] + uy * ww, c[2], c[1] - ux * ww], [a[0] + uy * ww, a[2], a[1] - ux * ww]].map((q) => Tz.P(q[0], q[1], q[2])), [0, 1, 0], C);
      quad(g, [[a[0], a[2] - ww, a[1]], [c[0], c[2] - ww, c[1]], [c[0], c[2] + ww, c[1]], [a[0], a[2] + ww, a[1]]].map((q) => Tz.P(q[0], q[1], q[2])), [-uy, 0, ux], C); } }
  for (const s of (AF ? AF.src : [])) { const r = Math.min(600, 160 + Math.abs(s.q) / 40); cyl(Tz, s.x, s.y, r, s.z - 4, s.z + 4, s.q > 0 ? '#7fc8f8' : '#e5484d', 'plain', 24, .3); }
};
{ const _as = airSet; airSet = function (on) { _as(on); DYN = DYN.filter((f) => f.name !== 'airDraw' && f !== airDraw); if (on) DYN.push(airDraw); }; }
window.APP_VERSION = 'v16 · 2026-11-06';
