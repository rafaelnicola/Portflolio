const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('configAPI', {
  getServerUrl: () => ipcRenderer.invoke('config:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('config:set-server-url', url),
});
