// 렌더러에 꼭 필요한 파일 기능만 노출한다 (Node API 는 직접 주지 않음)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('byr', {
  isElectron: true,
  openFiles: (opt) => ipcRenderer.invoke('file:open', opt),
  saveFile: (opt) => ipcRenderer.invoke('file:save', opt),
});
