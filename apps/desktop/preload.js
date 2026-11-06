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

  // ── Downloads ──────────────────────────────────────────────────────
  // Subscribe to download progress/state updates from the main process.
  // Returns an unsubscribe function.
  onDownloadUpdate: (callback) => {
    const subscription = (_event, payload) => callback(payload);
    ipcRenderer.on('download-update', subscription);
    return () => ipcRenderer.removeListener('download-update', subscription);
  },
  // Open a downloaded file in the OS default app.
  openFile: (filePath) => ipcRenderer.invoke('downloads:open', filePath),
  // Reveal a downloaded file in the OS file manager.
  showInFolder: (filePath) => ipcRenderer.invoke('downloads:show-in-folder', filePath),
  // Pause/resume an active download (toggles).
  pauseDownload: (id) => ipcRenderer.send('downloads:pause', id),
  // Cancel an active download.
  cancelDownload: (id) => ipcRenderer.send('downloads:cancel', id),
});
