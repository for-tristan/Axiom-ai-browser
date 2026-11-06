const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')

const DEV_URL = 'http://localhost:5173'

/** @type {BrowserWindow | null} */
let mainWindow = null

// ── Application menu ────────────────────────────────────────────────────
// A minimal menu keeps the app usable on macOS (where apps always have a
// menu bar) without exposing every Electron dev command. DevTools still
// reachable via F12 / right-click → Inspect, and via the View menu.
function installMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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
    // titleBarOverlay draws the native minimize/maximize/close buttons on
    // Windows. The height MUST match the tab bar height (40px) so the
    // drag region lines up exactly with the top of the window — if it's
    // taller, there's a dead strip above the tabs that you can't drag
    // by; if shorter, the controls overlap the tabs.
    titleBarOverlay: {
      color: '#e4e9f7',
      symbolColor: '#4a5568',
      height: 40,
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.once('ready-to-show', () => win.show())

  // Show the window if the Vite dev server isn't up yet, so users see the
  // retry screen instead of a blank white frame.
  win.webContents.on('did-fail-load', (_e, _code, description, url) => {
    if (!url.startsWith(DEV_URL)) return
    console.error('Failed to load', url, description)
    const errorHtml = `
      <body style="margin:0;background:#dce4f7;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#4a5568;text-align:center;padding:24px;">
        <div style="background:#fff;border-radius:16px;padding:40px;box-shadow:0 10px 40px rgba(0,0,0,.08);max-width:420px;">
          <div style="font-size:42px;margin-bottom:8px;">🔌</div>
          <h2 style="margin:0 0 8px;font-size:20px;color:#1a202c;">Can't reach the frontend</h2>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.5;">Make sure the Vite dev server is running at <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${DEV_URL}</code>.</p>
          <p style="margin:0 0 20px;font-size:13px;color:#718096;">Run <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">npm run dev</code> in <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">apps/desktop</code>.</p>
          <button onclick="location.href='${DEV_URL}'" style="padding:10px 22px;border-radius:10px;border:none;background:#7c5cfc;color:#fff;cursor:pointer;font-size:14px;font-weight:600;">Retry</button>
        </div>
      </body>
    `
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`)
  })

  win.loadURL(DEV_URL)
  mainWindow = win
  return win
}

// ── IPC handlers (registered once, not per-window) ─────────────────────
// Registering inside createWindow() leaks a new handler on every window
// creation and breaks multi-window use. These act on the focused window
// (or mainWindow as fallback), which is the correct behavior for a
// single-window browser app.

function getTargetWindow() {
  return BrowserWindow.getFocusedWindow() || mainWindow
}

ipcMain.on('window-minimize', () => getTargetWindow()?.minimize())
ipcMain.on('window-maximize', () => {
  const w = getTargetWindow()
  if (!w) return
  if (w.isMaximized()) w.unmaximize()
  else w.maximize()
})
ipcMain.on('window-close', () => getTargetWindow()?.close())

// The renderer sends { isDark, tabBarColor } whenever the theme changes
// (mode toggle OR a specific theme pick). We use tabBarColor for the
// overlay background so the native window controls always match the
// tab bar. symbolColor is picked for contrast against that background.
ipcMain.on('theme-changed', (_e, payload) => {
  // Backwards-compat: the old payload was a bare boolean (isDark).
  const isDark = typeof payload === 'boolean' ? payload : payload?.isDark
  const tabBarColor = typeof payload === 'object' && payload?.tabBarColor
    ? payload.tabBarColor
    : (isDark ? '#0e121a' : '#dce4f7')

  try {
    const w = getTargetWindow()
    if (w && typeof w.setTitleBarOverlay === 'function') {
      w.setTitleBarOverlay({
        color: tabBarColor,
        symbolColor: isDark ? '#cbd5e1' : '#4a5568',
        height: 40,
      })
    }
  } catch (err) {
    console.warn('Failed to update titleBarOverlay:', err)
  }
})

// ── App lifecycle ──────────────────────────────────────────────────────
app.whenReady().then(() => {
  installMenu()
  createWindow()

  // macOS: re-create a window when the dock icon is clicked and there are
  // no open windows. Without this the app stays running with no UI.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // On macOS apps stay alive until explicitly quit; everywhere else quit.
  if (process.platform !== 'darwin') app.quit()
})
