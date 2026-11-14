// 계정(기존 앱과 같은 Supabase) · Claude AI 키 · AI 도면 읽기 / 사진으로 기물 넣기
// 기존 앱(app.js askVision · pro14.js pdfVision)과 같은 방식·같은 지시문을 쓴다.
// 보안: 여기에는 공개용(publishable) 키만 둔다. AI 키는 이 기기(localStorage) 또는 본인 계정(user_secrets, RLS)에만 저장한다.

export const SB = { url: 'https://zxehyxjjiruxgqkthotn.supabase.co', key: 'sb_publishable_zz9PY-dtM2F2cwcx4DwPeA_G3k5Jztb' };
export const AI_MODEL = 'claude-sonnet-5-5';
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ---------- 계정 (기존 앱 계정 그대로) ---------- */
export const session = () => store.get('byr.session', null);
async function sbAuth(path, body) {
  const r = await fetch(`${SB.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: SB.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.msg || j.message || '로그인 실패 ' + r.status); return j;
}
function take(j) { if (!j.access_token) throw new Error('이메일 확인 후 다시 로그인하세요'); const s = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, user: j.user && j.user.id, email: j.user && j.user.email }; store.set('byr.session', s); return s; }
export async function login(email, password) { const s = take(await sbAuth('token?grant_type=password', { email, password })); await loadAccountKey().catch(() => {}); return s; }
/** 로그아웃: 계정에서 받아 온 AI 키도 이 기기에서 지운다 (직접 넣은 키는 남김) */
export function logout() { store.set('byr.session', null); if (store.get('byr.aiKeyAcct', false)) { store.set('byr.aiKey', null); store.set('byr.aiKeyAcct', null); } }
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
  claude: { name: 'Claude (Anthropic)', model: AI_MODEL, keyHint: 'sk-ant-…', where: 'console.anthropic.com → API Keys', pdf: true },
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
/** 고른 AI 에 그림/PDF + 지시문을 보내 JSON 을 받는다 (제공자마다 요청 모양만 다르고 지시문은 같다) */
export async function ask(prompt, file, maxTokens = 8000, provider = aiProvider()) {
  const key = aiKey(provider); if (!key) throw new Error(`${PROVIDERS[provider].name} 키가 없어요 · AI 화면에서 키를 넣어 주세요`);
  const data = b64(file.bytes), pdf = file.mime === 'application/pdf', model = aiModel(provider);
  if (provider === 'claude') {
    const src = pdf ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } : { type: 'image', source: { type: 'base64', media_type: file.mime, data } };
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: [src, { type: 'text', text: prompt }] }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(errOf(j, r));
    return jsonOf((j.content || []).map((c) => c.text || '').join(''));
  }
  if (provider === 'openai') {
    const src = pdf ? { type: 'input_file', filename: file.name || 'plan.pdf', file_data: 'data:application/pdf;base64,' + data } : { type: 'input_image', image_url: `data:${file.mime};base64,${data}` };
    const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model, max_output_tokens: maxTokens, input: [{ role: 'user', content: [src, { type: 'input_text', text: prompt }] }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(errOf(j, r));
    const t = j.output_text || (j.output || []).flatMap((o) => o.content || []).map((c) => c.text || '').join(''); return jsonOf(t);
  }
  // Gemini
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: file.mime, data } }, { text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(errOf(j, r));
  return jsonOf(((j.candidates || [])[0]?.content?.parts || []).map((p) => p.text || '').join(''));
}

/** 이미지는 긴 변 2000px JPEG 로 줄여 보낸다. 가로·세로 픽셀도 돌려준다 */
export async function prepFile(name, bytes) {
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
