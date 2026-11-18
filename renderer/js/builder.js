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
/**
 * 천 가림막 (노렌): 위 봉에 매달린 천 n 장 · 아래로 갈수록 살짝 출렁이는 굴곡 · 원점 = 봉 가운데 (아래로 h 만큼 내려옴)
 */
export function makeCurtain(wmm, hmm, color = '#c4161c', n = 3) {
  const g = new THREE.Group(), W = wmm * MM, H = Math.max(0.1, hmm * MM), gap = n > 1 ? 0.014 : 0, pw = (W - gap * (n - 1)) / n;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const geo = new THREE.PlaneGeometry(pw, H, 12, 10), pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), y = pos.getY(k), f = (H / 2 - y) / H; pos.setZ(k, Math.sin((x / pw) * Math.PI * 2.5 + i * 1.3) * 0.009 * (0.35 + f) + f * f * 0.025 * (i % 2 ? 1 : -1)); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.position.set(-W / 2 + pw / 2 + i * (pw + gap), -H / 2, 0); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, W + 0.06, 10), material('steel', '#b9bfc6')); rod.rotation.z = Math.PI / 2; rod.position.y = 0.012; g.add(rod);
  return g;
}
/* ---------- 페리카나 매뉴얼 사인 · 시트 (캔버스로 그린 면) ----------
 * L.sign = { kind: 'neon' | 'vneon' | 'menu' | 'glass' | 'wood' | 'window' | 'panel', text?, glow? } */
const signCache = new Map();
function signTex(S, w, h, text) {
  const key = S.kind + ':' + (text || S.text || '') + ':' + Math.round(w / h * 100) + ':' + (S.panel || '') + (S.fg || '') + (S.color || '') + (S.edge || ''); if (signCache.has(key)) return signCache.get(key);
  const k = 512 / Math.max(w, h), W = Math.max(64, Math.round(w * k * 2)), H = Math.max(64, Math.round(h * k * 2)), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), T = text || S.text || '';
  const font = (px, wt = 900) => `${wt} ${px}px "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif`, rr = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, r) : g.rect(x, y, ww, hh); };
  if (S.kind === 'neon') { g.clearRect(0, 0, W, H); rr(W * 0.03, H * 0.12, W * 0.94, H * 0.76, H * 0.38); g.fillStyle = '#c99a62'; g.fill(); g.lineWidth = H * 0.06; g.strokeStyle = '#7a1418'; g.stroke(); rr(W * 0.07, H * 0.24, W * 0.86, H * 0.52, H * 0.26); g.fillStyle = '#f6ecd8'; g.fill();
    g.font = font(H * 0.42); g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff2a1a'; g.shadowBlur = H * 0.08; g.fillStyle = '#d4141c'; g.fillText(T || '페리카나', W / 2, H * 0.52); }
  else if (S.kind === 'signred') { /* 직영점 간판: 빨간 상자 · 흰 글자 + 왕관 · 양옆 흰 막대 */
    g.fillStyle = S.color || '#d7191f'; g.fillRect(0, 0, W, H); const fs = H * 0.5; g.font = `italic 900 ${fs}px "Pretendard","Noto Sans KR","Malgun Gothic",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = fs * 0.14; g.strokeStyle = '#a10f14'; g.strokeText(T || '페리카나', W / 2, H * 0.56); g.fillStyle = '#ffffff'; g.fillText(T || '페리카나', W / 2, H * 0.56);
    const tw = g.measureText(T || '페리카나').width; g.fillStyle = '#ffffff'; const bh = H * 0.07, bw = Math.max(0, (W - tw) / 2 - W * 0.06); g.fillRect(W * 0.025, H * 0.5, bw, bh); g.fillRect(W - W * 0.025 - bw, H * 0.5, bw, bh);
    const kx = W / 2 - tw * 0.1, ky = H * 0.2, k = fs * 0.2; g.beginPath(); g.moveTo(kx - k, ky + k * 0.6); g.lineTo(kx - k, ky - k * 0.2); g.lineTo(kx - k * 0.5, ky + k * 0.2); g.lineTo(kx, ky - k * 0.5); g.lineTo(kx + k * 0.5, ky + k * 0.2); g.lineTo(kx + k, ky - k * 0.2); g.lineTo(kx + k, ky + k * 0.6); g.closePath(); g.fill(); }
  else if (S.kind === 'neonred') { /* 빨간 네온 글자 (사진 같은 필기체 · 왕관) · 배경 없음 */
    g.clearRect(0, 0, W, H); const fs = Math.min(H * 0.62, W / (Math.max(2, [...(T || '페리카나')].length) * 0.95)); g.font = `italic 900 ${fs}px "Pretendard","Noto Sans KR","Malgun Gothic",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const cy = H * 0.6;
    const neon = (fn) => { g.shadowColor = '#ff2a1a'; g.shadowBlur = fs * 0.35; g.strokeStyle = '#ff3b2f'; g.lineWidth = fs * 0.11; g.lineJoin = 'round'; fn('s'); g.shadowBlur = fs * 0.12; g.strokeStyle = '#ffb3a6'; g.lineWidth = fs * 0.035; fn('s'); };
    neon(() => g.strokeText(T || '페리카나', W / 2, cy));
    const tw = g.measureText(T || '페리카나').width, kx = W / 2 - tw * 0.12, ky = cy - fs * 0.62, k = fs * 0.22; /* 왕관 (둘째 글자 위) */
    neon(() => { g.beginPath(); g.moveTo(kx - k, ky + k * 0.6); g.lineTo(kx - k, ky - k * 0.2); g.lineTo(kx - k * 0.5, ky + k * 0.2); g.lineTo(kx, ky - k * 0.5); g.lineTo(kx + k * 0.5, ky + k * 0.2); g.lineTo(kx + k, ky - k * 0.2); g.lineTo(kx + k, ky + k * 0.6); g.closePath(); g.stroke(); }); }
  else if (S.kind === 'vneon') { g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, W, H); for (const y of [0.18, 0.5, 0.82]) { g.fillStyle = '#d4141c'; g.fillRect(0, H * y, W, H * 0.012); } g.save(); g.translate(W / 2, H / 2); g.rotate(Math.PI / 2); g.font = font(W * 0.42); g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#3cf0b0'; g.shadowBlur = W * 0.08; g.fillStyle = '#7ff5c8'; g.fillText(T || '페리카나', 0, 0); g.restore(); }
  else if (S.kind === 'ledpanel') { /* LED 백패널: 어두운 판 + 빛나는 글자(후광) + 테두리 LED 띠 */
    g.fillStyle = S.panel || '#18191c'; g.fillRect(0, 0, W, H); const fg = S.fg || '#ffffff', n = Math.max(1, [...(T || '페리카나')].length), fs = Math.min(H * 0.6, (W * 0.86) / (n * 0.95));
    g.font = font(fs); g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = fg; g.shadowBlur = fs * 0.3; g.fillStyle = fg; g.fillText(T || '페리카나', W / 2, H * 0.54); g.shadowBlur = fs * 0.08; g.fillText(T || '페리카나', W / 2, H * 0.54);
    g.shadowBlur = 0; g.strokeStyle = S.edge || fg; g.globalAlpha = 0.85; g.lineWidth = Math.max(3, H * 0.025); g.strokeRect(g.lineWidth, g.lineWidth, W - g.lineWidth * 2, H - g.lineWidth * 2); g.globalAlpha = 1; }
  else if (S.kind === 'menu') { const rows = (T || 'Spicy Red Chicken|Soy Sauce Chicken').split('|'); g.fillStyle = '#d9dcdf'; g.fillRect(0, 0, W, H); const rh = H / rows.length; rows.forEach((t, i) => { g.fillStyle = '#ee8a1f'; g.fillRect(W * 0.01, i * rh + rh * 0.08, W * 0.98, rh * 0.84); g.font = font(rh * 0.42, 800); g.fillStyle = '#4a1a08'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, W / 2, i * rh + rh / 2); }); }
  else if (S.kind === 'glass') { g.fillStyle = 'rgba(232,238,242,0.78)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = font(Math.min(W, H) * 0.12, 800); g.textAlign = 'center'; g.fillText(T || '페리카나', W / 2, H * 0.62); g.strokeStyle = 'rgba(150,160,168,.8)'; g.lineWidth = 4; g.strokeRect(2, 2, W - 4, H - 4); }
  else if (S.kind === 'wood') { const n = Math.max(3, Math.round(w / 300)); for (let i = 0; i < n; i++) { g.fillStyle = ['#7a4a2b', '#6f4226', '#83512f'][i % 3]; g.fillRect((i * W) / n, 0, W / n, H); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect((i * W) / n, 0, 2, H); for (let k2 = 0; k2 < 18; k2++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect((i * W) / n + Math.random() * W / n, 0, 1.5, H); } } }
  else if (S.kind === 'window') { g.fillStyle = 'rgba(255,255,255,0.0)'; g.clearRect(0, 0, W, H); g.fillStyle = '#d4141c'; g.font = font(Math.min(W / 6.2, H / 9)); g.textAlign = 'left'; g.textBaseline = 'top'; (T || 'DO YOU|REMEMBER|THE TASTE|OF THE|ORIGINAL|SEASONED|CHICKEN?').split('|').forEach((t, i) => g.fillText(t, W * 0.06, H * 0.08 + i * Math.min(W / 6.2, H / 9) * 1.08)); }
  else { g.fillStyle = S.color || '#ac0610'; g.fillRect(0, 0, W, H); if (T) { g.fillStyle = S.fg || '#ffffff'; g.font = font(H * 0.35); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(T, W / 2, H / 2); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; signCache.set(key, t); return t;
}
/** 불이 들어오는 간판 종류 (끄려면 it.signOff) */
export const LITSIGN = new Set(['signred', 'neon', 'neonred', 'vneon', 'menu', 'ledpanel', 'channel']);
export const signLit = (S, it = {}) => !it.signOff && (!!S.glow || LITSIGN.has(S.kind) || !!(it.light && it.light.on));
/** 3D 돌출 글자 (채널 간판): 글자마다 따로 된 입체. 글자 모양 판을 깊이만큼 촘촘히 겹쳐 옆면을 만들고, 앞면이 빛난다 */
const chCache = new Map();
function chMask(ch, bold) {
  const key = ch + (bold ? 'b' : ''); if (chCache.has(key)) return chCache.get(key); const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.font = `${bold ? 900 : 800} 220px "Pretendard","Noto Sans KR","Malgun Gothic",system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(ch, 128, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; chCache.set(key, t); return t;
}
export function channelSign(it, S) {
  const g = new THREE.Group(), chars = [...(it.signText || S.text || '페리카나')].filter((c) => c.trim()), n = Math.max(1, chars.length), W = it.w * MM, H = it.h * MM, D = Math.max(20, it.d) * MM;
  const cell = Math.min(W / n, H * 1.05), lit = signLit(S, it), face = new THREE.Color(S.fg || '#ffffff'), side = it.color || S.side || '#d7191f';
  const layers = Math.round(Math.max(6, Math.min(18, D / 0.006)));
  chars.forEach((ch, i) => {
    const mask = chMask(ch, true), x = -W / 2 + (W - cell * n) / 2 + cell * (i + 0.5), L = new THREE.Group(); L.name = '글자 ' + ch; L.userData.letter = i;
    const sideM = new THREE.MeshStandardMaterial({ color: side, map: null, alphaMap: mask, alphaTest: 0.5, transparent: false, roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
    for (let k = 0; k < layers; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), sideM); m.position.set(0, 0, (D * k) / layers); L.add(m); }
    const frontM = new THREE.MeshStandardMaterial({ color: face, alphaMap: mask, alphaTest: 0.5, roughness: 0.35, emissive: lit ? face : new THREE.Color('#000'), emissiveIntensity: lit ? 1.1 : 0 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell), frontM); f.position.z = D + 0.001; L.add(f);
    if (lit) { /* 벽에 번지는 후광 */ const hm = new THREE.MeshBasicMaterial({ color: S.halo || face, alphaMap: mask, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }); const h = new THREE.Mesh(new THREE.PlaneGeometry(cell * 1.18, cell * 1.18), hm); h.position.z = 0.002; L.add(h); }
    L.position.set(x, H / 2, 0); g.add(L);
  });
  return g;
}
function signFace(S, w, h, text, it = {}) {
  const map = signTex(S, w, h, text), glow = signLit(S, it), transparent = ['neon', 'neonred', 'window', 'glass'].includes(S.kind);
  const m = new THREE.MeshStandardMaterial({ map, transparent, alphaTest: S.kind === 'window' ? 0.05 : 0, ...(S.kind === 'neonred' ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}), roughness: 0.5, emissive: glow ? new THREE.Color('#ffffff') : new THREE.Color('#000000'), emissiveMap: glow ? map : null, emissiveIntensity: glow ? (S.kind === 'signred' || S.kind === 'menu' ? 0.75 : 1) : 0, depthWrite: !transparent || S.kind === 'neon' });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), m); mesh.renderOrder = 2; return mesh;
}
/* ---------- 손으로 만든 모양 (놀이방 · 테라스 · 경사로 · 어닝 · 조명) ----------
 * lib 의 shape 이름으로 고른다. 기준점: 바닥 가운데, x = 폭(w), z = 깊이(d, 앞 +z), y = 높이 */
const PROC = new Set(['pipeframe', 'wedge', 'slide', 'wave', 'pool', 'xroll', 'bag', 'ring', 'perf', 'deck', 'turf', 'fence', 'awning', 'light3', 'strip', 'postlamp']);
const KBROWN = '#b5866a', KCREAM = '#efe6dc';
function pm(color, opt = {}) { const m = material('plain', color); return opt.emissive ? Object.assign(m.clone(), { emissive: new THREE.Color(opt.emissive), emissiveIntensity: opt.ei ?? 1 }) : m; }
function mk(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }
function tube(a, b, r, mat) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), m = mk(new THREE.CylinderGeometry(r, r, L, 10), mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return m; }
function stripes(len, r, n, cA, cB, axis = 'y') { const g = new THREE.Group(), seg = len / n; for (let i = 0; i < n; i++) { const c = mk(new THREE.CylinderGeometry(r, r, seg, 16), pm(i % 2 ? cB : cA)); c.position.y = -len / 2 + seg * (i + 0.5); g.add(c); } if (axis === 'x') g.rotation.z = Math.PI / 2; if (axis === 'z') g.rotation.x = Math.PI / 2; return g; }
let perfTex = null;
function procShape(shape, it, L) {
  const g = new THREE.Group(), W = it.w * MM, D = it.d * MM, H = it.h * MM, col = it.color || (L && L.color) || '#cccccc';
  if (shape === 'pipeframe') { /* 놀이방 파이프 프레임: 1m 안팎 칸 · 위 · 가운데 · 아래 난간 */
    const nx = Math.max(1, it.nx || Math.round(it.w / 1000)), nz = Math.max(1, it.nz || Math.round(it.d / 1000)), r = 0.028, mat = pm(col), ys = [0.06, it.mid ? it.mid * MM : H * 0.45, H];
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) g.add(tube([-W / 2 + (W * i) / nx, 0, -D / 2 + (D * k) / nz], [-W / 2 + (W * i) / nx, H, -D / 2 + (D * k) / nz], r, mat));
    for (const y of ys) { for (let k = 0; k <= nz; k++) g.add(tube([-W / 2, y, -D / 2 + (D * k) / nz], [W / 2, y, -D / 2 + (D * k) / nz], r, mat)); for (let i = 0; i <= nx; i++) g.add(tube([-W / 2 + (W * i) / nx, y, -D / 2], [-W / 2 + (W * i) / nx, y, D / 2], r, mat)); }
  } else if (shape === 'wedge') { /* 경사로 · 슬로프 (뒤가 높고 앞이 낮음) */
    const sh = new THREE.Shape(); sh.moveTo(-D / 2, 0); sh.lineTo(D / 2, 0); sh.lineTo(-D / 2, H); sh.lineTo(-D / 2, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false }); geo.translate(0, 0, -W / 2); geo.rotateY(-Math.PI / 2); g.add(mk(geo, pm(col)));
    if (it.rail || (L && L.rail)) { const rm = pm('#9aa0a6'); for (const sx of [-W / 2 + 0.03, W / 2 - 0.03]) { g.add(tube([sx, H + 0.85, -D / 2], [sx, 0.85, D / 2], 0.02, rm)); g.add(tube([sx, 0, -D / 2], [sx, H + 0.85, -D / 2], 0.02, rm)); g.add(tube([sx, 0, D / 2], [sx, 0.85, D / 2], 0.02, rm)); } }
  } else if (shape === 'slide') { /* 미끄럼틀: 뒤 높이 H → 앞 바닥 */
    const n = 16, mat = pm(col); for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, f = (t) => H * (1 - t) * (1 - t * 0.35) + 0.05, z0 = -D / 2 + D * t0, z1 = -D / 2 + D * t1, y0 = f(t0), y1 = f(t1), len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y0 - y1, z1 - z0);
      const seg = new THREE.Group(); seg.add(mk(new THREE.BoxGeometry(W * 0.8, 0.02, len), mat)); seg.add(mk(new THREE.BoxGeometry(0.04, 0.16, len), mat, -W * 0.42, 0.08, 0)); seg.add(mk(new THREE.BoxGeometry(0.04, 0.16, len), mat, W * 0.42, 0.08, 0)); seg.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2); seg.rotation.x = ang; g.add(seg); }
  } else if (shape === 'wave') { /* 웨이브 경사 (반원 롤러) */
    const n = Math.max(3, Math.round(it.d / 300)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, c = mk(new THREE.CylinderGeometry(D / n / 2, D / n / 2, W, 20), pm(i % 2 ? KBROWN : KCREAM)); c.rotation.z = Math.PI / 2; c.position.set(0, H * (1 - t), -D / 2 + D * t); g.add(c); }
    const sh = new THREE.Shape(); sh.moveTo(-D / 2, 0); sh.lineTo(D / 2, 0); sh.lineTo(-D / 2, H); const geo = new THREE.ExtrudeGeometry(sh, { depth: W * 0.98, bevelEnabled: false }); geo.translate(0, 0, -W * 0.49); geo.rotateY(-Math.PI / 2); g.add(mk(geo, pm('#e9e2d8')));
  } else if (shape === 'pool') { /* 볼풀 · 테두리 + 안쪽 바 */
    const t = 0.08, mat = pm(col); g.add(mk(new THREE.BoxGeometry(W, H, t), mat, 0, H / 2, -D / 2 + t / 2)); g.add(mk(new THREE.BoxGeometry(W, H, t), mat, 0, H / 2, D / 2 - t / 2)); g.add(mk(new THREE.BoxGeometry(t, H, D), mat, -W / 2 + t / 2, H / 2, 0)); g.add(mk(new THREE.BoxGeometry(t, H, D), mat, W / 2 - t / 2, H / 2, 0));
    g.add(mk(new THREE.BoxGeometry(W - 2 * t, 0.05, D - 2 * t), pm('#ddd3c8'), 0, H * 0.55, 0)); const n = Math.round(it.w / 120); for (let i = 1; i < n; i++) if (i % 2) g.add(mk(new THREE.BoxGeometry(0.05, 0.02, D * 0.55), pm('#c9c2c6'), -W / 2 + (W * i) / n, H * 0.56, 0));
  } else if (shape === 'xroll') { /* X 롤러 (줄무늬 기둥 두 개 엇갈림) */
    for (const a of [Math.PI / 4, -Math.PI / 4]) { const s = stripes(Math.hypot(W, D) * 0.9, Math.min(0.13, H / 2), 7, '#b67a2c', KCREAM); s.rotation.z = Math.PI / 2; const p = new THREE.Group(); p.add(s); p.rotation.y = a; p.position.y = H / 2; g.add(p); }
  } else if (shape === 'bag') { const s = stripes(H, Math.min(W, D) / 2, 6, '#b67a2c', KCREAM); s.position.y = H / 2; g.add(s); g.add(tube([0, H, 0], [0, H + 0.4, 0], 0.01, pm('#888888'))); /* 샌드백 */
  } else if (shape === 'ring') { const p = mk(new THREE.BoxGeometry(W, H, D * 0.4), pm(col)); p.position.y = H / 2; g.add(p); const t = mk(new THREE.TorusGeometry(Math.min(W, H) * 0.32, Math.min(W, H) * 0.07, 12, 32), pm('#d7d2cd')); t.position.set(0, H / 2, D * 0.22); g.add(t); /* 링 터널 판 */
  } else if (shape === 'perf') { if (!perfTex && typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#efe9df'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#5b5550'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(6 + i * 16, 6 + j * 16, 6, 6); perfTex = new THREE.CanvasTexture(c); perfTex.wrapS = perfTex.wrapT = THREE.RepeatWrapping; perfTex.colorSpace = THREE.SRGBColorSpace; }
    const m = new THREE.MeshStandardMaterial({ map: perfTex, roughness: 0.8 }); if (perfTex) { m.map = perfTex.clone(); m.map.needsUpdate = true; m.map.repeat.set(it.w / 250, it.h / 250); } g.add(mk(new THREE.BoxGeometry(W, H, Math.max(0.01, D)), m, 0, H / 2, 0));
  } else if (shape === 'deck') { /* 데크: 판재 + 틈 */
    const n = Math.max(2, Math.round(it.d / 150)), bw = D / n; for (let i = 0; i < n; i++) g.add(mk(new THREE.BoxGeometry(W, H, bw * 0.92), pm(i % 3 === 1 ? '#8a5b3a' : col), 0, H / 2, -D / 2 + bw * (i + 0.5)));
  } else if (shape === 'turf') { g.add(mk(new THREE.BoxGeometry(W, H, D), Object.assign(pm(col).clone(), { roughness: 1 }), 0, H / 2, 0)); /* 인조잔디 */
  } else if (shape === 'fence') { /* 철제 펜스: 기둥 1.2m 안팎 · 위아래 난간 · 세로살 */
    const mat = pm(col), n = Math.max(1, Math.round(it.w / 1200)), posts = []; for (let i = 0; i <= n; i++) { const x = -W / 2 + (W * i) / n; posts.push(x); g.add(mk(new THREE.BoxGeometry(0.06, H, 0.06), mat, x, H / 2, 0)); }
    g.add(mk(new THREE.BoxGeometry(W, 0.04, 0.05), mat, 0, H - 0.02, 0)); g.add(mk(new THREE.BoxGeometry(W, 0.04, 0.05), mat, 0, 0.1, 0)); const bars = Math.round(it.w / 120); for (let i = 1; i < bars; i++) g.add(mk(new THREE.BoxGeometry(0.016, H - 0.14, 0.016), mat, -W / 2 + (W * i) / bars, H / 2 + 0.04, 0));
  } else if (shape === 'postlamp') { /* 펜스 외부등 */
    g.add(mk(new THREE.CylinderGeometry(0.015, 0.015, H * 0.5, 8), pm('#222222'), 0, H * 0.25, 0)); g.add(mk(new THREE.BoxGeometry(W, H * 0.5, D), pm('#fff1d6', { emissive: '#ffd59a', ei: 0.9 }), 0, H * 0.75, 0)); g.add(mk(new THREE.BoxGeometry(W * 1.2, 0.02, D * 1.2), pm('#222222'), 0, H, 0));
  } else if (shape === 'awning') { /* 수동식 어닝: 벽 쪽 상자 · 앞으로 비스듬히 내려오는 천 · 앞 드림(글자) */
    const drop = (it.drop ?? 350) * MM, fall = H; g.add(mk(new THREE.BoxGeometry(W, 0.14, 0.16), pm('#2b2b2b'), 0, fall, -D / 2 + 0.08));
    const len = Math.hypot(D, fall - drop), cloth = mk(new THREE.PlaneGeometry(W, len), Object.assign(pm(col).clone(), { side: THREE.DoubleSide })); cloth.rotation.x = -Math.atan2(D, fall - drop); cloth.position.set(0, (fall + drop) / 2 + 0.02, 0); g.add(cloth);
    if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(32, Math.round((1024 * drop) / W)); const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#ffffff'; x.fillRect(0, c.height * 0.12, c.width, Math.max(2, c.height * 0.06)); if (it.signText) { x.font = `800 ${c.height * 0.42}px "Pretendard","Noto Sans KR",sans-serif`; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText(it.signText, c.width - 24, c.height * 0.6); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const v = mk(new THREE.PlaneGeometry(W, drop), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); v.position.set(0, drop / 2, D / 2); g.add(v); }
    g.add(mk(new THREE.BoxGeometry(W, 0.05, 0.05), pm('#2b2b2b'), 0, drop, D / 2));
  } else if (shape === 'light3') { /* 3구 매입등 (사각 테두리 + 등 3개) */
    g.add(mk(new THREE.BoxGeometry(W, H, D), pm('#f4f4f2'), 0, H / 2, 0)); for (let i = -1; i <= 1; i++) g.add(mk(new THREE.CylinderGeometry(D * 0.32, D * 0.32, 0.006, 20), pm('#fffaf0', { emissive: '#fff4e0', ei: 1 }), (i * W) / 3.3, -0.002, 0));
  } else if (shape === 'strip') { /* 매립 무드등 (LED 바) */
    g.add(mk(new THREE.BoxGeometry(W, H, D), pm(col, { emissive: col, ei: 1.2 }), 0, H / 2, 0));
  }
  return g;
}
export function buildItem(it, ctx) {
  const g = new THREE.Group(); g.name = it.name || it.type; g.userData.itemId = it.id;
  const L = ctx.lib[it.type], parts = it.parts || ctx.shapes[it.type];
  if (it.asset && ctx.assets.has(it.asset.key)) { // 가져온 외부 3D 에셋
    const a = ctx.assets.get(it.asset.key), o = a.object.clone(true);
    o.scale.set((it.w * MM) / a.size.x, (it.h * MM) / a.size.y, (it.d * MM) / a.size.z); g.add(o);
  } else if (L && PROC.has(L.shape)) { g.add(procShape(L.shape, it, L)); /* 손으로 만든 모양 */
  } else if (L && L.shape === 'curtain') { const c = makeCurtain(it.w, it.h, it.color || L.color, it.panels || Math.max(2, Math.round(it.w / 450))); c.position.y = it.h * MM; g.add(c); /* 천 가림막 기물 */
  } else if (parts && parts.length) {
    const pb = it.pb || (L ? { w: L.w, d: L.d, h: L.h } : { w: it.w, d: it.d, h: it.h });
    const baseColor = L ? L.color : null, baseTex = L ? MAT_TEX[L.mat] || 'plain' : null, newTex = it.mat ? MAT_TEX[it.mat] || 'plain' : null;
    const recolor = (p) => { // 기존 앱 규칙: 기물 기본 색으로 그린 부품만 사용자가 고른 색 · 재질로 바뀐다
      if (p.own) return { color: p.c || '#b8bcc2', tex: MAT_TEX[p.m] || p.m || 'plain' }; // 디자인 수정에서 부품마다 따로 고른 색 · 재질
      const main = !!baseColor && typeof p.c === 'string' && p.c.toLowerCase() === baseColor.toLowerCase();
      return { color: main && it.color ? it.color : p.c || '#b8bcc2', tex: main && newTex ? newTex : p.m === baseTex && newTex && main ? newTex : p.m || 'plain' };
    };
    for (const m of partsToMeshes(parts, [it.w / (pb.w || it.w), it.h / (pb.h || it.h), it.d / (pb.d || it.d)], recolor)) g.add(m);
  } else if (!(L && L.sign && L.sign.only)) { // 모양 정보가 없으면 크기만 맞춘 상자 (그림 면만 있는 시트 · 네온은 빼고)
    const m = new THREE.Mesh(new THREE.BoxGeometry(it.w * MM, it.h * MM, it.d * MM), material(MAT_TEX[it.mat] || 'plain', it.color || '#b8bcc2'));
    m.position.y = (it.h * MM) / 2; m.castShadow = m.receiveShadow = true; g.add(m);
  }
  if (it.tex && it.tex.img) { const tm = texMaterial(it.tex, it.tex.rep || 1); g.traverse((o) => { if (o.isMesh && (!it.tex.main || !o.userData.own)) o.material = tm; }); } /* 텍스처 입히기 */
  const SG = L && L.sign ? { ...L.sign, ...(it.sign || {}) } : null; /* 기물마다 글자색 · 판 색을 바꿀 수 있게 */
  if (SG && SG.kind === 'channel') g.add(channelSign(it, SG));
  else if (SG) { const sg = signFace(SG, it.w, it.h, it.signText, it); sg.position.set(0, (it.h * MM) / 2, (it.d * MM) / 2 + 0.002); g.add(sg); if (SG.both) { const b = sg.clone(); b.rotation.y = Math.PI; b.position.z = -b.position.z; g.add(b); } } /* 그림 · 글자 면 (간판 · 네온 · 시트) */
  if (it.light && it.light.on) g.add(...makeLight(it));
  placeItem(g, it, ctx.zOf ? ctx.zOf(it) : it.elev);
  return g;
}
export function placeItem(g, it, z = it.elev) { g.position.set(it.x * MM, z * MM, it.y * MM); g.rotation.y = (-it.rot * Math.PI) / 180; }

// 조명 기물의 광원: 전등은 아래로 비추는 SpotLight, 튀김기 · 레인지 · 스탠드는 PointLight
function makeLight(it) {
  const c = new THREE.Color(it.light.color || '#ffe2bd'), pw = it.light.power ?? 1, h = it.h * MM;
  if (it.light.kind === 'spot') {
    const s = new THREE.SpotLight(c, 11 * pw, 8, 1.05, 0.8, 1.6); /* 매장 천장 2.7~3m 에서 바닥까지 충분히 */ s.position.set(0, -0.02, 0); s.target.position.set(0, -3, 0); s.userData.itemLight = true;
    return [s, s.target];
  }
  const p = new THREE.PointLight(c, 1.8 * pw, 3.5, 1.7); p.position.set(0, h + 0.18, 0); p.userData.itemLight = true;
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
    for (const q of ops) if (q.o.curtain && q.o.curtain.on !== false) { const c = q.o.curtain, cw = (q.b - q.a) / MM, cl = Math.min(c.len || 600, (q.y1 - q.y0) / MM - 100), m = makeCurtain(cw, cl, c.color || '#c4161c', c.panels || Math.max(2, Math.round(cw / 450))); m.position.set((q.a + q.b) / 2, q.y1 - 0.01, 0); m.userData.curtain = true; g.add(m); } /* 천 가림막 (문 · 배식구 · 창) */
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
/** 다각형을 바깥으로 d(mm) 밀기 (모서리는 이음) */
export function offsetPoly(P, d) {
  let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } const sg = a > 0 ? 1 : -1, n = P.length;
  return P.map((q, i) => { const p0 = P[(i - 1 + n) % n], p1 = P[(i + 1) % n], e1 = [q[0] - p0[0], q[1] - p0[1]], e2 = [p1[0] - q[0], p1[1] - q[1]], l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [(e1[1] / l1) * sg, (-e1[0] / l1) * sg], n2 = [(e2[1] / l2) * sg, (-e2[0] / l2) * sg], m = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(...m) || 1, k = d / Math.max(0.35, (m[0] * n1[0] + m[1] * n1[1]) / ml);
    return [q[0] + (m[0] / ml) * k, q[1] + (m[1] / ml) * k]; });
}
export function buildFloors(level) {
  const root = new THREE.Group(); root.name = '바닥';
  const b = levelBounds(level), pad = 80;
  // 기본 바닥판 (벽 바깥 테두리까지)
  let slab; /* 바닥판: level.slab(외곽 다각형)이 있으면 그 모양 + 벽 두께만큼 · 없으면 벽을 감싸는 사각 */
  if (level.slab && level.slab.length > 2) { const P = offsetPoly(level.slab, (level.wallT || 150) / 2 + 20), g = new THREE.ExtrudeGeometry(new THREE.Shape(P.map(([x, y]) => new THREE.Vector2(x * MM, -y * MM))), { depth: 0.12, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, -0.12, 0); slab = new THREE.Mesh(g, floorMaterial(level.floor.finish, level.floor.color)); }
  else slab = new THREE.Mesh(boxAt((b[0] - pad) * MM, (b[2] + pad) * MM, -0.12, 0, (b[1] - pad) * MM, (b[3] + pad) * MM), floorMaterial(level.floor.finish, level.floor.color));
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
