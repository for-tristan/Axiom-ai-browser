import { useMemo } from "react";
import type { DownloadItem } from "../../hooks/useDownloads";
import "./DownloadsPanel.css";

interface DownloadsPanelProps {
  isOpen: boolean;
  downloads: DownloadItem[];
  onClose: () => void;
  onRemove: (id: number) => void;
  onClearCompleted: () => void;
  onPause: (id: number) => void;
  onCancel: (id: number) => void;
  onOpenFile: (filePath: string) => void;
  onShowInFolder: (filePath: string) => void;
}

/** Pick a Font Awesome icon based on the file extension / mime type. */
function fileIcon(fileName: string, mimeType?: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext))
    return "fa-solid fa-image";
  if (mimeType?.startsWith("video/") || ["mp4", "webm", "avi", "mov", "mkv"].includes(ext))
    return "fa-solid fa-film";
  if (mimeType?.startsWith("audio/") || ["mp3", "wav", "ogg", "flac", "m4a"].includes(ext))
    return "fa-solid fa-music";
  if (["pdf"].includes(ext)) return "fa-solid fa-file-pdf";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "fa-solid fa-file-zipper";
  if (["doc", "docx"].includes(ext)) return "fa-solid fa-file-word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "fa-solid fa-file-excel";
  if (["ppt", "pptx"].includes(ext)) return "fa-solid fa-file-powerpoint";
  if (["txt", "md", "rtf"].includes(ext)) return "fa-solid fa-file-lines";
  if (["js", "ts", "tsx", "jsx", "py", "java", "c", "cpp", "html", "css", "json", "xml"].includes(ext))
    return "fa-solid fa-file-code";
  return "fa-solid fa-file";
}

/** Format bytes into a human-readable string (e.g. "1.2 MB"). */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a timestamp into a short relative time (e.g. "just now", "5m ago"). */
function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function DownloadsPanel({
  isOpen,
  downloads,
  onClose,
  onRemove,
  onClearCompleted,
  onPause,
  onCancel,
  onOpenFile,
  onShowInFolder,
}: DownloadsPanelProps) {
  const hasCompleted = useMemo(
    () => downloads.some((d) => d.state === "completed" || d.state === "cancelled" || d.state === "interrupted"),
    [downloads],
  );

  if (!isOpen) return null;

  return (
    <div className="downloads-backdrop" onClick={onClose}>
      <div className="downloads-panel" onClick={(e) => e.stopPropagation()}>
        <div className="downloads-header">
          <div className="downloads-title">
            <i className="fa-solid fa-download"></i>
            <div>
              <h3>Downloads</h3>
              <span>{downloads.length} item{downloads.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <button className="downloads-close" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="downloads-tools">
          {hasCompleted && (
            <button type="button" className="downloads-clear-btn" onClick={onClearCompleted}>
              <i className="fa-solid fa-broom"></i> Clear completed
            </button>
          )}
        </div>

        <div className="downloads-list">
          {downloads.length === 0 ? (
            <div className="downloads-empty">
              <i className="fa-solid fa-download"></i>
              <p>No downloads yet</p>
              <span>Files you download will appear here with live progress.</span>
            </div>
          ) : (
            downloads.map((d) => {
              const pct = d.totalBytes > 0 ? Math.min(100, (d.receivedBytes / d.totalBytes) * 100) : 0;
              const isActive = d.state === "progressing";
              return (
                <div key={d.id} className={`download-row ${d.state}`}>
                  <div className="download-icon">
                    <i className={fileIcon(d.fileName, d.mimeType)}></i>
                  </div>
                  <div className="download-info">
                    <div className="download-name-row">
                      <strong className="download-name" title={d.fileName}>{d.fileName}</strong>
                      <span className="download-size">
                        {formatBytes(d.receivedBytes)}
                        {d.totalBytes > 0 && ` / ${formatBytes(d.totalBytes)}`}
                      </span>
                    </div>
                    {isActive ? (
                      <div className="download-progress-bar">
                        <div className="download-progress-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    ) : (
                      <div className="download-meta">
                        <span className={`download-state ${d.state}`}>
                          {d.state === "completed" && <i className="fa-solid fa-circle-check"></i>}
                          {d.state === "cancelled" && <i className="fa-solid fa-circle-xmark"></i>}
                          {d.state === "interrupted" && <i className="fa-solid fa-triangle-exclamation"></i>}
                          {d.state === "completed" ? "Completed" : d.state === "cancelled" ? "Cancelled" : "Interrupted"}
                        </span>
                        {d.completedAt && <span className="download-time">{formatTime(d.completedAt)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="download-actions">
                    {isActive ? (
                      <>
                        <button type="button" className="download-action-btn" title="Pause / Resume" onClick={() => onPause(d.id)}>
                          <i className="fa-solid fa-pause"></i>
                        </button>
                        <button type="button" className="download-action-btn danger" title="Cancel" onClick={() => onCancel(d.id)}>
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                      </>
                    ) : (
                      <>
                        {d.state === "completed" && d.savePath && (
                          <>
                            <button type="button" className="download-action-btn" title="Open" onClick={() => onOpenFile(d.savePath!)}>
                              <i className="fa-solid fa-folder-open"></i>
                            </button>
                            <button type="button" className="download-action-btn" title="Show in folder" onClick={() => onShowInFolder(d.savePath!)}>
                              <i className="fa-solid fa-folder"></i>
                            </button>
                          </>
                        )}
                        <button type="button" className="download-action-btn danger" title="Remove from list" onClick={() => onRemove(d.id)}>
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default DownloadsPanel;
