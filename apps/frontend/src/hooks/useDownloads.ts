import { useEffect, useState, useCallback } from "react";

export interface DownloadItem {
  /** Unique id assigned by the main process. */
  id: number;
  fileName: string;
  state: "progressing" | "completed" | "cancelled" | "interrupted";
  /** Absolute path where the file was saved (set once the save dialog closes). */
  savePath?: string;
  receivedBytes: number;
  totalBytes: number;
  url?: string;
  mimeType?: string;
  /** Timestamp the download started (ms since epoch). */
  startedAt: number;
  /** Timestamp the download completed (ms since epoch). */
  completedAt?: number;
}

const STORAGE_KEY = "axiom-downloads";
const MAX_STORED = 100;

/** Load completed downloads from localStorage so they survive restarts. */
function loadStored(): DownloadItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * Manages the download list.
 *
 * - Active downloads (state="progressing") live only in memory.
 * - Completed/cancelled downloads are persisted to localStorage so the
 *   user sees their history after restarting the app.
 * - Subscribes to the Electron 'download-update' IPC channel on mount.
 *
 * The hook works even when not running in Electron (e.g. in a plain
 * browser preview) — it just never receives any updates.
 */
export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => loadStored());

  // Persist only completed/cancelled downloads to localStorage. Active
  // downloads are transient and shouldn't survive a restart.
  useEffect(() => {
    try {
      const toStore = downloads
        .filter((d) => d.state === "completed" || d.state === "cancelled" || d.state === "interrupted")
        .slice(0, MAX_STORED);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch { /* ignore quota errors */ }
  }, [downloads]);

  // Subscribe to download updates from the main process.
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onDownloadUpdate) return;
    const unsubscribe = api.onDownloadUpdate((update) => {
      setDownloads((prev) => {
        const existing = prev.find((d) => d.id === update.id);
        if (existing) {
          // Update an existing download (progress change or completion).
          return prev.map((d) =>
            d.id === update.id
              ? {
                  ...d,
                  state: update.state,
                  receivedBytes: update.receivedBytes,
                  totalBytes: update.totalBytes,
                  savePath: update.savePath ?? d.savePath,
                  url: update.url ?? d.url,
                  mimeType: update.mimeType ?? d.mimeType,
                  completedAt: update.state === "completed" ? Date.now() : d.completedAt,
                }
              : d,
          );
        }
        // New download — add it to the front of the list.
        return [
          {
            id: update.id,
            fileName: update.fileName,
            state: update.state,
            savePath: update.savePath,
            receivedBytes: update.receivedBytes,
            totalBytes: update.totalBytes,
            url: update.url,
            mimeType: update.mimeType,
            startedAt: Date.now(),
            completedAt: update.state === "completed" ? Date.now() : undefined,
          },
          ...prev,
        ];
      });
    });
    return unsubscribe;
  }, []);

  const removeDownload = useCallback((id: number) => {
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setDownloads((prev) => prev.filter((d) => d.state === "progressing"));
  }, []);

  const pauseDownload = useCallback((id: number) => {
    window.electronAPI?.pauseDownload?.(id);
  }, []);

  const cancelDownload = useCallback((id: number) => {
    window.electronAPI?.cancelDownload?.(id);
  }, []);

  const openFile = useCallback((filePath: string) => {
    window.electronAPI?.openFile?.(filePath);
  }, []);

  const showInFolder = useCallback((filePath: string) => {
    window.electronAPI?.showInFolder?.(filePath);
  }, []);

  const activeCount = downloads.filter((d) => d.state === "progressing").length;

  return {
    downloads,
    activeCount,
    removeDownload,
    clearCompleted,
    pauseDownload,
    cancelDownload,
    openFile,
    showInFolder,
  };
}
