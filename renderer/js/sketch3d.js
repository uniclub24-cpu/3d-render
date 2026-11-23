// 3D 화면 위에 펜으로 선 긋기 (메모 · 설명용) — 기물 · 벽 · 바닥 표면에 붙어서 그려지고, 허공은 앞 점 깊이에 이어 그린다.
// 선은 장면(scene)에 따로 두어 도면 · 저장 · 블렌더 내보내기에는 들어가지 않는다.  Esc = 모두 지우기 · 지우개 = 문질러 지우기
import * as THREE from 'three';

const COLORS = ['#ff3b30', '#ffcc00', '#2f7df6', '#111111', '#ffffff'];
const SIZES = { s: 0.0011, m: 0.0022, l: 0.0045 }; // 카메라 거리 대비 굵기

export class Sketch3D {
  constructor(engine, { toast = () => {} } = {}) {
    this.e = engine; this.toast = toast; this.mode = null; this.color = COLORS[0]; this.size = 'm'; this.strokes = []; this.cur = null;
    this.group = new THREE.Group(); this.group.name = '3D 펜'; engine.scene.add(this.group);
    this._ui(); this._bind();
  }
  /* ---------- 화면 왼쪽 작은 도구 ---------- */
  _ui() {
    const bar = (this.bar = document.createElement('div')); bar.id = 'sk3'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '3D 펜');
    bar.innerHTML = `<button class="ib" data-sk="pen" title="3D 펜 · 기물 · 벽 위에 선 긋기 (Esc = 모두 지우기)" aria-label="3D 펜"><svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg></button>
      <div class="sk-more" hidden>
        <button class="ib" data-sk="erase" title="지우개 · 선을 문질러 지우기" aria-label="지우개"><svg viewBox="0 0 24 24"><path d="M8 20h12"/><path d="M4 15l9-9 6 6-7 7H8z"/><path d="M9 10l6 6"/></svg></button>
        <div class="sk-cols">${COLORS.map((c) => `<button data-skc="${c}" style="--c:${c}" title="색" aria-label="색 ${c}"></button>`).join('')}</div>
        <div class="sk-sz">${Object.keys(SIZES).map((k) => `<button data-sks="${k}" title="굵기" aria-label="굵기 ${k}"><i class="${k}"></i></button>`).join('')}</div>
        <button class="ib" data-sk="undo" title="방금 선 지우기 (Ctrl+Z)" aria-label="방금 선 지우기"><svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg></button>
        <button class="ib" data-sk="clear" title="모두 지우기 (Esc)" aria-label="모두 지우기"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>
      </div>`;
    document.body.appendChild(bar);
    bar.addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.sk === 'pen') this.setMode(this.mode === 'pen' ? null : 'pen');
      else if (b.dataset.sk === 'erase') this.setMode(this.mode === 'erase' ? 'pen' : 'erase');
      else if (b.dataset.sk === 'undo') this.undo();
      else if (b.dataset.sk === 'clear') this.clear();
      else if (b.dataset.skc) { this.color = b.dataset.skc; if (this.mode !== 'pen') this.setMode('pen'); this._sync(); }
      else if (b.dataset.sks) { this.size = b.dataset.sks; if (this.mode !== 'pen') this.setMode('pen'); this._sync(); }
    });
    const place = () => { const r = this.e.canvas.getBoundingClientRect(), vis = r.width > 40 && r.height > 120 && getComputedStyle(this.e.canvas).display !== 'none' && !document.body.classList.contains('walking');
      bar.hidden = !vis; if (!vis) { if (this.mode) this.setMode(null); return; } bar.style.left = Math.round(r.left + 10) + 'px'; bar.style.top = Math.round(r.top + Math.min(90, Math.max(70, r.height * 0.12))) + 'px'; };
    new ResizeObserver(place).observe(this.e.canvas); window.addEventListener('resize', place); setInterval(place, 600); place(); this._sync();
  }
  _sync() {
    const q = (s) => this.bar.querySelector(s);
    q('[data-sk=pen]').setAttribute('aria-pressed', String(this.mode === 'pen')); q('[data-sk=erase]').setAttribute('aria-pressed', String(this.mode === 'erase'));
    q('.sk-more').hidden = !this.mode && !this.strokes.length; this.bar.classList.toggle('on', !!this.mode);
    this.bar.querySelectorAll('[data-skc]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.skc === this.color)));
    this.bar.querySelectorAll('[data-sks]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sks === this.size)));
    const cv = this.e.canvas; cv.style.cursor = this.mode === 'pen' ? 'crosshair' : this.mode === 'erase' ? 'cell' : '';
  }
  setMode(m) { this.mode = m; this._end(); this._sync(); if (m === 'pen' && !this._told) { this._told = 1; this.toast('3D 펜: 끌어서 그리기 · 지우개로 문질러 지우기 · Esc = 모두 지우기 · 다시 누르면 끝', 4500); } }
  /* ---------- 입력: 3D 화면보다 먼저 받아 화면이 돌지 않게 ---------- */
  _bind() {
    const host = this.e.canvas.parentElement, cv = this.e.canvas, touches = new Set();
    const mine = (ev) => this.mode && ev.target === cv;
    host.addEventListener('pointerdown', (ev) => {
      if (!mine(ev)) return; if (ev.pointerType === 'touch') { touches.add(ev.pointerId); if (touches.size > 1) { this._cancel(); return; } }
      if (ev.button > 0) return; ev.preventDefault(); ev.stopImmediatePropagation(); try { cv.setPointerCapture(ev.pointerId); } catch {}
      this.pid = ev.pointerId; if (this.mode === 'pen') this._start(ev); else this._erase(ev);
    }, true);
    host.addEventListener('pointermove', (ev) => {
      if (!mine(ev) || ev.pointerId !== this.pid) return; ev.preventDefault(); ev.stopImmediatePropagation();
      if (this.mode === 'pen') this._add(ev); else this._erase(ev);
    }, true);
    const up = (ev) => { touches.delete(ev.pointerId); if (!mine(ev) || ev.pointerId !== this.pid) return; ev.stopImmediatePropagation(); this.pid = null; this._end(); this._sync(); };
    host.addEventListener('pointerup', up, true); host.addEventListener('pointercancel', up, true);
    window.addEventListener('keydown', (ev) => {
      if (!this.mode || /input|textarea|select/i.test(ev.target.tagName || '')) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); if (this.strokes.length) this.clear(); else this.setMode(null); }
      else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey && this.strokes.length) { ev.preventDefault(); ev.stopImmediatePropagation(); this.undo(); }
      else if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.key.toLowerCase() === 'e') { ev.preventDefault(); ev.stopImmediatePropagation(); this.setMode(this.mode === 'erase' ? 'pen' : 'erase'); }
    }, true);
  }
  /* ---------- 표면 찾기 (엔진의 _ray 는 부를 때마다 그림자를 다시 그리게 해서 따로) ---------- */
  _ray(ev) { const r = this.e.canvas.getBoundingClientRect(), rc = (this._rc ||= new THREE.Raycaster()); rc.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), this.e.camera); return rc; }
  _hit(ev) {
    const ray = this._ray(ev), roots = [this.e.world, this.e.envGroup].filter((o) => o && o.visible);
    for (const h of ray.intersectObjects(roots, true)) {
      const o = h.object; if (!o.isMesh || !h.face) continue; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; } if (!vis) continue;
      const m = Array.isArray(o.material) ? o.material[h.face.materialIndex || 0] : o.material; if (m && (m.opacity ?? 1) < 0.15) continue;
      const n = h.face.normal.clone().transformDirection(o.matrixWorld); if (n.dot(ray.ray.direction) > 0) n.negate(); return { p: h.point.clone(), n };
    }
    return null;
  }
  _point(ev) {
    const h = this._hit(ev), ray = this._ray(ev).ray, cam = this.e.camera;
    if (h) { const d = h.p.distanceTo(cam.position); return h.p.add(h.n.multiplyScalar(Math.max(0.004, d * 0.0025))); }
    /* 맞는 표면이 없으면: 앞 점과 같은 깊이(화면과 나란한 면)에 → 허공에 이어 그리기 */
    const ref = this.cur && this.cur.pts.length ? this.cur.pts[this.cur.pts.length - 1] : null, fw = new THREE.Vector3(); cam.getWorldDirection(fw);
    if (ref) { const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(fw, ref), p = new THREE.Vector3(); if (ray.intersectPlane(pl, p)) return p; }
    const p = new THREE.Vector3(); if (ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return p; return ray.at(5, new THREE.Vector3());
  }
  _start(ev) {
    const p = this._point(ev); if (!p) return; const r = Math.max(0.003, p.distanceTo(this.e.camera.position) * SIZES[this.size]);
    const mat = new THREE.MeshBasicMaterial({ color: this.color, toneMapped: false }), mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); mesh.position.copy(p); mesh.renderOrder = 5;
    this.group.add(mesh); this.cur = { pts: [p], r, mesh, mat }; this.e.invalidate(false);
  }
  _add(ev) {
    const c = this.cur; if (!c) return; const p = this._point(ev); if (!p) return; const last = c.pts[c.pts.length - 1]; if (p.distanceTo(last) < c.r * 1.2) return;
    c.pts.push(p); this._mesh(c); this.e.invalidate(false);
  }
  _mesh(c) {
    if (c.pts.length < 2) return; const curve = new THREE.CatmullRomCurve3(c.pts, false, 'centripetal'), seg = Math.min(1200, c.pts.length * 3);
    const g = new THREE.TubeGeometry(curve, seg, c.r, 6, false); if (c.mesh.geometry) c.mesh.geometry.dispose(); c.mesh.geometry = g; c.mesh.position.set(0, 0, 0);
    if (!c.caps) { c.caps = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(c.r, 10, 8), c.mat)); c.caps.forEach((m) => c.mesh.add(m)); }
    c.caps[0].position.copy(c.pts[0]); c.caps[1].position.copy(c.pts[c.pts.length - 1]);
    /* 벽 · 기물 뒤로 가려진 부분도 흐리게 보이게 (선이 끊겨 보이지 않도록) */
    if (!c.ghost) { c.gmat = new THREE.MeshBasicMaterial({ color: c.mat.color, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false, toneMapped: false }); c.ghost = new THREE.Mesh(g, c.gmat); c.ghost.renderOrder = 6; c.mesh.add(c.ghost); } else c.ghost.geometry = g;
  }
  _end() { if (this.cur) { this.strokes.push(this.cur); this.cur = null; } }
  _cancel() { if (!this.cur) return; this._drop(this.cur); this.cur = null; this.pid = null; }
  _drop(s) { this.group.remove(s.mesh); s.mesh.traverse((o) => o.geometry && o.geometry.dispose()); s.mat.dispose(); if (s.gmat) s.gmat.dispose(); this.e.invalidate(false); }
  /* ---------- 지우기 ---------- */
  _erase(ev) {
    const r = this.e.canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, v = new THREE.Vector3(), cam = this.e.camera, R = ev.pointerType === 'touch' ? 22 : 14;
    const near = (s) => s.pts.some((p) => { v.copy(p).project(cam); if (v.z > 1) return false; return Math.hypot((v.x + 1) / 2 * r.width - x, (1 - v.y) / 2 * r.height - y) < R; });
    const keep = []; let n = 0; for (const s of this.strokes) { if (near(s)) { this._drop(s); n++; } else keep.push(s); } this.strokes = keep; if (n) this._sync();
  }
  undo() { const s = this.strokes.pop(); if (s) this._drop(s); this._sync(); }
  clear() { this._cancel(); for (const s of this.strokes) this._drop(s); this.strokes = []; this._sync(); }
}
