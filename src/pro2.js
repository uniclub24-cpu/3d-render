/* ================================================================
   v7 · 보기 — 1인칭 걷기(키 → 눈높이), 360° 파노라마, 실사 렌더
   ================================================================ */
/* ---------- 6. 걷기 모드 ---------- */
Object.assign(WALK, { x: 0, z: 0, yaw: 0, pitch: 0, eye: 1590, ghost: false });
const JOY = { x: 0, y: 0 };
let walkKeep = null;
const bodyCm = () => store.get('drs_bodyH', 170);
const eyeOf = (cm) => Math.round(cm * 10 - 110);           // 눈높이 ≈ 키 − 11cm
const EYEP = () => [['아이 (120cm)', eyeOf(120)], ['앉은 눈높이', 1200], ['내 키', eyeOf(bodyCm())], ['위에서 (2.4m)', 2400]];
function walkBlocked(x, z) {
  if (WALK.ghost) return false; const R = 170;
  for (const w of P.walls) {
    const [d, t] = distPtSeg(x, z, w); if (d >= wallT(w) / 2 + R) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), at = t * L;
    if (!P.openings.some((o) => o.wall === w.id && (o.sill || 0) < 300 && o.h > 1500 && Math.abs(at - o.t) < o.w / 2 - 100)) return true;
  }
  for (const it of P.items) {
    if (it.hidden || !physical(it)) continue; const s = spec(it);
    if (s.layer !== 'floor' || zOf(it) > 500 || s.h < 350 || s.L.shape === 'zone') continue;
    const b = aabb(corners(it)); if (x > b[0] - 120 && x < b[2] + 120 && z > b[1] - 120 && z < b[3] + 120) return true;
  }
  return false;
}
function walkInside(x, z) { const fp = floorPoly(); if (fp) return pointInPoly(x, z, fp); const b = bounds(); return x > b[0] + 200 && x < b[2] - 200 && z > b[1] + 200 && z < b[3] - 200; }
function walkFree(x, z) {
  if (!walkInside(x, z)) { const b = bounds(); x = clamp(x, b[0] + 600, b[2] - 600); z = clamp(z, b[1] + 600, b[3] - 600); }
  if (!walkBlocked(x, z)) return [x, z];
  for (let r = 300; r < 12000; r += 300) for (let a = 0; a < 16; a++) { const px = x + r * Math.cos(a * Math.PI / 8), pz = z + r * Math.sin(a * Math.PI / 8); if (walkInside(px, pz) && !walkBlocked(px, pz)) return [px, pz]; }
  return [x, z];
}
function walkApply() {
  const f = [Math.cos(WALK.pitch) * Math.cos(WALK.yaw), Math.sin(WALK.pitch), Math.cos(WALK.pitch) * Math.sin(WALK.yaw)], Ey = curElev() + WALK.eye;
  cam.tx = WALK.x + f[0] * 100; cam.ty = Ey + f[1] * 100; cam.tz = WALK.z + f[2] * 100; cam.dist = 100; cam.yaw = WALK.yaw + Math.PI; cam.pitch = -WALK.pitch;
  syncGoal(); need3d = true; reqMini(); updWalkHud();
}
function walkStart() {
  if (!gl || !P) return; if (WALK.on) return;
  if (view === '2d') { setView(isMobile() ? '3d' : 'split'); if (isMobile()) $$('[data-mview]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mview === '3d')); }
  if (document.body.classList.contains('clean')) setClean(false);
  walkKeep = { cam: { ...cam }, cut: cam.cut, fov: cam.fov };
  const E = eye(); const [x, z] = walkFree(cam.tx, cam.tz);
  let yaw = Math.atan2(cam.tz - E[2], cam.tx - E[0]), far = -1; const keepG = WALK.ghost; WALK.ghost = false;
  for (let a = 0; a < 24; a++) { const t = yaw + a * Math.PI / 12; let d = 0; while (d < 15000 && !walkBlocked(x + Math.cos(t) * (d + 200), z + Math.sin(t) * (d + 200))) d += 200; if (d > far + 400) { far = d; if (a) yaw = t; } }
  WALK.ghost = keepG;
  Object.assign(WALK, { on: true, x, z, yaw, pitch: 0, eye: store.get('drs_eye', eyeOf(bodyCm())) });
  cam.cut = false; cam.fov = store.get('drs_wfov', 70); anim = null; tour = null; spin = false; dirty3d = true;
  document.body.classList.add('walking'); $('#walkHud').hidden = false; renderWalkHud(); walkApply(); placeCtx(); renderQuick();
}
function walkStop() {
  if (!WALK.on) return; WALK.on = false; JOY.x = JOY.y = 0;
  Object.assign(cam, walkKeep.cam); cam.cut = walkKeep.cut; cam.fov = walkKeep.fov; syncGoal(); dirty3d = true; need3d = true;
  document.body.classList.remove('walking'); $('#walkHud').hidden = true; reqMini(); renderQuick();
}
function setEye(mm) { WALK.eye = clamp(Math.round(mm), 300, 3200); store.set('drs_eye', WALK.eye); walkApply(); const e = $('#whEye'); if (e) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } }
function walkTeleport(x, z) { if (walkBlocked(x, z)) { toast('벽이나 기물 안이라 갈 수 없어요'); return; } WALK.x = x; WALK.z = z; walkApply(); }
function walkStep(dt) {
  const k = (x) => held.has(x), run = held.has('shift') ? 2.3 : 1;
  const fw = (k('w') || k('arrowup') ? 1 : 0) - (k('s') || k('arrowdown') ? 1 : 0) - JOY.y, st = (k('d') ? 1 : 0) - (k('a') ? 1 : 0) + JOY.x;
  const turn = (k('arrowright') ? 1 : 0) - (k('arrowleft') ? 1 : 0), up = (k('e') || k('pageup') ? 1 : 0) - (k('q') || k('pagedown') ? 1 : 0);
  if (!fw && !st && !turn && !up) return;
  WALK.yaw += turn * 1.7 * dt;
  if (up) { WALK.eye = clamp(WALK.eye + up * 700 * dt, 300, 3200); store.set('drs_eye', Math.round(WALK.eye)); }
  const sp = 1500 * run * dt, c = Math.cos(WALK.yaw), s = Math.sin(WALK.yaw), dx = (c * fw - s * st) * sp, dz = (s * fw + c * st) * sp;
  if (!walkBlocked(WALK.x + dx, WALK.z + dz)) { WALK.x += dx; WALK.z += dz; }
  else { if (!walkBlocked(WALK.x + dx, WALK.z)) WALK.x += dx; else if (!walkBlocked(WALK.x, WALK.z + dz)) WALK.z += dz; }
  walkApply();
}
const _pk = panKeys; panKeys = function (dt) { if (WALK.on) { walkStep(dt); return; } _pk(dt); };
const _cg = clampGoal; clampGoal = function () { if (WALK.on) return; _cg(); };
function renderWalkHud() {
  const h = $('#walkHud'), cm = bodyCm();
  h.innerHTML = `<div class="whrow"><b class="whtitle">${ICO('<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6l-3 8M12 13l3 8M8 10l4-2 4 2"/>', 16)} 걷기</b>
    <label class="whh">키<input id="whBody" type="number" inputmode="numeric" min="80" max="230" value="${cm}" aria-label="내 키 cm"><span>cm</span></label>
    <span class="wheye" id="whEye" aria-live="polite"></span>
    <span class="whud"><button class="qb" id="whDn" aria-label="눈높이 낮추기" title="눈높이 낮추기 (Q)">▼</button><button class="qb" id="whUp" aria-label="눈높이 높이기" title="눈높이 높이기 (E)">▲</button></span>
    <button class="qb" id="whGhost" aria-pressed="${WALK.ghost}" title="벽 · 기물 통과">통과 ${WALK.ghost ? 'ON' : 'OFF'}</button>
    <button class="qb on" id="whX">나가기</button></div>
    <div class="whrow whp">${EYEP().map(([n, v], i) => `<button class="chip" data-eye="${v}" title="${i + 1}번 키">${i + 1} · ${n}</button>`).join('')}</div>
    <p class="whk">WASD 걷기 · ←→ 돌기 · 끌어서 둘러보기 · Q/E 눈높이 · 1~4 눈높이 고르기 · Shift 빨리 · Esc 나가기</p>`;
  $('#whBody').addEventListener('change', (e) => { const v = clamp(+e.target.value || 170, 80, 230); store.set('drs_bodyH', v); setEye(eyeOf(v)); renderWalkHud(); });
  $('#whBody').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); });
  $('#whDn').onclick = () => setEye(WALK.eye - 100); $('#whUp').onclick = () => setEye(WALK.eye + 100);
  $('#whGhost').onclick = () => { WALK.ghost = !WALK.ghost; renderWalkHud(); };
  $('#whX').onclick = walkStop; $$('[data-eye]', h).forEach((b) => (b.onclick = () => setEye(+b.dataset.eye)));
  updWalkHud();
}
function updWalkHud() { const e = $('#whEye'); if (e) e.innerHTML = `눈높이 <b>${Math.round(WALK.eye).toLocaleString()}</b>mm`; }
// 걷기 중 입력 가로채기 (끌어서 둘러보기 · 휠 = 화각)
{ let lk = null;
  gc.addEventListener('pointerdown', (e) => { if (!WALK.on || commentOn) return; e.stopImmediatePropagation(); gc.setPointerCapture(e.pointerId); lk = { x: e.clientX, y: e.clientY, yaw: WALK.yaw, pitch: WALK.pitch, id: e.pointerId }; }, true);
  gc.addEventListener('pointermove', (e) => { if (!WALK.on || !lk || e.pointerId !== lk.id) return; e.stopImmediatePropagation(); WALK.yaw = lk.yaw + (e.clientX - lk.x) * 0.0042; WALK.pitch = clamp(lk.pitch - (e.clientY - lk.y) * 0.0042, -1.35, 1.35); walkApply(); }, true);
  const up = (e) => { if (!WALK.on) return; e.stopImmediatePropagation(); lk = null; };
  gc.addEventListener('pointerup', up, true); gc.addEventListener('pointercancel', up, true);
  gc.addEventListener('wheel', (e) => { if (!WALK.on) return; e.preventDefault(); e.stopImmediatePropagation(); cam.fov = clamp((cam.fov || 70) + e.deltaY * 0.03, 35, 100); store.set('drs_wfov', cam.fov); need3d = true; }, { capture: true, passive: false });
  // 조이스틱 (터치)
  const jy = $('#joy'), knob = $('#joyK'); let jp = null;
  jy.addEventListener('pointerdown', (e) => { try { jy.setPointerCapture(e.pointerId); } catch (er) {} jp = jy.getBoundingClientRect(); mv(e); });
  const mv = (e) => { if (!jp) return; const r = jp.width / 2, dx = clamp((e.clientX - jp.left - r) / r, -1, 1), dy = clamp((e.clientY - jp.top - r) / r, -1, 1), m = Math.hypot(dx, dy), k = m > 1 ? 1 / m : 1; JOY.x = dx * k; JOY.y = dy * k; knob.style.transform = `translate(${JOY.x * r * .6}px, ${JOY.y * r * .6}px)`; held.add('_joy'); };
  jy.addEventListener('pointermove', mv);
  const end = () => { jp = null; JOY.x = JOY.y = 0; knob.style.transform = ''; held.delete('_joy'); };
  jy.addEventListener('pointerup', end); jy.addEventListener('pointercancel', end);
}
addEventListener('keydown', (e) => {
  if (!WALK.on || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
  const k = e.code && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : (e.key || '').toLowerCase();
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); walkStop(); return; }
  if (/^[1-4]$/.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); setEye(EYEP()[+e.key - 1][1]); return; }
  if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'pageup', 'pagedown', 'shift'].includes(k)) { e.preventDefault(); e.stopImmediatePropagation(); held.add(k); }
  else if (!(e.ctrlKey || e.metaKey) && !['f1', 'g'].includes(k)) e.stopImmediatePropagation();
}, true);

/* ---------- 7. 360° 파노라마 ---------- */
function camLook(pos, yaw, pitch, fov) { const f = [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)]; return { tx: pos[0] + f[0] * 100, ty: pos[1] + f[1] * 100, tz: pos[2] + f[2] * 100, dist: 100, yaw: yaw + Math.PI, pitch: -pitch, fov, f }; }
async function panoMake(W = 4096, onp) {
  const H = W / 2, F = Math.min(1536, Math.round(W / 3)), FOV = 94;
  const fr = WALK.on ? null : walkFree(cam.tx, cam.tz), pos = WALK.on ? [WALK.x, curElev() + WALK.eye, WALK.z] : [fr[0], curElev() + store.get('drs_eye', 1590), fr[1]];
  const yaw0 = WALK.on ? WALK.yaw : Math.atan2(cam.tz - eye()[2], cam.tx - eye()[0]);
  const keepCut = cam.cut; cam.cut = false; dirty3d = true;
  const dirs = [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0], [0, Math.PI / 2 - 1e-4], [0, -Math.PI / 2 + 1e-4]];
  const faces = [];
  try {
    for (const [dy, p] of dirs) {
      const C = camLook(pos, yaw0 + dy, p, FOV), c = snapshot3d(F, F, C); if (!c) throw new Error('3D 없음');
      const M = mul(mat4Persp(FOV * Math.PI / 180, 1, 50, 200000), mat4Look(pos, [C.tx, C.ty, C.tz]));
      faces.push({ M, f: C.f, px: c.getContext('2d').getImageData(0, 0, F, F).data });
      if (onp) onp(faces.length / 12); await new Promise((r) => setTimeout(r, 0));
    }
  } finally { cam.cut = keepCut; dirty3d = true; need3d = true; }
  const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'), img = og.createImageData(W, H), o = img.data;
  for (let v = 0; v < H; v++) {
    const lat = Math.PI / 2 - (v + .5) / H * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let u = 0; u < W; u++) {
      const lon = yaw0 + (u + .5) / W * 2 * Math.PI - Math.PI, d = [cl * Math.cos(lon), sl, cl * Math.sin(lon)];
      let bi = 0, bd = -2; for (let i = 0; i < 6; i++) { const f = faces[i].f, dd = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (dd > bd) { bd = dd; bi = i; } }
      const M = faces[bi].M, q = [pos[0] + d[0] * 1000, pos[1] + d[1] * 1000, pos[2] + d[2] * 1000];
      const x = M[0] * q[0] + M[4] * q[1] + M[8] * q[2] + M[12], y = M[1] * q[0] + M[5] * q[1] + M[9] * q[2] + M[13], w = M[3] * q[0] + M[7] * q[1] + M[11] * q[2] + M[15];
      const sx = clamp(Math.floor((x / w * .5 + .5) * F), 0, F - 1), sy = clamp(Math.floor((1 - (y / w * .5 + .5)) * F), 0, F - 1), si = (sy * F + sx) * 4, oi = (v * W + u) * 4, px = faces[bi].px;
      o[oi] = px[si]; o[oi + 1] = px[si + 1]; o[oi + 2] = px[si + 2]; o[oi + 3] = 255;
    }
    if (v % 96 === 0) { if (onp) onp(.5 + v / H / 2); await new Promise((r) => setTimeout(r, 0)); }
  }
  og.putImageData(img, 0, 0); return out;
}
function addGPano(bytes, W, H) {
  const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" GPano:ProjectionType="equirectangular" GPano:UsePanoramaViewer="True" GPano:FullPanoWidthPixels="${W}" GPano:FullPanoHeightPixels="${H}" GPano:CroppedAreaImageWidthPixels="${W}" GPano:CroppedAreaImageHeightPixels="${H}" GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0"/></rdf:RDF></x:xmpmeta>`;
  const pl = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xmp), len = pl.length + 2;
  let at = 2; if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + (bytes[4] << 8 | bytes[5]);
  const out = new Uint8Array(bytes.length + len + 2); out.set(bytes.subarray(0, at)); out.set([0xff, 0xe1, len >> 8, len & 255], at); out.set(pl, at + 4); out.set(bytes.subarray(at), at + 4 + pl.length); return out;
}
function panoViewerHtml(b64, title) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 360°</title>
<style>html,body{margin:0;height:100%;background:#111;overflow:hidden;font:14px -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}canvas{width:100%;height:100%;display:block;touch-action:none}.t{position:fixed;left:16px;top:16px;color:#fff;background:rgba(0,0,0,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:8px 14px;border-radius:999px}</style></head>
<body><canvas id="c"></canvas><div class="t">${esc(title)} · 끌어서 둘러보기</div><script>
const c=document.getElementById('c'),g=c.getContext('webgl');const im=new Image();let yaw=0,pit=0,fov=1.3;
const vs='attribute vec2 p;varying vec2 q;void main(){q=p;gl_Position=vec4(p,0.,1.);}',fs='precision highp float;varying vec2 q;uniform sampler2D t;uniform vec3 a;uniform float r;void main(){float th=tan(a.z/2.);vec3 d=normalize(vec3(q.x*th*r,q.y*th,1.));float cp=cos(a.y),sp=sin(a.y);d=vec3(d.x,d.y*cp+d.z*sp,-d.y*sp+d.z*cp);float cy=cos(a.x),sy=sin(a.x);d=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy);float u=atan(d.x,d.z)/6.2831853+.5,v=acos(clamp(d.y,-1.,1.))/3.1415927;gl_FragColor=texture2D(t,vec2(u,v));}';
const sh=(t,s)=>{const x=g.createShader(t);g.shaderSource(x,s);g.compileShader(x);return x},pr=g.createProgram();g.attachShader(pr,sh(g.VERTEX_SHADER,vs));g.attachShader(pr,sh(g.FRAGMENT_SHADER,fs));g.linkProgram(pr);g.useProgram(pr);
const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,2,g.FLOAT,false,0,0);
function draw(){const d=devicePixelRatio||1;c.width=innerWidth*d;c.height=innerHeight*d;g.viewport(0,0,c.width,c.height);g.uniform3f(g.getUniformLocation(pr,'a'),yaw,pit,fov);g.uniform1f(g.getUniformLocation(pr,'r'),c.width/c.height);g.drawArrays(g.TRIANGLE_STRIP,0,4);}
im.onload=()=>{const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGB,g.RGB,g.UNSIGNED_BYTE,im);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);draw();};
let d0=null;c.onpointerdown=e=>{c.setPointerCapture(e.pointerId);d0=[e.clientX,e.clientY,yaw,pit]};c.onpointermove=e=>{if(!d0)return;yaw=d0[2]-(e.clientX-d0[0])*.005;pit=Math.max(-1.5,Math.min(1.5,d0[3]+(e.clientY-d0[1])*.005));draw()};c.onpointerup=()=>d0=null;
c.onwheel=e=>{e.preventDefault();fov=Math.max(.5,Math.min(2,fov+e.deltaY*.001));draw()};onresize=draw;im.src='data:image/jpeg;base64,${b64}';
<\/script></body></html>`;
}
function panoExport() { expFmt = 'pano'; $('#exportBtn').click(); }

/* ---------- 12. 실사 렌더 (그림자 · 부드러운 빛 · 톤 매핑, 여러 장 누적) ---------- */
let HQ = null, hqBusy = false, hqLast = null;
function hqInit() {
  if (HQ) return HQ;
  const mk = (vs, fs) => { const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }; const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
  const hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT), prec = hp && hp.precision > 0 ? 'highp' : 'mediump';
  const S = mk('attribute vec3 p;uniform mat4 S;varying float dz;void main(){vec4 q=S*vec4(p,1.);gl_Position=q;dz=q.z/q.w*.5+.5;}',
    `precision ${prec} float;varying float dz;void main(){vec4 e=fract(vec4(1.,255.,65025.,16581375.)*dz);e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=e;}`);
  const M = mk('attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute vec2 u;uniform mat4 M;uniform mat4 S;varying vec3 vn,vc,vw;varying vec2 vu;varying vec4 vs;void main(){gl_Position=M*vec4(p,1.);vn=n;vc=c;vu=u;vw=p;vs=S*vec4(p,1.);}',
    `precision ${prec} float;varying vec3 vn,vc,vw;varying vec2 vu;varying vec4 vs;uniform sampler2D T,SM;uniform float useT,A,K,tx,amb,sunK,y0;uniform vec3 L,E,sunC;
    float up(vec4 c){return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.));}
    void main(){vec3 nn=normalize(vn);vec3 V=normalize(E-vw);if(dot(nn,V)<0.)nn=-nn;
      vec3 sc=vs.xyz/vs.w*.5+.5;float nl=dot(nn,L),b=.0009+.0025*(1.-abs(nl)),sh=0.;
      for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){sh+=sc.z-b>up(texture2D(SM,sc.xy+vec2(float(i),float(j))*tx))?0.:1.;}sh/=25.;
      if(sc.x<0.||sc.x>1.||sc.y<0.||sc.y>1.||sc.z>1.)sh=1.;
      vec3 col=vc;if(useT>.5)col*=texture2D(T,vu).rgb;
      float h=.5+.5*nn.y;vec3 sky=mix(vec3(.50,.47,.44),vec3(.86,.90,1.),h);
      float ao=mix(.72,1.,clamp((vw.y-y0)/650.,0.,1.))*mix(.92,1.,h);
      vec3 Hh=normalize(L+V);float spec=pow(max(dot(nn,Hh),0.),48.)*sh*step(0.,nl)*.22;
      vec3 o=(col*(amb*sky*ao+sunK*max(nl,0.)*sh*sunC)+spec*sunC)*K;
      o=(o*(2.51*o+.03))/(o*(2.43*o+.59)+.14);gl_FragColor=vec4(pow(clamp(o,0.,1.),vec3(.92)),A);}`);
  HQ = { S, M };
  return HQ;
}
function ortho(l, r, b, t, n, f) { return [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]; }
const TIMES = { morning: { sun: 100, alt: 22, c: [1, .86, .7], n: '아침' }, noon: { sun: 200, alt: 62, c: [1, .97, .92], n: '한낮' }, after: { sun: 250, alt: 38, c: [1, .92, .82], n: '오후' }, dusk: { sun: 285, alt: 12, c: [1, .7, .5], n: '노을' }, now: { n: '지금 설정' } };
async function hqRender(o, onp) {
  if (!gl) throw new Error('이 기기에서 3D를 켤 수 없어요');
  const { W, H, N, C, tm } = o, P0 = hqInit(); if (dirty3d) buildScene();
  const rs = P.render || { sun: 35, alt: 55, bright: 1 }, t = TIMES[tm] && TIMES[tm].sun != null ? TIMES[tm] : { sun: rs.sun, alt: rs.alt, c: [1, .96, .9] };
  const maxT = gl.getParameter(gl.MAX_TEXTURE_SIZE), SMs = Math.min(4096, maxT, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  const smT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, smT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SMs, SMs, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SMs, SMs);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, smT, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const b = bounds(), cxw = (b[0] + b[2]) / 2, czw = (b[1] + b[3]) / 2, R = 0.5 * Math.hypot(b[2] - b[0], b[3] - b[1]) + 2500, Y0 = curElev();
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H; { const g = bg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#b9cfe0'); gr.addColorStop(.6, '#e4ebef'); gr.addColorStop(1, '#f1efe9'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  const acc = document.createElement('canvas'); acc.width = W; acc.height = H; const ag = acc.getContext('2d'), tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tg = tmp.getContext('2d');
  const ow = gc.width, oh = gc.height, at = (p, nm) => gl.getAttribLocation(p, nm), un = (p, nm) => gl.getUniformLocation(p, nm);
  const bindA = (p, m, list) => { for (const [nm, bf, sz] of list) { const a = at(p, nm); if (a < 0) continue; gl.bindBuffer(gl.ARRAY_BUFFER, bf); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, sz, gl.FLOAT, false, 0, 0); } };
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  try {
    for (let i = 0; i < N; i++) {
      const jz = (rnd(i) - .5) * 4 * Math.PI / 180, ja = (rnd(i + 99) - .5) * 4 * Math.PI / 180;
      const az = t.sun * Math.PI / 180 + jz, al = clamp(t.alt * Math.PI / 180 + ja, .05, 1.53), Ld = [Math.cos(al) * Math.cos(az), Math.sin(al), Math.cos(al) * Math.sin(az)];
      const LE = [cxw + Ld[0] * R * 2, Y0 + 1000 + Ld[1] * R * 2, czw + Ld[2] * R * 2], SMat = mul(ortho(-R, R, -R, R, 10, R * 4.5), mat4Look(LE, [cxw, Y0 + 1000, czw]));
      // 그림자 맵
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, SMs, SMs); gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(P0.S); gl.uniformMatrix4fv(un(P0.S, 'S'), false, new Float32Array(SMat));
      for (const m of meshes) { if (m.alpha < 0.9) continue; bindA(P0.S, m, [['p', m.p, 3]]); gl.drawArrays(gl.TRIANGLES, 0, m.n); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // 본 화면
      gc.width = W; gc.height = H; gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const E = eye(C), Pm = mat4Persp((C.fov || 50) * Math.PI / 180, W / H, 50, 200000); Pm[8] += (rnd(i + 7) - .5) * 2 / W; Pm[9] += (rnd(i + 13) - .5) * 2 / H;
      const Mm = mul(Pm, mat4Look(E, [C.tx, C.ty, C.tz]));
      gl.useProgram(P0.M); gl.uniformMatrix4fv(un(P0.M, 'M'), false, new Float32Array(Mm)); gl.uniformMatrix4fv(un(P0.M, 'S'), false, new Float32Array(SMat));
      gl.uniform3f(un(P0.M, 'L'), ...Ld); gl.uniform3f(un(P0.M, 'E'), ...E); gl.uniform3f(un(P0.M, 'sunC'), ...t.c);
      gl.uniform1f(un(P0.M, 'K'), (rs.bright || 1) * 1.18); gl.uniform1f(un(P0.M, 'tx'), 1 / SMs); gl.uniform1f(un(P0.M, 'amb'), .78); gl.uniform1f(un(P0.M, 'sunK'), 1.05); gl.uniform1f(un(P0.M, 'y0'), Y0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, smT); gl.uniform1i(un(P0.M, 'SM'), 1); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(un(P0.M, 'T'), 0);
      const draw = (m) => { bindA(P0.M, m, [['p', m.p, 3], ['n', m.n_, 3], ['c', m.c, 3], ['u', m.u, 2]]); const tt = tex[m.key]; gl.uniform1f(un(P0.M, 'useT'), tt ? 1 : 0); if (tt) gl.bindTexture(gl.TEXTURE_2D, tt); gl.uniform1f(un(P0.M, 'A'), m.alpha); gl.drawArrays(gl.TRIANGLES, 0, m.n); };
      gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); meshes.filter((m) => m.alpha >= 1).forEach(draw);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); meshes.filter((m) => m.alpha < 1).forEach(draw); gl.depthMask(true);
      tg.globalAlpha = 1; tg.drawImage(bg, 0, 0); tg.drawImage(gc, 0, 0);
      ag.globalAlpha = 1 / (i + 1); ag.drawImage(tmp, 0, 0);
      gc.width = ow; gc.height = oh; need3d = true;
      if (onp) onp((i + 1) / N, acc); await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); gl.deleteTexture(smT); gl.activeTexture(gl.TEXTURE0);
    gc.width = ow; gc.height = oh; need3d = true;
  }
  // 마무리: 비네트 · 살짝 대비
  ag.globalAlpha = 1; const vg = ag.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .45, W / 2, H / 2, Math.hypot(W, H) * .6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.22)'); ag.fillStyle = vg; ag.fillRect(0, 0, W, H);
  return acc;
}
function openHQ() {
  const d = $('#hqDlg'); $('#hqStatus').textContent = ''; $('#hqBar').style.width = '0'; $('#hqSave').disabled = !hqLast; $('#hqSavePng').disabled = !hqLast;
  const pv = $('#hqPrev'); if (!hqLast) { const c = snapshot3d(960, 540, { ...cam }); if (c) { pv.width = c.width; pv.height = c.height; pv.getContext('2d').drawImage(c, 0, 0); } }
  $('#hqScene').innerHTML = `<option value="now">지금 보는 화면</option><option value="iso">45° 전체</option>${scenes().map((s, i) => `<option value="s${i}">장면 · ${esc(s.name)}</option>`).join('')}`;
  d.showModal();
}
function hqCam(v) { if (v === 'iso') return { ...isoCam(), ty: curElev() }; if (v && v[0] === 's') { const s = scenes()[+v.slice(1)]; if (s) return { ...cam, ...s }; } return { ...cam }; }
async function runHQ() {
  if (hqBusy) return; hqBusy = true; const [W, H] = $('#hqRes').value.split('x').map(Number), N = +$('#hqN').value, tm = $('#hqTime').value, cut = $('#hqCut').checked;
  const keepCut = cam.cut, C = hqCam($('#hqScene').value); cam.cut = cut; C.cut = cut; dirty3d = true;
  const st = $('#hqStatus'), bar = $('#hqBar'), pv = $('#hqPrev'); const t0 = performance.now(); $('#hqGo').disabled = true;
  try {
    const out = await hqRender({ W, H, N, C, tm }, (p, acc) => { bar.style.width = Math.round(p * 100) + '%'; st.textContent = `계산 중 ${Math.round(p * 100)}% · ${Math.round(p * N)}/${N}장 겹치는 중`; if (acc) { pv.width = 960; pv.height = Math.round(960 * H / W); pv.getContext('2d').drawImage(acc, 0, 0, pv.width, pv.height); } });
    hqLast = out; pv.getContext('2d').drawImage(out, 0, 0, pv.width, pv.height);
    st.textContent = `완료 · ${W}×${H} · ${((performance.now() - t0) / 1000).toFixed(1)}초`; $('#hqSave').disabled = false; $('#hqSavePng').disabled = false;
  } catch (e) { console.error(e); st.textContent = '렌더하지 못했어요: ' + (e.message || e); }
  finally { cam.cut = keepCut; dirty3d = true; hqBusy = false; $('#hqGo').disabled = false; }
}
async function hqSave(png) { if (!hqLast) return; const base = (P.name || 'render').replace(/[\\/:*?"<>|]/g, '_'); const blob = await new Promise((r) => hqLast.toBlob(r, png ? 'image/png' : 'image/jpeg', .93)); saveLocal({ name: `${base}_실사.${png ? 'png' : 'jpg'}`, blob }); }
