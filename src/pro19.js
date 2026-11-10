/* ================================================================
   v21 · 바닥 상세 (구배 % · 트렌치 · 바닥 높이 · 채움층 시멘트/모래…) · 벽으로 둘러싼 공간 자동 인식
         공간 태그 (주방 · 홀 · 공장 · 복도 · 화장실 · 거실 …) · 공간 프리셋 · 공간별 레이어
         선택 도구: 개별 / 공간 (눌러서 · 끌어서 · 그려서)
   ================================================================ */
['공장', '복도', '거실', '계단실', '탈의실', '세척실', '사무실'].forEach((k) => { if (!ROOMKINDS.includes(k)) ROOMKINDS.splice(ROOMKINDS.length - 1, 0, k); });
var SELMODE = 'item', LASTPT = null, SPDRAG = null, SLOPEPICK2 = null;

/* ---------- 1. 벽으로 둘러싼 공간 찾기 ---------- */
function detectRoom(wx, wy) {
  const W = (P && P.walls) || []; if (!W.length) return null;
  let b = [1e9, 1e9, -1e9, -1e9]; for (const w of W) { b[0] = Math.min(b[0], w.x1, w.x2); b[1] = Math.min(b[1], w.y1, w.y2); b[2] = Math.max(b[2], w.x1, w.x2); b[3] = Math.max(b[3], w.y1, w.y2); }
  if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) return null;
  b = [b[0] - 400, b[1] - 400, b[2] + 400, b[3] + 400]; let cs = 40; while (((b[2] - b[0]) / cs) * ((b[3] - b[1]) / cs) > 360000) cs *= 1.25;
  const nx = Math.ceil((b[2] - b[0]) / cs), ny = Math.ceil((b[3] - b[1]) / cs), g = new Uint8Array(nx * ny);
  for (const w of W) { const r = wallT(w) / 2 + cs * 0.35, i0 = Math.max(0, Math.floor((Math.min(w.x1, w.x2) - r - b[0]) / cs)), i1 = Math.min(nx - 1, Math.ceil((Math.max(w.x1, w.x2) + r - b[0]) / cs)), j0 = Math.max(0, Math.floor((Math.min(w.y1, w.y2) - r - b[1]) / cs)), j1 = Math.min(ny - 1, Math.ceil((Math.max(w.y1, w.y2) + r - b[1]) / cs));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (distPtSeg(b[0] + (i + .5) * cs, b[1] + (j + .5) * cs, w)[0] <= r) g[j * nx + i] = 1; }
  const si = Math.floor((wx - b[0]) / cs), sj = Math.floor((wy - b[1]) / cs); if (g[sj * nx + si]) return null;
  const f = new Uint8Array(nx * ny), st = [sj * nx + si]; f[st[0]] = 1; let n = 0;
  while (st.length) { const k = st.pop(), i = k % nx, j = (k - i) / nx; n++; if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) return null;
    for (const q of [k - 1, k + 1, k - nx, k + nx]) if (!g[q] && !f[q]) { f[q] = 1; st.push(q); } }
  // 테두리 따라가기
  const out = new Map(), key = (i, j) => j * (nx + 1) + i, add = (a, c) => { if (!out.has(a)) out.set(a, []); out.get(a).push(c); }, F = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny && f[j * nx + i];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { if (!f[j * nx + i]) continue;
    if (!F(i, j - 1)) add(key(i, j), key(i + 1, j)); if (!F(i + 1, j)) add(key(i + 1, j), key(i + 1, j + 1)); if (!F(i, j + 1)) add(key(i + 1, j + 1), key(i, j + 1)); if (!F(i - 1, j)) add(key(i, j + 1), key(i, j)); }
  let best = null;
  while (out.size) { const s0 = out.keys().next().value, loop = [s0]; let cur = s0, guard = 0;
    while (guard++ < 400000) { const L = out.get(cur); if (!L || !L.length) break; const nxt = L.pop(); if (!L.length) out.delete(cur); if (nxt === s0) break; loop.push(nxt); cur = nxt; }
    const pts = loop.map((k) => [b[0] + (k % (nx + 1)) * cs, b[1] + Math.floor(k / (nx + 1)) * cs]); if (pts.length > 3) { const a = Math.abs(polyArea(pts)); if (!best || a > best.a) best = { a, pts }; } }
  if (!best) return null; let p = rdp(best.pts.concat([best.pts[0]]), cs * 1.3); p.pop(); p = p.map((q) => [Math.round(q[0] / 10) * 10, Math.round(q[1] / 10) * 10]);
  // 거의 수평 · 수직인 변 정리
  for (let k = 0; k < p.length; k++) { const a = p[k], c = p[(k + 1) % p.length]; if (Math.abs(a[0] - c[0]) < cs * 1.2 && Math.abs(a[1] - c[1]) > cs * 3) c[0] = a[0]; else if (Math.abs(a[1] - c[1]) < cs * 1.2 && Math.abs(a[0] - c[0]) > cs * 3) c[1] = a[1]; }
  p = p.filter((q, k) => { const a = p[(k + p.length - 1) % p.length], c = p[(k + 1) % p.length]; return Math.abs((q[0] - a[0]) * (c[1] - a[1]) - (q[1] - a[1]) * (c[0] - a[0])) > 1; });
  return p.length >= 3 && Math.abs(polyArea(p)) > 300000 ? p : null;
}
function rdp(pts, eps) { if (pts.length < 3) return pts; const a = pts[0], c = pts[pts.length - 1]; let mi = 0, md = 0; for (let i = 1; i < pts.length - 1; i++) { const d = distPtSeg(pts[i][0], pts[i][1], { x1: a[0], y1: a[1], x2: c[0], y2: c[1] })[0]; if (d > md) { md = d; mi = i; } }
  if (md <= eps) return [a, c]; return rdp(pts.slice(0, mi + 1), eps).slice(0, -1).concat(rdp(pts.slice(mi), eps)); }
function guessKind(pts) {
  const its = P.items.filter((it) => pointInPoly(it.x, it.y, pts)), c = (re) => its.filter((it) => re.test((libGet(it.type).cat || '') + ' ' + it.type)).length;
  if (c(/toilet|urinal|욕실|washbasin/) >= 1) return '화장실'; if (c(/주방|sink|fryer|range|fridge|work/) >= 2) return '주방'; if (c(/table|chair|테이블|의자/) >= 3) return '홀'; if (c(/공장|prack|conveyor/) >= 1) return '공장'; return '기타';
}
function smallestRoomAt(x, y) { let best = null; for (const r of rooms()) if (pointInPoly(x, y, r.pts)) { const a = Math.abs(polyArea(r.pts)); if (!best || a < best.a) best = { a, r }; } return best && best.r; }
function makeRoomQuiet(pts, kind) {
  const n = rooms().length + 1, k = kind || guessKind(pts), same = rooms().filter((r) => r.kind === k).length, under = smallestRoomAt(...polyCenter(pts));
  const r = { id: uid('r'), name: k === '기타' ? `공간 ${n}` : same ? `${k} ${same + 1}` : k, kind: k, pts, finish: under ? { ...under.finish } : { ...(P.floor || { type: 'tile', color: '#c9c3b8' }) }, lift: under ? under.lift || 0 : 0 };
  P.rooms = P.rooms || []; P.rooms.push(r); return r;
}
function roomForPoint(x, y, create = true) { // 누른 자리의 공간 (없으면 벽을 따라 새로)
  const cur = smallestRoomAt(x, y), pts = detectRoom(x, y);
  if (cur && (!pts || Math.abs(polyArea(cur.pts)) <= Math.abs(polyArea(pts)) * 1.2)) return cur;
  if (!pts) return cur || null; if (!create) return null; return makeRoomQuiet(pts);
}
{ const _ra = roomAt; roomAt = function (x, y) { return smallestRoomAt(x, y) || _ra(x, y); }; }

// 마지막으로 누른 바닥 자리 기억
{ const _ht = hitTest; hitTest = function (wx, wy) { const h = _ht(wx, wy); if (h && (h.kind === 'floor' || h.kind === 'room')) LASTPT = [wx, wy]; return h; }; }
{ const _rh = rayHit; rayHit = function (e) { const h = _rh(e); if (h && h.p && (h.sel.kind === 'floor' || h.sel.kind === 'room')) LASTPT = [h.p[0], h.p[2]]; return h; }; }

function floorToRoom() { // 바닥 → 이 자리 공간 만들고 상세 열기
  const p = LASTPT || (() => { const b = bounds(); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; })();
  let r = roomForPoint(p[0], p[1]);
  if (!r) { const b = bounds(), T = (P.wallT || 150) / 2; if (b[2] - b[0] < 500) { toast('먼저 벽을 그려 주세요'); return null; } r = makeRoomQuiet([[b[0] + T, b[1] + T], [b[2] - T, b[1] + T], [b[2] - T, b[3] - T], [b[0] + T, b[3] - T]], '기타'); r.name = '전체 바닥'; toast('벽으로 닫힌 곳을 찾지 못해 전체 바닥으로 잡았어요 · 벽 끝이 서로 붙어 있는지 확인해 보세요'); }
  else toast(`"${r.name}" 공간을 잡았어요 · 오른쪽 상세에서 구배 · 바닥 높이 · 채움 · 종류를 정하세요`);
  commit(); dirty3d = true; draw2d(); pickSel({ kind: 'room', id: r.id }); if (isMobile()) openSheet('props'); else document.body.classList.remove('no-right'); return r;
}
// 바닥 속성 창 · 빠른 창에 진입 버튼
{ const _rp = renderProps0; renderProps0 = function () { _rp(); try { if (!sel || sel.kind !== 'floor' || multi.length > 1) return; const el = $('#props'); if (!el || $('#flDetail')) return;
  const box_ = document.createElement('div'); box_.className = 'flbox'; box_.innerHTML = `<div class="lbl">바닥 상세 · 이 자리 공간</div><p class="hint">벽으로 둘러싼 이 자리를 공간으로 잡고 구배(물빠짐) · 바닥 높이(양생 단 올림) · 채움층(시멘트 · 모래 …) · 공간 종류를 정해요</p><button class="btn pri" id="flDetail">구배 · 바닥 높이 · 채움 설정</button>`;
  el.appendChild(box_); $('#flDetail').onclick = floorToRoom; } catch (e) { console.warn(e); } }; }
{ const _rq = renderQuick0; renderQuick0 = function () { _rq(); const q = $('#quick'); if (!q || !sel || sel.kind !== 'floor' || multi.length > 1 || $('#qFlD', q)) return; const body = $('.qbody', q); if (body) body.insertAdjacentHTML('beforeend', '<div class="qrow"><button class="qb" id="qFlD">구배 · 높이 · 채움 (상세)</button></div>'); const b = $('#qFlD', q); if (b) b.onclick = floorToRoom; }; }

/* ---------- 2. 구배: % · 트렌치(선) ---------- */
slopeH = function (r, x, y) { const s = r && r.slope; if (!s || !s.drain || !s.deg) return 0; const t = Math.tan(s.deg * Math.PI / 180);
  if (s.drain2) return t * distPtSeg(x, y, { x1: s.drain[0], y1: s.drain[1], x2: s.drain2[0], y2: s.drain2[1] })[0]; return t * Math.hypot(x - s.drain[0], y - s.drain[1]); };
const pct2deg = (p) => Math.round(Math.atan(p / 100) * 180 / Math.PI * 1000) / 1000, deg2pct = (d) => Math.round(Math.tan(d * Math.PI / 180) * 1000) / 10;
function trenchPick(wx, wy) {
  const S = SLOPEPICK2, r = roomOf(S.id); if (!r) { SLOPEPICK2 = null; return; } if (!pointInPoly(wx, wy, r.pts)) { toast('그 공간 안쪽을 눌러 주세요'); return; }
  if (!S.a) { S.a = [Math.round(wx), Math.round(wy)]; toast('트렌치 끝점을 누르세요'); draw2d(); return; }
  const a = S.a, c = [Math.round(wx), Math.round(wy)], L = Math.hypot(c[0] - a[0], c[1] - a[1]); SLOPEPICK2 = null; if (L < 200) { toast('트렌치가 너무 짧아요'); renderProps(); return; }
  r.slope = { deg: (r.slope && r.slope.deg) || pct2deg(1), drain: a, drain2: c };
  P.items = P.items.filter((it) => !(it.tag === '트렌치 (구배)' && it.room === r.id));
  P.items.push({ id: uid('i'), type: 'trench', x: Math.round((a[0] + c[0]) / 2), y: Math.round((a[1] + c[1]) / 2), w: Math.round(L), d: 200, rot: Math.round(Math.atan2(c[1] - a[1], c[0] - a[0]) * 180 / Math.PI), tag: '트렌치 (구배)', room: r.id });
  commit(); dirty3d = true; draw2d(); renderProps(); toast(`트렌치 쪽으로 ${deg2pct(r.slope.deg)}% 기울였어요`);
}
cv.addEventListener('pointerdown', (e) => { if (!SLOPEPICK2) return; e.stopImmediatePropagation(); const r = cv.getBoundingClientRect(); trenchPick(...toW(e.clientX - r.left, e.clientY - r.top)); }, true);
gc.addEventListener('pointerdown', (e) => { if (!SLOPEPICK2 || e.button !== 0) return; const g = planeHit(e, 0); if (!g) return; e.stopImmediatePropagation(); trenchPick(g[0], g[1]); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && SLOPEPICK2) { e.stopImmediatePropagation(); SLOPEPICK2 = null; renderProps(); draw2d(); } }, true);

/* ---------- 3. 채움층 (양생 · 단 올림) ---------- */
var FILLS = { concrete: ['콘크리트', '#a9a9a4'], mortar: ['시멘트 몰탈', '#bdbab2'], sand: ['모래', '#d9c49a'], gravel: ['자갈 · 쇄석', '#9a958c'], foam: ['기포 콘크리트 (경량)', '#e3e1da'], xps: ['단열재 (XPS)', '#7fb2d9'],
  mesh: ['와이어 메쉬', '#6f7377'], waterproof: ['방수층 (액체 · 우레탄)', '#4f7fa6'], selflevel: ['셀프 레벨링', '#cfcdc6'], heating: ['난방 배관층', '#d98a6a'], epoxy: ['에폭시 코팅', '#7c8f86'], tilebed: ['타일 붙임 몰탈', '#b7b2a6'] };
const FILLSETS = { kitchen: ['주방 (방수 + 몰탈 + 타일)', [['concrete', 60], ['waterproof', 3], ['mortar', 50], ['tilebed', 20]]], raise: ['단 올림 (모래 + 몰탈)', [['sand', 80], ['mortar', 50]]], light: ['경량 단 올림 (기포 + 몰탈)', [['foam', 100], ['mortar', 40]]], heat: ['주거 난방 (단열 + 기포 + 배관 + 몰탈)', [['xps', 30], ['foam', 40], ['heating', 20], ['mortar', 40]]], factory: ['공장 (콘크리트 + 메쉬 + 에폭시)', [['gravel', 100], ['concrete', 150], ['mesh', 5], ['epoxy', 3]]] };
const layerSum = (r) => (r.layers || []).reduce((s, l) => s + (+l.t || 0), 0);

/* 3D: 단 옆면을 층별 색으로 */
{ const _bl = buildLevel; buildLevel = function (active) { _bl(active); try { if (!window.ROOMS_ON || vis.floorL === false || !P) return; const T = xf(0, 0, 0);
  const L = ISO && active ? rooms().filter((r) => r.id === ISO) : rooms();
  for (const r of L) { if (!r.layers || !r.layers.length || !(r.lift > 0)) continue; const sum = layerSum(r) || 1, k = r.lift / sum, pts = r.pts, cw = polyArea(pts) > 0 ? 1 : -1;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[j], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], Ln = Math.hypot(dx, dz) || 1, nx = dz / Ln * cw, nz = -dx / Ln * cw, o = 2;
      if (P.walls.some((w) => distPtSeg((a[0] + b[0]) / 2 + nx * 60, (a[1] + b[1]) / 2 + nz * 60, w)[0] < wallT(w) / 2 + 40)) continue; // 벽에 붙은 변은 건너뛰기
      let y = 0; for (const l of r.layers) { const h = (+l.t || 0) * k; if (h <= 0) continue; const c = tintC(hexRGB((FILLS[l.m] || ['', '#bbbbbb'])[1])), A = [a[0] + nx * o, a[1] + nz * o], B = [b[0] + nx * o, b[1] + nz * o];
        quad(grp(l.m === 'xps' || l.m === 'waterproof' || l.m === 'epoxy' ? 'plain' : 'plain'), [T.P(A[0], y, A[1]), T.P(B[0], y, B[1]), T.P(B[0], y + h, B[1]), T.P(A[0], y + h, A[1])], [nx, 0, nz], c); y += h; } } }
} catch (e) { console.warn('fill layers', e); } }; }

/* ---------- 4. 공간 속성 창 확장 ---------- */
{ const _p = roomPanel; roomPanel = function () {
  let h = _p(); const r = roomOf(sel.id), sl = r.slope || {}, M = selRooms().length > 1, pc = sl.deg ? deg2pct(sl.deg) : 1;
  // 구배: % 입력 · 트렌치
  h = h.replace('min="1" max="15" step="0.5"', 'min="0.1" max="10" step="0.05"').replace(`<b id="rmDegV">${sl.deg || 1}°</b>`, `<b id="rmDegV">${sl.deg || pct2deg(1)}° · ${pc}%</b>`);
  h = h.replace('<div class="lbl">구배 (물빠짐 경사)</div>', `<div class="lbl">구배 (물빠짐 경사)</div><div class="g3"><label class="fld"><span>경사 % (1/100 = 1%)</span><input id="rmPct" type="number" min="0.1" max="15" step="0.1" value="${pc}"></label><label class="fld"><span>흔한 값</span><select id="rmPctQ"><option value="">고르기</option><option value="1">주방 · 화장실 1/100 (1%)</option><option value="1.5">1.5%</option><option value="2">세척실 · 외부 1/50 (2%)</option><option value="0.5">공장 0.5%</option></select></label><button class="btn ${SLOPEPICK2 && SLOPEPICK2.id === r.id ? 'pri' : ''}" id="rmTrench">${sl.drain2 ? '트렌치 다시 긋기' : '트렌치(선)로 구배'}</button></div>`);
  // 바닥 높이 · 채움층
  const Ls = r.layers || [], sum = layerSum(r), area = Math.abs(polyArea(r.pts)) / 1e6;
  const fillHtml = `<div class="lbl">바닥 높이 · 채움 (양생)</div>
    <div class="g3"><label class="fld"><span>바닥 높이 mm (단 올림 +, 내림 −)</span><input id="rmLift2" type="number" step="10" value="${r.lift || 0}"></label><label class="fld"><span>채움 묶음</span><select id="rmFillSet"><option value="">고르기</option>${Object.entries(FILLSETS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select></label></div>
    <div class="fillrows">${Ls.map((l, i) => `<div class="fillrow"><i style="background:${(FILLS[l.m] || ['', '#bbb'])[1]}"></i><select data-flm="${i}" aria-label="채움 재료">${Object.entries(FILLS).map(([k, v]) => `<option value="${k}" ${k === l.m ? 'selected' : ''}>${v[0]}</option>`).join('')}</select><input type="number" data-flt="${i}" value="${l.t}" min="1" step="5" aria-label="두께 mm"><span>mm</span><button class="qb" data-flup="${i}" aria-label="위로" ${i === Ls.length - 1 ? 'disabled' : ''}>↑</button><button class="qb" data-fldel="${i}" aria-label="지우기">✕</button></div>`).join('')}</div>
    <div class="row wrap"><button class="btn" id="rmFillAdd">+ 채움층 추가</button>${Ls.length && sum !== (r.lift || 0) ? `<button class="btn pri" id="rmFillFit">바닥 높이를 층 합 ${sum}mm로</button>` : ''}</div>
    <p class="hint">${Ls.length ? `아래부터 위로 · 합 ${sum}mm · 면적 ${area.toFixed(1)}㎡ · ${Ls.map((l) => `${FILLS[l.m] ? FILLS[l.m][0] : l.m} ${(area * l.t / 1000).toFixed(2)}㎥`).join(' · ')}` : '시멘트 · 모래 · 방수층 등 층을 쌓아 단을 올려요. 단 옆면에 층별 색이 보여요.'}</p>`;
  const liftOld = `<div class="g3">${field('바닥 높이 (단차 mm)', 'rmLift', r.lift || 0)}</div><p class="hint">주방턱 · 단차가 있으면 높이를 넣어요. 그 위 기물도 같이 올라가요.</p>`; h = h.includes(liftOld) ? h.replace(liftOld, fillHtml) : h + fillHtml;
  // 공간 프리셋 · 레이어
  const myP = spList().filter((p) => !p.kind || p.kind === r.kind || true), bi = SPBUILT[r.kind] || [];
  if (!M) h += `<div class="lbl">공간 프리셋 · ${esc(r.kind)}</div>
    <div class="g3"><label class="fld" style="grid-column:span 2"><span>이 공간에 놓을 구성</span><select id="spSel">${bi.map((b, i) => `<option value="b${i}">${esc(b.n)}</option>`).join('')}${myP.length ? `<optgroup label="내 공간 프리셋">${myP.map((p) => `<option value="m${p.id}">${esc(p.name)} (${esc(p.kind)})</option>`).join('')}</optgroup>` : ''}${!bi.length && !myP.length ? '<option value="">이 종류는 기본 구성이 없어요</option>' : ''}</select></label><button class="btn pri" id="spGo" ${!bi.length && !myP.length ? 'disabled' : ''}>이 공간에 적용</button></div>
    <div class="row wrap"><label class="chk"><input type="checkbox" id="spClear" checked> 이 공간 안의 기물을 비우고 놓기</label></div>
    <div class="row wrap"><button class="btn" id="spSave">이 공간을 내 프리셋으로 저장</button>${myP.length ? '<button class="btn" id="spDel">내 프리셋 지우기…</button>' : ''}</div>
    <div class="lbl">이 공간 레이어 (이 공간만 볼 때)</div><div class="splay">${LAYERS.map((l) => `<label class="chk"><input type="checkbox" data-splay="${l.id}" ${(r.vis || {})[l.id] === false ? '' : 'checked'}> ${esc(l.name)}</label>`).join('')}</div>`;
  return h; }; }
{ const _b = bindRoomPanel; bindRoomPanel = function () { _b(); const L = selRooms(), r = roomOf(sel.id), all = (f, re) => { L.forEach(f); commit(); dirty3d = true; draw2d(); if (re !== false) renderProps(); };
  const setPct = (p) => { p = clamp(+p || 0, 0.05, 20); all((x) => (x.slope = { ...(x.slope || {}), deg: pct2deg(p) })); if (!r.slope || !r.slope.drain) toast(`경사 ${p}% · 이제 배수 위치를 찍거나 트렌치를 그어 주세요`); };
  const pi = $('#rmPct'); if (pi) pi.onchange = () => setPct(pi.value); const pq = $('#rmPctQ'); if (pq) pq.onchange = () => pq.value && setPct(pq.value);
  const dg = $('#rmDeg'); if (dg) dg.addEventListener('input', () => { $('#rmDegV').textContent = `${dg.value}° · ${deg2pct(+dg.value)}%`; });
  const tb = $('#rmTrench'); if (tb) tb.onclick = () => { SLOPEPICK = null; SLOPEPICK2 = { id: r.id }; renderProps(); draw2d(); toast('트렌치 시작점을 누르세요 (도면이나 3D 바닥) · Esc로 취소'); };
  const lf = $('#rmLift2'); if (lf) lf.onchange = () => all((x) => (x.lift = clamp(Math.round(+lf.value || 0), -1000, 1500)));
  const fs = $('#rmFillSet'); if (fs) fs.onchange = () => { const s = FILLSETS[fs.value]; if (!s) return; all((x) => { x.layers = s[1].map(([m, t]) => ({ m, t })); if (!x.lift) x.lift = layerSum(x); }); };
  $$('[data-flm]').forEach((s) => (s.onchange = () => all((x) => { if (x.layers && x.layers[+s.dataset.flm]) x.layers[+s.dataset.flm].m = s.value; })));
  $$('[data-flt]').forEach((s) => (s.onchange = () => all((x) => { if (x.layers && x.layers[+s.dataset.flt]) x.layers[+s.dataset.flt].t = clamp(Math.round(+s.value || 0), 1, 1500); })));
  $$('[data-fldel]').forEach((s) => (s.onclick = () => all((x) => x.layers && x.layers.splice(+s.dataset.fldel, 1))));
  $$('[data-flup]').forEach((s) => (s.onclick = () => all((x) => { const i = +s.dataset.flup, a = x.layers; if (a && a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]]; })));
  const fa = $('#rmFillAdd'); if (fa) fa.onclick = () => all((x) => { x.layers = x.layers || []; x.layers.push({ m: x.layers.length ? 'mortar' : 'sand', t: 50 }); });
  const ff = $('#rmFillFit'); if (ff) ff.onclick = () => all((x) => (x.lift = layerSum(x)));
  const go = $('#spGo'); if (go) go.onclick = () => { const v = $('#spSel').value; if (!v) return; spApply(r, v, $('#spClear').checked); };
  const kd = $('#rmKind'); if (kd) kd.addEventListener('change', () => { let ch_ = false; L.forEach((x) => { if (/^공간 \d+$/.test(x.name)) { const same = rooms().filter((y) => y !== x && y.kind === x.kind).length; x.name = same ? `${x.kind} ${same + 1}` : x.kind; ch_ = true; } }); if (ch_) { commit(); renderLevels(); renderProps(); } });
  const sv = $('#spSave'); if (sv) sv.onclick = () => spSave(r);
  const dl = $('#spDel'); if (dl) dl.onclick = () => { const v = $('#spSel').value; if (!v || v[0] !== 'm') { toast('지울 내 프리셋을 위 목록에서 고르세요'); return; } if (!dl.dataset.ok) { dl.dataset.ok = 1; dl.textContent = '정말 지울까요?'; return; } spPut(spList().filter((p) => 'm' + p.id !== v)); renderProps(); };
  $$('[data-splay]').forEach((c) => (c.onchange = () => { r.vis = { ...(r.vis || {}), [c.dataset.splay]: c.checked }; if (c.checked) delete r.vis[c.dataset.splay]; commit(); if (ISO === r.id) spVisApply(r); }));
}; }
// 2D: 트렌치 선 · 채움 표시 · 공간 끌기 사각형
{ const _d = draw2d; draw2d = function () { _d(); try { if (!P || view === '3d' || typeof OFF !== 'undefined' && OFF) return;
  if (window.ROOMS_ON && vis.floorL !== false) for (const r of rooms()) { const s = r.slope; if (s && s.drain2) { const a = toS(...s.drain), b = toS(...s.drain2); cx.save(); cx.strokeStyle = '#1f6fb0'; cx.lineWidth = 5; cx.setLineDash([]); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke(); cx.restore(); } }
  if (SLOPEPICK2 && SLOPEPICK2.a) { const a = toS(...SLOPEPICK2.a); cx.fillStyle = '#1f6fb0'; cx.beginPath(); cx.arc(a[0], a[1], 6, 0, 7); cx.fill(); }
  if (SPDRAG && SPDRAG.moved) { const a = toS(SPDRAG.x0, SPDRAG.y0), b = toS(SPDRAG.x1, SPDRAG.y1); cx.save(); cx.fillStyle = 'rgba(10,132,255,.12)'; cx.strokeStyle = getCss('--accent') || '#0a84ff'; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); cx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); cx.restore(); }
  if (SELMODE === 'space' && tool === 'select' && window.ROOMS_ON) for (const r of rooms()) { if (isSelected('room', r.id)) continue; const m = toS(...polyCenter(r.pts)); cx.save(); cx.font = '600 11px system-ui'; cx.textAlign = 'center'; cx.fillStyle = getCss('--accent') || '#0a84ff'; cx.fillText(`[${r.kind}]`, m[0], m[1] + 10); cx.restore(); }
} catch (e) { console.warn(e); } }; }

/* ---------- 5. 공간 프리셋 ---------- */
function spList() { try { return store.get('drs_spacepre', []) || []; } catch (e) { return []; } }
function spPut(L) { try { store.set('drs_spacepre', L); } catch (e) { toast('저장 공간이 부족해요'); } }
const SPBUILT = {
  '주방': [{ n: '페리카나 주방 (배달형 · 공간 전체)', pel: 'delivery' }, { n: '페리카나 주방 (홀형 주방 구성)', pel: 'hall' }, { n: '기본 주방 (벽 따라: 작업대 · 싱크 · 냉장고 · 레인지)', wall: ['k_reach', 'k_work18', 'sink2', 'k_work09', 'range', 'k_dwU', 'k_upper'] }],
  '홀': [{ n: '4인 테이블 배치', grid: { t: 't4', ch: 'chair', gap: 900 } }, { n: '2인 테이블 배치', grid: { t: 't2', ch: 'chair', gap: 800 } }],
  '화장실': [{ n: '남녀 공용 (양변기 · 소변기 · 세면대)', wall: ['toilet', 'b_urinal', 'washbasin', 'b_handdry', 'b_paper'] }, { n: '칸막이 화장실 2칸 + 세면대', wall: ['b_stall', 'b_stall', 'b_basin2', 'b_handdry'] }, { n: '가정 욕실 (변기 · 세면장 · 샤워)', wall: ['b_toiletB', 'b_vanity9', 'b_showerB'] }],
  '집 · 거실': [{ n: '거실 (소파 · TV장 · 테이블)', living: 1 }], '거실': [{ n: '거실 (소파 · TV장 · 테이블)', living: 1 }],
  '방': [{ n: '침실 (침대 · 옷장 · 협탁)', wall: ['f_ward24', 'f_bedD', 'f_night', 'f_chest4'] }],
  '사무실': [{ n: '사무실 (책상 · 의자 · 캐비닛)', office: 1 }],
  '창고': [{ n: '창고 (랙 벽 따라)', wall: ['m_lrack', 'm_lrack', 'm_lrack', 'm_lrack', 'm_lrack', 'm_lrack'] }],
  '공장': [{ n: '공장 (랙 · 작업대 · 컨베이어)', wall: ['m_prack', 'm_bench', 'm_bench', 'm_mlocker', 'm_ext'], center: ['m_conv6'] }],
  '복도': [{ n: '복도 (라인 조명 · 비상등)', corridor: 1 }],
  '탈의실': [{ n: '탈의실 (사물함 · 벤치)', wall: ['m_mlock', 'm_mlock', 'f_mirror'], center: ['f_bench'] }],
  '세척실': [{ n: '세척실 (세척 싱크 · 식세기 · 선반)', wall: ['k_potsink', 'k_dwDoor', 'k_work18', 'f_steelsh'] }],
  '베란다': [{ n: '세탁 공간 (세탁기 · 건조기)', wall: ['e_wash', 'e_dry', 'f_storage'] }],
};
function spBox(r) { const b = aabb(r.pts); return { x0: b[0], y0: b[1], x1: b[2], y1: b[3], W: b[2] - b[0], D: b[3] - b[1] }; }
function spDoorsOn(side, B) { // 그 변에 있는 문 · 개구부 구간 (변 위 좌표)
  const out = []; for (const o of P.openings) { const g = openingGeom(o); if (!g) continue; const m = [(g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2], tol = 400;
    if (side === 'N' && Math.abs(m[1] - B.y0) < tol) out.push([Math.min(g.a[0], g.b[0]) - B.x0 - 250, Math.max(g.a[0], g.b[0]) - B.x0 + 250]);
    if (side === 'S' && Math.abs(m[1] - B.y1) < tol) out.push([B.x1 - Math.max(g.a[0], g.b[0]) - 250, B.x1 - Math.min(g.a[0], g.b[0]) + 250]);
    if (side === 'E' && Math.abs(m[0] - B.x1) < tol) out.push([Math.min(g.a[1], g.b[1]) - B.y0 - 250, Math.max(g.a[1], g.b[1]) - B.y0 + 250]);
    if (side === 'W' && Math.abs(m[0] - B.x0) < tol) out.push([B.y1 - Math.max(g.a[1], g.b[1]) - 250, B.y1 - Math.min(g.a[1], g.b[1]) + 250]); }
  return out;
}
function spPlaceWall(r, ids, rep) { // 벽 따라 시계 방향으로
  const B = spBox(r), sides = [['N', B.W], ['E', B.D], ['S', B.W], ['W', B.D]]; let si = 0, u = 50;
  const doors = Object.fromEntries(sides.map(([s]) => [s, spDoorsOn(s, B)]));
  for (const id of ids) { const L = libGet(id); if (!L || L.id !== id) { rep.miss.push(id); continue; } const w = L.w, d = L.d; let ok = false;
    while (si < 4) { const [s, len] = sides[si]; const hit = doors[s].find(([a, b]) => u < b && u + w > a); if (hit) { u = hit[1]; continue; } if (u + w <= len - 50) { ok = true; break; } si++; u = d + 80; }
    if (!ok) { rep.miss.push(L.name); continue; } const s = sides[si][0], c = u + w / 2, off = d / 2 + 10;
    const [x, y, rot] = s === 'N' ? [B.x0 + c, B.y0 + off, 0] : s === 'E' ? [B.x1 - off, B.y0 + c, 90] : s === 'S' ? [B.x1 - c, B.y1 - off, 180] : [B.x0 + off, B.y1 - c, 270];
    if (!pointInPoly(x, y, r.pts)) { u += w + 20; rep.miss.push(L.name); continue; }
    P.items.push({ id: uid('i'), type: id, x: Math.round(x), y: Math.round(y), w, d, rot, pz: 'sp', room: r.id }); rep.placed++; u += w + (L.layer === 'upper' ? 0 : 20); }
}
function spPlaceCenter(r, ids, rep) { const B = spBox(r); ids.forEach((id, k) => { const L = libGet(id); if (!L || L.id !== id) return; const x = B.x0 + B.W / 2, y = B.y0 + B.D * (k + 1) / (ids.length + 1); const rot = B.W >= B.D ? 0 : 90;
  if (pointInPoly(x, y, r.pts)) { P.items.push({ id: uid('i'), type: id, x: Math.round(x), y: Math.round(y), w: L.w, d: L.d, rot, pz: 'sp', room: r.id }); rep.placed++; } }); }
function spPlaceGrid(r, g, rep) { const B = spBox(r), T = libGet(g.t), C = libGet(g.ch), cw = T.w + 2 * (C.d + 100) + g.gap, ch = T.d + g.gap; let n = 0;
  for (let y = B.y0 + 700 + T.d / 2; y + T.d / 2 < B.y1 - 600; y += ch) for (let x = B.x0 + 600 + T.w / 2 + C.d; x + T.w / 2 + C.d < B.x1 - 600; x += cw) {
    if (![[x - T.w / 2 - C.d, y - T.d / 2], [x + T.w / 2 + C.d, y + T.d / 2], [x, y]].every((p) => pointInPoly(p[0], p[1], r.pts))) continue;
    P.items.push({ id: uid('i'), type: g.t, x: Math.round(x), y: Math.round(y), w: T.w, d: T.d, rot: 0, pz: 'sp', room: r.id }); rep.placed++; n++;
    const per = T.w > 900 ? 2 : 1; for (let k = 0; k < per; k++) { const cx_ = x - T.w / 2 + T.w * (k + .5) / per; P.items.push({ id: uid('i'), type: g.ch, x: Math.round(cx_), y: Math.round(y - T.d / 2 - C.d / 2 + 60), w: C.w, d: C.d, rot: 180, pz: 'sp', room: r.id }, { id: uid('i'), type: g.ch, x: Math.round(cx_), y: Math.round(y + T.d / 2 + C.d / 2 - 60), w: C.w, d: C.d, rot: 0, pz: 'sp', room: r.id }); rep.placed += 2; rep.seats += 2; } }
  if (!n) rep.miss.push('테이블 (공간이 좁아요)'); }
function spApply(r, v, clear) {
  const rep = { placed: 0, seats: 0, miss: [] }, inR = (it) => pointInPoly(it.x, it.y, r.pts);
  if (v[0] === 'm') { const p = spList().find((q) => 'm' + q.id === v); if (!p) return; if (clear) P.items = P.items.filter((it) => !inR(it)); const B = spBox(r);
    for (const q of p.items) { const it = { ...JSON.parse(JSON.stringify(q.it)), id: uid('i'), x: Math.round(B.x0 + q.u * B.W), y: Math.round(B.y0 + q.v * B.D), room: r.id }; if (pointInPoly(it.x, it.y, r.pts)) { P.items.push(it); rep.placed++; } else rep.miss.push(libGet(it.type).name); }
    if (p.floor) Object.assign(r, JSON.parse(JSON.stringify(p.floor))); }
  else { const b = (SPBUILT[r.kind] || [])[+v.slice(1)]; if (!b) return;
    if (b.pel) return spPelicana(r, b.pel, clear);
    if (clear) P.items = P.items.filter((it) => !inR(it));
    if (b.wall) spPlaceWall(r, b.wall, rep); if (b.center) spPlaceCenter(r, b.center, rep); if (b.grid) spPlaceGrid(r, b.grid, rep);
    if (b.living) { spPlaceWall(r, ['f_tv18'], rep); const B = spBox(r), S = libGet('f_sofa2'), T = libGet('f_ctable'); const y = B.y1 - S.d / 2 - 150, x = B.x0 + B.W / 2;
      P.items.push({ id: uid('i'), type: 'f_sofa2', x: Math.round(x), y: Math.round(y), w: S.w, d: S.d, rot: 0, pz: 'sp', room: r.id }, { id: uid('i'), type: 'f_ctable', x: Math.round(x), y: Math.round(y - S.d / 2 - 500), w: T.w, d: T.d, rot: 0, pz: 'sp', room: r.id }); rep.placed += 2; }
    if (b.office) { spPlaceWall(r, ['f_book12', 'f_cabinet', 'f_file'], rep); const B = spBox(r), D = libGet('f_desk14'), C = libGet('f_och');
      for (let y = B.y0 + 1500; y + D.d < B.y1 - 900; y += D.d + 1300) for (let x = B.x0 + 800 + D.w / 2; x + D.w / 2 < B.x1 - 600; x += D.w + 300) { if (!pointInPoly(x, y, r.pts)) continue; P.items.push({ id: uid('i'), type: 'f_desk14', x: Math.round(x), y: Math.round(y), w: D.w, d: D.d, rot: 0, pz: 'sp', room: r.id }, { id: uid('i'), type: 'f_och', x: Math.round(x), y: Math.round(y + D.d / 2 + 350), w: C.w, d: C.d, rot: 0, pz: 'sp', room: r.id }); rep.placed += 2; } }
    if (b.corridor) { const B = spBox(r), L = libGet('l_line'), long = B.W >= B.D, n = Math.max(1, Math.floor((long ? B.W : B.D) / 2500));
      for (let k = 0; k < n; k++) { const t = (k + .5) / n, x = long ? B.x0 + B.W * t : B.x0 + B.W / 2, y = long ? B.y0 + B.D / 2 : B.y0 + B.D * t; P.items.push({ id: uid('i'), type: 'l_line', x: Math.round(x), y: Math.round(y), w: L.w, d: L.d, rot: long ? 0 : 90, pz: 'sp', room: r.id }); rep.placed++; }
      spPlaceWall(r, ['l_exit', 'm_ext'], rep); }
  }
  commit(); dirty3d = true; analyze(); draw2d(); renderProps(); toast(`"${r.name}"에 ${rep.placed}개 놓았어요${rep.seats ? ` · 좌석 ${rep.seats}석` : ''}${rep.miss.length ? ` · 못 넣음: ${[...new Set(rep.miss)].slice(0, 3).join(', ')}` : ''}`);
}
function spPelicana(r, kind, clear) { // 페리카나 프리셋을 이 공간 안에서만
  const keep = JSON.parse(JSON.stringify({ items: P.items, walls: P.walls, openings: P.openings, rooms: P.rooms, floor: P.floor, floorPat: P.floorPat, ceiling: P.ceiling })), inR = (x, y) => pointInPoly(x, y, r.pts), B = aabb(r.pts);
  const _pr = presetRect, _ex = exteriorWalls; presetRect = () => [B[0], B[1], B[2], B[3]];
  const ownWalls = P.walls.filter((w) => polyEdgeDist(r.pts, (w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2) < wallT(w) + 200); exteriorWalls = () => ownWalls;
  let rep = null; try { rep = applyPreset({ kind, ratio: 1, seed: Date.now() & 0xffffff, clear: false, scope: ['kitchen', 'lightBase'], counts: {}, windows: false, kh: 850, drainType: 'trench', sub: false }); }
  catch (e) { console.error(e); } finally { presetRect = _pr; exteriorWalls = _ex; }
  const newItems = P.items.filter((it) => inR(it.x, it.y) && !keep.items.some((k) => k.id === it.id)), newWalls = P.walls.filter((w) => !keep.walls.some((k) => k.id === w.id) && inR((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2)), nw = new Set(newWalls.map((w) => w.id));
  P.items = (clear ? keep.items.filter((it) => !inR(it.x, it.y)) : keep.items).concat(newItems.map((it) => ({ ...it, room: r.id })));
  P.walls = keep.walls.concat(newWalls); P.openings = keep.openings.concat(P.openings.filter((o) => nw.has(o.wall))); P.rooms = keep.rooms; P.floor = keep.floor; P.floorPat = keep.floorPat; P.ceiling = keep.ceiling;
  const rr = roomOf(r.id); if (rr && rr.finish.type !== 'tile') rr.finish = { type: 'tile', color: '#a7a3a2' };
  commit(); dirty3d = true; analyze(); draw2d(); renderProps(); toast(rep ? `"${r.name}"에 페리카나 주방 기물 ${newItems.length}개를 놓았어요${rep.miss.length ? ` · 못 넣음: ${rep.miss.slice(0, 3).join(', ')}` : ''}` : '이 공간에는 프리셋을 놓지 못했어요');
}
function spSave(r) {
  const B = spBox(r), its = P.items.filter((it) => pointInPoly(it.x, it.y, r.pts)); if (!its.length) { toast('이 공간 안에 기물이 없어요'); return; }
  const name = `${r.name} 구성 (${its.length}개)`, L = spList();
  L.push({ id: uid('sp'), name, kind: r.kind, items: its.map((it) => { const c = JSON.parse(JSON.stringify(it)); delete c.id; delete c.room; return { u: (it.x - B.x0) / (B.W || 1), v: (it.y - B.y0) / (B.D || 1), it: c }; }), floor: { finish: r.finish, lift: r.lift || 0, layers: r.layers, slope: r.slope ? { deg: r.slope.deg } : null } });
  spPut(L); renderProps(); toast(`"${name}"을 내 공간 프리셋으로 저장했어요 · 다른 공간에서 고를 수 있어요`);
}
// 공간별 레이어 (그 공간만 볼 때)
var SPVIS0 = null;
function spVisApply(r) { if (!SPVIS0) SPVIS0 = { ...vis }; for (const l of LAYERS) vis[l.id] = (r.vis || {})[l.id] === false ? false : SPVIS0[l.id]; renderLayers(); dirty3d = true; draw2d(); }
function spVisRestore() { if (!SPVIS0) return; Object.assign(vis, SPVIS0); SPVIS0 = null; renderLayers(); dirty3d = true; draw2d(); }
{ const _si = setIso; setIso = function (id) { _si(id); const r = id && roomOf(id); if (r && r.vis && Object.values(r.vis).some((v) => v === false)) spVisApply(r); else spVisRestore(); }; }

/* ---------- 6. 선택 도구: 개별 / 공간 ---------- */
{ const tb = $('[data-tool="select"]'); if (tb) {
  const pop = document.createElement('div'); pop.id = 'selPop'; pop.className = 'selpop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '선택 방식');
  document.body.appendChild(pop);
  const render = () => { pop.innerHTML = `<div class="seg" role="group" aria-label="선택 방식"><button data-sm="item" aria-pressed="${SELMODE === 'item'}">개별</button><button data-sm="space" aria-pressed="${SELMODE === 'space'}">공간</button></div>
    ${SELMODE === 'space' ? `<p class="hint">벽 안을 누르면 그 공간 · 끌면 사각형 공간 · 화면 이동은 휠 · 두 손가락</p><div class="row"><button class="btn" id="spDrawLine">선으로 그려 지정</button><button class="btn" id="spAuto">벽 따라 모두 찾기</button></div>` : '<p class="hint">기물 · 벽 · 바닥을 하나씩 골라요</p>'}`; };
  const place = () => { const r = tb.getBoundingClientRect(); pop.style.left = Math.min(innerWidth - 270, r.right + 8) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - 160, r.top)) + 'px'; };
  const badge = () => { tb.classList.toggle('spmode', SELMODE === 'space'); const t = [...tb.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim()); if (t) t.nodeValue = SELMODE === 'space' ? '공간' : '선택'; };
  tb.addEventListener('click', () => { render(); place(); pop.hidden = false; if (isMobile()) setTimeout(() => { place(); }, 50); });
  pop.addEventListener('click', (e) => { const b = e.target.closest('[data-sm]'); if (b) { SELMODE = b.dataset.sm; badge(); render(); draw2d(); toast(SELMODE === 'space' ? '공간 선택: 벽 안을 누르거나 끌어서 공간을 정해요' : '개별 선택'); if (SELMODE === 'space' && sel && sel.kind !== 'room') pickSel(null); }
    if (e.target.id === 'spDrawLine') { pop.hidden = true; startRoomDraw(); } if (e.target.id === 'spAuto') { pop.hidden = true; spAutoAll(); } });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !e.target.closest('#selPop') && !e.target.closest('[data-tool="select"]')) pop.hidden = true; }, true);
  window.addEventListener('resize', () => { if (!pop.hidden) place(); });
} }
function spAutoAll() { // 벽으로 닫힌 곳을 모두 공간으로
  const b = bounds(); if (b[2] - b[0] < 500) { toast('먼저 벽을 그려 주세요'); return; } let n = 0, step = Math.max(400, Math.min(b[2] - b[0], b[3] - b[1]) / 12);
  for (let y = b[1] + step / 2; y < b[3]; y += step) for (let x = b[0] + step / 2; x < b[2]; x += step) { if (rooms().some((r) => pointInPoly(x, y, r.pts))) continue; const pts = detectRoom(x, y); if (!pts) continue; makeRoomQuiet(pts); n++; if (n > 40) break; }
  commit(); dirty3d = true; draw2d(); renderLevels(); toast(n ? `닫힌 공간 ${n}곳을 찾았어요 · 눌러서 종류(주방 · 홀 …)를 정하세요 · 층 메뉴에서 공간별로 이동할 수 있어요` : '새로 찾은 닫힌 공간이 없어요');
}
// 2D: 공간 모드에서 누르기 · 끌기
cv.addEventListener('pointerdown', (e) => {
  if (SELMODE !== 'space' || tool !== 'select' || e.button !== 0 || e.ctrlKey || e.metaKey || SLOPEPICK || SLOPEPICK2 || ROOMDRAW) return;
  if (SPDRAG && SPDRAG.pid !== e.pointerId) { SPDRAG = null; draw2d(); return; } // 두 손가락 → 앱에 맡기기
  e.stopImmediatePropagation(); const r = cv.getBoundingClientRect(), [wx, wy] = toW(e.clientX - r.left, e.clientY - r.top); SPDRAG = { pid: e.pointerId, x0: wx, y0: wy, x1: wx, y1: wy, sx: e.clientX, sy: e.clientY, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
}, true);
cv.addEventListener('pointermove', (e) => { if (!SPDRAG || SPDRAG.pid !== e.pointerId) return; e.stopImmediatePropagation(); const r = cv.getBoundingClientRect(), [wx, wy] = toW(e.clientX - r.left, e.clientY - r.top); SPDRAG.x1 = wx; SPDRAG.y1 = wy; if (Math.hypot(e.clientX - SPDRAG.sx, e.clientY - SPDRAG.sy) > 6) SPDRAG.moved = true; draw2d(); }, true);
cv.addEventListener('pointerup', (e) => { if (!SPDRAG || SPDRAG.pid !== e.pointerId) return; e.stopImmediatePropagation(); const d = SPDRAG; SPDRAG = null;
  if (d.moved) { const s = (v) => snapGrid(v), x0 = s(Math.min(d.x0, d.x1)), x1 = s(Math.max(d.x0, d.x1)), y0 = s(Math.min(d.y0, d.y1)), y1 = s(Math.max(d.y0, d.y1)); if ((x1 - x0) * (y1 - y0) < 300000) { toast('공간이 너무 작아요'); draw2d(); return; }
    const r = makeRoomQuiet([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]); commit(); dirty3d = true; pickSel({ kind: 'room', id: r.id }); draw2d(); toast(`"${r.name}" 공간을 만들었어요 · 상세에서 종류 · 구배 · 바닥 높이를 정하세요`); return; }
  const r = roomForPoint(d.x0, d.y0); if (!r) { pickSel(null); toast('벽으로 닫힌 공간이 아니에요 · 끌어서 사각형으로 정하거나 선으로 그려 주세요'); draw2d(); return; }
  commit(); dirty3d = true; pickSel({ kind: 'room', id: r.id }); draw2d(); }, true);
// 3D: 공간 모드에서 누르면 그 자리 공간
{ let dn = null; gc.addEventListener('pointerdown', (e) => { dn = SELMODE === 'space' && tool === 'select' && e.button === 0 && !DE ? [e.clientX, e.clientY] : null; }, true);
  gc.addEventListener('pointerup', (e) => { if (!dn || Math.hypot(e.clientX - dn[0], e.clientY - dn[1]) > 5 || SLOPEPICK || SLOPEPICK2) { dn = null; return; } dn = null; const g = planeHit(e, 0); if (!g) return;
    setTimeout(() => { const r = roomForPoint(g[0], g[1]); if (!r) return; commit(); dirty3d = true; pickSel({ kind: 'room', id: r.id }); draw2d(); }, 0); }, true); }
// 층 메뉴: 공간 찾기 버튼 · 종류 표시
{ const _rl = renderLevels; renderLevels = function () { _rl(); try { const sub = $('#lvlMenu .lvsub'); if (sub && !$('#lvAutoSp')) sub.insertAdjacentHTML('beforeend', '<button class="btn" id="lvAutoSp" style="margin-top:4px">벽 따라 공간 찾기</button>'); } catch (e) {} }; }
$('#lvlMenu').addEventListener('click', (e) => { if (e.target.id === 'lvAutoSp') { e.stopPropagation(); $('#lvlMenu').hidden = true; spAutoAll(); } });

{ const st = document.createElement('style'); st.textContent = `.selpop{position:fixed;z-index:80;width:250px;background:var(--solid,var(--chrome));color:var(--fg);border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.25),inset 0 0 0 1px var(--line);padding:10px;display:flex;flex-direction:column;gap:8px;font-size:13px;animation:selin .16s ease-out}
  @keyframes selin{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
  .selpop .seg{display:flex;gap:2px;background:var(--fill);border-radius:9px;padding:2px}.selpop .seg button{flex:1;border:0;background:transparent;border-radius:7px;padding:7px;color:var(--fg);font-weight:600}
  .selpop .seg button[aria-pressed=true]{background:var(--accent);color:var(--on-accent,#fff)}.selpop .row{display:flex;gap:6px;flex-wrap:wrap}.selpop .hint{margin:0}
  [data-tool="select"].spmode{box-shadow:inset 0 0 0 2px var(--accent)}
  .fillrows{display:flex;flex-direction:column;gap:4px}.fillrow{display:flex;align-items:center;gap:4px;min-width:0}.fillrow i{width:12px;height:22px;border-radius:3px;flex:0 0 auto;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}
  .fillrow select{flex:1;min-width:0}.fillrow input{width:64px}.fillrow span{font-size:11px;color:var(--muted)}
  .splay{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 8px}.flbox{display:flex;flex-direction:column;gap:6px;margin:8px 0}`; document.head.appendChild(st); }
