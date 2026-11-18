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
  brace: { name: '벽 보강재 (선반 · 기기 고정)', color: '#b07a3a', layer: 'plumb', z: 'mid', w: 60 },
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
export function lineZ(k, l, level) { if (l.z != null && isFinite(l.z)) return +l.z; /* 직접 넣은 높이(바닥에서 중심까지) */ const H = level.ceilingH || 2700, S = level.slabH || 3300; return k.z === 'above' ? (H + S) / 2 : k.z === 'mid' ? (l.h ?? 500) : k.z === 'below' ? -(l.depth ?? 80) - k.w / 2 : k.z === 'hang' ? S - (l.off ?? 300) : k.z === 'frame' ? H + 30 : 20; }
/** 원형인가: 사각 덕트로 바꾼 것(shape: 'rect') · 천장틀(M바)만 각지게 */
export const lineRound = (l) => (l.shape ? l.shape !== 'rect' : l.kind !== 'cFrame');
/** 꺾이는 곳을 부드럽게 (반지름 ≈ 굵기 × 1.5, 짧은 구간이면 그 절반까지) */
function bentPath(P, w, zM) {
  const V = P.map(([x, y]) => new THREE.Vector3(x * MM, zM, y * MM)), path = new THREE.CurvePath(); let cur = V[0].clone();
  for (let i = 1; i < V.length - 1; i++) {
    const a = V[i - 1], b = V[i], c = V[i + 1], la = a.distanceTo(b), lb = b.distanceTo(c), r = Math.min(w * 1.5 * MM, la / 2, lb / 2);
    const p1 = b.clone().add(a.clone().sub(b).setLength(r)), p2 = b.clone().add(c.clone().sub(b).setLength(r));
    if (cur.distanceTo(p1) > 1e-5) path.add(new THREE.LineCurve3(cur.clone(), p1)); if (r > 1e-5) path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2)); cur = p2;
  }
  path.add(new THREE.LineCurve3(cur, V[V.length - 1])); return path;
}
export function buildLines(level, opt = {}) {
  const root = new THREE.Group(); root.name = '배관 · 전선'; root.userData.mep = 1; const mats = new Map();
  for (const l of level.lines || []) {
    const k = LINEKINDS[l.kind]; if (!k || !l.pts || l.pts.length < 2) continue; const w = l.w || k.w, z = lineZ(k, l, level), round = lineRound(l);
    const col = l.color || k.color, key = col + (opt.sel === l.id ? '*' : ''); if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: /duct|Duct|cPipe|Frame/.test(l.kind) ? 0.6 : 0.05, emissive: opt.sel === l.id ? '#2f7df6' : '#000000', emissiveIntensity: opt.sel === l.id ? 0.6 : 0 }));
    const mat = mats.get(key), pts = l.pts.filter((q, i, A) => !i || Math.hypot(q[0] - A[i - 1][0], q[1] - A[i - 1][1]) >= 1); if (pts.length < 2) continue;
    const tag = (m) => { m.castShadow = false; m.userData.xr = lineCat(k); m.userData.lineId = l.id; root.add(m); };
    if (round) {
      const path = bentPath(pts, w, z * MM), len = path.getLength(), seg = Math.min(600, Math.max(8, Math.round(len / 0.05) + (pts.length - 2) * 12)), rad = Math.max(4, w / 2) * MM, radial = w >= 150 ? 20 : w >= 40 ? 14 : 8;
      tag(new THREE.Mesh(new THREE.TubeGeometry(path, seg, rad, radial, false), mat));
      for (const q of [pts[0], pts[pts.length - 1]]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(rad, radial, 6), mat); cap.position.set(q[0] * MM, z * MM, q[1] * MM); tag(cap); } /* 끝 마감 */
    } else for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], L = Math.hypot(x2 - x1, y2 - y1);
      const m = new THREE.Mesh(new THREE.BoxGeometry((L + w) * MM, Math.min(w, 300) * MM, w * MM), mat); m.position.set(((x1 + x2) / 2) * MM, z * MM, ((y1 + y2) / 2) * MM); m.rotation.y = -Math.atan2(y2 - y1, x2 - x1); tag(m);
    }
  }
  return root;
}
/** 설치물(숨기기 대상) 기물인가: 콘센트 · 스위치 · 수전 위치 · 가스 밸브 · 앵커 등 표시용. 바닥 배수구 · 트렌치처럼 눈에 보이는 마감은 뺀다 */
export function isMepItem(L, type = '') { return !!L && (L.layer === 'elec' || L.layer === 'plumb' || L.layer === 'ceiling') && !/^(drain|trench|b_drain|k_prerinse|b_fau|b_shower)/.test(type); }
