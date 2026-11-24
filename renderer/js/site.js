// 상권 보기 (v2.1.28): 주소 → 좌표 → 반경 500m 공공데이터(브이월드) · OpenStreetMap → 단순 3D 매스
// - 건물: 브이월드 도로명주소건물(LT_C_SPBD, 지상층수 · 용도) · 키가 없으면 OSM 건물
// - 용도지역: 브이월드 LT_C_UQ111~114 (키가 있을 때)
// - 도로 · 공원 · 물 · 가로수: OpenStreetMap (Overpass, 키 없음)
// 좌표: 중심(경위도)에서 m 단위 평면 (x = 동쪽 +, y = 남쪽 + — 도면과 같은 방향)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { secretsChanged } from './cloud.js';

/* ---------- 키 · 네트워크 ---------- */
const LS = 'byr.vworld';
export const vworld = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null') || {}; } catch { return {}; } };
export const setVworld = (v) => { try { localStorage.setItem(LS, JSON.stringify(v || {})); } catch {} secretsChanged(); };
export class NetError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
/** PC 앱 = 메인 프로세스 · 안드로이드 = 네이티브 HTTP · 그 밖 = fetch */
export async function netGet(url) {
  if (window.byr && window.byr.netGet) { const r = await window.byr.netGet(url); if (!r.ok) throw new NetError('E-NET' + (r.status || ''), r.text.slice(0, 160)); return r.text; }
  const CH = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (CH && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) { const r = await CH.request({ url, method: 'GET', responseType: 'text' }); if (r.status >= 400) throw new NetError('E-NET' + r.status, String(r.data).slice(0, 160)); return typeof r.data === 'string' ? r.data : JSON.stringify(r.data); }
  const r = await fetch(url); if (!r.ok) throw new NetError('E-NET' + r.status, (await r.text()).slice(0, 160)); return r.text();
}
/** 그림(타일) 받기 → Uint8Array */
export async function netBin(url) {
  if (window.byr && window.byr.netBin) { const r = await window.byr.netBin(url); if (!r.ok) throw new NetError('E-NET' + (r.status || ''), String(r.text || '').slice(0, 160)); return r.data; }
  const CH = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
  if (CH && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) { const r = await CH.request({ url, method: 'GET', responseType: 'blob' }); if (r.status >= 400) throw new NetError('E-NET' + r.status, ''); const b = atob(r.data), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  const r = await fetch(url); if (!r.ok) throw new NetError('E-NET' + r.status, ''); return new Uint8Array(await r.arrayBuffer());
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
/** opt: { dem: false (지형 생략), zones: false (용도지역 생략), pages: 건물 최대 쪽수(1쪽 1000동), bigWater: 강 · 호수 면(여러 선 relation)까지 } */
export async function loadSite(lon, lat, R = 500, step = () => {}, opt = {}) {
  const P = proj(lon, lat), V = vworld(), dLon = (R * 1.05) / P.kx, dLat = (R * 1.05) / P.ky, box = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => +v.toFixed(7));
  const inR = (pts) => pts.some(([x, y]) => x * x + y * y <= R * R), lineInR = (pts) => inR(pts) || pts.some((q, k) => { if (!k) return false; const p = pts[k - 1], dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, -(p[0] * dx + p[1] * dy) / L2)); return Math.hypot(p[0] + dx * t, p[1] + dy * t) <= R; }), site = { lon, lat, R, buildings: [], zones: [], roads: [], green: [], water: [], rivers: [], trees: [], src: [], at: new Date().toISOString().slice(0, 10) };
  const ring = (c) => { const p = c.map(([a, b]) => P.fwd(a, b)); if (p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) p.pop(); return p; };
  // 1) 브이월드: 건물 · 용도지역
  if (V.key) {
    step('브이월드 건물 정보 받는 중…'); const fs = await vwLayer('LT_C_SPBD', box, V, step, opt.pages || 6);
    if (fs[0]) { const pr = fs[0].properties || {}; site.raw = Object.fromEntries(Object.entries(pr).slice(0, 30).map(([k, v]) => [k, String(v).slice(0, 24)])); step('건물 필드: ' + Object.entries(site.raw).map(([k, v]) => k + '=' + v).join(', ')); }
    for (const f of fs) { const pr = f.properties || {}, fl = +pick(pr, /gro_flo|grnd_?flr|flo_co|^flr/i) || 0, code = pick(pr, /bdtyp|prpos_code|use_cd|bld_use/i), nm = pick(pr, /buld_nm|bld_nm|bdnm/i), un = pick(pr, /prpos|usage|use_nm|bdtyp_nm/i);
      for (const c of ringsOf(f.geometry)) { const p = ring(c); if (p.length >= 3 && inR(p)) site.buildings.push({ p, f: fl || null, use: useOf(code, un || nm), name: nm || '', addr: pick(pr, /rd_nm|road|addr|rn_nm/i) || '', code: code || '', pnu: pnuOf(pr) }); } }
    site.src.push('브이월드 도로명주소건물');
    if (opt.zones !== false) step('용도지역 받는 중…');
    if (opt.zones !== false) for (const L of ['LT_C_UQ111', 'LT_C_UQ112', 'LT_C_UQ113', 'LT_C_UQ114']) { try { const zs = await vwLayer(L, box, V, null, 2); for (const f of zs) { const pr = f.properties || {}, n = pick(pr, /uname|prpos_area|^name$|dgm_nm/i) || Object.values(pr).find((v) => typeof v === 'string' && /지역$|지구$/.test(v)) || ''; for (const c of ringsOf(f.geometry)) { const p = ring(c); if (p.length >= 3) site.zones.push({ p, name: n }); } } } catch (e) { if (L === 'LT_C_UQ111') step('용도지역은 건너뜀 (' + (e.code || '') + ')'); } }
    if (site.zones.length) site.src.push('브이월드 용도지역');
  }
  // 2) OpenStreetMap: 도로 · 녹지 · 물 · 나무 (+ 키가 없으면 건물)
  step('도로 · 녹지 받는 중 (OpenStreetMap)…');
  const around = `(around:${Math.round(R * 1.05)},${lat},${lon})`, q = `[out:json][timeout:60];(way["highway"]${around};way["leisure"~"park|garden|playground|pitch"]${around};way["landuse"~"grass|forest|recreation_ground|meadow"]${around};way["natural"~"water|wood"]${around};way["waterway"~"river|stream|canal|riverbank"]${around};${opt.bigWater ? `relation["natural"="water"]${around};relation["waterway"="riverbank"]${around};` : ''}node["natural"="tree"]${around};${V.key ? '' : `way["building"]${around};`});out geom;`;
  let osm = null; for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) { try { osm = await getJson(host + '?data=' + encodeURIComponent(q)); break; } catch (e) { step('도로 서버 다시 시도…'); } }
  const RW = { motorway: 24, trunk: 22, primary: 20, secondary: 16, tertiary: 12, unclassified: 8, residential: 7, living_street: 6, service: 5, pedestrian: 5, footway: 2.2, path: 2, cycleway: 2.5, steps: 2 };
  for (const el of (osm && osm.elements) || []) {
    const t = el.tags || {};
    if (el.type === 'node' && t.natural === 'tree') { const p = P.fwd(el.lon, el.lat); if (p[0] ** 2 + p[1] ** 2 <= R * R) site.trees.push(p); continue; }
    if (el.type === 'relation') { for (const rg of joinRings((el.members || []).filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry.map((g) => P.fwd(g.lon, g.lat))))) if (rg.length > 2) site.water.push({ p: rg, big: 1 }); continue; } /* 강 · 호수 (여러 선으로 된 면) */
    if (!el.geometry) continue; const pts = el.geometry.map((g) => P.fwd(g.lon, g.lat)); if (!((t.highway || t.waterway) ? lineInR(pts) : inR(pts))) continue;
    if (t.waterway) { if (t.waterway === 'riverbank') site.water.push({ p: pts.slice(0, -1) }); else site.rivers.push({ p: pts, w: t.waterway === 'river' ? 14 : t.waterway === 'canal' ? 8 : 4, name: t.name || '' }); continue; }
    if (t.highway) { const base = t.highway.replace(/_link$/, ''); if (!(base in RW)) continue; const w = t.lanes ? Math.max(5, +t.lanes * 3.2 + 1) : t.width ? +t.width || RW[base] : RW[base]; site.roads.push({ p: pts, w, k: base, name: t.name || '' }); }
    else if (t.building) { const p = pts.slice(0, -1); if (p.length >= 3) site.buildings.push({ p, f: +t['building:levels'] || null, use: useOf('', `${t.building} ${t.shop || ''} ${t.amenity || ''} ${t.office || ''}`), name: t.name || '', addr: t['addr:street'] || '' }); }
    else if (t.natural === 'water') site.water.push({ p: pts.slice(0, -1) });
    else site.green.push({ p: pts.slice(0, -1) });
  }
  if (osm) site.src.push('OpenStreetMap');
  // 도로가 비면 브이월드 도로(도로명주소 도로)로 대신
  if (!site.roads.length && V.key) { step('도로를 브이월드에서 받는 중…'); try { const rs = await vwLayer('LT_L_SPRD', box, V, null, 3); for (const f of rs) { const pr = f.properties || {}, g = f.geometry || {}, lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []; const w = +pick(pr, /road_bt|rd_bt|width|rbp_cn|^bt$/i) || 8; for (const c of lines) { const pts = c.map(([a, b]) => P.fwd(a, b)); if (inR(pts)) site.roads.push({ p: pts, w: Math.max(3, w), k: 'vworld', name: pick(pr, /rn$|rd_nm|road_nm|rn_nm/i) || '' }); } } if (site.roads.length) site.src.push('브이월드 도로'); else step('브이월드 도로도 비었어요'); } catch (e) { step('브이월드 도로 실패 (' + (e.code || e.message) + ')'); } }
  if (opt.dem !== false) try { await loadDem(site, step); } catch (e) { step('지형은 건너뜀 (' + (e.code || e.message) + ')'); }
  // 찾은 주소 건물 (중심점이 들어 있는 건물 → 없으면 30m 안 가장 가까운 건물)
  site.hit = site.buildings.findIndex((b) => inPoly(0, 0, b.p)); if (site.hit < 0) { let best = 30, k = -1; site.buildings.forEach((b, i) => { const c = cen(b.p), d = Math.hypot(c[0], c[1]); if (d < best) { best = d; k = i; } }); site.hit = k; }
  if (!V.key) site.src.push('건물: OpenStreetMap (층수가 비어 있으면 3층으로)');
  step(`✓ 건물 ${site.buildings.length} · 도로 ${site.roads.length} · 용도지역 ${site.zones.length} · 나무 ${site.trees.length}`);
  return site;
}

/** 끝점이 맞닿는 선들을 이어 닫힌 고리로 (OSM 여러 선 면) */
function joinRings(lines) {
  const out = [], L = lines.map((l) => l.slice()), same = (a, b) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  while (L.length) { let r = L.shift(); for (let guard = 0; guard < 500 && !same(r[0], r[r.length - 1]); guard++) { const k = L.findIndex((l) => same(l[0], r[r.length - 1]) || same(l[l.length - 1], r[r.length - 1])); if (k < 0) break; const l = L.splice(k, 1)[0]; r = r.concat(same(l[0], r[r.length - 1]) ? l.slice(1) : l.reverse().slice(1)); } if (same(r[0], r[r.length - 1])) r.pop(); out.push(r); }
  return out;
}
/* ---------- 건축물대장 (공공데이터포털 건축HUB 표제부): 높이 · 층수 · 주용도 · 연면적 · 사용승인 ---------- */
const pnuOf = (pr) => { for (const v of Object.values(pr || {})) { const s = String(v); if (/^\d{19}$/.test(s)) return s; } return null; };
export function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
const cen = (P) => [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];
async function ledgerOf(pnu, key) {
  const q = `sigunguCd=${pnu.slice(0, 5)}&bjdongCd=${pnu.slice(5, 10)}&platGbCd=${pnu[10] === '2' ? 1 : 0}&bun=${pnu.slice(11, 15)}&ji=${pnu.slice(15, 19)}&numOfRows=50&pageNo=1&_type=json&serviceKey=${encodeURIComponent(key)}`;
  let last; for (const ep of ['https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo', 'https://apis.data.go.kr/1613000/BldRgstService_v2/getBrTitleInfo']) {
    try { const t = await netGet(ep + '?' + q); if (/SERVICE_KEY|SERVICE KEY|등록되지 않은/i.test(t)) throw new NetError('E-KEY', '공공데이터포털 키가 이 서비스에 등록되지 않았어요'); const j = JSON.parse(t), it = j && j.response && j.response.body && j.response.body.items && j.response.body.items.item; return it ? (Array.isArray(it) ? it : [it]) : []; }
    catch (e) { last = e; if (e.code === 'E-KEY') throw e; }
  }
  throw last;
}
/** 건물마다 지번(PNU)으로 대장을 찾아 높이 · 용도를 채운다. 같은 지번 여러 동이면 이름 → 층수가 가까운 것 */
export async function enrichLedger(site, key, step = () => {}) {
  const by = new Map(); site.buildings.forEach((b, i) => { if (b.pnu) { if (!by.has(b.pnu)) by.set(b.pnu, []); by.get(b.pnu).push(i); } });
  if (!by.size) { step('건물에 지번(PNU)이 없어 건축물대장을 건너뛰어요'); return 0; }
  const keys = [...by.keys()]; let done = 0, ok = 0, err = 0, idx = 0;
  const work = async () => { while (idx < keys.length) { const pnu = keys[idx++]; try { const L = await ledgerOf(pnu, key); for (const i of by.get(pnu)) { const b = site.buildings[i]; let t = L.find((x) => b.name && x.bldNm && String(x.bldNm).includes(b.name)) || L.slice().sort((a, c) => Math.abs((+a.grndFlrCnt || 0) - (b.f || 0)) - Math.abs((+c.grndFlrCnt || 0) - (b.f || 0)))[0]; if (!t) continue;
      const h = +t.heit || 0; if (h > 1) b.h = Math.round(h * 10) / 10; if (+t.grndFlrCnt) b.f = +t.grndFlrCnt; if (t.mainPurpsCdNm) { b.use = useOf(t.mainPurpsCd, t.mainPurpsCdNm); b.useNm = t.mainPurpsCdNm; } if (+t.totArea) b.area = Math.round(+t.totArea); if (t.useAprDay) b.year = String(t.useAprDay).slice(0, 4); if (!b.name && t.bldNm) b.name = String(t.bldNm).trim(); b.ledger = 1; ok++; } }
      catch (e) { err++; if (e.code === 'E-KEY') { idx = keys.length; throw e; } } done++; if (done % 10 === 0 || done === keys.length) step(`건축물대장 ${done}/${keys.length} 지번 · 맞춘 건물 ${ok}`); } };
  await Promise.all([work(), work(), work(), work()]);
  if (ok) site.src.push('건축물대장'); step(`✓ 건축물대장: 건물 ${ok}개에 높이 · 용도${err ? ` (실패 ${err})` : ''}`); return ok;
}

/* ---------- 바닥 지도 (브이월드 배경지도 타일) ---------- */
export const MAPS = [['none', '끄기'], ['base', '일반지도'], ['sat', '위성'], ['hyb', '위성 + 도로 · 지명'], ['gray', '회색 지도']];
const tX = (lon, z) => ((lon + 180) / 360) * 2 ** z, tY = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z; };
const xLon = (x, z) => (x / 2 ** z) * 360 - 180, yLat = (y, z) => { const n = Math.PI - (2 * Math.PI * y) / 2 ** z; return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
const mapCache = new Map(); let redraw = () => {}; export const setSiteRedraw = (f) => (redraw = f);
const blobImg = (u8, type) => new Promise((ok, bad) => { const url = URL.createObjectURL(new Blob([u8], { type })), im = new Image(); im.onload = () => { URL.revokeObjectURL(url); ok(im); }; im.onerror = () => { URL.revokeObjectURL(url); bad(new Error('tile')); }; im.src = url; });
/** 반경을 덮는 타일을 이어 붙인 캔버스 + 범위(m, 중심 기준) · 같은 것은 다시 안 받음 */
export function siteMap(site, kind, near) {
  const V = vworld(); if (!kind || kind === 'none' || !V.key) return null; const mob = matchMedia('(pointer: coarse)').matches, maxT = near ? (mob ? 6 : 9) : mob ? 7 : 12;
  const key = `${site.lon},${site.lat},${site.R},${kind},${mob},${near ? near.join(',') : ''}`; if (mapCache.has(key)) return mapCache.get(key);
  const P = proj(site.lon, site.lat), D = near ? near[2] : site.R * 1.08, cxl = near ? site.lon + near[0] / P.kx : site.lon, cyl = near ? site.lat - near[1] / P.ky : site.lat; let z = near ? 19 : 18; for (; z > 12; z--) { const tm = (40075016 * Math.cos((site.lat * Math.PI) / 180)) / 2 ** z; if ((2 * D) / tm + 1 <= maxT) break; }
  const lon0 = cxl - D / P.kx, lon1 = cxl + D / P.kx, lat0 = cyl + D / P.ky, lat1 = cyl - D / P.ky, x0 = Math.floor(tX(lon0, z)), x1 = Math.floor(tX(lon1, z)), y0 = Math.floor(tY(lat0, z)), y1 = Math.floor(tY(lat1, z));
  const cv = document.createElement('canvas'); cv.width = (x1 - x0 + 1) * 256; cv.height = (y1 - y0 + 1) * 256; const g = cv.getContext('2d'); g.fillStyle = '#e9ebe6'; g.fillRect(0, 0, cv.width, cv.height);
  const nw = P.fwd(xLon(x0, z), yLat(y0, z)), se = P.fwd(xLon(x1 + 1, z), yLat(y1 + 1, z)), out = { cv, b: [nw[0], nw[1], se[0], se[1]], ver: 0, z, kind, err: 0 };
  const L = kind === 'base' ? [['Base', 'png']] : kind === 'gray' ? [['white', 'png']] : kind === 'sat' ? [['Satellite', 'jpeg']] : [['Satellite', 'jpeg'], ['Hybrid', 'png']];
  const jobs = []; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]); let n = 0;
  const work = async () => { while (jobs.length) { const [x, y] = jobs.shift(); for (const [lay, ext] of L) { try { const u = await netBin(`https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(V.key)}/${lay}/${z}/${y}/${x}.${ext}`); const im = await blobImg(u, ext === 'png' ? 'image/png' : 'image/jpeg'); g.drawImage(im, (x - x0) * 256, (y - y0) * 256); } catch (e) { out.err++; } } if (++n % 6 === 0) { out.ver++; redraw(); } } };
  out.ready = Promise.all([work(), work(), work(), work()]).then(() => { out.ver++; out.done = true; redraw(); }); mapCache.set(key, out); return out;
}

/* ---------- 3D (배경 묶음) ---------- */
export const siteH = (b, hk = 1) => Math.max(2.8, (b.h || siteFloors(b) * 3.3) * hk);
export const siteFloors = (b) => b.f || (b.use === '공동주택' ? 12 : b.use === '단독주택' ? 2 : 3);
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
/** S = site, o = { color: 'use'|'floors'|'zone', hk, trees, zones, skip: 건물 번호(도면으로 그린 상가) , ax, ay: 기준점(m) } → THREE.Group (건물 고르기용 userData.site) */
/* ---------- 지형 (AWS Terrain Tiles · terrarium PNG, 키 없음 · 한국 약 30m) ---------- */
export const DEM_SRC = 'AWS Terrain Tiles (약 30m)';
export async function loadDem(site, step = () => {}) {
  const P = proj(site.lon, site.lat), D = site.R * 1.12, z = 15; step('지형(높이) 받는 중…');
  const x0 = Math.floor(tX(site.lon - D / P.kx, z)), x1 = Math.floor(tX(site.lon + D / P.kx, z)), y0 = Math.floor(tY(site.lat + D / P.ky, z)), y1 = Math.floor(tY(site.lat - D / P.ky, z));
  const cv = document.createElement('canvas'); cv.width = (x1 - x0 + 1) * 256; cv.height = (y1 - y0 + 1) * 256; const g = cv.getContext('2d', { willReadFrequently: true }); let bad = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { try { const u = await netBin(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`), im = await blobImg(u, 'image/png'); g.drawImage(im, (x - x0) * 256, (y - y0) * 256); } catch { bad++; } }
  if (bad === (x1 - x0 + 1) * (y1 - y0 + 1)) throw new NetError('E-DEM', '지형 타일을 받지 못했어요');
  const px = g.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
  const hpx = (fx, fy) => { const ix = Math.max(0, Math.min(W - 2, Math.floor(fx))), iy = Math.max(0, Math.min(H - 2, Math.floor(fy))), tx = fx - ix, ty = fy - iy, v = (a, b) => { const k = (b * W + a) * 4; return px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768; }; return v(ix, iy) * (1 - tx) * (1 - ty) + v(ix + 1, iy) * tx * (1 - ty) + v(ix, iy + 1) * (1 - tx) * ty + v(ix + 1, iy + 1) * tx * ty; };
  const at = (xm, ym) => { const lon = site.lon + xm / P.kx, lat = site.lat - ym / P.ky; return hpx((tX(lon, z) - x0) * 256, (tY(lat, z) - y0) * 256); };
  const gs = Math.max(5, Math.round((2 * D) / 160)), n = Math.ceil((2 * D) / gs) + 1, h0 = at(0, 0), h = new Array(n * n); let mn = 1e9, mx = -1e9;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = Math.round((at(-D + i * gs, -D + j * gs) - h0) * 10); h[j * n + i] = v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
  site.dem = { g: gs, n, x0: -D, y0: -D, h, min: mn / 10, max: mx / 10, base: Math.round(h0 * 10) / 10, src: DEM_SRC }; if (!site.src.includes(DEM_SRC)) site.src.push(DEM_SRC);
  step(`✓ 지형: 높이 차 ${Math.round((mx - mn) / 10)}m (해발 ${Math.round(h0)}m 기준)`); return site.dem;
}
/** 지형 높이 (m, 가운데 = 0) · 없으면 0 */
export function demAt(dem, x, y) { if (!dem) return 0; const fx = (x - dem.x0) / dem.g, fy = (y - dem.y0) / dem.g, n = dem.n, i = Math.max(0, Math.min(n - 2, Math.floor(fx))), j = Math.max(0, Math.min(n - 2, Math.floor(fy))), tx = Math.min(1, Math.max(0, fx - i)), ty = Math.min(1, Math.max(0, fy - j)), H = dem.h; return ((H[j * n + i] * (1 - tx) + H[j * n + i + 1] * tx) * (1 - ty) + (H[(j + 1) * n + i] * (1 - tx) + H[(j + 1) * n + i + 1] * tx) * ty) / 10; }
export const contourStep = (dem, v) => (v && v !== 'auto' ? +v : !dem ? 2 : dem.max - dem.min < 12 ? 1 : dem.max - dem.min < 40 ? 2 : dem.max - dem.min < 150 ? 5 : 10);
/** 등고선 (격자 칸마다 선분) → [[x1,y1,x2,y2,높이], ...] */
export function contours(dem, step) {
  const out = [], n = dem.n, H = (i, j) => dem.h[j * n + i] / 10, X = (i) => dem.x0 + i * dem.g, Y = (j) => dem.y0 + j * dem.g;
  for (let lv = Math.ceil(dem.min / step) * step; lv <= dem.max; lv += step) for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = H(i, j), b = H(i + 1, j), c = H(i + 1, j + 1), d = H(i, j + 1), P = []; const e = (v1, v2, x1, y1, x2, y2) => { if ((v1 < lv) !== (v2 < lv)) { const t = (lv - v1) / (v2 - v1); P.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
    e(a, b, X(i), Y(j), X(i + 1), Y(j)); e(b, c, X(i + 1), Y(j), X(i + 1), Y(j + 1)); e(c, d, X(i + 1), Y(j + 1), X(i), Y(j + 1)); e(d, a, X(i), Y(j + 1), X(i), Y(j));
    if (P.length >= 2) out.push([P[0][0], P[0][1], P[1][0], P[1][1], lv]); if (P.length === 4) out.push([P[2][0], P[2][1], P[3][0], P[3][1], lv]);
  }
  return out;
}
/** o: color, hk, tk(지형 과장), trees, roads, zones, map, model(건축 모형), terrain, contour, skip, ax, ay */
export function buildSiteGroup(S, o = {}) {
  const g = new THREE.Group(), ax = o.ax || 0, ay = o.ay || 0, hk = o.hk ?? 1, H = 3.3, mats = new Map(), byCol = new Map(), model = !!o.model, dem = o.terrain !== false ? S.dem : null, tk = o.tk ?? 1;
  const El = (x, y) => (dem ? demAt(dem, x, y) * tk : 0); /* 사이트 좌표(m) → 땅 높이 */
  const M = (col, opt = {}) => { const k = col + JSON.stringify(opt); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, ...opt })); return mats.get(k); };
  const C = model ? { ground: '#f4f4f2', road: '#e2e2e0', walk: '#ececea', water: '#d9d6ef', green: '#eef0ea', tree: '#fbfbfb', trunk: '#f1f1f1', line: '#9a9ca0', line5: '#6f7277' } : { ground: '#e9ece6', road: '#4a4e55', walk: '#d7d3cb', water: '#9cc8e8', green: '#cfe5c3', tree: '#5f9a52', trunk: '#6b5040', line: '#8a8f96', line5: '#5c6168' };
  const flat = (pts, y, col, opt = {}) => { opt = { side: THREE.DoubleSide, ...opt }; if (!pts || pts.length < 3) return; const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x - ax, -(z - ay)))); const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); if (dem) { const c = cen(pts), p = geo.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, El(p.getX(k) + ax, p.getZ(k) + ay) + y + 0.06); } else geo.translate(0, y, 0); return new THREE.Mesh(geo, M(col, opt)); };
  const MP = siteMap(S, o.map), onMap = !!MP;
  // 땅: 지형이 있으면 높이 격자 (지도는 그 위에 입힘), 없으면 평평한 원 + 지도판
  if (dem) {
    const n = dem.n, W = (n - 1) * dem.g, geo = new THREE.PlaneGeometry(W, W, n - 1, n - 1); geo.rotateX(-Math.PI / 2); const p = geo.attributes.position, uv = geo.attributes.uv, sk = o.skip != null && S.buildings[o.skip] ? S.buildings[o.skip].p : null;
    for (let k = 0; k < p.count; k++) { const sx = p.getX(k) + dem.x0 + W / 2, sy = p.getZ(k) + dem.y0 + W / 2; let y = El(sx, sy); if (sk && Math.hypot(sx - cen(sk)[0], sy - cen(sk)[1]) < 60 && (inPoly(sx, sy, sk) || near(sx, sy, sk, dem.g))) y = Math.min(y, -0.2); p.setXYZ(k, sx - ax, y - 0.08, sy - ay); if (MP) { const [x0, y0, x1, y1] = MP.b; uv.setXY(k, (sx - x0) / (x1 - x0), 1 - (sy - y0) / (y1 - y0)); } }
    geo.computeVertexNormals(); let mat; if (MP) { const tex = new THREE.CanvasTexture(MP.cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); const ver = () => { if (tex.userData.ver !== MP.ver) { tex.userData.ver = MP.ver; tex.needsUpdate = true; } }; const m = new THREE.Mesh(geo, mat); m.onBeforeRender = ver; m.userData.terrain = 1; g.add(m); }
    else { const m = new THREE.Mesh(geo, M(C.ground, { roughness: 1 })); m.receiveShadow = true; m.userData.terrain = 1; g.add(m); }
  } else {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(S.R * 1.04, 96), M(C.ground)); disc.rotation.x = -Math.PI / 2; disc.position.set(-ax, -0.06, -ay); disc.receiveShadow = true; g.add(disc);
    const plane = (MPx, y, po) => { const tex = new THREE.CanvasTexture(MPx.cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16; const [x0, y0, x1, y1] = MPx.b, pl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: po, polygonOffsetUnits: po })); pl.rotation.x = -Math.PI / 2; pl.position.set((x0 + x1) / 2 - ax, y, (y0 + y1) / 2 - ay); pl.onBeforeRender = () => { if (tex.userData.ver !== MPx.ver) { tex.userData.ver = MPx.ver; tex.needsUpdate = true; } }; g.add(pl); };
    if (MP) { plane(MP, -0.06, 8); disc.visible = false; if (o.skip != null || o.near) { const NP = siteMap(S, o.map, [ax, ay, o.nearR || 160]); if (NP) plane(NP, -0.05, 6); } }
  }
  if (o.zones) S.zones.forEach((z, k) => { const m = flat(z.p, -0.04, zoneColor(z.name), { transparent: true, opacity: onMap ? 0.45 : 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 4 - Math.min(3, k * 0.01), polygonOffsetUnits: 4 }); if (m) { m.renderOrder = 1; g.add(m); } });
  if (!onMap) for (const w of S.water || []) { const m = flat(w.p, -0.035, C.water); if (m) g.add(m); }
  if (!onMap) for (const gr of S.green || []) { const m = flat(gr.p, -0.03, C.green); if (m) g.add(m); }
  // 등고선
  if (dem && o.contour !== 'off') { const st = contourStep(dem, o.contour), L1 = [], L5 = []; for (const [x1, y1, x2, y2, lv] of contours(dem, st)) { const arr = Math.round(lv / st) % 5 === 0 ? L5 : L1; arr.push(x1 - ax, lv * tk + 0.05, y1 - ay, x2 - ax, lv * tk + 0.05, y2 - ay); }
    for (const [A, col] of [[L1, C.line], [L5, C.line5]]) if (A.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(A, 3)); const ls = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: onMap ? 0.75 : 0.9 })); ls.userData.contour = 1; g.add(ls); } }
  // 도로: 땅을 따라 깔리는 띠
  const road = [], walk = [];
  const ribbon = (P, w, lift) => { const pos = []; for (let i = 1; i < P.length; i++) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.2) continue; const nx = (-(y1 - y0) / L) * (w / 2), ny = ((x1 - x0) / L) * (w / 2), k = Math.max(1, Math.ceil(L / (dem ? dem.g / 2 : 1e9)));
      for (let s = 0; s < k; s++) { const t0 = s / k, t1 = (s + 1) / k, a = [x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0], b = [x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1], V = (q, sg) => [q[0] + nx * sg - ax, El(q[0] + nx * sg, q[1] + ny * sg) + lift, q[1] + ny * sg - ay], A1 = V(a, 1), A2 = V(a, -1), B1 = V(b, 1), B2 = V(b, -1); pos.push(...A1, ...B1, ...A2, ...A2, ...B1, ...B2); } }
    if (!pos.length) return null; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals(); return geo; };
  if (o.roads !== false) for (const r of S.roads || []) { const foot = r.w < 3, q = ribbon(r.p, r.w, foot ? 0.04 : 0.02); if (q) (foot ? walk : road).push(q); }
  const rm = (col, po) => M(col, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -po, polygonOffsetUnits: -po, ...(onMap ? { transparent: true, opacity: 0.82, depthWrite: false } : {}) });
  if (road.length) { const m = new THREE.Mesh(mergeGeometries(road), rm(C.road, 2)); m.receiveShadow = !onMap; m.renderOrder = 2; g.add(m); } if (walk.length) { const m = new THREE.Mesh(mergeGeometries(walk), rm(C.walk, 3)); m.renderOrder = 2; g.add(m); }
  // 건물: 땅 높이(외곽에서 가장 낮은 곳)부터 세움 · 색마다 합치고 삼각형 번호 → 건물 번호 표
  (S.buildings || []).forEach((b, i) => {
    if (o.skip != null && o.skip === i) return; const p = area(b.p) > 0 ? b.p : b.p.slice().reverse(); if (p.length < 3) return;
    const fl = siteFloors(b), h = Math.max(2.8, (b.h || fl * H) * hk), base = dem ? Math.min(...p.map(([x, y]) => El(x, y))) - 0.3 : 0, col = i === S.hit ? '#ff2d2d' : o.color === 'floors' ? floorCol(fl) : model || o.color === 'white' || o.color === 'zone' ? '#f1f2f4' : UCOL[b.use] || UCOL['기타'];
    let geo; try { geo = new THREE.ExtrudeGeometry(new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x - ax, -(z - ay)))), { depth: h + (dem ? 0.3 : 0), bevelEnabled: false }); } catch { return; }
    geo.rotateX(-Math.PI / 2); if (base) geo.translate(0, base, 0); geo = geo.toNonIndexed(); if (!byCol.has(col)) byCol.set(col, []); byCol.get(col).push([geo, i]);
  });
  for (const [col, list] of byCol) { const ranges = []; let t = 0; for (const [geo, i] of list) { const n = geo.attributes.position.count / 3; ranges.push([t, t + n, i]); t += n; } const m = new THREE.Mesh(mergeGeometries(list.map((q) => q[0]).map((q) => { q.deleteAttribute('uv'); return q; })), M(col)); m.castShadow = m.receiveShadow = true; m.userData.site = ranges; g.add(m); list.forEach(([q]) => q.dispose()); }
  // 나무 (모형 = 흰 공)
  if (o.trees !== false && (S.trees || []).length) { const tr = [], cr = []; for (const [x, y] of S.trees.slice(0, 1500)) { const e = El(x, y), t = new THREE.CylinderGeometry(0.12, 0.16, 2.4, 5); t.translate(x - ax, e + 1.2, y - ay); tr.push(t.toNonIndexed()); const c = model ? new THREE.IcosahedronGeometry(1.8, 2) : new THREE.IcosahedronGeometry(1.5, 0); if (!model) c.scale(1, 1.15, 1); c.translate(x - ax, e + (model ? 3.6 : 3.3), y - ay); cr.push(c.toNonIndexed()); } [tr, cr].forEach((L, k) => { L.forEach((q) => { q.deleteAttribute('uv'); }); const m = new THREE.Mesh(mergeGeometries(L), M(k ? C.tree : C.trunk)); m.castShadow = true; g.add(m); }); }
  // 찾은 주소 핀
  const hb = S.buildings && S.buildings[S.hit]; if (hb && o.skip == null) { /* 도면 작업 중에는 핀을 안 세움 */ const [cx, cy] = cen(hb.p), h = Math.max(2.8, (hb.h || siteFloors(hb) * H) * hk) + (dem ? Math.min(...hb.p.map(([x, y]) => El(x, y))) : 0), pin = new THREE.Group(), red = M('#ff2d2d', { emissive: '#ff2d2d', emissiveIntensity: 0.35 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 20), red); cone.rotation.x = Math.PI; cone.position.y = 3; const ball = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), red); ball.position.y = 8; const dot = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10), M('#ffffff')); dot.position.set(0, 8, 2.9);
    pin.add(cone, ball, dot); pin.scale.setScalar(Math.max(1, S.R / 160)); pin.position.set(cx - ax, h + 1, cy - ay); pin.userData.pin = 1; g.add(pin); }
  g.userData.siteRoot = true; return g;
}
const near = (x, y, P, d) => P.some((q, k) => { const r = P[(k + 1) % P.length], dx = r[0] - q[0], dy = r[1] - q[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - q[0]) * dx + (y - q[1]) * dy) / L2)); return Math.hypot(x - q[0] - dx * t, y - q[1] - dy * t) < d; });
/** 건물 바닥 높이 (지형 있을 때) */
export const siteBase = (S, b, tk = 1) => (S.dem ? Math.min(...b.p.map(([x, y]) => demAt(S.dem, x, y) * tk)) : 0);
const floorCol = (f) => (f >= 15 ? '#2f4f8f' : f >= 8 ? '#4f78b8' : f >= 5 ? '#7aa0d4' : f >= 3 ? '#a9c4e6' : '#d6e3f2');
/** 겹친 삼각형 번호 → 건물 번호 */
export function siteHit(hit) { const R = hit && hit.object && hit.object.userData.site; if (!R) return null; const f = hit.faceIndex; for (const [a, b, i] of R) if (f >= a && f < b) return i; return null; }
