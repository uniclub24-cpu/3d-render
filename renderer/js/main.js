// 핵심 Three.js 엔진: 렌더러 · PBR 조명/그림자 · 후처리(EffectComposer → RenderPass → SSAOPass → OutputPass → FXAA) · 선택/이동
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { buildItem, buildWalls, buildFloors, placeItem, levelBounds, MM , buildCeiling, signLit } from './builder.js';
import { Walker } from './walk.js';
import { buildDims } from './dims.js';
import { buildLines, itemCat, isMepItem } from './lines.js';
import { figKind } from './figures.js';
const lumC = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
import { AirSim } from './air.js';
import { siteHit, siteFloors } from './site.js';
import { KitchenSim } from './sim.js';
import { setEnvMap } from './materials.js';
import { STYLES, StylePass, applyStyleMaterials, restoreMaterials } from './styles3d.js';
import { DesignEditor } from './design.js';
import { buildEnv } from './env.js';
import { pointInPoly, syncDrain } from './slope.js';

/* 화질 단계: 편집할 때는 빠르게, 보여 줄 때는 곱게.
 * pr = 화면 배율 상한 · ssao = 그림자 짙게(rest = 멈췄을 때만) · shadow = 해 그림자 지도 크기 · lights = 동시에 켜는 기물 광원 수(바뀌면 셰이더를 다시 만들어 버벅이므로 고정) */
export const QUALITY = {
  fast: { name: '빠름 (편집)', pr: 1, ssao: false, shadow: 1024, soft: false, lights: 8 },
  normal: { name: '보통', pr: 1.5, ssao: 'rest', shadow: 2048, soft: true, lights: 20 },
  high: { name: '고급 (보여 주기)', pr: 2, ssao: true, shadow: 4096, soft: true, lights: 40 },
};
/* 해상도: idle = 멈췄을 때 화면 배율 · move = 움직이는 동안 (빠르게 돌릴 땐 거칠게, 멈추면 또렷하게). 최고는 화면보다 크게 그려 줄여 보인다 */
export const RES = {
  low: { name: '낮음', idle: 0.75, move: 0.5 },
  normal: { name: '보통', idle: 1.25, move: 0.75 },
  high: { name: '높음', idle: 2, move: 1 },
  max: { name: '최고', idle: 3, move: 1, sup: true },
};

export class Engine {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx; // ctx = { lib, shapes, assets }
    this.level = null; this.selId = null; this.mode = 'select'; this.style = 'real';
    this.onSelect = () => {}; this.onChange = () => {}; this.onMove = () => {};
    this.opt = { ssao: true, ssaoRadius: 0.45, fxaa: true, shadows: true, sunHour: 14, sunPower: 2.0, exposure: 0.85, itemLights: true };

    /* ----- 렌더러 ----- */
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
    this.qual = QUALITY[(() => { try { return JSON.parse(localStorage.getItem('byr.quality')); } catch { return null; } })()] ? (() => { try { return JSON.parse(localStorage.getItem('byr.quality')); } catch { return 'normal'; } })() : matchMedia('(pointer: coarse)').matches ? 'fast' : 'normal';
    this.res = (() => { try { const v = localStorage.getItem('byr.res'); return RES[v] ? v : null; } catch { return null; } })() || (matchMedia('(pointer: coarse)').matches ? 'normal' : 'high');
    r.setPixelRatio(this._pr(false));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = this.opt.exposure;
    r.shadowMap.enabled = true; r.shadowMap.type = QUALITY[this.qual].soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; r.shadowMap.autoUpdate = false; /* 그림자는 장면이 바뀔 때만 다시 그린다 (시점만 돌릴 때는 그대로) */

    /* ----- 장면 · 카메라 ----- */
    const scene = (this.scene = new THREE.Scene()); scene.background = new THREE.Color('#dfe5ea');
    // 금속 반사를 위한 실내 환경 지도 (이미지 파일 없이 코드로 만든다)
    const pmrem = new THREE.PMREMGenerator(r); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.38; pmrem.dispose();
    setEnvMap(scene.environment); // 스테인리스 · 유리는 같은 지도를 더 세게 받는다
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 160);
    this.camera.position.set(9, 9, 12);
    this.persp = this.camera;
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300); // 타이쿤 · 도면 스타일: 원근 없는 미니어처 시점
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.09, maxPolarAngle: Math.PI / 2 - 0.03, minDistance: 0.8, maxDistance: 70, zoomToCursor: true });
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; this.controls.screenSpacePanning = false; /* 기존 앱처럼 바닥을 따라 밀기 */
    this.touch = matchMedia('(pointer: coarse)').matches; this.setMoveSpeed(+localStorage.getItem('byr.speed') || 1); /* 이동 속도 (느리게 0.6 · 보통 1 · 빠르게 1.5) */
    { /* 두 손가락을 비틀면 구도 돌리기 (지도 앱처럼) */
      const T = new Map(); let a0 = null;
      const ang = () => { const [p, q] = [...T.values()]; return Math.atan2(q.y - p.y, q.x - p.x); };
      canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; T.set(e.pointerId, { x: e.clientX, y: e.clientY }); a0 = T.size === 2 ? ang() : null; });
      canvas.addEventListener('pointermove', (e) => { if (!T.has(e.pointerId)) return; T.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (T.size !== 2 || a0 == null || this.walker.active || this.design.active) return;
        let d = ang() - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; if (Math.abs(d) < 0.004) return; a0 = ang();
        const t = this.controls.target, off = this.camera.position.clone().sub(t).applyAxisAngle(new THREE.Vector3(0, 1, 0), -d); this.camera.position.copy(t).add(off); this.camera.lookAt(t); });
      const up = (e) => { T.delete(e.pointerId); a0 = T.size === 2 ? ang() : null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    }

    /* ----- 기본 조명: AmbientLight + DirectionalLight(그림자) ----- */
    this.ambient = new THREE.AmbientLight('#ffffff', 0.22); scene.add(this.ambient);
    const sun = (this.sun = new THREE.DirectionalLight('#fff4e3', this.opt.sunPower));
    sun.castShadow = true; sun.shadow.mapSize.set(QUALITY[this.qual].shadow, QUALITY[this.qual].shadow); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
    scene.add(sun, sun.target);

    /* ----- 내용물: world(내보내기 대상) / helpers(선택 표시 등) ----- */
    this.world = new THREE.Group(); this.world.name = 'BYR'; scene.add(this.world);
    this.items = new THREE.Group(); this.items.name = '기물';
    this.helpers = new THREE.Group(); scene.add(this.helpers);
    const ground = this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#c3c8cd', roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.121; ground.receiveShadow = true; this.helpers.add(ground);
    this.selBox = new THREE.BoxHelper(new THREE.Object3D(), 0x2f7df6); this.selBox.visible = false; this.selBox.material.depthTest = false; this.selBox.renderOrder = 999; this.helpers.add(this.selBox);

    /* ----- 후처리 파이프라인 ----- */
    // 1) RenderPass : 장면을 그린다
    // 2) SSAOPass   : 깊이 · 법선으로 틈새 음영을 계산해 1) 위에 곱한다 (기물과 바닥이 닿는 모서리가 어두워진다)
    // 3) OutputPass : 톤 매핑 + sRGB 변환
    // 4) FXAA       : 후처리 뒤 남는 계단 현상을 정리 (렌더러 antialias 는 후처리 버퍼에는 적용되지 않아서 필요)
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }); // MSAA 4x
    this.composer = new EffectComposer(r, target);
    this.renderPass = new RenderPass(scene, this.camera);
    this.ssaoPass = new SSAOPass(scene, this.camera, size.x, size.y);
    this.ssaoPass.kernelRadius = this.opt.ssaoRadius; // 음영이 번지는 반경 (m)
    this.ssaoPass.minDistance = 0.00003; this.ssaoPass.maxDistance = 0.004; // 깊이 차이 허용 범위 (near~far 를 0~1 로 본 값)
    this.outputPass = new OutputPass();
    // 5) StylePass : 카툰 · 타이쿤 · 만화 · 도면 스타일의 외곽선 · 종이 질감 (실사에서는 꺼져 있음)
    this.stylePass = new StylePass(scene, this.camera, size.x, size.y); this.stylePass.hide = [this.selBox]; this.stylePass.enabled = false;
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.ssaoPass); this.composer.addPass(this.outputPass); this.composer.addPass(this.stylePass); this.composer.addPass(this.fxaaPass);

    this._bindPointer();
    this.design = new DesignEditor(this);
    this.walker = new Walker(this);
    this.air = new AirSim(this); this.sim = new KitchenSim(this);
    this.resize(); this.setSun(this.opt.sunHour);
    new ResizeObserver(() => this.resize()).observe(canvas);
    /* 필요할 때만 그리기: 엔진 함수가 불리거나(장면 바뀜) 시점이 움직이거나 움직이는 것(공기 · 동선 · 걷기 …)이 있을 때만 */
    this._need = 2; this._moveT = 0; this._lastR = 0;
    const skip = new Set(['constructor', '_frame', 'getView', 'centerOnFloor', 'snapshot', 'snapshotAt', 'invalidate', 'pick', '_pickAt', '_pr', 'floorAt', '_applyMep', 'pickLine', 'pickSite']);
    for (const k of Object.getOwnPropertyNames(Engine.prototype)) { const d = Object.getOwnPropertyDescriptor(Engine.prototype, k); if (skip.has(k) || !d || typeof d.value !== 'function') continue; const f = d.value; this[k] = (...a) => { const out = f.apply(this, a); this.invalidate(true); return out; }; }
    this.controls.addEventListener('change', () => { this._need = Math.max(this._need, 1); this._moveT = performance.now(); this._lightsFollow(); });
    for (const ev of ['pointerdown', 'pointermove', 'wheel', 'pointerup']) canvas.addEventListener(ev, () => (this._need = Math.max(this._need, 1)), { passive: true });
    THREE.DefaultLoadingManager.onLoad = () => this.invalidate(true); THREE.DefaultLoadingManager.onProgress = () => this.invalidate(false);
    r.setAnimationLoop(() => this._frame());
  }
  /** WASD · 방향키로 화면 옮기기 (보는 각도는 그대로, 바닥을 따라) */
  /** 화면 돌리기 · 밀기 · 확대 빠르기. 감속(damping)은 길게 둬서 멈출 때 부드럽게 */
  setMoveSpeed(k = 1) { this.moveK = k; const b = this.touch ? { r: 0.42, p: 0.35, z: 0.5, d: 0.07 } : { r: 0.6, p: 0.55, z: 0.55, d: 0.065 }; Object.assign(this.controls, { rotateSpeed: b.r * k, panSpeed: b.p * k, zoomSpeed: b.z * k, dampingFactor: b.d }); }
  _keyPan(dt) {
    const k = (x) => this.panKeys.has(x), ax = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0), ay = (k('s') || k('arrowdown') ? 1 : 0) - (k('w') || k('arrowup') ? 1 : 0); if (!ax && !ay) return;
    const c = this.camera, t = this.controls.target, f = new THREE.Vector3().subVectors(t, c.position); f.y = 0; if (f.lengthSq() < 1e-6) f.set(0, 0, -1); f.normalize(); const r = new THREE.Vector3(-f.z, 0, f.x);
    const sp = (c.isOrthographicCamera ? this.orthoSize / (c.zoom || 1) : c.position.distanceTo(t)) * 0.45 * (this.moveK || 1) * dt * (this.panFast ? 2 : 1), m = r.multiplyScalar(ax * sp).addScaledVector(f, -ay * sp);
    c.position.add(m); t.add(m); this._moveT = performance.now(); this._need = Math.max(this._need, 1);
  }
  /** 다음 틀에 다시 그리기 (scene = 장면이 바뀜 → 그림자도 다시) */
  invalidate(scene = true) { this._need = 2; if (scene && this.renderer) this.renderer.shadowMap.needsUpdate = true; }
  setQuality(q) {
    if (!QUALITY[q]) return; this.qual = q; const Q = QUALITY[q], r = this.renderer; try { localStorage.setItem('byr.quality', JSON.stringify(q)); } catch {}
    r.shadowMap.type = Q.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.sun.shadow.mapSize.x !== Q.shadow) { this.sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); /* 그림자 방식이 바뀌면 재질을 한 번 다시 만든다 */
    this.resize(); this._limitLights(); this.invalidate(true);
  }

  /** 해상도 배율 — moving 이면 가볍게 */
  _pr(moving) {
    const R = RES[this.res] || RES.normal, d = window.devicePixelRatio || 1;
    const idle = R.sup ? Math.min(3, Math.max(d * 1.5, 2)) : Math.min(d, R.idle); return Math.round((moving ? Math.min(idle, R.move * Math.max(1, d / 1.5)) : idle) * 100) / 100;
  }
  setRes(v) { if (!RES[v]) return; this.res = v; try { localStorage.setItem('byr.res', v); } catch {} this.renderer.setPixelRatio(this._pr(false)); this.resize(); this.invalidate(false); }

  /* ---------- 크기 · 그리기 ---------- */
  resize() {
    const el = this.canvas; if (!el.clientWidth) return; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight), pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false); this.composer.setPixelRatio && this.composer.setPixelRatio(pr); this.composer.setSize(w, h); this.ssaoPass.setSize(w * pr, h * pr); this.stylePass.setSize(w * pr, h * pr);
    this.fxaaPass.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    this.persp.aspect = w / h; this.persp.updateProjectionMatrix(); this.aspect = w / h; this._fitOrtho(); this._applyShift();
  }
  /** 화면 오른쪽을 패널이 가릴 때 장면 가운데를 왼쪽으로 옮긴다 (px) */
  setShift(px) { this.shift = px || 0; this._applyShift(); }
  _applyShift() { const el = this.canvas, w = el.clientWidth, h = el.clientHeight; if (!w) return; for (const c of [this.persp, this.ortho]) { if (this.shift) c.setViewOffset(w, h, this.shift, 0, w, h); else c.clearViewOffset(); } }
  _fitOrtho() { const o = this.ortho, s = this.orthoSize || 8, a = this.aspect || 1; o.left = -s * a; o.right = s * a; o.top = s; o.bottom = -s; o.updateProjectionMatrix(); }
  _frame() {
    const now = performance.now(), dt = Math.min(0.1, ((now - (this._t || now)) / 1000)); this._t = now;
    this.air.update(dt); this.sim.update(dt); if (this.onTick) this.onTick(dt); // 2D 만 볼 때도 시뮬레이션은 돈다
    if (!this.canvas.clientWidth) return; // 2D 만 볼 때는 3D 를 그리지 않는다
    if (this._fly) { const f = this._fly; f.t += dt * 1000; const k = Math.min(1, f.t / f.ms); f.step(k); if (k >= 1) { this._fly = null; f.done(true); } }
    if (this.walker.active) this.walker.update(dt); else { if (this.panKeys && this.panKeys.size) this._keyPan(dt); if (this.controls.update()) this._moveT = now; }
    const anim = this.air.on || (this.sim.on && this.sim.run) || this.walker.active || this._fly || this.controls.autoRotate || this.design.active || this.dragging;
    const moving = anim || now - this._moveT < 220;
    if (!anim && !this._need && !(this._wasMoving && !moving) && now - this._lastR < 2000) return; /* 아무것도 안 바뀌면 그리지 않음 (멈춘 화면은 GPU 를 쉬게) */
    if (this._need > 0) this._need--; this._wasMoving = moving; this._lastR = now;
    { const pr = this._pr(!this._fixPr && (now - this._moveT < 220 || !!this._fly || !!this.dragging)); if (Math.abs(pr - this.renderer.getPixelRatio()) > 0.01) { this.renderer.setPixelRatio(pr); this.resize(); } } /* 움직일 땐 낮은 해상도, 멈추면 정한 해상도로 다시 */
    if (this.selBox.visible) this.selBox.update();
    const Q = QUALITY[this.qual]; /* 움직이는 동안에는 짙은 그림자(SSAO)를 끄고, 멈추면 한 번 곱게 다시 그린다 */
    this.ssaoPass.enabled = this.opt.ssao && STYLES[this.style].ssao && !this.camera.isOrthographicCamera && (Q.ssao === true || (Q.ssao === 'rest' && !moving)); this.fxaaPass.enabled = this.opt.fxaa;
    this.selBox.visible && (this.selBox.visible = !!(this.selId || this.hl));
    // 선택 표시 · 바닥 평면은 SSAO 법선 계산에서 빼지 않아도 되지만, 선택 상자는 선이라 영향이 없다
    this.composer.render();
  }
  /** 화면을 PNG dataURL 로 */
  snapshot() { this.composer.render(); return this.canvas.toDataURL('image/png'); }
  /** 정한 해상도로 한 장 (렌더 해상도) — type: image/png | image/jpeg */
  snapshotAt(W, H, type = 'image/png') {
    const r = this.renderer, pr = r.getPixelRatio(), sh = this.shift; this.shift = 0;
    try { r.setPixelRatio(1); r.setSize(W, H, false); this.composer.setPixelRatio && this.composer.setPixelRatio(1); this.composer.setSize(W, H); this.ssaoPass.setSize(W, H); this.stylePass.setSize(W, H); this.fxaaPass.material.uniforms.resolution.value.set(1 / W, 1 / H);
      this.persp.aspect = W / H; this.persp.clearViewOffset(); this.persp.updateProjectionMatrix(); this.aspect = W / H; this._fitOrtho(); this.ortho.clearViewOffset(); this.composer.render(); return this.canvas.toDataURL(type, 0.92); }
    finally { r.setPixelRatio(pr); this.composer.setPixelRatio && this.composer.setPixelRatio(pr); this.shift = sh; this.resize(); }
  }
  /* ---------- 단면 보기 (기존 앱 v12): h = 높이에서 자르기 · x / z = 세로로 자르기 ---------- */
  setSection(sec) {
    this.section = sec && sec.mode !== 'off' ? sec : null; const r = this.renderer;
    if (!this.section) { r.clippingPlanes = []; return; }
    const { mode, at = 1200, flip = false } = this.section, s = flip ? -1 : 1, v = at * MM;
    const pl = mode === 'h' ? new THREE.Plane(new THREE.Vector3(0, -1, 0), v) : mode === 'x' ? new THREE.Plane(new THREE.Vector3(-s, 0, 0), s * v) : new THREE.Plane(new THREE.Vector3(0, 0, -s), s * v);
    r.clippingPlanes = [pl];
  }
  /* ---------- 시점 저장 · 투어 · 360° ---------- */
  getView() { const c = this.camera, t = this.controls.target; return { p: c.position.toArray().map((v) => +v.toFixed(3)), t: t.toArray().map((v) => +v.toFixed(3)), zoom: c.zoom || 1, ortho: !!c.isOrthographicCamera, size: this.orthoSize }; }
  /** ms 동안 부드럽게 옮긴다 → Promise */
  flyTo(v, ms = 1200) {
    const c = this.camera, p0 = c.position.clone(), t0 = this.controls.target.clone(), p1 = new THREE.Vector3(...v.p), t1 = new THREE.Vector3(...v.t), z0 = c.zoom || 1, z1 = v.zoom || 1;
    if (this._fly) this._fly.done();
    return new Promise((ok) => { this._fly = { t: 0, ms: Math.max(1, ms), done: ok, step: (k) => { const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; c.position.lerpVectors(p0, p1, e); this.controls.target.lerpVectors(t0, t1, e); if (c.isOrthographicCamera) { c.zoom = z0 + (z1 - z0) * e; c.updateProjectionMatrix(); } } }; });
  }
  stopFly() { if (this._fly) { const f = this._fly; this._fly = null; f.done(false); } }
  setSpin(on, speed = 1.2) { this.controls.autoRotate = !!on; this.controls.autoRotateSpeed = speed; }

  /* ---------- 옵션 ---------- */
  setOption(k, v) {
    this.opt[k] = v;
    if (k === 'ssaoRadius') this.ssaoPass.kernelRadius = v;
    if (k === 'shadows') { this.sun.castShadow = v; this.renderer.shadowMap.needsUpdate = true; }
    if (k === 'sunHour') this.setSun(v);
    if (k === 'sunPower') this.sun.intensity = v * STYLES[this.style].sun;
    if (k === 'exposure') this.renderer.toneMappingExposure = v * (STYLES[this.style].exposure || 1);
    if (k === 'itemLights') this._limitLights();
  }
  /** 햇빛 방향: 6시(동) ~ 18시(서) */
  setSun(hour) {
    const b = this.bounds || { cx: 4, cz: 3, r: 8 }, a = ((hour - 6) / 12) * Math.PI, alt = Math.max(0.18, Math.sin(a)) * 1.05;
    const dir = new THREE.Vector3(Math.cos(a) * 0.9, alt, 0.45).normalize();
    this.sun.target.position.set(b.cx, 0, b.cz); this.sun.position.copy(this.sun.target.position).addScaledVector(dir, b.r * 2.2);
    const c = this.sun.shadow.camera, s = b.r * 1.25; c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 0.5; c.far = b.r * 5; c.updateProjectionMatrix();
    const warm = 1 - Math.min(1, alt / 0.7); this.sun.color.set('#fff4e3').lerp(new THREE.Color('#ffb070'), warm * 0.7);
  }

  /* ---------- 모델 → 장면 ---------- */
  setLevel(level) {
    this.level = level; this.selId = null; this.hl = null; this.selBox.visible = false;
    for (const c of [...this.world.children]) { this.world.remove(c); disposeTree(c); }
    this.items = new THREE.Group(); this.items.name = '기물';
    for (const r of level.rooms || []) syncDrain(level, r);
    this.structure = new THREE.Group(); this.structure.name = '구조';
    this.structure.add(buildFloors(level), buildWalls(level), buildCeiling(level), buildDims(level), buildLines(level, { sel: this.selLine }));
    this.world.add(this.structure, this.items);
    for (const it of level.items) this.items.add(buildItem(it, this.ctx));
    applyStyleMaterials(this.world, this.style);
    const b = levelBounds(level); this.bounds = { cx: ((b[0] + b[2]) / 2) * MM, cz: ((b[1] + b[3]) / 2) * MM, r: Math.max(3, (Math.hypot(b[2] - b[0], b[3] - b[1]) / 2) * MM) };
    this.setSun(this.opt.sunHour); this._limitLights(); if (this.envE) this.setEnv(this.envE, this.envMeta); this.applyFocus(); this._applyXray(); if (this.air.on) this.air.refresh();
  }
  itemGroup(id) { return this.items.children.find((g) => g.userData.itemId === id) || null; }
  /** 기물 하나를 다시 만든다 (색 · 크기 · 조명 변경 뒤) */
  rebuildItem(it) {
    const old = this.itemGroup(it.id), g = buildItem(it, this.ctx);
    if (old) { this.items.remove(old); disposeTree(old); } this.items.add(g); applyStyleMaterials(g, this.style); if (this.focusPts) this.applyFocus(); if (this.xray) this._applyXray(); else this._applyMep();
    if (this.selId === it.id) this.selBox.setFromObject(g);
    this._limitLights(); return g;
  }
  /** 배관 · 전선만 다시 (높이 · 굵기 · 모양 · 고르기 바뀔 때) */
  rebuildLines() {
    if (!this.structure || !this.level) return; const old = this.structure.children.find((c) => c.userData.mep), g = buildLines(this.level, { sel: this.selLine });
    if (old) { this.structure.remove(old); disposeTree(old); } applyStyleMaterials(g, this.style); this.structure.add(g); this._applyXray(); this.invalidate(true);
  }
  selectLine(id) { if (this.selLine === (id || null)) return; this.selLine = id || null; this.rebuildLines(); }
  /** 설치물 숨기기: 끄면 배관 · 전선 · 콘센트 · 수전 위치 등이 일반 화면 · 발표(설치물 보기 빼고)에서 사라진다 */
  setMepHide(on) { this.mepHide = !!on; this._applyMep(); this.invalidate(true); }
  _applyMep() {
    const hide = this.present ? this.present !== 'mep' : !!this.mepHide && !this.xray;
    if (this.structure) for (const c of this.structure.children) if (c.userData.mep) c.visible = !hide;
    if (this.items && this.level) for (const g of this.items.children) { const it = this.level.items.find((q) => q.id === g.userData.itemId); if (it && isMepItem(this.ctx.lib[it.type], it.type)) g.visible = !hide; }
    if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
  }
  /** 벽 · 문/창 · 바닥만 다시 만든다 (2D 도면에서 벽을 그리거나 끌 때 바로 3D 에 반영) */
  rebuildStructure() {
    if (!this.level) return; const old = this.structure; for (const r of this.level.rooms || []) syncDrain(this.level, r);
    this.structure = new THREE.Group(); this.structure.name = '구조'; this.structure.add(buildFloors(this.level), buildWalls(this.level), buildCeiling(this.level), buildDims(this.level), buildLines(this.level, { sel: this.selLine }));
    applyStyleMaterials(this.structure, this.style);
    if (old) { this.world.remove(old); disposeTree(old); } this.world.add(this.structure);
    const b = levelBounds(this.level); this.bounds = { cx: ((b[0] + b[2]) / 2) * MM, cz: ((b[1] + b[3]) / 2) * MM, r: Math.max(3, (Math.hypot(b[2] - b[0], b[3] - b[1]) / 2) * MM) };
    this.renderer.shadowMap.needsUpdate = true; if (this.hl) this.highlight(this.hl); this.replaceItems(); this.applyFocus(); this._applyXray(); if (this.air.on) this.air.refresh();
  }
  /** 설치물 투시: cat = 'floor' | 'wall' | 'ceil' | null. 그 분류의 배관 · 전선 · 설비만 진하게, 나머지는 흑백 반투명 */
  setXray(cat) { this.xray = cat || null; applyStyleMaterials(this.world, this.style); if (this.envGroup) this.envGroup.visible = !this.xray && !this.focusPts; this._applyXray(); }
  /** 댓글 핀 (3D 글자판) */
  setPins(pins) {
    if (this.pinG) { this.scene.remove(this.pinG); disposeTree(this.pinG); } this.pinG = new THREE.Group(); this.pinG.name = '댓글 핀'; this.scene.add(this.pinG);
    (pins || []).forEach((c, i) => { const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = 64; cv.height = 84; g.fillStyle = c.done ? '#7c8794' : '#ff6b3d'; g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(32, 30, 26, 0, Math.PI * 2); g.moveTo(16, 48); g.lineTo(32, 82); g.lineTo(48, 48); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = '700 30px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), 32, 31); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.center.set(0.5, 0); s.scale.set(0.3, 0.39, 1); s.position.set(c.x * MM, (c.z ?? 1600) * MM, c.y * MM); s.renderOrder = 998; this.pinG.add(s); });
  }
  /* ---------- 벽 낮춰 보기 · 레이어 투명도 (기존 앱 v13) ---------- */
  setWallCut(h) { this.wallCut = h || null; this._applyCut(); }
  _applyCut() { if (!this.structure) return; const H = (this.level && this.level.ceilingH) || 2700; for (const g of this.structure.children) if (g.name === '벽') g.scale.y = this.wallCut ? Math.max(0.02, this.wallCut / H) : 1; this.renderer.shadowMap.needsUpdate = true; }
  setLayerOpacity(op) { this.layerOp = { ...op }; this._applyLayers(); }
  _applyLayers() {
    const op = this.layerOp || {}, any = Object.values(op).some((v) => v < 1); if (!any && !this._layered) return; this._layered = any;
    for (const g of this.items.children) { const it = this.level && this.level.items.find((q) => q.id === g.userData.itemId), L = it && this.ctx.lib[it.type], ly = (L && L.layer) || 'floor', a = op[ly === 'ceiling' ? 'ceil' : ly] ?? 1;
      g.traverse((o) => { if (!o.isMesh) return; const u = o.userData; if (u.opMat && o.material !== u.opMat) { u.opBase = null; u.opMat = null; } /* 스타일이 재질을 바꿈 */
        if (a >= 1) { if (u.opBase) { o.material = u.opBase; u.opBase = u.opMat = null; } return; }
        const base = u.opBase || o.material, m = Array.isArray(base) ? base.map((x) => x.clone()) : base.clone(); for (const x of [].concat(m)) { x.transparent = true; x.opacity = a * (x.opacity ?? 1); x.depthWrite = false; }
        u.opBase = base; u.opMat = m; o.material = m; }); }
  }
  _applyXray() {
    this._applyCut(); this._applyLayers(); this._applyMep();
    const cat = this.xray; if (!cat) return; const gray = (this._xrMat ||= new THREE.MeshStandardMaterial({ color: '#c9ccd1', transparent: true, opacity: 0.16, depthWrite: false, roughness: 1 }));
    const keep = (o) => { for (let p = o; p; p = p.parent) { if (p.userData.xr) return p.userData.xr === cat; if (p.userData.itemId) { const it = this.level.items.find((q) => q.id === p.userData.itemId); return it ? itemCat(this.ctx.lib[it.type]) === cat : false; } } return false; };
    this.world.traverse((o) => { if (!o.isMesh) return; o.userData.baseMat ||= o.material; if (!keep(o)) o.material = gray; });
    if (this.structure) for (const g of this.structure.getObjectsByProperty('name', '천장')) g.visible = cat === 'ceil' || g.visible;
  }
  /* ---------- 프레젠테이션 모드: free · mep(설치물 투시) · light(조명 · 디밍) ----------
   * 모델은 건드리지 않고 보이는 재질 · 천장 · 광원 세기만 바꾼다. 나가면 setPresent(null) 로 모두 원래대로. */
  /** 조명 기물인가 (튀김기 · 레인지의 불빛은 빼고) · 무리: 매입·직부등 / 펜던트 / LED 평판·라인 / 후드등 / 핀·레일 / 스탠드·벽등 */
  lightGroup(it) { if (!it) return null; const L = this.ctx.lib[it.type] || {}, t = it.type || '', sh = L.shape || '', nm = `${it.name || ''} ${L.name || ''} ${t}`;
    if (/fryer|range|griddle|wok|oven|steam|soup|튀김|레인지|화구|그리들|오븐|국솥/i.test(t + ' ' + (L.name || '')) && !/등\b|조명/.test(it.name || '')) return null; /* 조리 기구 불빛은 조명 아님 */
    const byName = /조명|직부|다운라이트|펜던트|매입등|평판|라인등|핀조명|스포트|레일등|후드등|벽등|스탠드|램프|네온|무드등|외부등|lamp|light|LT-\d/i.test(nm);
    if (L.sign && signLit({ ...L.sign, ...(it.sign || {}) }, it)) return 'sign'; /* 불 들어오는 간판 */
    const lit = (it.light && it.light.on) || L.cat === '조명' || /^l_/.test(t) || (L.light && /light|pendant|track|lamp/.test(sh)) || byName; if (!lit) return null;
    if (/네온|neon|무드|strip/i.test(nm)) return 'neon';
    if (/외부등|l_post|정원등|기둥등/i.test(nm)) return 'out';
    if (/3구|triple/i.test(nm)) return 'triple';
    if (/후드등|hood/i.test(nm)) return 'hood';
    if (/핀|스포트|레일|spot|track|pin/i.test(nm) || sh === 'track') return 'pin';
    if (/펜던트|pendant|lantern|globe|초롱|등롱/i.test(nm) || sh === 'pendant') return 'pendant';
    if (/평판|라인|LED 바|flat|line|strip|panel|형광/i.test(nm)) return 'flat';
    if (/직부|다운|매입|돔|down|surface|direct/i.test(nm) || sh === 'light') return 'down';
    return 'etc'; }
  _isLightItem(g) { const it = this.level && this.level.items.find((q) => q.id === g.userData.itemId); return !!this.lightGroup(it); }
  _presentClear() {
    for (const e of this._pEdges || []) { e.parent && e.parent.remove(e); e.geometry.dispose(); } this._pEdges = [];
    if (this.presentLights) { this.presentLights = false; }
    if (this._envOff) { setEnvMap(this.scene.environment); this._envOff = false; }
    this.setStyle(this.style); /* 재질 · 빛 · 노출 · 후처리를 스타일 기본으로 */
  }
  setPresent(mode, o = {}) {
    this._presentClear(); this.present = mode || null; this._applyMep(); const st = STYLES[this.style];
    this.showCeiling(!this.level || !this.level.ceiling || this.level.ceiling.on !== false);
    if (mode === 'mep') {
      const gray = (this._pGray ||= new THREE.MeshStandardMaterial({ color: '#d0d4d9', transparent: true, opacity: 0.25, depthWrite: false, roughness: 1 })), bur = (this._pBur ||= new THREE.MeshStandardMaterial({ color: '#6e1423', roughness: 0.55, metalness: 0.1 })), edge = (this._pEdge ||= new THREE.LineBasicMaterial({ color: '#000000' }));
      gray.opacity = o.opacity ?? gray.opacity;
      const isMep = (m) => { for (let p = m; p; p = p.parent) { if (p.userData.xr) return true; if (p.userData.itemId) { if (this._isLightItem(p)) return false; const it = this.level.items.find((q) => q.id === p.userData.itemId), L = it && this.ctx.lib[it.type]; return !!(L && (itemCat(L) || /hood|duct|gas|drain|trench|trap|outlet|fan|aircon|ac_|brace|vent|boiler/.test(it.type))); } } return false; };
      const list = []; this.world.traverse((m) => { if (m.isMesh) list.push(m); });
      for (const m of list) { m.userData.baseMat ||= m.material; if (isMep(m)) { m.material = bur; const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), edge); e.raycast = () => {}; m.add(e); this._pEdges.push(e); } else m.material = gray; }
      if (this.envGroup) this.envGroup.visible = false;
    } else if (mode === 'light') {
      this.showCeiling(false); this.presentLights = true; this._envI0 = this.scene.environmentIntensity; setEnvMap(null); this._envOff = true; /* 스테인리스 반사도 같이 어둡게 */ this.renderer.toneMappingExposure *= 1.1;
      const u = this.stylePass.mat.uniforms; u.uGlow.value = Math.max(u.uGlow.value, 0.55); u.uVig.value = Math.max(u.uVig.value, 0.35); this.stylePass.enabled = true; /* 어두운 데서 빛 번짐이 보이게 */
      for (const g of this.items.children) if (this._isLightItem(g)) { const it = this.level.items.find((q) => q.id === g.userData.itemId), grp = this.lightGroup(it); this.setDim(g.userData.itemId, grp === 'sign' || grp === 'neon' ? 1 : o.dim ?? 0.2, true); } this._darkness(); /* 간판 · 네온은 켠 채로 시작 */
    } else if (this.envGroup) this.envGroup.visible = !this.focusPts;
    this._limitLights(); this.renderer.shadowMap.needsUpdate = true;
  }
  setPresentOpacity(a) { if (this._pGray) { this._pGray.opacity = a; this._pGray.depthWrite = a > 0.95; this._pGray.transparent = a < 1; this._pGray.needsUpdate = true; } }
  /** 조명 기물 목록 (프레젠테이션 디머용) */
  lightItems() { return this.items.children.filter((g) => this._isLightItem(g)).map((g) => { const it = this.level.items.find((q) => q.id === g.userData.itemId); return { id: it.id, name: it.name || (this.ctx.lib[it.type] || {}).name || '조명', group: this.lightGroup(it), dim: g.userData.dim ?? 1 }; }); }
  /** 조명 모드의 어둠: 켜진 조명 중 가장 밝은 값에 따라 주변광 · 환경광 · 해를 낮춤 → 다 끄면 거의 암전 */
  _darkness() { if (this.present !== 'light') return; const st = STYLES[this.style], m = Math.max(0, ...this.items.children.filter((g) => this._isLightItem(g)).map((g) => Math.min(1, g.userData.dim ?? 0)));
    this.ambient.intensity = 0.006 + 0.045 * m * Math.min(1, st.ambient * 3); this.sun.intensity = this.opt.sunPower * st.sun * 0.04 * m; this.scene.environmentIntensity = (this._envI0 || 0.3) * (0.015 + 0.09 * m); this.renderer.shadowMap.needsUpdate = true; }
  /** 한 조명의 밝기 (0 ~ 1.5). 광원 세기 + 전등 몸체 발광 같이 */
  setDim(id, v, quiet) {
    const g = this.itemGroup(id); if (!g) return; g.userData.dim = v;
    g.traverse((o) => { if (o.userData.itemLight) o.userData.dim = v; if (!o.isMesh || !o.material || Array.isArray(o.material)) return; const u = o.userData;
      if (!u.dimMat || o.material !== u.dimMat) { u.dimBase = o.material; u.dimMat = o.material.clone(); o.material = u.dimMat; }
      const b = u.dimBase, m = u.dimMat;
      if (m.emissive) { const glow = b.emissive && lumC(b.emissive) > 0.05; if (glow) { m.emissive.copy(b.emissive); m.emissiveIntensity = (b.emissiveIntensity || 1) * v; } else if (lumC(b.color || m.color) > 0.6) { m.emissive.set('#ffe7c4'); m.emissiveIntensity = 0.85 * v; } else m.emissiveIntensity = 0; }
      else if (m.color && b.color) m.color.copy(b.color).multiplyScalar(0.06 + 0.94 * Math.min(1, v)); /* 빛나는 기본 재질(전구면)도 어둡게 */ });
    if (!quiet) { this._limitLights(); this._darkness(); }
  }

  /** 천장 보이기 · 끄기 (모델의 level.ceiling.on 과 함께) */
  showCeiling(on) { if (this.structure) for (const g of this.structure.getObjectsByProperty('name', '천장')) g.visible = on; }
  /** 배경(상권) 다시 세우기. E = model.env */
  setEnv(E, meta = {}) {
    if (this.envGroup) { this.scene.remove(this.envGroup); disposeTree(this.envGroup); this.envGroup = null; }
    this.envE = E; this.envMeta = meta; if (!E || !this.level) return;
    this.envGroup = buildEnv(this.level, E, meta); applyStyleMaterials(this.envGroup, this.style); this.scene.add(this.envGroup);
    this.ground.visible = E.type === 'none' || E.type === 'basic'; this.controls.maxDistance = E.type === 'none' || E.type === 'basic' ? 70 : 260;
    const site = E.type === 'site' && !!E.site; this.siteOn = site; /* 상권(반경 500m): 멀리까지 보이게 */
    this.persp.far = site ? 4000 : 160; this.persp.updateProjectionMatrix(); if (site) { this.controls.maxDistance = 1600; this.ground.visible = false; }
    this.ssaoPass.enabled = !site && this.opt.ssao && QUALITY[this.qual].ssao; this.invalidate(true);
  }
  /** 상권 건물 고르기 → 건물 번호 */
  pickSite(e) { if (!this.siteOn || !this.envGroup) return null; const hs = this._ray(e).intersectObject(this.envGroup, true); for (const h of hs) { const i = siteHit(h); if (i != null) return i; if (h.object.userData.site === undefined && h.distance < 0) break; } return null; }
  /** 고른 건물 강조 (파란 테두리 상자) */
  siteMark(i) {
    if (this._siteMark) { this.scene.remove(this._siteMark); disposeTree(this._siteMark); this._siteMark = null; } const E = this.envE; if (i == null || !E || !E.site) return this.invalidate(true);
    const b = E.site.buildings[i]; if (!b) return; const ax = E.siteAx || 0, ay = E.siteAy || 0, h = Math.max(2.8, siteFloors(b) * 3.3 * (E.hk ?? 1));
    const pts = b.p.map(([x, y]) => new THREE.Vector3(x - ax, h + 0.05, y - ay)); pts.push(pts[0].clone()); const top = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2f7df6' }));
    const bot = top.clone(); bot.position.y = -h; const g = new THREE.Group(); g.add(top, bot); for (const p of pts.slice(0, -1)) { const v = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, p.clone().setY(0.05)]), top.material); g.add(v); }
    this._siteMark = g; this.scene.add(g); this.invalidate(true);
  }
  /** 공간만 보기: 그 다각형 안의 기물과 닿는 벽만 남긴다 (pts = null 이면 전체) */
  setFocus(pts) { this.focusPts = pts && pts.length >= 3 ? pts : null; this.applyFocus(); }
  applyFocus() {
    const F = this.focusPts, near = (x, y) => !F || pointInPoly(x, y, F) || F.some((p, i) => { const q = F[(i + 1) % F.length], dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / L)); return Math.hypot(p[0] + dx * t - x, p[1] + dy * t - y) < 400; });
    if (!this.level) return;
    const hiddenIn = (it) => { const Lb = this.ctx.lib[it.type], ly = Lb ? (Lb.layer === 'ceiling' ? 'ceil' : Lb.layer || 'floor') : 'floor'; for (const r of this.level.rooms || []) if (r.vis && r.vis[ly] === false && pointInPoly(it.x, it.y, r.pts)) return true; return false; };
    for (const g of this.items.children) { const it = this.level.items.find((q) => q.id === g.userData.itemId); g.visible = !it || (near(it.x, it.y) && !hiddenIn(it)); }
    if (this.structure) for (const g of this.structure.getObjectsByProperty('name', '벽')) { const w = g.userData.wallId && this.level.walls.find((q) => q.id === g.userData.wallId); if (w) g.visible = near((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2) || (near(w.x1, w.y1) && near(w.x2, w.y2)); }
    if (this.envGroup) this.envGroup.visible = !F;
  }
  /** 다각형(mm)이 화면에 꽉 차게 */
  frame(pts) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * MM, cz = ((Math.min(...ys) + Math.max(...ys)) / 2) * MM, r = Math.max(2, (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2) * MM);
    const t = new THREE.Vector3(cx, 0.6, cz), dir = this.camera.position.clone().sub(this.controls.target).normalize(); this.controls.target.copy(t);
    if (this.camera.isOrthographicCamera) { this.camera.zoom = 1; this.orthoSize = r * 0.95; this._fitOrtho(); this.camera.position.copy(t).addScaledVector(dir, 40); } else this.camera.position.copy(t).addScaledVector(dir, r * 2.2);
    this.controls.update(); this._moveT = performance.now();
  }
  /** 보기 스타일 바꾸기 — 모델은 그대로라서 어떤 스타일에서도 계속 편집할 수 있다 */
  setStyle(name) {
    const st = STYLES[name]; if (!st) return; this.style = name;
    applyStyleMaterials(this.world, name); if (this.envGroup) applyStyleMaterials(this.envGroup, name); this._applyXray();
    this.scene.background = new THREE.Color(st.bg); this.ground.material.color.set(st.ground);
    this.ambient.intensity = st.ambient; this.sun.intensity = this.opt.sunPower * st.sun;
    this.renderer.toneMapping = name === 'real' || name === 'clay' || st.aces ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping; this.renderer.toneMappingExposure = this.opt.exposure * (st.exposure || 1);
    this.scene.environmentIntensity = name === 'real' ? 0.38 : name === 'clay' ? 0.35 : st.mat === 'izakaya' || st.mat === 'oriental' ? 0.06 : st.mat === 'industrial' ? 0.14 : 0.25;
    this.ssaoPass.kernelRadius = st.ssaoRadius || this.opt.ssaoRadius;
    this.stylePass.setStyle(st);
    this._useCamera(st.ortho ? this.ortho : this.persp);
    this._limitLights();
    if (this.sim && this.sim.figs && this.sim.figKind !== figKind(name)) this.sim.buildMeshes(); /* 스타일에 맞는 사람 모양으로 */
  }
  /** 원근 ↔ 정투영 카메라를 같은 시점으로 바꿔 끼운다 */
  _useCamera(cam) {
    const prev = this.camera; if (prev === cam) return;
    const t = this.controls.target, dist = prev.position.distanceTo(t);
    if (cam.isOrthographicCamera) { this.orthoSize = Math.max(2, 1.3 * dist * Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2)) / (prev.zoom || 1)); cam.zoom = 1; this._fitOrtho(); }
    cam.position.copy(t).addScaledVector(prev.position.clone().sub(t).normalize(), cam.isOrthographicCamera ? Math.max(dist, 40) : this.orthoSize ? this.orthoSize / 1.3 / Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2)) / (prev.zoom || 1) : dist);
    cam.updateProjectionMatrix(); this.camera = cam; this.controls.object = cam;
    for (const p of [this.renderPass, this.ssaoPass, this.stylePass]) p.camera = cam;
    this.controls.update();
  }
  /** 모든 층을 층 높이(elev)대로 쌓은 Group (내보내기용 · PBR 재질) */
  buildAll(levels, zOfFor) {
    const root = new THREE.Group(); root.name = 'BYR 전체 층';
    for (const L of levels) { for (const r of L.rooms || []) syncDrain(L, r); const g = new THREE.Group(); g.name = L.name || '층'; g.position.y = (L.elev || 0) * MM; g.add(buildFloors(L), buildWalls(L), buildCeiling(L), buildLines(L)); const ctx = { ...this.ctx, zOf: zOfFor(L) }; for (const it of L.items) g.add(buildItem(it, ctx)); g.traverse((o) => { if (o.isLight) o.visible = false; }); root.add(g); }
    root.updateMatrixWorld(true); return root;
  }
  disposeTree(o) { disposeTree(o); }
  /** 내보내기처럼 원래 PBR 재질이 필요할 때 */
  async withRealMaterials(fn) { restoreMaterials(this.world); try { return await fn(); } finally { applyStyleMaterials(this.world, this.style); } }
  removeItem(id) { const g = this.itemGroup(id); if (g) { this.items.remove(g); disposeTree(g); } if (this.selId === id) this.select(null); this._limitLights(); }
  moveItem(it) { const g = this.itemGroup(it.id); if (g) placeItem(g, it, this.ctx.zOf ? this.ctx.zOf(it) : it.elev); }
  /** 바닥 높이(단 · 구배)가 바뀌었을 때 모든 기물 높이 다시 */
  replaceItems() { if (this.level) for (const it of this.level.items) this.moveItem(it); }
  // 기물 광원은 화면 중심에서 가까운 순서로 MAX_ITEM_LIGHTS 개까지만 켠다
  /** 화면을 옮기면 가까운 조명부터 다시 켠다 (예전엔 디머를 건드려야 바뀜) · 0.15초에 한 번 */
  _lightsFollow() { const now = performance.now(); if (now - (this._lfT || 0) < 150) { clearTimeout(this._lfH); this._lfH = setTimeout(() => this._lightsFollow(), 160); return; } this._lfT = now; const info = this.lightInfo; if (info && info.total > info.on) { this._limitLights(); this.invalidate(true); } }
  _limitLights() {
    const L = []; this.items.traverse((o) => { if (o.userData.itemLight) L.push(o); });
    const t = this.controls.target, p = new THREE.Vector3();
    L.sort((a, b) => a.getWorldPosition(p).distanceToSquared(t) - b.getWorldPosition(p).distanceToSquared(t));
    const pl = this.presentLights, on = pl || (this.opt.itemLights && STYLES[this.style].lights), N = pl ? Math.max(40, QUALITY[this.qual].lights) : QUALITY[this.qual].lights, boost = STYLES[this.style].lightBoost || 1;
    let mx = 0; if (pl) for (const g of this.items.children) if (this._isLightItem(g)) mx = Math.max(mx, Math.min(1, g.userData.dim ?? 0));
    const ownLight = (o) => { let p = o; while (p && !p.userData.itemId) p = p.parent; return p && this._isLightItem(p); };
    L.forEach((o, i) => { o.visible = on && i < N; o.intensity = (o.userData.bi ??= o.intensity) * boost * (pl ? (ownLight(o) ? (o.userData.dim ?? 1) * 3 : 0.5 * mx) : 1); }); /* 조명 모드: 조명 기물만 디머대로 · 튀김기 불빛 등은 전체 밝기에 맞춰 약하게 */ /* 스타일 밝기 · 프레젠테이션 디밍 */
    this.lightInfo = { total: L.length, on: on ? Math.min(L.length, N) : 0 };
  }

  /* ---------- 시점 ---------- */
  view(kind = 'iso') {
    const b = this.bounds || { cx: 4, cz: 3, r: 8 }, t = new THREE.Vector3(b.cx, 0.6, b.cz), asp = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight) || this.aspect || 1, d = b.r * 2.1 * (asp < 1 ? Math.min(2.2, 0.9 / asp) : 1); /* 세로 화면은 더 멀리 */
    const dir = kind === 'top' ? new THREE.Vector3(0.0001, 1, 0.0001) : kind === 'front' ? new THREE.Vector3(0, 0.35, 1) : new THREE.Vector3(0.62, 0.78, 0.85);
    this.controls.target.copy(t);
    if (this.camera.isOrthographicCamera) { this.camera.zoom = 1; this.orthoSize = b.r * 0.95; this._fitOrtho(); this.camera.position.copy(t).addScaledVector(dir.normalize(), Math.max(40, d * 2)); }
    else this.camera.position.copy(t).addScaledVector(dir.normalize(), kind === 'top' ? d * 1.15 : d);
    this.controls.update(); this._moveT = performance.now();
  }
  /** 화면 가운데가 가리키는 바닥 위치 (mm) — 새 기물을 놓을 자리 */
  centerOnFloor() { const t = this.controls.target; return { x: Math.round(t.x / MM / 10) * 10, y: Math.round(t.z / MM / 10) * 10 }; }

  /* ---------- 선택 · 끌어서 이동 ---------- */
  /** 벽 · 문/창 강조 (2D 에서 고른 것을 3D 에서도 보이게) */
  highlight(wallId) {
    this.hl = wallId || null; const g = wallId && this.structure && this.structure.getObjectsByProperty('name', '벽').find((o) => o.userData.wallId === wallId);
    if (g) { this.selBox.setFromObject(g); this.selBox.visible = true; } else if (!this.selId) this.selBox.visible = false;
  }
  select(id) {
    this.hl = null; this.selId = id || null; const g = id && this.itemGroup(id);
    if (g) { this.selBox.setFromObject(g); this.selBox.visible = true; } else this.selBox.visible = false;
    this.onSelect(this.selId);
  }
  /** 화면 좌표 → 바닥(높이 mm) 위 점 (mm) · 못 맞추면 null */
  floorAt(e, hMm = 0) { const p = new THREE.Vector3(); return this._ray(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -hMm * MM), p) ? { x: Math.round(p.x / MM / 10) * 10, y: Math.round(p.z / MM / 10) * 10 } : null; }
  _ray(e) {
    const r = this.canvas.getBoundingClientRect(), ray = (this._rc ||= new THREE.Raycaster());
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera); return ray;
  }
  pickLine(e) { const g = this.structure && this.structure.children.find((c) => c.userData.mep); if (!g || !g.visible) return null; const h = this._ray(e).intersectObject(g, true)[0]; return h ? h.object.userData.lineId : null; }
  pick(e) {
    for (const hit of this._ray(e).intersectObjects(this.items.children.filter((g) => g.visible), true)) { // 숨긴(공간만 보기) 기물은 건너뜀
      let o = hit.object; while (o && !o.userData.itemId) o = o.parent; if (o) return o.userData.itemId;
    }
    return null;
  }
  _bindPointer() {
    const cv = this.canvas; let down = null, drag = null; const active = new Set();
    // capture 단계에서 먼저 받아, 기물을 끌 때는 OrbitControls 로 넘기지 않는다
    cv.addEventListener('pointerdown', (e) => {
      active.add(e.pointerId); this._touches = active.size; if ((this.design && this.design.active) || this.walker.active) return;
      if (active.size > 1) { if (drag) { drag.cancel(); drag = null; } down = null; return; } // 두 손가락 = 화면 조작
      down = { x: e.clientX, y: e.clientY, id: e.pointerId };
      /* PC: 그냥 끌면 화면만 돌고 기물은 안 움직임 · Ctrl+Shift+끌기 = 옮기기 · Ctrl+끌기 = 길이 늘이기 · "이동" 모드에서는 그냥 끌어도 옮김 */
      const mod = e.ctrlKey || e.metaKey, stretch = mod && !e.shiftKey, moveKey = mod && e.shiftKey;
      if ((this.mode !== 'move' && !moveKey && !stretch) || e.button > 0) return;
      const id = this.pick(e), it = id && this.level.items.find((q) => q.id === id); if (!it) return;
      if (this.selId !== id) this.select(id);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.ctx.zOf ? this.ctx.zOf(it) : it.elev) * MM), p0 = new THREE.Vector3();
      if (!this._ray(e).ray.intersectPlane(plane, p0)) return;
      e.stopImmediatePropagation(); cv.setPointerCapture(e.pointerId);
      const ox = it.x, oy = it.y, ow = it.w, a = ((it.rot || 0) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), side = ((p0.x / MM - it.x) * ux + (p0.z / MM - it.y) * uy) >= 0 ? 1 : -1;
      drag = { it, moved: false, plane, p0, start: p0.clone(), stretch: stretch ? { ow, ox, oy, ux, uy, side } : null, cancel: () => { it.x = ox; it.y = oy; it.w = ow; this.rebuildItem(it); this.onMove(it); } };
    }, true);
    cv.addEventListener('pointermove', (e) => {
      if ((this.design && this.design.active) || this.walker.active) return;
      if (!drag || e.pointerId !== down?.id) return; e.stopImmediatePropagation();
      const p = new THREE.Vector3(); if (!this._ray(e).ray.intersectPlane(drag.plane, p)) return;
      const snap = (v) => Math.round(v / 10) * 10, it = drag.it;
      if (drag.stretch) { const S = drag.stretch, d = ((p.x - drag.start.x) * S.ux + (p.z - drag.start.z) * S.uy) / MM * S.side, w = Math.max(100, snap(S.ow + d)), dw = w - S.ow; /* 잡은 쪽 끝만 늘고 반대쪽 끝은 그대로 */
        it.w = w; it.x = Math.round(S.ox + S.ux * S.side * dw / 2); it.y = Math.round(S.oy + S.uy * S.side * dw / 2); drag.moved = true; this.rebuildItem(it); this.onMove(it); return; }
      it.x = snap(it.x + (p.x - drag.p0.x) / MM); it.y = snap(it.y + (p.z - drag.p0.z) / MM); drag.p0.copy(p); drag.moved = true;
      this.moveItem(it); this.onMove(it);
    }, true);
    const up = (e) => {
      active.delete(e.pointerId); this._touches = active.size; if ((this.design && this.design.active) || this.walker.active) { down = null; return; }
      if (drag) { e.stopImmediatePropagation(); const moved = drag.moved; drag = null; if (moved) { this.onChange(); return; } }
      if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7 && e.type === 'pointerup' && this.mode !== 'orbit') { const id = this.pick(e), ln = !id && this.pickLine(e), sb = !id && !ln && this.siteOn ? this.pickSite(e) : null; if (ln && this.onLine) { this.select(null); this.onLine(ln); } else if (sb != null && this.onSite) { this.select(null); this.onSite(sb); } else this.select(id); } // 톡 누르면 선택 (기물 없으면 배관 · 전선)
      down = null;
    };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
    /* (예전에는 손을 뗄 때마다 광원을 다시 골라 셰이더를 새로 만들어 버벅였다 → 층을 열 때만 고른다) */
  }
}

function disposeTree(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); } // 재질은 캐시해서 같이 쓰므로 지우지 않는다
