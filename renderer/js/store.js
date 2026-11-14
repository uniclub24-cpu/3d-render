// 프로젝트 보관함: 이 기기(IndexedDB) 자동 저장 + 계정 동기화(기존 앱 계정 · Supabase Storage)
//
// · 고칠 때마다 1초 뒤 이 기기에 자동 저장 (앱을 닫거나 폰이 정리해도 남음) — 다시 켜면 마지막 프로젝트가 열린다
// · 로그인돼 있으면 저장 뒤 몇 초 안에 계정으로 올리고, 다른 기기에서 고친 것은 내려받는다
// · 계정 쪽 저장 위치: Storage 버킷 models / <내 사용자 ID>/byr2/  (본인만 읽고 쓰는 규칙이 이미 걸린 곳)
//   기존 앱의 projects 표에는 쓰지 않는다 → 기존 앱이 새 형식을 열다 깨지는 일이 없다
// · 양쪽에서 같은 프로젝트를 동시에 고친 경우: 둘 다 남긴다 ("충돌 사본")
import { SB, session, sbFetch } from './cloud.js';

const DB = 'byr2', ST = 'projects';
let dbp = null;
const db = () => (dbp ||= new Promise((ok, no) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction(ST, mode), s = t.objectStore(ST); let out; Promise.resolve(fn(s)).then((v) => (out = v)); t.oncomplete = () => ok(out); t.onerror = () => no(t.error); }); };
const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const ls = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

/* ---------- 이 기기 ---------- */
export async function getRec(id) { return tx('readonly', (s) => req(s.get(id))); }
async function putRec(rec) { return tx('readwrite', (s) => req(s.put(rec))); }
async function delRec(id) { return tx('readwrite', (s) => req(s.delete(id))); }
async function allRecs() { return tx('readonly', (s) => req(s.getAll())); }
/** 저장: updated 를 지금으로 (synced 는 그대로 → 올릴 것이 생김) */
export async function saveLocal(model, opt = {}) {
  const prev = await getRec(model.id), data = JSON.stringify(model), now = opt.updated || Math.max(Date.now(), prev ? (prev.updated || 0) + 1 : 0);
  if (prev && !prev.deleted && prev.data === data && !opt.updated) { ls.set('byr.last', model.id); return prev.updated; } // 바뀐 게 없으면 시각도 그대로 (동기화가 서로 주고받지 않게)
  const own = prev && prev.owner !== undefined ? prev.owner : session() ? session().user : null; /* 계정별로 나눔: 로그인 없이 만든 것은 null(게스트) */
  await putRec({ id: model.id, name: model.name, updated: now, synced: opt.synced ?? (prev ? prev.synced || 0 : 0), dirty: opt.dirty ?? true, deleted: false, owner: own, data }); // dirty: 마지막 동기화 뒤 이 기기에서 고침
  ls.set('byr.last', model.id); return now;
}
export async function loadLocal(id) { const r = await getRec(id); return r && !r.deleted ? JSON.parse(r.data) : null; }
export async function listLocal() { const me = session() ? session().user : null; return (await allRecs()).filter((r) => !r.deleted).map(({ id, name, updated, synced, dirty, data, owner }) => ({ id, name, updated, synced, dirty: dirty ?? updated > (synced || 0), size: data.length, other: !!(owner && owner !== me) })).sort((a, b) => b.updated - a.updated); }
/** 지우기: 계정에 올린 적이 있으면 "지움 표시"를 남겨 다음 동기화 때 계정에서도 지운다 */
export async function removeLocal(id) { const r = await getRec(id); if (!r) return; if (r.synced) await putRec({ ...r, deleted: true, dirty: true, updated: Math.max(Date.now(), (r.updated || 0) + 1), data: '{}' }); else await delRec(id); if (ls.get('byr.last') === id) ls.set('byr.last', null); }
export const lastId = () => ls.get('byr.last', null);

/* ---------- 자동 저장 ---------- */
let saveT = 0, pending = null, status = () => {};
export function onStatus(fn) { status = fn; }
/** 고칠 때마다 부른다. 1초 동안 더 고치지 않으면 저장 → 로그인돼 있으면 5초 뒤 동기화 */
export function autosave(model) {
  pending = model; clearTimeout(saveT); status('저장 대기');
  saveT = setTimeout(flush, 1000);
}
/** 저장. 성공 true · 실패하면 다시 시도 줄에 남기고 false (3초 뒤 자동 재시도) */
export async function flush() {
  clearTimeout(saveT); if (!pending) return true; const m = pending; pending = null;
  try { await saveLocal(m); saveFail = 0; status('이 기기에 저장됨'); if (session()) scheduleSync(5000); return true; }
  catch (e) { console.error(e); if (!pending) pending = m; saveFail++; status(`⚠ 저장 실패 (${saveFail}회) · ${e.message || e} · 자동으로 다시 시도해요`); saveT = setTimeout(flush, Math.min(30000, 3000 * saveFail)); return false; }
}
let saveFail = 0;
export const saveFailed = () => saveFail > 0 || !!pending;
// 앱을 닫거나 뒤로 보낼 때 바로 저장
addEventListener('pagehide', () => { flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

/* ---------- 계정 동기화 ---------- */
const dir = () => `${session().user}/byr2/`;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
async function sget(name) { const r = await sbFetch('/storage/v1/object/authenticated/models/' + enc(dir() + name), { allow404: true }); return r.status === 404 || r.status === 400 ? null : r.text(); }
async function sput(name, text) { await sbFetch('/storage/v1/object/models/' + enc(dir() + name), { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: text }); }
/* 큰 프로젝트(가져온 3D · 텍스처)는 gzip 으로 줄여 올린다 → <id>.json.gz (목록에 gz 표시) */
const GZ_AT = 4e6;
async function gz(text) { const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function gunz(bytes) { const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')); return new Response(s).text(); }
async function putProject(id, text) {
  if (text.length < GZ_AT || typeof CompressionStream === 'undefined') { await sput(id + '.json', text); return false; }
  const b = await gz(text); if (b.length > 48e6) throw new Error(`프로젝트가 너무 커요 (${(b.length / 1e6).toFixed(0)}MB · 계정 한도 50MB) · 가져온 3D 파일이나 텍스처를 줄여 주세요`);
  await sbFetch('/storage/v1/object/models/' + enc(dir() + id + '.json.gz'), { method: 'POST', headers: { 'Content-Type': 'application/gzip', 'x-upsert': 'true' }, body: b }); return true;
}
async function getProject(id, r) {
  if (!r || !r.gz) return sget(id + '.json');
  const x = await sbFetch('/storage/v1/object/authenticated/models/' + enc(dir() + id + '.json.gz'), { allow404: true }); if (x.status === 404 || x.status === 400) return null; return gunz(new Uint8Array(await x.arrayBuffer()));
}
async function sdel(name) { await sbFetch('/storage/v1/object/models', { method: 'DELETE', body: JSON.stringify({ prefixes: [dir() + name] }) }); }
let syncT = 0, syncing = null;
export function scheduleSync(ms = 3000) { clearTimeout(syncT); syncT = setTimeout(() => syncNow().catch(() => {}), ms); }
/** 양방향 동기화. 결과: { up, down, del, conflict } */
export function syncNow() { return (syncing ||= doSync().finally(() => (syncing = null))); }
async function doSync() {
  if (!session()) return { skipped: true }; const uid = session().user;
  status('동기화 중…'); await flush();
  const res = { up: 0, down: 0, del: 0, conflict: 0, changed: [], err: [] };
  try {
    const txt = await sget('_index.json'); const idx = txt ? JSON.parse(txt) : {}; let idxDirty = false;
    const recs = await allRecs(), seen = new Set(), done = [];
    /* 받은 것 쓰기 · 단, 동기화하는 사이 이 기기에서 또 고쳤으면 건너뜀 (다음 동기화 때 충돌로 처리) */
    const putIfSame = async (id, upd, rec2) => { const cur = await getRec(id); if (cur && upd != null && cur.updated !== upd) return false; await putRec({ ...rec2, owner: uid }); return true; };
    for (const rec of recs) {
      seen.add(rec.id); if (rec.owner && rec.owner !== uid) continue; /* 다른 계정 작업은 이 계정에 섞지 않음 */ const r = idx[rec.id];
      const edited = rec.dirty ?? rec.updated > (rec.synced || 0);              // 마지막 동기화 뒤 이 기기에서 고쳤나
      const changed = !!r && (r.deleted || r.updated !== rec.synced);          // 마지막 동기화 뒤 계정 쪽이 바뀌었나 (시계가 달라도 안전하게 "같은지"로 본다)
      const up = async () => { let g; try { g = await putProject(rec.id, rec.data); } catch (e) { res.err.push(`${rec.name}: ${e.message || e}`); return; } idx[rec.id] = { name: rec.name, updated: rec.updated, ...(g ? { gz: true } : {}) }; idxDirty = true; res.up++;
        /* 목록(_index)까지 올라간 뒤에 "올림" 확정 · 올리는 사이 새로 고친 내용은 덮지 않고 dirty 로 둔다 */
        done.push(async () => { const cur = await getRec(rec.id); if (!cur) return; await putRec({ ...cur, owner: uid, synced: rec.updated, dirty: cur.updated !== rec.updated }); }); };
      if (rec.deleted) { // 이 기기에서 지움
        if (!r || !changed || r.deleted) { if (r && !r.deleted) await sdel(r.gz ? rec.id + '.json.gz' : rec.id + '.json').catch(() => {}); idx[rec.id] = { name: rec.name, updated: rec.updated, deleted: true }; idxDirty = true; res.del++; await delRec(rec.id); }
        else { // 지웠는데 다른 기기에서 그 사이 고침 → 고친 쪽을 살린다
          const data = await getProject(rec.id, r); if (data && await putIfSame(rec.id, rec.updated, { id: rec.id, name: r.name, updated: r.updated, synced: r.updated, dirty: false, deleted: false, data })) res.down++; }
        continue;
      }
      if (!r) { await up(); continue; }
      if (!changed) { if (edited) await up(); continue; }
      if (r.deleted) { if (edited) await up(); else { const cur = await getRec(rec.id); if (cur && cur.updated === rec.updated) { await delRec(rec.id); res.del++; res.changed.push(rec.id); } } continue; }
      const data = await getProject(rec.id, r); if (!data) { if (edited) await up(); continue; }
      if (edited) { // 양쪽에서 고침 → 이 기기 것을 "충돌 사본"으로 남기고 계정 것을 받는다
        const mine = JSON.parse(rec.data), cid = 'p' + Math.random().toString(36).slice(2, 9); mine.id = cid; mine.name = `${mine.name} (충돌 사본)`;
        await putRec({ id: cid, name: mine.name, updated: Date.now(), synced: 0, dirty: true, deleted: false, owner: uid, data: JSON.stringify(mine) }); res.conflict++;
      }
      if (await putIfSame(rec.id, rec.updated, { id: rec.id, name: r.name, updated: r.updated, synced: r.updated, dirty: false, deleted: false, data })) { res.down++; res.changed.push(rec.id); }
    }
    for (const [id, r] of Object.entries(idx)) { // 계정에만 있는 것
      if (seen.has(id) || r.deleted) continue; const data = await getProject(id, r); if (!data) continue;
      if (await putIfSame(id, null, { id, name: r.name, updated: r.updated, synced: r.updated, dirty: false, deleted: false, data })) res.down++;
    }
    if (res.conflict) scheduleSync(500); // 충돌 사본도 올린다
    if (!session() || session().user !== uid) throw new Error('동기화 중에 계정이 바뀌어 멈췄어요'); /* 계정 전환 */
    if (idxDirty) await sput('_index.json', JSON.stringify(idx));
    for (const f of done) await f();
    ls.set('byr.syncAt', Date.now());
    status(res.err.length ? `일부 못 올림 · ${res.err[0]}` : `동기화됨 · ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
  } catch (e) { console.warn('[sync]', e); status('동기화 실패 · ' + (e.message || e)); throw e; }
  return res;
}
export const lastSync = () => ls.get('byr.syncAt', 0);
export { SB };
