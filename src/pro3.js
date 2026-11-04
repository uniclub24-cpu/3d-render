/* ================================================================
   v7 · 데이터 — A/B안, 견적표, DXF·3D 모델 불러오기, 자동 배치, 댓글·공유
   ================================================================ */
/* ---------- 8. A안 · B안 ---------- */
const VKEYS = ['walls', 'openings', 'items', 'lines', 'sketches', 'ceilingH', 'soffitH', 'slabH', 'floor', 'ceiling', 'floorOpacity'];
const vpick = () => JSON.parse(JSON.stringify(Object.fromEntries(VKEYS.map((k) => [k, P[k]]))));
function varEnsure() { if (!P.variants || !P.variants.length) { P.variants = [{ id: 'va', name: 'A안', lv: P.levelId, data: null }]; P.varId = 'va'; } if (!P.variants.find((v) => v.id === P.varId)) P.varId = P.variants[0].id; }
const varCur = () => (varEnsure(), P.variants.find((v) => v.id === P.varId));
function varSaveCur() { const v = varCur(); v.data = vpick(); v.lv = P.levelId; }
function withVar(v, fn) {
  if (!v || v.id === P.varId || !v.data) return fn();
  const keep = vpick(), ks = sel, km = multi; sel = null; multi = []; Object.assign(P, JSON.parse(JSON.stringify(v.data))); dirty3d = true; analyze();
  try { return fn(); } finally { Object.assign(P, keep); sel = ks; multi = km; dirty3d = true; analyze(); }
}
function varSwitch(id) {
  varEnsure(); if (id === P.varId) return; varSaveCur(); const v = P.variants.find((x) => x.id === id); if (!v) return;
  if (v.lv && v.lv !== P.levelId && P.levels.find((l) => l.id === v.lv)) switchLevel(v.lv);
  if (v.data) Object.assign(P, JSON.parse(JSON.stringify(v.data))); P.varId = id; sel = null; multi = []; commit(); toast(`${v.name}으로 바꿨어요`);
}
function varAdd(name, data) {
  varEnsure(); varSaveCur(); const used = new Set(P.variants.map((v) => v.name));
  const nm = name || [...'ABCDEFGHIJ'].map((c) => c + '안').find((n) => !used.has(n)) || `안 ${P.variants.length + 1}`;
  const v = { id: uid('v'), name: nm, lv: P.levelId, data: data ? JSON.parse(JSON.stringify(data)) : vpick() }; P.variants.push(v);
  if (!data) { P.varId = v.id; commit(); toast(`${nm}을 만들었어요 · 지금 화면이 ${nm}이에요`); } else commit();
  return v;
}
function renderVariants() {
  if (!P) return; varEnsure(); const v = varCur(), b = $('#varBtn'); if (!b) return;
  b.innerHTML = `${esc(v.name)} <span class="tri">▾</span>${P.variants.length > 1 ? `<span class="lbadge">${P.variants.length}</span>` : ''}`;
  const m = $('#varMenu'); if (m && !m.hidden) varMenu();
  const sv = $('#showVar'); if (sv) sv.innerHTML = P.variants.length > 1 ? P.variants.map((x) => `<button class="chip ${x.id === P.varId ? 'on' : ''}" data-vsw="${x.id}">${esc(x.name)}</button>`).join('') : '';
}
function varMenu() {
  const m = $('#varMenu'); varEnsure();
  m.innerHTML = `<div class="lbl">배치안 · 같은 매장의 여러 안을 저장하고 비교해요</div>${P.variants.map((x) => `<div class="lvrow ${x.id === P.varId ? 'on' : ''}"><button class="lvgo" data-vsw="${x.id}">${esc(x.name)}</button><small>${(x.id === P.varId ? P.items : (x.data || {}).items || []).length}개</small><button class="qb" data-vren="${x.id}" aria-label="${esc(x.name)} 이름 바꾸기">이름</button>${P.variants.length > 1 ? `<button class="qb danger" data-vdel="${x.id}" aria-label="${esc(x.name)} 지우기">삭제</button>` : ''}</div>`).join('')}
    <div class="row"><button class="btn" data-vadd>+ 지금 안 복사해서 새 안</button><button class="btn pri" data-vcmp ${P.variants.length < 2 ? 'disabled' : ''}>비교하기</button></div><div id="vRen" hidden class="row"><input class="search" id="vRenIn" aria-label="안 이름"><button class="btn pri" id="vRenOk">바꾸기</button></div>`;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-vsw],[data-vren],[data-vdel],[data-vadd],[data-vcmp]'); if (!t) return;
  if (t.dataset.vsw) varSwitch(t.dataset.vsw);
  if (t.dataset.vadd !== undefined) varAdd();
  if (t.dataset.vcmp !== undefined) { $('#varMenu').hidden = true; varCompare(); }
  if (t.dataset.vdel) { const i = P.variants.findIndex((x) => x.id === t.dataset.vdel); if (i < 0) return; const ok = t.dataset.sure; if (!ok) { t.dataset.sure = 1; t.textContent = '정말?'; return; } if (P.variants[i].id === P.varId) { const o = P.variants[i ? 0 : 1]; varSwitch(o.id); } P.variants.splice(P.variants.findIndex((x) => x.id === t.dataset.vdel), 1); commit(); }
  if (t.dataset.vren) { const v = P.variants.find((x) => x.id === t.dataset.vren); $('#vRen').hidden = false; const i = $('#vRenIn'); i.value = v.name; i.focus(); i.select(); $('#vRenOk').onclick = () => { v.name = i.value.trim() || v.name; commit(); }; i.onkeydown = (ev) => { if (ev.key === 'Enter') $('#vRenOk').click(); }; }
  if (!t.dataset.vren && !t.dataset.vdel && $('#varMenu') && t.closest('#varMenu') && (t.dataset.vsw || t.dataset.vadd !== undefined)) varMenu();
});
let cmpMode = 'side', cmpView = '3d';
function varStats(v) {
  return withVar(v, () => { analyze(); const kw = P.items.reduce((s, it) => s + (+(it.kw ?? libGet(it.type).kw) || 0), 0); const bad = checks.filter((c) => c.lvl === 'bad' || c.level === 'bad').length; const b = bomRows(); const sum = b.reduce((s, r) => s + (r.q * (bomPrice(r.key) || 0)), 0); return { n: P.items.filter((i) => !i.hidden).length, kw, conf: conflicts.size, chk: checks.length, bad, sum }; });
}
function varShot(v, W, H) { return withVar(v, () => (cmpView === '3d' ? snapshot3d(W, H, { ...cam }) || planCanvas(W, H) : planCanvas(W, H))); }
function varCompare() {
  varEnsure(); if (P.variants.length < 2) { varAdd(); }
  varSaveCur(); const d = $('#cmpDlg'), opts = P.variants.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
  $('#cmpA').innerHTML = opts; $('#cmpB').innerHTML = opts; $('#cmpA').value = P.variants[0].id; $('#cmpB').value = P.variants[1].id; d.showModal(); drawCmp();
}
function drawCmp() {
  varSaveCur(); const A = P.variants.find((v) => v.id === $('#cmpA').value), B = P.variants.find((v) => v.id === $('#cmpB').value); if (!A || !B) return;
  const box = $('#cmpBox'), W = 1280, H = 800; box.dataset.mode = cmpMode;
  $$('[data-cmpm]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cmpm === cmpMode)); $$('[data-cmpv]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cmpv === cmpView));
  const ca = varShot(A, W, H), cb = varShot(B, W, H); need3d = true;
  box.innerHTML = `<figure class="cmpf a"><img alt="${esc(A.name)}" src="${ca.toDataURL('image/jpeg', .85)}"><figcaption>${esc(A.name)}</figcaption></figure><figure class="cmpf b"><img alt="${esc(B.name)}" src="${cb.toDataURL('image/jpeg', .85)}"><figcaption>${esc(B.name)}</figcaption></figure>${cmpMode === 'swipe' ? '<input type="range" class="cmpr" id="cmpR" min="0" max="100" value="50" aria-label="겹쳐 보기 위치">' : ''}`;
  if (cmpMode === 'swipe') { const r = $('#cmpR'), f = () => box.style.setProperty('--cut', r.value + '%'); r.oninput = f; f(); }
  const sa = varStats(A), sb = varStats(B), won = (x) => x ? x.toLocaleString() + '원' : '단가 없음';
  const row = (n, a, b, better) => `<tr><th>${n}</th><td class="${better === 'a' ? 'win' : ''}">${a}</td><td class="${better === 'b' ? 'win' : ''}">${b}</td></tr>`, lower = (x, y) => (x < y ? 'a' : y < x ? 'b' : '');
  $('#cmpStats').innerHTML = `<table class="ctbl"><thead><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>
    ${row('기물 수', sa.n + '개', sb.n + '개')}${row('전력 합계', sa.kw.toFixed(1) + ' kW', sb.kw.toFixed(1) + ' kW', lower(sa.kw, sb.kw))}
    ${row('겹침 · 조정 필요', sa.conf + '건', sb.conf + '건', lower(sa.conf, sb.conf))}${row('점검 항목', sa.chk + '건', sb.chk + '건', lower(sa.chk, sb.chk))}${row('견적 합계', won(sa.sum), won(sb.sum), sa.sum && sb.sum ? lower(sa.sum, sb.sum) : '')}</tbody></table>`;
}

/* ---------- 9. 자재 · 물량 · 견적표 ---------- */
let PRICE = store.get('drs_price', {});
const bomPrice = (k) => +PRICE[k] || 0;
function floorPoly() {
  const ws = exteriorWalls(); if (ws.length < 3) return null; const key = (x, y) => Math.round(x / 30) + ',' + Math.round(y / 30), adj = new Map();
  for (const w of ws) { const a = key(w.x1, w.y1), b = key(w.x2, w.y2); if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push([b, [w.x2, w.y2]]); adj.get(b).push([a, [w.x1, w.y1]]); }
  const start = key(ws[0].x1, ws[0].y1), pts = [[ws[0].x1, ws[0].y1]]; let prev = null, cur = start;
  for (let i = 0; i < ws.length + 2; i++) { const nx = (adj.get(cur) || []).find((n) => n[0] !== prev); if (!nx) return null; prev = cur; cur = nx[0]; if (cur === start) return pts; pts.push(nx[1]); }
  return null;
}
const polyArea = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
function bomRows() {
  const rows = [], add = (g, n, sp, q, u, key, note = '') => { if (q > 0) rows.push({ g, n, sp, q: Math.round(q * 100) / 100, u, key, note }); };
  const groups = new Map();
  for (const it of P.items) { if (it.hidden) continue; const s = spec(it), L = s.L; if (L.shape === 'zone') continue; const r10 = (v) => Math.round(v / 10) * 10, k = `${it.type}|${r10(it.w)}x${r10(it.d)}x${r10(s.h)}|${it.tag || ''}`; const g = groups.get(k) || { it, s, q: 0 }; g.q++; groups.set(k, g); }
  for (const g of groups.values()) { const L = g.s.L, kw = +(g.it.kw ?? L.kw) || 0; add(L.cat === '전기' || L.layer === 'elec' ? '전기' : L.cat === '배관' || L.cat === '바닥·배관' ? '설비 · 배관' : L.cat === '천장 설비' || L.cat === '벽 설비' || L.cat === '설비' ? '설비' : '기물 · 가구', g.s.name, L.shape === 'mark' ? '' : `${Math.round(g.it.w / 10) * 10}×${Math.round(g.it.d / 10) * 10}×${Math.round(g.s.h / 10) * 10}`, g.q, L.shape === 'mark' ? '개소' : '대', 'it:' + g.it.type + ':' + Math.round(g.it.w / 10) * 10 + 'x' + Math.round(g.it.d / 10) * 10, kw ? `${kw}kW` : ''); }
  const ops = new Map(); for (const o of P.openings) { const k = `${o.type}|${o.w}x${o.h}`; ops.set(k, (ops.get(k) || 0) + 1); }
  for (const [k, q] of ops) { const [t, sz] = k.split('|'); add('문 · 창', OPN(t) + ' (' + t + ')', sz.replace('x', '×'), q, '개', 'op:' + t + ':' + sz); }
  const ext = new Set(exteriorWalls().map((w) => w.id)), fin = {}; let partL = 0, perim = 0;
  for (const w of P.walls) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), H = wallH(w), hole = P.openings.filter((o) => o.wall === w.id).reduce((s, o) => s + o.w * o.h, 0), faces = ext.has(w.id) ? 1 : 2, a = Math.max(0, (L * H * faces - hole * faces)) / 1e6;
    const t = (w.finish && w.finish.type) || 'paint'; fin[t] = (fin[t] || 0) + a; if (!ext.has(w.id)) partL += L; perim += L * faces;
  }
  const FN = { paint: '벽 도장 (페인트)', tile: '벽 타일', wood: '벽 목재 마감', brick: '벽돌 마감', concrete: '노출 콘크리트', wallpaper: '벽지', steel: '스테인리스 판' };
  for (const [t, a] of Object.entries(fin)) {
    add('벽 마감', FN[t] || '벽 마감 · ' + t, '', a, '㎡', 'wall:' + t);
    if (t === 'paint') add('벽 마감', '└ 페인트 양 (2회 · 9㎡/L)', '', a * 2 / 9, 'L', 'paintL');
    if (t === 'tile') { const ts = std().tileWall || 300; add('벽 마감', `└ 타일 장수 (${ts}각 · 로스 8%)`, `${ts}×${ts}`, Math.ceil(a * 1e6 / ts / ts * 1.08), '장', 'tileWn'); }
  }
  if (partL) add('벽체', '칸막이 벽 (경량)', '', partL / 1000, 'm', 'part');
  const fp = floorPoly(), b = bounds(), area = (fp ? polyArea(fp) : (b[2] - b[0]) * (b[3] - b[1])) / 1e6, ft = (P.floor && P.floor.type) || 'tile';
  add('바닥', `바닥 마감 (${(MATS[normMat(ft)] || {}).n || ft})${fp ? '' : ' · 외곽 사각형 기준'}`, '', area, '㎡', 'floor:' + ft);
  if (ft === 'tile') { const ts = std().tileFloor || 600; add('바닥', `└ 바닥 타일 (${ts}각 · 로스 6%)`, `${ts}×${ts}`, Math.ceil(area * 1e6 / ts / ts * 1.06), '장', 'tileFn'); }
  for (const it of P.items) { const s = spec(it); if (s.L.shape === 'zone' && !it.hidden) add('바닥', `${s.name} (${(MATS[s.mat] || {}).n || s.mat})`, `${it.w}×${it.d}`, it.w * it.d / 1e6, '㎡', 'zone:' + it.type + ':' + s.mat); }
  add('바닥', '걸레받이', '', perim / 1000, 'm', 'base');
  if (P.ceiling && P.ceiling.on) { add('천장', '천장 마감 (텍스 · 석고)', '', area, '㎡', 'ceil'); add('천장', '└ 경량 천장틀', '', area, '㎡', 'ceilframe'); }
  const lk = {}; for (const l of P.lines) { let L = 0; for (let i = 1; i < l.pts.length; i++) L += Math.hypot(l.pts[i][0] - l.pts[i - 1][0], l.pts[i][1] - l.pts[i - 1][1]); const k = l.kind + (l.mat ? ':' + l.mat : '') + (l.dia ? ':' + l.dia : ''); lk[k] = (lk[k] || 0) + L; }
  for (const [k, L] of Object.entries(lk)) { const [kind, mat, dia] = k.split(':'), K = LINEKINDS[kind] || {}; add(K.layer === 'elec' ? '전기' : '설비 · 배관', (K.name || kind) + (mat && PIPEMAT[mat] ? ' · ' + (PIPEMAT[mat].n || mat) : ''), dia ? `Ø${dia}` : '', L / 1000 * 1.1, 'm', 'ln:' + k, '여유 10%'); }
  return rows;
}
let bomVat = store.get('drs_vat', true), bomEtc = store.get('drs_etc', 0);
function openBom() { renderBom(); $('#bomDlg').showModal(); }
function bomTotals(rows) { const sub = rows.reduce((s, r) => s + r.q * bomPrice(r.key), 0), etc = Math.round(sub * bomEtc / 100), vat = bomVat ? Math.round((sub + etc) * .1) : 0; return { sub, etc, vat, all: sub + etc + vat }; }
function renderBom() {
  const rows = bomRows(), kw = P.items.reduce((s, it) => s + (it.hidden ? 0 : +(it.kw ?? libGet(it.type).kw) || 0), 0); let g = '';
  $('#bomBody').innerHTML = rows.map((r, i) => { const h = r.g !== g ? `<tr class="bg"><th colspan="7">${esc(r.g)}</th></tr>` : ''; g = r.g; return h + `<tr><td>${esc(r.n)}${r.note ? ` <small class="muted">${esc(r.note)}</small>` : ''}</td><td class="num">${esc(r.sp)}</td><td class="num">${r.q.toLocaleString()}</td><td>${r.u}</td><td><input class="bp" type="number" inputmode="numeric" min="0" step="100" data-pk="${esc(r.key)}" value="${bomPrice(r.key) || ''}" placeholder="단가" aria-label="${esc(r.n)} 단가"></td><td class="num amt" data-amt="${i}">${bomPrice(r.key) ? Math.round(r.q * bomPrice(r.key)).toLocaleString() : '—'}</td></tr>`; }).join('');
  const t = bomTotals(rows);
  $('#bomFoot').innerHTML = `<tr><th colspan="5">소계</th><td class="num">${t.sub.toLocaleString()}</td></tr><tr><th colspan="5"><label class="chk">공과잡비 <input type="number" id="bomEtc" min="0" max="30" value="${bomEtc}" style="width:56px"> %</label></th><td class="num">${t.etc.toLocaleString()}</td></tr><tr><th colspan="5"><label class="chk"><input type="checkbox" id="bomVat" ${bomVat ? 'checked' : ''}> 부가세 10%</label></th><td class="num">${t.vat.toLocaleString()}</td></tr><tr class="tot"><th colspan="5">합계</th><td class="num">${t.all.toLocaleString()}원</td></tr>`;
  $('#bomInfo').textContent = `${P.name} · ${varCur().name} · 전력 합계 ${kw.toFixed(1)} kW · 단가는 이 기기에 저장돼 다음 견적에도 그대로 써요`;
  $('#bomEtc').onchange = (e) => { bomEtc = clamp(+e.target.value || 0, 0, 30); store.set('drs_etc', bomEtc); renderBom(); };
  $('#bomVat').onchange = (e) => { bomVat = e.target.checked; store.set('drs_vat', bomVat); renderBom(); };
}
$('#bomBody') && $('#bomBody').addEventListener('change', (e) => { const k = e.target.dataset.pk; if (!k) return; const v = Math.max(0, +e.target.value || 0); if (v) PRICE[k] = v; else delete PRICE[k]; store.set('drs_price', PRICE); renderBom(); });
function zipFiles(files) {
  const parts = [], cds = []; let off = 0;
  for (const f of files) {
    const nm = new TextEncoder().encode(f.name), data = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data, crc = crc32(data), sz = data.length;
    const lh = new DataView(new ArrayBuffer(30)); [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, nm.length, 2], [28, 0, 2]].forEach(([o, v, l]) => (l === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
    const ch = new DataView(new ArrayBuffer(46)); [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, l]) => (l === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
    parts.push(lh, nm, data); cds.push(ch, nm); off += 30 + nm.length + sz;
  }
  const cdLen = cds.reduce((s, x) => s + (x.byteLength || x.length), 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cdLen, 4], [16, off, 4], [20, 0, 2]].forEach(([o, v, l]) => (l === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true)));
  return new Blob([...parts, ...cds, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function bomXlsx() {
  const rows = bomRows(), x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = (r, c, v, st = 0) => `<c r="${c}${r}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t>${x(v)}</t></is></c>`, N = (r, c, v, st = 2) => `<c r="${c}${r}" s="${st}"><v>${v}</v></c>`, F = (r, c, f, v, st = 2) => `<c r="${c}${r}" s="${st}"><f>${f}</f><v>${v}</v></c>`;
  const out = [`<row r="1">${S(1, 'A', `${P.name} · ${varCur().name} 견적서`, 1)}</row>`, `<row r="2">${S(2, 'A', new Date().toLocaleDateString('ko-KR') + ' · 3D RENDER')}</row>`, `<row r="4">${['구분', '항목', '규격', '수량', '단위', '단가', '금액', '비고'].map((h, i) => S(4, 'ABCDEFGH'[i], h, 1)).join('')}</row>`];
  let r = 5; for (const o of rows) { const p = bomPrice(o.key); out.push(`<row r="${r}">${S(r, 'A', o.g)}${S(r, 'B', o.n)}${S(r, 'C', o.sp)}${N(r, 'D', o.q, 3)}${S(r, 'E', o.u)}${N(r, 'F', p)}${F(r, 'G', `D${r}*F${r}`, Math.round(o.q * p))}${S(r, 'H', o.note)}</row>`); r++; }
  const t = bomTotals(rows), last = r - 1;
  out.push(`<row r="${r + 1}">${S(r + 1, 'F', '소계', 1)}${F(r + 1, 'G', `SUM(G5:G${last})`, t.sub)}</row>`);
  out.push(`<row r="${r + 2}">${S(r + 2, 'F', `공과잡비 ${bomEtc}%`, 1)}${F(r + 2, 'G', `ROUND(G${r + 1}*${bomEtc / 100},0)`, t.etc)}</row>`);
  out.push(`<row r="${r + 3}">${S(r + 3, 'F', '부가세', 1)}${F(r + 3, 'G', bomVat ? `ROUND((G${r + 1}+G${r + 2})*0.1,0)` : '0', t.vat)}</row>`);
  out.push(`<row r="${r + 4}">${S(r + 4, 'F', '합계', 1)}${F(r + 4, 'G', `G${r + 1}+G${r + 2}+G${r + 3}`, t.all, 4)}</row>`);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="34" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="5" width="8" customWidth="1"/><col min="6" max="7" width="14" customWidth="1"/><col min="8" max="8" width="14" customWidth="1"/></cols><sheetData>${out.join('')}</sheetData></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="1" fillId="0" borderId="0" applyNumberFormat="1" applyFont="1"/></cellXfs></styleSheet>`;
  return zipFiles([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="견적" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', data: sheet }, { name: 'xl/styles.xml', data: styles },
  ]);
}

/* ---------- 10. DXF 도면 불러오기 ---------- */
let DXF = null;
function parseDxf(text) {
  const L = text.split(/\r?\n/), pr = []; for (let i = 0; i + 1 < L.length; i += 2) pr.push([+L[i].trim(), L[i + 1].trim()]);
  let units = 0, sec = '', ents = [], cur = null, poly = null;
  for (let i = 0; i < pr.length; i++) {
    const [c, v] = pr[i];
    if (c === 9 && v === '$INSUNITS') { const n = pr[i + 1]; if (n && n[0] === 70) units = +n[1]; }
    if (c === 0 && v === 'SECTION') { const n = pr[i + 1]; sec = n ? n[1] : ''; continue; }
    if (c === 0 && v === 'ENDSEC') { sec = ''; continue; }
    if (sec !== 'ENTITIES') continue;
    if (c === 0) {
      if (cur && cur.t !== 'VERTEX' && cur.t !== 'SEQEND') ents.push(cur);
      if (v === 'VERTEX' && poly) { cur = { t: 'VERTEX' }; poly.pts.push(cur.p = [0, 0]); continue; }
      if (v === 'SEQEND') { poly = null; cur = { t: 'SEQEND' }; continue; }
      cur = { t: v, layer: '0', pts: [], x: [], y: [] }; if (v === 'POLYLINE') poly = cur; continue;
    }
    if (!cur) continue;
    if (cur.t === 'VERTEX') { if (c === 10) cur.p[0] = +v; if (c === 20) cur.p[1] = +v; continue; }
    if (c === 8) cur.layer = v;
    if (cur.t === 'LWPOLYLINE') { if (c === 10) cur.pts.push([+v, 0]); if (c === 20 && cur.pts.length) cur.pts[cur.pts.length - 1][1] = +v; if (c === 70) cur.closed = (+v & 1) === 1; continue; }
    if (cur.t === 'POLYLINE' && c === 70) cur.closed = (+v & 1) === 1;
    if (c === 10) cur.x10 = +v; if (c === 20) cur.y20 = +v; if (c === 11) cur.x11 = +v; if (c === 21) cur.y21 = +v; if (c === 40) cur.r = +v; if (c === 50) cur.a0 = +v; if (c === 51) cur.a1 = +v;
  }
  if (cur && cur.t !== 'VERTEX' && cur.t !== 'SEQEND') ents.push(cur);
  const segs = [];
  for (const e of ents) {
    const push = (a, b) => segs.push({ a, b, layer: e.layer });
    if (e.t === 'LINE') push([e.x10, e.y20], [e.x11, e.y21]);
    else if (e.t === 'LWPOLYLINE' || e.t === 'POLYLINE') { const p = e.pts; for (let i = 1; i < p.length; i++) push(p[i - 1], p[i]); if (e.closed && p.length > 2) push(p[p.length - 1], p[0]); }
    else if (e.t === 'ARC' || e.t === 'CIRCLE') { const a0 = (e.t === 'ARC' ? e.a0 : 0) * Math.PI / 180; let a1 = (e.t === 'ARC' ? e.a1 : 360) * Math.PI / 180; if (a1 <= a0) a1 += Math.PI * 2; const n = Math.max(6, Math.round((a1 - a0) / (Math.PI / 12))); let pv = null; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, q = [e.x10 + e.r * Math.cos(a), e.y20 + e.r * Math.sin(a)]; if (pv) push(pv, q); pv = q; } }
  }
  return { units, segs: segs.filter((s) => isFinite(s.a[0] + s.a[1] + s.b[0] + s.b[1])), layers: [...new Set(segs.map((s) => s.layer))] };
}
const UNIT_MM = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 };
function dxfScale() { const u = $('#dxfUnit').value; if (u !== 'auto') return +u; if (UNIT_MM[DXF.units]) return UNIT_MM[DXF.units]; const xs = DXF.segs.flatMap((s) => [s.a[0], s.b[0]]), ys = DXF.segs.flatMap((s) => [s.a[1], s.b[1]]), span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); return span < 200 ? 1000 : span < 5000 ? 10 : 1; }
function dxfWalls() {
  const sc = dxfScale(), on = new Set($$('[data-dxl]:checked').map((c) => c.dataset.dxl)), merge = $('#dxfMerge').checked, rest = $('#dxfRest').checked;
  let S = DXF.segs.filter((s) => on.has(s.layer)).map((s) => [s.a[0] * sc, -s.a[1] * sc, s.b[0] * sc, -s.b[1] * sc]).filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) > 80).slice(0, 4000);
  if (!S.length) return { walls: [], S };
  const mx = Math.min(...S.flatMap((s) => [s[0], s[2]])), my = Math.min(...S.flatMap((s) => [s[1], s[3]])); S = S.map((s) => [s[0] - mx, s[1] - my, s[2] - mx, s[3] - my]);
  const used = new Set(), walls = [], dT = P.wallT || 150;
  if (merge) {
    const info = S.map((s) => { const L = Math.hypot(s[2] - s[0], s[3] - s[1]), u = [(s[2] - s[0]) / L, (s[3] - s[1]) / L]; return { L, u, n: [-u[1], u[0]] }; });
    const pairs = [];
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
      const A = info[i], B = info[j]; if (Math.abs(A.u[0] * B.u[1] - A.u[1] * B.u[0]) > .03) continue;
      const d = (S[j][0] - S[i][0]) * A.n[0] + (S[j][1] - S[i][1]) * A.n[1], d2 = (S[j][2] - S[i][0]) * A.n[0] + (S[j][3] - S[i][1]) * A.n[1]; if (Math.abs(d - d2) > 15) continue;
      const ad = Math.abs(d); if (ad < 60 || ad > 400) continue;
      const pj = (x, y) => (x - S[i][0]) * A.u[0] + (y - S[i][1]) * A.u[1], t0 = Math.max(0, Math.min(pj(S[j][0], S[j][1]), pj(S[j][2], S[j][3]))), t1 = Math.min(A.L, Math.max(pj(S[j][0], S[j][1]), pj(S[j][2], S[j][3])));
      if (t1 - t0 < Math.max(200, .5 * Math.min(A.L, B.L))) continue; pairs.push({ i, j, d, t0, t1, ov: t1 - t0 });
    }
    pairs.sort((a, b) => b.ov - a.ov || Math.abs(a.d) - Math.abs(b.d));
    for (const p of pairs) {
      if (used.has(p.i) || used.has(p.j)) continue; used.add(p.i); used.add(p.j); const A = info[p.i], o = [S[p.i][0] + A.n[0] * p.d / 2, S[p.i][1] + A.n[1] * p.d / 2];
      walls.push({ x1: o[0] + A.u[0] * p.t0, y1: o[1] + A.u[1] * p.t0, x2: o[0] + A.u[0] * p.t1, y2: o[1] + A.u[1] * p.t1, t: Math.round(Math.abs(p.d)) });
    }
  }
  if (rest || !merge) S.forEach((s, i) => { if (!used.has(i)) walls.push({ x1: s[0], y1: s[1], x2: s[2], y2: s[3], t: dT }); });
  // 거의 수평/수직은 반듯하게 → 모서리는 중심선 교점으로 · T자는 상대 벽 중심선까지
  for (const w of walls) { if (Math.abs(w.y2 - w.y1) < 8) w.y2 = w.y1 = (w.y1 + w.y2) / 2; if (Math.abs(w.x2 - w.x1) < 8) w.x2 = w.x1 = (w.x1 + w.x2) / 2; }
  const isect = (a, b) => { const d1 = [a.x2 - a.x1, a.y2 - a.y1], d2 = [b.x2 - b.x1, b.y2 - b.y1], den = d1[0] * d2[1] - d1[1] * d2[0]; if (Math.abs(den) < 1e-6 * Math.hypot(...d1) * Math.hypot(...d2)) return null; const t = ((b.x1 - a.x1) * d2[1] - (b.y1 - a.y1) * d2[0]) / den; return [a.x1 + d1[0] * t, a.y1 + d1[1] * t]; };
  const ends = (w) => [['x1', 'y1'], ['x2', 'y2']];
  for (const a of walls) for (const [ax, ay] of ends(a)) {
    let best = null;
    for (const b of walls) { if (b === a) continue; const p = isect(a, b); if (!p) continue; const dEnd = Math.hypot(p[0] - a[ax], p[1] - a[ay]); if (dEnd > Math.max(a.t, b.t) * 1.2 + 30) continue;
      const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), tb = ((p[0] - b.x1) * (b.x2 - b.x1) + (p[1] - b.y1) * (b.y2 - b.y1)) / (L * L); if (tb < -(a.t / L) - .02 || tb > 1 + a.t / L + .02) continue;
      if (!best || dEnd < best.d) best = { d: dEnd, p }; }
    if (best) { a[ax] = best.p[0]; a[ay] = best.p[1]; }
  }
  for (const w of walls) for (const k of ['x1', 'y1', 'x2', 'y2']) w[k] = Math.round(w[k]);
  return { walls: walls.filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 50), S };
}
function dxfPreview() {
  if (!DXF) return; const c = $('#dxfCv'), g = c.getContext('2d'), W = c.width, H = c.height, { walls, S } = dxfWalls(); g.clearRect(0, 0, W, H);
  const all = S.flatMap((s) => [[s[0], s[1]], [s[2], s[3]]]); if (!all.length) { $('#dxfInfo').textContent = '고른 레이어에 선이 없어요'; return; }
  const bb = aabb(all), s = Math.min((W - 30) / (bb[2] - bb[0] || 1), (H - 30) / (bb[3] - bb[1] || 1)), T = (x, y) => [15 + (x - bb[0]) * s, 15 + (y - bb[1]) * s];
  g.strokeStyle = getCss('--muted'); g.globalAlpha = .45; g.lineWidth = 1; for (const q of S) { g.beginPath(); g.moveTo(...T(q[0], q[1])); g.lineTo(...T(q[2], q[3])); g.stroke(); }
  g.globalAlpha = 1; g.strokeStyle = getCss('--accent'); g.lineCap = 'round'; for (const w of walls) { g.lineWidth = Math.max(2, w.t * s); g.beginPath(); g.moveTo(...T(w.x1, w.y1)); g.lineTo(...T(w.x2, w.y2)); g.stroke(); }
  $('#dxfInfo').textContent = `선 ${S.length}개 → 벽 ${walls.length}개 · 크기 ${Math.round(bb[2] - bb[0]).toLocaleString()} × ${Math.round(bb[3] - bb[1]).toLocaleString()} mm`;
}
function openDxfIn() { DXF = null; $('#dxfLayers').innerHTML = ''; $('#dxfInfo').textContent = 'DXF 파일을 고르세요. DWG는 캐드에서 DXF로 저장한 뒤 올려 주세요.'; $('#dxfOk').disabled = true; $('#dxfCv').getContext('2d').clearRect(0, 0, 9999, 9999); $('#dxfDlg').showModal(); }
async function dxfLoad(f) {
  if (!f) return; if (/\.dwg$/i.test(f.name)) { $('#dxfInfo').textContent = 'DWG는 바로 읽을 수 없어요. 캐드에서 "다른 이름으로 저장 → DXF"로 저장해 올려 주세요.'; return; }
  try { DXF = parseDxf(await f.text()); } catch (e) { $('#dxfInfo').textContent = '읽지 못했어요: ' + e.message; return; }
  if (!DXF.segs.length) { $('#dxfInfo').textContent = '선을 찾지 못했어요 (블록 안의 선은 캐드에서 "분해" 후 저장해 주세요)'; return; }
  const wallish = DXF.layers.filter((l) => /wall|벽|wal|a-wall|구조|struct/i.test(l)), cnt = (l) => DXF.segs.filter((s) => s.layer === l).length;
  $('#dxfLayers').innerHTML = DXF.layers.map((l) => `<label class="chip"><input type="checkbox" data-dxl="${esc(l)}" ${!wallish.length || wallish.includes(l) ? 'checked' : ''}> ${esc(l)} <small>${cnt(l)}</small></label>`).join('');
  $('#dxfOk').disabled = false; dxfPreview();
}
function dxfApply() {
  const { walls } = dxfWalls(); if (!walls.length) { toast('바꿀 벽이 없어요'); return; }
  const replace = $('#dxfReplace').checked, fin = { type: 'paint', color: '#ece8e1' };
  if (replace) { P.walls = []; P.openings = []; }
  const b = !replace && P.walls.length ? bounds() : [0, 0], ox = replace ? 0 : b[2] + 2000, oy = replace ? 0 : b[1];
  for (const w of walls) { const nw = { id: uid('w'), x1: w.x1 + ox, y1: w.y1 + oy, x2: w.x2 + ox, y2: w.y2 + oy, finish: { ...fin } }; if (Math.abs(w.t - P.wallT) > 5) nw.t = w.t; P.walls.push(nw); }
  commit(); fit2d(); draw2d(); cam3dDefault(); dirty3d = true; $('#dxfDlg').close(); toast(`벽 ${walls.length}개를 불러왔어요`);
}

/* ---------- 11. 내 3D 모델 올리기 (GLB · OBJ) ---------- */
let MODEL = null; const MESHC = {};
const b64e = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const b64d = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const rgbHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
function parseObj(text, mtl) {
  const v = [], vc = [], tris = [], cols = [], kd = {}; let cur = '#b8bcc2';
  if (mtl) { let n = null; for (const l of mtl.split(/\r?\n/)) { const p = l.trim().split(/\s+/); if (p[0] === 'newmtl') n = p[1]; if (p[0] === 'Kd' && n) kd[n] = rgbHex([+p[1], +p[2], +p[3]]); } }
  for (const l of text.split(/\r?\n/)) {
    const p = l.trim().split(/\s+/);
    if (p[0] === 'v') { v.push([+p[1], +p[2], +p[3]]); vc.push(p.length >= 7 ? rgbHex([+p[4], +p[5], +p[6]]) : null); }
    else if (p[0] === 'usemtl') cur = kd[p[1]] || cur;
    else if (p[0] === 'f') { const ix = p.slice(1).map((q) => { const i = parseInt(q, 10); return i < 0 ? v.length + i : i - 1; }); for (let k = 1; k + 1 < ix.length; k++) { tris.push([v[ix[0]], v[ix[k]], v[ix[k + 1]]]); cols.push(vc[ix[0]] || cur); } }
  }
  return { tris, cols };
}
function parseGlb(buf) {
  const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('GLB 파일이 아니에요');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) { const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true); if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len))); else if (type === 0x004e4942) bin = buf.slice(off + 8, off + 8 + len); off += 8 + len; }
  if (!json) throw new Error('GLB 안의 정보를 찾지 못했어요');
  if ((json.extensionsUsed || []).some((x) => /draco|meshopt/i.test(x))) throw new Error('압축된 GLB(Draco)는 아직 못 읽어요. 압축 없이 내보내 주세요');
  const acc = (i) => { const a = json.accessors[i], bv = json.bufferViews[a.bufferView], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type], T = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType], st = bv.byteStride || nc * T.BYTES_PER_ELEMENT, base = (bv.byteOffset || 0) + (a.byteOffset || 0), d = new DataView(bin), out = [];
    for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < nc; c++) { const o = base + k * st + c * T.BYTES_PER_ELEMENT; r.push(T === Float32Array ? d.getFloat32(o, true) : T === Uint16Array ? d.getUint16(o, true) : T === Uint32Array ? d.getUint32(o, true) : d.getUint8(o)); } out.push(nc === 1 ? r[0] : r); } return out; };
  const m4 = (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; };
  const trs = (n) => { if (n.matrix) return n.matrix; const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; };
  const tris = [], cols = [], I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const walk = (ni, Mp) => { const n = json.nodes[ni], M = m4(Mp, trs(n));
    if (n.mesh != null) for (const pr of json.meshes[n.mesh].primitives) { if (pr.mode != null && pr.mode !== 4) continue; const pos = acc(pr.attributes.POSITION).map((p) => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]]);
      const mt = pr.material != null ? json.materials[pr.material] : null, bc = mt && mt.pbrMetallicRoughness && mt.pbrMetallicRoughness.baseColorFactor, col = bc ? rgbHex(bc.slice(0, 3).map((c) => Math.pow(c, 1 / 2.2))) : '#b8bcc2';
      const ix = pr.indices != null ? acc(pr.indices) : pos.map((_, i) => i); for (let k = 0; k + 2 < ix.length; k += 3) { tris.push([pos[ix[k]], pos[ix[k + 1]], pos[ix[k + 2]]]); cols.push(col); } }
    for (const c of n.children || []) walk(c, M); };
  const sc = json.scenes ? json.scenes[json.scene || 0] : { nodes: json.nodes.map((_, i) => i) }; for (const n of sc.nodes) walk(n, I);
  return { tris, cols };
}
function modelPack(raw, unit) {
  let { tris, cols } = raw; if (!tris.length) throw new Error('삼각형이 없어요');
  const all = tris.flat(), mn = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))), mx = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k]))), size = mx.map((v, k) => (v - mn[k]) * unit);
  if (tris.length > 12000) { // 꼭짓점 묶기로 줄이기
    let n = 120; const span = Math.max(...mx.map((v, k) => v - mn[k])) || 1;
    for (; n > 8; n = Math.round(n * .8)) { const cell = span / n, q = (p) => p.map((v, k) => Math.round((v - mn[k]) / cell)), seen = new Set(), nt = [], nc = []; tris.forEach((t, i) => { const a = q(t[0]), b = q(t[1]), c = q(t[2]), ka = a + '', kb = b + '', kc = c + ''; if (ka === kb || kb === kc || ka === kc) return; const key = [ka, kb, kc].sort().join('|'); if (seen.has(key)) return; seen.add(key); nt.push([a, b, c].map((p) => p.map((v, k) => mn[k] + v * cell))); nc.push(cols[i]); }); if (nt.length <= 12000) { tris = nt; cols = nc; break; } }
  }
  const pal = [...new Set(cols)].slice(0, 255), pi = new Map(pal.map((c, i) => [c, i])), V = new Uint16Array(tris.length * 9), T = new Uint8Array(tris.length);
  tris.forEach((t, i) => { t.forEach((p, j) => p.forEach((v, k) => (V[i * 9 + j * 3 + k] = Math.round((v - mn[k]) / ((mx[k] - mn[k]) || 1) * 65535)))); T[i] = pi.get(cols[i]) ?? 0; });
  return { mesh: { v: b64e(new Uint8Array(V.buffer)), t: b64e(T), pal, n: tris.length }, w: Math.max(10, Math.round(size[0])), d: Math.max(10, Math.round(size[2])), h: Math.max(10, Math.round(size[1])) };
}
function meshOf(L) {
  if (MESHC[L.id]) return MESHC[L.id]; const m = L.mesh, V = new Uint16Array(b64d(m.v).buffer), T = b64d(m.t), pal = m.pal.map(hexRGB);
  return (MESHC[L.id] = { V, T, pal, n: m.n });
}
function meshTop(pk) { // 위에서 본 모습 (평면 · 썸네일)
  const L = { id: '_tmp' + Math.random(), mesh: pk.mesh }, m = meshOf(L), W = 256, H = Math.max(32, Math.round(256 * pk.d / pk.w)), c = document.createElement('canvas'); c.width = W; c.height = Math.min(512, H); const g = c.getContext('2d');
  const order = [...Array(m.n).keys()].sort((a, b) => (m.V[a * 9 + 1] + m.V[a * 9 + 4] + m.V[a * 9 + 7]) - (m.V[b * 9 + 1] + m.V[b * 9 + 4] + m.V[b * 9 + 7]));
  for (const i of order) { const p = (j) => [m.V[i * 9 + j * 3] / 65535 * c.width, m.V[i * 9 + j * 3 + 2] / 65535 * c.height], col = m.pal[m.T[i]] || [.7, .7, .7], sh = .65 + .35 * ((m.V[i * 9 + 1] + m.V[i * 9 + 4] + m.V[i * 9 + 7]) / 3 / 65535);
    g.fillStyle = `rgb(${col.map((v) => Math.round(v * sh * 255)).join(',')})`; g.beginPath(); g.moveTo(...p(0)); g.lineTo(...p(1)); g.lineTo(...p(2)); g.closePath(); g.fill(); g.strokeStyle = g.fillStyle; g.stroke(); }
  delete MESHC[L.id]; return c.toDataURL('image/png');
}
const _bi = buildItem;
buildItem = function (it) {
  const s = spec(it); if (s.L.shape !== 'mesh' || !s.L.mesh) return _bi(it);
  const m = meshOf(s.L), e = zOf(it), T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), g = grp('plain', MATS[s.mat].a), tint = it.color && it.color !== s.L.color ? hexRGB(it.color) : null;
  for (let i = 0; i < m.n; i++) {
    const q = [0, 1, 2].map((j) => [(m.V[i * 9 + j * 3] / 65535 - .5) * it.w, e + m.V[i * 9 + j * 3 + 1] / 65535 * s.h, (m.V[i * 9 + j * 3 + 2] / 65535 - .5) * it.d]);
    const a = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], b = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]]; let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l); if (n[1] < -0.2) n = n.map((v) => -v);
    const c = tintC(tint || m.pal[m.T[i]] || [.72, .74, .76]), N = T.N(...n);
    for (const p of q) { g.p.push(...T.P(...p)); g.n.push(...N); g.c.push(...c); g.u.push(0, 0); }
  }
};
function openModelIn() { MODEL = null; $('#mdInfo').textContent = 'GLB(권장) 또는 OBJ 파일을 고르세요. OBJ는 색 정보(.mtl)를 같이 골라도 돼요.'; $('#mdOk').disabled = true; $('#mdPrev').removeAttribute('src'); $('#mdDlg').showModal(); }
async function modelLoad(files) {
  const fs = [...files], main = fs.find((f) => /\.(glb|obj)$/i.test(f.name)); if (!main) { $('#mdInfo').textContent = 'GLB나 OBJ 파일을 골라 주세요 (.gltf는 GLB로 저장해 주세요)'; return; }
  try {
    const raw = /\.glb$/i.test(main.name) ? parseGlb(await main.arrayBuffer()) : parseObj(await main.text(), fs.find((f) => /\.mtl$/i.test(f.name)) ? await fs.find((f) => /\.mtl$/i.test(f.name)).text() : '');
    const all = raw.tris.flat(), span = Math.max(...[0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])) - Math.min(...all.map((p) => p[k]))));
    MODEL = { raw, name: main.name.replace(/\.(glb|obj)$/i, ''), glb: /\.glb$/i.test(main.name), span };
    $('#mdUnit').value = MODEL.glb ? '1000' : span < 30 ? '1000' : span < 400 ? '10' : '1'; $('#mdName').value = MODEL.name; modelPrev();
  } catch (e) { console.error(e); $('#mdInfo').textContent = '읽지 못했어요: ' + e.message; }
}
function modelPrev() { if (!MODEL) return; try { MODEL.pk = modelPack(MODEL.raw, +$('#mdUnit').value); MODEL.img = meshTop(MODEL.pk); $('#mdPrev').src = MODEL.img; $('#mdInfo').textContent = `삼각형 ${MODEL.pk.mesh.n.toLocaleString()}개${MODEL.raw.tris.length > MODEL.pk.mesh.n ? ` (원본 ${MODEL.raw.tris.length.toLocaleString()}개에서 줄임)` : ''} · 가로 ${MODEL.pk.w.toLocaleString()} × 깊이 ${MODEL.pk.d.toLocaleString()} × 높이 ${MODEL.pk.h.toLocaleString()} mm`; $('#mdOk').disabled = false; } catch (e) { $('#mdInfo').textContent = e.message; } }
function modelSave() {
  if (!MODEL || !MODEL.pk) return; const pk = MODEL.pk, cols = MODEL.pk.mesh.pal, layer = $('#mdLayer').value;
  const m = { id: uid('my'), name: $('#mdName').value.trim() || MODEL.name, tag: '', shape: 'mesh', mesh: pk.mesh, w: pk.w, d: pk.d, h: pk.h, elev: 0, layer, color: cols[0] || '#b8bcc2', mat: 'matte', img: MODEL.img };
  myLib.push(m); try { store.set('drs_mylib', myLib); store.set('drs_mylib_t', Date.now()); } catch (e) { myLib.pop(); toast('저장 공간이 부족해요 · 더 단순한 모델을 올려 주세요'); return; }
  libCat = '내 기물'; renderLib(); const [x, y] = viewCenter(); placeItem(m.id, x, y); $('#mdDlg').close();
}

/* ---------- 14. 주방 자동 배치 제안 ---------- */
const MENUS = {
  chicken: { n: '치킨 · 튀김', list: { fridge45: 1, freezer45: 1, tfridge: 1, work2: 1, fryer4: 1, fryer2: 1, holding: 1, sink2: 1, handsink: 1 } },
  korean: { n: '한식 · 국물', list: { fridge45: 1, tfridge: 2, range3: 1, soupkettle: 1, ricewarmer: 1, work2: 1, sink3: 1, dishwasher: 1, handsink: 1 } },
  cafe: { n: '카페 · 디저트', list: { tfridge: 2, fridge25: 1, icemaker: 1, oven: 1, work: 1, showcase: 1, sink1: 1, handsink: 1 } },
  snack: { n: '분식', list: { fridge45: 1, tfridge: 1, griddle: 1, fryer2: 1, range: 1, work2: 1, sink2: 1, handsink: 1 } },
};
const ROLE = (id) => { const L = libGet(id); return L.drain ? 'wash' : /fridge|freezer|showcase/.test(L.shape + id) && L.h > 1200 ? 'cold' : L.hood ? 'hot' : id === 'holding' || id === 'ricewarmer' ? 'hold' : 'prep'; };
let autoList = {}, autoRes = [];
function autoArea() {
  if (sel && sel.kind === 'item') { const it = itemOf(sel.id); if (it && libGet(it.type).shape === 'zone') return { b: aabb(corners(it)), src: '선택한 바닥 구역' }; }
  const k = kitchenBounds(); if (k) return { b: fitArea([k[0] - 100, k[1] - 100, k[2] + 100, k[3] + 100]), src: '지금 주방 기물이 있는 곳 (벽 안쪽 면에 맞춤)' };
  const b = bounds(), T = P.wallT / 2; return { b: [b[0] + T, b[1] + T, b[2] - T, b[3] - T], src: '매장 전체' };
}
function fitArea(b) { // 영역 가장자리를 가까운 벽 안쪽 면에 맞추기
  const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], o = [...b];
  for (const w of P.walls) { const T = wallT(w) / 2;
    if (w.y1 === w.y2) { const x0 = Math.min(w.x1, w.x2), x1 = Math.max(w.x1, w.x2); if (x1 < b[0] + 200 || x0 > b[2] - 200) continue; if (w.y1 < c[1] && Math.abs(w.y1 - b[1]) < 600) o[1] = Math.max(o[1] === b[1] ? -1e9 : o[1], w.y1 + T); if (w.y1 > c[1] && Math.abs(w.y1 - b[3]) < 600) o[3] = Math.min(o[3] === b[3] ? 1e9 : o[3], w.y1 - T); }
    if (w.x1 === w.x2) { const y0 = Math.min(w.y1, w.y2), y1 = Math.max(w.y1, w.y2); if (y1 < b[1] + 200 || y0 > b[3] - 200) continue; if (w.x1 < c[0] && Math.abs(w.x1 - b[0]) < 600) o[0] = Math.max(o[0] === b[0] ? -1e9 : o[0], w.x1 + T); if (w.x1 > c[0] && Math.abs(w.x1 - b[2]) < 600) o[2] = Math.min(o[2] === b[2] ? 1e9 : o[2], w.x1 - T); } }
  return o.map(Math.round);
}
function openAuto() {
  const a = autoArea(); $('#auX').value = Math.round(a.b[0]); $('#auY').value = Math.round(a.b[1]); $('#auW').value = Math.round(a.b[2] - a.b[0]); $('#auD').value = Math.round(a.b[3] - a.b[1]); $('#auSrc').textContent = a.src;
  $('#auAisle').value = std().aisle || P.aisle || 900; if (!Object.keys(autoList).length) autoList = { ...MENUS.chicken.list }; renderAutoList(); $('#auRes').innerHTML = ''; $('#autoDlg').showModal();
}
function renderAutoList() {
  const ids = [...new Set([...Object.keys(autoList), ...LIB.filter((l) => l.cat === '주방' && l.layer === 'floor').map((l) => l.id)])];
  $('#auList').innerHTML = ids.map((id) => { const L = libGet(id); return `<label class="aurow ${autoList[id] ? 'on' : ''}"><span>${esc(L.name)} <small class="muted">${L.w}×${L.d}</small></span><input type="number" min="0" max="9" value="${autoList[id] || 0}" data-au="${id}" aria-label="${esc(L.name)} 개수"></label>`; }).join('');
}
function doorGaps(side, b) { // 영역 한 변에 붙은 문 구간
  const gaps = []; const along = side === 'top' || side === 'bottom', lineV = side === 'top' ? b[1] : side === 'bottom' ? b[3] : side === 'left' ? b[0] : b[2];
  for (const o of P.openings) { const w = wallOf(o.wall); if (!w || (o.sill || 0) > 300) continue; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), c = [w.x1 + (w.x2 - w.x1) * o.t / L, w.y1 + (w.y2 - w.y1) * o.t / L];
    if (along ? Math.abs(c[1] - lineV) < 500 : Math.abs(c[0] - lineV) < 500) { const t = along ? c[0] : c[1]; gaps.push([t - o.w / 2 - 150, t + o.w / 2 + 150]); } }
  return gaps;
}
function autoPlan(kind, b, list, aisle) {
  const W = b[2] - b[0], D = b[3] - b[1], DEP = 800, ROT = { top: 0, bottom: 180, left: 270, right: 90 };
  const runs = { I: [W >= D ? 'top' : 'left'], L: ['top', 'left'], P: ['top', 'bottom'], U: ['left', 'top', 'right'] }[kind];
  if (kind === 'P' && D < DEP * 2 + aisle) return null; if (kind === 'U' && W < DEP * 2 + aisle) return null; if (kind !== 'I' && Math.min(W, D) < DEP + aisle) return null;
  const R = runs.map((s) => { let a, z; if (s === 'top' || s === 'bottom') { a = b[0] + (runs.includes('left') ? DEP : 0); z = b[2] - (runs.includes('right') ? DEP : 0); } else { a = b[1] + (runs.includes('top') && s !== 'top' ? DEP : 0); z = b[3] - (runs.includes('bottom') && s !== 'bottom' ? DEP : 0); } return { s, a, z, pos: a, items: [], gaps: doorGaps(s, b) }; });
  const seq = []; for (const role of ['cold', 'prep', 'hot', 'hold', 'wash']) for (const [id, q] of Object.entries(list)) if (ROLE(id) === role) for (let i = 0; i < q; i++) seq.push(id);
  const order = kind === 'P' ? [0, 0, 1, 1, 1] : kind === 'U' ? [0, 1, 1, 2, 2] : kind === 'L' ? [0, 0, 0, 0, 1] : [0, 0, 0, 0, 0], roleIx = { cold: 0, prep: 1, hot: 2, hold: 3, wash: 4 };
  const out = [], miss = [];
  for (const id of seq) {
    const L = libGet(id); let placed = false; const pref = order[roleIx[ROLE(id)]];
    for (const ri of [pref, ...R.keys()]) { const r = R[ri]; if (!r) continue; let p = r.pos; for (const g of r.gaps) if (p < g[1] && p + L.w > g[0]) p = g[1];
      if (p + L.w <= r.z) { r.pos = p + L.w; const c = p + L.w / 2, it = { id: uid('i'), type: id, w: L.w, d: L.d, rot: ROT[r.s] };
        if (r.s === 'top') { it.x = c; it.y = b[1] + L.d / 2; } if (r.s === 'bottom') { it.x = c; it.y = b[3] - L.d / 2; } if (r.s === 'left') { it.x = b[0] + L.d / 2; it.y = c; } if (r.s === 'right') { it.x = b[2] - L.d / 2; it.y = c; }
        r.items.push(it); out.push(it); placed = true; break; } }
    if (!placed) miss.push(L.name);
  }
  // 후드: 연속된 화기 위
  for (const r of R) { let grpI = []; const flush = () => { if (!grpI.length) return; const a = Math.min(...grpI.map((it) => (r.s === 'top' || r.s === 'bottom' ? it.x : it.y) - it.w / 2)) - 150, z = Math.max(...grpI.map((it) => (r.s === 'top' || r.s === 'bottom' ? it.x : it.y) + it.w / 2)) + 150, c = (a + z) / 2, H = libGet('hood'), hd = { id: uid('i'), type: 'hood', w: Math.round(z - a), d: H.d, rot: ROT[r.s] };
      if (r.s === 'top') { hd.x = c; hd.y = b[1] + H.d / 2; } if (r.s === 'bottom') { hd.x = c; hd.y = b[3] - H.d / 2; } if (r.s === 'left') { hd.x = b[0] + H.d / 2; hd.y = c; } if (r.s === 'right') { hd.x = b[2] - H.d / 2; hd.y = c; } out.push(hd); grpI = []; };
    for (const it of r.items) { if (libGet(it.type).hood) grpI.push(it); else flush(); } flush(); }
  out.forEach((it) => { it.x = Math.round(it.x); it.y = Math.round(it.y); });
  return { kind, items: out, miss };
}
function planCrop(a, W, H) { // 영역만 잘라 보기 (planCanvas 와 같은 배율 계산)
  const PW = 2400, PH = 1700, full = planCanvas(PW, PH), b = bounds(), bw = b[2] - b[0] || 1, bh = b[3] - b[1] || 1, s = Math.min((PW - 160) / bw, (PH - 200) / bh), ox = (PW - bw * s) / 2 - b[0] * s, oy = (PH - bh * s) / 2 - b[1] * s + 30;
  const pad = 600, x0 = (a[0] - pad) * s + ox, y0 = (a[1] - pad) * s + oy, w = (a[2] - a[0] + pad * 2) * s, h = (a[3] - a[1] + pad * 2) * s, k = Math.min(W / w, H / h);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.drawImage(full, x0, y0, w, h, (W - w * k) / 2, (H - h * k) / 2, w * k, h * k); return c;
}
function autoRun() {
  const b = [+$('#auX').value, +$('#auY').value]; b.push(b[0] + +$('#auW').value, b[1] + +$('#auD').value); const aisle = +$('#auAisle').value || 900;
  const list = Object.fromEntries(Object.entries(autoList).filter(([, q]) => q > 0)); if (!Object.keys(list).length) { toast('넣을 기물을 골라 주세요'); return; }
  const NM = { I: '일자형', L: 'ㄱ자형', P: '11자형 (마주 보기)', U: 'ㄷ자형' }, keepItems = P.items;
  const inArea = (it) => it.x > b[0] - 50 && it.x < b[2] + 50 && it.y > b[1] - 50 && it.y < b[3] + 50 && (libGet(it.type).cat === '주방');
  const base = keepItems.filter((it) => !inArea(it));
  autoRes = ['I', 'L', 'P', 'U'].map((k) => autoPlan(k, b, list, aisle)).filter(Boolean).map((r) => {
    P.items = base.concat(r.items); analyze(); const conf = r.items.filter((it) => conflicts.has(it.id)).length;
    r.score = r.items.length * 2 - r.miss.length * 12 - conf * 5 + (r.kind === 'L' || r.kind === 'P' ? 2 : 0); r.conf = conf; r.base = base; r.name = NM[r.kind];
    r.img = planCrop(b, 720, 480).toDataURL('image/jpeg', .85); return r;
  }).sort((a, z) => z.score - a.score).slice(0, 3);
  P.items = keepItems; analyze(); draw2d();
  $('#auRes').innerHTML = autoRes.length ? autoRes.map((r, i) => `<figure class="aucard"><img src="${r.img}" alt="${esc(r.name)} 배치안"><figcaption><b>${i + 1}안 · ${esc(r.name)}</b><small>${r.items.length}개 배치${r.miss.length ? ` · 못 넣음: ${esc(r.miss.join(', '))}` : ''}${r.conf ? ` · 겹침 ${r.conf}곳` : ' · 겹침 없음'}</small><span class="row"><button class="btn pri" data-aup="${i}">적용</button><button class="btn" data-auv="${i}">새 안으로 저장</button></span></figcaption></figure>`).join('') + `<button class="btn" id="auAll">세 안 모두 저장하고 비교</button>`
    : '<p class="alert">이 크기에는 배치할 수 없어요. 영역을 넓히거나 기물을 줄여 주세요.</p>';
}
document.addEventListener('click', (e) => {
  const ap = e.target.closest('[data-aup]'), av = e.target.closest('[data-auv]');
  if (ap) { const r = autoRes[+ap.dataset.aup]; P.items = r.base.concat(JSON.parse(JSON.stringify(r.items))); commit(); $('#autoDlg').close(); toast(`${r.name} 배치를 적용했어요 · 되돌리기로 취소할 수 있어요`); }
  if (av) { const r = autoRes[+av.dataset.auv]; const d = vpick(); d.items = r.base.concat(r.items); varAdd(`자동 ${r.name}`, d); av.disabled = true; av.textContent = '저장됨'; }
  if (e.target.id === 'auAll') { autoRes.forEach((r) => { const d = vpick(); d.items = r.base.concat(r.items); varAdd(`자동 ${r.name}`, d); }); $('#autoDlg').close(); varCompare(); }
});

/* ---------- 13. 3D 위 댓글 · 링크 공유 ---------- */
let commentOn = false, VIEWER = null;
const cmts = () => (P.comments = P.comments || []);
function commentMode(on) { commentOn = on; document.body.classList.toggle('commenting', on); $$('[data-cmt]').forEach((b) => b.setAttribute('aria-pressed', on)); if (on) { if (view === '2d' && isMobile()) setView('3d'); toast('댓글 달 곳을 누르세요 · Esc로 끝'); } }
function cmtComposer(pt, sx, sy) {
  const p = $('#cmtPop'); p.hidden = false; p.dataset.id = '';
  p.innerHTML = `<b>새 댓글</b><textarea id="cmtTx" rows="3" placeholder="예: 이 냉장고 문이 통로를 막아요"></textarea><input id="cmtBy" class="search" placeholder="이름" value="${esc(store.get('drs_name', ''))}" aria-label="이름"><div class="row"><button class="btn pri" id="cmtOk">남기기</button><button class="btn" id="cmtNo">취소</button></div>`;
  placePop(p, sx, sy); setTimeout(() => $('#cmtTx').focus(), 0);
  $('#cmtNo').onclick = () => (p.hidden = true);
  $('#cmtOk').onclick = async () => { const tx = $('#cmtTx').value.trim(); if (!tx) return; const by = $('#cmtBy').value.trim() || '나'; store.set('drs_name', by); const c = { id: uid('c'), x: Math.round(pt[0]), y: Math.round(pt[1]), z: Math.round(pt[2]), lv: P.levelId, text: tx, by, t: Date.now(), re: [] }; p.hidden = true;
    if (VIEWER) { await shareComment(c); } else { cmts().push(c); commit(); } renderCmts(); need3d = true; };
}
function placePop(p, sx, sy) { const W = innerWidth, H = innerHeight; p.style.left = clamp(sx + 12, 8, W - 300) + 'px'; p.style.top = clamp(sy + 12, 8, H - p.offsetHeight - 8) + 'px'; }
function cmtThread(id, sx, sy) {
  const c = cmts().find((x) => x.id === id); if (!c) return; const p = $('#cmtPop'); p.hidden = false; p.dataset.id = id; const i = cmts().filter((x) => x.lv === c.lv || !x.lv).indexOf(c) + 1;
  const ago = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  p.innerHTML = `<div class="row" style="align-items:center"><b style="flex:1">#${i} 댓글${c.share ? ' · 공유 링크에서' : ''}</b><button class="qb" data-cx2="x" aria-label="닫기">✕</button></div>
    <div class="cth"><p><b>${esc(c.by)}</b> <small class="muted">${ago(c.t)}</small><br>${esc(c.text)}</p>${(c.re || []).map((r) => `<p><b>${esc(r.by)}</b> <small class="muted">${ago(r.t)}</small><br>${esc(r.text)}</p>`).join('')}</div>
    ${VIEWER ? '' : `<textarea id="cmtRe" rows="2" placeholder="답글"></textarea><div class="row"><button class="btn pri" data-cx2="re">답글</button><button class="btn" data-cx2="done">${c.done ? '다시 열기' : '해결'}</button><button class="btn danger" data-cx2="del">삭제</button></div>`}`;
  placePop(p, sx, sy);
}
$('#cmtPop') && $('#cmtPop').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cx2]'); if (!b) return; const p = $('#cmtPop'), c = cmts().find((x) => x.id === p.dataset.id), k = b.dataset.cx2;
  if (k === 'x') { p.hidden = true; return; } if (!c) return;
  if (k === 're') { const t = $('#cmtRe').value.trim(); if (!t) return; (c.re = c.re || []).push({ by: store.get('drs_name', '') || '나', text: t, t: Date.now() }); commit(); cmtThread(c.id, parseFloat(p.style.left) - 12, parseFloat(p.style.top) - 12); }
  if (k === 'done') { c.done = !c.done; commit(); p.hidden = true; }
  if (k === 'del') { P.comments = cmts().filter((x) => x !== c); commit(); p.hidden = true; }
  renderCmts(); need3d = true;
});
function renderCmts() {
  const el = $('#cmtList'); if (!el || !P) return; const L = cmts().filter((c) => !c.lv || c.lv === P.levelId);
  $('#cmtSum').textContent = L.length ? `${L.filter((c) => !c.done).length}개 열림` : '';
  el.innerHTML = L.length ? L.map((c, i) => `<button class="chk-row ${c.done ? 'done' : ''}" data-cgo="${c.id}"><span class="cpin ${c.done ? 'done' : ''}">${i + 1}</span><span><b>${esc(c.by)}</b> ${esc(c.text)}${c.re && c.re.length ? ` <small class="muted">답글 ${c.re.length}</small>` : ''}</span></button>`).join('') : '<p class="hint">3D 위 아무 곳에 댓글을 남겨 현장 · 손님 의견을 모아요.</p>';
}
document.addEventListener('click', (e) => { const g = e.target.closest('[data-cgo]'); if (!g) return; const c = cmts().find((x) => x.id === g.dataset.cgo); if (!c) return; if (view !== '2d') { goal.tx = c.x; goal.tz = c.z; anim = null; } if (view !== '3d') { const r = cv.getBoundingClientRect(); V.ox = r.width / 2 - c.x * V.s; V.oy = r.height / 2 - c.z * V.s; draw2d(); } const rr = g.getBoundingClientRect(); cmtThread(c.id, rr.left - 300, rr.top); });
function cmtPins(M, r) {
  const ov = $('#ov3d'); if (!ov || document.body.classList.contains('show') || !P) return; const L = cmts().filter((c) => !c.lv || c.lv === P.levelId);
  L.forEach((c, i) => { const p = proj(M, [c.x, c.y + curElev(), c.z], r); if (!p) return; const b = document.createElement('button'); b.className = 'cpin pin3' + (c.done ? ' done' : ''); b.style.left = p[0] + 'px'; b.style.top = p[1] + 'px'; b.textContent = i + 1; b.title = c.text; b.dataset.cpin = c.id; b.setAttribute('aria-label', `댓글 ${i + 1}: ${c.text}`); ov.appendChild(b); });
}
$('#ov3d').addEventListener('click', (e) => { const b = e.target.closest('[data-cpin]'); if (b) { const r = b.getBoundingClientRect(); cmtThread(b.dataset.cpin, r.right, r.top); } });
// 3D · 2D 에서 댓글 위치 찍기
gc.addEventListener('pointerdown', (e) => { if (!commentOn) return; e.stopImmediatePropagation(); const h = rayHit(e); if (!h || !h.p) { toast('바닥이나 기물 위를 눌러 주세요'); return; } cmtComposer(h.p, e.clientX, e.clientY); commentMode(false); }, true);
cv.addEventListener('pointerdown', (e) => {
  if (!P) return; const [sx, sy] = evPos(e), [wx, wy] = toW(sx, sy);
  if (commentOn) { e.stopImmediatePropagation(); cmtComposer([wx, 1200, wy], e.clientX, e.clientY); commentMode(false); return; }
  const L = cmts().filter((c) => !c.lv || c.lv === P.levelId), hit = L.find((c) => { const p = toS(c.x, c.z); return Math.hypot(p[0] - sx, p[1] - sy) < 13; });
  if (hit) { e.stopImmediatePropagation(); cmtThread(hit.id, e.clientX, e.clientY); }
}, true);
function cmtDraw2d() {
  if (OFF || !P) return; const L = cmts().filter((c) => !c.lv || c.lv === P.levelId); cx.save(); cx.font = '700 11px ' + getComputedStyle(document.body).fontFamily; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  L.forEach((c, i) => { const [x, y] = toS(c.x, c.z); cx.fillStyle = c.done ? getCss('--muted') : '#ffcc00'; cx.beginPath(); cx.arc(x, y, 10, 0, 7); cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.stroke(); cx.fillStyle = '#111'; cx.fillText(String(i + 1), x, y + .5); });
  cx.restore();
}
// 공유 (Supabase)
const shareBase = () => store.get('drs_shareBase', '') || BUILT.shareBase || (/^https?:/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.host) ? location.origin + location.pathname : '');
function openShare() {
  const d = $('#shareDlg'), logged = !!(SYNC.cfg.access && sbUrl());
  $('#shNeed').hidden = logged; $('#shBody').hidden = !logged; $('#shBase').value = shareBase(); $('#shAllow').checked = P.shareAllow !== false;
  $('#shLink').value = P.shareId && shareBase() ? shareBase() + '#share-' + P.shareId : ''; $('#shStatus').textContent = P.shareId ? '이미 만든 링크가 있어요. 다시 누르면 최신 내용으로 바뀌어요.' : ''; d.showModal();
}
async function shareMake() {
  const st = $('#shStatus'), base = $('#shBase').value.trim(); store.set('drs_shareBase', base); if (!base) { st.textContent = '앱을 올려 둔 웹 주소를 넣어 주세요 (예: GitHub Pages 주소)'; return; }
  st.textContent = '링크를 만드는 중…'; P.shareAllow = $('#shAllow').checked; if (!P.shareId) P.shareId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  varSaveCur(); const data = JSON.parse(JSON.stringify(P)); delete data.photos; (data.levels || []).forEach((l) => l.data && delete l.data.photos);
  try { await sbFetch('/rest/v1/shares', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: P.shareId, owner: SYNC.cfg.user, name: P.name, data, allow_comment: P.shareAllow, updated_at: new Date().toISOString() }) });
    commit(true); $('#shLink').value = base + '#share-' + P.shareId; st.textContent = '링크가 준비됐어요. 복사해서 보내세요. 받는 사람은 로그인 없이 보고' + (P.shareAllow ? ' 댓글을 남길 수 있어요.' : ' 볼 수만 있어요.');
  } catch (e) { st.textContent = '만들지 못했어요: ' + netMsg(e) + ' · supabase/schema.sql의 shares 표를 먼저 만들어 주세요.'; }
}
async function sharePull() {
  if (!P.shareId) { $('#shStatus').textContent = '아직 공유 링크가 없어요'; return; }
  try { const r = await (await sbFetch(`/rest/v1/share_comments?share_id=eq.${P.shareId}&select=*`)).json(); let n = 0; for (const c of r) if (!cmts().some((x) => x.id === c.id)) { cmts().push({ id: c.id, x: c.x, y: c.y, z: c.z, lv: c.lv, text: c.text, by: c.by + ' (링크)', t: c.t, re: [], share: true }); n++; } if (n) commit(); renderCmts(); need3d = true; $('#shStatus').textContent = n ? `새 댓글 ${n}개를 가져왔어요` : '새 댓글이 없어요'; }
  catch (e) { $('#shStatus').textContent = '가져오지 못했어요: ' + netMsg(e); }
}
async function anonFetch(path, opt = {}) { const k = sbKey(), h = { apikey: k, 'Content-Type': 'application/json' }; if (!/^sb_/.test(k)) h.Authorization = 'Bearer ' + k; const r = await fetch(sbUrl() + path, { ...opt, headers: { ...h, ...(opt.headers || {}) } }); if (!r.ok) throw new Error('서버 응답 ' + r.status); return r; }
async function shareComment(c) { try { await anonFetch('/rest/v1/share_comments', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ id: c.id, share_id: VIEWER.id, x: c.x, y: c.y, z: c.z, lv: c.lv, text: c.text, by: c.by, t: c.t }) }); cmts().push(c); toast('댓글을 남겼어요 · 만든 사람에게 전달돼요'); } catch (e) { toast('댓글을 보내지 못했어요'); } }
async function shareOpen(id) {
  if (!sbUrl() || !sbKey()) { toast('이 앱에 서버 주소가 없어 공유 링크를 열 수 없어요'); return false; }
  try { const row = (await (await anonFetch(`/rest/v1/shares?id=eq.${id}&select=*`)).json())[0]; if (!row) throw new Error('없는 링크');
    let cm = []; try { cm = await (await anonFetch(`/rest/v1/share_comments?share_id=eq.${id}&select=*`)).json(); } catch (e) {}
    VIEWER = { id, allow: row.allow_comment }; const p = row.data; p.id = 'share-' + id; p.comments = (p.comments || []).concat(cm.map((c) => ({ ...c, re: [], share: true })));
    document.body.classList.add('viewer'); if (!row.allow_comment) document.body.classList.add('nocomment');
    openProject(p); setView(isMobile() ? '3d' : 'split'); $('#projDlg').close && $('#projDlg').open && $('#projDlg').close(); toast(`${row.name} · 보기 전용 링크예요`); return true;
  } catch (e) { toast('공유 링크를 열지 못했어요'); return false; }
}
const _sp = saveProject; saveProject = function (f) { if (VIEWER) return; return _sp(f); };

/* ---------- 테마 ---------- */
function setTheme(t) { store.set('drs_theme', t); if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; const b = $('#themeBtn'); if (b) b.setAttribute('aria-label', t === 'dark' ? '밝은 화면으로' : '어두운 화면으로'); need3d = true; reqMini(); }
