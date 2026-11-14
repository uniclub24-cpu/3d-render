// 공기 흐름 (기존 앱 "공기") + 열 · 연기 흐름 (v23): 급기 · 배기 · 후드 · 출입구를 소스로 한 2D 퍼텐셜 흐름에
// 튀김기 · 화구의 열 기둥(부력)과 연기를 얹는다. 연기가 후드에 빨려 들어가면 "포집", 오래 떠돌면 "샘".
import * as THREE from 'three';
import { pointInPoly } from './slope.js';
const MM = 0.001, CMH = 1600, MAXP = 900;
const sstep = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const corners = (it, pad = 0) => { const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2 + pad, hd = it.d / 2 + pad; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]); };
export function airKind(it, L) { const t = it.type || '', sh = (L && L.shape) || ''; if (sh === 'hood' || /hood/.test(t)) return 'hood'; if (/^supply|supplyfan/.test(t)) return 'in'; if (/^exhaust|exhaustfan|^fan$|^vent$|wallvent/.test(t)) return 'out'; if (L && L.air) return L.air; return null; }
export function heatK(it, L) { if (!L || L.layer === 'ceil') return 0; const s = it.type + ' ' + (L.shape || ''); let k = /fryer|noodle/.test(s) ? 1.7 : /wok|range|grill|fire/.test(s) ? 1.5 : /griddle/.test(s) ? 1.15 : /oven|combi|pizza|salam|steam/.test(s) ? 0.6 : 0; if (!k && L.gas && L.layer === 'floor') k = 1; if (k) k *= 1 + Math.min(0.8, (L.kw || 0) / 40) + (L.gas ? 0.2 : 0); return k; }

export class AirSim {
  constructor(engine) {
    this.e = engine; this.on = false; this.smoke = true; this.parts = []; this.src = []; this.acc = 0; this.sacc = 0; this.cap = 0; this.esc = 0; this.onInfo = () => {};
    const g = new THREE.BoxGeometry(1, 1, 1); this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), MAXP); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3); this.mesh.renderOrder = 5;
    this.rings = new THREE.Group(); this.root = new THREE.Group(); this.root.name = '공기 흐름'; this.root.add(this.mesh, this.rings); this.root.visible = false; engine.scene.add(this.root);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._c = new THREE.Color(); this._t = 0;
  }
  refresh() {
    const L = this.e.level, lib = this.e.ctx.lib, zOf = this.e.ctx.zOf || ((it) => it.elev); if (!L) return; const S = [], H = L.ceilingH || 2700;
    for (const it of L.items) { const Lb = lib[it.type], k = airKind(it, Lb); if (!k) continue; const hp = it.hp ?? (k === 'hood' ? 2 : 1), q = (k === 'in' ? 1 : -1) * hp * CMH; S.push({ x: it.x, y: it.y, z: zOf(it) + (k === 'hood' ? 200 : 0), q, kind: k === 'hood' ? '후드' : k === 'in' ? '급기' : '배기', it }); }
    const b = this.bounds(L), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    for (const o of L.openings) { if ((o.sill || 0) > 200 || !/door|auto|slide|arch|full/.test(o.type)) continue; const w = L.walls.find((q) => q.id === o.wall); if (!w) continue; const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, m = [w.x1 + ux * o.t, w.y1 + uy * o.t];
      // 바깥벽의 문만: 벽 바깥쪽이 매장 테두리 밖이면
      let nx = -uy, ny = ux; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny < 0) { nx = -nx; ny = -ny; } const out = [m[0] - nx * 600, m[1] - ny * 600]; if ((L.rooms || []).some((r) => pointInPoly(out[0], out[1], r.pts)) || (out[0] > b[0] + 50 && out[0] < b[2] - 50 && out[1] > b[1] + 50 && out[1] < b[3] - 50)) continue;
      S.push({ x: m[0] + nx * 250, y: m[1] + ny * 250, z: 1000, q: 0.5 * CMH, kind: '출입구', door: 1 }); }
    this.src = S; this.H = H; this.root.position.y = (L.elev || 0) * MM;
    this.heat = L.items.map((it) => ({ it, k: heatK(it, lib[it.type]), z: zOf(it) + (it.h || 0) })).filter((h) => h.k > 0);
    this.hoods = this.src.filter((s) => s.kind === '후드').map((s) => ({ ...s, poly: corners(s.it, 250), z0: zOf(s.it) }));
    // 링: 소스 표시 (파랑 = 들어옴 · 빨강 = 빠짐)
    this.rings.clear(); for (const s of S) { const r = Math.min(600, 160 + Math.abs(s.q) / 40) * MM, m = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 28), new THREE.MeshBasicMaterial({ color: s.q > 0 ? '#7fc8f8' : '#e5484d', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(s.x * MM, s.z * MM, s.y * MM); this.rings.add(m); }
    this.info();
  }
  bounds(L) { const xs = L.walls.flatMap((w) => [w.x1, w.x2]), ys = L.walls.flatMap((w) => [w.y1, w.y2]); return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [0, 0, 8000, 6000]; }
  start() { this.on = true; this.parts = []; this.cap = this.esc = 0; this.refresh(); this.root.visible = true; }
  stop() { this.on = false; this.root.visible = false; this.parts = []; this.mesh.count = 0; }
  vel(x, y) { let vx = 0, vy = 0; for (const s of this.src) { const dx = x - s.x, dy = y - s.y, r2 = dx * dx + dy * dy + 250000, k = s.q / r2; vx += dx * k; vy += dy * k; } return [vx * 520, vy * 520]; }
  info() { const n = (k) => this.src.filter((s) => s.kind === k).length, t = this.cap + this.esc; this.onInfo({ in: n('급기'), out: n('배기'), hood: n('후드'), door: n('출입구'), heat: (this.heat || []).length, capture: t > 30 ? Math.round((this.cap / t) * 100) : null }); }
  update(dt) {
    if (!this.on || !this.e.level) return; const L = this.e.level, b = this.bounds(L), H = this.H || 2700, sinks = this.src.filter((s) => s.q < 0), srcs = this.src.filter((s) => s.q > 0); this._t += dt;
    // 공기 입자
    this.acc += dt; while (this.acc > 0.025 && this.parts.length < MAXP - 200) { this.acc -= 0.025; const tot = srcs.reduce((a, s) => a + s.q, 0);
      if (srcs.length && Math.random() < 0.8) { let r = Math.random() * tot, s = srcs[0]; for (const q of srcs) { r -= q.q; if (r <= 0) { s = q; break; } } const a = Math.random() * 6.28, rr = 150 + Math.random() * 250; this.parts.push({ x: s.x + Math.cos(a) * rr, y: s.y + Math.sin(a) * rr, z: s.z, age: 0, k: s.door ? 'door' : 'air' }); }
      else this.parts.push({ x: b[0] + Math.random() * (b[2] - b[0]), y: b[1] + Math.random() * (b[3] - b[1]), z: 1200 + Math.random() * 800, age: 0, k: 'air' }); }
    // 연기 (튀김기 · 화구 위에서)
    if (this.smoke && this.heat.length) { const tot = this.heat.reduce((a, h) => a + h.k, 0); this.sacc += dt * Math.min(40, 10 * tot); while (this.sacc > 1 && this.parts.length < MAXP) { this.sacc -= 1; let r = Math.random() * tot, h = this.heat[0]; for (const q of this.heat) { r -= q.k; if (r <= 0) { h = q; break; } } this.parts.push({ x: h.it.x + (Math.random() - 0.5) * h.it.w * 0.6, y: h.it.y + (Math.random() - 0.5) * h.it.d * 0.6, z: h.z + 30, vx: 0, vy: 0, vz: 600 * h.k, k: 'smoke', hk: h.k, sx: h.it.x, sy: h.it.y, age: 0 }); } }
    this.parts = this.parts.filter((p) => {
      const [ax, ay] = this.vel(p.x, p.y); p.age += dt;
      if (p.k === 'smoke') {
        const warm = Math.exp(-p.age / 2.8); let vx = ax + (Math.random() - 0.5) * 700 * p.hk * warm, vy = ay + (Math.random() - 0.5) * 700 * p.hk * warm, vz = (1000 * p.hk * warm + 140) * (1 - sstep((p.z - (H - 260)) / 200));
        if (p.z > H - 380) { const dx = p.x - p.sx, dy = p.y - p.sy, d = Math.hypot(dx, dy) + 1; vx += (dx / d) * 650 * p.hk * Math.exp(-p.age / 7); vy += (dy / d) * 650 * p.hk * Math.exp(-p.age / 7); } // 천장에서 옆으로 퍼짐
        for (const hd of this.hoods) if (pointInPoly(p.x, p.y, hd.poly) && p.z > hd.z0 - 700) { const dx = hd.x - p.x, dy = hd.y - p.y, d = Math.hypot(dx, dy) + 1, w = (700 * Math.abs(hd.q)) / CMH / (1 + p.hk * 0.35); vx += (dx / d) * w; vy += (dy / d) * w; vz += 500 * Math.abs(hd.q) / CMH; if (p.z > hd.z0 + 100 && d < 500) { this.cap++; return false; } }
        const ip = 1 - Math.exp(-dt * 2.2); p.vx += (vx - p.vx) * ip; p.vy += (vy - p.vy) * ip; p.vz += (vz - p.vz) * ip; const sp = Math.hypot(p.vx, p.vy, p.vz); if (sp > 2600) { p.vx *= 2600 / sp; p.vy *= 2600 / sp; p.vz *= 2600 / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.min(H - 40, p.z + p.vz * dt);
        if (p.age > 12) { this.esc++; return false; } return true;
      }
      const sp = Math.hypot(ax, ay), k = sp > 2600 ? 2600 / sp : 1; p.vx = ax * k; p.vy = ay * k; p.x += p.vx * dt; p.y += p.vy * dt;
      let near = null, nd = 1e12; for (const s of sinks) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < nd) { nd = d; near = s; } }
      if (near) p.z += (near.z - p.z) * Math.min(1, (dt * 1.2 * 2000) / (nd + 800)); if (near && nd < 320) return false;
      return p.age < 14 && p.x > b[0] - 500 && p.x < b[2] + 500 && p.y > b[1] - 500 && p.y < b[3] + 500;
    });
    // 그리기 (방향 막대)
    const base = 0; let n = 0;
    for (const p of this.parts) { const vx = p.vx || 0, vy = p.vy || 0, sp = Math.hypot(vx, vy); const len = p.k === 'smoke' ? 90 : Math.min(380, Math.max(120, sp * 0.16)); if (p.k !== 'smoke' && sp < 5) continue;
      this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(vy, vx)); this._m.compose(new THREE.Vector3(p.x * MM, base + p.z * MM, p.y * MM), this._q, new THREE.Vector3(len * MM, (p.k === 'smoke' ? 90 : 40) * MM, (p.k === 'smoke' ? 90 : 44) * MM));
      this.mesh.setMatrixAt(n, this._m); this._c.set(p.k === 'smoke' ? (p.age < 3 ? '#9a8f86' : '#c7c2bd') : p.k === 'door' ? '#7fc8f8' : '#2f8fd6'); this.mesh.setColorAt(n, this._c); if (++n >= MAXP) break; }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    if ((this._ti = (this._ti || 0) + dt) > 1) { this._ti = 0; this.info(); }
  }
}
