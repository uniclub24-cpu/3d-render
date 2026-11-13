// 앱 상태 · 파일 관리(기존 데이터 가져오기 포함) · 태블릿 UI 연결
import { Engine } from './main.js';
import { findLegacyProjects, convertLegacy, isNextProject, emptyProject, reportText, defaultLight, FORMAT, migrate } from './legacy.js';
import { loadAsset, exportGLB, exportOBJ, openFiles, saveFile, extOf, ASSET_EXT, bytesToB64, b64ToBytes } from './io.js';
import { MAT_LABEL } from './materials.js';
import { STYLES } from './styles3d.js';
import { Plan2D, KINDS } from './plan2d.js';
import * as cloud from './cloud.js';
import * as lib2 from './store.js';
import * as SL from './slope.js';
import { ENVTYPES, ENVCOL, ENVLV, envOf, envFront } from './env.js';
import { bakeParts, applyParts } from './design.js';
export const APP_VERSION = '2.1';

const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const S = { model: null, lib: {}, shapes: {}, assets: new Map(), undo: [], redo: [], propsOpen: false, sel: null, panel: 'props', pane: 'split' };
let engine, plan;
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const level = () => (S.model ? S.model.levels[S.model.activeLevel] : null);
const selItem = () => level().items.find((i) => i.id === engine.selId) || null;

/* ---------- 알림 ---------- */
let toastT = 0;
function toast(msg, ms = 4200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }

/* ---------- 모델 · 되돌리기 ---------- */
const snap = () => JSON.stringify(S.model);
function commit() { S.undo.push(S.last); if (S.undo.length > 60) S.undo.shift(); S.redo.length = 0; S.last = snap(); syncBar(); afterChange(); }
/** 고칠 때마다: 자동 저장 · 조정 필요 다시 세기 · 2D 다시 그리기 */
function afterChange() { lib2.autosave(S.model); refreshBad(); plan && plan.redraw(); }
function restore(json) {
  const sel = S.sel; S.model = JSON.parse(json); S.last = json; engine.setLevel(level()); applyEnv(); afterChange();
  const L = level(), still = sel && ({ item: L.items, wall: L.walls, opening: L.openings, room: L.rooms }[sel.kind] || []).some((q) => q.id === sel.id);
  setSel(still ? sel : null); syncBar();
}
function undo() { if (!S.undo.length) return; S.redo.push(S.last); restore(S.undo.pop()); }
function redo() { if (!S.redo.length) return; S.undo.push(S.last); restore(S.redo.pop()); }
async function setModel(model, fit = true) {
  if (S.model && S.model !== model) await lib2.flush();
  S.model = migrate(model, S.lib); S.undo.length = S.redo.length = 0; S.last = snap(); setFocus(null);
  await restoreAssets(); S.sel = null; engine.setLevel(level()); applyEnv(); if (fit) { engine.view('iso'); plan.fit(); } plan.select(null, true); syncBar(); renderProps();
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
function setStyle(name) {
  engine.setStyle(name); store.set('byr.style', name); plan.redraw();
  $('#styleMenu').innerHTML = Object.entries(STYLES).map(([k, st]) => `<button role="menuitemradio" aria-checked="${k === name}" data-style="${k}"><b>${st.name}</b><small>${st.hint}</small></button>`).join('');
  if (S.propsOpen && !S.sel) renderProps();
}

function applyEnv() { const L = level(); engine.setEnv(S.model.env ? envOf(S.model) : envOf(S.model), { slabH: L.slabH || 3300, ceilingH: L.ceilingH || 2700, above: false }); }

/* ---------- 파일 관리 ---------- */
// 프로젝트에 넣어 둔 외부 에셋(base64)을 다시 읽어 캐시에 올린다
async function restoreAssets() {
  for (const [key, a] of Object.entries(S.model.assets || {})) { if (S.assets.has(key)) continue; try { const r = await loadAsset(a.name, b64ToBytes(a.b64)); S.assets.set(key, r); } catch (e) { console.warn('asset', a.name, e); } }
}
/** JSON 파일 하나: 새 형식이면 열고, 기존 앱 형식이면 변환해서 연다 */
async function openJson(name, bytes) {
  let json; try { json = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { toast(`${name}: JSON 을 읽지 못했어요`); return false; }
  if (isNextProject(json)) { await setModel(json); toast(`"${json.name}" 을 열었어요`); return true; }
  const found = findLegacyProjects(json);
  if (!found.length) { toast(`${name}: 프로젝트 데이터를 찾지 못했어요 (기존 앱의 "내보내기 → JSON" 파일인지 확인해 주세요)`); return false; }
  const { model, report } = convertLegacy(found[0], S.lib);
  await setModel(model); toast(reportText(report) + (found.length > 1 ? ` · 파일 안 ${found.length}개 중 첫 번째` : ''), 9000);
  console.info('[legacy import]', report); return true;
}
async function importAsset(name, bytes) {
  try {
    const a = await loadAsset(name, bytes); S.assets.set(a.key, a);
    (S.model.assets ||= {})[a.key] = { name, b64: bytesToB64(bytes) }; // 프로젝트 파일에 함께 저장
    const c = engine.centerOnFloor(), it = { id: uid('i'), type: 'asset', name: name.replace(/\.[^.]+$/, ''), x: c.x, y: c.y, elev: 0, rot: 0, ...a.mm, color: null, mat: null, asset: { key: a.key }, light: null };
    level().items.push(it); engine.rebuildItem(it); engine.select(it.id); commit(); toast(`"${it.name}" 을 가져왔어요 · ${a.mm.w}×${a.mm.d}×${a.mm.h}mm (속성에서 크기를 바꿀 수 있어요)`);
  } catch (e) { console.error(e); toast(`${name}: 3D 파일을 읽지 못했어요 (${e.message || e})`); }
}
async function handleFiles(files) { for (const f of files) { const ext = extOf(f.name); if (ext === 'json') await openJson(f.name, f.data); else if (ASSET_EXT.includes(ext)) await importAsset(f.name, f.data); else toast(`${f.name}: 지원하지 않는 형식이에요`); } }
const safeName = () => (S.model.name || 'byr').replace(/[\\/:*?"<>|]/g, '_');

const ACT = {
  new: async () => { await setModel(emptyProject()); toast('새 프로젝트 · 자동 저장돼요'); },
  library: () => { S.panel = 'library'; S.propsOpen = true; renderProps(); },
  rooms: () => { S.panel = 'rooms'; S.propsOpen = true; renderProps(); },
  bg: () => { S.panel = 'bg'; S.propsOpen = true; renderProps(); },
  open: async () => handleFiles(await openFiles({ title: 'BYR 프로젝트', extensions: ['json'] })),
  save: async () => { const p = await saveFile({ title: 'BYR 프로젝트', defaultName: safeName() + '.byr.json', extensions: ['json'], data: JSON.stringify(S.model) }); if (p) toast('저장했어요'); },
  legacy: async () => handleFiles(await openFiles({ title: '기존 앱 JSON', extensions: ['json'], multi: false })),
  sample: async () => { const r = await fetch('./data/legacy-sample.json'); await openJson('샘플', new Uint8Array(await r.arrayBuffer())); },
  asset: async () => handleFiles(await openFiles({ title: '3D 에셋', extensions: ASSET_EXT, multi: true })),
  glb: async () => { setSel(null); const data = await engine.withRealMaterials(() => exportGLB(engine.world)); const p = await saveFile({ title: 'glTF 바이너리', defaultName: safeName() + '.glb', extensions: ['glb'], data }); if (p) toast(`GLB 로 내보냈어요 (${(data.byteLength / 1e6).toFixed(1)}MB) · Blender · D5 Render · Twinmotion 에서 가져오기`); },
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
  if (S.panel === 'bg') return renderBg(body);
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
    if (b.dataset.a === 'fit') fitItems([t.id], '바닥 위로 올렸어요');
    if (b.dataset.a === 'unfit') { delete t.onSlope; engine.moveItem(t); commit(); renderProps(); }
    if (b.dataset.a === 'drain') { const r = SL.roomAt(level(), t.x, t.y) || nearestRoom(t.x, t.y); if (!r) return toast('이 배수 기물이 놓인 공간이 없어요 · 먼저 2D 에서 공간(사각형 · 선)을 그려 주세요'); setDrain(r, t, `"${t.name}" 쪽으로 구배를 잡았어요 · 각도만 바꾸면 돼요`); setSel({ kind: 'room', id: r.id }); }
  }));
}

/* ----- 공간 (태그 · 단 · 바닥 · 구배 · 공간만 작업 · 별도 보관) ----- */
const FLOORS = { tile: '타일', epoxy: '에폭시', concrete: '콘크리트', wood: '목재', marble: '대리석', turf: '인조잔디' };
const SW = { pct: 1, pick: null, a: null };
function nearestRoom(x, y) { let best = null; for (const r of level().rooms) { const d = SL.polyEdgeDist(r.pts, x, y); if (d < 400 && (!best || d < best.d)) best = { d, r }; } return best && best.r; }
function newRoom(pts) {
  const L = level(), n = L.rooms.length + 1, r = { id: uid('r'), name: `공간 ${n}`, kind: '기타', pts, lift: 0, color: '#c9c3b8', finish: 'tile', slope: null };
  L.rooms.push(r); engine.rebuildStructure(); commit(); setSel({ kind: 'room', id: r.id }); toast('공간을 만들었어요 · 오른쪽에서 태그(주방 · 홀 …)를 고르세요');
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
    <div class="row">${num('단 높이 (mm)', 'lift', r.lift || 0)}<label class="fld">마감<select data-r="finish">${Object.entries(FLOORS).map(([k, n]) => `<option value="${k}" ${r.finish === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="fld">색<input type="color" data-r="color" value="${/^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#c9c3b8'}"></label></div>
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
    <p class="hint">2D 에서 공간을 고르면 꼭짓점(동그라미)을 끌어 모양을 바꿀 수 있어요.</p>`;
  const live = () => { engine.rebuildStructure(); };
  $$('[data-r]', body).forEach((i) => { const k = i.dataset.r; if (k === 'color') { i.oninput = () => { r.color = i.value; live(); }; i.onchange = () => commit(); return; } i.onchange = () => { r[k] = k === 'name' ? i.value.trim() || r.name : i.value; live(); commit(); renderProps(); }; });
  $$('[data-k]', body).forEach((i) => (i.onchange = () => { r.lift = clamp(Math.round(+i.value || 0), 0, 3000); live(); commit(); renderProps(); }));
  $$('[data-kind]', body).forEach((b) => (b.onclick = () => { const old = r.kind; r.kind = b.dataset.kind; if (!r.name || /^공간 \d+$/.test(r.name) || r.name === old) r.name = level().rooms.some((q) => q !== r && q.name === r.kind) ? `${r.kind} ${level().rooms.filter((q) => q.kind === r.kind).length}` : r.kind; commit(); renderProps(); }));
  const applyPct = (v) => { SW.pct = clamp(Math.round((+v || 1) * 100) / 100, 0.1, 25); if (r.slope && r.slope.drain) { r.slope.deg = SL.pct2deg(SW.pct); live(); commit(); renderProps(); } else startPick(r, 'pt'); };
  $$('[data-pct]', body).forEach((b) => (b.onclick = () => applyPct(+b.dataset.pct)));
  $('#swPct').onchange = (e) => applyPct(e.target.value); $('#swDeg').onchange = (e) => applyPct(Math.tan(((+e.target.value || 0.5) * Math.PI) / 180) * 100);
  $$('[data-dr]', body).forEach((b) => (b.onclick = () => { const it = L.items.find((q) => q.id === b.dataset.dr); if (it) setDrain(r, it, `"${it.name}" 쪽으로 구배를 잡았어요`); renderProps(); }));
  $$('[data-ra]', body).forEach((b) => (b.onclick = () => {
    const a = b.dataset.ra;
    if (a === 'pt' || a === 'line') { if (SW.pick === a) endPick(); else startPick(r, a); renderProps(); }
    if (a === 'fit') fitItems(bad.map((x) => x.id));
    if (a === 'fitall') fitItems(its.map((x) => x.id), `"${r.name}" 안 기물을 모두 구배 · 단 위에 올렸어요`);
    if (a === 'unfit') { let n = 0; for (const it of its) if (it.onSlope) { delete it.onSlope; n++; } engine.replaceItems(); commit(); renderProps(); toast(n ? `${n}개를 원래 높이로 돌렸어요` : '올린 기물이 없어요'); }
    if (a === 'off') { r.slope = null; L.items = L.items.filter((it) => !(it.autoDrain && it.room === r.id && it.type === 'drain')); engine.setLevel(L); commit(); renderProps(); toast('구배를 지웠어요'); }
    if (a === 'del') { if (S.focus === r.id) setFocus(null); plan.erase({ kind: 'room', id: r.id }); }
    if (a === 'focus') { setFocus(S.focus === r.id ? null : r.id); renderProps(); }
    if (a === 'export') exportRoom(r);
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
function renderRooms(body) {
  const L = level(); $('#propsTitle').textContent = '공간 목록';
  body.innerHTML = `<p class="hint">2D 도구의 "공간 (사각형)" 으로 끌거나 "공간 (선)" 으로 꼭짓점을 차례로 눌러 공간을 만들고 태그를 붙여요. 누르면 그 공간만 따로 작업해요.</p>
    <div class="plist">${L.rooms.length ? L.rooms.map((r) => `<button data-room="${r.id}"><b><i class="dot" style="background:${KINDS[r.kind] || '#ccc'}"></i>${esc(r.name)}</b><small>${esc(r.kind || '')} · ${(SL.polyArea(r.pts) / 1e6).toFixed(1)}㎡ · 기물 ${L.items.filter((it) => SL.pointInPoly(it.x, it.y, r.pts)).length}개${r.slope ? ' · 구배' : ''}${r.lift ? ` · 단 +${r.lift}` : ''}</small></button>`).join('') : '<p class="hint">아직 공간이 없어요</p>'}</div>
    ${S.focus ? '<div class="btns"><button class="btn" data-ra="all">전체 보기로</button></div>' : ''}`;
  $$('[data-room]', body).forEach((b) => (b.onclick = () => { setFocus(b.dataset.room); setSel({ kind: 'room', id: b.dataset.room }); }));
  const a = $('[data-ra=all]', body); if (a) a.onclick = () => { setFocus(null); renderProps(); };
}

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
  $('#propsTitle').textContent = `디자인 수정 · ${DE.it.name}`;
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
    <div class="btns"><button class="btn" data-a="split">가운데서 나누기</button><button class="btn danger" data-a="del">삭제</button></div>`;
  $$('[data-k]', body).forEach((i) => {
    const k = i.dataset.k;
    if (k === 'color') { i.oninput = () => { w.color = i.value; liveStructure(); }; i.onchange = () => commit(); return; }
    i.onchange = () => {
      if (k === 'finish') w.finish = i.value;
      else { const v = +i.value; if (!Number.isFinite(v) || v <= 0) return renderProps();
        if (k === 'len') { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, nl = clamp(v, 100, 100000), nx = Math.round(w.x1 + ((w.x2 - w.x1) / L) * nl), ny = Math.round(w.y1 + ((w.y2 - w.y1) / L) * nl);
          for (const o of level().walls) { if (o === w) continue; if (Math.hypot(o.x1 - w.x2, o.y1 - w.y2) < 1) { o.x1 = nx; o.y1 = ny; } if (Math.hypot(o.x2 - w.x2, o.y2 - w.y2) < 1) { o.x2 = nx; o.y2 = ny; } }
          w.x2 = nx; w.y2 = ny; }
        else w[k] = clamp(v, k === 't' ? 30 : 100, k === 't' ? 1000 : 20000); }
      engine.rebuildStructure(); commit(); renderProps();
    };
  });
  $$('[data-a]', body).forEach((b) => (b.onclick = () => {
    if (b.dataset.a === 'del') return plan.erase({ kind: 'wall', id: w.id });
    const mx = Math.round((w.x1 + w.x2) / 2), my = Math.round((w.y1 + w.y2) / 2), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), n = { ...w, id: uid('w'), x1: mx, y1: my };
    for (const o of level().openings) if (o.wall === w.id && o.t > L / 2) { o.wall = n.id; o.t -= L / 2; }
    w.x2 = mx; w.y2 = my; level().walls.push(n); engine.rebuildStructure(); commit(); toast('벽을 둘로 나눴어요');
  }));
}
const OPS = { door1: '외문', door2: '양문', auto: '자동문', slide: '미닫이문', window: '창', full: '통창', pass: '배식구', slidepass: '미닫이 배식구', arch: '아치 (뚫린 문)' };
function renderOpening(body, o) {
  $('#propsTitle').textContent = OPS[o.type] || '문 · 창';
  body.innerHTML = `<label class="fld">종류<select data-k="type">${Object.entries(OPS).map(([k, n]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <div class="row">${num('폭', 'w', o.w)}${num('높이', 'h', o.h)}${num('바닥에서', 'sill', o.sill)}</div>
    <div class="row">${num('벽 시작점에서 (가운데)', 't', o.t)}</div>
    <label class="tog">간유리 띠<input type="checkbox" data-k="frost" ${o.frost ? 'checked' : ''}></label>
    <p class="hint">2D 에서 끌면 벽을 따라 움직여요.</p>
    <div class="btns"><button class="btn danger" data-a="del">삭제</button></div>`;
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
    try { const r = await cloud.readPlan(await cloud.prepFile(f.name, f.data), +$('#pW').value || 0); applyPlan(r, $('#pMode').value); msg(`벽 ${r.walls.length}개 · 문/창 ${r.openings.length}개를 그렸어요 (도면 가로 ${r.widthMm.toLocaleString()}mm 기준)`); }
    catch (e) { console.error(e); msg('읽지 못했어요: ' + (e.message || e)); }
    $('#pGo').disabled = false;
  };
  $('#phGo').onclick = async () => {
    const f = (await openFiles({ title: '현장 사진', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f || !selWall()) return;
    msg(`${PV.name} 가 사진을 보는 중…`); $('#phGo').disabled = true;
    try { const wall = selWall(), objs = await cloud.readPhoto(await cloud.prepFile(f.name, f.data), Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1), S.lib); const n = placeDetected(wall, objs); msg(`${n}개를 넣었어요 · 위치는 끌어서 다듬으세요`); }
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
async function boot() {
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
    onRoom: (pts) => newRoom(pts),
    onChange: (msg) => { commit(); renderProps(); if (msg) toast(msg, 2200); },
  });
  $$('[data-tool]').forEach((b) => (b.onclick = () => { plan.setTool(b.dataset.tool); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q === b))); }));
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
  $('#levelSel').onchange = (e) => { S.model.activeLevel = +e.target.value; S.sel = null; engine.setLevel(level()); engine.view('iso'); plan.fit(); plan.select(null, true); renderProps(); };
  const fm = $('#fileMenu'), fb = $('#btnFile');
  fb.onclick = () => { fm.hidden = !fm.hidden; fb.setAttribute('aria-expanded', String(!fm.hidden)); };
  fm.onclick = async (e) => { const a = e.target.closest('[data-act]'); if (!a) return; fm.hidden = true; fb.setAttribute('aria-expanded', 'false'); try { await ACT[a.dataset.act](); } catch (er) { console.error(er); toast('작업을 마치지 못했어요: ' + (er.message || er)); } };
  document.addEventListener('pointerdown', (e) => { if (!fm.hidden && !e.target.closest('#fileMenu, #btnFile')) { fm.hidden = true; fb.setAttribute('aria-expanded', 'false'); } });
  window.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (engine.design.active) { engine.design.undo(); return; } e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ACT.save(); }
    if (engine.design.active) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) plan.erase(S.sel);
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
  window.BYR = { S, engine, plan, openJson, FORMAT, setStyle, setPane, setSel, applyPlan, placeDetected, lib2, SL, newRoom, setFocus, fitItems, startDesign, endDesign, exportRoom, setDrain, SW, ACT, applyEnv, cloud, startPick, endPick }; // 디버깅 · 자동 테스트용
  toast(first ? `"${first.name}" 을 이어서 열었어요 · 고칠 때마다 자동 저장돼요` : '왼쪽 2D 도면에서 벽을 그리면 오른쪽 3D 에 바로 세워져요 · 고칠 때마다 자동 저장돼요 · 파일 메뉴에서 기존 앱 작업물을 불러오세요', 8000);
  // 계정 동기화: 켤 때 · 1분마다 · 앱으로 돌아올 때
  const sync = () => { if (!cloud.session() || document.visibilityState === 'hidden') return; lib2.syncNow().then(reloadIfChanged).catch(() => {}); };
  sync(); setInterval(sync, 60000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
}
boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:auto 12px 12px 12px;background:#300;color:#fff;padding:12px;border-radius:8px;white-space:pre-wrap;z-index:99">시작하지 못했어요: ${esc(e.message || e)}</pre>`); });
