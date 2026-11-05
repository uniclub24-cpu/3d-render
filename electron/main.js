const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
// 자동 업데이트: 열 때마다 GitHub Pages의 최신 화면을 먼저 불러오고, 인터넷이 없거나 실패하면 설치된 화면을 연다.
const REMOTE = 'https://uniclub24-cpu.github.io/3d-render/';
const LOCAL = path.join(__dirname, '..', 'www', 'index.html');

function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 900, title: '3D RENDER', backgroundColor: '#121316', autoHideMenuBar: true });
  let fellBack = false;
  const local = () => { if (!fellBack) { fellBack = true; win.loadFile(LOCAL); } };
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain) local(); });
  const t = setTimeout(local, 8000); // 8초 안에 못 받으면 설치된 화면
  win.webContents.once('did-finish-load', () => clearTimeout(t));
  win.loadURL(REMOTE + '?t=' + Date.now()).catch(local);
  // 구글 드라이브 · 네이버 메일 링크는 기본 브라우저로 연다
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
