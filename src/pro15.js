/* v17.1 · 3D가 멈추거나 빈 화면이 되지 않게 (오류 가두기 · 화면 다시 살리기) */
var ERR3D = { last: '', shown: 0, list: [] };
function err3d(where, e) {
  const m = ((e && e.message) || String(e)).slice(0, 120);
  ERR3D.list.push({ t: new Date().toISOString(), where, m, s: ((e && e.stack) || '').split('\n').slice(0, 4).join(' | ') }); if (ERR3D.list.length > 30) ERR3D.list.shift();
  console.error('[3D]', where, e);
  if (ERR3D.last !== where + m || Date.now() - ERR3D.shown > 20000) { ERR3D.last = where + m; ERR3D.shown = Date.now(); try { toast(`3D 일부를 건너뛰고 그렸어요 (${where}: ${m})`); } catch (_) {} }
}
// 기물 하나 · 벽 · 층 · 주변 건물 단위로 실패를 가둬서, 하나가 틀려도 나머지는 그려지게
{ const _bi = buildItem; buildItem = function (it) { try { return _bi(it); } catch (e) { err3d('기물 ' + ((it && libGet(it.type) && libGet(it.type).name) || (it && it.type) || ''), e); } }; }
{ const _bw = buildWalls; buildWalls = function () { try { return _bw(); } catch (e) { err3d('벽', e); } }; }
{ const _bl = buildLevel; buildLevel = function (a) { try { return _bl(a); } catch (e) { err3d('층', e); } finally { CUT = false; FADE = false; TINT = false; } }; }
{ const _be = buildEnv; buildEnv = function (b) { try { return _be(b); } catch (e) { err3d('주변 배경', e); } }; }
{ const _bs = buildScene; buildScene = function () { try { return _bs(); } catch (e) { err3d('장면', e); dirty3d = false; YOFF = 0; FADE = false; TINT = false; CUT = false; } }; }
// 그릴 때마다 화면 버퍼로 되돌리고 시작 (실사 렌더가 중간에 멈춰도 3D가 사라지지 않게)
{ const _dg = drawGL; drawGL = function (W, H, C) { try { gl.bindFramebuffer(gl.FRAMEBUFFER, null); } catch (e) {} return _dg(W, H, C); }; }
{ const _r3 = render3d; render3d = function () { try { _r3(); } catch (e) { err3d('화면', e); } }; }
// 애니메이션 고리가 오류 한 번에 끊기지 않게 (끊기면 3D가 영영 안 바뀜 → 빈 화면)
{ const _lp = loop; loop = function (now) { try { _lp(now); } catch (e) { err3d('화면 갱신', e); need3d = true; requestAnimationFrame(loop); } }; }
// 그래픽 카드가 3D를 잠깐 놓쳤을 때(절전 · 드라이버) 다시 살리기
gc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ERR3D.lost = true; try { toast('그래픽이 잠깐 끊겼어요 · 3D를 다시 준비하는 중'); } catch (_) {} });
gc.addEventListener('webglcontextrestored', () => {
  try { tex = {}; meshes = []; if (typeof HQ !== 'undefined') HQ = null; initGL(); ERR3D.lost = false; dirty3d = true; need3d = true; toast('3D를 다시 그렸어요'); }
  catch (e) { err3d('3D 다시 준비', e); }
});
// 3D 화면으로 바꿀 때마다 확실히 새로 그리기
{ const _sv = setView; setView = function (v) { const r = _sv.apply(this, arguments); if (v !== '2d') { dirty3d = true; need3d = true; requestAnimationFrame(() => { try { render3d(); } catch (e) {} }); } return r; }; }
window.APP_VERSION = 'v17.1 · 2026-11-06';
