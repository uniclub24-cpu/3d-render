// 앱 상태 · 파일 관리(기존 데이터 가져오기 포함) · 태블릿 UI 연결
import { Engine, QUALITY, RES as RESV } from './main.js';
import { findLegacyProjects, convertLegacy, isNextProject, emptyProject, reportText, defaultLight, FORMAT, migrate } from './legacy.js';
import { loadAsset, exportGLB, exportOBJ, openFiles, saveFile, extOf, ASSET_EXT, RES_EXT, bytesToB64, b64ToBytes } from './io.js';
import { MAT_LABEL } from './materials.js';
import { STYLES } from './styles3d.js';
import { Plan2D, KINDS, fitOpening } from './plan2d.js';
import * as cloud from './cloud.js';
import { airKind } from './air.js';
import * as SITE from './site.js';
import { openMarket, recList as marketRecs } from './market.js';
import { CanvasRec, recType } from './rec.js';
import * as BL from './blender.js';
import { Sketch3D } from './sketch3d.js';
import { SectionView } from './section3d.js';
import { initUiMove, regrip, resetUiMove, toggleClean } from './uimove.js';
import * as DUAL from './dual.js';
import { pelStore } from './pelstore.js';
import { kidsZone, KID_THEMES } from './kids.js';
let secView = null;
let sketch = null;
import * as lib2 from './store.js';
import * as SL from './slope.js';
import { ENVTYPES, ENVCOL, ENVLV, envOf, envFront } from './env.js';
import { bakeParts, applyParts } from './design.js';
import { LINEKINDS, lineCat, XRN, lineZ, lineRound } from './lines.js';
import { ROLES, FAMN, SIMCOL } from './sim.js';
import { findFaces, splitPoly } from './rooms.js';
import { WFI } from './builder.js';
import * as SH from './shop.js';
import * as CAD from './cad.js';
import { initLang, setLang, lang } from './i18n.js';
export const APP_VERSION = '2.1.48';

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
function afterChange() { S.dirty = true; lib2.autosave(S.model); refreshBad(); syncPins(); plan && plan.redraw(); if (DUAL.isOpen()) setTimeout(() => DUAL.notify(), 50); /* 듀얼 모니터: 보조 창에 바로 반영 */ }
function restore(json) {
  const sel = S.sel; S.model = JSON.parse(json); S.last = json; engine.setLevel(level()); applyEnv(); afterChange();
  const L = level(), still = sel && ({ item: L.items, wall: L.walls, opening: L.openings, room: L.rooms }[sel.kind] || []).some((q) => q.id === sel.id);
  setSel(still ? sel : null); syncBar();
}
function undo() { if (!S.undo.length) return; S.redo.push(S.last); S.rm.push(S.um.pop()); restore(S.undo.pop()); S.lastC = cnts(); }
function redo() { if (!S.redo.length) return; S.undo.push(S.last); S.um.push(S.rm.pop()); restore(S.redo.pop()); S.lastC = cnts(); }
/** 다른 프로젝트로 가기 전: 저장 안 한 것이 있으면 묻는다 (false = 취소) */
async function leaveOk(nextId) {
  if (!S.model || !S.dirty || (nextId && nextId === S.model.id)) return true;
  const a = await ask('저장하지 않은 변경이 있어요', `"${S.model.name}" 을 저장할까요?`, [{ label: '취소', value: 'x' }, { label: '저장 안 함', value: 'no' }, { label: '저장', value: 'yes', kind: 'pri' }]);
  if (a === 'x' || !a) return false; if (a === 'yes') await saveNow(); else { await lib2.dropDraft(S.model.id); S.dirty = false; } return true;
}
/** [저장]: 지금 프로젝트에 덮어쓰기 (이 기기) */
async function saveNow(quiet) { if (!S.model) return; try { await lib2.saveProject(S.model); S.dirty = false; setSaveState('저장됨'); if (!quiet) toast('저장했어요 · 계정에도 두려면 [계정에 저장]', 2200); } catch (e) { toast('저장 실패 · ' + (e.message || e), 4000); } }
/** [계정에 저장]: 저장 + 내 계정에 올리기 */
async function saveCloud() { if (!cloud.session()) { toast('먼저 로그인해 주세요'); return ACT.account(); } await saveNow(true); try { await lib2.pushProject(S.model.id); setSaveState('계정에 저장됨'); toast('계정에 저장했어요 · 다른 기기 홈에서 [계정에서 받기]', 2500); } catch (e) { toast('계정 저장 실패 · ' + (e.message || e), 4500); } }
/** 보조 창(듀얼 모니터)에서 메인 창 모델을 따라갈 때: 저장 · 초안 확인 없이 화면만 바꾼다 */
let _followed = false;
async function followModel(model) {
  S.model = migrate(model, S.lib); S.undo.length = S.redo.length = S.um.length = S.rm.length = 0; S.last = snap(); S.lastC = cnts();
  await restoreAssets(); engine.setLevel(level()); applyEnv(); if (!_followed) { loadRender(); engine.view('iso'); plan.fit(); _followed = true; } syncCeilBtn(); plan.select(null, true); syncBar(); S.dirty = false;
}
async function setModel(model, fit = true) {
  if (S.model && S.model !== model && S.model.id !== model.id && !(await leaveOk(model.id))) return false;
  S.aiPrev = null; if (typeof plan !== 'undefined' && plan) plan.preview = null; S.multi = []; S.tucked = null;
  if (S.model && S.model !== model) await lib2.flush();
  if (engine.sim.on) { engine.sim.stop(); plan.simA = null; syncSimBtn(); } if (engine.air.on) toggleAir(); if (engine.xray) setXray(null);
  if (sketch) sketch.clear(); if (secView && secView.on) secView.exit();
  S.model = migrate(model, S.lib); S.undo.length = S.redo.length = S.um.length = S.rm.length = 0; S.last = snap(); S.lastC = cnts(); setTimeout(syncPins); setFocus(null);
  await restoreAssets(); S.sel = null; engine.setLevel(level()); applyEnv(); loadRender(); syncCeilBtn(); if (fit) { engine.view('iso'); plan.fit(); } plan.select(null, true); syncBar(); renderProps();
  S.dirty = false; try { const had = await lib2.getRec(S.model.id); if (!had || had.deleted) { await lib2.saveProject(S.model); } else setSaveState(had.synced && had.synced === had.updated ? '계정에 저장됨' : '저장됨'); } catch (e) { console.warn(e); } refreshBad();
  const d = await lib2.draftOf(S.model.id).catch(() => null); if (d) { const a = await ask('저장 안 한 변경이 남아 있어요', '지난번에 저장하지 않고 닫은 변경을 불러올까요?', [{ label: '버리기', value: 'no' }, { label: '불러오기', value: 'yes', kind: 'pri' }]); if (a === 'yes') { S.model = migrate(d, S.lib); engine.setLevel(level()); applyEnv(); plan.redraw(); renderProps(); S.dirty = true; setSaveState('저장 안 됨 · Ctrl+S'); } else await lib2.dropDraft(S.model.id); }
  return true;
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
  if (S.sel && S.sel.kind === 'site') { const i = S.sel.id; S.sel = null; engine.select(null); S.siteSel = i; engine.siteMark(i); S.panel = 'site'; S.propsOpen = true; plan.redraw(); return renderProps(); }
  engine.selectLine(S.sel && S.sel.kind === 'line' ? S.sel.id : null);
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
function saveRender() { if (!S.model) return; S.model.render = { style: engine.style, ...Object.fromEntries(RENDER_KEYS.map((k) => [k, engine.opt[k]])) }; S.dirty = true; lib2.autosave(S.model); }
function loadRender() { const r = S.model && S.model.render; if (!r) return; for (const k of RENDER_KEYS) if (r[k] != null && r[k] !== engine.opt[k]) engine.setOption(k, r[k]); if (r.style && STYLES[r.style] && r.style !== engine.style) setStyle(r.style, true); }
function setStyle(name, fromModel) {
  engine.setStyle(name); store.set('byr.style', name); plan.redraw(); if (!fromModel) saveRender();
  renderStyleMenu(name);
  if (S.propsOpen && !S.sel) renderProps();
}
/** 스타일 목록 + 맨 위에 화질(빠름 · 보통 · 고급) */
const SPEEDS = [[0.6, '이동 느리게'], [1, '이동 보통'], [1.5, '이동 빠르게']];
function setMoveSpeed(k) { engine.setMoveSpeed(k); plan.moveK = k; try { localStorage.setItem('byr.speed', String(k)); } catch {} }
function renderStyleMenu(name = engine.style) {
  $('#styleMenu').innerHTML = `<div class="qlab">해상도 <small>움직일 땐 가볍게 · 멈추면 또렷하게</small></div><div class="qrow" role="group" aria-label="해상도">${Object.entries(RESV).map(([k, q]) => `<button data-res="${k}" aria-pressed="${engine.res === k}">${q.name}</button>`).join('')}</div><div class="qlab">효과</div><div class="qrow" role="group" aria-label="화질">${Object.entries(QUALITY).map(([k, q]) => `<button data-qual="${k}" aria-pressed="${engine.qual === k}">${q.name}</button>`).join('')}</div><div class="qrow" role="group" aria-label="이동 속도">${SPEEDS.map(([v, n]) => `<button data-spd="${v}" aria-pressed="${Math.abs((engine.moveK || 1) - v) < 0.01}">${n}</button>`).join('')}</div>`
    + Object.entries(STYLES).map(([k, st]) => `<button role="menuitemradio" aria-checked="${k === name}" data-style="${k}"><b>${st.name}</b><small>${st.hint}</small></button>`).join('');
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
    const sz = await askSize(); /* 가로 · 세로 직접 입력 (m) */
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
  keys: () => showKeys(),
  hist: () => { S.panel = 'hist'; S.propsOpen = true; renderProps(); },
  uiset: () => { S.panel = 'uiset'; S.propsOpen = true; renderProps(); },
  orient: () => { S.panel = 'orient'; S.propsOpen = true; renderProps(); },
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
  save: () => saveNow(),
  saveCloud: () => saveCloud(),
  saveFile: async () => { const p = await saveFile({ title: 'BYR 프로젝트', defaultName: safeName() + '.byr.json', extensions: ['json'], data: JSON.stringify(S.model) }); if (p) toast('파일로 내보냈어요'); },
  legacy: async () => handleFiles(await openFiles({ title: '기존 앱 JSON', extensions: ['json'], multi: false })),
  kids: () => kidsDialog(),
  sample: async () => {
    const k = await ask('샘플 매장', '페리카나 매뉴얼(2025.01) 기준으로 주방 규칙 · 네온 · 시트 · 우드 패널까지 넣은 매장을 만들어요. 만든 뒤 자유롭게 고쳐도 돼요.', [{ label: '취소', value: false }, { label: '매뉴얼 그대로 · 홀 타입', value: 'man_hall' }, { label: '매뉴얼 그대로 · 배달 타입', value: 'man_delivery' }, { label: '키즈형 · ㄱ자 키즈룸', value: 'man_kidsL' }, { label: '키즈형 · 일자 키즈룸', value: 'man_kidsI' }, { label: '예전 앱 샘플', value: 'old' }, { label: '배달 매장 5×8m', value: 'pel_delivery' }, { label: '홀 매장 8×15m', value: 'pel_hall', kind: 'pri' }]);
    if (!k) return; if (k === 'old') { const r = await fetch('./data/legacy-sample.json'); return openJson('샘플', new Uint8Array(await r.arrayBuffer())); }
    if (k.startsWith('man_')) return makeManual(k);
    await makeSample(k);
  },
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
function addFromCatalog(id, at) {
  const L = S.lib[id]; if (!L) return; const lv = level(), c = at || engine.centerOnFloor();
  const elev = L.elev != null ? L.elev : L.layer === 'ceil' || L.layer === 'ceiling' ? lv.ceilingH - L.h : 0;
  const it = { id: uid('i'), type: id, name: L.name, x: c.x, y: c.y, elev, rot: 0, w: L.w, d: L.d, h: L.h, color: null, mat: null, parts: L.parts ? JSON.parse(JSON.stringify(L.parts)) : null, ...(L.parts ? { pb: { w: L.w, d: L.d, h: L.h } } : {}), light: L.light ? defaultLight(L) : null, kw: L.kw };
  lv.items.push(it); engine.rebuildItem(it); engine.select(it.id); commit(); closeDrawer(); setMode('move'); toast(`${L.name} 을 놓았어요 · 끌어서 자리를 잡으세요`);
}
function patchSel(patch, rebuild = true) { const it = selItem(); if (!it) return; Object.assign(it, patch); if (rebuild) engine.rebuildItem(it); else engine.moveItem(it); commit(); }

/* ---------- 속성 카드 (오른쪽 팝오버) ---------- */
const num = (label, key, v, step = 10) => `<label class="fld">${label}<input type="number" inputmode="numeric" data-k="${key}" value="${Math.round(v)}" step="${step}"></label>`;
function renderProps() {
  const el = $('#props'), body = $('#propsBody'); el.hidden = !S.propsOpen; $('#fab').setAttribute('aria-expanded', String(S.propsOpen)); if (!S.propsOpen) return;
  if (engine.design.active && S.panel !== 'design') { const keep = S.panel; endDesign(true); S.panel = keep; toast('디자인 수정을 저장하고 다른 작업으로 넘어갔어요', 2200); } /* 다른 작업으로 넘어가면 커서가 묶이지 않게 */
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
  if (S.panel === 'uiset') return renderUiSet(body);
  if (S.panel === 'site') return renderSite(body);
  if (S.panel === 'orient') return renderOrient(body);
  if (S.panel === 'cmt') return renderCmt(body);
  if (S.panel === 'multi' && (S.multi || []).length) return renderMulti(body);
  if (S.panel === 'dxf') return renderDxf(body);
  if (selRoom()) return renderRoom(body, selRoom());
  if (S.panel === 'account') return renderAccount(body);
  if (S.sel && S.sel.kind === 'line') { const ln = (level().lines || []).find((l) => l.id === S.sel.id); if (ln) return renderLine(body, ln); }
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
    ${L && L.sign ? signUi(it, L) : ''}
    <div class="sec">조명</div>
    <label class="tog">이 기물에 불 켜기<input type="checkbox" data-l="on" ${lt && lt.on ? 'checked' : ''}></label>
    ${lt && lt.on ? `<div class="row"><label class="fld">밝기<input type="range" data-l="power" min="0.1" max="3" step="0.1" value="${lt.power ?? 1}"></label><label class="fld">빛 색<input type="color" data-l="color" value="${lt.color || '#ffe2bd'}"></label></div>
      <label class="fld">비추는 방향<select data-l="kind"><option value="spot" ${lt.kind === 'spot' ? 'selected' : ''}>아래로 비추기 (전등)</option><option value="point" ${lt.kind !== 'spot' ? 'selected' : ''}>사방으로 (스탠드 · 불빛)</option></select></label>${lightUi(lt)}` : ''}
    ${airKindOf(it) === 'ac' ? `<div class="sec">에어컨 바람</div><label class="tog">에어컨 켜기 (공기 흐름에 찬 바람 넣기)<input type="checkbox" id="acOn" ${it.acOn ? 'checked' : ''}></label>${it.acOn ? `<label class="fld">세기 (마력)<input type="number" id="acHp" min="0.5" max="10" step="0.5" value="${it.acHp ?? 1}"></label>` : ''}` : ''}
    ${it.type === 'fence' ? '<div class="btns"><button class="btn pri" data-a="fenceL">펜스에 등 달기 (기둥마다)</button></div>' : ''}
    ${SL.isDrainItem(it, S.lib) ? '<div class="btns"><button class="btn pri" data-a="drain">이 배수 기물로 구배 잡기</button></div>' : ''}
    ${it.onSlope ? '<div class="row2"><span class="hint">구배 · 단 위에 올려져 있어요</span><button class="btn" data-a="unfit">원래 높이로</button></div>' : SL.needFit(level(), it, S.lib) ? `<div class="row2"><span class="hint warn">바닥(구배 · 단)에 ${SL.needFit(level(), it, S.lib)}mm 묻혀요</span><button class="btn pri" data-a="fit">바닥 위로</button></div>` : ''}
    <div class="btns"><button class="btn pri" data-a="design" ${it.asset ? 'disabled title="가져온 3D 파일은 디자인 수정이 안 돼요"' : ''}>디자인 수정 (점 · 면 · 부품 색)</button></div>
    <div class="btns"><button class="btn" data-a="rot90">90° 돌리기</button><button class="btn" data-a="dup">복제</button><button class="btn danger" data-a="del">삭제</button></div>`;
  if (L && L.sign) bindSignUi(body, it, L);
  const ao = $('#acOn', body); if (ao) ao.onchange = () => { const t = selItem(); if (ao.checked) t.acOn = true; else delete t.acOn; commit(); if (engine.air.on) engine.air.refresh(); else if (ao.checked) toast('공기 흐름(보기 → 공기)을 켜면 찬 바람이 보여요', 2500); renderProps(); };
  const ah = $('#acHp', body); if (ah) ah.onchange = () => { const t = selItem(); t.acHp = Math.max(0.5, +ah.value || 1); commit(); if (engine.air.on) engine.air.refresh(); };
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
  bindLightUi(body, () => [selItem()]);
  $$('[data-a]', body).forEach((b) => (b.onclick = () => {
    const t = selItem(); if (!t) return; if (b.dataset.a === 'fenceL') return fenceLights(t);
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
  $('#propsTitle').textContent = `공간 · ${r.name}`; const inIt = L.items.filter((q) => SL.pointInPoly(q.x, q.y, r.pts));
  body.innerHTML = `<div class="sec">편집 대상</div><div class="seg" role="group" aria-label="편집 대상"><button data-rsc="all" aria-pressed="${(S.roomScope || 'all') === 'all'}">공간 + 안의 기물 ${inIt.length}개</button><button data-rsc="floor" aria-pressed="${S.roomScope === 'floor'}">바닥(공간)만</button></div>
    <p class="hint">${S.roomScope === 'floor' ? '공간을 끌어 옮기거나 고쳐도 안의 기물은 그대로 있어요.' : '공간을 끌면 안의 기물도 같이 움직여요.'}${inIt.length && S.roomScope !== 'floor' ? ' <button class="lnk" data-ra="pickIn">안의 기물만 한꺼번에 고르기</button>' : ''}</p>
    <label class="fld">이름<input type="text" data-r="name" value="${esc(r.name)}"></label>
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
  $$('[data-rsc]', body).forEach((b) => (b.onclick = () => { S.roomScope = b.dataset.rsc; renderProps(); }));
  const pin = $('[data-ra=pickIn]', body); if (pin) pin.onclick = (e) => { e.stopImmediatePropagation(); const ids = level().items.filter((q) => SL.pointInPoly(q.x, q.y, r.pts)).map((q) => q.id); setSel(null); plan.setMulti(ids); toast(`안의 기물 ${ids.length}개를 골랐어요 · 오른쪽에서 한꺼번에 정렬 · 색 · 삭제`, 3000); };
  $$('[data-ra=tex],[data-ra=texX]', body).forEach((b) => (b.onclick = async (e) => { e.stopImmediatePropagation(); if (b.dataset.ra === 'texX') delete r.tex; else { const img = await pickTexture(); if (!img) return; r.tex = { img, size: (r.tex && r.tex.size) || 600 }; } engine.rebuildStructure(); commit(); renderProps(); }));
  $$('[data-ra]:not([data-ra=tex]):not([data-ra=texX]):not([data-ra=pickIn])', body).forEach((b) => (b.onclick = () => {
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
    { /* L자 · 다각형 공간: 상자 안이어도 공간 밖으로 나간 부분은 잘라 낸다 (가장 긴 안쪽 구간만) */
      const N = Math.max(8, Math.ceil(((t1 - t0) * len) / 100)); let best = null, run = null;
      for (let k = 0; k <= N; k++) { const t = t0 + ((t1 - t0) * k) / N, ok = inside(w.x1 + dx * t, w.y1 + dy * t, m); if (ok) { run = run ? { a: run.a, b: t } : { a: t, b: t }; if (!best || run.b - run.a > best.b - best.a) best = { ...run }; } else run = null; }
      if (!best) continue; t0 = best.a; t1 = best.b; if ((t1 - t0) * len < 200) continue; }
    const nw = { ...w, x1: Math.round(w.x1 + dx * t0), y1: Math.round(w.y1 + dy * t0), x2: Math.round(w.x1 + dx * t1), y2: Math.round(w.y1 + dy * t1) }; walls.push(nw);
    for (const o of L.openings) if (o.wall === w.id) { const t = o.t - t0 * len; if (t - o.w / 2 >= -1 && t + o.w / 2 <= (t1 - t0) * len + 1) opens.push({ ...o, t: Math.round(t) }); }
  }
  const m = { ...emptyProject(`${S.model.name} · ${r.name}`), env: S.model.env ? JSON.parse(JSON.stringify(S.model.env)) : undefined, source: { app: 'byr2-room', project: S.model.id, room: r.id, at: new Date().toISOString() } };
  m.levels = [{ ...JSON.parse(JSON.stringify({ ...L, bg: null })), id: 'L1', name: L.name, walls, openings: opens, rooms: [r], items: L.items.filter((it) => inside(it.x, it.y)), lines: (L.lines || []).filter((l) => l.pts.some((q) => inside(q[0], q[1], 200))), dims: (L.dims || []).filter((d) => inside(d.x1, d.y1, 300) && inside(d.x2, d.y2, 300)), sketches: (L.sketches || []).filter((k) => k.pts.some((q) => inside(q[0], q[1]))), soffits: (L.soffits || []).filter((o) => o.pts && o.pts.every((q) => inside(q[0], q[1], 200))) }].map((x) => JSON.parse(JSON.stringify(x)));
  m.comments = (S.model.comments || []).filter((c) => (c.lv ?? 0) === S.model.activeLevel && inside(c.x, c.y)).map((c) => ({ ...c, lv: 0 }));
  if (S.model.assets) { const keys = new Set(m.levels[0].items.filter((i) => i.asset).map((i) => i.asset.key)); m.assets = Object.fromEntries(Object.entries(S.model.assets).filter(([k]) => keys.has(k))); }
  await lib2.saveLocal(m); // 지금 프로젝트는 [저장] 할 때만
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
  if (!made && at) { const ex = L.rooms.filter((r) => SL.pointInPoly(at.x, at.y, r.pts)).sort((a, b) => SL.polyArea(a.pts) - SL.polyArea(b.pts))[0];
    if (ex) return askRoomKind(ex.pts, `"${ex.name}" 의 태그를 바꿀까요?`).then((k) => { if (k) { ex.kind = k; if (/^공간 \d+$/.test(ex.name)) ex.name = k; engine.rebuildStructure(); commit(); } S.tucked = null; setSel({ kind: 'room', id: ex.id }); });
    return ask('여기는 벽으로 닫힌 곳을 못 찾았어요', '벽과 상관없이 직접 그려서 공간을 정할 수 있어요.', [{ label: '사각형으로 그리기', value: 'roomRect', kind: 'pri' }, { label: '점 찍어 그리기', value: 'roomPoly' }, { label: '취소', value: false }]).then((t) => { if (t) { setPlanTool(t); toast(t === 'roomRect' ? '2D 에서 끌어서 사각형을 그리세요' : '꼭짓점을 차례로 누르고 첫 점을 다시 누르면 끝', 5000); } else untuck(); }); }
  if (!made) return toast('새로 찾은 공간이 없어요 (이미 다 있거나 벽이 닫혀 있지 않아요) · 직접 그리기를 써 보세요', 5000);
  engine.rebuildStructure(); commit(); if (last) setSel({ kind: 'room', id: last.id }); toast(`공간 ${made}개를 찾았어요 · 태그(주방 · 홀 …)를 붙여 주세요`, 5000);
}

function renderRooms(body) {
  const L = level(); $('#propsTitle').textContent = '공간 목록';
  body.innerHTML = `<div class="sec">직접 정하기 · 벽과 상관없이</div>
    <div class="btns"><button class="btn pri" data-rt="roomRect">사각형으로 그리기</button><button class="btn" data-rt="roomPoly">점 찍어 그리기</button><button class="btn" data-rt="cut">선으로 자르기</button></div>
    <p class="hint">큰 공간 안에 그리면 그 부분만 떼어 낸 새 공간이 돼요(바닥은 겹치지 않게 비워요). "선으로 자르기"는 공간을 가로지르는 선을 그으면 둘로 나눠요.</p>
    <div class="sec">벽에서 찾기 · 벽 끝이 450mm 까지 떨어져 있어도 이어서 봐요</div>
    <div class="plist">${L.rooms.length ? L.rooms.map((r) => `<button data-room="${r.id}"><b><i class="dot" style="background:${KINDS[r.kind] || '#ccc'}"></i>${esc(r.name)}</b><small>${esc(r.kind || '')} · ${(SL.polyArea(r.pts) / 1e6).toFixed(1)}㎡ · 기물 ${L.items.filter((it) => SL.pointInPoly(it.x, it.y, r.pts)).length}개${r.slope ? ' · 구배' : ''}${r.lift ? ` · 단 +${r.lift}` : ''}</small></button>`).join('') : '<p class="hint">아직 공간이 없어요</p>'}</div>
    <div class="btns"><button class="btn pri" data-ra="auto">벽 따라 공간 자동 찾기</button><button class="btn" data-ra="autoTap">눌러서 찾기 (2D)</button></div>
    ${S.focus ? '<div class="btns"><button class="btn" data-ra="all">전체 보기로</button></div>' : ''}`;
  $('[data-ra=auto]', body).onclick = () => autoRooms(null);
  $$('[data-rt]', body).forEach((b) => (b.onclick = () => { const t = b.dataset.rt; if (t === 'cut') { S.cutRoom = true; plan.lineKind = 'wire'; setPlanTool('line'); return toast('자를 공간을 가로질러 선을 그으세요 · 두 점을 찍고 끝점을 한 번 더 누르면 잘라요', 6000); }
    setPlanTool(t); toast(t === 'roomRect' ? '2D 에서 끌어서 사각형을 그리세요' : '꼭짓점을 차례로 누르고 첫 점을 다시 누르면 끝', 5000); }));
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
    <div class="chips"><button data-mh="1" aria-pressed="${!cat && !!engine.mepHide}">끄기 (숨기기)</button><button data-mh="0" aria-pressed="${!cat && !engine.mepHide}">보이기</button>${Object.entries(XRN).map(([k, n]) => `<button data-xr="${k}" aria-pressed="${cat === k}">${n} (${cnt(k)})</button>`).join('')}</div>
    <div class="sec">그리기 · 2D 에서 점을 차례로 · 마지막 점을 한 번 더 누르면 끝 (Enter)</div>
    <div class="chips">${Object.entries(LINEKINDS).map(([k, v]) => `<button data-lk="${k}" aria-pressed="${plan.tool === 'line' && plan.lineKind === k}"><i class="dot" style="background:${v.color}"></i>${v.name}</button>`).join('')}</div>
    <div class="row">${num('매립 깊이 (바닥 아래)', 'depth', LOPT.depth)}${num('천장(슬래브)에서 내려온 거리', 'off', LOPT.off)}</div>
    <p class="hint">그린 선을 2D · 3D 에서 누르면 높이 · 굵기 · 모양(원형/사각)을 바꿀 수 있어요.</p>
    <p class="hint">바닥 매립 · 바닥 배관은 바닥, 콘센트 · 가스는 벽, 천장 속 배선 · 덕트 · 급기/배기관은 천장 분류로 보여요. 지우기 도구로 선을 누르면 지워져요.</p>`;
  $$('[data-xr]', body).forEach((b) => (b.onclick = () => { setXray(b.dataset.xr || null); renderProps(); }));
  $$('[data-mh]', body).forEach((b) => (b.onclick = () => { const h = b.dataset.mh === '1'; setXray(null); engine.setMepHide(h); store.set('byr.mepHide', h); renderProps(); toast(h ? '설치물(배관 · 전선 · 콘센트 · 수전 위치 등)을 숨겼어요 · 발표에서도 안 보여요' : '설치물을 보여요'); }));
  $$('[data-lk]', body).forEach((b) => (b.onclick = () => { plan.lineKind = b.dataset.lk; setPlanTool('line'); const c = lineCat(LINEKINDS[b.dataset.lk]); if (engine.xray && c && engine.xray !== c) setXray(c); renderProps(); toast(`${LINEKINDS[b.dataset.lk].name} · 2D 에서 점을 차례로 누르세요`); }));
  $$('[data-k]', body).forEach((i) => (i.onchange = () => { LOPT[i.dataset.k] = Math.max(0, Math.round(+i.value || 0)); }));
}

/* ---------- 블렌더 실사 렌더 (발표 탭): 지금 시점 그대로 블렌더 Cycles 로 정지샷 ---------- */
const BLS = { q: store.get('byr.blQ', 'normal'), sz: store.get('byr.blSz', 'fhd'), ai: store.get('byr.blAi', true), exe: store.get('byr.blExe', ''), found: null, busy: false, log: '' };
const isPC = () => !!(window.byr && window.byr.blenderRun);
async function blPop() {
  let p = $('#blPop'); if (p) { if (!BLS.busy) p.remove(); return; } p = document.createElement('div'); p.id = 'blPop'; p.className = 'recpop blpop'; document.body.appendChild(p);
  const draw = () => { const f = BLS.found, key = !!(cloud.aiKey && cloud.aiKey());
    p.innerHTML = `<b>🎬 블렌더 실사 렌더</b><small>지금 보이는 시점 그대로, 블렌더(Cycles)가 재질 · 조명을 다시 짜서 정지샷을 만들어요</small>
      ${isPC() ? `<div class="blst">${f === null ? '블렌더 찾는 중…' : f ? `✓ 블렌더 ${esc(f.version || '')} <small>${esc(f.path)}</small>` : '⚠ 이 PC 에서 블렌더를 찾지 못했어요'}</div>
        <div class="btns">${f ? '' : '<button class="btn" data-bl="get">블렌더 받기 (무료)</button>'}<button class="btn" data-bl="pick">${f ? '다른 블렌더' : '직접 찾기 (blender.exe)'}</button></div>` : '<p class="hint">블렌더 렌더는 PC 앱에서 돼요. 여기서는 블렌더 작업 묶음(.zip)을 내보낼 수 있어요.</p>'}
      <div class="fld">품질<div class="seg2">${Object.entries(BL.QUALITY).map(([k, q]) => `<button data-blq="${k}" aria-pressed="${BLS.q === k}">${q.name} <small>${q.samples}</small></button>`).join('')}</div></div>
      <div class="fld">크기<div class="seg2">${Object.entries(BL.SIZES).map(([k, q]) => `<button data-bls="${k}" aria-pressed="${BLS.sz === k}">${q.name}</button>`).join('')}</div></div>
      <label class="tog">AI 가 재질을 하나씩 고르기 (목재 · 스테인리스 · 타일 · 대리석 …)<input type="checkbox" id="blAi" ${BLS.ai && key ? 'checked' : ''} ${key ? '' : 'disabled'}></label>${key ? '' : '<p class="hint">AI 키가 있으면 기물 이름 · 색을 보고 재질을 골라요. 없으면 BYR 기본 재질로 렌더해요.</p>'}
      <div class="ilive" id="blLive" hidden></div><pre class="ilog" id="blLog" ${BLS.log ? '' : 'hidden'}>${esc(BLS.log)}</pre>
      <div class="btns"><button class="btn" data-bl="x">${BLS.busy ? '숨기기' : '닫기'}</button><button class="btn" data-bl="zip" ${BLS.busy ? 'disabled' : ''}>작업 묶음 (.zip)</button>${isPC() ? `<button class="btn ${BLS.busy ? 'danger' : 'pri'}" data-bl="${BLS.busy ? 'stop' : 'go'}" ${!BLS.busy && !f ? 'disabled' : ''}>${BLS.busy ? '■ 렌더 취소' : '렌더 시작'}</button>` : ''}</div>`;
    $$('[data-blq]', p).forEach((b) => (b.onclick = () => { BLS.q = b.dataset.blq; store.set('byr.blQ', BLS.q); draw(); }));
    $$('[data-bls]', p).forEach((b) => (b.onclick = () => { BLS.sz = b.dataset.bls; store.set('byr.blSz', BLS.sz); draw(); }));
    const ai = $('#blAi', p); if (ai) ai.onchange = () => { BLS.ai = ai.checked; store.set('byr.blAi', BLS.ai); };
    $$('[data-bl]', p).forEach((b) => (b.onclick = async () => { const a = b.dataset.bl;
      if (a === 'x') return p.remove(); if (a === 'stop') return window.byr.blenderCancel();
      if (a === 'get') return window.byr.openUrl ? window.byr.openUrl('https://www.blender.org/download/') : window.open('https://www.blender.org/download/', '_blank');
      if (a === 'pick') { const r = await window.byr.blenderPick(); if (r) { BLS.found = r.version ? r : BLS.found; if (r.version) { BLS.exe = r.path; store.set('byr.blExe', r.path); } else toast('블렌더 실행 파일이 아니에요'); draw(); } return; }
      if (a === 'zip') return blZip(); if (a === 'go') return blRun(draw); })); };
  draw(); if (isPC() && BLS.found === null) { BLS.found = (await window.byr.blenderFind(BLS.exe || null).catch(() => null)) || false; if (BLS.found) { BLS.exe = BLS.found.path; store.set('byr.blExe', BLS.exe); } if ($('#blPop')) draw(); }
}
const blItemName = (id) => { const it = level().items.find((q) => q.id === id); return it ? it.name || (S.lib[it.type] && S.lib[it.type].name) || it.type : id; };
const blAi = async (list) => { const r = await cloud.ask(BL.aiPrompt(list), { name: 'materials.txt', mime: 'text/plain', bytes: new TextEncoder().encode('재질 목록은 위 프롬프트에 있어요') }, 6000); return r && r.materials; };
async function blRun(draw) {
  if (BLS.busy) return; BLS.busy = true; BLS.log = ''; draw(); const t0 = Date.now(); let cur = '준비 중…', pct = 0;
  const log = (t) => { BLS.log += (BLS.log ? '\n' : '') + t; const el = $('#blLog'); if (el) { el.hidden = false; el.textContent = BLS.log; el.scrollTop = 1e9; } };
  const iv = setInterval(() => { const el = $('#blLive'); if (el) { el.hidden = false; el.innerHTML = `<span class="spin"></span><span>${esc(cur)}</span><b>${pct ? pct + '% · ' : ''}${Math.round((Date.now() - t0) / 1000)}초</b>`; } }, 500);
  const off = window.byr.onBlenderLog((l) => { const m = l.match(/Sample (\d+)\/(\d+)/); if (m) { pct = Math.round((+m[1] / +m[2]) * 100); cur = `렌더 중 (샘플 ${m[1]}/${m[2]})`; return; } const s = l.match(/BYR:\s*(step|device|warn)\s*(.*)/); if (s) { cur = s[1] === 'device' ? `장치: ${s[2] === 'CPU' ? 'CPU (그래픽카드 못 씀 · 느림)' : s[2]}` : s[2]; log((s[1] === 'warn' ? '⚠ ' : '· ') + cur); } else if (/Error|Traceback|rror:/.test(l)) log('⛔ ' + l); });
  try {
    const job = await BL.blenderJob(engine, { quality: BLS.q, size: BLS.sz, itemName: blItemName, aiRefine: BLS.ai && cloud.aiKey && cloud.aiKey() ? blAi : null, onStep: (m) => { cur = m; log('· ' + m); } });
    log(`· 재질 ${job.mats}개 · 조명 ${job.lights}개 · ${job.plan.render.w}×${job.plan.render.h} · 샘플 ${job.plan.render.samples}`); cur = '블렌더 실행 중…';
    const r = await window.byr.blenderRun({ exe: BLS.exe || BLS.found.path, glb: job.glb, plan: job.plan });
    if (!r.ok) { log('⛔ ' + r.error); toast('블렌더 렌더 실패 · ' + r.error, 5000); } else { log(`✓ 완료 · ${Math.round((Date.now() - t0) / 1000)}초`); blShow(r); }
  } catch (e) { console.error(e); log('⛔ ' + (e.message || e)); } finally { clearInterval(iv); off(); BLS.busy = false; const el = $('#blLive'); if (el) el.hidden = true; if ($('#blPop')) draw(); }
}
function blShow(r) {
  let m = $('#blRes'); if (m) m.remove(); m = document.createElement('div'); m.id = 'blRes'; m.className = 'blres'; const url = URL.createObjectURL(new Blob([r.png], { type: 'image/png' }));
  m.innerHTML = `<div class="blres-in"><img src="${url}" alt="블렌더 렌더"><div class="btns"><button class="btn pri" data-br="save">PNG 저장</button><button class="btn" data-br="blend">블렌더에서 열기 (.blend)</button><button class="btn" data-br="dir">폴더 열기</button><button class="btn" data-br="x">닫기</button></div></div>`;
  document.body.appendChild(m);
  $$('[data-br]', m).forEach((b) => (b.onclick = async () => { const a = b.dataset.br; if (a === 'x') { URL.revokeObjectURL(url); return m.remove(); } if (a === 'blend' || a === 'dir') return window.byr.blenderOpen(r.dir, a === 'blend' ? 'blend' : 'dir');
    const p = await saveFile({ title: '블렌더 렌더', defaultName: `${safeName()}_blender.png`, extensions: ['png'], data: r.png }); if (p) toast('저장했어요'); }));
}
async function blZip() {
  try { toast('블렌더 작업 묶음을 만드는 중…'); const job = await BL.blenderJob(engine, { quality: BLS.q, size: BLS.sz, itemName: blItemName, aiRefine: BLS.ai && cloud.aiKey && cloud.aiKey() ? blAi : null });
    const py = new Uint8Array(await (await fetch('blender/byr_render.py')).arrayBuffer()), readme = `BYR2 블렌더 실사 렌더 묶음\r\n\r\n1. 이 폴더를 풀어 둡니다.\r\n2. 명령창에서: blender -b --factory-startup -P byr_render.py -- "이 폴더 경로"\r\n3. 같은 폴더에 render.png 와 scene.blend 가 생겨요.\r\n`;
    const z = SH.zip([{ name: 'scene.glb', data: new Uint8Array(job.glb) }, { name: 'plan.json', data: new TextEncoder().encode(JSON.stringify(job.plan, null, 1)) }, { name: 'byr_render.py', data: py }, { name: '읽어보기.txt', data: new TextEncoder().encode(readme) }]);
    const p = await saveFile({ title: '블렌더 작업 묶음', defaultName: `${safeName()}_blender.zip`, extensions: ['zip'], data: z }); if (p) toast('내보냈어요'); } catch (e) { toast('내보내기 실패 · ' + (e.message || e), 4000); }
}

/* ---------- 녹화: 3D 화면(캔버스)만 MP4 로 · 도구 · 막대는 안 찍힘 ---------- */
const REC = { len: store.get('byr.recLen', 30), spin: false, r: null };
function recPop() {
  let p = $('#recPop'); if (p) { p.remove(); return; } if (REC.r && REC.r.on) return;
  p = document.createElement('div'); p.id = 'recPop'; p.className = 'recpop'; document.body.appendChild(p);
  const draw = () => { const t = recType(); p.innerHTML = `<b>3D 화면 녹화</b><small>도구 · 막대는 빼고 3D 화면만 ${t && /mp4/.test(t) ? 'MP4' : 'WebM'} 으로 저장</small>
    <div class="seg2">${[10, 20, 30, 60].map((n) => `<button data-rl="${n}" aria-pressed="${REC.len === n}">${n < 60 ? n + '초' : '1분'}</button>`).join('')}</div>
    <label class="tog">360° 한 바퀴 돌리며 녹화 (녹화 길이 = 한 바퀴)<input type="checkbox" id="recSpin" ${REC.spin ? 'checked' : ''}></label>
    <p class="hint">${REC.spin ? '화면 가운데를 축으로 천천히 한 바퀴 돌아요.' : '녹화하는 동안 마우스 · 손가락으로 움직이는 그대로 찍혀요. 언제든 ■ 정지 · Esc 로 끝낼 수 있어요.'}</p>
    <div class="btns"><button class="btn" data-rc="x">닫기</button><button class="btn pri" data-rc="go" ${t ? '' : 'disabled'}>● 녹화 시작</button></div>${t ? '' : '<p class="hint warn">이 기기(브라우저)는 화면 녹화를 지원하지 않아요</p>'}`;
    $$('[data-rl]', p).forEach((b) => (b.onclick = () => { REC.len = +b.dataset.rl; store.set('byr.recLen', REC.len); draw(); }));
    $('#recSpin', p).onchange = (e) => { REC.spin = e.target.checked; draw(); };
    $$('[data-rc]', p).forEach((b) => (b.onclick = () => { p.remove(); if (b.dataset.rc === 'go') recStart(); })); };
  draw();
}
async function recStart() {
  if (S.pane === '2d') setPane('3d'); engine.select(null); engine.siteMark && engine.siteMark(null); if (engine.controls.autoRotate) engine.setSpin(false);
  const cv = engine.canvas; engine.recPr = Math.round(Math.min(2, Math.max(1, 1080 / Math.max(1, cv.clientHeight))) * 100) / 100; engine.recording = true; engine.resize(); engine.invalidate(true);
  if (REC.spin) engine.orbitT = REC.len;
  let bar = $('#recBar'); if (!bar) { bar = document.createElement('div'); bar.id = 'recBar'; bar.className = 'recbar'; document.body.appendChild(bar); }
  const fmt = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`; bar.hidden = false;
  bar.innerHTML = `<i class="dot"></i><b id="recT">0:00</b><span>/ ${fmt(REC.len)}</span><button class="btn sm" id="recStop">■ 정지</button>`; $('#recStop').onclick = () => REC.r && REC.r.stop();
  REC.r = new CanvasRec(cv);
  try {
    await new Promise((r) => setTimeout(r, 120)); const out = await REC.r.start({ max: REC.len, fps: 30, kbps: 14000, onTick: (t) => { const e = $('#recT'); if (e) e.textContent = fmt(t); } });
    recEnd(); toast(`녹화 ${Math.round(out.sec)}초 · 저장할 곳을 고르세요`, 2500);
    const name = `${(S.model.name || 'BYR').replace(/[\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.${out.ext}`;
    const saved = await saveFile({ title: '녹화 영상', defaultName: name, extensions: [out.ext], data: new Uint8Array(await out.blob.arrayBuffer()) });
    if (saved) toast(out.ext === 'mp4' ? `저장했어요 · ${saved}` : `저장했어요 (이 기기는 MP4 대신 WebM) · ${saved}`, 4000);
  } catch (e) { console.error(e); recEnd(); toast('녹화 실패 · ' + (e.message || e), 4000); }
}
function recEnd() { engine.recording = false; engine.orbitT = 0; engine.recPr = 0; engine.resize(); engine.invalidate(true); const bar = $('#recBar'); if (bar) bar.hidden = true; }

/* ---------- 간판: 글자 · 불 · 색 · 글자별로 나누기 ---------- */
function signUi(it, L) {
  const S0 = { ...L.sign, ...(it.sign || {}) }, k = S0.kind, txt = it.signText ?? S0.text ?? '', hx = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);
  return `<div class="sec">간판</div>
    <label class="fld">글자<input type="text" id="sgT" value="${esc(txt)}" placeholder="${esc(S0.text || '')}"></label>
    <label class="tog">간판 불 켜기 (글자 · 판이 빛나요)<input type="checkbox" id="sgOn" ${it.signOff ? '' : 'checked'}></label>
    <div class="row">${['ledpanel', 'channel', 'panel'].includes(k) ? `<label class="fld">글자 색 (빛)<input type="color" id="sgFg" value="${hx(S0.fg, '#ffffff')}"></label>` : ''}${k === 'ledpanel' ? `<label class="fld">판 색<input type="color" id="sgPn" value="${hx(S0.panel, '#18191c')}"></label>` : ''}${k === 'channel' ? `<label class="fld">옆면 색 (위 '색')</label>` : ''}</div>
    ${k === 'channel' && [...txt].filter((c) => c.trim()).length > 1 ? '<div class="btns"><button class="btn pri" id="sgSplit">글자별로 나누기 (한 글자씩 따로 고르기)</button></div><p class="hint">나누면 글자마다 위치 · 색 · 불을 따로 정할 수 있어요.</p>' : ''}`;
}
function bindSignUi(body, it, L) {
  const up = (f) => { const t = selItem(); if (!t) return; f(t); engine.rebuildItem(t); commit(); };
  const T = $('#sgT', body); if (T) T.onchange = () => { up((t) => (t.signText = T.value)); renderProps(); };
  const on = $('#sgOn', body); if (on) on.onchange = () => up((t) => { if (on.checked) delete t.signOff; else t.signOff = true; });
  const fg = $('#sgFg', body); if (fg) fg.onchange = () => up((t) => { t.sign = { ...(t.sign || {}), fg: fg.value }; if (t.light) t.light.color = fg.value; });
  const pn = $('#sgPn', body); if (pn) pn.onchange = () => up((t) => (t.sign = { ...(t.sign || {}), panel: pn.value }));
  const sp = $('#sgSplit', body); if (sp) sp.onclick = () => {
    const t = selItem(), S0 = { ...L.sign, ...(t.sign || {}) }, ch = [...(t.signText ?? S0.text ?? '')].filter((c) => c.trim()), n = ch.length, cell = Math.min(t.w / n, t.h * 1.05), a = (-t.rot * Math.PI) / 180, lv = level(), ids = [];
    ch.forEach((c, i) => { const off = -t.w / 2 + (t.w - cell * n) / 2 + cell * (i + 0.5), x = t.x + Math.cos(a) * off, y = t.y - Math.sin(a) * off; const q = mkItem('ch_letter', Math.round(x), Math.round(y), t.rot, { elev: t.elev, w: Math.round(cell), h: t.h, d: t.d, color: t.color, signText: c, sign: t.sign ? { ...t.sign } : undefined, name: `돌출 글자 '${c}'`, ...(t.signOff ? { signOff: true } : {}) }); if (t.light) q.light = { ...t.light, power: Math.max(0.15, (t.light.power || 0.6) / n * 1.5) }; lv.items.push(q); ids.push(q.id); });
    lv.items = lv.items.filter((q) => q !== t); engine.setLevel(lv); commit(); setSel({ kind: 'item', id: ids[0] }); toast(`${n}글자로 나눴어요 · 글자를 눌러 하나씩 고르세요`);
  };
}

/** 배관 · 전선 하나: 높이(바닥에서 중심까지) · 굵기(지름) · 모양 · 색 · 지우기 */
function renderLine(body, ln) {
  const k = LINEKINDS[ln.kind] || {}, z = Math.round(lineZ(k, ln, level())), w = ln.w || k.w, round = lineRound(ln), len = Math.round(ln.pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - ln.pts[i][0], q[1] - ln.pts[i][1]), 0));
  $('#propsTitle').textContent = k.name || '배관 · 전선';
  body.innerHTML = `<p class="hint">길이 ${(len / 1000).toFixed(2)}m · 꺾임 ${Math.max(0, ln.pts.length - 2)}곳</p>
    <div class="row"><label class="fld">높이 (바닥에서 중심까지, mm)<input type="number" id="lnZ" step="10" value="${z}"></label><label class="fld">${round ? '지름' : '폭'} (mm)<input type="number" id="lnW" min="5" max="1200" step="5" value="${w}"></label></div>
    <div class="chips"><button data-lz="${-(ln.depth ?? 80)}">바닥 매립</button><button data-lz="20">바닥 위</button><button data-lz="500">벽 속 (500)</button><button data-lz="${(level().ceilingH || 2700) + Math.round(((level().slabH || 3300) - (level().ceilingH || 2700)) / 2)}">천장 속</button><button data-lz="${(level().ceilingH || 2700) - Math.round(w / 2) - 30}">천장 아래 노출</button></div>
    ${ln.z != null ? '<button class="btn sm" id="lnZr">기본 높이로 (종류대로)</button>' : ''}
    <div class="fld">모양<div class="seg2"><button data-ls="round" aria-pressed="${round}">원형 (부드러운 꺾임)</button><button data-ls="rect" aria-pressed="${!round}">사각 덕트</button></div></div>
    <label class="fld">색<input type="color" id="lnC" value="${ln.color || k.color || '#999999'}"></label>
    <div class="btns"><button class="btn danger" id="lnDel">이 선 지우기</button></div>`;
  const up = () => { engine.rebuildLines(); commit(); plan.redraw(); };
  $('#lnZ', body).onchange = (e) => { ln.z = Math.round(+e.target.value || 0); up(); renderProps(); };
  $('#lnW', body).onchange = (e) => { ln.w = clamp(Math.round(+e.target.value || w), 5, 1200); up(); renderProps(); };
  $$('[data-lz]', body).forEach((b) => (b.onclick = () => { ln.z = +b.dataset.lz; up(); renderProps(); }));
  const zr = $('#lnZr', body); if (zr) zr.onclick = () => { delete ln.z; up(); renderProps(); };
  $$('[data-ls]', body).forEach((b) => (b.onclick = () => { ln.shape = b.dataset.ls; up(); renderProps(); }));
  $('#lnC', body).onchange = (e) => { ln.color = e.target.value; up(); };
  $('#lnDel', body).onclick = () => { const L = level(); L.lines = (L.lines || []).filter((l) => l !== ln); setSel(null); engine.rebuildLines(); commit(); plan.redraw(); toast('선을 지웠어요'); };
}

/* ----- 5차: 설비 점검 · 전력 · 견적 · 자동 배치 · A안/B안 (기존 앱 v7~v10) ----- */
const aisleOf = () => S.model.aisle || 900;
function mkItem(type, x, y, rot, over = {}) { const L = S.lib[type], it = spItem(type, x, y, rot, {}); delete it.room; if (L.parts) { it.parts = JSON.parse(JSON.stringify(L.parts)); it.pb = { w: L.w, d: L.d, h: L.h }; } return Object.assign(it, over); }
/** 매뉴얼 그대로 만든 매장 (홀 · 배달 · 키즈형 ㄱ자 / 일자) */
async function makeManual(k) {
  const kind = k === 'man_delivery' ? 'delivery' : 'hall', kids = k === 'man_kidsL' ? 'L' : k === 'man_kidsI' ? 'I' : null; await lib2.flush();
  const M = pelStore(kind, { emptyProject, mkItem, uid, kids }); if (!(await setModel(M))) return; setPane('split'); engine.view('iso'); plan.fit();
  toast(`${M.name} · 기물 ${level().items.length}개 · 조명 · 재질은 매뉴얼 스펙대로`, 4500);
}
/* ---------- 키즈룸 넣기 (직영점 참고): 벽으로 막힌 키즈룸 + 강화유리 벽 · 유리문 + 붙은 룸 ---------- */
async function kidsDialog() {
  let c = { form: 'L', theme: 'brown', lk: 5.0, dk: 4.6, room: true, lr: 4.0, end: false }; try { c = { ...c, ...(JSON.parse(localStorage.getItem('byr.kids2')) || {}) }; } catch {}
  const w0 = selWall(); const p = ask('키즈룸 넣기 (직영점 구성)', '', [{ label: '취소', value: false }, { label: '넣기', value: 'ok', kind: 'pri' }]);
  $('#dlgM').innerHTML = `<p class="hint" style="margin:0 0 8px">${w0 ? '<b>고른 벽</b>' : '가장 긴 바깥벽'} 안쪽을 따라 <b>벽으로 막힌 키즈룸</b>(홀 쪽 강화유리 벽 · 유리문, 우드 월 패널 · 레드 띠장)과 <b>붙은 룸</b>(키즈룸 쪽 강화유리 · 홀 쪽 벽 · 문 · 단체 테이블)을 만들고, 키즈룸 안에 2단 놀이 구조물(미끄럼틀 · 웨이브 · 볼풀 …)을 놓아요. 홀 매장용이에요.</p>
    <div class="fld">놀이 구조물 형태<div class="seg2" role="group"><button data-kf="L" aria-pressed="${c.form === 'L'}">ㄱ자 (미끄럼틀 날개)</button><button data-kf="I" aria-pressed="${c.form === 'I'}">일자</button></div></div>
    <div class="row" style="gap:8px"><label class="fld" style="flex:1">키즈룸 길이 (m · 벽 따라)<input id="kdLk" type="number" min="4" max="12" step="0.1" value="${c.lk}"></label><label class="fld" style="flex:1">깊이 (m)<input id="kdDk" type="number" min="4" max="8" step="0.1" value="${c.dk}"></label></div>
    <label class="tog">붙은 룸 만들기<input type="checkbox" id="kdRoom" ${c.room ? 'checked' : ''}></label>
    <label class="fld">룸 길이 (m)<input id="kdLr" type="number" min="2.5" max="10" step="0.1" value="${c.lr}"></label>
    <label class="tog">벽 끝 쪽에 붙이기 (반대 모서리)<input type="checkbox" id="kdEnd" ${c.end ? 'checked' : ''}></label>
    <label class="fld">놀이 구조물 색<select id="kdTh">${Object.entries(KID_THEMES).map(([k, v]) => `<option value="${k}" ${c.theme === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>`;
  $$('[data-kf]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); c.form = b.dataset.kf; $$('[data-kf]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  if ((await p) !== 'ok') return;
  const num = (id, a, b, d) => Math.min(b, Math.max(a, +$(id).value || d));
  c.lk = num('#kdLk', 4, 12, 5); c.dk = num('#kdDk', 4, 8, 4.6); c.room = $('#kdRoom').checked; c.lr = num('#kdLr', 2.5, 10, 4); c.end = $('#kdEnd').checked; c.theme = $('#kdTh').value; try { localStorage.setItem('byr.kids2', JSON.stringify(c)); } catch {}
  const L = level(), w = w0 || L.walls.slice().filter((q) => !q.pz).sort((a, b) => Math.hypot(b.x2 - b.x1, b.y2 - b.y1) - Math.hypot(a.x2 - a.x1, a.y2 - a.y1))[0]; if (!w) return toast('벽이 없어요 · 벽을 먼저 그려 주세요');
  const wl = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / wl, uy = (w.y2 - w.y1) / wl, b = levelBox(), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, t2 = (w.t || 150) / 2;
  let nx = -uy, ny = ux; if (nx * (cx - (w.x1 + w.x2) / 2) + ny * (cy - (w.y1 + w.y2) / 2) < 0) { nx = -nx; ny = -ny; }
  const need = (c.lk + (c.room ? c.lr : 0)) * 1000; if (need > wl - 100) toast(`벽 길이(${(wl / 1000).toFixed(1)}m)보다 길어요 · 길이를 줄이거나 긴 벽을 고르세요`, 4000);
  const z = kidsZone({ form: c.form, theme: c.theme, Lk: c.lk * 1000, Dk: c.dk * 1000, room: c.room, Lr: c.lr * 1000, atEnd: c.end }, { ax: w.x1 + nx * t2, ay: w.y1 + ny * t2, ux, uy, nx, ny, wallLen: wl }, { mkItem, uid });
  L.walls.push(...z.walls); L.openings.push(...z.openings); L.items.push(...z.items); (L.rooms ||= []).push(...z.rooms);
  engine.setLevel(L); applyEnv(); plan && plan.redraw && plan.redraw(); commit();
  toast(`키즈룸 ${c.lk}×${c.dk}m${c.room ? ` + 룸 ${c.lr}m` : ''} · 강화유리 벽 · 유리문 · 놀이 구조물 ${c.form === 'L' ? 'ㄱ자' : '일자'}`, 4500);
}
/** 페리카나 샘플 매장: 사각 매장 → 자동 배치(주방 규칙) → 매뉴얼 사인 · 시트 · 조형물 */
async function makeSample(kind) {
  const hall = kind === 'pel_hall', W = hall ? 8000 : 5000, D = hall ? 15000 : 8000; await lib2.flush();
  await setModel(emptyProject(hall ? '페리카나 홀 매장 (샘플)' : '페리카나 배달 매장 (샘플)', W, D));
  const L = level(), pr = SH.BIZ[kind], r = SH.autoLayout(L, S.lib, { kind, ratio: pr.ratio, front: 'S', aisle: 1200, clear: true, scope: { kitchen: 1, hall: 1, mep: 1, finish: 1 }, dish: hall }, mkItem, uid);
  if (r.error) return toast(r.error);
  const add = (type, x, y, rot, over = {}) => { if (!S.lib[type]) return null; const it = mkItem(type, Math.round(x), Math.round(y), rot, { pz: 'pel', ...over }); L.items.push(it); return it; };
  const iy0 = 75, iy1 = D - 75, ix0 = 75, ix1 = W - 75, part = L.walls.find((w) => w.pz === 'part'), py = part ? (part.y1 + part.y2) / 2 : iy0 + D * 0.4, counter = L.items.find((q) => /counter/.test(q.type));
  /* 옆벽(오른쪽): 우드 월 패널 + 가로 네온 로고 + 장식 띠장 + 원형 장식 (매뉴얼 04 내부 사인) */
  const hy0 = py + 700, hy1 = iy1 - 1300, hl = hy1 - hy0, hc = (hy0 + hy1) / 2, rx = ix1 - 10;
  if (hl > 2000) { add('pel_wood', rx, hc, 90, { w: Math.round(hl / 100) * 100, h: 2700, elev: 0 });
    add('pel_neon_h', rx - 25, hc, 90, { w: Math.min(1700, hl * 0.5), elev: 1650 }); add('pel_band', rx - 22, hc, 90, { w: Math.round(hl * 0.85 / 100) * 100, elev: 1890 });
    if (hall) for (let k = 0; k < 3; k++) add('pel_dome', rx - 75, hy1 - 500 - k * 650, 90, { elev: 1250 }); }
  /* 칸막이(홀 쪽): 메뉴 시트커팅 주황 띠 · 카운터 위 */
  if (part) { const cx = counter ? counter.x : W / 2, n = hall ? 3 : 2, pw = 1466, menus = ['Spicy Red Chicken|Soy Sauce Chicken', 'Spicy Red & Sweet Soy Chicken|Hot Devil Chicken', 'Sweet Soy Chicken|Seasoned Chicken'];
    const mb = L.items.filter((q) => q.type === 'menuboard'), bx0 = mb.length ? Math.min(...mb.map((q) => q.x - q.w / 2)) : cx - 300, bx1 = mb.length ? Math.max(...mb.map((q) => q.x + q.w / 2)) : cx + 300; /* 디지털 메뉴보드와 안 겹치게 양옆으로 */
    const xs = []; for (let k = 0; k < n; k++) { const left = k % 2 === 0, j = Math.floor(k / 2), x = left ? bx0 - 120 - pw / 2 - j * (pw + 20) : bx1 + 120 + pw / 2 + j * (pw + 20); if (x - pw / 2 > ix0 + 100 && x + pw / 2 < ix1 - 100) xs.push(x); }
    xs.forEach((x, k) => add('pel_menu', x, py + 90, 0, { elev: 1700, signText: menus[k % 3] })); }
  /* 앞벽: 윈도우 시트 · 유리 시트커팅 · 바깥 간판 · 입구 옆 세로 네온 */
  add('pel_window', ix0 + 900, iy1 - 4, 180, { w: 1000, h: 1500, elev: 700 }); add('pel_glass', ix1 - 900, iy1 - 4, 180, { w: 1000, h: 2000, elev: 100 });
  add('pel_sign', W / 2, D + 75 + 110, 0, { w: W - 200, elev: 2750 });
  if (hall) add('pel_neon_v', ix0 + 260, iy1 - 450, 0, { elev: 300 });
  /* 조명 무리: 홀 직부등 · 카운터 위 펜던트 · 후드등 · 진열 핀조명 */
  if (counter) for (let k = -1; k <= 1; k++) add('l_globe', counter.x + k * 900, counter.y + 450, 0, { elev: 1950 });
  const hood = L.items.find((q) => q.type === 'hood'); if (hood) add('l_hood', hood.x, hood.y, hood.rot || 0, { elev: 1950 });
  if (hl > 2000) for (let k = 0; k < 3; k++) add('l_pin', ix1 - 600, hy0 + 600 + k * (hl - 1200) / 2, 0);
  engine.setLevel(L); applyEnv(); plan.fit(); syncCeilBtn(); commit(); engine.view('iso');
  toast(`${pr.name} 샘플 · ${r.placed}개 + 매뉴얼 사인 · 시트 · 조형물 · 주방 ${r.kitchenA.toFixed(1)}㎡${r.hallA ? ` / 홀 ${r.hallA.toFixed(1)}㎡` : ''}`, 5000);
}
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
  const L = level(), rows = SH.bomRows(L, S.lib), P = (() => { const P0 = PRICE(); let mig = false; for (const r of rows) if (r.old && P0[r.key] == null && P0[r.old] != null) { P0[r.key] = P0[r.old]; mig = true; } if (mig) store.set('byr.price', P0); return P0; })(), /* 예전 단가(가로만 같은 기물)를 새 칸(가로×깊이×높이)으로 옮김 */ etc = store.get('byr.etc', 0), vat = store.get('byr.vat', true), t = SH.bomTotals(rows, P, etc, vat), a = SH.analyze(L, S.lib, aisleOf()); let g = '';
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
/* 내 프리셋 (시방서 · 계획서) — 이 기기(localStorage)와 프로젝트(model.bizpre)에 같이 둔다 */
const bizList = () => { const a = store.get('byr.bizpre', []) || [], m = (S.model && S.model.bizpre) || []; const out = [...a]; for (const p of m) if (!out.some((q) => q.id === p.id)) out.push(p); return out; };
const bizSave = (list) => { store.set('byr.bizpre', list); SH.setCustomBiz(list); };
const BIZC = [['main', '대표색'], ['hallWall', '홀 벽'], ['hallFloor', '홀 바닥'], ['hallFloor2', '홀 바닥 2'], ['kitFloor', '주방 바닥'], ['kitWall', '주방 벽'], ['counter', '카운터'], ['chair', '의자'], ['ceiling', '천장'], ['gate', '출입구']];
async function bizFromDoc() {
  const f = (await openFiles({ title: '시방서 · 계획서 (PDF · 이미지 · 글)', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'csv'] }))[0]; if (!f) return;
  const base = SH.BIZ[AUTO.kind] || SH.BIZ.pel_hall, id = uid('bz').slice(-8); let p = { id, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), base: AUTO.kind.startsWith('u_') ? (base.custom?.base || 'pel_hall') : AUTO.kind, ratio: base.ratio, pel: base.pel, colors: { ...(base.colors || {}) }, kitchen: base.kitchen.map((r) => [...r]), notes: [], doc: f.name };
  if (cloud.aiKey && cloud.aiKey()) { toast('AI 가 문서를 읽는 중…', 60000); const stopW = aiWatch((t) => toast(t.replace(/^\[\d+:\d+\] /, ''), /⛔/.test(t) ? 12000 : 300000), null); cloud.onAiStep((st) => toast(`${st.phase === 'error' ? '⛔ ' : ''}${st.msg}${st.detail ? ' → ' + st.detail : ''}`, st.phase === 'error' ? 15000 : 300000)); try { const r = await cloud.readSpec(await cloud.prepFile(f.name, f.data), S.lib); p = { ...p, ...r, kitchen: r.kitchen.length ? r.kitchen : p.kitchen, colors: { ...p.colors, ...r.colors }, pel: SH.BIZ[r.base]?.pel ?? p.pel, id, doc: f.name }; toast(`"${p.name}" 프리셋을 만들었어요 · 아래에서 고칠 수 있어요`, 5000); } catch (e) { console.error(e); toast('AI 가 읽지 못해서 지금 업종을 복사했어요 · 직접 고쳐 주세요 · ' + errTxt(e).replace('\n', ' '), 15000); } finally { stopW(); } }
  else toast('AI 키가 없어서 지금 업종을 복사했어요 · 색 · 기물을 직접 고쳐 주세요 (AI 화면에서 키를 넣으면 문서를 읽어 채워요)', 7000);
  const list = bizList(); list.push(p); bizSave(list); AUTO.kind = 'u_' + id; AUTO.ratio = null; renderProps();
}
function bizEditor() {
  const pr = SH.BIZ[AUTO.kind]; if (!pr || !pr.custom) return ''; const p = pr.custom;
  return `<div class="sec">내 프리셋 고치기</div><label class="fld">이름<input id="bzN" value="${esc(p.name)}"></label>
    ${p.doc ? `<p class="hint">문서: ${esc(p.doc)}</p>` : ''}${(p.notes || []).length ? `<p class="hint">${p.notes.map(esc).join('<br>')}</p>` : ''}
    <div class="row" style="flex-wrap:wrap">${BIZC.map(([k, n]) => `<label class="fld" style="min-width:30%">${n}<input type="color" data-bzc="${k}" value="${(p.colors || {})[k] || SH.PELI[k] || '#cccccc'}"></label>`).join('')}</div>
    <label class="chk"><input type="checkbox" id="bzPel" ${p.pel ? 'checked' : ''}> 브랜드 마감 디테일 (체크 바닥 · 붙박이 의자 · 바 테이블 · 조명)</label>
    <label class="fld">주방 기물 (한 줄에 하나: 기물id, 폭, 깊이, 수량, hot/wash/prep/cold/store)<textarea id="bzK" rows="8" style="font:12px ui-monospace,monospace">${esc((pr.kitchen || []).map((r) => r.join(', ')).join('\n'))}</textarea></label>
    <div class="btns"><button class="btn pri" id="bzSv">프리셋 저장</button><button class="btn" id="bzDel">프리셋 지우기</button></div>`;
}
function bizBind(body) {
  const pr = SH.BIZ[AUTO.kind]; if (!pr || !pr.custom || !$('#bzSv', body)) return; const id = pr.custom.id;
  $('#bzSv', body).onclick = () => { const list = bizList(), p = list.find((q) => q.id === id); if (!p) return; p.name = $('#bzN').value.trim() || p.name; p.pel = $('#bzPel').checked ? 1 : 0; p.ratio = AUTO.ratio ?? p.ratio; p.colors = {}; $$('[data-bzc]', body).forEach((i) => (p.colors[i.dataset.bzc] = i.value));
    const bad = []; p.kitchen = $('#bzK').value.split('\n').map((l) => l.split(/[,\t]/).map((x) => x.trim())).filter((r) => r[0]).filter((r) => (S.lib[r[0]] ? true : (bad.push(r[0]), false))).map((r) => [r[0], +r[1] || 0, +r[2] || 0, +r[3] || 1, r[4] || 'prep']);
    bizSave(list); if (S.model) { S.model.bizpre = list; commit(); } renderProps(); toast(bad.length ? `저장했어요 · 모르는 기물 빼고: ${bad.join(', ')}` : '프리셋을 저장했어요'); };
  $('#bzDel', body).onclick = async () => { if (!(await ask('이 프리셋을 지울까요?', pr.name, [{ label: '취소', value: false }, { label: '지우기', value: true }]))) return; const list = bizList().filter((q) => q.id !== id); bizSave(list); if (S.model && S.model.bizpre) { S.model.bizpre = S.model.bizpre.filter((q) => q.id !== id); commit(); } AUTO.kind = 'pel_hall'; AUTO.ratio = null; renderProps(); };
}
const AUTO = { kind: 'pel_delivery', ratio: null, front: 'auto', clear: false, newVar: false, scope: { kitchen: 1, hall: 1, mep: 1, finish: 1 } };
function renderAuto(body) {
  SH.setCustomBiz(bizList()); if (!SH.BIZ[AUTO.kind]) AUTO.kind = 'pel_hall'; varEnsure(); const M = S.model, pr = SH.BIZ[AUTO.kind], ratio = AUTO.ratio ?? pr.ratio, fd = SH.frontSide(level()), FN = { N: '위', S: '아래', E: '오른쪽', W: '왼쪽' };
  $('#propsTitle').textContent = '자동 배치 · A안/B안';
  body.innerHTML = `<div class="sec">업종</div><div class="chips">${Object.entries(SH.BIZ).map(([k, b]) => `<button data-bz="${k}" aria-pressed="${AUTO.kind === k}">${b.custom ? '★ ' : ''}${esc(b.name)}</button>`).join('')}<button id="bzDoc" title="인테리어 시방서 · 계획서를 올리면 색 · 주방 기물을 읽어 내 프리셋으로 저장해요">+ 시방서 · 계획서로 프리셋</button></div>${bizEditor()}
    <label class="fld">주방 비율 <b>${Math.round(ratio * 100)}%${ratio >= 0.95 ? ' · 배달 전용 (홀 없음)' : ''}</b><input type="range" id="auR" min="15" max="100" step="1" value="${Math.round(ratio * 100)}"></label>
    <div class="chips"><button data-rq="${pr.ratio}">기본 ${Math.round(pr.ratio * 100)}%</button><button data-rq="0.5">50%</button><button data-rq="0.7">70%</button><button data-rq="1">100% 배달 전용</button></div>
    <label class="fld">정면 (출입구 쪽, 2D 기준)<select id="auF"><option value="auto">자동${fd ? ` · 문이 있는 ${FN[fd.side]}` : ' · 아래'}</option>${Object.entries(FN).map(([k, n]) => `<option value="${k}" ${AUTO.front === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="row">${num('주방 통로 폭', 'aisle', aisleOf(), 50)}</div>
    <div class="sec">넣을 것</div><div class="chips">${[['kitchen', '주방 기물'], ['hall', '홀 (카운터 · 테이블)'], ['mep', '설비 (후드 · 배수 · 가스 · 3상)'], ['finish', '마감 색']].map(([k, n]) => `<button data-sc="${k}" aria-pressed="${!!AUTO.scope[k]}">${n}</button>`).join('')}</div>
    <label class="chk"><input type="checkbox" id="auDish" ${(AUTO.dish ?? (/hall/.test(AUTO.kind) && !/deliv/.test(AUTO.kind))) ? 'checked' : ''}> 식기세척기 넣기 (싱크 옆 · 벽에 안 붙게)</label>
    <label class="chk"><input type="checkbox" id="auClr" ${AUTO.clear ? 'checked' : ''}> 직접 놓은 기물도 모두 지우고 배치</label>
    <label class="chk"><input type="checkbox" id="auNew" ${AUTO.newVar ? 'checked' : ''}> 새 안으로 배치 (지금 안은 그대로 둠)</label>
    <div class="btns"><button class="btn pri" id="auGo">배치하기</button></div>
    <p class="hint">매장 바깥 벽을 기준으로 뒤쪽에 주방 · 앞쪽에 홀을 나누고, 칸막이 · 배식구 · 주방 기물(뒷벽 → 옆벽 → 칸막이) · 후드 · 배수구 · 카운터 · 테이블을 놓아요. 다시 배치하면 자동으로 놓은 것만 바꿔요.${pr.pel ? ' 페리카나 매뉴얼 2025.01 의 기물 · 색을 써요.' : ''}</p>
    <div class="sec">배치안 · ${M.variants.length}개</div>
    ${M.variants.map((v) => { const m = SH.metrics(varLevel(v), S.lib, PRICE()); return `<div class="lvrow ${v.id === M.varId ? 'on' : ''}"><button class="lvgo" data-vsw="${v.id}">${esc(v.name)}${v.id === M.varId ? ' · 지금' : ''}</button><small>기물 ${m.items} · 좌석 ${m.seats} · ${m.kw}kW</small><button class="qb" data-vren="${v.id}">이름</button>${M.variants.length > 1 ? `<button class="qb danger" data-vdel="${v.id}">지우기</button>` : ''}</div>`; }).join('')}
    <div id="vRen" hidden class="row"><input id="vRenIn" aria-label="안 이름"><button class="btn pri" id="vRenOk">바꾸기</button></div>
    <div class="btns"><button class="btn" id="vAdd">+ 지금 안 복사해서 새 안</button><button class="btn" id="vCmp" ${M.variants.length < 2 ? 'disabled' : ''}>비교하기</button></div>`;
  $$('[data-bz]', body).forEach((b) => (b.onclick = () => { AUTO.kind = b.dataset.bz; AUTO.ratio = null; AUTO.dish = undefined; renderProps(); })); $('#bzDoc', body).onclick = bizFromDoc; bizBind(body);
  $('#auR').oninput = (e) => { AUTO.ratio = +e.target.value / 100; e.target.previousElementSibling.textContent = `${e.target.value}%${+e.target.value >= 95 ? ' · 배달 전용 (홀 없음)' : ''}`; };
  $$('[data-rq]', body).forEach((b) => (b.onclick = () => { AUTO.ratio = +b.dataset.rq; renderProps(); }));
  $('#auF').onchange = (e) => (AUTO.front = e.target.value);
  $('[data-k=aisle]', body).onchange = (e) => { S.model.aisle = clamp(Math.round(+e.target.value || 900), 400, 2000); commit(); };
  $$('[data-sc]', body).forEach((b) => (b.onclick = () => { AUTO.scope[b.dataset.sc] = AUTO.scope[b.dataset.sc] ? 0 : 1; renderProps(); }));
  $('#auDish').onchange = (e) => (AUTO.dish = e.target.checked); $('#auClr').onchange = (e) => (AUTO.clear = e.target.checked); $('#auNew').onchange = (e) => (AUTO.newVar = e.target.checked);
  $('#auGo').onclick = async () => {
    if (AUTO.clear && level().items.some((it) => !it.pz) && !(await ask('기물을 모두 지우고 배치할까요?', '직접 놓은 기물도 지워져요. 되돌리기(↶)로 되돌릴 수 있어요.', [{ label: '취소', value: false }, { label: '지우고 배치', value: true, kind: 'pri' }]))) return;
    if (AUTO.newVar) varAdd(); setFocus(null);
    const r = SH.autoLayout(level(), S.lib, { kind: AUTO.kind, ratio: AUTO.ratio ?? pr.ratio, front: AUTO.front, aisle: aisleOf(), clear: AUTO.clear, scope: AUTO.scope, _bz: AUTO.kind.startsWith('u_') && (S.model.bizpre = bizList().filter((q) => 'u_' + q.id === AUTO.kind || (S.model.bizpre || []).some((m) => m.id === q.id))), dish: AUTO.dish ?? (/hall/.test(AUTO.kind) && !/deliv/.test(AUTO.kind)) }, mkItem, uid);
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
/* ---------- 빛 종류 · 색온도 (3000K 부터 1000K 단위) ---------- */
const KCOL = { 2700: '#ffa757', 3000: '#ffb46b', 4000: '#ffd1a3', 5000: '#ffe4ce', 6000: '#fff3ef', 7000: '#f3f2ff' };
const LTYPE = [['bulb', '알전구', 2700, 'point', 0.8], ['warm', '황색등', 3000, 'spot', 1], ['led', 'LED', 4000, 'spot', 1.2], ['white', '백색등', 6000, 'spot', 1.2]];
function lightUi(lt, many) { const k = lt && lt.k ? lt.k : 0;
  return `<div class="sec">빛 종류 · 색온도${many ? ` <small class="hint">(고른 조명 ${many}개 한꺼번에)</small>` : ''}</div><div class="chips">${LTYPE.map(([id, n, K]) => `<button data-lt="${id}" aria-pressed="${lt && lt.type === id}">${n} ${K}K</button>`).join('')}</div>
    <div class="row"><label class="fld">색온도<select data-lk>${[3000, 4000, 5000, 6000, 7000].map((K) => `<option value="${K}" ${k === K ? 'selected' : ''}>${K}K${K === 3000 ? ' (따뜻함)' : K === 6000 ? ' (하얀)' : ''}</option>`).join('')}${k && !KCOL[k] ? '' : ''}<option value="" ${!k ? 'selected' : ''}>직접 고른 색</option></select></label>
    <label class="fld">밝기 <b>${Math.round((lt && lt.power != null ? lt.power : 1) * 100)}%</b><input type="range" data-lp min="0.1" max="3" step="0.1" value="${lt && lt.power != null ? lt.power : 1}"></label></div>`; }
function bindLightUi(body, targets) {
  const apply = (fn, label) => { const ts = targets().filter(Boolean); for (const t of ts) { t.light = t.light || { on: true, kind: (S.lib[t.type] || {}).layer === 'floor' ? 'point' : 'spot', color: '#ffe2bd', power: 1 }; t.light.on = true; fn(t.light); engine.rebuildItem(t); } commit(); renderProps(); if (label && ts.length > 1) toast(`조명 ${ts.length}개 · ${label}`, 1500); };
  $$('[data-lt]', body).forEach((b) => (b.onclick = () => { const [id, n, K, kind, pw] = LTYPE.find((q) => q[0] === b.dataset.lt); apply((l) => Object.assign(l, { type: id, k: K, color: KCOL[K], kind: l.fixed ? l.kind : kind, power: Math.max(l.power ?? 1, pw) }), `${n} ${K}K`); }));
  const ks = $('[data-lk]', body); if (ks) ks.onchange = () => { const K = +ks.value; if (K) apply((l) => Object.assign(l, { k: K, color: KCOL[K] }), `${K}K`); };
  const lp = $('[data-lp]', body); if (lp) { lp.oninput = () => { lp.previousElementSibling.textContent = Math.round(lp.value * 100) + '%'; }; lp.onchange = () => apply((l) => (l.power = +lp.value), `밝기 ${Math.round(lp.value * 100)}%`); }
}
/** 펜스 기둥마다 외부등 달기 (펜스를 누르고 "등 달기") */
function fenceLights(f) { const n = Math.max(1, Math.round(f.w / 1200)), a = (-f.rot * Math.PI) / 180, c = Math.cos(a), s2 = Math.sin(a), L = level(); let made = 0;
  for (let i = 0; i <= n; i++) { const lx = -f.w / 2 + (f.w * i) / n, x = Math.round(f.x + lx * c), y = Math.round(f.y - lx * s2); if (L.items.some((q) => q.type === 'l_post' && Math.hypot(q.x - x, q.y - y) < 80)) continue; L.items.push(mkItem('l_post', x, y, f.rot || 0, { elev: (f.elev || 0) + f.h, of: f.id })); made++; }
  for (const q of L.items.filter((q) => q.of === f.id)) engine.addItem ? engine.addItem(q) : null; engine.setLevel(L); commit(); plan.redraw(); toast(made ? `외부등 ${made}개를 달았어요 · 조명 모드에서 디밍돼요` : '이미 모든 기둥에 등이 있어요'); }
function renderMulti(body) {
  const its = multiItems(), kw = its.reduce((a, q) => a + SH.itemKw(q, S.lib), 0);
  $('#propsTitle').textContent = `여러 개 · ${its.length}개`;
  body.innerHTML = `<p class="hint">고른 기물 중 하나를 끌면 함께 옮겨져요. Shift+누르기로 더하고 빼요. 전력 ${kw.toFixed(1)} kW</p>
    <div class="sec">정렬</div><div class="chips">${[['l', '왼쪽'], ['cx', '가로 가운데'], ['r', '오른쪽'], ['t', '위'], ['cy', '세로 가운데'], ['b', '아래']].map(([k, n]) => `<button data-al="${k}">${n}</button>`).join('')}</div>
    <div class="sec">간격 같게</div><div class="chips"><button data-ds="x">가로로</button><button data-ds="y">세로로</button><button data-ds="xt">가로로 딱 붙이기</button><button data-ds="yt">세로로 딱 붙이기</button></div>
    <div class="sec">한꺼번에</div><div class="row"><label class="fld">색<input type="color" id="muC" value="#b8bcc2"></label><label class="fld">재질<select id="muM"><option value="">그대로</option>${Object.entries(MAT_LABEL).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label></div>
    ${its.some((q) => q.light || (S.lib[q.type] || {}).light) ? lightUi((its.find((q) => q.light) || {}).light, its.filter((q) => q.light || (S.lib[q.type] || {}).light).length) : ''}
    <div class="btns"><button class="btn" data-mu="rot">묶어서 90° 돌리기</button><button class="btn" data-mu="dup">복제</button><button class="btn danger" data-mu="del">삭제</button><button class="btn" data-mu="none">고르기 풀기</button></div>`;
  const done = (msg) => { for (const q of its) engine.moveItem(q); commit(); plan.redraw(); if (msg) toast(msg, 2000); };
  bindLightUi(body, () => multiItems().filter((q) => q.light || (S.lib[q.type] || {}).light));
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
/** 선으로 공간 자르기: 첫 점 → 끝 점 직선이 지나는 공간을 둘로 */
async function cutRooms(pts) {
  S.cutRoom = false; setPlanTool('select'); const L = level(), a = pts[0], b = pts[pts.length - 1]; let n = 0, last = null;
  const crosses = (r) => { const P = r.pts; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]), e1 = (q[0] - p[0]) * (a[1] - p[1]) - (q[1] - p[1]) * (a[0] - p[0]), e2 = (q[0] - p[0]) * (b[1] - p[1]) - (q[1] - p[1]) * (b[0] - p[0]); if (d1 * d2 < 0 && e1 * e2 < 0) return true; } return false; };
  for (const r of [...L.rooms]) { if (!crosses(r)) continue; const sp = splitPoly(r.pts, a, b); if (!sp) continue; const [A, B] = sp.sort((x, y) => SL.polyArea(y) - SL.polyArea(x));
    r.pts = A; const nr = { ...JSON.parse(JSON.stringify(r)), id: uid('r'), pts: B, name: `${r.name} (나눔)`, slope: null }; L.rooms.push(nr); n++; last = nr; }
  if (!n) { untuck(); return toast('선이 공간을 가로지르지 않아요 · 공간 바깥에서 바깥까지 그어 주세요', 5000); }
  engine.rebuildStructure(); commit(); const k = await askRoomKind(last.pts, '잘라 낸 쪽 (주황색) 을 무엇으로 지정할까요?'); if (k) { last.kind = k; last.name = L.rooms.filter((q) => q.kind === k).length > 1 ? `${k} ${L.rooms.filter((q) => q.kind === k).length}` : k; engine.rebuildStructure(); commit(); }
  S.tucked = null; setSel({ kind: 'room', id: last.id }); toast(`공간 ${n}개를 둘로 나눴어요`);
}
/* ----- WASD · 방향키로 화면 옮기기 (2D 는 도면을, 3D 는 바닥을 따라) · 마우스가 있는 쪽 화면 ----- */
const panHeld = new Set(); let panRaf = 0;
function keyPan(k, on, fast) {
  if (k == null) panHeld.clear(); else if (on) panHeld.add(k); else panHeld.delete(k);
  const to3d = S.pane === '3d' || (S.pane === 'split' && S.hoverPane === '3d'); engine.panKeys = to3d ? panHeld : null; engine.panFast = !!fast; if (to3d) { engine.invalidate(false); return; }
  if (!panRaf && panHeld.size) { let t0 = performance.now(); const step = (t) => { const dt = Math.min(0.05, (t - t0) / 1000); t0 = t; const h = (x) => panHeld.has(x), ax = (h('d') || h('arrowright') ? 1 : 0) - (h('a') || h('arrowleft') ? 1 : 0), ay = (h('s') || h('arrowdown') ? 1 : 0) - (h('w') || h('arrowup') ? 1 : 0), sp = (engine.panFast ? 1000 : 420) * (engine.moveK || 1) * dt / plan.view.sc;
    plan.view.ox += ax * sp; plan.view.oy += ay * sp; plan.redraw(); panRaf = panHeld.size ? requestAnimationFrame(step) : 0; }; panRaf = requestAnimationFrame(step); }
}
/* ----- 단축키 안내 (F1 · Ctrl+/) ----- */
const KEYS = [['마우스 · 2D', [['그냥 끌기', '화면 옮기기 (기물은 안 움직임)'], ['누르기', '고르기 (오른쪽에 속성)'], ['Ctrl+Shift+끌기', '기물 · 벽 · 문 옮기기'], ['Ctrl+끌기', '길이 늘이기 · 줄이기 (잡은 쪽 끝)'], ['Shift+누르기 / Shift+끌기', '여러 개 고르기'], ['기물 앞 파란 손잡이', '돌리기 (15° 씩 · Shift 자유)'], ['휠', '확대 · 축소']]],
  ['마우스 · 3D', [['왼쪽 끌기', '돌려 보기'], ['오른쪽 끌기 · Shift+끌기', '바닥 따라 밀기'], ['휠', '가까이 · 멀리'], ['Ctrl+Shift+끌기', '기물 옮기기'], ['Ctrl+끌기', '기물 길이 늘이기']]],
  ['키보드', [['W A S D · 방향키', '화면 옮기기 (Shift = 빠르게) · 기물을 고르면 방향키는 10mm 이동 (Shift 100mm)'], ['Ctrl+B → W', '벽 바로 그리기'], ['T', '줄자'], ['M', '이동 모드 켜고 끄기 (그냥 끌어도 옮김)'], ['R · Shift+R · Ctrl+R', '90° 돌리기'], ['Ctrl+] / Ctrl+[', '크기 5% 키우기 · 줄이기'], ['Ctrl+Shift+> / <', '크기 10%'], ['G', '걷기'], ['H', '작업 기록'], ['Delete', '지우기'], ['Esc', '도구 끝내기 · 고르기 풀기'], ['Enter', '그리던 선 끝내기']]],
  ['공간', [['Alt+끌기 (2D)', '공간 사각형 바로 그리기 · 벽을 조금(5% 이내) 넘기면 벽까지만'], ['공간 누르기', '오른쪽에서 "공간 + 안의 기물" / "바닥만" 골라 편집']]],
  ['디자인 수정 (기물 · 벽)', [['부품 누르기 · Tab · Shift+Tab', '부품 고르기 · 다음 · 이전'], ['P · F', '점 끌기 · 면 밀고 당기기 모드'], ['Ctrl+Shift+끌기', '누른 부품 통째로 옮기기'], ['Ctrl+끌기', '누른 면 밀고 당기기 (어느 모드에서나)'], ['Ctrl+C · X · V · D', '부품 복사 · 잘라내기 · 붙여넣기 · 복제'], ['Delete', '부품 지우기'], ['Ctrl+Z · Ctrl+Y', '디자인 되돌리기 · 다시'], ['Enter', '완료 · 저장'], ['Esc', '끝내기 (고친 게 있으면 저장할지 물어봄)']]],
  ['발표 모드', [['1 · 2 · 3', '자유 보기 · 설치물 보기 · 조명 모드'], ['Esc', '발표 끝내기']]],
  ['어디서나', [['Esc', '하던 작업 멈추기 (그리기 · 이동 · 걷기 · 디자인 수정 · 고르기)'], ['Ctrl+Z', '한글 자판이어도 되돌리기']]],
  ['편집', [['Ctrl+Z · Ctrl+Shift+Z · Ctrl+Y', '되돌리기 · 다시'], ['Ctrl+C · X · V', '복사 · 잘라내기 · 붙여넣기'], ['Ctrl+D', '복제'], ['Ctrl+A', '모두 고르기 (2D)'], ['Ctrl+S', '프로젝트 저장'], ['Ctrl+O · Ctrl+N', '내 프로젝트 · 새 프로젝트'], ['Ctrl+P', '이미지 · 단면 · 시점'], ['F1 · Ctrl+/', '이 안내']]],
  ['걷기', [['W A S D', '걷기 (Shift = 뛰기)'], ['← →', '고개 돌리기'], ['Q · E', '눈높이 낮추기 · 높이기'], ['Esc', '걷기 끝']]]];
function showKeys() {
  ask('단축키', '', [{ label: '닫기', value: false, kind: 'pri' }]);
  setTimeout(() => { const t = $('#dlgM') || $('#dlg p'); if (t) t.innerHTML = `<span class="keys">${KEYS.map(([g, L]) => `<b class="kh">${g}</b>${L.map(([a, b]) => `<kbd>${esc(a)}</kbd><span>${esc(b)}</span>`).join('')}`).join('')}</span>`; });
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
const airKindOf = (it) => airKind(it, S.lib[it.type]);
function toggleAir() {
  const A = engine.air; if (A.on) { A.stop(); $('#airHud').hidden = true; } else { if (S.pane === '2d') setPane('split'); A.start(); $('#airHud').hidden = false; A.info(); }
  const b = $('#dkAir'); if (b) b.setAttribute('aria-pressed', String(A.on));
}
function airHud(i) {
  const h = $('#airHud'); if (!h || h.hidden) return;
  h.innerHTML = `<span><b>공기</b> 급기 ${i.in} · 배기 ${i.out} · 후드 ${i.hood} · 출입구 ${i.door}${i.ac ? ` · 에어컨 ${i.ac}` : ''}</span><span class="airhp">급기 팬 <input type="number" id="airHpIn" min="0.25" max="10" step="0.25" value="${i.hpIn}">마력 · 배기 팬 <input type="number" id="airHpOut" min="0.25" max="10" step="0.25" value="${i.hpOut}">마력 <small>(디퓨저 수로 나눔)</small></span>${i.heat ? `<span>열원 ${i.heat} · 후드 포집 <b class="${i.capture != null && i.capture < 70 ? 'warn' : ''}">${i.capture == null ? '계산 중' : i.capture + '%'}</b></span>` : ''}${!i.out && !i.hood ? '<span class="warn">후드 · 배기가 없어요</span>' : ''}<button class="btn" id="airSmoke" aria-pressed="${engine.air.smoke}">연기</button><button class="btn" id="airOff">끄기</button>`;
  $('#airSmoke').onclick = () => { engine.air.smoke = !engine.air.smoke; airHud(i); };
  for (const [id, k] of [['#airHpIn', 'in'], ['#airHpOut', 'out']]) $(id).onchange = (e) => { const L = level(); L.airHp = { ...(L.airHp || {}), [k]: Math.max(0.25, +e.target.value || 1) }; commit(); engine.air.refresh(); }; $('#airOff').onclick = () => toggleAir();
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
function switchLevel(i) { setTimeout(syncPins); S.aiPrev = null; if (plan) plan.preview = null;  if (engine.sim.on) { engine.sim.stop(); plan.simA = null; syncSimBtn(); } S.model.activeLevel = clamp(i, 0, S.model.levels.length - 1); S.sel = null; setFocus(null); engine.setLevel(level()); applyEnv(); engine.view('iso'); plan.fit(); plan.select(null, true); syncBar(); syncCeilBtn(); refreshBad(); }

/* ----- 배경 (주변 거리) · 도면 밑그림 ----- */
function renderBg(body) {
  const E = envOf(S.model), L = level(), bg = L.bg, hk = E.hk ?? 1, nk = E.nk ?? 1, lv = Object.entries(ENVLV).reduce((b, [k, v]) => (Math.abs(v[0] - hk) + Math.abs(v[1] - nk) < Math.abs(ENVLV[b][0] - hk) + Math.abs(ENVLV[b][1] - nk) ? k : b), '5');
  $('#propsTitle').textContent = '배경 · 밑그림';
  body.innerHTML = `<div class="sec">배경 (상권 조감도)</div>
    <div class="chips">${ENVTYPES.filter(([k]) => (k !== 'map' || E.map) && (k !== 'site' || E.site)).map(([k, n]) => `<button data-env="${k}" aria-pressed="${E.type === k}">${n}</button>`).join('')}</div>
    ${E.site ? `<div class="sec">상권 배경</div>${E.type === 'site' ? siteLayersHtml(E) : ''}<div class="btns"><button class="btn pri" id="siteOpen">상권 3D 패널 (범례 · 상가 고르기)</button></div>` : '<p class="hint">주소로 실제 주변(반경 500m)을 세우려면 홈 → 주소로 상가 찾기</p>'}
    ${mapSecHtml(E)}
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
  bindMapSec(body, E); if (E.site && E.type === 'site') bindSiteLayers(body, E, () => { applyEnv(); commit(); renderProps(); }); const so = $('#siteOpen', body); if (so) so.onclick = () => { if (E.type !== 'site') { E.type = 'site'; applyEnv(); commit(); } S.panel = 'site'; renderProps(); };
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
/* ---------- 지도 캡처 → AI 가 주변 건물 · 도로 · 녹지 · 나무를 단순한 덩어리로 (AI 키가 있을 때만) ----------
 * 캡처 가로 실제 길이(m)와 가게 자리(그림을 눌러 찍음)로 축척을 잡고, 고른 범위만 잘라 보낸다 → 범위가 넓을수록 토큰이 많이 든다 */
const MAPQ = { url: null, w: 0, h: 0, sx: 0.5, sy: 0.5, widthM: 300, range: 'mid', top: 'N', busy: false, log: '' };
const MRANGE = { low: ['좁게', 100, 3000], mid: ['보통', 200, 6000], high: ['넓게', 400, 12000] };
function mapCrop() {
  const Q = MAPQ, pxPerM = Q.w / Math.max(20, Q.widthM), side = Math.min(Q.w, Q.h, MRANGE[Q.range][1] * pxPerM), x0 = clamp(Q.sx * Q.w - side / 2, 0, Q.w - side), y0 = clamp(Q.sy * Q.h - side / 2, 0, Q.h - side), out = Math.min(1568, Math.round(side));
  return { x0, y0, side, out, sideM: side / pxPerM, tokIn: Math.round((out * out) / 750) + 700, tokOut: MRANGE[Q.range][2] };
}
function mapSecHtml(E) {
  const Q = MAPQ, key = cloud.aiKey && cloud.aiKey(), c = Q.url ? mapCrop() : null;
  return `<div class="sec">지도 캡처로 주변 만들기 <small>AI</small></div>
    ${key ? '' : '<p class="hint">네이버 · 구글 지도(위성 · 일반) 캡처를 AI 가 읽어 주변 건물 · 도로 · 나무를 세워요. <b>AI 키가 있어야 해요</b> — <button class="btn sm" id="mapAiGo">AI 키 넣기</button></p>'}
    <div class="btns"><button class="btn" id="mapPick" ${key ? '' : 'disabled'}>${Q.url ? '캡처 바꾸기' : '지도 캡처 고르기'}</button>${E.map ? '<button class="btn danger" id="mapDel">지도 배경 지우기</button>' : ''}</div>
    ${Q.url ? `<div class="mapbox" id="mapBox"><img src="${Q.url}" alt="지도 캡처"><i class="mcrop" style="left:${(c.x0 / Q.w) * 100}%;top:${(c.y0 / Q.h) * 100}%;width:${(c.side / Q.w) * 100}%;height:${(c.side / Q.h) * 100}%"></i><i class="mpin" style="left:${Q.sx * 100}%;top:${Q.sy * 100}%"></i></div>
    <p class="hint">그림에서 <b>우리 가게 자리</b>를 눌러 찍으세요. 파란 네모 안만 AI 에 보내요.</p>
    <label class="fld">캡처 가로 실제 길이 (m) <small>지도 축척 막대로 어림</small><input type="number" id="mapW" min="20" max="5000" step="10" value="${Q.widthM}"></label>
    <div class="fld">범위<div class="seg2">${Object.entries(MRANGE).map(([k, [n, m]]) => `<button data-mr="${k}" aria-pressed="${Q.range === k}">${n} ${m}m</button>`).join('')}</div></div>
    <label class="fld">도면 위쪽이 지도의<select id="mapTop">${[['N', '북쪽 (기본)'], ['E', '동쪽'], ['S', '남쪽'], ['W', '서쪽']].map(([k, n]) => `<option value="${k}" ${Q.top === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <p class="hint">실제 범위 약 ${Math.round(c.sideM)}m · 예상 토큰: 보내기 약 ${c.tokIn.toLocaleString()} + 받기 최대 ${c.tokOut.toLocaleString()}</p>
    <div class="btns"><button class="btn pri" id="mapGo" ${Q.busy || !key ? 'disabled' : ''}>${Q.busy ? 'AI 가 지도를 읽는 중…' : 'AI 로 주변 만들기'}</button></div>` : ''}
    <div class="ilive" id="mapLive" hidden></div><pre class="ilog" id="mapLog" ${Q.log ? '' : 'hidden'}>${esc(Q.log)}</pre>`;
}
function bindMapSec(body, E) {
  const Q = MAPQ, go = $('#mapAiGo', body); if (go) go.onclick = () => ACT.ai();
  $('#mapPick', body) && ($('#mapPick', body).onclick = async () => { const f = (await openFiles({ title: '지도 캡처', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f) return; Q.url = await shrinkToDataUrl(f.data, 3000); const im = new Image(); im.onload = () => { Q.w = im.naturalWidth; Q.h = im.naturalHeight; Q.sx = 0.5; Q.sy = 0.5; renderProps(); }; im.src = Q.url; });
  $('#mapDel', body) && ($('#mapDel', body).onclick = () => { delete E.map; if (E.type === 'map') E.type = 'basic'; applyEnv(); commit(); renderProps(); });
  const box = $('#mapBox', body); if (box) box.onclick = (e) => { const r = box.getBoundingClientRect(); Q.sx = clamp((e.clientX - r.left) / r.width, 0, 1); Q.sy = clamp((e.clientY - r.top) / r.height, 0, 1); renderProps(); };
  $('#mapW', body) && ($('#mapW', body).onchange = (e) => { Q.widthM = clamp(+e.target.value || 300, 20, 5000); renderProps(); });
  $$('[data-mr]', body).forEach((b) => (b.onclick = () => { Q.range = b.dataset.mr; renderProps(); }));
  $('#mapTop', body) && ($('#mapTop', body).onchange = (e) => (Q.top = e.target.value));
  $('#mapGo', body) && ($('#mapGo', body).onclick = () => mapRun(E));
}
async function mapRun(E) {
  const Q = MAPQ; if (Q.busy || !Q.url) return; Q.busy = true; Q.log = ''; renderProps();
  const log = (t) => { Q.log += (Q.log ? '\n' : '') + t; const el = $('#mapLog'); if (el) { el.hidden = false; el.textContent = Q.log; el.scrollTop = 1e9; } };
  const stop = aiWatch(log, $('#mapLive'));
  try {
    const c = mapCrop(), im = new Image(); im.src = Q.url; await im.decode(); const cv = document.createElement('canvas'); cv.width = cv.height = c.out; cv.getContext('2d').drawImage(im, c.x0, c.y0, c.side, c.side, 0, 0, c.out, c.out);
    const bytes = Uint8Array.from(atob(cv.toDataURL('image/jpeg', 0.9).split(',')[1]), (x) => x.charCodeAt(0));
    const sx = (Q.sx * Q.w - c.x0) / c.side, sy = (Q.sy * Q.h - c.y0) / c.side; log(`범위 약 ${Math.round(c.sideM)}m 를 ${c.out}px 로 잘라 보내요`);
    const res = await cloud.readMap({ name: '지도 캡처.jpg', mime: 'image/jpeg', bytes, aspect: 1 }, { sx, sy, detail: Q.range, maxTokens: c.tokOut });
    const b = levelBox(), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, S2 = c.sideM * 1000;
    const rot = { N: ([x, y]) => [x, y], E: ([x, y]) => [y, -x], S: ([x, y]) => [-x, -y], W: ([x, y]) => [-y, x] }[Q.top] || ((p) => p);
    const P = (pt) => { const [x, y] = rot([((+pt[0] || 0) - sx) * S2, ((+pt[1] || 0) - sy) * S2]); return [Math.round(cx + x), Math.round(cy + y)]; };
    const ok = (a) => Array.isArray(a) && a.length >= 2 && a.every((p) => Array.isArray(p) && p.length >= 2);
    const M = { rangeM: Math.round(c.sideM),
      buildings: (res.buildings || []).filter((x) => x && ok(x.p) && x.p.length >= 3).map((x) => ({ p: x.p.map(P), h: Math.round(clamp(+x.floors || 3, 1, 60) * (x.apt ? 2900 : 3300)), apt: !!x.apt })),
      roads: (res.roads || []).filter((x) => x && ok(x.p)).map((x) => ({ p: x.p.map(P), w: Math.round(clamp(+x.lanes || 2, 1, 10) * 3200) })),
      green: (res.green || []).filter((x) => x && ok(x.p) && x.p.length >= 3).map((x) => ({ p: x.p.map(P) })),
      trees: (res.trees || []).filter((p) => Array.isArray(p) && p.length >= 2).map(P) };
    log(`✓ 건물 ${M.buildings.length} · 도로 ${M.roads.length} · 녹지 ${M.green.length} · 나무 ${M.trees.length}`);
    E.map = M; E.type = 'map'; applyEnv(); commit(); if (S.pane === '2d') setPane('split'); envBird(); toast('지도 캡처로 주변을 세웠어요 · 건물 높이 · 수는 아래 막대로');
  } catch (e) { console.error(e); log('⛔ ' + errTxt(e)); } finally { stop(); Q.busy = false; renderProps(); }
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
/** Esc: 지금 하던 작업을 무엇이든 멈춘다 (디자인 수정 · 걷기 · 그리기 도구 · 줄자 · 이동 · 고르기 순). 멈춘 게 있으면 true */
function escAll() {
  if (REC.r && REC.r.on) { REC.r.stop(); return true; } if ($('#recPop')) { $('#recPop').remove(); return true; }
  if (engine.design.active) { const d = engine.design; if (d.dirty) { ask('디자인 수정을 끝낼까요?', '고친 내용을 저장하고 나갈지, 버리고 나갈지 골라요.', [{ label: '계속 수정', value: null }, { label: '버리고 나가기', value: false }, { label: '저장하고 나가기', value: true, kind: 'pri' }]).then((r) => { if (r != null) { endDesign(r); renderProps(); } }); } else { endDesign(false); renderProps(); } return true; }
  if (engine.walker.active) { engine.walker.stop ? engine.walker.stop() : stopWalk?.(); return true; }
  if (engine.controls.autoRotate || tourOn) { engine.setSpin(false); if (tourOn) { tourOn = false; engine.stopFly(); } $$('[data-pv="spin"]').forEach((x) => x.setAttribute('aria-pressed', 'false')); if (S.panel === 'view') renderProps(); toast('360° 보기를 멈췄어요', 1200); return true; }
  if (S.dragTmp || engine.dragging) { engine.cancelDrag?.(); plan.cancelDrag?.(); }
  if (S.patrol || S.cutRoom || S.roomDrag) { S.patrol = null; S.cutRoom = false; S.roomDrag = null; plan.redraw(); }
  if (plan.tool && plan.tool !== 'select') { plan.picker = null; plan.cancelTool?.(); setPlanTool('select'); if (S.tucked) untuck(); toast('그리기를 멈췄어요', 1200); return true; }
  if (engine.mode && engine.mode !== 'select') { setMode('select'); return true; }
  if (engine.sim.on && S.patrol) { S.patrol = null; return true; }
  return false;
}
function startDesign(it) {
  if (S.pane === '2d') setPane('split'); setFocus(null);
  DE.it = it; const d = engine.design; d.onChange = () => renderProps(); d.onSelect = () => renderProps();
  S.panel = 'design'; S.propsOpen = true; d.start(it, bakeParts(it, { lib: S.lib, shapes: S.shapes })); renderProps();
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
    <div class="btns"><button class="btn" data-de="undo">↶ 되돌리기</button><button class="btn" data-de="redo">↷ 다시</button><button class="btn" data-de="mine">새 기물로 저장</button></div>
    <p class="hint">⚠ 위의 "완료"를 눌러야 프로젝트에 저장돼요. 완료 전에 앱을 닫으면 이 수정은 사라져요.</p>
    <div class="btns"><button class="btn danger" data-de="cancel">취소</button><button class="btn pri" data-de="ok">완료 · 저장</button></div>`;
  $$('[data-dm]', body).forEach((b) => (b.onclick = () => { d.setMode(b.dataset.dm); renderProps(); }));
  $$('[data-ax]', body).forEach((b) => (b.onclick = () => { d.axis = b.dataset.ax; renderProps(); }));
  $('#deWeld').onchange = (e) => { d.weld = e.target.checked; };
  $$('[data-pp]', body).forEach((b) => (b.onclick = () => d.selectPart(+b.dataset.pp)));
  $$('[data-pc]', body).forEach((c) => { c.oninput = () => { const k = +c.dataset.pc; P[k].c = c.value; P[k].own = true; d.rebuild(); }; c.onchange = () => d.setColor(+c.dataset.pc, c.value); });
  $('#deMat').onchange = (e) => d.setMat(i, e.target.value); $('#deA').onchange = (e) => d.setAlpha(i, +e.target.value);
  $$('[data-de]', body).forEach((b) => (b.onclick = () => { const a = b.dataset.de;
    if (a === 'dup') d.duplicatePart(i); if (a === 'box') d.addBox(); if (a === 'rm') d.removePart(i); if (a === 'undo') { if (!d.undo()) toast('되돌릴 게 없어요'); } if (a === 'redo') { if (!d.redo()) toast('다시 할 게 없어요'); }
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
    if (a === 'sync') { b.disabled = true; $('#libMsg').textContent = '계정에서 받는 중…'; try { const r = await lib2.syncNow(); $('#libMsg').textContent = `받음 ${r.down}${r.skip && r.skip.length ? ` · 이 기기에서 고친 ${r.skip.length}개는 건너뜀` : ''}`; await reloadIfChanged(r); } catch (e) { $('#libMsg').textContent = '동기화 실패: ' + (e.message || e); } b.disabled = false; listLib(); } }));
  listLib();
}
async function listLib() {
  const el = $('#libList'); if (!el) return; const list = await lib2.listLocal().catch(() => []);
  el.innerHTML = list.length ? list.map((p) => `<div class="prow ${p.id === S.model.id ? 'on' : ''}"><button data-open="${p.id}"><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleString('ko-KR')} · ${(p.size / 1024).toFixed(0)}KB${p.other ? ' · 다른 계정 작업 (이 계정에 안 올림)' : cloud.session() ? (p.dirty ? ' · 올릴 예정' : ' · 동기화됨') : ''}</small></button><button class="ib" data-dup="${p.id}" title="복제" aria-label="복제"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/></svg></button><button class="ib" data-rm="${p.id}" title="지우기" aria-label="지우기"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div>`).join('') : '<p class="hint">저장된 프로젝트가 없어요</p>';
  $$('[data-open]', el).forEach((b) => (b.onclick = async () => { const m = await lib2.loadLocal(b.dataset.open); if (m) { if (!(await leaveOk(m.id))) return; await setModel(m); toast(`"${m.name}" 을 열었어요`); } }));
  $$('[data-dup]', el).forEach((b) => (b.onclick = async () => { const m = await lib2.loadLocal(b.dataset.dup); if (!m) return; m.id = uid('p'); m.name += ' (사본)'; await lib2.saveLocal(m); listLib(); }));
  $$('[data-rm]', el).forEach((b) => { let armed = false; b.onclick = async () => { if (!armed) { armed = true; b.classList.add('danger'); b.title = '한 번 더 누르면 지워요'; toast('한 번 더 누르면 지워요'); setTimeout(() => { armed = false; b.classList.remove('danger'); }, 3000); return; } const id = b.dataset.rm; await lib2.removeEverywhere(id).catch(() => {}); if (id === S.model.id) { S.dirty = false; await setModel(emptyProject()); } listLib(); }; });
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
    <div class="btns"><button class="btn" data-a="alignH">이 벽을 수평으로 (도면 전체 돌리기)</button><button class="btn" data-a="orient">작업 방향…</button><button class="btn danger" data-a="del">삭제</button></div>`;
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
    if (a === 'alignH') { alignWallH(w); return renderProps(); } if (a === 'orient') return ACT.orient();
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
  S.panel = 'design'; S.propsOpen = true; d.start({ id: 'wall', name: '벽', w: L, d: w.t, h: H }, [part], g); d.weld = false; renderProps();
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
    <div class="sec">천 가림막</div>
    <label class="tog">가림막 달기${/slide/.test(o.type) ? ' (미닫이는 보통 안 달아요)' : ''}<input type="checkbox" data-cu="on" ${o.curtain && o.curtain.on !== false ? 'checked' : ''}></label>
    ${o.curtain && o.curtain.on !== false ? `<div class="row"><label class="fld">색<input type="color" data-cu="color" value="${o.curtain.color || '#c4161c'}"></label>${num('길이 (mm)', 'cuLen', o.curtain.len || 600, 50)}${num('천 장수', 'cuN', o.curtain.panels || Math.max(2, Math.round(o.w / 450)), 1)}</div>` : ''}
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
  $$('[data-cu]', body).forEach((i) => { if (i.dataset.cu === 'on') i.onchange = () => { o.curtain = i.checked ? { ...(o.curtain || {}), on: true, color: (o.curtain && o.curtain.color) || '#c4161c', len: (o.curtain && o.curtain.len) || (/pass/.test(o.type) ? 450 : 900) } : { ...(o.curtain || {}), on: false }; od(); renderProps(); }; else { i.oninput = () => { o.curtain.color = i.value; liveStructure(); }; i.onchange = od; } });
  for (const [k, f] of [['cuLen', 'len'], ['cuN', 'panels']]) { const i = $(`[data-k=${k}]`, body); if (i) i.onchange = (e) => { e.stopImmediatePropagation(); o.curtain[f] = Math.max(f === 'len' ? 100 : 1, Math.round(+i.value || 0)); od(); }; }
  $$('[data-od]', body).forEach((i) => { i.oninput = () => { o[i.dataset.od] = i.value; liveStructure(); }; i.onchange = od; });
  $$('[data-on]', body).forEach((i) => (i.onchange = () => { const v = Math.max(0, Math.round(+i.value || 0)), k = i.dataset.on; o[k] = k === 'div' ? clamp(v || 1, 1, 12) : k === 'fw' ? clamp(v, 10, 200) : v; od(); }));
  $$('[data-os]', body).forEach((i) => (i.onchange = () => { o[i.dataset.os] = i.value; od(); }));
  $$('[data-ot]', body).forEach((i) => (i.onchange = () => { o[i.dataset.ot] = i.checked; od(); }));
  $$('[data-k]:not([data-k=cuLen]):not([data-k=cuN])', body).forEach((i) => (i.onchange = () => {
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
    ${pv === 'claude' ? `<label class="fld">워크스페이스 ID <small class="hint">(개인 키 sk-ant-usr- 일 때 · 콘솔 → 설정 → 워크스페이스의 wrkspc_…)</small><input type="text" id="kWs" value="${esc(cloud.aiWorkspace())}" placeholder="wrkspc_…" spellcheck="false" autocomplete="off"></label>` : ''}
    <div class="btns"><button class="btn" id="kSave">이 기기에 저장</button>${s && pv === 'claude' ? '<button class="btn" id="kAcct">계정에서 받기</button><button class="btn" id="kPut">계정에 저장</button>' : ''}<button class="btn" id="kTest">키 시험</button>${key ? '<button class="btn danger" id="kDel">지우기</button>' : ''}</div><div class="kres" id="kRes" hidden></div>${key ? `<p class="hint">지금 키: ${esc(key.slice(0, 7))}…${esc(key.slice(-4))}${store.get('byr.aiKeyAcct') ? ' (계정에서 받은 키)' : ' (이 기기)'}${cloud.keyProblem(key, pv) ? ' · ⚠ ' + esc(cloud.keyProblem(key, pv)) : ''}</p>` : ''}
    <div class="sec">도면 → 벽 · 문/창</div>
    <p class="hint"><b>지금 열린 프로젝트(이 층)</b>에 도면의 벽 · 문 · 창을 그려 넣는 기능이에요. 고른 뒤 AI 가 읽으면 2D 에 <b>주황 점선 미리보기</b>가 나오고, 위에 뜨는 <b>적용</b>을 눌러야 실제로 들어가요.<br>· 지우고 바꾸기: 지금 벽을 모두 지우고 도면대로 다시 그림 · 그대로 두고 더하기: 지금 벽에 덧붙임<br>· 새 매장으로 만들려면: 홈 → <b>자료로 매장 만들기</b> (도면 · 렌더 · 전열도를 한꺼번에)</p>
    <div class="row"><label class="fld">도면 가로 실제 길이 mm (선택)<input type="number" id="pW" inputmode="numeric" placeholder="예: 12000"></label>
    <label class="fld">기존 벽<select id="pMode"><option value="replace">지우고 바꾸기</option><option value="add">그대로 두고 더하기</option></select></label></div>
    <div class="btns"><button class="btn" id="pGo" ${key ? '' : 'disabled'}>도면 파일 고르기</button></div>
    <div class="sec">현장 사진 → 기물</div>
    <p class="hint">${w ? `고른 벽(${Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)).toLocaleString()}mm)을 방 안에서 정면으로 찍은 사진을 고르세요. 보이는 기물 · 문/창을 그 벽 앞에 놓아요.` : '2D 도면에서 사진에 찍힌 벽을 먼저 톡 눌러 고른 뒤, 다시 이 메뉴를 여세요.'}</p>
    <div class="btns"><button class="btn" id="phGo" ${key && w ? '' : 'disabled'}>벽 사진 고르기</button></div>
    <div class="ailive" id="aiLive" hidden></div><pre class="ailog" id="aiLog"></pre><p class="hint" id="aiMsg"></p>`;
  // AI 결과 미리보기: 바로 넣지 않고 확인한 뒤 적용
  const P = S.aiPrev;
  if (P) {
    const nm = (t) => (S.lib[t] && S.lib[t].name) || ({ door1: '외문', door2: '양문', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', auto: '자동문', slide: '미닫이', arch: '아치' }[t]) || t;
    body.insertAdjacentHTML('afterbegin', P.kind === 'plan'
      ? `<div class="sec">AI 결과 미리보기</div><p class="hint">벽 ${P.r.walls.length}개 · 문/창 ${P.r.openings.length}개 · 도면 가로 ${P.r.widthMm.toLocaleString()}mm 기준 · 2D 의 주황 점선이 AI 가 읽은 벽이에요. 기존 벽은 ${P.mode === 'replace' ? '지우고 바꿔요' : '그대로 두고 더해요'}.</p><div class="btns"><button class="btn" data-ap="no">버리기</button><button class="btn pri" data-ap="ok">적용</button></div><hr>`
      : `<div class="sec">AI 결과 미리보기 · 넣을 것만 고르세요</div><div class="plist">${P.objs.map((o, k) => `<label class="tog">${esc(nm(o.type))} <small class="hint">${Math.round(((+o.x0 + +o.x1) / 2) * 100)}% 위치${o.on_wall ? ' · 벽에 붙음' : o.dist ? ` · 벽에서 ${Math.round(o.dist)}mm` : ''}</small><input type="checkbox" data-po="${k}" ${o.on ? 'checked' : ''}></label>`).join('') || '<p class="hint">찾은 것이 없어요</p>'}</div><div class="btns"><button class="btn" data-ap="no">버리기</button><button class="btn pri" data-ap="ok" ${P.objs.length ? '' : 'disabled'}>적용</button></div><hr>`);
    $$('[data-po]', body).forEach((c) => (c.onchange = () => (P.objs[+c.dataset.po].on = c.checked)));
    $$('[data-ap]', body).forEach((b) => (b.onclick = () => {
      if (b.dataset.ap === 'ok' && (P.pid !== S.model.id || P.lv !== S.model.activeLevel)) { toast('다른 프로젝트 · 층이라 넣지 않았어요'); S.aiPrev = null; plan.preview = null; plan.redraw(); return renderProps(); }
      if (b.dataset.ap === 'ok') { if (P.kind === 'plan') { applyPlan(P.r, P.mode); toast(`벽 ${P.r.walls.length}개 · 문/창 ${P.r.openings.length}개를 그렸어요 · 되돌리기로 취소할 수 있어요`); } else { const w = level().walls.find((q) => q.id === P.wall); const n = w ? placeDetected(w, P.objs.filter((o) => o.on)) : 0; toast(`${n}개를 넣었어요 · 위치는 끌어서 다듬으세요`); } }
      S.aiPrev = null; plan.preview = null; plan.redraw(); renderProps();
    }));
  }
  const msg = (t) => ($('#aiMsg').textContent = t);
  function kRes(t, kind) { const el = $('#kRes'); if (!el) return; el.hidden = false; el.textContent = t; el.className = 'kres ' + (kind || ''); }
  const aLog = (t) => { const el = $('#aiLog'); if (el) { el.textContent += (el.textContent ? '\n' : '') + t; el.scrollTop = 1e9; } };
  const watch = () => { const el = $('#aiLog'); if (el) el.textContent = ''; msg(''); return aiWatch(aLog, $('#aiLive')); };
  $$('[data-pv]', body).forEach((b) => (b.onclick = () => { cloud.setAiProvider(b.dataset.pv); renderProps(); }));
  $('#kModel').onchange = (e) => { cloud.setAiModel(pv, e.target.value === PV.model ? '' : e.target.value); toast('모델을 바꿨어요'); };
  $('#kSave').onclick = () => { const v = $('#kIn').value.replace(/\s+/g, ''); if (!v) return kRes('⛔ 위 칸에 키를 붙여 넣은 뒤 눌러 주세요', 'bad'); cloud.setAiKey(v); renderProps(); kRes(`✅ 저장했어요 · ${v.slice(0, 9)}…${v.slice(-4)} · 이제 "키 시험"을 눌러 확인해 보세요`, 'ok'); toast(`${PV.name} 키를 저장했어요 (…${v.slice(-4)})`); };
  if ($('#kDel')) $('#kDel').onclick = () => { cloud.setAiKey(''); renderProps(); };
  /* 키 시험: 칸에 새 키가 있으면 그 키로 (되면 저장), 없으면 저장된 키로. 결과는 버튼 바로 아래 + 알림 */
  if ($('#kWs')) $('#kWs').onchange = (e) => { cloud.setAiWorkspace(e.target.value.replace(/\s+/g, '')); kRes(e.target.value ? '✅ 워크스페이스 ID 저장 · "키 시험"으로 확인해 보세요' : '워크스페이스 ID 를 지웠어요', 'ok'); };
  $('#kTest').onclick = async (e) => { if ($('#kWs')) cloud.setAiWorkspace($('#kWs').value.replace(/\s+/g, '')); const b = e.target, typed = $('#kIn').value.replace(/\s+/g, ''), old = cloud.aiKey(pv); if (!typed && !old) return kRes('⛔ 저장된 키가 없어요 · 위 칸에 키를 붙여 넣어 주세요', 'bad');
    b.disabled = true; kRes(`⏳ ${typed ? '새로 넣은' : '저장된'} 키(…${(typed || old).slice(-4)})로 시험하는 중…`, '');
    if (typed) cloud.setAiKey(typed, pv);
    try { const r = await cloud.testKey(pv); kRes('✅ ' + r + (typed ? ' · 이 키를 저장했어요' : ''), 'ok'); toast('✅ 키 정상'); if (typed) setTimeout(renderProps, 1500); }
    catch (er) { if (typed) cloud.setAiKey(old, pv); kRes(`⛔ ${er.message}${er.detail ? '\n→ ' + er.detail : ''}${typed ? '\n(새 키가 안 돼서 저장하지 않았어요)' : ''}`, 'bad'); toast('⛔ 키 시험 실패 · ' + (er.code || ''), 5000); }
    b.disabled = false; };
  if ($('#kAcct')) $('#kAcct').onclick = async () => { try { msg((await cloud.loadAccountKey()) ? '계정의 키를 받았어요' : '계정에 저장된 키가 없어요'); renderProps(); } catch (e) { msg(e.message || e); } };
  if ($('#kPut')) $('#kPut').onclick = async () => { try { await cloud.saveAccountKey(cloud.aiKey('claude')); msg('계정에 저장했어요 · 다른 기기에서 로그인하면 자동으로 써요'); } catch (e) { msg(e.message || e); } };
  $('#pGo').onclick = async () => {
    const f = (await openFiles({ title: '도면 (이미지 · PDF)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }))[0]; if (!f) return;
    msg(`${PV.name} 가 도면을 읽는 중… (30초~1분)`); $('#pGo').disabled = true;
    const ctx = { pid: S.model.id, lv: S.model.activeLevel, w: +($('#pW') || {}).value || 0, mode: ($('#pMode') || {}).value || 'add' }; /* 요청할 때의 프로젝트 · 층 · 설정을 기억 */
    const stopW = watch(); try { const r = await cloud.readPlan(await cloud.prepFile(f.name, f.data), ctx.w); if (S.model.id !== ctx.pid || S.model.activeLevel !== ctx.lv) return toast('AI 가 읽는 동안 프로젝트나 층이 바뀌어서 결과를 넣지 않았어요', 6000); S.aiPrev = { kind: 'plan', r, mode: ctx.mode, pid: ctx.pid, lv: ctx.lv }; plan.preview = r; if (S.pane === '3d') setPane('split'); plan.redraw(); renderProps(); toast('2D 에 주황 점선으로 미리 보여요 · 확인하고 "적용"을 누르세요', 6000); }
    catch (e) { console.error(e); msg('읽지 못했어요 · 위 기록의 ⛔ 줄과 → 안내를 보세요'); toast('⛔ ' + (e.code || '') + ' 도면을 읽지 못했어요', 5000); }
    finally { stopW(); } $('#pGo') && ($('#pGo').disabled = false);
  };
  $('#phGo').onclick = async () => {
    const f = (await openFiles({ title: '현장 사진', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f || !selWall()) return;
    msg(`${PV.name} 가 사진을 보는 중…`); $('#phGo').disabled = true;
    const ctx = { pid: S.model.id, lv: S.model.activeLevel };
    const stopW = watch(); try { const wall = selWall(), objs = await cloud.readPhoto(await cloud.prepFile(f.name, f.data), Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), S.lib); if (S.model.id !== ctx.pid || S.model.activeLevel !== ctx.lv) return toast('AI 가 읽는 동안 프로젝트나 층이 바뀌어서 결과를 넣지 않았어요', 6000); S.aiPrev = { ...ctx, kind: 'photo', wall: wall.id, objs: objs.map((o) => ({ ...o, on: true })) }; renderProps(); }
    catch (e) { console.error(e); msg('읽지 못했어요 · 위 기록의 ⛔ 줄과 → 안내를 보세요'); toast('⛔ ' + (e.code || '') + ' 사진을 읽지 못했어요', 5000); }
    finally { stopW(); } $('#phGo') && ($('#phGo').disabled = false);
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
const CAT_ORDER = ['내 기물', '페리카나', '놀이방', '테라스 · 외부', '주방', '테이블', '의자', '가구', '가전', '욕실', '조명', '천장 설비', '벽 설비', '전기', '바닥·배관', '설비', '공장', '인테리어', '식물', '주거', '배경'];
function renderCatalog(q = '') {
  const by = new Map(); q = q.trim().toLowerCase();
  for (const [id, L] of Object.entries(S.lib)) { if (['zone', 'mesh', 'decal', 'mark'].includes(L.shape)) continue; if (q && !(L.name + ' ' + (L.sub || '') + ' ' + L.cat).toLowerCase().includes(q)) continue; if (!by.has(L.cat)) by.set(L.cat, []); by.get(L.cat).push([id, L]); }
  const cats = [...by.keys()].sort((a, b) => (CAT_ORDER.indexOf(a) + 99) % 99 - (CAT_ORDER.indexOf(b) + 99) % 99);
  $('#catalog').innerHTML = cats.length ? cats.map((c, i) => `<div class="acc ${q || i === 0 ? 'open' : ''}"><button aria-expanded="${!!q || i === 0}">${esc(c)} <small>${by.get(c).length}</small></button><div class="list">${by.get(c).map(([id, L]) => `<button class="item" data-add="${esc(id)}" draggable="true"><b>${esc(L.name)}</b><small><i style="background:${esc(L.color)}"></i>${L.w}×${L.d}×${L.h}</small></button>`).join('')}</div></div>`).join('') : '<p class="hint" style="padding:12px">찾는 기물이 없어요</p>';
}
function openDrawer() { $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').hidden = false; $('#btnDrawer')?.setAttribute('aria-expanded', 'true'); }
function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').hidden = true; $('#btnDrawer')?.setAttribute('aria-expanded', 'false'); }
function setMode(m) { if (engine.design.active) endDesign(true); engine.mode = m; $$('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m))); syncModeChip(); }
/** 지금 무엇을 하는 중인지 (작업대 · 도구) 늘 보여 주는 작은 표시 */
const TOOLN = { wall: '벽 그리기', door1: '문 놓기', window: '창 놓기', pass: '배식구 놓기', roomRect: '공간 사각형', roomPoly: '공간 점 찍기', measure: '줄자', soffitRect: '천장 가벽', line: '선 그리기', pick: '누를 곳 고르기', erase: '지우기', boxsel: '여러 개 고르기', sketch: '낙서' };
function syncModeChip() { const c = $('#modeChip'); if (!c || !engine) return; const t = plan && plan.tool !== 'select' ? TOOLN[plan.tool] || plan.tool : null, m = { select: '선택', move: '이동', orbit: '둘러보기' }[engine.mode] || '';
  c.textContent = S.patrol ? '유동인구 길 그리기 · Esc 취소' : S.cutRoom ? '공간 자르기 · 선 긋기' : t ? `${t} · Esc 로 끝` : `${m} 중${(S.multi || []).length ? ` · ${S.multi.length}개 고름` : ''}`; c.classList.toggle('busy', !!t); }
function syncDockState() { setMode(engine.mode); syncCeilBtn(); if (typeof syncSimBtn === 'function') syncSimBtn(); }

/* ---------- 시작 ---------- */
/* ---------- 도구 막대: 한 줄 = 버튼 하나 (2차 · 3차 도구는 soon 을 지우고 run 만 붙이면 된다) ---------- */
const SV = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const DOCK = [
  { id: 'btnDrawer', g: 'edit', label: '기물', icon: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 13.5v6M13.5 16.5h6"/>', attrs: 'aria-expanded="false"' },
  '|',
  { mode: 'select', g: 'edit', label: '선택', icon: '<path d="M6 3l13 8-6 1.8L10.5 19z"/>' },
  { mode: 'move', g: 'edit', label: '이동', icon: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>' },
  { mode: 'orbit', g: 'edit', label: '둘러보기', icon: '<circle cx="12" cy="12" r="3"/><path d="M2.5 12c2.4-4.4 5.6-6.6 9.5-6.6s7.1 2.2 9.5 6.6c-2.4 4.4-5.6 6.6-9.5 6.6S4.9 16.4 2.5 12z"/>' },
  '|',
  { act: 'levels', g: 'plan', label: '층', icon: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>' },
  { run: () => setPlanTool('measure'), g: 'plan', label: '줄자', icon: '<path d="M3 15l12-12 6 6-12 12z"/><path d="M7 11l2 2M10 8l2 2M13 5l2 2"/>' },
  { act: 'rooms', g: 'plan', label: '공간', icon: '<path d="M4 4h16v16H4z" stroke-dasharray="3 2.5"/><path d="M9 12h6"/>' },
  { run: () => slopeTool(), g: 'plan', label: '구배', icon: '<path d="M3 17L21 9M3 17h18"/><path d="M15 7l3 2.6-3.6 1.1"/>' },
  { act: 'orient', g: 'plan', label: '작업 방향', icon: '<path d="M12 3v4M12 3l-2.5 2.5M12 3l2.5 2.5"/><path d="M5 12a7 7 0 1 0 7-7"/><path d="M3 9l2 3 3-2"/>' },
  { act: 'bg', g: 'plan', label: '배경', icon: '<path d="M3 20h18M5 20V10h4v10M11 20V5h5v15M18 20v-7h2"/>' },
  '|',
  { id: 'btnStyle', g: 'view', label: '스타일', icon: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>', attrs: 'aria-haspopup="menu" aria-expanded="false"' },
  { view: 'iso', g: 'view', label: '비스듬히', icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>' },
  { view: 'top', g: 'view', label: '위에서', icon: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 10h7v10M11 14h9"/>' },
  '|',
  { act: 'ai', g: 'more', label: 'AI', icon: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>' },
  '|',
  { id: 'dkCeil', run: () => toggleCeiling(), g: 'plan', label: '천장', icon: '<path d="M3 6h18M6 6v3M12 6v3M18 6v3"/><circle cx="12" cy="13" r="2.5"/>' },
  { run: () => present.enter(), g: 'view', label: '발표', icon: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M10 8l4 2-4 2z"/>' },
  { run: () => recPop(), g: 'view', label: '녹화', icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>' },
  { run: () => { if (S.pane === '2d') setPane('split'); setTimeout(() => secView.toggle(), S.pane === '2d' ? 300 : 0); }, g: 'view', label: '단면 투시', on: () => secView && secView.on, icon: '<path d="M3 6h18v12H3z"/><path d="M12 6v12" stroke-dasharray="2 2"/><path d="M3 6l9 6 9-6M3 18l9-6 9 6"/>' },
  { run: () => startWalk(), g: 'view', label: '걷기', icon: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6-2.5-2.5L11 8l3 2 3 1M12 15l3 6M9.5 12.5L7 14"/>' },
  { id: 'dkXr', act: 'xray', g: 'view', label: '설치물', icon: '<path d="M3 18h18M5 18v-4h14v4"/><path d="M8 14V9h8v5" stroke-dasharray="2 2"/>' },
  { id: 'dkAir', run: () => toggleAir(), g: 'check', label: '공기', icon: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>' },
  { act: 'view', g: 'view', label: '단면 · 시점', icon: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 12h16" stroke-dasharray="2.5 2"/>' },
  { act: 'cmt', g: 'check', label: '댓글', icon: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>' },
  { act: 'check', g: 'check', label: '점검', icon: '<path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="3.5" width="16" height="17" rx="2"/>' },
  { act: 'quote', g: 'check', label: '견적', icon: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>' },
  { act: 'kids', g: 'plan', label: '키즈룸', icon: '<path d="M3 20V8h7v12M3 14h7"/><path d="M10 8l9 10h2"/><circle cx="16" cy="6" r="2"/>' },
  { act: 'auto', g: 'plan', label: '자동 배치', icon: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 10h17M10 10v10.5"/><path d="M14 14h3v3h-3z"/>' },
  { id: 'dkSim', act: 'sim', g: 'check', label: '동선', icon: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" stroke-dasharray="2.5 2"/>' },
];
/* 작업군 5개 (선택 중심): 아래 줄 = 작업군 탭, 위 줄 = 그 작업군 도구. 고른 작업군은 기억 */
const DGROUPS = [['edit', '편집', '<path d="M6 3l13 8-6 1.8L10.5 19z"/>'], ['plan', '설계', '<path d="M4 4h16v16H4z"/><path d="M4 10h9v10"/>'], ['view', '보기', '<path d="M2.5 12c2.4-4.4 5.6-6.6 9.5-6.6s7.1 2.2 9.5 6.6c-2.4 4.4-5.6 6.6-9.5 6.6S4.9 16.4 2.5 12z"/><circle cx="12" cy="12" r="3"/>'], ['check', '검토', '<path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="3.5" width="16" height="17" rx="2"/>'], ['more', '더보기', '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>']];
const MORE = [{ g: 'more', act: 'uiset', label: '화면 설정', icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>' }, { g: 'more', run: () => checkUpdate(true), label: '업데이트 확인', icon: '<path d="M12 4v10M8 10l4 4 4-4M5 18h14"/>' }, { g: 'more', run: () => showKeys(), label: '단축키', icon: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M9 10h1M12 10h1M15 10h1M18 10h0M7 14h10"/>' }, { g: 'more', act: 'hist', label: '작업 기록', icon: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3"/><path d="M12 8v4l3 2"/>' }, { g: 'more', act: 'lang', label: 'English', icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>' }, { g: 'more', run: () => $('#btnFile').click(), label: '파일', icon: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>' }];
let dockG = store.get('byr.dockG', 'edit');
function buildDock() {
  const ALL = [...DOCK.filter((d) => d !== '|'), ...MORE], list = dockList(dockG);
  $('#dockTabs').innerHTML = DGROUPS.map(([k, n, ic]) => `<button class="dg" data-dg="${k}" aria-pressed="${k === dockG}"><svg viewBox="0 0 24 24">${ic}</svg><span>${n}</span></button>`).join('');
  $$('[data-dg]', $('#dockTabs')).forEach((b) => (b.onclick = () => { dockG = b.dataset.dg; store.set('byr.dockG', dockG); buildDock(); syncDockState(); }));
  const DOCK0 = DOCK; /* 같은 그리기 코드를 쓰려고 */
  $('#dockIn').innerHTML = list.map((d) => d === '|' ? '<span class="dsep" aria-hidden="true"></span>'
    : `<button class="dk${d.soon ? ' soon' : ''}" ${d.id ? `id="${d.id}"` : ''} ${d.mode ? `data-mode="${d.mode}" aria-pressed="false"` : ''} ${d.view ? `data-view="${d.view}"` : ''} ${d.act ? `data-dact="${d.act}"` : ''} ${d.on ? `aria-pressed="${!!d.on()}"` : ''} ${d.attrs || ''} title="${d.label}${d.soon ? ` (${d.soon} 업데이트)` : ''}" aria-label="${d.label}">${SV(d.icon)}<span>${d.label}</span></button>`).join('');
  [...$('#dockIn').children].filter((e) => e.tagName === 'BUTTON').forEach((b, i) => { const d = list[i]; void DOCK0;
    if (d.soon) b.onclick = () => toast(`"${d.label}" 은 ${d.soon} 업데이트에서 들어와요`);
    else if (d.act) b.onclick = () => { closeHome(); ACT[d.act](); };
    else if (d.mode) b.onclick = () => setMode(d.mode); /* 작업군을 바꾸면 단추를 새로 그리므로 여기서 묶는다 */
    else if (d.view) b.onclick = () => { closeHome(); if (S.pane === '2d') setPane('split'); engine.view(d.view); };
    else if (d.run) b.onclick = () => { closeHome(); d.run(); }; });
  regrip();
}
/* ---------- 화면 설정: 가로 모드 손잡이 서랍 · 상단 바 · 도구 고르기/순서 ----------
 * 도구 설정은 세로 / 가로 따로 기억 (byr.dock.port / byr.dock.land) = { hide: [키], order: { 작업군: [키] } } */
const dkKey = (d) => d.id || (d.mode && 'm:' + d.mode) || (d.view && 'v:' + d.view) || (d.act && 'a:' + d.act) || 'l:' + d.label;
const UIQ = matchMedia('(orientation: landscape) and (max-height: 600px)');
const isLandC = () => UIQ.matches;
const uiCfg = () => ({ land: 'handle', side: 'left', top: 'mini', ...store.get('byr.ui', {}) });
const dockCfgK = () => 'byr.dock.' + (isLandC() ? 'land' : 'port');
const dockCfg = () => ({ hide: [], order: {}, ...store.get(dockCfgK(), {}) });
function dockList(g, all = false) {
  const ALL = [...DOCK.filter((d) => d !== '|'), ...MORE].filter((d) => d.g === g), c = dockCfg(), ord = c.order[g] || [];
  const L = ALL.slice().sort((a, b) => { const ia = ord.indexOf(dkKey(a)), ib = ord.indexOf(dkKey(b)); return (ia < 0 ? 999 + ALL.indexOf(a) : ia) - (ib < 0 ? 999 + ALL.indexOf(b) : ib); });
  return all ? L : L.filter((d) => !c.hide.includes(dkKey(d)) || d.act === 'uiset'); /* 화면 설정은 숨길 수 없게 */
}
function applyUi() {
  const c = uiCfg(), land = isLandC(), h = land && c.land === 'handle', b = document.body;
  b.classList.toggle('uih', h); b.classList.toggle('uih-left', h && c.side === 'left'); b.classList.toggle('uih-bottom', h && c.side === 'bottom');
  b.classList.toggle('topmini', land && c.top === 'mini'); if (!h) b.classList.remove('dock-open'); if (!(land && c.top === 'mini')) $('#topbar').classList.remove('open');
  let hd = $('#dockHandle'); if (!hd) { hd = document.createElement('button'); hd.id = 'dockHandle'; hd.setAttribute('aria-label', '도구 서랍 열기 · 닫기'); hd.innerHTML = '<span></span>'; $('#dock').appendChild(hd); hd.onclick = () => dockOpen(!b.classList.contains('dock-open')); }
  hd.hidden = !h; setTimeout(() => engine.resize(), 50);
}
function dockOpen(on) { document.body.classList.toggle('dock-open', on); $('#dockHandle') && $('#dockHandle').setAttribute('aria-expanded', String(on)); }
function bindUi() {
  (UIQ.addEventListener ? UIQ.addEventListener('change', () => { applyUi(); buildDock(); syncDockState(); }) : UIQ.addListener(() => { applyUi(); buildDock(); }));
  /* 손잡이 쪽 가장자리에서 안으로 쓸면 열고, 반대로 쓸면 닫는다 */
  let t0 = null; const st = $('#stage') || document.body;
  document.addEventListener('touchstart', (e) => { if (!document.body.classList.contains('uih')) return; const p = e.touches[0]; t0 = { x: p.clientX, y: p.clientY }; }, { passive: true });
  document.addEventListener('touchend', (e) => { if (!t0 || !document.body.classList.contains('uih')) return; const p = e.changedTouches[0], dx = p.clientX - t0.x, dy = p.clientY - t0.y, left = document.body.classList.contains('uih-left'), H = innerHeight;
    const open = document.body.classList.contains('dock-open');
    if (left && !open && t0.x < 24 && dx > 40 && Math.abs(dy) < 60) dockOpen(true);
    else if (!left && !open && t0.y > H - 24 && dy < -40 && Math.abs(dx) < 80) dockOpen(true);
    else if (open && e.target.closest && e.target.closest('#dock') && (left ? dx < -50 && Math.abs(dy) < 60 : dy > 50 && Math.abs(dx) < 80)) dockOpen(false);
    t0 = null; }, { passive: true });
  st.addEventListener('pointerdown', (e) => { if (document.body.classList.contains('dock-open') && !e.target.closest('#dock,#dockHandle')) dockOpen(false); if ($('#topbar').classList.contains('open') && !e.target.closest('#topbar,#fileMenu')) $('#topbar').classList.remove('open'); });
  $('#topbar .title').addEventListener('click', () => { if (document.body.classList.contains('topmini')) $('#topbar').classList.toggle('open'); });
  applyUi();
}
const DGN = () => Object.fromEntries(DGROUPS.map(([k, n]) => [k, n]));
/* ---------- 듀얼 모니터 설정 ---------- */
function dualHtml() {
  const c = DUAL.dualCfg(), on = DUAL.isOpen(), pc = !!(window.byr && window.byr.sideOpen);
  return `<h4 class="uih4">듀얼 모니터 <small>${pc ? '보조 모니터에 창을 하나 더' : '웹: 새 창(팝업)으로 열려요'} · 끄면 지금처럼 한 창만</small></h4>
    <div class="fld">보조 창<div class="seg2" role="group"><button data-dual="off" aria-pressed="${!on}">끔</button><button data-dual="on" aria-pressed="${on}">켬</button></div></div>
    <div class="fld">보조 창 위치<div class="seg2" role="group">${[['left', '왼쪽 모니터'], ['right', '오른쪽 모니터']].map(([v, n]) => `<button data-dw="${v}" aria-pressed="${c.where === v}">${n}</button>`).join('')}</div></div>
    <div class="fld">보조 창 보기<div class="chips">${DUAL.VIEWS.map(([v, n]) => `<button data-dv="${v}" aria-pressed="${c.view === v}">${n}</button>`).join('')}</div></div>
    <label class="fld">보조 창 스타일<select id="dualSt"><option value="same">메인과 같게</option>${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${c.style === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
    <p class="hint">보조 창은 이 프로젝트를 보기 전용으로 따라가요 (메인에서 고치면 바로 반영). 보조 창 오른쪽 위 <b>⌂ 홈</b> = 다른 프로젝트를 열어 대조하며 따로 수정 · <b>✕</b> = 보조 창만 닫기.</p>`;
}
function dualBind(body) {
  $$('[data-dual]', body).forEach((b) => (b.onclick = async () => { if (b.dataset.dual === 'on') await DUAL.openSide(); else DUAL.closeSide(); renderProps(); }));
  $$('[data-dw]', body).forEach((b) => (b.onclick = () => { DUAL.setCfg('where', b.dataset.dw); renderProps(); }));
  $$('[data-dv]', body).forEach((b) => (b.onclick = () => { DUAL.setCfg('view', b.dataset.dv); renderProps(); }));
  const st = $('#dualSt', body); if (st) { st.value = DUAL.dualCfg().style; st.onchange = () => DUAL.setCfg('style', st.value); }
}
function renderUiSet(body) {
  $('#propsTitle').textContent = '화면 설정'; const c = uiCfg(), dc = dockCfg(), land = isLandC();
  const seg = (k, opts) => `<div class="seg2" role="group">${opts.map(([v, n]) => `<button data-uk="${k}" data-uv="${v}" aria-pressed="${c[k] === v}">${n}</button>`).join('')}</div>`;
  body.innerHTML = `<p class="hint">휴대폰 · 태블릿을 <b>가로</b>로 눕혔을 때의 화면을 정해요. (지금: ${land ? '가로 화면' : '세로 · 큰 화면'})</p>
    <div class="fld">해상도 <small>움직일 땐 가볍게, 멈추면 또렷하게</small><div class="seg2" role="group">${Object.entries(RESV).map(([k, q]) => `<button data-res2="${k}" aria-pressed="${engine.res === k}">${q.name}</button>`).join('')}</div></div>
    <div class="fld">가로 모드 도구 막대${seg('land', [['handle', '손잡이 (서랍)'], ['fixed', '항상 보이기']])}</div>
    <div class="fld">손잡이 위치${seg('side', [['left', '왼쪽'], ['bottom', '아래']])}</div>
    <div class="fld">가로 모드 상단 바${seg('top', [['mini', '최소 (이름 누르면 열림)'], ['full', '전체']])}</div>
    <h4 class="uih4">도구 막대에 넣을 기능 <small>${land ? '가로' : '세로'} 화면용 · 화살표로 순서</small></h4>
    ${DGROUPS.map(([g, n]) => `<div class="uigrp"><b>${n}</b>${dockList(g, true).map((d, i, A) => { const k = dkKey(d), on = !dc.hide.includes(k), lock = d.act === 'uiset'; return `<div class="uirow"><label><input type="checkbox" data-dk="${esc(k)}" ${on ? 'checked' : ''} ${lock ? 'disabled' : ''}><svg viewBox="0 0 24 24">${d.icon}</svg>${esc(d.label)}</label><button class="ib sm" data-up="${esc(k)}" data-g="${g}" ${i ? '' : 'disabled'} aria-label="위로">↑</button><button class="ib sm" data-dn="${esc(k)}" data-g="${g}" ${i < A.length - 1 ? '' : 'disabled'} aria-label="아래로">↓</button></div>`; }).join('')}</div>`).join('')}
    <button class="btn" id="uiReset">기본값으로</button>
    <h4 class="uih4">툴바 위치 <small>툴바 끝의 ⋮⋮ 를 끌어 옮겨요 · Tab = 화면 비우기</small></h4><button class="btn" id="uiMvReset">툴바 원래 자리로</button>
    ${dualHtml()}`;
  const re = () => { buildDock(); syncDockState(); renderUiSet(body); };
  $$('[data-uk]', body).forEach((b) => (b.onclick = () => { store.set('byr.ui', { ...uiCfg(), [b.dataset.uk]: b.dataset.uv }); applyUi(); re(); }));
  $$('[data-res2]', body).forEach((b) => (b.onclick = () => { engine.setRes(b.dataset.res2); re(); }));
  $$('[data-dk]', body).forEach((b) => (b.onchange = () => { const x = dockCfg(), k = b.dataset.dk; x.hide = x.hide.filter((h) => h !== k); if (!b.checked) x.hide.push(k); store.set(dockCfgK(), x); re(); }));
  $$('[data-up],[data-dn]', body).forEach((b) => (b.onclick = () => { const g = b.dataset.g, k = b.dataset.up || b.dataset.dn, x = dockCfg(), L = dockList(g, true).map(dkKey), i = L.indexOf(k), j = i + (b.dataset.up ? -1 : 1); if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; x.order = { ...x.order, [g]: L }; store.set(dockCfgK(), x); re(); }));
  $('#uiMvReset', body).onclick = () => { resetUiMove(); toast('툴바를 원래 자리로 옮겼어요'); };
  dualBind(body);
  $('#uiReset', body).onclick = () => { try { localStorage.removeItem('byr.ui'); localStorage.removeItem(dockCfgK()); } catch {} applyUi(); re(); };
}
function stopWalk() { engine.walker.stop(); }
function setPlanTool(t) { if (engine.design.active && t !== 'select') { endDesign(true); renderProps(); } if (S.pane === '3d') setPane('split'); if (t !== 'select' && t !== 'boxsel') tuck(); plan.setTool(t); setTimeout(syncModeChip); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q.dataset.tool === t))); if (t === 'measure') toast('2D 에서 잴 두 점 사이를 끌어요 · 벽 끝 · 모서리에 붙어요 · 3D 에도 보여요', 5000); }
/* ---------- 프레젠테이션 모드 (고객 · 파트너 시연) ----------
 * 편집 막대를 숨기고 3D 만 크게. 위: 자유 보기 · 설치물 보기 · 조명 모드 / 아래: 스타일 필터 막대 (언제든 바꿈)
 * 나가면 재질 · 투명도 · 천장 · 조명 밝기 · 스타일 · 화면 나눔을 모두 들어오기 전으로. 모델은 바꾸지 않는다. */
const LGROUPS = [['sign', '간판 (불 들어오는)'], ['triple', '3구 매입등'], ['neon', '네온 · 무드등'], ['out', '외부등 (테라스)'], ['down', '매입 · 직부등'], ['pendant', '펜던트'], ['flat', 'LED 평판 · 라인등'], ['hood', '후드등'], ['pin', '핀 · 레일 조명'], ['etc', '스탠드 · 벽등 · 기타']];
const present = {
  on: false, mode: 'free', prev: null, op: 0.25, master: 0.2,
  enter() {
    if (this.on) return; if (engine.walker && engine.walker.active) engine.walker.stop(); /* 걷기 중이면 먼저 끝냄 (이름 오타로 안 끝나던 문제) */ if (engine.xray) setXray(null);
    this.prev = { pane: S.pane, style: engine.style, props: S.propsOpen }; this.on = true; S.propsOpen = false; $('#props') && ($('#props').hidden = true);
    document.body.classList.add('presenting'); setPane('3d'); this.build(); this.set('free'); toast('발표 모드 · Esc 로 나가요', 2500);
  },
  exit() {
    if (!this.on) return; this.on = false; engine.setSpin(false); if (engine.walker.active) engine.walker.stop(); engine.controls.enabled = true; engine.setPresent(null); this.box && this.box.remove(); this.box = null; document.body.classList.remove('presenting');
    const p = this.prev || {}; if (p.style && p.style !== engine.style) setStyle(p.style, true); else engine.setStyle(engine.style); setPane(p.pane || '3d'); engine.invalidate(true);
  },
  set(m) {
    if (m === 'light' && this.mode !== 'light') this.gv = { ...(this.gv || {}), sign: this.gv?.sign ?? 1, neon: this.gv?.neon ?? 1 };
    this.mode = m; engine.setPresent(m, { opacity: this.op, dim: this.master }); const b = this.box; if (!b) return;
    $$('[data-pm]', b).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.pm === m)));
    const side = $('.pr-side', b); side.hidden = m === 'free';
    if (m === 'mep') side.innerHTML = `<b>설치물 보기</b><p>벽 · 바닥 · 천장 속 배관 · 전선 · 후드 · 덕트 · 보강재를 진한 색으로, 마감과 가구는 반투명 회색으로 보여요. (조명 기구는 빼요)</p>
      <label>마감 투명도 <output>${Math.round(this.op * 100)}%</output><input type="range" id="prOp" min="0" max="100" value="${Math.round(this.op * 100)}"></label>`;
    if (m === 'light') { const L = engine.lightItems(), G = {}; for (const l of L) (G[l.group] ||= []).push(l); this.gv ||= {};
      const GS = LGROUPS.filter(([g]) => G[g]); if (!GS.some(([g]) => g === this.gsel)) this.gsel = GS[0] && GS[0][0];
      side.innerHTML = `<button class="pr-grab" aria-label="조명 판 크게 · 작게"><span></span></button><b>조명 · 디밍</b><p>천장을 열고 모든 조명을 20% 에서 시작해요. 오른쪽으로 밀면 밝아지고, 모두 0% 면 거의 깜깜해져요.</p>
      <label class="pr-master">전체 <output>${Math.round(this.master * 100)}%</output><input type="range" id="prMa" min="0" max="150" value="${Math.round(this.master * 100)}"></label>
      <div class="pr-dims">${L.length ? LGROUPS.filter(([g]) => G[g]).map(([g, n]) => { const v = Math.round((this.gv[g] ?? this.master) * 100); return `<details class="pr-g"><summary><label>${n} · ${G[g].length}개 <output>${v}%</output><input type="range" data-dg="${g}" min="0" max="150" value="${v}"></label></summary>${G[g].map((l) => `<label class="pr-i">${esc(l.name)} <output>${v}%</output><input type="range" data-dim="${l.id}" data-of="${g}" min="0" max="150" value="${v}"></label>`).join('')}</details>`; }).join('') : '<p>놓인 조명이 없어요 · 기물 → 조명에서 직부등 · 펜던트 · 평판등 · 핀조명을 놓아 보세요</p>'}</div>
      <div class="pr-chips">${GS.map(([g, n]) => `<button data-gc="${g}" aria-pressed="${g === this.gsel}">${n.split(' ')[0]} <i>${Math.round((this.gv[g] ?? this.master) * 100)}%</i></button>`).join('')}</div>
      ${this.gsel ? `<label class="pr-one">${(GS.find(([g]) => g === this.gsel) || [, ''])[1]} <output>${Math.round((this.gv[this.gsel] ?? this.master) * 100)}%</output><input type="range" id="prOne" min="0" max="150" value="${Math.round((this.gv[this.gsel] ?? this.master) * 100)}"></label>` : ''}`;
      side.classList.toggle('full', !!this.full); }
    const op = $('#prOp', b); if (op) op.oninput = (e) => { this.op = +e.target.value / 100; e.target.previousElementSibling.textContent = e.target.value + '%'; engine.setPresentOpacity(this.op); engine.invalidate(false); };
    const setIn = (sel, v) => $$(sel, b).forEach((d) => { d.value = Math.round(v * 100); d.previousElementSibling.textContent = Math.round(v * 100) + '%'; if (d.dataset.dim) engine.setDim(d.dataset.dim, v, true); });
    const done = () => { engine.setDim('__none__', 0); engine._limitLights(); engine._darkness(); engine.invalidate(true); };
    const ma = $('#prMa', b); if (ma) ma.oninput = (e) => { this.master = +e.target.value / 100; e.target.previousElementSibling.textContent = e.target.value + '%'; this.gv = {}; setIn('[data-dg]', this.master); setIn('[data-dim]', this.master); done(); };
    $$('[data-dg]', b).forEach((d) => { d.onclick = (e) => e.stopPropagation(); d.oninput = (e) => { const g = d.dataset.dg, v = +e.target.value / 100; this.gv[g] = v; e.target.previousElementSibling.textContent = e.target.value + '%'; setIn(`[data-of="${g}"]`, v); done(); }; });
    const gr = $('.pr-grab', b); if (gr) gr.onclick = () => { this.full = !this.full; side.classList.toggle('full', this.full); };
    $$('[data-gc]', b).forEach((c) => (c.onclick = () => { this.gsel = c.dataset.gc; this.set(this.mode); }));
    const one = $('#prOne', b); if (one) one.oninput = (e) => { const t = $(`[data-dg="${this.gsel}"]`, b); e.target.previousElementSibling.textContent = e.target.value + '%'; const ch = $(`[data-gc="${this.gsel}"] i`, b); if (ch) ch.textContent = e.target.value + '%'; if (t) { t.value = e.target.value; t.dispatchEvent(new Event('input')); } };
    $$('[data-dim]', b).forEach((d) => (d.oninput = (e) => { e.target.previousElementSibling.textContent = e.target.value + '%'; engine.setDim(d.dataset.dim, +e.target.value / 100); engine.invalidate(true); }));
    engine.invalidate(true);
  },
  build() {
    const b = (this.box = document.createElement('div')); b.className = 'pr-ui';
    b.innerHTML = `<div class="pr-top"><div class="pr-modes" role="group" aria-label="보기 모드"><button data-pm="free">자유 보기</button><button data-pm="mep">설치물 보기</button><button data-pm="light">조명 모드</button></div>
      <div class="pr-views"><button data-pv="iso" title="비스듬히">◇</button><button data-pv="top" title="위에서">□</button><button data-pv="spin" title="360° 돌려 보기">⟳ 360°</button><button data-pv="rec" title="녹화 (MP4)" class="pr-recb">● 녹화</button><button data-pv="blender" title="블렌더로 실사 렌더 (정지샷)">🎬 블렌더 실사</button></div><button class="pr-x" title="발표 끝내기 (Esc)">✕ 끝내기</button></div>
      <div class="pr-side" hidden></div>
      <div class="pr-styles" role="group" aria-label="스타일 필터">${Object.entries(STYLES).map(([k, st]) => `<button data-ps="${k}" title="${esc(st.hint)}" aria-pressed="${engine.style === k}">${esc(st.name)}</button>`).join('')}</div>`;
    document.body.appendChild(b);
    $$('[data-pm]', b).forEach((x) => (x.onclick = () => this.set(x.dataset.pm)));
    $$('[data-pv]', b).forEach((x) => (x.onclick = () => { if (x.dataset.pv === 'rec') return recPop(); if (x.dataset.pv === 'blender') return blPop(); if (x.dataset.pv === 'spin') { engine.setSpin(!engine.controls.autoRotate); x.setAttribute('aria-pressed', String(engine.controls.autoRotate)); } else engine.view(x.dataset.pv); }));
    $$('[data-ps]', b).forEach((x) => (x.onclick = () => { engine.setStyle(x.dataset.ps); $$('[data-ps]', b).forEach((y) => y.setAttribute('aria-pressed', String(y === x))); this.set(this.mode); })); /* 발표 중 스타일은 프로젝트에 저장하지 않음 */
    $('.pr-x', b).onclick = () => this.exit();
  },
};
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
/** 글자 한 줄 받기 (이름 수정 등) */
function askText(title, value = '') {
  const p = ask(title, '', [{ label: '취소', value: false }, { label: '확인', value: true, kind: 'pri' }]);
  const m = $('#dlgM'); m.innerHTML = `<input id="dlgIn" type="text" value="${esc(value)}" style="width:100%;font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--line, #ccc)">`; const i = $('#dlgIn'); setTimeout(() => { i.focus(); i.select(); }, 40);
  i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#dlgB').lastElementChild.click(); } };
  return p.then((ok) => (ok ? (i.value || '').trim().slice(0, 60) : null));
}
/* 로딩 화면 걷기 — 켤 때 묻는 창(저장 안 한 변경 등)이 로딩 화면 뒤에 숨어 멈춘 것처럼 보이던 문제 (2.1.36) */
function dropIntro(fast) { const it = document.querySelector('#intro'); if (!it || it.dataset.out) return; it.dataset.out = 1; if (fast) { it.remove(); return; } it.classList.add('out'); setTimeout(() => it.remove(), 600); }
function ask(title, msg, buttons = [{ label: '취소', value: false }, { label: '확인', value: true, kind: 'pri' }]) {
  dropIntro(true);
  return new Promise((ok) => {
    const d = $('#dlg'); $('#dlgT').textContent = title; $('#dlgM').textContent = msg || '';
    $('#dlgB').innerHTML = buttons.map((b, i) => `<button class="btn ${b.kind || ''}" data-i="${i}">${esc(b.label)}</button>`).join('');
    const done = (v) => { d.hidden = true; d.onclick = null; S.dlgClose = null; ok(v); };
    S.dlgClose = () => done(buttons[0].value);
    d.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) done(buttons[+b.dataset.i].value); else if (e.target === d) done(buttons[0].value); };
    d.hidden = false; setTimeout(() => { const last = $('#dlgB').lastElementChild; if (last) last.focus(); }, 30);
  });
}
/** 새 프로젝트 크기: 가로 · 세로를 직접 입력 (m · 소수 가능) + 자주 쓰는 크기 빠른 고르기 → [mm, mm] | false */
function askSize() {
  let last = [8, 6]; try { last = JSON.parse(localStorage.getItem('byr.newSize')) || last; } catch {}
  const p = ask('새 매장 크기', '', [{ label: '취소', value: false }, { label: '만들기', value: 'ok', kind: 'pri' }]);
  $('#dlgM').innerHTML = `<p class="hint" style="margin:0 0 8px">바깥 벽 안쪽 기준이에요. 만든 뒤에도 벽 끝점을 끌어 바꿀 수 있어요.</p>
    <div class="row" style="gap:8px;align-items:end"><label class="fld" style="flex:1">가로 (m)<input id="nsW" type="number" inputmode="decimal" min="1" max="200" step="0.1" value="${last[0]}"></label><span style="padding-bottom:10px">×</span><label class="fld" style="flex:1">세로 (m)<input id="nsD" type="number" inputmode="decimal" min="1" max="200" step="0.1" value="${last[1]}"></label></div>
    <div class="chips" style="margin-top:8px">${[[6, 8], [8, 10], [9, 12], [10, 15], [12, 20]].map(([w, d]) => `<button type="button" data-ns="${w},${d}">${w}×${d}</button>`).join('')}</div><p class="hint" id="nsA" style="margin:6px 0 0"></p>`;
  const W = $('#nsW'), D = $('#nsD'), area = () => { const a = (+W.value || 0) * (+D.value || 0); $('#nsA').textContent = a > 0 ? `${a.toFixed(1)} ㎡ · ${(a / 3.3058).toFixed(1)} 평` : '숫자를 넣어 주세요'; };
  W.oninput = D.oninput = area; area(); $$('[data-ns]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const [w, d] = b.dataset.ns.split(','); W.value = w; D.value = d; area(); }));
  const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#dlgB [data-i="1"]').click(); } }; W.onkeydown = D.onkeydown = enter; setTimeout(() => { W.focus(); W.select(); }, 60);
  return p.then((v) => { if (v !== 'ok') return false; const w = Math.min(200, Math.max(1, +W.value || 0)), d = Math.min(200, Math.max(1, +D.value || 0)); if (!(w > 0 && d > 0)) return false; try { localStorage.setItem('byr.newSize', JSON.stringify([w, d])); } catch {} return [Math.round(w * 1000), Math.round(d * 1000)]; });
}
/* ---------- 새 버전 알림 ----------
 * PC 설치판은 메인 프로세스가 알아서 받고 다시 시작을 묻는다 (여기선 진행 알림만).
 * PC 포터블 · 안드로이드: GitHub 릴리스의 최신 버전과 비교해 "새 버전 받기" 를 띄운다 (하루에 한 번까지 · 끄기 가능). */
const REL = 'https://github.com/uniclub24-cpu/3d-render/releases/latest', newer = (a, b) => { const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function checkUpdate(force) {
  const E = window.byr, cap = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android';
  let kind = cap ? 'apk' : null;
  if (E && E.info) { const i = await E.info().catch(() => null); kind = i && i.update; if (kind === 'setup' && E.onUpdate) { if (force) return toast(`설치판은 켤 때 자동으로 확인 · 설치해요 (지금 ${APP_VERSION})`); E.onUpdate((m) => { if (m.state === 'downloading') toast(`새 버전 ${m.version} 을 받는 중… (작업은 계속해도 돼요)`, 4000); if (m.state === 'ready') toast(`새 버전 ${m.version} 준비 완료 · 다시 시작하면 바뀌어요`, 6000); }); return; } if (kind !== 'portable') return; }
  if (!kind) return; const last = store.get('byr.updChk', 0); if (!force && Date.now() - last < 20 * 3600 * 1000) return; store.set('byr.updChk', Date.now());
  try { const j = await (await fetch('https://api.github.com/repos/uniclub24-cpu/3d-render/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })).json(); const v = String(j.tag_name || '').replace(/^v/, '');
    if (!v || !newer(v, APP_VERSION) || store.get('byr.updSkip', '') === v) { if (force) toast(`지금이 최신이에요 (${APP_VERSION})`); return; }
    const url = kind === 'apk' ? REL + '/download/BYR2.apk' : REL;
    const r = await ask(`새 버전 ${v} 이 나왔어요`, kind === 'apk' ? '받은 APK 를 열면 덮어쓰기로 설치돼요 (작업은 그대로). 처음 한 번은 "출처를 알 수 없는 앱" 허용이 필요할 수 있어요.' : '설치판(BYR2-Setup)을 한 번 설치하면 다음부터는 자동으로 업데이트돼요. 작업은 그대로 이어져요.', [{ label: '이 버전 건너뛰기', value: 'skip' }, { label: '나중에', value: false }, { label: kind === 'apk' ? '새 버전 받기' : '받는 곳 열기', value: true, kind: 'pri' }]);
    if (r === 'skip') store.set('byr.updSkip', v); else if (r) { if (E && E.openUrl) E.openUrl(kind === 'portable' ? REL : url); else location.href = url; } }
  catch (e) { console.warn('update check', e); if (force) toast('새 버전을 확인하지 못했어요 (인터넷 연결 확인)'); }
}
const IS_APP = () => !!(window.byr || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));
async function quitApp() {
  if (!(await ask('BYR2 를 종료할까요?', '저장한 작업은 다시 켜면 이어서 할 수 있어요.', [{ label: '취소', value: false }, { label: '종료', value: true, kind: 'danger' }]))) return;
  if (!(await lib2.flush())) { const c = await ask('이 기기에 저장하지 못했어요', '지금 닫으면 마지막 고친 내용이 사라질 수 있어요. 프로젝트 파일로 백업해 두세요.', [{ label: '파일로 백업', value: 'bk', kind: 'pri' }, { label: '그냥 종료', value: 'q', kind: 'danger' }, { label: '취소', value: false }]); if (!c) return; if (c === 'bk') { await ACT.save(); return; } }
  if (S.dirty) { const a = await ask('저장하지 않은 변경이 있어요', '저장하고 종료할까요? (저장 안 해도 다음에 열 때 복구할 수 있어요)', [{ label: '취소', value: 'x' }, { label: '저장 안 함', value: 'no' }, { label: '저장', value: 'yes', kind: 'pri' }]); if (a === 'x' || !a) return; if (a === 'yes') await saveNow(true); }
  if (window.byr && window.byr.quit) window.byr.quit(); else if (window.Capacitor && window.Capacitor.Plugins.App) window.Capacitor.Plugins.App.exitApp(); else toast('브라우저 탭을 닫으면 돼요 · 작업은 저장돼 있어요');
}
/** 뒤로 가기 (안드로이드 뒤로 단추 · Esc): 열린 것부터 하나씩 닫고, 마지막엔 홈 → 종료 확인 */
async function goBack() { if (present.on) return present.exit();
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
  market: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/><path d="M11 7.5v3.5l2.3 1.6"/>', site: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>', cont: '<path d="M8 5l11 7-11 7z"/>', new: '<path d="M12 5v14M5 12h14"/>', open: '<path d="M4 6h6l2 2h8v11H4z"/>', legacy: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 13h8M8 17h5"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z"/>', sample: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>', model: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>', ai: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z"/>',
};
function showHome() { $('#home').hidden = false; renderHome(); }
function closeHome() { $('#home').hidden = true; }
/* ---------- 자료로 매장 만들기 (도면 · 3D 렌더 · 전열도 · 치수) ----------
 * 1) 오프라인: DXF 도면 → 벽 / 치수(가로 × 세로) → 사각 매장 · 고른 업종 프리셋으로 자동 배치
 * 2) AI(키가 있으면): 도면 그림 · PDF → 벽 · 문, 렌더 · 사진 → 기물 · 마감 색, 전열도 → 콘센트 · 조명
 * 오프라인으로 만들다 깨지면(벽이 없음 · 치수 없음) AI 로 넘어가고, 키가 없으면 무엇이 필요한지 알려 준다. */
const IMP = { files: [], w: '', d: '', kind: 'pel_hall', auto: true, name: '' };
const IMP_ROLE = { plan: '평면도', render: '3D 렌더 · 사진', elec: '전열 · 설비도' };
const guessRole = (n) => (/\.dxf$/i.test(n) || /평면|도면|plan|layout/i.test(n) ? 'plan' : /전열|전기|설비|조명도|elec|mep/i.test(n) ? 'elec' : /\.pdf$/i.test(n) ? 'plan' : 'render');
function renderImport(log) {
  SH.setCustomBiz(bizList()); const key = !!cloud.aiKey(), B = $('#homeBody');
  B.innerHTML = `<div class="row2"><button class="btn" data-im="back">‹ 홈</button><b class="htitle">자료로 매장 만들기</b></div>
    <section class="hsec"><b>1. 자료 올리기</b><p class="hint">자료마다 역할을 골라 주세요. <b>평면도</b> = 벽 · 기물의 기준, <b>전열 · 설비도</b> = 평면도에 없는 설비(콘센트 · 조명 · 급수 · 가스 · 배수 · 에어컨)만 더함, <b>3D 렌더 · 사진</b> = 새로 넣지 않고 색 · 마감만 맞춤. 같은 기물은 두 번 넣지 않아요.</p>
      <div class="ifiles">${IMP.files.map((f, i) => `<div class="ifile"><span>${esc(f.name)}</span><select data-ir="${i}">${Object.entries(IMP_ROLE).map(([k, n]) => `<option value="${k}" ${f.role === k ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="lnk" data-ix="${i}">빼기</button></div>`).join('') || '<p class="hint">아직 올린 자료가 없어요</p>'}</div>
      <div class="btns"><button class="btn" data-im="add">+ 자료 추가</button></div></section>
    <section class="hsec"><b>2. 치수 · 옵션</b><p class="hint">치수를 넣으면 인터넷 없이도 바로 만들어요. 도면에 치수선이 있으면 비워도 돼요(DXF · AI).</p>
      <div class="row"><label class="fld">이름<input id="imN" value="${esc(IMP.name)}" placeholder="예: 페리카나 ○○ 직영점"></label></div>
      <div class="row"><label class="fld">가로 (m)<input id="imW" type="number" step="0.1" min="2" value="${IMP.w}" placeholder="예: 8"></label><label class="fld">세로 · 깊이 (m)<input id="imD" type="number" step="0.1" min="2" value="${IMP.d}" placeholder="예: 15"></label></div>
      <label class="fld">업종 · 프리셋<select id="imK"><option value="">자동 배치 안 함 (벽만)</option>${Object.entries(SH.BIZ).map(([k, b]) => `<option value="${k}" ${IMP.kind === k ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label></section>
    <section class="hsec"><b>3. 만들기</b><div class="btns"><button class="btn" data-im="off">인터넷 없이 만들기</button><button class="btn pri" data-im="ai" ${key ? '' : 'disabled'}>AI 로 자료 읽어 만들기</button></div>
      <p class="hint">${key ? `AI: ${esc(cloud.PROVIDERS[cloud.aiProvider()].name)} 키 연결됨 · 그림 · PDF 자료는 AI 가 읽어요 (자료마다 30초~1분).` : 'AI 키가 없어요 · 홈 → AI 설정에서 키를 넣으면 그림 · PDF 자료도 읽어요. 지금은 DXF · 치수로만 만들어요.'}</p>
      <div class="ilive" id="imLive" hidden></div><pre class="ilog" id="imLog">${esc(log || '')}</pre></section>`;
  const sync = () => { IMP.name = $('#imN').value; IMP.w = $('#imW').value; IMP.d = $('#imD').value; IMP.kind = $('#imK').value; };
  $$('[data-ir]', B).forEach((x) => (x.onchange = () => { IMP.files[+x.dataset.ir].role = x.value; }));
  $$('[data-ix]', B).forEach((x) => (x.onclick = () => { sync(); IMP.files.splice(+x.dataset.ix, 1); renderImport(); }));
  $$('[data-im]', B).forEach((x) => (x.onclick = async () => { const a = x.dataset.im; if (a === 'back') return renderHome(); sync();
    if (a === 'add') { const fs = await openFiles({ title: '도면 · 렌더 · 전열도', extensions: ['dxf', 'pdf', 'png', 'jpg', 'jpeg', 'webp'], multi: true }); for (const f of fs) IMP.files.push({ ...f, role: guessRole(f.name) }); return renderImport(); }
    $$('[data-im]', B).forEach((q) => (q.disabled = true)); $('#imLog').textContent = ''; const stopW = aiWatch(imLog, $('#imLive'));
    try { await buildFromDocs(a === 'ai'); } catch (e) { console.error(e); imLog('⛔ ' + errTxt(e)); $$('[data-im]', B).forEach((q) => (q.disabled = false)); } finally { stopW(); } }));
}
/* ---------- 주소로 상가 찾기 · 상권 3D (공공데이터 · OpenStreetMap) ---------- */
const SF = { q: '', res: [], R: 500, busy: false, log: '' };
function renderSiteFind() {
  const B = $('#homeBody'), V = SITE.vworld();
  B.innerHTML = `<div class="row2"><button class="btn" data-sf="back">‹ 홈</button><b class="htitle">주소로 상가 찾기 · 상권 3D</b></div>
    <section class="hsec"><b>1. 주소 · 상호 검색</b>
      <div class="row"><label class="fld">주소<input id="sfQ" value="${esc(SF.q)}" placeholder="예: 서울 강서구 마곡중앙로 161"></label></div>
      <div class="btns"><button class="btn pri" data-sf="find">찾기</button></div>
      <div class="sfres">${SF.res.map((r, i) => `<button class="sfr" data-sr="${i}"><b>${esc(r.title)}</b><small>${esc(r.sub || '')} · ${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}</small></button>`).join('')}</div></section>
    <section class="hsec"><b>2. 범위</b><div class="seg2">${[300, 500, 800].map((r) => `<button data-sfr="${r}" aria-pressed="${SF.R === r}">반경 ${r}m</button>`).join('')}</div>
      <p class="hint">넓을수록 오래 걸리고 무거워요. 휴대폰은 500m 까지 권해요.</p></section>
    <section class="hsec"><b>3. 공공데이터 키 (브이월드)</b>
      <p class="hint">${V.key ? '✓ 키가 있어요 · 건물 층수 · 용도(건축물대장) · 용도지역을 받아요.' : '키가 없으면 OpenStreetMap 만 써요 (건물이 빠지거나 층수가 비는 곳이 있어요). 브이월드(vworld.kr) → 오픈API → 인증키 발급에서 무료로 받을 수 있어요.'}</p>
      <div class="row"><label class="fld">인증키<input id="sfK" type="password" value="${esc(V.key || '')}" placeholder="브이월드 인증키" autocomplete="off"></label><label class="fld">등록한 서비스 URL<input id="sfD" value="${esc(V.domain || '')}" placeholder="예: http://localhost"></label></div>
      <p class="hint">${V.dkey ? '✓ 공공데이터포털 키가 있어요 · 건축물대장(높이 · 주용도 · 연면적 · 준공연도)을 붙여요.' : '공공데이터포털(data.go.kr) 키를 넣으면 건축물대장의 실제 높이 · 주용도를 붙여요 (건축HUB 건축물대장정보 활용 신청).'}</p>
      <div class="row"><label class="fld">공공데이터포털 키 (일반 인증키)<input id="sfDK" type="password" value="${esc(V.dkey || '')}" placeholder="data.go.kr 일반 인증키 (Decoding)" autocomplete="off"></label></div>
      <div class="btns"><button class="btn" data-sf="key">키 저장 (이 기기에만)</button>${V.key ? '<button class="btn" data-sf="keyx">키 지우기</button>' : ''}</div></section>
    <section class="hsec"><div class="ilive" id="sfLive" hidden></div><pre class="ilog" id="sfLog" ${SF.log ? '' : 'hidden'}>${esc(SF.log)}</pre></section>`;
  const log = (t) => { SF.log += (SF.log ? '\n' : '') + t; const el = $('#sfLog'); if (el) { el.hidden = false; el.textContent = SF.log; el.scrollTop = 1e9; } };
  const find = async () => { SF.q = $('#sfQ').value.trim(); if (!SF.q) return; SF.log = ''; log('찾는 중…'); try { SF.res = await SITE.geocode(SF.q); SF.log = SF.res.length ? '' : '찾지 못했어요 · 도로명 주소나 지번으로 다시 넣어 보세요'; } catch (e) { SF.res = []; SF.log = '⛔ ' + siteErr(e); } renderSiteFind(); };
  $('#sfQ').onkeydown = (e) => { if (e.key === 'Enter') find(); };
  $$('[data-sfr]', B).forEach((b) => (b.onclick = () => { SF.q = $('#sfQ').value; SF.R = +b.dataset.sfr; renderSiteFind(); }));
  $$('[data-sr]', B).forEach((b) => (b.onclick = () => siteBuild(SF.res[+b.dataset.sr], log)));
  $$('[data-sf]', B).forEach((b) => (b.onclick = () => { const a = b.dataset.sf; if (a === 'back') return renderHome(); if (a === 'find') return find();
    if (a === 'key') { SITE.setVworld({ key: $('#sfK').value.trim(), domain: $('#sfD').value.trim(), dkey: $('#sfDK').value.trim() }); SF.q = $('#sfQ').value; toast('키를 이 기기에 저장했어요'); return renderSiteFind(); }
    if (a === 'keyx') { SITE.setVworld({}); return renderSiteFind(); } }));
}
const siteErr = (e) => { const c = e && e.code || ''; return /E-VW/.test(c) ? `브이월드 오류 (${e.message}) · 키 · 등록 URL 을 확인해 주세요` : /E-NET0|E-NET$/.test(c) ? '인터넷 연결 또는 서버 응답이 없어요' : /E-NET4/.test(c) ? `서버가 거절했어요 (${c.slice(5)}) · 키를 확인해 주세요` : (e && e.message) || String(e); };
async function siteBuild(r, log) {
  if (SF.busy) return; SF.busy = true; $$('#homeBody button').forEach((b) => (b.disabled = true)); const live = $('#sfLive'), t0 = Date.now(); let cur = '';
  const iv = setInterval(() => { if (live) { live.hidden = !cur; live.innerHTML = cur ? `<span class="spin"></span><span>${esc(cur)}</span><b>${Math.round((Date.now() - t0) / 1000)}초</b>` : ''; } }, 500);
  try {
    log(`📍 ${r.title} · 반경 ${SF.R}m`); const step = (m) => { cur = m; if (/^✓|건너뜀|건물 필드|실패|비었|대신/.test(m)) log(m); }, site = await SITE.loadSite(r.lon, r.lat, SF.R, step);
    const V = SITE.vworld(); if (V.dkey && site.buildings.length) { try { await SITE.enrichLedger(site, V.dkey, step); } catch (e) { log('⛔ 건축물대장: ' + siteErr(e)); } }
    if (!site.buildings.length && !site.roads.length) throw new Error('이 범위에서 받은 자료가 없어요');
    site.title = r.title; const m = emptyProject(`상권 · ${r.title}`.slice(0, 40)); const L = m.levels[0]; L.walls = []; L.rooms = []; L.openings = [];
    m.env = { ...(m.env || {}), type: 'site', site, siteColor: 'use', hk: 1, siteMap: SITE.vworld().key ? 'sat' : 'none', siteRoads: true, siteZones: false }; closeHome(); await setModel(m); S.siteSel = site.hit >= 0 ? site.hit : null; siteBird(); siteFit2d(); S.panel = 'site'; S.propsOpen = true; renderProps();
    toast('상권을 세웠어요 · 건물을 누르면 정보 · 도면 시작', 3500);
  } catch (e) { console.error(e); log('⛔ ' + siteErr(e)); } finally { clearInterval(iv); cur = ''; if (live) live.hidden = true; SF.busy = false; $$('#homeBody button').forEach((b) => (b.disabled = false)); }
}
function siteBird() { const E = envOf(S.model), R = (E.site && E.site.R) || 500, c = engine.camera, t = engine.controls.target, ax = 0, ay = 0; if (S.pane === '2d') setPane('3d'); t.set(ax, 0, ay); c.position.set(ax + R * 0.3, R * 0.5, ay + R * 0.85); engine.controls.update(); engine.invalidate(true); }
/* ---------- 상권 2D: 위성 · 지도 바닥 + 건물 외곽(용도 색) · 찾은 주소 · 고르기 ---------- */
const siteE = () => { const E = envOf(S.model); return E.type === 'site' && E.site ? E : null; };
function siteUnder(g, px1) {
  const E = siteE(); if (!E || !site2d(E)) return; const St = E.site, ax = E.siteAx || 0, ay = E.siteAy || 0, K = 1000, M = SITE.siteMap(St, E.siteMap2d || E.siteMap || 'none');
  g.save(); g.rotate(((E.siteRot || 0) * Math.PI) / 180); /* 작업 방향에 맞춰 상권도 같이 돈다 */
  if (M) { const [x0, y0, x1, y1] = M.b; g.drawImage(M.cv, (x0 - ax) * K, (y0 - ay) * K, (x1 - x0) * K, (y1 - y0) * K); }
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  if (!M) for (const [arr, col] of [[St.green, E.siteModel ? '#eef0ea' : '#d6ead0'], [St.water, E.siteModel ? '#dcd9f0' : '#b9d8ee']]) for (const w of arr || []) { g.beginPath(); w.p.forEach(([x, y], k) => (k ? g.lineTo((x - ax) * K, (y - ay) * K) : g.moveTo((x - ax) * K, (y - ay) * K))); g.closePath(); g.fillStyle = col; g.fill(); }
  if (St.dem && E.siteTerrain !== false && (E.siteContour || 'auto') !== 'off') { const st = SITE.contourStep(St.dem, E.siteContour), key = st + ':' + St.dem.n + ':' + St.dem.base; let ct = CTC.get(St); if (!ct || ct.key !== key) CTC.set(St, (ct = { key, L: SITE.contours(St.dem, st) }));
    for (const idx of [false, true]) { g.beginPath(); for (const [x1, y1, x2, y2, lv] of ct.L) { if ((Math.round(lv / st) % 5 === 0) !== idx) continue; g.moveTo((x1 - ax) * K, (y1 - ay) * K); g.lineTo((x2 - ax) * K, (y2 - ay) * K); } g.strokeStyle = M ? (idx ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.55)') : idx ? '#6f7277' : '#a3a6ab'; g.lineWidth = (idx ? 1.4 : 0.7) * px1; g.stroke(); } }
  if (!M) { g.strokeStyle = '#c4c6cb'; for (const r of St.roads || []) { g.lineWidth = r.w * K; g.beginPath(); r.p.forEach(([x, y], k) => (k ? g.lineTo((x - ax) * K, (y - ay) * K) : g.moveTo((x - ax) * K, (y - ay) * K))); g.stroke(); } }
  St.buildings.forEach((b, i) => { if (i === E.siteStore) return; g.beginPath(); b.p.forEach(([x, y], k) => (k ? g.lineTo((x - ax) * K, (y - ay) * K) : g.moveTo((x - ax) * K, (y - ay) * K))); g.closePath();
    const hit = i === St.hit, sel = i === S.siteSel, col = hit ? '#ff2d2d' : (SITE.USES.find(([n]) => n === b.use) || [, '#c7cbd1'])[1];
    g.globalAlpha = M ? (hit ? 0.7 : 0.35) : 0.85; g.fillStyle = col; g.fill(); g.globalAlpha = 1; g.lineWidth = (sel ? 3 : hit ? 2 : 0.8) * px1; g.strokeStyle = sel ? '#2f7df6' : hit ? '#b40000' : 'rgba(30,35,45,.55)'; g.stroke(); });
  const hb = St.buildings[St.hit]; if (hb && E.siteStore !== St.hit) { const cx = (hb.p.reduce((a, q) => a + q[0], 0) / hb.p.length - ax) * K, cy = (hb.p.reduce((a, q) => a + q[1], 0) / hb.p.length - ay) * K, r = 9 * px1;
    g.fillStyle = '#ff2d2d'; g.strokeStyle = '#fff'; g.lineWidth = 2 * px1; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy - r * 2.2, r, Math.PI * 0.8, Math.PI * 0.2); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy - r * 2.2, r * 0.4, 0, 7); g.fill(); }
  g.restore(); g.restore();
}
const CTC = new WeakMap(); /* 등고선 계산 캐시 (저장 안 함) */
const site2d = (E) => (E.site2d ?? E.siteStore == null); /* 도면 작업 중 2D 는 기본으로 배경 없음 */
function sitePick2d(p) { const E = siteE(); if (!E || !site2d(E)) return null; const a = (-(E.siteRot || 0) * Math.PI) / 180, px = p.x * Math.cos(a) - p.y * Math.sin(a), py = p.x * Math.sin(a) + p.y * Math.cos(a), ax = E.siteAx || 0, ay = E.siteAy || 0, x = px / 1000 + ax, y = py / 1000 + ay; const i = E.site.buildings.findIndex((b, k) => k !== E.siteStore && SITE.inPoly(x, y, b.p)); return i >= 0 ? { kind: 'site', id: i } : null; }
function siteBounds2d() { const E = siteE(); if (!E) return null; const R = E.site.R * 1000, ax = (E.siteAx || 0) * 1000, ay = (E.siteAy || 0) * 1000; return [-R - ax, -R - ay, R - ax, R - ay]; }
function siteFit2d() { setTimeout(() => plan.fit(), 60); }

/** 상권 배경 겹: 바닥(위성 · 지도 · 없음) · 3D 도로 · 건물 색 · 용도지역 · 나무 · 높이 — 상권 패널과 배경 탭에서 같이 씀 */
function siteLayersHtml(E) {
  const St = E.site, vk = !!SITE.vworld().key, MAPS2 = [['sat', '위성'], ['base', '일반지도'], ['gray', '회색 지도'], ['hyb', '위성 + 지명'], ['none', '없음 (깨끗한 바닥)']];
  const dm = St.dem;
  return `<div class="fld">보기 방식<div class="seg2"><button data-sp="model" aria-pressed="${!!E.siteModel}">건축 모형</button><button data-sp="sat" aria-pressed="${!E.siteModel && E.siteMap === 'sat'}" ${vk ? '' : 'disabled'}>위성 사실</button><button data-sp="cmp" ${vk ? '' : 'disabled'}>대조 보기 (2D 위성 · 3D 모형)</button></div></div>
    <div class="fld">지형 <small>${dm ? `${esc(dm.src)} · 높이 차 ${Math.round(dm.max - dm.min)}m` : '아직 없음'}</small>${dm ? `<label class="tog">지형 켜기<input type="checkbox" id="siTer" ${E.siteTerrain !== false ? 'checked' : ''}></label><label class="fld">지형 과장 <b>${(E.terrK ?? 1).toFixed(1)}×</b><input type="range" id="siTK" min="1" max="4" step="0.5" value="${E.terrK ?? 1}"></label><div class="seg2">${[['off', '등고선 끔'], ['auto', `자동 (${SITE.contourStep(dm, 'auto')}m)`], ['1', '1m'], ['2', '2m'], ['5', '5m'], ['10', '10m']].map(([k, n]) => `<button data-ct="${k}" aria-pressed="${(E.siteContour || 'auto') === k}">${n}</button>`).join('')}</div>` : '<div class="btns"><button class="btn" id="siDem">지형 · 등고선 받기 (키 없음)</button></div>'}</div>
    <div class="fld">바닥 <small>브이월드</small><div class="seg2">${MAPS2.map(([k, n]) => `<button data-sm="${k}" aria-pressed="${(E.siteMap || 'none') === k}" ${k !== 'none' && !vk ? 'disabled title="브이월드 키가 있어야 해요"' : ''}>${n}</button>`).join('')}</div></div>
    <div class="fld">건물 색<div class="seg2">${[['white', '흰 매스'], ['use', '용도'], ['floors', '층수']].map(([k, n]) => `<button data-sc="${k}" aria-pressed="${(E.siteColor === 'zone' ? 'white' : E.siteColor || 'use') === k}">${n}</button>`).join('')}</div></div>
    <label class="tog">3D 도로 (실제 도로선으로 그림)<input type="checkbox" id="siR" ${E.siteRoads !== false ? 'checked' : ''}></label>
    <label class="tog">용도지역 색 깔기<input type="checkbox" id="siZ" ${E.siteZones || E.siteColor === 'zone' ? 'checked' : ''} ${St.zones.length ? '' : 'disabled'}></label>
    <label class="tog">가로수 · 나무<input type="checkbox" id="siT" ${E.siteTrees !== false ? 'checked' : ''}></label>
    <label class="fld">높이 과장 <b>${(E.hk ?? 1).toFixed(1)}×</b><input type="range" id="siH" min="0.5" max="3" step="0.1" value="${E.hk ?? 1}"></label>`;
}
function bindSiteLayers(body, E, re) {
  $$('[data-sp]', body).forEach((x) => (x.onclick = () => { const k = x.dataset.sp;
    if (k === 'model') { E.siteModel = true; E.siteMap = 'none'; E.siteColor = 'white'; E.siteZones = false; delete E.siteMap2d; }
    if (k === 'sat') { E.siteModel = false; E.siteMap = 'sat'; delete E.siteMap2d; }
    if (k === 'cmp') { E.siteModel = true; E.siteMap = 'none'; E.siteColor = 'white'; E.siteZones = false; E.siteMap2d = 'sat'; E.site2d = true; setPane('split'); toast('왼쪽 2D = 브이월드 위성 · 오른쪽 3D = 건축 모형 · 건물 · 도로 · 지형이 맞는지 대조해 보세요', 4000); }
    re(); plan.redraw(); }));
  const dB = $('#siDem', body); if (dB) dB.onclick = async () => { dB.disabled = true; try { await SITE.loadDem(E.site, (m) => (dB.textContent = m)); E.siteTerrain = true; toast('지형 · 등고선을 받았어요'); } catch (e) { toast('지형 받기 실패 · ' + siteErr(e), 4000); } re(); plan.redraw(); };
  const tr = $('#siTer', body); if (tr) tr.onchange = (e) => { E.siteTerrain = e.target.checked; re(); plan.redraw(); };
  const tk = $('#siTK', body); if (tk) tk.onchange = (e) => { E.terrK = +e.target.value; re(); };
  $$('[data-ct]', body).forEach((x) => (x.onclick = () => { E.siteContour = x.dataset.ct; re(); plan.redraw(); }));
  $$('[data-sm]', body).forEach((x) => (x.onclick = () => { E.siteMap = x.dataset.sm; re(); plan.redraw(); }));
  $$('[data-sc]', body).forEach((x) => (x.onclick = () => { if (E.siteColor === 'zone') E.siteZones = true; E.siteColor = x.dataset.sc; re(); }));
  $('#siR', body).onchange = (e) => { E.siteRoads = e.target.checked; re(); };
  $('#siZ', body).onchange = (e) => { E.siteZones = e.target.checked; if (!e.target.checked && E.siteColor === 'zone') E.siteColor = 'white'; re(); };
  $('#siT', body).onchange = (e) => { E.siteTrees = e.target.checked; re(); };
  $('#siH', body).onchange = (e) => { E.hk = +e.target.value; re(); };
}
/* ---------- 작업 방향: 층 전체(벽 · 기물 · 공간 · 선 · 바닥판 · 치수 · 핀)와 상권 배경을 같은 각도로 돌린다 ---------- */
function rotateWork(deg, quiet) {
  if (!deg) return; const L = level(), a = (deg * Math.PI) / 180, c = Math.cos(a), s2 = Math.sin(a), R = (x, y) => [Math.round(x * c - y * s2), Math.round(x * s2 + y * c)], Rp = (p) => R(p[0], p[1]);
  for (const w of L.walls) { [w.x1, w.y1] = R(w.x1, w.y1); [w.x2, w.y2] = R(w.x2, w.y2); }
  for (const it of L.items) { [it.x, it.y] = R(it.x, it.y); it.rot = ((((it.rot || 0) + deg) % 360) + 360) % 360; }
  for (const r of L.rooms || []) r.pts = r.pts.map(Rp); for (const l of L.lines || []) l.pts = l.pts.map(Rp); for (const sf of L.soffits || []) sf.pts = sf.pts.map(Rp); for (const k of L.sketches || []) if (k.pts) k.pts = k.pts.map(Rp);
  for (const d of L.dims || []) { [d.x1, d.y1] = R(d.x1, d.y1); [d.x2, d.y2] = R(d.x2, d.y2); } if (L.slab) L.slab = L.slab.map(Rp);
  for (const cm of S.model.comments || []) if ((cm.lv ?? 0) === S.model.activeLevel && cm.x != null) [cm.x, cm.y] = R(cm.x, cm.y);
  const E = envOf(S.model); if (E.site) E.siteRot = Math.round(((E.siteRot || 0) + deg) * 10) / 10;
  engine.setLevel(L); applyEnv(); commit(); syncPins(); plan.redraw(); if (!quiet) toast(`작업 방향 ${deg > 0 ? '+' : ''}${Math.round(deg * 10) / 10}°`, 1200);
}
function alignWallH(w) { let a = (Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180) / Math.PI, d = -a; while (d > 90) d -= 180; while (d <= -90) d += 180; if (Math.abs(d) < 0.05) return toast('이미 수평이에요'); rotateWork(Math.round(d * 100) / 100, true); toast(`이 벽이 수평이 되게 ${Math.round(d * 10) / 10}° 돌렸어요`); }
function renderOrient(body) {
  $('#propsTitle').textContent = '작업 방향 · 도면 돌리기'; const E = envOf(S.model), w = selWall();
  body.innerHTML = `<p class="hint">층 전체(벽 · 기물 · 공간 · 선 · 바닥)를 돌려 원하는 방향을 위로 두고 그려요. ${E.site ? '상권 배경도 같은 각도로 같이 돌아서 틀어지지 않아요.' : ''}${E.site ? ` · 지금 북쪽에서 ${Math.round((E.siteRot || 0) * 10) / 10}°` : ''}</p>
    <div class="btns">${w ? '<button class="btn pri" id="orW">고른 벽을 수평으로</button>' : '<span class="hint">벽을 고르면 [고른 벽을 수평으로] 가 생겨요</span>'}</div>
    <div class="seg2">${[[-90, '⟲ 90°'], [-15, '⟲ 15°'], [-1, '⟲ 1°'], [1, '⟳ 1°'], [15, '⟳ 15°'], [90, '⟳ 90°']].map(([d, n]) => `<button data-od="${d}">${n}</button>`).join('')}</div>
    <label class="fld">잡고 돌리기 (−45° ~ +45°)<input type="range" id="orS" min="-45" max="45" step="0.5" value="0"><small id="orV">0°</small></label>
    <div class="row"><label class="fld">각도 직접 (°)<input type="number" id="orN" step="0.5" value="0"></label><button class="btn" id="orGo">돌리기</button></div>
    ${E.site ? `<div class="btns"><button class="btn" id="orN0">북쪽을 위로 (지도 원래 방향)</button></div><label class="tog">2D 에 상권 배경 보이기<input type="checkbox" id="or2d" ${site2d(E) ? 'checked' : ''}></label>` : ''}
    <div class="sec">바닥판</div><label class="tog">바닥판을 벽(공간) 모양에 맞추기<input type="checkbox" id="orSlab" ${level().slab ? 'checked' : ''}></label>`;
  const ow = $('#orW', body); if (ow) ow.onclick = () => { alignWallH(w); renderProps(); };
  $$('[data-od]', body).forEach((b) => (b.onclick = () => { rotateWork(+b.dataset.od); renderProps(); }));
  let last = 0; const sl = $('#orS', body); sl.oninput = () => { const v = +sl.value; rotateWork(v - last, true); last = v; $('#orV', body).textContent = v + '°'; }; sl.onchange = () => { toast(`${last}° 돌렸어요`); renderProps(); };
  $('#orGo', body).onclick = () => { rotateWork(+$('#orN', body).value || 0); renderProps(); };
  const n0 = $('#orN0', body); if (n0) n0.onclick = () => { rotateWork(-(E.siteRot || 0)); renderProps(); };
  const o2 = $('#or2d', body); if (o2) o2.onchange = () => { E.site2d = o2.checked; commit(); plan.redraw(); };
  $('#orSlab', body).onchange = (e) => { const L = level(); if (e.target.checked) { const r = (L.rooms || []).slice().sort((a, b) => Math.abs(polyA(b.pts)) - Math.abs(polyA(a.pts)))[0]; if (!r) { e.target.checked = false; return toast('공간(방)이 있어야 해요 · 공간 자동 찾기 먼저'); } L.slab = r.pts.map((q) => q.slice()); } else delete L.slab; engine.setLevel(L); commit(); };
}
const polyA = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a / 2; };

/** 상권 패널: 색 · 높이 · 범례 · 고른 건물 정보 · 도면 시작 */
function renderSite(body) {
  const E = envOf(S.model), St = E.site; $('#propsTitle').textContent = '상권 3D';
  if (!St) { body.innerHTML = '<p class="hint">상권 자료가 없어요 · 홈 → 주소로 상가 찾기</p>'; return; }
  const b = S.siteSel != null ? St.buildings[S.siteSel] : null, cnt = {}; for (const q of St.buildings) cnt[q.use] = (cnt[q.use] || 0) + 1;
  body.innerHTML = `<p class="hint">${esc(St.title || '')} · 반경 ${St.R}m · 건물 ${St.buildings.length} · ${esc(St.src.join(' · '))} (${esc(St.at || '')})</p>
    ${b ? `<div class="hsec sitesel"><b>${esc(b.name || '이름 없는 건물')}</b><small>${S.siteSel === St.hit ? '📍 찾은 주소 · ' : ''}${esc(b.useNm || b.use)} · 지상 ${b.f ? b.f + '층' : '층수 모름 (' + SITE.siteFloors(b) + '층으로 표시)'}${b.h ? ` · 높이 ${b.h}m` : ''}${b.area ? ` · 연면적 ${b.area.toLocaleString()}㎡` : ''}${b.year ? ` · ${b.year}년 준공` : ''}${b.addr ? ' · ' + esc(b.addr) : ''}${b.ledger ? ' · 건축물대장' : ''}</small>
      <div class="btns"><button class="btn pri" id="siGo">${E.siteStore === S.siteSel ? '이 상가 도면으로 가기' : '이 건물(상가)로 도면 시작'}</button><button class="btn" id="siX">선택 해제</button></div></div>` : '<p class="hint">3D 에서 건물을 누르면 용도 · 층수가 나오고, 그 상가로 도면을 시작할 수 있어요.</p>'}
    ${siteLayersHtml(E)}
    ${SITE.vworld().dkey ? `<div class="btns"><button class="btn" id="siLed">건축물대장 ${St.src.includes('건축물대장') ? '다시 ' : ''}받기 (높이 · 주용도)</button></div>` : ''}
    <div class="btns"><button class="btn" id="siBird">전체 보기</button><button class="btn" id="siWalk">도로 둘러보기 (걷기)</button></div>
    <div class="legend">${E.siteColor === 'white' ? '' : (E.siteColor || 'use') === 'use' ? SITE.USES.filter(([n]) => cnt[n]).map(([n, c]) => `<span><i style="background:${c}"></i>${n} ${cnt[n]}</span>`).join('') : (E.siteColor === 'floors' ? [['1~2층', '#d6e3f2'], ['3~4층', '#a9c4e6'], ['5~7층', '#7aa0d4'], ['8~14층', '#4f78b8'], ['15층+', '#2f4f8f']] : [...new Set(St.zones.map((z) => z.name))].slice(0, 12).map((n) => [n || '기타', SITE.zoneColor(n)])).map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join('')}</div>`;
  const re = () => { applyEnv(); commit(); engine.siteMark(S.siteSel); renderProps(); };
  bindSiteLayers(body, E, re);
  const led = $('#siLed', body); if (led) led.onclick = async () => { led.disabled = true; led.textContent = '건축물대장 받는 중…'; try { St.src = St.src.filter((x) => x !== '건축물대장'); const n = await SITE.enrichLedger(St, SITE.vworld().dkey, (m) => (led.textContent = m)); toast(`건물 ${n}개에 건축물대장을 붙였어요`); } catch (e) { toast('건축물대장 실패 · ' + siteErr(e), 4000); } re(); };
  $('#siBird', body).onclick = () => { if (E.siteStore != null) { const R = St.R; engine.controls.target.set(0, 0, 0); engine.camera.position.set(R * 0.3, R * 0.5, R * 0.85); engine.controls.update(); engine.invalidate(true); } else siteBird(); };
  $('#siWalk', body).onclick = () => { setPane('3d'); engine.walker.start(); toast('W A S D · 화살표로 이동 · Shift 빠르게 · 끌어서 둘러보기 · Esc 끝', 4000); };
  const x = $('#siX', body); if (x) x.onclick = () => { S.siteSel = null; engine.siteMark(null); renderProps(); };
  const go = $('#siGo', body); if (go) go.onclick = () => siteStart(S.siteSel);
}
/** 고른 건물 외곽 → 벽 (mm, 건물 가운데가 원점) · 주변은 그대로 배경 */
async function siteStart(i) {
  const E = envOf(S.model), St = E.site, b = St && St.buildings[i]; if (!b) return; const L = level();
  if (E.siteStore === i) { setPane('split'); engine.view('iso'); return; }
  if (E.siteStore != null || L.walls.length) { if (!(await ask('다른 상가로 도면을 시작할까요?', '지금 그린 벽 · 기물은 그대로 두고 새 상가 외곽으로 벽을 다시 세워요. (되돌리기 가능)'))) return; }
  const cx = b.p.reduce((a, q) => a + q[0], 0) / b.p.length, cy = b.p.reduce((a, q) => a + q[1], 0) / b.p.length;
  /* 작업 방향: 가장 긴 변을 가로로 (상권 배경도 같은 각도로 돌림) → 모눈 · 벽이 건물과 나란해진다 */
  let best = 0, ang = 0; b.p.forEach((q, k) => { const r = b.p[(k + 1) % b.p.length], l = Math.hypot(r[0] - q[0], r[1] - q[1]); if (l > best) { best = l; ang = (Math.atan2(r[1] - q[1], r[0] - q[0]) * 180) / Math.PI; } });
  let rot = -ang; while (rot > 90) rot -= 180; while (rot <= -90) rot += 180; rot = Math.round(rot * 10) / 10; const ra = (rot * Math.PI) / 180, co = Math.cos(ra), si = Math.sin(ra);
  const P = b.p.map(([x, y]) => { const X = (x - cx) * 1000, Y = (y - cy) * 1000; return [Math.round(X * co - Y * si), Math.round(X * si + Y * co)]; });
  const T = S.model.wallT || 150; L.walls = P.map((q, k) => { const r = P[(k + 1) % P.length]; return { id: uid('w'), x1: q[0], y1: q[1], x2: r[0], y2: r[1], t: T, h: L.ceilingH || 2700 }; }).filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 200);
  L.rooms = [{ id: uid('r'), name: b.name || '매장', kind: '홀', pts: P, lift: 0, color: '#c9c3b8', finish: 'tile', slope: null }]; L.slab = P.map((q) => q.slice()); L.openings = []; E.siteStore = i; E.siteAx = cx; E.siteAy = cy; E.siteRot = rot; delete E.site2d; if (SITE.vworld().key) E.siteMap = 'sat'; E.siteRoads = true; E.siteZones = false; E.siteColor = 'white'; /* 작업용: 위성 + 실제 도로선 + 흰 매스만 */
  if (/^상권 · /.test(S.model.name) && b.name) S.model.name = `${b.name} (${St.title || ''})`.slice(0, 40);
  engine.setLevel(L); applyEnv(); commit(); S.siteSel = i; engine.siteMark(null); plan.fit && plan.fit(); setPane('split'); engine.view('iso'); renderProps();
  toast(`상가 외곽으로 벽을 세웠어요 · 긴 벽이 가로가 되게 ${Math.abs(rot)}° 돌려 놓았어요 (작업 방향에서 바꿀 수 있어요)`, 5000);
}

const errTxt = (e) => (e && e.message ? e.message : String(e)) + (e && e.detail ? `\n   → ${e.detail}` : '');
/** AI 진행 상황을 화면에 보여 준다: 단계는 기록(log)에 시각과 함께, "답 쓰는 중" 같은 계속 바뀌는 건 한 줄(live)에 경과 시간과 함께 */
function aiWatch(log, live) {
  const t0 = Date.now(), mmss = () => { const s = Math.round((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }; let cur = '', since = Date.now();
  const paint = () => { if (!live) return; live.hidden = !cur; live.innerHTML = cur ? `<span class="spin"></span><span>${esc(cur)}</span><b>${Math.round((Date.now() - since) / 1000)}초</b>` : ''; };
  const iv = setInterval(paint, 1000);
  cloud.onAiStep((st) => { if (st.phase === 'write') { cur = st.msg; paint(); return; } if (st.phase === 'send' || st.phase === 'read') { cur = st.phase === 'send' ? 'AI 가 문서를 읽는 중…' : st.msg; since = st.phase === 'send' ? Date.now() : since; } if (st.phase === 'done' || st.phase === 'error') cur = '';
    log(`[${mmss()}] ${st.phase === 'error' ? '⛔ ' : ''}${st.msg}${st.detail ? `\n   → ${st.detail}` : ''}`); paint(); });
  return () => { clearInterval(iv); cloud.onAiStep(null); cur = ''; paint(); };
}
const imLog = (t) => { const el = $('#imLog'); if (el) { el.textContent += (el.textContent ? '\n' : '') + t; el.scrollTop = 1e9; } };
async function buildFromDocs(useAI) {
  const W = Math.round(+IMP.w * 1000) || 0, D = Math.round(+IMP.d * 1000) || 0, plans = IMP.files.filter((f) => f.role === 'plan'), dxf = plans.find((f) => /\.dxf$/i.test(f.name)), pics = plans.filter((f) => !/\.dxf$/i.test(f.name));
  const key = !!cloud.aiKey(); let walls = null, openings = [], how = '', aiErr = null;
  /* 1) 벽 */
  if (dxf) { try { const X = CAD.parseDxf(new TextDecoder().decode(dxf.data)), r = CAD.dxfWalls(X, { wallT: 150 }); if (r.walls.length >= 3) { walls = r.walls; how = `DXF "${dxf.name}" 에서 벽 ${walls.length}개`; } else imLog('DXF 에서 벽을 거의 못 찾았어요'); } catch (e) { imLog('DXF 읽기 실패: ' + (e.message || e)); } }
  if (!walls && useAI && pics.length) { imLog(`AI 가 평면도 "${pics[0].name}" 를 읽는 중…`); try { const r = await cloud.readPlan(await cloud.prepFile(pics[0].name, pics[0].data), 0); if (r.walls.length >= 3) { walls = r.walls; openings = r.openings; how = `AI 평면도 읽기 · 벽 ${walls.length}개 · 문/창 ${openings.length}개`; } } catch (e) { aiErr = e; imLog('AI 평면도 읽기 실패 (위 기록 참고)' + (e.code ? ' · ' + e.code : '')); } }
  if (!walls && W >= 2000 && D >= 2000) { how = `치수 ${W / 1000}×${D / 1000}m 사각 매장`; }
  if (!walls && !(W >= 2000 && D >= 2000)) {
    if (!useAI && key && pics.length) { imLog('인터넷 없이 만들 수 있는 자료(DXF · 치수)가 없어 AI 로 이어서 해요…'); return buildFromDocs(true); }
    if (aiErr) throw new Error(`AI 가 평면도를 읽지 못해 멈췄어요 (${aiErr.code || '오류'})${aiErr.detail ? '\n   → ' + aiErr.detail : ''}\n   → 또는 가로 × 세로 치수를 넣고 "인터넷 없이 만들기"`);
    throw new Error(key ? '벽을 만들 수 없어요 · 가로 × 세로 치수를 넣어 주세요' : '벽을 만들 수 없어요 · 가로 × 세로 치수를 넣거나(인터넷 없이), DXF 도면을 올리거나, AI 키를 연결해 주세요');
  }
  imLog('벽: ' + how); await lib2.flush();
  const M = emptyProject(IMP.name || (IMP.files[0] ? IMP.files[0].name.replace(/\.[^.]+$/, '') : '자료로 만든 매장'), W || 8000, D || 6000); await setModel(M); const L = level();
  if (walls) { applyPlan({ walls, openings, height: null }, 'replace'); }
  /* 2) 기물 · 마감: AI(렌더 · 전열 · 평면 그림) → 없으면 프리셋 자동 배치 */
  const b = SH.bounds(L), T = (L.walls[0] && L.walls[0].t || 150) / 2, box = { x0: b[0] + T, y0: b[1] + T, x1: b[2] - T, y1: b[3] - T }, size = { w: box.x1 - box.x0, d: box.y1 - box.y0 };
  /* 자료를 겹쳐 쌓지 않고 "층"처럼 합친다:
   *  ① 평면도 → 벽 · 기물의 기준 (먼저)  ② 전열 · 설비도 → 기준에 없는 설비(콘센트 · 조명 · 급수 · 가스 · 배수 · 에어컨 …)만 더함
   *  ③ 3D 렌더 · 사진 → 새 기물은 넣지 않고, 이미 있는 기물의 색 · 마감 색만 맞춤 (기준 기물이 하나도 없을 때만 렌더로 배치)
   *  같은 종류가 600mm 안에 이미 있으면 다시 넣지 않는다. */
  let aiN = 0, fin = {}, tint = 0, skip = 0; const MEP = /^(outlet|tvport|water|gasvalve|drain|trench|hood|exhaustfan|l_|ac_|e_spk|cctv|airlouver)/;
  const near = (type, x, y, r = 600) => L.items.find((q) => q.type === type && Math.hypot(q.x - x, q.y - y) < r);
  const order = { plan: 0, elec: 1, render: 2 }, files = IMP.files.filter((q) => !/\.dxf$/i.test(q.name)).sort((a, b) => order[a.role] - order[b.role]);
  if (useAI) for (const f of files) { const kind = f.role === 'elec' ? 'elec' : f.role === 'render' ? 'render' : 'plan'; imLog(`AI 가 ${IMP_ROLE[f.role]} "${f.name}" 를 읽는 중… (${kind === 'plan' ? '기준: 벽 · 기물' : kind === 'elec' ? '없는 설비만 더함' : '색 · 마감만 맞춤'})`);
    try { const r = await cloud.readLayout(await cloud.prepFile(f.name, f.data), kind, S.lib, size); fin = kind === 'render' ? { ...fin, ...r.finishes } : { ...r.finishes, ...fin };
      const base = L.items.filter((q) => !MEP.test(q.type)).length; let add = 0, col = 0;
      for (const q of r.items) { const x = Math.round(box.x0 + q.x * size.w), y = Math.round(box.y0 + q.y * size.d);
        if (kind === 'elec' && !MEP.test(q.type)) { skip++; continue; } /* 전열 · 설비도: 가구 · 주방기물은 평면도 것을 씀 */
        if (kind === 'render' && base > 0) { const m = near(q.type, x, y, 1800) || L.items.filter((z) => z.type === q.type).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; if (m && q.color) { m.color = q.color; col++; } continue; } /* 렌더: 색만 */
        if (near(q.type, x, y)) { skip++; continue; }
        const it = mkItem(q.type, x, y, q.rot, { pz: 'ai' }); if (q.w && q.w > 100 && q.w < 12000) it.w = q.w; if (q.d && q.d > 50 && q.d < 6000) it.d = q.d; if (q.color) it.color = q.color; L.items.push(it); aiN++; add++; }
      tint += col; imLog(`  → ${kind === 'render' && base > 0 ? `기물 ${col}개 색 맞춤` : `기물 ${add}개 넣음`}${r.notes.length ? ' · ' + r.notes.join(' / ') : ''}`); } catch (e) { imLog('  → 못 읽었어요' + (e.code ? ' · ' + e.code : ': ' + (e.message || e))); if (e.code === 'E-KEY') break; } }
  if (skip) imLog(`겹치는 것 ${skip}개는 넣지 않았어요 (같은 기물이 이미 있음 · 전열도의 가구 등)`);
  if (!aiN && IMP.kind && SH.BIZ[IMP.kind]) { const pr = SH.BIZ[IMP.kind], r = SH.autoLayout(L, S.lib, { kind: IMP.kind, ratio: pr.ratio, front: 'auto', aisle: aisleOf(), clear: true, scope: { kitchen: 1, hall: 1, mep: 1, finish: 1 }, dish: /hall/.test(IMP.kind) && !/deliv/.test(IMP.kind) }, mkItem, uid); imLog(r.error ? '자동 배치 못 함: ' + r.error : `프리셋 "${pr.name}" 자동 배치 · ${r.placed}개 (주방 규칙 적용)`); }
  if (fin.wall) for (const w of L.walls) if (w.pz !== 'part') w.color = fin.wall;
  if (fin.ceiling) L.ceiling = { ...(L.ceiling || {}), on: true, color: fin.ceiling };
  if (fin.floor) { const fl = L.rooms.length ? L.rooms : null; if (fl) fl.filter((r) => r.kind !== '주방').forEach((r) => { r.color = fin.floor; if (fin.floor2 && fin.floor2 !== fin.floor) r.tex = { img: SH.checker(fin.floor, fin.floor2, 64), size: 1200 }; }); else L.floor = { ...(L.floor || {}), color: fin.floor }; }
  if (fin.counter) for (const it of L.items) if (/counter/.test(it.type)) it.color = fin.counter;
  engine.setLevel(L); applyEnv(); plan.fit(); syncCeilBtn(); commit(); engine.view('iso');
  imLog(`✅ 만들었어요 · 벽 ${L.walls.length} · 기물 ${L.items.length}${aiN ? ` (AI ${aiN})` : ''} · 작업 화면에서 이어서 고치세요`); IMP.files = [];
  setTimeout(() => closeHome(), 1200);
}
/* ---------- 홈: AI 연결 (프로젝트에 들어가지 않고 여기서 키 넣고 · 시험) ---------- */
function homeAiHtml() {
  const pv = cloud.aiProvider(), key = cloud.aiKey(), ok = store.get('byr.aiOk', null), good = ok && ok.ok && ok.key === key.slice(-6);
  return `<section class="hsec hai" id="hAi"><div class="row2"><b>AI 연결</b><span class="stat ${good ? 'ok' : ''}"><i></i>${good ? '연결됨 ✓' : key ? '시험 안 됨' : '키 없음'}</span></div>
    <p class="hint">자료로 매장 만들기 · 시방서 프리셋 · 도면/사진 인식에 써요. 키는 이 기기에만 저장돼요.</p>
    <div class="row"><label class="fld">AI<select id="hPv">${Object.entries(cloud.PROVIDERS).map(([k, P]) => `<option value="${k}" ${k === pv ? 'selected' : ''}>${esc(P.name)}</option>`).join('')}</select></label>
      <label class="fld">모델<input id="hModel" value="${esc(cloud.aiModel(pv))}" spellcheck="false"></label></div>
    <label class="fld">API 키 <small class="hint">${key ? `저장됨 ${esc(key.slice(0, 11))}…${esc(key.slice(-4))} (${key.length}자)` : esc(cloud.PROVIDERS[pv].where)}</small><input id="hKey" type="password" placeholder="${key ? '바꿀 때만 새 키를 붙여 넣으세요' : cloud.PROVIDERS[pv].keyHint}" autocomplete="off"></label>
    ${pv === 'claude' ? `<label class="fld">워크스페이스 ID <small class="hint">(개인 키 sk-ant-usr- 이면 넣기 · 콘솔 → 설정 → 워크스페이스)</small><input id="hWs" value="${esc(cloud.aiWorkspace())}" placeholder="wrkspc_…" spellcheck="false"></label>` : ''}
    <div class="btns"><button class="btn pri" id="hTest">저장하고 연결 시험</button>${key ? '<button class="btn" id="hDel">키 지우기</button>' : ''}</div>
    <div class="kres" id="hRes" ${ok && ok.key === key.slice(-6) ? '' : 'hidden'}>${ok && ok.key === key.slice(-6) ? esc(ok.msg) : ''}</div></section>`;
}
function bindHomeAi() {
  const R = (t, k) => { const el = $('#hRes'); el.hidden = false; el.textContent = t; el.className = 'kres ' + (k || ''); };
  $('#hPv').onchange = (e) => { cloud.setAiProvider(e.target.value); renderHome(); };
  $('#hModel').onchange = (e) => cloud.setAiModel(cloud.aiProvider(), e.target.value);
  if ($('#hDel')) $('#hDel').onclick = () => { cloud.setAiKey(''); store.set('byr.aiOk', null); renderHome(); };
  $('#hTest').onclick = async (e) => {
    const pv = cloud.aiProvider(), typed = $('#hKey').value.replace(/\s+/g, ''), old = cloud.aiKey(pv); if ($('#hWs')) cloud.setAiWorkspace($('#hWs').value.replace(/\s+/g, '')); cloud.setAiModel(pv, $('#hModel').value);
    const k = typed || old; if (!k) return R('⛔ API 키를 붙여 넣어 주세요 · ' + cloud.PROVIDERS[pv].where, 'bad');
    const bad = cloud.keyProblem(k, pv); if (/잘린|빈칸/.test(bad)) return R('⛔ ' + bad, 'bad');
    e.target.disabled = true; R(`⏳ 시험하는 중… (${k.slice(0, 11)}…${k.slice(-4)} · ${k.length}자)`); cloud.setAiKey(k, pv);
    try { const m = await cloud.testKey(pv); store.set('byr.aiOk', { ok: true, key: k.slice(-6), msg: '✅ ' + m, at: Date.now() }); R('✅ ' + m, 'ok'); toast('✅ AI 연결됨'); S.aiOk = true; setTimeout(renderHome, 1200); }
    catch (er) { if (typed && old) cloud.setAiKey(old, pv); store.set('byr.aiOk', { ok: false, key: k.slice(-6), msg: '⛔ ' + er.message, at: Date.now() }); R(`⛔ ${er.message}${er.detail ? '\n→ ' + er.detail : ''}${typed && old ? '\n(새 키가 안 돼서 예전 키로 되돌렸어요)' : ''}`, 'bad'); }
    e.target.disabled = false; };
}
const MKCTX = () => ({ toast, saveFile, ask, askText, onClose: () => { if (!$('#home').hidden) renderHome(); }, open3d: (r) => { showHome(); SF.q = r.title; SF.res = [r]; renderSiteFind(); const b = $('[data-sr="0"]'); if (b) b.click(); } });
async function homeMarketRecs() { const el = $('#hMkRec'); if (!el) return; const L = await marketRecs(); if (!L.length) { el.hidden = true; return; } el.hidden = false;
  el.innerHTML = `<small>최근 상권</small>${L.slice(0, 6).map((m) => `<button data-mkr="${esc(m.id)}" title="${esc(m.cats || '')}"><b>${esc(m.title)}</b>${m.n ? `<span>${esc((m.cats || '').split(' + ')[0])} 1km ${m.n[2]}</span>` : ''}</button>`).join('')}${L.length > 6 ? `<button data-mkr=""><b>전체 ${L.length}곳</b></button>` : ''}`;
  $$('[data-mkr]', el).forEach((b) => (b.onclick = () => openMarket(MKCTX(), b.dataset.mkr || undefined))); }
async function renderHome() {
  { const ok = store.get('byr.aiOk', null), k = cloud.aiKey(); S.aiOk = !!(ok && ok.ok && k && ok.key === k.slice(-6)); }
  const s = cloud.session(), pv = cloud.aiProvider(), key = cloud.aiKey(), last = lib2.lastSync(), list = await lib2.listLocal().catch(() => []), cur = S.model;
  $('#homeVer').textContent = `BYR Next ${APP_VERSION} · ${IS_APP() ? (window.byr ? 'PC' : '모바일') : '웹'}`;
  $('#homeBody').innerHTML = `
    <button class="hcont" data-h="cont">${SV(HI.cont)}<div><b>이어서 작업</b><small>${esc(cur ? cur.name : '')} · ${cur ? `벽 ${cur.levels[cur.activeLevel].walls.length} · 기물 ${cur.levels[cur.activeLevel].items.length}` : ''}</small></div></button>
    <button class="hmarket" data-h="market">${SV(HI.market)}<div><b>상권분석</b><small>주소 · 우편번호로 상가를 찾고, 반경 1km 지도에 하려는 업종의 경쟁사(치킨 · 고깃집 · 호프 …)를 핀으로 · 개업일 · 영업 여부 · 보고서</small></div><em>열기</em></button><div class="hmrec" id="hMkRec"></div>
    <div class="hacts">
      <button data-h="import" class="hbig">${SV(HI.ai)}<span><b>자료로 매장 만들기</b><small>도면 · 3D 렌더 · 전열도를 올리면 BYR 매장으로</small></span></button>
      <button data-h="site" class="hbig">${SV(HI.site)}<span><b>주소로 상가 찾기 · 상권 3D</b><small>주소를 넣으면 반경 500m 건물 · 도로 · 용도지역을 세우고, 상가를 골라 도면 시작</small></span></button>
      <button data-h="sample" class="hbig">${SV(HI.sample)}<span><b>샘플 매장</b><small>페리카나 홀 매장 · 배달 매장</small></span></button>
      <button data-h="new">${SV(HI.new)}새 프로젝트</button><button data-h="open">${SV(HI.open)}파일 열기</button>
      <button data-h="legacy">${SV(HI.legacy)}기존 앱 파일 (JSON)</button><button data-h="account">${SV(HI.cloud)}기존 앱 계정에서</button>
      <button data-h="asset">${SV(HI.model)}3D 모델 가져오기</button>
    </div>
    <section class="hsec"><div class="row2"><b>내 프로젝트 · ${list.length}개</b>${list.length > 6 ? '<button class="btn" data-h="library">전체 · 정리</button>' : ''}</div>
      ${list.some((p) => / \(충돌 사본\)/.test(p.name)) ? `<div class="btns"><button class="btn danger" data-h="clean">충돌 사본 ${list.filter((p) => / \(충돌 사본\)/.test(p.name)).length}개 모두 지우기</button></div>` : ''}
      <div class="hgrid">${list.slice(0, S.homeAll ? 200 : 8).map((p) => `<div class="hp ${cur && p.id === cur.id ? 'on' : ''}"><button class="hpm" data-op="${p.id}"><b>${esc(p.name)}</b><small>${new Date(p.updated).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${s ? (p.dirty ? ' · 올릴 예정' : ' · 동기화됨') : ''}${cur && p.id === cur.id ? ' · 지금 열림' : ''}</small></button>
        <div class="hpa"><button class="go" data-op="${p.id}">작업하기</button><button data-ren="${p.id}">이름 수정</button><button class="del" data-del="${p.id}">삭제</button></div></div>`).join('') || '<p class="hint">아직 저장된 프로젝트가 없어요</p>'}</div>${list.length > 8 && !S.homeAll ? '<button class="btn" data-h="all">모두 보기</button>' : ''}</section>
    <section class="hsec"><div class="row2"><b>계정 · 동기화</b><span class="stat ${s ? 'ok' : ''}"><i></i>${s ? '로그인됨' : '로그인 안 함'}</span></div>
      <p class="hint">${s ? `${esc(s.email || '')} · [계정에 저장] 한 프로젝트만 계정에 올라가요 · 다른 기기에서는 [계정에서 받기]${last ? ` · 마지막 ${new Date(last).toLocaleString('ko-KR')}` : ''}` : '기존 BYR 앱과 같은 이메일 · 비밀번호로 로그인하면, PC 에서 하던 작업을 폰에서 이어 하고 기존 앱 프로젝트도 불러올 수 있어요.'}</p>
      <div class="btns">${s ? '<button class="btn pri" data-h="sync">계정에서 받기</button><button class="btn" data-h="account">기존 앱 프로젝트</button><button class="btn" data-h="logout">로그아웃</button>' : '<button class="btn pri" data-h="login">로그인</button>'}</div><p class="hint" id="hMsg"></p></section>
`;
  $('#homeBody').insertAdjacentHTML(S.aiOk ? 'beforeend' : 'afterbegin', homeAiHtml()); homeMarketRecs();
  bindHomeAi();
  const act = async (h) => {
    if (h === 'cont') return closeHome();
    if (h === 'import') return renderImport();
    if (h === 'site') return renderSiteFind();
    if (h === 'market') return openMarket(MKCTX());
    if (h === 'all') { S.homeAll = true; return renderHome(); }
    if (h === 'new') { closeHome(); return ACT.new(); }
    if (h === 'clean') { if (!(await ask('충돌 사본을 모두 지울까요?', '이름에 "(충돌 사본)" 이 붙은 프로젝트를 이 기기와 계정에서 지워요. 되돌릴 수 없어요.'))) return; const n = await lib2.cleanConflicts(); toast(`충돌 사본 ${n}개를 지웠어요`); return renderHome(); }
    if (h === 'sync') { $('#hMsg').textContent = '계정에서 받는 중…'; try { const r = await lib2.syncNow(); await reloadIfChanged(r); $('#hMsg').textContent = `받음 ${r.down}${r.skip && r.skip.length ? ` · 이 기기에서 고친 ${r.skip.length}개는 건너뜀 (${r.skip.slice(0, 3).join(', ')})` : ''}`; setTimeout(renderHome, 1800); } catch (e) { $('#hMsg').textContent = '동기화 실패: ' + (e.message || e); } return; }
    if (h === 'logout') { if (await ask('로그아웃할까요?', '이 기기의 프로젝트는 그대로 남아요. 계정에서 받아 온 AI 키는 이 기기에서 지워져요.')) { cloud.logout(); renderHome(); } return; }
    closeHome(); const map = { open: 'open', legacy: 'legacy', account: 'account', login: 'account', asset: 'asset', sample: 'sample', library: 'library', ai: 'ai' }; await ACT[map[h]]();
  };
  $$('[data-h]', $('#homeBody')).forEach((b) => (b.onclick = () => act(b.dataset.h)));
  $$('[data-ren]', $('#homeBody')).forEach((b) => (b.onclick = async () => { const id = b.dataset.ren, m = cur && cur.id === id ? cur : await lib2.loadLocal(id); if (!m) return; const nm = await askText('프로젝트 이름 수정', m.name); if (!nm || nm === m.name) return; m.name = nm; if (cur && cur.id === id) { commit(); $('#projName') && ($('#projName').textContent = nm); await saveNow(true); } else { await lib2.saveLocal(m); } renderHome(); }));
  $$('[data-del]', $('#homeBody')).forEach((b) => (b.onclick = async () => { const id = b.dataset.del, it = list.find((q) => q.id === id); if (!(await ask('프로젝트를 삭제할까요?', `"${it ? it.name : ''}" 을 이 기기${s ? '와 계정' : ''}에서 지워요. 되돌릴 수 없어요.`, [{ label: '취소', value: false }, { label: '삭제', value: true, kind: 'danger' }]))) return;
    await lib2.removeEverywhere(id).catch((e) => toast('계정에서 지우지 못했어요 · ' + (e.message || e))); if (cur && cur.id === id) { S.dirty = false; await setModel(emptyProject('새 프로젝트', 8000, 6000)); } toast('삭제했어요'); renderHome(); }));
  $$('[data-op]', $('#homeBody')).forEach((b) => (b.onclick = async () => { if (cur && b.dataset.op === cur.id) return closeHome(); const m = await lib2.loadLocal(b.dataset.op); if (m) { if (!(await leaveOk(m.id))) return; closeHome(); await setModel(m); toast(`"${m.name}" 을 열었어요`); } }));
}

async function boot() {
  buildDock();
  const [lib, shapes] = await Promise.all([fetch('./data/legacy-lib.json').then((r) => r.json()), fetch('./data/legacy-shapes.json').then((r) => r.json())]);
  S.lib = lib.items; S.shapes = shapes; loadMyLib();
  engine = new Engine($('#view'), { lib: S.lib, shapes: S.shapes, assets: S.assets, zOf: (it) => SL.itemZ(level(), it, S.lib) });
  sketch = new Sketch3D(engine, { toast }); /* 3D 펜 (화면 왼쪽 작은 아이콘) */
  secView = new SectionView(engine, { toast, level: () => level(), selWall: () => selWall(), onChange: () => buildDock && buildDock() }); /* 보기 → 단면 투시 */
  initUiMove(); /* 툴바 손잡이 ⋮⋮ */
  if (!DUAL.SIDE) DUAL.initMain({ S, engine, toast, onChange: () => { if (S.panel === 'uiset') renderProps(); } });
  try { bindUi(); } catch (e) { console.warn(e); }
  engine.mepHide = !!store.get('byr.mepHide', false); engine.onSite = (i) => { S.siteSel = i; engine.siteMark(i); S.panel = 'site'; S.propsOpen = true; plan.redraw(); renderProps(); }; SITE.setSiteRedraw(() => { engine.invalidate(true); plan.redraw(); }); window.addEventListener('byr-secrets-in', () => { toast('계정에 저장된 API 키를 받았어요', 2500); renderProps(); if (!$('#home').hidden && $('#homeBody')) { if ($('#sfQ')) renderSiteFind(); } }); engine.onLine = (id) => setSel({ kind: 'line', id });
  lib2.onStatus(setSaveState); $('#btnSave').onclick = () => saveNow(); $('#btnSaveC').onclick = () => saveCloud(); $('#saveState').onclick = () => S.dirty && saveNow();
  engine.onSelect = (id) => { if (id) { S.sel = { kind: 'item', id }; S.propsOpen = true; S.panel = 'props'; } else if (S.sel && S.sel.kind === 'item') S.sel = null; plan && plan.select(S.sel, true); renderProps(); };
  engine.onChange = () => { commit(); renderProps(); };
  const drainMoved = (it) => { if (it && SL.isDrainItem(it, S.lib) && level().rooms.some((r) => r.slope && r.slope.item === it.id)) liveStructure(); else if (it && level().items.some((q) => q.onSlope)) engine.replaceItems(); };
  engine.onMove = (it) => { plan.redraw(); drainMoved(it); }; // 3D 에서 끌면 2D 도 같이 · 배수 기물을 옮기면 구배도 따라감
  plan = new Plan2D($('#plan'), {
    roomScope: () => S.roomScope || 'all',
    level, lib: S.lib, style: () => engine.style, toast,
    under: (g, px1) => siteUnder(g, px1), pickUnder: (p) => sitePick2d(p), extraBounds: () => siteBounds2d(),
    onSelect: (sel) => setSel(sel),
    onLive: (kind, x) => { if (kind === 'structure') liveStructure(); else if (kind === 'item') { engine.moveItem(x); drainMoved(x); } else if (kind === 'item-removed') engine.removeItem(x); else if (kind === 'itemSize') { engine.rebuildItem(x); if (S.sel && S.sel.id === x.id) renderProps(); } },
    freeMove: () => engine.mode === 'move', /* 이동 모드면 마우스로 그냥 끌어도 옮김 */
    onMulti: (ids) => { S.multi = ids; setTimeout(syncModeChip); if (ids.length && plan.tool === 'boxsel') setPlanTool('select'); if (ids.length) { engine.select(null); S.sel = null; S.panel = 'multi'; S.propsOpen = true; } else if (S.panel === 'multi') S.panel = 'props'; renderProps(); },
    onSketch: (pts) => { const L = level(); (L.sketches ||= []).push({ id: uid('k'), pts, color: plan.skColor || '#e8467c', w: plan.skW || 3 }); commit(); },
    onRoom: (pts) => newRoom(pts),
    onLine: (pts) => { if (S.patrol) return patrolDone(pts); if (S.cutRoom) return cutRooms(pts); const L = level(), k = LINEKINDS[plan.lineKind] || LINEKINDS.wire; (L.lines ||= []).push({ id: uid('l'), kind: plan.lineKind || 'wire', pts, ...(k.z === 'below' ? { depth: LOPT.depth } : {}), ...(k.z === 'hang' ? { off: LOPT.off } : {}) }); if (engine.mepHide) { engine.setMepHide(false); store.set('byr.mepHide', false); } engine.rebuildStructure(); commit(); toast(`${k.name} ${Math.round(pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0) / 100) / 10}m 를 그렸어요 · 이어서 다음 선을 그려도 돼요`, 3000); },
    onDim: (d) => { const L = level(); (L.dims ||= []).push({ id: uid('d'), ...d }); engine.rebuildStructure(); commit(); toast(`${Math.round(Math.hypot(d.x2 - d.x1, d.y2 - d.y1)).toLocaleString()} mm · 지우기 도구로 누르면 지워져요`, 2500); },
    onSoffit: (pts) => { const L = level(); (L.soffits ||= []).push({ id: uid('s'), pts, h: L.soffitH || 2400 }); engine.rebuildStructure(); commit(); toast(`천장 가벽을 넣었어요 · 아래면 ${L.soffitH || 2400}mm (층 · 천장 카드에서 높이 바꾸기)`, 3500); },
    onChange: (msg) => { commit(); renderProps(); if (msg) toast(msg, 2200); },
  });
  plan.moveK = engine.moveK || 1; /* 이동 속도 (스타일 메뉴) */
  { const st = plan.setTool.bind(plan); plan.setTool = (t) => { st(t); setTimeout(syncModeChip); }; } syncModeChip();
  $$('[data-tool]').forEach((b) => (b.onclick = () => { setTimeout(syncModeChip); if (b.dataset.tool !== 'select' && b.dataset.tool !== 'boxsel') tuck(); else untuck(); plan.setTool(b.dataset.tool); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q === b))); }));
  $('#btnFit').onclick = () => plan.fit();
  $('#btnRooms').onclick = () => ACT.rooms();
  $('#fitFab').onclick = () => fitItems(SL.slopeBad(level(), S.lib));
  $('#focusExit').onclick = () => { setFocus(null); renderProps(); };
  $$('[data-pane]').forEach((b) => (b.onclick = () => setPane(b.dataset.pane)));
  /* 도구 막대 단추는 작업군을 바꿀 때마다 새로 그려지므로 이벤트는 문서에서 받는다 */
  const sm = $('#styleMenu'), sbA = (v) => { const sb = $('#btnStyle'); if (sb) sb.setAttribute('aria-expanded', v); };
  document.addEventListener('click', (e) => { if (e.target.closest('#btnStyle')) { sm.hidden = !sm.hidden; sbA(String(!sm.hidden)); } else if (e.target.closest('#btnDrawer')) openDrawer(); });
  sm.onclick = (e) => { const sp = e.target.closest('[data-spd]'); if (sp) { setMoveSpeed(+sp.dataset.spd); renderStyleMenu(); toast(sp.textContent); return; } const rs = e.target.closest('[data-res]'); if (rs) { engine.setRes(rs.dataset.res); renderStyleMenu(); toast(`해상도: ${RESV[rs.dataset.res].name}`); return; } const q = e.target.closest('[data-qual]'); if (q) { engine.setQuality(q.dataset.qual); renderStyleMenu(); toast(`화질: ${QUALITY[q.dataset.qual].name}`); return; } const b = e.target.closest('[data-style]'); if (!b) return; setStyle(b.dataset.style); sm.hidden = true; sbA('false'); };
  document.addEventListener('pointerdown', (e) => { if (!sm.hidden && !e.target.closest('#styleMenu, #btnStyle')) { sm.hidden = true; sbA('false'); } });
  setPane(store.get('byr.pane', innerWidth < 700 ? '3d' : 'split')); setStyle(STYLES[store.get('byr.style', 'real')] ? store.get('byr.style', 'real') : 'real');
  renderCatalog();

  $('#btnDrawerClose').onclick = closeDrawer; $('#scrim').onclick = closeDrawer;
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
    if (present.on) { if (e.key === 'Escape') { e.preventDefault(); if (REC.r && REC.r.on) REC.r.stop(); else if ($('#recPop')) $('#recPop').remove(); else if (engine.controls.autoRotate) { engine.setSpin(false); $$('[data-pv="spin"]').forEach((x) => x.setAttribute('aria-pressed', 'false')); toast('360° 보기를 멈췄어요 · Esc 한 번 더 = 발표 끝', 1500); } else present.exit(); } else if (/^[123]$/.test(e.key)) present.set(['free', 'mep', 'light'][+e.key - 1]); if (!/^[wasd]$/i.test(e.key) || e.ctrlKey || e.metaKey) return; } /* 발표 중엔 편집 단축키 끔 */
    if (e.key === 'Escape' && (S.dlgClose || !$('#home').hidden && !S.propsOpen)) { e.preventDefault(); if (S.dlgClose) S.dlgClose(); else closeHome(); return; }
    /* 글자를 치는 칸에서만 단축키를 양보 (슬라이더 · 체크 · 색 · 단추에 초점이 남아 있어도 단축키는 먹게) */
    const ae = document.activeElement, typing = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || (ae.tagName === 'INPUT' && !/^(range|checkbox|radio|color|button|submit|file)$/.test(ae.type)) || ae.isContentEditable);
    const mod = e.ctrlKey || e.metaKey, k = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase(), it = selItem(); /* 한글 자판(ㅋ)이어도 Ctrl+Z 등 같은 키 */
    if (typing) { if (e.key === 'Escape') ae.blur(); return; }
    if (ae && ae !== document.body && /INPUT|BUTTON|SELECT/.test(ae.tagName) && (mod || e.key === 'Escape' || e.key === 'Delete')) ae.blur();
    if (mod && k === 'z') { e.preventDefault(); if (engine.design.active) { (e.shiftKey ? engine.design.redo() : engine.design.undo()) || toast(e.shiftKey ? '다시 할 게 없어요' : '되돌릴 게 없어요', 1200); renderProps(); return; } e.shiftKey ? redo() : undo(); return; }
    if (mod && k === 's') { e.preventDefault(); if (e.shiftKey) saveCloud(); else saveNow(); return; }
    if (e.key === 'F1' || (mod && (e.key === '/' || e.code === 'Slash'))) { e.preventDefault(); showKeys(); return; }
    if (!mod && e.key === 'Tab' && !e.shiftKey && $('#home').hidden && !S.dlgClose) { e.preventDefault(); const on = toggleClean(); toast(on ? '화면 비우기 · Tab 을 다시 누르면 도구가 돌아와요' : '도구를 다시 보여요', 1600); return; }
    if (e.key === 'Escape' && escAll()) { e.preventDefault(); return; }
    if (engine.design.active) { /* 디자인 수정 중: 부품 단축키 */
      const d = engine.design;
      if (mod && k === 'y') { e.preventDefault(); d.redo(); renderProps(); return; }
      if (mod && k === 'c') { e.preventDefault(); d.copyPart(); toast(`부품 ${d.sel + 1} 을 복사했어요 · Ctrl+V 로 붙여넣기`, 1800); return; }
      if (mod && k === 'x') { e.preventDefault(); d.copyPart(); if (!d.removePart(d.sel)) toast('부품이 하나뿐이라 자를 수 없어요'); renderProps(); return; }
      if (mod && k === 'v') { e.preventDefault(); if (!d.pastePart()) toast('복사한 부품이 없어요'); renderProps(); return; }
      if (mod && k === 'd') { e.preventDefault(); d.duplicatePart(d.sel); renderProps(); return; }
      if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); if (!d.removePart(d.sel)) toast('부품이 하나뿐이라 지울 수 없어요'); renderProps(); return; }
      if (!mod && e.key === 'Tab') { e.preventDefault(); d.selectPart((d.sel + (e.shiftKey ? -1 : 1) + d.parts.length) % d.parts.length); return; }
      if (!mod && (k === 'p' || k === 'f')) { d.setMode(k === 'p' ? 'point' : 'face'); renderProps(); return; }
      if (e.key === 'Enter') { endDesign(true); return; }
      return;
    }
    if (engine.walker.active) return;
    if (mod && k === 'b') { e.preventDefault(); S.chordB = Date.now(); toast('Ctrl+B · 이어서 W = 벽 그리기', 1800); return; }
    if (k === 'w' && Date.now() - (S.chordB || 0) < 1800) { e.preventDefault(); S.chordB = 0; setPlanTool('wall'); toast('벽 그리기 · 점을 차례로 찍어요 · Esc 로 끝', 4000); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'r') { e.preventDefault(); if (it) { patchSel({ rot: ((it.rot || 0) + 90) % 360 }, false); renderProps(); } return; }
    if (mod && k === 'x' && it) { e.preventDefault(); S.clipM = null; S.clip = JSON.parse(JSON.stringify(it)); plan.erase(S.sel); toast('잘라냈어요 · Ctrl+V 로 붙여넣기'); return; }
    if (mod && (k === 'o' || k === 'n')) { e.preventDefault(); k === 'n' ? ACT.new() : showHome(); return; }
    if (mod && k === 'p') { e.preventDefault(); ACT.view(); return; }
    if (mod && it && (e.code === 'BracketRight' || e.code === 'BracketLeft' || (e.shiftKey && (e.code === 'Period' || e.code === 'Comma')))) { e.preventDefault(); const f = e.code === 'BracketRight' ? 1.05 : e.code === 'BracketLeft' ? 1 / 1.05 : e.code === 'Period' ? 1.1 : 1 / 1.1; patchSel({ w: Math.max(50, Math.round(it.w * f)), d: Math.max(50, Math.round(it.d * f)), h: Math.max(50, Math.round(it.h * f)) }, false); renderProps(); return; }
    if (!mod && !e.altKey && !it && !(S.multi || []).length && /^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/.test(k)) { e.preventDefault(); keyPan(k, true, e.shiftKey); return; } /* WASD · 방향키 = 화면 옮기기 */
    if (!mod && !e.altKey && it && /^(w|a|s|d)$/.test(k)) { e.preventDefault(); keyPan(k, true, e.shiftKey); return; }
    if ((S.multi || []).length && !mod && (e.key === 'Delete' || e.key === 'Backspace')) { const b = $('[data-mu=del]'); if (b) b.click(); return; }
    if ((S.multi || []).length && mod && k === 'c') { S.clipM = multiItems().map((q) => JSON.parse(JSON.stringify(q))); S.clip = null; toast(`${S.clipM.length}개를 복사했어요`); return; }
    if (mod && k === 'v' && S.clipM && !S.clip) { e.preventDefault(); const n = S.clipM.map((q) => ({ ...JSON.parse(JSON.stringify(q)), id: uid('i'), x: q.x + 400, y: q.y + 400 })); S.clipM = n.map((q) => JSON.parse(JSON.stringify(q))); level().items.push(...n); n.forEach((q) => engine.rebuildItem(q)); commit(); plan.setMulti(n.map((q) => q.id)); return; }
    if (mod && k === 'a' && S.pane !== '3d') { e.preventDefault(); plan.setMulti(level().items.filter((q) => !q.hidden).map((q) => q.id)); return; }
    if (mod && k === 'c' && it) { S.clipM = null; S.clip = JSON.parse(JSON.stringify(it)); toast('복사했어요 · Ctrl+V 로 붙여넣기'); return; }
    if (mod && (k === 'v' || k === 'd') && (k === 'd' ? it : S.clip)) { e.preventDefault(); const src = k === 'd' ? it : S.clip, n = { ...JSON.parse(JSON.stringify(src)), id: uid('i'), x: src.x + 300, y: src.y + 300 }; if (k === 'v') S.clip = { ...S.clip, x: n.x, y: n.y }; level().items.push(n); engine.rebuildItem(n); commit(); setSel({ kind: 'item', id: n.id }); return; }
    if (!mod && it && k === 'r') { patchSel({ rot: ((it.rot || 0) + (e.shiftKey ? 270 : 90)) % 360 }, false); renderProps(); return; }
    if (!mod && it && /^arrow/.test(k)) { e.preventDefault(); const st = e.shiftKey ? 100 : 10, d = { arrowleft: [-st, 0], arrowright: [st, 0], arrowup: [0, -st], arrowdown: [0, st] }[k]; patchSel({ x: it.x + d[0], y: it.y + d[1] }, false); return; }
    if (!mod && !e.altKey && k === 'g') { startWalk(); return; }
    if (!mod && !e.altKey && k === 't') { setPlanTool('measure'); return; }
    if (!mod && !e.altKey && k === 'm') { setMode(engine.mode === 'move' ? 'select' : 'move'); toast(engine.mode === 'move' ? '이동 모드: 그냥 끌어도 기물이 움직여요 (M 으로 끔)' : '선택 모드: 기물은 Ctrl+Shift+끌기로만 움직여요', 3000); return; }
    if (!mod && !e.altKey && k === 'h') { ACT.hist(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) plan.erase(S.sel);
    if (e.key === 'Escape' && (S.patrol || S.cutRoom)) { S.patrol = null; S.cutRoom = false; }
    if (e.key === 'Escape' && S.tucked && plan.tool !== 'select') { plan.picker = null; setPlanTool('select'); untuck(); return; }
    if (e.key === 'Escape' && (S.multi || []).length) { plan.setMulti([]); return; }
    if (e.key === 'Escape') { if (SW.pick) { endPick(); renderProps(); return; } setSel(null); closeDrawer(); }
  });
  window.addEventListener('keyup', (e) => { const k = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase(); keyPan(k, false); });
  window.addEventListener('blur', () => keyPan(null, false));
  for (const [sel, p] of [['#plan', '2d'], ['#view', '3d']]) { const el = $(sel); if (el) el.addEventListener('pointerenter', () => (S.hoverPane = p)); }
  // 파일을 끌어다 놓기
  let depth = 0; const drop = $('#drop');
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; drop.hidden = false; } });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.hidden = true; } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  /* PC: 기물 목록에서 3D · 2D 화면으로 바로 끌어다 놓기 */
  $('#catalog').addEventListener('dragstart', (e) => { const b = e.target.closest && e.target.closest('[data-add]'); if (!b) return; e.dataTransfer.setData('application/x-byr-item', b.dataset.add); e.dataTransfer.effectAllowed = 'copy'; setTimeout(() => document.body.classList.add('catdrag'), 0); });
  $('#catalog').addEventListener('dragend', () => document.body.classList.remove('catdrag'));
  const dropItem = (e, id) => {
    document.body.classList.remove('catdrag'); let at = null; const inPlan = e.target.closest && e.target.closest('#plan'), inView = e.target.closest && e.target.closest('#view');
    if (inPlan && plan) { const m = plan.evMm(e); at = { x: Math.round(m.x / 10) * 10, y: Math.round(m.y / 10) * 10 }; }
    else if (inView) at = engine.floorAt(e, level().elev || 0);
    if (!at) { toast('2D 도면이나 3D 화면 위에 놓아 주세요'); return; } addFromCatalog(id, at);
  };
  window.addEventListener('drop', async (e) => { const it = e.dataTransfer && e.dataTransfer.getData('application/x-byr-item'); if (it) { e.preventDefault(); depth = 0; drop.hidden = true; dropItem(e, it); return; } e.preventDefault(); depth = 0; drop.hidden = true; const fs = await Promise.all([...e.dataTransfer.files].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))); handleFiles(fs); });

  // 마지막으로 작업하던 프로젝트를 연다 (자동 저장)
  setTimeout(() => dropIntro(), 12000); /* 안전장치: 무엇이 오래 걸려도 12초 뒤엔 로딩 화면을 걷는다 */
  if (DUAL.SIDE) { /* 듀얼 모니터 보조 창: 메인 창 모델을 따라감 */
    await followModel(emptyProject()); setMode('orbit');
    window.BYR = { S, engine, plan, setModel, level, setPane, secView };
    DUAL.initSide({ S, engine, secView, setPane, toggleClean, followModel, showHome, setMode }); initLang(); setTimeout(() => dropIntro(true), 300); return;
  }
  let first = null; try { const id = lib2.lastId(); first = id && (await lib2.loadLocal(id)); } catch (e) { console.warn(e); }
  await setModel(first || emptyProject());
  window.__goBack = goBack; window.BYR = { DUAL, secView, S, engine, present, plan, mkItem, emptyProject, setModel, level, commit, uid, openJson, FORMAT, setStyle, setPane, setSel, applyPlan, placeDetected, lib2, SL, newRoom, setFocus, fitItems, startDesign, endDesign, exportRoom, setDrain, SW, ACT, applyEnv, cloud, startPick, endPick, dxfLoad }; // 디버깅 · 자동 테스트용
  initLang(); checkUpdate(); showHome(); // 켤 때 홈 (이어서 작업 · 내 프로젝트 · 계정 · AI)
  if ($('#introVer')) $('#introVer').textContent = 'v' + APP_VERSION;
  const wait = Math.max(1200, 3000 - performance.now()); /* 로딩 화면: 처음부터 최소 3초 · 준비가 끝난 뒤에도 1.2초 더 */ setTimeout(() => dropIntro(), wait);
  // 계정 동기화: 켤 때 · 1분마다 · 앱으로 돌아올 때
  /* 2.1.32~: 프로젝트는 자동으로 주고받지 않는다 ([계정에 저장] · [계정에서 받기]). API 키만 켤 때 · 돌아올 때 맞춘다 */
  const keys = () => { if (cloud.session() && document.visibilityState !== 'hidden') lib2.syncKeys().catch(() => {}); };
  keys(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keys(); });
}
boot().catch((e) => { console.error(e); const it = document.querySelector('#intro'); if (it) it.remove(); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:auto 12px 12px 12px;background:#300;color:#fff;padding:12px;border-radius:8px;white-space:pre-wrap;z-index:99">시작하지 못했어요: ${esc(e.message || e)}</pre>`); });
