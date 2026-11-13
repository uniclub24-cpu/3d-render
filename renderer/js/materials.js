// PBR 재질 (MeshStandardMaterial). 기존 앱의 재질 키를 금속성 · 거칠기 값으로 옮긴다.
import * as THREE from 'three';

// 기존 재질 이름(MATS) → 질감 키
export const MAT_TEX = { paint: 'plain', matte: 'plain', gloss: 'plastic', wood: 'wood', plywood: 'plywood', marble: 'marble', steel: 'steel', plastic: 'plastic', glass: 'glass', frosted: 'frost', turf: 'grass', tile: 'tile', film: 'plain', filmwood: 'wood', brick: 'brick', epoxy: 'epoxy', concrete: 'concrete' };
export const MAT_LABEL = { '': '원래대로', steel: '스테인리스', paint: '페인트', wood: '목재', plastic: '플라스틱', marble: '대리석', glass: '유리', concrete: '콘크리트' };

// 질감 키 → PBR 값. 스테인리스는 금속성 0.9, 홀 가구(목재 · 페인트)는 거칠기로 질감을 낸다.
const PBR = {
  steel: { metalness: 0.9, roughness: 0.36, envMapIntensity: 1.35 },
  plain: { metalness: 0, roughness: 0.82 },
  wood: { metalness: 0, roughness: 0.58 },
  plywood: { metalness: 0, roughness: 0.72 },
  marble: { metalness: 0, roughness: 0.2, envMapIntensity: 0.9 },
  plastic: { metalness: 0, roughness: 0.4 },
  gloss: { metalness: 0, roughness: 0.22 },
  tile: { metalness: 0, roughness: 0.32 },
  epoxy: { metalness: 0, roughness: 0.3, envMapIntensity: 0.8 },
  concrete: { metalness: 0, roughness: 0.92 },
  brick: { metalness: 0, roughness: 0.9 },
  grass: { metalness: 0, roughness: 1 },
  frost: { metalness: 0, roughness: 0.55, transparent: true, opacity: 0.6 },
  glass: { metalness: 0, roughness: 0.06, transparent: true, opacity: 0.28, envMapIntensity: 1.4 },
};

function canvasTexture(size, draw, colorSpace) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (colorSpace) t.colorSpace = colorSpace; return t;
}
let _brushed, _woodMap;
// 헤어라인 스테인리스: 거칠기 지도에 가로 결을 넣어 반사가 길게 번지게 한다
function brushedRoughness() {
  return (_brushed ||= canvasTexture(256, (g, s) => {
    g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) { const y = Math.random() * s, v = 110 + Math.random() * 90; g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = Math.random() < 0.2 ? 2 : 1; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 2); g.stroke(); }
  }));
}
// 나뭇결: 밝기만 살짝 흔드는 무채색 지도 (기물 색에 곱해진다)
function woodGrain() {
  return (_woodMap ||= canvasTexture(256, (g, s) => {
    g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) { const y = Math.random() * s, v = 190 + Math.random() * 50; g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + 6, s * 0.6, y - 6, s, y + (Math.random() - 0.5) * 8); g.stroke(); }
  }, THREE.SRGBColorSpace));
}
const tileCache = new Map();
/** 바닥 타일: 줄눈이 있는 색 지도. size = 타일 한 변(m) */
export function tileTexture(color, grout = '#8e8a84') {
  const k = color + grout; if (tileCache.has(k)) return tileCache.get(k);
  const t = canvasTexture(256, (g, s) => {
    g.fillStyle = grout; g.fillRect(0, 0, s, s); g.fillStyle = color; g.fillRect(3, 3, s - 6, s - 6);
    const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = gr; g.fillRect(3, 3, s - 6, s - 6);
  }, THREE.SRGBColorSpace);
  tileCache.set(k, t); return t;
}

const cache = new Map();
let ENV = null;
/** 금속 · 유리 반사에 쓸 환경 지도를 등록한다 (scene.environment 와 별도로 재질마다 세기를 줄 수 있다) */
export function setEnvMap(tex) { ENV = tex; for (const m of cache.values()) if (m.userData.reflect) { m.envMap = tex; m.needsUpdate = true; } }
/** 질감 키 + 색 + 투명도 → 재질 (같은 조합은 하나를 같이 쓴다) */
export function material(tex, color, alpha) {
  const key = PBR[tex] ? tex : 'plain', k = `${key}|${color}|${alpha ?? ''}`;
  if (cache.has(k)) return cache.get(k);
  const p = { ...PBR[key] };
  if (alpha != null && alpha < 1) { p.transparent = true; p.opacity = alpha; if (key === 'plain') p.roughness = 0.1; }
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color || '#b8bcc2'), ...p });
  if (key === 'steel') { m.roughnessMap = brushedRoughness(); m.roughnessMap.repeat.set(1, 6); }
  if (key === 'wood' || key === 'plywood') { m.map = woodGrain(); }
  if (m.transparent) m.depthWrite = false;
  if (p.envMapIntensity) { m.userData.reflect = true; if (ENV) m.envMap = ENV; }
  cache.set(k, m); return m;
}
/** 바닥 마감 재질 */
export function floorMaterial(finish, color) {
  const k = `floor|${finish}|${color}`; if (cache.has(k)) return cache.get(k);
  const tex = MAT_TEX[finish] || 'plain', m = new THREE.MeshStandardMaterial({ color: '#ffffff', ...(PBR[tex] || PBR.plain) });
  if (tex === 'tile') { m.map = tileTexture(color); m.map.repeat.set(1 / 0.6, 1 / 0.6); } // 600 각 타일
  else if (tex === 'wood') { m.color.set(color); m.map = woodGrain().clone(); m.map.needsUpdate = true; m.map.repeat.set(0.6, 4); }
  else m.color.set(color);
  cache.set(k, m); return m;
}
