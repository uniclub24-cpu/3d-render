// 줄자 · 치수 (기존 앱 v18): level.dims = [{ id, x1, y1, x2, y2, z?(mm, 3D 에서 띄울 높이) }]
// 2D 는 plan2d.js 가 그리고, 3D 는 여기서 선 + 글자판(스프라이트)으로 세운다.
import * as THREE from 'three';
const MM = 0.001;
const label = (text) => {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '600 44px system-ui, sans-serif'; const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = 64;
  g.font = '600 44px system-ui, sans-serif'; g.fillStyle = '#2f7df6'; g.beginPath(); g.roundRect(0, 0, w, 64, 18); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set((w / 64) * 0.16, 0.16, 1); s.renderOrder = 997; return s;
};
export function buildDims(level) {
  const root = new THREE.Group(); root.name = '치수'; root.visible = level.dimsOn !== false; const mat = new THREE.LineBasicMaterial({ color: '#2f7df6', depthTest: false });
  for (const d of level.dims || []) {
    const z = (d.z ?? 1200) * MM, a = new THREE.Vector3(d.x1 * MM, z, d.y1 * MM), b = new THREE.Vector3(d.x2 * MM, z, d.y2 * MM), len = Math.round(Math.hypot(d.x2 - d.x1, d.y2 - d.y1));
    const tick = (p) => [p.clone().setY(z - 0.06), p.clone().setY(z + 0.06)];
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([a, b, ...tick(a), ...tick(b)]), mat); l.renderOrder = 996; root.add(l);
    const s = label(len.toLocaleString() + ' mm'); s.position.copy(a).add(b).multiplyScalar(0.5).setY(z + 0.12); root.add(s);
  }
  return root;
}
