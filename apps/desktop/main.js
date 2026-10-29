const { app, BrowserWindow } = require('electron')

const DEV_URL = 'http://localhost:5173'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#14203a',
    autoHideMenuBar: true,
    title: 'Axiom',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f1830',
      symbolColor: '#f2f5fa',
      height: 42,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    console.error('Failed to load', url, code, description)
  })

  win.loadURL(DEV_URL)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})