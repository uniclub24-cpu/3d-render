// 앱 상태 · 파일 관리(기존 데이터 가져오기 포함) · 태블릿 UI 연결
import { Engine } from './main.js';
import { findLegacyProjects, convertLegacy, isNextProject, emptyProject, reportText, defaultLight, FORMAT } from './legacy.js';
import { loadAsset, exportGLB, exportOBJ, openFiles, saveFile, extOf, ASSET_EXT, bytesToB64, b64ToBytes } from './io.js';
import { MAT_LABEL } from './materials.js';
import { STYLES } from './styles3d.js';
import { Plan2D } from './plan2d.js';
import * as cloud from './cloud.js';

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
function commit() { S.undo.push(S.last); if (S.undo.length > 60) S.undo.shift(); S.redo.length = 0; S.last = snap(); syncBar(); plan && plan.redraw(); }
function restore(json) {
  const sel = S.sel; S.model = JSON.parse(json); S.last = json; engine.setLevel(level()); plan.redraw();
  const L = level(), still = sel && (sel.kind === 'item' ? L.items : sel.kind === 'wall' ? L.walls : L.openings).some((q) => q.id === sel.id);
  setSel(still ? sel : null); syncBar();
}
function undo() { if (!S.undo.length) return; S.redo.push(S.last); restore(S.undo.pop()); }
function redo() { if (!S.redo.length) return; S.undo.push(S.last); restore(S.redo.pop()); }
async function setModel(model, fit = true) {
  S.model = model; S.undo.length = S.redo.length = 0; S.last = snap();
  await restoreAssets(); S.sel = null; engine.setLevel(level()); if (fit) { engine.view('iso'); plan.fit(); } plan.select(null, true); syncBar(); renderProps();
}
function syncBar() {
  $('#projName').textContent = S.model.name; document.title = S.model.name + ' · BYR Next';
  $('#btnUndo').disabled = !S.undo.length; $('#btnRedo').disabled = !S.redo.length;
  const ls = $('#levelSel'); ls.hidden = S.model.levels.length < 2; ls.innerHTML = S.model.levels.map((l, i) => `<option value="${i}" ${i === S.model.activeLevel ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
}

/* ---------- 선택 (2D · 3D 공통) ---------- */
function setSel(sel) {
  S.sel = sel || null; plan.select(S.sel, true);
  if (S.sel && S.sel.kind === 'item') { if (engine.selId !== S.sel.id) engine.select(S.sel.id); }
  else { if (engine.selId) engine.select(null); const L = level(), w = S.sel && (S.sel.kind === 'wall' ? S.sel.id : (L.openings.find((o) => o.id === S.sel.id) || {}).wall); engine.highlight(w || null); }
  if (S.sel) { S.propsOpen = true; S.panel = 'props'; } renderProps();
}
let liveT = 0;
const liveStructure = () => { if (liveT) return; liveT = requestAnimationFrame(() => { liveT = 0; engine.rebuildStructure(); }); };
const selWall = () => (S.sel && S.sel.kind === 'wall' ? level().walls.find((w) => w.id === S.sel.id) : null);
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
  new: () => setModel(emptyProject()),
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
  const it = { id: uid('i'), type: id, name: L.name, x: c.x, y: c.y, elev, rot: 0, w: L.w, d: L.d, h: L.h, color: null, mat: null, parts: null, light: L.light ? defaultLight(L) : null, kw: L.kw };
  lv.items.push(it); engine.rebuildItem(it); engine.select(it.id); commit(); closeDrawer(); setMode('move'); toast(`${L.name} 을 놓았어요 · 끌어서 자리를 잡으세요`);
}
function patchSel(patch, rebuild = true) { const it = selItem(); if (!it) return; Object.assign(it, patch); if (rebuild) engine.rebuildItem(it); else engine.moveItem(it); commit(); }

/* ---------- 속성 카드 (오른쪽 팝오버) ---------- */
const num = (label, key, v, step = 10) => `<label class="fld">${label}<input type="number" inputmode="numeric" data-k="${key}" value="${Math.round(v)}" step="${step}"></label>`;
function renderProps() {
  const el = $('#props'), body = $('#propsBody'); el.hidden = !S.propsOpen; $('#fab').setAttribute('aria-expanded', String(S.propsOpen)); if (!S.propsOpen) return;
  if (S.panel === 'ai') return renderAi(body);
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
      <p class="hint">기물을 톡 누르면 색 · 크기 · 조명을 바꿀 수 있어요.</p>`;
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
  }));
}

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
    $('#aLogin').onclick = async () => { $('#aMsg').textContent = '로그인 중…'; try { await cloud.login($('#aEmail').value.trim(), $('#aPw').value); renderProps(); } catch (e) { $('#aMsg').textContent = e.message || String(e); } };
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
  const key = cloud.aiKey(), w = selWall(), s = cloud.session();
  body.innerHTML = `<div class="sec">AI 키 (Anthropic)</div>
    <p class="hint">${key ? '이 기기에 키가 있어요 · ' + esc(key.slice(0, 10)) + '…' : '키가 없어요. 기존 앱에서 "계정에 저장"했다면 계정에 로그인하면 자동으로 들어와요.'}</p>
    <div class="row"><label class="fld">키<input type="password" id="kIn" placeholder="sk-ant-…" autocomplete="off"></label></div>
    <div class="btns"><button class="btn" id="kSave">이 기기에 저장</button>${s ? '<button class="btn" id="kAcct">계정에서 받기</button><button class="btn" id="kPut">계정에 저장</button>' : ''}${key ? '<button class="btn danger" id="kDel">지우기</button>' : ''}</div>
    <div class="sec">도면 → 벽 · 문/창</div>
    <p class="hint">도면 사진 · 스캔 · PDF 를 고르면 Claude 가 벽 중심선과 문/창 자리를 읽어 바로 2D · 3D 에 그려요. 치수선을 읽어 축척을 잡고, 못 읽으면 아래 가로 길이를 써요.</p>
    <div class="row"><label class="fld">도면 가로 실제 길이 mm (선택)<input type="number" id="pW" inputmode="numeric" placeholder="예: 12000"></label>
    <label class="fld">기존 벽<select id="pMode"><option value="replace">지우고 바꾸기</option><option value="add">그대로 두고 더하기</option></select></label></div>
    <div class="btns"><button class="btn" id="pGo" ${key ? '' : 'disabled'}>도면 파일 고르기</button></div>
    <div class="sec">현장 사진 → 기물</div>
    <p class="hint">${w ? `고른 벽(${Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1)).toLocaleString()}mm)을 방 안에서 정면으로 찍은 사진을 고르세요. 보이는 기물 · 문/창을 그 벽 앞에 놓아요.` : '2D 도면에서 사진에 찍힌 벽을 먼저 톡 눌러 고른 뒤, 다시 이 메뉴를 여세요.'}</p>
    <div class="btns"><button class="btn" id="phGo" ${key && w ? '' : 'disabled'}>벽 사진 고르기</button></div>
    <p class="hint" id="aiMsg"></p>`;
  const msg = (t) => ($('#aiMsg').textContent = t);
  $('#kSave').onclick = () => { const v = $('#kIn').value.trim(); if (!v) return msg('키를 넣어 주세요'); cloud.setAiKey(v); renderProps(); toast('AI 키를 이 기기에 저장했어요'); };
  if ($('#kDel')) $('#kDel').onclick = () => { cloud.setAiKey(''); renderProps(); };
  if ($('#kAcct')) $('#kAcct').onclick = async () => { try { msg((await cloud.loadAccountKey()) ? '계정의 키를 받았어요' : '계정에 저장된 키가 없어요'); renderProps(); } catch (e) { msg(e.message || e); } };
  if ($('#kPut')) $('#kPut').onclick = async () => { try { await cloud.saveAccountKey(cloud.aiKey()); msg('계정에 저장했어요 · 다른 기기에서 로그인하면 자동으로 써요'); } catch (e) { msg(e.message || e); } };
  $('#pGo').onclick = async () => {
    const f = (await openFiles({ title: '도면 (이미지 · PDF)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }))[0]; if (!f) return;
    msg('Claude 가 도면을 읽는 중… (30초~1분)'); $('#pGo').disabled = true;
    try { const r = await cloud.readPlan(await cloud.prepFile(f.name, f.data), +$('#pW').value || 0); applyPlan(r, $('#pMode').value); msg(`벽 ${r.walls.length}개 · 문/창 ${r.openings.length}개를 그렸어요 (도면 가로 ${r.widthMm.toLocaleString()}mm 기준)`); }
    catch (e) { console.error(e); msg('읽지 못했어요: ' + (e.message || e)); }
    $('#pGo').disabled = false;
  };
  $('#phGo').onclick = async () => {
    const f = (await openFiles({ title: '현장 사진', extensions: ['png', 'jpg', 'jpeg', 'webp'] }))[0]; if (!f || !selWall()) return;
    msg('Claude 가 사진을 보는 중…'); $('#phGo').disabled = true;
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
const CAT_ORDER = ['주방', '테이블', '의자', '가구', '가전', '욕실', '조명', '천장 설비', '벽 설비', '전기', '바닥·배관', '설비', '공장', '인테리어', '식물', '주거', '배경'];
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
  S.lib = lib.items; S.shapes = shapes;
  engine = new Engine($('#view'), { lib: S.lib, shapes: S.shapes, assets: S.assets });
  engine.onSelect = (id) => { if (id) { S.sel = { kind: 'item', id }; S.propsOpen = true; S.panel = 'props'; } else if (S.sel && S.sel.kind === 'item') S.sel = null; plan && plan.select(S.sel, true); renderProps(); };
  engine.onChange = () => { commit(); renderProps(); };
  engine.onMove = () => plan.redraw(); // 3D 에서 끌면 2D 도 같이
  plan = new Plan2D($('#plan'), {
    level, lib: S.lib, style: () => engine.style, toast,
    onSelect: (sel) => setSel(sel),
    onLive: (kind, x) => { if (kind === 'structure') liveStructure(); else if (kind === 'item') engine.moveItem(x); else if (kind === 'item-removed') engine.removeItem(x); },
    onChange: (msg) => { commit(); renderProps(); if (msg) toast(msg, 2200); },
  });
  $$('[data-tool]').forEach((b) => (b.onclick = () => { plan.setTool(b.dataset.tool); $$('[data-tool]').forEach((q) => q.setAttribute('aria-pressed', String(q === b))); }));
  $('#btnFit').onclick = () => plan.fit();
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); ACT.save(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) plan.erase(S.sel);
    if (e.key === 'Escape') { setSel(null); closeDrawer(); }
  });
  // 파일을 끌어다 놓기
  let depth = 0; const drop = $('#drop');
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; drop.hidden = false; } });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.hidden = true; } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => { e.preventDefault(); depth = 0; drop.hidden = true; const fs = await Promise.all([...e.dataTransfer.files].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))); handleFiles(fs); });

  await setModel(emptyProject());
  window.BYR = { S, engine, plan, openJson, FORMAT, setStyle, setPane, setSel, applyPlan, placeDetected }; // 디버깅 · 자동 테스트용
  toast('왼쪽 2D 도면에서 벽을 그리면 오른쪽 3D 에 바로 세워져요 · 붓 아이콘으로 카툰 · 타이쿤 · 만화 스타일로 바꿔도 편집은 그대로 · 파일 메뉴에서 기존 앱 작업물을 불러오세요', 8000);
}
boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;inset:auto 12px 12px 12px;background:#300;color:#fff;padding:12px;border-radius:8px;white-space:pre-wrap;z-index:99">시작하지 못했어요: ${esc(e.message || e)}</pre>`); });
