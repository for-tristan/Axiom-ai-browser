const { app, BrowserWindow, Menu } = require('electron')

const DEV_URL = 'http://localhost:5173'

function installMenu() {
  // القائمة الافتراضية بتحجز Ctrl+W و Ctrl+R لنفسها، فبنشيلها ونخلي
  // الاختصارات توصل للواجهة. سايبين DevTools بس عشان التطوير.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: 'View', submenu: [{ role: 'toggleDevTools' }] },
    ]),
  )
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#dce4f7',
    autoHideMenuBar: true,
    title: 'Axiom',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#e4e9f7',
      symbolColor: '#4a5568',
      height: 42,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    console.error('Failed to load', url, code, description)
  })

  win.loadURL(DEV_URL)
}

app.whenReady().then(() => {
  installMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})