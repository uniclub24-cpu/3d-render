/* ================================================================
   v7 · 연결 — 화면 그리기 갈고리, 단축키, 내보내기 형식, 시작
   ================================================================ */
const _d2 = draw2d;
draw2d = function () { _d2(); if (P && view !== '3d' && !OFF) { drawGuides(); cmtDraw2d(); } placeCtx(); reqMini(); };
const _r3 = render3d;
render3d = function () { _r3(); if (!P || !lastM) return; const r = gc.getBoundingClientRect(); cmtPins(lastM, r); if (WALK.on) { $$('#ov3d .pin').forEach((x) => x.remove()); } placeCtx(); reqMini(); };
const _sv = setView; setView = function (v) { _sv(v); placeCtx(); reqMini(); };
const _ps = pickSel; pickSel = function (h) { _ps(h); const b = $('#ctxbar'); if (b && sel) { b.hidden = true; } placeCtx(); };
const _sm = setMove; setMove = function (on) { _sm(on); renderCtx(); };
const _oc = openSheet; openSheet = function (n) { _oc(n); placeCtx(); reqMini(); };
const _cs = closeSheet; closeSheet = function () { _cs(); placeCtx(); reqMini(); };
const _scl = setClean; setClean = function (on) { if (on && WALK.on) walkStop(); _scl(on); placeCtx(); reqMini(); };
const _op = openProject; openProject = function (p) { if (WALK.on) walkStop(); _op(p); undoMeta = []; redoMeta = []; varEnsure(); renderVariants(); renderCmts(); reqMini(); };
const _swl = switchLevel; switchLevel = function (id) { _swl(id); undoMeta = []; redoMeta = []; renderCmts(); };
const _ep = endPtr; endPtr = function (e) { _ep(e); if (GUIDES) { GUIDES = null; draw2d(); } };
cv.removeEventListener('pointerup', _ep); cv.removeEventListener('pointercancel', _ep);
cv.addEventListener('pointerup', (e) => endPtr(e)); cv.addEventListener('pointercancel', (e) => endPtr(e));

// 단축키: Ctrl+K 검색, G 걷기, C 댓글, H 기록
addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey, k = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : (e.key || '').toLowerCase(), inField = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (mod && k === 'k') { e.preventDefault(); e.stopImmediatePropagation(); $('#cmdk').hidden ? openCmd() : closeCmd(); return; }
  if (!$('#cmdk').hidden) return;
  if (inField || mod || e.altKey || document.querySelector('dialog[open]')) return;
  if (k === 'g') { e.preventDefault(); e.stopImmediatePropagation(); WALK.on ? walkStop() : walkStart(); return; }
  if (WALK.on) return;
  if (k === 'c' && !sel) { e.preventDefault(); commentMode(!commentOn); return; }
  if (k === 'h') { e.preventDefault(); openHist(); return; }
  if (e.key === 'Escape' && commentOn) { e.stopImmediatePropagation(); commentMode(false); return; }
  if (e.key === 'Escape' && !$('#histPop').hidden) { e.stopImmediatePropagation(); $('#histPop').hidden = true; return; }
}, true);
$('#cmdQ').addEventListener('input', runCmdSearch);
$('#cmdQ').addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); cmdMove(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); cmdMove(-1); } else if (e.key === 'Enter') { e.preventDefault(); cmdRun(cmdIdx); } else if (e.key === 'Escape') { e.preventDefault(); closeCmd(); } e.stopPropagation(); });
$('#cmdList').addEventListener('click', (e) => { const li = e.target.closest('[data-ci]'); if (li) cmdRun(+li.dataset.ci); });
$('#cmdk').addEventListener('pointerdown', (e) => { if (e.target.id === 'cmdk') closeCmd(); });
$('#cmdBtn').onclick = openCmd; $('#cmdBtn2') && ($('#cmdBtn2').onclick = openCmd);
$('#histBtn').onclick = openHist;
$('#histPop').addEventListener('click', (e) => { const b = e.target.closest('[data-hg]'); if (b) { histGo(+b.dataset.hg); renderHist(); } if (e.target.closest('[data-hx]')) $('#histPop').hidden = true; });
// 미니맵
{ const c = $('#miniC'); let dn = false; c.addEventListener('pointerdown', (e) => { dn = true; c.setPointerCapture(e.pointerId); miniGo(e); }); c.addEventListener('pointermove', (e) => { if (dn) miniGo(e); }); c.addEventListener('pointerup', () => (dn = false));
  const gp = $('#miniGrip'); let g0 = null; gp.addEventListener('pointerdown', (e) => { gp.setPointerCapture(e.pointerId); g0 = [e.clientX, MINI.w]; }); gp.addEventListener('pointermove', (e) => { if (!g0) return; MINI.w = clamp(g0[1] - (e.clientX - g0[0]), 120, 380); drawMini(); }); gp.addEventListener('pointerup', () => { g0 = null; store.set('drs_mini', MINI); });
  $('#miniX').onclick = () => { MINI.on = false; store.set('drs_mini', MINI); drawMini(); }; $('#miniOn').onclick = () => { MINI.on = true; store.set('drs_mini', MINI); drawMini(); }; }
// 3D 막대 버튼
$('#walkBtn').onclick = () => (WALK.on ? walkStop() : walkStart());
$$('[data-cmt]').forEach((b) => (b.onclick = () => commentMode(!commentOn)));
$('#hqBtn').onclick = openHQ;
$('#hqGo').onclick = runHQ; $('#hqSave').onclick = () => hqSave(false); $('#hqSavePng').onclick = () => hqSave(true);
// 안
{ const w = $('#varWrap'), m = $('#varMenu'); $('#varBtn').onclick = (e) => { e.stopPropagation(); m.hidden = !m.hidden; if (!m.hidden) varMenu(); }; document.addEventListener('pointerdown', (e) => { if (!w.contains(e.target)) m.hidden = true; }); }
$$('[data-cmpm]').forEach((b) => (b.onclick = () => { cmpMode = b.dataset.cmpm; drawCmp(); })); $$('[data-cmpv]').forEach((b) => (b.onclick = () => { cmpView = b.dataset.cmpv; drawCmp(); }));
$('#cmpA').onchange = drawCmp; $('#cmpB').onchange = drawCmp;
$('#cmpUse').onclick = () => { varSwitch($('#cmpB').value); $('#cmpDlg').close(); };
// 견적
$('#bomXlsx').onclick = () => saveLocal({ name: `${(P.name || 'plan').replace(/[\\/:*?"<>|]/g, '_')}_견적.xlsx`, blob: bomXlsx() });
$('#bomCsv').onclick = () => { const rows = bomRows(), q = (s) => `"${String(s).replace(/"/g, '""')}"`; const t = '﻿' + [['구분', '항목', '규격', '수량', '단위', '단가', '금액', '비고'].join(','), ...rows.map((r) => [r.g, r.n, r.sp, r.q, r.u, bomPrice(r.key), Math.round(r.q * bomPrice(r.key)), r.note].map(q).join(','))].join('\r\n'); saveLocal({ name: `${(P.name || 'plan').replace(/[\\/:*?"<>|]/g, '_')}_견적.csv`, blob: new Blob([t], { type: 'text/csv' }) }); };
// DXF
$('#dxfFile').addEventListener('change', (e) => dxfLoad(e.target.files[0]));
$('#dxfLayers').addEventListener('change', dxfPreview); for (const id of ['dxfUnit', 'dxfMerge', 'dxfRest']) $('#' + id).addEventListener('change', dxfPreview);
$('#dxfOk').onclick = dxfApply;
// 모델
$('#mdFile').addEventListener('change', (e) => modelLoad(e.target.files)); $('#mdUnit').addEventListener('change', modelPrev); $('#mdOk').onclick = modelSave;
// 자동 배치
$('#auMenu').addEventListener('change', (e) => { const m = MENUS[e.target.value]; if (m) { autoList = { ...m.list }; renderAutoList(); } });
$('#auList').addEventListener('change', (e) => { const id = e.target.dataset.au; if (id) { autoList[id] = clamp(+e.target.value || 0, 0, 9); e.target.closest('.aurow').classList.toggle('on', autoList[id] > 0); } });
$('#auGo').onclick = autoRun;
// 공유
$('#shGo').onclick = shareMake; $('#shPull').onclick = sharePull; $('#shLogin').onclick = () => { $('#shareDlg').close(); $('#acctBtn').click(); };
$('#shCopy').onclick = async () => { const i = $('#shLink'); if (!i.value) return; try { await navigator.clipboard.writeText(i.value); $('#shStatus').textContent = '복사했어요'; } catch (e) { i.select(); $('#shStatus').textContent = '선택된 주소를 복사하세요'; } };
// 보여주기에서 안 바꾸기는 위 document click 이 처리
// 테마
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
// 상단 도구 메뉴 (더보기)
{ const w = $('#moreWrap'), m = $('#moreMenu'); $('#moreBtn').onclick = (e) => { e.stopPropagation(); m.hidden = !m.hidden; }; document.addEventListener('pointerdown', (e) => { if (!w.contains(e.target)) m.hidden = true; });
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-mm]'); if (!b) return; m.hidden = true; ({ bom: openBom, dxf: openDxfIn, model: openModelIn, auto: openAuto, hq: openHQ, pano: panoExport, share: openShare, cmp: varCompare, walk: walkStart, hist: openHist, cmt: () => commentMode(true) })[b.dataset.mm](); }); }

// 내보내기 형식 추가: 360°, 360° 보기 페이지, 실사 렌더, 견적 엑셀
const _mf0 = makeFile0;
makeFile0 = async function (fmt, lv) {
  const base = (P.name || 'plan').replace(/[\\/:*?"<>|]/g, '_'), st = $('#expStatus');
  if (fmt === 'pano' || fmt === 'panohtml') {
    const c = await panoMake(4096, (p) => (st.textContent = `360° 만드는 중 ${Math.round(p * 100)}%`)); const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', .9));
    const bytes = addGPano(new Uint8Array(await blob.arrayBuffer()), c.width, c.height);
    if (fmt === 'pano') return { name: base + '_360.jpg', blob: new Blob([bytes], { type: 'image/jpeg' }) };
    return { name: base + '_360보기.html', blob: new Blob([panoViewerHtml(b64e(bytes), P.name)], { type: 'text/html' }) };
  }
  if (fmt === 'hq') { const out = await hqRender({ W: 2560, H: 1440, N: 24, C: { ...cam }, tm: 'now' }, (p) => (st.textContent = `실사 렌더 ${Math.round(p * 100)}%`)); return { name: base + '_실사.jpg', blob: await new Promise((r) => out.toBlob(r, 'image/jpeg', .92)) }; }
  if (fmt === 'xlsx') return { name: base + '_견적.xlsx', blob: bomXlsx() };
  return _mf0(fmt, lv);
};
$$('[data-fmt]').forEach((b) => (b.onclick = () => { expFmt = b.dataset.fmt; $$('[data-fmt]').forEach((x) => x.classList.toggle('on', x === b)); }));

/* ---------- 시작 ---------- */
setTheme(store.get('drs_theme', 'dark'));
varEnsure(); renderVariants(); renderCmts(); renderCtx(); drawMini();
if (/^#share-[0-9a-f-]{36}$/i.test(location.hash)) setTimeout(() => shareOpen(location.hash.slice(7)), 350);
