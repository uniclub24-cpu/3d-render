// 공기 흐름 (v2.1.27): 3D 입자 + 꼬리선.
// - 급기 디퓨저: 아래 · 바깥으로 내뿜는 제트 → 일단 아래로 내려와 눈높이까지 퍼진 뒤 배기로 간다
// - 배기 · 후드: 3D 흡입(가까울수록 강함, 멀면 약함) → 가까이 있으면 바로 빨려 가는 공기도 생긴다
// - 열원(튀김기 · 화구): 뜨거운 공기(빨강)가 솟고, 식거나 급기와 섞이면 흰색 → 파랑으로
// - 풍량: 급기 · 배기 팬 기본 1마력(≈3000 m³/h)을 디퓨저 수로 나눈다(1/n). 에어컨은 '켜기' 했을 때만 넣는다
// 색 = 온도 T (-1 차가움 파랑 · 0 흰색 · +1 뜨거움 빨강), 선은 얇고 약간 투명.
import * as THREE from 'three';
import { pointInPoly } from './slope.js';
const MM = 0.001, CMH_HP = 3000, MAXP = 1400, TR = 9; /* 꼬리 점 수 */
const corners = (it, pad = 0) => { const a = ((it.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2 + pad, hd = it.d / 2 + pad; return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.x + x * c - y * s, it.y + x * s + y * c]); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function airKind(it, L) {
  const t = it.type || '', sh = (L && L.shape) || '';
  if (/^(ac_|e_ac)/.test(t) || /에어컨/.test((L && L.name) || '')) return 'ac';
  if (sh === 'hood' || /hood/.test(t)) return /l_hood/.test(t) ? null : 'hood';
  if (/^supply/.test(t)) return 'in';
  if (/^exhaust|^fan$|^vent$|wallvent/.test(t)) return 'out';
  if (L && L.air) return L.air; return null;
}
export function heatK(it, L) { if (!L || L.layer === 'ceil') return 0; const s = it.type + ' ' + (L.shape || ''); let k = /fryer|noodle/.test(s) ? 1.7 : /wok|range|grill|fire/.test(s) ? 1.5 : /griddle/.test(s) ? 1.15 : /oven|combi|pizza|salam|steam/.test(s) ? 0.6 : 0; if (!k && L.gas && L.layer === 'floor') k = 1; if (k) k *= 1 + Math.min(0.8, (L.kw || 0) / 40) + (L.gas ? 0.2 : 0); return k; }

export class AirSim {
  constructor(engine) {
    this.e = engine; this.on = false; this.smoke = true; this.parts = []; this.src = []; this.acc = 0; this.sacc = 0; this.racc = 0; this.cap = 0; this.esc = 0; this.onInfo = () => {};
    const geo = new THREE.BufferGeometry(); this.pos = new Float32Array(MAXP * (TR - 1) * 2 * 3); this.col = new Float32Array(MAXP * (TR - 1) * 2 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage)); geo.setDrawRange(0, 0);
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false })); this.lines.frustumCulled = false; this.lines.renderOrder = 5;
    this.rings = new THREE.Group(); this.root = new THREE.Group(); this.root.name = '공기 흐름'; this.root.add(this.lines, this.rings); this.root.visible = false; engine.scene.add(this.root);
    this._c = new THREE.Color(); this._t = 0;
  }
  /** 급기 · 배기 팬 마력 (층마다, 기본 1) */
  hp(L = this.e.level) { const h = (L && L.airHp) || {}; return { in: h.in ?? 1, out: h.out ?? 1 }; }
  refresh() {
    const L = this.e.level, lib = this.e.ctx.lib, zOf = this.e.ctx.zOf || ((it) => it.elev); if (!L) return; const S = [], H = L.ceilingH || 2700, HP = this.hp(L);
    const its = L.items.map((it) => ({ it, k: airKind(it, lib[it.type]) })).filter((q) => q.k), nIn = its.filter((q) => q.k === 'in').length, nOut = its.filter((q) => q.k === 'out').length;
    for (const { it, k } of its) {
      const Lb = lib[it.type] || {}, ceil = Lb.layer === 'ceil', z = ceil ? H - 40 : zOf(it) + (it.h || 300) / 2;
      if (k === 'in') S.push({ x: it.x, y: it.y, z, q: ((it.hp ?? HP.in / nIn) * CMH_HP) / 3600, kind: '급기', down: ceil, it });
      else if (k === 'out') S.push({ x: it.x, y: it.y, z, q: -((it.hp ?? HP.out / Math.max(1, nOut)) * CMH_HP) / 3600, kind: '배기', it });
      else if (k === 'hood') S.push({ x: it.x, y: it.y, z: zOf(it) + (it.h || 500) - 60, q: -((it.hp ?? 2) * CMH_HP) / 3600, kind: '후드', it });
      else if (k === 'ac' && it.acOn) { /* 켠 에어컨만: 찬 바람을 내뿜고 같은 양을 다시 빨아들인다 (순환) */
        const q = ((it.acHp ?? 1) * 2400) / 3600, a = (-(it.rot || 0) * Math.PI) / 180, fx = -Math.sin(a), fy = Math.cos(a); /* 앞(+d) 방향 */
        const type = Lb.shape === 'cassette' || ceil ? 'cassette' : Lb.layer === 'floor' ? 'stand' : 'wall';
        S.push({ x: it.x, y: it.y, z: type === 'stand' ? zOf(it) + (it.h || 1700) * 0.85 : z, q, kind: '에어컨', ac: type, fx, fy, cold: 1, it });
        S.push({ x: it.x - (type === 'cassette' ? 0 : fx * 80), y: it.y - (type === 'cassette' ? 0 : fy * 80), z: type === 'stand' ? zOf(it) + 500 : type === 'wall' ? zOf(it) + (it.h || 300) : z, q: -q, kind: '에어컨 흡입', it, ret: 1 });
      }
    }
    const b = this.bounds(L), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
    for (const o of L.openings) { if ((o.sill || 0) > 200 || !/door|auto|slide|arch|full/.test(o.type)) continue; const w = L.walls.find((q) => q.id === o.wall); if (!w) continue; const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, m = [w.x1 + ux * o.t, w.y1 + uy * o.t];
      let nx = -uy, ny = ux; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny < 0) { nx = -nx; ny = -ny; } const out = [m[0] - nx * 600, m[1] - ny * 600]; if ((L.rooms || []).some((r) => pointInPoly(out[0], out[1], r.pts)) || (out[0] > b[0] + 50 && out[0] < b[2] - 50 && out[1] > b[1] + 50 && out[1] < b[3] - 50)) continue;
      S.push({ x: m[0] + nx * 250, y: m[1] + ny * 250, z: 1000, q: 0.12, kind: '출입구', door: 1, nx, ny }); }
    this.src = S; this.H = H; this.root.position.y = (L.elev || 0) * MM; this.b = b;
    this.rooms = (L.rooms || []).filter((r) => r.pts && r.pts.length > 2);
    this.heat = L.items.map((it) => ({ it, k: heatK(it, lib[it.type]), z: zOf(it) + (it.h || 0) })).filter((h) => h.k > 0);
    this.hoods = S.filter((s) => s.kind === '후드').map((s) => ({ ...s, poly: corners(s.it, 200), z0: zOf(s.it) }));
    this.rings.clear(); for (const s of S) { if (s.door) continue; const r = clamp(160 + Math.abs(s.q) * 300, 160, 520) * MM, m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 28), new THREE.MeshBasicMaterial({ color: s.q > 0 ? '#5aa9f0' : '#e5484d', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(s.x * MM, s.z * MM - 0.01, s.y * MM); this.rings.add(m); }
    this.info();
  }
  bounds(L) { const xs = L.walls.flatMap((w) => [w.x1, w.x2]), ys = L.walls.flatMap((w) => [w.y1, w.y2]); return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [0, 0, 8000, 6000]; }
  start() { this.on = true; this.parts = []; this.cap = this.esc = 0; this.refresh(); this.root.visible = true; }
  stop() { this.on = false; this.root.visible = false; this.parts = []; this.lines.geometry.setDrawRange(0, 0); }
  inside(x, y) { const b = this.b; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false; return !this.rooms.length || this.rooms.some((r) => pointInPoly(x, y, r.pts)); }
  /** 배경 흐름 (mm/s): 3D 흡입(배기 · 후드 · 에어컨 흡입) + 약한 평면 흐름(급기 → 배기) */
  field(x, y, z) {
    let vx = 0, vy = 0, vz = 0;
    for (const s of this.src) {
      const dx = x - s.x, dy = y - s.y, dz = z - s.z, h2 = dx * dx + dy * dy;
      if (s.q < 0) { const r2 = (h2 + dz * dz) * 1e-6 + 0.09, r = Math.sqrt(r2), k = (s.q / (2 * Math.PI * r2)) * 1000 / r; vx += dx * 1e-3 * k; vy += dy * 1e-3 * k; vz += dz * 1e-3 * k; } /* 반구 흡입: Q / 2πr² */
      const k2 = (s.q * 260) / (h2 * 1e-6 + 2.2); vx += dx * 1e-3 * k2; vy += dy * 1e-3 * k2; /* 평면 흐름(질량 균형): 멀리서도 느리게 */
    }
    return [vx, vy, vz];
  }
  spawnJet(s, cold) {
    const sp = clamp(Math.sqrt(s.q / 0.25), 0.5, 1.8);
    if (s.ac === 'cassette' || (s.down && !s.ac)) { const a = Math.random() * Math.PI * 2, o = (s.ac ? 1.6 : 0.9) * sp; return { x: s.x + Math.cos(a) * 180, y: s.y + Math.sin(a) * 180, z: s.z - 30, vx: Math.cos(a) * o * 1000, vy: Math.sin(a) * o * 1000, vz: -(s.ac ? 0.9 : 1.7) * sp * 1000, T: cold }; }
    if (s.ac) { const j = (Math.random() - 0.5) * 0.7, fx = s.fx + -s.fy * j, fy = s.fy + s.fx * j; return { x: s.x + s.fx * 150, y: s.y + s.fy * 150, z: s.z - 40, vx: fx * 2.2 * sp * 1000, vy: fy * 2.2 * sp * 1000, vz: (s.ac === 'wall' ? -0.9 : -0.2) * sp * 1000, T: cold }; }
    const a = Math.random() * Math.PI * 2; return { x: s.x + Math.cos(a) * 120, y: s.y + Math.sin(a) * 120, z: s.z, vx: Math.cos(a) * 900 * sp, vy: Math.sin(a) * 900 * sp, vz: 0, T: cold };
  }
  info() { const n = (k) => this.src.filter((s) => s.kind === k).length, t = this.cap + this.esc, HP = this.hp(); this.onInfo({ in: n('급기'), out: n('배기'), hood: n('후드'), door: n('출입구'), ac: n('에어컨'), heat: (this.heat || []).length, capture: t > 30 ? Math.round((this.cap / t) * 100) : null, hpIn: HP.in, hpOut: HP.out }); }
  update(dt) {
    if (!this.on || !this.e.level) return; dt = Math.min(dt, 0.05); const b = this.b, H = this.H || 2700, jets = this.src.filter((s) => s.q > 0 && !s.door), doors = this.src.filter((s) => s.door); this._t += dt;
    const P = this.parts, room = MAXP - 260;
    // 1) 급기 · 에어컨 제트 (풍량 비례)
    const tot = jets.reduce((a, s) => a + s.q, 0); this.acc += dt * Math.min(70, 40 * tot);
    while (this.acc > 1 && P.length < room) { this.acc -= 1; let r = Math.random() * tot, s = jets[0]; for (const q of jets) { r -= q.q; if (r <= 0) { s = q; break; } } const p = this.spawnJet(s, s.cold ? -1 : -0.7); p.age = 0; p.k = 'jet'; p.tr = []; P.push(p); }
    // 2) 방 안 공기 (눈높이에 촘촘히) · 출입구 바람
    this.racc += dt * 26; while (this.racc > 1 && P.length < room) { this.racc -= 1; let x, y, ok = false; for (let t = 0; t < 6 && !ok; t++) { x = b[0] + Math.random() * (b[2] - b[0]); y = b[1] + Math.random() * (b[3] - b[1]); ok = this.inside(x, y); } if (!ok) continue; const z = Math.random() < 0.65 ? 900 + Math.random() * 900 : 300 + Math.random() * (H - 500); P.push({ x, y, z, vx: 0, vy: 0, vz: 0, T: 0, age: 0, k: 'room', tr: [] }); }
    for (const d of doors) if (Math.random() < dt * 3 && P.length < room) P.push({ x: d.x, y: d.y, z: 300 + Math.random() * 1500, vx: -d.nx * 500, vy: -d.ny * 500, vz: 0, T: 0.15, age: 0, k: 'door', tr: [] });
    // 3) 열원 (뜨거운 공기 · 연기)
    if (this.smoke && this.heat.length) { const th = this.heat.reduce((a, h) => a + h.k, 0); this.sacc += dt * Math.min(45, 12 * th); while (this.sacc > 1 && P.length < MAXP) { this.sacc -= 1; let r = Math.random() * th, h = this.heat[0]; for (const q of this.heat) { r -= q.k; if (r <= 0) { h = q; break; } } P.push({ x: h.it.x + (Math.random() - 0.5) * h.it.w * 0.6, y: h.it.y + (Math.random() - 0.5) * h.it.d * 0.6, z: h.z + 30, vx: 0, vy: 0, vz: 500 * h.k, T: 1, hk: h.k, age: 0, k: 'heat', tr: [] }); } }
    // 움직이기
    const cold = jets.filter((s) => s.cold !== undefined || s.kind === '급기');
    this.parts = P.filter((p) => {
      p.age += dt; const [fx, fy, fz] = this.field(p.x, p.y, p.z);
      const buoy = p.T * 420 * (p.k === 'heat' ? p.hk || 1 : 1); /* 뜨거우면 뜨고, 차가우면 가라앉음 */
      const turb = 140 + (p.k === 'heat' ? 220 * Math.exp(-p.age / 2) : 0), relax = p.k === 'jet' ? 0.7 : 2.2;
      let tz = fz + buoy; if (p.z > H - 250 && tz > 0) tz *= (H - p.z) / 250; /* 천장에 닿으면 옆으로 */
      const ip = 1 - Math.exp(-dt * relax); p.vx += (fx + (Math.random() - 0.5) * turb - p.vx) * ip; p.vy += (fy + (Math.random() - 0.5) * turb - p.vy) * ip; p.vz += (tz + (Math.random() - 0.5) * turb * 0.6 - p.vz) * ip;
      for (const hd of this.hoods) if (pointInPoly(p.x, p.y, hd.poly) && p.z > hd.z0 - 600 && p.z < hd.z + 300) { const dx = hd.x - p.x, dy = hd.y - p.y, d = Math.hypot(dx, dy) + 1, w = 900 * Math.abs(hd.q); p.vx += (dx / d) * w * dt * 4; p.vy += (dy / d) * w * dt * 4; p.vz += 1400 * Math.abs(hd.q) * dt * 4; }
      const sp = Math.hypot(p.vx, p.vy, p.vz); if (sp > 3200) { const k = 3200 / sp; p.vx *= k; p.vy *= k; p.vz *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.z < 40) { p.z = 40; p.vz = Math.abs(p.vz) * 0.3; } if (p.z > H - 20) { p.z = H - 20; p.vz = -Math.abs(p.vz) * 0.2; }
      // 온도: 주변(0)으로 식고, 급기 · 에어컨 바람 가까이서는 더 빨리 차가워진다
      let env = 0; for (const s of cold) { const d2 = ((p.x - s.x) ** 2 + (p.y - s.y) ** 2) * 1e-6 + ((p.z - s.z) ** 2) * 1e-6; if (d2 < 2.5) env = Math.min(env, -(1 - d2 / 2.5) * (s.cold ? 1 : 0.8)); }
      const kT = p.k === 'heat' ? (env < 0 ? 0.55 : 0.16) : env < 0 && p.T > env ? 0.8 : 0.22; p.T += (env - p.T) * (1 - Math.exp(-dt * kT));
      if (p.k === 'heat' && p.T > 0) { for (const hd of this.hoods) if (!pointInPoly(p.x, p.y, hd.poly) && p.z > hd.z0 - 700 && p.age > 1.2) { p.T -= dt * 0.35; break; } } /* 후드 밖으로 샌 열 → 식는다 */
      // 꼬리
      p.tt = (p.tt || 0) + dt; if (p.tt > 0.07 || !p.tr.length) { p.tt = 0; p.tr.unshift([p.x, p.y, p.z]); if (p.tr.length > TR) p.tr.pop(); } else p.tr[0] = [p.x, p.y, p.z];
      // 빨려 들어감 (배기 · 후드 · 에어컨 흡입)
      for (const s of this.src) if (s.q < 0) { const d2 = (p.x - s.x) ** 2 + (p.y - s.y) ** 2 + (p.z - s.z) ** 2; if (d2 < 230 * 230 * (1 + Math.abs(s.q))) { if (p.k === 'heat') { if (s.kind === '후드') this.cap++; else this.esc++; } return false; } }
      if (p.k === 'heat' && p.age > 16) { this.esc++; return false; }
      return p.age < (p.k === 'room' ? 9 : 18) && p.x > b[0] - 400 && p.x < b[2] + 400 && p.y > b[1] - 400 && p.y < b[3] + 400;
    });
    // 그리기: 얇은 꼬리선, 온도 색, 꼬리로 갈수록 흐리게
    let n = 0; const pos = this.pos, col = this.col, c = this._c, blue = new THREE.Color('#1f74e0'), red = new THREE.Color('#ff3b30'), white = new THREE.Color('#c3cfdc');
    for (const p of this.parts) {
      const tr = p.tr; if (tr.length < 2) continue; const T = clamp(p.T, -1, 1); c.copy(white).lerp(T < 0 ? blue : red, Math.min(1, Math.abs(T) * 1.15));
      const fade = Math.min(1, p.age / 0.4) * (p.k === 'room' ? Math.min(1, (9 - p.age) / 1.5) : 1);
      for (let i = 0; i < tr.length - 1; i++) { const a = tr[i], b2 = tr[i + 1], o = n * 6, oc = n * 8, al0 = (1 - i / (TR - 1)) * 0.9 * fade, al1 = (1 - (i + 1) / (TR - 1)) * 0.9 * fade;
        pos[o] = a[0] * MM; pos[o + 1] = a[2] * MM; pos[o + 2] = a[1] * MM; pos[o + 3] = b2[0] * MM; pos[o + 4] = b2[2] * MM; pos[o + 5] = b2[1] * MM;
        col[oc] = c.r; col[oc + 1] = c.g; col[oc + 2] = c.b; col[oc + 3] = al0; col[oc + 4] = c.r; col[oc + 5] = c.g; col[oc + 6] = c.b; col[oc + 7] = al1; if (++n >= MAXP * (TR - 1)) break; }
    }
    const g = this.lines.geometry; g.setDrawRange(0, n * 2); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    if ((this._ti = (this._ti || 0) + dt) > 1) { this._ti = 0; this.info(); }
  }
}
