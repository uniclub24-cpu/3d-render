// 보기 스타일(렌더 필터): 실사 · 카툰 · 타이쿤 · 만화 · 클레이 · 도면
// 편집 상태는 그대로 두고 "보이는 방식"만 바꾼다 → 어느 스타일에서든 그리기 · 옮기기를 이어서 할 수 있다.
//   1) 재질 바꾸기: MeshStandardMaterial ↔ MeshToonMaterial(셀 셰이딩) / 무광 클레이 / 흰 도면
//   2) StylePass: 법선 · 깊이 · 색이 급히 바뀌는 곳에 외곽선을 긋고, 종이 질감 · 파스텔 보정을 얹는다
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const STYLES = {
  real:   { name: '실사',   hint: 'PBR 재질 · 그림자 · 틈새 음영',        ortho: false, ssao: true,  lights: true,  outline: 0,   bg: '#dfe5ea', ground: '#c3c8cd', ambient: 0.22, sun: 1 },
  toon:   { name: '카툰',   hint: '셀 셰이딩 + 검은 외곽선',              ortho: false, ssao: false, lights: false, outline: 1.3, bg: '#dfe9f2', ground: '#cfd8e0', ambient: 0.85, sun: 0.8, line: '#15161a', exposure: 1.25 },
  tycoon: { name: '타이쿤', hint: '위에서 본 파스텔 미니어처',            ortho: true,  ssao: false, lights: false, outline: 1.1, bg: '#dcefdc', ground: '#cfe6cf', ambient: 1.0,  sun: 0.62, line: '#4e2740', pastel: 0.1, soft: 1, exposure: 1.2 },
  comic:  { name: '만화',   hint: '굵은 잉크 선 + 종이 질감',             ortho: false, ssao: false, lights: false, outline: 2.2, bg: '#efe9dc', ground: '#e6dfcf', ambient: 0.95, sun: 0.7, line: '#141312', paper: 1, wobble: 1, exposure: 1.3 },
  clay:   { name: '클레이', hint: '무광 찰흙 모형 + 강한 틈새 음영',      ortho: false, ssao: true,  lights: false, outline: 0,   bg: '#ece6dd', ground: '#ddd5c9', ambient: 0.22, sun: 0.75, ssaoRadius: 0.95, exposure: 0.9 },
  plan:   { name: '도면',   hint: '원근 없는 흑백 등각 다이어그램',       ortho: true,  ssao: false, lights: false, outline: 1.2, bg: '#ffffff', ground: '#ffffff', ambient: 1.6,  sun: 0.25, line: '#1b1d21', mono: 1 },
};

/* ---------- 재질 바꾸기 ---------- */
const ramp = (steps) => { const d = new Uint8Array(steps.length * 4); steps.forEach((v, i) => d.set([v, v, v, 255], i * 4)); const t = new THREE.DataTexture(d, steps.length, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
const RAMP3 = ramp([150, 205, 255]), RAMP2 = ramp([196, 255]);
const cache = new Map(), WHITE = new THREE.Color('#ffffff'), CLAY = new THREE.Color('#e7dfd3');
function styled(base, style) {
  if (style === 'real' || !base || !base.color) return base;
  const k = style + base.uuid; if (cache.has(k)) return cache.get(k);
  const common = { transparent: base.transparent, opacity: base.opacity, depthWrite: base.depthWrite, side: base.side };
  let m;
  if (style === 'clay') m = new THREE.MeshStandardMaterial({ ...common, color: base.color.clone().lerp(CLAY, 0.55), roughness: 1, metalness: 0 });
  else if (style === 'plan') m = new THREE.MeshBasicMaterial({ ...common, color: base.transparent ? '#dfe9ee' : '#ffffff' });
  else {
    const c = base.color.clone(); if (base.metalness > 0.5) c.lerp(WHITE, 0.25); // 금속은 반사가 없어지므로 밝게
    if (style === 'tycoon') c.lerp(WHITE, 0.08);
    m = new THREE.MeshToonMaterial({ ...common, color: c, map: base.map && base.map.isCanvasTexture && !base.roughnessMap ? base.map : null, gradientMap: style === 'toon' ? RAMP3 : RAMP2 });
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
uniform vec2 uRes; uniform float uNear, uFar, uOrtho, uWidth, uPaper, uWobble, uPastel, uMono, uSoft; uniform vec3 uLine;
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
  vec2 uv = vUv; vec2 fc = uv * uRes;
  if (uWobble > 0.5) uv += (vec2(vnoise(fc * 0.03), vnoise(fc * 0.03 + 17.0)) - 0.5) * 2.4 / uRes;   // 손으로 그은 듯 살짝 흔들기
  vec4 src = texture2D(tDiffuse, uv); vec3 col = src.rgb;
  if (uPastel > 0.0) { col = mix(col, vec3(1.0, 0.985, 0.96), uPastel); col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.12); }
  if (uMono > 0.5) col = vec3(mix(1.0, dot(col, vec3(0.3, 0.59, 0.11)), 0.12));
  float e = 0.0;
  if (uWidth > 0.0) e = max(edgeAt(uv, uWidth), edgeAt(uv, uWidth * 1.9) * 0.85);
  if (uPaper > 0.5) { float g = vnoise(fc * 0.7) * 0.6 + hsh(floor(fc)) * 0.4; col *= 0.93 + 0.09 * g; col = mix(col, vec3(0.97, 0.95, 0.9), 0.04 + 0.05 * hsh(floor(fc / 1.5))); }
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
      uNear: { value: 0.1 }, uFar: { value: 100 }, uOrtho: { value: 0 }, uWidth: { value: 0 }, uPaper: { value: 0 }, uWobble: { value: 0 }, uPastel: { value: 0 }, uMono: { value: 0 }, uSoft: { value: 0 }, uLine: { value: new THREE.Color('#000') } } });
    this.quad = new FullScreenQuad(this.mat);
  }
  setStyle(s) { this.style = s; const u = this.mat.uniforms; u.uWidth.value = s.outline || 0; u.uPaper.value = s.paper || 0; u.uWobble.value = s.wobble || 0; u.uPastel.value = s.pastel || 0; u.uMono.value = s.mono || 0; u.uSoft.value = s.soft || 0; new THREE.Color(s.line || '#000').getRGB(u.uLine.value, THREE.SRGBColorSpace); /* OutputPass 뒤에서 그리므로 sRGB 값 그대로 */ this.enabled = !!(s.outline || s.paper || s.pastel || s.mono); }
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
