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
import { buildItem, buildWalls, buildFloors, placeItem, levelBounds, MM , buildCeiling } from './builder.js';
import { Walker } from './walk.js';
import { buildDims } from './dims.js';
import { buildLines, itemCat } from './lines.js';
import { AirSim } from './air.js';
import { KitchenSim } from './sim.js';
import { setEnvMap } from './materials.js';
import { STYLES, StylePass, applyStyleMaterials, restoreMaterials } from './styles3d.js';
import { DesignEditor } from './design.js';
import { buildEnv } from './env.js';
import { pointInPoly, syncDrain } from './slope.js';

const MAX_ITEM_LIGHTS = 24; // 실시간 광원이 너무 많으면 태블릿에서 느려져서 가까운 것부터 켠다

export class Engine {
  constructor(canvas, ctx) {
    this.canvas = canvas; this.ctx = ctx; // ctx = { lib, shapes, assets }
    this.level = null; this.selId = null; this.mode = 'select'; this.style = 'real';
    this.onSelect = () => {}; this.onChange = () => {}; this.onMove = () => {};
    this.opt = { ssao: true, ssaoRadius: 0.45, fxaa: true, shadows: true, sunHour: 14, sunPower: 2.0, exposure: 0.85, itemLights: true };

    /* ----- 렌더러 ----- */
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = this.opt.exposure;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;

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
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    /* ----- 기본 조명: AmbientLight + DirectionalLight(그림자) ----- */
    this.ambient = new THREE.AmbientLight('#ffffff', 0.22); scene.add(this.ambient);
    const sun = (this.sun = new THREE.DirectionalLight('#fff4e3', this.opt.sunPower));
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025; sun.shadow.radius = 3;
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
    r.setAnimationLoop(() => this._frame());
  }

  /* ---------- 크기 · 그리기 ---------- */
  resize() {
    const el = this.canvas; if (!el.clientWidth) return; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight), pr = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h); this.ssaoPass.setSize(w * pr, h * pr); this.stylePass.setSize(w * pr, h * pr);
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
    if (this.walker.active) this.walker.update(dt); else this.controls.update();
    if (this.selBox.visible) this.selBox.update();
    this.ssaoPass.enabled = this.opt.ssao && STYLES[this.style].ssao && !this.camera.isOrthographicCamera; this.fxaaPass.enabled = this.opt.fxaa;
    this.selBox.visible && (this.selBox.visible = !!(this.selId || this.hl));
    // 선택 표시 · 바닥 평면은 SSAO 법선 계산에서 빼지 않아도 되지만, 선택 상자는 선이라 영향이 없다
    this.composer.render();
  }
  /** 화면을 PNG dataURL 로 */
  snapshot() { this.composer.render(); return this.canvas.toDataURL('image/png'); }

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
    this.structure.add(buildFloors(level), buildWalls(level), buildCeiling(level), buildDims(level), buildLines(level));
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
    if (old) { this.items.remove(old); disposeTree(old); } this.items.add(g); applyStyleMaterials(g, this.style); if (this.focusPts) this.applyFocus(); if (this.xray) this._applyXray();
    if (this.selId === it.id) this.selBox.setFromObject(g);
    this._limitLights(); return g;
  }
  /** 벽 · 문/창 · 바닥만 다시 만든다 (2D 도면에서 벽을 그리거나 끌 때 바로 3D 에 반영) */
  rebuildStructure() {
    if (!this.level) return; const old = this.structure; for (const r of this.level.rooms || []) syncDrain(this.level, r);
    this.structure = new THREE.Group(); this.structure.name = '구조'; this.structure.add(buildFloors(this.level), buildWalls(this.level), buildCeiling(this.level), buildDims(this.level), buildLines(this.level));
    applyStyleMaterials(this.structure, this.style);
    if (old) { this.world.remove(old); disposeTree(old); } this.world.add(this.structure);
    const b = levelBounds(this.level); this.bounds = { cx: ((b[0] + b[2]) / 2) * MM, cz: ((b[1] + b[3]) / 2) * MM, r: Math.max(3, (Math.hypot(b[2] - b[0], b[3] - b[1]) / 2) * MM) };
    this.renderer.shadowMap.needsUpdate = true; if (this.hl) this.highlight(this.hl); this.replaceItems(); this.applyFocus(); this._applyXray(); if (this.air.on) this.air.refresh();
  }
  /** 설치물 투시: cat = 'floor' | 'wall' | 'ceil' | null. 그 분류의 배관 · 전선 · 설비만 진하게, 나머지는 흑백 반투명 */
  setXray(cat) { this.xray = cat || null; applyStyleMaterials(this.world, this.style); if (this.envGroup) this.envGroup.visible = !this.xray && !this.focusPts; this._applyXray(); }
  _applyXray() {
    const cat = this.xray; if (!cat) return; const gray = (this._xrMat ||= new THREE.MeshStandardMaterial({ color: '#c9ccd1', transparent: true, opacity: 0.16, depthWrite: false, roughness: 1 }));
    const keep = (o) => { for (let p = o; p; p = p.parent) { if (p.userData.xr) return p.userData.xr === cat; if (p.userData.itemId) { const it = this.level.items.find((q) => q.id === p.userData.itemId); return it ? itemCat(this.ctx.lib[it.type]) === cat : false; } } return false; };
    this.world.traverse((o) => { if (!o.isMesh) return; o.userData.baseMat ||= o.material; if (!keep(o)) o.material = gray; });
    if (this.structure) for (const g of this.structure.getObjectsByProperty('name', '천장')) g.visible = cat === 'ceil' || g.visible;
  }
  /** 천장 보이기 · 끄기 (모델의 level.ceiling.on 과 함께) */
  showCeiling(on) { if (this.structure) for (const g of this.structure.getObjectsByProperty('name', '천장')) g.visible = on; }
  /** 배경(상권) 다시 세우기. E = model.env */
  setEnv(E, meta = {}) {
    if (this.envGroup) { this.scene.remove(this.envGroup); disposeTree(this.envGroup); this.envGroup = null; }
    this.envE = E; this.envMeta = meta; if (!E || !this.level) return;
    this.envGroup = buildEnv(this.level, E, meta); applyStyleMaterials(this.envGroup, this.style); this.scene.add(this.envGroup);
    this.ground.visible = E.type === 'none' || E.type === 'basic'; this.controls.maxDistance = E.type === 'none' || E.type === 'basic' ? 70 : 260;
  }
  /** 공간만 보기: 그 다각형 안의 기물과 닿는 벽만 남긴다 (pts = null 이면 전체) */
  setFocus(pts) { this.focusPts = pts && pts.length >= 3 ? pts : null; this.applyFocus(); }
  applyFocus() {
    const F = this.focusPts, near = (x, y) => !F || pointInPoly(x, y, F) || F.some((p, i) => { const q = F[(i + 1) % F.length], dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / L)); return Math.hypot(p[0] + dx * t - x, p[1] + dy * t - y) < 400; });
    if (!this.level) return;
    for (const g of this.items.children) { const it = this.level.items.find((q) => q.id === g.userData.itemId); g.visible = !it || near(it.x, it.y); }
    if (this.structure) for (const g of this.structure.getObjectsByProperty('name', '벽')) { const w = g.userData.wallId && this.level.walls.find((q) => q.id === g.userData.wallId); if (w) g.visible = near((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2) || (near(w.x1, w.y1) && near(w.x2, w.y2)); }
    if (this.envGroup) this.envGroup.visible = !F;
  }
  /** 다각형(mm)이 화면에 꽉 차게 */
  frame(pts) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), cx = ((Math.min(...xs) + Math.max(...xs)) / 2) * MM, cz = ((Math.min(...ys) + Math.max(...ys)) / 2) * MM, r = Math.max(2, (Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2) * MM);
    const t = new THREE.Vector3(cx, 0.6, cz), dir = this.camera.position.clone().sub(this.controls.target).normalize(); this.controls.target.copy(t);
    if (this.camera.isOrthographicCamera) { this.camera.zoom = 1; this.orthoSize = r * 0.95; this._fitOrtho(); this.camera.position.copy(t).addScaledVector(dir, 40); } else this.camera.position.copy(t).addScaledVector(dir, r * 2.2);
    this.controls.update(); this._limitLights();
  }
  /** 보기 스타일 바꾸기 — 모델은 그대로라서 어떤 스타일에서도 계속 편집할 수 있다 */
  setStyle(name) {
    const st = STYLES[name]; if (!st) return; this.style = name;
    applyStyleMaterials(this.world, name); if (this.envGroup) applyStyleMaterials(this.envGroup, name); this._applyXray();
    this.scene.background = new THREE.Color(st.bg); this.ground.material.color.set(st.ground);
    this.ambient.intensity = st.ambient; this.sun.intensity = this.opt.sunPower * st.sun;
    this.renderer.toneMapping = name === 'real' || name === 'clay' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping; this.renderer.toneMappingExposure = this.opt.exposure * (st.exposure || 1);
    this.scene.environmentIntensity = name === 'real' ? 0.38 : name === 'clay' ? 0.35 : 0.25;
    this.ssaoPass.kernelRadius = st.ssaoRadius || this.opt.ssaoRadius;
    this.stylePass.setStyle(st);
    this._useCamera(st.ortho ? this.ortho : this.persp);
    this._limitLights();
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
  _limitLights() {
    const L = []; this.items.traverse((o) => { if (o.userData.itemLight) L.push(o); });
    const t = this.controls.target, p = new THREE.Vector3();
    L.sort((a, b) => a.getWorldPosition(p).distanceToSquared(t) - b.getWorldPosition(p).distanceToSquared(t));
    const on = this.opt.itemLights && STYLES[this.style].lights; L.forEach((o, i) => (o.visible = on && i < MAX_ITEM_LIGHTS));
    this.lightInfo = { total: L.length, on: on ? Math.min(L.length, MAX_ITEM_LIGHTS) : 0 };
  }

  /* ---------- 시점 ---------- */
  view(kind = 'iso') {
    const b = this.bounds || { cx: 4, cz: 3, r: 8 }, t = new THREE.Vector3(b.cx, 0.6, b.cz), asp = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight) || this.aspect || 1, d = b.r * 2.1 * (asp < 1 ? Math.min(2.2, 0.9 / asp) : 1); /* 세로 화면은 더 멀리 */
    const dir = kind === 'top' ? new THREE.Vector3(0.0001, 1, 0.0001) : kind === 'front' ? new THREE.Vector3(0, 0.35, 1) : new THREE.Vector3(0.62, 0.78, 0.85);
    this.controls.target.copy(t);
    if (this.camera.isOrthographicCamera) { this.camera.zoom = 1; this.orthoSize = b.r * 0.95; this._fitOrtho(); this.camera.position.copy(t).addScaledVector(dir.normalize(), Math.max(40, d * 2)); }
    else this.camera.position.copy(t).addScaledVector(dir.normalize(), kind === 'top' ? d * 1.15 : d);
    this.controls.update(); this._limitLights();
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
  _ray(e) {
    const r = this.canvas.getBoundingClientRect(), ray = (this._rc ||= new THREE.Raycaster());
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera); return ray;
  }
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
      if (this.mode !== 'move' || e.button > 0) return;
      const id = this.pick(e), it = id && this.level.items.find((q) => q.id === id); if (!it) return;
      if (this.selId !== id) this.select(id);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.ctx.zOf ? this.ctx.zOf(it) : it.elev) * MM), p0 = new THREE.Vector3();
      if (!this._ray(e).ray.intersectPlane(plane, p0)) return;
      e.stopImmediatePropagation(); cv.setPointerCapture(e.pointerId);
      const ox = it.x, oy = it.y;
      drag = { it, moved: false, plane, p0, cancel: () => { it.x = ox; it.y = oy; this.moveItem(it); this.onMove(it); } };
    }, true);
    cv.addEventListener('pointermove', (e) => {
      if ((this.design && this.design.active) || this.walker.active) return;
      if (!drag || e.pointerId !== down?.id) return; e.stopImmediatePropagation();
      const p = new THREE.Vector3(); if (!this._ray(e).ray.intersectPlane(drag.plane, p)) return;
      const snap = (v) => Math.round(v / 10) * 10, it = drag.it;
      it.x = snap(it.x + (p.x - drag.p0.x) / MM); it.y = snap(it.y + (p.z - drag.p0.z) / MM); drag.p0.copy(p); drag.moved = true;
      this.moveItem(it); this.onMove(it);
    }, true);
    const up = (e) => {
      active.delete(e.pointerId); this._touches = active.size; if ((this.design && this.design.active) || this.walker.active) { down = null; return; }
      if (drag) { e.stopImmediatePropagation(); const moved = drag.moved; drag = null; if (moved) { this.onChange(); return; } }
      if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7 && e.type === 'pointerup' && this.mode !== 'orbit') this.select(this.pick(e)); // 톡 누르면 선택
      down = null;
    };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
    this.controls.addEventListener('end', () => this._limitLights());
  }
}

function disposeTree(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); }); } // 재질은 캐시해서 같이 쓰므로 지우지 않는다
