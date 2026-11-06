/* ================================================================
   v13 · 벽 높이 즉시 반영 · 시트 / 간판 보관함 · 간판 오브젝트 · 천장 끄기
        공간 설계 모드 · 설치물 보기 · 주방 동선 시뮬레이터 · 공기 흐름 · 태블릿 도구 접기
   ================================================================ */

/* ---------- 1. 벽 높이: 바로 보이게 (벽 낮춰 보기가 켜져 있으면 끄기) ---------- */
function showFullWalls(why) { if (!cam.cut) return; cam.cut = false; const c = $('#cutWalls'); if (c) c.checked = false; dirty3d = true; need3d = true; toast((why || '벽 높이') + ' · "벽 낮춰 보기"를 꺼서 실제 높이로 보여요'); }
{ const _rp = renderProps0; renderProps0 = function () { _rp(); if (!P || !sel || sel.kind !== 'wall') return; const w = wallOf(sel.id), el = $('#wH'); if (!w || !el) return;
    el.addEventListener('input', () => { const v = +el.value; if (v >= 300) { w.h = v; dirty3d = true; need3d = true; showFullWalls('벽 높이 ' + v); } }); }; }
{ const _rq = renderQuick0; renderQuick0 = function () { _rq(); if (!sel || sel.kind !== 'wall' || multi.length > 1) return; const w = wallOf(sel.id), el = $('#q2'); if (!w || !el) return;
    el.addEventListener('input', () => { const v = +el.value; if (v >= 300) { w.h = v; dirty3d = true; need3d = true; showFullWalls('벽 높이 ' + v); } }); }; }
{ const _c = commit; commit = function (s) { const before = sel && sel.kind === 'wall' ? wallH(wallOf(sel.id) || {}) : null; _c(s); if (before != null && cam.cut && wallOf(sel.id) && wallH(wallOf(sel.id)) !== before && wallH(wallOf(sel.id)) > 1200) showFullWalls(); }; }
{ const _eh = edgeHeight; edgeHeight = function (E, dy) { if (E.kind === 'wallH' || E.kind === 'top') showFullWalls(E.kind === 'wallH' ? '벽 높이 조절' : '높이 조절'); return _eh(E, dy); }; }

/* ---------- 2. 천장 끄기 (3D 메뉴 · 도구) · 빈 곳 누르면 천장 선택 ---------- */
var NOCEIL = false;
function setCeilOn(on) { P.ceiling = { ...(P.ceiling || {}), on: !!on }; if (on) for (const r of rooms()) if (r.ceil) delete r.ceil.on; commit(); dirty3d = true; renderCeilBtn(); if (typeof syncCeilOpt === 'function') syncCeilOpt(); toast(on ? '천장을 켰어요 · 천장(빈 곳)을 누르면 투명도 · 높이를 바꿔요' : '천장을 껐어요'); }
function renderCeilBtn() { const b = $('#ceilBtn'); if (!b || !P) return; const on = !!(P.ceiling && P.ceiling.on); b.setAttribute('aria-pressed', on); b.textContent = on ? '천장 ON' : '천장 OFF'; }
{ const h = $('#hgtBtn'); if (h) h.insertAdjacentHTML('afterend', '<button class="tg" id="ceilBtn" aria-pressed="false" title="천장 보이기 · 끄기">천장</button>'); }
$('#ceilBtn').onclick = () => setCeilOn(!(P.ceiling && P.ceiling.on));
{ const _bl = buildLevel; buildLevel = function (a) { if (!NOCEIL) return _bl(a); const k = P.ceiling, kr = rooms().map((r) => [r, r.ceil]); P.ceiling = { ...(k || {}), on: false }; for (const r of rooms()) r.ceil = { ...(r.ceil || {}), on: false }; try { _bl(a); } finally { P.ceiling = k; for (const [r, c] of kr) r.ceil = c; } }; }
{ const _p3 = pick3d; pick3d = function (e) { const h = rayHit(e); if (!h && P && P.ceiling && P.ceiling.on && !NOCEIL) { lastHit = null; pickSel({ kind: 'ceil', id: 'all' }); toast('천장 선택 · 오른쪽에서 투명도 · 높이 · 끄기'); return; } _p3(e); }; }
{ const _ch = ceilHit; ceilHit = function (e) { if (NOCEIL) return null; const r = _ch(e); if (r) return r; if (!P || !P.ceiling || !P.ceiling.on) return null; // 위에서 봐도 반쯤 보이는 천장은 고를 수 있게
    const { E: E0, D } = rayOf(e), E = [E0[0], E0[1] - curElev(), E0[2]], H = P.ceilingH, op = P.ceiling.opacity ?? 0.45; if (op < 0.3 || Math.abs(D[1]) < 1e-6 || E[1] < H) return null; const t = (H - E[1]) / D[1]; if (t <= 0) return null; const x = E[0] + D[0] * t, z = E[2] + D[2] * t, b = bounds();
    if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return null; const rr = rooms().length ? roomAt(x, z) : null; return { t, rt: t, sel: { kind: 'ceil', id: rr ? rr.id : 'all' }, n: [0, -1, 0], p: [x, H, z] }; }; }

/* ---------- 3. 프리셋: 외부 시트 따로 · 간판은 기본으로 넣지 않음 ---------- */
{ const i = PSCOPE.findIndex((x) => x[0] === 'sign'); if (i >= 0) PSCOPE.splice(i, 1, ['sheet', '외부 윈도우 · 출입문 시트'], ['sign', '간판 (보관함 이미지로 따로 넣기 권장)']); }
{ const _op = openPreset; openPreset = function (fromNew) { _op(fromNew); const o = P.preset && P.preset.opt; const s = $('[data-pss="sign"]'); if (s && (fromNew || !o || !o.scope)) s.checked = false; const sh = $('[data-pss="sheet"]'); if (sh && o && o.scope && !o.scope.includes('sheet') && !o.scope.includes('sign')) sh.checked = false; }; }

/* ---------- 4. 이미지 보관함 (시트 · 간판 로고) ---------- */
const BUILTIN_IMG = [['signH', '페리카나 간판 (홀)'], ['signD', '페리카나 간판 (배달)'], ['neon', '네온사인'], ['doorH', '레드 양개 출입문'], ['doorD', '배달 출입문'], ['wH1', '치킨 사진'], ['wH2', '슬로건'], ['wH3', '1982 로고'], ['wH6', 'DRINKS · BEER'], ['wD1', '치킨 사진 (배달)'], ['wD2', '슬로건 (배달)'], ['wD3', '1982 로고 (배달)']];
function regAssets() { if (!P) return; for (const [id, a] of Object.entries(P.assets || {})) DECALS['u_' + id] = { src: a.src, w: a.w, h: a.h }; }
{ const _op = openProject; openProject = function (p) { _op(p); regAssets(); renderCeilBtn(); }; }
let ASSET = { mode: 'any', pick: null, target: null };
function openAssets(mode, target) {
  ASSET = { mode: mode || 'any', pick: null, target: target || null }; regAssets(); let d = $('#assetDlg');
  if (!d) { document.body.insertAdjacentHTML('beforeend', `<dialog id="assetDlg" class="wide"><div class="dlg"><div class="row" style="align-items:center"><h3 style="flex:1">시트 · 간판 이미지 보관함</h3><button class="btn" data-close>닫기</button></div>
    <p class="hint">PNG · JPG를 올리면 이 프로젝트에 보관돼요 (긴 변 3000px까지 고화질 유지). 고른 뒤 아래에서 넣을 방법을 누르세요.</p>
    <div class="row"><label class="btn pri">이미지 올리기<input type="file" id="asUp" accept="image/png,image/jpeg,image/webp" multiple hidden></label><span class="hint" id="asMsg"></span></div>
    <div class="asgrid" id="asGrid"></div>
    <div class="row wrap" id="asAct"><button class="btn pri" data-asdo="sign">간판으로 넣기</button><button class="btn" data-asdo="wall">선택한 벽에 시트 붙이기</button><button class="btn" data-asdo="win">선택한 창 · 문에 시트</button><button class="btn" data-asdo="logo">간판 로고 바꾸기</button><button class="btn danger" data-asdo="del">보관함에서 지우기</button></div></div></dialog>`);
    d = $('#assetDlg'); d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); const c = e.target.closest('[data-as]'); if (c) { ASSET.pick = c.dataset.as; renderAssets(); } const b = e.target.closest('[data-asdo]'); if (b) assetDo(b.dataset.asdo); });
    $('#asUp').onchange = async (e) => { const fs = [...e.target.files]; e.target.value = ''; for (const f of fs) await addAsset(f); renderAssets(); }; }
  renderAssets(); d.showModal();
}
function renderAssets() {
  const L = BUILTIN_IMG.map(([k, n]) => [k, n, true]).concat(Object.entries(P.assets || {}).map(([id, a]) => ['u_' + id, a.name, false]));
  $('#asGrid').innerHTML = L.map(([k, n, b]) => `<button class="ascard ${ASSET.pick === k ? 'on' : ''}" data-as="${k}"><img src="${DECALS[k] ? DECALS[k].src : ''}" alt=""><span>${esc(n)}</span><small>${b ? '기본 (매뉴얼)' : `${DECALS[k] ? DECALS[k].w + '×' + DECALS[k].h : ''}`}</small></button>`).join('');
  const t = selList(), hasWall = t.some((s) => s.kind === 'wall') || (ASSET.target && ASSET.target.kind === 'wall'), hasOp = t.some((s) => s.kind === 'open'), sb = sel && sel.kind === 'item' && itemOf(sel.id) && itemOf(sel.id).type === 'signbox';
  $$('[data-asdo]').forEach((b) => { const k = b.dataset.asdo; b.disabled = !ASSET.pick || (k === 'wall' && !hasWall) || (k === 'win' && !hasOp) || (k === 'logo' && !sb) || (k === 'del' && !/^u_/.test(ASSET.pick || '')); });
  $('#asMsg').textContent = ASSET.pick ? '' : '이미지를 하나 고르세요';
}
function addAsset(f) { return new Promise((res) => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
  const mx = 3000, k = Math.min(1, mx / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const png = /png|webp/.test(f.type), src = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92), id = uid('a'); P.assets = P.assets || {}; P.assets[id] = { name: f.name.replace(/\.[^.]+$/, ''), src, w: c.width, h: c.height }; regAssets(); ASSET.pick = 'u_' + id; commit(true); saveProject(true);
  toast(`보관함에 넣었어요 · ${c.width}×${c.height}${src.length > 2e6 ? ' (용량이 커서 동기화가 느릴 수 있어요)' : ''}`); res(); }; im.onerror = () => { toast('이미지를 열 수 없어요'); res(); }; im.src = r.result; }; r.readAsDataURL(f); }); }
function outward(w, t) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L, b = bounds(), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], m = [w.x1 + ux * t, w.y1 + uy * t]; let nx = -uy, ny = ux; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny > 0) { nx = -nx; ny = -ny; } return { L, ux, uy, m, nx, ny }; }
const rotOf = (nx, ny) => Math.round(((Math.atan2(-nx, ny) * 180 / Math.PI) % 360 + 360) % 360);
function assetDo(k) {
  const key = ASSET.pick, Dk = DECALS[key]; if (!Dk && k !== 'del') return; const ar = Dk ? Dk.w / Dk.h : 1;
  if (k === 'del') { delete P.assets[key.slice(2)]; ASSET.pick = null; commit(); renderAssets(); return; }
  if (k === 'sign' || k === 'wall') {
    const ws = selList().filter((s) => s.kind === 'wall').map((s) => wallOf(s.id)).filter(Boolean); let w = ws[0] || (ASSET.target && wallOf(ASSET.target.id));
    if (!w) { const g = P.openings.find((o) => o.pz === 'gate'); w = g ? wallOf(g.wall) : exteriorWalls()[0]; } if (!w) { toast('벽이 없어요'); return; }
    const hit = lastHit && lastHit.sel && lastHit.sel.kind === 'wall' && lastHit.sel.id === w.id ? lastHit : null, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), t = hit && hit.along != null ? hit.along : L / 2;
    let { nx, ny, m } = outward(w, t); const ext = exteriorWalls().some((x) => x.id === w.id), inside = hit && hit.side != null && !ext ? false : !ext; if (inside) { nx = -nx; ny = -ny; }
    if (k === 'sign') { const g = P.openings.find((o) => o.pz === 'gate' && o.wall === w.id), sw = Math.min(L - 100, 6000), ww = sw, hh = Math.round(clamp(ww / Math.max(ar, 1), 450, 1200)), top = g ? g.sill + g.h : Math.min(wallH(w), 2800), off = wallT(w) / 2 + 100, tt = g ? clamp(g.t, ww / 2 + 50, L - ww / 2 - 50) : t, o = outward(w, tt);
      const it = { id: uid('i'), type: 'signbox', dk: key, x: Math.round(o.m[0] + (inside ? -o.nx : o.nx) * off), y: Math.round(o.m[1] + (inside ? -o.ny : o.ny) * off), w: ww, d: 200, h: hh, rot: rotOf(inside ? -o.nx : o.nx, inside ? -o.ny : o.ny), elev: top + 50, face: 'led', frame: 'alu', fcol: '#c9ced4', bg: '#ffffff', logo: 0.92, tag: '간판 (보관함 이미지)', wallLink: w.id };
      P.items.push(it); w.L0 = w.L0 || L; $('#assetDlg').close(); commit(); dirty3d = true; pickSel({ kind: 'item', id: it.id }); toast('간판을 달았어요 · 오른쪽에서 두께 · 판 · 프레임 · 로고 크기를 바꿔요'); return; }
    const H = wallH(w), sw = Math.min(1500, L * 0.6, (Math.min(H, 2700) - 300) * ar), sh = sw / ar, el = clamp(1200 - sh / 2, 0, Math.max(0, H - sh)), off = wallT(w) / 2 + 12;
    const it = { id: uid('i'), type: 'sticker', dk: key, x: Math.round(m[0] + nx * off), y: Math.round(m[1] + ny * off), w: Math.round(sw), d: 8, h: Math.round(sh), lockAR: ar, rot: rotOf(nx, ny), elev: Math.round(el), tag: '시트지 (스티커)', wallLink: w.id };
    P.items.push(it); w.L0 = w.L0 || L; $('#assetDlg').close(); commit(); dirty3d = true; pickSel({ kind: 'item', id: it.id }); toast('시트지를 붙였어요 · Ctrl+끌기로 크기(비율 유지) · Ctrl+Shift+끌기로 위치'); return; }
  if (k === 'win') { const ops = selList().filter((s) => s.kind === 'open'); for (const s of ops) { P.items = P.items.filter((i) => i.win !== s.id || i.type === 'winsheet' && false); P.items.push({ id: uid('i'), type: 'doorsheet', dk: key, win: s.id, x: 0, y: 0, w: 1000, d: 12, h: 2000, rot: 0, tag: '창 · 문 시트 (보관함)' }); } $('#assetDlg').close(); commit(); dirty3d = true; toast(`시트 ${ops.length}장을 붙였어요 · 창 크기를 바꾸면 비율 그대로 따라가요`); return; }
  if (k === 'logo') { const it = itemOf(sel.id); it.dk = key; $('#assetDlg').close(); commit(); dirty3d = true; renderProps(); }
}
[
  { id: 'sticker', name: '시트지 (스티커)', cat: '인테리어', shape: 'decal', img: 'wH3', w: 1000, d: 8, h: 1000, elev: 900, layer: 'deco', color: '#ffffff', mat: 'plastic' },
  { id: 'signbox', name: '간판 (이미지 · LED / 금속판)', cat: '인테리어', shape: 'signbox', w: 4000, d: 200, h: 800, elev: 2700, layer: 'upper', color: '#ffffff', mat: 'plastic', kw: 0.3 },
  { id: 'supplyfan', name: '급기팬 (천장)', cat: '설비', shape: 'cassette', w: 450, d: 450, h: 200, layer: 'ceil', color: '#7fb3d5', mat: 'plastic', kw: 0.4, hp: 1, air: 'in' },
  { id: 'exhaustfan', name: '배기팬 (천장 · 벽)', cat: '설비', shape: 'cassette', w: 450, d: 450, h: 200, layer: 'ceil', color: '#b0a49a', mat: 'steel', kw: 0.4, hp: 1, air: 'out' },
].forEach((x) => { if (!LIB.find((l) => l.id === x.id)) LIB.push(x); });
{ const hd = LIB.find((l) => l.id === 'hood'); if (hd) { hd.hp = 2; hd.air = 'out'; } }
const SIGNFRAME = { alu: ['알루미늄 프레임', '#c9ced4', 'steel'], sus: ['스테인리스 헤어라인', '#bababa', 'steel'], black: ['블랙 도장', '#1f2023', 'plain'], white: ['화이트 도장', '#f2f2f2', 'plain'], red: ['레드 도장 (PT-02)', '#931506', 'plain'] };
const SIGNFACE = { led: 'LED 파나플렉스 (발광)', metal: '금속판 (갈바 · 스텐)', acryl: '아크릴 (채널 · 비발광)' };
{ const _bi = buildItem; buildItem = function (it) { const s = spec(it); if (s.L.shape !== 'signbox') return _bi(it);
    const T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), e = zOf(it), hw = it.w / 2, hd = it.d / 2, h = s.h, F = SIGNFRAME[it.frame || 'alu'], fr = Math.min(60, it.w / 10, h / 6), face = it.face || 'led';
    box(T, -hw, hw, e, e + h, -hd, hd - 25, F[1], F[2]); box(T, -hw, hw, e, e + fr, hd - 25, hd, F[1], F[2]); box(T, -hw, hw, e + h - fr, e + h, hd - 25, hd, F[1], F[2]); box(T, -hw, -hw + fr, e, e + h, hd - 25, hd, F[1], F[2]); box(T, hw - fr, hw, e, e + h, hd - 25, hd, F[1], F[2]);
    const bg = it.bg || '#ffffff'; if (face === 'led') { const g = grp('plain'), c = tintC(hexRGB(bg)).map((v) => Math.min(1.6, v * 1.45)), n = T.N(0, 0, 1), V = [[-hw + fr, e + fr], [hw - fr, e + fr], [hw - fr, e + h - fr], [-hw + fr, e + h - fr]]; quad(g, V.map(([x, y]) => T.P(x, y, hd - 4)), n, c); }
    else box(T, -hw + fr, hw - fr, e + fr, e + h - fr, hd - 25, hd - 4, bg, face === 'metal' ? 'steel' : 'plain');
    const Dk = it.dk && DECALS[it.dk]; if (Dk) { const ar = Dk.w / Dk.h, aw = (it.w - 2 * fr) * (it.logo || 0.92), ah = (h - 2 * fr) * (it.logo || 0.92); let gw = aw, gh = gw / ar; if (gh > ah) { gh = ah; gw = gh * ar; } const y0 = e + (h - gh) / 2; decalTex(it.dk); const g = grp('dc_' + it.dk), c = tintC(face === 'led' ? [1.42, 1.42, 1.42] : [1.2, 1.2, 1.2]), n = T.N(0, 0, 1), V = [[-gw / 2, y0], [gw / 2, y0], [gw / 2, y0 + gh], [-gw / 2, y0 + gh]], U = [[0, 1], [1, 1], [1, 0], [0, 0]];
      for (const i of [0, 1, 2, 0, 2, 3]) { g.p.push(...T.P(V[i][0], V[i][1], hd - 1)); g.n.push(...n); g.c.push(...c); g.u.push(...U[i]); } } }; }
{ const _rp = renderProps0; renderProps0 = function () { _rp(); if (!P || !sel) return; const el = $('#props');
    if (sel.kind === 'wall') { el.insertAdjacentHTML('beforeend', '<div class="lbl">시트 · 간판</div><div class="row wrap"><button class="btn" id="wSticker">시트지 붙이기 (이미지)</button><button class="btn" id="wSign">간판 달기 (이미지)</button></div>'); $('#wSticker').onclick = () => openAssets('wall', sel); $('#wSign').onclick = () => openAssets('sign', sel); }
    if (sel.kind === 'open') { el.insertAdjacentHTML('beforeend', '<div class="row wrap"><button class="btn" id="oSheet">창 · 문 시트 붙이기 (이미지)</button></div>'); $('#oSheet').onclick = () => openAssets('win', sel); }
    if (sel.kind !== 'item') return; const it = itemOf(sel.id); if (!it) return; const L = libGet(it.type);
    if (L.air) { el.insertAdjacentHTML('beforeend', `<div class="lbl">공기 (${L.air === 'in' ? '급기' : '배기'})</div><div class="g3">${field('마력 HP', 'airHp', it.hp ?? L.hp)}<p class="hint" style="grid-column:span 2">약 ${Math.round((it.hp ?? L.hp) * CMH_HP)} CMH · 공기 흐름 보기에서 확인</p></div>`); $('#airHp').onchange = (e) => { it.hp = clamp(+e.target.value || 0, 0, 20); commit(); renderProps(); }; }
    if (it.type !== 'signbox') return;
    el.insertAdjacentHTML('beforeend', `<div class="lbl">간판 설정</div><div class="g3">${field('두께 mm', 'sgD', it.d)}${sel_('판', 'sgFace', SIGNFACE, it.face || 'led')}${sel_('프레임', 'sgFrame', Object.fromEntries(Object.entries(SIGNFRAME).map(([k, v]) => [k, v[0]])), it.frame || 'alu')}</div>
      <div class="g3"><label class="fld"><span>로고 크기 <b id="sgLogoV">${Math.round((it.logo || .92) * 100)}%</b></span><input type="range" id="sgLogo" min="0.2" max="1" step="0.02" value="${it.logo || .92}"></label><label class="fld"><span>바탕색</span><input type="color" id="sgBg" value="${it.bg || '#ffffff'}"></label><button class="btn" id="sgImg">로고 이미지 바꾸기</button></div>`);
    $('#sgD').onchange = (e) => { it.d = clamp(+e.target.value || 200, 20, 800); commit(); dirty3d = true; }; $('#sgFace').onchange = (e) => { it.face = e.target.value; commit(); dirty3d = true; }; $('#sgFrame').onchange = (e) => { it.frame = e.target.value; commit(); dirty3d = true; };
    $('#sgLogo').oninput = (e) => { it.logo = +e.target.value; $('#sgLogoV').textContent = Math.round(it.logo * 100) + '%'; dirty3d = true; }; $('#sgLogo').onchange = () => commit(); $('#sgBg').onchange = (e) => { it.bg = e.target.value; commit(); dirty3d = true; }; $('#sgImg').onclick = () => openAssets('logo'); }; }
// 프리셋 간판은 간판 오브젝트(signbox)로
{ const _ap = applyPreset; applyPreset = function (opt) { const r = _ap(opt); if (!r) return r; for (const it of P.items) if (it.type === 'pelisign') { it.type = 'signbox'; it.face = 'led'; it.frame = 'alu'; it.bg = '#ffffff'; it.logo = 1; it.d = 200; delete it.lockAR; }
    return r; }; }

/* ---------- 5. 동적 그리기 (사람 · 공기 입자): 매 프레임 작은 메시만 따로 ---------- */
var DYN = [];
{ const _dg = drawGL; drawGL = function (W, H, C) { const M = _dg(W, H, C); if (!DYN.length || !P || !gl) return M;
    const kG = G, kY = YOFF, kF = FADE, kT = TINT; G = {}; YOFF = curElev(); FADE = false; TINT = false; try { for (const f of DYN) f(); } catch (e) { console.warn(e); } const groups = Object.values(G); G = kG; YOFF = kY; FADE = kF; TINT = kT;
    const at = (n) => gl.getAttribLocation(prog, n), bufs = [];
    const draw = (g) => { const n = g.p.length / 3; if (!n) return; for (const [nm, arr, sz] of [['p', g.p, 3], ['n', g.n, 3], ['c', g.c, 3], ['u', g.u, 2]]) { const b = gl.createBuffer(); bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STREAM_DRAW); const a = at(nm); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, sz, gl.FLOAT, false, 0, 0); }
      const t = tex[g.key]; gl.uniform1f(gl.getUniformLocation(prog, 'useT'), t ? 1 : 0); if (t) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(prog, 'T'), 0); } gl.uniform1f(gl.getUniformLocation(prog, 'A'), g.alpha); gl.drawArrays(gl.TRIANGLES, 0, n); };
    gl.useProgram(prog); gl.disable(gl.BLEND); groups.filter((g) => g.alpha >= 1).forEach(draw); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); groups.filter((g) => g.alpha < 1).forEach(draw); gl.depthMask(true); bufs.forEach((b) => gl.deleteBuffer(b)); return M; }; }

/* ---------- 6. 공간으로 설계 (홀 · 주방 모드) ---------- */
var SPACE = { on: false, id: null, rest: 'fade' };
function spaceFrame(r) { const b = aabb(r.pts), w = b[2] - b[0], d = b[3] - b[1]; anim = { t0: performance.now(), dur: 900, a: { ...cam }, b: { yaw: cam.yaw, pitch: Math.max(.7, cam.pitch), dist: Math.max(w, d) * 1.55 + 2500, tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2 } }; }
function spaceSet(on, id) {
  SPACE.on = !!on && rooms().length > 0; if (!SPACE.on) { SPACE.id = null; ISO = null; renderSpaceBar(); dirty3d = true; draw2d(); renderLevels(); if (on) toast('먼저 바닥을 공간(주방 · 홀)으로 나눠 주세요 · 프리셋을 쓰면 자동으로 나뉘어요'); return; }
  const r = roomOf(id) || rooms().find((x) => x.kind === '주방') || rooms()[0]; SPACE.id = r.id; ISO = r.id; dirty3d = true; renderSpaceBar(); renderLevels(); draw2d(); if (view === '2d') setView('split'); spaceFrame(r);
}
function renderSpaceBar() {
  let b = $('#spaceBar'); if (!b) { $('#stage').insertAdjacentHTML('beforeend', '<div class="spacebar glass" id="spaceBar" hidden></div>'); b = $('#spaceBar'); b.addEventListener('click', (e) => { const t = e.target.closest('button'); if (!t) return; if (t.dataset.sp) spaceSet(true, t.dataset.sp); if (t.dataset.sprest) { SPACE.rest = t.dataset.sprest; dirty3d = true; renderSpaceBar(); } if (t.dataset.spx != null) spaceSet(false); }); }
  b.hidden = !SPACE.on; if (!SPACE.on) return;
  b.innerHTML = `<b>공간 설계</b>${rooms().map((r) => `<button class="chip ${SPACE.id === r.id ? 'on' : ''}" data-sp="${r.id}">${esc(r.name)}</button>`).join('')}<span class="sep"></span><span class="muted">나머지</span><button class="chip ${SPACE.rest === 'fade' ? 'on' : ''}" data-sprest="fade">반투명</button><button class="chip ${SPACE.rest === 'hide' ? 'on' : ''}" data-sprest="hide">숨김</button><button class="qb" data-spx aria-label="공간 설계 끝내기">✕</button>`;
}
{ const _bl = buildLevel; buildLevel = function (a) { _bl(a); if (!a || !SPACE.on || SPACE.rest !== 'fade' || !roomOf(SPACE.id)) return; const r = roomOf(SPACE.id), kI = ISO, kf = FOCUS;
    const inside = (x, y) => pointInPoly(x, y, r.pts) || polyEdgeDist(r.pts, x, y) < 320, keep = { items: P.items, walls: P.walls, openings: P.openings, lines: P.lines, rooms: P.rooms, ceiling: P.ceiling };
    P.items = P.items.filter((it) => !pointInPoly(it.x, it.y, r.pts)); P.walls = P.walls.filter((w) => !(inside(w.x1, w.y1) && inside(w.x2, w.y2))); P.openings = P.openings.filter((o) => P.walls.some((w) => w.id === o.wall)); P.lines = P.lines.filter((l) => !l.pts.every((p) => inside(p[0], p[1]))); P.rooms = keep.rooms.filter((x) => x !== r); P.ceiling = { ...(P.ceiling || {}), on: false };
    ISO = null; FOCUS = '__fade__'; try { _bl(a); } finally { Object.assign(P, keep); ISO = kI; FOCUS = kf; } }; }
{ const _dm = drawMini; drawMini = function () { withIso(() => _dm()); }; }
{ const _rl = renderLevels; renderLevels = function () { _rl(); if (!P) return; const m = $('#lvlMenu'), sub = $('.lvsub', m); if (sub) sub.insertAdjacentHTML('beforeend', `<label class="chk"><input type="checkbox" id="spaceChk" ${SPACE.on ? 'checked' : ''} ${rooms().length ? '' : 'disabled'}> 공간으로 설계 (주방 · 홀 따로 보기)</label>`); }; }
$('#lvlMenu').addEventListener('change', (e) => { if (e.target.id === 'spaceChk') { $('#lvlMenu').hidden = true; spaceSet(e.target.checked); } });
{ const _si = setIso; setIso = function (id) { if (SPACE.on && id) { spaceSet(true, id); return; } if (SPACE.on && !id) { spaceSet(false); return; } _si(id); }; }

/* ---------- 7. 설치물 보기 (바닥 매립 · 벽 보강/전선 · 천장 배기/급기/전선) ---------- */
var XR = { on: false, cat: 'floor' }, XGRAY = false, XVIVID = false, XACT = false;
const XRN = { floor: '바닥 매립 (배수 · 트랩 · 급수 · 매립관)', wall: '벽 (보강재 · 전선 · 콘센트 · 가스)', ceil: '천장 (배기 · 급기 · 후드 · 조명 · 전선)' };
{ const _h = hexRGB; hexRGB = function (h) { const c = _h(h); if (!XGRAY || XVIVID) return c; const g = c[0] * .3 + c[1] * .59 + c[2] * .11; return [g * .8 + .14, g * .8 + .14, g * .8 + .14]; }; }
function isInstall(it, cat) { const L = libGet(it.type), s = spec(it), t = it.type;
  if (cat === 'floor') return s.layer === 'plumb' || L.shape === 'drainpt' || /drain|trench|water|grease|floorbox/.test(t);
  if (cat === 'wall') return s.layer === 'elec' || /gasvalve|outlet|switch|panel|distbox|intercom/.test(t);
  return ['ceil', 'ceiling'].includes(s.layer) || t === 'hood' || !!L.air || /vent|duct|sprink/.test(t); }
const lineCat = (k) => (k.z === 'below' || (k.layer === 'plumb' && k.z === 'floor') ? 'floor' : k.layer === 'elec' || k.z === 'mid' ? 'wall' : ['above', 'hang', 'frame'].includes(k.z) ? 'ceil' : null);
{ const _bi = buildItem; buildItem = function (it) { if (!XACT || !isInstall(it, XR.cat)) return _bi(it); const kF = FADE, had = 'color' in it, kc = it.color; FADE = false; XVIVID = true; it.color = /^hood$|duct|panel|distbox/.test(it.type) ? '#1f2023' : '#d0021b';
    try { _bi(it); } finally { if (had) it.color = kc; else delete it.color; XVIVID = false; FADE = kF; } }; }
{ const _bl = buildLevel; buildLevel = function (a) { if (!XR.on || !a) return _bl(a); const kf = FOCUS; XACT = true; XGRAY = true; FOCUS = '__x';
    try { _bl(a); XVIVID = true; FADE = false;
      for (const l of P.lines) { const k = LINEKINDS[l.kind]; if (!k || lineCat(k) !== XR.cat) continue; const w = (l.w || k.w) * 1.3, y = k.z === 'above' ? (P.ceilingH + P.slabH) / 2 : k.z === 'mid' ? 500 : k.z === 'below' ? -(l.depth ?? 80) - k.w / 2 : k.z === 'hang' ? P.slabH - (l.off ?? 300) : k.z === 'frame' ? P.ceilingH + 30 : 20, col = /wire|cable|conduit|Wire|lan/.test(l.kind) ? '#111111' : '#d0021b';
        for (let i = 1; i < l.pts.length; i++) { const [x1, z1] = l.pts[i - 1], [x2, z2] = l.pts[i], L = Math.hypot(x2 - x1, z2 - z1); if (L > 1) box(xf(x1, z1, Math.atan2(z2 - z1, x2 - x1)), -w / 2, L + w / 2, y, y + Math.min(w, 140), -w / 2, w / 2, col); } }
      if (XR.cat === 'wall') for (const w of P.walls) { const B = backsOf(w); if (!B.length) continue; const T = xf(w.x1, w.y1, Math.atan2(w.y2 - w.y1, w.x2 - w.x1)), t = wallT(w) / 2; for (const b of B) for (const sd of b.side ? [b.side] : [1, -1]) box(T, b.x0, b.x1, b.y0, b.y1, sd > 0 ? t : -t - 8, sd > 0 ? t + 8 : -t, '#d0021b'); }
    } finally { XVIVID = false; XGRAY = false; XACT = false; FOCUS = kf; } }; }
function xrSet(on, cat) { XR.on = !!on; if (cat) XR.cat = cat; dirty3d = true; need3d = true; renderXrBar(); const b = $('#xrBtn'); if (b) b.setAttribute('aria-pressed', XR.on); if (XR.on) toast(`설치물 보기 · ${XRN[XR.cat]} · 바닥 · 벽 · 천장을 누르면 바뀌어요`); }
function renderXrBar() { let b = $('#xrBar'); if (!b) { $('#stage').insertAdjacentHTML('beforeend', '<div class="xrbar glass" id="xrBar" hidden></div>'); b = $('#xrBar'); b.addEventListener('click', (e) => { const t = e.target.closest('button'); if (!t) return; if (t.dataset.xr) xrSet(true, t.dataset.xr); if (t.dataset.xrx != null) xrSet(false); }); }
  b.hidden = !XR.on; if (!XR.on) return; b.innerHTML = `<b>설치물 보기</b>${Object.entries({ floor: '바닥 매립', wall: '벽 보강 · 전선', ceil: '천장 배기 · 급기 · 전선' }).map(([k, n]) => `<button class="chip ${XR.cat === k ? 'on' : ''}" data-xr="${k}">${n}</button>`).join('')}<span class="muted">빨강 · 검정 = 설치물 · 나머지는 흑백 반투명</span><button class="qb" data-xrx aria-label="설치물 보기 끄기">✕</button>`; }
{ const _ps = pickSel; pickSel = function (h) { _ps(h); if (!XR.on || !h) return; const c = h.kind === 'room' || h.kind === 'floor' ? 'floor' : h.kind === 'wall' ? 'wall' : h.kind === 'ceil' ? 'ceil' : null; if (c && c !== XR.cat) xrSet(true, c); }; }

/* ---------- 8. 주방 동선 시뮬레이터 (위에서 보는 심즈형 · 따라가기 · 녹화) ---------- */
const FAM = { fridge: /^(fridge|freezer|tfridge|showcase)/, work: /^work/, fryer: /^fryer/, range: /^(range|griddle|oven)/, sink: /^(sink|handsink)/, dish: /^dishwasher/, rack: /^(rack|shelf|holding)/, counter: /^(counter|pos)/ };
const FAMN = { fridge: '냉장고', work: '작업대', fryer: '튀김기', range: '화구', sink: '싱크대', dish: '식기세척기', rack: '선반 · 랙', counter: '카운터', pass: '배식구' };
const DWELL = { fryer: 4, range: 3, sink: 3, dish: 3, fridge: 2, work: 2.5, rack: 1.5, counter: 2, pass: 1.5 };
const ROLES = { fry: ['튀김 담당', ['fridge', 'work', 'fryer', 'work', 'pass']], hot: ['화구 · 소스 담당', ['fridge', 'range', 'work', 'pass']], wash: ['세척 담당', ['pass', 'sink', 'dish', 'rack']], pack: ['포장 · 배식 담당', ['rack', 'work', 'pass', 'counter']] };
const SIMCOL = ['#e5484d', '#2f8fd6', '#30a46c', '#f5a524', '#8e6cf0', '#0aa5a5'];
var SIM = { on: false, run: false, speed: 1, view: 'god', follow: 0, heat: true, rec: null, A: [], heatM: new Map(), hits: 0, grid: null, cache: new Map() };
const simData = () => (P.sim = P.sim || { actors: [] });
function kitchenRoom() { return rooms().find((r) => r.kind === '주방') || null; }
function stationOf(fam, from) {
  const kr = kitchenRoom();
  if (fam === 'pass') { const ops = P.openings.filter((o) => /pass/.test(o.type)); let best = null; for (const o of ops) { const g = openingGeom(o); if (!g) continue; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2]; for (const s of [1, -1]) { const p = [m[0] + g.nx * s * 550, m[1] + g.ny * s * 550]; const okK = kr ? pointInPoly(p[0], p[1], kr.pts) : true; const d = from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : 0; if (okK && (!best || d < best.d)) best = { d, p, a: Math.atan2(-g.ny * s, -g.nx * s) }; } } return best && { p: best.p, label: '배식구' }; }
  let best = null; for (const it of P.items) { if (it.hidden || !FAM[fam] || !FAM[fam].test(it.type)) continue; const r = (it.rot || 0) * Math.PI / 180, f = [-Math.sin(r), Math.cos(r)], p = [it.x + f[0] * (it.d / 2 + 380), it.y + f[1] * (it.d / 2 + 380)];
    const inK = kr ? pointInPoly(it.x, it.y, kr.pts) : true, d = (from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : 0) + (inK || fam === 'counter' ? 0 : 1e6); if (!best || d < best.d) best = { d, p, label: spec(it).name }; }
  return best && { p: best.p, label: best.label };
}
function simGrid() {
  const b = bounds(), cs = 100, nx = Math.ceil((b[2] - b[0]) / cs) + 1, ny = Math.ceil((b[3] - b[1]) / cs) + 1, g = new Uint8Array(nx * ny);
  const mark = (x0, y0, x1, y1, test) => { for (let i = Math.max(0, Math.floor((x0 - b[0]) / cs)); i <= Math.min(nx - 1, Math.ceil((x1 - b[0]) / cs)); i++) for (let j = Math.max(0, Math.floor((y0 - b[1]) / cs)); j <= Math.min(ny - 1, Math.ceil((y1 - b[1]) / cs)); j++) if (test(b[0] + i * cs, b[1] + j * cs)) g[j * nx + i] = 1; };
  for (const w of P.walls) { const r = wallT(w) / 2 + 130, ops = P.openings.filter((o) => o.wall === w.id && o.sill < 150 && !/window|full/.test(o.type)).map((o) => { const gg = openingGeom(o); return gg; }).filter(Boolean);
    mark(Math.min(w.x1, w.x2) - r, Math.min(w.y1, w.y2) - r, Math.max(w.x1, w.x2) + r, Math.max(w.y1, w.y2) + r, (x, y) => { const [d, t] = distPtSeg(x, y, w); if (d > r) return false; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), at = t * L; return !ops.some((gg) => { const a = Math.hypot(gg.a[0] - w.x1, gg.a[1] - w.y1), bb = Math.hypot(gg.b[0] - w.x1, gg.b[1] - w.y1); return at > Math.min(a, bb) + 120 && at < Math.max(a, bb) - 120; }); }); }
  for (const it of P.items) { if (it.hidden || !physical(it) || spec(it).layer !== 'floor' || zOf(it) > 400) continue; const a = (it.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), hw = it.w / 2 + 130, hd = it.d / 2 + 130, bb = aabb(corners(it));
    mark(bb[0] - 140, bb[1] - 140, bb[2] + 140, bb[3] + 140, (x, y) => { const dx = x - it.x, dy = y - it.y, lx = dx * c + dy * s, ly = -dx * s + dy * c; return Math.abs(lx) < hw && Math.abs(ly) < hd; }); }
  return { b, cs, nx, ny, g };
}
function astar(G, p, q) {
  const { b, cs, nx, ny, g } = G, ci = (pt) => [clamp(Math.round((pt[0] - b[0]) / cs), 0, nx - 1), clamp(Math.round((pt[1] - b[1]) / cs), 0, ny - 1)];
  const free = (c) => { if (!g[c[1] * nx + c[0]]) return c; for (let r = 1; r < 25; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const x = c[0] + dx, y = c[1] + dy; if (x >= 0 && y >= 0 && x < nx && y < ny && !g[y * nx + x]) return [x, y]; } return c; };
  const s = free(ci(p)), t = free(ci(q)), N = nx * ny, gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), open = [], si = s[1] * nx + s[0], ti = t[1] * nx + t[0];
  const h = (i) => { const x = i % nx, y = (i / nx) | 0, dx = Math.abs(x - t[0]), dy = Math.abs(y - t[1]); return dx + dy - .59 * Math.min(dx, dy); };
  const push = (i, f) => { open.push([f, i]); let k = open.length - 1; while (k) { const pk = (k - 1) >> 1; if (open[pk][0] <= open[k][0]) break; [open[pk], open[k]] = [open[k], open[pk]]; k = pk; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
  gs[si] = 0; push(h(si), si); let it = 0;
  while (open.length && it++ < 60000) { const [, i] = pop(); if (i === ti) break; const x = i % nx, y = (i / nx) | 0;
    for (const [dx, dy, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue; const j = Y * nx + X; if (g[j] && j !== ti) continue; if (dx && dy && (g[y * nx + X] || g[Y * nx + x])) continue; const ng = gs[i] + c; if (ng < gs[j]) { gs[j] = ng; from[j] = i; push(ng + h(j), j); } } }
  if (from[ti] < 0 && ti !== si) return [p, q];
  const cells = []; for (let i = ti; i >= 0 && i !== si; i = from[i]) cells.push(i); cells.push(si); cells.reverse();
  const pts = cells.map((i) => [b[0] + (i % nx) * cs, b[1] + ((i / nx) | 0) * cs]);
  const los = (a, c) => { const n = Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1]) / (cs / 2)); for (let k = 1; k < n; k++) { const x = a[0] + (c[0] - a[0]) * k / n, y = a[1] + (c[1] - a[1]) * k / n, ii = clamp(Math.round((x - b[0]) / cs), 0, nx - 1), jj = clamp(Math.round((y - b[1]) / cs), 0, ny - 1); if (g[jj * nx + ii]) return false; } return true; };
  const out = [p]; let k = 0; while (k < pts.length - 1) { let j = pts.length - 1; while (j > k + 1 && !los(pts[k], pts[j])) j--; out.push(pts[j]); k = j; } out.push(q); return out;
}
function simReset() {
  SIM.grid = simGrid(); SIM.cache.clear(); SIM.heatM = new Map(); SIM.hits = 0; SIM.contact = new Set();
  SIM.A = simData().actors.map((a, i) => { const st = a.plan.map((f, k) => null), s0 = stationOf(a.plan[0], null); return { a, i, pos: s0 ? [...s0.p] : [0, 0], hd: [0, 1], step: 0, path: null, pi: 0, wait: 0.5 + i * 0.7, ph: 0, dist: 0, loopD: 0, loopT: 0, t0: 0, last: null, stations: st, label: s0 ? s0.label : '' }; });
}
function simNext(A) { const a = A.a; if (!a.plan.length) return; if (A.step === 0 && A.t0) { A.last = { d: A.loopD, t: SIM.t - A.t0 }; A.loopD = 0; A.t0 = SIM.t; } if (!A.t0) A.t0 = SIM.t;
  A.step = (A.step + 1) % a.plan.length; const s = stationOf(a.plan[A.step], A.pos); if (!s) { A.wait = 0.3; return; } A.label = s.label; const key = Math.round(A.pos[0] / 50) + ',' + Math.round(A.pos[1] / 50) + '>' + Math.round(s.p[0] / 50) + ',' + Math.round(s.p[1] / 50);
  if (!SIM.cache.has(key)) SIM.cache.set(key, astar(SIM.grid, A.pos, s.p)); A.path = SIM.cache.get(key).map((p) => [...p]); A.pi = 1; }
function simStep(dt) { SIM.t += dt; const V = 1100;
  for (const A of SIM.A) { if (A.wait > 0) { A.wait -= dt; A.ph += dt * 3; if (A.wait <= 0) simNext(A); continue; }
    if (!A.path) { simNext(A); continue; } let go = V * dt; while (go > 0 && A.pi < A.path.length) { const q = A.path[A.pi], dx = q[0] - A.pos[0], dy = q[1] - A.pos[1], d = Math.hypot(dx, dy); if (d < 1) { A.pi++; continue; } const m = Math.min(go, d); A.hd = [dx / d, dy / d]; A.pos[0] += A.hd[0] * m; A.pos[1] += A.hd[1] * m; go -= m; A.dist += m; A.loopD += m; A.ph += m / 260; }
    if (A.pi >= A.path.length) { A.path = null; A.wait = DWELL[A.a.plan[A.step]] || 2; }
    const hk = Math.round(A.pos[0] / 300) + ',' + Math.round(A.pos[1] / 300); SIM.heatM.set(hk, (SIM.heatM.get(hk) || 0) + dt); }
  for (let i = 0; i < SIM.A.length; i++) for (let j = i + 1; j < SIM.A.length; j++) { const a = SIM.A[i], b = SIM.A[j], k = i + '-' + j, d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]); if (d < 550) { if (!SIM.contact.has(k)) { SIM.contact.add(k); SIM.hits++; } } else if (d > 800) SIM.contact.delete(k); }
  if (SIM.view === 'follow' && SIM.A[SIM.follow]) { const A = SIM.A[SIM.follow]; goal.tx = A.pos[0]; goal.tz = A.pos[1]; goal.ty = curElev() + 1100; goal.dist = 3800; goal.pitch = .62; goal.yaw = Math.atan2(-A.hd[1], -A.hd[0]); }
}
function drawMan(A) { const a = A.a, ang = Math.atan2(-A.hd[0], A.hd[1]), T = xf(A.pos[0], A.pos[1], ang), sw = A.wait > 0 ? 0 : Math.sin(A.ph) * 140, work = A.wait > 0, col = a.color, sk = '#e8c4a0', y0 = floorAt(A.pos[0], A.pos[1]);
  box(T, -150, -30, y0, y0 + 820, -70 + sw, 70 + sw, '#2b2d31'); box(T, 30, 150, y0, y0 + 820, -70 - sw, 70 - sw, '#2b2d31');
  box(T, -190, 190, y0 + 800, y0 + 1420, -110, 110, col); box(T, -160, 160, y0 + 820, y0 + 1300, 108, 116, '#f4f2ee');
  const arm = work ? 230 + Math.sin(A.ph * 2) * 40 : -sw; box(T, -260, -195, y0 + 900, y0 + 1400, -60 + arm, 60 + arm, col); box(T, 195, 260, y0 + 900, y0 + 1400, -60 + (work ? arm : sw), 60 + (work ? arm : sw), col);
  sph(T, 0, y0 + 1560, 0, 120, 140, 120, sk); box(T, -125, 125, y0 + 1640, y0 + 1720, -125, 125, '#f4f2ee'); }
function simDraw() { if (!SIM.on) return; const T0 = xf(0, 0, 0);
  if (SIM.heat) { let mx = 0; for (const v of SIM.heatM.values()) mx = Math.max(mx, v); if (mx > 0) for (const [k, v] of SIM.heatM) { const [i, j] = k.split(',').map(Number), q = v / mx; if (q < .05) continue; const col = q > .66 ? '#e5484d' : q > .33 ? '#f5a524' : '#30a46c'; box(T0, i * 300 - 150, i * 300 + 150, 6, 9, j * 300 - 150, j * 300 + 150, col, 'plain', .22 + .45 * q); } }
  for (const A of SIM.A) { if (A.path) for (let k = Math.max(1, A.pi); k < A.path.length; k++) { const p = k === A.pi ? A.pos : A.path[k - 1], q = A.path[k], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > 20) box(xf(p[0], p[1], Math.atan2(q[1] - p[1], q[0] - p[0])), 0, L, 12, 18, -18, 18, A.a.color, 'plain', .7); } drawMan(A); } }
function simStart() {
  if (!simData().actors.length) simAdd('fry'); simReset(); SIM.on = true; SIM.run = true; NOCEIL = true; dirty3d = true; if (!DYN.includes(simDraw)) DYN.push(simDraw);
  if (view === '2d') setView(isMobile() ? '3d' : 'split'); const kr = kitchenRoom(); if (SIM.view === 'god') { const b = kr ? aabb(kr.pts) : bounds(); anim = { t0: performance.now(), dur: 900, a: { ...cam }, b: { yaw: cam.yaw, pitch: 1.2, dist: Math.max(b[2] - b[0], b[3] - b[1]) * 1.6 + 2500, tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2 } }; }
  renderSim(); }
function simStop(full) { SIM.run = false; if (full) { SIM.on = false; NOCEIL = false; DYN = DYN.filter((f) => f !== simDraw); if (SIM.rec) recStop(); dirty3d = true; } renderSim(); need3d = true; }
function simAdd(role) { const d = simData(), i = d.actors.length, R = ROLES[role] || ROLES.fry; d.actors.push({ id: uid('m'), name: `직원 ${i + 1} · ${R[0]}`, role, color: SIMCOL[i % SIMCOL.length], plan: [...R[1]] }); commit(true); if (SIM.on) simReset(); renderSim(); }
function recStart() { if (!window.MediaRecorder || !gc.captureStream) { toast('이 기기에서는 화면 녹화를 지원하지 않아요'); return; } const st = gc.captureStream(30), mt = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const r = new MediaRecorder(st, mt ? { mimeType: mt, videoBitsPerSecond: 6e6 } : {}), parts = []; r.ondataavailable = (e) => e.data.size && parts.push(e.data); r.onstop = async () => { const blob = new Blob(parts, { type: r.mimeType || 'video/webm' }); const ok = await saveLocal({ name: `주방동선_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.${/mp4/.test(r.mimeType) ? 'mp4' : 'webm'}`, blob }); toast(ok ? '녹화 영상을 저장했어요' : '저장하지 못했어요'); };
  r.start(500); SIM.rec = r; SIM.recT = performance.now(); renderSim(); toast('녹화 중 · 다시 누르면 멈추고 저장해요'); }
function recStop() { if (SIM.rec) { SIM.rec.stop(); SIM.rec = null; renderSim(); } }
function renderSim() {
  let p = $('#simPanel'); if (!p) { $('#stage').insertAdjacentHTML('beforeend', '<div class="simpanel glass" id="simPanel" hidden></div>'); p = $('#simPanel'); p.addEventListener('click', simClick); p.addEventListener('change', simChange); }
  p.hidden = !SIM.panel; if (!SIM.panel || !P) return; const d = simData(), opt = Object.entries(FAMN).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  p.innerHTML = `<div class="sph"><b>주방 동선 시뮬레이터</b><button class="qb" data-sim="close" aria-label="닫기">✕</button></div>
    <div class="simlist">${d.actors.map((a, i) => { const A = SIM.A[i]; return `<div class="simrow"><span class="sdot" style="background:${a.color}"></span><div class="sbody"><input class="sname" data-sname="${i}" value="${esc(a.name)}" aria-label="이름">
      <div class="splan">${a.plan.map((f, k) => `<span class="schip ${SIM.on && A && A.step === k ? 'on' : ''}">${FAMN[f] || f}<button data-sdel="${i}:${k}" aria-label="빼기">×</button></span>`).join('<span class="sarr">→</span>')}<select data-sadd="${i}" aria-label="단계 추가"><option value="">+ 단계</option>${opt}</select></div>
      ${A && A.last ? `<small class="muted">1회 ${(A.last.d / 1000).toFixed(1)}m · ${A.last.t.toFixed(0)}초</small>` : A ? `<small class="muted">${esc(A.label || '')}</small>` : ''}</div><button class="qb danger" data-srm="${i}" aria-label="사람 빼기">✕</button></div>`; }).join('') || '<p class="hint">사람을 넣고 일하는 순서를 정하세요</p>'}</div>
    <div class="row wrap"><select data-sim="addrole" aria-label="역할로 사람 추가"><option value="">+ 사람 추가</option>${Object.entries(ROLES).map(([k, r]) => `<option value="${k}">${r[0]}</option>`).join('')}</select></div>
    <div class="row wrap"><button class="btn pri" data-sim="play">${SIM.run ? '❚❚ 멈춤' : '▶ 시작'}</button>${[1, 2, 4].map((s) => `<button class="chip ${SIM.speed === s ? 'on' : ''}" data-sspd="${s}">${s}x</button>`).join('')}<button class="chip ${SIM.view === 'god' ? 'on' : ''}" data-sim="god">위에서</button><button class="chip ${SIM.view === 'follow' ? 'on' : ''}" data-sim="follow">따라가기${d.actors.length > 1 ? ' ' + (SIM.follow + 1) : ''}</button></div>
    <div class="row wrap"><label class="chk"><input type="checkbox" data-sim="heat" ${SIM.heat ? 'checked' : ''}> 동선 열지도</label><button class="btn ${SIM.rec ? 'danger' : ''}" data-sim="rec">${SIM.rec ? '■ 녹화 멈추고 저장' : '● 녹화'}</button>${SIM.on ? '<button class="btn" data-sim="end">끝내기</button>' : ''}</div>
    ${SIM.on ? `<p class="hint">겹침(부딪힘) ${SIM.hits}회 · ${SIM.hits > SIM.t / 20 ? '동선이 자주 겹쳐요 · 기물 위치나 순서를 바꿔 보세요' : '동선이 크게 겹치지 않아요'}</p>` : '<p class="hint">시작하면 천장을 걷어 내고 위에서 봐요 · 빨갛게 진한 곳이 많이 다니는 곳</p>'}`;
}
function simClick(e) { const t = e.target.closest('button'); if (!t) return; const d = simData(), k = t.dataset.sim;
  if (k === 'close') { SIM.panel = false; simStop(true); }
  if (k === 'play') { if (!SIM.on) simStart(); else { SIM.run = !SIM.run; renderSim(); } }
  if (k === 'end') simStop(true);
  if (k === 'god') { SIM.view = 'god'; if (SIM.on) { const kr = kitchenRoom(), b = kr ? aabb(kr.pts) : bounds(); anim = { t0: performance.now(), dur: 800, a: { ...cam }, b: { yaw: cam.yaw, pitch: 1.2, dist: Math.max(b[2] - b[0], b[3] - b[1]) * 1.6 + 2500, tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2 } }; } renderSim(); }
  if (k === 'follow') { if (SIM.view === 'follow') SIM.follow = (SIM.follow + 1) % Math.max(1, d.actors.length); SIM.view = 'follow'; renderSim(); }
  if (k === 'rec') { SIM.rec ? recStop() : (SIM.on || simStart(), recStart()); }
  if (t.dataset.sspd) { SIM.speed = +t.dataset.sspd; renderSim(); }
  if (t.dataset.srm) { d.actors.splice(+t.dataset.srm, 1); commit(true); if (SIM.on) simReset(); renderSim(); }
  if (t.dataset.sdel) { const [i, kk] = t.dataset.sdel.split(':').map(Number); d.actors[i].plan.splice(kk, 1); commit(true); if (SIM.on) simReset(); renderSim(); } }
function simChange(e) { const t = e.target, d = simData();
  if (t.dataset.sim === 'addrole' && t.value) simAdd(t.value); if (t.dataset.sim === 'heat') { SIM.heat = t.checked; }
  if (t.dataset.sadd != null && t.value) { d.actors[+t.dataset.sadd].plan.push(t.value); commit(true); if (SIM.on) simReset(); renderSim(); }
  if (t.dataset.sname != null) { d.actors[+t.dataset.sname].name = t.value; commit(true); } }
setInterval(() => { if (SIM.panel && SIM.on) renderSimStats(); }, 1000);
function renderSimStats() { const p = $('#simPanel'); if (!p || p.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return; renderSim(); }
{ const _r3 = render3d; render3d = function () { _r3(); if (!SIM.on || !lastM || view === '2d') return; const ov = $('#ov3d'), r = gc.getBoundingClientRect();
    for (const A of SIM.A) { const q = proj(lastM, [A.pos[0], curElev() + 1950, A.pos[1]], r); if (!q) continue; const d = document.createElement('div'); d.className = 'pin simpin'; d.style.left = q[0] + 'px'; d.style.top = q[1] + 'px'; d.style.background = A.a.color; d.textContent = `${A.a.name.split(' · ')[0]}${A.wait > 0 ? ' · ' + (A.label || '') : ''}`; ov.appendChild(d); } }; }

/* ---------- 9. 공기 흐름 보기 (급기 · 출입구 → 후드 · 배기) ---------- */
const CMH_HP = 3600; // 시로코 팬 1마력 ≈ 60 CMM 정도로 잡은 어림값
var AIR = { on: false, parts: [], src: [], acc: 0 };
function airSources() {
  const S = []; for (const it of P.items) { if (it.hidden) continue; const L = libGet(it.type); if (!L.air) continue; const hp = it.hp ?? L.hp ?? 1, q = (L.air === 'in' ? 1 : -1) * hp * CMH_HP; S.push({ x: it.x, y: it.y, z: zOf(it) + (it.type === 'hood' ? 200 : 0), q, kind: it.type === 'hood' ? '후드' : L.air === 'in' ? '급기팬' : '배기팬' }); }
  const ext = new Set(exteriorWalls().map((w) => w.id)), b = bounds(), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  for (const o of P.openings) { if (!ext.has(o.wall) || o.sill > 200 || !/door|auto|slide|glass|fold|opening|arch/.test(o.type)) continue; const g = openingGeom(o); if (!g) continue; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2]; let nx = g.nx, ny = g.ny; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny < 0) { nx = -nx; ny = -ny; } S.push({ x: m[0] + nx * 250, y: m[1] + ny * 250, z: 1000, q: 0.5 * CMH_HP, kind: '출입구', door: 1 }); }
  return S;
}
function airVel(x, y) { let vx = 0, vy = 0; for (const s of AIR.src) { const dx = x - s.x, dy = y - s.y, r2 = dx * dx + dy * dy + 250000, k = s.q / r2; vx += dx * k; vy += dy * k; } return [vx * 520, vy * 520]; }
function airStep(dt) { const b = bounds(), sinks = AIR.src.filter((s) => s.q < 0), srcs = AIR.src.filter((s) => s.q > 0);
  AIR.acc += dt; while (AIR.acc > 0.025 && AIR.parts.length < 700) { AIR.acc -= 0.025; const tot = srcs.reduce((a, s) => a + s.q, 0);
    if (srcs.length && Math.random() < .8) { let r = Math.random() * tot, s = srcs[0]; for (const q of srcs) { r -= q.q; if (r <= 0) { s = q; break; } } const a = Math.random() * 6.28, rr = 150 + Math.random() * 250; AIR.parts.push({ x: s.x + Math.cos(a) * rr, y: s.y + Math.sin(a) * rr, z: s.z, age: 0, door: s.door }); }
    else AIR.parts.push({ x: b[0] + Math.random() * (b[2] - b[0]), y: b[1] + Math.random() * (b[3] - b[1]), z: 1200 + Math.random() * 800, age: 0 }); }
  AIR.parts = AIR.parts.filter((p) => { const [vx, vy] = airVel(p.x, p.y), sp = Math.hypot(vx, vy), k = sp > 2600 ? 2600 / sp : 1; p.vx = vx * k; p.vy = vy * k; p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
    let near = null, nd = 1e12; for (const s of sinks) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < nd) { nd = d; near = s; } } if (near) p.z += (near.z - p.z) * Math.min(1, dt * 1.2 * 2000 / (nd + 800)); if (near && nd < 320) return false;
    return p.age < 14 && p.x > b[0] - 500 && p.x < b[2] + 500 && p.y > b[1] - 500 && p.y < b[3] + 500; }); }
function airDraw() { if (!AIR.on) return; for (const p of AIR.parts) { const sp = Math.hypot(p.vx || 0, p.vy || 0); if (sp < 5) continue; const L = clamp(sp * .16, 120, 380); box(xf(p.x, p.y, Math.atan2(p.vy, p.vx)), -L / 2, L / 2, p.z, p.z + 40, -22, 22, p.door ? '#7fc8f8' : '#2f8fd6', 'plain', .85); }
  for (const s of AIR.src) { const r = Math.min(600, 160 + Math.abs(s.q) / 40); cyl(xf(0, 0, 0), s.x, s.y, r, s.z - 4, s.z + 4, s.q > 0 ? '#7fc8f8' : '#e5484d', 'plain', 20, .35); } }
function airSet(on) { AIR.on = !!on; const b = $('#airBtn'); if (b) b.setAttribute('aria-pressed', AIR.on); if (AIR.on) { AIR.src = airSources(); AIR.parts = []; if (!DYN.includes(airDraw)) DYN.push(airDraw); if (!AIR.src.some((s) => s.q < 0)) toast('후드 · 배기팬이 없어요 · 설비에서 넣으면 빨려 들어가는 흐름이 보여요'); }
  else DYN = DYN.filter((f) => f !== airDraw); renderAirHud(); need3d = true; }
function renderAirHud() { let h = $('#airHud'); if (!h) { $('#stage').insertAdjacentHTML('beforeend', '<div class="airhud glass" id="airHud" hidden></div>'); h = $('#airHud'); h.addEventListener('click', (e) => { if (e.target.closest('[data-airx]')) airSet(false); }); } h.hidden = !AIR.on; if (!AIR.on) return;
  const S = AIR.src, sup = S.filter((s) => s.q > 0 && !s.door).reduce((a, s) => a + s.q, 0), dr = S.filter((s) => s.door).reduce((a, s) => a + s.q, 0), ex = -S.filter((s) => s.q < 0).reduce((a, s) => a + s.q, 0), b = bounds(), vol = (b[2] - b[0]) * (b[3] - b[1]) * (P.ceilingH || 2700) / 1e9, net = ex - sup - dr;
  h.innerHTML = `<b>공기 흐름</b><span>급기 ${Math.round(sup)} · 출입구 ${Math.round(dr)} · 배기(후드) ${Math.round(ex)} CMH</span><span>${net > 0 ? `음압 ${Math.round(net)} CMH · 문 틈 · 창으로 더 빨려 들어와요` : net < 0 ? `양압 ${Math.round(-net)} CMH · 문으로 공기가 밀려 나가요` : '급기와 배기가 맞아요'}</span><span>환기 약 ${vol ? (ex / vol).toFixed(0) : 0}회/시간 (ACH)</span><small class="muted">파란 점선 = 공기 이동 · 빨간 원 = 빨아들이는 곳 · 1HP ≈ ${CMH_HP} CMH로 어림한 예측이에요</small><button class="qb" data-airx aria-label="끄기">✕</button>`; }

/* ---------- 10. 틱 (시뮬 · 공기) ---------- */
{ let lt = performance.now(), fr = 0; const tick = (now) => { const dt = Math.min(0.05, (now - lt) / 1000); lt = now; fr++;
    if (P && SIM.on && SIM.run) simStep(dt * SIM.speed); if (P && AIR.on) airStep(dt);
    if (P && (SIM.on || AIR.on)) { need3d = true; if (view !== '3d' && fr % 4 === 0) draw2d(); } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
{ const _d = draw2d; draw2d = function () { _d(); if (!P || view === '3d' || OFF) return; cx.save();
    if (AIR.on) { cx.strokeStyle = 'rgba(47,143,214,.85)'; cx.lineWidth = 1.6; for (const p of AIR.parts) { const sp = Math.hypot(p.vx || 0, p.vy || 0); if (sp < 5) continue; const L = clamp(sp * .12, 60, 260), a = toS(p.x - p.vx / sp * L / 2, p.y - p.vy / sp * L / 2), e = toS(p.x + p.vx / sp * L / 2, p.y + p.vy / sp * L / 2); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...e); cx.stroke(); } }
    if (SIM.on) for (const A of SIM.A) { const q = toS(...A.pos); cx.fillStyle = A.a.color; cx.beginPath(); cx.arc(q[0], q[1], Math.max(5, 260 * V.s), 0, 7); cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.stroke(); }
    cx.restore(); }; }

/* ---------- 11. 3D 메뉴 버튼 · 도구 메뉴 ---------- */
{ const c = $('#ceilBtn'); if (c) c.insertAdjacentHTML('afterend', '<button class="tg" id="xrBtn" aria-pressed="false" title="바닥 매립 · 벽 보강/전선 · 천장 배기/급기 보기">설치물</button><button class="tg" id="airBtn" aria-pressed="false" title="급기 · 배기 공기 흐름">공기</button><button class="tg" id="simBtn" title="주방 동선 시뮬레이터">동선</button><button class="tg" id="spaceBtn" title="공간으로 설계 (주방 · 홀 따로)">공간</button>'); }
$('#xrBtn').onclick = () => xrSet(!XR.on); $('#airBtn').onclick = () => airSet(!AIR.on); $('#simBtn').onclick = () => { SIM.panel = !SIM.panel; if (!SIM.panel) simStop(true); renderSim(); }; $('#spaceBtn').onclick = () => spaceSet(!SPACE.on);
{ const mm = $('#moreMenu'); mm.insertAdjacentHTML('afterbegin', '<button data-mm="sim"><b>주방 동선 시뮬레이터</b><small>사람 · 근무 순서 · 녹화</small></button><button data-mm="space"><b>공간으로 설계</b><small>주방 · 홀만 따로 보기</small></button><button data-mm="xr"><b>설치물 보기</b><small>매립 배수 · 보강재 · 배기</small></button><button data-mm="air"><b>공기 흐름</b><small>급기 · 후드 흡입 예측</small></button><button data-mm="ceil"><b>천장 켜기 · 끄기</b><small>투명 천장이 거슬릴 때</small></button><button data-mm="assets"><b>시트 · 간판 보관함</b><small>고화질 이미지 올려 붙이기</small></button>');
  mm.addEventListener('click', (e) => { const b = e.target.closest('[data-mm]'); if (!b) return; const k = b.dataset.mm, F = { sim: () => { SIM.panel = true; renderSim(); }, space: () => spaceSet(!SPACE.on), xr: () => xrSet(!XR.on), air: () => airSet(!AIR.on), ceil: () => setCeilOn(!(P.ceiling && P.ceiling.on)), assets: () => openAssets('any') }[k]; if (F) { e.stopImmediatePropagation(); mm.hidden = true; F(); } }, true); }
{ const _C = CMDS; CMDS = function () { const l = _C(); l.push({ g: '보기', n: '천장 끄기 · 켜기', run: () => setCeilOn(!(P.ceiling && P.ceiling.on)), k: '', kw: 'ceiling 천장 off' }, { g: '도구', n: '주방 동선 시뮬레이터', run: () => { SIM.panel = true; renderSim(); }, k: '', kw: 'sim 시뮬 동선 직원 사람' }, { g: '보기', n: '설치물 보기', run: () => xrSet(!XR.on), k: '', kw: 'xray 매립 보강재 전선 배기' }, { g: '보기', n: '공기 흐름 보기', run: () => airSet(!AIR.on), k: '', kw: 'air 급기 배기 후드' }, { g: '보기', n: '공간으로 설계', run: () => spaceSet(!SPACE.on), k: '', kw: 'space 주방 홀' }, { g: '도구', n: '시트 · 간판 보관함', run: () => openAssets('any'), k: '', kw: 'sticker sign 간판 시트 이미지' }); return l; }; }

/* ---------- 12. 태블릿 · 폰: 도구 접기 + 아이콘 독 ---------- */
const ICD = { menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', view: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>', ceil: '<path d="M3 7h18M6 7v3M18 7v3"/><path d="M8 17h8" stroke-dasharray="2 2"/>', xr: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2"/><path d="M8 16l3-4 2 2 3-5"/>', air: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>', sim: '<circle cx="12" cy="5" r="2"/><path d="M12 7v6l-3 7M12 13l3 7M8 10l4-2 4 2"/>', walk: '<path d="M4 20l6-6M14 4l6 6-8 8-6-6z"/>', props: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>', lib: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><path d="M16.5 13v7M13 16.5h7"/>' };
const di = (k) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICD[k]}</svg>`;
$('#stage').insertAdjacentHTML('beforeend', `<nav class="dock glass" id="dock" aria-label="빠른 도구"><button data-dk="menu" title="도구 · 패널 펼치기/접기">${di('menu')}<span>도구</span></button><button data-dk="lib" title="기물">${di('lib')}<span>기물</span></button><button data-dk="props" title="속성">${di('props')}<span>속성</span></button><button data-dk="view" title="2D · 3D">${di('view')}<span>보기</span></button><button data-dk="undo" title="되돌리기">${di('undo')}<span>되돌리기</span></button><button data-dk="ceil" title="천장">${di('ceil')}<span>천장</span></button><button data-dk="xr" title="설치물">${di('xr')}<span>설치물</span></button><button data-dk="air" title="공기">${di('air')}<span>공기</span></button><button data-dk="sim" title="동선">${di('sim')}<span>동선</span></button><button data-dk="walk" title="걷기">${di('walk')}<span>걷기</span></button></nav>`);
function setCompact(on) { document.body.classList.toggle('compact', !!on); document.body.classList.remove('cpL', 'cpR'); store.set('drs_compact', !!on); $$('[data-dk="menu"]').forEach((b) => b.setAttribute('aria-pressed', !on)); setTimeout(() => { try { applySplit(); } catch (e) {} draw2d(); need3d = true; }, 60); }
$('#dock').addEventListener('click', (e) => { const b = e.target.closest('[data-dk]'); if (!b) return; const k = b.dataset.dk, bd = document.body.classList;
  if (k === 'menu') setCompact(!bd.contains('compact'));
  if (k === 'lib') { if (isMobile()) openSheet('lib'); else { bd.toggle('cpL'); bd.remove('cpR'); } }
  if (k === 'props') { if (isMobile()) openSheet('props'); else { bd.toggle('cpR'); bd.remove('cpL'); } }
  if (k === 'view') setView(view === '3d' ? (isMobile() ? '2d' : 'split') : '3d');
  if (k === 'undo') undo(); if (k === 'ceil') setCeilOn(!(P.ceiling && P.ceiling.on)); if (k === 'xr') xrSet(!XR.on); if (k === 'air') airSet(!AIR.on); if (k === 'sim') { SIM.panel = !SIM.panel; if (!SIM.panel) simStop(true); renderSim(); } if (k === 'walk') { const w = $('#walkBtn'); if (w) w.click(); } });
{ const t = $('#tglRight'); if (t) t.insertAdjacentHTML('afterend', '<button class="ic" id="cpBtn" aria-label="작업 표시줄 가리기" title="도구 가리기 (아이콘만)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M9 14h6"/></svg></button>'); const c = $('#cpBtn'); if (c) c.onclick = () => setCompact(!document.body.classList.contains('compact')); }
{ const touch = matchMedia('(pointer: coarse)').matches, pref = store.get('drs_compact', null); if (pref === true || (pref === null && touch && innerWidth < 1400)) setCompact(true); }
renderCeilBtn(); regAssets();
window.APP_VERSION = 'v13 · 2026-11-06';
