const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('configAPI', {
  getServerUrl: () => ipcRenderer.invoke('config:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('config:set-server-url', url),
});

contextBridge.exposeInMainWorld('archivoAPI', {
  guardar: (nombreSugerido, datos) => ipcRenderer.invoke('archivo:guardar', { nombreSugerido, datos }),
});

contextBridge.exposeInMainWorld('notificacionesAPI', {
  // Hace parpadear el icono de la barra de tareas (funciona en cualquier
  // version de Windows, incluidas 7/8 donde no existen las notificaciones
  // nativas de escritorio) para avisar de un mensaje nuevo del chat.
  avisarMensajeNuevo: () => ipcRenderer.send('notificacion:avisar'),
});
