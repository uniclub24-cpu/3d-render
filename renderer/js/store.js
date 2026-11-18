// 프로젝트 보관함: 이 기기(IndexedDB) 자동 저장 + 계정 동기화(기존 앱 계정 · Supabase Storage)
//
// · 고칠 때마다 1초 뒤 이 기기에 자동 저장 (앱을 닫거나 폰이 정리해도 남음) — 다시 켜면 마지막 프로젝트가 열린다
// · 로그인돼 있으면 저장 뒤 몇 초 안에 계정으로 올리고, 다른 기기에서 고친 것은 내려받는다
// · 계정 쪽 저장 위치: Storage 버킷 models / <내 사용자 ID>/byr2/  (본인만 읽고 쓰는 규칙이 이미 걸린 곳)
//   기존 앱의 projects 표에는 쓰지 않는다 → 기존 앱이 새 형식을 열다 깨지는 일이 없다
// · 양쪽에서 같은 프로젝트를 동시에 고친 경우: 둘 다 남긴다 ("충돌 사본")
import { SB, session, sbFetch, SECRET_RE } from './cloud.js';

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
export async function listLocal() { const me = session() ? session().user : null; return (await allRecs()).filter((r) => !r.deleted && !isDraft(r.id)).map(({ id, name, updated, synced, dirty, data, owner }) => ({ id, name, updated, synced, dirty: dirty ?? updated > (synced || 0), size: data.length, other: !!(owner && owner !== me) })).sort((a, b) => b.updated - a.updated); }
/** 지우기: 계정에 올린 적이 있으면 "지움 표시"를 남겨 다음 동기화 때 계정에서도 지운다 */
export async function removeLocal(id) { const r = await getRec(id); if (!r) return; if (r.synced) await putRec({ ...r, deleted: true, dirty: true, updated: Math.max(Date.now(), (r.updated || 0) + 1), data: '{}' }); else await delRec(id); if (ls.get('byr.last') === id) ls.set('byr.last', null); }
export const lastId = () => ls.get('byr.last', null);

/* ---------- 저장 (2.1.32~): 고칠 때는 '임시 복구본'만, 프로젝트는 [저장] 을 눌렀을 때만 덮어쓴다 ----------
 * 임시 복구본(draft:<id>) = 앱이 꺼지거나 튕겨도 고친 내용을 살리기 위한 것. 목록에는 안 보이고, 다음에 열 때 "불러올까요?" 로 묻는다. */
const DRAFT = 'draft:'; export const isDraft = (id) => String(id).startsWith(DRAFT);
let saveT = 0, pending = null, status = () => {};
export function onStatus(fn) { status = fn; }
export function autosave(model) { pending = model; clearTimeout(saveT); status('저장 안 됨 · Ctrl+S'); saveT = setTimeout(flush, 1500); }
/** 고친 내용 → 임시 복구본 */
export async function flush() {
  clearTimeout(saveT); if (!pending) return true; const m = pending; pending = null;
  try { await putRec({ id: DRAFT + m.id, name: m.name, updated: Date.now(), synced: 0, dirty: false, deleted: false, owner: null, data: JSON.stringify(m) }); saveFail = 0; return true; }
  catch (e) { console.error(e); if (!pending) pending = m; saveFail++; status(`⚠ 임시 저장 실패 · ${e.message || e}`); saveT = setTimeout(flush, Math.min(30000, 3000 * saveFail)); return false; }
}
/** [저장]: 지금 프로젝트에 덮어쓰기 + 임시 복구본 지우기 */
export async function saveProject(model) { clearTimeout(saveT); pending = null; const t = await saveLocal(model); await delRec(DRAFT + model.id).catch(() => {}); status('저장됨'); return t; }
/** 저장 안 한 복구본 (프로젝트보다 새것일 때만) */
export async function draftOf(id) { const d = await getRec(DRAFT + id), r = await getRec(id); return d && (!r || d.updated > (r.updated || 0)) ? JSON.parse(d.data) : null; }
export async function dropDraft(id) { clearTimeout(saveT); pending = null; await delRec(DRAFT + id).catch(() => {}); }
export const hasPending = () => !!pending;
let saveFail = 0;
export const saveFailed = () => saveFail > 0 || !!pending;
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
/* ---------- 키 따라다니기: 한 번 넣은 API 키를 로그인한 계정에 (나중에 고친 쪽이 이김) ---------- */
async function syncSecrets() {
  const localAt = +(localStorage.getItem('byr.secretsAt') || 0); let remote = null;
  try { const t = await sget('_secrets.json'); remote = t ? JSON.parse(t) : null; } catch { remote = null; }
  const rAt = (remote && remote.at) || 0, rv = (remote && remote.v) || {}, mine = () => { const v = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SECRET_RE.test(k)) v[k] = localStorage.getItem(k); } return v; };
  if (remote && rAt > localAt) { /* 계정 쪽이 최신 → 이 기기에 */ for (const [k, x] of Object.entries(rv)) if (SECRET_RE.test(k) && typeof x === 'string') localStorage.setItem(k, x); for (const k of remote.del || []) if (SECRET_RE.test(k)) localStorage.removeItem(k); localStorage.setItem('byr.secretsAt', String(rAt)); localStorage.removeItem('byr.secretsDel'); try { window.dispatchEvent(new Event('byr-secrets-in')); } catch {} return 'down'; }
  if (localAt > rAt) { /* 이 기기가 최신 → 계정에 (키마다 합치고, 지운 키는 지움) */ const del = JSON.parse(localStorage.getItem('byr.secretsDel') || '[]'), v = { ...rv, ...mine() }; for (const k of del) if (!(k in mine())) delete v[k];
    await sput('_secrets.json', JSON.stringify({ at: localAt, v, del })); localStorage.removeItem('byr.secretsDel'); const add = Object.keys(rv).filter((k) => !localStorage.getItem(k) && !del.includes(k)); for (const k of add) localStorage.setItem(k, rv[k]); if (add.length) try { window.dispatchEvent(new Event('byr-secrets-in')); } catch {} return 'up'; }
  return null;
}
let keyT = 0; if (typeof window !== 'undefined') window.addEventListener('byr-secrets', () => { if (!session()) return; clearTimeout(keyT); keyT = setTimeout(() => syncKeys(), 1500); });
export function syncNow() { return (syncing ||= pullAll().finally(() => (syncing = null))); }
/** 키만 맞추기 (켤 때 · 로그인 · 키 바꿀 때) */
export async function syncKeys() { if (!session()) return null; try { return await syncSecrets(); } catch (e) { console.warn('[secrets]', e); return null; } }
const readIdx = async () => { const t = await sget('_index.json'); return t ? JSON.parse(t) : {}; };
/** [계정에 저장]: 이 프로젝트를 계정에 덮어 올린다 (묻지 않음 · 충돌 사본 없음) */
export async function pushProject(id) {
  if (!session()) throw new Error('로그인이 필요해요'); const uid = session().user, rec = await getRec(id); if (!rec || rec.deleted) throw new Error('먼저 [저장] 해 주세요');
  status('계정에 저장 중…'); const g = await putProject(id, rec.data), idx = await readIdx(); idx[id] = { name: rec.name, updated: rec.updated, ...(g ? { gz: true } : {}) };
  await sput('_index.json', JSON.stringify(idx)); const cur = await getRec(id); if (cur) await putRec({ ...cur, owner: uid, synced: rec.updated, dirty: cur.updated !== rec.updated }); ls.set('byr.syncAt', Date.now()); status('계정에 저장됨'); return true;
}
/** [계정에서 받기]: 계정에만 있는 것 · 이 기기에서 안 고친 것만 받는다. 이 기기에서 고친 게 있으면 건너뛰고 알려 줌 (충돌 사본을 만들지 않음) */
async function pullAll() {
  if (!session()) return { skipped: true }; const uid = session().user, res = { down: 0, skip: [], changed: [], err: [] }; status('계정에서 받는 중…');
  try { await syncSecrets(); } catch (e) { console.warn('[secrets]', e); }
  try {
    const idx = await readIdx();
    for (const [id, r] of Object.entries(idx)) {
      if (r.deleted || / \(충돌 사본\)$/.test(r.name || '')) continue; const rec = await getRec(id);
      if (rec && !rec.deleted) { if (rec.owner && rec.owner !== uid) continue; if (r.updated === rec.synced) continue; /* 이미 계정 것 */ if ((rec.updated || 0) > (rec.synced || 0)) { res.skip.push(rec.name); continue; } /* 이 기기에서 저장한 뒤 계정에 안 올림 → 덮지 않음 */ }
      try { const data = await getProject(id, r); if (!data) continue; await putRec({ id, name: r.name, updated: r.updated, synced: r.updated, dirty: false, deleted: false, owner: uid, data }); res.down++; res.changed.push(id); } catch (e) { res.err.push(`${r.name}: ${e.message || e}`); }
    }
    ls.set('byr.syncAt', Date.now()); status(res.err.length ? `받기 일부 실패 · ${res.err[0]}` : res.down ? `계정에서 ${res.down}개 받음` : '계정과 같아요');
  } catch (e) { const m = String(e.message || e); status(/bucket not found/i.test(m) ? '받기 실패 · 서버에 저장 공간(models 버킷)이 없어요' : '받기 실패 · ' + m); throw e; }
  return res;
}
/** 지우기 (계정에서도) */
export async function removeEverywhere(id) { const r = await getRec(id); await removeLocal(id); await delRec(id).catch(() => {}); await delRec(DRAFT + id).catch(() => {}); if (!session()) return; const idx = await readIdx(); const e = idx[id]; if (e && !e.deleted) { await sdel(e.gz ? id + '.json.gz' : id + '.json').catch(() => {}); idx[id] = { name: e.name || (r && r.name) || '', updated: Date.now(), deleted: true }; await sput('_index.json', JSON.stringify(idx)); } }
/** '(충돌 사본)' 정리: 이 기기 + 계정 */
export async function cleanConflicts() { let n = 0; for (const r of await allRecs()) if (!isDraft(r.id) && / \(충돌 사본\)/.test(r.name || '')) { await removeEverywhere(r.id); n++; } if (session()) { const idx = await readIdx(); let ch = false; for (const [id, e] of Object.entries(idx)) if (!e.deleted && / \(충돌 사본\)/.test(e.name || '')) { await sdel(e.gz ? id + '.json.gz' : id + '.json').catch(() => {}); idx[id] = { name: e.name, updated: Date.now(), deleted: true }; ch = true; n++; } if (ch) await sput('_index.json', JSON.stringify(idx)); } return n; }
export const lastSync = () => ls.get('byr.syncAt', 0);
export { SB };
