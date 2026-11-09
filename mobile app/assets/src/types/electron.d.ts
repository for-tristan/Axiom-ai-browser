/** A download progress/state update sent from the main process. */
export interface DownloadUpdate {
  id: number;
  state: "progressing" | "completed" | "cancelled" | "interrupted";
  fileName: string;
  savePath?: string;
  receivedBytes: number;
  totalBytes: number;
  url?: string;
  mimeType?: string;
}

export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
  send: (channel: string, data?: unknown) => void;
  invoke: (channel: string, data?: unknown) => Promise<unknown>;
  /** Subscribe to download progress updates. Returns an unsubscribe fn. */
  onDownloadUpdate: (callback: (update: DownloadUpdate) => void) => () => void;
  /** Open a downloaded file in the OS default app. */
  openFile: (filePath: string) => Promise<void>;
  /** Reveal a downloaded file in the OS file manager. */
  showInFolder: (filePath: string) => Promise<void>;
  /** Pause/resume an active download (toggles). */
  pauseDownload: (id: number) => void;
  /** Cancel an active download. */
  cancelDownload: (id: number) => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
