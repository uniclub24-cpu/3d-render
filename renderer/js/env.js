// 배경(상권) 그리기 — 기존 앱 "배경 넣기"(pro6 buildEnv · pro8 배경 레벨)를 그대로 옮김
// 매장 정면(출입문 쪽)을 기준으로 길 · 보도 · 주변 건물 · 나무 · 아파트를 러프한 조감도로 세운다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material } from './materials.js';
import { MM, levelBounds } from './builder.js';

export const ENVTYPES = [
  ['basic', '기본 거리'], ['plaza', '프라자상권'], ['apt', '아파트상가'], ['main', '메인상권'], ['park', '공원 앞 상가'], ['none', '배경 없음'],
];
export const ENVCOL = [['bld', '주변 건물'], ['glass', '유리 · 창'], ['apt', '아파트'], ['road', '도로'], ['walk', '보도 · 바닥'], ['green', '나무 · 잔디']];
export const ENVLV = { 5: [1, 1], 4: [0.8, 0.85], 3: [0.6, 0.7], 2: [0.42, 0.5], 1: [0.25, 0.3] };
export function env0() { return { type: 'basic', front: 'auto', hk: 1, nk: 1, colors: { bld: '#cfd3d8', glass: '#7fa3bf', apt: '#e6e2da', road: '#4a4d52', walk: '#bdbab3', green: '#6e9a55' } }; }
export function envOf(model) { if (!model.env) model.env = env0(); model.env.colors = { ...env0().colors, ...(model.env.colors || {}) }; return model.env; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const shade = (hex, k) => { const c = new THREE.Color(hex); c.r = clamp(c.r * k, 0, 1); c.g = clamp(c.g * k, 0, 1); c.b = clamp(c.b * k, 0, 1); return '#' + c.getHexString(); };

/** 매장 정면: 설정값, 없으면 문이 붙은 바깥쪽 */
export function envFront(level, E, b) {
  if (E.front && E.front !== 'auto') return E.front;
  let best = null;
  for (const o of level.openings) {
    if (!/door|auto|slide|glass|fold|shutter|arch|full/.test(o.type)) continue; const w = level.walls.find((q) => q.id === o.wall); if (!w) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, m = [w.x1 + ((w.x2 - w.x1) * o.t) / L, w.y1 + ((w.y2 - w.y1) * o.t) / L];
    const d = { N: Math.abs(m[1] - b[1]), S: Math.abs(m[1] - b[3]), W: Math.abs(m[0] - b[0]), E: Math.abs(m[0] - b[2]) };
    for (const [k, v] of Object.entries(d)) if (!best || v < best.v) best = { k, v };
  }
  return best && best.v < 1500 ? best.k : 'S';
}

/** 배경 Group (mm → m). above = 매장 위층 건물도 세울지 (위에서 내려다볼 때는 끔) */
export function buildEnv(level, E, { above = false, slabH = 3300, ceilingH = 2700 } = {}) {
  const root = new THREE.Group(); root.name = '배경'; const type = E.type || 'basic'; if (type === 'none') return root;
  const bins = new Map(); // (재질 · 색 · 투명도)마다 합쳐서 가볍게
  const add = (geo, col, key = 'plain', al) => { const k = `${key}|${col}|${al ?? ''}`; if (!bins.has(k)) bins.set(k, { key, col, al, g: [] }); bins.get(k).g.push(geo); };
  const box = (x0, x1, y0, y1, z0, z1, col, key, al) => { if (x1 - x0 < 1 || y1 - y0 < 1 || z1 - z0 < 1) return; const g = new THREE.BoxGeometry((x1 - x0) * MM, (y1 - y0) * MM, (z1 - z0) * MM); g.translate(((x0 + x1) / 2) * MM, ((y0 + y1) / 2) * MM, ((z0 + z1) / 2) * MM); add(g, col, key, al); };
  const cyl = (x, z, r, y0, y1, col, key, n = 8) => { const g = new THREE.CylinderGeometry(r * MM, r * MM, (y1 - y0) * MM, n); g.translate(x * MM, ((y0 + y1) / 2) * MM, z * MM); add(g, col, key); };
  const sph = (x, y, z, rx, ry, rz, col) => { const g = new THREE.SphereGeometry(1, 10, 7); g.scale(rx * MM, ry * MM, rz * MM); g.translate(x * MM, y * MM, z * MM); add(g, col, 'plain'); };
  const b = levelBounds(level), C = E.colors, EK = { h: E.hk ?? 1, n: E.nk ?? 1 };
  if (type === 'basic') {
    box(b[0] - 20000, b[2] + 20000, -60 - 120, -40 - 120, b[1] - 20000, b[3] + 20000, '#9a9c98', 'concrete');
    box(b[0] - 20000, b[2] + 20000, -40 - 120, -20 - 120, b[1] - 9000, b[1] - 3500, '#4a4c50', 'concrete');
    const rnd = (i) => ((i * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 9; i++) { if (rnd(i + 3) >= EK.n) continue; const x = b[0] - 6000 + i * 3200, hh = (6000 + rnd(i) * 9000) * EK.h; box(x, x + 2800, 0, hh, b[1] - 16000, b[1] - 10000, ['#c9c3b8', '#a9b4bd', '#d8d2c6', '#8f99a3'][i % 4], 'concrete'); sph(x + 1400, 3200, b[1] - 3000, 1100, 1500, 1100, '#5d7f45'); cyl(x + 1400, b[1] - 3000, 90, 0, 2200, '#5a4a3a', 'plain'); }
    return finish(root, bins);
  }
  const F = envFront(level, E, b), L = F === 'N' || F === 'S' ? b[2] - b[0] : b[3] - b[1], D = F === 'N' || F === 'S' ? b[3] - b[1] : b[2] - b[0];
  // (a: 정면을 따라, o: 정면에서 바깥쪽) → 도면 좌표
  const M = (a, o) => (F === 'S' ? [b[0] + a, b[3] + o] : F === 'N' ? [b[2] - a, b[1] - o] : F === 'E' ? [b[2] + o, b[3] - a] : [b[0] - o, b[1] + a]);
  const lb = (a0, a1, o0, o1, y0, y1, col, key = 'plain', al) => { const p = M(a0, o0), q = M(a1, o1); box(Math.min(p[0], q[0]), Math.max(p[0], q[0]), y0, y1, Math.min(p[1], q[1]), Math.max(p[1], q[1]), col, key, al); };
  const tree = (a, o, h = 5200) => { const [x, z] = M(a, o); cyl(x, z, 110, -20, h * 0.45, '#5a4a3a', 'plain'); sph(x, h * 0.62, z, h * 0.2, h * 0.3, h * 0.2, shade(C.green, 0.9 + (Math.abs(Math.round(a * 7 + o * 3)) % 5) * 0.05)); };
  const bands = (a0, a1, o0, o1, base, h, col, fh = 3400) => { for (let y = base + 900; y + 1300 < base + h; y += fh) lb(a0 - 30, a1 + 30, o0 - 30, o1 + 30, y, y + 1500, col, 'plain'); };
  const near = (a0, a1, o0) => o0 > -D - 9000 && o0 < 12000 && a1 > -20000 && a0 < L + 20000;
  const bld = (a0, a1, o0, o1, h, col, base = 0, glass = C.glass) => {
    if (EK.n < 1 && !near(a0, a1, o0) && ((Math.abs(Math.round(a0 * 0.37 + o0 * 0.61)) >> 7) % 100) / 100 >= EK.n) return;
    h = base < 1000 || base > 4000 ? Math.max(3200, h * EK.h) : Math.max(1500, h * EK.h);
    lb(a0, a1, o0, o1, base, base + h, col, 'concrete'); bands(a0, a1, o0, o1, base, h, glass); lb(a0 - 40, a1 + 40, o0 - 40, o1 + 40, base + h, base + h + 400, shade(col, 0.85));
  };
  const road = (o0, o1, lanes, a0 = -90000, a1 = L + 90000) => {
    lb(a0, a1, o0, o1, -40, -25, C.road); lb(a0, a1, o0 - 220, o0, -40, 130, '#d9d6cf'); lb(a0, a1, o1, o1 + 220, -40, 130, '#d9d6cf');
    const lw = (o1 - o0) / lanes; for (let k = 1; k < lanes; k++) { const o = o0 + lw * k; if (k === lanes / 2) { lb(a0, a1, o - 110, o - 20, -25, -18, '#e9c43a'); lb(a0, a1, o + 20, o + 110, -25, -18, '#e9c43a'); } else for (let a = a0; a < a1; a += 6000) lb(a, a + 3000, o - 60, o + 60, -25, -18, '#f2f2f2'); }
    const cw = clamp(L / 2, 2000, L - 2000); for (let s = -2; s <= 2; s++) lb(cw + s * 1000 - 250, cw + s * 1000 + 250, o0 + 300, o1 - 300, -25, -17, '#f2f2f2');
  };
  const hs = Math.max(slabH || 3300, (ceilingH || 2700) + 400);
  lb(-120000, L + 120000, -D - 120000, 120000, -60 - 120, -40 - 120, C.walk, 'concrete');
  const aptRow = (o0, n, a0, h0, dep = 13000, gap = 9000) => { for (let i = 0; i < n; i++) { const a = a0 + i * (30000 + gap); bld(a, a + 30000, o0, o0 + dep, h0 + ((i * 7) % 3) * 6000, shade(C.apt, 1 - (i % 2) * 0.05), 0, shade(C.glass, 0.8)); } };
  if (type === 'plaza') {
    for (const [a0, a1] of [[-17000, -8500], [-8500, 0], [L, L + 8500], [L + 8500, L + 17000]]) { lb(a0, a1, -D, 0, 0, 4500, C.bld, 'concrete'); lb(a0 + 250, a1 - 250, -15, 40, 200, 4000, C.glass, 'glass', 0.55); }
    for (const [a0, a1] of [[-17000, 0], [L, L + 17000]]) bld(a0, a1, -D - 2500, 0, 36000, C.bld, 4500);
    if (above) bld(0, L, -D - 2500, 0, 40500 - hs, C.bld, hs); else lb(0, L, -D - 2500, -D, 0, 4500, C.bld, 'concrete');
    lb(-30000, L + 30000, 0, 9500, -40, -12, shade(C.walk, 1.08), 'tile');
    for (let a = -14000; a < L + 14000; a += 7000) { lb(a - 700, a + 700, 6200, 7600, -12, 450, '#9aa0a6', 'concrete'); tree(a, 6900, 4600); }
    road(9500, 30500, 6); road(-90000, 9500, 6, L + 19000, L + 40000);
    bld(-45000, -18000, 34000, 52000, 48000, shade(C.bld, 0.95)); bld(-12000, 14000, 34000, 50000, 30000, shade(C.bld, 1.05)); bld(18000, 44000, 34000, 54000, 62000, C.apt, 0, shade(C.glass, 0.8)); bld(L + 44000, L + 70000, 34000, 52000, 40000, shade(C.bld, 0.9));
    aptRow(60000, 5, -60000, 50000); aptRow(-D - 30000, 4, -50000, 55000); bld(L + 44000, L + 66000, -D - 6000, 6000, 28000, shade(C.bld, 0.92));
  }
  if (type === 'apt') {
    const H2 = 7800;
    for (const [a0, a1] of [[-30000, 0], [L, L + 30000]]) { lb(a0, a1, -D, 0, 0, H2, C.bld, 'concrete'); lb(a0, a1, -D, 0, H2, H2 + 500, shade(C.bld, 0.85)); for (let a = a0; a < a1; a += 6000) { lb(a + 250, Math.min(a + 5750, a1 - 250), -15, 40, 150, 3000, C.glass, 'glass', 0.55); lb(a + 250, Math.min(a + 5750, a1 - 250), -15, 40, 4300, 6800, shade(C.glass, 0.85), 'glass', 0.7); } lb(a0, a1, 0, 120, 3150, 3950, shade(C.bld, 1.08)); }
    if (above) { lb(0, L, -D, 0, hs, H2, C.bld, 'concrete'); lb(0, L, -D, 0, H2, H2 + 500, shade(C.bld, 0.85)); lb(250, L - 250, -15, 40, 4300, 6800, shade(C.glass, 0.85), 'glass', 0.7); }
    lb(0, L, 0, 120, 3150, 3950, shade(C.bld, 1.08));
    for (let a = -30000; a < L + 30000; a += 1500) { const [x, z] = M(a, 5200); cyl(x, z, 60, -20, 900, '#3a3d42', 'plain'); }
    for (let a = -26000; a < L + 30000; a += 9000) tree(a, 4000, 5600);
    road(5600, 19600, 4); lb(-90000, L + 90000, 21500, 22100, -20, 1200, shade(C.apt, 0.8), 'concrete');
    aptRow(30000, 5, -70000, 50000); aptRow(58000, 5, -55000, 62000); aptRow(-D - 26000, 5, -60000, 58000); aptRow(-D - 56000, 5, -45000, 70000);
  }
  if (type === 'main') {
    const ws = [6000, 8500, 7000, 9000, 6500], hs2 = [9000, 13500, 16500, 11000, 20000], pal = [1, 0.92, 1.06, 0.86, 0.98];
    const row = (o0, o1, from, to, k0, faceO) => { let a = from, i = k0; while (from < to ? a < to : a > to) { const w = ws[i % 5], a0 = from < to ? a : a - w, a1 = from < to ? a + w : a; bld(a0, a1, o0, o1, hs2[i % 5], shade(C.bld, pal[i % 5]), 0); lb(a0 + 300, a0 + 800, faceO - (faceO > 0 ? 700 : 0), faceO + (faceO > 0 ? 0 : 700), 3600, 8200, shade(C.bld, 1.15)); a = from < to ? a + w : a - w; i++; } };
    row(-D, 0, 0, -60000, 0, 0); row(-D, 0, L, L + 60000, 2, 0);
    if (above) bld(0, L, -D, 0, 12000 - hs, C.bld, hs);
    lb(-70000, L + 70000, 0, 9000, -40, -12, shade(C.walk, 1.1), 'tile');
    for (let a = -50000; a < L + 50000; a += 12000) { const [x, z] = M(a, 8300); cyl(x, z, 70, -12, 4600, '#3a3d42', 'plain'); const [x2, z2] = M(a, 7800); box(Math.min(x, x2) - 120, Math.max(x, x2) + 120, 4500, 4650, Math.min(z, z2) - 120, Math.max(z, z2) + 120, '#3a3d42'); }
    row(9000, 21000, L + 4000, -60000, 3, 9000); row(9000, 21000, L + 4000, L + 60000, 1, 9000);
    road(21000, 28000, 2); row(28500, 42000, 0, -60000, 4, 28500); row(28500, 42000, 0, L + 60000, 0, 28500); aptRow(-D - 30000, 4, -50000, 50000);
  }
  if (type === 'park') {
    for (const [a0, a1] of [[-20000, 0], [L, L + 20000]]) bld(a0, a1, -D, 0, 11000, C.bld, 0);
    for (const [a0, a1] of [[-20000, 0], [L, L + 20000]]) for (let a = a0; a < a1; a += 5000) lb(a + 250, Math.min(a + 4750, a1 - 250), -15, 40, 150, 3000, C.glass, 'glass', 0.55);
    if (above) bld(0, L, -D, 0, 11000 - hs, C.bld, hs);
    for (let a = -18000; a < L + 20000; a += 8000) tree(a, 2600, 5000);
    road(4200, 11200, 2);
    lb(-80000, L + 80000, 12000, 90000, -40, -22, C.green, 'grass'); lb(-80000, L + 80000, 11400, 12000, -40, 300, '#c9c6bd');
    lb(-80000, L + 80000, 16500, 19500, -22, -14, shade(C.walk, 1.12), 'tile'); lb(L / 2 - 1500, L / 2 + 1500, 12000, 90000, -22, -14, shade(C.walk, 1.12), 'tile');
    let k = 0; for (let o = 23000; o < 86000; o += 6500) for (let a = -70000; a < L + 70000; a += 6500) { k++; const ja = (((k * 37) % 19) - 9) * 260, jo = (((k * 53) % 17) - 8) * 260; if (Math.abs(a + ja - L / 2) < 3500) continue; if ((k * 13) % 7 === 0) continue; tree(a + ja, o + jo, 4800 + ((k * 7) % 5) * 700); }
    for (let a = -40000; a < L + 40000; a += 9000) lb(a, a + 1600, 20200, 20700, -14, 450, '#8a6a4a', 'wood');
    aptRow(-D - 26000, 5, -60000, 55000); aptRow(-D - 56000, 5, -45000, 65000);
  }
  return finish(root, bins);
}
function finish(root, bins) {
  for (const { key, col, al, g } of bins.values()) { const m = new THREE.Mesh(mergeGeometries(g), material(key, col, al)); m.receiveShadow = true; m.castShadow = !(al < 1); root.add(m); g.forEach((x) => x.dispose()); }
  return root;
}
