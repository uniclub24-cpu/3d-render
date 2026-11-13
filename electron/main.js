// Electron 메인 프로세스: 창 띄우기 · 로컬 파일 서빙(app://) · 파일 열기/저장
const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { pathToFileURL } = require('url');

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
      const r = await win.webContents.executeJavaScript(`(async () => { const res = await fetch('./data/legacy-sample.json'); await BYR.openJson('샘플', new Uint8Array(await res.arrayBuffer())); for (const s of ['toon','tycoon','comic','clay','plan','real']) BYR.setStyle(s); const L = BYR.S.model.levels[0]; return L.walls.length + '/' + L.items.length; })()`).catch((e) => 'ERR ' + e.message);
      console.log('[smoke] boot ok · sample walls/items', r, errs.length ? '· console errors: ' + errs.join(' | ') : '');
      app.exit(/^ERR/.test(r) || errs.length ? 1 : 0); return;
    }
    if (Date.now() - t0 > 90000) { console.log('[smoke] timeout', errs.join(' | ')); app.exit(1); return; }
    setTimeout(tick, 500);
  };
  win.webContents.once('did-finish-load', tick);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#1b1d21', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL('app://byr/index.html');
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
