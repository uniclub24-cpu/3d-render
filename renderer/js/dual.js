// 듀얼 모니터: 보조 창(사이드 윈도우). 설정에서 켤 때만 열린다 → 끄면 지금처럼 한 창만 그린다.
// 메인 창 → 보조 창: 모델(고칠 때마다) · 카메라(발표 화면일 때). PC 앱 = Electron IPC, 웹 = window.open + BroadcastChannel.
// 보조 창: 같은 프로젝트를 보기 전용으로 따라감. ⌂ 홈 = 따라가기를 끊고 다른 프로젝트를 열어 따로 수정 · ✕ = 보조 창만 닫기.
export const SIDE = new URLSearchParams(location.search).has('side');
const KEY = 'byr.dual';
export const VIEWS = [['2d', '2D 도면'], ['3d', '3D'], ['section', '단면 투시'], ['orbit', '360° 돌기'], ['mirror', '발표 화면 (메인 시점 · 도구 없음)']];
export const dualCfg = () => { try { return { on: false, where: 'right', view: 'section', style: 'same', ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { on: false, where: 'right', view: 'section', style: 'same' }; } };
const saveCfg = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
const B = () => (window.byr && window.byr.sideOpen ? window.byr : null);
let ch = null; const bc = () => (ch ||= typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('byr-side') : null);
let H = null, open = false, webWin = null, lastJson = '', camT = 0, lastCam = '';

/* ================= 메인 창 ================= */
export function initMain(hooks) {
  H = hooks;
  if (B()) B().onSideClosed(() => { open = false; const c = dualCfg(); if (c.on) { c.on = false; saveCfg(c); } H.onChange && H.onChange(); });
  const b = bc(); if (b) b.onmessage = (e) => { const m = e.data || {}; if (m.t === 'hello' && open) push(true); if (m.t === 'bye') { open = false; webWin = null; const c = dualCfg(); c.on = false; saveCfg(c); H.onChange && H.onChange(); } };
  setInterval(tick, 120);
  if (dualCfg().on && B()) openSide(); /* PC 앱: 켜 둔 채로 껐으면 다시 연다 */
}
export const isOpen = () => open;
export const notify = () => push(false);
export async function openSide() {
  const c = dualCfg(); c.on = true; saveCfg(c);
  if (B()) { const r = await B().sideOpen({ where: c.where }); if (r && r.ok === false) { H.toast && H.toast(r.msg || '보조 창을 열지 못했어요'); c.on = false; saveCfg(c); return false; } if (r && r.single) H.toast && H.toast('모니터가 하나라 같은 화면에 창으로 열었어요 · 보조 모니터로 끌어다 놓으세요', 4000); }
  else { webWin = window.open(location.pathname + '?side=1', 'byr-side', 'popup,width=1280,height=800'); if (!webWin) { H.toast && H.toast('팝업이 막혀 보조 창을 못 열었어요 · 브라우저에서 팝업을 허용해 주세요'); c.on = false; saveCfg(c); return false; } }
  open = true; lastJson = ''; setTimeout(() => push(true), 600); H.onChange && H.onChange(); return true;
}
export function closeSide() { const c = dualCfg(); c.on = false; saveCfg(c); if (B()) B().sideClose(); else { send({ t: 'close' }); try { webWin && webWin.close(); } catch {} } open = false; webWin = null; H && H.onChange && H.onChange(); }
export function setCfg(k, v) { const c = dualCfg(); c[k] = v; saveCfg(c); if (open) push(true, true); }
function send(m) { if (B()) B().sideState(m); else { const b = bc(); b && b.postMessage(m); } }
/** 모델 · 설정을 보조 창으로 (바뀐 경우만) */
function push(force, opt) {
  if (!open || !H) return; const S = H.S; if (!S.model) return; let j; try { j = JSON.stringify(S.model); } catch { return; }
  const c = dualCfg(); if (force || j !== lastJson) { lastJson = j; send({ t: 'model', json: j, cfg: c, opt: !!opt }); }
}
function tick() {
  if (!open || !H) return; const now = performance.now(); if (now - camT > 450) { camT = now; push(false); }
  if (dualCfg().view === 'mirror') { const v = JSON.stringify({ v: H.engine.getView(), st: H.engine.style, pr: H.engine.present || null }); if (v !== lastCam) { lastCam = v; send({ t: 'cam', ...JSON.parse(v) }); } }
}

/* ================= 보조 창 ================= */
export function initSide(hooks) {
  H = hooks; let follow = true, applied = null; document.body.classList.add('sidewin', 'sidefollow');
  const corner = document.createElement('div'); corner.id = 'sideCorner';
  corner.innerHTML = `<span class="sc-t">보조 창</span><button class="btn" id="scHome" title="홈 · 다른 프로젝트를 열어 대조하며 수정">⌂ 홈</button><button class="btn danger" id="scClose" title="보조 창만 닫기 (메인 창은 그대로)">✕ 보조 창 끄기</button>`;
  document.body.appendChild(corner);
  corner.querySelector('#scHome').onclick = () => { follow = false; document.body.classList.remove('sidefollow'); H.toggleClean(false); if (H.secView.on) H.secView.exit(); H.engine.controls.autoRotate = false; corner.querySelector('.sc-t').textContent = '보조 창 · 따로 작업'; H.showHome(); };
  corner.querySelector('#scClose').onclick = () => { if (window.byr && window.byr.sideClose) window.byr.sideClose(); else { const b = bc(); b && b.postMessage({ t: 'bye' }); window.close(); } };
  const onMsg = async (m) => {
    if (!m || !follow) return;
    if (m.t === 'close') { window.close(); return; }
    if (m.t === 'model') {
      const sv = H.secView, keep = sv.on ? { N: sv.N.clone(), cut: sv.cut, vpU: sv.vpU, vpV: sv.vpV, wu: sv.wu, wv: sv.wv, hh: sv.hh, pull: sv.pull, hour: sv.hour, depth: sv.depth } : null, cam = H.engine.getView();
      await H.followModel(JSON.parse(m.json));
      const c = m.cfg || {}, key = c.view + '|' + c.style;
      if (key !== applied || m.opt) { applied = key; await applyView(c); }
      else { if (keep && sv.on) { Object.assign(sv, keep); sv.box = sv._box(); sv._frame(); Object.assign(sv, { vpU: keep.vpU, vpV: keep.vpV, wu: keep.wu, wv: keep.wv, hh: keep.hh }); sv.apply(); } else if (c.view !== 'mirror') H.engine.flyTo(cam, 1); }
    }
    if (m.t === 'cam' && applied && applied.startsWith('mirror')) { if (m.st && H.engine.style !== m.st) H.engine.setStyle(m.st); H.engine.flyTo(m.v, 1); }
  };
  if (window.byr && window.byr.onSideState) window.byr.onSideState(onMsg); else { const b = bc(); if (b) { b.onmessage = (e) => onMsg(e.data); b.postMessage({ t: 'hello' }); } addEventListener('beforeunload', () => { const b2 = bc(); b2 && b2.postMessage({ t: 'bye' }); }); }
}
async function applyView(c) {
  const { engine, secView, setPane, toggleClean } = H; if (secView.on) secView.exit(); engine.controls.autoRotate = false; toggleClean(false);
  if (c.style && c.style !== 'same' && engine.style !== c.style) engine.setStyle(c.style);
  const v = c.view || 'section';
  if (v === '2d') { setPane('2d'); return; }
  setPane('3d'); await new Promise((r) => setTimeout(r, 250));
  if (v === 'section') secView.enter();
  else if (v === 'orbit') { engine.view('iso'); engine.controls.autoRotate = true; }
  else if (v === 'mirror') toggleClean(true);
}
