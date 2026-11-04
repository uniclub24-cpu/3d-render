/* ================================================================
   v8 · 관리자 — 작업 기록 올리기, 차단 확인, 관리자 화면
   서버 쪽 권한은 supabase/schema.sql 의 RLS 가 지키고, 이 화면은 보여 주기만 해요.
   ================================================================ */
const ADMIN_EMAIL = (BUILT.adminEmail || 'marcus_pelic@naver.com').toLowerCase();
const isAdminUser = () => !!(SYNC.cfg.access && (SYNC.cfg.email || '').toLowerCase() === ADMIN_EMAIL);
let ADMINVIEW = false;

/* ---------- 작업 기록 쌓기 (동기화할 때 서버로) ---------- */
function queueAct(action) {
  if (!P || VIEWER || ADMINVIEW || !action) return;
  let q = []; try { q = store.get('drs_actq', []); } catch (e) {}
  const last = q[q.length - 1], now = Date.now();
  if (last && last.pid === P.id && last.a.replace(/ ×\d+$/, '') === action && now - last.t < 15000) { const n = (+(last.a.match(/×(\d+)$/) || [0, 1])[1]) + 1; last.a = `${action} ×${n}`; last.t = now; }
  else q.push({ pid: P.id, pn: P.name, a: action, t: now });
  if (q.length > 500) q = q.slice(-500);
  store.set('drs_actq', q);
}
{ const _c = commit; commit = function (skip) { const b = batch; _c(skip); if (!skip && !b && undoMeta.length) queueAct(undoMeta[undoMeta.length - 1].l); }; }
{ const _o = openProject; let lastOpen = null; openProject = function (p) { _o(p); if (P && P.id !== lastOpen) { lastOpen = P.id; queueAct('프로젝트 열기'); } }; }
async function flushAct() {
  const q = store.get('drs_actq', []); if (!q.length || !SYNC.cfg.access) return;
  try { await sbFetch('/rest/v1/activity', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(q.map((x) => ({ project_id: x.pid, project_name: x.pn, action: x.a, at: new Date(x.t).toISOString() }))) }); store.set('drs_actq', []); }
  catch (e) { /* 표가 아직 없거나 연결이 끊김: 다음 동기화 때 다시 */ }
}
let BLOCKED = false;
{ const _sn = syncNow;
  syncNow = async function (quiet) {
    if (!SYNC.cfg.access || SYNC.busy) return _sn(quiet);
    try { const r = await (await sbFetch(`/rest/v1/blocked?user_id=eq.${SYNC.cfg.user}&select=reason`)).json(); BLOCKED = !!(r && r.length); if (BLOCKED) { const m = '관리자가 이 계정의 동기화를 막았어요' + (r[0].reason ? ` · ${r[0].reason}` : ''); $('#syncMsg').textContent = m; if (!quiet) toast(m); return; } } catch (e) {}
    await _sn(quiet); await flushAct(); renderAdminBtn();
  }; }

/* ---------- 관리자 화면 ---------- */
function renderAdminBtn() { const b = $('#adminBtn'); if (b) b.hidden = !isAdminUser(); const m = $('#adminMM'); if (m) m.hidden = !isAdminUser(); }
let AD = { tab: 'users', users: [], acts: [], projs: [], who: '' };
const fmtT = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
async function adminLoad() {
  const st = $('#adStatus'); st.textContent = '불러오는 중…';
  try {
    const [u, a, p] = await Promise.all([
      sbFetch('/rest/v1/rpc/admin_users', { method: 'POST', body: '{}' }).then((r) => r.json()),
      sbFetch('/rest/v1/activity?select=*&order=at.desc&limit=400').then((r) => r.json()),
      sbFetch('/rest/v1/projects?select=id,name,user_id,updated_at&name=neq.__mylib&order=updated_at.desc&limit=400').then((r) => r.json()),
    ]);
    AD.users = u; AD.acts = a; AD.projs = p; st.textContent = `사용자 ${u.length}명 · 프로젝트 ${p.length}개 · 최근 작업 ${a.length}건`; renderAdmin();
  } catch (e) { st.textContent = '불러오지 못했어요: ' + netMsg(e) + ' · supabase/schema.sql(v8)을 SQL Editor에서 한 번 더 Run 했는지 확인하세요.'; }
}
function openAdmin() { if (!isAdminUser()) { toast('관리자 계정으로 로그인해야 열려요'); return; } $('#adminDlg').showModal(); renderAdmin(); adminLoad(); }
function renderAdmin() {
  $$('[data-adt]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.adt === AD.tab));
  const em = (id) => (AD.users.find((u) => u.id === id) || {}).email || id.slice(0, 8), box = $('#adBody');
  if (AD.tab === 'users') box.innerHTML = AD.users.length ? `<table class="adt"><thead><tr><th>이메일</th><th>가입</th><th>마지막 로그인</th><th>마지막 작업</th><th class="num">프로젝트</th><th>상태</th><th></th></tr></thead><tbody>${AD.users.map((u) => `<tr><td>${esc(u.email)}${u.email.toLowerCase() === ADMIN_EMAIL ? ' <span class="pill work">관리자</span>' : ''}</td><td>${fmtT(u.created_at)}</td><td>${fmtT(u.last_sign_in_at)}</td><td>${fmtT(u.last_action)}</td><td class="num">${u.projects}</td><td>${u.blocked ? '<span class="pill bad">차단</span>' : '<span class="pill ok">사용 중</span>'}</td><td class="adact"><button class="qb" data-adwho="${esc(u.email)}">기록</button>${u.email.toLowerCase() === ADMIN_EMAIL ? '' : u.blocked ? `<button class="qb" data-adun="${u.id}">차단 풀기</button>` : `<button class="qb danger" data-adblk="${u.id}" data-em="${esc(u.email)}">차단</button>`}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">아직 사용자가 없어요.</p>';
  if (AD.tab === 'acts') { const L = AD.acts.filter((a) => !AD.who || a.email === AD.who); box.innerHTML = `<div class="row" style="align-items:center"><select id="adWho" class="tg2" aria-label="사용자 거르기"><option value="">모든 사용자</option>${[...new Set(AD.acts.map((a) => a.email))].map((e) => `<option ${e === AD.who ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select><span class="hint">${L.length}건 · 최근 400건까지</span></div>` + (L.length ? `<table class="adt"><thead><tr><th>시각</th><th>사용자</th><th>프로젝트</th><th>작업</th></tr></thead><tbody>${L.map((a) => `<tr><td>${fmtT(a.at)}</td><td>${esc(a.email || '')}</td><td>${esc(a.project_name || '')}</td><td>${esc(a.action)}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">기록이 없어요. 사용자가 작업 후 동기화하면 쌓여요.</p>'); const w = $('#adWho'); if (w) w.onchange = (e) => { AD.who = e.target.value; renderAdmin(); }; }
  if (AD.tab === 'projs') box.innerHTML = AD.projs.length ? `<table class="adt"><thead><tr><th>프로젝트</th><th>만든 사람</th><th>마지막 저장</th><th></th></tr></thead><tbody>${AD.projs.map((p) => `<tr><td>${esc(p.name || '(이름 없음)')}</td><td>${esc(em(p.user_id))}</td><td>${fmtT(p.updated_at)}</td><td class="adact"><button class="qb" data-adopen="${esc(p.id)}">보기</button></td></tr>`).join('')}</tbody></table>` : '<p class="hint">프로젝트가 없어요.</p>';
}
$('#adminDlg').addEventListener('click', async (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.adt) { AD.tab = t.dataset.adt; renderAdmin(); }
  if (t.id === 'adReload') adminLoad();
  if (t.dataset.adwho) { AD.who = t.dataset.adwho; AD.tab = 'acts'; renderAdmin(); }
  if (t.dataset.adblk) {
    if (!t.dataset.sure) { t.dataset.sure = 1; t.textContent = '정말 차단?'; return; }
    try { await sbFetch('/rest/v1/blocked', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: t.dataset.adblk, email: t.dataset.em, reason: '관리자 차단' }) }); toast(`${t.dataset.em} 차단 · 다음 동기화부터 막혀요`); adminLoad(); } catch (er) { toast('차단하지 못했어요: ' + netMsg(er)); }
  }
  if (t.dataset.adun) { try { await sbFetch(`/rest/v1/blocked?user_id=eq.${t.dataset.adun}`, { method: 'DELETE' }); toast('차단을 풀었어요'); adminLoad(); } catch (er) { toast('풀지 못했어요: ' + netMsg(er)); } }
  if (t.dataset.adopen) {
    try { const row = (await (await sbFetch(`/rest/v1/projects?id=eq.${encodeURIComponent(t.dataset.adopen)}&select=*`)).json())[0]; if (!row) throw new Error('없는 프로젝트');
      const keepLast = store.get('drs_last'); saveProject(true); ADMINVIEW = true; VIEWER = { admin: true }; document.body.classList.add('viewer', 'nocomment', 'adminview');
      const p = row.data; p.id = 'admin-view-' + row.id; openProject(p); store.set('drs_last', keepLast); $('#adminDlg').close(); $('#adViewName').textContent = `${row.name} · ${(AD.users.find((u) => u.id === row.user_id) || {}).email || ''}`; $('#adView').hidden = false; toast('관리자 보기 · 고쳐도 저장되지 않아요');
    } catch (er) { toast('열지 못했어요: ' + netMsg(er)); }
  }
});
$('#adViewExit').onclick = () => location.reload();
$('#adminBtn').onclick = openAdmin;
{ const mm = $('#moreMenu'); mm.insertAdjacentHTML('afterbegin', '<button data-mm="admin" id="adminMM" hidden><b>관리자</b><small>사용자 · 작업 기록 · 차단</small></button>'); mm.addEventListener('click', (e) => { if (e.target.closest('[data-mm="admin"]')) { e.stopImmediatePropagation(); mm.hidden = true; openAdmin(); } }, true); }
{ const _rs = renderSync; renderSync = function () { _rs(); renderAdminBtn(); }; }
renderAdminBtn();
