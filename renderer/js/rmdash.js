// 블렌더 실사 · 재질 점검 대시보드: 공간 → 기물(세트) → 세부 → 텍스처 → 미리보기 → 크기·받기
// 렌더 전에 한눈에 확인 · 바꾸고 "이대로 렌더 시작". 기물 속성의 🎨 실사 재질 버튼으로 기물 하나만 열 수도 있다.
import * as RM from './realmat.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ST = { manual: ['매뉴얼', 'm'], auto: ['자동', 'a'], brand: ['브랜드 전용', 'b'], check: ['⚠ 확인 필요', 'w'], set: ['직접', 's'] };
const MB = 15; /* 2K 재질 한 벌 대략 */

export function openDash(H, { onGo = null, only = null } = {}) {
  const { S, engine, level, toast, commit } = H; let rows = [], tab = '전체', sort = 'space', byMat = false, cached = {}, detail = null, catErr = null;
  document.getElementById('rmDash')?.remove(); const box = document.createElement('div'); box.id = 'rmDash'; box.className = 'rmdash'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '블렌더 실사 재질 점검'); document.body.appendChild(box);
  const close = () => { box.remove(); removeEventListener('keydown', onKey, true); }; const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (box.querySelector('.rm-pick')) { box.querySelector('.rm-pick').remove(); return; } if (detail) { detail = null; draw(); return; } close(); } }; addEventListener('keydown', onKey, true);
  const scan = async () => { rows = await engine.withRealMaterials(async () => RM.buildRows(engine, S, level())); if (only) rows = rows.filter((r) => r.key === only || r.objs.includes(only)); };
  const label = (v) => (v === 'keep' ? 'BYR 그대로' : v === 'proc' ? 'BYR 재질 (계산 무늬)' : !v ? '— 고르세요' : (RM.asset(v) || { name: v }).name);
  const ids = () => { const s = new Set(); for (const r of rows) for (const p of r.parts) { const v = RM.resolve(r, p).v; if (v && v !== 'keep' && v !== 'proc') s.add(v); } return [...s]; };
  const refreshCache = async () => { if (window.byr && window.byr.texCached) { try { cached = await window.byr.texCached(ids()); } catch {} } };
  const thumbInto = (el, id, big) => { if (!id || id === 'keep' || id === 'proc') return; RM.thumb(id, big).then((u) => { if (u && el.isConnected) el.style.backgroundImage = `url("${u}")`; }); };
  function sorted() {
    let list = rows.slice(); if (tab === '⚠') list = list.filter((r) => r.parts.some((p) => RM.resolve(r, p).st === 'check')); else if (tab !== '전체') list = list.filter((r) => r.space === tab || r.space.startsWith(tab + ' '));
    const nm = (r) => r.name + (r.setNo ? ' ' + r.setNo : ''), tx = (r) => label(RM.resolve(r, r.parts[0] || {}).v);
    const kindRank = { room: 0, wall: 1, ceil: 2, item: 3 };
    list.sort(sort === 'name' ? (a, b) => nm(a).localeCompare(nm(b), 'ko') : sort === 'tex' ? (a, b) => tx(a).localeCompare(tx(b)) : sort === 'count' ? (a, b) => b.count - a.count : (a, b) => RM.spaceRank(a.space) - RM.spaceRank(b.space) || a.space.localeCompare(b.space, 'ko') || kindRank[a.kind] - kindRank[b.kind] || nm(a).localeCompare(nm(b), 'ko'));
    return list;
  }
  function texCell(r, p) { const R = RM.resolve(r, p), st = ST[R.st] || ST.auto; return `<button class="rm-sel" data-pick="${esc(r.key)}" data-pk="${esc(p.pk)}">${esc(label(R.v))} ▾</button><span class="rm-tag ${st[1]}">${st[0]}${R.code ? ' ' + R.code : ''}</span>`; }
  function sizeCell(r, p) { const v = RM.resolve(r, p).v; if (!v || v === 'keep' || v === 'proc') return '—'; return `2K · ${(RM.realSize(v)).toFixed(1)}m${cached[v] ? ' · 받음' : ''}`; }
  function draw() {
    const list = sorted(), spaces = [...new Set(rows.map((r) => r.space.split(' | ')[0]))].sort((a, b) => RM.spaceRank(a) - RM.spaceRank(b) || a.localeCompare(b, 'ko'));
    const nParts = rows.reduce((s, r) => s + r.parts.length, 0), nCheck = rows.reduce((s, r) => s + r.parts.filter((p) => RM.resolve(r, p).st === 'check').length, 0), nBrand = rows.reduce((s, r) => s + r.parts.filter((p) => RM.resolve(r, p).st === 'brand').length, 0), nObj = rows.reduce((s, r) => s + r.count, 0);
    const I = ids(), need = I.filter((i) => !cached[i]), q = H.quality ? H.quality() : { samples: 192, w: 1920, h: 1080 }, sec = Math.round(q.samples * ((q.w * q.h) / 2.07e6) * 0.9 * (1 + I.length * 0.02));
    let body = '';
    if (byMat) { /* 같은 재질끼리 */
      const g = new Map(); for (const r of rows) for (const p of r.parts) { const v = RM.resolve(r, p).v || '?'; if (!g.has(v)) g.set(v, []); g.get(v).push([r, p]); }
      body = [...g.entries()].sort((a, b) => b[1].length - a[1].length).map(([v, arr]) => `<tr class="g"><td colspan="6"><span class="rm-th" data-th="${esc(v)}"></span> ${esc(label(v === '?' ? null : v))} <span class="n">· ${arr.length}곳</span> <button class="rm-sel sm" data-pickall="${esc(v)}">이 재질 쓰는 곳 모두 바꾸기 ▾</button></td></tr>` + arr.map(([r, p]) => `<tr><td>${esc(r.space)}</td><td>${esc(r.name)}${r.setNo ? ` <span class="rm-set">세트${r.setNo}</span>` : ''} <span class="n">× ${r.count}</span></td><td>${esc(p.label)}</td><td>${texCell(r, p)}</td><td><span class="rm-th" data-th="${esc(RM.resolve(r, p).v || '')}" data-big="${esc(RM.resolve(r, p).v || '')}"></span></td><td class="n">${sizeCell(r, p)}</td></tr>`).join('')).join('');
    } else {
      let lastSp = null;
      for (const r of list) {
        if (sort === 'space' && r.space !== lastSp) { lastSp = r.space; body += `<tr class="g"><td colspan="6">${esc(r.space)}</td></tr>`; }
        r.parts.forEach((p, i) => { const v = RM.resolve(r, p).v; body += `<tr${i ? ' class="sub"' : ''}><td>${i ? '' : esc(r.space)}</td><td>${i ? '' : `<span class="rm-nm">${esc(r.name)}</span>${r.setNo ? ` <span class="rm-set">세트${r.setNo}</span>` : ''} <span class="n">× ${r.count}</span> ${r.kind === 'ceil' ? '' : `<button class="rm-ren" data-ren="${esc(r.key)}" title="세트 이름 바꾸기" aria-label="세트 이름 바꾸기">✎</button>`}${r.parts.length > 1 && !i ? '' : ''}`}</td><td>${esc(p.label)}${p.color ? ` <i class="rm-dot" style="background:${esc(p.color)}"></i>` : ''}</td><td>${texCell(r, p)}</td><td><span class="rm-th" data-th="${esc(v || '')}" data-big="${esc(v || '')}" role="button" tabindex="0" aria-label="미리보기 크게"></span></td><td class="n">${sizeCell(r, p)}</td></tr>`; });
      }
    }
    box.innerHTML = `<div class="rm-in"><div class="rm-hd"><b>🎬 블렌더 실사 · 재질 점검</b><span class="rm-pill">세트 ${rows.length} · 부분 ${nParts} · 기물 ${nObj}</span>${nCheck ? `<span class="rm-pill w">⚠ 확인 필요 ${nCheck}</span>` : ''}${nBrand ? `<span class="rm-pill r">브랜드 전용(그대로) ${nBrand}</span>` : ''}<span class="sp"></span>
      <button class="rm-b" data-a="bymat" aria-pressed="${byMat}">${byMat ? '공간별로 보기' : '같은 재질끼리 보기'}</button><button class="rm-b" data-a="x" aria-label="닫기">✕</button></div>
      ${catErr ? `<p class="rm-err">재질 목록(Poly Haven)을 못 받았어요 · 인터넷을 확인해 주세요. 지금은 BYR 재질로 렌더해요. <small>${esc(catErr)}</small></p>` : ''}
      ${only ? '' : `<div class="rm-tabs">${['전체', ...spaces, '⚠'].map((t) => `<button data-tab="${esc(t)}" aria-pressed="${tab === t}">${t === '⚠' ? '⚠ 확인 필요만' : esc(t)}</button>`).join('')}</div>`}
      <div class="rm-tw"><table><thead><tr><th data-sort="space">공간</th><th data-sort="name">기물 · 세트 ↕</th><th>세부</th><th data-sort="tex">텍스처 (Poly Haven · CC0) ↕</th><th>미리보기</th><th data-sort="count">크기 · 받기 ↕</th></tr></thead><tbody>${body || '<tr><td colspan="6" class="n">표시할 기물이 없어요</td></tr>'}</tbody></table></div>
      <div class="rm-ft"><span>받을 재질 <b>${need.length}종 · 약 ${need.length * MB}MB</b>${I.length - need.length ? ` (이미 받음 ${I.length - need.length}종)` : ''}</span>${onGo ? `<span>예상 렌더 <b>약 ${Math.max(1, Math.round(sec / 60))}분</b> <small>(그래픽카드에 따라 달라요)</small></span>` : ''}<span class="sp"></span>
        ${window.byr && window.byr.texDir ? '<button class="rm-b" data-a="dir">재질 보관 폴더</button>' : ''}<button class="rm-b" data-a="save">재질 목록 저장</button>${onGo ? '<button class="rm-b pri" data-a="go">✓ 이대로 렌더 시작</button>' : '<button class="rm-b pri" data-a="x">닫기</button>'}</div>
      ${detail ? detailHtml() : ''}<p class="rm-cc">재질: <a href="https://polyhaven.com" target="_blank" rel="noopener">Poly Haven</a> (CC0)</p></div>`;
    box.querySelectorAll('.rm-th').forEach((el) => { thumbInto(el, el.dataset.th); el.onclick = el.onkeydown = (e) => { if (e.type === 'keydown' && e.key !== 'Enter') return; const v = el.dataset.big || el.dataset.th; if (v && v !== 'keep' && v !== 'proc' && v !== '?') { detail = v; draw(); } }; });
    box.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    box.querySelectorAll('[data-sort]').forEach((b) => (b.onclick = () => { sort = sort === b.dataset.sort ? 'space' : b.dataset.sort; draw(); }));
    box.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const r = rows.find((x) => x.key === b.dataset.pick), p = r.parts.find((x) => x.pk === b.dataset.pk); picker(b, [[r, p]], RM.resolve(r, p)); }));
    box.querySelectorAll('[data-pickall]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const v = b.dataset.pickall, arr = []; for (const r of rows) for (const p of r.parts) if ((RM.resolve(r, p).v || '?') === v) arr.push([r, p]); picker(b, arr, { v: v === '?' ? null : v }); }));
    box.querySelectorAll('[data-ren]').forEach((b) => (b.onclick = () => { const r = rows.find((x) => x.key === b.dataset.ren), td = b.parentElement; td.innerHTML = `<input class="rm-in-name" value="${esc(r.name)}" aria-label="세트 이름">`; const i = td.querySelector('input'); i.focus(); i.select(); const done = () => { RM.setSetName(r, i.value.trim() && i.value.trim() !== r.base ? i.value.trim() : ''); commit(); rescan(); }; i.onkeydown = (e) => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { e.stopPropagation(); draw(); } }; i.onblur = done; }));
    box.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => { const a = b.dataset.a;
      if (a === 'x') close(); else if (a === 'bymat') { byMat = !byMat; draw(); } else if (a === 'dir') window.byr.texDir(); else if (a === 'save') { commit(); toast('재질 지정을 프로젝트에 저장했어요 (저장하기를 누르면 파일에도)'); }
      else if (a === 'go') { const c = rows.reduce((s, r) => s + r.parts.filter((p) => RM.resolve(r, p).st === 'check').length, 0); if (c && !b.dataset.ok) { b.dataset.ok = 1; b.textContent = `⚠ ${c}곳은 BYR 재질로 · 그래도 시작`; return; } close(); onGo && onGo(); }
      else if (a === 'dx') { detail = null; draw(); } }));
    box.querySelectorAll('[data-sim]').forEach((el) => { thumbInto(el, el.dataset.sim); el.onclick = () => { detail = el.dataset.sim; draw(); }; });
    const bigEl = box.querySelector('.rm-big'); if (bigEl) thumbInto(bigEl, detail, true);
  }
  function detailHtml() { const a = RM.asset(detail) || { name: detail, cats: [], tags: [] }; return `<aside class="rm-side" aria-label="재질 미리보기"><div class="rm-sh"><b>${esc(a.name)}</b><button class="rm-b sm" data-a="dx" aria-label="닫기">✕</button></div><div class="rm-big"></div><p class="n">Poly Haven · CC0 · 실제 크기 약 ${RM.realSize(detail).toFixed(1)}m · ${esc((a.cats || []).slice(0, 3).join(', '))}</p><p class="n">렌더할 때 2K 로 받아 PC 에 보관해요. 매뉴얼 색이 정해진 부분은 무늬는 사진 · 색은 지정 색으로 맞춰요.</p><div class="sec">비슷한 재질</div><div class="rm-simg">${RM.similar(detail).map((s) => `<span class="rm-th lg" data-sim="${esc(s.id)}" title="${esc(s.name)}" role="button" tabindex="0"></span>`).join('')}</div></aside>`; }
  /** 재질 고르기: 검색 + 그림 목록 + BYR 그대로 / BYR 재질 / 자동 추천 */
  function picker(anchor, targets, cur) {
    box.querySelector('.rm-pick')?.remove(); const [r0, p0] = targets[0], sg = RM.suggest(RM.ctxOf(r0, p0)); const pk = document.createElement('div'); pk.className = 'rm-pick'; pk.setAttribute('role', 'dialog');
    pk.innerHTML = `<div class="rm-pq"><input type="search" placeholder="찾기 (예: wood, tiles, leather, metal)" value="${esc(sg.q || '')}" aria-label="재질 찾기"><span class="n">${targets.length > 1 ? `${targets.length}곳에 적용` : ''}</span></div>
      <div class="rm-pb"><button class="rm-b sm" data-v="__auto">자동 추천${sg.v && sg.v !== 'keep' && sg.v !== 'proc' ? ' (' + esc(label(sg.v)) + ')' : ''}</button><button class="rm-b sm" data-v="keep">BYR 그대로</button><button class="rm-b sm" data-v="proc">BYR 재질 (계산 무늬)</button></div><div class="rm-pg"></div>`;
    box.querySelector('.rm-in').appendChild(pk); const r = anchor.getBoundingClientRect(), br = box.querySelector('.rm-in').getBoundingClientRect(); pk.style.left = Math.min(br.width - 470, Math.max(8, r.left - br.left)) + 'px'; pk.style.top = Math.min(br.height - 380, r.bottom - br.top + 4) + 'px';
    const grid = pk.querySelector('.rm-pg'), inp = pk.querySelector('input');
    const fill = () => { const list = RM.search(inp.value, 30); grid.innerHTML = list.length ? list.map((a) => `<button class="rm-pc" data-v="${esc(a.id)}" aria-pressed="${cur && cur.v === a.id}" title="${esc(a.name)}"><span class="rm-th lg" data-th="${esc(a.id)}"></span><small>${esc(a.name)}</small></button>`).join('') : `<p class="n">${catErr ? '재질 목록을 못 받았어요' : '찾는 재질이 없어요'}</p>`; grid.querySelectorAll('.rm-th').forEach((el) => thumbInto(el, el.dataset.th)); bind(); };
    const bind = () => pk.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { const v = b.dataset.v; for (const [r, p] of targets) RM.setAssign(r, p.pk, v === '__auto' ? undefined : v); commit(); pk.remove(); rescan(); }));
    inp.oninput = fill; fill(); setTimeout(() => inp.focus(), 30);
    setTimeout(() => { const off = (e) => { if (!pk.contains(e.target)) { pk.remove(); removeEventListener('pointerdown', off, true); } }; addEventListener('pointerdown', off, true); }, 0);
  }
  const rescan = async () => { await scan(); await refreshCache(); draw(); };
  box.innerHTML = '<div class="rm-in"><p class="n" style="padding:24px">재질 목록 · 기물 정리 중…</p></div>';
  (async () => { try { await RM.catalog(); } catch (e) { catErr = e.message || String(e); } await rescan(); })();
}
