const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('node:url');

contextBridge.exposeInMainWorld('pigeonDesktop', {
  saveBegin: (opts) => ipcRenderer.invoke('save:begin', opts),
  saveChunk: (token, u8) => ipcRenderer.invoke('save:chunk', token, u8),
  saveEnd: (token) => ipcRenderer.invoke('save:end', token),
  saveAbort: (token) => ipcRenderer.invoke('save:abort', token),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showInFolder: (p) => ipcRenderer.invoke('show-in-folder', p),
  downloadsDir: () => ipcRenderer.invoke('downloads-dir'),
  fileUrl: (p) => pathToFileURL(p).href,
  flash: () => ipcRenderer.invoke('flash'),
  setBadge: (n) => ipcRenderer.invoke('set-badge', n),
});
