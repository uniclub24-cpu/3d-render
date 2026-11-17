// 보기 스타일(렌더 필터): 실사 · 카툰 · 타이쿤 · 만화 · 수묵 · 클레이 · 로우폴리 · 북유럽 · 이자카야 · 인더스트리얼 · 동양풍 · 초안 스케치 · 팝아트 · 도면
// 편집 상태는 그대로 두고 "보이는 방식"만 바꾼다 → 어느 스타일에서든 그리기 · 옮기기를 이어서 할 수 있다.
//   1) 재질 바꾸기: MeshStandardMaterial ↔ MeshToonMaterial(셀 셰이딩) / 무광 클레이 / 흰 도면
//   2) StylePass: 법선 · 깊이 · 색이 급히 바뀌는 곳에 외곽선을 긋고, 종이 질감 · 파스텔 보정을 얹는다
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const STYLES = {
  real:   { name: '실사',   hint: 'PBR 재질 · 그림자 · 틈새 음영',        ortho: false, ssao: true,  lights: true,  outline: 0,   bg: '#dfe5ea', ground: '#c3c8cd', ambient: 0.22, sun: 1 },
  toon:   { name: '카툰',   hint: '셀 셰이딩 + 검은 외곽선',              ortho: false, ssao: false, lights: false, outline: 1.3, bg: '#dfe9f2', ground: '#cfd8e0', ambient: 0.85, sun: 0.8, line: '#15161a', exposure: 1.25 },
  tycoon: { name: '타이쿤', hint: '게임 같은 사탕색 미니어처 · 부드러운 색 선', ortho: true,  ssao: false, lights: false, outline: 1.0, bg: '#cfe8d4', ground: '#bfe0c4', ambient: 1.05, sun: 0.7, line: '#5a3b52', soft: 1, exposure: 1.15, mat: 'tycoon', shade: [0.86, 0.84, 1.04] },
  comic:  { name: '만화',   hint: '만화책처럼 또렷한 잉크 선 · 선명한 색 · 푸른 그늘', ortho: false, ssao: false, lights: false, outline: 1.5, bg: '#f3eee2', ground: '#ebe4d3', ambient: 0.9, sun: 0.85, line: '#121318', paper: 1, wobble: 1, exposure: 1.2, mat: 'comic', shade: [0.72, 0.78, 1.08] },
  ink:    { name: '수묵',   hint: '먹 선 + 한지 · 옅은 담채 (조선 · 일본 실내 그림 느낌)', ortho: false, ssao: false, lights: false, outline: 1.5, bg: '#ece4d2', ground: '#e6ddca', ambient: 1.0, sun: 0.55, line: '#1d1a17', ink: 1, wobble: 1, exposure: 1.15 },
  clay:   { name: '클레이', hint: '무광 찰흙 모형 + 강한 틈새 음영',      ortho: false, ssao: true,  lights: false, outline: 0,   bg: '#ece6dd', ground: '#ddd5c9', ambient: 0.22, sun: 0.75, ssaoRadius: 0.95, exposure: 0.9 },
  lowpoly:    { name: '로우폴리', hint: '각진 면 · 크림 벽 · 원색 소품 디오라마 (선 없이)', ortho: true, ssao: false, lights: false, outline: 0.35, bg: '#f2efe8', ground: '#e9e4da', ambient: 0.95, sun: 1.05, line: '#6b5a4a', soft: 1, mat: 'lowpoly', exposure: 1.05 },
  nordic:     { name: '북유럽', hint: '흰 벽 · 밝은 오크 바닥 · 세이지 그린 · 자연광', ortho: false, ssao: true, lights: true, outline: 0, bg: '#f5f6f4', ground: '#e6e8e3', ambient: 0.42, sun: 1.05, mat: 'nordic', aces: 1, exposure: 1.12, ssaoRadius: 0.8, grade: [1.0, 1.0, 0.985] },
  izakaya:    { name: '이자카야', hint: '어두운 나무 · 따뜻한 등불 번짐 (밤 분위기)', ortho: false, ssao: true, lights: true, outline: 0, bg: '#0a0b0f', ground: '#14110f', ambient: 0.06, sun: 0.06, mat: 'izakaya', aces: 1, exposure: 0.95, glow: 0.8, vig: 0.55, grade: [1.08, 0.96, 0.84], lightBoost: 2.2 },
  industrial: { name: '인더스트리얼', hint: '콘크리트 · 검은 철제 · 에디슨 전구', ortho: false, ssao: true, lights: true, outline: 0, bg: '#1a1c1f', ground: '#3a3c3f', ambient: 0.16, sun: 0.55, mat: 'industrial', aces: 1, exposure: 1.05, glow: 0.45, vig: 0.35, grade: [1.04, 1.0, 0.94], sat: 0.8, lightBoost: 1.6 },
  oriental:   { name: '동양풍', hint: '한옥 나무 · 한지 · 초롱 불빛', ortho: false, ssao: true, lights: true, outline: 0, bg: '#2a1d14', ground: '#4a3727', ambient: 0.14, sun: 0.3, mat: 'oriental', aces: 1, exposure: 0.95, glow: 0.6, vig: 0.45, grade: [1.07, 0.99, 0.86], lightBoost: 1.8 },
  sketch:     { name: '초안 스케치', hint: '연필 선 + 빗금 음영 (설계 초안)', ortho: false, ssao: false, lights: false, outline: 1.4, bg: '#f6f1e4', ground: '#f0eadb', ambient: 1.1, sun: 0.7, line: '#2c2f36', mat: 'sketch', hatch: 1, paper: 1, wobble: 1, exposure: 1.1 },
  pop:        { name: '팝아트', hint: '굵은 선 · 원색 · 잔잔한 망점 (만화책 인쇄 느낌)', ortho: false, ssao: false, lights: false, outline: 1.8, bg: '#ffe14d', ground: '#ffd23a', ambient: 1.0, sun: 0.8, line: '#111111', mat: 'pop', halftone: 1, exposure: 1.15 },
  plan:   { name: '도면',   hint: '원근 없는 흑백 등각 다이어그램',       ortho: true,  ssao: false, lights: false, outline: 1.2, bg: '#ffffff', ground: '#ffffff', ambient: 1.6,  sun: 0.25, line: '#1b1d21', mono: 1 },
};

/* ---------- 재질 바꾸기 ---------- */
const ramp = (steps) => { const d = new Uint8Array(steps.length * 4); steps.forEach((v, i) => d.set([v, v, v, 255], i * 4)); const t = new THREE.DataTexture(d, steps.length, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
const RAMP3 = ramp([150, 205, 255]), RAMP2 = ramp([196, 255]);
const cache = new Map(), WHITE = new THREE.Color('#ffffff'), CLAY = new THREE.Color('#e7dfd3');
const C = (h) => new THREE.Color(h), BIRCH = C('#e6d3b3'), CHAR = C('#261912'), CONC = C('#8a8d90'), IRON = C('#1e2024'), HANJI = C('#f1e6cf'), WOOD = C('#7a4a2a'), PAPER = C('#ece6d6');
const lum = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11, satur = (c, k) => { const l = lum(c); c.r = l + (c.r - l) * k; c.g = l + (c.g - l) * k; c.b = l + (c.b - l) * k; return c; };
/* ---------- 스타일 전용 무늬 (진짜 재질은 안 바꾸고, 스타일을 누를 때만 덮어 보임) ----------
 * 기물 · 벽에 UV 가 제각각이라 월드 좌표로 붙이는 삼면 투영(triplanar) 무늬를 쓴다. 1 = 1m */
const TEX = {};
function cvTex(key, size, draw) { if (TEX[key]) return TEX[key]; if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (TEX[key] = t); }
const rnd = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
function planks(g, S, cols, n = 4, grain = 0.18) { const h = S / n; for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, i * h, S, h); for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(0,0,0,${grain * (0.3 + rnd(i * 31 + k))})`; g.lineWidth = 1 + rnd(k + i) * 1.5; const y = i * h + rnd(i * 7 + k * 3) * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y + (rnd(k) - 0.5) * 6, S * 0.6, y - (rnd(k + 9) - 0.5) * 6, S, y); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, i * h, S, 2); const cut = rnd(i * 13) * S; g.fillRect(cut, i * h, 2, h); } }
const STEX = {
  darkwood: () => cvTex('darkwood', 256, (g, S) => planks(g, S, ['#3a2416', '#33200f', '#41291a', '#2e1c10'], 5, 0.28)),
  wood: () => cvTex('wood', 256, (g, S) => planks(g, S, ['#9a6338', '#8c5830', '#a46c40', '#93603a'], 4, 0.2)),
  oak: () => cvTex('oak', 256, (g, S) => planks(g, S, ['#dcc39c', '#d6bb92', '#e2caa6', '#d2b78e'], 5, 0.1)),
  lattice: () => cvTex('lattice', 256, (g, S) => { g.fillStyle = '#efe2c6'; g.fillRect(0, 0, S, S); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,120,80,${0.04 * rnd(i)})`; g.fillRect(rnd(i + 1) * S, rnd(i + 2) * S, 6, 1); }
    g.fillStyle = '#7a4a26'; const n = 4, w = 7; for (let k = 0; k <= n; k++) { g.fillRect((k * S) / n - w / 2, 0, w, S); g.fillRect(0, (k * S) / n - w / 2, S, w); } g.fillStyle = '#5c3519'; g.fillRect(0, S - 18, S, 18); g.fillRect(0, 0, S, 10); }),
  slate: () => cvTex('slate', 256, (g, S) => { const n = 2, c = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 52 + rnd(i * 5 + j) * 14; g.fillStyle = `rgb(${v},${v + 2},${v + 5})`; g.fillRect(i * c, j * c, c, c); for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(255,255,255,${0.035 * rnd(k + i * 9 + j)})`; g.fillRect(i * c + rnd(k * 3 + j) * c, j * c + rnd(k * 5 + i) * c, 3, 2); } } g.strokeStyle = '#1d1f22'; g.lineWidth = 3; for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * c, 0); g.lineTo(k * c, S); g.moveTo(0, k * c); g.lineTo(S, k * c); g.stroke(); } }),
  brick: () => cvTex('brick', 256, (g, S) => { g.fillStyle = '#5a4136'; g.fillRect(0, 0, S, S); const rh = S / 8, bw = S / 3; for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) { const x = k * bw + (r % 2 ? bw / 2 : 0), v = rnd(r * 11 + k); g.fillStyle = `rgb(${120 + v * 40},${62 + v * 18},${48 + v * 12})`; g.fillRect(x + 3, r * rh + 3, bw - 6, rh - 6); } }),
  concrete: () => cvTex('concrete', 256, (g, S) => { g.fillStyle = '#8d8f91'; g.fillRect(0, 0, S, S); for (let i = 0; i < 1600; i++) { const v = rnd(i) * 60 - 30; g.fillStyle = `rgba(${128 + v},${130 + v},${132 + v},0.25)`; g.fillRect(rnd(i + 3) * S, rnd(i + 7) * S, 2 + rnd(i) * 5, 2 + rnd(i + 1) * 5); } g.strokeStyle = 'rgba(40,40,40,.35)'; g.strokeRect(0, 0, S, S); }),
  checker: () => cvTex('lpcheck', 128, (g, S) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#e9d3a8' : '#f4e6c8'; g.fillRect(i * S / 2, j * S / 2, S / 2, S / 2); } }),
};
/** 월드 좌표 삼면 투영 무늬 재질 (scale = 1m 당 반복 수) */
function triMat(tex, scale, opt = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0, ...opt }); if (!tex) return m;
  m.onBeforeCompile = (sh) => { sh.uniforms.tTri = { value: tex }; sh.uniforms.uTriS = { value: scale };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP = (modelMatrix * vec4(transformed, 1.0)).xyz; vTriN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tTri; uniform float uTriS; varying vec3 vTriP; varying vec3 vTriN;').replace('#include <map_fragment>', '#include <map_fragment>\n{ vec3 bw = pow(abs(normalize(vTriN)), vec3(6.0)); bw /= (bw.x + bw.y + bw.z); vec3 tc = texture2D(tTri, vTriP.zy * uTriS).rgb * bw.x + texture2D(tTri, vTriP.xz * uTriS).rgb * bw.y + texture2D(tTri, vTriP.xy * uTriS).rgb * bw.z; diffuseColor.rgb *= tc; }'); };
  m.customProgramCacheKey = () => 'tri' + tex.uuid; return m;
}
/** 면마다 살짝 다른 밝기 (로우폴리 각진 느낌) */
function facetMat(color, common) { const m = new THREE.MeshLambertMaterial({ ...common, color, flatShading: true });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 fn = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition))); diffuseColor.rgb *= 0.9 + 0.2 * fract(sin(dot(floor(fn * 3.0 + 0.5), vec3(12.9, 78.2, 37.7))) * 43758.5); }'); }; m.customProgramCacheKey = () => 'facet'; return m; }
/* 게임 · 만화 색: 같은 색 계열을 유지하면서 채도 · 밝기 · 색온도를 바꿈 (회색은 따뜻한 크림 / 푸른 회색으로) */
const hsl = {};
function gameColor(c, kind) { c.getHSL(hsl); let { h, s, l } = hsl;
  if (kind === 'tycoon') { if (s < 0.1) { if (l > 0.55) { h = 0.1; s = 0.35; l = 0.86 + (l - 0.55) * 0.2; } else { h = 0.62; s = 0.18; l = 0.35 + l * 0.5; } } else { s = Math.min(1, s * 1.25 + 0.12); l = 0.3 + l * 0.62; h = (h + 0.012) % 1; } }
  else { if (s < 0.1) { if (l > 0.6) { h = 0.12; s = 0.18; l = 0.9; } else { h = 0.6; s = 0.22; l = 0.22 + l * 0.6; } } else { s = Math.min(1, s * 1.35 + 0.1); l = 0.22 + l * 0.7; } }
  return c.setHSL(h, s, l); }
/* 새 스타일 재질 (발광 재질 · 텍스처는 살림) */
function themed(base, kind, common, role) {
  const c = base.color.clone(), l = lum(c), glow = base.emissive && (base.emissiveIntensity || 0) * lum(base.emissive) > 0.05, map = base.map || null;
  const em = glow ? { emissive: base.emissive.clone(), emissiveIntensity: base.emissiveIntensity * (kind === 'izakaya' || kind === 'oriental' ? 2.2 : 1.2) } : {};
  const big = role === 'wall' || role === 'floor' || role === 'ceil';
  if (kind === 'tycoon' || kind === 'comic') { const q = gameColor(c, kind); if (base.metalness > 0.5) q.offsetHSL(0, -0.05, 0.1); return new THREE.MeshToonMaterial({ ...common, ...em, color: q, map, gradientMap: kind === 'comic' ? RAMP2 : RAMP3 }); }
  if (kind === 'lowpoly') { if (role === 'wall') return facetMat(C('#f1e4c9'), common); if (role === 'floor' && !map) { const m = triMat(STEX.checker(), 1 / 1.2, { roughness: 1 }); return m; } if (role === 'ceil') return facetMat(C('#f6efe0'), common); return facetMat(satur(c.lerp(WHITE, 0.04), 1.35), { ...common, ...em }); }
  if (kind === 'pop') { const q = satur(c, 1.7); q.offsetHSL(0, 0, 0.04); return new THREE.MeshToonMaterial({ ...common, ...em, color: q, map, gradientMap: RAMP2 }); }
  if (big && !glow) { /* 바닥 · 벽 · 천장: 예시 사진 분위기 무늬 */
    if (kind === 'izakaya') return role === 'floor' ? triMat(STEX.slate(), 1 / 1.2, { roughness: 0.75, ...common }) : role === 'wall' ? triMat(STEX.darkwood(), 1 / 1.6, { roughness: 0.7, ...common }) : new THREE.MeshStandardMaterial({ ...common, color: '#1f1712', roughness: 0.9 });
    if (kind === 'oriental') return role === 'floor' ? triMat(STEX.slate(), 1 / 1.2, { roughness: 0.8, ...common, color: C('#cfcac2') }) : role === 'wall' ? triMat(STEX.lattice(), 1 / 1.0, { roughness: 0.85, ...common }) : triMat(STEX.wood(), 1 / 1.2, { roughness: 0.8, ...common });
    if (kind === 'industrial') return role === 'floor' ? triMat(STEX.concrete(), 1 / 2.4, { roughness: 0.6, ...common }) : role === 'wall' ? triMat(l > 0.6 ? STEX.brick() : STEX.concrete(), 1 / 1.4, { roughness: 0.9, ...common }) : new THREE.MeshStandardMaterial({ ...common, color: '#2a2c2f', roughness: 0.8 });
    if (kind === 'nordic') return role === 'floor' ? triMat(STEX.oak(), 1 / 1.4, { roughness: 0.7, ...common }) : new THREE.MeshStandardMaterial({ ...common, color: role === 'wall' ? '#f7f7f4' : '#fbfbf9', roughness: 0.92 });
  }
  if (kind === 'nordic' && role === 'item' && !glow && base.metalness < 0.5) { if (c.r > c.b + 0.06 && l > 0.2) return triMat(STEX.oak(), 1 / 0.8, { ...common, ...em, roughness: 0.75 }); if (satur(c.clone(), 1).getHSL(hsl).s > 0.25) c.setHSL(0.3, 0.12, 0.6); else if (l < 0.45) c.set('#8c9196'); }
  if ((kind === 'izakaya' || kind === 'oriental') && role === 'item' && !glow && base.metalness < 0.5 && l > 0.08 && l < 0.85) return triMat(kind === 'izakaya' ? STEX.darkwood() : STEX.wood(), 1 / 0.9, { ...common, ...em, roughness: 0.75 }); /* 가구는 나무처럼 */
  if (kind === 'sketch') return new THREE.MeshLambertMaterial({ ...common, color: c.lerp(PAPER, 0.78), map: null });
  if (kind === 'nordic') { if (l > 0.7) c.lerp(WHITE, 0.45); else if (c.r > c.b && l > 0.25) c.lerp(BIRCH, 0.55); else c.lerp(WHITE, 0.3); return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: 0.85, metalness: Math.min(0.2, base.metalness || 0) }); }
  if (kind === 'izakaya') { if (!glow) c.lerp(CHAR, base.metalness > 0.5 ? 0.35 : 0.6); return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: 0.7, metalness: base.metalness || 0 }); }
  if (kind === 'industrial') { if (base.metalness > 0.5) c.lerp(IRON, 0.55); else if (l > 0.55) c.lerp(CONC, 0.5); else satur(c, 0.75); return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: base.metalness > 0.5 ? 0.45 : 0.92, metalness: base.metalness > 0.5 ? 0.75 : 0 }); }
  if (kind === 'oriental') { if (!glow) { if (l > 0.72) c.lerp(HANJI, 0.6); else if (base.metalness > 0.5) c.lerp(C('#3b3029'), 0.45); else c.lerp(WOOD, 0.45); } return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: 0.8, metalness: 0 }); }
  return base;
}
function styled(base, style, role = 'item') {
  if (style === 'real' || !base || !base.color) return base;
  const k = style + role + base.uuid; if (cache.has(k)) return cache.get(k);
  const common = { transparent: base.transparent, opacity: base.opacity, depthWrite: base.depthWrite, side: base.side };
  let m;
  const mk = STYLES[style] && STYLES[style].mat;
  if (mk) m = themed(base, mk, common, role);
  else if (style === 'clay') m = new THREE.MeshStandardMaterial({ ...common, color: base.color.clone().lerp(CLAY, 0.55), roughness: 1, metalness: 0 });
  else if (style === 'plan') m = new THREE.MeshBasicMaterial({ ...common, color: base.transparent ? '#dfe9ee' : '#ffffff' });
  else {
    const c = base.color.clone(); if (base.metalness > 0.5) c.lerp(WHITE, 0.25); // 금속은 반사가 없어지므로 밝게
    if (style === 'tycoon') c.lerp(WHITE, 0.08);
    m = new THREE.MeshToonMaterial({ ...common, color: c, map: base.map || null, /* 텍스처(타일 · 사진)는 어느 스타일에서도 그대로 */ gradientMap: style === 'toon' ? RAMP3 : RAMP2 });
  }
  cache.set(k, m); return m;
}
/** root 아래 모든 메시의 재질을 스타일에 맞게 바꾼다 (원래 재질은 userData 에 보관) */
const roleOf = (o) => { for (let p = o; p; p = p.parent) { if (p.userData.itemId) return 'item'; if (p.userData.roomId) return 'floor'; if (p.name === '벽') return 'wall'; if (p.name === '천장') return 'ceil'; if (p.name === '바닥') return 'floor'; } return 'other'; };
export function applyStyleMaterials(root, style) {
  const mk = STYLES[style] && STYLES[style].mat;
  root.traverse((o) => {
    if (!o.isMesh) return; const base = (o.userData.baseMat ||= o.material), role = mk ? roleOf(o) : 'item';
    o.material = Array.isArray(base) ? base.map((b) => styled(b, style, role)) : styled(base, style, role);
  });
}
/** 내보내기 · 저장 전에 원래(PBR) 재질로 되돌린다 */
export const restoreMaterials = (root) => applyStyleMaterials(root, 'real');

/* ---------- 외곽선 · 종이 · 파스텔 후처리 ---------- */
const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
#include <packing>
varying vec2 vUv;
uniform sampler2D tDiffuse, tNormal, tDepth;
uniform vec2 uRes; uniform float uNear, uFar, uOrtho, uWidth, uPaper, uWobble, uPastel, uMono, uSoft, uInk, uHatch, uHalf, uGlow, uVig, uSat; uniform vec3 uLine, uGrade, uShade;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return uOrtho > 0.5 ? orthographicDepthToViewZ(d, uNear, uFar) : perspectiveDepthToViewZ(d, uNear, uFar); }
float edgeAt(vec2 uv, float w){
  vec2 px = w / uRes; vec3 n = texture2D(tNormal, uv).rgb; float z = viewZ(uv); vec3 c = texture2D(tDiffuse, uv).rgb; float e = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
    e += length(n - texture2D(tNormal, uv + o).rgb) * 1.1;                       // 면이 꺾이는 곳
    e += abs(z - viewZ(uv + o)) / max(abs(z) * 0.05, 0.03) * 0.55;              // 앞뒤로 떨어진 곳 (윤곽)
    e += length(c - texture2D(tDiffuse, uv + o).rgb) * uSoft * 0.45;              // 색이 바뀌는 곳
  }
  return smoothstep(0.5, 1.15, e);
}
float edgeAA(vec2 uv, float w){ vec2 h = 0.35 / uRes; return 0.25 * (edgeAt(uv + vec2(h.x, h.y), w) + edgeAt(uv + vec2(-h.x, h.y), w) + edgeAt(uv + vec2(h.x, -h.y), w) + edgeAt(uv + vec2(-h.x, -h.y), w)); } // 선 계단 현상 줄이기 (4점 평균)
void main(){
  vec2 uv = vUv; vec2 fc = uv * uRes; vec2 uvE = uv;
  if (uWobble > 0.5) uvE += (vec2(vnoise(fc * 0.012), vnoise(fc * 0.012 + 17.0)) - 0.5) * 0.45 / uRes;   // 선만 아주 살짝 흔들기 (그림 · 텍스처는 그대로)
  vec4 src = texture2D(tDiffuse, uv); vec3 col = src.rgb;
  if (uInk > 0.5) { // 수묵: 밝기 → 먹의 농담, 색은 옅은 담채로만 · 한지 결 · 가장자리는 번진 듯 옅게
    vec3 paper = vec3(0.925, 0.89, 0.81); float l = dot(col, vec3(0.3, 0.59, 0.11)), wash = pow(clamp(1.0 - l, 0.0, 1.0), 1.15);
    vec3 tint = mix(vec3(l), col, 0.28); col = mix(paper, tint * 0.5 + vec3(0.07, 0.06, 0.05), clamp(wash * 0.95 + 0.06, 0.0, 1.0));
    float fib = vnoise(vec2(fc.x * 0.015, fc.y * 0.5)) * 0.5 + vnoise(fc * 0.12) * 0.5; col *= 0.955 + 0.06 * fib; col = mix(col, paper, smoothstep(0.42, 0.8, length(vUv - 0.5)) * 0.4); }
  if (uGlow > 0.0) { vec3 b = vec3(0.0); float tw = 0.0; for (int i = 0; i < 16; i++) { float a = float(i) * 2.39996, r = 2.0 + float(i) * 1.9; vec2 o = vec2(cos(a), sin(a)) * r / uRes * 1.6; vec3 s = texture2D(tDiffuse, uv + o).rgb; float w = 1.0 / (1.0 + float(i) * 0.15); b += max(s - 0.8, 0.0) * w; tw += w; } col += b / tw * 4.0 * uGlow; } // 등불 번짐 (밝은 곳만 퍼짐)
  if (uSat != 1.0) col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, uSat);
  col *= uGrade;
  if (uShade.z > 0.0 && uShade != vec3(1.0)) { float l = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(col, col * uShade, smoothstep(0.62, 0.25, l)); } // 만화 · 게임: 그늘을 푸른 · 보랏빛으로
  if (uHatch > 0.5) { float l = dot(col, vec3(0.3, 0.59, 0.11)); float h1 = step(0.5, fract((fc.x + fc.y) / 7.0)), h2 = step(0.5, fract((fc.x - fc.y) / 7.0)), h3 = step(0.5, fract(fc.x / 4.0));
    float ink = (l < 0.82 ? h1 : 0.0) + (l < 0.62 ? h2 : 0.0) * 0.9 + (l < 0.42 ? h3 : 0.0) * 0.8; vec3 pap = vec3(0.965, 0.945, 0.894); col = mix(pap, uLine, clamp(ink * 0.22, 0.0, 0.6)); col = mix(col, vec3(0.5, 0.62, 0.75), 0.06 * smoothstep(0.3, 0.8, src.b - src.r)); } // 연필 빗금 (어두울수록 겹침)
  if (uHalf > 0.5) { float l = dot(col, vec3(0.3, 0.59, 0.11)); vec2 g = fc / 4.5; mat2 r = mat2(0.7071, -0.7071, 0.7071, 0.7071); vec2 q = fract(r * g) - 0.5; float d = length(q), sh = smoothstep(0.78, 0.25, l), rad = 0.42 * sqrt(sh);
    float dot1 = 1.0 - smoothstep(rad - 0.08, rad + 0.08, d); col = mix(col, col * vec3(0.55, 0.5, 0.62), dot1 * 0.38 * step(0.02, sh)); } // 잔잔한 망점: 그늘진 곳에만 작고 옅게
  if (uVig > 0.0) col *= 1.0 - uVig * smoothstep(0.35, 0.85, length(vUv - 0.5));
  if (uPastel > 0.0) { col = mix(col, vec3(1.0, 0.985, 0.96), uPastel); col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.12); }
  if (uMono > 0.5) col = vec3(mix(1.0, dot(col, vec3(0.3, 0.59, 0.11)), 0.12));
  float e = 0.0;
  if (uWidth > 0.0) { e = edgeAA(uvE, uWidth); if (uPaper > 0.5 && uHatch < 0.5) e = max(e, edgeAt(uvE, uWidth * 1.35) * 0.45); if (uInk > 0.5) e *= 0.5 + 0.75 * vnoise(fc * 0.045); } // 만화: 두 겹으로 펜 굵기 · 수묵: 붓 누름처럼 진하고 옅게
  if (uPaper > 0.5) { float g = vnoise(fc * 0.35) * 0.7 + vnoise(fc * 1.3) * 0.3; col *= 0.965 + 0.05 * g; col = mix(col, vec3(0.97, 0.95, 0.9), 0.04); } // 종이 결 (점 잡음 없이 부드럽게)
  vec3 line = uSoft > 0.5 ? mix(col * 0.42, uLine, 0.6) : uLine;
  gl_FragColor = vec4(mix(col, line, e), src.a);
}`;

export class StylePass extends Pass {
  constructor(scene, camera, w, h) {
    super(); this.scene = scene; this.camera = camera; this.style = STYLES.real; this.hide = [];
    this.normalMat = new THREE.MeshNormalMaterial();
    this.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rt.depthTexture = new THREE.DepthTexture(w, h); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: {
      tDiffuse: { value: null }, tNormal: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(w, h) },
      uNear: { value: 0.1 }, uFar: { value: 100 }, uOrtho: { value: 0 }, uWidth: { value: 0 }, uPaper: { value: 0 }, uWobble: { value: 0 }, uPastel: { value: 0 }, uMono: { value: 0 }, uSoft: { value: 0 }, uInk: { value: 0 }, uHatch: { value: 0 }, uHalf: { value: 0 }, uGlow: { value: 0 }, uVig: { value: 0 }, uSat: { value: 1 }, uGrade: { value: new THREE.Vector3(1, 1, 1) }, uShade: { value: new THREE.Vector3(1, 1, 1) }, uLine: { value: new THREE.Color('#000') } } });
    this.quad = new FullScreenQuad(this.mat);
  }
  setStyle(s) { this.style = s; const u = this.mat.uniforms; u.uWidth.value = s.outline || 0; u.uPaper.value = s.paper || 0; u.uWobble.value = s.wobble || 0; u.uPastel.value = s.pastel || 0; u.uMono.value = s.mono || 0; u.uSoft.value = s.soft || 0; u.uInk.value = s.ink || 0; u.uHatch.value = s.hatch || 0; u.uHalf.value = s.halftone || 0; u.uGlow.value = s.glow || 0; u.uVig.value = s.vig || 0; u.uSat.value = s.sat && !s.mat ? s.sat : s.mat === 'industrial' ? 0.85 : 1; u.uGrade.value.fromArray(s.grade || [1, 1, 1]); u.uShade.value.fromArray(s.shade || [1, 1, 1]); new THREE.Color(s.line || '#000').getRGB(u.uLine.value, THREE.SRGBColorSpace); /* OutputPass 뒤에서 그리므로 sRGB 값 그대로 */ this.enabled = !!(s.outline || s.paper || s.pastel || s.mono || s.ink || s.hatch || s.halftone || s.glow || s.vig || s.grade || s.shade); }
  setSize(w, h) { this.rt.setSize(w, h); this.mat.uniforms.uRes.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    // 1) 법선 · 깊이 지도 (선택 상자 같은 보조선은 빼고)
    const vis = this.hide.map((o) => o.visible); this.hide.forEach((o) => (o.visible = false));
    const bg = this.scene.background, om = this.scene.overrideMaterial; this.scene.background = null; this.scene.overrideMaterial = this.normalMat;
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), sh = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(this.rt); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(this.scene, this.camera);
    renderer.setClearColor(cc, ca); renderer.shadowMap.autoUpdate = sh; this.scene.overrideMaterial = om; this.scene.background = bg; this.hide.forEach((o, i) => (o.visible = vis[i]));
    // 2) 외곽선 합성
    const u = this.mat.uniforms; u.tDiffuse.value = readBuffer.texture; u.uNear.value = this.camera.near; u.uFar.value = this.camera.far; u.uOrtho.value = this.camera.isOrthographicCamera ? 1 : 0;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.rt.dispose(); this.mat.dispose(); this.quad.dispose(); }
}
