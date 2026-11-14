// 걷기 모드 (기존 앱 "걷기"): 눈높이 1인칭으로 매장 안을 걸어 다닌다.
//   PC: W A S D · 방향키 이동, 끌어서 둘러보기, Q · E 눈높이, Shift 빨리
//   폰 · 태블릿: 왼쪽 아래 조이스틱 이동, 화면 끌어서 둘러보기
//   벽에 막힘(문 · 아치 자리는 지나감) · "통과"를 켜면 벽 · 기물 통과 · 단 · 구배 위에서는 바닥 높이를 따라 올라간다
import * as THREE from 'three';
import { floorAt } from './slope.js';
const MM = 0.001, R = 260; // 몸 반지름 mm

export class Walker {
  constructor(engine) { this.e = engine; this.active = false; this.eye = 1600; this.through = false; this.keys = new Set(); this.stick = { x: 0, y: 0 }; this._bind(); }
  start() {
    const e = this.e, L = e.level; if (!L) return;
    this.saved = { cam: e.camera, pos: e.camera.position.clone(), tgt: e.controls.target.clone(), zoom: e.camera.zoom };
    if (e.camera.isOrthographicCamera) e._useCamera(e.persp);
    const t = e.controls.target, d = e.camera.position.clone().sub(t); this.yaw = Math.atan2(d.x, d.z); this.pitch = 0;
    // 출발점: 화면 가운데 바닥, 벽 안쪽이면 그대로
    this.x = t.x / MM; this.y = t.z / MM; this.fov = e.persp.fov; e.persp.fov = 70; e.persp.updateProjectionMatrix();
    e.controls.enabled = false; this.active = true; this.ui(true); this.update(0);
  }
  stop() {
    if (!this.active) return; const e = this.e; this.active = false; this.ui(false); e.persp.fov = this.fov || 45; e.persp.updateProjectionMatrix();
    if (this.saved) { if (this.saved.cam !== e.camera) e._useCamera(this.saved.cam); e.camera.position.copy(this.saved.pos); e.controls.target.copy(this.saved.tgt); }
    e.controls.enabled = true; e.controls.update(); this.keys.clear(); this.stick = { x: 0, y: 0 }; if (this.onStop) this.onStop();
  }
  ui(on) { const el = document.querySelector('#walkUI'); if (el) el.hidden = !on; const n = document.querySelector('#walkThrough'); if (n) n.setAttribute('aria-pressed', String(this.through)); }
  blocked(x, y) {
    if (this.through) return false; const L = this.e.level;
    for (const w of L.walls) {
      const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1, t = ((x - w.x1) * dx + (y - w.y1) * dy) / (len * len), tc = Math.max(0, Math.min(1, t));
      const dist = Math.hypot(w.x1 + dx * tc - x, w.y1 + dy * tc - y); if (dist > w.t / 2 + R) continue;
      const along = tc * len; if (L.openings.some((o) => o.wall === w.id && (o.sill || 0) <= 50 && o.h >= 1700 && Math.abs(along - o.t) < o.w / 2 - R * 0.6)) continue; // 문 · 아치 자리
      return true;
    }
    return false;
  }
  update(dt) {
    const e = this.e, k = this.keys, sp = (k.has('shift') ? 2.6 : 1.4) * 1000 * dt; // mm/초
    let f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) - this.stick.y, s = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0) + this.stick.x;
    if (k.has('arrowleft')) this.yaw += 1.6 * dt; if (k.has('arrowright')) this.yaw -= 1.6 * dt;
    if (k.has('q')) this.eye = Math.max(400, this.eye - 900 * dt); if (k.has('e')) this.eye = Math.min(4000, this.eye + 900 * dt);
    const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
    const fx = -Math.sin(this.yaw), fy = -Math.cos(this.yaw), rx = -fy, ry = fx; // 앞 · 오른쪽 (도면 좌표)
    const nx = this.x + (fx * f + rx * s) * sp, ny = this.y + (fy * f + ry * s) * sp;
    if (!this.blocked(nx, this.y)) this.x = nx; if (!this.blocked(this.x, ny)) this.y = ny; // 벽을 따라 미끄러지게
    const z = (floorAt(e.level, this.x, this.y) + this.eye) * MM, cam = e.camera;
    cam.position.set(this.x * MM, z, this.y * MM);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    cam.lookAt(cam.position.clone().add(dir)); e.controls.target.copy(cam.position).add(dir);
  }
  _bind() {
    const typing = () => /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    addEventListener('keydown', (ev) => { if (!this.active || typing()) return; const key = ev.key.toLowerCase(); if (key === 'escape') return this.stop(); this.keys.add(key === 'shift' ? 'shift' : key); if (/^(arrow|w|a|s|d|q|e)/.test(key)) ev.preventDefault(); });
    addEventListener('keyup', (ev) => this.keys.delete(ev.key.toLowerCase() === 'shift' ? 'shift' : ev.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    // 끌어서 둘러보기
    const cv = this.e.canvas; let look = null;
    cv.addEventListener('pointerdown', (ev) => { if (!this.active) return; look = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }; cv.setPointerCapture(ev.pointerId); ev.stopImmediatePropagation(); }, true);
    cv.addEventListener('pointermove', (ev) => { if (!this.active || !look || ev.pointerId !== look.id) return; this.yaw -= (ev.clientX - look.x) * 0.005; this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - (ev.clientY - look.y) * 0.004)); look.x = ev.clientX; look.y = ev.clientY; ev.stopImmediatePropagation(); }, true);
    const up = (ev) => { if (look && ev.pointerId === look.id) look = null; };
    cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
    cv.addEventListener('wheel', (ev) => { if (!this.active) return; ev.preventDefault(); ev.stopImmediatePropagation(); this.eye = Math.max(400, Math.min(4000, this.eye - ev.deltaY * 0.8)); }, { capture: true, passive: false });
    // 조이스틱 (화면 요소는 index.html 의 #walkPad)
    const pad = document.querySelector('#walkPad'), knob = pad && pad.firstElementChild; if (!pad) return;
    let pid = null;
    const setK = (ev) => { const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width / 2 - 14; let dx = ev.clientX - cx, dy = ev.clientY - cy; const d = Math.hypot(dx, dy); if (d > max) { dx *= max / d; dy *= max / d; } knob.style.transform = `translate(${dx}px, ${dy}px)`; this.stick = { x: dx / max, y: dy / max }; };
    pad.addEventListener('pointerdown', (ev) => { pid = ev.pointerId; pad.setPointerCapture(pid); setK(ev); });
    pad.addEventListener('pointermove', (ev) => { if (ev.pointerId === pid) setK(ev); });
    const end = (ev) => { if (ev.pointerId !== pid) return; pid = null; knob.style.transform = ''; this.stick = { x: 0, y: 0 }; };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  }
}
