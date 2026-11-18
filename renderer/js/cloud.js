// 계정(기존 앱과 같은 Supabase) · Claude AI 키 · AI 도면 읽기 / 사진으로 기물 넣기
// 기존 앱(app.js askVision · pro14.js pdfVision)과 같은 방식·같은 지시문을 쓴다.
// 보안: 여기에는 공개용(publishable) 키만 둔다. AI 키는 이 기기(localStorage) 또는 본인 계정(user_secrets, RLS)에만 저장한다.

export const SB = { url: 'https://zxehyxjjiruxgqkthotn.supabase.co', key: 'sb_publishable_zz9PY-dtM2F2cwcx4DwPeA_G3k5Jztb' };
export const AI_MODEL = 'claude-sonnet-5-5';
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} if (SECRET_RE.test(k)) secretsChanged(v == null ? k : null); },
};
/** 계정을 따라다니는 키 (AI 키 · 모델 · 워크스페이스 · 브이월드 · 공공데이터포털) — 로그인한 계정의 비공개 저장소(models/<내 ID>/byr2/_secrets.json)에 */
export const SECRET_RE = /^byr\.(aiKey(\.[a-z]+)?|aiWs|aiProvider|aiModel\.[a-z]+|vworld)$/;
export function secretsChanged(removed) { try { localStorage.setItem('byr.secretsAt', String(Date.now())); if (removed) { const d = JSON.parse(localStorage.getItem('byr.secretsDel') || '[]'); if (!d.includes(removed)) d.push(removed); localStorage.setItem('byr.secretsDel', JSON.stringify(d)); } } catch {} try { window.dispatchEvent(new Event('byr-secrets')); } catch {} }

/* ---------- 계정 (기존 앱 계정 그대로) ---------- */
export const session = () => store.get('byr.session', null);
async function sbAuth(path, body) {
  const r = await fetch(`${SB.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.msg || j.message || '로그인 실패 ' + r.status); return j;
}
function take(j) { if (!j.access_token) throw new Error('이메일 확인 후 다시 로그인하세요'); const s = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, user: j.user && j.user.id, email: j.user && j.user.email }; store.set('byr.session', s); return s; }
export async function login(email, password) { const s = take(await sbAuth('token?grant_type=password', { email, password })); await loadAccountKey().catch(() => {}); return s; }
/** 로그아웃: 계정에서 받아 온 AI 키도 이 기기에서 지운다 (직접 넣은 키는 남김) */
export function logout() { store.set('byr.session', null); store.set('byr.aiKeyAcct', null); /* 계정 키는 이 기기에서 지운다 (다시 로그인하면 따라옴) */ try { for (const k of Object.keys(localStorage)) if (SECRET_RE.test(k)) localStorage.removeItem(k); localStorage.removeItem('byr.secretsAt'); localStorage.removeItem('byr.secretsDel'); } catch {} }
export async function sbFetch(path, opt = {}) {
  let s = session(); if (!s) throw new Error('먼저 로그인하세요');
  if (s.exp && Date.now() > s.exp) s = take(await sbAuth('token?grant_type=refresh_token', { refresh_token: s.refresh }));
  const go = () => fetch(SB.url + path, { ...opt, headers: { apikey: SB.key, Authorization: 'Bearer ' + s.access, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  let r = await go();
  if (!r.ok && (r.status === 400 || r.status === 401 || r.status === 403)) { // 저장소는 토큰이 만료돼도 400 을 준다 → 한 번 새로 받고 다시
    const body = await r.clone().text().catch(() => '');
    if (/jwt|token|expired|unauthori[sz]ed|signature/i.test(body) && s.refresh) { s = take(await sbAuth('token?grant_type=refresh_token', { refresh_token: s.refresh })); r = await go(); }
    else if (/too large|exceeded|maximum|413/i.test(body)) throw new Error('파일이 너무 커요 (계정 저장 한도)');
  }
  if (!r.ok && !(opt.allow404 && (r.status === 404 || r.status === 400))) { const t = await r.text().catch(() => ''); let m = ''; try { m = JSON.parse(t).message || JSON.parse(t).error || ''; } catch {} throw new Error('서버 응답 ' + r.status + (m ? ' · ' + String(m).slice(0, 80) : '')); } return r;
}
/** 기존 앱이 계정에 올려 둔 프로젝트 목록 */
export async function listProjects() { const s = session(); return (await sbFetch(`/rest/v1/projects?select=id,name,updated_at&user_id=eq.${s.user}&order=updated_at.desc`)).json(); }
/** 프로젝트 하나 (기존 앱 형식 그대로: { id, name, data }) */
export async function fetchProject(id) { const j = await (await sbFetch(`/rest/v1/projects?select=id,name,data&id=eq.${encodeURIComponent(id)}`)).json(); if (!j[0]) throw new Error('프로젝트를 찾지 못했어요'); return j[0]; }

/* ---------- AI 연결: 사용자 본인의 Claude · ChatGPT(OpenAI) · Gemini 키 ---------- */
// claude.ai · ChatGPT · Gemini 앱의 "구독 로그인"은 다른 앱에서 쓸 수 없게 막혀 있어서, 각 회사 개발자 콘솔에서 만든 API 키로 연결한다.
export const PROVIDERS = {
  claude: { name: 'Claude (Anthropic)', model: AI_MODEL, keyHint: 'sk-ant-…', where: 'platform.claude.com → API 키 → 키 생성 → 만든 직후 창에서 키 전체 복사', pdf: true },
  openai: { name: 'ChatGPT (OpenAI)', model: 'gpt-6-astra', keyHint: 'sk-…', where: 'platform.openai.com → API keys', pdf: true },
  gemini: { name: 'Gemini (Google)', model: 'gemini-3.8-flash', keyHint: 'AIza…', where: 'aistudio.google.com → Get API key', pdf: true },
};
export const aiProvider = () => (PROVIDERS[store.get('byr.aiProvider', 'claude')] ? store.get('byr.aiProvider', 'claude') : 'claude');
export function setAiProvider(p) { if (PROVIDERS[p]) store.set('byr.aiProvider', p); }
export const aiModel = (p = aiProvider()) => store.get('byr.aiModel.' + p, '') || PROVIDERS[p].model;
export function setAiModel(p, m) { store.set('byr.aiModel.' + p, m ? m.trim() : null); }
export const aiKey = (p = aiProvider()) => store.get(p === 'claude' ? 'byr.aiKey' : 'byr.aiKey.' + p, '') || '';
export function setAiKey(k, p = aiProvider()) { if (p === 'claude') store.set('byr.aiKeyAcct', null); store.set(p === 'claude' ? 'byr.aiKey' : 'byr.aiKey.' + p, k ? k.trim() : null); }
/** 기존 앱 "계정에 저장"한 키를 불러온다 (user_secrets, 본인만 읽힘) */
export async function loadAccountKey() { const s = session(); const j = await (await sbFetch('/rest/v1/user_secrets?select=ai_key&user_id=eq.' + s.user)).json(); const k = j && j[0] && j[0].ai_key; if (k) { setAiKey(k, 'claude'); store.set('byr.aiKeyAcct', true); } return !!k; }
export async function saveAccountKey(k) { const s = session(); await sbFetch('/rest/v1/user_secrets', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: s.user, ai_key: k || null, updated_at: new Date().toISOString() }) }); }

/* ---------- Claude 호출 ---------- */
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const jsonOf = (t) => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('AI 가 JSON 으로 답하지 않았어요: ' + t.slice(0, 120)); return JSON.parse(t.slice(a, b + 1)); };
const errOf = (j, r) => (j.error && (j.error.message || j.error.status)) || (typeof j.error === 'string' ? j.error : '') || 'AI 응답 ' + r.status;
/* Claude 키 종류: 예전 워크스페이스 키(sk-ant-api03-) 는 x-api-key, 개인 · 서비스 계정 키(sk-ant-usr- 등)는 Authorization: Bearer.
 * 워크스페이스에 묶이지 않은 개인 키는 anthropic-workspace-id 도 보내야 한다 (AI 화면에서 넣음) */
export const aiWorkspace = () => store.get('byr.aiWs', '') || '';
export function setAiWorkspace(v) { store.set('byr.aiWs', v ? v.trim() : null); }
function claudeHeaders(key) { const h = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  if (/^sk-ant-api/.test(key)) h['x-api-key'] = key; else h.Authorization = 'Bearer ' + key; const ws = aiWorkspace(); if (ws) h['anthropic-workspace-id'] = ws; return h; }
/* ---------- AI 진행 상황 · 오류 코드 ----------
 * onAiStep(fn) 로 화면이 받는다: { phase, msg, ...자세한 값 }. phase: prep · send · read · write · done · error
 * 오류는 AiError(code) — E-KEY(키) · E-PERM(권한) · E-SIZE(파일 큼) · E-RATE(사용량 한도) · E-BUSY(AI 서버 바쁨) · E-NET(인터넷) · E-TIME(시간 초과) · E-JSON(답 형식) · E-CUT(답이 잘림) · E-API(기타) */
let STEP = null; export function onAiStep(fn) { STEP = fn; }
const step = (phase, msg, x = {}) => { try { STEP && STEP({ phase, msg, ...x }); } catch {} };
export class AiError extends Error { constructor(code, msg, detail) { super(`[${code}] ${msg}`); this.code = code; this.detail = detail || ''; } }
const HINT = { 'E-KEY': '키가 틀렸거나 지워졌어요 · 콘솔에서 새 키를 만들어 AI 화면에 다시 넣어 주세요 (앞뒤 빈칸 · 줄바꿈 없이)', 'E-PERM': '이 키로는 이 모델을 쓸 수 없어요 · 결제 · 권한을 확인하세요', 'E-SIZE': '파일이 너무 커요 · 필요한 쪽만 PDF 로 저장하거나 그림으로 캡처해 올려 주세요', 'E-RATE': '사용량 한도에 걸렸어요 · 잠시 뒤 다시 하거나 콘솔에서 한도 · 잔액을 확인하세요', 'E-BUSY': 'AI 서버가 바빠요 · 1~2분 뒤 다시 해 주세요', 'E-NET': '인터넷 연결을 확인해 주세요', 'E-TIME': '너무 오래 걸려 멈췄어요 · 쪽수를 줄여 다시 해 주세요', 'E-JSON': 'AI 답을 읽지 못했어요 · 한 번 더 해 보세요', 'E-CUT': '답이 길어 중간에 잘렸어요 · 자료를 나눠 올려 주세요', 'E-API': '' };
export const aiHint = (code) => HINT[code] || '';
const codeOf = (status, type = '', msg = '') => status === 401 || /authentication|invalid.*key|api.?key/i.test(type + msg) ? 'E-KEY' : status === 403 || /permission/i.test(type) ? 'E-PERM' : status === 413 || /too large|too long|exceed.*(size|page|token)|maximum.*pages|request_too_large/i.test(type + msg) ? 'E-SIZE' : status === 429 || /rate|quota|credit|billing/i.test(type + msg) ? 'E-RATE' : status === 529 || status === 503 || status === 502 || /overload/i.test(type) ? 'E-BUSY' : 'E-API';
async function httpErr(r, provider) {
  const j = await r.json().catch(() => ({})), e = j.error || {}, type = e.type || e.status || e.code || '', msg = e.message || (typeof j.error === 'string' ? j.error : '') || r.statusText || '', rid = r.headers.get('request-id') || r.headers.get('x-request-id') || '';
  const code = codeOf(r.status, String(type), msg), wsHint = provider === 'claude' && /workspace/i.test(msg) ? ' · 개인 키라면 AI 화면에 워크스페이스 ID(wrkspc_…)를 넣어 주세요' : ''; return new AiError(code, `${PROVIDERS[provider].name} HTTP ${r.status}${type ? ' · ' + type : ''} · ${msg}`, `${aiHint(code)}${wsHint}${rid ? ` (요청 ID ${rid})` : ''}`);
}
const keyTag = (k) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : '(짧음)');
const pdfPages = (bytes) => { const t = new TextDecoder('latin1').decode(bytes); const m = t.match(/\/Type\s*\/Page(?!s)\b/g); return m ? m.length : 0; };
/** 키 형식만 미리 확인 (보내기 전에) */
export function keyProblem(k, provider = aiProvider()) { if (!k) return '키가 없어요'; if (/\.\.\.|…/.test(k) || (provider === 'claude' && k.length < 60)) return `키가 잘린 것 같아요 (${k.length}자${/\.\.\.|…/.test(k) ? ' · 가운데 ... 있음' : ''}). 콘솔 키 목록에 보이는 "sk-ant-usr-1CX...ZwAA" 같은 글자는 줄임 표시라 쓸 수 없어요. 키 전체(100자 안팎)는 "키 생성" 직후 한 번만 보여요 → 새로 만들어 그 창에서 복사하세요`; if (/\s/.test(k)) return '키 안에 빈칸 · 줄바꿈이 있어요'; if (provider === 'claude' && !/^sk-ant-/.test(k)) return 'Claude 키는 sk-ant- 로 시작해요'; if (provider === 'gemini' && !/^AIza/.test(k)) return 'Gemini 키는 AIza 로 시작해요'; if (provider === 'openai' && !/^sk-/.test(k)) return 'OpenAI 키는 sk- 로 시작해요'; return ''; }
/** 키가 실제로 되는지 아주 작은 요청으로 확인 */
export async function testKey(provider = aiProvider()) {
  const key = aiKey(provider), bad = keyProblem(key, provider); if (!key || /빈칸|잘린/.test(bad)) throw new AiError('E-KEY', bad, '');
  const r = provider === 'claude' ? await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: claudeHeaders(key), body: JSON.stringify({ model: aiModel(provider), max_tokens: 5, messages: [{ role: 'user', content: 'ok' }] }) })
    : provider === 'openai' ? await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key } }) : await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
  if (!r.ok) { const e = await httpErr(r, provider); if (bad) e.detail = bad + ' · ' + e.detail; throw e; } return `${PROVIDERS[provider].name} 키 정상 · ${keyTag(key)} · 모델 ${aiModel(provider)}`;
}
const LIMIT = { claude: { pdf: 32e6, pages: 100, img: 5e6 }, openai: { pdf: 50e6, pages: 100, img: 20e6 }, gemini: { pdf: 20e6, pages: 1000, img: 20e6 } };
/** 고른 AI 에 그림/PDF + 지시문을 보내 JSON 을 받는다 (제공자마다 요청 모양만 다르고 지시문은 같다) · 진행 상황은 onAiStep 으로 */
export async function ask(prompt, file, maxTokens = 8000, provider = aiProvider()) {
  const key = aiKey(provider), P = PROVIDERS[provider]; if (!key) throw new AiError('E-KEY', `${P.name} 키가 없어요`, 'AI 화면에서 키를 넣어 주세요');
  const bad = keyProblem(key, provider); if (bad && /빈칸|잘린/.test(bad)) throw new AiError('E-KEY', `${bad} · 지금 키 ${keyTag(key)}`, aiHint('E-KEY')); if (bad) step('prep', '⚠ ' + bad);
  const pdf = file.mime === 'application/pdf', model = aiModel(provider), txt = /^text\//.test(file.mime) ? '[첨부 문서]\n' + new TextDecoder().decode(file.bytes).slice(0, 150000) : null, pages = pdf ? pdfPages(file.bytes) : 0, mb = (file.bytes.length / 1e6).toFixed(1), Lm = LIMIT[provider];
  step('prep', `파일 준비: ${file.name || ''} · ${pdf ? `PDF ${pages || '?'}쪽` : txt ? '글' : '그림'} · ${mb}MB`, { pages, bytes: file.bytes.length });
  if (pdf && (file.bytes.length > Lm.pdf || pages > Lm.pages)) throw new AiError('E-SIZE', `PDF ${mb}MB · ${pages}쪽 — ${P.name} 한도(${Lm.pdf / 1e6}MB · ${Lm.pages}쪽)를 넘어요`, aiHint('E-SIZE'));
  if (!pdf && !txt && file.bytes.length > Lm.img) throw new AiError('E-SIZE', `그림 ${mb}MB — 한도 ${Lm.img / 1e6}MB`, aiHint('E-SIZE'));
  const data = b64(file.bytes), ac = new AbortController(), t0 = Date.now(); let idle = Date.now();
  const timer = setInterval(() => { const s = (Date.now() - t0) / 1000; if (s > 300 || Date.now() - idle > 120000) ac.abort('time'); }, 1000);
  step('send', `${P.name} 에 보냄 · 모델 ${model} · 키 ${keyTag(key)}`);
  const go = async (url, init) => { try { return await fetch(url, { ...init, signal: ac.signal }); } catch (e) { if (ac.signal.aborted) throw new AiError('E-TIME', `${Math.round((Date.now() - t0) / 1000)}초 동안 답이 없어 멈췄어요`, aiHint('E-TIME')); throw new AiError('E-NET', `연결 실패: ${e.message || e}`, aiHint('E-NET')); } };
  try {
    let text = '', stop = '';
    if (provider === 'claude') {
      const src = txt ? { type: 'text', text: txt } : pdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } : { type: 'image', source: { type: 'base64', media_type: file.mime, data } };
      const r = await go('https://api.anthropic.com/v1/messages', { method: 'POST', headers: claudeHeaders(key), body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, messages: [{ role: 'user', content: [src, { type: 'text', text: prompt }] }] }) });
      if (!r.ok) throw await httpErr(r, provider);
      /* 스트림: 문서를 다 읽으면 message_start(읽은 양) → 답을 쓰는 동안 글자가 조금씩 옴 */
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', last = 0;
      for (;;) { let res; try { res = await rd.read(); } catch (e) { if (ac.signal.aborted) throw new AiError('E-TIME', `${Math.round((Date.now() - t0) / 1000)}초 만에 멈춤 · 받은 글자 ${text.length}`, aiHint('E-TIME')); throw new AiError('E-NET', '받는 중 연결이 끊겼어요 · 받은 글자 ' + text.length, aiHint('E-NET')); }
        if (res.done) break; idle = Date.now(); buf += dec.decode(res.value, { stream: true }); let k;
        while ((k = buf.indexOf('\n\n')) >= 0) { const ev = buf.slice(0, k); buf = buf.slice(k + 2); const line = ev.split('\n').find((l) => l.startsWith('data:')); if (!line) continue; let d; try { d = JSON.parse(line.slice(5)); } catch { continue; }
          if (d.type === 'message_start') step('read', `문서 다 읽음 · 입력 ${(d.message?.usage?.input_tokens || 0).toLocaleString()} 토큰 (${Math.round((Date.now() - t0) / 1000)}초) · 이제 답을 쓰는 중`, { inTok: d.message?.usage?.input_tokens });
          else if (d.type === 'content_block_delta' && d.delta && d.delta.text) { text += d.delta.text; if (Date.now() - last > 400) { last = Date.now(); step('write', `답 쓰는 중 · ${text.length.toLocaleString()}자 · 항목 ${(text.match(/"type"\s*:|^\s*\[/gm) || []).length}개째`, { chars: text.length }); } }
          else if (d.type === 'message_delta') stop = d.delta?.stop_reason || stop;
          else if (d.type === 'error') throw new AiError(codeOf(0, d.error?.type, d.error?.message), `${P.name} · ${d.error?.type || ''} · ${d.error?.message || ''}`, aiHint(codeOf(0, d.error?.type, d.error?.message))); } }
    } else if (provider === 'openai') {
      const src = txt ? { type: 'input_text', text: txt } : pdf ? { type: 'input_file', filename: file.name || 'plan.pdf', file_data: 'data:application/pdf;base64,' + data } : { type: 'input_image', image_url: `data:${file.mime};base64,${data}` };
      step('read', '문서를 읽고 답을 만드는 중 (이 AI 는 끝나야 한꺼번에 와요)');
      const r = await go('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model, max_output_tokens: maxTokens, input: [{ role: 'user', content: [src, { type: 'input_text', text: prompt }] }] }) });
      if (!r.ok) throw await httpErr(r, provider); const j = await r.json(); text = j.output_text || (j.output || []).flatMap((o) => o.content || []).map((c) => c.text || '').join(''); stop = j.status === 'incomplete' ? 'max_tokens' : '';
    } else {
      step('read', '문서를 읽고 답을 만드는 중 (이 AI 는 끝나야 한꺼번에 와요)');
      const r = await go(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [txt ? { text: txt } : { inline_data: { mime_type: file.mime, data } }, { text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' } }) });
      if (!r.ok) throw await httpErr(r, provider); const j = await r.json(), c0 = (j.candidates || [])[0]; text = (c0?.content?.parts || []).map((p) => p.text || '').join(''); stop = c0?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : '';
      if (!c0) throw new AiError('E-API', 'Gemini 가 답을 주지 않았어요 · ' + (j.promptFeedback?.blockReason || ''), '');
    }
    step('done', `답 받음 · ${text.length.toLocaleString()}자 · ${Math.round((Date.now() - t0) / 1000)}초${stop === 'max_tokens' ? ' · ⚠ 길이 한도에서 잘림' : ''}`);
    try { return jsonOf(text); } catch (e) { throw new AiError(stop === 'max_tokens' ? 'E-CUT' : 'E-JSON', `${e.message}`, aiHint(stop === 'max_tokens' ? 'E-CUT' : 'E-JSON')); }
  } catch (e) { step('error', e.message, { code: e.code, detail: e.detail }); throw e; }
  finally { clearInterval(timer); }
}

/** 이미지는 긴 변 2000px JPEG 로 줄여 보낸다. 가로·세로 픽셀도 돌려준다 */
export async function prepFile(name, bytes) {
  if (/\.(txt|md|csv|json)$/i.test(name)) return { mime: 'text/plain', bytes, aspect: 1, name };
  if (/\.pdf$/i.test(name)) {
    const txt = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 400000)));
    const m = txt.match(/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/); // 첫 쪽 크기 (못 찾으면 A판 가로)
    const aspect = m ? Math.abs(+m[4] - +m[2]) / Math.abs(+m[3] - +m[1]) : 1 / Math.SQRT2;
    return { mime: 'application/pdf', bytes, aspect, name };
  }
  const bmp = await createImageBitmap(new Blob([bytes])), s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s)); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const out = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.88 })).arrayBuffer());
  return { mime: 'image/jpeg', bytes: out, aspect: bmp.height / bmp.width, name };
}

export const OPDEF = { slidepass: [900, 600, 900], slide: [1800, 2100, 0], pass: [900, 600, 900], arch: [1200, 2400, 0], door1: [900, 2100, 0], door2: [1600, 2300, 0], auto: [1800, 2300, 0], window: [1800, 1500, 900], full: [2400, 2400, 0] };

/**
 * 도면(이미지 · PDF) → 벽 · 문/창.
 * widthMm 를 주면 기존 앱처럼 "그림 가로 = 실제 가로" 로 맞추고, 비우면 AI 가 읽은 치수선으로 축척을 정한다.
 */
export async function readPlan(file, widthMm) {
  const ops = Object.keys(OPDEF).join(', ');
  const prompt = `This is an architectural floor plan${file.mime === 'application/pdf' ? ' (use the first page)' : ' image'}. Answer JSON only, exactly in this shape:
{"scale_ref":{"x1":0,"y1":0,"x2":0,"y2":0,"mm":0},"wall_height_mm":null,
 "walls":[{"x1":0,"y1":0,"x2":0,"y2":0,"t_mm":150}],
 "openings":[{"type":"door1","x":0,"y":0,"w_mm":900}]}
All x / y values are fractions 0..1 of the ${file.mime === 'application/pdf' ? 'page' : 'image'} width (x) and height (y), origin top-left.
Rules:
- scale_ref: the two end points of the longest dimension line whose number you can read clearly, and that number in mm (e.g. "27,000" → 27000). null if none.
- walls: trace every wall as a straight centre-line segment with its thickness in mm. Join walls that meet at corners exactly.
- openings: centre point of each door / window / pass-through on its wall; type is one of ${ops}.
- wall_height_mm only if a wall or ceiling height is written (CH, 천장고, 벽높이).
- Ignore furniture, the title block, grid bubbles, dimension text and the paper border.`;
  const res = await ask(prompt, file, 12000), A = file.aspect || 1;
  let W = +widthMm || 0; // 그림 가로 전체가 몇 mm 인가
  const sr = res.scale_ref;
  if (!W && sr && +sr.mm > 0) { const d = Math.hypot((+sr.x2 - +sr.x1), (+sr.y2 - +sr.y1) * A); if (d > 0.02) W = +sr.mm / d; }
  if (!W) throw new Error('축척을 알 수 없어요 · "도면 가로 길이(mm)"를 넣고 다시 해 주세요');
  const X = (v) => Math.round(Math.min(1, Math.max(0, +v || 0)) * W), Y = (v) => Math.round(Math.min(1, Math.max(0, +v || 0)) * W * A);
  const walls = (res.walls || []).map((w) => ({ x1: X(w.x1), y1: Y(w.y1), x2: X(w.x2), y2: Y(w.y2), t: Math.round(Math.min(600, Math.max(50, +w.t_mm || 150))) })).filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 150);
  const openings = (res.openings || []).filter((o) => OPDEF[o.type]).map((o) => ({ type: o.type, x: X(o.x), y: Y(o.y), w: Math.round(+o.w_mm || OPDEF[o.type][0]) }));
  return { walls, openings, height: +res.wall_height_mm || null, widthMm: Math.round(W) };
}

/** 지도 캡처(위성 · 일반 지도, 북쪽이 위) → 주변 건물 · 도로 · 녹지 · 나무. 좌표는 그림 가로/세로 0..1, 가게 자리는 (sx, sy) */
export async function readMap(file, { sx = 0.5, sy = 0.5, detail = 'mid', maxTokens = 6000 } = {}) {
  const lim = { low: [25, 6, 30], mid: [60, 12, 80], high: [120, 20, 160] }[detail] || [60, 12, 80];
  const prompt = `This is a top-down map capture (satellite or street map, north is up). Our store is at x=${sx.toFixed(3)}, y=${sy.toFixed(3)}. Build a SIMPLE 3D context massing. Answer JSON only, exactly in this shape:
{"buildings":[{"p":[[0,0],[0,0],[0,0],[0,0]],"floors":3,"apt":false}],
 "roads":[{"p":[[0,0],[0,0]],"lanes":2}],
 "green":[{"p":[[0,0],[0,0],[0,0]]}],
 "trees":[[0,0]]}
All coordinates are fractions 0..1 of the image width (x) and height (y), origin top-left.
Rules:
- buildings: footprint as a simple polygon (4-8 points, clockwise), at most ${lim[0]}, biggest and closest to the store first. floors = your estimate from shadows / labels / type (houses 2-3, shops 3-5, apartments 10-25; apt=true for apartment towers). Skip the building that contains the store point.
- roads: centre lines as polylines (2-6 points), at most ${lim[1]}; lanes = total lanes (alley 1, street 2, main road 4-8).
- green: parks / lawns / planted areas, at most ${Math.round(lim[1] / 2)} polygons.
- trees: individual street trees or tree clusters, at most ${lim[2]}.
- Ignore text labels, icons, markers, the UI and the copyright line. Keep shapes simple (massing only).`;
  return ask(prompt, file, maxTokens);
}

/** 벽 하나를 정면으로 찍은 사진 → 기물 · 문/창 (기존 앱 "사진 4면 AI 인식" 지시문을 벽 하나 기준으로) */
export const AI_TYPES = ['fridge45', 'fridge25', 'tfridge', 'work', 'work2', 'sink1', 'sink2', 'fryer1', 'fryer2', 'fryer4', 'range', 'range3', 'dishwasher', 'icemaker', 'holding', 'rack', 'tank', 'hood', 'shelf', 'uppercab', 'showcase', 't2', 't4', 't6', 'tround', 'tbar', 'counter', 'chair', 'stool', 'barchair', 'bench', 'banquette', 'lounge', 'column', 'partition', 'glasspart', 'tv', 'ac_wall', 'ac_cassette', 'ac_stand', 'wallvent', 'pendant', 'frame', 'monstera', 'olive', 'planterbox', 'panel'];
export async function readPhoto(file, wallLen, lib) {
  const types = [...AI_TYPES.filter((t) => lib[t]).map((t) => `${t} (${lib[t].name})`), ...Object.keys(OPDEF)].join(', ');
  const prompt = `The photo was taken from inside the room looking at one wall, which is ${Math.round(wallLen)} mm long. The photo's left edge is the left end and the right edge is the right end of that wall.
List every distinct physical object you can see, one entry per object (three tables = three entries). Use ONLY these type ids: ${types}.
For each object give: "type" (one id from the list), "x0" and "x1" (left and right edge of the object across the photo, as fractions 0 to 1), "dist" (estimated distance in mm from the facing wall to the object's centre; 0 if it is on or built into that wall), "on_wall" (true if mounted on or built into the facing wall), "w" and "h" (estimated width and height in mm, or null), "sill" (for windows and pass-throughs, height of the bottom edge above the floor in mm, else null), "elev" (for wall-mounted things, height of the bottom edge above the floor in mm, else null).
Answer with JSON only, exactly in this shape: {"objects":[{"type":"","x0":0,"x1":0,"dist":0,"on_wall":false,"w":null,"h":null,"sill":null,"elev":null}]}`;
  return (await ask(prompt, file, 4000)).objects || [];
}

/**
 * 인테리어 시방서 · 계획서(PDF · 이미지 · 글) → 내 프리셋.
 * 업종 · 주방 비율 · 마감 색 · 주방 기물 목록만 뽑는다 (기물 종류는 앱에 있는 것 중에서만).
 */
export async function readSpec(file, lib) {
  const ids = Object.entries(lib).filter(([, L]) => /주방|kitchen|설비|냉장|싱크|작업대|튀김|화구|선반|세척|제빙|정수/.test((L.cat || '') + (L.sub || '') + (L.name || ''))).map(([k, L]) => `${k}=${L.name}`).slice(0, 220).join(', ');
  const prompt = `이 문서는 매장 인테리어 시방서 또는 계획서다. 자동 배치에 쓸 "프리셋"을 JSON 하나로만 답하라. 설명 글 금지.
{"name": "브랜드/타입 이름", "base": "pel_hall | pel_delivery | chicken | cafe | snack | korean 중 가장 가까운 것", "ratio": 주방 면적 비율 0.15~1,
 "colors": {"main":"#hex 대표색","hallWall":"#hex 홀 벽","hallFloor":"#hex 홀 바닥","hallFloor2":"#hex 홀 바닥 둘째 색(체크 타일이 아니면 hallFloor 와 같게)","kitFloor":"#hex 주방 바닥","kitWall":"#hex 주방 벽","counter":"#hex 카운터 앞판","chair":"#hex 의자","ceiling":"#hex 천장","gate":"#hex 출입구 프레임"},
 "kitchen": [["기물id", 폭mm, 깊이mm, 수량, "hot|wash|prep|cold|store"], ...],
 "notes": ["배치 · 마감 규칙 요약 (짧게, 최대 8줄)"]}
기물id 는 반드시 다음 목록에서만 고른다 (없으면 가장 가까운 것): ${ids}
문서에 없는 값은 빼라. 색은 문서의 마감재 표 · 사진 색을 따른다.`;
  const j = await ask(prompt, file, 6000);
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : undefined), colors = {};
  for (const [k, v] of Object.entries(j.colors || {})) if (hex(v)) colors[k] = v;
  const kitchen = (j.kitchen || []).filter((r) => Array.isArray(r) && lib[r[0]]).map((r) => [r[0], Math.round(+r[1] || 0), Math.round(+r[2] || 0), Math.max(1, Math.min(9, Math.round(+r[3] || 1))), String(r[4] || 'prep')]);
  return { name: String(j.name || '내 프리셋').slice(0, 40), base: String(j.base || 'pel_hall'), ratio: Math.min(1, Math.max(0.15, +j.ratio || 0.35)), colors, kitchen, notes: (j.notes || []).map(String).slice(0, 8) };
}

/**
 * 매장 자료 → 기물 · 마감 (자료로 매장 만들기)
 * kind: 'render' (3D 렌더 · 현장 사진) · 'elec' (전열 · 설비 도면) · 'plan' (평면도 안의 기물)
 * 좌표는 그림이 아니라 "매장 안쪽 네모" 기준 0..1 (위에서 본 평면 · 출입구 쪽이 아래) 로 받는다 → 도면 · 렌더 · 전열도를 같은 틀에 겹칠 수 있다.
 */
export async function readLayout(file, kind, lib, size) {
  const extra = kind === 'elec' ? ['outlet', 'outlet3', 'switch', 'panel', 'l_down', 'l_surface', 'l_flat', 'l_line', 'l_pin', 'l_hood', 'l_globe', 'exitsign', 'aircurtain', 'wallvent'] : ['l_down', 'l_surface', 'l_flat', 'l_line', 'l_globe', 'l_pin', 'pel_neon_h', 'pel_neon_v', 'pel_menu', 'pel_band', 'pel_wood', 'pel_window', 'pel_glass', 'pel_dome', 'menuboard', 'neonsign', 'plant'];
  const ids = [...new Set([...(kind === 'elec' ? [] : AI_TYPES), ...extra])].filter((k) => lib[k]).map((k) => `${k}=${lib[k].name}`).join(', ');
  const what = kind === 'render' ? 'a 3D rendering or photo of a restaurant interior' : kind === 'elec' ? 'an electrical / MEP drawing (outlets, switches, lighting, panel) of a restaurant' : 'a floor plan of a restaurant with furniture and equipment';
  const prompt = `This is ${what}${size ? ` whose interior is about ${Math.round(size.w)} mm wide and ${Math.round(size.d)} mm deep` : ''}. Answer JSON only:
{"size":{"w_mm":0,"d_mm":0},"items":[{"type":"id","x":0.5,"y":0.5,"rot":0,"w_mm":0,"d_mm":0,"color":"#hex"}],"finishes":{"floor":"#hex","floor2":"#hex","wall":"#hex","ceiling":"#hex","counter":"#hex","accent":"#hex"},"kitchen":{"x0":0,"y0":0,"x1":0,"y1":0},"notes":["short"]}
Coordinates: imagine the store seen from directly above, the entrance side at the BOTTOM. x = 0..1 from left to right inner wall, y = 0..1 from back (top) to entrance (bottom). Give the CENTER of each item.
rot: 0 = front faces the entrance (down), 90 = faces left, 180 = faces back, 270 = faces right.
type must be one of: ${ids}. Use the closest type; skip things you cannot place. Repeat items (each chair / light / outlet separately) up to 150 items.
size: interior size in mm only if you can read or estimate it (else null). kitchen: the kitchen area rectangle in the same 0..1 frame, or null.
finishes: dominant colours you can see (null if unknown). floor2 = second floor tile colour for checker floors.`;
  const j = await ask(prompt, file, 12000), hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : null), cl = (v) => Math.min(1, Math.max(0, +v || 0));
  const items = (j.items || []).filter((q) => q && lib[q.type]).slice(0, 200).map((q) => ({ type: q.type, x: cl(q.x), y: cl(q.y), rot: (Math.round((+q.rot || 0) / 90) * 90 + 360) % 360, w: Math.round(+q.w_mm || 0) || null, d: Math.round(+q.d_mm || 0) || null, color: hex(q.color) }));
  const f = j.finishes || {}, finishes = {}; for (const k of ['floor', 'floor2', 'wall', 'ceiling', 'counter', 'accent']) if (hex(f[k])) finishes[k] = f[k];
  const sz = j.size && +j.size.w_mm > 1000 && +j.size.d_mm > 1000 ? { w: Math.round(+j.size.w_mm), d: Math.round(+j.size.d_mm) } : null;
  const K = j.kitchen && [j.kitchen.x0, j.kitchen.y0, j.kitchen.x1, j.kitchen.y1].every((v) => v != null) ? [cl(j.kitchen.x0), cl(j.kitchen.y0), cl(j.kitchen.x1), cl(j.kitchen.y1)] : null;
  return { items, finishes, size: sz, kitchen: K, notes: (j.notes || []).map(String).slice(0, 6) };
}
