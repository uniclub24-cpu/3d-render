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
  blenderFind: (p) => ipcRenderer.invoke('blender:find', p), blenderPick: () => ipcRenderer.invoke('blender:pick'), blenderRun: (job) => ipcRenderer.invoke('blender:run', job),
  blenderCancel: () => ipcRenderer.invoke('blender:cancel'), blenderOpen: (dir, what) => ipcRenderer.invoke('blender:open', dir, what),
  onBlenderLog: (fn) => { const h = (e, t) => fn(t); ipcRenderer.on('blender:log', h); return () => ipcRenderer.removeListener('blender:log', h); },
  onUpdate: (fn) => ipcRenderer.on('update', (e, m) => fn(m)),
  /* 듀얼 모니터 보조 창 */
  sideOpen: (opt) => ipcRenderer.invoke('side:open', opt), sideClose: () => ipcRenderer.invoke('side:close'), sideState: (m) => ipcRenderer.send('side:state', m),
  onSideState: (fn) => ipcRenderer.on('side:state', (e, m) => fn(m)), onSideClosed: (fn) => ipcRenderer.on('side:closed', () => fn()),
});
