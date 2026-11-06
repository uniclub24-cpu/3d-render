/* ================================================================
   v18 · 텍스처 입히기(실사 렌더에서 눌러 입히기 · 사진 텍스처) · 단면 보기 · 계단
         줄자(상단 뱃지) · 치수 표시(2D/3D · 투명도 · 위치) · 단축키(Ctrl+B→W, Ctrl+R, T)
         DXF 블록 내보내기 · 3D 블록(SketchUp DAE · OBJ · 텍스처) 내보내기
   ================================================================ */
(function v18css() {
  const st = document.createElement('style');
  st.textContent = `
.tapeb{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border:0;border-radius:13px;background:var(--fill);color:var(--fg);font:600 12px system-ui;cursor:pointer;white-space:nowrap}
.tapeb[aria-pressed="true"]{background:#ff6b00;color:#fff}
.tapeb.sm{padding:0 7px;margin-left:-4px;border-radius:0 13px 13px 0}
.tapeb.main{border-radius:13px 0 0 13px}
.pop16{position:fixed;z-index:60;min-width:250px;max-width:320px;padding:12px;border-radius:14px;background:var(--panel,#fff);color:var(--fg);box-shadow:0 10px 40px rgba(0,0,0,.25),0 0 0 .5px var(--line);font:13px system-ui}
.pop16 h4{margin:0 0 8px;font-size:13px}
.pop16 .r{display:flex;align-items:center;gap:8px;margin:6px 0}
.pop16 .r>span{flex:1}
.pop16 input[type=range]{width:110px}
.pop16 .seg2{display:flex;gap:4px;flex-wrap:wrap}
.pop16 .seg2 button{border:0;border-radius:8px;padding:5px 8px;background:var(--fill);color:var(--fg);font:12px system-ui;cursor:pointer}
.pop16 .seg2 button.on{background:var(--accent);color:var(--on-accent,#fff)}
.pop16 .dl{max-height:150px;overflow:auto;margin:6px 0;border-top:.5px solid var(--line)}
.pop16 .dl div{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px}
.pop16 .dl button,.pop16 .lnk{border:0;background:none;color:var(--accent);cursor:pointer;font:12px system-ui;padding:2px 4px}
.pop16 .keys16{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px}
.pop16 kbd{font:11px ui-monospace,monospace;background:var(--fill);border-radius:5px;padding:1px 5px;white-space:nowrap}
#helpBtn.v18{width:22px;height:22px;min-width:22px;border-radius:11px;font:700 12px system-ui;padding:0;background:var(--fill)}
.txbox{margin:10px 0;padding:10px;border-radius:12px;background:var(--fill)}
.txgrid{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;max-height:150px;overflow:auto}
.txgrid button{display:flex;flex-direction:column;align-items:center;gap:2px;width:64px;border:2px solid transparent;border-radius:9px;background:none;color:var(--fg);font:11px system-ui;cursor:pointer;padding:2px}
.txgrid button.on{border-color:var(--accent)}
.txgrid img{width:56px;height:40px;object-fit:cover;border-radius:6px;background:#ccc}
.hqprev.picking{cursor:crosshair;outline:2px solid #ff6b00}
.sec16{display:flex;flex-direction:column;gap:6px}
@media (max-width:1400px) and (min-width:700px){.tapeb .tl{display:none}.tapeb.main{padding:0 7px}.tapeb.sm{padding:0 5px}}
@media (max-width:1366px) and (min-width:700px){#saveState{display:none}}
`;
  document.head.appendChild(st);
})();

/* ---------- 공통 ---------- */
const V18 = { qw: store.get('drs_qw', null) };
const dimCfg = () => (P.dimCfg = Object.assign({ s2: true, s3: true, o2: 1, o3: 0.85, place: 'line' }, P.dimCfg || {}));
function pop16(id, anchor, html) {
  let el = $('#' + id); if (!el) { el = document.createElement('div'); el.id = id; el.className = 'pop16'; el.hidden = true; document.body.appendChild(el); }
  if (html != null) el.innerHTML = html;
  if (anchor) { const r = anchor.getBoundingClientRect(); el.hidden = false; const w = el.offsetWidth || 260; el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px'; el.style.top = (r.bottom + 6) + 'px'; }
  return el;
}
document.addEventListener('pointerdown', (e) => { for (const p of $$('.pop16')) { if (p.hidden || p.contains(e.target)) continue; const a = p.dataset.anchor && document.getElementById(p.dataset.anchor); if (a && a.contains(e.target)) continue; p.hidden = true; } });
if (!LEVEL_KEYS.includes('dims')) LEVEL_KEYS.push('dims');
{ const _op = openProject; openProject = function (p) { _op(p); P.dims = P.dims || []; P.textures = P.textures || []; texRegAll(); }; }
{ const _sw = switchLevel; switchLevel = function (id) { _sw(id); P.dims = P.dims || []; }; }

/* ================================================================
   1. 텍스처 — 기본 재질 + 사진 텍스처 (실제 크기 mm), 실사 렌더 화면에서 눌러 입히기
   ================================================================ */
const TEXCV = {};
const isUx = (k) => typeof k === 'string' && k.startsWith('ux_');
function texLibAll() { const g = store.get('drs_tex', []), out = [...(P && P.textures) || []]; for (const t of g) if (!out.find((x) => x.id === t.id)) out.push(t); return out; }
function texReg(t) {
  const k = 'ux_' + t.id; if (MATS[k] && (tex[k] || !gl)) return Promise.resolve(k);
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(im, 0, 0, 512, 512); TEXCV[k] = c;
      if (gl) { const g = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); tex[k] = g; }
      MATS[k] = { n: '사진 · ' + t.name, tex: k }; matOpts[k] = MATS[k].n; TILE[k] = t.size || 600; dirty3d = true; need3d = true; res(k);
    };
    im.onerror = () => res(null); im.src = t.src;
  });
}
function texRegAll() { if (!P) return; return Promise.all(texLibAll().map(texReg)).then(() => { dirty3d = true; need3d = true; if (typeof renderProps === 'function') try { renderProps(); } catch (e) {} }); }
function texAdd(file, name, size) {
  return new Promise((res, rej) => {
    const fr = new FileReader(); fr.onerror = rej;
    fr.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
      const c = document.createElement('canvas'), s = Math.min(512, Math.max(im.width, im.height)); c.width = c.height = 512; c.getContext('2d').drawImage(im, 0, 0, 512, 512);
      const t = { id: uid('t'), name: (name || file.name.replace(/\.[^.]+$/, '')).slice(0, 20), src: c.toDataURL('image/jpeg', 0.84), size: Math.max(50, +size || 600) };
      P.textures = P.textures || []; P.textures.push(t); const g = store.get('drs_tex', []); g.unshift(t); store.set('drs_tex', g.slice(0, 40)); texReg(t).then(() => res(t)); }; im.src = fr.result; };
    fr.readAsDataURL(file);
  });
}
// 기본 재질 텍스처를 그림으로 (읽어서 미리보기 · 내보내기에 씀)
function texCanvas(key) {
  if (TEXCV[key]) return TEXCV[key]; const t = tex[key]; if (!t || !gl) return null;
  const n = 256, fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
  const px = new Uint8Array(n * n * 4); let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; if (ok) gl.readPixels(0, 0, n, n, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); if (!ok) return null;
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), id = g.createImageData(n, n); id.data.set(px); for (let i = 3; i < id.data.length; i += 4) id.data[i] = 255; g.putImageData(id, 0, 0);
  return (TEXCV[key] = c);
}
const TXTHUMB = {};
const TXBASE = { wood: '#b48a62', filmwood: '#a87b55', plywood: '#e2cfa8', marble: '#f2f1ee', steel: '#c9ced4', tile: '#eeeeee', brick: '#b5654a', epoxy: '#c9c3b8', concrete: '#a9a9a4', turf: '#5d8f4e', plastic: '#e8e8e8', frosted: '#dfe9ee', glass: '#bfe3f5', paint: '#ece8e1' };
function texThumb(matKey) {
  if (TXTHUMB[matKey]) return TXTHUMB[matKey]; const tk = MATS[matKey] ? MATS[matKey].tex : matKey, c = texCanvas(tk), o = document.createElement('canvas'); o.width = 112; o.height = 80; const g = o.getContext('2d');
  const base = TXBASE[matKey] || '#ececec';
  g.fillStyle = isUx(matKey) ? '#fff' : base; g.fillRect(0, 0, 112, 80); if (c) { g.globalCompositeOperation = 'multiply'; g.drawImage(c, 0, 0, 112, 80); g.globalCompositeOperation = 'source-over'; }
  return (TXTHUMB[matKey] = o.toDataURL('image/jpeg', .8));
}
const TX = { cur: 'wood', pick: false };
function texApply(h, key) {
  if (!h || !h.sel) return false; const s = h.sel, ux = isUx(key), bc = ux ? '#ffffff' : TXBASE[key]; // 텍스처는 제 색으로 (사진은 흰색 = 원래 색)
  if (s.kind === 'item') { const it = itemOf(s.id); if (!it) return false; const L = libGet(it.type);
    if (L.shape === 'zone') it.finish = { type: key, color: bc || (it.finish && it.finish.color) || spec(it).color }; else { it.mat = key; if (bc) it.color = bc; } }
  else if (s.kind === 'wall') { const w = wallOf(s.id); if (!w) return false; w.finish = { type: key, color: bc || (w.finish && w.finish.color) || '#ece8e1' }; }
  else if (s.kind === 'floor') { P.floor = { ...(P.floor || {}), type: key, color: bc || (P.floor && P.floor.color) || '#c9c3b8' }; }
  else return false;
  if (ux) { const t = texLibAll().find((x) => 'ux_' + x.id === key); if (t && !P.textures.find((x) => x.id === t.id)) P.textures.push(t); }
  commit(); dirty3d = true; return true;
}
function texGridHtml() {
  const pre = ['wood', 'filmwood', 'plywood', 'marble', 'tile', 'brick', 'concrete', 'epoxy', 'steel', 'plastic', 'turf', 'frosted', 'paint'];
  const items = pre.filter((k) => MATS[k]).map((k) => [k, MATS[k].n]).concat(texLibAll().map((t) => ['ux_' + t.id, t.name]));
  return items.map(([k, n]) => `<button data-tx="${k}" class="${k === TX.cur ? 'on' : ''}" title="${esc(n)}"><img alt="" src="${texThumb(k)}"><span>${esc(n.replace('사진 · ', ''))}</span></button>`).join('');
}
// 실사 렌더 창: 텍스처 입히기 칸
(function hqTexUi() {
  const pv = $('#hqPrev'); if (!pv) return;
  pv.insertAdjacentHTML('afterend', `<div class="txbox" id="txBox">
    <div class="row wrap" style="align-items:center;gap:10px"><b style="flex:1">텍스처 입히기</b>
      <label class="chk"><input type="checkbox" id="txPick"> 렌더 화면을 눌러 입히기</label></div>
    <div class="txgrid" id="txGrid"></div>
    <div class="row wrap" style="align-items:center;gap:8px">
      <label class="btn">사진으로 텍스처 만들기<input type="file" id="txFile" accept="image/*" hidden></label>
      <label class="fld" style="flex-direction:row;align-items:center;gap:6px"><span>실제 크기</span><input id="txSize" type="number" value="600" min="50" step="50" style="width:80px"> mm</label>
      <span class="hint" id="txMsg">재질을 고르고 위 렌더 화면에서 벽 · 바닥 · 기물을 누르세요</span></div></div>`);
  const grid = $('#txGrid'), msg = $('#txMsg');
  const draw = () => (grid.innerHTML = texGridHtml());
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-tx]'); if (!b) return; TX.cur = b.dataset.tx; draw(); if (!$('#txPick').checked) { $('#txPick').checked = true; pv.classList.add('picking'); } msg.textContent = `${MATS[TX.cur] ? MATS[TX.cur].n : ''} · 렌더 화면에서 입힐 곳을 누르세요`; });
  $('#txPick').onchange = (e) => { TX.pick = e.target.checked; pv.classList.toggle('picking', TX.pick); };
  $('#txFile').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; msg.textContent = '사진을 텍스처로 만드는 중…'; try { const t = await texAdd(f, '', $('#txSize').value); TX.cur = 'ux_' + t.id; draw(); $('#txPick').checked = true; TX.pick = true; pv.classList.add('picking'); msg.textContent = `"${t.name}" 텍스처를 만들었어요 (${t.size}mm 반복) · 렌더 화면에서 입힐 곳을 누르세요`; } catch (er) { msg.textContent = '사진을 읽지 못했어요'; } e.target.value = ''; };
  pv.addEventListener('click', async (e) => {
    if (!$('#txPick').checked) return; const r = pv.getBoundingClientRect(), C = hqCam($('#hqScene').value); C.cut = $('#hqCut').checked;
    const nx = (e.clientX - r.left) / r.width * 2 - 1, ny = 1 - (e.clientY - r.top) / r.height * 2, h = pickCam(C, nx, ny, pv.width / pv.height);
    if (!h || !texApply(h, TX.cur)) { msg.textContent = '여기에는 입힐 수 없어요 (벽 · 바닥 · 기물을 눌러 주세요)'; return; }
    const what = h.sel.kind === 'wall' ? '벽' : h.sel.kind === 'floor' ? '바닥' : (spec(itemOf(h.sel.id)).name || '기물');
    msg.textContent = `${what}에 ${MATS[TX.cur].n} 입힘 · 미리보기 다시 계산 중…`; await hqQuick(C); msg.textContent = `${what}에 ${MATS[TX.cur].n} 입혔어요 · Ctrl+Z로 되돌리기 · "렌더 시작"으로 고화질`;
  });
  const _o = openHQ; openHQ = function () { _o(); texRegAll(); setTimeout(draw, 30); };
})();
// 카메라 C 에서 화면 좌표(-1~1)로 광선을 쏴서 맞은 곳
function pickCam(C, nx, ny, asp) {
  const E = eye(C), T = [C.tx, C.ty, C.tz]; let f = [T[0] - E[0], T[1] - E[1], T[2] - E[2]]; const fl = Math.hypot(...f); f = f.map((v) => v / fl);
  let rt = [-f[2], 0, f[0]]; const rl = Math.hypot(...rt) || 1; rt = rt.map((v) => v / rl);
  const up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]], th = Math.tan((C.fov || cam.fov || 50) * Math.PI / 360);
  const D = [0, 1, 2].map((i) => f[i] + rt[i] * nx * th * asp + up[i] * ny * th), keep = rayOf, kc = cam.cut;
  rayOf = () => ({ E, D }); cam.cut = !!C.cut; try { return rayHit({}); } finally { rayOf = keep; cam.cut = kc; }
}
async function hqQuick(C) {
  if (hqBusy) return; hqBusy = true; const pv = $('#hqPrev'), keep = cam.cut; cam.cut = !!C.cut; dirty3d = true;
  try { const W = 960, H = Math.round(960 * pv.height / pv.width); const out = await hqRender({ W, H, N: 6, C, tm: $('#hqTime').value }, null); pv.getContext('2d').drawImage(out, 0, 0, pv.width, pv.height); }
  catch (e) { console.error(e); } finally { cam.cut = keep; dirty3d = true; hqBusy = false; }
}

/* ================================================================
   2. 단면 보기 — X(세로) · Z(가로) · 높이(평면) 자르기
   ================================================================ */
const SEC = { on: false, axis: 'y', pos: 1200, flip: false };
function secPlane() {
  if (!SEC.on || !P) return null; const s = SEC.flip ? -1 : 1, ax = SEC.axis, pos = SEC.pos + (ax === 'y' ? curElev() : 0);
  return [ax === 'x' ? s : 0, ax === 'y' ? s : 0, ax === 'z' ? s : 0, s * pos];
}
function setClipU(pr) { if (!gl || !pr) return; gl.useProgram(pr); const c = secPlane(); gl.uniform4f(gl.getUniformLocation(pr, 'CLP'), ...(c || [0, 0, 0, 0])); gl.uniform1f(gl.getUniformLocation(pr, 'CLON'), c ? 1 : 0); }
{ const _dg = drawGL; drawGL = function (W, H, C) { if (prog) setClipU(prog); return _dg(W, H, C); }; }
{ const _hr = hqRender; hqRender = async function (o, onp) { const p0 = hqInit(); setClipU(p0.S); setClipU(p0.M); return _hr(o, onp); }; }
{ const _rh = rayHit; rayHit = function (e) {
  const c = secPlane(); if (!c) return _rh(e); const out = (x, y, z) => c[0] * x + c[1] * (y + curElev()) + c[2] * z > c[3];
  const ki = P.items, kw = P.walls; P.items = ki.filter((it) => !out(it.x, zOf(it), it.y)); P.walls = kw.filter((w) => !(out(w.x1, 0, w.y1) && out(w.x2, 0, w.y2)));
  try { const h = _rh(e); if (h && h.p && out(h.p[0], h.p[1], h.p[2]) && h.sel.kind === 'floor') return null; return h; } finally { P.items = ki; P.walls = kw; } }; }
function secRange() { const b = bounds(); return SEC.axis === 'x' ? [b[0] - 200, b[2] + 200] : SEC.axis === 'z' ? [b[1] - 200, b[3] + 200] : [0, Math.max(P.slabH || 3300, ...P.walls.map(wallH))]; }
(function secUi() {
  const hb = $('#hqBtn'); if (!hb) return;
  hb.insertAdjacentHTML('afterend', `<button class="tg" id="secBtn" aria-pressed="false" title="단면 보기"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M3 12h18" stroke-dasharray="2 2"/></svg><span>단면</span></button>`);
  const b = $('#secBtn');
  const draw = () => {
    const [lo, hi] = secRange(); SEC.pos = clamp(SEC.pos, lo, hi);
    const el = pop16('secPop', null, `<h4>단면 보기</h4><div class="sec16">
      <div class="seg2">${[['off', '끄기'], ['y', '높이 (평면)'], ['x', '세로 (좌우)'], ['z', '가로 (앞뒤)']].map(([k, n]) => `<button data-sa="${k}" class="${(k === 'off' ? !SEC.on : SEC.on && SEC.axis === k) ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="r"><span>자르는 위치 <b id="secV">${Math.round(SEC.pos)}</b> mm</span></div>
      <input type="range" id="secPos" min="${Math.round(lo)}" max="${Math.round(hi)}" step="10" value="${Math.round(SEC.pos)}" ${SEC.on ? '' : 'disabled'} style="width:100%">
      <label class="chk"><input type="checkbox" id="secFlip" ${SEC.flip ? 'checked' : ''}> 반대쪽 남기기</label>
      <p class="hint" style="margin:0">잘린 곳은 실사 렌더에도 그대로 반영돼요</p></div>`);
    el.dataset.anchor = 'secBtn';
  };
  const apply = () => { b.setAttribute('aria-pressed', SEC.on); dirty3d = true; need3d = true; draw2d(); };
  b.onclick = (e) => { e.stopPropagation(); const el = $('#secPop'); if (el && !el.hidden) { el.hidden = true; return; } draw(); pop16('secPop', b); };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-sa]'); if (a) { const k = a.dataset.sa; if (k === 'off') SEC.on = false; else { if (!SEC.on || SEC.axis !== k) { SEC.axis = k; const [lo, hi] = secRange(); SEC.pos = k === 'y' ? 1200 : (lo + hi) / 2; } SEC.on = true; } draw(); apply(); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'secPos') { SEC.pos = +e.target.value; $('#secV').textContent = SEC.pos; apply(); } });
  document.addEventListener('change', (e) => { if (e.target.id === 'secFlip') { SEC.flip = e.target.checked; apply(); } });
})();
// 평면도에 단면선 표시
function drawSec2d() {
  if (!SEC.on || SEC.axis === 'y') return; const b = bounds(), m = 600, red = '#ff3b30';
  const [a, c] = SEC.axis === 'x' ? [[SEC.pos, b[1] - m], [SEC.pos, b[3] + m]] : [[b[0] - m, SEC.pos], [b[2] + m, SEC.pos]];
  const A = toS(...a), Cc = toS(...c); cx.save(); cx.strokeStyle = red; cx.lineWidth = 1.5; cx.setLineDash([10, 4, 2, 4]); cx.beginPath(); cx.moveTo(...A); cx.lineTo(...Cc); cx.stroke(); cx.setLineDash([]);
  cx.fillStyle = red; cx.font = '700 12px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('A', A[0], A[1] - 10); cx.fillText('A\'', Cc[0], Cc[1] + 10); cx.restore();
}

/* ================================================================
   3. 계단
   ================================================================ */
LIB.push(
  { id: 'stairs', name: '계단 (직선 · 반층)', cat: '인테리어', shape: 'stairs', w: 1000, d: 2800, h: 1650, layer: 'floor', color: '#b48a62', mat: 'wood' },
  { id: 'stairs_full', name: '계단 (직선 · 한 층)', cat: '인테리어', shape: 'stairs', w: 1200, d: 5200, h: 3300, layer: 'floor', color: '#c9c3b8', mat: 'concrete' },
  { id: 'steps3', name: '단차 계단 (3단)', cat: '인테리어', shape: 'stairs', w: 1200, d: 900, h: 450, layer: 'floor', color: '#b48a62', mat: 'wood' }
);
const stairN = (it) => Math.max(2, Math.round(spec(it).h / 170));
{ const _bi = buildItem; buildItem = function (it) {
  const s = spec(it); if (s.L.shape !== 'stairs') return _bi(it);
  const w = it.w, d = it.d, h = s.h, e = zOf(it), hw = w / 2, hd = d / 2, T = xf(it.x, it.y, (it.rot || 0) * Math.PI / 180), mk = MATS[s.mat].tex, n = stairN(it), rz = h / n, tr = d / n;
  for (let i = 0; i < n; i++) { box(T, -hw, hw, e + i * rz, e + (i + 1) * rz, hd - (i + 1) * tr, hd - i * tr, s.color, mk); box(T, -hw, hw, e + (i + 1) * rz - 1, e + (i + 1) * rz + 3, hd - i * tr - 45, hd - i * tr + 2, '#3a3e44'); }
  for (let i = 0; i < n - 1; i++) box(T, -hw, hw, e, e + (i + 1) * rz, hd - (i + 2) * tr, hd - (i + 1) * tr, s.color, mk); // 아래를 채워 통계단
  if (h > 500) { const x = hw - 40, rail = 900, p0 = T.P(x, e + rz + rail, hd - tr / 2), p1 = T.P(x, e + h + rail, -hd + tr / 2), yo = YOFF;
    beam([p0[0], p0[1] - yo, p0[2]], [p1[0], p1[1] - yo, p1[2]], 22, '#2b2d31');
    for (const k of [0, 1]) { const zz = k ? -hd + tr / 2 : hd - tr / 2, yb = k ? e + h : e + rz; box(T, x - 15, x + 15, yb, yb + rail, zz - 15, zz + 15, '#2b2d31'); } }
}; }
{ const _sy = symbol; symbol = function (it, s) {
  if (s.L.shape !== 'stairs') return _sy(it, s);
  const hw = it.w / 2, hd = it.d / 2, n = stairN(it), tr = it.d / n; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 1;
  const ln = (a, b, c2, d2) => { cx.beginPath(); cx.moveTo(...lp(it, a, b)); cx.lineTo(...lp(it, c2, d2)); cx.stroke(); };
  for (let i = 1; i < n; i++) ln(-hw, hd - i * tr, hw, hd - i * tr);
  ln(0, hd - tr * .5, 0, -hd + tr * .6); ln(0, -hd + tr * .6, -Math.min(120, hw * .3), -hd + tr * .6 + 180); ln(0, -hd + tr * .6, Math.min(120, hw * .3), -hd + tr * .6 + 180);
  const [px, py] = lp(it, 0, hd - tr * .5); cx.fillStyle = 'rgba(0,0,0,.7)'; cx.font = '700 10px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'top'; cx.fillText('UP', px, py + 2);
}; }
try { renderLib(); } catch (e) {}

/* ================================================================
   4. 줄자 · 치수 (2D · 3D)
   ================================================================ */
const TAPE = { on: false, a: null, hover: null, view: null };
const DIMC = '#ff6b00';
function dimLen(d) { return Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1], (d.b[2] || 0) - (d.a[2] || 0)); }
const fmtMm = (v) => Math.round(v).toLocaleString('ko-KR');
// 표시 위치: line(잰 자리) · outside(외벽 바깥) · below(벽면 아래)
function dimGeom(d) {
  const pl = d.place || dimCfg().place, a = d.a.slice(), b = d.b.slice(); a[2] = a[2] || 0; b[2] = b[2] || 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (pl === 'line' || L < 1) return { a, b, ea: null, eb: null, pl };
  const ux = dx / L, uy = dy / L; let nx = -uy, ny = ux; const bb = bounds(), cxm = (bb[0] + bb[2]) / 2, cym = (bb[1] + bb[3]) / 2, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if (nx * (mx - cxm) + ny * (my - cym) < 0) { nx = -nx; ny = -ny; }
  if (pl === 'outside') {
    const ex = (v, d0, lo, hi) => (d0 > 1e-6 ? (hi - v) / d0 : d0 < -1e-6 ? (lo - v) / d0 : 1e9), t = Math.max(0, Math.min(ex(mx, nx, bb[0], bb[2]), ex(my, ny, bb[1], bb[3]))), off = t + (P.wallT || 150) / 2 + 450;
    const A = [a[0] + nx * off, a[1] + ny * off, 0], B = [b[0] + nx * off, b[1] + ny * off, 0]; return { a: A, b: B, ea: [[a[0], a[1], 0], A], eb: [[b[0], b[1], 0], B], pl };
  }
  // below: 벽면 바로 아래 (안쪽으로 살짝, 바닥 가까이)
  const off = -160, A = [a[0] + nx * off, a[1] + ny * off, 60], B = [b[0] + nx * off, b[1] + ny * off, 60]; return { a: A, b: B, ea: null, eb: null, pl };
}
function dimLine2d(A, B, text, alpha, live) {
  const sa = toS(A[0], A[1]), sb = toS(B[0], B[1]), ang = Math.atan2(sb[1] - sa[1], sb[0] - sa[0]); if (Math.hypot(sb[0] - sa[0], sb[1] - sa[1]) < 2) return;
  cx.save(); cx.globalAlpha = alpha; cx.strokeStyle = DIMC; cx.fillStyle = DIMC; cx.lineWidth = 1; if (live) cx.setLineDash([5, 3]);
  cx.beginPath(); cx.moveTo(...sa); cx.lineTo(...sb); cx.stroke(); cx.setLineDash([]);
  for (const p of [sa, sb]) { cx.beginPath(); cx.moveTo(p[0] - 4 * Math.cos(ang + .785), p[1] - 4 * Math.sin(ang + .785)); cx.lineTo(p[0] + 4 * Math.cos(ang + .785), p[1] + 4 * Math.sin(ang + .785)); cx.lineWidth = 1.6; cx.stroke(); }
  let ta = ang; if (ta > Math.PI / 2 || ta < -Math.PI / 2) ta += Math.PI;
  cx.translate((sa[0] + sb[0]) / 2, (sa[1] + sb[1]) / 2); cx.rotate(ta); cx.font = '600 10px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'bottom';
  const tw = cx.measureText(text).width; cx.globalAlpha = alpha * .85; cx.fillStyle = OFF ? '#fff' : getCss('--canvas'); cx.fillRect(-tw / 2 - 2, -13, tw + 4, 11); cx.globalAlpha = alpha; cx.fillStyle = DIMC; cx.fillText(text, 0, -2.5); cx.restore();
}
function drawDims2d() {
  if (!P) return; const cf = dimCfg();
  if (cf.s2) for (const d of P.dims || []) { const g = dimGeom(d), t = fmtMm(dimLen(d));
    cx.save(); cx.globalAlpha = cf.o2 * .7; cx.strokeStyle = DIMC; cx.lineWidth = .8; cx.setLineDash([2, 2]); for (const e of [g.ea, g.eb]) if (e) { cx.beginPath(); cx.moveTo(...toS(e[0][0], e[0][1])); cx.lineTo(...toS(e[1][0], e[1][1])); cx.stroke(); } cx.restore();
    dimLine2d(g.a, g.b, t, cf.o2); }
  if (!OFF && TAPE.on && TAPE.a && TAPE.hover && TAPE.view === '2d') dimLine2d(TAPE.a, TAPE.hover, fmtMm(Math.hypot(TAPE.hover[0] - TAPE.a[0], TAPE.hover[1] - TAPE.a[1])), 1, true);
  if (!OFF && TAPE.on && TAPE.view === '2d') for (const p of [TAPE.a, TAPE.hover]) if (p) { const s = toS(p[0], p[1]); cx.save(); cx.strokeStyle = DIMC; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(s[0], s[1], 5, 0, 7); cx.stroke(); cx.restore(); }
}
{ const _d2 = draw2d; draw2d = function () { _d2(); if (P && (OFF || view !== '3d')) { drawSec2d(); drawDims2d(); } }; }
function drawDims3d() {
  if (!P || !lastM) return; const c = $('#ov3c'); if (!c) return; const r = gc.getBoundingClientRect(); if (!r.width) return; const d = Math.min(2, window.devicePixelRatio || 1), g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  const cf = dimCfg(), EL = curElev(), W3 = (p) => proj(lastM, [p[0], (p[2] || 0) + EL, p[1]], r);
  const seg = (A, B, text, alpha, live) => {
    const sa = W3(A), sb = W3(B); if (!sa || !sb) return; g.save(); g.globalAlpha = alpha; g.strokeStyle = DIMC; g.fillStyle = DIMC; g.lineWidth = 1.5; if (live) g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(...sa); g.lineTo(...sb); g.stroke(); g.setLineDash([]); for (const p of [sa, sb]) { g.beginPath(); g.arc(p[0], p[1], 2.5, 0, 7); g.fill(); }
    if (text) { const mx = (sa[0] + sb[0]) / 2, my = (sa[1] + sb[1]) / 2; g.font = '600 11px system-ui'; const tw = g.measureText(text).width; g.globalAlpha = alpha * .85; g.fillStyle = 'rgba(20,20,22,.78)'; g.beginPath(); g.roundRect ? g.roundRect(mx - tw / 2 - 5, my - 9, tw + 10, 17, 8) : g.rect(mx - tw / 2 - 5, my - 9, tw + 10, 17); g.fill(); g.globalAlpha = alpha; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, mx, my + .5); }
    g.restore();
  };
  if (cf.s3) for (const dd of P.dims || []) { const gm = dimGeom(dd); for (const e of [gm.ea, gm.eb]) if (e) seg(e[0], e[1], '', cf.o3 * .6); seg(gm.a, gm.b, fmtMm(dimLen(dd)), cf.o3); }
  if (TAPE.on && TAPE.view === '3d' && TAPE.a) seg(TAPE.a, TAPE.hover || TAPE.a, TAPE.hover ? fmtMm(Math.hypot(TAPE.hover[0] - TAPE.a[0], TAPE.hover[1] - TAPE.a[1], TAPE.hover[2] - TAPE.a[2])) : '', 1, true);
}
{ const _do = drawOverlay; drawOverlay = function () { _do(); try { drawDims3d(); } catch (e) {} }; }
// 2D 스냅: 벽 끝 · 벽 면 모서리 · 기물 모서리 · 벽 면 위
function tapeSnap2d(wx, wy, shift) {
  const tol = 14 / V.s; let best = null, bd = tol; const tryP = (x, y) => { const dd = Math.hypot(x - wx, y - wy); if (dd < bd) { bd = dd; best = [x, y]; } };
  for (const w of P.walls) { tryP(w.x1, w.y1); tryP(w.x2, w.y2); for (const q of wallRect(w)) tryP(q[0], q[1]); }
  for (const it of P.items) if (!it.hidden && physical(it)) for (const q of corners(it)) tryP(q[0], q[1]);
  if (!best) { let bf = 8 / V.s; for (const w of P.walls) { const r = wallRect(w); for (const [p, q] of [[r[0], r[1]], [r[2], r[3]]]) { const [dd, t] = distPtSeg(wx, wy, { x1: p[0], y1: p[1], x2: q[0], y2: q[1] }); if (dd < bf) { bf = dd; best = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; } } } }
  let p = best || [Math.round(wx / 10) * 10, Math.round(wy / 10) * 10];
  if (shift && TAPE.a) p = Math.abs(p[0] - TAPE.a[0]) > Math.abs(p[1] - TAPE.a[1]) ? [p[0], TAPE.a[1]] : [TAPE.a[0], p[1]];
  return [Math.round(p[0]), Math.round(p[1]), 0];
}
function tape3dPoint(e) { const h = rayHit(e); if (!h || !h.p) return null; return [Math.round(h.p[0]), Math.round(h.p[2]), Math.max(0, Math.round(h.p[1]))]; }
function setTape(on) {
  TAPE.on = !!on; TAPE.a = TAPE.hover = null; const b = $('#tapeBtn'); if (b) b.setAttribute('aria-pressed', TAPE.on);
  cv.style.cursor = TAPE.on ? 'crosshair' : (tool === 'select' ? 'default' : 'crosshair'); gc.style.cursor = TAPE.on ? 'crosshair' : '';
  if (TAPE.on) toast('줄자: 두 점을 누르면 치수가 남아요 · Shift = 수평/수직 · Esc 끝'); draw2d(); need3d = true;
}
function tapeAdd(a, b) { if (Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)) < 5) return; P.dims = P.dims || []; P.dims.push({ id: uid('d'), a, b }); commit(); toast(`치수 ${fmtMm(dimLen(P.dims[P.dims.length - 1]))} mm`); renderTapePop(); }
document.addEventListener('pointerdown', (e) => {
  if (!TAPE.on || !P || e.button > 0) return; const in2 = e.target === cv, in3 = e.target === gc || (e.target.closest && e.target.closest('#v3d') && !e.target.closest('button,.tg,.bar,.pin,input,select'));
  if (!in2 && !in3) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  let p; if (in2) { const [sx, sy] = evPos(e), [wx, wy] = toW(sx, sy); p = tapeSnap2d(wx, wy, e.shiftKey); } else p = tape3dPoint(e);
  if (!p) return; const vw = in2 ? '2d' : '3d';
  if (!TAPE.a || TAPE.view !== vw) { TAPE.a = p; TAPE.view = vw; TAPE.hover = null; } else { tapeAdd(TAPE.a, p); TAPE.a = null; TAPE.hover = null; }
  draw2d(); need3d = true;
}, true);
document.addEventListener('pointermove', (e) => {
  if (!TAPE.on || !TAPE.a || !P) return;
  if (TAPE.view === '2d' && e.target === cv) { const [sx, sy] = evPos(e), [wx, wy] = toW(sx, sy); TAPE.hover = tapeSnap2d(wx, wy, e.shiftKey); draw2d(); }
  else if (TAPE.view === '3d' && (e.target === gc || (e.target.closest && e.target.closest('#v3d')))) { const p = tape3dPoint(e); if (p) { if (e.shiftKey) { const d0 = [Math.abs(p[0] - TAPE.a[0]), Math.abs(p[1] - TAPE.a[1]), Math.abs(p[2] - TAPE.a[2])], m = d0.indexOf(Math.max(...d0)); for (let i = 0; i < 3; i++) if (i !== m) p[i] = TAPE.a[i]; } TAPE.hover = p; need3d = true; } }
}, true);
for (const t of ['pointerup', 'click', 'dblclick']) document.addEventListener(t, (e) => { if (TAPE.on && (e.target === cv || e.target === gc)) { e.stopPropagation(); e.stopImmediatePropagation(); } }, true);
function autoWallDims() {
  const ex = exteriorWalls(); if (!ex.length) { toast('외벽을 찾지 못했어요'); return; } P.dims = P.dims || [];
  for (const w of ex) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 300) continue; if (P.dims.some((d) => d.wall === w.id)) continue; P.dims.push({ id: uid('d'), a: [w.x1, w.y1, 0], b: [w.x2, w.y2, 0], wall: w.id, place: 'outside' }); }
  commit(); renderTapePop(); toast('외벽 치수를 넣었어요');
}
function renderTapePop() {
  const el = $('#tapePop'); if (!el || el.hidden) return; const cf = dimCfg(), ds = P.dims || [];
  el.innerHTML = `<h4>줄자 · 치수</h4>
    <div class="r"><span>줄자로 재기</span><button class="tapeb" id="tpOn" aria-pressed="${TAPE.on}">${TAPE.on ? '재는 중 · 끄기' : '켜기 (T)'}</button></div>
    <div class="r"><label class="chk"><input type="checkbox" id="tpS2" ${cf.s2 ? 'checked' : ''}> 2D 치수</label><span></span><input type="range" id="tpO2" min="0.1" max="1" step="0.05" value="${cf.o2}" title="2D 투명도"></div>
    <div class="r"><label class="chk"><input type="checkbox" id="tpS3" ${cf.s3 ? 'checked' : ''}> 3D 치수</label><span></span><input type="range" id="tpO3" min="0.1" max="1" step="0.05" value="${cf.o3}" title="3D 투명도"></div>
    <div class="lbl" style="margin-top:6px">표시 위치</div>
    <div class="seg2">${[['line', '잰 자리'], ['outside', '외벽 바깥'], ['below', '벽면 아래']].map(([k, n]) => `<button data-tpp="${k}" class="${cf.place === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="dl">${ds.length ? ds.map((d, i) => `<div><span>${i + 1}. ${fmtMm(dimLen(d))} mm${d.place ? ' · ' + { line: '잰 자리', outside: '외벽 바깥', below: '벽면 아래' }[d.place] : ''}</span><button data-tpx="${d.id}" aria-label="치수 지우기">지우기</button></div>`).join('') : '<div class="muted">아직 잰 치수가 없어요</div>'}</div>
    <div class="r"><button class="lnk" id="tpAuto">외벽 치수 자동 넣기</button><span></span><button class="lnk" id="tpClr" ${ds.length ? '' : 'disabled'}>모두 지우기</button></div>`;
}
(function tapeUi() {
  const seg = $('.top .seg[aria-label="보기"]') || $('#saveState'); if (!seg) return;
  seg.insertAdjacentHTML('afterend', `<span class="tapewrap" style="display:inline-flex"><button class="tapeb main" id="tapeBtn" aria-pressed="false" title="줄자 (T)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7v4M10 7v3M14 7v4M18 7v3"/></svg><span class="tl">줄자</span></button><button class="tapeb sm" id="tapeCfg" aria-label="치수 설정">▾</button></span>`);
  $('#tapeBtn').onclick = () => setTape(!TAPE.on);
  $('#tapeCfg').onclick = (e) => { e.stopPropagation(); const el = pop16('tapePop'); el.dataset.anchor = 'tapeCfg'; if (!el.hidden) { el.hidden = true; return; } el.hidden = false; renderTapePop(); pop16('tapePop', $('#tapeCfg')); };
  const P_ = () => $('#tapePop');
  document.addEventListener('click', (e) => {
    const el = P_(); if (!el || !el.contains(e.target)) return; const t = e.target;
    if (t.id === 'tpOn') { setTape(!TAPE.on); renderTapePop(); }
    else if (t.dataset.tpp) { dimCfg().place = t.dataset.tpp; commit(true); renderTapePop(); draw2d(); need3d = true; }
    else if (t.dataset.tpx) { P.dims = P.dims.filter((d) => d.id !== t.dataset.tpx); commit(); renderTapePop(); }
    else if (t.id === 'tpAuto') autoWallDims();
    else if (t.id === 'tpClr') { P.dims = []; commit(); renderTapePop(); }
  });
  document.addEventListener('input', (e) => { const el = P_(); if (!el || !el.contains(e.target)) return; const cf = dimCfg(), id = e.target.id;
    if (id === 'tpO2') cf.o2 = +e.target.value; if (id === 'tpO3') cf.o3 = +e.target.value; if (id === 'tpS2') cf.s2 = e.target.checked; if (id === 'tpS3') cf.s3 = e.target.checked; draw2d(); need3d = true; clearTimeout(V18.ct); V18.ct = setTimeout(saveProject, 500); });
})();

/* ================================================================
   5. 단축키 — Ctrl+B → W 빠른 벽, Ctrl+R 시계방향 90°, T 줄자 · 단축키 메뉴(?)
   ================================================================ */
const QW = { on: false, known: new Set() };
function avgWallH() { const hs = P.walls.map(wallH).filter(Boolean); return hs.length ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length / 10) * 10 : P.ceilingH || 2700; }
function qwDialog(then) {
  let d = $('#qwDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'qwDlg'; document.body.appendChild(d); }
  const c = V18.qw || { t: P.wallT || 150, h: avgWallH(), mat: 'paint', color: '#ece8e1' };
  d.innerHTML = `<div class="dlg" style="min-width:300px"><h3>빠른 벽 기본값</h3><p class="hint">Ctrl+B → W 로 바로 그리는 벽에 들어가요. 한 번 정하면 다음부터는 묻지 않아요 (단축키 메뉴 ?에서 바꾸기).</p>
    <label class="fld"><span>두께 (mm)</span><input type="number" id="qwT" value="${c.t}" min="30" step="10"></label>
    <label class="fld"><span>높이 (mm) · 지금 벽 평균 ${avgWallH()}</span><input type="number" id="qwH" value="${c.h}" min="300" step="10"></label>
    <label class="fld"><span>재질</span><select id="qwM">${Object.entries(matOpts).map(([k, n]) => `<option value="${k}" ${k === c.mat ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <label class="fld"><span>색</span><input type="color" id="qwC" value="${c.color}"></label>
    <div class="row"><button class="btn pri" id="qwOk">저장${then ? ' 후 벽 그리기' : ''}</button><button class="btn" id="qwNo">취소</button></div></div>`;
  d.showModal();
  $('#qwNo').onclick = () => d.close();
  $('#qwOk').onclick = () => { V18.qw = { t: clamp(+$('#qwT').value || 150, 30, 2000), h: clamp(+$('#qwH').value || 2700, 300, 20000), mat: $('#qwM').value, color: $('#qwC').value }; store.set('drs_qw', V18.qw); d.close(); if (then) then(); };
}
function quickWall() {
  if (!P) return; if (!V18.qw) { qwDialog(quickWall); return; }
  QW.known = new Set(P.walls.map((w) => w.id)); setTool('wall'); QW.on = true; const c = V18.qw;
  toast(`빠른 벽: 두께 ${c.t} · 높이 ${c.h} · ${MATS[c.mat] ? MATS[c.mat].n : c.mat} — 눌러서 그리고 Enter로 끝`);
}
{ const _cm = commit; commit = function (skip) {
  if (QW.on && P && V18.qw && !batch) { const c = V18.qw; for (const w of P.walls) if (!QW.known.has(w.id)) { QW.known.add(w.id); w.t = c.t; w.h = c.h; w.finish = { type: c.mat, color: isUx(c.mat) ? '#ffffff' : c.color }; } }
  return _cm(skip); }; }
{ const _st = setTool; setTool = function (t) { if (t !== 'wall') QW.on = false; _st(t); }; }
function rotateSelCW() {
  const L = selList().filter((s) => s.kind === 'item' || s.kind === 'wall'); if (!L.length) { toast('돌릴 오브젝트를 먼저 고르세요'); return; }
  for (const s of L) {
    if (s.kind === 'item') { const it = itemOf(s.id); if (it) it.rot = (((it.rot || 0) + 90) % 360 + 360) % 360; }
    else { const w = wallOf(s.id); if (!w) continue; const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2, r = (x, y) => [Math.round(mx - (y - my)), Math.round(my + (x - mx))]; [w.x1, w.y1] = r(w.x1, w.y1); [w.x2, w.y2] = r(w.x2, w.y2); }
  }
  commit(); dirty3d = true;
}
const KEYS18 = [
  ['Ctrl+B → W', '빠른 벽 바로 그리기 (기본 두께 · 재질 · 평균 높이)'], ['Ctrl+R', '고른 오브젝트 시계방향 90° 돌리기'], ['T', '줄자 켜기 · 끄기'], ['Shift (줄자)', '수평 · 수직으로 재기'],
  ['Ctrl+C / X / V', '복사 · 잘라내기 · 붙여넣기'], ['Ctrl+D', '복제'], ['Ctrl+Z / Y', '되돌리기 · 다시 실행'], ['Ctrl+S', '저장'], ['Ctrl+P', '내보내기'], ['Ctrl+K', '기능 · 기물 검색'],
  ['Ctrl+Shift+> / <', '비율 유지 10% 크게 · 작게'], ['M', '이동 ON/OFF'], ['방향키', '이동 (Shift ×10)'], ['R / Shift+R', '90° 돌리기 · 반대로'], ['G', '걷기 모드'], ['C', '3D 댓글'], ['H', '작업 기록'],
  ['Delete', '삭제'], ['Esc', '취소 · 선택 해제 · 줄자 끄기'], ['Enter', '그리기 끝'], ['F1', '단축키 전체 창']
];
function keyPop() {
  const b = $('#helpBtn'); const el = pop16('keyPop', null, `<h4>단축키</h4><div class="keys16">${KEYS18.map(([k, n]) => `<kbd>${esc(k)}</kbd><span>${esc(n)}</span>`).join('')}</div>
    <div class="r" style="margin-top:8px"><button class="lnk" id="kpQw">빠른 벽 기본값 바꾸기</button></div>`); el.dataset.anchor = 'helpBtn';
  if (!el.hidden && el.dataset.open === '1') { el.hidden = true; el.dataset.open = ''; return; } el.dataset.open = '1'; pop16('keyPop', b);
}
(function keysUi() {
  const b = $('#helpBtn'); if (b) { b.classList.remove('desk'); b.classList.add('v18'); b.title = '단축키'; b.onclick = (e) => { e.stopPropagation(); keyPop(); }; }
  document.addEventListener('click', (e) => { if (e.target.id === 'kpQw') { $('#keyPop').hidden = true; qwDialog(null); } });
  const k = $('#helpDlg .keys'); if (k) k.insertAdjacentHTML('afterbegin', '<kbd>Ctrl+B → W</kbd><span>빠른 벽 바로 그리기</span><kbd>Ctrl+R</kbd><span>시계방향 90° 돌리기</span><kbd>T</kbd><span>줄자</span>');
})();
let chordB = 0;
addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey, k = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : (e.key || '').toLowerCase(), inField = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (mod && k === 'r' && !e.shiftKey && !e.altKey) { e.preventDefault(); e.stopImmediatePropagation(); if (!inField && !document.querySelector('dialog[open]') && P) rotateSelCW(); return; }
  if (inField || document.querySelector('dialog[open]') || !P) return;
  if (mod && k === 'b') { e.preventDefault(); e.stopImmediatePropagation(); chordB = Date.now(); toast('Ctrl+B · 이어서 W = 빠른 벽'); return; }
  if (k === 'w' && Date.now() - chordB < 1800) { e.preventDefault(); e.stopImmediatePropagation(); chordB = 0; quickWall(); return; }
  if (!mod && !e.altKey && k === 't') { e.preventDefault(); e.stopImmediatePropagation(); setTape(!TAPE.on); return; }
  if (e.key === 'Escape' && TAPE.on) { e.stopImmediatePropagation(); if (TAPE.a) { TAPE.a = TAPE.hover = null; draw2d(); need3d = true; } else setTape(false); }
}, true);

/* ================================================================
   6. DXF — 기물을 선이 아니라 블록(BLOCK/INSERT + 이름 · 크기 속성)으로
   ================================================================ */
function symRecord(it) {
  const rec = []; let cur = null; const R = new Proxy({}, { get: (o, p) => {
    if (p === 'moveTo') return (x, y) => (cur = [x, y]); if (p === 'lineTo') return (x, y) => { if (cur) rec.push(['L', cur, [x, y]]); cur = [x, y]; };
    if (p === 'arc') return (x, y, r) => rec.push(['C', [x, y], r]); if (p === 'measureText') return () => ({ width: 0 }); if (p in o) return o[p]; return () => {}; }, set: (o, p, v) => ((o[p] = v), true) });
  const keep = [cx, V]; cx = R; V = { s: 1, ox: 0, oy: 0 }; try { symbol({ ...it, x: 0, y: 0, rot: 0 }, spec(it)); } catch (e) {} finally { cx = keep[0]; V = keep[1]; }
  return rec;
}
const blkName = (it) => { const s = spec(it); return (`${it.type}_${it.w}X${it.d}` + (s.L.shape === 'stairs' ? 'X' + s.h : '')).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 60); };
function dxfDoc(parts) {
  const BL = new Map(), layers = new Set(['0', 'WALL', 'OPENING', 'DIM']), ENT = [], Y = (y) => -y, n = (v) => +(+v).toFixed(2);
  const line = (E, a, b, l) => E.push(`0\nLINE\n8\n${l}\n10\n${n(a[0])}\n20\n${n(Y(a[1]))}\n30\n0\n11\n${n(b[0])}\n21\n${n(Y(b[1]))}\n31\n0`);
  const text = (E, x, y, t, l, h = 120, rot = 0) => E.push(`0\nTEXT\n8\n${l}\n10\n${n(x)}\n20\n${n(Y(y))}\n30\n0\n40\n${h}\n1\n${dxfText(t)}\n50\n${n(rot)}\n72\n1\n11\n${n(x)}\n21\n${n(Y(y))}\n31\n0\n73\n2`);
  const LN = { floor: 'L1_FLOOR', upper: 'L2_UPPER', ceil: 'L3_CEILING', ceiling: 'L3_CEILING', elec: 'ELEC', plumb: 'PLUMB', deco: 'DECO' };
  for (const pt of parts) pt.run(() => {
    const pre = pt.pre || '', L = (x) => { const v = pre + x; layers.add(v); return v; };
    for (const w of P.walls) { const r = wallRect(w); for (let i = 0; i < 4; i++) line(ENT, r[i], r[(i + 1) % 4], L('WALL')); }
    for (const o of P.openings) { const g = openingGeom(o); if (g) { line(ENT, g.a, g.b, L('OPENING')); text(ENT, (g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2 - 300, `${OPENTYPES[o.type] || o.type} ${o.w}x${o.h}`, L('OPENING'), 100); } }
    for (const it of P.items.filter((i) => !i.hidden && (!pt.only || pt.only.has(i.id)))) {
      const s = spec(it), nm = blkName(it), l = L(LN[s.layer] || 'L1_FLOOR');
      if (!BL.has(nm)) { const E = [], hw = it.w / 2, hd = it.d / 2, c = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]; for (let i = 0; i < 4; i++) line(E, c[i], c[(i + 1) % 4], '0');
        for (const r of symRecord(it)) { if (r[0] === 'L') line(E, r[1], r[2], '0'); else E.push(`0\nCIRCLE\n8\n0\n10\n${n(r[1][0])}\n20\n${n(Y(r[1][1]))}\n30\n0\n40\n${n(r[2])}`); }
        const th = Math.max(60, Math.min(140, Math.min(it.w, it.d) / 6));
        E.push(`0\nATTDEF\n8\n0\n10\n0\n20\n${n(th * .6)}\n30\n0\n40\n${n(th)}\n1\n\n3\n이름\n2\nNAME\n70\n0\n72\n1\n11\n0\n21\n${n(th * .6)}\n31\n0`);
        E.push(`0\nATTDEF\n8\n0\n10\n0\n20\n${n(-th * .9)}\n30\n0\n40\n${n(th * .7)}\n1\n\n3\n규격\n2\nSIZE\n70\n0\n72\n1\n11\n0\n21\n${n(-th * .9)}\n31\n0`);
        BL.set(nm, { E, th }); }
      const { th } = BL.get(nm), a = -(it.rot || 0), ar = a * Math.PI / 180, wpt = (lx, ly) => [it.x + lx * Math.cos(ar) - ly * Math.sin(ar), Y(it.y) + lx * Math.sin(ar) + ly * Math.cos(ar)];
      ENT.push(`0\nINSERT\n8\n${l}\n66\n1\n2\n${nm}\n10\n${n(it.x)}\n20\n${n(Y(it.y))}\n30\n${n(zOf(it))}\n41\n1\n42\n1\n43\n1\n50\n${n(a)}`);
      for (const [tag, val, ly, h] of [['NAME', s.name, th * .6, th], ['SIZE', `${it.w}x${it.d}x${s.h}`, -th * .9, th * .7]]) { const p = wpt(0, ly); ENT.push(`0\nATTRIB\n8\n${l}\n10\n${n(p[0])}\n20\n${n(p[1])}\n30\n0\n40\n${n(h)}\n1\n${dxfText(val)}\n2\n${tag}\n70\n0\n50\n${n(a)}\n72\n1\n11\n${n(p[0])}\n21\n${n(p[1])}\n31\n0`); }
      ENT.push(`0\nSEQEND\n8\n${l}`);
    }
    if (!pt.only) for (const ln of P.lines) for (let i = 1; i < ln.pts.length; i++) line(ENT, ln.pts[i - 1], ln.pts[i], L('LINE_' + ln.kind.toUpperCase()));
    if (!pt.only) for (const d of P.dims || []) { const g = dimGeom(d), lay = L('DIM'); line(ENT, g.a, g.b, lay); for (const e of [g.ea, g.eb]) if (e) line(ENT, e[0], e[1], lay);
      const ang = Math.atan2(-(g.b[1] - g.a[1]), g.b[0] - g.a[0]) * 180 / Math.PI, up = ang > 90 || ang < -90 ? ang + 180 : ang; text(ENT, (g.a[0] + g.b[0]) / 2, (g.a[1] + g.b[1]) / 2 - 90, fmtMm(dimLen(d)), lay, 110, up);
      for (const p of [g.a, g.b]) line(ENT, [p[0] - 60, p[1] + 60], [p[0] + 60, p[1] - 60], lay); }
  });
  const ly = [...layers], tbl = ly.map((nm, i) => `0\nLAYER\n2\n${nm}\n70\n0\n62\n${nm.endsWith('DIM') ? 30 : (i % 7) + 1}\n6\nCONTINUOUS`).join('\n');
  const blocks = [...BL.entries()].map(([nm, b]) => `0\nBLOCK\n8\n0\n2\n${nm}\n70\n2\n10\n0\n20\n0\n30\n0\n3\n${nm}\n${b.E.join('\n')}\n0\nENDBLK\n8\n0`).join('\n');
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${ly.length}\n${tbl}\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n${blocks}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${ENT.join('\n')}\n0\nENDSEC\n0\nEOF\n`;
}
const selOnly = () => { if (!$('#expSelOnly') || !$('#expSelOnly').checked) return null; const s = new Set(selList().filter((x) => x.kind === 'item').map((x) => x.id)); return s.size ? s : null; };
dxfString = function () { return dxfDoc([{ pre: '', run: (f) => f(), only: selOnly() }]); };
dxfMulti = function (lv) { return dxfDoc(lv.map((l) => ({ pre: l.name.replace(/\s+/g, '').replace(/[^A-Za-z0-9가-힣_]/g, '') + '_', run: (f) => (l.id === P.levelId ? f() : withLevel(l, f)) }))); };

/* ================================================================
   7. 3D 블록 내보내기 — SketchUp(DAE · 기물마다 컴포넌트) + OBJ/MTL + 텍스처 그림
   ================================================================ */
function grab(fn) {
  const k = [G, YOFF, FADE, TINT, FOCUS, sel, multi, CUT]; G = {}; YOFF = 0; FADE = false; TINT = false; FOCUS = null; sel = null; multi = []; CUT = false;
  try { fn(); return Object.values(G); } finally { [G, YOFF, FADE, TINT, FOCUS, sel, multi, CUT] = k; }
}
function toParts(groups, MT) { // 재질(텍스처·색·투명도)별 삼각형, 좌표는 mm · Y 위 · z 뒤집기
  const parts = new Map();
  for (const g of groups) { const n = g.p.length / 3; for (let v = 0; v < n; v += 3) {
    const hex = [0, 1, 2].map((j) => Math.round(clamp(g.c[v * 3 + j], 0, 1) * 255).toString(16).padStart(2, '0')).join(''), key = g.key || 'plain', id = `${key}|${hex}|${(+g.alpha).toFixed(2)}`;
    if (!MT.has(id)) MT.set(id, { id, n: 'm' + MT.size, key, hex, alpha: +g.alpha, img: key !== 'plain' && (tex[key] || TEXCV[key]) ? 'tx_' + MT.size + '.jpg' : null });
    let pt = parts.get(id); if (!pt) parts.set(id, (pt = { m: MT.get(id), p: [], nn: [], u: [] }));
    for (const j of [0, 2, 1]) { const i = v + j; pt.p.push(g.p[i * 3], g.p[i * 3 + 1], -g.p[i * 3 + 2]); pt.nn.push(g.n[i * 3], g.n[i * 3 + 1], -g.n[i * 3 + 2]); pt.u.push(g.u[i * 2], -g.u[i * 2 + 1]); }
  } }
  return [...parts.values()];
}
async function texJpg(m) { // 텍스처 × 색을 구운 그림
  const c = texCanvas(m.key); if (!c) return null; const o = document.createElement('canvas'); o.width = o.height = c.width; const g = o.getContext('2d'); g.drawImage(c, 0, 0);
  if (m.hex !== 'ffffff') { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#' + m.hex; g.fillRect(0, 0, o.width, o.height); }
  const b = await new Promise((r) => o.toBlob(r, 'image/jpeg', .88)); return new Uint8Array(await b.arrayBuffer());
}
async function exportBlocks3d() {
  if (dirty3d) buildScene(); const only = selOnly(), MT = new Map(), BL = new Map(), inst = [], EL = curElev(), f = (v) => +(+v).toFixed(2);
  const its = P.items.filter((i) => !i.hidden && vis[spec(i).layer] !== false && (!only || only.has(i.id)));
  for (const it of its) {
    const s = spec(it), key = [it.type, it.w, it.d, s.h, zOf(it), s.color, s.mat, it.finish && it.finish.type, it.finish && it.finish.color, it.v, it.art].join('|');
    if (!BL.has(key)) BL.set(key, { id: 'blk' + BL.size, name: `${s.name} ${it.w}x${it.d}x${s.h}`, parts: toParts(grab(() => buildItem({ ...it, x: 0, y: 0, rot: 0 })), MT) });
    inst.push({ it, b: BL.get(key), name: s.name });
  }
  const walls = only ? [] : toParts(grab(() => buildWalls()), MT);
  const floor = only ? [] : toParts(grab(() => { const b = bounds(); box(xf(0, 0, 0), b[0] - P.wallT / 2, b[2] + P.wallT / 2, -20, 0, b[1] - P.wallT / 2, b[3] + P.wallT / 2, P.floor.color, matTex(P.floor.type), matA(P.floor.type)); }), MT);
  const mats = [...MT.values()], files = [];
  for (const m of mats) if (m.img) { const d = await texJpg(m); if (d) files.push({ name: 'textures/' + m.img, data: d }); else m.img = null; }
  const rgb = (m) => hexRGB('#' + m.hex).map((v) => v.toFixed(4)).join(' ');
  // ---- DAE ----
  const geo = (id, parts) => { const P3 = [], N3 = [], U2 = []; for (const p of parts) { P3.push(...p.p); N3.push(...p.nn); U2.push(...p.u); } let off = 0;
    const tris = parts.map((p) => { const c = p.p.length / 9, idx = []; for (let i = 0; i < c * 3; i++) idx.push(off + i); off += c * 3; return `<triangles material="${p.m.n}" count="${c}"><input semantic="VERTEX" source="#${id}-v" offset="0"/><input semantic="NORMAL" source="#${id}-nrm" offset="0"/><input semantic="TEXCOORD" source="#${id}-uv" offset="0" set="0"/><p>${idx.join(' ')}</p></triangles>`; }).join('');
    const src = (sid, arr, st, names) => `<source id="${id}-${sid}"><float_array id="${id}-${sid}-a" count="${arr.length}">${arr.map(f).join(' ')}</float_array><technique_common><accessor source="#${id}-${sid}-a" count="${arr.length / st}" stride="${st}">${names.map((x) => `<param name="${x}" type="float"/>`).join('')}</accessor></technique_common></source>`;
    return `<geometry id="${id}" name="${id}"><mesh>${src('pos', P3, 3, ['X', 'Y', 'Z'])}${src('nrm', N3, 3, ['X', 'Y', 'Z'])}${src('uv', U2, 2, ['S', 'T'])}<vertices id="${id}-v"><input semantic="POSITION" source="#${id}-pos"/></vertices>${tris}</mesh></geometry>`; };
  const lib = (tag, inner) => (inner ? `<${tag}>${inner}</${tag}>` : '');
  const bindM = (parts) => `<bind_material><technique_common>${[...new Set(parts.map((p) => p.m))].map((m) => `<instance_material symbol="${m.n}" target="#${m.n}"><bind_vertex_input semantic="UVSET0" input_semantic="TEXCOORD" input_set="0"/></instance_material>`).join('')}</technique_common></bind_material>`;
  const X = (s) => esc(s).replace(/'/g, '&apos;');
  let dae = `<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>3D RENDER</authoring_tool></contributor><unit name="millimeter" meter="0.001"/><up_axis>Y_UP</up_axis></asset>`;
  dae += lib('library_images', mats.filter((m) => m.img).map((m) => `<image id="${m.n}-img"><init_from>textures/${m.img}</init_from></image>`).join(''));
  dae += lib('library_effects', mats.map((m) => `<effect id="${m.n}-fx"><profile_COMMON>${m.img ? `<newparam sid="${m.n}-surf"><surface type="2D"><init_from>${m.n}-img</init_from></surface></newparam><newparam sid="${m.n}-samp"><sampler2D><source>${m.n}-surf</source></sampler2D></newparam>` : ''}<technique sid="common"><lambert><diffuse>${m.img ? `<texture texture="${m.n}-samp" texcoord="UVSET0"/>` : `<color>${rgb(m)} 1</color>`}</diffuse>${m.alpha < 1 ? `<transparent opaque="A_ONE"><color>1 1 1 1</color></transparent><transparency><float>${m.alpha}</float></transparency>` : ''}</lambert></technique></profile_COMMON></effect>`).join(''));
  dae += lib('library_materials', mats.map((m) => `<material id="${m.n}" name="${X((MATS[m.key] && MATS[m.key].n) || m.key)}_${m.hex}"><instance_effect url="#${m.n}-fx"/></material>`).join(''));
  dae += lib('library_geometries', [...BL.values()].map((b) => geo(b.id + '-g', b.parts)).join('') + (walls.length ? geo('walls-g', walls) : '') + (floor.length ? geo('floor-g', floor) : ''));
  dae += lib('library_nodes', [...BL.values()].map((b) => `<node id="${b.id}" name="${X(b.name)}"><instance_geometry url="#${b.id}-g">${bindM(b.parts)}</instance_geometry></node>`).join(''));
  const mtx = (it) => { const a = (it.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c, 0, s, it.x, 0, 1, 0, EL, -s, 0, c, -it.y, 0, 0, 0, 1].map(f).join(' '); };
  dae += `<library_visual_scenes><visual_scene id="scene" name="${X(P.name || '3D RENDER')}">`;
  if (walls.length) dae += `<node id="walls" name="벽"><matrix>1 0 0 0 0 1 0 ${f(EL)} 0 0 1 0 0 0 0 1</matrix><instance_geometry url="#walls-g">${bindM(walls)}</instance_geometry></node>`;
  if (floor.length) dae += `<node id="floor" name="바닥"><matrix>1 0 0 0 0 1 0 ${f(EL)} 0 0 1 0 0 0 0 1</matrix><instance_geometry url="#floor-g">${bindM(floor)}</instance_geometry></node>`;
  dae += `<node id="items" name="기물">${inst.map((x, i) => `<node id="i${i}" name="${X(x.name)} #${i + 1}"><matrix>${mtx(x.it)}</matrix><instance_node url="#${x.b.id}"/></node>`).join('')}</node>`;
  dae += `</visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>\n`;
  // ---- OBJ ----
  const O = [`# 3D RENDER · ${P.name} · 단위 mm · Y 위\nmtllib model.mtl`]; let vi = 1;
  const objPart = (name, parts, tf) => { O.push(`o ${name.replace(/\s+/g, '_')}`); for (const p of parts) { const c = p.p.length / 3; for (let i = 0; i < c; i++) { const q = tf(p.p[i * 3], p.p[i * 3 + 1], p.p[i * 3 + 2]), nn = tf(p.nn[i * 3], p.nn[i * 3 + 1], p.nn[i * 3 + 2], true); O.push(`v ${f(q[0])} ${f(q[1])} ${f(q[2])}`, `vt ${p.u[i * 2].toFixed(4)} ${p.u[i * 2 + 1].toFixed(4)}`, `vn ${nn[0].toFixed(4)} ${nn[1].toFixed(4)} ${nn[2].toFixed(4)}`); }
    O.push(`usemtl ${p.m.n}`); for (let i = 0; i < c; i += 3) O.push(`f ${vi + i}/${vi + i}/${vi + i} ${vi + i + 1}/${vi + i + 1}/${vi + i + 1} ${vi + i + 2}/${vi + i + 2}/${vi + i + 2}`); vi += c; } };
  const lift = (x, y, z, isN) => (isN ? [x, y, z] : [x, y + EL, z]);
  if (walls.length) objPart('벽', walls, lift); if (floor.length) objPart('바닥', floor, lift);
  inst.forEach((x, i) => { const a = (x.it.rot || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); objPart(`${x.name}_${i + 1}`, x.b.parts, (px, py, pz, isN) => isN ? [c * px + s * pz, py, -s * px + c * pz] : [c * px + s * pz + x.it.x, py + EL, -s * px + c * pz - x.it.y]); });
  const mtl = mats.map((m) => `newmtl ${m.n}\n# ${(MATS[m.key] && MATS[m.key].n) || m.key}\nKd ${m.img ? '1 1 1' : rgb(m)}\nKa 0 0 0\nd ${m.alpha}\nillum 1${m.img ? `\nmap_Kd textures/${m.img}` : ''}`).join('\n\n');
  const readme = '﻿3D RENDER · 3D 블록 (텍스처 포함)\r\n\r\n- model.dae : 스케치업 (파일 → 가져오기 → COLLADA). 기물은 같은 종류·크기끼리 컴포넌트로 들어가고, 벽 · 바닥은 그룹이에요.\r\n- model.obj + model.mtl : 3ds Max · 블렌더 · 라이노 · D5 · 트윈모션 (textures 폴더와 같이 두세요)\r\n- textures/ : 재질 그림 (색이 입혀진 상태)\r\n- 단위: mm, 위쪽 = Y\r\n';
  files.unshift({ name: 'model.dae', data: dae }, { name: 'model.obj', data: O.join('\n') + '\n' }, { name: 'model.mtl', data: mtl + '\n' }, { name: 'README_3D블록.txt', data: readme });
  const z = zipFiles(files); return { name: `${(P.name || 'plan').replace(/[\\/:*?"<>|]/g, '_')}_3D블록.zip`, blob: new Blob([await z.arrayBuffer()], { type: 'application/zip' }), n: inst.length, m: mats.length };
}
{ const _mf = makeFile0; makeFile0 = async function (fmt, lv) { if (fmt === 'blk3d') return exportBlocks3d(); return _mf(fmt, lv); }; }
(function expUi() {
  const fm = $('#expDlg .fmts'); if (!fm) return;
  const obj = $('[data-fmt="obj"]', fm); (obj || fm.lastElementChild).insertAdjacentHTML('afterend', '<button class="fmt" data-fmt="blk3d"><b>3D 블록 (텍스처)</b><small>스케치업 DAE · OBJ · 기물별 컴포넌트</small></button>');
  const dx = $('[data-fmt="dxf"] small', fm); if (dx) dx.textContent = '레이어별 · 기물은 블록';
  const b = $('[data-fmt="blk3d"]', fm); b.onclick = () => { expFmt = 'blk3d'; $$('[data-fmt]').forEach((x) => x.classList.toggle('on', x === b)); };
  const row = $('#expLinkedRow'); if (row) row.insertAdjacentHTML('afterend', '<label class="chk" id="expSelRow" hidden><input type="checkbox" id="expSelOnly"> 고른 기물만 (DXF · 3D 블록)</label>');
  const eb = $('#exportBtn'), upd = () => { const n = selList().filter((x) => x.kind === 'item').length; const r = $('#expSelRow'); if (r) { r.hidden = !n; $('#expSelOnly').checked = false; r.lastChild.textContent = ` 고른 기물 ${n}개만 (DXF · 3D 블록)`; } };
  if (eb) eb.addEventListener('click', upd); const eb2 = $('#exportBtn2'); if (eb2) eb2.addEventListener('click', upd);
})();
