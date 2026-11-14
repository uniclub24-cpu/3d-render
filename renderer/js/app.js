// 앱 상태 · 파일 관리(기존 데이터 가져오기 포함) · 태블릿 UI 연결
import { Engine } from './main.js';
import { findLegacyProjects, convertLegacy, isNextProject, emptyProject, reportText, defaultLight, FORMAT, migrate } from './legacy.js';
import { loadAsset, exportGLB, exportOBJ, openFiles, saveFile, extOf, ASSET_EXT, RES_EXT, bytesToB64, b64ToBytes } from './io.js';
import { MAT_LABEL } from './materials.js';
import { STYLES } from './styles3d.js';
import { Plan2D, KINDS, fitOpening } from './plan2d.js';
import * as cloud from './cloud.js';
import * as lib2 from './store.js';
import * as SL from './slope.js';
import { ENVTYPES, ENVCOL, ENVLV, envOf, envFront } from './env.js';
import { bakeParts, applyParts } from './design.js';
import { LINEKINDS, lineCat, XRN } from './lines.js';
import { ROLES, FAMN, SIMCOL } from './sim.js';
import { findFaces } from './rooms.js';
import { WFI } from './builder.js';
import * as SH from './shop.js';
import * as CAD from './cad.js';
import { initLang, setLang, lang } from './i18n.js';
export const APP_VERSION = '2.1.10';

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const S = { model: null, lib: {}, shapes: {}, assets: new Map(), undo: [], redo: [], um: [], rm: [], propsOpen: false, sel: null, panel: 'props', pane: 'split' };
let engine, plan;
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const level = () => (S.model ? S.model.levels[S.model.activeLevel] : null);
const selItem = () => level().items.find((i) => i.id === engine.selId) || null;

/* ---------- 알림 ---------- */
let toastT = 0;
function toast(msg, ms = 4200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }

/* ---------- 모델 · 되돌리기 ---------- */
const snap = () => JSON.stringify(S.model);
/** 작업 기록: 고칠 때마다 무엇이 몇 개 바뀌었는지 (되돌리기 칸과 짝) */
const cnts = () => { const L = level(); return L ? [L.items.length, L.walls.length, L.openings.length, (L.rooms || []).length, (L.lines || []).length, (L.dims || []).length, S.model.activeLevel, S.model.levels.length] : []; };
const CN = ['기물', '벽', '문/창', '공간', '설치물', '치수'];
function histLabel(a, b) { if (!a || a[6] !== b[6]) return a && a[7] !== b[7] ? `층 ${b[7] > a[7] ? '추가' : '삭제'}` : '층 · 설정'; const d = CN.map((n, i) => (b[i] !== a[i] ? `${n} ${b[i] > a[i] ? '+' : '−'}${Math.abs(b[i] - a[i])}` : '')).filter(Boolean); return d.join(' · ') || (S.sel ? `${{ item: '기물', wall: '벽', opening: '문/창', room: '공간' }[S.sel.kind] || ''} 수정`.trim() : '수정'); }
function commit() { const c = cnts(); S.undo.push(S.last); S.um.push({ t: Date.now(), l: histLabel(S.lastC, c) }); S.lastC = c; if (S.undo.length > 60) { S.undo.shift(); S.um.shift(); } S.redo.length = 0; S.rm.length = 0; S.last = snap(); syncBar(); afterChange(); if (S.panel === 'hist' && S.propsOpen) renderProps(); }
/** 고칠 때마다: 자동 저장 · 조정 필요 다시 세기 · 2D 다시 그리기 */
function afterChange() { lib2.autosave(S.model); refreshBad(); syncPins(); plan && plan.redraw(); }
function restore(json) {
  const sel = S.sel; S.model = JSON.parse(json); S.last = json; engine.setLevel(level()); applyEnv(); afterChange();
  const L = level(), still = sel && ({ item: L.items, wall: L.walls, opening: L.openings, room: L.rooms }[sel.kind] || []).some((q) => q.id === sel.id);
  setSel(still ? sel : null); syncBar();
}
function undo() { if (!S.undo.length) return; S.redo.push(S.last); S.rm.push(S.um.pop()); restore(S.undo.pop()); S.lastC = cnts(); }
function redo() { if (!S.redo.length) return; S.undo.push(S.last); S.um.push(S.rm.pop()); restore(S.redo.pop()); S.lastC = cnts(); }
async function setModel(model, fit = true) {
  if (S.model && S.model !== model) await lib2.flush();
  if (engine.sim.on) { engine.sim.stop(); plan.simA = null; syncSimBtn(); } if (engine.air.on) toggleAir(); if (engine.xray) setXray(null);
  S.model = migrate(model, S.lib); S.undo.length = S.redo.length = S.um.length = S.rm.length = 0; S.last = snap(); S.lastC = cnts(); setTimeout(syncPins); setFocus(null);
  await restoreAssets(); S.sel = null; engine.setLevel(level()); applyEnv(); loadRender(); syncCeilBtn(); if (fit) { engine.view('iso'); plan.fit(); } plan.select(null, true); syncBar(); renderProps();
  try { await lib2.saveLocal(S.model); setSaveState('이 기기에 저장됨'); } catch (e) { console.warn(e); } refreshBad(); if (cloud.session()) lib2.scheduleSync(2000);
}
function syncBar() {
  $('#projName').textContent = S.model.name; document.title = S.model.name + ' · BYR Next ' + APP_VERSION;
  $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length;
  const ls = $('#levelSel'); ls.hidden = S.model.levels.length < 2; ls.innerHTML = S.model.levels.map((l, i) => `<option value="${i}" ${i === S.model.activeLevel ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
}

/* ---------- 선택 (2D · 3D 공통) ---------- */
function setSel(sel) {
  S.sel = sel || null; plan.select(S.sel, true);
  if (S.sel && S.sel.kind === 'item') { if (engine.selId !== S.sel.id) engine.select(S.sel.id); }
  else { if (engine.selId) engine.select(null); const L = level(), w = S.sel && (S.sel.kind === 'wall' ? S.sel.id : S.sel.kind === 'opening' ? (L.openings.find((o) => o.id === S.sel.id) || {}).wall : null); engine.highlight(w || null); }
  if (S.sel) { S.propsOpen = true; S.panel = 'props'; } renderProps();
}
let liveT = 0;
const liveStructure = () => { if (liveT) return; liveT = requestAnimationFrame(() => { liveT = 0; engine.rebuildStructure(); }); };
const selWall = () => (S.sel && S.sel.kind === 'wall' ? level().walls.find((w) => w.id === S.sel.id) : null);
const selRoom = () => (S.sel && S.sel.kind === 'room' ? level().rooms.find((r) => r.id === S.sel.id) : null);
let saveStateT = 0;
function setSaveState(t) { const el = $('#saveState'); if (!el) return; el.textContent = t; el.title = t; }
/* ----- 조정 필요(구배 · 단에 묻힌 기물) ----- */
function refreshBad() {
  if (!S.model) return; const bad = SL.slopeBad(level(), S.lib); if (plan) plan.bad = bad;
  const f = $('#fitFab'); if (f) { f.hidden = !bad.length; f.textContent = `조정 필요 ${bad.length} · 일괄조정`; }
}
function fitItems(ids, msg) {
  let n = 0; for (const id of ids) { const it = level().items.find((q) => q.id === id); if (it && SL.fitable(it, S.lib)) { it.onSlope = true; n++; } }
  if (!n) return toast('맞출 기물이 없어요'); engine.replaceItems(); commit(); renderProps(); toast(msg || `기물 ${n}개를 구배 · 단 위로 올렸어요 (다리 가장 높은 곳 기준)`);
}
/* ----- 공간만 보기 ----- */
function setFocus(roomId) {
  const r = roomId && level() && level().rooms.find((q) => q.id === roomId); S.focus = r ? r.id : null;
  engine.setFocus(r ? r.pts : null); if (plan) { plan.focus = r ? r.pts : null; plan.redraw(); }
  const b = $('#focusBar'); if (b) { b.hidden = !r; if (r) $('#focusName').textContent = `"${r.name}" 만 작업 중`; }
  if (r) { engine.frame(r.pts); } 
}
const selOpening = () => (S.sel && S.sel.kind === 'opening' ? level().openings.find((o) => o.id === S.sel.id) : null);
function setPane(p) {
  S.pane = p; store.set('byr.pane', p); $('#stage').className = 'p' + p; $$('[data-pane]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pane === p)));
  requestAnimationFrame(() => { engine.resize(); plan.resize(); });
}
/** 렌더 설정(스타일 · 햇빛 · 노출 · 후처리)을 프로젝트에 저장 → 다시 열거나 다른 기기에서도 같게 */
const RENDER_KEYS = ['ssao', 'ssaoRadius', 'fxaa', 'shadows', 'sunHour', 'sunPower', 'exposure', 'itemLights'];
function saveRender() { if (!S.model) return; S.model.render = { style: engine.style, ...Object.fromEntries(RENDER_KEYS.map((k) => [k, engine.opt[k]])) }; lib2.autosave(S.model); }
function loadRender() { const r = S.model && S.model.render; if (!r) return; for (const k of RENDER_KEYS) if (r[k] != null && r[k] !== engine.opt[k]) engine.setOption(k, r[k]); if (r.style && STYLES[r.style] && r.style !== engine.style) setStyle(r.style, true); }
function setStyle(name, fromModel) {
  engine.setStyle(name); store.set('byr.style', name); plan.redraw(); if (!fromModel) saveRender();
  $('#styleMenu').innerHTML = Object.entries(STYLES).map(([k, st]) => `<button role="menuitemradio" aria-checked="${k === name}" data-style="${k}"><b>${st.name}</b><small>${st.hint}</small></button>`).join('');
  if (S.propsOpen && !S.sel) renderProps();
}

function applyEnv() { const L = level(); engine.setEnv(S.model.env ? envOf(S.model) : envOf(S.model), { slabH: L.slabH || 3300, ceilingH: L.ceilingH || 2700, above: false }); }

/* ---------- 파일 관리 ---------- */
// 프로젝트에 넣어 둔 외부 에셋(base64)을 다시 읽어 캐시에 올린다
async function restoreAssets() {
  for (const [key, a] of Object.entries(S.model.assets || {})) { if (S.assets.has(key)) continue; try { const res = Object.fromEntries(Object.entries(a.res || {}).map(([n, b]) => [n, b64ToBytes(b)])); const r = await loadAsset(a.name, b64ToBytes(a.b64), res); S.assets.set(key, r); } catch (e) { console.warn('asset', a.name, e); } }
}
/** JSON 파일 하나: 새 형식이면 열고, 기존 앱 형식이면 변환해서 연다 */
async function openJson(name, bytes) {
  let json; try { json = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { toast(`${name}: JSON 을 읽지 못했어요`); return false; }
  if (isNextProject(json)) { const bad = checkModel(json); if (bad) { toast(`${name}: 열 수 없는 프로젝트예요 (${bad}) · 지금 작업은 그대로예요`, 7000); return false; } if (!(await safeOpen(json))) return false; toast(`"${json.name}" 을 열었어요`); return true; }
  const found = findLegacyProjects(json);
  if (!found.length) { toast(`${name}: 프로젝트 데이터를 찾지 못했어요 (기존 앱의 "내보내기 → JSON" 파일인지 확인해 주세요)`); return false; }
  let conv; try { conv = convertLegacy(found[0], S.lib); } catch (e) { console.error(e); toast(`${name}: 변환하지 못했어요 (${e.message || e}) · 지금 작업은 그대로예요`, 7000); return false; }
  const { model, report } = conv; if (!(await safeOpen(model))) return false; toast(reportText(report) + (found.length > 1 ? ` · 파일 안 ${found.length}개 중 첫 번째` : ''), 9000);
  console.info('[legacy import]', report); return true;
}
/** 새 형식 프로젝트 검사 + 빠진 목록 채우기. 문제가 있으면 이유(문자열) */
function checkModel(m) {
  if (!Array.isArray(m.levels) || !m.levels.length) return '층 정보가 없어요';
  for (const L of m.levels) { if (!L || typeof L !== 'object') return '층 정보가 깨졌어요'; for (const k of ['walls', 'openings', 'items', 'rooms']) { if (L[k] == null) L[k] = []; if (!Array.isArray(L[k])) return `${k} 가 목록이 아니에요`; }
    if (L.walls.some((w) => ![w.x1, w.y1, w.x2, w.y2].every(Number.isFinite))) return '벽 좌표가 숫자가 아니에요';
    if (L.items.some((i) => ![i.x, i.y, i.w, i.d, i.h].every(Number.isFinite))) return '기물 좌표 · 크기가 숫자가 아니에요';
    L.floor ||= { color: '#c9c3b8', finish: 'tile' }; L.ceilingH ||= 2700; }
  if (!Number.isInteger(m.activeLevel) || !m.levels[m.activeLevel]) m.activeLevel = 0;
  m.id ||= uid('p'); m.name ||= '이름 없는 프로젝트'; return null;
}
/** 열다가 실패하면 지금 프로젝트 · 되돌리기 기록을 그대로 되살린다 */
async function safeOpen(model) {
  const prev = S.model && { json: snap(), undo: [...S.undo], redo: [...S.redo], um: [...S.um], rm: [...S.rm] };
  try { await setModel(model); return true; }
  catch (e) { console.error(e); if (prev) { S.model = JSON.parse(prev.json); S.last = prev.json; S.undo = prev.undo; S.redo = prev.redo; S.um = prev.um; S.rm = prev.rm; try { engine.setLevel(level()); applyEnv(); plan.fit(); syncBar(); renderProps(); } catch (e2) { console.error(e2); } } toast('열지 못했어요 (' + (e.message || e) + ') · 지금 작업은 그대로예요', 7000); return false; }
}
async function importAsset(name, bytes, resFiles = []) {
  try {
    const res = Object.fromEntries(resFiles.map((f) => [f.name, f.data]));
    const a = await loadAsset(name, bytes, res); S.assets.set(a.key, a);
    (S.model.assets ||= {})[a.key] = { name, b64: bytesToB64(bytes), ...(resFiles.length ? { res: Object.fromEntries(resFiles.map((f) => [f.name, bytesToB64(f.data)])) } : {}) }; // 프로젝트 파일에 함께 저장 (연결 파일 포함)
    if (a.missing.length) toast(`연결 파일 ${a.missing.length}개를 못 찾았어요 (${a.missing.slice(0, 3).join(', ')}) · 같은 폴더의 파일을 함께 골라 다시 가져오세요`, 8000);
    const c = engine.centerOnFloor(), it = { id: uid('i'), type: 'asset', name: name.replace(/\.[^.]+$/, ''), x: c.x, y: c.y, elev: 0, rot: 0, ...a.mm, color: null, mat: null, asset: { key: a.key }, light: null };
    level().items.push(it); engine.rebuildItem(it); engine.select(it.id); commit(); toast(`"${it.name}" 을 가져왔어요 · ${a.mm.w}×${a.mm.d}×${a.mm.h}mm (속성에서 크기를 바꿀 수 있어요)`);
  } catch (e) { console.error(e); toast(`${name}: 3D 파일을 읽지 못했어요 (${e.message || e})`); }
}
async function handleFiles(files) {
  const res = files.filter((f) => RES_EXT.includes(extOf(f.name))); // .bin · 텍스처는 같이 고른 모델의 연결 파일로
  for (const f of files) { const ext = extOf(f.name); if (ext === 'json') await openJson(f.name, f.data); else if (ext === 'dxf') dxfLoad(f.name, f.data); else if (ASSET_EXT.includes(ext)) await importAsset(f.name, f.data, ext === 'glb' ? [] : res); else if (!RES_EXT.includes(ext)) toast(`${f.name}: 지원하지 않는 형식이에요`); }
  if (res.length && !files.some((f) => ASSET_EXT.includes(extOf(f.name)))) toast('텍스처 · .bin 은 모델 파일(.gltf · .obj · .fbx)과 함께 골라 주세요');
}
const safeName = () => (S.model.name || 'byr').replace(/[\\/:*?"<>|]/g, '_');

const ACT = {
  new: async () => {
    const empty = !S.model || (S.model.levels.every((L) => !L.items.length && !L.rooms.length && L.walls.length <= 4) && !S.undo.length);
    if (!empty && !(await ask('새 프로젝트를 시작할까요?', `"${S.model.name}" 은 내 프로젝트에 저장돼 있어요. 지금 화면의 되돌리기 기록은 없어져요.`, [{ label: '취소', value: false }, { label: '새로 시작', value: true, kind: 'pri' }]))) return;
    const sz = await ask('매장 크기 (사각 매장 템플릿)', '바깥 벽 안쪽 기준 가로 × 세로예요. 만든 뒤 벽 끝점을 끌거나 벽 길이를 바꿔 맞출 수 있어요.', [['6×8', 6000, 8000], ['8×10', 8000, 10000], ['9×12', 9000, 12000], ['10×15', 10000, 15000], ['12×20', 12000, 20000], ['기본 8×6', 8000, 6000]].map(([n, w, d], i) => ({ label: `${n} m`, value: [w, d], kind: i === 5 ? 'pri' : '' })).concat([{ label: '취소', value: false }]));
    if (!sz) return; await lib2.flush(); await setModel(emptyProject('새 프로젝트', sz[0], sz[1])); toast(`새 프로젝트 · ${sz[0] / 1000}×${sz[1] / 1000}m · 이전 작업은 "내 프로젝트"에 있어요`);
  },
  home: () => showHome(),
  quit: () => quitApp(),
  library: () => { S.panel = 'library'; S.propsOpen = true; renderProps(); },
  xray: () => { S.panel = 'xray'; S.propsOpen = true; if (!engine.xray) setXray('floor'); renderProps(); },
  sim: () => { S.panel = 'sim'; S.propsOpen = true; renderProps(); },
  levels: () => { S.panel = 'levels'; S.propsOpen = true; renderProps(); },
  rooms: () => { S.panel = 'rooms'; S.propsOpen = true; renderProps(); },
  bg: () => { S.panel = 'bg'; S.propsOpen = true; renderProps(); },
  check: () => { S.panel = 'check'; S.propsOpen = true; renderProps(); },
  quote: () => { S.panel = 'quote'; S.propsOpen = true; renderProps(); },
  auto: () => { S.panel = 'auto'; S.propsOpen = true; renderProps(); },
  view: () => { S.panel = 'view'; S.propsOpen = true; renderProps(); },
  hist: () => { S.panel = 'hist'; S.propsOpen = true; renderProps(); },
  lang: () => { setLang(lang() === 'en' ? 'ko' : 'en'); renderProps(); if (!$('#home').hidden) renderHome(); toast(lang() === 'en' ? 'English screen (names in your project stay as they are)' : '한국어 화면으로 바꿨어요'); },
  sketch: () => setPlanTool('sketch'),
  cmt: () => { S.panel = 'cmt'; S.propsOpen = true; renderProps(); },
  pack: async () => { /* 블렌더 패키지: GLB(모든 층) + DXF + 프로젝트 + 견적 + 안내 를 zip 하나로 */
    setSel(null); toast('패키지를 만드는 중…'); const nm = safeName(), root = engine.buildAll(S.model.levels, (L) => (it) => SL.itemZ(L, it, S.lib)), glb = await exportGLB(root), dxf = CAD.dxfDoc(S.model.levels.map((L, i) => ({ level: L, pre: `F${i + 1}_` })), S.lib, (L, it) => SL.itemZ(L, it, S.lib));
    engine.disposeTree(root); const shot = Uint8Array.from(atob(engine.snapshot().split(',')[1]), (c) => c.charCodeAt(0)), rows = SH.bomRows(level(), S.lib), xl = SH.bomXlsx(rows, PRICE(), { title: `${S.model.name} 견적서`, sub: new Date().toLocaleDateString('ko-KR') + ' · BYR2', etcPct: store.get('byr.etc', 0), vat: store.get('byr.vat', true) });
    const readme = `${S.model.name} — BYR2 ${APP_VERSION} 패키지 (${new Date().toLocaleString('ko-KR')})\r\n\r\n- ${nm}.glb : 모든 층 3D (단위 m · Y 위). Blender: File > Import > glTF 2.0 / D5 · Twinmotion · SketchUp 에서도 가져오기\r\n- ${nm}.dxf : 평면 (mm · 층마다 F1_ · F2_ 레이어 · 기물은 블록)\r\n- ${nm}.byr.json : BYR2 프로젝트 (다시 열어서 고치기)\r\n- ${nm}_견적.xlsx : 지금 층 물량 · 단가 · 합계\r\n- ${nm}.png : 지금 화면\r\n\r\nBlender 팁: 가져온 뒤 렌더 엔진 Cycles · 조명은 기물 이름의 '조명' 을 Emission 으로 바꾸면 좋아요.\r\n`;
    const z = SH.zip([{ name: nm + '.glb', data: new Uint8Array(glb) }, { name: nm + '.dxf', data: dxf }, { name: nm + '.byr.json', data: JSON.stringify(S.model) }, { name: nm + '_견적.xlsx', data: xl }, { name: nm + '.png', data: shot }, { name: '읽어보기.txt', data: readme }]);
    if (await saveFile({ title: 'ZIP 패키지', defaultName: nm + '-패키지.zip', extensions: ['zip'], data: z })) toast(`패키지를 저장했어요 (${(z.length / 1e6).toFixed(1)}MB · GLB · DXF · 프로젝트 · 견적 · 이미지)`); },
  dxfIn: async () => { const f = (await openFiles({ title: 'DXF 도면', extensions: ['dxf'] }))[0]; if (f) dxfLoad(f.name, f.data); },
  dxfOut: async () => { const t = CAD.dxfDoc([{ level: level() }], S.lib, (L, it) => SL.itemZ(L, it, S.lib)); if (await saveFile({ title: 'DXF 도면', defaultName: `${safeName()}-${level().name || '층'}.dxf`, extensions: ['dxf'], data: t })) toast('DXF 로 내보냈어요 · 기물은 블록(이름 · 규격 속성)으로 들어가요'); },
  dxfAll: async () => { const t = CAD.dxfDoc(S.model.levels.map((L, i) => ({ level: L, pre: `F${i + 1}_` })), S.lib, (L, it) => SL.itemZ(L, it, S.lib)); if (await saveFile({ title: 'DXF 도면', defaultName: `${safeName()}-전체층.dxf`, extensions: ['dxf'], data: t })) toast(`${S.model.levels.length}개 층을 DXF 한 파일로 (층마다 F1_ · F2_ 레이어)`); },
  planImg: async () => { if (S.pane === '3d') { setPane('split'); await new Promise((r) => setTimeout(r, 120)); } const cv = $('#plan canvas') || plan.cv, c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, 0);
    const b = Uint8Array.from(atob(c.toDataURL('image/jpeg', 0.92).split(',')[1]), (x) => x.charCodeAt(0)); if (await saveFile({ title: 'JPEG 이미지', defaultName: safeName() + '-평면도.jpg', extensions: ['jpg'], data: b })) toast('평면도를 JPEG 로 저장했어요'); },
  open: async () => handleFiles(await openFiles({ title: 'BYR 프로젝트', extensions: ['json'] })),
  save: async () => { const p = await saveFile({ title: 'BYR 프로젝트', defaultName: safeName() + '.byr.json', extensions: ['json'], data: JSON.stringify(S.model) }); if (p) toast('저장했어요'); },
  legacy: async () => handleFiles(await openFiles({ title: '기존 앱 JSON', extensions: ['json'], multi: false })),
  sample: async () => { const r = await fetch('./data/legacy-sample.json'); await openJson('샘플', new Uint8Array(await r.arrayBuffer())); },
  asset: async () => handleFiles(await openFiles({ title: '3D 에셋 (연결된 .bin · 텍스처도 함께 고르세요)', extensions: [...ASSET_EXT, ...RES_EXT], multi: true })),
  glb: async () => { setSel(null); const data = await engine.withRealMaterials(() => exportGLB(engine.world)); const p = await saveFile({ title: 'glTF 바이너리', defaultName: safeName() + '.glb', extensions: ['glb'], data }); if (p) toast(`GLB 로 내보냈어요 (${(data.byteLength / 1e6).toFixed(1)}MB) · Blender · D5 Render · Twinmotion 에서 가져오기`); },
  glbAll: async () => { // 모든 층을 높이대로 쌓아서 한 파일로
    setSel(null); const root = engine.buildAll(S.model.levels, (L) => (it) => SL.itemZ(L, it, S.lib)); const data = await exportGLB(root); engine.disposeTree(root);
    const p = await saveFile({ title: 'glTF 바이너리', defaultName: safeName() + '-전체층.glb', extensions: ['glb'], data }); if (p) toast(`${S.model.levels.length}개 층을 GLB 로 내보냈어요 (${(data.byteLength / 1e6).toFixed(1)}MB)`); },
  obj: async () => { setSel(null); const p = await saveFile({ title: 'Wavefront OBJ', defaultName: safeName() + '.obj', extensions: ['obj'], data: exportOBJ(engine.world) }); if (p) toast('OBJ 로 내보냈어요 (형상만 · 재질은 GLB 를 쓰세요)'); },
  account: () => { S.panel = 'account'; S.propsOpen = true; renderProps(); },
  ai: () => { S.panel = 'ai'; S.propsOpen = true; renderProps(); },
  png: async () => { const b = Uint8Array.from(atob(engine.snapshot().split(',')[1]), (c) => c.charCodeAt(0)); const p = await saveFile({ title: 'PNG 이미지', defaultName: safeName() + '.png', extensions: ['png'], data: b }); if (p) toast('이미지를 저장했어요'); },
};

/* ---------- 기물 추가 · 수정 ---------- */
function addFromCatalog(id) {
  const L = S.lib[id]; if (!L) return; const lv = level(), c = engine.centerOnFloor();
  const elev = L.elev != null ? L.elev : L.layer === 'ceil' || L.layer === 'ceiling' ? lv.ceilingH - L.h : 0;
  const it = { id: uid('i'), type: id, name: L.name, x: c.x, y: c.y, elev, rot: 0, w: L.w, d: L.d, h: L.h, color: null, mat: null, parts: L.parts ? JSON.parse(JSON.stringify(L.parts)) : null, ...(L.parts ? { pb: { w: L.w, d: L.d, h: L.h } } : {}), light: L.light ? defaultLight(L) : null, kw: L.kw };
  lv.items.push(it); engine.rebuildItem(it); engine.select(it.id); commit(); closeDrawer(); setMode('move'); toast(`${L.name} 을 놓았어요 · 끌어서 자리를 잡으세요`);
}
function patchSel(patch, rebuild = true) { const it = selItem(); if (!it) return; Object.assign(it, patch); if (rebuild) engine.rebuildItem(it); else engine.moveItem(it); commit(); }

/* ---------- 속성 카드 (오른쪽 팝오버) ---------- */
const num = (label, key, v, step = 10) => `<label class="fld">${label}<input type="number" inputmode="numeric" data-k="${key}" value="${Math.round(v)}" step="${step}"></label>`;
function renderProps() {
  const el = $('#props'), body = $('#propsBody'); el.hidden = !S.propsOpen; $('#fab').setAttribute('aria-expanded', String(S.propsOpen)); if (!S.propsOpen) return;
  if (S.panel === 'ai') return renderAi(body);
  if (S.panel === 'design') return renderDesign(body);
  if (S.panel === 'library') return renderLibrary(body);
  if (S.panel === 'rooms') return renderRooms(body);
  if (S.panel === 'levels') return renderLevels(body);
  if (S.panel === 'xray') return renderXray(body);
  if (S.panel === 'sim') return renderSim(body);
  if (S.panel === 'bg') return renderBg(body);
  if (S.panel === 'check') return renderCheck(body);
  if (S.panel === 'quote') return renderQuote(body);
  if (S.panel === 'auto') return renderAuto(body);
  if (S.panel === 'cmp') return renderCmp(body);
  if (S.panel === 'view') return renderView(body);
  if (S.panel === 'hist') return renderHist(body);
  if (S.panel === 'cmt') return renderCmt(body);
  if (S.panel === 'multi' && (S.multi || []).length) return renderMulti(body);
  if (S.panel === 'dxf') return renderDxf(body);
  if (selRoom()) return renderRoom(body, selRoom());
  if (S.panel === 'account') return renderAccount(body);
  if (selWall()) return renderWall(body, selWall());
  if (selOpening()) return renderOpening(body, selOpening());
  const it = selItem();
  if (!it) { // 선택이 없으면 장면 설정
    const o = engine.opt, li = engine.lightInfo || { total: 0, on: 0 };
    $('#propsTitle').textContent = '장면 설정';
    body.innerHTML = `<div class="sec">보기 스타일 · 편집은 그대로 이어져요</div>
      <div class="chips">${Object.entries(STYLES).map(([k, st]) => `<button data-style="${k}" aria-pressed="${engine.style === k}">${st.name}</button>`).join('')}</div>
      <div class="sec">햇빛 · 그림자</div>
      <label class="fld">시간 <b id="vHour">${o.sunHour}시</b><input type="range" data-o="sunHour" min="6.5" max="17.5" step="0.5" value="${o.sunHour}"></label>
      <label class="fld">햇빛 세기<input type="range" data-o="sunPower" min="0" max="5" step="0.1" value="${o.sunPower}"></label>
      <label class="tog">그림자<input type="checkbox" data-o="shadows" ${o.shadows ? 'checked' : ''}></label>
      <label class="tog">기물 조명 (${li.on}/${li.total}개 켜짐)<input type="checkbox" data-o="itemLights" ${o.itemLights ? 'checked' : ''}></label>
      <div class="sec">후처리</div>
      <label class="tog">틈새 음영 (SSAO)<input type="checkbox" data-o="ssao" ${o.ssao ? 'checked' : ''}></label>
      <label class="fld">음영 반경<input type="range" data-o="ssaoRadius" min="0.1" max="1.2" step="0.05" value="${o.ssaoRadius}"></label>
      <label class="tog">가장자리 부드럽게 (FXAA)<input type="checkbox" data-o="fxaa" ${o.fxaa ? 'checked' : ''}></label>
      <label class="fld">노출<input type="range" data-o="exposure" min="0.4" max="1.8" step="0.05" value="${o.exposure}"></label>
      <div class="sec">배경 · 밑그림</div>
      <div class="btns"><button class="btn" data-go="bg">배경 (주변 거리) · 도면 밑그림</button></div>
      <p class="hint">기물을 톡 누르면 색 · 크기 · 조명을 바꿀 수 있어요.</p>`;
    $$('[data-go]', body).forEach((b) => (b.onclick = () => ACT[b.dataset.go]()));
    $$('[data-style]', body).forEach((b) => (b.onclick = () => setStyle(b.dataset.style)));
    $$('[data-o]', body).forEach((i) => (i.onchange = () => saveRender()));
    $$('[data-o]', body).forEach((i) => (i.oninput = () => { const v = i.type === 'checkbox' ? i.checked : +i.value; engine.setOption(i.dataset.o, v); if (i.dataset.o === 'sunHour') $('#vHour').textContent = v + '시'; if (i.dataset.o === 'itemLights') renderProps(); }));
    return;
  }
  const L = S.lib[it.type], color = it.color || (L && L.color) || '#b8bcc2', lt = it.light;
  $('#propsTitle').textContent = it.name;
  body.innerHTML = `<label class="fld">이름<input type="text" data-k="name" value="${esc(it.name)}"></label>
    <div class="sec">위치 (mm)</div><div class="row">${num('가로 X', 'x', it.x)}${num('세로 Y', 'y', it.y)}${num('바닥에서', 'elev', it.elev)}</div>
    <label class="fld">회전 <b id="vRot">${Math.round(it.rot)}°</b><input type="range" data-k="rot" min="0" max="345" step="15" value="${((it.rot % 360) + 360) % 360}"></label>
    <div class="sec">크기 (mm)</div><div class="row">${num('폭', 'w', it.w)}${num('깊이', 'd', it.d)}${num('높이', 'h', it.h)}</div>
    <div class="sec">색 · 재질</div><div class="row"><label class="fld">색<input type="color" data-k="color" value="${/^#[0-9a-f]{6}$/i.test(color) ? color : '#b8bcc2'}" ${it.asset ? 'disabled' : ''}></label>
      <label class="fld">재질<select data-k="mat" ${it.asset ? 'disabled' : ''}>${Object.entries(MAT_LABEL).map(([k, n]) => `<option value="${k}" ${(it.mat || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <div class="sec">텍스처 입히기 (사진 · 무늬 이미지)</div>
    <div class="btns"><button class="btn" data-a="tex" ${it.asset ? 'disabled' : ''}>${it.tex ? '이미지 바꾸기' : '이미지 고르기'}</button>${it.tex ? `<button class="btn" data-a="texX">텍스처 지우기</button>` : ''}</div>
    ${it.tex ? `<label class="fld">반복 <b>${it.tex.rep || 1}회</b><input type="range" data-tx="rep" min="1" max="10" step="1" value="${it.tex.rep || 1}"></label>` : ''}
    <div class="sec">조명</div>
    <label class="tog">이 기물에 불 켜기<input type="checkbox" data-l="on" ${lt && lt.on ? 'checked' : ''}></label>
    ${lt && lt.on ? `<div class="row"><label class="fld">밝기<input type="range" data-l="power" min="0.1" max="3" step="0.1" value="${lt.power ?? 1}"></label><label class="fld">빛 색<input type="color" data-l="color" value="${lt.color || '#ffe2bd'}"></label></div>
      <label class="fld">종류<select data-l="kind"><option value="spot" ${lt.kind === 'spot' ? 'selected' : ''}>아래로 비추기 (전등)</option><option value="point" ${lt.kind !== 'spot' ? 'selected' : ''}>사방으로 (스탠드 · 불빛)</option></select></label>` : ''}
    ${SL.isDrainItem(it, S.lib) ? '<div class="btns"><button class="btn pri" data-a="drain">이 배수 기물로 구배 잡기</button></div>' : ''}
    ${it.onSlope ? '<div class="row2"><span class="hint">구배 · 단 위에 올려져 있어요</span><button class="btn" data-a="unfit">원래 높이로</button></div>' : SL.needFit(level(), it, S.lib) ? `<div class="row2"><span class="hint warn">바닥(구배 · 단)에 ${SL.needFit(level(), it, S.lib)}mm 묻혀요</span><button class="btn pri" data-a="fit">바닥 위로</button></div>` : ''}
    <div class="btns"><button class="btn pri" data-a="design" ${it.asset ? 'disabled title="가져온 3D 파일은 디자인 수정이 안 돼요"' : ''}>디자인 수정 (점 · 면 · 부품 색)</button></div>
    <div class="btns"><button class="btn" data-a="rot90">90° 돌리기</button><button class="btn" data-a="dup">복제</button><button class="btn danger" data-a="del">삭제</button></div>`;
  $$('[data-k]', body).forEach((i) => {
    const k = i.dataset.k;
    if (k === 'rot') { i.oninput = () => { const t = selItem(); t.rot = +i.value; engine.moveItem(t); $('#vRot').textContent = i.value + '°'; }; i.onchange = () => commit(); return; }
    if (k === 'color') { i.oninput = () => { const t = selItem(); t.color = i.value; engine.rebuildItem(t); }; i.onchange = () => commit(); return; }
    i.onchange = () => {
      if (k === 'name') return patchSel({ name: i.value.trim() || it.name }, false) || renderProps();
      if (k === 'mat') return patchSel({ mat: i.value || null });
      const v = +i.value; if (!Number.isFinite(v)) return;
      if (k === 'w' || k === 'd' || k === 'h') patchSel({ [k]: clamp(v, 10, 30000) }); else patchSel({ [k]: v }, false);
    };
  });
  $$('[data-tx]', body).forEach((i) => (i.onchange = () => { const t = selItem(); if (!t || !t.tex) return; t.tex.rep = +i.value; engine.rebuildItem(t); commit(); renderProps(); }));
  $$('[data-l]', body).forEach((i) => (i.onchange = () => {
    const t = selItem(), k = i.dataset.l; t.light = t.light || { on: false, kind: (S.lib[t.type] || {}).layer === 'floor' || !S.lib[t.type] ? 'point' : 'spot', color: '#ffe2bd', power: 1 };
    t.light[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' ? +i.value : i.value; engine.rebuildItem(t); commit(); renderProps();
  }));
  $$('[data-a]', body).forEach((b) => (b.onclick = () => {
    const t = selItem(); if (!t) return;
    if (b.dataset.a === 'rot90') { patchSel({ rot: (t.rot + 90) % 360 }, false); renderProps(); }
    if (b.dataset.a === 'dup') { const c = { ...JSON.parse(JSON.stringify(t)), id: uid('i'), x: t.x + 300, y: t.y + 300 }; level().items.push(c); engine.rebuildItem(c); engine.select(c.id); commit(); }
    if (b.dataset.a === 'del') { plan.erase({ kind: 'item', id: t.id }); }
    if (b.dataset.a === 'design') startDesign(t);
    if (b.dataset.a === 'tex') pickTexture().then((img) => { if (!img) return; const q = selItem(); if (!q) return; q.tex = { img, rep: (q.tex && q.tex.rep) || 1 }; engine.rebuildItem(q); commit(); renderProps(); });
    if (b.dataset.a === 'texX') { delete t.tex; engine.rebuildItem(t); commit(); renderProps(); }
    if (b.dataset.a === 'fit') fitItems([t.id], '바닥 위로 올렸어요');
    if (b.dataset.a === 'unfit') { delete t.onSlope; engine.moveItem(t); commit(); renderProps(); }
    if (b.dataset.a === 'drain') { const r = SL.roomAt(level(), t.x, t.y) || nearestRoom(t.x, t.y); if (!r) return toast('이 배수 기물이 놓인 공간이 없어요 · 먼저 2D 에서 공간(사각형 · 선)을 그려 주세요'); setDrain(r, t, `"${t.name}" 쪽으로 구배를 잡았어요 · 각도만 바꾸면 돼요`); setSel({ kind: 'room', id: r.id }); }
  }));
}

/* ----- 공간 (태그 · 단 · 바닥 · 구배 · 공간만 작업 · 별도 보관) ----- */
const FLOORS = { tile: '타일', epoxy: '에폭시', concrete: '콘크리트', wood: '목재', marble: '대리석', turf: '인조잔디' };
const SW = { pct: 1, pick: null, a: null };
function nearestRoom(x, y) { let best = null; for (const r of level().rooms) { const d = SL.polyEdgeDist(r.pts, x, y); if (d < 400 && (!best || d < best.d)) best = { d, r }; } return best && best.r; }
/* 그리는 동안 패널을 접어 도면이 보이게 · 끝나면 다시 펼친다 */
function tuck() { if (S.propsOpen) { S.tucked = S.panel; S.propsOpen = false; renderProps(); } }
function untuck() { if (S.tucked) { S.panel = S.tucked; S.tucked = null; S.propsOpen = true; renderProps(); } }
/** 영역을 2D 에서 강조하고 무엇으로 지정할지 묻는다 → 태그(kind) 또는 false */
async function askRoomKind(pts, title) {
  if (S.pane === '3d') setPane('split'); plan.hlPoly = pts; plan.redraw(); const a = (SL.polyArea(pts) / 1e6).toFixed(1);
  const k = await ask(title || `이 영역 (${a}㎡) 을 무엇으로 지정할까요?`, '주황색으로 칠한 곳이에요. 고르면 그 태그의 공간이 돼요.', [...Object.keys(KINDS).map((n) => ({ label: n, value: n })), { label: '취소', value: false }]);
  plan.hlPoly = null; plan.redraw(); return k;
}
async function newRoom(pts) {
  const L = level(), kind = await askRoomKind(pts); if (!kind) { untuck(); return toast('공간 지정을 취소했어요'); }
  const same = L.rooms.filter((q) => q.kind === kind).length, r = { id: uid('r'), name: same ? `${kind} ${same + 1}` : kind, kind, pts, lift: 0, color: '#c9c3b8', finish: 'tile', slope: null };
  L.rooms.push(r); engine.rebuildStructure(); commit(); S.tucked = null; setSel({ kind: 'room', id: r.id }); toast(`"${r.name}" 으로 지정했어요`);
}
function setDrain(r, it, msg) {
  r.slope = { deg: SL.pct2deg(SW.pct), ...SL.drainGeom(it), item: it.id }; endPick(); engine.rebuildStructure(); commit();
  const bad = SL.itemsIn(level(), r, S.lib).filter((x) => SL.needFit(level(), x, S.lib)).length; toast(`${msg || '구배를 잡았어요'} · ${SW.pct}% · 가장 높은 곳 +${SL.roomTop(r)}mm${bad ? ` · 높이 맞출 기물 ${bad}개` : ''}`, 6000);
}
function endPick() { SW.pick = null; SW.a = null; plan.picker = null; if (plan.tool === 'pick') { plan.setTool('select'); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.tool === 'select'))); } }
function startPick(r, kind) {
  if (S.pane === '3d') setPane('split');
  SW.pick = kind; SW.a = null; plan.setTool('pick'); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', 'false'));
  toast(kind === 'line' ? '2D 도면에서 트렌치 시작점을 누르세요 · Esc 취소' : '2D 도면에서 배수구 위치를 누르세요 · 이미 놓인 배수구 · 트렌치를 눌러도 돼요 · Esc 취소', 6000);
  plan.picker = (p, hit) => {
    const near = hit && SL.isDrainItem(hit, S.lib) ? hit : null;
    if (near && kind === 'pt') return setDrain(r, near, `"${near.name}" 쪽으로 구배를 잡았어요`);
    if (!(SL.pointInPoly(p.x, p.y, r.pts) || SL.polyEdgeDist(r.pts, p.x, p.y) < 400)) return toast(`"${r.name}" 안쪽을 눌러 주세요`);
    const q = [Math.round(p.x), Math.round(p.y)], L = level(), clear = () => (L.items = L.items.filter((it) => !(it.autoDrain && it.room === r.id)));
    if (kind === 'pt') { clear(); const it = { id: uid('i'), type: 'drain', name: '바닥 배수구 (구배)', x: q[0], y: q[1], elev: 0, rot: 0, w: 150, d: 150, h: 6, color: null, mat: null, parts: null, light: null, autoDrain: true, room: r.id }; L.items.push(it); engine.rebuildItem(it); return setDrain(r, it, '배수구를 놓고 구배를 잡았어요'); }
    if (!SW.a) { SW.a = q; toast('트렌치 끝점을 누르세요'); return; }
    const a = SW.a, len = Math.hypot(q[0] - a[0], q[1] - a[1]); if (len < 200) return toast('트렌치가 너무 짧아요 · 끝점을 다시 누르세요');
    clear(); const it = { id: uid('i'), type: 'trench', name: '트렌치 (구배)', x: Math.round((a[0] + q[0]) / 2), y: Math.round((a[1] + q[1]) / 2), elev: 0, rot: Math.round((Math.atan2(q[1] - a[1], q[0] - a[0]) * 180) / Math.PI), w: Math.round(len), d: 200, h: 6, color: null, mat: null, parts: null, light: null, autoDrain: true, room: r.id };
    L.items.push(it); engine.rebuildItem(it); setDrain(r, it, '트렌치를 놓고 구배를 잡았어요');
  };
}
function renderRoom(body, r) {
  const L = level(), s = r.slope && r.slope.drain && r.slope.deg ? r.slope : null; if (s) SW.pct = SL.deg2pct(s.deg);
  const pct = SW.pct, ds = SL.drainsIn(L, r, S.lib), its = SL.itemsIn(L, r, S.lib), bad = its.filter((x) => SL.needFit(L, x, S.lib)), on = its.filter((x) => x.onSlope).length, area = (SL.polyArea(r.pts) / 1e6).toFixed(1);
  const cur = s ? (s.drain2 ? `트렌치 ${(Math.hypot(s.drain2[0] - s.drain[0], s.drain2[1] - s.drain[1]) / 1000).toFixed(2)}m 쪽으로` : '배수구(점) 쪽으로') + ` · 가장 높은 곳 +${SL.roomTop(r)}mm` : '아직 배수구 위치가 없어요';
  $('#propsTitle').textContent = `공간 · ${r.name}`;
  body.innerHTML = `<label class="fld">이름<input type="text" data-r="name" value="${esc(r.name)}"></label>
    <div class="sec">태그 · ${area}㎡</div>
    <div class="chips">${Object.keys(KINDS).map((k) => `<button data-kind="${k}" aria-pressed="${r.kind === k}"><i class="dot" style="background:${KINDS[k]}"></i>${k}</button>`).join('')}</div>
    <div class="btns"><button class="btn ${S.focus === r.id ? 'pri' : ''}" data-ra="focus">${S.focus === r.id ? '전체 보기로' : '이 공간만 작업'}</button><button class="btn" data-ra="export">별도 프로젝트로 보관</button></div>
    <div class="sec">바닥</div>
    <div class="row">${num('천장 높이 (비우면 층 기본)', 'ceilH', r.ceilH || '')}</div>
    <div class="row">${num('단 높이 (mm)', 'lift', r.lift || 0)}<label class="fld">마감<select data-r="finish">${Object.entries(FLOORS).map(([k, n]) => `<option value="${k}" ${r.finish === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="fld">색<input type="color" data-r="color" value="${/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#c9c3b8'}"></label></div>
    <div class="btns"><button class="btn" data-ra="tex">${r.tex ? '바닥 이미지 바꾸기' : '바닥에 이미지(텍스처) 입히기'}</button>${r.tex ? '<button class="btn" data-ra="texX">텍스처 지우기</button>' : ''}</div>
    ${r.tex ? `<div class="row">${num('이미지 한 장 크기 (mm)', 'texSize', r.tex.size || 600, 50)}</div>` : ''}
    <div class="sec">구배 (물빠짐 경사) · 직선 구배라 타일이 그대로</div>
    <div class="chips">${[0.5, 1, 1.5, 2, 3].map((v) => `<button data-pct="${v}" aria-pressed="${Math.abs(v - pct) < 0.01}">${v}%</button>`).join('')}</div>
    <div class="row"><label class="fld">경사 %<input type="number" id="swPct" step="0.1" min="0.1" max="25" value="${pct}"></label><label class="fld">각도 °<input type="number" id="swDeg" step="0.05" min="0.05" max="14" value="${Math.round((Math.atan(pct / 100) * 180) / Math.PI * 1000) / 1000}"></label><label class="fld">1m 당<input disabled value="${Math.round(pct * 10)}mm"></label></div>
    <div class="btns"><button class="btn ${SW.pick === 'pt' ? 'pri' : s ? '' : 'pri'}" data-ra="pt">${SW.pick === 'pt' ? '2D 에서 누르세요…' : '배수구 위치 찍기'}</button><button class="btn ${SW.pick === 'line' ? 'pri' : ''}" data-ra="line">${SW.pick === 'line' ? '2D 에서 누르세요…' : '트렌치 선 그리기'}</button></div>
    ${ds.length ? `<div class="chips">${ds.map((it) => `<button data-dr="${it.id}" aria-pressed="${!!(s && s.item === it.id)}">${esc(it.name)}</button>`).join('')}</div>` : ''}
    <p class="hint">${cur}</p>
    <div class="sec">기물 높이</div>
    <p class="hint">${bad.length ? `<b class="warn">조정 필요 ${bad.length}개</b> · 구배 · 단 때문에 다리가 바닥에 묻혀요` : on ? `${on}개가 구배 위에 올라가 있어요` : its.length ? '충돌 없음' : '이 공간에 기물이 없어요'}</p>
    <div class="btns"><button class="btn ${bad.length ? 'pri' : ''}" data-ra="fit" ${bad.length ? '' : 'disabled'}>조정 필요 · 일괄조정</button><button class="btn" data-ra="fitall" ${its.length ? '' : 'disabled'}>모두 올리기</button><button class="btn" data-ra="unfit" ${on ? '' : 'disabled'}>원래 높이로</button></div>
    <div class="btns"><button class="btn" data-ra="off" ${s ? '' : 'disabled'}>구배 지우기</button><button class="btn danger" data-ra="del">공간 지우기</button></div>
    <div class="sec">공간 프리셋 · 이 공간 안에만</div>
    <div class="chips">${(SPBUILT[r.kind] || []).map((b, i) => `<button data-sp="b${i}">${esc(b.n)}</button>`).join('')}${spList().filter((q) => !q.kind || q.kind === r.kind || true).map((q) => `<button data-sp="m${q.id}">★ ${esc(q.name)}</button>`).join('')}</div>
    ${(SPBUILT[r.kind] || []).length || spList().length ? '' : '<p class="hint">태그(주방 · 홀 · 화장실 …)를 고르면 맞는 프리셋이 떠요</p>'}
    <div class="row2"><label class="tog" style="flex:1">기존 기물 지우고 적용<input type="checkbox" id="spClear"></label><button class="btn" data-ra="spSave">이 구성 저장</button></div>
    <div class="sec">바닥 채움층 (양생 · 단 올림) · 합계 ${(r.layers || []).reduce((a, q) => a + (+q[1] || 0), 0)}mm</div>
    <div class="chips">${Object.entries(FILLSETS).map(([k, v]) => `<button data-fs="${k}">${v[0]}</button>`).join('')}</div>
    ${(r.layers || []).map((q, i) => `<div class="row2"><select data-fm="${i}">${Object.entries(FILLS).map(([k, v]) => `<option value="${k}" ${q[0] === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select><input type="number" data-ft="${i}" value="${q[1]}" style="width:80px" aria-label="두께 mm"><span class="hint">mm</span><button class="btn danger" data-fd="${i}">✕</button></div>`).join('')}
    <div class="btns"><button class="btn" data-ra="fillAdd">층 더하기</button>${(r.layers || []).length ? '<button class="btn" data-ra="fillLift">단 높이를 채움층 합계로</button>' : ''}</div>
    <div class="sec">이 공간에서 보일 것 (레이어)</div>
    <div class="chips">${Object.entries(LAYERN).map(([k, n]) => `<button data-lyr="${k}" aria-pressed="${!(r.vis && r.vis[k] === false)}">${n}</button>`).join('')}</div>
    <p class="hint">2D 에서 공간을 고르면 꼭짓점(동그라미)을 끌어 모양을 바꾸고, 공간 안쪽을 끌면 공간째(안의 기물까지) 옮겨요.</p>`;
  const live = () => { engine.rebuildStructure(); };
  $$('[data-r]', body).forEach((i) => { const k = i.dataset.r; if (k === 'color') { i.oninput = () => { r.color = i.value; live(); }; i.onchange = () => commit(); return; } i.onchange = () => { r[k] = k === 'name' ? i.value.trim() || r.name : i.value; live(); commit(); renderProps(); }; });
  $$('[data-k]:not([data-k=texSize])', body).forEach((i) => (i.onchange = () => { const v = Math.round(+i.value || 0); if (i.dataset.k === 'ceilH') { if (v >= 1800) r.ceilH = Math.min(12000, v); else delete r.ceilH; } else r.lift = clamp(v, 0, 3000); live(); commit(); renderProps(); }));
  $$('[data-kind]', body).forEach((b) => (b.onclick = () => { const old = r.kind; r.kind = b.dataset.kind; if (!r.name || /^공간 \d+$/.test(r.name) || r.name === old) r.name = level().rooms.some((q) => q !== r && q.name === r.kind) ? `${r.kind} ${level().rooms.filter((q) => q.kind === r.kind).length}` : r.kind; commit(); renderProps(); }));
  const applyPct = (v) => { SW.pct = clamp(Math.round((+v || 1) * 100) / 100, 0.1, 25); if (r.slope && r.slope.drain) { r.slope.deg = SL.pct2deg(SW.pct); live(); commit(); renderProps(); } else startPick(r, 'pt'); };
  $$('[data-pct]', body).forEach((b) => (b.onclick = () => applyPct(+b.dataset.pct)));
  $('#swPct').onchange = (e) => applyPct(e.target.value); $('#swDeg').onchange = (e) => applyPct(Math.tan(((+e.target.value || 0.5) * Math.PI) / 180) * 100);
  $$('[data-sp]', body).forEach((b) => (b.onclick = () => spApply(r, b.dataset.sp, $('#spClear').checked)));
  $$('[data-fs]', body).forEach((b) => (b.onclick = () => { r.layers = FILLSETS[b.dataset.fs][1].map((q) => [...q]); commit(); renderProps(); }));
  $$('[data-fm]', body).forEach((i) => (i.onchange = () => { r.layers[+i.dataset.fm][0] = i.value; commit(); }));
  $$('[data-ft]', body).forEach((i) => (i.onchange = () => { r.layers[+i.dataset.ft][1] = Math.max(1, Math.round(+i.value || 1)); commit(); renderProps(); }));
  $$('[data-fd]', body).forEach((b) => (b.onclick = () => { r.layers.splice(+b.dataset.fd, 1); if (!r.layers.length) delete r.layers; commit(); renderProps(); }));
  $$('[data-lyr]', body).forEach((b) => (b.onclick = () => { r.vis ||= {}; const k = b.dataset.lyr; r.vis[k] = r.vis[k] === false; if (Object.values(r.vis).every((v) => v !== false)) delete r.vis; engine.applyFocus(); plan.redraw(); commit(); renderProps(); }));
  $$('[data-dr]', body).forEach((b) => (b.onclick = () => { const it = L.items.find((q) => q.id === b.dataset.dr); if (it) setDrain(r, it, `"${it.name}" 쪽으로 구배를 잡았어요`); renderProps(); }));
  { const ts = $('[data-k=texSize]', body); if (ts) ts.onchange = () => { r.tex.size = clamp(+ts.value || 600, 50, 20000); engine.rebuildStructure(); commit(); }; }
  $$('[data-ra=tex],[data-ra=texX]', body).forEach((b) => (b.onclick = async (e) => { e.stopImmediatePropagation(); if (b.dataset.ra === 'texX') delete r.tex; else { const img = await pickTexture(); if (!img) return; r.tex = { img, size: (r.tex && r.tex.size) || 600 }; } engine.rebuildStructure(); commit(); renderProps(); }));
  $$('[data-ra]:not([data-ra=tex]):not([data-ra=texX])', body).forEach((b) => (b.onclick = () => {
    const a = b.dataset.ra;
    if (a === 'pt' || a === 'line') { if (SW.pick === a) endPick(); else startPick(r, a); renderProps(); }
    if (a === 'fit') fitItems(bad.map((x) => x.id));
    if (a === 'fitall') fitItems(its.map((x) => x.id), `"${r.name}" 안 기물을 모두 구배 · 단 위에 올렸어요`);
    if (a === 'unfit') { let n = 0; for (const it of its) if (it.onSlope) { delete it.onSlope; n++; } engine.replaceItems(); commit(); renderProps(); toast(n ? `${n}개를 원래 높이로 돌렸어요` : '올린 기물이 없어요'); }
    if (a === 'off') { r.slope = null; L.items = L.items.filter((it) => !(it.autoDrain && it.room === r.id && it.type === 'drain')); engine.setLevel(L); commit(); renderProps(); toast('구배를 지웠어요'); }
    if (a === 'del') { if (S.focus === r.id) setFocus(null); plan.erase({ kind: 'room', id: r.id }); }
    if (a === 'focus') { setFocus(S.focus === r.id ? null : r.id); renderProps(); }
    if (a === 'export') exportRoom(r);
    if (a === 'spSave') spSave(r);
    if (a === 'fillAdd') { (r.layers ||= []).push(['mortar', 50]); commit(); renderProps(); }
    if (a === 'fillLift') { r.lift = (r.layers || []).reduce((s2, q) => s2 + (+q[1] || 0), 0); live(); commit(); renderProps(); toast(`단 높이를 ${r.lift}mm 로 맞췄어요`); }
  }));
}
/** 공간 하나(안의 기물 · 닿은 벽 · 문/창)를 별도 프로젝트로 보관 — 내 프로젝트 목록에 들어가고 파일로도 받을 수 있다 */
async function exportRoom(r) {
  const L = level(), inside = (x, y, m = 0) => SL.pointInPoly(x, y, r.pts) || SL.polyEdgeDist(r.pts, x, y) < m;
  // 벽: 공간 테두리(벽 두께만큼 넓힌 사각형) 안에 든 부분만 잘라서 가져간다 · 문/창은 잘린 자리에 맞춰 옮긴다
  const xs = r.pts.map((p) => p[0]), ys = r.pts.map((p) => p[1]), walls = [], opens = [];
  for (const w of L.walls) {
    const m = w.t + 120, bx = [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m], dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
    let t0 = 0, t1 = 1; for (const [p, q] of [[-dx, w.x1 - bx[0]], [dx, bx[2] - w.x1], [-dy, w.y1 - bx[1]], [dy, bx[3] - w.y1]]) { if (Math.abs(p) < 1e-9) { if (q < 0) { t0 = 1; t1 = 0; } continue; } const t = q / p; if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); }
    if ((t1 - t0) * len < 200) continue;
    const nw = { ...w, x1: Math.round(w.x1 + dx * t0), y1: Math.round(w.y1 + dy * t0), x2: Math.round(w.x1 + dx * t1), y2: Math.round(w.y1 + dy * t1) }; walls.push(nw);
    for (const o of L.openings) if (o.wall === w.id) { const t = o.t - t0 * len; if (t - o.w / 2 >= -1 && t + o.w / 2 <= (t1 - t0) * len + 1) opens.push({ ...o, t: Math.round(t) }); }
  }
  const m = { ...emptyProject(`${S.model.name} · ${r.name}`), env: S.model.env ? JSON.parse(JSON.stringify(S.model.env)) : undefined, source: { app: 'byr2-room', project: S.model.id, room: r.id, at: new Date().toISOString() } };
  m.levels = [{ ...JSON.parse(JSON.stringify({ ...L, bg: null })), id: 'L1', name: L.name, walls, openings: opens, rooms: [r], items: L.items.filter((it) => inside(it.x, it.y)) }].map((x) => JSON.parse(JSON.stringify(x)));
  if (S.model.assets) { const keys = new Set(m.levels[0].items.filter((i) => i.asset).map((i) => i.asset.key)); m.assets = Object.fromEntries(Object.entries(S.model.assets).filter(([k]) => keys.has(k))); }
  await lib2.saveLocal(m); await lib2.saveLocal(S.model); // 지금 프로젝트를 마지막으로 열린 것으로 유지
  if (cloud.session()) lib2.scheduleSync(1500);
  toast(`"${m.name}" 을 내 프로젝트에 보관했어요 (기물 ${m.levels[0].items.length} · 벽 ${walls.length})`, 6000);
  S.panel = 'library'; renderProps();
}
/* ----- 공간 프리셋 · 채움층 · 자동 인식 (기존 앱 v21) ----- */
const FILLS = { concrete: ['콘크리트', '#a9a9a4'], mortar: ['시멘트 몰탈', '#bdbab2'], sand: ['모래', '#d9c49a'], gravel: ['자갈 · 쇄석', '#9a958c'], foam: ['기포 콘크리트 (경량)', '#e3e1da'], xps: ['단열재 (XPS)', '#7fb2d9'], mesh: ['와이어 메쉬', '#6f7377'], waterproof: ['방수층 (액체 · 우레탄)', '#4f7fa6'], selflevel: ['셀프 레벨링', '#cfcdc6'], heating: ['난방 배관층', '#d98a6a'], epoxy: ['에폭시 코팅', '#7c8f86'], tilebed: ['타일 붙임 몰탈', '#b7b2a6'] };
const FILLSETS = { kitchen: ['주방 (방수 + 몰탈 + 타일)', [['concrete', 60], ['waterproof', 3], ['mortar', 50], ['tilebed', 20]]], raise: ['단 올림 (모래 + 몰탈)', [['sand', 80], ['mortar', 50]]], light: ['경량 단 올림 (기포 + 몰탈)', [['foam', 100], ['mortar', 40]]], heat: ['주거 난방 (단열 + 기포 + 배관 + 몰탈)', [['xps', 30], ['foam', 40], ['heating', 20], ['mortar', 40]]], factory: ['공장 (콘크리트 + 메쉬 + 에폭시)', [['gravel', 100], ['concrete', 150], ['mesh', 5], ['epoxy', 3]]] };
const LAYERN = { floor: '바닥 기물', upper: '벽 상부', ceil: '천장 설비', elec: '전기', plumb: '배관 · 수전', deco: '장식' };
const SPBUILT = {
  주방: [{ n: '기본 주방 (벽 따라: 작업대 · 싱크 · 냉장고 · 레인지)', wall: ['k_reach', 'k_work18', 'sink2', 'k_work09', 'range', 'k_dwU', 'k_upper'] }, { n: '페리카나 배달 주방', biz: 'pel_delivery' }, { n: '페리카나 홀 주방', biz: 'pel_hall' }, { n: '치킨 주방', biz: 'chicken' }, { n: '카페 바', biz: 'cafe' }, { n: '분식 주방', biz: 'snack' }, { n: '한식 주방', biz: 'korean' }],
  홀: [{ n: '4인 테이블 배치', grid: { t: 't4', ch: 'chair', gap: 900 } }, { n: '2인 테이블 배치', grid: { t: 't2', ch: 'chair', gap: 800 } }],
  화장실: [{ n: '남녀 공용 (양변기 · 소변기 · 세면대)', wall: ['toilet', 'b_urinal', 'washbasin', 'b_handdry', 'b_paper'] }, { n: '칸막이 화장실 2칸 + 세면대', wall: ['b_stall', 'b_stall', 'b_basin2', 'b_handdry'] }, { n: '가정 욕실 (변기 · 세면장 · 샤워)', wall: ['b_toiletB', 'b_vanity9', 'b_showerB'] }],
  거실: [{ n: '거실 (소파 · TV장 · 테이블)', living: 1 }],
  사무실: [{ n: '사무실 (책상 · 의자 · 캐비닛)', office: 1 }],
  창고: [{ n: '창고 (랙 벽 따라)', wall: ['m_lrack', 'm_lrack', 'm_lrack', 'm_lrack', 'm_lrack', 'm_lrack'] }],
  공장: [{ n: '공장 (랙 · 작업대 · 컨베이어)', wall: ['m_prack', 'm_bench', 'm_bench', 'm_mlocker', 'm_ext'], center: ['m_conv6'] }],
  복도: [{ n: '복도 (라인 조명 · 비상등)', corridor: 1 }],
};
const spList = () => store.get('byr.spacepre', []) || [];
function spBox(r) { const xs = r.pts.map((p) => p[0]), ys = r.pts.map((p) => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), get W() { return this.x1 - this.x0; }, get D() { return this.y1 - this.y0; } }; }
function spItem(id, x, y, rot, r) { const L = S.lib[id]; if (!L) return null; const lv = level(), elev = L.elev != null ? L.elev : L.layer === 'ceil' || L.layer === 'ceiling' ? (lv.ceilingH || 2700) - L.h : 0;
  return { id: uid('i'), type: id, name: L.name, x: Math.round(x), y: Math.round(y), elev, rot, w: L.w, d: L.d, h: L.h, color: null, mat: null, parts: null, light: L.light ? defaultLight(L) : null, kw: L.kw, room: r.id }; }
function spDoorsOn(side, B) { const out = [], L = level(); for (const o of L.openings) { const w = L.walls.find((q) => q.id === o.wall); if (!w) continue; const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, a = [w.x1 + ux * (o.t - o.w / 2), w.y1 + uy * (o.t - o.w / 2)], b = [w.x1 + ux * (o.t + o.w / 2), w.y1 + uy * (o.t + o.w / 2)], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tol = 400;
    if (side === 'N' && Math.abs(m[1] - B.y0) < tol) out.push([Math.min(a[0], b[0]) - B.x0 - 250, Math.max(a[0], b[0]) - B.x0 + 250]);
    if (side === 'S' && Math.abs(m[1] - B.y1) < tol) out.push([B.x1 - Math.max(a[0], b[0]) - 250, B.x1 - Math.min(a[0], b[0]) + 250]);
    if (side === 'E' && Math.abs(m[0] - B.x1) < tol) out.push([Math.min(a[1], b[1]) - B.y0 - 250, Math.max(a[1], b[1]) - B.y0 + 250]);
    if (side === 'W' && Math.abs(m[0] - B.x0) < tol) out.push([B.y1 - Math.max(a[1], b[1]) - 250, B.y1 - Math.min(a[1], b[1]) + 250]); } return out; }
function spPlaceWall(r, ids, rep) { const B = spBox(r), sides = [['N', B.W], ['E', B.D], ['S', B.W], ['W', B.D]], doors = Object.fromEntries(sides.map(([sd]) => [sd, spDoorsOn(sd, B)])); let si = 0, u = 50;
  for (const id of ids) { const L = S.lib[id]; if (!L) { rep.miss.push(id); continue; } const w = L.w, d = L.d; let ok = false;
    while (si < 4) { const [sd, len] = sides[si]; const hit = doors[sd].find(([a, b]) => u < b && u + w > a); if (hit) { u = hit[1]; continue; } if (u + w <= len - 50) { ok = true; break; } si++; u = d + 80; }
    if (!ok) { rep.miss.push(L.name); continue; } const sd = sides[si][0], c = u + w / 2, off = d / 2 + 10;
    const [x, y, rot] = sd === 'N' ? [B.x0 + c, B.y0 + off, 0] : sd === 'E' ? [B.x1 - off, B.y0 + c, 90] : sd === 'S' ? [B.x1 - c, B.y1 - off, 180] : [B.x0 + off, B.y1 - c, 270];
    if (!SL.pointInPoly(x, y, r.pts)) { u += w + 20; rep.miss.push(L.name); continue; } const it = spItem(id, x, y, rot, r); level().items.push(it); rep.placed++; u += w + (L.layer === 'upper' ? 0 : 20); } }
function spPlaceCenter(r, ids, rep) { const B = spBox(r); ids.forEach((id, k) => { const L = S.lib[id]; if (!L) return; const x = B.x0 + B.W / 2, y = B.y0 + (B.D * (k + 1)) / (ids.length + 1); if (SL.pointInPoly(x, y, r.pts)) { level().items.push(spItem(id, x, y, B.W >= B.D ? 0 : 90, r)); rep.placed++; } }); }
function spPlaceGrid(r, g, rep) { const B = spBox(r), T = S.lib[g.t], C = S.lib[g.ch]; if (!T || !C) return; const cw = T.w + 2 * (C.d + 100) + g.gap, ch = T.d + g.gap; let n = 0;
  for (let y = B.y0 + 700 + T.d / 2; y + T.d / 2 < B.y1 - 600; y += ch) for (let x = B.x0 + 600 + T.w / 2 + C.d; x + T.w / 2 + C.d < B.x1 - 600; x += cw) {
    if (![[x - T.w / 2 - C.d, y - T.d / 2], [x + T.w / 2 + C.d, y + T.d / 2], [x, y]].every((p) => SL.pointInPoly(p[0], p[1], r.pts))) continue; level().items.push(spItem(g.t, x, y, 0, r)); rep.placed++; n++;
    const per = T.w > 900 ? 2 : 1; for (let k = 0; k < per; k++) { const cx = x - T.w / 2 + (T.w * (k + 0.5)) / per; level().items.push(spItem(g.ch, cx, y - T.d / 2 - C.d / 2 + 60, 180, r), spItem(g.ch, cx, y + T.d / 2 + C.d / 2 - 60, 0, r)); rep.placed += 2; rep.seats += 2; } }
  if (!n) rep.miss.push('테이블 (공간이 좁아요)'); }
function spApply(r, v, clear) {
  const rep = { placed: 0, seats: 0, miss: [] }, L = level(), inR = (it) => SL.pointInPoly(it.x, it.y, r.pts);
  if (v[0] === 'm') { const p = spList().find((q) => 'm' + q.id === v); if (!p) return; if (clear) L.items = L.items.filter((it) => !inR(it)); const B = spBox(r);
    for (const q of p.items) { const it = { ...JSON.parse(JSON.stringify(q.it)), id: uid('i'), x: Math.round(B.x0 + q.u * B.W), y: Math.round(B.y0 + q.v * B.D), room: r.id }; if (SL.pointInPoly(it.x, it.y, r.pts)) { L.items.push(it); rep.placed++; } else rep.miss.push(it.name || it.type); }
    if (p.floor) Object.assign(r, JSON.parse(JSON.stringify(p.floor))); }
  else { const b = (SPBUILT[r.kind] || [])[+v.slice(1)]; if (!b) return; if (clear) L.items = L.items.filter((it) => !inR(it));
    if (b.wall) spPlaceWall(r, b.wall, rep);
    if (b.biz) spPlaceWall(r, SH.BIZ[b.biz].kitchen.flatMap(([t, , , q]) => Array(q).fill(t)), rep); if (b.center) spPlaceCenter(r, b.center, rep); if (b.grid) spPlaceGrid(r, b.grid, rep);
    if (b.living) { spPlaceWall(r, ['f_tv18'], rep); const B = spBox(r), Sf = S.lib.f_sofa2, T = S.lib.f_ctable; if (Sf && T) { const y = B.y1 - Sf.d / 2 - 150, x = B.x0 + B.W / 2; L.items.push(spItem('f_sofa2', x, y, 0, r), spItem('f_ctable', x, y - Sf.d / 2 - 500, 0, r)); rep.placed += 2; } }
    if (b.office) { spPlaceWall(r, ['f_book12', 'f_cabinet', 'f_file'], rep); const B = spBox(r), D = S.lib.f_desk14, C = S.lib.f_och; if (D && C) for (let y = B.y0 + 1500; y + D.d < B.y1 - 900; y += D.d + 1300) for (let x = B.x0 + 800 + D.w / 2; x + D.w / 2 < B.x1 - 600; x += D.w + 300) { if (!SL.pointInPoly(x, y, r.pts)) continue; L.items.push(spItem('f_desk14', x, y, 0, r), spItem('f_och', x, y + D.d / 2 + 350, 0, r)); rep.placed += 2; } }
    if (b.corridor) { const B = spBox(r), Ll = S.lib.l_line, long = B.W >= B.D; if (Ll) { const n = Math.max(1, Math.floor((long ? B.W : B.D) / 2500)); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; L.items.push(spItem('l_line', long ? B.x0 + B.W * t : B.x0 + B.W / 2, long ? B.y0 + B.D / 2 : B.y0 + B.D * t, long ? 0 : 90, r)); rep.placed++; } } spPlaceWall(r, ['l_exit', 'm_ext'], rep); } }
  L.items = L.items.filter(Boolean); engine.setLevel(L); applyEnv(); commit(); renderProps();
  toast(`"${r.name}"에 ${rep.placed}개 놓았어요${rep.seats ? ` · 좌석 ${rep.seats}석` : ''}${rep.miss.length ? ` · 못 넣음: ${[...new Set(rep.miss)].slice(0, 3).join(', ')}` : ''}`, 6000);
}
function spSave(r) { const B = spBox(r), its = level().items.filter((it) => SL.pointInPoly(it.x, it.y, r.pts)); if (!its.length) return toast('이 공간 안에 기물이 없어요');
  const Lst = spList(); Lst.push({ id: uid('sp'), name: `${r.name} 구성 (${its.length}개)`, kind: r.kind, items: its.map((it) => { const c = JSON.parse(JSON.stringify(it)); delete c.id; delete c.room; return { u: (it.x - B.x0) / (B.W || 1), v: (it.y - B.y0) / (B.D || 1), it: c }; }), floor: { finish: r.finish, color: r.color, lift: r.lift || 0, layers: r.layers } });
  store.set('byr.spacepre', Lst); renderProps(); toast('이 구성을 프리셋(★)으로 저장했어요 · 다른 공간에도 적용할 수 있어요'); }
/** 벽으로 둘러싼 공간을 찾아 아직 공간이 없는 곳에 만든다 */
function autoRooms(at) {
  const L = level(), faces = findFaces(L.walls); let made = 0, last = null;
  for (const f of faces) { const c = SL.polyCenter(f.pts); if (at && !SL.pointInPoly(at.x, at.y, f.pts)) continue; if (!at && L.rooms.some((r) => SL.pointInPoly(c[0], c[1], r.pts))) continue;
    if (at) { const ex = L.rooms.find((r) => SL.pointInPoly(at.x, at.y, r.pts)); if (ex && Math.abs(SL.polyArea(ex.pts) - f.area) < 1e5) { askRoomKind(ex.pts, `"${ex.name}" 의 태그를 바꿀까요?`).then((k) => { if (k) { ex.kind = k; if (/^공간 \d+$/.test(ex.name)) ex.name = k; engine.rebuildStructure(); commit(); } S.tucked = null; setSel({ kind: 'room', id: ex.id }); }); return; }
      return newRoom(f.pts); }
    const r = { id: uid('r'), name: `공간 ${L.rooms.length + 1}`, kind: '기타', pts: f.pts, lift: 0, color: '#c9c3b8', finish: 'tile', slope: null }; L.rooms.push(r); made++; last = r; if (at) break; }
  if (!made) return toast(at ? '여기는 벽으로 닫혀 있지 않아요 · 벽 끝을 이어 주세요' : '새로 찾은 공간이 없어요 (이미 다 있거나 벽이 닫혀 있지 않아요)', 5000);
  engine.rebuildStructure(); commit(); if (last) setSel({ kind: 'room', id: last.id }); toast(`공간 ${made}개를 찾았어요 · 태그(주방 · 홀 …)를 붙여 주세요`, 5000);
}

function renderRooms(body) {
  const L = level(); $('#propsTitle').textContent = '공간 목록';
  body.innerHTML = `<p class="hint">2D 도구의 "공간 (사각형)" 으로 끌거나 "공간 (선)" 으로 꼭짓점을 차례로 눌러 공간을 만들고 태그를 붙여요. 누르면 그 공간만 따로 작업해요.</p>
    <div class="plist">${L.rooms.length ? L.rooms.map((r) => `<button data-room="${r.id}"><b><i class="dot" style="background:${KINDS[r.kind] || '#ccc'}"></i>${esc(r.name)}</b><small>${esc(r.kind || '')} · ${(SL.polyArea(r.pts) / 1e6).toFixed(1)}㎡ · 기물 ${L.items.filter((it) => SL.pointInPoly(it.x, it.y, r.pts)).length}개${r.slope ? ' · 구배' : ''}${r.lift ? ` · 단 +${r.lift}` : ''}</small></button>`).join('') : '<p class="hint">아직 공간이 없어요</p>'}</div>
    <div class="btns"><button class="btn pri" data-ra="auto">벽 따라 공간 자동 찾기</button><button class="btn" data-ra="autoTap">눌러서 찾기 (2D)</button></div>
    ${S.focus ? '<div class="btns"><button class="btn" data-ra="all">전체 보기로</button></div>' : ''}`;
  $('[data-ra=auto]', body).onclick = () => autoRooms(null);
  $('[data-ra=autoTap]', body).onclick = () => { if (S.pane === '3d') setPane('split'); tuck(); plan.setTool('pick'); plan.picker = (p) => { plan.picker = null; plan.setTool('select'); autoRooms(p); }; toast('2D 에서 벽으로 둘러싼 곳 안쪽을 누르세요'); };
  $$('[data-room]', body).forEach((b) => (b.onclick = () => { setFocus(b.dataset.room); setSel({ kind: 'room', id: b.dataset.room }); }));
  const a = $('[data-ra=all]', body); if (a) a.onclick = () => { setFocus(null); renderProps(); };
}

/* ----- 설치물 (배관 · 전선 · 덕트 투시) ----- */
const LOPT = { depth: 80, off: 300 };
function setXray(cat) { engine.setXray(cat); const b = $('#dkXr'); if (b) b.setAttribute('aria-pressed', String(!!cat)); }
function renderXray(body) {
  const L = level(), cat = engine.xray, cnt = (c) => (L.lines || []).filter((l) => LINEKINDS[l.kind] && lineCat(LINEKINDS[l.kind]) === c).length;
  $('#propsTitle').textContent = '설치물 · 배관 · 전선';
  body.innerHTML = `<div class="sec">투시해서 보기 · 나머지는 흑백 반투명</div>
    <div class="chips"><button data-xr="" aria-pressed="${!cat}">끄기</button>${Object.entries(XRN).map(([k, n]) => `<button data-xr="${k}" aria-pressed="${cat === k}">${n} (${cnt(k)})</button>`).join('')}</div>
    <div class="sec">그리기 · 2D 에서 점을 차례로 · 마지막 점을 한 번 더 누르면 끝 (Enter)</div>
    <div class="chips">${Object.entries(LINEKINDS).map(([k, v]) => `<button data-lk="${k}" aria-pressed="${plan.tool === 'line' && plan.lineKind === k}"><i class="dot" style="background:${v.color}"></i>${v.name}</button>`).join('')}</div>
    <div class="row">${num('매립 깊이 (바닥 아래)', 'depth', LOPT.depth)}${num('천장(슬래브)에서 내려온 거리', 'off', LOPT.off)}</div>
    <p class="hint">바닥 매립 · 바닥 배관은 바닥, 콘센트 · 가스는 벽, 천장 속 배선 · 덕트 · 급기/배기관은 천장 분류로 보여요. 지우기 도구로 선을 누르면 지워져요.</p>`;
  $$('[data-xr]', body).forEach((b) => (b.onclick = () => { setXray(b.dataset.xr || null); renderProps(); }));
  $$('[data-lk]', body).forEach((b) => (b.onclick = () => { plan.lineKind = b.dataset.lk; setPlanTool('line'); const c = lineCat(LINEKINDS[b.dataset.lk]); if (engine.xray && c && engine.xray !== c) setXray(c); renderProps(); toast(`${LINEKINDS[b.dataset.lk].name} · 2D 에서 점을 차례로 누르세요`); }));
  $$('[data-k]', body).forEach((i) => (i.onchange = () => { LOPT[i.dataset.k] = Math.max(0, Math.round(+i.value || 0)); }));
}

/* ----- 5차: 설비 점검 · 전력 · 견적 · 자동 배치 · A안/B안 (기존 앱 v7~v10) ----- */
const aisleOf = () => S.model.aisle || 900;
function mkItem(type, x, y, rot, over = {}) { const L = S.lib[type], it = spItem(type, x, y, rot, {}); delete it.room; if (L.parts) { it.parts = JSON.parse(JSON.stringify(L.parts)); it.pb = { w: L.w, d: L.d, h: L.h }; } return Object.assign(it, over); }
function goItem(id) { const it = level().items.find((q) => q.id === id); if (!it) return; setSel({ kind: 'item', id }); engine.frame([[it.x - 1500, it.y - 1500], [it.x + 1500, it.y + 1500]]); }
function renderCheck(body) {
  const L = level(), a = SH.analyze(L, S.lib, aisleOf()), cnt = (l) => a.checks.filter((c) => c.lvl === l).length, ic = { bad: '⛔', warn: '⚠', work: '🛠' };
  $('#propsTitle').textContent = '설비 점검 · 전력';
  body.innerHTML = `<div class="sec">전력 합계</div><p class="big"><b>${a.kw.toFixed(1)} kW</b> <small class="muted">${Object.entries(a.byCat).map(([k, v]) => `${esc(k)} ${v.toFixed(1)}`).join(' · ') || '전력 쓰는 기물 없음'}</small></p>
    <p class="hint">가스 기물 ${a.n.gas} · 배수 필요 ${a.n.drain} · 후드 필요 ${a.n.hot} · 3kW 이상 ${a.n.kw3}${a.kw > 20 ? ' · 20kW 넘음: 전기 증설(계약 전력) 확인' : ''}</p>
    <div class="row">${num('주방 통로 기준 폭', 'aisle', aisleOf(), 50)}</div>
    <div class="sec">점검 결과 · 겹침 ${cnt('bad')} · 확인 ${cnt('warn')} · 공사 ${cnt('work')}</div>
    ${a.checks.length ? `<ul class="clist">${a.checks.map((c) => `<li class="${c.lvl}"><button data-ci="${c.id}">${ic[c.lvl] || ''} ${esc(c.t)}</button></li>`).join('')}</ul>` : '<p class="hint">문제 없어요 ✓</p>'}
    <p class="hint">배수구 · 가스 밸브 · 3상 콘센트는 기물(바닥·배관 / 전기)이나 설치물 선(배수 · 가스 · 배선)으로 놓으면 인정돼요. 누르면 그 기물로 가요.</p>
    <div class="btns"><button class="btn" data-dact="quote">견적 보기</button></div>`;
  $$('[data-ci]', body).forEach((b) => (b.onclick = () => goItem(b.dataset.ci)));
  $$('[data-dact]', body).forEach((b) => (b.onclick = () => ACT[b.dataset.dact]()));
  $('[data-k=aisle]', body).onchange = (e) => { S.model.aisle = clamp(Math.round(+e.target.value || 900), 400, 2000); commit(); renderProps(); };
}
const PRICE = () => store.get('byr.price', {}) || {};
function renderQuote(body) {
  const L = level(), rows = SH.bomRows(L, S.lib), P = PRICE(), etc = store.get('byr.etc', 0), vat = store.get('byr.vat', true), t = SH.bomTotals(rows, P, etc, vat), a = SH.analyze(L, S.lib, aisleOf()); let g = '';
  $('#propsTitle').textContent = '견적 · 물량 · 단가';
  body.innerHTML = `<p class="hint">${esc(S.model.name)} · ${esc(varCur().name)} · ${esc(L.name || '')} · 전력 ${a.kw.toFixed(1)} kW · 단가는 이 기기에 저장돼 다음 견적에도 그대로 써요</p>
    <div class="tblw"><table class="qt"><thead><tr><th>항목</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>${rows.map((r) => { const h = r.g !== g ? `<tr class="qg"><th colspan="5">${esc(r.g)}</th></tr>` : ''; g = r.g;
      return h + `<tr><td>${esc(r.n)}${r.note ? ` <small class="muted">${esc(r.note)}</small>` : ''}</td><td>${esc(r.sp)}</td><td class="n">${r.q.toLocaleString()} ${r.u}</td><td><input type="number" inputmode="numeric" min="0" step="100" data-pk="${esc(r.key)}" value="${P[r.key] || ''}" placeholder="단가"></td><td class="n">${Math.round(r.q * (P[r.key] || 0)).toLocaleString()}</td></tr>`; }).join('')}</tbody>
    <tfoot><tr><th colspan="4">소계</th><td class="n">${t.sub.toLocaleString()}</td></tr><tr><th colspan="4">공과잡비 <input type="number" id="qEtc" min="0" max="30" value="${etc}" style="width:56px"> %</th><td class="n">${t.etc.toLocaleString()}</td></tr>
    <tr><th colspan="4"><label class="chk"><input type="checkbox" id="qVat" ${vat ? 'checked' : ''}> 부가세 10%</label></th><td class="n">${t.vat.toLocaleString()}</td></tr><tr class="qsum"><th colspan="4">합계</th><td class="n"><b>${t.all.toLocaleString()}</b></td></tr></tfoot></table></div>
    <div class="btns"><button class="btn pri" id="qX">엑셀 (xlsx)</button><button class="btn" id="qC">CSV</button><button class="btn" data-dact="check">설비 점검</button></div>`;
  $$('[data-pk]', body).forEach((i) => (i.onchange = () => { const P2 = PRICE(), v = Math.max(0, +i.value || 0); if (v) P2[i.dataset.pk] = v; else delete P2[i.dataset.pk]; store.set('byr.price', P2); renderProps(); }));
  $('#qEtc').onchange = (e) => { store.set('byr.etc', clamp(+e.target.value || 0, 0, 30)); renderProps(); };
  $('#qVat').onchange = (e) => { store.set('byr.vat', e.target.checked); renderProps(); };
  const nm = `${safeName()}_${varCur().name}_견적`;
  $('#qX').onclick = async () => { const data = SH.bomXlsx(rows, PRICE(), { title: `${S.model.name} · ${varCur().name} 견적서`, sub: `${new Date().toLocaleDateString('ko-KR')} · BYR2 · 전력 ${a.kw.toFixed(1)} kW`, etcPct: store.get('byr.etc', 0), vat: store.get('byr.vat', true) }); if (await saveFile({ title: '견적 엑셀', defaultName: nm + '.xlsx', extensions: ['xlsx'], data })) toast('견적 엑셀을 저장했어요 · 금액 칸은 수식이라 단가를 바꾸면 다시 계산돼요'); };
  $('#qC').onclick = async () => { if (await saveFile({ title: '견적 CSV', defaultName: nm + '.csv', extensions: ['csv'], data: SH.bomCsv(rows, PRICE()) })) toast('CSV 로 저장했어요'); };
  $$('[data-dact]', body).forEach((b) => (b.onclick = () => ACT[b.dataset.dact]()));
}
/* 안 (같은 층의 여러 배치안) */
function varEnsure() { const M = S.model; if (!M.variants || !M.variants.length) { M.variants = [{ id: 'va', name: 'A안', lv: M.activeLevel, data: null }]; M.varId = 'va'; } if (!M.variants.find((v) => v.id === M.varId)) M.varId = M.variants[0].id; }
const varCur = () => (varEnsure(), S.model.variants.find((v) => v.id === S.model.varId));
const varLevel = (v) => (v.id === S.model.varId ? level() : v.data);
function varAdd(name) { varEnsure(); const used = new Set(S.model.variants.map((v) => v.name)), nm = name || [...'ABCDEFGHIJ'].map((c) => c + '안').find((n) => !used.has(n)) || `안 ${S.model.variants.length + 1}`;
  const cur = varCur(); cur.data = JSON.parse(JSON.stringify(level())); cur.lv = S.model.activeLevel; const v = { id: uid('v'), name: nm, lv: S.model.activeLevel, data: null }; S.model.variants.push(v); S.model.varId = v.id; commit(); return v; }
function varSwitch(id) { varEnsure(); const M = S.model; if (id === M.varId) return; const v = M.variants.find((x) => x.id === id); if (!v || !v.data) return; const cur = varCur(); cur.data = JSON.parse(JSON.stringify(level())); cur.lv = M.activeLevel;
  M.levels[v.lv] = JSON.parse(JSON.stringify(v.data)); v.data = null; M.varId = id; switchLevel(v.lv); commit(); renderProps(); toast(`${v.name}으로 바꿨어요`); }
function varDel(id) { varEnsure(); const M = S.model; if (M.variants.length < 2) return; if (id === M.varId) { const o = M.variants.find((x) => x.id !== id); varSwitch(o.id); } M.variants = M.variants.filter((x) => x.id !== id); commit(); renderProps(); }
const AUTO = { kind: 'pel_delivery', ratio: null, front: 'auto', clear: false, newVar: false, scope: { kitchen: 1, hall: 1, mep: 1, finish: 1 } };
function renderAuto(body) {
  varEnsure(); const M = S.model, pr = SH.BIZ[AUTO.kind], ratio = AUTO.ratio ?? pr.ratio, fd = SH.frontSide(level()), FN = { N: '위', S: '아래', E: '오른쪽', W: '왼쪽' };
  $('#propsTitle').textContent = '자동 배치 · A안/B안';
  body.innerHTML = `<div class="sec">업종</div><div class="chips">${Object.entries(SH.BIZ).map(([k, b]) => `<button data-bz="${k}" aria-pressed="${AUTO.kind === k}">${esc(b.name)}</button>`).join('')}</div>
    <label class="fld">주방 비율 <b>${Math.round(ratio * 100)}%${ratio >= 0.95 ? ' · 배달 전용 (홀 없음)' : ''}</b><input type="range" id="auR" min="15" max="100" step="1" value="${Math.round(ratio * 100)}"></label>
    <div class="chips"><button data-rq="${pr.ratio}">기본 ${Math.round(pr.ratio * 100)}%</button><button data-rq="0.5">50%</button><button data-rq="0.7">70%</button><button data-rq="1">100% 배달 전용</button></div>
    <label class="fld">정면 (출입구 쪽, 2D 기준)<select id="auF"><option value="auto">자동${fd ? ` · 문이 있는 ${FN[fd.side]}` : ' · 아래'}</option>${Object.entries(FN).map(([k, n]) => `<option value="${k}" ${AUTO.front === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="row">${num('주방 통로 폭', 'aisle', aisleOf(), 50)}</div>
    <div class="sec">넣을 것</div><div class="chips">${[['kitchen', '주방 기물'], ['hall', '홀 (카운터 · 테이블)'], ['mep', '설비 (후드 · 배수 · 가스 · 3상)'], ['finish', '마감 색']].map(([k, n]) => `<button data-sc="${k}" aria-pressed="${!!AUTO.scope[k]}">${n}</button>`).join('')}</div>
    <label class="chk"><input type="checkbox" id="auClr" ${AUTO.clear ? 'checked' : ''}> 직접 놓은 기물도 모두 지우고 배치</label>
    <label class="chk"><input type="checkbox" id="auNew" ${AUTO.newVar ? 'checked' : ''}> 새 안으로 배치 (지금 안은 그대로 둠)</label>
    <div class="btns"><button class="btn pri" id="auGo">배치하기</button></div>
    <p class="hint">매장 바깥 벽을 기준으로 뒤쪽에 주방 · 앞쪽에 홀을 나누고, 칸막이 · 배식구 · 주방 기물(뒷벽 → 옆벽 → 칸막이) · 후드 · 배수구 · 카운터 · 테이블을 놓아요. 다시 배치하면 자동으로 놓은 것만 바꿔요.${pr.pel ? ' 페리카나 매뉴얼 2025.01 의 기물 · 색을 써요.' : ''}</p>
    <div class="sec">배치안 · ${M.variants.length}개</div>
    ${M.variants.map((v) => { const m = SH.metrics(varLevel(v), S.lib, PRICE()); return `<div class="lvrow ${v.id === M.varId ? 'on' : ''}"><button class="lvgo" data-vsw="${v.id}">${esc(v.name)}${v.id === M.varId ? ' · 지금' : ''}</button><small>기물 ${m.items} · 좌석 ${m.seats} · ${m.kw}kW</small><button class="qb" data-vren="${v.id}">이름</button>${M.variants.length > 1 ? `<button class="qb danger" data-vdel="${v.id}">지우기</button>` : ''}</div>`; }).join('')}
    <div id="vRen" hidden class="row"><input id="vRenIn" aria-label="안 이름"><button class="btn pri" id="vRenOk">바꾸기</button></div>
    <div class="btns"><button class="btn" id="vAdd">+ 지금 안 복사해서 새 안</button><button class="btn" id="vCmp" ${M.variants.length < 2 ? 'disabled' : ''}>비교하기</button></div>`;
  $$('[data-bz]', body).forEach((b) => (b.onclick = () => { AUTO.kind = b.dataset.bz; AUTO.ratio = null; renderProps(); }));
  $('#auR').oninput = (e) => { AUTO.ratio = +e.target.value / 100; e.target.previousElementSibling.textContent = `${e.target.value}%${+e.target.value >= 95 ? ' · 배달 전용 (홀 없음)' : ''}`; };
  $$('[data-rq]', body).forEach((b) => (b.onclick = () => { AUTO.ratio = +b.dataset.rq; renderProps(); }));
  $('#auF').onchange = (e) => (AUTO.front = e.target.value);
  $('[data-k=aisle]', body).onchange = (e) => { S.model.aisle = clamp(Math.round(+e.target.value || 900), 400, 2000); commit(); };
  $$('[data-sc]', body).forEach((b) => (b.onclick = () => { AUTO.scope[b.dataset.sc] = AUTO.scope[b.dataset.sc] ? 0 : 1; renderProps(); }));
  $('#auClr').onchange = (e) => (AUTO.clear = e.target.checked); $('#auNew').onchange = (e) => (AUTO.newVar = e.target.checked);
  $('#auGo').onclick = async () => {
    if (AUTO.clear && level().items.some((it) => !it.pz) && !(await ask('기물을 모두 지우고 배치할까요?', '직접 놓은 기물도 지워져요. 되돌리기(↶)로 되돌릴 수 있어요.', [{ label: '취소', value: false }, { label: '지우고 배치', value: true, kind: 'pri' }]))) return;
    if (AUTO.newVar) varAdd(); setFocus(null);
    const r = SH.autoLayout(level(), S.lib, { kind: AUTO.kind, ratio: AUTO.ratio ?? pr.ratio, front: AUTO.front, aisle: aisleOf(), clear: AUTO.clear, scope: AUTO.scope }, mkItem, uid);
    if (r.error) return toast(r.error);
    S.sel = null; engine.setLevel(level()); applyEnv(); plan.fit(); syncCeilBtn(); commit(); renderProps();
    const a = SH.analyze(level(), S.lib, aisleOf()), w = a.checks.filter((c) => c.lvl !== 'work').length;
    toast(`${varCur().name} · ${pr.name}: ${r.placed}개 놓음${r.seats ? ` · 좌석 ${r.seats}석` : ''} · 주방 ${r.kitchenA.toFixed(1)}㎡${r.hallA ? ` / 홀 ${r.hallA.toFixed(1)}㎡` : ''}${r.miss.length ? ` · 못 넣음: ${r.miss.slice(0, 3).map((m) => (S.lib[m] || {}).name || m).join(', ')}` : ''}${r.note ? ' · ' + r.note : ''}${w ? ` · 점검 ${w}건` : ' · 점검 이상 없음'}`, 8000);
  };
  $$('[data-vsw]', body).forEach((b) => (b.onclick = () => varSwitch(b.dataset.vsw)));
  $$('[data-vdel]', body).forEach((b) => (b.onclick = async () => { const v = S.model.variants.find((x) => x.id === b.dataset.vdel); if (await ask(`${v.name}을 지울까요?`, '', [{ label: '취소', value: false }, { label: '지우기', value: true, kind: 'pri' }])) varDel(v.id); }));
  $$('[data-vren]', body).forEach((b) => (b.onclick = () => { const v = S.model.variants.find((x) => x.id === b.dataset.vren), box = $('#vRen'); box.hidden = false; $('#vRenIn').value = v.name; $('#vRenIn').focus(); $('#vRenOk').onclick = () => { v.name = $('#vRenIn').value.trim().slice(0, 30) || v.name; commit(); renderProps(); }; }));
  $('#vAdd').onclick = () => { const v = varAdd(); renderProps(); toast(`${v.name}을 만들었어요 · 지금 화면이 ${v.name}이에요`); };
  $('#vCmp').onclick = () => { S.cmp = { a: S.model.variants[0].id, b: (S.model.variants.find((v) => v.id !== S.model.variants[0].id) || {}).id }; S.panel = 'cmp'; renderProps(); };
}
function renderCmp(body) {
  varEnsure(); const V = S.model.variants, c = S.cmp || {}, va = V.find((v) => v.id === c.a) || V[0], vb = V.find((v) => v.id === c.b) || V[1] || V[0], P = PRICE();
  const ma = SH.metrics(varLevel(va), S.lib, P), mb = SH.metrics(varLevel(vb), S.lib, P), opt = (sel) => V.map((v) => `<option value="${v.id}" ${v.id === sel.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  const rowsDef = [['기물', 'items', '개', 0], ['좌석', 'seats', '석', 0], ['전력', 'kw', 'kW', 1], ['주방 면적', 'kitchen', '㎡', 1], ['홀 면적', 'hall', '㎡', 1], ['주방 비율', 'kr', '%', 0], ['겹침', 'bad', '건', 0], ['확인 필요', 'warn', '건', 0], ['견적 소계', 'cost', '원', 0]];
  for (const m of [ma, mb]) m.kr = m.total ? (m.kitchen / m.total) * 100 : 0;
  $('#propsTitle').textContent = '안 비교';
  body.innerHTML = `<div class="row"><label class="fld">왼쪽<select id="cA">${opt(va)}</select></label><label class="fld">오른쪽<select id="cB">${opt(vb)}</select></label></div>
    <div class="cmpv"><canvas id="cvA" width="300" height="220"></canvas><canvas id="cvB" width="300" height="220"></canvas></div>
    <div class="tblw"><table class="qt"><thead><tr><th></th><th>${esc(va.name)}</th><th>${esc(vb.name)}</th></tr></thead><tbody>${rowsDef.map(([n, k, u, d]) => { const x = ma[k], y = mb[k], f = (v) => (d ? v.toFixed(d) : Math.round(v).toLocaleString()); return `<tr><td>${n}</td><td class="n">${f(x)} ${u}</td><td class="n">${f(y)} ${u}${x !== y ? ` <small class="muted">(${y > x ? '+' : ''}${d ? (y - x).toFixed(d) : Math.round(y - x).toLocaleString()})</small>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="hint">견적 소계는 견적에 넣은 단가 기준이에요 (단가가 없으면 0).</p>
    <div class="btns"><button class="btn" id="cBack">← 자동 배치</button><button class="btn pri" id="cUse">${esc(vb.name)} 쓰기</button></div>`;
  SH.thumb($('#cvA'), varLevel(va), S.lib); SH.thumb($('#cvB'), varLevel(vb), S.lib);
  $('#cA').onchange = (e) => { S.cmp = { ...c, a: e.target.value, b: vb.id }; renderProps(); }; $('#cB').onchange = (e) => { S.cmp = { ...c, a: va.id, b: e.target.value }; renderProps(); };
  $('#cBack').onclick = () => ACT.auto(); $('#cUse').onclick = () => { varSwitch(vb.id); S.panel = 'cmp'; renderProps(); };
}

/* ----- 6차: 단면 보기 · 시점 저장 · 자동 투어 · 360° · 렌더 해상도 (기존 앱 v12 · v14) ----- */
const SEC = { mode: 'off', at: 1200, flip: false }, RES = { size: 'fhd', type: 'png' };
const RESN = { screen: ['지금 화면 크기', 0, 0], fhd: ['FHD 1920×1080', 1920, 1080], qhd: ['QHD 2560×1440', 2560, 1440], uhd: ['4K 3840×2160', 3840, 2160], sq: ['정사각 2048×2048', 2048, 2048], a4: ['A4 가로 3508×2480 (300dpi)', 3508, 2480] };
let tourOn = false;
function secRange() { const b = SH.bounds(level()); return SEC.mode === 'h' ? [100, (level().ceilingH || 2700) + 300] : SEC.mode === 'x' ? [b[0], b[2]] : [b[1], b[3]]; }
function applySection() { engine.setSection(SEC.mode === 'off' ? null : { ...SEC }); }
async function tour() {
  const V = S.model.views || []; if (tourOn) { tourOn = false; engine.stopFly(); renderProps(); return; }
  if (S.pane === '2d') setPane('split'); tourOn = true; renderProps(); const b = SH.bounds(level()), cx = (b[0] + b[2]) / 2 * 0.001, cz = (b[1] + b[3]) / 2 * 0.001, r = Math.max(4, Math.hypot(b[2] - b[0], b[3] - b[1]) * 0.001);
  const list = V.length ? V.map((v) => v.v) : [0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2 + 0.6; return { p: [cx + Math.cos(a) * r * 0.9, r * 0.75, cz + Math.sin(a) * r * 0.9], t: [cx, 0.8, cz], zoom: 1 }; });
  for (let k = 0; tourOn; k = (k + 1) % list.length) { const ok = await engine.flyTo(list[k], 2600); if (!ok || !tourOn) break; await new Promise((r2) => setTimeout(r2, 1100)); if (!V.length && k === list.length - 1) { /* 한 바퀴 */ } }
  tourOn = false; if (S.panel === 'view') renderProps();
}
function renderView(body) {
  const M = S.model, V = M.views || [], rg = secRange();
  $('#propsTitle').textContent = '단면 · 시점 · 이미지';
  body.innerHTML = `<div class="sec">단면 보기 · 잘라서 속 보기</div>
    <div class="chips">${[['off', '끄기'], ['h', '높이에서 (위를 걷어냄)'], ['x', '세로 (좌우)'], ['z', '세로 (앞뒤)']].map(([k, n]) => `<button data-sec="${k}" aria-pressed="${SEC.mode === k}">${n}</button>`).join('')}</div>
    ${SEC.mode !== 'off' ? `<label class="fld">자르는 위치 <b id="secV">${Math.round(SEC.at)} mm</b><input type="range" id="secAt" min="${Math.round(rg[0])}" max="${Math.round(rg[1])}" step="10" value="${Math.round(clamp(SEC.at, rg[0], rg[1]))}"></label>${SEC.mode !== 'h' ? `<label class="chk"><input type="checkbox" id="secFlip" ${SEC.flip ? 'checked' : ''}> 반대쪽 보기</label>` : ''}` : ''}
    <label class="fld">벽 낮춰 보기 <b id="wcV">${engine.wallCut ? engine.wallCut + ' mm' : '끔'}</b><input type="range" id="wcAt" min="300" max="${(level().ceilingH || 2700)}" step="50" value="${engine.wallCut || level().ceilingH || 2700}"></label>
    <div class="sec">레이어 투명도</div>
    ${Object.entries(LAYERN).map(([k, n]) => `<label class="fld">${n} <b data-lov="${k}">${Math.round(((engine.layerOp || {})[k] ?? 1) * 100)}%</b><input type="range" data-lo="${k}" min="0" max="100" step="5" value="${Math.round(((engine.layerOp || {})[k] ?? 1) * 100)}"></label>`).join('')}
    <div class="sec">시점 저장 · ${V.length}개</div>
    ${V.map((v) => `<div class="lvrow"><button class="lvgo" data-vgo="${v.id}">${esc(v.name)}</button><button class="qb danger" data-vx="${v.id}">지우기</button></div>`).join('') || '<p class="hint">지금 보고 있는 시점을 이름 붙여 저장해 두면 누르는 순간 그 자리로 가요.</p>'}
    <div class="row"><input id="vName" placeholder="시점 이름 (예: 입구에서)" aria-label="시점 이름"><button class="btn" id="vSave">+ 지금 시점 저장</button></div>
    <div class="btns"><button class="btn ${tourOn ? 'pri' : ''}" id="vTour">${tourOn ? '■ 투어 멈춤' : `▶ 자동 투어${V.length ? ` (${V.length}곳)` : ' (네 방향)'}`}</button><button class="btn ${engine.controls.autoRotate ? 'pri' : ''}" id="vSpin">${engine.controls.autoRotate ? '■ 360° 멈춤' : '↻ 360° 돌려 보기'}</button></div>
    <div class="sec">이미지 저장 · 렌더 해상도</div>
    <label class="fld">크기<select id="rSize">${Object.entries(RESN).map(([k, v]) => `<option value="${k}" ${RES.size === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
    <div class="chips">${[['png', 'PNG'], ['jpeg', 'JPEG']].map(([k, n]) => `<button data-rt="${k}" aria-pressed="${RES.type === k}">${n}</button>`).join('')}</div>
    <div class="btns"><button class="btn pri" id="rGo">3D 이미지 저장</button><button class="btn" data-dact="planImg">평면도 JPEG</button></div>
    <p class="hint">큰 크기는 지금 보기 스타일 그대로 다시 그려서 저장해요. 단면을 켠 채로 저장하면 단면 그림이 돼요.</p>`;
  $$('[data-sec]', body).forEach((b) => (b.onclick = () => { SEC.mode = b.dataset.sec; const r2 = secRange(); SEC.at = SEC.mode === 'h' ? 1500 : (r2[0] + r2[1]) / 2; applySection(); renderProps(); }));
  const sa = $('#secAt'); if (sa) sa.oninput = () => { SEC.at = +sa.value; $('#secV').textContent = `${SEC.at} mm`; applySection(); };
  const sf = $('#secFlip'); if (sf) sf.onchange = () => { SEC.flip = sf.checked; applySection(); };
  $('#wcAt').oninput = (e) => { const H = level().ceilingH || 2700, v = +e.target.value; engine.setWallCut(v >= H ? null : v); $('#wcV').textContent = v >= H ? '끔' : v + ' mm'; };
  $$('[data-lo]', body).forEach((i) => (i.oninput = () => { const op = { ...(engine.layerOp || {}) }; op[i.dataset.lo] = +i.value / 100; engine.setLayerOpacity(op); $(`[data-lov="${i.dataset.lo}"]`).textContent = i.value + '%'; }));
  $$('[data-vgo]', body).forEach((b) => (b.onclick = () => { const v = (M.views || []).find((q) => q.id === b.dataset.vgo); if (v) { if (S.pane === '2d') setPane('split'); engine.flyTo(v.v, 900); } }));
  $$('[data-vx]', body).forEach((b) => (b.onclick = () => { M.views = (M.views || []).filter((q) => q.id !== b.dataset.vx); commit(); renderProps(); }));
  $('#vSave').onclick = () => { M.views ||= []; M.views.push({ id: uid('v'), name: $('#vName').value.trim().slice(0, 30) || `시점 ${M.views.length + 1}`, v: engine.getView() }); commit(); renderProps(); toast('시점을 저장했어요'); };
  $('#vTour').onclick = () => tour();
  $('#vSpin').onclick = () => { engine.setSpin(!engine.controls.autoRotate); if (engine.controls.autoRotate && S.pane === '2d') setPane('split'); renderProps(); };
  $('#rSize').onchange = (e) => (RES.size = e.target.value);
  $$('[data-rt]', body).forEach((b) => (b.onclick = () => { RES.type = b.dataset.rt; renderProps(); }));
  $('#rGo').onclick = async () => { if (S.pane === '2d') { setPane('split'); await new Promise((r2) => setTimeout(r2, 150)); } setSel(null); const [, W, H] = RESN[RES.size], ty = 'image/' + RES.type, url = W ? engine.snapshotAt(W, H, ty) : engine.snapshot();
    const b = Uint8Array.from(atob(url.split(',')[1]), (x) => x.charCodeAt(0)), ext = RES.type === 'jpeg' ? 'jpg' : 'png'; if (await saveFile({ title: '이미지', defaultName: `${safeName()}${W ? `-${W}x${H}` : ''}.${ext}`, extensions: [ext], data: b })) toast(`이미지를 저장했어요 (${(b.length / 1e6).toFixed(1)}MB)`); };
  $$('[data-dact]', body).forEach((b) => (b.onclick = () => ACT[b.dataset.dact]()));
}


/** 이미지 파일 → 1024px 이하 JPEG dataURL (프로젝트에 함께 저장 · 동기화) */
async function pickTexture() {
  const f = (await openFiles({ title: '텍스처 이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f) return null;
  const url = URL.createObjectURL(new Blob([f.data])), img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; }).catch(() => null); URL.revokeObjectURL(url); if (!img) { toast('이미지를 읽지 못했어요'); return null; }
  const k = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85);
}
/* ----- 댓글 · 핀 (기존 앱 v7) ----- */
const pinsHere = () => (S.model.comments || []).filter((c) => (c.lv ?? 0) === S.model.activeLevel);
function syncPins() { if (!S.model || !plan) return; const P = pinsHere(); plan.pins = P; engine.setPins(P); }
function renderCmt(body) {
  const P = pinsHere(), tm = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }), me = (cloud.session() || {}).name || '나';
  $('#propsTitle').textContent = '댓글 · 핀';
  body.innerHTML = `<p class="hint">2D 도면에서 자리를 눌러 핀을 꽂고 메모를 남겨요. 프로젝트 파일 · 계정 동기화에 함께 저장돼서 다른 기기 · 다른 사람과 볼 수 있어요.</p>
    <div class="btns"><button class="btn pri" id="cmPin">+ 핀 꽂기</button></div>
    ${P.map((c, i) => `<div class="cmt ${c.done ? 'done' : ''}"><b>${i + 1}</b><div><p>${esc(c.text || '(메모 없음)')}</p><small>${esc(c.by || '')} · ${tm(c.t)}${(c.re || []).length ? ` · 답글 ${c.re.length}` : ''}</small>${(c.re || []).map((r) => `<p class="re">↳ ${esc(r.text)} <small>${esc(r.by || '')}</small></p>`).join('')}
      <div class="btns"><button class="qb" data-cgo="${c.id}">보기</button><button class="qb" data-cre="${c.id}">답글</button><button class="qb" data-cdn="${c.id}">${c.done ? '다시 열기' : '해결'}</button><button class="qb danger" data-cx="${c.id}">지우기</button></div></div></div>`).join('') || '<p class="hint">아직 핀이 없어요</p>'}
    <div id="cmBox" hidden class="row"><input id="cmIn" placeholder="메모" aria-label="메모"><button class="btn pri" id="cmOk">남기기</button></div>`;
  const C = () => (S.model.comments ||= []), find = (id) => C().find((c) => c.id === id);
  const askText = (cb) => { const b = $('#cmBox'); b.hidden = false; $('#cmIn').value = ''; $('#cmIn').focus(); $('#cmOk').onclick = () => { const t = $('#cmIn').value.trim(); if (t) cb(t.slice(0, 500)); }; $('#cmIn').onkeydown = (e) => { if (e.key === 'Enter') $('#cmOk').click(); }; };
  $('#cmPin').onclick = () => { if (S.pane === '3d') setPane('split'); plan.setTool('pick'); toast('2D 도면에서 핀을 꽂을 자리를 누르세요 · Esc 취소', 5000);
    plan.picker = (p, hit) => { plan.picker = null; plan.setTool('select'); const it = hit && level().items.find((q) => q.id === hit); const c = { id: uid('c'), lv: S.model.activeLevel, x: Math.round(p.x), y: Math.round(p.y), z: it ? SL.itemZ(level(), it, S.lib) + (it.h || 0) + 150 : 1600, item: it ? it.id : null, text: '', by: me, t: Date.now(), done: false, re: [] };
      C().push(c); commit(); renderProps(); askText((t) => { c.text = t; commit(); renderProps(); }); }; };
  $$('[data-cgo]', body).forEach((b) => (b.onclick = () => { const c = find(b.dataset.cgo); engine.frame([[c.x - 2000, c.y - 2000], [c.x + 2000, c.y + 2000]]); }));
  $$('[data-cre]', body).forEach((b) => (b.onclick = () => askText((t) => { const c = find(b.dataset.cre); (c.re ||= []).push({ text: t, by: me, t: Date.now() }); commit(); renderProps(); })));
  $$('[data-cdn]', body).forEach((b) => (b.onclick = () => { const c = find(b.dataset.cdn); c.done = !c.done; commit(); renderProps(); }));
  $$('[data-cx]', body).forEach((b) => (b.onclick = () => { S.model.comments = C().filter((c) => c.id !== b.dataset.cx); commit(); renderProps(); }));
}
/* ----- 여러 개 고르기 · 정렬 · 간격 (기존 앱 v9) ----- */
const multiItems = () => level().items.filter((q) => (S.multi || []).includes(q.id));
const ext = (q) => { const r = ((q.rot || 0) % 180) === 90; return { hw: (r ? q.d : q.w) / 2, hd: (r ? q.w : q.d) / 2 }; };
function renderMulti(body) {
  const its = multiItems(), kw = its.reduce((a, q) => a + SH.itemKw(q, S.lib), 0);
  $('#propsTitle').textContent = `여러 개 · ${its.length}개`;
  body.innerHTML = `<p class="hint">고른 기물 중 하나를 끌면 함께 옮겨져요. Shift+누르기로 더하고 빼요. 전력 ${kw.toFixed(1)} kW</p>
    <div class="sec">정렬</div><div class="chips">${[['l', '왼쪽'], ['cx', '가로 가운데'], ['r', '오른쪽'], ['t', '위'], ['cy', '세로 가운데'], ['b', '아래']].map(([k, n]) => `<button data-al="${k}">${n}</button>`).join('')}</div>
    <div class="sec">간격 같게</div><div class="chips"><button data-ds="x">가로로</button><button data-ds="y">세로로</button><button data-ds="xt">가로로 딱 붙이기</button><button data-ds="yt">세로로 딱 붙이기</button></div>
    <div class="sec">한꺼번에</div><div class="row"><label class="fld">색<input type="color" id="muC" value="#b8bcc2"></label><label class="fld">재질<select id="muM"><option value="">그대로</option>${Object.entries(MAT_LABEL).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label></div>
    <div class="btns"><button class="btn" data-mu="rot">묶어서 90° 돌리기</button><button class="btn" data-mu="dup">복제</button><button class="btn danger" data-mu="del">삭제</button><button class="btn" data-mu="none">고르기 풀기</button></div>`;
  const done = (msg) => { for (const q of its) engine.moveItem(q); commit(); plan.redraw(); if (msg) toast(msg, 2000); };
  $$('[data-al]', body).forEach((b) => (b.onclick = () => { const k = b.dataset.al, E = its.map((q) => ({ q, ...ext(q) }));
    const v = { l: Math.min(...E.map((e) => e.q.x - e.hw)), r: Math.max(...E.map((e) => e.q.x + e.hw)), t: Math.min(...E.map((e) => e.q.y - e.hd)), b: Math.max(...E.map((e) => e.q.y + e.hd)), cx: E.reduce((a, e) => a + e.q.x, 0) / E.length, cy: E.reduce((a, e) => a + e.q.y, 0) / E.length }[k];
    for (const e of E) { if (k === 'l') e.q.x = Math.round(v + e.hw); if (k === 'r') e.q.x = Math.round(v - e.hw); if (k === 't') e.q.y = Math.round(v + e.hd); if (k === 'b') e.q.y = Math.round(v - e.hd); if (k === 'cx') e.q.x = Math.round(v); if (k === 'cy') e.q.y = Math.round(v); } done('맞췄어요'); }));
  $$('[data-ds]', body).forEach((b) => (b.onclick = () => { const k = b.dataset.ds, ax = k[0] === 'x' ? 'x' : 'y', hk = ax === 'x' ? 'hw' : 'hd', E = its.map((q) => ({ q, ...ext(q) })).sort((a, c) => a.q[ax] - c.q[ax]); if (E.length < 2) return;
    const a0 = E[0].q[ax] - E[0][hk], a1 = E[E.length - 1].q[ax] + E[E.length - 1][hk], tot = E.reduce((a, e) => a + 2 * e[hk], 0), gap = k.length > 1 ? 0 : (a1 - a0 - tot) / (E.length - 1); let c = a0;
    for (const e of E) { e.q[ax] = Math.round(c + e[hk]); c += 2 * e[hk] + gap; } done(k.length > 1 ? '딱 붙였어요' : `간격 ${Math.round(gap)} mm 로 맞췄어요`); }));
  $('#muC').onchange = (e) => { for (const q of its) { q.color = e.target.value; engine.rebuildItem(q); } commit(); };
  $('#muM').onchange = (e) => { if (!e.target.value) return; for (const q of its) { q.mat = e.target.value; engine.rebuildItem(q); } commit(); };
  $$('[data-mu]', body).forEach((b) => (b.onclick = () => { const a = b.dataset.mu;
    if (a === 'none') return plan.setMulti([]);
    if (a === 'del') { const set = new Set(S.multi); level().items = level().items.filter((q) => !set.has(q.id)); for (const id of set) engine.removeItem(id); plan.setMulti([]); commit(); return toast(`${set.size}개를 지웠어요`); }
    if (a === 'dup') { const n = its.map((q) => ({ ...JSON.parse(JSON.stringify(q)), id: uid('i'), x: q.x + 400, y: q.y + 400 })); level().items.push(...n); n.forEach((q) => engine.rebuildItem(q)); commit(); plan.setMulti(n.map((q) => q.id)); return; }
    if (a === 'rot') { const cx = its.reduce((s2, q) => s2 + q.x, 0) / its.length, cy = its.reduce((s2, q) => s2 + q.y, 0) / its.length; for (const q of its) { const dx = q.x - cx, dy = q.y - cy; q.x = Math.round(cx - dy); q.y = Math.round(cy + dx); q.rot = ((q.rot || 0) + 90) % 360; } done('묶어서 돌렸어요'); } }));
}
function patrolDone(pts) {
  const P = S.patrol, Sm = engine.sim, d = Sm.data(S.model); S.patrol = null; setPlanTool('select');
  if (P.idx != null && d.walkers[P.idx]) d.walkers[P.idx].path = pts; else Sm.addWalker(S.model, P.sex, pts);
  commit(); if (Sm.on) Sm.reset(S.model); S.tucked = null; S.panel = 'sim'; S.propsOpen = true; renderProps(); toast('길을 저장했어요 · ▶ 시작을 누르면 왔다 갔다 해요');
}
/* ----- 작업 기록 ----- */
function renderHist(body) {
  const tm = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), U = S.um, Rd = S.rm;
  $('#propsTitle').textContent = '작업 기록';
  body.innerHTML = `<p class="hint">누르면 그 작업을 한 바로 뒤로 돌아가요 (되돌리기 여러 번과 같아요). 최근 60개까지 · 이 화면을 연 뒤의 작업만 남아요.</p>
    <ul class="clist">${Rd.slice().map((m, i) => `<li><button data-hr="${Rd.length - i}" style="opacity:.55">↷ ${tm(m.t)} · ${esc(m.l)} <small>(되돌린 작업)</small></button></li>`).join('')}
    <li><button disabled style="border-color:var(--accent)">● 지금</button></li>
    ${U.slice().reverse().map((m, i) => `<li><button data-hu="${i}">${tm(m.t)} · ${esc(m.l)}</button></li>`).join('')}${U.length ? '' : '<li><p class="hint">아직 기록이 없어요</p></li>'}</ul>`;
  $$('[data-hu]', body).forEach((b) => (b.onclick = () => { for (let k = 0; k < +b.dataset.hu; k++) undo(); renderProps(); }));
  $$('[data-hr]', body).forEach((b) => (b.onclick = () => { for (let k = 0; k < +b.dataset.hr; k++) redo(); renderProps(); }));
}
/* ----- DXF 가져오기 (캐드 선 → 벽) ----- */
const DXFO = { unit: 'auto', merge: true, rest: true, replace: true };
function dxfLoad(name, bytes) {
  let txt = new TextDecoder('utf-8').decode(bytes); if (txt.includes('�')) { try { txt = new TextDecoder('euc-kr').decode(bytes); } catch {} }
  if (/^AC10\d\d/.test(txt.slice(0, 6))) return toast('이진(binary) DXF 는 읽지 못해요 · 캐드에서 ASCII DXF 로 저장해 주세요');
  const D = CAD.parseDxf(txt); if (!D.segs.length) return toast('DXF 에서 선을 찾지 못했어요 (LINE · POLYLINE · ARC)');
  const cnt = {}; for (const sg of D.segs) cnt[sg.layer] = (cnt[sg.layer] || 0) + 1;
  S.dxf = { name, D, cnt, on: new Set(D.layers.filter((l) => /wall|벽|a-wall|^0$/i.test(l)).length ? D.layers.filter((l) => /wall|벽|a-wall|^0$/i.test(l)) : D.layers) };
  S.panel = 'dxf'; S.propsOpen = true; renderProps();
}
function renderDxf(body) {
  const X = S.dxf; if (!X) { S.panel = 'props'; return renderProps(); }
  const r = CAD.dxfWalls(X.D, { unit: DXFO.unit, layers: [...X.on], merge: DXFO.merge, rest: DXFO.rest, wallT: S.model.wallT || 150 }), sc = CAD.dxfScale(X.D, DXFO.unit);
  $('#propsTitle').textContent = 'DXF 가져오기';
  body.innerHTML = `<p class="hint">${esc(X.name)} · 선 ${X.D.segs.length}개 · 레이어 ${X.D.layers.length}개 · 단위 ×${sc} mm</p>
    <div class="sec">벽으로 쓸 레이어</div><div class="chips">${X.D.layers.map((l) => `<button data-dl="${esc(l)}" aria-pressed="${X.on.has(l)}">${esc(l)} <small>${X.cnt[l]}</small></button>`).join('')}</div>
    <label class="fld">단위<select id="dxU">${[['auto', '자동'], ['1', 'mm'], ['10', 'cm'], ['1000', 'm'], ['25.4', 'inch']].map(([v, n]) => `<option value="${v}" ${DXFO.unit === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="chk"><input type="checkbox" id="dxM" ${DXFO.merge ? 'checked' : ''}> 평행한 두 줄은 벽 하나로 (두께 자동)</label>
    <label class="chk"><input type="checkbox" id="dxR" ${DXFO.rest ? 'checked' : ''}> 짝이 없는 선도 벽으로</label>
    <label class="chk"><input type="checkbox" id="dxP" ${DXFO.replace ? 'checked' : ''}> 지금 층의 벽 · 문/창을 바꿔 넣기 (끄면 더하기)</label>
    <div class="cmpv"><canvas id="dxC" width="300" height="220"></canvas><div class="hint" style="align-self:center">벽 ${r.walls.length}개가 만들어져요.<br>두께: ${[...new Set(r.walls.map((w) => w.t))].slice(0, 5).join(' · ')} mm</div></div>
    <div class="btns"><button class="btn" id="dxX">취소</button><button class="btn pri" id="dxGo" ${r.walls.length ? '' : 'disabled'}>벽 ${r.walls.length}개 만들기</button></div>`;
  SH.thumb($('#dxC'), { walls: r.walls, items: [], rooms: [] }, S.lib);
  $$('[data-dl]', body).forEach((b) => (b.onclick = () => { const l = b.dataset.dl; X.on.has(l) ? X.on.delete(l) : X.on.add(l); renderProps(); }));
  $('#dxU').onchange = (e) => { DXFO.unit = e.target.value; renderProps(); };
  $('#dxM').onchange = (e) => { DXFO.merge = e.target.checked; renderProps(); }; $('#dxR').onchange = (e) => { DXFO.rest = e.target.checked; renderProps(); }; $('#dxP').onchange = (e) => (DXFO.replace = e.target.checked);
  $('#dxX').onclick = () => { S.dxf = null; S.panel = 'props'; S.propsOpen = false; renderProps(); };
  $('#dxGo').onclick = () => { const L = level(), H = L.ceilingH || 2700, made = r.walls.map((w) => ({ id: uid('w'), x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, t: w.t, h: H, color: '#ece8e1', finish: 'paint' }));
    if (DXFO.replace) { L.walls = made; L.openings = []; } else L.walls.push(...made); S.dxf = null; S.panel = 'props'; S.sel = null; engine.setLevel(L); applyEnv(); plan.fit(); commit(); renderProps(); toast(`DXF 에서 벽 ${made.length}개를 만들었어요 · 공간 → "벽 따라 공간 자동 찾기" 로 바닥을 만들 수 있어요`, 7000); };
}
/* ----- 공기 흐름 · 열/연기 ----- */
function toggleAir() {
  const A = engine.air; if (A.on) { A.stop(); $('#airHud').hidden = true; } else { if (S.pane === '2d') setPane('split'); A.start(); $('#airHud').hidden = false; A.info(); }
  const b = $('#dkAir'); if (b) b.setAttribute('aria-pressed', String(A.on));
}
function airHud(i) {
  const h = $('#airHud'); if (!h || h.hidden) return;
  h.innerHTML = `<span><b>공기</b> 급기 ${i.in} · 배기 ${i.out} · 후드 ${i.hood} · 출입구 ${i.door}</span>${i.heat ? `<span>열원 ${i.heat} · 후드 포집 <b class="${i.capture != null && i.capture < 70 ? 'warn' : ''}">${i.capture == null ? '계산 중' : i.capture + '%'}</b></span>` : ''}${!i.out && !i.hood ? '<span class="warn">후드 · 배기가 없어요</span>' : ''}<button class="btn" id="airSmoke" aria-pressed="${engine.air.smoke}">연기</button><button class="btn" id="airOff">끄기</button>`;
  $('#airSmoke').onclick = () => { engine.air.smoke = !engine.air.smoke; airHud(i); }; $('#airOff').onclick = () => toggleAir();
}
/* ----- 동선 시뮬레이터 (직원 배치) ----- */
function renderSim(body) {
  const M = S.model, Sm = engine.sim, d = Sm.data(M), famOpt = Object.entries(FAMN).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  $('#propsTitle').textContent = '동선 · 직원 배치';
  body.innerHTML = `<p class="hint">직원마다 일하는 순서를 정하면, 주방(태그) 안의 기물 앞자리를 찾아 걸어가요. 겹치는 곳이 많으면 기물 위치나 순서를 바꿔 보세요.</p>
    <div class="plist">${d.actors.map((a, i) => { const A = Sm.A[i]; return `<div class="hsec" style="padding:10px;gap:6px"><div class="row2"><span><i class="dot" style="background:${a.color}"></i><b>${esc(a.name)}</b></span><span><input type="color" data-sc="${i}" value="${a.color}" aria-label="직원 색" style="width:34px;height:30px;border:0;background:none"><button class="btn danger" data-sdel="${i}">빼기</button></span></div>
      <div class="chips">${a.plan.map((f, k) => `<button data-sstep="${i}:${k}" aria-pressed="${!!(Sm.on && A && A.step === k)}" title="눌러서 빼기">${FAMN[f] || f} ✕</button>`).join('')}<select data-sadd="${i}" aria-label="일 더하기"><option value="">+ 일 더하기</option>${famOpt}</select></div>
      ${Sm.on && A ? `<small class="hint">${A.miss ? '<b class="warn">' + esc(A.label) + '</b>' : '지금: ' + esc(A.label)}${A.last ? ` · 한 바퀴 ${A.last.t.toFixed(0)}초 · ${(A.last.d / 1000).toFixed(1)}m` : ''}</small>` : ''}</div>`; }).join('') || '<p class="hint">아직 직원이 없어요</p>'}</div>
    <div class="sec">유동인구 · 순찰 (그린 길을 왔다 갔다)</div>
    ${d.walkers.map((w, i) => `<div class="lvrow"><i class="dot" style="background:${w.color}"></i><span class="lvgo" style="flex:1">${esc(w.name)} <small>점 ${w.path.length}개</small></span>
      <select data-wm="${i}" aria-label="움직임"><option value="pingpong" ${w.mode !== 'loop' ? 'selected' : ''}>왕복</option><option value="loop" ${w.mode === 'loop' ? 'selected' : ''}>한 방향 반복</option></select>
      <select data-wv="${i}" aria-label="속도">${[[800, '천천히'], [1200, '보통'], [1600, '빠르게']].map(([v, n]) => `<option value="${v}" ${(w.speed || 1200) === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="qb" data-wr="${i}">다시 그리기</button><button class="qb danger" data-wx="${i}">지우기</button></div>`).join('')}
    <div class="btns"><button class="btn" data-wadd="m">+ 남자 길 그리기</button><button class="btn" data-wadd="f">+ 여자 길 그리기</button></div>
    <p class="hint">2D 에서 지나갈 점을 차례로 누르고, 마지막 점을 한 번 더 누르면(또는 Enter) 끝나요. 점 사이는 벽 · 기물을 돌아서 걸어요. 사람끼리 마주치면 비켜 가요.</p>
    <div class="row"><label class="fld">직원 더하기<select id="simRole">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}">${r[0]}</option>`).join('')}</select></label><div class="btns" style="align-items:flex-end"><button class="btn" id="simAdd">더하기</button></div></div>
    <div class="btns"><button class="btn pri" id="simPlay">${Sm.on && Sm.run ? '❚❚ 멈춤' : '▶ 시작'}</button>${[1, 2, 4].map((v) => `<button class="btn ${Sm.speed === v ? 'pri' : ''}" data-sp="${v}">${v}배</button>`).join('')}<button class="btn" id="simReset" ${Sm.on ? '' : 'disabled'}>처음부터</button><button class="btn" id="simStop" ${Sm.on ? '' : 'disabled'}>끝내기</button></div>
    <label class="tog">동선 열지도 (많이 지나간 곳 빨강)<input type="checkbox" id="simHeat" ${Sm.heatOn ? 'checked' : ''}></label>
    <label class="fld">카메라<select id="simFollow"><option value="-1">위에서 보기</option>${d.actors.map((a, i) => `<option value="${i}" ${Sm.follow === i ? 'selected' : ''}>${esc(a.name)} 따라가기</option>`).join('')}</select></label>
    ${Sm.on ? `<p class="hint">겹침(부딪힘) <b class="${Sm.hits > Sm.t / 20 ? 'warn' : ''}">${Sm.hits}회</b> · ${Math.round(Sm.t)}초 · ${Sm.hits > Sm.t / 20 ? '동선이 자주 겹쳐요' : '괜찮아요'}${level().rooms.some((r) => r.kind === '주방') ? '' : ' · <b class="warn">주방 태그 공간이 없어 매장 전체에서 찾아요</b>'}</p>` : ''}`;
  const changed = () => { commit(); if (Sm.on) Sm.reset(M); renderProps(); };
  $$('[data-sdel]', body).forEach((b) => (b.onclick = () => { d.actors.splice(+b.dataset.sdel, 1); changed(); }));
  $$('[data-sc]', body).forEach((c) => (c.onchange = () => { d.actors[+c.dataset.sc].color = c.value; changed(); }));
  $$('[data-sstep]', body).forEach((b) => (b.onclick = () => { const [i, k] = b.dataset.sstep.split(':').map(Number); if (d.actors[i].plan.length > 1) { d.actors[i].plan.splice(k, 1); changed(); } }));
  $$('[data-sadd]', body).forEach((sel) => (sel.onchange = () => { if (sel.value) { d.actors[+sel.dataset.sadd].plan.push(sel.value); changed(); } }));
  $('#simAdd').onclick = () => { Sm.add(M, $('#simRole').value); changed(); };
  $$('[data-wadd]', body).forEach((b) => (b.onclick = () => { S.patrol = { sex: b.dataset.wadd }; plan.lineKind = 'wire'; setPlanTool('line'); toast(`${b.dataset.wadd === 'f' ? '여자' : '남자'} 길: 2D 에서 점을 차례로 · 마지막 점을 한 번 더 누르면 끝 · Esc 취소`, 6000); }));
  $$('[data-wr]', body).forEach((b) => (b.onclick = () => { S.patrol = { idx: +b.dataset.wr }; plan.lineKind = 'wire'; setPlanTool('line'); toast('새 길을 그려 주세요 · 마지막 점을 한 번 더 누르면 끝', 5000); }));
  $$('[data-wx]', body).forEach((b) => (b.onclick = () => { d.walkers.splice(+b.dataset.wx, 1); changed(); }));
  $$('[data-wm]', body).forEach((x) => (x.onchange = () => { d.walkers[+x.dataset.wm].mode = x.value; changed(); }));
  $$('[data-wv]', body).forEach((x) => (x.onchange = () => { d.walkers[+x.dataset.wv].speed = +x.value; changed(); }));
  $('#simPlay').onclick = () => { if (!Sm.on) { if (S.pane === '2d') setPane('split'); Sm.start(M); engine.view('top'); commit(); } else Sm.run = !Sm.run; syncSimBtn(); renderProps(); };
  $$('[data-sp]', body).forEach((b) => (b.onclick = () => { Sm.speed = +b.dataset.sp; renderProps(); }));
  $('#simReset').onclick = () => { Sm.reset(M); renderProps(); };
  $('#simStop').onclick = () => { Sm.stop(); plan.simA = null; plan.redraw(); syncSimBtn(); renderProps(); };
  $('#simHeat').onchange = (e) => { Sm.heatOn = e.target.checked; };
  $('#simFollow').onchange = (e) => { Sm.follow = +e.target.value; if (Sm.follow < 0) engine.view('top'); };
}
function syncSimBtn() { const b = $('#dkSim'); if (b) b.setAttribute('aria-pressed', String(engine.sim.on)); }

/* ----- 층 · 천장 · 치수 ----- */
function renderLevels(body) {
  const M = S.model, L = level(), C = L.ceiling || {};
  $('#propsTitle').textContent = '층 · 천장';
  body.innerHTML = `<div class="plist">${M.levels.map((l, i) => `<div class="prow ${i === M.activeLevel ? 'on' : ''}"><button data-lv="${i}"><b>${esc(l.name)}</b><small>바닥 +${(l.elev || 0).toLocaleString()} · 천장 ${l.ceilingH || 2700} · 벽 ${l.walls.length} · 기물 ${l.items.length}</small></button></div>`).join('')}</div>
    <div class="btns"><button class="btn pri" data-la="add">층 추가 (바깥 벽 복사)</button><button class="btn" data-la="blank">빈 층 추가</button><button class="btn" data-la="dup">이 층 복제</button></div>
    <div class="sec">지금 층 · ${esc(L.name)}</div>
    <label class="fld">이름<input type="text" data-l="name" value="${esc(L.name)}"></label>
    <div class="row">${num('바닥 높이 (아래층 기준)', 'elev', L.elev || 0)}${num('층고 · 슬래브', 'slabH', L.slabH || 3300)}</div>
    <div class="sec">천장</div>
    <label class="tog">천장 보이기 (위에서 보면 투명)<input type="checkbox" data-c="on" ${C.on !== false ? 'checked' : ''}></label>
    <div class="row">${num('천장 마감 높이', 'ceilingH', L.ceilingH || 2700)}${num('천장 가벽 높이', 'soffitH', L.soffitH || 2400)}</div>
    <div class="row"><label class="fld">천장 색<input type="color" data-c="color" value="${/^#[0-9a-f]{6}$/i.test(C.color) ? C.color : '#f3f1ec'}"></label><label class="fld">불투명도<input type="range" data-c="opacity" min="0.2" max="1" step="0.05" value="${C.opacity ?? 1}"></label></div>
    <div class="btns"><button class="btn" data-la="soffit">천장 가벽 그리기 (2D 사각형)</button><button class="btn" data-la="wallsH">벽 높이를 천장에 맞추기</button></div>
    <p class="hint">천장 설비(조명 · 에어컨 · 덕트)는 기물 목록 "천장 설비" 에서 넣으면 천장 높이에 붙어요. 공간마다 천장 높이를 다르게 하려면 공간 카드의 "천장 높이"를 쓰세요.</p>
    <div class="sec">치수</div>
    <label class="tog">줄자 치수 보이기 (2D · 3D)<input type="checkbox" data-d="dimsOn" ${L.dimsOn !== false ? 'checked' : ''}></label>
    <label class="tog">벽 길이 자동 표시 (2D)<input type="checkbox" id="autoDims" ${plan.autoDims ? 'checked' : ''}></label>
    <div class="btns"><button class="btn" data-la="measure">줄자로 재기</button><button class="btn danger" data-la="clearDims" ${(L.dims || []).length ? '' : 'disabled'}>치수 모두 지우기 (${(L.dims || []).length})</button></div>
    ${M.levels.length > 1 ? '<div class="btns"><button class="btn danger" data-la="del">이 층 지우기</button></div>' : ''}`;
  const reb = () => { engine.setLevel(L); applyEnv(); commit(); syncBar(); };
  $$('[data-lv]', body).forEach((b) => (b.onclick = () => { switchLevel(+b.dataset.lv); renderProps(); }));
  $('[data-l=name]', body).onchange = (e) => { L.name = e.target.value.trim() || L.name; commit(); syncBar(); renderProps(); };
  $$('[data-k]', body).forEach((i) => (i.onchange = () => { const v = Math.round(+i.value); if (!Number.isFinite(v)) return; const k = i.dataset.k; L[k] = k === 'elev' ? v : clamp(v, 1800, 12000);
    if (k === 'ceilingH') for (const it of L.items) { const Lb = S.lib[it.type]; if (Lb && (Lb.layer === 'ceil' || Lb.layer === 'ceiling') && !it.manualElev) it.elev = Math.max(0, L.ceilingH - it.h); } // 천장 설비도 따라 올라가고 내려감
    reb(); renderProps(); }));
  $$('[data-c]', body).forEach((i) => { const k = i.dataset.c; const set = () => { L.ceiling ||= {}; L.ceiling[k] = k === 'on' ? i.checked : k === 'opacity' ? +i.value : i.value; };
    if (k === 'color' || k === 'opacity') { i.oninput = () => { set(); engine.rebuildStructure(); }; i.onchange = () => commit(); } else i.onchange = () => { set(); engine.rebuildStructure(); syncCeilBtn(); commit(); }; });
  $('[data-d=dimsOn]', body).onchange = (e) => { L.dimsOn = e.target.checked; engine.rebuildStructure(); commit(); };
  $('#autoDims').onchange = (e) => { plan.autoDims = e.target.checked; store.set('byr.autoDims', plan.autoDims); plan.redraw(); };
  $$('[data-la]', body).forEach((b) => (b.onclick = async () => { const a = b.dataset.la;
    if (a === 'add' || a === 'blank' || a === 'dup') { const top = M.levels.reduce((m, l) => Math.max(m, (l.elev || 0) + (l.slabH || 3300)), 0), n = M.levels.length + 1;
      const nl = a === 'dup' ? { ...JSON.parse(JSON.stringify(L)), id: uid('L'), name: `${L.name} 복제` } : { id: uid('L'), name: `${n}층`, elev: top, ceilingH: L.ceilingH || 2700, slabH: L.slabH || 3300, floor: { ...L.floor }, rooms: [], openings: [], items: [], walls: [] };
      if (a === 'dup') { nl.elev = top; const re = (o) => ({ ...o, id: uid(o.id[0] || 'x') }); const wm = new Map(); nl.walls = nl.walls.map((w) => { const q = re(w); wm.set(w.id, q.id); return q; }); nl.openings = nl.openings.map((o) => ({ ...re(o), wall: wm.get(o.wall) })); nl.items = nl.items.map(re); nl.rooms = nl.rooms.map((r) => ({ ...re(r), slope: null })); }
      if (a === 'add') { const b2 = levelBox(); nl.walls = L.walls.filter((w) => [w.x1, w.x2].every((x) => Math.abs(x - b2[0]) < 400 || Math.abs(x - b2[2]) < 400) || [w.y1, w.y2].every((y) => Math.abs(y - b2[1]) < 400 || Math.abs(y - b2[3]) < 400)).map((w) => ({ ...w, id: uid('w') })); if (!nl.walls.length) nl.walls = L.walls.map((w) => ({ ...w, id: uid('w') })); }
      M.levels.push(nl); switchLevel(M.levels.length - 1); commit(); renderProps(); toast(`"${nl.name}" 을 만들었어요 · 위 막대의 층 고르기로 오가요`); }
    if (a === 'del') { if (!(await ask(`"${L.name}" 을 지울까요?`, '이 층의 벽 · 기물 · 공간이 모두 지워져요. 되돌리기로 살릴 수 있어요.', [{ label: '취소', value: false }, { label: '지우기', value: true, kind: 'danger' }]))) return; M.levels.splice(M.activeLevel, 1); switchLevel(Math.max(0, M.activeLevel - 1)); commit(); renderProps(); }
    if (a === 'soffit') setPlanTool('soffitRect');
    if (a === 'measure') setPlanTool('measure');
    if (a === 'clearDims') { L.dims = []; engine.rebuildStructure(); commit(); renderProps(); }
    if (a === 'wallsH') { for (const w of L.walls) w.h = L.ceilingH || 2700; engine.rebuildStructure(); commit(); toast('벽 높이를 천장 높이에 맞췄어요'); }
  }));
}
function switchLevel(i) { setTimeout(syncPins);  if (engine.sim.on) { engine.sim.stop(); plan.simA = null; syncSimBtn(); } S.model.activeLevel = clamp(i, 0, S.model.levels.length - 1); S.sel = null; setFocus(null); engine.setLevel(level()); applyEnv(); engine.view('iso'); plan.fit(); plan.select(null, true); syncBar(); syncCeilBtn(); refreshBad(); }

/* ----- 배경 (주변 거리) · 도면 밑그림 ----- */
function renderBg(body) {
  const E = envOf(S.model), L = level(), bg = L.bg, hk = E.hk ?? 1, nk = E.nk ?? 1, lv = Object.entries(ENVLV).reduce((b, [k, v]) => (Math.abs(v[0] - hk) + Math.abs(v[1] - nk) < Math.abs(ENVLV[b][0] - hk) + Math.abs(ENVLV[b][1] - nk) ? k : b), '5');
  $('#propsTitle').textContent = '배경 · 밑그림';
  body.innerHTML = `<div class="sec">배경 (상권 조감도)</div>
    <div class="chips">${ENVTYPES.map(([k, n]) => `<button data-env="${k}" aria-pressed="${E.type === k}">${n}</button>`).join('')}</div>
    <label class="fld">매장 정면<select id="envFront"><option value="auto">자동 (출입문 쪽)</option><option value="N">도면 위쪽</option><option value="E">도면 오른쪽</option><option value="S">도면 아래쪽</option><option value="W">도면 왼쪽</option></select></label>
    <div class="row2"><span class="hint">배경 레벨 ${lv} / 5 · 낮출수록 건물이 적고 낮아져요</span><button class="btn" data-elv="-1" aria-label="배경 줄이기">▼</button><button class="btn" data-elv="1" aria-label="배경 늘리기">▲</button></div>
    <label class="fld">건물 높이 <b id="vHk">${Math.round(hk * 100)}%</b><input type="range" id="envHk" min="0.2" max="1" step="0.05" value="${hk}"></label>
    <label class="fld">건물 수 <b id="vNk">${Math.round(nk * 100)}%</b><input type="range" id="envNk" min="0.2" max="1" step="0.05" value="${nk}"></label>
    <div class="row">${ENVCOL.map(([k, n]) => `<label class="fld">${n}<input type="color" data-envc="${k}" value="${E.colors[k]}"></label>`).join('')}</div>
    <div class="btns"><button class="btn" id="envView">조감도로 보기</button><button class="btn" id="envReset">기본 색으로</button></div>
    <p class="hint">사람 · 차량 · 도로 · 가로수 소품은 왼쪽 기물 목록의 "배경" 에서 놓으세요.</p>
    <div class="sec">도면 밑그림 (사진 · 스캔을 깔고 따라 그리기)</div>
    <div class="btns"><button class="btn" id="bgPick">${bg ? '밑그림 바꾸기' : '도면 이미지 고르기'}</button>${bg ? '<button class="btn danger" id="bgDel">밑그림 지우기</button>' : ''}</div>
    ${bg ? `<div class="row">${num('이미지 가로 mm', 'wmm', bg.wmm)}${num('X', 'x', bg.x || 0)}${num('Y', 'y', bg.y || 0)}</div><label class="fld">불투명도<input type="range" id="bgO" min="0.1" max="1" step="0.05" value="${bg.opacity ?? 0.5}"></label>` : '<p class="hint">손그림 · PDF 캡처 · 사진을 깔고 2D "벽 그리기" 로 따라 그리면 돼요. 도면의 긴 벽 하나 길이를 보고 "이미지 가로 mm" 로 축척을 맞추세요.</p>'}`;
  $('#envFront').value = E.front || 'auto';
  const re = () => { applyEnv(); commit(); };
  $$('[data-env]', body).forEach((b) => (b.onclick = () => { E.type = b.dataset.env; re(); if (E.type !== 'none') { if (S.pane === '2d') setPane('split'); envBird(); } renderProps(); }));
  $('#envFront').onchange = (e) => { E.front = e.target.value; re(); };
  $$('[data-elv]', body).forEach((b) => (b.onclick = () => { const nx = clamp(+lv + +b.dataset.elv, 1, 5); [E.hk, E.nk] = ENVLV[nx]; re(); renderProps(); }));
  for (const [id, k, v] of [['envHk', 'hk', 'vHk'], ['envNk', 'nk', 'vNk']]) { const i = $('#' + id); i.oninput = () => { $('#' + v).textContent = Math.round(i.value * 100) + '%'; }; i.onchange = () => { E[k] = +i.value; re(); }; }
  $$('[data-envc]', body).forEach((i) => (i.onchange = () => { E.colors[i.dataset.envc] = i.value; re(); }));
  $('#envView').onclick = () => { if (S.pane === '2d') setPane('split'); envBird(); };
  $('#envReset').onclick = () => { delete E.colors; envOf(S.model); re(); renderProps(); };
  $('#bgPick').onclick = async () => { const f = (await openFiles({ title: '도면 이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f) return; const src = await shrinkToDataUrl(f.data, 2400); const b = SL.polyArea ? levelBox() : [0, 0, 10000, 0]; L.bg = { src, wmm: Math.max(3000, Math.round(b[2] - b[0]) || 10000), x: Math.round(b[0]) || 0, y: Math.round(b[1]) || 0, opacity: 0.5 }; if (S.pane === '3d') setPane('split'); commit(); renderProps(); toast('밑그림을 깔았어요 · 가로 mm 로 축척을 맞추세요'); };
  if (bg) { $('#bgDel').onclick = () => { L.bg = null; commit(); renderProps(); }; $$('[data-k]', body).forEach((i) => (i.onchange = () => { const v = +i.value; if (Number.isFinite(v)) bg[i.dataset.k] = i.dataset.k === 'wmm' ? Math.max(100, v) : v; commit(); })); const o = $('#bgO'); o.oninput = () => { bg.opacity = +o.value; plan.redraw(); }; o.onchange = () => commit(); }
}
function levelBox() { const L = level(), b = [Infinity, Infinity, -Infinity, -Infinity]; L.walls.forEach((w) => { b[0] = Math.min(b[0], w.x1, w.x2); b[1] = Math.min(b[1], w.y1, w.y2); b[2] = Math.max(b[2], w.x1, w.x2); b[3] = Math.max(b[3], w.y1, w.y2); }); return Number.isFinite(b[0]) ? b : [0, 0, 10000, 8000]; }
async function shrinkToDataUrl(bytes, max) { const bmp = await createImageBitmap(new Blob([bytes])), s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); }
function envBird() { // 길 건너(매장 정면 쪽) 하늘에서 비스듬히 내려다보기
  const L = level(), E = envOf(S.model), xs = L.walls.flatMap((w) => [w.x1, w.x2]), ys = L.walls.flatMap((w) => [w.y1, w.y2]), b = xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : [0, 0, 8000, 6000];
  const F = envFront(L, E, b), o = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[F] || [0, 1], c = engine.camera, t = engine.controls.target, r = Math.max(4, Math.hypot(b[2] - b[0], b[3] - b[1]) / 2000);
  t.set((b[0] + b[2]) / 2000, 0.5, (b[1] + b[3]) / 2000); const dir = new t.constructor(o[0] * 0.75 + o[1] * 0.35, 1.05, o[1] * 0.75 - o[0] * 0.35).normalize();
  if (c.isOrthographicCamera) { c.position.copy(t).addScaledVector(dir, 120); c.zoom = 0.45; c.updateProjectionMatrix(); } else c.position.copy(t).addScaledVector(dir, Math.max(38, r * 7)); engine.controls.update();
}

/* ----- 디자인 수정 ----- */
const DE = { it: null };
function startDesign(it) {
  if (S.pane === '2d') setPane('split'); setFocus(null);
  DE.it = it; const d = engine.design; d.onChange = () => renderProps(); d.onSelect = () => renderProps();
  d.start(it, bakeParts(it, { lib: S.lib, shapes: S.shapes })); S.panel = 'design'; S.propsOpen = true; renderProps();
  toast('점 모드: 파란 점을 끌어요 · 면 모드: 부품을 고른 뒤 면을 밀고 당겨요 · 부품을 누르면 그 부품을 골라요', 7000);
}
function endDesign(save) {
  if (DE.wall) return endWallDesign(save);
  const d = engine.design, it = DE.it; if (!it || !d.active) return;
  if (save) { const parts = d.result(); applyParts(it, parts); } d.stop(); DE.it = null;
  engine.rebuildItem(it); S.panel = 'props'; if (save) commit(); setSel({ kind: 'item', id: it.id }); if (save) toast('디자인을 저장했어요');
}
function saveMyItem() {
  const d = engine.design, it = DE.it; if (!it) return; const parts = JSON.parse(JSON.stringify(d.result())), tmp = { ...it }; applyParts(tmp, parts);
  const my = store.get('byr.mylib', {}), id = 'my_' + uid(''); const L0 = S.lib[it.type] || {};
  my[id] = { name: `${it.name} (내 기물)`, cat: '내 기물', sub: '', shape: 'parts', w: tmp.w, d: tmp.d, h: tmp.h, layer: L0.layer || 'floor', color: '#b8bcc2', mat: 'plain', elev: L0.elev ?? null, kw: L0.kw || 0, light: 0, parts: tmp.parts };
  store.set('byr.mylib', my); loadMyLib(); renderCatalog($('#search').value); toast(`"${my[id].name}" 을 기물 목록 "내 기물" 에 넣었어요`);
}
function loadMyLib() { const my = store.get('byr.mylib', {}); for (const [id, v] of Object.entries(my)) { S.lib[id] = v; S.shapes[id] = v.parts; } }
function renderDesign(body) {
  const d = engine.design; if (!d.active) { S.panel = 'props'; return renderProps(); }
  const P = d.parts, i = d.sel, p = P[i] || {};
  $('#propsTitle').textContent = DE.wall ? '벽 디자인 수정' : `디자인 수정 · ${DE.it.name}`;
  body.innerHTML = `<div class="chips"><button data-dm="point" aria-pressed="${d.mode === 'point'}">점 끌기</button><button data-dm="face" aria-pressed="${d.mode === 'face'}">면 밀고 당기기</button></div>
    ${d.mode === 'point' ? `<div class="chips"><span class="hint">방향</span>${[['free', '자유'], ['x', '가로 X'], ['y', '높이 Y'], ['z', '깊이 Z']].map(([k, n]) => `<button data-ax="${k}" aria-pressed="${d.axis === k}">${n}</button>`).join('')}</div>` : '<p class="hint">고른 부품의 면을 눌러 바깥 · 안쪽으로 끌어요 (5mm 단위)</p>'}
    <label class="tog">붙은 점 같이 움직이기<input type="checkbox" id="deWeld" ${d.weld ? 'checked' : ''}></label>
    <div class="sec">부품 ${P.length}개 · 눌러서 고르기 · 색은 부품마다 따로</div>
    <div class="plist parts">${P.map((q, k) => `<div class="prow ${k === i ? 'on' : ''}"><button data-pp="${k}">부품 ${k + 1}</button><input type="color" data-pc="${k}" value="${/^#[0-9a-f]{6}$/i.test(q.c) ? q.c : '#b8bcc2'}" aria-label="부품 ${k + 1} 색"></div>`).join('')}</div>
    <div class="row"><label class="fld">고른 부품 재질<select id="deMat">${Object.entries(MAT_LABEL).filter(([k]) => k).map(([k, n]) => `<option value="${k}" ${p.m === k ? 'selected' : ''}>${n}</option>`).join('')}<option value="tile" ${p.m === 'tile' ? 'selected' : ''}>타일</option></select></label>
      <label class="fld">투명도<input type="range" id="deA" min="0.15" max="1" step="0.05" value="${p.a ?? 1}"></label></div>
    <div class="btns"><button class="btn" data-de="dup">부품 복제</button><button class="btn" data-de="box">상자 부품 추가</button><button class="btn danger" data-de="rm" ${P.length < 2 ? 'disabled' : ''}>부품 삭제</button></div>
    <div class="btns"><button class="btn" data-de="undo">한 단계 되돌리기</button><button class="btn" data-de="mine">새 기물로 저장</button></div>
    <div class="btns"><button class="btn danger" data-de="cancel">취소</button><button class="btn pri" data-de="ok">완료 · 저장</button></div>`;
  $$('[data-dm]', body).forEach((b) => (b.onclick = () => { d.setMode(b.dataset.dm); renderProps(); }));
  $$('[data-ax]', body).forEach((b) => (b.onclick = () => { d.axis = b.dataset.ax; renderProps(); }));
  $('#deWeld').onchange = (e) => { d.weld = e.target.checked; };
  $$('[data-pp]', body).forEach((b) => (b.onclick = () => d.selectPart(+b.dataset.pp)));
  $$('[data-pc]', body).forEach((c) => { c.oninput = () => { const k = +c.dataset.pc; P[k].c = c.value; P[k].own = true; d.rebuild(); }; c.onchange = () => d.setColor(+c.dataset.pc, c.value); });
  $('#deMat').onchange = (e) => d.setMat(i, e.target.value); $('#deA').onchange = (e) => d.setAlpha(i, +e.target.value);
  $$('[data-de]', body).forEach((b) => (b.onclick = () => { const a = b.dataset.de;
    if (a === 'dup') d.duplicatePart(i); if (a === 'box') d.addBox(); if (a === 'rm') d.removePart(i); if (a === 'undo') { if (!d.undo()) toast('되돌릴 게 없어요'); }
    if (a === 'mine') saveMyItem(); if (a === 'ok') endDesign(true); if (a === 'cancel') endDesign(false); renderProps(); }));
}

/* ----- 내 프로젝트 (자동 저장 · 동기화) ----- */
async function renderLibrary(body) {
  $('#propsTitle').textContent = '내 프로젝트'; const s = cloud.session(), last = lib2.lastSync();
  body.innerHTML = `<p class="hint">고칠 때마다 이 기기에 자동 저장돼요. ${s ? `${esc(s.email || '')} 계정과 자동으로 동기화해요${last ? ` · 마지막 ${new Date(last).toLocaleString('ko-KR')}` : ''}.` : '기존 앱 계정으로 로그인하면 다른 PC · 폰과 자동으로 맞춰져요.'}</p>
    <div class="btns"><button class="btn" data-lb="new">새 프로젝트</button>${s ? '<button class="btn pri" data-lb="sync">지금 동기화</button>' : '<button class="btn pri" data-lb="login">로그인 (동기화 켜기)</button>'}</div>
    <div class="plist" id="libList"><p class="hint">불러오는 중…</p></div><p class="hint" id="libMsg"></p>`;
  $$('[data-lb]', body).forEach((b) => (b.onclick = async () => { const a = b.dataset.lb;
    if (a === 'new') return ACT.new();
    if (a === 'login') return ACT.account();
    if (a === 'sync') { b.disabled = true; $('#libMsg').textContent = '동기화 중…'; try { const r = await lib2.syncNow(); $('#libMsg').textContent = `올림 ${r.up} · 받음 ${r.down} · 지움 ${r.del}${r.conflict ? ` · 충돌 사본 ${r.conflict}` : ''}`; await reloadIfChanged(r); } catch (e) { $('#libMsg').textContent = '동기화 실패: ' + (e.message || e); } b.disabled = false; listLib(); } }));
  listLib();
}
async function listLib() {
  const el = $('#libList'); if (!el) return; const list = await lib2.listLocal().catch(() => []);
  el.innerHTML = list.length ? list.map((p) => `<div class="prow ${p.id === S.model.id ? 'on' : ''}"><button data-open="${p.id}"><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleString('ko-KR')} · ${(p.size / 1024).toFixed(0)}KB${cloud.session() ? (p.dirty ? ' · 올릴 예정' : ' · 동기화됨') : ''}</small></button><button class="ib" data-dup="${p.id}" title="복제" aria-label="복제"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/></svg></button><button class="ib" data-rm="${p.id}" title="지우기" aria-label="지우기"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div>`).join('') : '<p class="hint">저장된 프로젝트가 없어요</p>';
  $$('[data-open]', el).forEach((b) => (b.onclick = async () => { const m = await lib2.loadLocal(b.dataset.open); if (m) { await setModel(m); toast(`"${m.name}" 을 열었어요`); } }));
  $$('[data-dup]', el).forEach((b) => (b.onclick = async () => { const m = await lib2.loadLocal(b.dataset.dup); if (!m) return; m.id = uid('p'); m.name += ' (사본)'; await lib2.saveLocal(m); await lib2.saveLocal(S.model); listLib(); }));
  $$('[data-rm]', el).forEach((b) => { let armed = false; b.onclick = async () => { if (!armed) { armed = true; b.classList.add('danger'); b.title = '한 번 더 누르면 지워요'; toast('한 번 더 누르면 지워요'); setTimeout(() => { armed = false; b.classList.remove('danger'); }, 3000); return; } const id = b.dataset.rm; await lib2.removeLocal(id); if (id === S.model.id) await setModel(emptyProject()); if (cloud.session()) lib2.scheduleSync(800); listLib(); }; });
}
/** 동기화로 지금 열린 프로젝트가 바뀌었으면 다시 연다 */
async function reloadIfChanged(r) { if (r && r.changed && r.changed.includes(S.model.id)) { const m = await lib2.loadLocal(S.model.id); if (m) { await setModel(m, false); toast('다른 기기에서 고친 내용을 받아 왔어요'); } else { await setModel(emptyProject()); toast('다른 기기에서 지운 프로젝트예요'); } } }

/* ----- 벽 · 문/창 속성 ----- */
const FINISH = { paint: '페인트', tile: '타일', wood: '목재', panel: '샌드위치 패널', concrete: '콘크리트', glass: '유리' };
function renderWall(body, w) {
  const len = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1));
  $('#propsTitle').textContent = '벽';
  body.innerHTML = `<div class="row">${num('길이', 'len', len)}${num('두께', 't', w.t)}${num('높이', 'h', w.h)}</div>
    <div class="row"><label class="fld">색<input type="color" data-k="color" value="${/^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#ece8e1'}"></label>
    <label class="fld">마감<select data-k="finish">${Object.entries(FINISH).map(([k, n]) => `<option value="${k}" ${w.finish === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <p class="hint">길이를 바꾸면 끝점(두 번째 점)이 움직여요. 2D 에서 파란 끝점을 끌면 붙은 벽도 같이 따라와요.</p>
    <div class="sec">나누기 · 돌리기 · 잇기</div>
    <div class="btns"><button class="btn" data-a="split">2등분</button><button class="btn" data-a="split3">3등분</button><button class="btn" data-a="splitAt">시작점에서 …mm 에서 나누기</button></div>
    <div class="btns"><button class="btn" data-a="rot45">45° 돌리기</button><button class="btn" data-a="rot90">90° 돌리기</button><button class="btn" data-a="rotAt">각도 직접</button><button class="btn" data-a="join">다른 벽과 잇기</button></div>
    <div class="row" id="wNum" hidden><label class="fld"><span id="wNumL"></span><input type="number" id="wNumV" inputmode="decimal"></label><div class="btns" style="align-items:flex-end"><button class="btn pri" id="wNumOk">적용</button></div></div>
    <div class="sec">모양 · 마감</div>
    <div class="btns"><button class="btn pri" data-a="design">벽 디자인 수정 (모서리 점 끌기)</button>${w.form ? '<button class="btn" data-a="formReset">모양 되돌리기</button>' : ''}</div>
    <div class="row"><label class="fld">시트지 면<select id="shSide"><option value="">없음</option><option value="a" ${w.sheet && w.sheet.side === 'a' ? 'selected' : ''}>앞면</option><option value="b" ${w.sheet && w.sheet.side === 'b' ? 'selected' : ''}>뒷면</option><option value="both" ${w.sheet && w.sheet.side === 'both' ? 'selected' : ''}>양면</option></select></label><label class="fld">시트지 색<input type="color" id="shCol" value="${w.sheet && /^#[0-9a-f]{6}$/i.test(w.sheet.color) ? w.sheet.color : '#d8c7a6'}"></label></div>
    <div class="btns"><button class="btn" data-a="shImg">${w.sheet && w.sheet.img ? '시트지 이미지 바꾸기' : '시트지에 이미지 (사진 · 패턴)'}</button>${w.sheet && w.sheet.img ? '<button class="btn" data-a="shImgDel">이미지 빼기</button>' : ''}<button class="btn" data-a="art">벽 그림 넣기</button></div>
    ${(w.arts || []).map((A, i) => `<div class="row2"><span class="hint">그림 ${i + 1} · ${A.w}×${A.h}</span><span><button class="btn" data-art="${i}:big">크게</button><button class="btn" data-art="${i}:small">작게</button><button class="btn" data-art="${i}:left">◀</button><button class="btn" data-art="${i}:right">▶</button><button class="btn" data-art="${i}:up">▲</button><button class="btn" data-art="${i}:down">▼</button><button class="btn danger" data-art="${i}:del">✕</button></span></div>`).join('')}
    <div class="btns"><button class="btn danger" data-a="del">삭제</button></div>`;
  $$('[data-k]', body).forEach((i) => {
    const k = i.dataset.k;
    if (k === 'color') { i.oninput = () => { w.color = i.value; liveStructure(); }; i.onchange = () => commit(); return; }
    i.onchange = () => {
      if (k === 'finish') w.finish = i.value;
      else { const v = +i.value; if (!Number.isFinite(v) || v <= 0) return renderProps();
        if (k === 'len') { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, nl = clamp(v, 100, 100000), nx = Math.round(w.x1 + ((w.x2 - w.x1) / L) * nl), ny = Math.round(w.y1 + ((w.y2 - w.y1) / L) * nl);
          for (const o of level().walls) { if (o === w) continue; if (Math.hypot(o.x1 - w.x2, o.y1 - w.y2) < 1) { o.x1 = nx; o.y1 = ny; } if (Math.hypot(o.x2 - w.x2, o.y2 - w.y2) < 1) { o.x2 = nx; o.y2 = ny; } }
          w.x2 = nx; w.y2 = ny; const nl2 = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); for (const o of level().openings) if (o.wall === w.id) fitOpening(o, nl2);
          for (const o2 of level().walls) for (const op of level().openings) if (op.wall === o2.id && o2 !== w) fitOpening(op, Math.hypot(o2.x2 - o2.x1, o2.y2 - o2.y1)); }
        else w[k] = clamp(v, k === 't' ? 30 : 100, k === 't' ? 1000 : 20000); }
      engine.rebuildStructure(); commit(); renderProps();
    };
  });
  const done = (msg) => { engine.rebuildStructure(); commit(); renderProps(); if (msg) toast(msg); };
  const askNum = (label, v, fn) => { $('#wNum').hidden = false; $('#wNumL').textContent = label; $('#wNumV').value = v; $('#wNumV').focus(); $('#wNumOk').onclick = () => { const x = +$('#wNumV').value; if (Number.isFinite(x)) fn(x); }; };
  $('#shSide').onchange = (e) => { const v = e.target.value; if (!v) delete w.sheet; else w.sheet = { ...(w.sheet || { color: $('#shCol').value }), side: v }; done(); };
  $('#shCol').oninput = (e) => { if (!w.sheet) return; w.sheet.color = e.target.value; liveStructure(); }; $('#shCol').onchange = () => { if (w.sheet) commit(); };
  $$('[data-art]', body).forEach((b) => (b.onclick = () => { const [i, a] = b.dataset.art.split(':'), A = w.arts[+i], L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (a === 'del') w.arts.splice(+i, 1); if (a === 'big' || a === 'small') { const k = a === 'big' ? 1.15 : 1 / 1.15; A.w = Math.round(A.w * k); A.h = Math.round(A.h * k); }
    if (a === 'left') A.t = Math.max(A.w / 2, A.t - 100); if (a === 'right') A.t = Math.min(L - A.w / 2, A.t + 100); if (a === 'up') A.y = Math.min(w.h - A.h, A.y + 100); if (a === 'down') A.y = Math.max(0, A.y - 100); done(); }));
  $$('[data-a]', body).forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a, L0 = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    if (a === 'del') return plan.erase({ kind: 'wall', id: w.id });
    if (a === 'split' || a === 'split3') { const n = a === 'split' ? 2 : 3; splitWall(w, [...Array(n - 1).keys()].map((k) => (L0 * (k + 1)) / n)); return done(`벽을 ${n}개로 나눴어요`); }
    if (a === 'splitAt') return askNum(`시작점에서 몇 mm (0 ~ ${Math.round(L0)})`, Math.round(L0 / 2), (x) => { if (x > 50 && x < L0 - 50) { splitWall(w, [x]); done('벽을 나눴어요'); } });
    if (a === 'rot45' || a === 'rot90') { rotateWall(w, a === 'rot45' ? 45 : 90); return done(); }
    if (a === 'rotAt') return askNum('돌릴 각도 (°, 시계 방향 +)', 15, (x) => { rotateWall(w, x); done(); });
    if (a === 'join') { if (S.pane === '3d') setPane('split'); plan.setTool('pick'); toast('2D 에서 이을 다른 벽을 누르세요 · 두 벽을 늘이거나 줄여서 모서리를 맞춰요', 5000);
      plan.picker = (p) => { const h = plan.hitWall(p); if (!h || h.w === w) return toast('다른 벽을 눌러 주세요'); plan.picker = null; plan.setTool('select'); if (joinWalls(w, h.w)) done('두 벽을 이었어요'); else toast('나란한 벽은 이을 수 없어요'); }; return; }
    if (a === 'design') return startWallDesign(w);
    if (a === 'formReset') { delete w.form; return done('벽 모양을 되돌렸어요'); }
    if (a === 'shImg' || a === 'art') { const f = (await openFiles({ title: a === 'art' ? '벽 그림' : '시트지 이미지', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f) return; const src = await shrinkToDataUrl(f.data, 1600);
      if (a === 'shImg') { w.sheet = { side: 'a', color: '#ffffff', ...(w.sheet || {}), img: src }; return done('시트지에 이미지를 입혔어요'); }
      const im = await createImageBitmap(new Blob([f.data])), ww = Math.min(1500, L0 * 0.6), hh = Math.round((ww * im.height) / im.width); (w.arts ||= []).push({ id: uid('a'), img: src, t: Math.round(L0 / 2), y: Math.round(Math.max(0, Math.min(w.h - hh, 1500 - hh / 2))), w: Math.round(ww), h: hh, side: 'a' }); return done('벽 그림을 넣었어요 · ◀ ▶ ▲ ▼ 로 옮겨요'); }
    if (a === 'shImgDel') { delete w.sheet.img; return done(); }
  }));
}
/** 벽을 시작점에서 at(mm 목록) 자리에서 자른다 · 문/창은 들어 있는 조각으로 */
function splitWall(w, at) {
  const L = level(), len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, cuts = [0, ...at.sort((a, b) => a - b), len], pieces = [];
  for (let k = 1; k < cuts.length; k++) pieces.push(k === 1 ? w : { ...w, id: uid('w'), form: undefined, arts: undefined });
  pieces.forEach((p, k) => { p.x1 = Math.round(w.x1 + ux * cuts[k]) || p.x1; });
  const x0 = w.x1, y0 = w.y1; pieces.forEach((p, k) => { p.x1 = Math.round(x0 + ux * cuts[k]); p.y1 = Math.round(y0 + uy * cuts[k]); p.x2 = Math.round(x0 + ux * cuts[k + 1]); p.y2 = Math.round(y0 + uy * cuts[k + 1]); if (k) L.walls.push(p); });
  for (const o of L.openings) if (o.wall === w.id) { let k = cuts.findIndex((c, i) => i > 0 && o.t <= c); if (k < 1) k = cuts.length - 1; o.wall = pieces[k - 1].id; o.t -= cuts[k - 1]; fitOpening(o, cuts[k] - cuts[k - 1]); }
  delete w.form;
}
/** 벽을 가운데 기준으로 돌린다 (붙어 있던 이웃 끝은 따라오지 않음) */
function rotateWall(w, deg) { const cx = (w.x1 + w.x2) / 2, cy = (w.y1 + w.y2) / 2, a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), r = (x, y) => [Math.round(cx + (x - cx) * c - (y - cy) * s), Math.round(cy + (x - cx) * s + (y - cy) * c)]; [w.x1, w.y1] = r(w.x1, w.y1); [w.x2, w.y2] = r(w.x2, w.y2); }
/** 두 벽의 연장선이 만나는 점까지 가까운 끝을 옮겨 모서리를 만든다 */
function joinWalls(a, b) {
  const r = [a.x2 - a.x1, a.y2 - a.y1], s = [b.x2 - b.x1, b.y2 - b.y1], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-6) return false;
  const t = ((b.x1 - a.x1) * s[1] - (b.y1 - a.y1) * s[0]) / den, X = Math.round(a.x1 + r[0] * t), Y = Math.round(a.y1 + r[1] * t);
  for (const w of [a, b]) { const d1 = Math.hypot(w.x1 - X, w.y1 - Y), d2 = Math.hypot(w.x2 - X, w.y2 - Y), L0 = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (d1 < d2) { const shift = Math.hypot(w.x2 - X, w.y2 - Y) - L0; w.x1 = X; w.y1 = Y; for (const o of level().openings) if (o.wall === w.id) { o.t += shift; fitOpening(o, L0 + shift); } } else { w.x2 = X; w.y2 = Y; for (const o of level().openings) if (o.wall === w.id) fitOpening(o, Math.hypot(w.x2 - w.x1, w.y2 - w.y1)); } }
  return true;
}
/** 벽 디자인 수정: 벽 하나를 8 꼭짓점 상자 부품으로 바꿔 디자인 편집기(점 끌기)로 고친 뒤, 이동량을 w.form 으로 저장 */
function startWallDesign(w) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), t = w.t / 2, H = w.h, o = (w.form && w.form.o) || Array.from({ length: 8 }, () => [0, 0, 0]);
  const base = (s, sd, lv) => [s ? L : 0, lv ? H : 0, sd ? t : -t], P = (s, sd, lv) => { const b = base(s, sd, lv), q = o[WFI(s, sd, lv)]; return [b[0] + q[0], b[1] + q[2], b[2] + q[1]]; };
  const ring = (lv) => [P(0, 0, lv), P(1, 0, lv), P(1, 1, lv), P(0, 1, lv)];
  const part = { n: 4, v: [...ring(0), ...ring(1)].flat(), c: w.color || '#ece8e1', m: 'plain', own: true };
  const g = engine.structure.getObjectsByProperty('name', '벽').find((x) => x.userData.wallId === w.id); if (!g) return;
  if (S.pane === '2d') setPane('split'); DE.it = null; DE.wall = w; const d = engine.design; d.onChange = () => renderProps(); d.onSelect = () => renderProps();
  d.start({ id: 'wall', name: '벽', w: L, d: w.t, h: H }, [part], g); d.weld = false; S.panel = 'design'; S.propsOpen = true; renderProps();
  toast('파란 점(모서리)을 끌어 벽 모양을 바꿔요 · 위 끝을 내리면 경사 벽, 두께 쪽을 밀면 두꺼워져요', 6000);
}
function endWallDesign(save) {
  const d = engine.design, w = DE.wall; if (!w) return; if (save) { const v = d.result()[0].v, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), t = w.t / 2, H = w.h, o = [];
    const idx = { '0,0,0': 0, '1,0,0': 1, '1,1,0': 2, '0,1,0': 3, '0,0,1': 4, '1,0,1': 5, '1,1,1': 6, '0,1,1': 7 };
    for (const [k, i] of Object.entries(idx)) { const [s, sd, lv] = k.split(',').map(Number), b = [s ? L : 0, lv ? H : 0, sd ? t : -t], p = v.slice(i * 3, i * 3 + 3); o[WFI(s, sd, lv)] = [Math.round(p[0] - b[0]), Math.round(p[2] - b[2]), Math.round(p[1] - b[1])]; }
    if (o.some((q) => q[0] || q[1] || q[2])) w.form = { o }; else delete w.form; }
  d.stop(); DE.wall = null; S.panel = 'props'; engine.rebuildStructure(); if (save) commit(); setSel({ kind: 'wall', id: w.id }); if (save) toast('벽 모양을 저장했어요');
}
const OPS = { door1: '외문', door2: '양문', auto: '자동문', slide: '미닫이문', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', arch: '아치 (뚫린 문)' };
function renderOpening(body, o) {
  $('#propsTitle').textContent = OPS[o.type] || '문 · 창';
  body.innerHTML = `<label class="fld">종류<select data-k="type">${Object.entries(OPS).map(([k, n]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="row">${num('폭', 'w', o.w)}${num('높이', 'h', o.h)}${num('바닥에서', 'sill', o.sill)}</div>
    <div class="row">${num('벽 시작점에서 (가운데)', 't', o.t)}</div>
    <label class="tog">간유리 띠<input type="checkbox" data-k="frost" ${o.frost ? 'checked' : ''}></label>
    <div class="sec">디자인 상세</div>
    <div class="row"><label class="fld">틀 색<input type="color" data-od="frame" value="${o.frame || '#2b2d31'}"></label>${num('틀 굵기 (mm)', 'fw', o.fw ?? 50, 5).replace('data-k=', 'data-on=')}</div>
    ${/window|full|auto|slide/.test(o.type) ? `<div class="row">${num('세로 나눔 (칸)', 'div', o.div || 1, 1).replace('data-k=', 'data-on=')}${num('가로 띠 높이 (바닥 기준, 0=없음)', 'hdiv', o.hdiv || 0, 50).replace('data-k=', 'data-on=')}</div><label class="fld">유리 색<input type="color" data-od="tint" value="${o.tint || '#bfe3f2'}"></label>` : ''}
    ${/door/.test(o.type) ? `<label class="fld">문짝 색<input type="color" data-od="leaf" value="${o.leaf || '#d9d4ca'}"></label>` : ''}
    ${/pass/.test(o.type) ? `<div class="row">${num('선반 깊이 (mm, 0=없음)', 'shelf', o.shelf ?? 180, 10).replace('data-k=', 'data-on=')}${num('선반 두께', 'shelfT', o.shelfT ?? 30, 5).replace('data-k=', 'data-on=')}</div>
      <div class="row"><label class="fld">선반 쪽<select data-os="shelfSide">${[['both', '양쪽'], ['a', '앞쪽만'], ['b', '뒤쪽만']].map(([v, n]) => `<option value="${v}" ${(o.shelfSide || 'both') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="fld">선반 색<input type="color" data-od="shelfColor" value="${o.shelfColor || '#c9ced4'}"></label></div>
      <label class="tog">배식구 둘레 틀<input type="checkbox" data-ot="pframe" ${o.pframe ? 'checked' : ''}></label>` : ''}
    <p class="hint">2D 에서 끌면 벽을 따라 움직여요.</p>
    <div class="btns"><button class="btn danger" data-a="del">삭제</button></div>`;
  const od = () => { engine.rebuildStructure(); commit(); };
  $$('[data-od]', body).forEach((i) => { i.oninput = () => { o[i.dataset.od] = i.value; liveStructure(); }; i.onchange = od; });
  $$('[data-on]', body).forEach((i) => (i.onchange = () => { const v = Math.max(0, Math.round(+i.value || 0)), k = i.dataset.on; o[k] = k === 'div' ? clamp(v || 1, 1, 12) : k === 'fw' ? clamp(v, 10, 200) : v; od(); }));
  $$('[data-os]', body).forEach((i) => (i.onchange = () => { o[i.dataset.os] = i.value; od(); }));
  $$('[data-ot]', body).forEach((i) => (i.onchange = () => { o[i.dataset.ot] = i.checked; od(); }));
  $$('[data-k]', body).forEach((i) => (i.onchange = () => {
    const k = i.dataset.k, w = level().walls.find((q) => q.id === o.wall), L = w ? Math.hypot(w.x2 - w.x1, w.y2 - w.y1) : 1e9;
    if (k === 'type') { const d = cloud.OPDEF[i.value]; o.type = i.value; if (d) { o.h = d[1]; o.sill = d[2]; } }
    else if (k === 'frost') o.frost = i.checked ? { b: o.sill + 300, t: o.sill + Math.min(o.h - 100, 1500) } : null;
    else { const v = +i.value; if (Number.isFinite(v)) o[k] = k === 'sill' ? clamp(v, 0, 5000) : clamp(v, 100, 20000); }
    o.w = Math.min(o.w, L - 20); o.t = clamp(o.t, o.w / 2, L - o.w / 2);
    engine.rebuildStructure(); commit(); renderProps();
  }));
  $('[data-a=del]', body).onclick = () => plan.erase({ kind: 'opening', id: o.id });
}

/* ----- 계정 (기존 앱과 같은 계정) ----- */
async function renderAccount(body) {
  $('#propsTitle').textContent = '기존 앱 계정';
  const s = cloud.session();
  if (!s) {
    body.innerHTML = `<p class="hint">기존 BYR 앱의 "계정 · 동기화"에서 쓰던 이메일 · 비밀번호로 로그인하면, 계정에 올려 둔 프로젝트를 그대로 불러와요.</p>
      <label class="fld">이메일<input type="email" id="aEmail" autocomplete="username"></label>
      <label class="fld">비밀번호<input type="password" id="aPw" autocomplete="current-password"></label>
      <div class="btns"><button class="btn" id="aLogin">로그인</button></div><p class="hint" id="aMsg"></p>`;
    $('#aLogin').onclick = async () => { $('#aMsg').textContent = '로그인 중…'; try { await cloud.login($('#aEmail').value.trim(), $('#aPw').value); renderProps(); lib2.syncNow().then(reloadIfChanged).catch(() => {}); toast('로그인했어요 · 내 프로젝트를 계정과 동기화해요'); } catch (e) { $('#aMsg').textContent = e.message || String(e); } };
    return;
  }
  body.innerHTML = `<p class="hint">${esc(s.email || '')} 로 로그인됨</p><div class="sec">계정의 프로젝트</div><div class="plist" id="aList"><p class="hint">불러오는 중…</p></div>
    <div class="btns"><button class="btn" id="aOut">로그아웃</button></div>`;
  $('#aOut').onclick = () => { cloud.logout(); renderProps(); };
  try {
    const list = await cloud.listProjects();
    $('#aList').innerHTML = list.length ? list.map((p) => `<button data-pid="${esc(p.id)}"><b>${esc(p.name || '이름 없음')}</b><small>${p.updated_at ? new Date(p.updated_at).toLocaleString('ko-KR') : ''}</small></button>`).join('') : '<p class="hint">계정에 올린 프로젝트가 없어요</p>';
    $$('[data-pid]', body).forEach((b) => (b.onclick = async () => { b.disabled = true; try { const row = await cloud.fetchProject(b.dataset.pid); await openJson(row.name || '계정 프로젝트', new TextEncoder().encode(JSON.stringify(row))); } catch (e) { toast('불러오지 못했어요: ' + (e.message || e)); } b.disabled = false; }));
  } catch (e) { $('#aList').innerHTML = `<p class="hint">목록을 받지 못했어요: ${esc(e.message || e)}</p>`; }
}

/* ----- AI (기존 앱의 Claude 인식 기능) ----- */
function renderAi(body) {
  $('#propsTitle').textContent = 'AI 도면 · 사진 인식';
  const pv = cloud.aiProvider(), PV = cloud.PROVIDERS[pv], key = cloud.aiKey(), w = selWall(), s = cloud.session();
  body.innerHTML = `<div class="sec">내 AI 연결</div>
    <div class="chips">${Object.entries(cloud.PROVIDERS).map(([k, v]) => `<button data-pv="${k}" aria-pressed="${k === pv}">${v.name}${cloud.aiKey(k) ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="hint">본인 계정의 API 키로 연결해요 · 키 만드는 곳: <b>${PV.where}</b>. (claude.ai · ChatGPT · Gemini 앱의 구독 로그인은 다른 앱에서 쓸 수 없어서 API 키가 필요해요. 쓴 만큼 각 회사에 요금이 나가요.)</p>
    <p class="hint">${key ? '이 기기에 키가 있어요 · ' + esc(key.slice(0, 8)) + '…' : pv === 'claude' ? '키가 없어요. 기존 앱에서 "계정에 저장"했다면 계정에 로그인하면 자동으로 들어와요.' : '키가 없어요.'}</p>
    <div class="row"><label class="fld">${PV.name} 키<input type="password" id="kIn" placeholder="${PV.keyHint}" autocomplete="off"></label><label class="fld">모델<input type="text" id="kModel" value="${esc(cloud.aiModel())}" spellcheck="false"></label></div>
    <div class="btns"><button class="btn" id="kSave">이 기기에 저장</button>${s && pv === 'claude' ? '<button class="btn" id="kAcct">계정에서 받기</button><button class="btn" id="kPut">계정에 저장</button>' : ''}${key ? '<button class="btn danger" id="kDel">지우기</button>' : ''}</div>
    <div class="sec">도면 → 벽 · 문/창</div>
    <p class="hint">도면 사진 · 스캔 · PDF 를 고르면 연결한 AI 가 벽 중심선과 문/창 자리를 읽어 바로 2D · 3D 에 그려요. 치수선을 읽어 축척을 잡고, 못 읽으면 아래 가로 길이를 써요.</p>
    <div class="row"><label class="fld">도면 가로 실제 길이 mm (선택)<input type="number" id="pW" inputmode="numeric" placeholder="예: 12000"></label>
    <label class="fld">기존 벽<select id="pMode"><option value="replace">지우고 바꾸기</option><option value="add">그대로 두고 더하기</option></select></label></div>
    <div class="btns"><button class="btn" id="pGo" ${key ? '' : 'disabled'}>도면 파일 고르기</button></div>
    <div class="sec">현장 사진 → 기물</div>
    <p class="hint">${w ? `고른 벽(${Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)).toLocaleString()}mm)을 방 안에서 정면으로 찍은 사진을 고르세요. 보이는 기물 · 문/창을 그 벽 앞에 놓아요.` : '2D 도면에서 사진에 찍힌 벽을 먼저 톡 눌러 고른 뒤, 다시 이 메뉴를 여세요.'}</p>
    <div class="btns"><button class="btn" id="phGo" ${key && w ? '' : 'disabled'}>벽 사진 고르기</button></div>
    <p class="hint" id="aiMsg"></p>`;
  // AI 결과 미리보기: 바로 넣지 않고 확인한 뒤 적용
  const P = S.aiPrev;
  if (P) {
    const nm = (t) => (S.lib[t] && S.lib[t].name) || ({ door1: '외문', door2: '양문', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', auto: '자동문', slide: '미닫이', arch: '아치' }[t]) || t;
    body.insertAdjacentHTML('afterbegin', P.kind === 'plan'
      ? `<div class="sec">AI 결과 미리보기</div><p class="hint">벽 ${P.r.walls.length}개 · 문/창 ${P.r.openings.length}개 · 도면 가로 ${P.r.widthMm.toLocaleString()}mm 기준 · 2D 의 주황 점선이 AI 가 읽은 벽이에요. 기존 벽은 ${P.mode === 'replace' ? '지우고 바꿔요' : '그대로 두고 더해요'}.</p><div class="btns"><button class="btn" data-ap="no">버리기</button><button class="btn pri" data-ap="ok">적용</button></div><hr>`
      : `<div class="sec">AI 결과 미리보기 · 넣을 것만 고르세요</div><div class="plist">${P.objs.map((o, k) => `<label class="tog">${esc(nm(o.type))} <small class="hint">${Math.round(((+o.x0 + +o.x1) / 2) * 100)}% 위치${o.on_wall ? ' · 벽에 붙음' : o.dist ? ` · 벽에서 ${Math.round(o.dist)}mm` : ''}</small><input type="checkbox" data-po="${k}" ${o.on ? 'checked' : ''}></label>`).join('') || '<p class="hint">찾은 것이 없어요</p>'}</div><div class="btns"><button class="btn" data-ap="no">버리기</button><button class="btn pri" data-ap="ok" ${P.objs.length ? '' : 'disabled'}>적용</button></div><hr>`);
    $$('[data-po]', body).forEach((c) => (c.onchange = () => (P.objs[+c.dataset.po].on = c.checked)));
    $$('[data-ap]', body).forEach((b) => (b.onclick = () => {
      if (b.dataset.ap === 'ok') { if (P.kind === 'plan') { applyPlan(P.r, P.mode); toast(`벽 ${P.r.walls.length}개 · 문/창 ${P.r.openings.length}개를 그렸어요 · 되돌리기로 취소할 수 있어요`); } else { const w = level().walls.find((q) => q.id === P.wall); const n = w ? placeDetected(w, P.objs.filter((o) => o.on)) : 0; toast(`${n}개를 넣었어요 · 위치는 끌어서 다듬으세요`); } }
      S.aiPrev = null; plan.preview = null; plan.redraw(); renderProps();
    }));
  }
  const msg = (t) => ($('#aiMsg').textContent = t);
  $$('[data-pv]', body).forEach((b) => (b.onclick = () => { cloud.setAiProvider(b.dataset.pv); renderProps(); }));
  $('#kModel').onchange = (e) => { cloud.setAiModel(pv, e.target.value === PV.model ? '' : e.target.value); toast('모델을 바꿨어요'); };
  $('#kSave').onclick = () => { const v = $('#kIn').value.trim(); if (!v) return msg('키를 넣어 주세요'); cloud.setAiKey(v); renderProps(); toast(`${PV.name} 키를 이 기기에 저장했어요`); };
  if ($('#kDel')) $('#kDel').onclick = () => { cloud.setAiKey(''); renderProps(); };
  if ($('#kAcct')) $('#kAcct').onclick = async () => { try { msg((await cloud.loadAccountKey()) ? '계정의 키를 받았어요' : '계정에 저장된 키가 없어요'); renderProps(); } catch (e) { msg(e.message || e); } };
  if ($('#kPut')) $('#kPut').onclick = async () => { try { await cloud.saveAccountKey(cloud.aiKey('claude')); msg('계정에 저장했어요 · 다른 기기에서 로그인하면 자동으로 써요'); } catch (e) { msg(e.message || e); } };
  $('#pGo').onclick = async () => {
    const f = (await openFiles({ title: '도면 (이미지 · PDF)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }))[0]; if (!f) return;
    msg(`${PV.name} 가 도면을 읽는 중… (30초~1분)`); $('#pGo').disabled = true;
    try { const r = await cloud.readPlan(await cloud.prepFile(f.name, f.data), +$('#pW').value || 0); S.aiPrev = { kind: 'plan', r, mode: $('#pMode').value }; plan.preview = r; if (S.pane === '3d') setPane('split'); plan.redraw(); renderProps(); toast('2D 에 주황 점선으로 미리 보여요 · 확인하고 "적용"을 누르세요', 6000); }
    catch (e) { console.error(e); msg('읽지 못했어요: ' + (e.message || e)); }
    $('#pGo').disabled = false;
  };
  $('#phGo').onclick = async () => {
    const f = (await openFiles({ title: '현장 사진', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f || !selWall()) return;
    msg(`${PV.name} 가 사진을 보는 중…`); $('#phGo').disabled = true;
    try { const wall = selWall(), objs = await cloud.readPhoto(await cloud.prepFile(f.name, f.data), Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), S.lib); S.aiPrev = { kind: 'photo', wall: wall.id, objs: objs.map((o) => ({ ...o, on: true })) }; renderProps(); }
    catch (e) { console.error(e); msg('읽지 못했어요: ' + (e.message || e)); }
    $('#phGo').disabled = false;
  };
}
function applyPlan(r, mode) {
  const L = level(); if (mode === 'replace') { L.walls = []; L.openings = []; }
  const H = r.height || L.ceilingH || 2700, made = r.walls.map((w) => ({ id: uid('w'), ...w, h: H, color: '#ece8e1', finish: 'paint' })); L.walls.push(...made);
  for (const o of r.openings) { // 가장 가까운 벽에 붙인다
    let best = null; for (const w of made) { const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / len, uy = (w.y2 - w.y1) / len, t = (o.x - w.x1) * ux + (o.y - w.y1) * uy, d = Math.abs(-(o.x - w.x1) * uy + (o.y - w.y1) * ux); if (t < 0 || t > len || d > Math.max(400, w.t * 2)) continue; if (!best || d < best.d) best = { w, t, len, d }; }
    if (!best) continue; const D = cloud.OPDEF[o.type], ow = Math.min(o.w, best.len - 40);
    L.openings.push({ id: uid('o'), wall: best.w.id, type: o.type, t: Math.round(clamp(best.t, ow / 2, best.len - ow / 2)), w: ow, h: D[1], sill: D[2], frost: null });
  }
  engine.setLevel(L); engine.view('iso'); plan.fit(); setSel(null); commit();
}
/** 기존 앱 placeDetected 를 아무 방향의 벽에 쓰도록 일반화 */
function placeDetected(wall, objs) {
  const L = level(), len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), mx = (wall.x1 + wall.x2) / 2, my = (wall.y1 + wall.y2) / 2;
  const b = [Infinity, Infinity, -Infinity, -Infinity]; L.walls.forEach((w) => { b[0] = Math.min(b[0], w.x1, w.x2); b[1] = Math.min(b[1], w.y1, w.y2); b[2] = Math.max(b[2], w.x1, w.x2); b[3] = Math.max(b[3], w.y1, w.y2); });
  let nx = -(wall.y2 - wall.y1) / len, ny = (wall.x2 - wall.x1) / len; if (((b[0] + b[2]) / 2 - mx) * nx + ((b[1] + b[3]) / 2 - my) * ny < 0) { nx = -nx; ny = -ny; } // 방 안쪽
  const rx = ny, ry = -nx; // 벽을 바라볼 때 오른쪽 (도면 y 가 아래)
  const fromStart = (wall.x1 - mx) * rx + (wall.y1 - my) * ry < 0; // 사진 왼쪽 끝 = 벽 시작점?
  const left = fromStart ? [wall.x1, wall.y1] : [wall.x2, wall.y2], ux = fromStart ? (wall.x2 - wall.x1) / len : (wall.x1 - wall.x2) / len, uy = fromStart ? (wall.y2 - wall.y1) / len : (wall.y1 - wall.y2) / len;
  const rot = Math.round((Math.atan2(-nx, ny) * 180) / Math.PI + 360) % 360; let n = 0;
  for (const o of objs || []) {
    const type = String(o.type || ''), x0 = clamp(+o.x0 || 0, 0, 1), x1 = clamp(+o.x1 || x0, 0, 1), along = ((x0 + x1) / 2) * len, span = Math.max(100, Math.abs(x1 - x0) * len);
    const D = cloud.OPDEF[type];
    if (D) { const w = Math.round(clamp(+o.w || span || D[0], 400, len)), t = fromStart ? along : len - along; L.openings.push({ id: uid('o'), wall: wall.id, type, t: Math.round(clamp(t, w / 2, len - w / 2)), w, h: Math.round(+o.h || D[1]), sill: Math.round(o.sill != null ? +o.sill : D[2]), frost: null }); n++; continue; }
    const Lb = S.lib[type]; if (!Lb || !cloud.AI_TYPES.includes(type)) continue;
    const w = Math.round(clamp(+o.w || span || Lb.w, 100, 9000)), d = Lb.d, dist = o.on_wall ? d / 2 + wall.t / 2 + 1 : Math.max(d / 2 + wall.t / 2, +o.dist || d / 2);
    const ceil = Lb.layer === 'ceil' || Lb.layer === 'ceiling';
    const it = { id: uid('i'), type, name: Lb.name, x: Math.round(left[0] + ux * along + nx * dist), y: Math.round(left[1] + uy * along + ny * dist), rot, w, d, h: Math.round(o.h && !['mark', 'plant'].includes(Lb.shape) ? clamp(+o.h, 50, L.ceilingH) : Lb.h), color: null, mat: null, parts: null, light: Lb.light ? defaultLight(Lb) : null, kw: Lb.kw, note: 'AI · 사진' };
    it.elev = o.on_wall && o.elev != null && Lb.layer !== 'floor' ? Math.round(+o.elev) : Lb.elev != null ? Lb.elev : ceil ? L.ceilingH - it.h : 0;
    L.items.push(it); engine.rebuildItem(it); n++;
  }
  engine.rebuildStructure(); commit(); return n;
}

/* ---------- 왼쪽 서랍: 아코디언 기물 목록 ---------- */
const CAT_ORDER = ['내 기물', '주방', '테이블', '의자', '가구', '가전', '욕실', '조명', '천장 설비', '벽 설비', '전기', '바닥·배관', '설비', '공장', '인테리어', '식물', '주거', '배경'];
function renderCatalog(q = '') {
  const by = new Map(); q = q.trim().toLowerCase();
  for (const [id, L] of Object.entries(S.lib)) { if (['zone', 'mesh', 'decal', 'mark'].includes(L.shape)) continue; if (q && !(L.name + ' ' + (L.sub || '') + ' ' + L.cat).toLowerCase().includes(q)) continue; if (!by.has(L.cat)) by.set(L.cat, []); by.get(L.cat).push([id, L]); }
  const cats = [...by.keys()].sort((a, b) => (CAT_ORDER.indexOf(a) + 99) % 99 - (CAT_ORDER.indexOf(b) + 99) % 99);
  $('#catalog').innerHTML = cats.length ? cats.map((c, i) => `<div class="acc ${q || i === 0 ? 'open' : ''}"><button aria-expanded="${!!q || i === 0}">${esc(c)} <small>${by.get(c).length}</small></button><div class="list">${by.get(c).map(([id, L]) => `<button class="item" data-add="${esc(id)}"><b>${esc(L.name)}</b><small><i style="background:${esc(L.color)}"></i>${L.w}×${L.d}×${L.h}</small></button>`).join('')}</div></div>`).join('') : '<p class="hint" style="padding:12px">찾는 기물이 없어요</p>';
}
function openDrawer() { $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false; $('#btnDrawer').setAttribute('aria-expanded', 'true'); }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').hidden = true; $('#btnDrawer').setAttribute('aria-expanded', 'false'); }
function setMode(m) { engine.mode = m; $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m))); }

/* ---------- 시작 ---------- */
/* ---------- 도구 막대: 한 줄 = 버튼 하나 (2차 · 3차 도구는 soon 을 지우고 run 만 붙이면 된다) ---------- */
const SV = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const DOCK = [
  { id: 'btnDrawer', label: '기물', icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13.5v6M13.5 16.5h6"/>', attrs: 'aria-expanded="false"' },
  '|',
  { mode: 'select', label: '선택', icon: '<path d="M6 3l13 8-6 1.8L10.5 19z"/>' },
  { mode: 'move', label: '이동', icon: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>' },
  { mode: 'orbit', label: '둘러보기', icon: '<circle cx="12" cy="12" r="3"/><path d="M2.5 12c2.4-4.4 5.6-6.6 9.5-6.6s7.1 2.2 9.5 6.6c-2.4 4.4-5.6 6.6-9.5 6.6S4.9 16.4 2.5 12z"/>' },
  '|',
  { act: 'levels', label: '층', icon: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>' },
  { run: () => setPlanTool('measure'), label: '줄자', icon: '<path d="M3 15l12-12 6 6-12 12z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>' },
  { act: 'rooms', label: '공간', icon: '<path d="M4 4h16v16H4z" stroke-dasharray="3 2.5"/><path d="M9 12h6"/>' },
  { run: () => slopeTool(), label: '구배', icon: '<path d="M3 17L21 9M3 17h18"/><path d="M15 7l3 2.6-3.6 1.1"/>' },
  { act: 'bg', label: '배경', icon: '<path d="M3 20h18M5 20V10h4v10M11 20V5h5v15M18 20v-7h2"/>' },
  '|',
  { id: 'btnStyle', label: '스타일', icon: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>', attrs: 'aria-haspopup="menu" aria-expanded="false"' },
  { view: 'iso', label: '비스듬히', icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>' },
  { view: 'top', label: '위에서', icon: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 10h7v10M11 14h9"/>' },
  '|',
  { act: 'ai', label: 'AI', icon: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>' },
  '|',
  { id: 'dkCeil', run: () => toggleCeiling(), label: '천장', icon: '<path d="M3 6h18M6 6v3M12 6v3M18 6v3"/><circle cx="12" cy="13" r="2.5"/>' },
  { run: () => startWalk(), label: '걷기', icon: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6-2.5-2.5L11 8l3 2 3 1M12 15l3 6M9.5 12.5L7 14"/>' },
  { id: 'dkXr', act: 'xray', label: '설치물', icon: '<path d="M3 18h18M5 18v-4h14v4"/><path d="M8 14V9h8v5" stroke-dasharray="2 2"/>' },
  { id: 'dkAir', run: () => toggleAir(), label: '공기', icon: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>' },
  { act: 'view', label: '단면 · 시점', icon: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 12h16" stroke-dasharray="2.5 2"/>' },
  { act: 'cmt', label: '댓글', icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>' },
  { act: 'check', label: '점검', icon: '<path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="3.5" width="16" height="17" rx="2"/>' },
  { act: 'quote', label: '견적', icon: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>' },
  { act: 'auto', label: '자동 배치', icon: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 10h17M10 10v10.5"/><path d="M14 14h3v3h-3z"/>' },
  { id: 'dkSim', act: 'sim', label: '동선', icon: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" stroke-dasharray="2.5 2"/>' },
];
function buildDock() {
  $('#dockIn').innerHTML = DOCK.map((d) => d === '|' ? '<span class="dsep" aria-hidden="true"></span>'
    : `<button class="dk${d.soon ? ' soon' : ''}" ${d.id ? `id="${d.id}"` : ''} ${d.mode ? `data-mode="${d.mode}" aria-pressed="false"` : ''} ${d.view ? `data-view="${d.view}"` : ''} ${d.act ? `data-dact="${d.act}"` : ''} ${d.attrs || ''} title="${d.label}${d.soon ? ` (${d.soon} 업데이트)` : ''}" aria-label="${d.label}">${SV(d.icon)}<span>${d.label}</span></button>`).join('');
  [...$('#dockIn').children].filter((e) => e.tagName === 'BUTTON').forEach((b, i) => { const d = DOCK.filter((x) => x !== '|')[i];
    if (d.soon) b.onclick = () => toast(`"${d.label}" 은 ${d.soon} 업데이트에서 들어와요`);
    else if (d.act) b.onclick = () => { closeHome(); ACT[d.act](); };
    else if (d.run) b.onclick = () => { closeHome(); d.run(); }; });
}
function stopWalk() { engine.walker.stop(); }
function setPlanTool(t) { if (S.pane === '3d') setPane('split'); if (t !== 'select' && t !== 'boxsel') tuck(); plan.setTool(t); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.tool === t))); if (t === 'measure') toast('2D 에서 잴 두 점 사이를 끌어요 · 벽 끝 · 모서리에 붙어요 · 3D 에도 보여요', 5000); }
function toggleCeiling() { const L = level(); L.ceiling ||= {}; L.ceiling.on = L.ceiling.on === false; engine.showCeiling(L.ceiling.on); syncCeilBtn(); commit(); toast(L.ceiling.on ? '천장을 보여요 · 위에서 내려다보면 투명해요' : '천장을 껐어요'); }
function syncCeilBtn() { const b = $('#dkCeil'); if (b && level()) b.setAttribute('aria-pressed', String((level().ceiling || {}).on !== false)); }
function startWalk() {
  closeHome(); S.walkPane = S.pane; if (S.pane !== '3d') setPane('3d'); S.propsOpen = false; renderProps(); closeDrawer(); setSel(null);
  setTimeout(() => { engine.walker.start(); toast(window.matchMedia('(pointer: coarse)').matches ? '왼쪽 아래 동그라미로 걷고, 화면을 끌어 둘러봐요' : 'W A S D · 방향키로 걷고, 끌어서 둘러봐요 · Q/E 눈높이 · Shift 빨리 · Esc 끝', 6000); }, 60);
}
/** 구배 단추: 공간을 고른 상태면 그 공간의 구배, 아니면 공간 고르기부터 */
function slopeTool() {
  const r = selRoom(); if (r) { S.panel = 'props'; S.propsOpen = true; renderProps(); setTimeout(() => { const el = $('#propsBody .sec:nth-of-type(4)') || $('#swPct'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 50); return; }
  if (level().rooms.length) { ACT.rooms(); toast('구배를 잡을 공간을 고르세요 (주방 · 화장실 등)'); return; }
  if (S.pane === '3d') setPane('split'); plan.setTool('roomRect'); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.tool === 'roomRect')));
  toast('먼저 2D 에서 구배를 잡을 공간을 끌어서 그리세요 (사각형)', 6000);
}

/* ---------- 확인 창 ---------- */
function ask(title, msg, buttons = [{ label: '취소', value: false }, { label: '확인', value: true, kind: 'pri' }]) {
  return new Promise((ok) => {
    const d = $('#dlg'); $('#dlgT').textContent = title; $('#dlgM').textContent = msg || '';
    $('#dlgB').innerHTML = buttons.map((b, i) => `<button class="btn ${b.kind || ''}" data-i="${i}">${esc(b.label)}</button>`).join('');
    const done = (v) => { d.hidden = true; d.onclick = null; S.dlgClose = null; ok(v); };
    S.dlgClose = () => done(buttons[0].value);
    d.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) done(buttons[+b.dataset.i].value); else if (e.target === d) done(buttons[0].value); };
    d.hidden = false; setTimeout(() => { const last = $('#dlgB').lastElementChild; if (last) last.focus(); }, 30);
  });
}
const IS_APP = () => !!(window.byr || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));
async function quitApp() {
  if (!(await ask('BYR2 를 종료할까요?', '작업은 이 기기에 자동 저장돼 있어요. 다시 켜면 이어서 할 수 있어요.', [{ label: '취소', value: false }, { label: '종료', value: true, kind: 'danger' }]))) return;
  await lib2.flush(); if (cloud.session()) await lib2.syncNow().catch(() => {});
  if (window.byr && window.byr.quit) window.byr.quit(); else if (window.Capacitor && window.Capacitor.Plugins.App) window.Capacitor.Plugins.App.exitApp(); else toast('브라우저 탭을 닫으면 돼요 · 작업은 저장돼 있어요');
}
/** 뒤로 가기 (안드로이드 뒤로 단추 · Esc): 열린 것부터 하나씩 닫고, 마지막엔 홈 → 종료 확인 */
async function goBack() {
  if (S.dlgClose) return S.dlgClose();
  if (engine.walker.active) return stopWalk();
  for (const id of ['#fileMenu', '#styleMenu']) if (!$(id).hidden) { $(id).hidden = true; return; }
  if ($('#drawer').classList.contains('open')) return closeDrawer();
  if (engine.design.active) { if (await ask('디자인 수정을 그만할까요?', '저장하지 않은 모양 변경은 버려져요.', [{ label: '계속 수정', value: false }, { label: '그만하기', value: true, kind: 'danger' }])) endDesign(false); return; }
  if (SW.pick) { endPick(); renderProps(); return; }
  if (engine.sim.on) { engine.sim.stop(); plan.simA = null; plan.redraw(); syncSimBtn(); renderProps(); return; }
  if (engine.air.on) { toggleAir(); return; }
  if (engine.xray) { setXray(null); renderProps(); return; }
  if (S.aiPrev) { S.aiPrev = null; plan.preview = null; plan.redraw(); renderProps(); return; }
  if (S.propsOpen) { S.propsOpen = false; renderProps(); return; }
  if (plan.tool !== 'select') { plan.setTool('select'); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.tool === 'select'))); return; }
  if (S.focus) { setFocus(null); return; }
  if (S.sel) { setSel(null); return; }
  if ($('#home').hidden) return showHome();
  return quitApp();
}

/* ---------- 홈 (대시보드) ---------- */
const HI = {
  cont: '<path d="M8 5l11 7-11 7z"/>', new: '<path d="M12 5v14M5 12h14"/>', open: '<path d="M4 6h6l2 2h8v11H4z"/>', legacy: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 13h8M8 17h5"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z"/>', sample: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>', model: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>', ai: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/>',
};
function showHome() { $('#home').hidden = false; renderHome(); }
function closeHome() { $('#home').hidden = true; }
async function renderHome() {
  const s = cloud.session(), pv = cloud.aiProvider(), key = cloud.aiKey(), last = lib2.lastSync(), list = await lib2.listLocal().catch(() => []), cur = S.model;
  $('#homeVer').textContent = `BYR Next ${APP_VERSION} · ${IS_APP() ? (window.byr ? 'PC' : '모바일') : '웹'}`;
  $('#homeBody').innerHTML = `
    <button class="hcont" data-h="cont">${SV(HI.cont)}<div><b>이어서 작업</b><small>${esc(cur ? cur.name : '')} · ${cur ? `벽 ${cur.levels[cur.activeLevel].walls.length} · 기물 ${cur.levels[cur.activeLevel].items.length}` : ''}</small></div></button>
    <div class="hacts">
      <button data-h="new">${SV(HI.new)}새 프로젝트</button><button data-h="open">${SV(HI.open)}파일 열기</button>
      <button data-h="legacy">${SV(HI.legacy)}기존 앱 파일 (JSON)</button><button data-h="account">${SV(HI.cloud)}기존 앱 계정에서</button>
      <button data-h="asset">${SV(HI.model)}3D 모델 가져오기</button><button data-h="sample">${SV(HI.sample)}샘플 매장</button>
    </div>
    <section class="hsec"><div class="row2"><b>내 프로젝트 · ${list.length}개</b>${list.length > 6 ? '<button class="btn" data-h="library">전체 · 정리</button>' : ''}</div>
      <div class="hgrid">${list.slice(0, 6).map((p) => `<button class="hp ${cur && p.id === cur.id ? 'on' : ''}" data-op="${p.id}"><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${s ? (p.dirty ? ' · 올릴 예정' : ' · 동기화됨') : ''}${cur && p.id === cur.id ? ' · 지금 열림' : ''}</small></button>`).join('') || '<p class="hint">아직 저장된 프로젝트가 없어요</p>'}</div></section>
    <section class="hsec"><div class="row2"><b>계정 · 동기화</b><span class="stat ${s ? 'ok' : ''}"><i></i>${s ? '로그인됨' : '로그인 안 함'}</span></div>
      <p class="hint">${s ? `${esc(s.email || '')} · PC · 폰에서 같은 계정으로 로그인하면 내 프로젝트가 자동으로 맞춰져요${last ? ` · 마지막 ${new Date(last).toLocaleString('ko-KR')}` : ''}` : '기존 BYR 앱과 같은 이메일 · 비밀번호로 로그인하면, PC 에서 하던 작업을 폰에서 이어 하고 기존 앱 프로젝트도 불러올 수 있어요.'}</p>
      <div class="btns">${s ? '<button class="btn pri" data-h="sync">지금 동기화</button><button class="btn" data-h="account">기존 앱 프로젝트</button><button class="btn" data-h="logout">로그아웃</button>' : '<button class="btn pri" data-h="login">로그인</button>'}</div><p class="hint" id="hMsg"></p></section>
    <section class="hsec"><div class="row2"><b>AI 연결</b><span class="stat ${key ? 'ok' : ''}"><i></i>${esc(cloud.PROVIDERS[pv].name)} ${key ? '· 키 있음' : '· 키 없음'}</span></div>
      <p class="hint">도면 사진 · PDF → 벽, 현장 사진 → 기물 인식에 써요. 본인 Claude · ChatGPT · Gemini API 키로 연결해요.</p>
      <div class="btns"><button class="btn" data-h="ai">${SV(HI.ai)} AI 설정</button></div></section>`;
  const act = async (h) => {
    if (h === 'cont') return closeHome();
    if (h === 'new') { closeHome(); return ACT.new(); }
    if (h === 'sync') { $('#hMsg').textContent = '동기화 중…'; try { const r = await lib2.syncNow(); await reloadIfChanged(r); $('#hMsg').textContent = `올림 ${r.up} · 받음 ${r.down}${r.conflict ? ` · 충돌 사본 ${r.conflict}` : ''}`; setTimeout(renderHome, 1200); } catch (e) { $('#hMsg').textContent = '동기화 실패: ' + (e.message || e); } return; }
    if (h === 'logout') { if (await ask('로그아웃할까요?', '이 기기의 프로젝트는 그대로 남아요. 계정에서 받아 온 AI 키는 이 기기에서 지워져요.')) { cloud.logout(); renderHome(); } return; }
    closeHome(); const map = { open: 'open', legacy: 'legacy', account: 'account', login: 'account', asset: 'asset', sample: 'sample', library: 'library', ai: 'ai' }; await ACT[map[h]]();
  };
  $$('[data-h]', $('#homeBody')).forEach((b) => (b.onclick = () => act(b.dataset.h)));
  $$('[data-op]', $('#homeBody')).forEach((b) => (b.onclick = async () => { if (cur && b.dataset.op === cur.id) return closeHome(); const m = await lib2.loadLocal(b.dataset.op); if (m) { closeHome(); await setModel(m); toast(`"${m.name}" 을 열었어요`); } }));
}

async function boot() {
  buildDock();
  const [lib, shapes] = await Promise.all([fetch('./data/legacy-lib.json').then((r) => r.json()), fetch('./data/legacy-shapes.json').then((r) => r.json())]);
  S.lib = lib.items; S.shapes = shapes; loadMyLib();
  engine = new Engine($('#view'), { lib: S.lib, shapes: S.shapes, assets: S.assets, zOf: (it) => SL.itemZ(level(), it, S.lib) });
  lib2.onStatus(setSaveState);
  engine.onSelect = (id) => { if (id) { S.sel = { kind: 'item', id }; S.propsOpen = true; S.panel = 'props'; } else if (S.sel && S.sel.kind === 'item') S.sel = null; plan && plan.select(S.sel, true); renderProps(); };
  engine.onChange = () => { commit(); renderProps(); };
  const drainMoved = (it) => { if (it && SL.isDrainItem(it, S.lib) && level().rooms.some((r) => r.slope && r.slope.item === it.id)) liveStructure(); else if (it && level().items.some((q) => q.onSlope)) engine.replaceItems(); };
  engine.onMove = (it) => { plan.redraw(); drainMoved(it); }; // 3D 에서 끌면 2D 도 같이 · 배수 기물을 옮기면 구배도 따라감
  plan = new Plan2D($('#plan'), {
    level, lib: S.lib, style: () => engine.style, toast,
    onSelect: (sel) => setSel(sel),
    onLive: (kind, x) => { if (kind === 'structure') liveStructure(); else if (kind === 'item') { engine.moveItem(x); drainMoved(x); } else if (kind === 'item-removed') engine.removeItem(x); },
    onMulti: (ids) => { S.multi = ids; if (ids.length && plan.tool === 'boxsel') setPlanTool('select'); if (ids.length) { engine.select(null); S.sel = null; S.panel = 'multi'; S.propsOpen = true; } else if (S.panel === 'multi') S.panel = 'props'; renderProps(); },
    onSketch: (pts) => { const L = level(); (L.sketches ||= []).push({ id: uid('k'), pts, color: plan.skColor || '#e8467c', w: plan.skW || 3 }); commit(); },
    onRoom: (pts) => newRoom(pts),
    onLine: (pts) => { if (S.patrol) return patrolDone(pts); const L = level(), k = LINEKINDS[plan.lineKind] || LINEKINDS.wire; (L.lines ||= []).push({ id: uid('l'), kind: plan.lineKind || 'wire', pts, ...(k.z === 'below' ? { depth: LOPT.depth } : {}), ...(k.z === 'hang' ? { off: LOPT.off } : {}) }); engine.rebuildStructure(); commit(); toast(`${k.name} ${Math.round(pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0) / 100) / 10}m 를 그렸어요 · 이어서 다음 선을 그려도 돼요`, 3000); },
    onDim: (d) => { const L = level(); (L.dims ||= []).push({ id: uid('d'), ...d }); engine.rebuildStructure(); commit(); toast(`${Math.round(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)).toLocaleString()} mm · 지우기 도구로 누르면 지워져요`, 2500); },
    onSoffit: (pts) => { const L = level(); (L.soffits ||= []).push({ id: uid('s'), pts, h: L.soffitH || 2400 }); engine.rebuildStructure(); commit(); toast(`천장 가벽을 넣었어요 · 아래면 ${L.soffitH || 2400}mm (층 · 천장 카드에서 높이 바꾸기)`, 3500); },
    onChange: (msg) => { commit(); renderProps(); if (msg) toast(msg, 2200); },
  });
  $$('[data-tool]').forEach((b) => (b.onclick = () => { if (b.dataset.tool !== 'select' && b.dataset.tool !== 'boxsel') tuck(); else untuck(); plan.setTool(b.dataset.tool); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q === b))); }));
  $('#btnFit').onclick = () => plan.fit();
  $('#btnRooms').onclick = () => ACT.rooms();
  $('#fitFab').onclick = () => fitItems(SL.slopeBad(level(), S.lib));
  $('#focusExit').onclick = () => { setFocus(null); renderProps(); };
  $$('[data-pane]').forEach((b) => (b.onclick = () => setPane(b.dataset.pane)));
  const sm = $('#styleMenu'), sb = $('#btnStyle');
  sb.onclick = () => { sm.hidden = !sm.hidden; sb.setAttribute('aria-expanded', String(!sm.hidden)); };
  sm.onclick = (e) => { const b = e.target.closest('[data-style]'); if (!b) return; setStyle(b.dataset.style); sm.hidden = true; sb.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('pointerdown', (e) => { if (!sm.hidden && !e.target.closest('#styleMenu, #btnStyle')) { sm.hidden = true; sb.setAttribute('aria-expanded', 'false'); } });
  setPane(store.get('byr.pane', innerWidth < 700 ? '3d' : 'split')); setStyle(STYLES[store.get('byr.style', 'real')] ? store.get('byr.style', 'real') : 'real');
  renderCatalog();

  $('#btnDrawer').onclick = openDrawer; $('#btnDrawerClose').onclick = closeDrawer; $('#scrim').onclick = closeDrawer;
  $('#search').oninput = (e) => renderCatalog(e.target.value);
  $('#catalog').onclick = (e) => { const add = e.target.closest('[data-add]'); if (add) return addFromCatalog(add.dataset.add); const h = e.target.closest('.acc > button'); if (h) { const o = h.parentElement.classList.toggle('open'); h.setAttribute('aria-expanded', String(o)); } };
  $$('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $$('[data-view]').forEach((b) => (b.onclick = () => engine.view(b.dataset.view)));
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#fab').onclick = () => { S.propsOpen = !S.propsOpen; S.panel = 'props'; renderProps(); };
  $('#btnPropsClose').onclick = () => { S.propsOpen = false; renderProps(); };
  $('#levelSel').onchange = (e) => { switchLevel(+e.target.value); renderProps(); };
  plan.autoDims = !!store.get('byr.autoDims', false);
  $('#walkExit').onclick = () => stopWalk();
  engine.air.onInfo = (i) => airHud(i);
  engine.sim.onInfo = () => { if (S.panel === 'sim' && S.propsOpen && !document.activeElement.closest('#props select, #props input')) renderProps(); };
  engine.onTick = () => { if (engine.sim.on) { plan.simA = engine.sim.all(); plan.redraw(); } };
  engine.walker.onStop = () => { if (S.walkPane && S.walkPane !== S.pane) setPane(S.walkPane); S.walkPane = null; };
  $('#walkUp').onclick = () => { engine.walker.eye = Math.min(4000, engine.walker.eye + 200); toast(`눈높이 ${Math.round(engine.walker.eye)}mm`, 1200); };
  $('#walkDown').onclick = () => { engine.walker.eye = Math.max(400, engine.walker.eye - 200); toast(`눈높이 ${Math.round(engine.walker.eye)}mm`, 1200); };
  $('#walkThrough').onclick = (e) => { engine.walker.through = !engine.walker.through; e.currentTarget.setAttribute('aria-pressed', String(engine.walker.through)); toast(engine.walker.through ? '벽 · 기물을 통과해요' : '벽에 막혀요 (문으로 지나가요)', 1600); };
  const fm = $('#fileMenu'), fb = $('#btnFile');
  fb.onclick = () => { fm.hidden = !fm.hidden; fb.setAttribute('aria-expanded', String(!fm.hidden)); };
  fm.onclick = async (e) => { const a = e.target.closest('[data-act]'); if (!a) return; fm.hidden = true; fb.setAttribute('aria-expanded', 'false'); try { await ACT[a.dataset.act](); } catch (er) { console.error(er); toast('작업을 마치지 못했어요: ' + (er.message || er)); } };
  document.addEventListener('pointerdown', (e) => { if (!fm.hidden && !e.target.closest('#fileMenu, #btnFile')) { fm.hidden = true; fb.setAttribute('aria-expanded', 'false'); } });
  $('#btnHome').onclick = () => ($('#home').hidden ? showHome() : closeHome());
  $('#homeClose').onclick = closeHome;
  if (!IS_APP()) $('#miQuit').hidden = true;
  // 안드로이드 뒤로 단추 (Capacitor App 플러그인)
  try { const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App; if (A) A.addListener('backButton', () => { goBack(); }); } catch (e) { console.warn(e); }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (S.dlgClose || !$('#home').hidden && !S.propsOpen)) { e.preventDefault(); if (S.dlgClose) S.dlgClose(); else closeHome(); return; }
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (engine.design.active) { engine.design.undo(); return; } e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ACT.save(); }
    if (engine.design.active) return;
    if (engine.walker.active) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), it = selItem();
    if ((S.multi || []).length && !mod && (e.key === 'Delete' || e.key === 'Backspace')) { const b = $('[data-mu=del]'); if (b) b.click(); return; }
    if ((S.multi || []).length && mod && k === 'c') { S.clipM = multiItems().map((q) => JSON.parse(JSON.stringify(q))); S.clip = null; toast(`${S.clipM.length}개를 복사했어요`); return; }
    if (mod && k === 'v' && S.clipM && !S.clip) { e.preventDefault(); const n = S.clipM.map((q) => ({ ...JSON.parse(JSON.stringify(q)), id: uid('i'), x: q.x + 400, y: q.y + 400 })); S.clipM = n.map((q) => JSON.parse(JSON.stringify(q))); level().items.push(...n); n.forEach((q) => engine.rebuildItem(q)); commit(); plan.setMulti(n.map((q) => q.id)); return; }
    if (mod && k === 'a' && S.pane !== '3d') { e.preventDefault(); plan.setMulti(level().items.filter((q) => !q.hidden).map((q) => q.id)); return; }
    if (mod && k === 'c' && it) { S.clipM = null; S.clip = JSON.parse(JSON.stringify(it)); toast('복사했어요 · Ctrl+V 로 붙여넣기'); return; }
    if (mod && (k === 'v' || k === 'd') && (k === 'd' ? it : S.clip)) { e.preventDefault(); const src = k === 'd' ? it : S.clip, n = { ...JSON.parse(JSON.stringify(src)), id: uid('i'), x: src.x + 300, y: src.y + 300 }; if (k === 'v') S.clip = { ...S.clip, x: n.x, y: n.y }; level().items.push(n); engine.rebuildItem(n); commit(); setSel({ kind: 'item', id: n.id }); return; }
    if (!mod && it && k === 'r') { patchSel({ rot: ((it.rot || 0) + (e.shiftKey ? 270 : 90)) % 360 }, false); renderProps(); return; }
    if (!mod && it && /^arrow/.test(k)) { e.preventDefault(); const st = e.shiftKey ? 100 : 10, d = { arrowleft: [-st, 0], arrowright: [st, 0], arrowup: [0, -st], arrowdown: [0, st] }[k]; patchSel({ x: it.x + d[0], y: it.y + d[1] }, false); return; }
    if (!mod && !e.altKey && k === 'g') { startWalk(); return; }
    if (!mod && !e.altKey && k === 'm') { setPlanTool('measure'); return; }
    if (!mod && !e.altKey && k === 'h') { ACT.hist(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) plan.erase(S.sel);
    if (e.key === 'Escape' && S.patrol) { S.patrol = null; }
    if (e.key === 'Escape' && S.tucked && plan.tool !== 'select') { plan.picker = null; setPlanTool('select'); untuck(); return; }
    if (e.key === 'Escape' && (S.multi || []).length) { plan.setMulti([]); return; }
    if (e.key === 'Escape') { if (SW.pick) { endPick(); renderProps(); return; } setSel(null); closeDrawer(); }
  });
  // 파일을 끌어다 놓기
  let depth = 0; const drop = $('#drop');
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; drop.hidden = false; } });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.hidden = true; } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => { e.preventDefault(); depth = 0; drop.hidden = true; const fs = await Promise.all([...e.dataTransfer.files].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))); handleFiles(fs); });

  // 마지막으로 작업하던 프로젝트를 연다 (자동 저장)
  let first = null; try { const id = lib2.lastId(); first = id && (await lib2.loadLocal(id)); } catch (e) { console.warn(e); }
  await setModel(first || emptyProject());
  window.__goBack = goBack; window.BYR = { S, engine, plan, openJson, FORMAT, setStyle, setPane, setSel, applyPlan, placeDetected, lib2, SL, newRoom, setFocus, fitItems, startDesign, endDesign, exportRoom, setDrain, SW, ACT, applyEnv, cloud, startPick, endPick, dxfLoad }; // 디버깅 · 자동 테스트용
  initLang(); showHome(); // 켤 때 홈 (이어서 작업 · 내 프로젝트 · 계정 · AI)
  const intro = $('#intro'), wait = Math.max(0, 1400 - performance.now()); setTimeout(() => { intro.classList.add('out'); setTimeout(() => intro.remove(), 600); }, wait);
  // 계정 동기화: 켤 때 · 1분마다 · 앱으로 돌아올 때
  const sync = () => { if (!cloud.session() || document.visibilityState === 'hidden') return; lib2.syncNow().then(reloadIfChanged).catch(() => {}); };
  sync(); setInterval(sync, 60000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
}
boot().catch((e) => { console.error(e); const it = document.querySelector('#intro'); if (it) it.remove(); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:auto 12px 12px 12px;background:#300;color:#fff;padding:12px;border-radius:8px;white-space:pre-wrap;z-index:99">시작하지 못했어요: ${esc(e.message || e)}</pre>`); });
