const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
// 자동 업데이트: 열 때마다 GitHub Pages의 최신 화면을 먼저 불러오고, 인터넷이 없거나 실패하면 설치된 화면을 연다.
const REMOTE = 'https://uniclub24-cpu.github.io/3d-render/';
const LOCAL = path.join(__dirname, '..', 'www', 'index.html');
const ICON = path.join(__dirname, 'icon.png');

function createWindow() {
  const t0 = Date.now();
  // 시작 로딩 화면 (BYR) — 본 화면이 다 뜰 때까지
  const splash = new BrowserWindow({ width: 960, height: 536, frame: false, resizable: false, movable: true, center: true, show: true, skipTaskbar: false, backgroundColor: '#121826', icon: ICON, title: '3D RENDER' });
  splash.loadFile(path.join(__dirname, 'splash.html'));

  const win = new BrowserWindow({ width: 1440, height: 900, title: '3D RENDER', backgroundColor: '#121316', autoHideMenuBar: true, show: false, icon: ICON });
  let shown = false;
  const reveal = () => {
    if (shown) return; shown = true;
    setTimeout(() => { win.show(); win.focus(); if (!splash.isDestroyed()) splash.close(); }, Math.max(0, 1800 - (Date.now() - t0)));
  };
  let fellBack = false;
  const local = () => { if (!fellBack) { fellBack = true; win.loadFile(LOCAL); } };
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain) local(); });
  const t = setTimeout(local, 8000); // 8초 안에 못 받으면 설치된 화면
  win.webContents.on('did-finish-load', () => { clearTimeout(t); setTimeout(reveal, 500); });
  setTimeout(reveal, 20000); // 무슨 일이 있어도 20초 뒤엔 본 화면
  win.loadURL(REMOTE + '?t=' + Date.now()).catch(local);
  // 구글 드라이브 · 네이버 메일 링크는 기본 브라우저로 연다
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
