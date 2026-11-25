// 도구모음 · 왼쪽 툴바 · 기물 목록을 끝에 달린 작은 손잡이(⋮⋮)로 끌어 옮기기. 더블클릭 = 원래 자리. 위치는 기기마다 기억.
// Tab = 화면 비우기 (툴바 · 패널을 모두 숨기고 다시 누르면 돌아옴)
const KEY = 'byr.uimove';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };

/** target: 옮길 요소 · host: 손잡이를 붙일 요소(다시 그려져도 다시 붙인다) · name: 저장 이름 · vertical: 세로 손잡이 */
const SPOTS = [
  { name: 'dock', target: '#dock', host: '#dockIn', vertical: true, label: '하단 도구모음' },
  { name: 'plan', target: '#planTools', host: '#planTools', vertical: false, label: '왼쪽 도구' },
  { name: 'drawer', target: '#drawer', host: '#drawer .dhead', vertical: false, label: '기물 목록' },
];
let pos = load();

function apply(sp) {
  const el = document.querySelector(sp.target); if (!el) return; const p = pos[sp.name];
  if (!p) { el.style.translate = ''; el.classList.remove('moved'); return; }
  /* 화면 밖으로 나가지 않게 */
  el.style.translate = ''; const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight, m = 40;
  const dx = Math.max(-r.left - r.width + m, Math.min(W - r.left - m, p.x)), dy = Math.max(-r.top, Math.min(H - r.top - m, p.y));
  el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`; el.classList.add('moved');
}
function grip(sp) {
  const host = document.querySelector(sp.host); if (!host || host.querySelector(':scope > .mvgrip')) return;
  const g = document.createElement('div'); g.className = 'mvgrip' + (sp.vertical ? ' v' : ''); g.setAttribute('role', 'button'); g.tabIndex = 0;
  g.title = `${sp.label} 옮기기 · 끌어서 이동 · 더블클릭 = 원래 자리`; g.setAttribute('aria-label', `${sp.label} 옮기기`); g.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
  let st = null;
  g.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { g.setPointerCapture(e.pointerId); } catch {} const p = pos[sp.name] || { x: 0, y: 0 }; st = { id: e.pointerId, x: e.clientX, y: e.clientY, p0: { ...p } }; g.classList.add('drag'); });
  g.addEventListener('pointermove', (e) => { if (!st || e.pointerId !== st.id) return; e.preventDefault(); pos[sp.name] = { x: st.p0.x + e.clientX - st.x, y: st.p0.y + e.clientY - st.y }; const el = document.querySelector(sp.target); if (el) { el.style.translate = `${pos[sp.name].x}px ${pos[sp.name].y}px`; el.classList.add('moved'); } });
  const up = (e) => { if (!st || e.pointerId !== st.id) return; st = null; g.classList.remove('drag'); apply(sp); save(pos); };
  g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  g.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); delete pos[sp.name]; save(pos); apply(sp); });
  g.addEventListener('keydown', (e) => { const d = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] }[e.key]; if (!d) { if (e.key === 'Enter' || e.key === ' ') { delete pos[sp.name]; save(pos); apply(sp); } return; } e.preventDefault(); e.stopPropagation(); const p = pos[sp.name] || { x: 0, y: 0 }; pos[sp.name] = { x: p.x + d[0], y: p.y + d[1] }; save(pos); apply(sp); });
  host.appendChild(g);
}
export function initUiMove() {
  const tick = () => { for (const sp of SPOTS) grip(sp); };
  tick(); for (const sp of SPOTS) apply(sp);
  setInterval(tick, 800); /* 도구모음은 작업군을 바꿀 때 다시 그려지므로 손잡이를 다시 붙인다 */
  addEventListener('resize', () => { for (const sp of SPOTS) apply(sp); });
}
export function regrip() { for (const sp of SPOTS) grip(sp); }
export function resetUiMove() { pos = {}; save(pos); for (const sp of SPOTS) apply(sp); }
/** Tab = 화면 비우기 */
export function toggleClean(force) { const on = force ?? !document.body.classList.contains('uiclean'); document.body.classList.toggle('uiclean', on); return on; }
