// 기존 앱(BYR / 3D RENDER, HTML·Vanilla JS 버전) 작업물 → 새 앱 모델 변환
//
// 받을 수 있는 입력
//   1) 기존 앱 "내보내기 → JSON" 파일 (프로젝트 객체 그대로)
//   2) Supabase projects 테이블 응답: { id, name, data: {...} } 또는 그 배열
//   3) 여러 프로젝트 묶음: { projects: [...] }
//
// 기존 좌표계: 평면 (x, y) mm, y 는 화면 아래 방향 · 높이는 바닥에서 mm · 회전은 도(시계 방향)
// 새 모델도 같은 mm 값을 그대로 보관하고, Three.js 로 옮길 때만 m 로 바꾼다 (builder.js).

export const FORMAT = 'byr-next';
export const VERSION = 2; // 2: 단(lift) 높이를 기물 elev 에 넣지 않고 그릴 때 더한다 · 구배 · 배경 · 밑그림

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const LEVEL_KEYS = ['walls', 'openings', 'items', 'rooms', 'ceilingH', 'slabH', 'soffitH', 'floor', 'bg', 'ceiling'];
const OPDEF = { slidepass: [900, 600, 900], slide: [1800, 2100, 0], pass: [900, 600, 900], arch: [1200, 2400, 0], door1: [900, 2100, 0], door2: [1600, 2300, 0], auto: [1800, 2300, 0], window: [1800, 1500, 900], full: [2400, 2400, 0] };

/** 파일 내용(JSON 값)에서 기존 프로젝트들을 찾아낸다 */
export function findLegacyProjects(json) {
  const out = [];
  const visit = (v, hint) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach((x) => visit(x, hint)); return; }
    if (v.format === FORMAT) return; // 새 형식은 여기서 다루지 않음
    if (Array.isArray(v.walls) && Array.isArray(v.items)) { out.push({ ...v, name: v.name || hint || '이름 없는 프로젝트' }); return; }
    if (v.data) visit(typeof v.data === 'string' ? safeParse(v.data) : v.data, v.name || hint); // Supabase 행
    if (v.projects) visit(v.projects, hint);
  };
  visit(json);
  return out;
}
const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
export const isNextProject = (json) => !!json && json.format === FORMAT && Array.isArray(json.levels);

function pointInPoly(x, y, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const polyArea = (p) => Math.abs(p.reduce((s, q, i) => { const n = p[(i + 1) % p.length]; return s + q[0] * n[1] - n[0] * q[1]; }, 0) / 2);

/** 기존 프로젝트 하나 → 새 모델. lib = legacy-lib.json 의 items */
export function convertLegacy(P, lib) {
  const report = { name: P.name, levels: 0, walls: 0, openings: 0, items: 0, rooms: 0, lights: 0, unknown: [], skipped: [], notes: [] };
  const base = { ceilingH: num(P.ceilingH, 2700), slabH: num(P.slabH, 3300), wallT: num(P.wallT, 150) };

  // 층: 지금 보고 있던 층은 프로젝트에 바로 들어 있고, 나머지 층은 levels[].data 에 있다
  const srcLevels = Array.isArray(P.levels) && P.levels.length ? P.levels : [{ id: 'L1', name: '1층', elev: 0 }];
  const levels = srcLevels.map((L) => {
    const cur = L.id === P.levelId || !L.data;
    const D = cur ? P : L.data;
    const pick = Object.fromEntries(LEVEL_KEYS.map((k) => [k, D[k]]));
    return convertLevel({ id: L.id || uid('L'), name: L.name || '층', elev: num(L.elev) }, pick, base, lib, report);
  });
  report.levels = levels.length;
  if ((P.walls || []).some((w) => w.form)) report.notes.push('모양을 바꾼 벽(벽 디자인 수정)은 곧은 벽으로 불러왔어요');

  return {
    model: { format: FORMAT, version: VERSION, id: uid('p'), name: P.name || '이름 없는 프로젝트', env: P.env ? { ...P.env } : undefined, source: { app: 'byr-legacy', id: P.id || null, importedAt: new Date().toISOString() }, wallT: base.wallT, levels, activeLevel: Math.max(0, srcLevels.findIndex((l) => l.id === P.levelId)) },
    report,
  };
}

function convertLevel(meta, D, base, lib, report) {
  const ceilingH = num(D.ceilingH, base.ceilingH), slabH = num(D.slabH, base.slabH);
  const walls = (D.walls || []).filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 1).map((w) => ({
    id: w.id || uid('w'), x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2),
    t: num(w.t, base.wallT), h: num(w.h, ceilingH), color: (w.finish && w.finish.color) || '#ece8e1', finish: (w.finish && w.finish.type) || 'paint',
  }));
  const wallIds = new Set(walls.map((w) => w.id));
  const openings = (D.openings || []).filter((o) => wallIds.has(o.wall)).map((o) => {
    const d = OPDEF[o.type] || OPDEF.door1;
    return { id: o.id || uid('o'), wall: o.wall, type: o.type || 'door1', t: num(o.t), w: num(o.w, d[0]), h: num(o.h, d[1]), sill: num(o.sill, d[2]), frost: o.frost && o.frost.on ? { b: num(o.frost.b), t: num(o.frost.t), a: num(o.frost.a, 0.82) } : null };
  });
  const rooms = (D.rooms || []).filter((r) => Array.isArray(r.pts) && r.pts.length >= 3).map((r) => ({
    id: r.id || uid('r'), name: r.name || r.kind || '공간', kind: r.kind || '기타', pts: r.pts.map((p) => [num(p[0]), num(p[1])]),
    lift: num(r.lift), color: (r.finish && r.finish.color) || '#c9c3b8', finish: (r.finish && r.finish.type) || 'tile',
    slope: r.slope && r.slope.deg && Array.isArray(r.slope.drain) ? { deg: num(r.slope.deg), drain: r.slope.drain.map(num), ...(Array.isArray(r.slope.drain2) ? { drain2: r.slope.drain2.map(num) } : {}), ...(r.slope.item ? { item: r.slope.item } : {}) } : null,
  }));
  const _liftAt = (x, y) => { let best = null; for (const r of rooms) if (pointInPoly(x, y, r.pts)) { const a = polyArea(r.pts); if (!best || a < best.a) best = { a, r }; } return best ? best.r.lift : 0; };

  const items = [];
  for (const it of D.items || []) {
    if (it.hidden) continue;
    const L = lib[it.type];
    const shape = L ? L.shape : it.parts ? 'parts' : null;
    if (shape === 'zone' || it.pz === 'sheet' || it.type === 'winsheet' || it.win) { report.skipped.push((L && L.name) || it.tag || it.type); continue; } // 바닥 표시 · 시트지
    if (shape === 'mesh') { report.skipped.push(`${it.tag || (L && L.name) || '3D 모델'} (기존 앱에 올린 모델은 파일을 다시 가져와 주세요)`); continue; }
    if (!L && !it.parts) report.unknown.push(it.tag || it.type);
    const layer = it.layer || (L && L.layer) || 'floor';
    const h = num(it.h, L ? L.h : 900);
    // 높이: 기존 앱 zOf() 와 같은 규칙
    let elev;
    if (it.elev != null) elev = num(it.elev);
    else if (L && L.elev != null) elev = L.elev;
    else if (layer === 'ceil') elev = ceilingH - h;
    else if (layer === 'ceiling') elev = slabH - h;
    else elev = 0;
    const light = L && L.light ? defaultLight(L) : null;
    if (light) report.lights++;
    items.push({
      id: it.id || uid('i'), type: it.type, name: it.tag || (L && L.name) || it.type, x: num(it.x), y: num(it.y), elev, rot: num(it.rot),
      w: num(it.w, L ? L.w : 600), d: num(it.d, L ? L.d : 600), h, color: it.color || null, mat: it.mat || null,
      parts: Array.isArray(it.parts) ? packParts(it.parts) : null, pb: it.pb || null, light, kw: num(it.kw ?? (L && L.kw)), ...(it.onSlope ? { onSlope: true } : {}),
    });
  }
  report.walls += walls.length; report.openings += openings.length; report.rooms += rooms.length; report.items += items.length;
  const bg = D.bg && D.bg.src ? { src: D.bg.src, wmm: num(D.bg.wmm, 10000), x: num(D.bg.x), y: num(D.bg.y), opacity: num(D.bg.opacity, 0.5) } : null;
  const ceiling = D.ceiling && typeof D.ceiling === 'object' ? { on: D.ceiling.on !== false, color: D.ceiling.color || '#f3f1ec', opacity: num(D.ceiling.opacity, 1) } : { on: true };
  return { ...meta, ceilingH, bg, ceiling, soffitH: num(D.soffitH, 2400), slabH, floor: { color: (D.floor && D.floor.color) || '#c9c3b8', finish: (D.floor && D.floor.type) || 'epoxy' }, walls, openings, rooms, items };
}

/** 조명 · 열 기물의 기본 광원 */
export function defaultLight(L) {
  const hot = /fryer|range/.test(L.shape);
  return hot ? { on: true, kind: 'point', color: '#ffb46b', power: 0.6 } : { on: true, kind: L.layer === 'floor' ? 'point' : 'spot', color: '#ffe2bd', power: 1 };
}

/** 기존 "디자인 수정" 부품 → legacy-shapes.json 과 같은 묶음 형식 */
function packParts(parts) {
  return parts.filter((q) => !q.hide).map((q) => (q.k === 'pr' ? { n: q.n, v: q.v.flat(), c: q.c, m: q.m || 'plain', a: q.a } : { f: (q.f || []).map((f) => f.flat()), c: q.c, m: q.m || 'plain', a: q.a }));
}

/** 빈 프로젝트 */
export function emptyProject(name = '새 프로젝트', W = 8000, D = 6000) {
  const pts = [[0, 0], [W, 0], [W, D], [0, D]];
  return {
    format: FORMAT, version: VERSION, id: uid('p'), name, wallT: 150, activeLevel: 0,
    levels: [{ id: 'L1', name: '1층', elev: 0, ceilingH: 2700, slabH: 3300, soffitH: 2400, ceiling: { on: true }, dims: [], soffits: [], floor: { color: '#c9c3b8', finish: 'tile' }, rooms: [], openings: [], items: [],
      walls: pts.map((p, i) => { const q = pts[(i + 1) % 4]; return { id: uid('w'), x1: p[0], y1: p[1], x2: q[0], y2: q[1], t: 150, h: 2700, color: '#ece8e1', finish: 'paint' }; }) }],
  };
}

/** 변환 결과를 사람이 읽을 한 줄로 */
export function reportText(r) {
  const s = [`"${r.name}" 불러옴: 벽 ${r.walls} · 문/창 ${r.openings} · 공간 ${r.rooms} · 기물 ${r.items}${r.levels > 1 ? ` · ${r.levels}개 층` : ''}`];
  if (r.unknown.length) s.push(`모양을 모르는 기물 ${r.unknown.length}개는 상자로 표시 (${[...new Set(r.unknown)].slice(0, 3).join(', ')})`);
  if (r.skipped.length) s.push(`건너뜀 ${r.skipped.length}개 (${[...new Set(r.skipped)].slice(0, 2).join(', ')})`);
  return s.concat(r.notes).join(' · ');
}

/** 예전 BYR Next(형식 1) 프로젝트 → 형식 2: 단 높이를 기물 elev 에서 빼서 그릴 때 더하도록 */
export function migrate(model, lib) {
  if ((model.version || 1) >= 2) return model;
  for (const L of model.levels) for (const it of L.items) {
    const Lb = lib[it.type]; if (Lb && Lb.layer && !['floor', 'deco', 'plumb'].includes(Lb.layer)) continue;
    let best = null; for (const r of L.rooms || []) if (r.lift && pointInPoly(it.x, it.y, r.pts)) { const a = polyArea(r.pts); if (!best || a < best.a) best = { a, r }; }
    if (best && it.elev >= best.r.lift - 1) it.elev = Math.round(it.elev - best.r.lift);
  }
  model.version = 2; return model;
}
