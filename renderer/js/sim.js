// 주방 동선 시뮬레이터 (기존 앱 "동선"): 직원마다 역할(작업 순서)을 정하면 냉장고 → 작업대 → 튀김기 → 배식구 …를
// 실제 기물 앞자리로 찾아 A* 길찾기로 걸어간다. 동선 열지도 · 겹침(부딪힘) 횟수 · 한 바퀴 시간/거리.
// model.sim = { actors: [{ id, name, role, color, plan: ['fridge', 'work', …] }] }
import * as THREE from 'three';
import { pointInPoly } from './slope.js';
const MM = 0.001;
export const FAM = { fridge: /^(fridge|freezer|tfridge|showcase)/, work: /^work/, fryer: /^fryer/, range: /^(range|griddle|oven)/, sink: /^(sink|handsink)/, dish: /^dishwasher/, rack: /^(rack|shelf|holding)/, counter: /^(counter|pos)/ };
export const FAMN = { fridge: '냉장고', work: '작업대', fryer: '튀김기', range: '화구', sink: '싱크대', dish: '식기세척기', rack: '선반 · 랙', counter: '카운터', pass: '배식구' };
const DWELL = { fryer: 4, range: 3, sink: 3, dish: 3, fridge: 2, work: 2.5, rack: 1.5, counter: 2, pass: 1.5 };
export const ROLES = { fry: ['튀김 담당', ['fridge', 'work', 'fryer', 'work', 'pass']], hot: ['화구 · 소스 담당', ['fridge', 'range', 'work', 'pass']], wash: ['세척 담당', ['pass', 'sink', 'dish', 'rack']], pack: ['포장 · 배식 담당', ['rack', 'work', 'pass', 'counter']] };
export const SIMCOL = ['#e5484d', '#2f8fd6', '#30a46c', '#f5a524', '#8e6cf0', '#0aa5a5'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class KitchenSim {
  constructor(engine) { this.e = engine; this.on = false; this.run = false; this.speed = 1; this.heatOn = true; this.follow = -1; this.A = []; this.root = new THREE.Group(); this.root.name = '동선'; this.root.visible = false; engine.scene.add(this.root); this.onInfo = () => {}; }
  data(model) { return (model.sim ||= { actors: [] }); }
  add(model, role = 'fry') { const d = this.data(model), i = d.actors.length, R = ROLES[role] || ROLES.fry; d.actors.push({ id: 'm' + Math.random().toString(36).slice(2, 8), name: `직원 ${i + 1} · ${R[0]}`, role, color: SIMCOL[i % SIMCOL.length], plan: [...R[1]] }); }
  kitchen() { return (this.e.level.rooms || []).find((r) => r.kind === '주방') || null; }
  bounds() { const L = this.e.level, xs = L.walls.flatMap((w) => [w.x1, w.x2]), ys = L.walls.flatMap((w) => [w.y1, w.y2]); return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [0, 0, 8000, 6000]; }
  /** 그 일을 하는 자리: 기물 앞 380mm (주방 공간 안을 먼저) · 배식구는 주방 쪽 550mm */
  station(fam, from) {
    const L = this.e.level, kr = this.kitchen(), lib = this.e.ctx.lib;
    if (fam === 'pass') { let best = null; for (const o of L.openings) { if (!/pass/.test(o.type)) continue; const w = L.walls.find((q) => q.id === o.wall); if (!w) continue; const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, m = [w.x1 + ux * o.t, w.y1 + uy * o.t];
        for (const s of [1, -1]) { const p = [m[0] - uy * s * 550, m[1] + ux * s * 550], ok = kr ? pointInPoly(p[0], p[1], kr.pts) : true, d = from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : 0; if (ok && (!best || d < best.d)) best = { d, p }; } } return best && { p: best.p, label: '배식구' }; }
    let best = null; for (const it of L.items) { if (!FAM[fam] || !FAM[fam].test(it.type)) continue; const r = ((it.rot || 0) * Math.PI) / 180, f = [-Math.sin(r), Math.cos(r)], p = [it.x + f[0] * (it.d / 2 + 380), it.y + f[1] * (it.d / 2 + 380)];
      const inK = kr ? pointInPoly(it.x, it.y, kr.pts) : true, d = (from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : 0) + (inK || fam === 'counter' ? 0 : 1e6); if (!best || d < best.d) best = { d, p, label: it.name || (lib[it.type] || {}).name }; }
    return best && { p: best.p, label: best.label };
  }
  grid() {
    const L = this.e.level, lib = this.e.ctx.lib, b = this.bounds(), cs = 100, nx = Math.ceil((b[2] - b[0]) / cs) + 1, ny = Math.ceil((b[3] - b[1]) / cs) + 1, g = new Uint8Array(nx * ny);
    const mark = (x0, y0, x1, y1, test) => { for (let i = Math.max(0, Math.floor((x0 - b[0]) / cs)); i <= Math.min(nx - 1, Math.ceil((x1 - b[0]) / cs)); i++) for (let j = Math.max(0, Math.floor((y0 - b[1]) / cs)); j <= Math.min(ny - 1, Math.ceil((y1 - b[1]) / cs)); j++) if (test(b[0] + i * cs, b[1] + j * cs)) g[j * nx + i] = 1; };
    for (const w of L.walls) { const r = w.t / 2 + 130, len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ops = L.openings.filter((o) => o.wall === w.id && (o.sill || 0) < 150 && !/window|full/.test(o.type));
      mark(Math.min(w.x1, w.x2) - r, Math.min(w.y1, w.y2) - r, Math.max(w.x1, w.x2) + r, Math.max(w.y1, w.y2) + r, (x, y) => { const t = clamp(((x - w.x1) * (w.x2 - w.x1) + (y - w.y1) * (w.y2 - w.y1)) / (len * len), 0, 1), d = Math.hypot(w.x1 + (w.x2 - w.x1) * t - x, w.y1 + (w.y2 - w.y1) * t - y); if (d > r) return false; const at = t * len; return !ops.some((o) => at > o.t - o.w / 2 + 120 && at < o.t + o.w / 2 - 120); }); }
    for (const it of L.items) { const Lb = lib[it.type]; if (Lb && Lb.layer && Lb.layer !== 'floor') continue; if ((it.elev || 0) > 400 || it.autoDrain || /drain|trench|trap|mat|rug/.test(it.type)) continue; const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2 + 130, hd = it.d / 2 + 130, R = Math.hypot(hw, hd);
      mark(it.x - R, it.y - R, it.x + R, it.y + R, (x, y) => { const dx = x - it.x, dy = y - it.y, lx = dx * c + dy * s, ly = -dx * s + dy * c; return Math.abs(lx) < hw && Math.abs(ly) < hd; }); }
    return { b, cs, nx, ny, g };
  }
  astar(G, p, q) {
    const { b, cs, nx, ny, g } = G, ci = (pt) => [clamp(Math.round((pt[0] - b[0]) / cs), 0, nx - 1), clamp(Math.round((pt[1] - b[1]) / cs), 0, ny - 1)];
    const free = (c) => { if (!g[c[1] * nx + c[0]]) return c; for (let r = 1; r < 25; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = c[0] + dx, y = c[1] + dy; if (x >= 0 && y >= 0 && x < nx && y < ny && !g[y * nx + x]) return [x, y]; } return c; };
    const s = free(ci(p)), t = free(ci(q)), N = nx * ny, gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), open = [], si = s[1] * nx + s[0], ti = t[1] * nx + t[0];
    const h = (i) => { const x = i % nx, y = (i / nx) | 0, dx = Math.abs(x - t[0]), dy = Math.abs(y - t[1]); return dx + dy - 0.59 * Math.min(dx, dy); };
    const push = (i, f) => { open.push([f, i]); let k = open.length - 1; while (k) { const pk = (k - 1) >> 1; if (open[pk][0] <= open[k][0]) break; [open[pk], open[k]] = [open[k], open[pk]]; k = pk; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
    gs[si] = 0; push(h(si), si); let it = 0;
    while (open.length && it++ < 80000) { const [, i] = pop(); if (i === ti) break; const x = i % nx, y = (i / nx) | 0;
      for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue; const j = Y * nx + X; if (g[j] && j !== ti) continue; if (dx && dy && (g[y * nx + X] || g[Y * nx + x])) continue; const ng = gs[i] + c; if (ng < gs[j]) { gs[j] = ng; from[j] = i; push(ng + h(j), j); } } }
    if (from[ti] < 0 && ti !== si) return [p, q];
    const cells = []; for (let i = ti; i >= 0 && i !== si; i = from[i]) cells.push(i); cells.push(si); cells.reverse();
    const pts = cells.map((i) => [b[0] + (i % nx) * cs, b[1] + ((i / nx) | 0) * cs]);
    const los = (a, c) => { const n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / (cs / 2)); for (let k = 1; k < n; k++) { const x = a[0] + ((c[0] - a[0]) * k) / n, y = a[1] + ((c[1] - a[1]) * k) / n, ii = clamp(Math.round((x - b[0]) / cs), 0, nx - 1), jj = clamp(Math.round((y - b[1]) / cs), 0, ny - 1); if (g[jj * nx + ii]) return false; } return true; };
    const out = [p]; let k = 0; while (k < pts.length - 1) { let j = pts.length - 1; while (j > k + 1 && !los(pts[k], pts[j])) j--; out.push(pts[j]); k = j; } out.push(q); return out;
  }
  reset(model) {
    this.G = this.grid(); this.cache = new Map(); this.heat = new Map(); this.hits = 0; this.contact = new Set(); this.t = 0;
    this.A = this.data(model).actors.map((a, i) => { const s0 = this.station(a.plan[0], null); return { a, i, pos: s0 ? [...s0.p] : [0, 0], step: 0, wait: 0.5, path: null, pi: 0, loopD: 0, t0: 0, last: null, label: s0 ? s0.label : '-', miss: !s0, ph: 0 }; });
    this.buildMeshes();
  }
  next(A) {
    const a = A.a; if (!a.plan.length) return; if (A.step === 0 && A.t0) { A.last = { d: A.loopD, t: this.t - A.t0 }; A.loopD = 0; A.t0 = this.t; } if (!A.t0) A.t0 = this.t;
    A.step = (A.step + 1) % a.plan.length; const fam = a.plan[A.step], s = this.station(fam, A.pos); if (!s) { A.miss = true; A.wait = 1; A.label = `${FAMN[fam] || fam} 없음`; return; }
    A.miss = false; A.label = s.label; const key = `${Math.round(A.pos[0] / 100)},${Math.round(A.pos[1] / 100)}>${Math.round(s.p[0] / 100)},${Math.round(s.p[1] / 100)}`;
    if (!this.cache.has(key)) this.cache.set(key, this.astar(this.G, A.pos, s.p)); A.path = this.cache.get(key).map((p) => [...p]); A.pi = 1;
  }
  update(dt) {
    if (!this.on) return; if (this.run) { dt *= this.speed; this.t += dt; const V = 1100;
      for (const A of this.A) {
        if (A.wait > 0) { A.wait -= dt; A.ph += dt * 3; if (A.wait <= 0) this.next(A); continue; }
        if (!A.path || A.pi >= A.path.length) { A.wait = DWELL[A.a.plan[A.step]] || 2; continue; }
        const q = A.path[A.pi], dx = q[0] - A.pos[0], dy = q[1] - A.pos[1], d = Math.hypot(dx, dy), st = V * dt; A.ph += dt * 9;
        if (d <= st) { A.pos = [...q]; A.pi++; A.loopD += d; } else { A.pos[0] += (dx / d) * st; A.pos[1] += (dy / d) * st; A.loopD += st; } A.dir = Math.atan2(dy, dx);
        const hk = Math.round(A.pos[0] / 300) + ',' + Math.round(A.pos[1] / 300); this.heat.set(hk, (this.heat.get(hk) || 0) + dt);
      }
      for (let i = 0; i < this.A.length; i++) for (let j = i + 1; j < this.A.length; j++) { const a = this.A[i], b = this.A[j], k = i + '-' + j, d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]); if (d < 450) { if (!this.contact.has(k)) { this.contact.add(k); this.hits++; } } else this.contact.delete(k); }
    }
    this.draw();
    if ((this._ti = (this._ti || 0) + dt) > 0.5) { this._ti = 0; this.onInfo(); }
    if (this.follow >= 0 && this.A[this.follow]) { const A = this.A[this.follow], c = this.e.controls; c.target.lerp(new THREE.Vector3(A.pos[0] * MM, 1.1, A.pos[1] * MM), 0.08); }
  }
  buildMeshes() {
    for (const c of [...this.root.children]) { this.root.remove(c); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    this.root.position.y = (this.e.level.elev || 0) * MM; this.figs = this.A.map((A) => {
      const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: A.a.color, roughness: 0.6 }), skin = new THREE.MeshStandardMaterial({ color: '#f1d3b5', roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.75, 4, 10), mat); body.position.y = 0.6; const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin); head.position.y = 1.33;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14), new THREE.MeshStandardMaterial({ color: '#ffffff' })); cap.position.y = 1.45; const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.06), mat); nose.position.set(0.15, 1.0, 0);
      for (const m of [body, head]) m.castShadow = true; g.add(body, head, cap, nose); this.root.add(g);
      const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: A.a.color, dashSize: 0.15, gapSize: 0.1, depthTest: false })); line.renderOrder = 990; this.root.add(line); return { g, line };
    });
    this.heatMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }), 4000); this.heatMesh.count = 0; this.heatMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(12000), 3); this.root.add(this.heatMesh);
  }
  draw() {
    if (!this.figs) return; const m4 = new THREE.Matrix4(), c = new THREE.Color();
    this.A.forEach((A, i) => { const f = this.figs[i]; if (!f) return; const bob = A.wait > 0 ? 0 : Math.abs(Math.sin(A.ph)) * 0.03; f.g.position.set(A.pos[0] * MM, bob, A.pos[1] * MM); if (A.dir != null) f.g.rotation.y = -A.dir;
      const pts = A.path ? [A.pos, ...A.path.slice(A.pi)].map((p) => new THREE.Vector3(p[0] * MM, 0.05, p[1] * MM)) : []; f.line.geometry.dispose(); f.line.geometry = new THREE.BufferGeometry().setFromPoints(pts); if (pts.length > 1) f.line.computeLineDistances(); });
    let n = 0, mx = 0; if (this.heatOn) { for (const v of this.heat.values()) mx = Math.max(mx, v); for (const [k, v] of this.heat) { if (n >= 4000) break; const [i, j] = k.split(',').map(Number), t = v / (mx || 1); m4.makeTranslation(i * 0.3, 0.02, j * 0.3); this.heatMesh.setMatrixAt(n, m4); c.setHSL(0.6 - 0.6 * t, 0.85, 0.5); this.heatMesh.setColorAt(n, c); n++; } }
    this.heatMesh.count = n; this.heatMesh.instanceMatrix.needsUpdate = true; if (this.heatMesh.instanceColor) this.heatMesh.instanceColor.needsUpdate = true;
  }
  start(model) { if (!this.data(model).actors.length) this.add(model, 'fry'); this.reset(model); this.on = true; this.run = true; this.root.visible = true; }
  stop() { this.on = false; this.run = false; this.root.visible = false; this.follow = -1; }
}
