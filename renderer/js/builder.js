// 모델(mm) → Three.js 객체(m). 벽 · 문/창 · 바닥 · 기물을 만든다.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, floorMaterial, MAT_TEX } from './materials.js';
import { slopeFrame, slopePieces, slopeH, pointInPoly } from './slope.js';

export const MM = 0.001;
/** 텍스처 입히기: tex = { img(dataURL), size(mm, 한 장 크기 · 바닥용), rot } → 반복되는 PBR 재질 */
const texMats = new Map();
export function texMaterial(tex, rep = 1) {
  if (!tex || !tex.img) return null; const k = tex.img.length + ':' + tex.img.slice(-64) + ':' + rep.toFixed(4); if (texMats.has(k)) return texMats.get(k);
  const t = new THREE.TextureLoader().load(tex.img); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: tex.rough ?? 0.7, metalness: 0 }); texMats.set(k, m); return m;
}
const FRAME = '#2b2d31';

/* ---------- 부품(각기둥 · 면 묶음) → 지오메트리 ---------- */
// 삼각형 위치 배열(m)에 평면 법선 · 상자 투영 UV 를 붙인다
function finishGeometry(pos, smooth) {
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (smooth) { g = mergeVertices(g, 1e-4); g.computeVertexNormals(); g = g.toNonIndexed(); } else g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) { // 면이 향한 축에 따라 나머지 두 축을 UV 로
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    for (let k = 0; k < 3; k++) { const x = p.getX(i + k), y = p.getY(i + k), z = p.getZ(i + k); const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y]; uv[(i + k) * 2] = u; uv[(i + k) * 2 + 1] = v; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// 한 면(점 3개 이상)을 바깥을 향하게 삼각형으로 쪼개 넣는다
function pushFace(out, pts, center) {
  if (pts.length < 3) return;
  const a = pts[0], b = pts[1], c = pts[pts.length - 1];
  const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let fx = 0, fy = 0, fz = 0; for (const q of pts) { fx += q[0]; fy += q[1]; fz += q[2]; } fx /= pts.length; fy /= pts.length; fz /= pts.length;
  const flip = nx * (fx - center[0]) + ny * (fy - center[1]) + nz * (fz - center[2]) < 0;
  const P = flip ? pts.slice().reverse() : pts;
  for (let i = 1; i + 1 < P.length; i++) { if (samePt(P[i], P[i + 1]) || samePt(P[0], P[i])) continue; out.push(...P[0], ...P[i], ...P[i + 1]); }
}
const samePt = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-7;

/** 부품 목록 → 재질별로 합친 메시들. scale = [sx, sy, sz], recolor = (부품) → { color, tex } */
export function partsToMeshes(parts, scale, recolor) {
  const [sx, sy, sz] = scale, groups = new Map();
  for (const part of parts) {
    const flat = part.v || part.f.flat(), pts = [];
    for (let i = 0; i < flat.length; i += 3) pts.push([flat[i] * sx * MM, flat[i + 1] * sy * MM, flat[i + 2] * sz * MM]);
    const cen = [0, 1, 2].map((k) => pts.reduce((s, q) => s + q[k], 0) / (pts.length || 1)), tri = [];
    let smooth = false;
    if (part.v) { // 각기둥: 아래 고리 n개 + 위 고리 n개
      const n = part.n;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; pushFace(tri, [pts[i], pts[j], pts[n + j], pts[n + i]], cen); }
      pushFace(tri, pts.slice(n, 2 * n), cen); pushFace(tri, pts.slice(0, n), cen);
    } else { // 면 묶음 (구 · 곡면)
      let k = 0; for (const f of part.f) { const m = f.length / 3; pushFace(tri, pts.slice(k, k + m), cen); k += m; }
      smooth = part.f.length >= 40;
    }
    if (!tri.length) continue;
    const { color, tex } = recolor(part), key = `${tex}|${color}|${part.a ?? ''}|${smooth ? 1 : 0}`;
    if (!groups.has(key)) groups.set(key, { tex, color, a: part.a, smooth, geos: [] });
    groups.get(key).geos.push(finishGeometry(tri, smooth));
  }
  const meshes = [];
  for (const g of groups.values()) {
    const geo = g.geos.length > 1 ? mergeGeometries(g.geos) : g.geos[0];
    const mesh = new THREE.Mesh(geo, material(g.tex, g.color, g.a));
    mesh.castShadow = !(g.a != null && g.a < 1); mesh.receiveShadow = true; meshes.push(mesh);
  }
  return meshes;
}

/* ---------- 기물 ---------- */
/** 기물 하나 → Group. ctx = { lib, shapes, assets(Map) } */
export function buildItem(it, ctx) {
  const g = new THREE.Group(); g.name = it.name || it.type; g.userData.itemId = it.id;
  const L = ctx.lib[it.type], parts = it.parts || ctx.shapes[it.type];
  if (it.asset && ctx.assets.has(it.asset.key)) { // 가져온 외부 3D 에셋
    const a = ctx.assets.get(it.asset.key), o = a.object.clone(true);
    o.scale.set((it.w * MM) / a.size.x, (it.h * MM) / a.size.y, (it.d * MM) / a.size.z); g.add(o);
  } else if (parts && parts.length) {
    const pb = it.pb || (L ? { w: L.w, d: L.d, h: L.h } : { w: it.w, d: it.d, h: it.h });
    const baseColor = L ? L.color : null, baseTex = L ? MAT_TEX[L.mat] || 'plain' : null, newTex = it.mat ? MAT_TEX[it.mat] || 'plain' : null;
    const recolor = (p) => { // 기존 앱 규칙: 기물 기본 색으로 그린 부품만 사용자가 고른 색 · 재질로 바뀐다
      if (p.own) return { color: p.c || '#b8bcc2', tex: MAT_TEX[p.m] || p.m || 'plain' }; // 디자인 수정에서 부품마다 따로 고른 색 · 재질
      const main = !!baseColor && typeof p.c === 'string' && p.c.toLowerCase() === baseColor.toLowerCase();
      return { color: main && it.color ? it.color : p.c || '#b8bcc2', tex: main && newTex ? newTex : p.m === baseTex && newTex && main ? newTex : p.m || 'plain' };
    };
    for (const m of partsToMeshes(parts, [it.w / (pb.w || it.w), it.h / (pb.h || it.h), it.d / (pb.d || it.d)], recolor)) g.add(m);
  } else { // 모양 정보가 없으면 크기만 맞춘 상자
    const m = new THREE.Mesh(new THREE.BoxGeometry(it.w * MM, it.h * MM, it.d * MM), material(MAT_TEX[it.mat] || 'plain', it.color || '#b8bcc2'));
    m.position.y = (it.h * MM) / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  }
  if (it.tex && it.tex.img) { const tm = texMaterial(it.tex, it.tex.rep || 1); g.traverse((o) => { if (o.isMesh && (!it.tex.main || !o.userData.own)) o.material = tm; }); } /* 텍스처 입히기 */
  if (it.light && it.light.on) g.add(...makeLight(it));
  placeItem(g, it, ctx.zOf ? ctx.zOf(it) : it.elev);
  return g;
}
export function placeItem(g, it, z = it.elev) { g.position.set(it.x * MM, z * MM, it.y * MM); g.rotation.y = (-it.rot * Math.PI) / 180; }

// 조명 기물의 광원: 전등은 아래로 비추는 SpotLight, 튀김기 · 레인지 · 스탠드는 PointLight
function makeLight(it) {
  const c = new THREE.Color(it.light.color || '#ffe2bd'), pw = it.light.power ?? 1, h = it.h * MM;
  if (it.light.kind === 'spot') {
    const s = new THREE.SpotLight(c, 7 * pw, 6, 1.0, 0.75, 1.7); s.position.set(0, -0.02, 0); s.target.position.set(0, -3, 0); s.userData.itemLight = true;
    return [s, s.target];
  }
  const p = new THREE.PointLight(c, 1.4 * pw, 3, 1.8); p.position.set(0, h + 0.18, 0); p.userData.itemLight = true;
  return [p];
}

/* ---------- 벽 · 문/창 ---------- */
function boxAt(x0, x1, y0, y1, z0, z1) { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; }
function meshOf(geos, mat, shadow = true) { const m = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], mat); m.castShadow = shadow; m.receiveShadow = true; return m; }

export function buildWalls(level) {
  const root = new THREE.Group(); root.name = '벽';
  const ends = level.walls.flatMap((w) => [[w.x1, w.y1, w], [w.x2, w.y2, w]]);
  const corner = (x, y, w) => ends.some(([ex, ey, o]) => o !== w && Math.hypot(ex - x, ey - y) < 8 && Math.abs((o.x2 - o.x1) * (w.y2 - w.y1) - (o.y2 - o.y1) * (w.x2 - w.x1)) > 1);
  for (const w of level.walls) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), t = w.t * MM, H = w.h * MM, L = len * MM;
    // 다른 벽과 꺾여 만나는 끝은 두께 절반만큼 늘려 모서리를 채운다
    const e0 = corner(w.x1, w.y1, w) ? t / 2 : 0, e1 = corner(w.x2, w.y2, w) ? t / 2 : 0;
    const ops = level.openings.filter((o) => o.wall === w.id).map((o) => ({ o, a: Math.max(0, o.t - o.w / 2) * MM, b: Math.min(len, o.t + o.w / 2) * MM, y0: Math.max(0, o.sill) * MM, y1: Math.min(w.h, o.sill + o.h) * MM })).filter((q) => q.b - q.a > 0.02).sort((p, q) => p.a - q.a);
    const solid = [], frost = [], FR = new Map(), LF = new Map(), GL = new Map(), ST = new Map(), put = (M, k, v) => { if (!M.has(k)) M.set(k, []); M.get(k).push(v); }; /* 색마다 묶기 (배식구 · 통창 디자인 상세) */
    let u = -e0;
    for (const q of ops) {
      if (q.a > u + 1e-4) solid.push(boxAt(u, q.a, 0, H, -t / 2, t / 2));
      if (q.y0 > 0.001) solid.push(boxAt(q.a, q.b, 0, q.y0, -t / 2, t / 2));
      if (q.y1 < H - 0.001) solid.push(boxAt(q.a, q.b, q.y1, H, -t / 2, t / 2));
      const o = q.o, f = (o.fw ?? 50) * MM, ty = o.type, fc = o.frame || FRAME, frame = { push: (...b) => b.forEach((x) => put(FR, fc, x)) }, glass = { push: (...b) => b.forEach((x) => put(GL, o.tint || '#bfe3f2', x)) }, leaf = { push: (...b) => b.forEach((x) => put(LF, o.leaf || '#d9d4ca', x)) }, steel = { push: (...b) => b.forEach((x) => put(ST, o.shelfColor || '#c9ced4', x)) };
      if ((ty !== 'arch' && ty !== 'pass') || o.pframe) { // 틀
        frame.push(boxAt(q.a, q.a + f, q.y0, q.y1, -t / 2 - 0.01, t / 2 + 0.01), boxAt(q.b - f, q.b, q.y0, q.y1, -t / 2 - 0.01, t / 2 + 0.01), boxAt(q.a, q.b, q.y1 - f, q.y1, -t / 2 - 0.01, t / 2 + 0.01));
        if (q.y0 > 0.001) frame.push(boxAt(q.a, q.b, q.y0, q.y0 + f, -t / 2 - 0.01, t / 2 + 0.01));
      }
      const gx0 = q.a + f, gx1 = q.b - f, gy0 = q.y0 + (q.y0 > 0.001 ? f : 0), gy1 = q.y1 - f;
      if (['window', 'full', 'auto', 'slide', 'slidepass'].includes(ty)) {
        const fr = q.o.frost;
        if (fr) { const a = THREE.MathUtils.clamp(fr.b * MM, gy0, gy1), b = THREE.MathUtils.clamp(fr.t * MM, gy0, gy1);
          if (a > gy0) glass.push(boxAt(gx0, gx1, gy0, a, -0.006, 0.006)); if (b < gy1) glass.push(boxAt(gx0, gx1, b, gy1, -0.006, 0.006)); if (b > a) frost.push(boxAt(gx0, gx1, a, b, -0.007, 0.007)); }
        else glass.push(boxAt(gx0, gx1, gy0, gy1, -0.006, 0.006));
        if (ty === 'auto' || ty === 'slide') frame.push(boxAt((gx0 + gx1) / 2 - 0.02, (gx0 + gx1) / 2 + 0.02, gy0, gy1, -0.02, 0.02));
        const nd = Math.max(1, Math.round(o.div || 1)), mw = Math.max(0.02, f * 0.7); for (let k = 1; k < nd; k++) { const x = gx0 + ((gx1 - gx0) * k) / nd; frame.push(boxAt(x - mw / 2, x + mw / 2, gy0, gy1, -0.025, 0.025)); } /* 통창 세로 나눔 */
        if (o.hdiv && o.hdiv > 0) { const y = Math.min(gy1 - 0.05, q.y0 + o.hdiv * MM); if (y > gy0 + 0.05) frame.push(boxAt(gx0, gx1, y - mw / 2, y + mw / 2, -0.025, 0.025)); } /* 가로 띠 (欄間) */
      }
      if (ty === 'door1') leaf.push(boxAt(gx0, gx1, gy0, gy1, -0.02, 0.02));
      if (ty === 'door2') leaf.push(boxAt(gx0, (gx0 + gx1) / 2 - 0.004, gy0, gy1, -0.02, 0.02), boxAt((gx0 + gx1) / 2 + 0.004, gx1, gy0, gy1, -0.02, 0.02));
      if ((ty === 'pass' || ty === 'slidepass') && o.shelf !== 0) { const sd = (o.shelf ?? 180) * MM, sa = o.shelfSide || 'both'; steel.push(boxAt(q.a - 0.03, q.b + 0.03, q.y0 - (o.shelfT ?? 30) * MM, q.y0, sa === 'b' ? -t / 2 : -t / 2 - sd, sa === 'a' ? t / 2 : t / 2 + sd)); } // 배식 선반 (깊이 · 쪽 · 두께 · 색)
      u = q.b;
    }
    if (L + e1 > u + 1e-4) solid.push(boxAt(u, L + e1, 0, H, -t / 2, t / 2));
    const g = new THREE.Group(); g.name = '벽'; g.userData.wallId = w.id;
    g.position.set(w.x1 * MM, 0, w.y1 * MM); g.rotation.y = -Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
    if (solid.length) { const tex = MAT_TEX[w.finish] || 'plain', glass = tex === 'glass'; g.add(meshOf(solid, glass ? material('glass', w.color || '#bfe3f2', 0.35) : material(tex, w.color), !glass)); } // 마감: 페인트 · 타일 · 목재 · 콘크리트 · 유리(반투명)
    for (const [c, b] of FR) g.add(meshOf(b, material('plastic', c)));
    for (const [c, b] of LF) g.add(meshOf(b, material('plain', c)));
    for (const [c, b] of ST) g.add(meshOf(b, material('steel', c)));
    for (const [c, b] of GL) g.add(meshOf(b, material('glass', c), false));
    if (frost.length) g.add(meshOf(frost, material('frost', '#eef2f4'), false));
    if (w.form && w.form.o && w.form.o.some((q) => q[0] || q[1] || q[2])) deformWall(g, w, len, w.h, w.t / 2); // 벽 디자인 수정 (8 모서리 끌기)
    addSheet(g, w, len, ops); // 시트지 · 벽 그림
    root.add(g);
  }
  return root;
}

/* ---------- 바닥 ---------- */
export function levelBounds(level) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
  level.walls.forEach((w) => { add(w.x1, w.y1); add(w.x2, w.y2); }); level.items.forEach((i) => add(i.x, i.y)); level.rooms.forEach((r) => r.pts.forEach((p) => add(p[0], p[1])));
  return Number.isFinite(b[0]) ? b : [0, 0, 8000, 6000];
}
export function buildFloors(level) {
  const root = new THREE.Group(); root.name = '바닥';
  const b = levelBounds(level), pad = 80;
  // 기본 바닥판 (벽 바깥 테두리까지)
  const slab = new THREE.Mesh(boxAt((b[0] - pad) * MM, (b[2] + pad) * MM, -0.12, 0, (b[1] - pad) * MM, (b[3] + pad) * MM), floorMaterial(level.floor.finish, level.floor.color));
  { const p = slab.geometry.attributes.position, uv = slab.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i)); } // 타일이 실제 크기로 깔리도록 좌표를 UV 로
  slab.receiveShadow = true; slab.name = '바닥판'; root.add(slab);
  // 공간별 바닥 (마감 · 단 높이)
  for (const r of level.rooms) {
    if (slopeFrame(r)) { root.add(slopedRoom(r)); continue; }
    const shape = new THREE.Shape(r.pts.map((p) => new THREE.Vector2(p[0] * MM, -p[1] * MM)));
    for (const c of level.rooms) if (c !== r && c.pts.length > 2 && c.pts.every((p) => pointInPoly(p[0], p[1], r.pts)) && !r.pts.every((p) => pointInPoly(p[0], p[1], c.pts))) shape.holes.push(new THREE.Path(c.pts.map((p) => new THREE.Vector2(p[0] * MM, -p[1] * MM)))); /* 안쪽에 떼어 낸 공간은 구멍으로 (겹쳐 깜빡이지 않게) */
    const depth = Math.max(0.004, r.lift * MM + 0.004);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, texMaterial(r.tex, 1000 / ((r.tex && r.tex.size) || 600)) || floorMaterial(r.finish, r.color)); m.receiveShadow = true; m.castShadow = r.lift > 20; m.name = r.name; m.userData.roomId = r.id; root.add(m);
  }
  return root;
}

/** 구배 바닥: 평면 조각마다 위에서 투영한 UV(월드 좌표)라 타일 · 패턴이 끊기지 않고 그대로 이어진다 */
function slopedRoom(r) {
  const tri = (pts) => THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const lift = r.lift || 0, base = 4, pos = [], uv = [];
  for (const pc of slopePieces(r, tri)) {
    const P = (q) => [q[0] * MM, (lift + base + pc.h(q[0], q[1])) * MM, q[1] * MM];
    for (let k = 1; k + 1 < pc.pts.length; k++) {
      let a = pc.pts[0], b = pc.pts[k], c = pc.pts[k + 1];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0) [b, c] = [c, b]; // 위를 보게 (도면 y 가 아래라 반대)
      for (const q of [a, b, c]) { pos.push(...P(q)); uv.push(q[0] * MM, q[1] * MM); }
    }
  }
  // 단이 있으면 옆면(테두리)도 구배를 따라
  if (lift > 0) for (let k = 0, j = r.pts.length - 1; k < r.pts.length; j = k++) {
    const a = r.pts[j], b = r.pts[k], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, n = Math.max(1, Math.ceil(L / 200));
    for (let q = 0; q < n; q++) { const p0 = [a[0] + (dx * q) / n, a[1] + (dz * q) / n], p1 = [a[0] + (dx * (q + 1)) / n, a[1] + (dz * (q + 1)) / n];
      const v = [[p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], lift + base + slopeH(r, ...p1), p1[1]], [p0[0], lift + base + slopeH(r, ...p0), p0[1]]].map((t) => [t[0] * MM, t[1] * MM, t[2] * MM]);
      for (const i of [0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3]) { pos.push(...v[i]); uv.push(v[i][0] + v[i][2], v[i][1]); } }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, texMaterial(r.tex, 1000 / ((r.tex && r.tex.size) || 600)) || floorMaterial(r.finish, r.color)); m.receiveShadow = true; m.name = r.name; m.userData.roomId = r.id; return m;
}

/** 천장: 공간(방)마다 · 공간이 없으면 벽 테두리 전체. 아래를 보는 면만 그려서 위에서 내려다보면 투명하게 보인다 */
export function buildCeiling(level) {
  const root = new THREE.Group(); root.name = '천장'; const C = level.ceiling || {}; root.visible = C.on !== false;
  const H = level.ceilingH || 2700, mat = new THREE.MeshStandardMaterial({ color: C.color || '#f3f1ec', roughness: 0.92, metalness: 0, transparent: (C.opacity ?? 1) < 1, opacity: C.opacity ?? 1 });
  const polys = (level.rooms || []).filter((r) => r.pts && r.pts.length >= 3).map((r) => ({ pts: r.pts, h: r.ceilH || H }));
  if (!polys.length) { const b = levelBounds(level); polys.push({ pts: [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], h: H }); }
  for (const P of polys) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(P.pts.map((p) => new THREE.Vector2(p[0] * MM, p[1] * MM)))); g.rotateX(Math.PI / 2);
    const n = g.attributes.normal; let flip = false; g.computeVertexNormals(); if (n && g.attributes.normal.getY(0) > 0) flip = true; // 아래를 보게
    if (flip) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; } g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, mat); m.position.y = P.h * MM; m.receiveShadow = true; m.castShadow = false; m.name = '천장판'; root.add(m);
  }
  // 천장 가벽(단 내림): level.soffits = [{ pts, h(내려온 아래면 높이) }]
  for (const S of level.soffits || []) {
    if (!S.pts || S.pts.length < 3) continue; const top = H, bot = S.h || level.soffitH || 2400; if (bot >= top) continue;
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(S.pts.map((p) => new THREE.Vector2(p[0] * MM, -p[1] * MM))), { depth: (top - bot) * MM, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, bot * MM, 0);
    const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; m.name = '가벽'; root.add(m);
  }
  return root;
}

/** 벽 디자인 수정: w.form.o = 8 × [du(길이 방향), dv(두께 방향), dy(위)] mm · 번호 = 끝(0 시작 · 1 끝) × 4 + 면(0 −쪽 · 1 +쪽) × 2 + 위아래(0 바닥 · 1 위)
 *  벽 안 모든 점을 8 모서리 이동량의 3중 선형 보간만큼 옮긴다 (문 · 창 자리도 같이 휜다) */
export const WFI = (s, sd, lv) => s * 4 + sd * 2 + lv;
export function wallDeform(o, L, H, t, x, y, z) { const u = Math.min(1, Math.max(0, x / L)), sd = Math.min(1, Math.max(0, (z + t) / (2 * t))), v = Math.min(1, Math.max(0, y / H)); const d = [0, 0, 0];
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) { const k = (a ? u : 1 - u) * (b ? sd : 1 - sd) * (c ? v : 1 - v); if (!k) continue; const q = o[WFI(a, b, c)]; d[0] += q[0] * k; d[1] += q[1] * k; d[2] += q[2] * k; }
  return [x + d[0], y + d[2], z + d[1]]; }
function deformWall(g, w, L, H, t) {
  g.traverse((m) => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const r = wallDeform(w.form.o, L, H, t, p.getX(i) / MM, p.getY(i) / MM, p.getZ(i) / MM); p.setXYZ(i, r[0] * MM, r[1] * MM, r[2] * MM); } p.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); });
}
/** 시트지(벽 한 면 전체 색 · 이미지) · 벽 그림(이미지 판) — w.sheet = { side: 'a' | 'b' | 'both', color, img, opacity }, w.arts = [{ id, img, t, y, w, h, side }] */
const texCache = new Map();
function texOf(src) { if (!src) return null; if (!texCache.has(src)) { const t = new THREE.TextureLoader().load(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(src, t); } return texCache.get(src); }
function addSheet(g, w, len, ops) {
  const t = (w.t / 2) * MM, H = w.h * MM, L = len * MM, sides = (s) => (s === 'both' ? [1, -1] : s === 'b' ? [-1] : [1]);
  if (w.sheet) { const S = w.sheet, map = texOf(S.img), mat = new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : S.color || '#d8c7a6', map, roughness: 0.6, transparent: (S.opacity ?? 1) < 1, opacity: S.opacity ?? 1, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sd of sides(S.side)) { // 문 · 창 자리는 비운 판
      const shape = new THREE.Shape([[0, 0], [L, 0], [L, H], [0, H]].map(([x, y]) => new THREE.Vector2(x, y)));
      for (const q of ops) shape.holes.push(new THREE.Path([[q.a, q.y0], [q.b, q.y0], [q.b, q.y1], [q.a, q.y1]].map(([x, y]) => new THREE.Vector2(x, y))));
      const geo = new THREE.ShapeGeometry(shape); const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / L, pos.getY(i) / H);
      const m = new THREE.Mesh(geo, mat); m.position.z = sd * (t + 0.002); if (sd < 0) { m.rotation.y = Math.PI; m.position.x = L; } m.receiveShadow = true; m.name = '시트지'; g.add(m); }
  }
  for (const A of w.arts || []) { const map = texOf(A.img); if (!map) continue; const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.55, transparent: true, polygonOffset: true, polygonOffsetFactor: -4 });
    for (const sd of sides(A.side)) { const m = new THREE.Mesh(new THREE.PlaneGeometry(A.w * MM, A.h * MM), mat); m.position.set((sd > 0 ? A.t : len - A.t) * MM + (sd < 0 ? 0 : 0), (A.y + A.h / 2) * MM, sd * (t + 0.004)); if (sd < 0) { m.rotation.y = Math.PI; m.position.x = A.t * MM; } m.name = '벽 그림'; m.userData.artId = A.id; g.add(m); } }
}
