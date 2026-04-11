// apps/desktop/electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notebookBridge', {
  ping: () => ipcRenderer.invoke('app:ping'),
  choosePath: (options) => ipcRenderer.invoke('dialog:choosePath', options),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  backendUrl: () => ipcRenderer.invoke('app:backendUrl'),
  onBackendReady: (callback) => {
    ipcRenderer.on('app:backendReady', (_, url) => callback(url));
  },
});
