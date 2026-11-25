// 단면 투시 보기 (보기 → 단면 투시) — 벽과 나란히 잘라 그 벽을 정면으로 보는 1점 투시.
// 소실점(눈 위치)은 그대로 두고 화면 틀(창)만 확대 · 이동 → 휠 = 확대 · 끌기 / WASD · 방향키 = 이동 · 더블클릭 or 🎯 = 소실점 찍기
// 배경(프리셋 · 상권) · 땅은 끄고 내 작업물만. 잘린 면은 검게(포셰). 시간 = 아침 → 정오 → 석양 → 밤(조명 켜짐)
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const SKY = [[5.5, '#efe2d2'], [8, '#eaeef2'], [15.5, '#e9eef3'], [17, '#f1cfa6'], [18.2, '#dc8e62'], [18.9, '#3a3550'], [19.6, '#161b2c'], [22, '#0e1220']];
const lerpSky = (h) => { let a = SKY[0], b = SKY[SKY.length - 1]; for (let i = 0; i < SKY.length - 1; i++) if (h >= SKY[i][0] && h <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; } if (h <= SKY[0][0]) return new THREE.Color(SKY[0][1]); if (h >= b[0]) return new THREE.Color(b[1]); return new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), (h - a[0]) / (b[0] - a[0])); };
const NIGHT = 18.8;
export const hourName = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 10) * 10; const t = `${hh}:${String(mm % 60).padStart(2, '0')}`; return (h < 9 ? '아침 ' : h < 16 ? '낮 ' : h < NIGHT ? '석양 ' : '밤 ') + t; };

export class SectionView {
  constructor(engine, { toast = () => {}, level = () => null, selWall = () => null, onChange = () => {} } = {}) {
    this.e = engine; this.toast = toast; this.level = level; this.selWall = selWall; this.onChange = onChange; this.on = false; this.hour = 12; this.depth = 0.8; this.pickVP = false;
    engine.secView = this; this._bind();
  }
  /* ---------- 켜기 · 끄기 ---------- */
  toggle() { this.on ? this.exit() : this.enter(); }
  enter() {
    const E = this.e; if (this.on) return; if (!E.canvas.clientWidth) { this.toast('3D 화면에서 쓸 수 있어요'); return false; }
    this.save = { view: E.getView(), style: E.style, env: E.envGroup ? E.envGroup.visible : null, ground: E.ground.visible, bg: E.scene.background, present: E.present, exp: null, fov: E.persp.fov, sec: E.section, hour: E.opt.sunHour, ctl: E.controls.enabled };
    if (E.camera.isOrthographicCamera) E.setStyle('real');
    this.save.exp = E.renderer.toneMappingExposure; this.save.sun = E.sun.intensity; this.save.amb = E.ambient.intensity;
    this.on = true; E.controls.enabled = false; E.controls.autoRotate = false; this._poche(true);
    const w = this.selWall(); this.setWall(w); this._ui(true); this.setHour(this.hour); this.fit(); document.body.classList.add('secview');
    if (!this._told) { this._told = 1; this.toast('단면 투시: 휠 = 확대 · 끌기 / WASD = 이동 · 더블클릭 = 소실점 찍기 · Esc = 나가기', 5000); }
    this.onChange(true); return true;
  }
  exit() {
    const E = this.e, s = this.save; if (!this.on) return; this.on = false; this.playing = false; this.pickVP = false; this._poche(false); this._ui(false); document.body.classList.remove('secview');
    E.renderer.clippingPlanes = []; E.setSection(s.sec); E.setPresent(s.present || null); if (E.style !== s.style) E.setStyle(s.style);
    E.renderer.toneMappingExposure = s.exp; E.sun.intensity = s.sun; E.ambient.intensity = s.amb; if (E.envGroup && s.env != null) E.envGroup.visible = s.env; E.ground.visible = s.ground; E.scene.background = s.bg; E.setSun(s.hour);
    const c = E.persp; c.fov = s.fov; c.clearViewOffset(); c.updateProjectionMatrix(); E.controls.enabled = s.ctl !== false; E._applyShift(); E.flyTo(s.view, 1); E.invalidate(true); this.onChange(false);
  }
  /* ---------- 벽 기준 방향 ---------- */
  setWall(w) {
    const box = this._box(); this.box = box; const c = box.getCenter(new THREE.Vector3());
    let N;
    if (w) { const d = new THREE.Vector3(w.x2 - w.x1, 0, w.y2 - w.y1).normalize(); N = new THREE.Vector3(-d.z, 0, d.x); const mid = new THREE.Vector3((w.x1 + w.x2) / 2000, 0, (w.y1 + w.y2) / 2000); if (N.dot(c.clone().sub(mid).setY(0)) < 0) N.negate(); }
    else { const L = this.level(), ws = (L && L.walls) || []; const lw = ws.slice().sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))[0]; if (lw) return this.setWall(lw); N = new THREE.Vector3(0, 0, 1); }
    this.N = N; this.cut = N.dot(c); this.vpU = null; this._frame(); this.fit();
  }
  rotate(k = 1) { this.N.applyAxisAngle(UP, (k * Math.PI) / 2); this.N.set(Math.round(this.N.x * 1e6) / 1e6, 0, Math.round(this.N.z * 1e6) / 1e6).normalize(); this.cut = this.N.dot(this.box.getCenter(new THREE.Vector3())); this.vpU = null; this._frame(); this.fit(); }
  flip() { this.N.negate(); this.cut = -this.cut; this.vpU = this.vpU == null ? null : -this.vpU; this._frame(); this.fit(); }
  /** 잘린 범위(N 방향) · 화면 좌표계(R · 위) */
  _frame() {
    this.R = new THREE.Vector3().crossVectors(this.N.clone().negate(), UP).normalize(); const b = this.box; let n0 = 1e9, n1 = -1e9, u0 = 1e9, u1 = -1e9;
    for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) { const p = new THREE.Vector3(x, 0, z); n0 = Math.min(n0, this.N.dot(p)); n1 = Math.max(n1, this.N.dot(p)); u0 = Math.min(u0, this.R.dot(p)); u1 = Math.max(u1, this.R.dot(p)); }
    this.nr = [n0, n1]; this.ur = [u0, u1]; this.vr = [Math.min(0, b.min.y), b.max.y]; this.cut = Math.min(n1 - 0.05, Math.max(n0 + 0.05, this.cut));
    if (this.vpU == null) { this.vpU = (u0 + u1) / 2; this.vpV = 1.5; }
  }
  setCut(v) { this.cut = v; this.apply(); }
  setDepth(k) { this.depth = k; this.apply(); }
  /** 맞춤: 단면 전체가 여백 없이 */
  fit() {
    const cv = this.e.canvas, A = (cv.clientWidth || 16) / (cv.clientHeight || 9), W = this.ur[1] - this.ur[0], H = this.vr[1] - this.vr[0];
    this.wu = (this.ur[0] + this.ur[1]) / 2; this.wv = (this.vr[0] + this.vr[1]) / 2; this.hh = Math.max(H * 0.56, (W * 0.53) / A); this.apply();
  }
  /* ---------- 카메라: 소실점 고정 · 창만 확대 · 이동 ---------- */
  apply(Wpx, Hpx) {
    if (!this.on) return; const E = this.e, cv = E.canvas, cam = E.persp, w = Wpx || cv.clientWidth, h = Hpx || cv.clientHeight; if (!w || !h) return;
    E.renderer.clippingPlanes = [new THREE.Plane(this.N.clone().negate(), this.cut)];
    const D = Math.max(1.5, (this.ur[1] - this.ur[0]) * this.depth), eye = this.R.clone().multiplyScalar(this.vpU).addScaledVector(this.N, this.cut).setY(this.vpV);
    cam.position.copy(eye).addScaledVector(this.N, D); cam.up.set(0, 1, 0); cam.lookAt(eye); E.controls.target.copy(eye);
    const A = w / h, hh = this.hh, fH = Math.min(D * 11, Math.max(Math.abs(this.wv - this.vpV) + hh, (Math.abs(this.wu - this.vpU) + hh * A) / A)); /* fov ≤ 170° */
    cam.fov = (2 * Math.atan(fH / D) * 180) / Math.PI; cam.aspect = A; const s = fH / hh, FW = w * s, FH = h * s;
    cam.setViewOffset(FW, FH, FW / 2 + ((this.wu - this.vpU) / fH) * (FH / 2) - w / 2, FH / 2 - ((this.wv - this.vpV) / fH) * (FH / 2) - h / 2, w, h); cam.updateProjectionMatrix();
    this.D = D; this.eye = eye; this._mark(); E.invalidate(false);
  }
  /** 화면 좌표(px) ↔ 잘린 면 위 좌표(u, v) */
  _toPlane(x, y) { const cv = this.e.canvas, w = cv.clientWidth, h = cv.clientHeight, A = w / h; return [this.wu + (x / w - 0.5) * 2 * this.hh * A, this.wv - (y / h - 0.5) * 2 * this.hh]; }
  _toScreen(u, v) { const cv = this.e.canvas, w = cv.clientWidth, h = cv.clientHeight, A = w / h; return [((u - this.wu) / (2 * this.hh * A) + 0.5) * w, (0.5 - (v - this.wv) / (2 * this.hh)) * h]; }
  zoomAt(x, y, k) { const [pu, pv] = this._toPlane(x, y), H = Math.max(0.25, Math.min(60, this.hh * k)), r = H / this.hh; this.wu = pu - (pu - this.wu) * r; this.wv = pv - (pv - this.wv) * r; this.hh = H; this.apply(); }
  panPx(dx, dy) { const h = this.e.canvas.clientHeight || 1; this.wu -= (dx / h) * 2 * this.hh; this.wv += (dy / h) * 2 * this.hh; this.apply(); }
  setVP(x, y) { const [u, v] = this._toPlane(x, y); this.vpU = u; this.vpV = Math.max(this.vr[0] + 0.05, v); this.pickVP = false; this._sync(); this.apply(); }
  /** 엔진 틀마다: WASD · 재생 · 모델이 바뀌면 포셰 다시 */
  tick(dt, keys) {
    if (keys && keys.size) { const k = (q) => keys.has(q), ax = (k('d') || k('arrowright') ? 1 : 0) - (k('a') || k('arrowleft') ? 1 : 0), ay = (k('w') || k('arrowup') ? 1 : 0) - (k('s') || k('arrowdown') ? 1 : 0); if (ax || ay) { const sp = this.hh * 1.3 * dt; this.wu += ax * sp; this.wv += ay * sp; this.apply(); this.e._moveT = performance.now(); } }
    if (this.playing) { let h = this.hour + dt * 1.25; if (h >= 21.5) { h = 21.5; this.playing = false; this._sync(); } this.setHour(h); }
    if (this.e.structure !== this._st) { this._poche(false); this._poche(true); this.box = this._box(); this._frame(); this.apply(); }
  }
  /* ---------- 하루: 아침 → 정오 → 석양 → 밤(조명) ---------- */
  setHour(h) {
    const E = this.e; this.hour = h; const night = h >= NIGHT;
    if (night !== (E.present === 'light')) { E.setPresent(night ? 'light' : null, { dim: 1 }); }
    if (E.envGroup) E.envGroup.visible = false; E.ground.visible = false;
    E.setSun(Math.min(18.6, Math.max(5.6, h))); E.scene.background = lerpSky(h);
    const alt = Math.max(0, Math.sin(((Math.min(18.6, Math.max(6, h)) - 6) / 12) * Math.PI)), day = Math.min(1, 0.25 + alt * 1.5);
    if (!night) { E.sun.intensity = this.save.sun * day; E.ambient.intensity = this.save.amb * (0.55 + 0.45 * day); E.renderer.toneMappingExposure = this.save.exp * (0.85 + 0.15 * day); }
    else E.renderer.toneMappingExposure = this.save.exp * 0.62; /* 밤: 조명 근처가 하얗게 날아가지 않게 */
    E.renderer.shadowMap.needsUpdate = true; E.invalidate(true); const t = this.bar && this.bar.querySelector('#svHourV'); if (t) t.textContent = hourName(h); const r = this.bar && this.bar.querySelector('#svHour'); if (r && document.activeElement !== r) r.value = h;
  }
  /* ---------- 포셰: 잘린 단면 속을 검게 (뒷면만 그리는 검은 껍질) ---------- */
  _poche(on) {
    const E = this.e; if (this._pk) { for (const k of this._pk) k.parent && k.parent.remove(k); this._pk = null; }
    if (!on) return; this._ink ||= new THREE.MeshBasicMaterial({ color: '#16181c', side: THREE.BackSide }); const list = []; this._pk = [];
    E.world.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.userData.poche && o.material && !(o.material.transparent && (o.material.opacity ?? 1) < 0.6)) list.push(o); });
    for (const o of list) { const k = new THREE.Mesh(o.geometry, this._ink); k.raycast = () => {}; k.userData.poche = 1; o.add(k); this._pk.push(k); }
    this._st = E.structure;
  }
  _box() { const b = new THREE.Box3(); this.e.world.traverse((o) => { if (o.isMesh && !o.userData.poche) { let v = true; for (let p = o; p; p = p.parent) if (!p.visible) { v = false; break; } if (!v) return; const bb = new THREE.Box3().setFromObject(o); if (!bb.isEmpty() && isFinite(bb.min.x)) b.union(bb); } }); if (b.isEmpty()) b.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(8, 2.7, 6)); return b; }
  /* ---------- 화면 위 도구 ---------- */
  _ui(on) {
    if (!on) { this.bar && this.bar.remove(); this.mk && this.mk.remove(); this.bar = this.mk = null; return; }
    const bar = (this.bar = document.createElement('div')); bar.id = 'svBar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '단면 투시');
    bar.innerHTML = `<b class="sv-t">단면 투시</b>
      <div class="sv-g"><button class="qb" data-sv="wall" title="선택한 벽 기준으로 다시 (벽을 먼저 고르세요)">선택한 벽</button><button class="qb" data-sv="rot" title="90° 돌려 다른 벽 기준">⟳ 90°</button><button class="qb" data-sv="flip" title="반대편에서 보기">⇄ 반대편</button></div>
      <label class="sv-r">자르기<input type="range" id="svCut" step="0.05" aria-label="자르는 위치"></label>
      <label class="sv-r">깊이감<input type="range" id="svDepth" min="0.35" max="2" step="0.05" value="${this.depth}" aria-label="깊이감"></label>
      <label class="sv-r"><span id="svHourV">${hourName(this.hour)}</span><input type="range" id="svHour" min="5.5" max="21.5" step="0.1" value="${this.hour}" aria-label="시간"></label>
      <div class="sv-g"><button class="qb" data-sv="play" title="아침부터 밤까지 재생">▶ 하루</button><button class="qb" data-sv="vp" title="소실점 찍기 (더블클릭도 돼요)">🎯 소실점</button><button class="qb" data-sv="fit" title="여백 없이 맞춤">⤢ 맞춤</button><button class="qb" data-sv="x" title="나가기 (Esc)">✕</button></div>`;
    document.body.appendChild(bar); const mk = (this.mk = document.createElement('div')); mk.id = 'svVP'; mk.setAttribute('aria-hidden', 'true'); document.body.appendChild(mk);
    bar.addEventListener('click', (ev) => { const b = ev.target.closest('[data-sv]'); if (!b) return; const a = b.dataset.sv;
      if (a === 'wall') { const w = this.selWall(); if (!w) this.toast('2D 나 3D 에서 벽을 먼저 고르세요 · 지금은 가장 긴 벽 기준'); this.setWall(w); }
      else if (a === 'rot') this.rotate(1); else if (a === 'flip') this.flip(); else if (a === 'fit') this.fit(); else if (a === 'x') this.exit();
      else if (a === 'vp') { this.pickVP = !this.pickVP; if (this.pickVP) this.toast('화면에서 소실점(눈 높이 · 위치)을 누르세요', 2500); }
      else if (a === 'play') { this.playing = !this.playing; if (this.playing && this.hour >= 21.4) this.hour = 5.5; }
      this._sync(); });
    bar.querySelector('#svCut').oninput = (e) => this.setCut(+e.target.value); bar.querySelector('#svDepth').oninput = (e) => this.setDepth(+e.target.value);
    bar.querySelector('#svHour').oninput = (e) => { this.playing = false; this.setHour(+e.target.value); this._sync(); };
    this._sync();
  }
  _sync() {
    const b = this.bar; if (!b) return; const c = b.querySelector('#svCut'); if (this.nr) { c.min = this.nr[0] + 0.05; c.max = this.nr[1] - 0.05; c.value = this.cut; }
    b.querySelector('[data-sv=play]').textContent = this.playing ? '■ 멈춤' : '▶ 하루'; b.querySelector('[data-sv=play]').setAttribute('aria-pressed', String(!!this.playing)); b.querySelector('[data-sv=vp]').setAttribute('aria-pressed', String(this.pickVP));
    this.e.canvas.style.cursor = this.pickVP ? 'crosshair' : this.on ? 'grab' : '';
    const r = this.e.canvas.getBoundingClientRect(); b.style.left = Math.round(r.left + r.width / 2) + 'px'; const tb = document.querySelector('#topbar'), tbB = tb && tb.offsetParent ? tb.getBoundingClientRect().bottom : 0; b.style.top = Math.round(Math.max(r.top, tbB) + 8) + 'px'; b.style.maxWidth = Math.round(r.width - 20) + 'px';
  }
  _mark() { if (!this.mk) return; const r = this.e.canvas.getBoundingClientRect(), [x, y] = this._toScreen(this.vpU, this.vpV), vis = x > 0 && y > 0 && x < r.width && y < r.height; this.mk.hidden = !vis; this.mk.style.left = r.left + x + 'px'; this.mk.style.top = r.top + y + 'px'; this._sync(); }
  /* ---------- 입력 (펜이 켜져 있으면 펜이 먼저 받는다) ---------- */
  _bind() {
    const cv = this.e.canvas, host = cv.parentElement, P = new Map(); let drag = null, pinch = null;
    host.addEventListener('pointerdown', (ev) => { if (!this.on || ev.target !== cv) return; ev.preventDefault(); ev.stopImmediatePropagation(); try { cv.setPointerCapture(ev.pointerId); } catch {}
      P.set(ev.pointerId, [ev.clientX, ev.clientY]); const r = cv.getBoundingClientRect();
      if (this.pickVP && P.size === 1) { this.setVP(ev.clientX - r.left, ev.clientY - r.top); return; }
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), hh: this.hh }; drag = null; } else { drag = { x: ev.clientX, y: ev.clientY }; cv.style.cursor = 'grabbing'; } }, true);
    host.addEventListener('pointermove', (ev) => { if (!this.on || !P.has(ev.pointerId)) return; ev.preventDefault(); ev.stopImmediatePropagation(); P.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pinch && P.size >= 2) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), r = cv.getBoundingClientRect(); this.zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, (pinch.hh * pinch.d) / Math.max(10, d) / this.hh); }
      else if (drag) { this.panPx(ev.clientX - drag.x, ev.clientY - drag.y); drag.x = ev.clientX; drag.y = ev.clientY; this.e._moveT = performance.now(); } }, true);
    const up = (ev) => { if (!P.has(ev.pointerId)) return; P.delete(ev.pointerId); if (P.size < 2) pinch = null; if (!P.size) drag = null; if (this.on) { ev.stopImmediatePropagation(); this._sync(); } };
    host.addEventListener('pointerup', up, true); host.addEventListener('pointercancel', up, true);
    host.addEventListener('dblclick', (ev) => { if (!this.on || ev.target !== cv) return; ev.preventDefault(); ev.stopImmediatePropagation(); const r = cv.getBoundingClientRect(); this.setVP(ev.clientX - r.left, ev.clientY - r.top); }, true);
    host.addEventListener('wheel', (ev) => { if (!this.on || ev.target !== cv) return; ev.preventDefault(); ev.stopImmediatePropagation(); const r = cv.getBoundingClientRect(); this.zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015))); }, { capture: true, passive: false });
    window.addEventListener('keydown', (ev) => { if (!this.on || ev.key !== 'Escape' || /input|textarea|select/i.test(ev.target.tagName || '') && ev.target.type !== 'range') return; ev.preventDefault(); ev.stopImmediatePropagation(); if (this.pickVP) { this.pickVP = false; this._sync(); } else this.exit(); }, true);
    window.addEventListener('resize', () => this.on && this.apply());
  }
}
