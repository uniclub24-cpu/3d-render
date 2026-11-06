/* ================================================================
   v15 · 통짜 마네킹 걷기 · 서로 비켜 가기 · 좁은 곳 못 지나감
        공기 흐름 다시 만들기 (벽 · 문 · 배식구를 따라 흐르는 평면 흐름장 + 바닥~천장 높이 흐름)
        급기 · 배기 · 자연 루버 설치 모드 (나머지는 흐리게 · 선택 안 됨 · Esc로 끝)
        프리셋 다시 배치해도 천장 끈 상태 유지 · 벽 모서리 이음 마감
   ================================================================ */

/* ---------- 1. 마네킹 (통짜 · 매끈한 흰 몸) + 걷기 ---------- */
function capsule(T, a, b, r, col) { // 로컬 좌표 a→b 원통 (양끝 둥글게)
  const g = grp('plain'), c = tintC(hexRGB(col)), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, u = d.map((v) => v / L);
  let p = Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0]; const v1 = [u[1] * p[2] - u[2] * p[1], u[2] * p[0] - u[0] * p[2], u[0] * p[1] - u[1] * p[0]], n1 = Math.hypot(...v1); for (let i = 0; i < 3; i++) v1[i] /= n1; const v2 = [u[1] * v1[2] - u[2] * v1[1], u[2] * v1[0] - u[0] * v1[2], u[0] * v1[1] - u[1] * v1[0]];
  const N = 14, ring = (o, k) => { const t = 2 * Math.PI * k / N, cx_ = Math.cos(t), sy = Math.sin(t); return [o[0] + (v1[0] * cx_ + v2[0] * sy) * r, o[1] + (v1[1] * cx_ + v2[1] * sy) * r, o[2] + (v1[2] * cx_ + v2[2] * sy) * r]; };
  for (let k = 0; k < N; k++) { const q = [ring(a, k), ring(b, k), ring(b, k + 1), ring(a, k + 1)], t = 2 * Math.PI * (k + .5) / N, nn = [v1[0] * Math.cos(t) + v2[0] * Math.sin(t), v1[1] * Math.cos(t) + v2[1] * Math.sin(t), v1[2] * Math.cos(t) + v2[2] * Math.sin(t)];
    quad(g, q.map((v) => T.P(v[0], v[1], v[2])), T.N(nn[0], nn[1], nn[2]), c.map((x) => x * (0.92 + 0.08 * nn[1]))); }
  ell(T, a[0], a[1], a[2], r, r, r, col); ell(T, b[0], b[1], b[2], r, r, r, col);
}
const MANC = '#eef0f3';
function drawMan(A) {
  const ang = Math.atan2(-A.hd[0], A.hd[1]), T = xf(A.pos[0], A.pos[1], ang), walk = A.wait <= 0 && !A.blocked, ph = A.ph, y0 = floorAt(A.pos[0], A.pos[1]), bob = walk ? Math.abs(Math.sin(ph)) * 18 : Math.sin((SIM.t || 0) * 2 + (A.i || 0)) * 4, C = MANC;
  const leg = (s) => { const q = walk ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) : 0, th = q * 0.42, kn = walk ? Math.max(0, -Math.cos(ph + (s > 0 ? 0 : Math.PI))) * 0.65 : 0.04, hip = [s * 95, 930 + bob, 0], knee = [hip[0], hip[1] - Math.cos(th) * 440, hip[2] + Math.sin(th) * 440], a2 = th - kn, ank = [hip[0], knee[1] - Math.cos(a2) * 430, knee[2] + Math.sin(a2) * 430];
    capsule(T, hip, knee, 70, C); capsule(T, knee, ank, 52, C); capsule(T, [ank[0], Math.max(45, ank[1] - 25), ank[2] - 20], [ank[0], Math.max(40, ank[1] - 35), ank[2] + 150], 42, C); };
  const arm = (s) => { const q = walk ? Math.sin(ph + (s > 0 ? Math.PI : 0)) : 0, th = q * 0.38, sh = [s * 215, 1430 + bob, 0], el = [s * 235, sh[1] - Math.cos(th) * 290, Math.sin(th) * 290], a2 = th + (walk ? 0.25 : 0.08), wr = [s * 245, el[1] - Math.cos(a2) * 260, el[2] + Math.sin(a2) * 260];
    capsule(T, sh, el, 50, C); capsule(T, el, wr, 40, C); ell(T, wr[0], wr[1] - 60, wr[2], 42, 75, 30, C); };
  leg(1); leg(-1); arm(1); arm(-1);
  ell(T, 0, 960 + bob, 0, 165, 120, 110, C); ell(T, 0, 1150 + bob, 0, 150, 160, 100, C); ell(T, 0, 1340 + bob, 5, 190, 140, 118, C); capsule(T, [0, 1440 + bob, 0], [0, 1530 + bob, 10], 52, C); ell(T, 0, 1630 + bob, 15, 92, 118, 102, C);
  if (A.a.color) { const g = grp('plain', 0.85), c = tintC(hexRGB(A.a.color)), N = 20; for (let k = 0; k < N; k++) { const t0 = 2 * Math.PI * k / N, t1 = 2 * Math.PI * (k + 1) / N, r0 = 300, r1 = 360; quad(g, [[r0, t0], [r1, t0], [r1, t1], [r0, t1]].map(([r, t]) => T.P(Math.cos(t) * r, 8, Math.sin(t) * r)), [0, 1, 0], c); } }
}
/* 서로 비켜 가기 · 막힌 곳은 못 지나감 (사람 폭 기준으로 길 찾기) */
{ const _sg = simGrid; simGrid = function () { const G = _sg(), { b, cs, nx, ny, g } = G, extra = 120, add = new Uint8Array(g); // 막힌 칸 둘레를 더 두껍게: 어깨 폭 600 이하 틈은 못 지나감
    const r = Math.ceil(extra / cs); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { if (!g[j * nx + i]) continue; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const x = i + di, y = j + dj; if (x >= 0 && y >= 0 && x < nx && y < ny && di * di + dj * dj <= r * r) add[y * nx + x] = 1; } }
    return { b, cs, nx, ny, g: add }; }; }
function cellFree(x, y) { const G = SIM.grid; if (!G) return true; const i = Math.round((x - G.b[0]) / G.cs), j = Math.round((y - G.b[1]) / G.cs); if (i < 0 || j < 0 || i >= G.nx || j >= G.ny) return false; return !G.g[j * G.nx + i]; }
simStep = function (dt) { SIM.t = (SIM.t || 0) + dt; const V = 1100;
  for (const A of SIM.A) { A.blocked = false; if (A.wait > 0) { A.wait -= dt; if (A.wait <= 0) simNext(A); continue; }
    if (!A.path) { simNext(A); continue; } let go = V * dt;
    while (go > 0 && A.pi < A.path.length) { const q = A.path[A.pi]; let dx = q[0] - A.pos[0], dy = q[1] - A.pos[1]; const d = Math.hypot(dx, dy); if (d < 30) { A.pi++; continue; } dx /= d; dy /= d;
      let sx = 0, sy = 0, stop = false; // 마주 오는 사람: 오른쪽으로 비켜서기
      for (const B of SIM.A) { if (B === A) continue; const rx = B.pos[0] - A.pos[0], ry = B.pos[1] - A.pos[1], rd = Math.hypot(rx, ry); if (rd > 1200 || rd < 1) continue; const ahead = (rx * dx + ry * dy) / rd; if (ahead < 0.2) continue;
        const w = (1 - rd / 1200) * ahead, side = (rx * -dy + ry * dx) > 0 ? -1 : 1; sx += -dy * side * w * 1.6; sy += dx * side * w * 1.6; if (rd < 520 && ahead > .7 && B.wait > 0) stop = true; }
      let mx = dx + sx, my = dy + sy; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml; const m = Math.min(go, d), nx_ = A.pos[0] + mx * m, ny_ = A.pos[1] + my * m;
      if (stop || (!cellFree(nx_, ny_) && cellFree(A.pos[0] + dx * m, A.pos[1] + dy * m) === false)) { if (A.pi >= A.path.length - 1 && d < 700) { A.pi = A.path.length; break; } A.blocked = true; A.stall = (A.stall || 0) + dt; if (A.stall > 2.5) { A.stall = 0; A.path = null; } break; }
      const fx = cellFree(nx_, ny_) ? nx_ : A.pos[0] + dx * m, fy = cellFree(nx_, ny_) ? ny_ : A.pos[1] + dy * m; A.hd = [mx, my]; A.pos[0] = fx; A.pos[1] = fy; go -= m; A.dist += m; A.loopD += m; A.ph += m / 300; A.stall = 0; }
    if (A.path && A.pi >= A.path.length) { A.path = null; A.wait = DWELL[A.a.plan[A.step]] || 2; }
    const hk = Math.round(A.pos[0] / 300) + ',' + Math.round(A.pos[1] / 300); SIM.heatM.set(hk, (SIM.heatM.get(hk) || 0) + dt); }
  for (let i = 0; i < SIM.A.length; i++) for (let j = i + 1; j < SIM.A.length; j++) { const a = SIM.A[i], b = SIM.A[j], k = i + '-' + j, d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]); if (d < 450) { if (!SIM.contact.has(k)) { SIM.contact.add(k); SIM.hits++; } } else if (d > 700) SIM.contact.delete(k); }
  if (SIM.view === 'follow' && SIM.A[SIM.follow]) { const A = SIM.A[SIM.follow]; goal.tx = A.pos[0]; goal.tz = A.pos[1]; goal.ty = curElev() + 1100; goal.dist = 3800; goal.pitch = .62; goal.yaw = Math.atan2(-A.hd[1], -A.hd[0]); }
};

/* ---------- 2. 프리셋 다시 배치해도 천장 끈 상태 유지 ---------- */
{ const _ap = applyPreset; applyPreset = function (opt) { const off = P && P.ceiling && P.ceiling.on === false, kr = rooms().map((r) => r.ceil && r.ceil.on === false); const r = _ap(opt); if (r && off && !opt.clear) { P.ceiling.on = false; for (const x of rooms()) if (x.ceil) delete x.ceil.on; } renderCeilBtn(); return r; }; }

/* ---------- 3. 벽 모서리 이음: ㄱ자로 만나는 끝은 상대 벽 두께 절반만큼 늘려 빈틈 없이 ---------- */
{ const _bw = buildWalls; buildWalls = function () {
    const ch = [], near = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) < 4;
    for (const w of P.walls) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 1) continue; const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
      for (const k of [1, 2]) { const ex = k === 1 ? w.x1 : w.x2, ey = k === 1 ? w.y1 : w.y2; let ext = 0, coll = false;
        for (const o of P.walls) { if (o === w) continue; const hit = near(o.x1, o.y1, ex, ey) || near(o.x2, o.y2, ex, ey); if (!hit) continue; const oL = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, cr = Math.abs(ux * (o.y2 - o.y1) / oL - uy * (o.x2 - o.x1) / oL); if (cr < 0.2) { coll = true; continue; } ext = Math.max(ext, wallT(o) / 2); }
        if (ext && !coll) ch.push([w, k, ext, ux, uy]); } }
    const keep = ch.map(([w]) => [w, w.x1, w.y1, w.x2, w.y2]), ok = new Map();
    for (const [w, k, e, ux, uy] of ch) { if (k === 1) { w.x1 -= ux * e; w.y1 -= uy * e; for (const o of P.openings) if (o.wall === w.id) { ok.set(o, ok.has(o) ? ok.get(o) : o.t); o.t += e; } } else { w.x2 += ux * e; w.y2 += uy * e; } }
    try { _bw(); } finally { for (const [w, x1, y1, x2, y2] of keep) { w.x1 = x1; w.y1 = y1; w.x2 = x2; w.y2 = y2; } for (const [o, t] of ok) o.t = t; } }; }

/* ---------- 4. 자연 루버 ---------- */
[{ id: 'airlouver', name: '자연 루버 (창 · 벽)', cat: '설비', shape: 'box', w: 600, d: 80, h: 400, elev: 1800, layer: 'upper', color: '#c9ced4', mat: 'steel', air: 'nat' }].forEach((x) => { if (!LIB.find((l) => l.id === x.id)) LIB.push(x); });
AT.airlouver = { n: '자연 루버', k: 'item', w: 600, h: 400, d: 80, e: 1800 };
{ const _bi = buildItem; buildItem = function (it) { if (it.type !== 'airlouver') return _bi(it); const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), hw = it.w / 2, hd = it.d / 2, h = spec(it).h;
    box(T, -hw, hw, e, e + 30, -hd, hd, '#9aa0a6', 'steel'); box(T, -hw, hw, e + h - 30, e + h, -hd, hd, '#9aa0a6', 'steel'); box(T, -hw, -hw + 30, e, e + h, -hd, hd, '#9aa0a6', 'steel'); box(T, hw - 30, hw, e, e + h, -hd, hd, '#9aa0a6', 'steel');
    for (let y = e + 55; y < e + h - 40; y += 45) box(T, -hw + 30, hw - 30, y, y + 12, -hd + 10, hd - 5, '#c9ced4', 'steel'); }; }
const isAirDev = (it) => !!it && !!libGet(it.type).air && it.type !== 'hood';

/* ---------- 5. 공기 흐름장: 벽을 피해 문 · 배식구 · 루버로 흐르는 평면 흐름 (포텐셜 흐름 근사) ---------- */
var AF = null;
function afSources() {
  const S = []; for (const it of P.items) { if (it.hidden) continue; const L = libGet(it.type); if (!L.air || L.air === 'nat') continue; const hp = it.hp ?? L.hp ?? 1, q = (L.air === 'in' ? 1 : -1) * hp * CMH_HP; S.push({ x: it.x, y: it.y, z: zOf(it) + (it.type === 'hood' ? 200 : 0), q, it, hood: it.type === 'hood' }); }
  return S;
}
function afBuild() {
  const b = bounds(), pad = 1000, cs = 200, x0 = b[0] - pad, y0 = b[1] - pad, nx = Math.ceil((b[2] - b[0] + 2 * pad) / cs), ny = Math.ceil((b[3] - b[1] + 2 * pad) / cs), N = nx * ny, wall = new Uint8Array(N), out = new Uint8Array(N), s = new Float32Array(N);
  const ext = exteriorWalls(), extSet = new Set(ext.map((w) => w.id)), R = presetRect() || [b[0], b[1], b[2], b[3]], H = (P.ceilingH || 2700) / 1000;
  const cc = (i, j) => [x0 + (i + .5) * cs, y0 + (j + .5) * cs];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const [x, y] = cc(i, j); if (x < R[0] - 40 || x > R[2] + 40 || y < R[1] - 40 || y > R[3] + 40) out[j * nx + i] = 1; }
  const louvers = P.items.filter((it) => !it.hidden && it.type === 'airlouver');
  for (const w of P.walls) { const t = wallT(w) / 2 + 70, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 1) continue; const isExt = extSet.has(w.id);
    const gaps = P.openings.filter((o) => o.wall === w.id && (!isExt || /door|auto|slide|fold|arch|opening|gap/.test(o.type))).map((o) => [o.t - o.w / 2, o.t + o.w / 2]);
    for (const lv of louvers) { const [d, tt] = distPtSeg(lv.x, lv.y, w); if (d < wallT(w) / 2 + 200) gaps.push([tt * L - lv.w / 2, tt * L + lv.w / 2]); }
    const bb = [Math.min(w.x1, w.x2) - t, Math.min(w.y1, w.y2) - t, Math.max(w.x1, w.x2) + t, Math.max(w.y1, w.y2) + t];
    for (let j = Math.max(0, Math.floor((bb[1] - y0) / cs)); j <= Math.min(ny - 1, Math.ceil((bb[3] - y0) / cs)); j++) for (let i = Math.max(0, Math.floor((bb[0] - x0) / cs)); i <= Math.min(nx - 1, Math.ceil((bb[2] - x0) / cs)); i++) {
      const [x, y] = cc(i, j), [d, tt] = distPtSeg(x, y, w); if (d > t) continue; const at = tt * L; if (gaps.some(([a, c]) => at > a + 60 && at < c - 60)) continue; wall[j * nx + i] = 1; out[j * nx + i] = 0; } }
  const src = afSources(), k = 1 / ((cs / 1000) * (cs / 1000) * H); let fluid = 0, tot = 0;
  for (const S of src) { const i = clamp(Math.floor((S.x - x0) / cs), 0, nx - 1), j = clamp(Math.floor((S.y - y0) / cs), 0, ny - 1), id = j * nx + i; if (wall[id]) continue; s[id] += S.q / 3600 * k; tot += S.q / 3600 * k; }
  const hasOut = out.some((v) => v); if (!hasOut) { for (let i = 0; i < N; i++) if (!wall[i]) fluid++; const m = tot / Math.max(1, fluid); for (let i = 0; i < N; i++) if (!wall[i]) s[i] -= m; }
  const phi = new Float32Array(N), h2 = (cs / 1000) ** 2;
  for (let it = 0; it < 500; it++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) { const id = j * nx + i; if (wall[id] || out[id]) continue; let sum = 0, n = 0; for (const nb of [id - 1, id + 1, id - nx, id + nx]) if (!wall[nb]) { sum += phi[nb]; n++; } if (!n) continue; const v = (sum + s[id] * h2) / n; phi[id] += 1.8 * (v - phi[id]); }
  AF = { x0, y0, cs, nx, ny, wall, out, phi, src, sig: afSig() };
}
function afSig() { return JSON.stringify([P.walls.map((w) => [w.x1, w.y1, w.x2, w.y2]), P.openings.map((o) => [o.wall, o.t, o.w, o.type]), P.items.filter((it) => libGet(it.type).air || it.type === 'hood').map((it) => [it.x, it.y, it.hp, it.type, it.hidden])]); }
function afVel(x, y) { // m/s → mm/s (보이기 위해 3배 빠르게)
  if (!AF) return [0, 0]; const { x0, y0, cs, nx, ny, wall, phi } = AF, fi = (x - x0) / cs - .5, fj = (y - y0) / cs - .5, i = Math.floor(fi), j = Math.floor(fj); if (i < 1 || j < 1 || i >= nx - 2 || j >= ny - 2) return [0, 0];
  const g = (ii, jj) => { const id = jj * nx + ii; if (wall[id]) return [0, 0]; const pl = wall[id - 1] ? phi[id] : phi[id - 1], pr = wall[id + 1] ? phi[id] : phi[id + 1], pu = wall[id - nx] ? phi[id] : phi[id - nx], pd = wall[id + nx] ? phi[id] : phi[id + nx]; return [-(pr - pl) / (2 * cs / 1000), -(pd - pu) / (2 * cs / 1000)]; };
  const ax = fi - i, ay = fj - j, a = g(i, j), b = g(i + 1, j), c = g(i, j + 1), d = g(i + 1, j + 1); return [0, 1].map((k) => ((a[k] * (1 - ax) + b[k] * ax) * (1 - ay) + (c[k] * (1 - ax) + d[k] * ax) * ay) * 3000); }
function afWall(x, y) { if (!AF) return false; const i = Math.floor((x - AF.x0) / AF.cs), j = Math.floor((y - AF.y0) / AF.cs); if (i < 0 || j < 0 || i >= AF.nx || j >= AF.ny) return true; return !!AF.wall[j * AF.nx + i]; }
const heatSrc = () => P.items.filter((it) => !it.hidden && /^(fryer|range|griddle|oven)/.test(it.type));
airStep = function (dt) {
  if (!AF || AF.sig !== afSig()) { afBuild(); AIR.src = airSources(); renderAirHud(); }
  const H = P.ceilingH || 2700, R = presetRect() || bounds(), sinks = AF.src.filter((s) => s.q < 0), sups = AF.src.filter((s) => s.q > 0), heats = heatSrc(); AIR.acc += dt;
  while (AIR.acc > 0.01 && AIR.parts.length < 650) { AIR.acc -= 0.01; const r = Math.random();
    if (r < 0.32 && sups.length) { const s = sups[Math.floor(Math.random() * sups.length)], a = Math.random() * 6.28; AIR.parts.push({ x: s.x + Math.cos(a) * 160, y: s.y + Math.sin(a) * 160, z: s.z - 30, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, vz: -1600, k: 'sup', age: 0, tr: [] }); }
    else if (r < 0.55 && heats.length) { const h = heats[Math.floor(Math.random() * heats.length)], s = spec(h); AIR.parts.push({ x: h.x + (Math.random() - .5) * h.w * .8, y: h.y + (Math.random() - .5) * h.d * .8, z: zOf(h) + s.h + 20, vx: 0, vy: 0, vz: 400, k: 'heat', age: 0, tr: [] }); }
    else { const x = R[0] + Math.random() * (R[2] - R[0]), y = R[1] + Math.random() * (R[3] - R[1]); if (afWall(x, y)) continue; AIR.parts.push({ x, y, z: 100 + Math.random() * (H - 200), vx: 0, vy: 0, vz: 0, k: 'amb', age: 0, tr: [] }); } }
  AIR.parts = AIR.parts.filter((p) => { const [fx, fy] = afVel(p.x, p.y); let tx = fx, ty = fy, tz = 0;
    for (const s of sups) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < 1300 && p.z > 500) tz -= 1500 * (1 - d / 1300); }
    for (const s of sinks) { const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) + 1, rr = s.hood ? 1700 : 1300; if (d < rr) { const w = (1 - d / rr) * (s.hood ? 1600 : 1000); tx += dx / d * w; ty += dy / d * w; tz += (s.z - p.z) * (1 - d / rr) * 1.6; } }
    if (p.k === 'heat') { tz += p.z < H - 150 ? 650 : 0; if (!sinks.some((s) => s.hood)) { tx *= 1.3; ty *= 1.3; } }
    if (p.z < 120 && tz < 0) { tz = 0; } const ip = Math.min(1, dt * (p.k === 'sup' ? 1.2 : 2.5)); p.vx += (tx - p.vx) * ip; p.vy += (ty - p.vy) * ip; p.vz += (tz - p.vz) * ip;
    if (p.z < 80 && p.k === 'sup') { const sp = Math.hypot(p.vx, p.vy) || 1; p.vx += p.vx / sp * 600 * dt * 4; p.vy += p.vy / sp * 600 * dt * 4; }
    const sp = Math.hypot(p.vx, p.vy, p.vz), cap = 2800; if (sp > cap) { p.vx *= cap / sp; p.vy *= cap / sp; p.vz *= cap / sp; }
    const nx_ = p.x + p.vx * dt, ny_ = p.y + p.vy * dt; if (afWall(nx_, ny_)) { if (!afWall(nx_, p.y)) { p.x = nx_; p.vy *= -0.2; } else if (!afWall(p.x, ny_)) { p.y = ny_; p.vx *= -0.2; } else { p.vx *= -.3; p.vy *= -.3; } } else { p.x = nx_; p.y = ny_; }
    p.z = clamp(p.z + p.vz * dt, 40, H - 40); p.age += dt; p.tt = (p.tt || 0) + dt; if (p.tt > 0.05) { p.tt = 0; p.tr.push([p.x, p.y, p.z]); if (p.tr.length > 14) p.tr.shift(); }
    for (const s of sinks) if (Math.hypot(p.x - s.x, p.y - s.y, (p.z - s.z) * .6) < (s.hood ? 520 : 380)) return false;
    if (p.x < R[0] - 600 || p.x > R[2] + 600 || p.y < R[1] - 600 || p.y > R[3] + 600) return false; return p.age < (p.k === 'amb' ? 9 : 16); });
};
airDraw = function () { if (!AIR.on) return; const Tz = xf(0, 0, 0);
  for (const p of AIR.parts) { const pts = [...p.tr, [p.x, p.y, p.z]], n = pts.length; if (n < 2) continue; const col = p.k === 'heat' ? '#e5484d' : p.k === 'sup' ? '#2f8fd6' : '#5aa9e6', C = tintC(hexRGB(col)), w = p.k === 'amb' ? 8 : 11, a0 = p.k === 'amb' ? 0.2 : 0.3;
    for (let k = 1; k < n; k++) { const a = pts[k - 1], c = pts[k], L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]); if (L < 5) continue; const al = Math.min(0.999, Math.round((a0 + 0.65 * k / n) * 4) / 4), g = grp('plain', al), ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L;
      quad(g, [[a[0] - uy * w, a[2], a[1] + ux * w], [c[0] - uy * w, c[2], c[1] + ux * w], [c[0] + uy * w, c[2], c[1] - ux * w], [a[0] + uy * w, a[2], a[1] - ux * w]].map((q) => Tz.P(q[0], q[1], q[2])), [0, 1, 0], C);
      quad(g, [[a[0], a[2] - w, a[1]], [c[0], c[2] - w, c[1]], [c[0], c[2] + w, c[1]], [a[0], a[2] + w, a[1]]].map((q) => Tz.P(q[0], q[1], q[2])), [-uy, 0, ux], C); } }
  for (const s of (AF ? AF.src : [])) { const r = Math.min(600, 160 + Math.abs(s.q) / 40); cyl(Tz, s.x, s.y, r, s.z - 4, s.z + 4, s.q > 0 ? '#7fc8f8' : '#e5484d', 'plain', 20, .35); }
};
{ const _as = airSet; airSet = function (on) { DYN = DYN.filter((f) => f !== airDraw); _as(on); DYN = DYN.filter((f) => f !== airDraw); if (on) { AF = null; DYN.push(airDraw); } else aedSet(false); }; }
{ const _rh = renderAirHud; renderAirHud = function () { _rh(); const h = $('#airHud'); if (!h || h.hidden) return; const ad = $('.airadd', h); if (ad && !$('[data-aiadd="nat"]', ad)) ad.insertAdjacentHTML('beforeend', `<button class="btn" data-aiadd="nat">+ 자연 루버</button><button class="btn ${AED ? 'pri' : ''}" data-aied>${AED ? '위치 조정 중 · Esc로 끝' : '위치 조정'}</button>`);
    const lv = P.items.filter((it) => it.type === 'airlouver').length, hs = heatSrc().length, hd = P.items.some((it) => it.type === 'hood');
    h.insertAdjacentHTML('beforeend', `<small class="muted">벽 · 문 · 배식구 · 루버를 따라 흐르는 흐름 (바닥~천장) · 파랑 = 급기 · 연파랑 = 실내 공기 · 빨강 = 튀김기 · 화구 열기${hs && !hd ? ' · 후드가 없어 열기가 퍼져요' : ''}${lv ? ` · 자연 루버 ${lv}개` : ''}</small>`); }; }
document.addEventListener('click', (e) => { const b = e.target.closest('[data-aiadd="nat"]'); if (b) { e.stopImmediatePropagation(); addLouver(); return; } if (e.target.closest('[data-aied]')) aedSet(!AED); }, true);
document.addEventListener('click', (e) => { const b = e.target.closest('[data-aiadd]'); if (b && b.dataset.aiadd !== 'nat') setTimeout(() => aedSet(true), 0); });
function addLouver() {
  const s = sel && sel.kind === 'wall' ? wallOf(sel.id) : null, o = sel && sel.kind === 'open' ? P.openings.find((x) => x.id === sel.id) : P.openings.find((x) => /window|full/.test(x.type) && exteriorWalls().some((w) => w.id === x.wall));
  const w = s || (o && wallOf(o.wall)) || exteriorWalls()[0]; if (!w) return; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), t = o && o.wall === w.id ? o.t : L / 2, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, bb = bounds(), c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2], m = [w.x1 + ux * t, w.y1 + uy * t];
  let nx = -uy, ny = ux; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny < 0) { nx = -nx; ny = -ny; } const off = wallT(w) / 2 + 45, top = o && o.wall === w.id ? o.sill + o.h : Math.min(2400, wallH(w));
  const it = { id: uid('i'), type: 'airlouver', x: Math.round(m[0] + nx * off), y: Math.round(m[1] + ny * off), w: 600, d: 80, h: 400, rot: Math.round(Math.atan2(-nx, ny) * 180 / Math.PI), elev: Math.max(0, top - 450), tag: '자연 루버' };
  P.items.push(it); commit(); dirty3d = true; aedSet(true); pickSel({ kind: 'item', id: it.id }); toast('자연 루버를 창 위쪽에 달았어요 · 팬 없이 바깥 공기가 들고 나요 · 끌어서 옮기세요');
}

/* ---------- 6. 급기 · 배기 설치 모드: 공기 장치만 진하게 · 나머지는 흐리게 · 선택 안 됨 ---------- */
var AED = false, AEDmove = null;
function aedSet(on) { if (AED === !!on) { renderAirHud(); return; } AED = !!on; if (AED) { AEDmove = moveOn; moveOn = true; if (sel && !(sel.kind === 'item' && isAirDev(itemOf(sel.id)))) pickSel(null); toast('급기 · 배기 · 루버 위치 조정 · 끌어서 옮기면 흐름이 바로 바뀌어요 · Esc로 끝'); }
  else { if (AEDmove != null) moveOn = AEDmove; AEDmove = null; } dirty3d = true; need3d = true; draw2d(); renderAirHud(); renderQuick(); }
{ const _bl = buildLevel; buildLevel = function (a) { if (!AED || !a) return _bl(a); const kf = FOCUS; FOCUS = '__aed'; try { _bl(a); } finally { FOCUS = kf; } }; }
{ const _bi = buildItem; buildItem = function (it) { if (!AED || !isAirDev(it)) return _bi(it); const kF = FADE, kT = TINT; FADE = false; TINT = true; try { _bi(it); } finally { FADE = kF; TINT = kT; } }; }
{ const _rh = rayHit; rayHit = function (e) { if (!AED) return _rh(e); if (!lastM) return null; const r = gc.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; let best = null;
    for (const it of P.items) { if (!isAirDev(it) || it.hidden) continue; const q = proj(lastM, [it.x, curElev() + zOf(it) + spec(it).h / 2, it.y], r); if (!q) continue; const d = Math.hypot(q[0] - mx, q[1] - my); if (d < 44 && (!best || d < best.d)) best = { d, it }; }
    if (!best) return null; const it = best.it, z = zOf(it); return { t: 1, rt: 1, sel: { kind: 'item', id: it.id }, n: [0, -1, 0], p: [it.x, z, it.y] }; }; }
{ const _ht = hitTest; hitTest = function (wx, wy) { if (!AED) return _ht(wx, wy); let best = null; for (const it of P.items) { if (!isAirDev(it) || it.hidden) continue; const d = Math.hypot(it.x - wx, it.y - wy); if (d < Math.max(it.w, it.d) / 2 + 22 / V.s && (!best || d < best.d)) best = { d, it }; } return best ? { kind: 'item', id: best.it.id } : null; }; }
{ const _ch = ceilHit; ceilHit = function (e) { return AED ? null : _ch(e); }; }
{ const _d = draw2d; draw2d = function () { _d(); if (!AED || !P || view === '3d' || OFF) return; cx.save(); cx.fillStyle = 'rgba(20,22,26,.45)'; cx.fillRect(0, 0, cv.width, cv.height);
    for (const it of P.items) { if (!isAirDev(it)) continue; const q = toS(it.x, it.y), r = Math.max(10, Math.max(it.w, it.d) / 2 * V.s); cx.strokeStyle = '#2f8fd6'; cx.lineWidth = 3; cx.beginPath(); cx.arc(q[0], q[1], r, 0, 7); cx.stroke(); cx.fillStyle = libGet(it.type).air === 'in' ? '#7fc8f8' : libGet(it.type).air === 'out' ? '#e5484d' : '#c9ced4'; cx.beginPath(); cx.arc(q[0], q[1], Math.max(5, r * .5), 0, 7); cx.fill();
      cx.fillStyle = '#fff'; cx.font = '600 11px system-ui'; cx.textAlign = 'center'; cx.fillText(it.type === 'airlouver' ? '루버' : `${libGet(it.type).air === 'in' ? '급기' : '배기'} ${+(it.hp ?? 1).toFixed(2)}HP`, q[0], q[1] - r - 6); } cx.restore(); }; }
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || !AED) return; const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; e.stopImmediatePropagation(); e.preventDefault(); aedSet(false); toast('위치 조정을 끝냈어요 · 공기 흐름은 계속 보여요'); }, true);
window.APP_VERSION = 'v15 · 2026-11-06';
{ const _as = airSources; airSources = function () { const S = _as(), nat = new Set(P.items.filter((it) => libGet(it.type).air === 'nat').map((it) => it.x + ',' + it.y)); return S.filter((s) => !nat.has(s.x + ',' + s.y)); }; }

{ const _r = simReset; simReset = function () { SIM.t = 0; _r(); }; }
