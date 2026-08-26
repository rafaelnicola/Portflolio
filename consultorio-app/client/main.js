const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    serverUrl: '',
  },
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Biomedical Center',
    icon: path.join(__dirname, 'src', 'assets', 'logo-mark.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('config:get-server-url', () => store.get('serverUrl'));
ipcMain.handle('config:set-server-url', (event, url) => {
  store.set('serverUrl', url);
  return true;
});

const FILTROS_POR_EXTENSION = {
  docx: { name: 'Documento Word', extensions: ['docx'] },
  pdf: { name: 'Documento PDF', extensions: ['pdf'] },
  zip: { name: 'Archivo comprimido', extensions: ['zip'] },
};

ipcMain.handle('archivo:guardar', async (event, { nombreSugerido, datos }) => {
  const extension = (nombreSugerido || '').split('.').pop().toLowerCase();
  const filtro = FILTROS_POR_EXTENSION[extension] || { name: 'Todos los archivos', extensions: ['*'] };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: nombreSugerido,
    filters: [filtro],
  });
  if (canceled || !filePath) return { ok: false };
  fs.writeFileSync(filePath, Buffer.from(datos));
  const errorAlAbrir = await shell.openPath(filePath);
  if (errorAlAbrir) {
    console.error('No se pudo abrir el archivo automaticamente:', errorAlAbrir);
  }
  return { ok: true, filePath, abierto: !errorAlAbrir };
});

app.setAppUserModelId('com.biomedicalcenter.cliente');

app.whenReady().then(() => {
  // Permite el acceso a la camara para poder tomarle una foto al paciente,
  // y a las notificaciones para avisar de mensajes nuevos del chat aunque
  // la app este minimizada o en segundo plano. Todo lo demas queda denegado.
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'notifications');
  });
  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission) => permission === 'media' || permission === 'notifications'
  );

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
