// 기물 디자인 수정 (기존 앱 v20 "디자인 수정"): 부품의 점 · 면을 잡고 끌어 모양을 바꾸고, 부품마다 색 · 재질을 따로 고른다.
//   점 모드: 선택한 부품의 꼭짓점(동그라미)을 끌기 — 자유(화면과 나란히) 또는 가로 X · 높이 Y · 깊이 Z 축으로만
//   면 모드: 부품의 면을 눌러 그 면이 바라보는 방향으로 밀고 당기기 (늘이기 · 줄이기 · 턱 만들기)
//   "붙은 점 같이": 다른 부품과 같은 자리에 있던 점도 함께 움직여 틈이 생기지 않게
import * as THREE from 'three';
import { partsToMeshes, MM } from './builder.js';
import { MAT_TEX } from './materials.js';

const SNAP = 5; // mm
const clone = (o) => JSON.parse(JSON.stringify(o));

/** 부품 → 꼭짓점 목록(mm, 참조) + 면(꼭짓점 번호 목록) */
function topo(part) {
  const P = [], faces = [];
  if (part.v) { const n = part.n; for (let i = 0; i < part.v.length; i += 3) P.push([part.v[i], part.v[i + 1], part.v[i + 2]]); for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]); faces.push([...Array(n).keys()].map((i) => n + i), [...Array(n).keys()]); }
  else for (const f of part.f) { const idx = []; for (let i = 0; i < f.length; i += 3) { idx.push(P.length); P.push([f[i], f[i + 1], f[i + 2]]); } faces.push(idx); }
  return { P, faces };
}
function writeBack(part, T) { if (part.v) part.v = T.P.flat(); else { let k = 0; part.f = T.faces.map((f) => f.map(() => T.P[k++]).flat()); } }
const centroid = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
function faceNormal(T, f) {
  const pts = f.map((i) => T.P[i]), c = centroid(pts); let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
  const pc = centroid(T.P); if ((c[0] - pc[0]) * n[0] + (c[1] - pc[1]) * n[1] + (c[2] - pc[2]) * n[2] < 0) n = n.map((v) => -v); // 부품 바깥쪽
  return { n, c };
}

export class DesignEditor {
  constructor(engine) {
    this.e = engine; this.active = false; this.mode = 'point'; this.axis = 'free'; this.weld = true; this.sel = 0; this.onChange = () => {}; this.onSelect = () => {};
    this.root = new THREE.Group(); this.root.name = '디자인 수정'; this.root.visible = false; engine.scene.add(this.root);
    this.hMat = new THREE.MeshBasicMaterial({ color: '#2f7df6', depthTest: false }); this.hMatOn = new THREE.MeshBasicMaterial({ color: '#ff9f0a', depthTest: false });
    this.hGeo = new THREE.SphereGeometry(1, 12, 8);
    this.faceMat = new THREE.MeshBasicMaterial({ color: '#ff9f0a', transparent: true, opacity: 0.45, depthTest: false, side: THREE.DoubleSide });
    this._bind();
  }
  /** it: 기물, parts: 이미 실제 크기(mm)로 굽힌 부품 (app 이 넘김) */
  /** group: 기물이 아닌 것(벽 등)을 고칠 때 그 Three 그룹 (위치 · 방향을 따르고 숨김) */
  start(it, parts, group) {
    this.it = it; this.parts = clone(parts); this.T = this.parts.map(topo); this.sel = 0; this.vSel = null; this.fSel = null; this.undoStack = [];
    const g = group || this.e.itemGroup(it.id); this.hidden = g; if (g) { g.visible = false; this.root.position.copy(g.position); this.root.rotation.copy(g.rotation); }
    this.root.visible = true; this.active = true; this.e.select(null); const cv = this.e.canvas.getBoundingClientRect(), card = document.querySelector('#props'), cr = card && !card.hidden ? card.getBoundingClientRect() : null, ov = cr && cr.width ? Math.max(0, cv.right - cr.left) : Math.min(340, cv.width * 0.3); this.e.setShift(ov > 0 && ov < cv.width * 0.75 ? Math.round(ov / 2) : 0); /* 오른쪽 패널에 가리지 않게 */ this.rebuild(); this._frame();
  }
  stop() { this.active = false; this.e.setShift(0); this.root.visible = false; this._clear(); if (this.hidden) this.hidden.visible = true; this.hidden = null; }
  result() { this.T.forEach((T, i) => writeBack(this.parts[i], T)); return this.parts; }
  /** 되돌리기 기록: 부품 전체(점 · 색 · 재질 · 투명도 · 추가/삭제) + 고른 부품을 한 단위로. key 가 같은 연속 조작(슬라이더)은 0.8초 안이면 한 번만 */
  _state() { this.T.forEach((T, i) => writeBack(this.parts[i], T)); return JSON.stringify({ parts: this.parts, sel: this.sel }); }
  snapshot(key) { const now = performance.now(); if (key && this._lastKey === key && now - this._lastT < 800) { this._lastT = now; return; } this._lastKey = key || null; this._lastT = now; this.undoStack.push(this._state()); this.redoStack = []; if (this.undoStack.length > 60) this.undoStack.shift(); }
  _restore(st) { const o = JSON.parse(st); this.parts = o.parts; this.T = this.parts.map(topo); this.sel = Math.min(o.sel, this.parts.length - 1); this.vSel = null; this.fSel = null; this.rebuild(); this.onSelect(this.sel); this.onChange(); }
  undo() { const st = this.undoStack.pop(); if (!st) return false; (this.redoStack ||= []).push(this._state()); this._lastKey = null; this._restore(st); return true; }
  redo() { const st = (this.redoStack || []).pop(); if (!st) return false; this.undoStack.push(this._state()); this._lastKey = null; this._restore(st); return true; }
  _clear() { for (const c of [...this.root.children]) { this.root.remove(c); c.traverse((o) => { if (o.geometry && o.geometry !== this.hGeo) o.geometry.dispose(); }); } }
  /** 화면을 다시 그린다 (부품 메시 + 선택 부품 꼭짓점 손잡이) */
  rebuild() {
    this._clear(); this.T.forEach((T, i) => writeBack(this.parts[i], T));
    this.parts.forEach((p, i) => {
      const ms = partsToMeshes([p], [1, 1, 1], (q) => ({ color: q.c || '#b8bcc2', tex: MAT_TEX[q.m] || q.m || 'plain' }));
      for (const m of ms) { m.userData.part = i; this.root.add(m); if (i === this.sel) { const ed = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 20), new THREE.LineBasicMaterial({ color: '#2f7df6', depthTest: false })); ed.renderOrder = 998; this.root.add(ed); } }
    });
    const T = this.T[this.sel]; if (!T) return;
    if (this.mode === 'point') {
      const seen = new Set(), r = this._handleR();
      T.P.forEach((p, k) => { const key = p.map((v) => Math.round(v)).join(','); if (seen.has(key)) return; seen.add(key);
        const h = new THREE.Mesh(this.hGeo, this.vSel && this.vSel.part === this.sel && this.vSel.key === key ? this.hMatOn : this.hMat); h.scale.setScalar(r); h.position.set(p[0] * MM, p[1] * MM, p[2] * MM); h.renderOrder = 999; h.userData.vtx = { part: this.sel, k, key }; this.root.add(h); });
    }
    if (this.mode === 'face' && this.fSel && this.fSel.part === this.sel) {
      const f = T.faces[this.fSel.f], pts = f.map((i) => T.P[i]), pos = [];
      for (let k = 1; k + 1 < pts.length; k++) for (const q of [pts[0], pts[k], pts[k + 1]]) pos.push(q[0] * MM, q[1] * MM, q[2] * MM);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Mesh(g, this.faceMat); m.renderOrder = 999; this.root.add(m);
    }
  }
  _handleR() { const it = this.it; return Math.max(0.012, Math.min(0.03, Math.max(it.w, it.d, it.h) * MM * 0.025)); }
  _frame() { const box = new THREE.Box3().setFromObject(this.root), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() || 1, cam = this.e.camera, t = this.e.controls.target, dir = cam.position.clone().sub(t).normalize(); t.copy(c); cam.position.copy(c).addScaledVector(dir, Math.max(1.8, r * 2.3)); if (cam.isOrthographicCamera) { cam.zoom = Math.max(0.5, (this.e.orthoSize || 8) / (r * 0.9)); cam.updateProjectionMatrix(); } this.e.controls.update(); }

  /* ---------- 부품 편집 ---------- */
  selectPart(i) { this.sel = Math.max(0, Math.min(this.parts.length - 1, i)); this.vSel = null; this.fSel = null; this.rebuild(); this.onSelect(this.sel); }
  setColor(i, c) { this.snapshot('c' + i); const p = this.parts[i]; p.c = c; p.own = true; this.rebuild(); this.onChange(); }
  setMat(i, m) { this.snapshot(); const p = this.parts[i]; p.m = m; p.own = true; this.rebuild(); this.onChange(); }
  setAlpha(i, a) { this.snapshot('a' + i); const p = this.parts[i]; if (a >= 1) delete p.a; else p.a = a; p.own = true; this.rebuild(); this.onChange(); }
  removePart(i) { if (this.parts.length < 2) return false; this.snapshot(); this.parts.splice(i, 1); this.T.splice(i, 1); this.selectPart(Math.min(i, this.parts.length - 1)); this.onChange(); return true; }
  duplicatePart(i) { this.snapshot(); const p = clone(this.parts[i]); this.parts.splice(i + 1, 0, p); const T = topo(p); T.P.forEach((q) => (q[0] += 50)); this.T.splice(i + 1, 0, T); this.selectPart(i + 1); this.onChange(); }
  addBox() { // 선택 부품 위에 얹는 상자 (턱 · 선반 · 손잡이 만들 때)
    this.snapshot();
    const all = this.T.flatMap((T) => T.P), maxY = Math.max(...all.map((p) => p[1])), xs = all.map((p) => p[0]), zs = all.map((p) => p[2]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const w = 200, d = 200, h = 100, v = [[cx - w / 2, maxY, cz - d / 2], [cx + w / 2, maxY, cz - d / 2], [cx + w / 2, maxY, cz + d / 2], [cx - w / 2, maxY, cz + d / 2]]; const p = { n: 4, v: [...v, ...v.map((q) => [q[0], q[1] + h, q[2]])].flat(), c: '#b8bcc2', m: 'plain', own: true };
    this.parts.push(p); this.T.push(topo(p)); this.selectPart(this.parts.length - 1); this.onChange();
  }
  setMode(m) { this.mode = m; this.vSel = null; this.fSel = null; this.rebuild(); }

  /* ---------- 끌기 ---------- */
  _ray(e) { const r = this.e.canvas.getBoundingClientRect(), rc = (this._rc ||= new THREE.Raycaster()); rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.e.camera); return rc; }
  _toLocal(v) { return this.root.worldToLocal(v.clone()).multiplyScalar(1 / MM); }
  /** 광선과 가장 가까운 축 위의 점 (mm, 기물 좌표) */
  _closestOnLine(ray, o, d) { // o, d: 기물 좌표(mm) — 월드로 바꿔 계산
    const O = this.root.localToWorld(new THREE.Vector3(...o).multiplyScalar(MM)), D = this.root.localToWorld(new THREE.Vector3(...o).add(new THREE.Vector3(...d)).multiplyScalar(MM)).sub(O).normalize();
    const w0 = ray.origin.clone().sub(O), a = D.dot(D), b = D.dot(ray.direction), c = ray.direction.dot(ray.direction), dd = D.dot(w0), e = ray.direction.dot(w0), den = a * c - b * b; if (Math.abs(den) < 1e-9) return 0;
    return ((dd * c - b * e) / den) / MM; // 축을 따라 움직인 거리(mm)
  }
  /** 축(o, d) 방향으로 얼마나 끌었나(mm). 축이 화면을 똑바로 향하면(위에서 본 높이 등) 화면 위아래로 끈 거리로 대신한다 */
  _axisDrag(ray0, o, d) {
    const cam = this.e.camera, O = this.root.localToWorld(new THREE.Vector3(...o).multiplyScalar(MM)), D = this.root.localToWorld(new THREE.Vector3(...o).add(new THREE.Vector3(...d)).multiplyScalar(MM)).sub(O).normalize();
    const view = cam.getWorldDirection(new THREE.Vector3());
    if (Math.abs(D.dot(view)) < 0.9) { const t0 = this._closestOnLine(ray0, o, d); return (r) => this._closestOnLine(r, o, d) - t0; }
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(view, O), p0 = new THREE.Vector3(); ray0.intersectPlane(plane, p0);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), sign = -Math.sign(D.dot(view)) || 1;
    return (r) => { const p = new THREE.Vector3(); if (!r.intersectPlane(plane, p)) return 0; return (p.sub(p0).dot(up) / MM) * sign; };
  }
  _pickFace(ray) {
    let best = null; const T = this.T[this.sel], v = (q) => this.root.localToWorld(new THREE.Vector3(q[0] * MM, q[1] * MM, q[2] * MM)), hit = new THREE.Vector3();
    T.faces.forEach((f, fi) => { const pts = f.map((i) => v(T.P[i])); for (let k = 1; k + 1 < pts.length; k++) { if (ray.ray.intersectTriangle(pts[0], pts[k], pts[k + 1], false, hit)) { const d = hit.distanceTo(ray.ray.origin); if (!best || d < best.d) best = { f: fi, d }; } } });
    return best;
  }
  _mates(part, k) { // 같은 자리 점들 (붙은 점 같이)
    const p0 = this.T[part].P[k], out = [];
    this.T.forEach((T, pi) => { if (pi !== part && !this.weld) return; T.P.forEach((p, i) => { if (Math.abs(p[0] - p0[0]) < 0.6 && Math.abs(p[1] - p0[1]) < 0.6 && Math.abs(p[2] - p0[2]) < 0.6) out.push(p); }); });
    return out;
  }
  _bind() {
    const cv = this.e.canvas; let drag = null;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.active || e.button > 0 || this.e._touches > 1) return;
      const ray = this._ray(e);
      if (this.mode === 'point') {
        const h = ray.intersectObjects(this.root.children.filter((o) => o.userData.vtx), false)[0];
        if (h) { const { part, k, key } = h.object.userData.vtx; this.vSel = { part, k, key }; this.snapshot(); const pts = this._mates(part, k), start = pts.map((p) => [...p]), o = [...this.T[part].P[k]];
          const ax = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[this.axis];
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.e.camera.getWorldDirection(new THREE.Vector3()), this.root.localToWorld(new THREE.Vector3(...o).multiplyScalar(MM)));
          const along = ax ? this._axisDrag(ray.ray, o, ax) : null, p0 = new THREE.Vector3(); if (!ax) ray.ray.intersectPlane(plane, p0);
          drag = { move: (r) => { let d;
              if (ax) { const s = Math.round(along(r.ray) / SNAP) * SNAP; d = ax.map((v) => v * s); }
              else { const p = new THREE.Vector3(); if (!r.ray.intersectPlane(plane, p)) return; const a = this._toLocal(p0), b = this._toLocal(p); d = [b.x - a.x, b.y - a.y, b.z - a.z].map((v) => Math.round(v / SNAP) * SNAP); }
              pts.forEach((p, i) => { p[0] = start[i][0] + d[0]; p[1] = start[i][1] + d[1]; p[2] = start[i][2] + d[2]; }); this.rebuild(); } };
          e.stopImmediatePropagation(); cv.setPointerCapture(e.pointerId); this.rebuild(); return; }
      }
      // (면 모드) 고른 부품의 면을 먼저 찾고, 없으면 누른 부품을 고른다
      const fh = this.mode === 'face' ? this._pickFace(ray) : null;
      if (!fh) {
        const hit = ray.intersectObjects(this.root.children.filter((o) => o.userData.part != null), false)[0];
        if (hit && hit.object.userData.part !== this.sel) { this.selectPart(hit.object.userData.part); e.stopImmediatePropagation(); }
        return;
      }
      const T = this.T[this.sel], f = T.faces[fh.f], { n, c } = faceNormal(T, f); this.fSel = { part: this.sel, f: fh.f }; this.snapshot();
      const set = new Set(); f.forEach((i) => this._mates(this.sel, i).forEach((p) => set.add(p))); const pts = [...set], start = pts.map((p) => [...p]), along = this._axisDrag(ray.ray, c, n);
      drag = { move: (r) => { const s = Math.round(along(r.ray) / SNAP) * SNAP; pts.forEach((p, i) => { p[0] = start[i][0] + n[0] * s; p[1] = start[i][1] + n[1] * s; p[2] = start[i][2] + n[2] * s; }); this.rebuild(); } };
      e.stopImmediatePropagation(); cv.setPointerCapture(e.pointerId); this.rebuild();
    }, true);
    cv.addEventListener('pointermove', (e) => { if (!drag) return; e.stopImmediatePropagation(); drag.move(this._ray(e)); drag.moved = true; }, true);
    const up = (e) => { if (!drag) return; e.stopImmediatePropagation(); const m = drag.moved; drag = null; if (m) this.onChange(); else { this.undoStack.pop(); this._lastKey = null; } };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
  }
}

/** 기물의 지금 모양을 실제 크기(mm) 부품으로 굽힌다 (부품이 없으면 상자 하나) */
export function bakeParts(it, ctx) {
  const L = ctx.lib[it.type], src = it.parts || ctx.shapes[it.type];
  if (!src || !src.length) { const hw = it.w / 2, hd = it.d / 2, v = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]]; return [{ n: 4, v: [...v, ...v.map((q) => [q[0], it.h, q[2]])].flat(), c: it.color || (L && L.color) || '#b8bcc2', m: it.mat || (L && L.mat) || 'plain', own: true }]; }
  const pb = it.pb || (L ? { w: L.w, d: L.d, h: L.h } : { w: it.w, d: it.d, h: it.h }), sx = it.w / (pb.w || it.w), sy = it.h / (pb.h || it.h), sz = it.d / (pb.d || it.d);
  const baseColor = L && L.color ? L.color.toLowerCase() : null;
  return src.map((p) => { const q = clone(p), sc = (a) => a.map((v, i) => Math.round(v * [sx, sy, sz][i % 3] * 10) / 10);
    if (q.v) q.v = sc(q.v); else q.f = q.f.map(sc);
    if (!q.own) { const main = baseColor && typeof q.c === 'string' && q.c.toLowerCase() === baseColor; if (main && it.color) q.c = it.color; if (main && it.mat) q.m = it.mat; q.own = true; } // 지금 보이는 색을 부품 색으로 고정
    return q; });
}
/** 고친 부품 → 기물 크기 · 위치 다시 맞추기 (가운데 정렬, 바닥 0) */
export function applyParts(it, parts) {
  const all = []; for (const p of parts) { const f = p.v || p.f.flat(); for (let i = 0; i < f.length; i += 3) all.push([f[i], f[i + 1], f[i + 2]]); }
  const mn = [0, 1, 2].map((k) => Math.min(...all.map((q) => q[k]))), mx = [0, 1, 2].map((k) => Math.max(...all.map((q) => q[k]))), cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, dy = mn[1];
  const mv = (a) => a.map((v, i) => Math.round((v - [cx, dy, cz][i % 3]) * 10) / 10);
  for (const p of parts) { if (p.v) p.v = mv(p.v); else p.f = p.f.map(mv); }
  const r = ((it.rot || 0) * Math.PI) / 180; // 기물 좌표(x, z) → 도면(x, y)
  it.x = Math.round(it.x + cx * Math.cos(r) - cz * Math.sin(r)); it.y = Math.round(it.y + cx * Math.sin(r) + cz * Math.cos(r)); it.elev = Math.round((it.elev || 0) + dy);
  it.w = Math.max(1, Math.round(mx[0] - mn[0])); it.h = Math.max(1, Math.round(mx[1] - mn[1])); it.d = Math.max(1, Math.round(mx[2] - mn[2]));
  it.parts = parts; it.pb = { w: it.w, d: it.d, h: it.h }; it.color = null; it.mat = null;
}
