// 2D 도면: 벽 그리기 · 문/창 넣기 · 기물/벽/문 끌기 — 손을 떼기 전부터 3D 에 바로 반영된다.
// 좌표는 모델과 같은 mm, 도면 y 는 아래로 (3D 의 z).
import { OPDEF } from './cloud.js';

const GRID = 50, SNAP_PX = 14, HIT_PX = 12;
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const wlen = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
const OP_LABEL = { door1: '외문', door2: '양문', auto: '자동문', slide: '미닫이', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', arch: '아치' };
export const TOOLS = { select: '고르기 · 끌기', wall: '벽 그리기', door1: '문', window: '창', pass: '배식구', erase: '지우기' };

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
  setTool(t) { this.tool = t; this.chain = null; this.cv.style.cursor = t === 'select' ? 'default' : 'crosshair'; this.redraw(); }
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
  pickAt(p) {
    const o = this.hitOpening(p); if (o) return { kind: 'opening', id: o.id };
    const it = this.hitItem(p); if (it) return { kind: 'item', id: it.id };
    const w = this.hitWall(p); if (w) return { kind: 'wall', id: w.w.id };
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
      if (this.tool !== 'select') { act = { tap: true, start }; return; }
      // 고르기: 벽 끝점 → 문/창 → 기물 → 벽 → 빈 곳(화면 이동)
      const end = this.sel && this.sel.kind === 'wall' ? this.hitEnd(p) : null;
      if (end) { const mates = this.ends().filter((q) => Math.hypot(q.x - end.x, q.y - end.y) < 1); act = this._dragEnds(mates, start); return; }
      const hit = this.pickAt(p);
      if (!hit) { act = { pan: true, start, last: start, tapEmpty: true }; return; }
      if (!this.sel || this.sel.id !== hit.id) this.select(hit);
      if (hit.kind === 'item') act = this._dragItem(this.L.items.find((i) => i.id === hit.id), p, start);
      else if (hit.kind === 'opening') act = this._dragOpening(this.L.openings.find((o) => o.id === hit.id), start);
      else act = this._dragWall(this.L.walls.find((w) => w.id === hit.id), p, start);
    });
    cv.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, r = cv.getBoundingClientRect(); this.view.ox -= (cx - pinch.cx) / this.view.sc; this.view.oy -= (cy - pinch.cy) / this.view.sc; this.zoomAt(cx - r.left, cy - r.top, d / pinch.d); pinch = { d, cx, cy }; return; }
      const p = this.evMm(e);
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
      if (a.tap && !a.moved) { if (OPDEF[this.tool]) this.addOpening(this.tool, p); if (this.tool === 'erase') this.erase(this.pickAt(p)); return; }
      if (a.pan) { if (a.tapEmpty && !a.moved) this.select(null); return; }
      if (a.done) a.done(a.moved);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { if (act && act.cancel) act.cancel(); act = null; up(e); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.chain) { this.chain = null; this.redraw(); } });
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
    // 공간
    for (const r of L.rooms) { if (r.pts.length < 3) continue; g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fillStyle = (r.color || '#d9d2c4') + '55'; g.fill(); }
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
