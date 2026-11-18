// 상권 보기 (v2.1.28): 주소 → 좌표 → 반경 500m 공공데이터(브이월드) · OpenStreetMap → 단순 3D 매스
// - 건물: 브이월드 도로명주소건물(LT_C_SPBD, 지상층수 · 용도) · 키가 없으면 OSM 건물
// - 용도지역: 브이월드 LT_C_UQ111~114 (키가 있을 때)
// - 도로 · 공원 · 물 · 가로수: OpenStreetMap (Overpass, 키 없음)
// 좌표: 중심(경위도)에서 m 단위 평면 (x = 동쪽 +, y = 남쪽 + — 도면과 같은 방향)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- 키 · 네트워크 ---------- */
const LS = 'byr.vworld';
export const vworld = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null') || {}; } catch { return {}; } };
export const setVworld = (v) => { try { localStorage.setItem(LS, JSON.stringify(v || {})); } catch {} };
export class NetError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
/** PC 앱 = 메인 프로세스 · 안드로이드 = 네이티브 HTTP · 그 밖 = fetch */
export async function netGet(url) {
  if (window.byr && window.byr.netGet) { const r = await window.byr.netGet(url); if (!r.ok) throw new NetError('E-NET' + (r.status || ''), r.text.slice(0, 160)); return r.text; }
  const CH = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (CH && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) { const r = await CH.request({ url, method: 'GET', responseType: 'text' }); if (r.status >= 400) throw new NetError('E-NET' + r.status, String(r.data).slice(0, 160)); return typeof r.data === 'string' ? r.data : JSON.stringify(r.data); }
  const r = await fetch(url); if (!r.ok) throw new NetError('E-NET' + r.status, (await r.text()).slice(0, 160)); return r.text();
}
const getJson = async (url) => { const t = await netGet(url); try { return JSON.parse(t); } catch { throw new NetError('E-JSON', t.slice(0, 160)); } };

/* ---------- 주소 찾기 ---------- */
export async function geocode(q) {
  const V = vworld(), out = [];
  if (V.key) {
    for (const [type, cat] of [['address', 'road'], ['address', 'parcel'], ['place', '']]) {
      const u = `https://api.vworld.kr/req/search?service=search&request=search&version=2.0&crs=EPSG:4326&size=8&page=1&format=json&errorformat=json&type=${type}${cat ? '&category=' + cat : ''}&query=${encodeURIComponent(q)}&key=${encodeURIComponent(V.key)}${V.domain ? '&domain=' + encodeURIComponent(V.domain) : ''}`;
      try { const j = await getJson(u), R = j.response || {}; if (R.status === 'ERROR') throw new NetError('E-VW', (R.error && (R.error.text || R.error.code)) || 'vworld'); for (const it of (R.result && R.result.items) || []) out.push({ title: it.title || (it.address && (it.address.road || it.address.parcel)) || q, sub: it.address ? it.address.road || it.address.parcel || '' : it.category || '', lon: +it.point.x, lat: +it.point.y, src: 'vworld' }); }
      catch (e) { if (e.code === 'E-VW') throw e; }
      if (out.length) break;
    }
  }
  if (!out.length) { const j = await getJson(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&limit=8&accept-language=ko&q=${encodeURIComponent(q)}`); for (const it of j) out.push({ title: (it.display_name || '').split(',').slice(0, 3).join(','), sub: it.type || '', lon: +it.lon, lat: +it.lat, src: 'osm' }); }
  return out;
}

/* ---------- 투영 (경위도 → m) ---------- */
export function proj(lon0, lat0) { const kx = 111320 * Math.cos((lat0 * Math.PI) / 180), ky = 110574; return { fwd: (lon, lat) => [Math.round((lon - lon0) * kx * 100) / 100, Math.round((lat0 - lat) * ky * 100) / 100], kx, ky }; }
const ringsOf = (g) => !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [];

/* ---------- 건물 용도 ---------- */
export const USES = [
  ['단독주택', '#f7d65a'], ['공동주택', '#f2a63c'], ['제1종근린생활시설', '#f5a9a0'], ['제2종근린생활시설', '#ee7f6b'], ['판매시설', '#d9382c'], ['업무시설', '#a8231d'],
  ['교육연구시설', '#2f63d6'], ['의료시설', '#4f95e6'], ['노유자시설', '#8db6ec'], ['종교시설', '#2ba597'], ['문화 및 집회시설', '#11807e'], ['숙박시설', '#9a6fd2'],
  ['공장 · 창고', '#a99ed9'], ['기타', '#c7cbd1'],
];
const UCOL = Object.fromEntries(USES);
/** 건축물 용도 코드(앞 2자리) · 이름 → 우리 분류 */
export function useOf(code, name) {
  const c = String(code || '').slice(0, 2), s = String(name || '');
  const by = { '01': '단독주택', '02': '공동주택', '03': '제1종근린생활시설', '04': '제2종근린생활시설', '05': '문화 및 집회시설', '06': '종교시설', '07': '판매시설', '09': '의료시설', '10': '교육연구시설', '11': '노유자시설', '14': '업무시설', '15': '숙박시설', '17': '공장 · 창고', '18': '공장 · 창고' }[c];
  if (by) return by;
  if (/단독|다가구|다중주택|house|detached/i.test(s)) return '단독주택'; if (/아파트|연립|다세대|공동주택|apartments|residential/i.test(s)) return '공동주택';
  if (/제1종|1종근린/.test(s)) return '제1종근린생활시설'; if (/근린|상가|retail|shop|commercial/i.test(s)) return '제2종근린생활시설'; if (/판매|마트|백화점|supermarket|mall/i.test(s)) return '판매시설';
  if (/업무|오피스|office/i.test(s)) return '업무시설'; if (/학교|교육|school|university|college|kindergarten/i.test(s)) return '교육연구시설'; if (/병원|의료|hospital|clinic/i.test(s)) return '의료시설';
  if (/노유자|어린이집|경로당/.test(s)) return '노유자시설'; if (/종교|교회|성당|사찰|church|temple/i.test(s)) return '종교시설'; if (/숙박|호텔|모텔|hotel/i.test(s)) return '숙박시설'; if (/공장|창고|industrial|warehouse/i.test(s)) return '공장 · 창고';
  return '기타';
}
/* 용도지역 색 (토지이용계획 관례) */
export function zoneColor(n) { const s = String(n || ''); if (/전용주거/.test(s)) return '#f5e6a0'; if (/주거/.test(s)) return '#f6dd7a'; if (/중심상업|일반상업/.test(s)) return '#f19a9a'; if (/상업/.test(s)) return '#f4b6b0'; if (/공업/.test(s)) return '#c9b6e6'; if (/녹지|보전|농림|자연/.test(s)) return '#a7d7a0'; return '#d9dde2'; }

/* ---------- 불러오기 ---------- */
const pick = (o, re) => { for (const [k, v] of Object.entries(o || {})) if (re.test(k) && v != null && v !== '') return v; return null; };
async function vwLayer(data, box, V, step, max = 6) {
  const out = []; for (let page = 1; page <= max; page++) {
    const u = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=${data}&key=${encodeURIComponent(V.key)}${V.domain ? '&domain=' + encodeURIComponent(V.domain) : ''}&geomFilter=BOX(${box.join(',')})&size=1000&page=${page}&format=json&errorformat=json&crs=EPSG:4326&geometry=true&attribute=true`;
    const j = await getJson(u), R = j.response || {}; if (R.status === 'NOT_FOUND') break; if (R.status === 'ERROR') throw new NetError('E-VW', (R.error && (R.error.text || R.error.code)) || data);
    const fs = (R.result && R.result.featureCollection && R.result.featureCollection.features) || []; out.push(...fs); step && step(`${data} ${out.length}개`);
    const tp = +(R.page && R.page.total) || 1; if (page >= tp || fs.length < 1000) break;
  }
  return out;
}
/** lon/lat 중심 반경 R(m) → 그리기 자료 */
export async function loadSite(lon, lat, R = 500, step = () => {}) {
  const P = proj(lon, lat), V = vworld(), dLon = (R * 1.05) / P.kx, dLat = (R * 1.05) / P.ky, box = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => +v.toFixed(7));
  const inR = (pts) => pts.some(([x, y]) => x * x + y * y <= R * R), site = { lon, lat, R, buildings: [], zones: [], roads: [], green: [], water: [], trees: [], src: [], at: new Date().toISOString().slice(0, 10) };
  const ring = (c) => { const p = c.map(([a, b]) => P.fwd(a, b)); if (p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop(); return p; };
  // 1) 브이월드: 건물 · 용도지역
  if (V.key) {
    step('브이월드 건물 정보 받는 중…'); const fs = await vwLayer('LT_C_SPBD', box, V, step);
    for (const f of fs) { const pr = f.properties || {}, fl = +pick(pr, /gro_flo|grnd_?flr|flo_co|^flr/i) || 0, code = pick(pr, /bdtyp|prpos_code|use_cd|bld_use/i), nm = pick(pr, /buld_nm|bld_nm|bdnm/i), un = pick(pr, /prpos|usage|use_nm|bdtyp_nm/i);
      for (const c of ringsOf(f.geometry)) { const p = ring(c); if (p.length >= 3 && inR(p)) site.buildings.push({ p, f: fl || null, use: useOf(code, un || nm), name: nm || '', addr: pick(pr, /rd_nm|road|addr|rn_nm/i) || '', code: code || '' }); } }
    site.src.push('브이월드 도로명주소건물');
    step('용도지역 받는 중…');
    for (const L of ['LT_C_UQ111', 'LT_C_UQ112', 'LT_C_UQ113', 'LT_C_UQ114']) { try { const zs = await vwLayer(L, box, V, null, 2); for (const f of zs) { const pr = f.properties || {}, n = pick(pr, /uname|prpos_area|^name$|dgm_nm/i) || Object.values(pr).find((v) => typeof v === 'string' && /지역$|지구$/.test(v)) || ''; for (const c of ringsOf(f.geometry)) { const p = ring(c); if (p.length >= 3) site.zones.push({ p, name: n }); } } } catch (e) { if (L === 'LT_C_UQ111') step('용도지역은 건너뜀 (' + (e.code || '') + ')'); } }
    if (site.zones.length) site.src.push('브이월드 용도지역');
  }
  // 2) OpenStreetMap: 도로 · 녹지 · 물 · 나무 (+ 키가 없으면 건물)
  step('도로 · 녹지 받는 중 (OpenStreetMap)…');
  const around = `(around:${Math.round(R * 1.05)},${lat},${lon})`, q = `[out:json][timeout:60];(way["highway"]${around};way["leisure"~"park|garden|playground|pitch"]${around};way["landuse"~"grass|forest|recreation_ground|meadow"]${around};way["natural"~"water|wood"]${around};node["natural"="tree"]${around};${V.key ? '' : `way["building"]${around};`});out geom;`;
  let osm = null; for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) { try { osm = await getJson(host + '?data=' + encodeURIComponent(q)); break; } catch (e) { step('도로 서버 다시 시도…'); } }
  const RW = { motorway: 24, trunk: 22, primary: 20, secondary: 16, tertiary: 12, unclassified: 8, residential: 7, living_street: 6, service: 5, pedestrian: 5, footway: 2.2, path: 2, cycleway: 2.5, steps: 2 };
  for (const el of (osm && osm.elements) || []) {
    const t = el.tags || {};
    if (el.type === 'node' && t.natural === 'tree') { const p = P.fwd(el.lon, el.lat); if (p[0] ** 2 + p[1] ** 2 <= R * R) site.trees.push(p); continue; }
    if (!el.geometry) continue; const pts = el.geometry.map((g) => P.fwd(g.lon, g.lat)); if (!inR(pts)) continue;
    if (t.highway) { const base = t.highway.replace(/_link$/, ''); if (!(base in RW)) continue; const w = t.lanes ? Math.max(5, +t.lanes * 3.2 + 1) : t.width ? +t.width || RW[base] : RW[base]; site.roads.push({ p: pts, w, k: base, name: t.name || '' }); }
    else if (t.building) { const p = pts.slice(0, -1); if (p.length >= 3) site.buildings.push({ p, f: +t['building:levels'] || null, use: useOf('', `${t.building} ${t.shop || ''} ${t.amenity || ''} ${t.office || ''}`), name: t.name || '', addr: t['addr:street'] || '' }); }
    else if (t.natural === 'water') site.water.push({ p: pts.slice(0, -1) });
    else site.green.push({ p: pts.slice(0, -1) });
  }
  if (osm) site.src.push('OpenStreetMap');
  if (!V.key) site.src.push('건물: OpenStreetMap (층수가 비어 있으면 3층으로)');
  step(`✓ 건물 ${site.buildings.length} · 도로 ${site.roads.length} · 용도지역 ${site.zones.length} · 나무 ${site.trees.length}`);
  return site;
}

/* ---------- 3D (배경 묶음) ---------- */
export const siteFloors = (b) => b.f || (b.use === '공동주택' ? 12 : b.use === '단독주택' ? 2 : 3);
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
/** S = site, o = { color: 'use'|'floors'|'zone', hk, trees, zones, skip: 건물 번호(도면으로 그린 상가) , ax, ay: 기준점(m) } → THREE.Group (건물 고르기용 userData.site) */
export function buildSiteGroup(S, o = {}) {
  const g = new THREE.Group(), MMk = 1, ax = o.ax || 0, ay = o.ay || 0, hk = o.hk ?? 1, H = 3.3, mats = new Map(), byCol = new Map();
  const M = (col, opt = {}) => { const k = col + JSON.stringify(opt); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, ...opt })); return mats.get(k); };
  const flat = (pts, y, col, opt = {}) => { opt = { side: THREE.DoubleSide, ...opt }; if (!pts || pts.length < 3) return; const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x - ax, -(z - ay)))); const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); return new THREE.Mesh(geo, M(col, opt)); };
  // 땅 (반경 원)
  const disc = new THREE.Mesh(new THREE.CircleGeometry(S.R * 1.04, 96), M('#eef0ee')); disc.rotation.x = -Math.PI / 2; disc.position.set(-ax, -0.06, -ay); disc.receiveShadow = true; g.add(disc);
  if (o.zones !== false && o.color === 'zone') for (const z of S.zones || []) { const m = flat(z.p, -0.04, zoneColor(z.name), { transparent: true, opacity: 0.75 }); if (m) g.add(m); }
  for (const w of S.water || []) { const m = flat(w.p, -0.035, '#9cc8e8'); if (m) g.add(m); }
  for (const gr of S.green || []) { const m = flat(gr.p, -0.03, '#cfe5c3'); if (m) g.add(m); }
  // 도로: 마디마다 띠
  const road = [], walk = [];
  for (const r of S.roads || []) { const P = r.p, w = r.w, foot = w < 3; for (let i = 1; i < P.length; i++) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.2) continue; const bx = new THREE.BoxGeometry(L + (foot ? 0 : w * 0.5), 0.02, w); bx.rotateY(-Math.atan2(y1 - y0, x1 - x0)); bx.translate((x0 + x1) / 2 - ax, foot ? -0.012 : -0.02, (y0 + y1) / 2 - ay); (foot ? walk : road).push(bx.toNonIndexed()); } }
  if (road.length) { const m = new THREE.Mesh(mergeGeometries(road), M('#5b5f66')); m.receiveShadow = true; g.add(m); } if (walk.length) g.add(new THREE.Mesh(mergeGeometries(walk), M('#d7d3cb')));
  // 건물: 색마다 합치고, 삼각형 번호 → 건물 번호 표
  (S.buildings || []).forEach((b, i) => {
    if (o.skip != null && o.skip === i) return; const p = area(b.p) > 0 ? b.p : b.p.slice().reverse(); if (p.length < 3) return;
    const fl = siteFloors(b), h = Math.max(2.8, fl * H * hk), col = o.color === 'floors' ? floorCol(fl) : o.color === 'zone' ? '#e9ebee' : UCOL[b.use] || UCOL['기타'];
    let geo; try { geo = new THREE.ExtrudeGeometry(new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x - ax, -(z - ay)))), { depth: h, bevelEnabled: false }); } catch { return; }
    geo.rotateX(-Math.PI / 2); geo = geo.toNonIndexed(); if (!byCol.has(col)) byCol.set(col, []); byCol.get(col).push([geo, i]);
  });
  for (const [col, list] of byCol) { const ranges = []; let t = 0; for (const [geo, i] of list) { const n = geo.attributes.position.count / 3; ranges.push([t, t + n, i]); t += n; } const m = new THREE.Mesh(mergeGeometries(list.map((q) => q[0]).map((q) => { q.deleteAttribute('uv'); return q; })), M(col)); m.castShadow = m.receiveShadow = true; m.userData.site = ranges; g.add(m); list.forEach(([q]) => q.dispose()); }
  // 나무
  if (o.trees !== false && (S.trees || []).length) { const tr = [], cr = []; for (const [x, y] of S.trees.slice(0, 1500)) { const t = new THREE.CylinderGeometry(0.12, 0.16, 2.4, 5); t.translate(x - ax, 1.2, y - ay); tr.push(t.toNonIndexed()); const c = new THREE.IcosahedronGeometry(1.5, 0); c.scale(1, 1.15, 1); c.translate(x - ax, 3.3, y - ay); cr.push(c.toNonIndexed()); } [tr, cr].forEach((L, k) => { L.forEach((q) => { q.deleteAttribute('uv'); }); const m = new THREE.Mesh(mergeGeometries(L), M(k ? '#5f9a52' : '#6b5040')); m.castShadow = true; g.add(m); }); }
  g.userData.siteRoot = true; return g;
}
const floorCol = (f) => (f >= 15 ? '#2f4f8f' : f >= 8 ? '#4f78b8' : f >= 5 ? '#7aa0d4' : f >= 3 ? '#a9c4e6' : '#d6e3f2');
/** 겹친 삼각형 번호 → 건물 번호 */
export function siteHit(hit) { const R = hit && hit.object && hit.object.userData.site; if (!R) return null; const f = hit.faceIndex; for (const [a, b, i] of R) if (f >= a && f < b) return i; return null; }
