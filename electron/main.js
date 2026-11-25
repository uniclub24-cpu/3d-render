// Electron 메인 프로세스: 창 띄우기 · 로컬 파일 서빙(app://) · 파일 열기/저장
const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');
const { spawn, execFile } = require('child_process');
const fss = require('fs');

const ROOT = path.join(__dirname, '..', 'renderer');

// ES 모듈 · fetch 가 file:// 에서 막히지 않도록 자체 스킴으로 renderer 폴더를 서빙한다 (네트워크 사용 없음)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

const SMOKE = process.argv.includes('--smoke'); // CI 확인용: 화면이 뜨고 앱이 시작되면 0, 아니면 1 로 끝낸다
function smoke(win) {
  const errs = []; win.webContents.on('console-message', (e, level, msg) => { if (level >= 3) errs.push(msg); });
  const t0 = Date.now(), tick = async () => {
    const ok = await win.webContents.executeJavaScript('!!(window.BYR && BYR.S.model && BYR.plan)').catch(() => false);
    if (ok) {
      const r = await win.webContents.executeJavaScript(`(async () => { const res = await fetch('./data/legacy-sample.json'); await BYR.openJson('샘플', new Uint8Array(await res.arrayBuffer())); for (const s of ['toon','tycoon','comic','clay','lowpoly','pop','oriental','plan','real']) BYR.setStyle(s); const L = BYR.S.model.levels[0]; return L.walls.length + '/' + L.items.length; })()`).catch((e) => 'ERR ' + e.message);
      console.log('[smoke] boot ok · sample walls/items', r, errs.length ? '· console errors: ' + errs.join(' | ') : '');
      app.exit(/^ERR/.test(r) || errs.length ? 1 : 0); return;
    }
    if (Date.now() - t0 > 90000) { console.log('[smoke] timeout', errs.join(' | ')); app.exit(1); return; }
    setTimeout(tick, 500);
  };
  win.webContents.once('did-finish-load', tick);
}

/* ---------- 자동 업데이트 ----------
 * 설치판(Setup): GitHub 릴리스(latest.yml)에서 새 버전을 뒤에서 받아 두고, 다 받으면 "지금 다시 시작 / 나중에(끌 때 설치)" 를 묻는다.
 * 포터블 exe: 스스로 바꿀 수 없으므로 화면(렌더러)에서 새 버전 알림 + 받기 링크만 보여 준다. 작업 파일은 사용자 폴더에 있어 버전이 바뀌어도 그대로. */
const PORTABLE = !!process.env.PORTABLE_EXECUTABLE_DIR;
const UPD = app.isPackaged ? (PORTABLE ? 'portable' : 'setup') : 'dev';
function autoUpdate(win) {
  if (UPD !== 'setup' || SMOKE) return; let au; try { au = require('electron-updater').autoUpdater; } catch (e) { console.warn('updater', e.message); return; }
  au.autoDownload = true; au.autoInstallOnAppQuit = true;
  const send = (m) => { try { win.webContents.send('update', m); } catch {} };
  au.on('update-available', (i) => send({ state: 'downloading', version: i.version }));
  au.on('download-progress', (p) => send({ state: 'progress', pct: Math.round(p.percent) }));
  au.on('error', (e) => send({ state: 'error', msg: String(e && e.message || e).slice(0, 200) }));
  au.on('update-downloaded', (i) => { send({ state: 'ready', version: i.version });
    dialog.showMessageBox(win, { type: 'info', buttons: ['지금 다시 시작', '나중에 (끌 때 설치)'], defaultId: 0, cancelId: 1, title: 'BYR2 업데이트', message: `새 버전 ${i.version} 을 받았어요`, detail: '다시 시작하면 바로 바뀌어요. 작업은 자동 저장돼 있어요.' })
      .then((r) => { if (r.response === 0) { win.__quit = true; setImmediate(() => au.quitAndInstall(true, true)); } }); });
  const check = () => au.checkForUpdates().catch(() => {}); setTimeout(check, 8000); setInterval(check, 6 * 3600 * 1000);
}

/* ---------- 듀얼 모니터: 보조 창 (설정에서 켤 때만) ---------- */
let mainWin = null, sideWin = null;
ipcMain.handle('side:open', (e, opt = {}) => {
  if (!mainWin || e.sender !== mainWin.webContents) return { ok: false };
  if (sideWin && !sideWin.isDestroyed()) { sideWin.show(); sideWin.focus(); return { ok: true }; }
  const md = screen.getDisplayMatching(mainWin.getBounds()), others = screen.getAllDisplays().filter((d) => d.id !== md.id);
  let d = null; if (others.length) { const right = others.filter((o) => o.bounds.x >= md.bounds.x), left = others.filter((o) => o.bounds.x < md.bounds.x); d = (opt.where === 'left' ? left[0] || right[0] : right[0] || left[0]) || others[0]; }
  const wa = (d || md).workArea, single = !d, b = single ? { x: wa.x + Math.round(wa.width * 0.5), y: wa.y + 40, width: Math.round(wa.width * 0.5), height: wa.height - 80 } : wa;
  sideWin = new BrowserWindow({ ...b, minWidth: 600, minHeight: 400, backgroundColor: '#1b1d21', autoHideMenuBar: true, title: 'BYR2 · 보조 창',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  sideWin.removeMenu(); if (!single) sideWin.maximize();
  sideWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  sideWin.webContents.on('will-navigate', (ev, url) => { if (!url.startsWith('app://byr/')) ev.preventDefault(); });
  sideWin.on('closed', () => { sideWin = null; try { mainWin && !mainWin.isDestroyed() && mainWin.webContents.send('side:closed'); } catch {} });
  sideWin.loadURL('app://byr/index.html?side=1');
  return { ok: true, single };
});
ipcMain.handle('side:close', () => { if (sideWin && !sideWin.isDestroyed()) sideWin.close(); return true; });
ipcMain.on('side:state', (e, m) => { if (mainWin && e.sender === mainWin.webContents && sideWin && !sideWin.isDestroyed()) sideWin.webContents.send('side:state', m); });

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#1b1d21', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // 창 닫기(X) · Alt+F4: 종료할지 묻는다 (작업은 자동 저장돼 있음). 앱 안 "종료" 메뉴는 이미 물었으니 바로 닫는다(__quit).
  win.on('close', (e) => {
    if (win.__quit || SMOKE) return; e.preventDefault();
    dialog.showMessageBox(win, { type: 'question', buttons: ['종료', '취소'], defaultId: 1, cancelId: 1, title: 'BYR2', message: 'BYR2 를 종료할까요?', detail: '작업은 이 PC 에 자동 저장돼 있어요. 다시 켜면 이어서 할 수 있어요.' })
      .then((r) => { if (r.response === 0) { win.__quit = true; win.close(); } });
  });
  win.removeMenu(); /* Alt 를 눌러도 메뉴 막대가 뜨지 않게 (Alt+끌기 = 공간 그리기) */
  mainWin = win; win.on('closed', () => { mainWin = null; if (sideWin && !sideWin.isDestroyed()) sideWin.destroy(); });
  win.loadURL('app://byr/index.html'); autoUpdate(win);
  if (SMOKE) smoke(win);
  // 외부 링크로 창이 넘어가지 않게
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://byr/')) e.preventDefault(); });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // 파일 열기: [{ name, path, data(Uint8Array) }]
  /* 공공데이터 · 지도 API (브라우저 CORS 우회) — 정해진 주소만 */
  ipcMain.handle('net:get', async (e, url) => {
    const u = String(url || ''); if (!/^https:\/\/(api\.vworld\.kr|apis\.data\.go\.kr|overpass-api\.de|overpass\.kumi\.systems|nominatim\.openstreetmap\.org)\//.test(u)) return { ok: false, status: 0, text: 'blocked' };
    try { const r = await net.fetch(u, { headers: { 'User-Agent': 'BYR2/' + app.getVersion() } }); return { ok: r.ok, status: r.status, text: await r.text() }; } catch (err) { return { ok: false, status: 0, text: String(err && err.message || err) }; }
  });
  ipcMain.handle('net:bin', async (e, url) => {
    const u = String(url || ''); if (!/^https:\/\/(api\.vworld\.kr|xdworld\.vworld\.kr|s3\.amazonaws\.com\/elevation-tiles-prod|elevation-tiles-prod\.s3\.amazonaws\.com)\//.test(u)) return { ok: false, status: 0, text: 'blocked' };
    try { const r = await net.fetch(u, { headers: { 'User-Agent': 'BYR2/' + app.getVersion() } }); return r.ok ? { ok: true, status: r.status, data: new Uint8Array(await r.arrayBuffer()) } : { ok: false, status: r.status, text: (await r.text()).slice(0, 200) }; } catch (err) { return { ok: false, status: 0, text: String(err && err.message || err) }; }
  });
  /* ---------- 블렌더 실사 렌더: 이 PC 의 블렌더를 화면 없이 실행 → render.png + scene.blend ---------- */
  const REND = () => path.join(app.getPath('userData'), 'blender-renders');
  const verOf = (exe) => new Promise((ok) => execFile(exe, ['--version'], { timeout: 30000, windowsHide: true }, (err, out) => { const m = String(out || '').match(/Blender\s+(\d+\.\d+(\.\d+)?)/); ok(err && !m ? null : m ? m[1] : null); }));
  async function findBlender() {
    const C = []; const add = (p) => { if (p && fss.existsSync(p)) C.push(p); };
    if (process.platform === 'win32') { for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files', 'D:\\Program Files'].filter(Boolean)) { const bf = path.join(base, 'Blender Foundation'); try { for (const d of fss.readdirSync(bf).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) add(path.join(bf, d, 'blender.exe')); } catch {} add(path.join(base, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe')); }
      try { const la = path.join(process.env.LOCALAPPDATA || '', 'Programs'); for (const d of fss.readdirSync(la)) if (/blender/i.test(d)) add(path.join(la, d, 'blender.exe')); } catch {} }
    else if (process.platform === 'darwin') add('/Applications/Blender.app/Contents/MacOS/Blender');
    else { add('/usr/bin/blender'); add('/snap/bin/blender'); add('/usr/local/bin/blender'); }
    for (const exe of C) { const v = await verOf(exe); if (v) return { path: exe, version: v }; }
    const v = await verOf(process.platform === 'win32' ? 'blender.exe' : 'blender'); return v ? { path: process.platform === 'win32' ? 'blender.exe' : 'blender', version: v } : null;
  }
  ipcMain.handle('blender:find', async (e, custom) => { if (custom) { const v = await verOf(custom); if (v) return { path: custom, version: v }; } return findBlender(); });
  ipcMain.handle('blender:pick', async (e) => { const w = BrowserWindow.fromWebContents(e.sender), r = await dialog.showOpenDialog(w, { title: '블렌더 실행 파일 (blender.exe)', properties: ['openFile'], filters: process.platform === 'win32' ? [{ name: 'Blender', extensions: ['exe'] }] : [] }); if (r.canceled || !r.filePaths[0]) return null; const v = await verOf(r.filePaths[0]); return v ? { path: r.filePaths[0], version: v } : { path: r.filePaths[0], version: null }; });
  let job = null;
  ipcMain.handle('blender:run', async (e, { exe, glb, plan }) => {
    if (job) return { ok: false, error: '이미 렌더 중이에요' }; const v = await verOf(exe); if (!v) return { ok: false, error: '블렌더를 실행할 수 없어요' };
    const dir = path.join(REND(), new Date().toISOString().replace(/[:.]/g, '-')); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'scene.glb'), Buffer.from(glb)); await fs.writeFile(path.join(dir, 'plan.json'), JSON.stringify(plan)); await fs.writeFile(path.join(dir, 'byr_render.py'), await fs.readFile(path.join(ROOT, 'blender', 'byr_render.py')));
    const send = (t) => { try { e.sender.send('blender:log', t); } catch {} };
    return new Promise((ok) => {
      const ch = spawn(exe, ['-b', '--factory-startup', '-P', path.join(dir, 'byr_render.py'), '--', dir], { windowsHide: true }); job = ch; let tail = '', errT = '';
      const onData = (b) => { tail += b.toString(); const L = tail.split(/\r?\n/); tail = L.pop(); for (const l of L) if (/BYR:|Sample \d+\/\d+|Error|Traceback|rror:/.test(l)) send(l.slice(0, 300)); };
      ch.stdout.on('data', onData); ch.stderr.on('data', (b) => { errT = (errT + b.toString()).slice(-2000); onData(b); });
      ch.on('close', async (code) => { job = null; const png = path.join(dir, 'render.png'); if (fss.existsSync(png)) ok({ ok: true, dir, png: new Uint8Array(await fs.readFile(png)), version: v }); else ok({ ok: false, dir, error: code === null ? '취소했어요' : `블렌더가 끝났지만 그림이 없어요 (코드 ${code}) ${errT.slice(-300)}` }); });
      ch.on('error', (err) => { job = null; ok({ ok: false, error: String(err && err.message || err) }); });
    });
  });
  ipcMain.handle('blender:cancel', () => { if (job) { try { job.kill(); } catch {} } return true; });
  ipcMain.handle('blender:open', (e, dir, what) => { const d = path.resolve(String(dir || '')); if (!d.startsWith(REND())) return false; shell.openPath(what === 'blend' ? path.join(d, 'scene.blend') : d); return true; });
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), update: UPD }));
  ipcMain.handle('open:url', (e, url) => { if (/^https:\/\/(github\.com\/uniclub24-cpu\/3d-render\/|www\.blender\.org\/download\/)/.test(String(url))) shell.openExternal(url); }); /* 업데이트 받기 · 블렌더 받기 링크만 */
  ipcMain.handle('app:quit', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) { w.__quit = true; w.close(); } });
  ipcMain.handle('file:open', async (e, opt = {}) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: opt.title, filters: opt.filters, properties: ['openFile', ...(opt.multi ? ['multiSelections'] : [])],
    });
    if (r.canceled) return [];
    return Promise.all(r.filePaths.map(async (p) => ({ name: path.basename(p), path: p, data: await fs.readFile(p) })));
  });

  // 파일 저장: data 는 문자열 또는 Uint8Array
  ipcMain.handle('file:save', async (e, opt = {}) => {
    const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { title: opt.title, defaultPath: opt.defaultName, filters: opt.filters });
    if (r.canceled || !r.filePath) return null;
    await fs.writeFile(r.filePath, typeof opt.data === 'string' ? opt.data : Buffer.from(opt.data));
    return r.filePath;
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
