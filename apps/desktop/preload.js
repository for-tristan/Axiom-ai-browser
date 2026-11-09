const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Window controls ────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // ── Generic IPC (on/send/invoke) ───────────────────────────────────
  on: (channel, callback) => {
    const subscription = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // ── DevTools ───────────────────────────────────────────────────────
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),

  // ── Downloads ──────────────────────────────────────────────────────
  onDownloadUpdate: (callback) => {
    const subscription = (_event, payload) => callback(payload);
    ipcRenderer.on('download-update', subscription);
    return () => ipcRenderer.removeListener('download-update', subscription);
  },
  openFile: (filePath) => ipcRenderer.invoke('downloads:open', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('downloads:show-in-folder', filePath),
  pauseDownload: (id) => ipcRenderer.send('downloads:pause', id),
  cancelDownload: (id) => ipcRenderer.send('downloads:cancel', id),
});

// Keyboard shortcut for DevTools — listen at the window level so it
// works even when focus is inside a webview. This runs in the renderer
// process (the preload script), so it can intercept keys before the page.
window.addEventListener('keydown', (e) => {
  // F12 or Ctrl+Shift+I
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i'))) {
    e.preventDefault();
    e.stopPropagation();
    ipcRenderer.send('toggle-devtools');
  }
}, true); // useCapture=true so we catch it before the page
