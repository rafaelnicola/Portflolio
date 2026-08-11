const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('configAPI', {
  getServerUrl: () => ipcRenderer.invoke('config:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('config:set-server-url', url),
});

contextBridge.exposeInMainWorld('archivoAPI', {
  guardar: (nombreSugerido, datos) => ipcRenderer.invoke('archivo:guardar', { nombreSugerido, datos }),
});
