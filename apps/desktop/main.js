const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')

const DEV_URL = 'http://localhost:5173'

function installMenu() {
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
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  // Window controls handlers
  ipcMain.on('window-minimize', () => win.minimize())
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window-close', () => win.close())
  ipcMain.on('theme-changed', (_e, isDark) => {
    try {
      if (typeof win.setTitleBarOverlay === 'function') {
        win.setTitleBarOverlay({
          color: isDark ? '#0e121a' : '#e4e9f7',
          symbolColor: isDark ? '#cbd5e1' : '#4a5568',
        })
      }
    } catch (err) {
      console.warn('Failed to update titleBarOverlay:', err)
    }
  })

  win.webContents.on('did-fail-load', (_e, code, description, url) => {
    console.error('Failed to load', url, code, description)
    if (url.startsWith(DEV_URL)) {
      const errorHtml = `
        <body style="background: #dce4f7; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; color: #4a5568;">
          <h2>Unable to connect to Frontend</h2>
          <p>Please make sure the Vite server is running at ${DEV_URL}</p>
          <p>Run: <code>npm run dev</code> in the desktop folder</p>
          <button onclick="location.href='${DEV_URL}'" style="padding: 10px 20px; border-radius: 8px; border: none; background: #7c5cfc; color: white; cursor: pointer;">Retry</button>
        </body>
      `;
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
    }
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