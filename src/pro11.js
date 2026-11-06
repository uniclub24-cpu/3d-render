/* ================================================================
   v14 · 붙이기 "적용하기" · 회전 링 + 기울기 · 프리셋 테이블 수 · 동선(홀 포함 · 마네킹 · 색)
        공기 흐름(급기 · 배기 추가 · 가는 흐름선 · 벽 막힘) · 조명 색온도 · 천장 끄면 통과 선택
   ================================================================ */

/* ---------- 1. 붙이기: 아래에 항상 보이는 "적용하기" ---------- */
{ const _rq = renderQuick0; renderQuick0 = function () { _rq(); const q = $('#quick'); if (!q || q.hidden || qTab !== 'attach' || !sel) return; const go = $('#atGo', q); if (!go) return;
    const row = go.closest('.qrow'), D = AT[atType]; let f = $('.qfoot', q); if (!f) { f = document.createElement('div'); f.className = 'qfoot'; q.appendChild(f); }
    f.innerHTML = ''; if (row) { const al = $('#atAlong', row), sd = $('#atSide', row); if (al) f.appendChild(al.closest('label')); if (sd) f.appendChild(sd); row.remove(); }
    go.className = 'btn pri qapply'; go.textContent = `적용하기 · ${D ? D.n : ''} ${sel.kind === 'floor' || sel.kind === 'room' ? '놓기' : '붙이기'}`; f.appendChild(go);
    $$('[data-at]', q).forEach((b) => b.addEventListener('dblclick', () => { atType = b.dataset.at; renderQuick(); setTimeout(() => { const g = $('#atGo'); if (g) g.click(); }, 0); })); }; }
{ const _da = doAttach; doAttach = function () { const before = P.items.length + P.openings.length; try { _da(); } catch (e) { toast('붙이지 못했어요: ' + e.message); return; } if (P.items.length + P.openings.length > before) { dirty3d = true; need3d = true; draw2d(); renderProps(); } }; }

/* ---------- 2. 회전 링 (2D · 3D) + 기울기 ---------- */
var ROTG = { on: false, drag: null };
{ const _bi = buildItem; buildItem = function (it) {
    if (CUT && it.type === 'metalframe') { const h = it.h; it.h = Math.min(h || 2700, 1200); try { return _bi(it); } finally { it.h = h; } }
    if (!it.tilt) return _bi(it); const before = new Map(Object.entries(G).map(([k, g]) => [k, g.p.length])); _bi(it);
    const a = (it.rot || 0) * Math.PI / 180, ax = [Math.cos(a), 0, Math.sin(a)], th = it.tilt * Math.PI / 180, c = Math.cos(th), s = Math.sin(th), py = YOFF + zOf(it) + spec(it).h / 2, pv = [it.x, py, it.y];
    const rot = (v) => { const d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2], cr = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]]; return [v[0] * c + cr[0] * s + ax[0] * d * (1 - c), v[1] * c + cr[1] * s + ax[1] * d * (1 - c), v[2] * c + cr[2] * s + ax[2] * d * (1 - c)]; };
    for (const [k, g] of Object.entries(G)) { const b0 = before.get(k) || 0; for (let i = b0; i < g.p.length; i += 3) { const r = rot([g.p[i] - pv[0], g.p[i + 1] - pv[1], g.p[i + 2] - pv[2]]); g.p[i] = r[0] + pv[0]; g.p[i + 1] = r[1] + pv[1]; g.p[i + 2] = r[2] + pv[2]; const n = rot([g.n[i], g.n[i + 1], g.n[i + 2]]); g.n[i] = n[0]; g.n[i + 1] = n[1]; g.n[i + 2] = n[2]; } } }; }
function rotTarget() { if (!sel || sel.kind !== 'item' || multi.length > 1) return null; return itemOf(sel.id); }
function ringPos() { const it = rotTarget(); if (!it) return null; const st = $('#stage').getBoundingClientRect();
  if (view !== '2d' && lastM) { const r = gc.getBoundingClientRect(), q = proj(lastM, [it.x, curElev() + zOf(it) + spec(it).h / 2, it.y], r); if (q && q[0] > 0 && q[1] > 0 && q[0] < r.width && q[1] < r.height) return [r.left - st.left + q[0], r.top - st.top + q[1], '3d']; }
  if (view !== '3d') { const r = cv.getBoundingClientRect(), q = toS(it.x, it.y); return [r.left - st.left + q[0], r.top - st.top + q[1], '2d']; } return null; }
function ringShow(on) { ROTG.on = !!on; let g = $('#rotRing'); if (!g) {
    $('#stage').insertAdjacentHTML('beforeend', '<div class="rotring" id="rotRing" hidden><div class="rrc" data-rr="yaw" title="링을 잡고 돌리기 (Shift: 15° 단위)"></div><div class="rrk" data-rr="yaw"></div><div class="rrt" data-rr="tilt" title="위아래로 끌어 기울기"><span>기울기</span></div><b class="rrv"></b></div>'); g = $('#rotRing');
    g.addEventListener('pointerdown', (e) => { const k = e.target.closest('[data-rr]'); if (!k) return; const it = rotTarget(); if (!it) return; e.preventDefault(); e.stopPropagation(); g.setPointerCapture(e.pointerId); const b = g.getBoundingClientRect(), c = [b.left + b.width / 2, b.top + b.height / 2];
      ROTG.drag = { k: k.dataset.rr, c, a0: Math.atan2(e.clientY - c[1], e.clientX - c[0]), r0: it.rot || 0, t0: it.tilt || 0, y0: e.clientY, x0: e.clientX, pane: ringPos() && ringPos()[2] }; });
    g.addEventListener('pointermove', (e) => { const D = ROTG.drag, it = rotTarget(); if (!D || !it) return; if (D.k === 'yaw') { let d = (Math.atan2(e.clientY - D.c[1], e.clientX - D.c[0]) - D.a0) * 180 / Math.PI; if (D.pane === '3d' && cam.pitch < 0.5) d = (e.clientX - D.x0) * 0.6; let r = D.r0 + d; r = e.shiftKey ? Math.round(r / 15) * 15 : Math.round(r); it.rot = ((r % 360) + 360) % 360; }
      else it.tilt = clamp(Math.round(D.t0 - (e.clientY - D.y0) * 0.5), -90, 90); D.moved = true; dirty3d = true; need3d = true; draw2d(); ringUpd(); });
    g.addEventListener('pointerup', () => { if (ROTG.drag && ROTG.drag.moved) { commit(); renderProps(); } ROTG.drag = null; }); }
  ringUpd(); }
function ringUpd() { const g = $('#rotRing'); if (!g) return; const p = ROTG.on && ringPos(), it = rotTarget(); g.hidden = !p || !it; if (g.hidden) return; g.style.left = p[0] + 'px'; g.style.top = p[1] + 'px';
  const a = (it.rot || 0) * Math.PI / 180; $('.rrk', g).style.transform = `translate(${Math.cos(a - Math.PI / 2) * 62}px, ${Math.sin(a - Math.PI / 2) * 62}px)`; $('.rrv', g).textContent = `${it.rot || 0}°${it.tilt ? ` · 기울기 ${it.tilt}°` : ''}`; }
{ let fr = 0; const loop = () => { if (ROTG.on && !ROTG.drag && ++fr % 3 === 0) ringUpd(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
{ const _rp = rotPop; rotPop = function (btn) { _rp(btn); const p = $('#rotPop'), it = rotTarget(); ringShow(!!it);
    if (it) { p.insertAdjacentHTML('beforeend', `<div class="row" style="align-items:center"><label class="qf" style="flex:1"><span>기울기 (위아래) <b id="rpTV">${it.tilt || 0}°</b></span><input type="range" id="rpTilt" min="-90" max="90" step="1" value="${it.tilt || 0}"></label><button class="qb" id="rpT0">0°</button></div><p class="hint" style="margin:0">물건 위 동그란 링을 잡고 돌리거나, 오른쪽 "기울기" 손잡이를 위아래로 끌어요</p>`);
      $('#rpTilt').oninput = (e) => { it.tilt = +e.target.value; $('#rpTV').textContent = it.tilt + '°'; dirty3d = true; need3d = true; ringUpd(); }; $('#rpTilt').onchange = () => commit(); $('#rpT0').onclick = () => { it.tilt = 0; $('#rpTilt').value = 0; $('#rpTV').textContent = '0°'; commit(); dirty3d = true; ringUpd(); }; } }; }
document.addEventListener('click', (e) => { if (ROTG.on && !e.target.closest('#rotPop') && !e.target.closest('#rotRing') && !e.target.closest('[data-cx="rot"]')) { const p = $('#rotPop'); if (!p || p.hidden) ringShow(false); } }, false);
{ const _ps = pickSel; pickSel = function (h) { _ps(h); if (ROTG.on && (!h || h.kind !== 'item')) ringShow(false); else if (ROTG.on) ringUpd(); }; }
{ const _rp = renderProps0; renderProps0 = function () { _rp(); if (!P || !sel || sel.kind !== 'item') return; const it = itemOf(sel.id); if (!it) return; const el = $('#props'), sh = spec(it).L.shape;
    el.insertAdjacentHTML('beforeend', `<div class="g3"><label class="fld"><span>기울기 °</span><input type="number" id="pTilt" value="${it.tilt || 0}" min="-90" max="90"></label><button class="btn" id="pRing">회전 링 켜기</button></div>`);
    $('#pTilt').onchange = (e) => { it.tilt = clamp(+e.target.value || 0, -90, 90); commit(); dirty3d = true; }; $('#pRing').onclick = () => ringShow(true);
    if (['light', 'pendant', 'track'].includes(sh)) { el.insertAdjacentHTML('beforeend', `<div class="lbl">조명 (실사 렌더)</div><div class="g3"><label class="fld"><span>색온도 <b id="lkV">${it.kelvin || 3500}K</b></span><input type="range" id="lkK" min="2200" max="6500" step="100" value="${it.kelvin || 3500}"></label><label class="fld"><span>밝기 <b id="lkPV">${Math.round((it.pw ?? 1) * 100)}%</b></span><input type="range" id="lkP" min="0.1" max="3" step="0.1" value="${it.pw ?? 1}"></label></div><p class="hint">기본 3500K (3000~4000K 따뜻한 흰빛) · 실사 렌더(내보내기 → Realistic Render)에 반영돼요</p>`);
      $('#lkK').oninput = (e) => { $('#lkV').textContent = e.target.value + 'K'; }; $('#lkK').onchange = (e) => { selList().filter((s) => s.kind === 'item').forEach((s) => { const x = itemOf(s.id); if (x) x.kelvin = +e.target.value; }); commit(); };
      $('#lkP').oninput = (e) => { $('#lkPV').textContent = Math.round(e.target.value * 100) + '%'; }; $('#lkP').onchange = (e) => { selList().filter((s) => s.kind === 'item').forEach((s) => { const x = itemOf(s.id); if (x) x.pw = +e.target.value; }); commit(); }; } }; }
{ const _rl = realLights; realLights = function () { const out = _rl(); let i = 0; for (const it of P.items) { if (it.hidden) continue; const sh = spec(it).L.shape; if (!['light', 'pendant', 'track'].includes(sh)) continue; const o = out[i++]; if (o) { o.k = it.kelvin || 3500; o.pw = it.pw ?? 1; } } return out; }; }

/* ---------- 3. 천장을 끄면 천장이 없는 것처럼 고르기 ---------- */
{ const _ch = ceilHit; ceilHit = function (e) { if (!P || !P.ceiling || !P.ceiling.on || vis.ceiling === false || NOCEIL) return null; return _ch(e); }; }
{ const _sc = setCeilOn; setCeilOn = function (on) { for (const r of rooms()) if (r.ceil) delete r.ceil.on; _sc(on); }; }
{ const c = $('#ceilShow'); if (c) c.addEventListener('change', () => { for (const r of rooms()) if (r.ceil) delete r.ceil.on; dirty3d = true; renderCeilBtn(); }); }

/* ---------- 4. 프리셋: 바테이블 유무 · 최대 4인 테이블 수 (빈 곳을 다 채우지 않음) ---------- */
{ const w = $('#psWin'); if (w) w.closest('.row').insertAdjacentHTML('beforeend', '<label class="chk"><input type="checkbox" id="psBar" checked> 바테이블</label><label class="qf"><span>최대 4인 테이블</span><input type="number" id="psMaxT" min="0" max="40" placeholder="자동" style="width:70px"></label>'); }
{ const _r = psRead; psRead = function () { const o = _r(); o.bar = $('#psBar').checked; const m = $('#psMaxT').value; o.maxT = m === '' ? null : clamp(+m, 0, 40); return o; }; }
{ const _op = openPreset; openPreset = function (f) { _op(f); const o = P.preset && P.preset.opt; if (o && !f) { $('#psBar').checked = o.bar !== false; $('#psMaxT').value = o.maxT ?? ''; } else { $('#psBar').checked = true; $('#psMaxT').value = ''; } const R = presetRect(); if (R) $('#psMaxT').placeholder = `자동 ${autoTables(R)}`; }; }
function autoTables(R) { const W = R[2] - R[0], D = R[3] - R[1], hall = W * D * 0.68 / 1e6; return Math.max(2, Math.round(hall / 10)); }
{ const _ap = applyPreset; applyPreset = function (opt) { const r = _ap(opt); if (!r || !P.preset) return r; P.preset.opt.bar = opt.bar; P.preset.opt.maxT = opt.maxT; return r; }; }

/* ---------- 5. 동선: 홀까지 · 직원 색 · 마네킹 ---------- */
Object.assign(FAM, { table: /^(t2|t4|t6|tround|tbar)/, bev: /^showcase/ });
Object.assign(FAMN, { passH: '배식구 (홀 쪽)', table: '테이블 (가까운)', bev: '음료냉장고', door: '출입구' });
Object.assign(DWELL, { passH: 1.5, table: 3, bev: 1.5, door: 1 });
ROLES.serve = ['홀 서빙', ['counter', 'passH', 'table', 'passH', 'counter']]; ROLES.cashier = ['카운터 · 음료', ['counter', 'bev', 'counter', 'door', 'counter']];
const KFAM = new Set(['fridge', 'work', 'fryer', 'range', 'sink', 'dish', 'rack']);
function tableList() { return P.items.filter((it) => !it.hidden && /^(t2|t4|t6|tround|tbar)/.test(it.type)).sort((a, b) => a.y - b.y || a.x - b.x); }
function famName(f) { if (/^item:/.test(f)) { const id = f.slice(5), i = tableList().findIndex((t) => t.id === id); const it = itemOf(id); return it ? (i >= 0 ? `테이블 ${i + 1}` : spec(it).name) : '(없음)'; } return FAMN[f] || f; }
{ const _so = stationOf; stationOf = function (fam, from) { const kr = kitchenRoom();
    if (/^item:/.test(fam)) { const it = itemOf(fam.slice(5)); if (!it) return null; const r = (it.rot || 0) * Math.PI / 180, f = [-Math.sin(r), Math.cos(r)], off = /^t/.test(it.type) ? Math.max(it.w, it.d) / 2 + 350 : it.d / 2 + 380; return { p: [it.x + f[0] * off, it.y + f[1] * off], label: famName(fam) }; }
    if (fam === 'passH') { let best = null; for (const o of P.openings.filter((x) => /pass/.test(x.type))) { const g = openingGeom(o); if (!g) continue; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2]; for (const s of [1, -1]) { const p = [m[0] + g.nx * s * 600, m[1] + g.ny * s * 600]; if (kr && pointInPoly(p[0], p[1], kr.pts)) continue; const d = from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : 0; if (!best || d < best.d) best = { d, p }; } } return best && { p: best.p, label: '배식구 (홀)' }; }
    if (fam === 'door') { const g0 = P.openings.find((o) => o.pz === 'gate') || P.openings.find((o) => /door|auto|slide|glass/.test(o.type)), g = g0 && openingGeom(g0); if (!g) return null; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], b = bounds(), c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; let nx = g.nx, ny = g.ny; if ((c[0] - m[0]) * nx + (c[1] - m[1]) * ny < 0) { nx = -nx; ny = -ny; } return { p: [m[0] + nx * 700, m[1] + ny * 700], label: '출입구' }; }
    if (KFAM.has(fam) || fam === 'pass') return _so(fam, from);
    let best = null; for (const it of P.items) { if (it.hidden || !FAM[fam] || !FAM[fam].test(it.type)) continue; const r = (it.rot || 0) * Math.PI / 180, f = [-Math.sin(r), Math.cos(r)], off = fam === 'table' ? Math.max(it.w, it.d) / 2 + 350 : it.d / 2 + 380, p = [it.x + f[0] * off, it.y + f[1] * off], d = from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : 0; if (!best || d < best.d) best = { d, p, label: fam === 'table' ? famName('item:' + it.id) : spec(it).name }; }
    return best && { p: best.p, label: best.label }; }; }
function ell(T, x, y, z, rx, ry, rz, col) { const g = grp('plain'), c = tintC(hexRGB(col)), nu = 16, nv = 10, pt = (i, j) => { const th = 2 * Math.PI * i / nu, ph = Math.PI * j / nv; return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; };
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const q = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)], m = pt(i + .5, j + .5), sh = 0.9 + 0.1 * m[1]; quad(g, q.map((u) => T.P(x + u[0] * rx, y + u[1] * ry, z + u[2] * rz)), T.N(m[0] / rx, m[1] / ry, m[2] / rz).map((v, k, arr) => v / Math.hypot(...arr)), c.map((v) => v * sh)); } }
function drawMan(A) { // 마네킹: 매끈한 흰 몸 + 반팔 · 반바지(직원 색)
  const a = A.a, ang = Math.atan2(-A.hd[0], A.hd[1]), T = xf(A.pos[0], A.pos[1], ang), sw = A.wait > 0 ? 0 : Math.sin(A.ph), work = A.wait > 0, col = a.color, sk = '#ececef', y0 = floorAt(A.pos[0], A.pos[1]);
  for (const s of [-1, 1]) { const k = s * sw * 110, x = s * 92;
    ell(T, x, y0 + 35, 40 + k * 1.3, 48, 35, 105, '#d6d6db'); cyl(T, x, k * 1.1, 46, y0 + 60, y0 + 470, sk, 'plain', 14); ell(T, x, y0 + 480, k * 0.8, 52, 55, 55, sk);
    cyl(T, x, k * 0.5, 64, y0 + 480, y0 + 700, sk, 'plain', 14); cyl(T, x, k * 0.4, 72, y0 + 650, y0 + 860, col, 'plain', 14); }
  ell(T, 0, y0 + 880, 0, 175, 115, 115, col); ell(T, 0, y0 + 1060, 0, 150, 150, 100, col); ell(T, 0, y0 + 1250, 8, 185, 140, 118, col); ell(T, 0, y0 + 1390, 0, 150, 60, 95, col);
  for (const s of [-1, 1]) { const x = s * 228, k = work ? 0 : -s * sw * 100, fw = work ? 1 : 0;
    ell(T, x, y0 + 1330, 0, 70, 70, 70, col); cyl(T, x + s * 5, k * 0.4, 44, y0 + 1180, y0 + 1340, col, 'plain', 12); cyl(T, x + s * 8, k * 0.6, 34, y0 + 1060, y0 + 1200, sk, 'plain', 12);
    if (fw) { const L = 240 + Math.sin(A.ph * 2 + s) * 25; box(T, x - 30, x + 30, y0 + 1030, y0 + 1080, 20, L, sk); ell(T, x, y0 + 1055, L + 15, 40, 35, 45, sk); }
    else { cyl(T, x + s * 10, k, 30, y0 + 820, y0 + 1070, sk, 'plain', 12); ell(T, x + s * 10, y0 + 800, k, 38, 50, 32, sk); } }
  cyl(T, 0, 0, 50, y0 + 1420, y0 + 1500, sk, 'plain', 12); ell(T, 0, y0 + 1600, 6, 95, 120, 105, sk);
}
{ const _rs = renderSim; renderSim = function () { _rs(); const p = $('#simPanel'); if (!p || p.hidden || !P) return; const d = simData();
    $$('.sdot', p).forEach((dot, i) => { const a = d.actors[i]; if (!a) return; dot.outerHTML = `<label class="sdotc" title="직원 색 바꾸기" style="background:${a.color}"><input type="color" data-scol="${i}" value="${a.color}"></label>`; });
    const tl = tableList(), extra = tl.map((t, i) => `<option value="item:${t.id}">테이블 ${i + 1}</option>`).join('');
    $$('[data-sadd]', p).forEach((s) => { s.insertAdjacentHTML('beforeend', `<option value="passH">배식구 (홀 쪽)</option><option value="table">테이블 (가까운)</option><option value="bev">음료냉장고</option><option value="door">출입구</option>${extra}`); const seen = new Set(); [...s.options].forEach((o) => { if (seen.has(o.value)) o.remove(); else seen.add(o.value); }); });
    $$('.splan', p).forEach((row, i) => { const a = d.actors[i]; if (!a) return; $$('.schip', row).forEach((c, k) => { const t = c.firstChild; if (t && t.nodeType === 3) t.textContent = famName(a.plan[k]); }); }); }; }
document.addEventListener('input', (e) => { const t = e.target; if (t.dataset && t.dataset.scol != null) { const a = simData().actors[+t.dataset.scol]; if (a) { a.color = t.value; t.parentElement.style.background = t.value; need3d = true; } } });
document.addEventListener('change', (e) => { const t = e.target; if (t.dataset && t.dataset.scol != null) { commit(true); renderSim(); } });
{ const _ss = simStart; simStart = function () { _ss(); if (SIM.view !== 'god') return; const hall = simData().actors.some((a) => a.plan.some((f) => !KFAM.has(f) && f !== 'pass')); if (hall) { const b = bounds(); anim = { t0: performance.now(), dur: 900, a: { ...cam }, b: { yaw: cam.yaw, pitch: 1.15, dist: Math.max(b[2] - b[0], b[3] - b[1]) * 1.3 + 2500, tx: (b[0] + b[2]) / 2, ty: curElev(), tz: (b[1] + b[3]) / 2 } }; } }; }

/* ---------- 6. 공기 흐름: 급기 · 배기 추가 · 가늘고 긴 흐름선 · 벽에 막힘 ---------- */
{ const s = LIB.find((l) => l.id === 'supplyfan'), x = LIB.find((l) => l.id === 'exhaustfan'); if (s) s.name = '급기 디퓨저 (팬)'; if (x) x.name = '배기 그릴 (팬)'; }
function airAdd(kind, hp, n) {
  const kr = SPACE.on && roomOf(SPACE.id) ? roomOf(SPACE.id) : (kind === 'out' ? kitchenRoom() : rooms().find((r) => r.kind === '홀')) || null, b = kr ? aabb(kr.pts) : bounds(), long = b[2] - b[0] >= b[3] - b[1], gid = uid('g'), made = [];
  for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, x = long ? b[0] + (b[2] - b[0]) * f : (b[0] + b[2]) / 2, y = long ? (b[1] + b[3]) / 2 : b[1] + (b[3] - b[1]) * f;
    const it = { id: uid('i'), type: kind === 'in' ? 'supplyfan' : 'exhaustfan', x: Math.round(x), y: Math.round(y), w: 450, d: 450, rot: 0, hp: +(hp / n).toFixed(3), grp: gid, tag: `${kind === 'in' ? '급기' : '배기'} ${hp}HP · ${n}개 중 ${i + 1}` }; P.items.push(it); made.push(it); }
  commit(); dirty3d = true; AIR.src = airSources(); renderAirHud(); toast(`${kind === 'in' ? '급기' : '배기'} ${hp}HP를 ${n}개 ${kind === 'in' ? '디퓨저' : '그릴'}로 나눠 달았어요 (개당 ${(hp / n).toFixed(2)}HP) · 끌어서 위치를 옮기면 흐름이 바로 바뀌어요`); }
{ const _rh = renderAirHud; renderAirHud = function () { _rh(); const h = $('#airHud'); if (!h || h.hidden) return; const hpO = [0.5, 1, 1.5, 2].map((v) => `<option value="${v}" ${v === 1 ? 'selected' : ''}>${v}HP</option>`).join(''), nO = [1, 2, 3, 4, 6].map((v) => `<option>${v}</option>`).join('');
    h.insertAdjacentHTML('beforeend', `<div class="airadd"><select id="aiHp" aria-label="마력">${hpO}</select><select id="aiN" aria-label="그릴 · 디퓨저 수">${nO}</select><span class="muted">개로 나눔</span><button class="btn" data-aiadd="in">+ 급기</button><button class="btn" data-aiadd="out">+ 배기</button></div>`); }; }
document.addEventListener('click', (e) => { const b = e.target.closest('[data-aiadd]'); if (b) airAdd(b.dataset.aiadd, +$('#aiHp').value, +$('#aiN').value); });
setInterval(() => { if (AIR.on && P) { AIR.src = airSources(); } }, 500);
setInterval(() => { if (AIR.on && P && !$('#airHud').contains(document.activeElement)) renderAirHud(); }, 2000);
function wallBlock(x0, y0, x1, y1) { for (const w of P.walls) { const d1x = x1 - x0, d1y = y1 - y0, d2x = w.x2 - w.x1, d2y = w.y2 - w.y1, den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-9) continue; const t = ((w.x1 - x0) * d2y - (w.y1 - y0) * d2x) / den, u = ((w.x1 - x0) * d1y - (w.y1 - y0) * d1x) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    const L = Math.hypot(d2x, d2y), at = u * L; if (P.openings.some((o) => { if (o.wall !== w.id) return false; const g = openingGeom(o); if (!g) return false; const a = Math.hypot(g.a[0] - w.x1, g.a[1] - w.y1), bb = Math.hypot(g.b[0] - w.x1, g.b[1] - w.y1); return at > Math.min(a, bb) && at < Math.max(a, bb) && (o.sill < 1800); })) continue; return true; } return false; }
airStep = function (dt) { const b = bounds(), sinks = AIR.src.filter((s) => s.q < 0), srcs = AIR.src.filter((s) => s.q > 0); AIR.acc += dt;
  while (AIR.acc > 0.012 && AIR.parts.length < 520) { AIR.acc -= 0.012; const tot = srcs.reduce((a, s) => a + s.q, 0);
    if (srcs.length && Math.random() < .85) { let r = Math.random() * tot, s = srcs[0]; for (const q of srcs) { r -= q.q; if (r <= 0) { s = q; break; } } const a = Math.random() * 6.28, rr = 120 + Math.random() * 200; AIR.parts.push({ x: s.x + Math.cos(a) * rr, y: s.y + Math.sin(a) * rr, z: s.z, age: 0, door: s.door, tr: [] }); }
    else AIR.parts.push({ x: b[0] + Math.random() * (b[2] - b[0]), y: b[1] + Math.random() * (b[3] - b[1]), z: 1200 + Math.random() * 900, age: 0, tr: [] }); }
  AIR.parts = AIR.parts.filter((p) => { const [vx, vy] = airVel(p.x, p.y), sp = Math.hypot(vx, vy), k = sp > 2600 ? 2600 / sp : 1; p.vx = vx * k; p.vy = vy * k; const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (wallBlock(p.x, p.y, nx, ny)) { p.dead = (p.dead || 0) + 1; p.vx *= -.2; p.vy *= -.2; if (p.dead > 3) return false; } else { p.x = nx; p.y = ny; } p.age += dt;
    p.tt = (p.tt || 0) + dt; if (p.tt > 0.06) { p.tt = 0; p.tr.push([p.x, p.y, p.z]); if (p.tr.length > 12) p.tr.shift(); }
    let near = null, nd = 1e12; for (const s of sinks) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < nd) { nd = d; near = s; } } if (near) p.z += (near.z - p.z) * Math.min(1, dt * 1.2 * 2000 / (nd + 800)); if (near && nd < 300) return false;
    return p.age < 16 && p.x > b[0] - 500 && p.x < b[2] + 500 && p.y > b[1] - 500 && p.y < b[3] + 500; }); };
{ const i = DYN.indexOf(airDraw); airDraw = function () { if (!AIR.on) return; const Tz = xf(0, 0, 0);
    for (const p of AIR.parts) { const pts = [...p.tr, [p.x, p.y, p.z]], n = pts.length; if (n < 2) continue; const col = p.door ? '#7fc8f8' : '#2f8fd6';
      for (let k = 1; k < n; k++) { const a = pts[k - 1], c = pts[k], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 5) continue; const al = Math.round((0.3 + 0.65 * k / n) * 4) / 4, g = grp('plain', Math.min(0.999, al)), C = tintC(hexRGB(col)), ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, w = 11;
        const v = [[a[0] - uy * w, a[2], a[1] + ux * w], [c[0] - uy * w, c[2], c[1] + ux * w], [c[0] + uy * w, c[2], c[1] - ux * w], [a[0] + uy * w, a[2], a[1] - ux * w]].map((q) => Tz.P(q[0] - 0, q[1], q[2])); void Tz;
        quad(g, [[v[0][0], v[0][1], v[0][2]], v[1], v[2], v[3]], [0, 1, 0], C); quad(g, [[a[0], a[2] - w, a[1]], [c[0], c[2] - w, c[1]], [c[0], c[2] + w, c[1]], [a[0], a[2] + w, a[1]]].map((q) => [q[0], q[1] + YOFF, q[2]]), [-uy, 0, ux], C); } }
    for (const s of AIR.src) { const r = Math.min(600, 160 + Math.abs(s.q) / 40); cyl(Tz, s.x, s.y, r, s.z - 4, s.z + 4, s.q > 0 ? '#7fc8f8' : '#e5484d', 'plain', 20, .35); } };
  if (i >= 0) DYN[i] = airDraw; }
{ const _as = airSet; airSet = function (on) { DYN = DYN.filter((f) => f.name !== 'airDraw' && f !== airDraw); _as(on); if (on) { DYN = DYN.filter((f) => f !== airDraw); DYN.push(airDraw); } }; }
{ const _d = draw2d; draw2d = function () { _d(); if (!P || view === '3d' || OFF || !AIR.on) return; cx.save(); cx.lineWidth = 1; for (const p of AIR.parts) { const pts = [...(p.tr || []), [p.x, p.y]]; for (let k = 1; k < pts.length; k++) { const a = toS(pts[k - 1][0], pts[k - 1][1]), c = toS(pts[k][0], pts[k][1]); cx.strokeStyle = `rgba(47,143,214,${(0.1 + 0.8 * k / pts.length).toFixed(2)})`; cx.beginPath(); cx.moveTo(...a); cx.lineTo(...c); cx.stroke(); } } cx.restore(); }; }
document.addEventListener('click', (e) => { const h = e.target.closest('#simPanel .sph b'); if (h) { $('#simPanel').classList.toggle('min'); } });
window.APP_VERSION = 'v14 · 2026-11-06';
