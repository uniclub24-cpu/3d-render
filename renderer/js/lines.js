// 배관 · 전선 · 덕트 (기존 앱 LINEKINDS · P.lines) + 설치물 투시(X-ray) 분류
// level.lines = [{ id, kind, pts: [[x, y], …], w?(굵기 mm), depth?(매립 깊이), off?(천장에서 내려온 거리) }]
import * as THREE from 'three';
const MM = 0.001;
export const LINEKINDS = {
  wire: { name: '전기 배선', color: '#f2d24a', layer: 'elec', z: 'floor', w: 30 },
  ceilwire: { name: '천장 속 배선', color: '#c9a0f2', layer: 'ceil', z: 'above', w: 30 },
  water: { name: '급수 배관', color: '#4f9cf9', layer: 'plumb', z: 'floor', w: 40 },
  drainpipe: { name: '배수 배관', color: '#38c1b0', layer: 'plumb', z: 'floor', w: 80 },
  gas: { name: '가스 배관', color: '#f28b3a', layer: 'plumb', z: 'mid', w: 30 },
  duct: { name: '환기 덕트', color: '#a9adb5', layer: 'ceil', z: 'above', w: 300 },
  supplyDuct: { name: '급기관', color: '#7fb3d5', layer: 'ceil', z: 'above', w: 250 },
  exhaustDuct: { name: '배기관', color: '#b0a49a', layer: 'ceil', z: 'above', w: 300 },
  lan: { name: '랜선', color: '#5856d6', layer: 'ceil', z: 'above', w: 10 },
  embDrain: { name: '매립 배수관', color: '#38c1b0', layer: 'floorL', z: 'below', w: 100 },
  embWater: { name: '매립 급수관', color: '#4f9cf9', layer: 'floorL', z: 'below', w: 25 },
  embConduit: { name: '매립 전선관', color: '#f2d24a', layer: 'floorL', z: 'below', w: 22 },
  embCable: { name: '매립 케이블', color: '#ff9f0a', layer: 'floorL', z: 'below', w: 15 },
  embGas: { name: '매립 가스관', color: '#f28b3a', layer: 'floorL', z: 'below', w: 25 },
  cPipe: { name: '천장 배관', color: '#a9adb5', layer: 'ceiling', z: 'hang', w: 50 },
  cWire: { name: '천장 전선', color: '#2b2d31', layer: 'ceiling', z: 'hang', w: 12 },
  cFrame: { name: '천장틀 (M바)', color: '#8f98a3', layer: 'ceiling', z: 'frame', w: 40 },
};
/** 설치물 투시 분류: floor(바닥 매립 · 바닥 배관) · wall(벽 속 전선 · 가스) · ceil(천장 속) */
export const lineCat = (k) => (k.z === 'below' || (k.layer === 'plumb' && k.z === 'floor') ? 'floor' : k.layer === 'elec' || k.z === 'mid' ? 'wall' : ['above', 'hang', 'frame'].includes(k.z) ? 'ceil' : null);
export const XRN = { floor: '바닥 매립 · 배관', wall: '벽 속 전선 · 가스', ceil: '천장 속 배기 · 급기 · 전선' };
/** 기물도 분류 (콘센트 · 수전 · 천장 설비 등) */
export function itemCat(L) { if (!L) return null; if (L.layer === 'elec') return 'wall'; if (L.layer === 'plumb' || L.shape === 'drainpt' || L.drain === 'out') return 'floor'; if (L.layer === 'ceil' || L.layer === 'ceiling') return 'ceil'; return null; }
export function lineZ(k, l, level) { const H = level.ceilingH || 2700, S = level.slabH || 3300; return k.z === 'above' ? (H + S) / 2 : k.z === 'mid' ? 500 : k.z === 'below' ? -(l.depth ?? 80) - k.w / 2 : k.z === 'hang' ? S - (l.off ?? 300) : k.z === 'frame' ? H + 30 : 20; }
export function buildLines(level) {
  const root = new THREE.Group(); root.name = '배관 · 전선'; const mats = new Map();
  for (const l of level.lines || []) {
    const k = LINEKINDS[l.kind]; if (!k || !l.pts || l.pts.length < 2) continue; const w = l.w || k.w, z = lineZ(k, l, level), round = !/duct|Duct|Frame/.test(l.kind);
    const col = l.color || k.color; if (!mats.has(col)) mats.set(col, new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: /duct|Duct|cPipe|Frame/.test(l.kind) ? 0.6 : 0.05 }));
    for (let i = 1; i < l.pts.length; i++) {
      const [x1, y1] = l.pts[i - 1], [x2, y2] = l.pts[i], L = Math.hypot(x2 - x1, y2 - y1); if (L < 1) continue;
      const g = round ? new THREE.CylinderGeometry((w / 2) * MM, (w / 2) * MM, (L + w) * MM, 10) : new THREE.BoxGeometry((L + w) * MM, Math.min(w, 300) * MM, w * MM);
      if (round) g.rotateZ(Math.PI / 2);
      const m = new THREE.Mesh(g, mats.get(col)); m.position.set(((x1 + x2) / 2) * MM, z * MM, ((y1 + y2) / 2) * MM); m.rotation.y = -Math.atan2(y2 - y1, x2 - x1); m.castShadow = false; m.userData.xr = lineCat(k); m.userData.lineId = l.id; root.add(m);
    }
  }
  return root;
}
