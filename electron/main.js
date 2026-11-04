const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 900, title: '3D RENDER', backgroundColor: '#121316', autoHideMenuBar: true });
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // 구글 드라이브 · 네이버 메일 링크는 기본 브라우저로 연다
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
