// 보기 스타일(렌더 필터): 실사 · 카툰 · 타이쿤 · 만화 · 수묵 · 클레이 · 로우폴리 · 북유럽 · 이자카야 · 인더스트리얼 · 동양풍 · 초안 스케치 · 팝아트 · 도면
// 편집 상태는 그대로 두고 "보이는 방식"만 바꾼다 → 어느 스타일에서든 그리기 · 옮기기를 이어서 할 수 있다.
//   1) 재질 바꾸기: MeshStandardMaterial ↔ MeshToonMaterial(셀 셰이딩) / 무광 클레이 / 흰 도면
//   2) StylePass: 법선 · 깊이 · 색이 급히 바뀌는 곳에 외곽선을 긋고, 종이 질감 · 파스텔 보정을 얹는다
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const STYLES = {
  real:   { name: '실사',   hint: 'PBR 재질 · 그림자 · 틈새 음영',        ortho: false, ssao: true,  lights: true,  outline: 0,   bg: '#dfe5ea', ground: '#c3c8cd', ambient: 0.22, sun: 1 },
  toon:   { name: '카툰',   hint: '셀 셰이딩 + 검은 외곽선',              ortho: false, ssao: false, lights: false, outline: 1.3, bg: '#dfe9f2', ground: '#cfd8e0', ambient: 0.85, sun: 0.8, line: '#15161a', exposure: 1.25 },
  tycoon: { name: '타이쿤', hint: '위에서 본 파스텔 미니어처',            ortho: true,  ssao: false, lights: false, outline: 1.1, bg: '#dcefdc', ground: '#cfe6cf', ambient: 1.0,  sun: 0.62, line: '#4e2740', pastel: 0.1, soft: 1, exposure: 1.2 },
  comic:  { name: '만화',   hint: '깔끔한 잉크 선 + 종이 질감 (카툰보다 선이 굵고 펜 느낌)', ortho: false, ssao: false, lights: false, outline: 1.7, bg: '#efe9dc', ground: '#e6dfcf', ambient: 0.95, sun: 0.7, line: '#141312', paper: 1, wobble: 1, exposure: 1.25 },
  ink:    { name: '수묵',   hint: '먹 선 + 한지 · 옅은 담채 (조선 · 일본 실내 그림 느낌)', ortho: false, ssao: false, lights: false, outline: 1.5, bg: '#ece4d2', ground: '#e6ddca', ambient: 1.0, sun: 0.55, line: '#1d1a17', ink: 1, wobble: 1, exposure: 1.15 },
  clay:   { name: '클레이', hint: '무광 찰흙 모형 + 강한 틈새 음영',      ortho: false, ssao: true,  lights: false, outline: 0,   bg: '#ece6dd', ground: '#ddd5c9', ambient: 0.22, sun: 0.75, ssaoRadius: 0.95, exposure: 0.9 },
  lowpoly:    { name: '로우폴리', hint: '각진 면 · 밝은 원색 미니어처 (타이쿤 게임 느낌)', ortho: true, ssao: false, lights: false, outline: 0.9, bg: '#bfe3f2', ground: '#9ccf86', ambient: 1.05, sun: 0.95, line: '#2b3a4a', mat: 'lowpoly', sat: 1.25, exposure: 1.1 },
  nordic:     { name: '북유럽', hint: '자작나무 · 흰 벽 · 부드러운 자연광과 틈새 음영', ortho: false, ssao: true, lights: true, outline: 0, bg: '#f5f6f4', ground: '#e6e8e3', ambient: 0.4, sun: 1.05, mat: 'nordic', aces: 1, exposure: 1.12, ssaoRadius: 0.8, grade: [1.0, 1.0, 0.985] },
  izakaya:    { name: '이자카야', hint: '어두운 나무 · 따뜻한 등불 번짐 (밤 분위기)', ortho: false, ssao: true, lights: true, outline: 0, bg: '#0a0b0f', ground: '#14110f', ambient: 0.06, sun: 0.06, mat: 'izakaya', aces: 1, exposure: 0.95, glow: 0.8, vig: 0.55, grade: [1.08, 0.96, 0.84], lightBoost: 2.2 },
  industrial: { name: '인더스트리얼', hint: '콘크리트 · 검은 철제 · 에디슨 전구', ortho: false, ssao: true, lights: true, outline: 0, bg: '#1a1c1f', ground: '#3a3c3f', ambient: 0.16, sun: 0.55, mat: 'industrial', aces: 1, exposure: 1.05, glow: 0.45, vig: 0.35, grade: [1.04, 1.0, 0.94], sat: 0.8, lightBoost: 1.6 },
  oriental:   { name: '동양풍', hint: '한옥 나무 · 한지 · 초롱 불빛', ortho: false, ssao: true, lights: true, outline: 0, bg: '#2a1d14', ground: '#4a3727', ambient: 0.14, sun: 0.3, mat: 'oriental', aces: 1, exposure: 0.95, glow: 0.6, vig: 0.45, grade: [1.07, 0.99, 0.86], lightBoost: 1.8 },
  sketch:     { name: '초안 스케치', hint: '연필 선 + 빗금 음영 (설계 초안)', ortho: false, ssao: false, lights: false, outline: 1.4, bg: '#f6f1e4', ground: '#f0eadb', ambient: 1.1, sun: 0.7, line: '#2c2f36', mat: 'sketch', hatch: 1, paper: 1, wobble: 1, exposure: 1.1 },
  pop:        { name: '팝아트', hint: '굵은 선 · 원색 · 망점 (만화책 인쇄 느낌)', ortho: false, ssao: false, lights: false, outline: 2.0, bg: '#ffe14d', ground: '#ffd23a', ambient: 1.0, sun: 0.8, line: '#111111', mat: 'pop', halftone: 1, sat: 1.5, exposure: 1.15 },
  plan:   { name: '도면',   hint: '원근 없는 흑백 등각 다이어그램',       ortho: true,  ssao: false, lights: false, outline: 1.2, bg: '#ffffff', ground: '#ffffff', ambient: 1.6,  sun: 0.25, line: '#1b1d21', mono: 1 },
};

/* ---------- 재질 바꾸기 ---------- */
const ramp = (steps) => { const d = new Uint8Array(steps.length * 4); steps.forEach((v, i) => d.set([v, v, v, 255], i * 4)); const t = new THREE.DataTexture(d, steps.length, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
const RAMP3 = ramp([150, 205, 255]), RAMP2 = ramp([196, 255]);
const cache = new Map(), WHITE = new THREE.Color('#ffffff'), CLAY = new THREE.Color('#e7dfd3');
const C = (h) => new THREE.Color(h), BIRCH = C('#e6d3b3'), CHAR = C('#261912'), CONC = C('#8a8d90'), IRON = C('#1e2024'), HANJI = C('#f1e6cf'), WOOD = C('#7a4a2a'), PAPER = C('#ece6d6');
const lum = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11, satur = (c, k) => { const l = lum(c); c.r = l + (c.r - l) * k; c.g = l + (c.g - l) * k; c.b = l + (c.b - l) * k; return c; };
/* 새 스타일 재질 (발광 재질 · 텍스처는 살림) */
function themed(base, kind, common) {
  const c = base.color.clone(), l = lum(c), glow = base.emissive && (base.emissiveIntensity || 0) * lum(base.emissive) > 0.05, map = base.map || null;
  const em = glow ? { emissive: base.emissive.clone(), emissiveIntensity: base.emissiveIntensity * (kind === 'izakaya' || kind === 'oriental' ? 2.2 : 1.2) } : {};
  if (kind === 'lowpoly') return new THREE.MeshLambertMaterial({ ...common, ...em, color: satur(c.lerp(WHITE, 0.06), 1.3), map, flatShading: true });
  if (kind === 'pop') { const q = satur(c, 1.7); return new THREE.MeshToonMaterial({ ...common, ...em, color: q, map, gradientMap: RAMP2 }); }
  if (kind === 'sketch') return new THREE.MeshLambertMaterial({ ...common, color: c.lerp(PAPER, 0.78), map: null });
  if (kind === 'nordic') { if (l > 0.7) c.lerp(WHITE, 0.45); else if (c.r > c.b && l > 0.25) c.lerp(BIRCH, 0.55); else c.lerp(WHITE, 0.3); return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: 0.85, metalness: Math.min(0.2, base.metalness || 0) }); }
  if (kind === 'izakaya') { if (!glow) c.lerp(CHAR, base.metalness > 0.5 ? 0.35 : 0.6); return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: 0.7, metalness: base.metalness || 0 }); }
  if (kind === 'industrial') { if (base.metalness > 0.5) c.lerp(IRON, 0.55); else if (l > 0.55) c.lerp(CONC, 0.5); else satur(c, 0.75); return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: base.metalness > 0.5 ? 0.45 : 0.92, metalness: base.metalness > 0.5 ? 0.75 : 0 }); }
  if (kind === 'oriental') { if (!glow) { if (l > 0.72) c.lerp(HANJI, 0.6); else if (base.metalness > 0.5) c.lerp(C('#3b3029'), 0.45); else c.lerp(WOOD, 0.45); } return new THREE.MeshStandardMaterial({ ...common, ...em, color: c, map, roughness: 0.8, metalness: 0 }); }
  return base;
}
function styled(base, style) {
  if (style === 'real' || !base || !base.color) return base;
  const k = style + base.uuid; if (cache.has(k)) return cache.get(k);
  const common = { transparent: base.transparent, opacity: base.opacity, depthWrite: base.depthWrite, side: base.side };
  let m;
  const mk = STYLES[style] && STYLES[style].mat;
  if (mk) m = themed(base, mk, common);
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
export function applyStyleMaterials(root, style) {
  root.traverse((o) => {
    if (!o.isMesh) return; const base = (o.userData.baseMat ||= o.material);
    o.material = Array.isArray(base) ? base.map((b) => styled(b, style)) : styled(base, style);
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
uniform vec2 uRes; uniform float uNear, uFar, uOrtho, uWidth, uPaper, uWobble, uPastel, uMono, uSoft, uInk, uHatch, uHalf, uGlow, uVig, uSat; uniform vec3 uLine, uGrade;
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
  return smoothstep(0.55, 1.0, e);
}
void main(){
  vec2 uv = vUv; vec2 fc = uv * uRes; vec2 uvE = uv;
  if (uWobble > 0.5) uvE += (vec2(vnoise(fc * 0.02), vnoise(fc * 0.02 + 17.0)) - 0.5) * 1.1 / uRes;   // 선만 아주 살짝 흔들기 (그림 · 텍스처는 그대로)
  vec4 src = texture2D(tDiffuse, uv); vec3 col = src.rgb;
  if (uInk > 0.5) { // 수묵: 밝기 → 먹의 농담, 색은 옅은 담채로만 · 한지 결 · 가장자리는 번진 듯 옅게
    vec3 paper = vec3(0.925, 0.89, 0.81); float l = dot(col, vec3(0.3, 0.59, 0.11)), wash = pow(clamp(1.0 - l, 0.0, 1.0), 1.15);
    vec3 tint = mix(vec3(l), col, 0.28); col = mix(paper, tint * 0.5 + vec3(0.07, 0.06, 0.05), clamp(wash * 0.95 + 0.06, 0.0, 1.0));
    float fib = vnoise(vec2(fc.x * 0.015, fc.y * 0.5)) * 0.5 + vnoise(fc * 0.12) * 0.5; col *= 0.955 + 0.06 * fib; col = mix(col, paper, smoothstep(0.42, 0.8, length(vUv - 0.5)) * 0.4); }
  if (uGlow > 0.0) { vec3 b = vec3(0.0); float tw = 0.0; for (int i = 0; i < 16; i++) { float a = float(i) * 2.39996, r = 2.0 + float(i) * 1.9; vec2 o = vec2(cos(a), sin(a)) * r / uRes * 1.6; vec3 s = texture2D(tDiffuse, uv + o).rgb; float w = 1.0 / (1.0 + float(i) * 0.15); b += max(s - 0.8, 0.0) * w; tw += w; } col += b / tw * 4.0 * uGlow; } // 등불 번짐 (밝은 곳만 퍼짐)
  if (uSat != 1.0) col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, uSat);
  col *= uGrade;
  if (uHatch > 0.5) { float l = dot(col, vec3(0.3, 0.59, 0.11)); float h1 = step(0.5, fract((fc.x + fc.y) / 7.0)), h2 = step(0.5, fract((fc.x - fc.y) / 7.0)), h3 = step(0.5, fract(fc.x / 4.0));
    float ink = (l < 0.82 ? h1 : 0.0) + (l < 0.62 ? h2 : 0.0) * 0.9 + (l < 0.42 ? h3 : 0.0) * 0.8; vec3 pap = vec3(0.965, 0.945, 0.894); col = mix(pap, uLine, clamp(ink * 0.22, 0.0, 0.6)); col = mix(col, vec3(0.5, 0.62, 0.75), 0.06 * smoothstep(0.3, 0.8, src.b - src.r)); } // 연필 빗금 (어두울수록 겹침)
  if (uHalf > 0.5) { float l = dot(col, vec3(0.3, 0.59, 0.11)); vec2 g = fc / 7.0; mat2 r = mat2(0.7071, -0.7071, 0.7071, 0.7071); vec2 q = fract(r * g) - 0.5; float d = length(q), rad = sqrt(clamp(1.0 - l, 0.0, 1.0)) * 0.62; col = mix(col, col * 0.3, (1.0 - smoothstep(rad - 0.06, rad + 0.06, d)) * 0.65); col = floor(col * 4.0 + 0.5) / 4.0; } // 망점 + 색 단계
  if (uVig > 0.0) col *= 1.0 - uVig * smoothstep(0.35, 0.85, length(vUv - 0.5));
  if (uPastel > 0.0) { col = mix(col, vec3(1.0, 0.985, 0.96), uPastel); col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.12); }
  if (uMono > 0.5) col = vec3(mix(1.0, dot(col, vec3(0.3, 0.59, 0.11)), 0.12));
  float e = 0.0;
  if (uWidth > 0.0) { e = edgeAt(uvE, uWidth); if (uPaper > 0.5) e = max(e, edgeAt(uvE, uWidth * 1.45) * 0.7); if (uInk > 0.5) e *= 0.5 + 0.75 * vnoise(fc * 0.045); } // 만화: 두 겹으로 펜 굵기 · 수묵: 붓 누름처럼 진하고 옅게
  if (uPaper > 0.5) { float g = vnoise(fc * 0.35) * 0.7 + vnoise(fc * 1.3) * 0.3; col *= 0.965 + 0.05 * g; col = mix(col, vec3(0.97, 0.95, 0.9), 0.04); } // 종이 결 (점 잡음 없이 부드럽게)
  vec3 line = uSoft > 0.5 ? mix(col * 0.42, uLine, 0.6) : uLine;
  gl_FragColor = vec4(mix(col, line, e), src.a);
}`;

export class StylePass extends Pass {
  constructor(scene, camera, w, h) {
    super(); this.scene = scene; this.camera = camera; this.style = STYLES.real; this.hide = [];
    this.normalMat = new THREE.MeshNormalMaterial();
    this.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.rt.depthTexture = new THREE.DepthTexture(w, h); this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: {
      tDiffuse: { value: null }, tNormal: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(w, h) },
      uNear: { value: 0.1 }, uFar: { value: 100 }, uOrtho: { value: 0 }, uWidth: { value: 0 }, uPaper: { value: 0 }, uWobble: { value: 0 }, uPastel: { value: 0 }, uMono: { value: 0 }, uSoft: { value: 0 }, uInk: { value: 0 }, uHatch: { value: 0 }, uHalf: { value: 0 }, uGlow: { value: 0 }, uVig: { value: 0 }, uSat: { value: 1 }, uGrade: { value: new THREE.Vector3(1, 1, 1) }, uLine: { value: new THREE.Color('#000') } } });
    this.quad = new FullScreenQuad(this.mat);
  }
  setStyle(s) { this.style = s; const u = this.mat.uniforms; u.uWidth.value = s.outline || 0; u.uPaper.value = s.paper || 0; u.uWobble.value = s.wobble || 0; u.uPastel.value = s.pastel || 0; u.uMono.value = s.mono || 0; u.uSoft.value = s.soft || 0; u.uInk.value = s.ink || 0; u.uHatch.value = s.hatch || 0; u.uHalf.value = s.halftone || 0; u.uGlow.value = s.glow || 0; u.uVig.value = s.vig || 0; u.uSat.value = s.sat && !s.mat ? s.sat : s.mat === 'industrial' ? 0.85 : 1; u.uGrade.value.fromArray(s.grade || [1, 1, 1]); new THREE.Color(s.line || '#000').getRGB(u.uLine.value, THREE.SRGBColorSpace); /* OutputPass 뒤에서 그리므로 sRGB 값 그대로 */ this.enabled = !!(s.outline || s.paper || s.pastel || s.mono || s.ink || s.hatch || s.halftone || s.glow || s.vig || s.grade); }
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
