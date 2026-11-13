// 2D 도면: 벽 그리기 · 문/창 넣기 · 기물/벽/문 끌기 — 손을 떼기 전부터 3D 에 바로 반영된다.
// 좌표는 모델과 같은 mm, 도면 y 는 아래로 (3D 의 z).
import { OPDEF } from './cloud.js';
import { pointInPoly, polyArea, polyCenter, slopeFrame, roomTop, deg2pct } from './slope.js';
export const KINDS = { 주방: '#f2c46b', 홀: '#9cc8e8', 카운터: '#e8a0a0', 공장: '#b9b0d8', 창고: '#c8bfae', 복도: '#cfd6dc', 화장실: '#9fd9d0', 거실: '#d7c49e', 사무실: '#b7d39b', 기타: '#d9d2c4' };

const GRID = 50, SNAP_PX = 14, HIT_PX = 12;
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const wlen = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
const OP_LABEL = { door1: '외문', door2: '양문', auto: '자동문', slide: '미닫이', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', arch: '아치' };
export const TOOLS = { select: '고르기 · 끌기', wall: '벽 그리기', door1: '문', window: '창', pass: '배식구', roomRect: '공간 (사각형)', roomPoly: '공간 (선)', erase: '지우기' };

export class Plan2D {
  /** api: { level(), lib, style(), onLive(kind), onChange(msg), onSelect(sel), toast(msg) } */
  constructor(canvas, api) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.api = api;
    this.view = { sc: 0.08, ox: -1000, oy: -1500 }; this.tool = 'select'; this.sel = null; this.chain = null; this.hover = null; this.dirty = true;
    this._bind(); new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
    const loop = () => { if (this.dirty && this.cv.clientWidth) { this.dirty = false; this.draw(); } requestAnimationFrame(loop); }; loop();
  }
  get L() { return this.api.level(); }
  redraw() { this.dirty = true; }
  resize() { const pr = Math.min(2, devicePixelRatio || 1), w = this.cv.clientWidth, h = this.cv.clientHeight; if (!w) return; this.cv.width = w * pr; this.cv.height = h * pr; this.pr = pr; if (!this._fitted && this.L) { this._fitted = true; this.fit(); } this.redraw(); }
  setTool(t) { this.tool = t; this.chain = null; this.rpts = null; this.rrect = null; this.cv.style.cursor = t === 'select' ? 'default' : 'crosshair'; this.redraw(); }
  select(sel, quiet) { this.sel = sel; this.redraw(); if (!quiet) this.api.onSelect(sel); }

  /* ---------- 좌표 ---------- */
  toMm(px, py) { return { x: px / this.view.sc + this.view.ox, y: py / this.view.sc + this.view.oy }; }
  toPx(x, y) { return { x: (x - this.view.ox) * this.view.sc, y: (y - this.view.oy) * this.view.sc }; }
  evMm(e) { const r = this.cv.getBoundingClientRect(); return this.toMm(e.clientX - r.left, e.clientY - r.top); }
  /** 도면 전체가 보이게 (위 도구줄 · 왼쪽 도구 버튼 자리를 비우고) */
  fit() {
    const L = this.L; if (!L) return; const b = [Infinity, Infinity, -Infinity, -Infinity], add = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
    L.walls.forEach((w) => { add(w.x1, w.y1); add(w.x2, w.y2); }); L.items.forEach((i) => add(i.x, i.y)); L.rooms.forEach((r) => r.pts.forEach((p) => add(p[0], p[1])));
    if (!Number.isFinite(b[0])) b.splice(0, 4, 0, 0, 8000, 6000);
    const w = this.cv.clientWidth, h = this.cv.clientHeight, padL = 72, padT = 84, pad = 28;
    const sc = Math.min((w - padL - pad) / Math.max(1000, b[2] - b[0]), (h - padT - pad) / Math.max(1000, b[3] - b[1]));
    this.view.sc = sc; this.view.ox = b[0] - (padL + (w - padL - pad - (b[2] - b[0]) * sc) / 2) / sc; this.view.oy = b[1] - (padT + (h - padT - pad - (b[3] - b[1]) * sc) / 2) / sc; this.redraw();
  }
  zoomAt(px, py, f) { const m = this.toMm(px, py), v = this.view; v.sc = Math.min(2, Math.max(0.01, v.sc * f)); v.ox = m.x - px / v.sc; v.oy = m.y - py / v.sc; this.redraw(); }

  /* ---------- 붙이기(스냅) ---------- */
  ends() { return this.L.walls.flatMap((w) => [{ w, k: 1, x: w.x1, y: w.y1 }, { w, k: 2, x: w.x2, y: w.y2 }]); }
  snapPoint(p, from, skip) {
    const tol = SNAP_PX / this.view.sc;
    let best = null; for (const e of this.ends()) { if (skip && skip.has(e.w)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < tol && (!best || d < best.d)) best = { x: e.x, y: e.y, d }; }
    if (best) return { x: best.x, y: best.y, snapped: 'end' };
    let q = { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
    if (from) { const dx = q.x - from.x, dy = q.y - from.y; if (Math.abs(dy) < Math.abs(dx) * 0.1) q.y = from.y; else if (Math.abs(dx) < Math.abs(dy) * 0.1) q.x = from.x; } // 수평 · 수직 고정
    return q;
  }

  /* ---------- 고르기 ---------- */
  projOnWall(w, p) { const L = wlen(w) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, t = (p.x - w.x1) * ux + (p.y - w.y1) * uy, d = Math.abs(-(p.x - w.x1) * uy + (p.y - w.y1) * ux); return { t, d, L, ux, uy }; }
  hitWall(p, extra = 0) { let best = null; for (const w of this.L.walls) { const q = this.projOnWall(w, p); if (q.t < -10 || q.t > q.L + 10) continue; const lim = w.t / 2 + HIT_PX / this.view.sc + extra; if (q.d < lim && (!best || q.d < best.q.d)) best = { w, q }; } return best; }
  hitItem(p) {
    const its = this.L.items; for (let i = its.length - 1; i >= 0; i--) { const it = its[i], a = (-it.rot * Math.PI) / 180, dx = p.x - it.x, dy = p.y - it.y, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a), m = 4 / this.view.sc; if (Math.abs(lx) <= it.w / 2 + m && Math.abs(ly) <= it.d / 2 + m) return it; }
    return null;
  }
  hitOpening(p) { const h = this.hitWall(p); if (!h) return null; return this.L.openings.find((o) => o.wall === h.w.id && Math.abs(h.q.t - o.t) <= o.w / 2) || null; }
  hitEnd(p) { const tol = HIT_PX / this.view.sc; let best = null; for (const e of this.ends()) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < tol && (!best || d < best.d)) best = { ...e, d }; } return best; }
  hitRoom(p) { let best = null; for (const r of this.L.rooms) if (r.pts.length >= 3 && pointInPoly(p.x, p.y, r.pts)) { const a = polyArea(r.pts); if (!best || a < best.a) best = { a, r }; } return best && best.r; }
  hitRoomVtx(p) { const r = this.sel && this.sel.kind === 'room' && this.L.rooms.find((q) => q.id === this.sel.id); if (!r) return null; const tol = HIT_PX / this.view.sc; const k = r.pts.findIndex((q) => Math.hypot(q[0] - p.x, q[1] - p.y) < tol); return k < 0 ? null : { r, k }; }
  /** 공간만 보기 중이면 그 공간 근처만 고를 수 있다 */
  inFocus(x, y) { const F = this.focus; if (!F) return true; if (pointInPoly(x, y, F)) return true; for (let i = 0; i < F.length; i++) { const a = F[i], b = F[(i + 1) % F.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); if (Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) < 400) return true; } return false; }
  pickAt(p) {
    if (!this.inFocus(p.x, p.y)) return null;
    const o = this.hitOpening(p); if (o) return { kind: 'opening', id: o.id };
    const it = this.hitItem(p); if (it) return { kind: 'item', id: it.id };
    const w = this.hitWall(p); if (w) return { kind: 'wall', id: w.w.id };
    const r = this.hitRoom(p); if (r) return { kind: 'room', id: r.id };
    return null;
  }

  /* ---------- 편집 ---------- */
  addWall(a, b) {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 100) return null;
    const L = this.L, w = { id: uid('w'), x1: Math.round(a.x), y1: Math.round(a.y), x2: Math.round(b.x), y2: Math.round(b.y), t: L.wallT || 150, h: L.ceilingH || 2700, color: '#ece8e1', finish: 'paint' };
    L.walls.push(w); this.api.onLive('structure'); return w;
  }
  addOpening(type, p) {
    const h = this.hitWall(p, 300 / 1); if (!h) { this.api.toast('벽 위를 눌러 주세요'); return; }
    const [w0, hh, sill] = OPDEF[type], len = h.q.L, w = Math.min(w0, Math.max(300, len - 100));
    const t = Math.round(Math.min(len - w / 2, Math.max(w / 2, h.q.t)) / 10) * 10;
    const o = { id: uid('o'), wall: h.w.id, type, t, w, h: Math.min(hh, h.w.h - sill), sill, frost: null };
    this.L.openings.push(o); this.api.onLive('structure'); this.select({ kind: 'opening', id: o.id }); this.api.onChange(`${OP_LABEL[type] || '문/창'}을 넣었어요`);
  }
  erase(sel) {
    if (!sel) return; const L = this.L;
    if (sel.kind === 'item') { L.items = L.items.filter((i) => i.id !== sel.id); this.api.onLive('item-removed', sel.id); }
    if (sel.kind === 'opening') { L.openings = L.openings.filter((o) => o.id !== sel.id); this.api.onLive('structure'); }
    if (sel.kind === 'room') { L.rooms = L.rooms.filter((r) => r.id !== sel.id); this.api.onLive('structure'); }
    if (sel.kind === 'wall') { L.walls = L.walls.filter((w) => w.id !== sel.id); L.openings = L.openings.filter((o) => o.wall !== sel.id); this.api.onLive('structure'); }
    if (this.sel && this.sel.id === sel.id) this.select(null); this.api.onChange('지웠어요'); this.redraw();
  }

  /* ---------- 입력 ---------- */
  _bind() {
    const cv = this.cv, pts = new Map(); let act = null, pinch = null;
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { if (act && act.cancel) act.cancel(); act = null; const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
      if (pts.size > 2) return;
      const p = this.evMm(e), start = { x: e.clientX, y: e.clientY };
      if (e.button === 1 || e.button === 2) { if (this.chain && e.button === 2) { this.chain = null; this.redraw(); return; } act = { pan: true, start, last: start }; return; }
      if (this.tool === 'wall') { act = { wall: true, start, a: this.snapPoint(p) }; return; }
      if (this.tool === 'roomRect') { const a0 = this.snapPoint(p); this.rrect = [a0, a0]; act = { rect: true, start }; return; }
      if (this.tool !== 'select') { act = { tap: true, start }; return; }
      const rv = this.hitRoomVtx(p); if (rv) { act = this._dragRoomVtx(rv.r, rv.k, start); return; }
      // 고르기: 벽 끝점 → 문/창 → 기물 → 벽 → 빈 곳(화면 이동)
      const end = this.sel && this.sel.kind === 'wall' ? this.hitEnd(p) : null;
      if (end) { const mates = this.ends().filter((q) => Math.hypot(q.x - end.x, q.y - end.y) < 1); act = this._dragEnds(mates, start); return; }
      const hit = this.pickAt(p);
      if (!hit) { act = { pan: true, start, last: start, tapEmpty: true }; return; }
      if (!this.sel || this.sel.id !== hit.id) this.select(hit);
      if (hit.kind === 'item') act = this._dragItem(this.L.items.find((i) => i.id === hit.id), p, start);
      else if (hit.kind === 'opening') act = this._dragOpening(this.L.openings.find((o) => o.id === hit.id), start);
      else if (hit.kind === 'room') act = { pan: true, start, last: start }; // 공간은 눌러서 고르기만 (꼭짓점으로 모양 바꾸기)
      else act = this._dragWall(this.L.walls.find((w) => w.id === hit.id), p, start);
    });
    cv.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, r = cv.getBoundingClientRect(); this.view.ox -= (cx - pinch.cx) / this.view.sc; this.view.oy -= (cy - pinch.cy) / this.view.sc; this.zoomAt(cx - r.left, cy - r.top, d / pinch.d); pinch = { d, cx, cy }; return; }
      const p = this.evMm(e);
      if (this.tool === 'roomPoly' || this.tool === 'pick') { this.hover = this.tool === 'pick' ? p : this.snapPoint(p, this.rpts && this.rpts[this.rpts.length - 1]); this.redraw(); }
      if (act && act.rect) { const b = this.snapPoint(p); this.rrect = [this.rrect[0], b]; this.redraw(); return; }
      if (this.tool === 'wall') { const drag = act && act.wall && Math.hypot(e.clientX - act.start.x, e.clientY - act.start.y) > 6; this.dragFrom = drag ? act.a : null; this.hover = this.snapPoint(p, this.dragFrom || (this.chain && this.chain.last)); this.redraw(); }
      if (!act) return;
      const moved = Math.hypot(e.clientX - act.start.x, e.clientY - act.start.y) > 6; act.moved ||= moved;
      if (act.pan) { this.view.ox -= (e.clientX - act.last.x) / this.view.sc; this.view.oy -= (e.clientY - act.last.y) / this.view.sc; act.last = { x: e.clientX, y: e.clientY }; this.redraw(); return; }
      if (act.move && act.moved) { act.move(p); this.redraw(); }
    });
    const up = (e) => {
      pts.delete(e.pointerId); if (pinch) { if (pts.size < 2) pinch = null; act = null; return; }
      if (!act) return; const a = act; act = null; const p = this.evMm(e);
      if (a.wall) {
        this.dragFrom = null; const b = this.snapPoint(p, a.moved ? a.a : this.chain && this.chain.last);
        if (a.moved && Math.hypot(b.x - a.a.x, b.y - a.a.y) >= 100) { this.addWall(a.a, b); this.chain = { first: a.a, last: b }; this.api.onChange('벽을 그렸어요'); } // 끌어서 한 번에
        else if (!this.chain) this.chain = { first: b, last: b }; // 첫 점
        else if (Math.hypot(b.x - this.chain.last.x, b.y - this.chain.last.y) < 100) this.chain = null; // 같은 곳 한 번 더 = 끝
        else { this.addWall(this.chain.last, b); const closed = Math.hypot(b.x - this.chain.first.x, b.y - this.chain.first.y) < 1; this.chain = closed ? null : { ...this.chain, last: b }; this.api.onChange(closed ? '벽을 닫았어요' : '벽을 그렸어요'); }
        this.redraw(); return;
      }
      if (a.rect) { const [q0, q1] = this.rrect; this.rrect = null; this.redraw(); if (Math.abs(q1.x - q0.x) < 300 || Math.abs(q1.y - q0.y) < 300) { this.api.toast('끌어서 사각형을 그려 주세요 (30cm 이상)'); return; } const x0 = Math.min(q0.x, q1.x), x1 = Math.max(q0.x, q1.x), y0 = Math.min(q0.y, q1.y), y1 = Math.max(q0.y, q1.y); this.api.onRoom([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); return; }
      if (a.tap && !a.moved && this.tool === 'roomPoly') { const q = this.snapPoint(p, this.rpts && this.rpts[this.rpts.length - 1]), R = (this.rpts ||= []);
        const first = R[0], tol = SNAP_PX / this.view.sc, last = R[R.length - 1];
        if (first && R.length >= 3 && Math.hypot(q.x - first.x, q.y - first.y) < Math.max(tol, 1)) { this.rpts = null; this.api.onRoom(R.map((v) => [Math.round(v.x), Math.round(v.y)])); }
        else if (last && Math.hypot(q.x - last.x, q.y - last.y) < 1) { if (R.length >= 3) { this.rpts = null; this.api.onRoom(R.map((v) => [Math.round(v.x), Math.round(v.y)])); } }
        else R.push(q);
        this.redraw(); return; }
      if (a.tap && !a.moved && this.tool === 'pick') { if (this.picker) this.picker(p, this.hitItem(p)); return; }
      if (a.tap && !a.moved) { if (OPDEF[this.tool]) this.addOpening(this.tool, p); if (this.tool === 'erase') this.erase(this.pickAt(p)); return; }
      if (a.pan) { if (a.tapEmpty && !a.moved) this.select(null); return; }
      if (a.done) a.done(a.moved);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { if (act && act.cancel) act.cancel(); act = null; up(e); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (this.chain || this.rpts)) { this.chain = null; this.rpts = null; this.redraw(); } });
  }
  _dragRoomVtx(r, k, start) {
    const o = [...r.pts[k]];
    return { start, move: (p) => { const q = this.snapPoint(p); r.pts[k] = [Math.round(q.x), Math.round(q.y)]; this.api.onLive('structure'); },
      done: (m) => m && this.api.onChange(), cancel: () => { r.pts[k] = o; this.api.onLive('structure'); } };
  }
  _dragItem(it, p0, start) {
    const ox = it.x, oy = it.y;
    return { start, move: (p) => { it.x = Math.round((ox + p.x - p0.x) / 10) * 10; it.y = Math.round((oy + p.y - p0.y) / 10) * 10; this.api.onLive('item', it); },
      done: (m) => m && this.api.onChange(), cancel: () => { it.x = ox; it.y = oy; this.api.onLive('item', it); } };
  }
  _dragOpening(o, start) {
    const w = this.L.walls.find((q) => q.id === o.wall), t0 = o.t;
    return { start, move: (p) => { const q = this.projOnWall(w, p); o.t = Math.round(Math.min(q.L - o.w / 2, Math.max(o.w / 2, q.t)) / 10) * 10; this.api.onLive('structure'); },
      done: (m) => m && this.api.onChange(), cancel: () => { o.t = t0; this.api.onLive('structure'); } };
  }
  /** 끝점 끌기: 이 점에 붙은 다른 벽 끝도 같이 따라온다 */
  _dragEnds(mates, start) {
    const orig = mates.map((m) => ({ ...m })), skip = new Set(mates.map((m) => m.w));
    const other = (m) => (m.k === 1 ? { x: m.w.x2, y: m.w.y2 } : { x: m.w.x1, y: m.w.y1 });
    const set = (x, y) => mates.forEach((m) => { if (m.k === 1) { m.w.x1 = x; m.w.y1 = y; } else { m.w.x2 = x; m.w.y2 = y; } });
    return { start, move: (p) => { const q = this.snapPoint(p, mates.length === 1 ? other(mates[0]) : null, skip); set(Math.round(q.x), Math.round(q.y)); this._clampOpenings(); this.api.onLive('structure'); },
      done: (m) => m && this.api.onChange(), cancel: () => { set(orig[0].x, orig[0].y); this.api.onLive('structure'); } };
  }
  /** 벽 통째로 옮기기: 붙어 있던 이웃 벽 끝도 늘어나며 따라온다 */
  _dragWall(w, p0, start) {
    const a = { x: w.x1, y: w.y1 }, b = { x: w.x2, y: w.y2 }, near = (q, r) => Math.hypot(q.x - r.x, q.y - r.y) < 1;
    const mates = this.ends().filter((e) => e.w !== w && (near(e, a) || near(e, b))).map((e) => ({ ...e, at: near(e, a) ? 'a' : 'b' }));
    const apply = (dx, dy) => { w.x1 = a.x + dx; w.y1 = a.y + dy; w.x2 = b.x + dx; w.y2 = b.y + dy; for (const m of mates) { const s = m.at === 'a' ? a : b; if (m.k === 1) { m.w.x1 = s.x + dx; m.w.y1 = s.y + dy; } else { m.w.x2 = s.x + dx; m.w.y2 = s.y + dy; } } };
    return { start, move: (p) => { apply(Math.round((p.x - p0.x) / GRID) * GRID, Math.round((p.y - p0.y) / GRID) * GRID); this._clampOpenings(); this.api.onLive('structure'); },
      done: (m) => m && this.api.onChange(), cancel: () => { apply(0, 0); this.api.onLive('structure'); } };
  }
  _clampOpenings() { for (const o of this.L.openings) { const w = this.L.walls.find((q) => q.id === o.wall); if (!w) continue; const L = wlen(w); o.w = Math.min(o.w, Math.max(200, L - 40)); o.t = Math.min(L - o.w / 2, Math.max(o.w / 2, o.t)); } }

  /* ---------- 그리기 ---------- */
  draw() {
    const g = this.g, L = this.L, pr = this.pr, W = this.cv.clientWidth, H = this.cv.clientHeight, sc = this.view.sc, st = this.api.style ? this.api.style() : 'real';
    const ink = '#1d2026', paper = st === 'comic' ? '#f2ecdf' : st === 'tycoon' ? '#eef6ea' : '#f7f8fa';
    g.setTransform(pr, 0, 0, pr, 0, 0); g.fillStyle = paper; g.fillRect(0, 0, W, H); if (!L) return;
    // 모눈: 100mm (가까울 때) / 1m
    const grid = (step, col) => { if (step * sc < 7) return; g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); const a = this.toMm(0, 0), b = this.toMm(W, H); for (let x = Math.floor(a.x / step) * step; x <= b.x; x += step) { const px = Math.round(this.toPx(x, 0).x) + 0.5; g.moveTo(px, 0); g.lineTo(px, H); } for (let y = Math.floor(a.y / step) * step; y <= b.y; y += step) { const py = Math.round(this.toPx(0, y).y) + 0.5; g.moveTo(0, py); g.lineTo(W, py); } g.stroke(); };
    grid(100, 'rgba(30,40,60,0.05)'); grid(1000, 'rgba(30,40,60,0.12)');
    g.save(); g.translate(-this.view.ox * sc, -this.view.oy * sc); g.scale(sc, sc); const px1 = 1 / sc;
    // 밑그림 (도면 사진 · 스캔을 깔고 따라 그리기)
    const bg = L.bg; if (bg && bg.src) { if (!this._bgImg || this._bgImg.src0 !== bg.src) { this._bgImg = new Image(); this._bgImg.src0 = bg.src; this._bgImg.onload = () => this.redraw(); this._bgImg.src = bg.src; }
      const im = this._bgImg; if (im.complete && im.naturalWidth) { g.globalAlpha = bg.opacity ?? 0.5; g.drawImage(im, bg.x || 0, bg.y || 0, bg.wmm, (bg.wmm * im.naturalHeight) / im.naturalWidth); g.globalAlpha = 1; } }
    // 공간 (태그 색)
    const poly = (pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
    for (const r of L.rooms) { if (r.pts.length < 3) continue; const sel = this.sel && this.sel.id === r.id; poly(r.pts); g.fillStyle = (KINDS[r.kind] || r.color || '#d9d2c4') + (sel ? '88' : '55'); g.fill();
      g.setLineDash([8 * px1, 5 * px1]); g.lineWidth = (sel ? 2.5 : 1.2) * px1; g.strokeStyle = sel ? '#2f7df6' : 'rgba(40,50,60,0.45)'; g.stroke(); g.setLineDash([]); }
    this._slopeOverlay(g, L, px1);
    // 기물
    const selId = this.sel && this.sel.id;
    for (const it of L.items) {
      const Lb = this.api.lib[it.type] || {}, col = it.color || Lb.color || '#b8bcc2', ceil = Lb.layer === 'ceil' || Lb.layer === 'ceiling';
      g.save(); g.translate(it.x, it.y); g.rotate((it.rot * Math.PI) / 180);
      g.fillStyle = ceil ? 'rgba(0,0,0,0)' : col + 'cc'; g.strokeStyle = it.id === selId ? '#2f7df6' : 'rgba(20,24,30,0.75)'; g.lineWidth = (it.id === selId ? 2.5 : 1) * px1;
      if (ceil) g.setLineDash([5 * px1, 4 * px1]);
      g.fillRect(-it.w / 2, -it.d / 2, it.w, it.d); g.strokeRect(-it.w / 2, -it.d / 2, it.w, it.d); g.setLineDash([]);
      g.beginPath(); g.moveTo(-it.w / 2, it.d / 2); g.lineTo(it.w / 2, it.d / 2); g.lineWidth = 2.2 * px1; g.stroke(); // 앞면 표시
      if (Math.min(it.w, it.d) * sc > 26) { g.fillStyle = 'rgba(15,18,22,0.85)'; g.font = `${Math.min(13, it.d * sc / 3) * px1}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center'; g.textBaseline = 'middle'; const name = it.name || Lb.name || ''; const max = it.w * 0.92; let s = name; while (s.length > 1 && g.measureText(s).width > max) s = s.slice(0, -1); g.fillText(s === name ? s : s + '…', 0, 0); }
      g.restore();
    }
    // 벽 (문/창 자리는 비우고)
    for (const w of L.walls) {
      const len = wlen(w); if (len < 1) continue; const ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, nx = -uy, ny = ux, t = w.t / 2;
      const ops = L.openings.filter((o) => o.wall === w.id).sort((a, b) => a.t - b.t); let u = 0; const segs = [];
      for (const o of ops) { const a = Math.max(0, o.t - o.w / 2), b = Math.min(len, o.t + o.w / 2); if (a > u) segs.push([u, a]); u = Math.max(u, b); } if (u < len) segs.push([u, len]);
      g.fillStyle = w.id === selId ? '#2f7df6' : ink;
      for (const [a, b] of segs) { const ea = a === 0 ? t : 0, eb = b === len ? t : 0, P = (s, k) => [w.x1 + ux * s + nx * k, w.y1 + uy * s + ny * k]; g.beginPath(); [P(a - ea, -t), P(b + eb, -t), P(b + eb, t), P(a - ea, t)].forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill(); }
      // 문/창 기호
      for (const o of ops) {
        const sel = o.id === selId, a = o.t - o.w / 2, b = o.t + o.w / 2, P = (s, k) => [w.x1 + ux * s + nx * k, w.y1 + uy * s + ny * k];
        g.strokeStyle = sel ? '#2f7df6' : ink; g.lineWidth = (sel ? 2.5 : 1.3) * px1; g.beginPath();
        if (o.type === 'door1' || o.type === 'door2') { // 문짝 + 여닫는 호
          const leaves = o.type === 'door2' ? [[a, 1], [b, -1]] : [[a, 1]], r = o.type === 'door2' ? o.w / 2 : o.w;
          for (const [h, s] of leaves) { const [hx, hy] = P(h, t), ang0 = Math.atan2(uy * s, ux * s), ang1 = Math.atan2(ny, nx); g.moveTo(hx, hy); g.lineTo(hx + nx * r, hy + ny * r); g.moveTo(hx + ux * s * r, hy + uy * s * r); g.arc(hx, hy, r, ang0, ang1, s < 0 ? true : false); }
        } else if (o.type === 'pass' || o.type === 'slidepass') { g.setLineDash([6 * px1, 4 * px1]); g.moveTo(...P(a, 0)); g.lineTo(...P(b, 0)); g.stroke(); g.setLineDash([]); g.beginPath(); g.moveTo(...P(a, -t)); g.lineTo(...P(a, t)); g.moveTo(...P(b, -t)); g.lineTo(...P(b, t)); }
        else if (o.type === 'arch') { g.moveTo(...P(a, -t)); g.lineTo(...P(a, t)); g.moveTo(...P(b, -t)); g.lineTo(...P(b, t)); }
        else { for (const k of [-t, -t / 3, t / 3, t]) { g.moveTo(...P(a, k)); g.lineTo(...P(b, k)); } g.moveTo(...P(a, -t)); g.lineTo(...P(a, t)); g.moveTo(...P(b, -t)); g.lineTo(...P(b, t)); }
        g.stroke();
      }
    }
    // 공간 이름표 (태그 · 단 · 구배)
    for (const r of L.rooms) { if (r.pts.length < 3) continue; const c = polyCenter(r.pts); g.save(); g.translate(c[0], c[1]); g.scale(px1, px1); g.textAlign = 'center'; g.textBaseline = 'middle';
      const t2 = [r.kind && r.kind !== r.name ? r.kind : '', r.lift ? `단 +${r.lift}` : '', slopeFrame(r) ? `구배 ${deg2pct(r.slope.deg)}% · 최고 +${roomTop(r)}mm` : ''].filter(Boolean).join(' · ');
      g.font = '700 13px system-ui'; g.fillStyle = 'rgba(20,26,34,0.85)'; g.fillText(r.name || '공간', 0, t2 ? -8 : 0); if (t2) { g.font = '11px system-ui'; g.fillStyle = '#1f6fb0'; g.fillText(t2, 0, 9); } g.restore(); }
    // 조정 필요(구배 · 단에 묻힌 기물) 주황 테두리
    for (const id of this.bad || []) { const it = L.items.find((q) => q.id === id); if (!it) continue; g.save(); g.translate(it.x, it.y); g.rotate((it.rot * Math.PI) / 180); g.strokeStyle = '#ff9f0a'; g.lineWidth = 3 * px1; g.setLineDash([6 * px1, 4 * px1]); g.strokeRect(-it.w / 2 - 30, -it.d / 2 - 30, it.w + 60, it.d + 60); g.restore(); }
    // 선택한 공간: 꼭짓점 손잡이
    const sr = this.sel && this.sel.kind === 'room' && L.rooms.find((r) => r.id === this.sel.id);
    if (sr) for (const [x, y] of sr.pts) { g.beginPath(); g.arc(x, y, 8 * px1, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5 * px1; g.strokeStyle = '#2f7df6'; g.stroke(); }
    // 공간 그리는 중
    if (this.rrect) { const [a, b] = this.rrect; g.fillStyle = 'rgba(47,125,246,0.15)'; g.strokeStyle = '#2f7df6'; g.lineWidth = 2 * px1; g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); g.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); }
    if (this.tool === 'roomPoly' && this.rpts && this.rpts.length) { const R2 = [...this.rpts, ...(this.hover ? [this.hover] : [])]; g.beginPath(); R2.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.strokeStyle = '#2f7df6'; g.lineWidth = 2.5 * px1; g.stroke(); for (const q of this.rpts) { g.beginPath(); g.arc(q.x, q.y, 6 * px1, 0, Math.PI * 2); g.fillStyle = '#2f7df6'; g.fill(); } }
    if (this.tool === 'pick' && this.hover) { g.beginPath(); g.arc(this.hover.x, this.hover.y, 10 * px1, 0, Math.PI * 2); g.strokeStyle = '#ff9f0a'; g.lineWidth = 3 * px1; g.stroke(); }
    // 공간만 보기: 바깥을 흐리게
    if (this.focus) { g.save(); g.beginPath(); const a = this.toMm(0, 0), b = this.toMm(W, H); g.rect(a.x, a.y, b.x - a.x, b.y - a.y); this.focus.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = 'rgba(247,248,250,0.72)'; g.fill('evenodd'); g.restore(); }
    // 선택한 벽: 끝점 손잡이 + 길이
    const sw = this.sel && this.sel.kind === 'wall' && L.walls.find((w) => w.id === this.sel.id);
    if (sw) { for (const [x, y] of [[sw.x1, sw.y1], [sw.x2, sw.y2]]) { g.beginPath(); g.arc(x, y, 9 * px1, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5 * px1; g.strokeStyle = '#2f7df6'; g.stroke(); } this._dim(sw.x1, sw.y1, sw.x2, sw.y2, sw.t); }
    // 벽 그리는 중: 미리보기 선 + 길이
    if (this.tool === 'wall') {
      const h = this.hover, c = this.dragFrom ? { last: this.dragFrom } : this.chain;
      if (c && h) { g.strokeStyle = 'rgba(47,125,246,0.55)'; g.lineWidth = (L.wallT || 150); g.lineCap = 'square'; g.beginPath(); g.moveTo(c.last.x, c.last.y); g.lineTo(h.x, h.y); g.stroke(); g.lineCap = 'butt'; this._dim(c.last.x, c.last.y, h.x, h.y, L.wallT || 150); }
      if (h) { g.beginPath(); g.arc(h.x, h.y, (h.snapped ? 8 : 5) * px1, 0, Math.PI * 2); g.fillStyle = h.snapped ? '#2f7df6' : '#1d2026'; g.fill(); }
    }
    g.restore();
    // 축척 막대
    const m = [100, 500, 1000, 2000, 5000, 10000].find((v) => v * sc > 70) || 10000, bx = W - 24 - m * sc, by = H - 22;
    g.fillStyle = ink; g.fillRect(bx, by, m * sc, 3); g.font = '12px system-ui'; g.textAlign = 'right'; g.fillText(m >= 1000 ? m / 1000 + 'm' : m + 'mm', W - 24, by - 6);
  }
  _dim(x1, y1, x2, y2, t) {
    const g = this.g, sc = this.view.sc, len = Math.hypot(x2 - x1, y2 - y1); if (len < 50) return; const ux = (x2 - x1) / len, uy = (y2 - y1) / len, off = t / 2 + 22 / sc;
    const mx = (x1 + x2) / 2 - uy * off, my = (y1 + y2) / 2 + ux * off; let ang = Math.atan2(uy, ux); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    g.save(); g.translate(mx, my); g.rotate(ang); g.scale(1 / sc, 1 / sc); g.font = '600 12px system-ui'; const s = Math.round(len).toLocaleString() + ' mm', w = g.measureText(s).width + 10;
    g.fillStyle = '#2f7df6'; g.beginPath(); g.roundRect(-w / 2, -10, w, 20, 6); g.fill(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 1); g.restore();
  }
}

/* 구배 표시: 물 흐름 화살표 · 꺾이는 골 · 배수구(D) — 기존 앱 v23 과 같은 그림 */
Plan2D.prototype._slopeOverlay = function (g, L, px1) {
  for (const r of L.rooms) {
    const F = slopeFrame(r); if (!F) continue; const n = [-F.e[1], F.e[0]], W = (u, v) => [F.c[0] + F.e[0] * u + n[0] * v, F.c[1] + F.e[1] * u + n[1] * v];
    g.save(); g.strokeStyle = 'rgba(31,111,176,.55)'; g.lineWidth = px1; g.setLineDash([4 * px1, 4 * px1]);
    for (const su of [-1, 1]) for (const sv of [-1, 1]) { let Ln = 0; const a = W(su * F.hl, 0); while (Ln < 40000) { const q = W(su * (F.hl + Ln + 100), sv * (Ln + 100)); if (!pointInPoly(q[0], q[1], r.pts)) break; Ln += 100; } if (Ln > 0) { const q = W(su * (F.hl + Ln), sv * Ln); g.beginPath(); g.moveTo(...a); g.lineTo(...q); g.stroke(); } }
    g.setLineDash([]); g.strokeStyle = '#2f8fd6'; g.fillStyle = '#2f8fd6'; g.lineWidth = 1.2 * px1;
    const xs = r.pts.map((p) => p[0]), ys = r.pts.map((p) => p[1]), b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], st = Math.max(500, Math.min(900, (b[2] - b[0] + b[3] - b[1]) / 12));
    for (let x = b[0] + st / 2; x < b[2]; x += st) for (let y = b[1] + st / 2; y < b[3]; y += st) {
      if (!pointInPoly(x, y, r.pts)) continue; const dx = x - F.c[0], dy = y - F.c[1], u = dx * F.e[0] + dy * F.e[1], v = -dx * F.e[1] + dy * F.e[0]; if (Math.max(Math.abs(v), Math.abs(u) - F.hl) < 250) continue;
      const dir = Math.abs(v) >= Math.abs(u) - F.hl ? n.map((z) => -Math.sign(v) * z) : F.e.map((z) => -Math.sign(u) * z), ex = x + dir[0] * 240, ey = y + dir[1] * 240, ah = 60;
      g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke(); g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - dir[0] * ah + dir[1] * ah * 0.6, ey - dir[1] * ah - dir[0] * ah * 0.6); g.lineTo(ex - dir[0] * ah - dir[1] * ah * 0.6, ey - dir[1] * ah + dir[0] * ah * 0.6); g.fill();
    }
    if (!F.hl) { g.fillStyle = '#1f6fb0'; g.beginPath(); g.arc(F.c[0], F.c[1], 8 * px1, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${10 * px1}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('D', F.c[0], F.c[1]); }
    else { g.strokeStyle = '#1f6fb0'; g.lineWidth = 5 * px1; g.beginPath(); g.moveTo(...W(-F.hl, 0)); g.lineTo(...W(F.hl, 0)); g.stroke(); }
    g.restore();
  }
};
