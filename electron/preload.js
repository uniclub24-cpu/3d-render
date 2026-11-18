// 렌더러에 꼭 필요한 파일 기능만 노출한다 (Node API 는 직접 주지 않음)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('byr', {
  isElectron: true,
  openFiles: (opt) => ipcRenderer.invoke('file:open', opt),
  saveFile: (opt) => ipcRenderer.invoke('file:save', opt),
  quit: () => ipcRenderer.invoke('app:quit'), // 앱 안에서 종료를 확인한 뒤
  info: () => ipcRenderer.invoke('app:info'), // { version, update: 'setup' | 'portable' | 'dev' }
  openUrl: (u) => ipcRenderer.invoke('open:url', u),
  netGet: (u) => ipcRenderer.invoke('net:get', u), // 공공데이터 · 지도 API
  netBin: (u) => ipcRenderer.invoke('net:bin', u), // 지도 타일
  onUpdate: (fn) => ipcRenderer.on('update', (e, m) => fn(m)),
});
