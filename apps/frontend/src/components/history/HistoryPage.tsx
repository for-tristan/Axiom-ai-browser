import { useMemo, useState } from "react";
import type { HistoryEntry } from "../../hooks/useHistory";
import "./HistoryPage.css";

interface HistoryPageProps {
  entries: HistoryEntry[];
  onOpen: (url: string) => void;
  onRemove: (ids: string[]) => void;
  onOpenSettings: () => void;
  onClose?: () => void;
}

function dayLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function HistoryPage({
  entries,
  onOpen,
  onRemove,
  onOpenSettings,
  onClose,
}: HistoryPageProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? entries.filter((entry) => `${entry.title} ${entry.url}`.toLowerCase().includes(query))
      : entries;
  }, [entries, search]);

  const groups = useMemo(() => {
    const result = new Map<string, HistoryEntry[]>();
    filtered.forEach((entry) => {
      const label = dayLabel(entry.visitedAt);
      result.set(label, [...(result.get(label) ?? []), entry]);
    });
    return Array.from(result.entries());
  }, [filtered]);

  function toggleEntry(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function removeSelected() {
    onRemove(selectedIds);
    setSelectedIds([]);
  }

  return (
    <div className="history-page-backdrop" onClick={onClose}>
      <main className="history-page" onClick={(e) => e.stopPropagation()}>
        <header className="history-header">
          <div className="history-header-left">
            {onClose && (
              <button type="button" className="history-close-btn" onClick={onClose} title="Back to browser">
                <i className="fa-solid fa-arrow-left"></i>
              </button>
            )}
            <div>
              <h1>History</h1>
              <p>Pages you've visited on this device.</p>
            </div>
          </div>

          <div className="history-header-actions">
            <button type="button" className="history-clear-link" onClick={onOpenSettings} title="Settings & Clear Data">
              <i className="fa-solid fa-trash-can" aria-hidden="true"></i> Clear browsing data
            </button>

            {onClose && (
              <button type="button" className="history-x-btn" onClick={onClose} title="Close">
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </header>

        <label className="history-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search history by title or address..."
            aria-label="Search history"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </label>

        {selectedIds.length > 0 && (
          <div className="history-selection">
            <span>{selectedIds.length} item(s) selected</span>
            <div className="history-selection-actions">
              <button type="button" className="history-deselect" onClick={() => setSelectedIds([])}>
                Deselect all
              </button>
              <button type="button" className="history-delete-selected" onClick={removeSelected}>
                <i className="fa-solid fa-trash"></i> Delete selected
              </button>
            </div>
          </div>
        )}

        <div className="history-groups">
          {!filtered.length ? (
            <div className="history-empty">
              <div className="history-empty-icon">
                <i className="fa-regular fa-clock" aria-hidden="true"></i>
              </div>
              <strong>{search ? "No matching pages found" : "No browsing history yet"}</strong>
              <span>{search ? "Try a different search keyword or URL." : "Pages you visit will automatically appear here."}</span>
            </div>
          ) : (
            groups.map(([label, items]) => (
              <section className="history-group" key={label}>
                <h2 className="history-group-title">{label}</h2>
                <div className="history-entries-list">
                  {items.map((entry) => (
                    <article className="history-entry" key={entry.id}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(entry.id)}
                        onChange={() => toggleEntry(entry.id)}
                        aria-label={`Select ${entry.title}`}
                      />
                      {entry.favicon ? (
                        <img className="history-entry-favicon" src={entry.favicon} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <span className="history-favicon">
                          <i className="fa-solid fa-globe"></i>
                        </span>
                      )}
                      <button
                        type="button"
                        className="history-entry-main"
                        onClick={() => {
                          onOpen(entry.url);
                          if (onClose) onClose();
                        }}
                      >
                        <strong className="entry-title">{entry.title || entry.url}</strong>
                        <span className="entry-url">{entry.url}</span>
                      </button>
                      <time dateTime={new Date(entry.visitedAt).toISOString()} className="history-entry-time">
                        {new Date(entry.visitedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </time>
                      <button
                        type="button"
                        className="history-remove"
                        onClick={() => onRemove([entry.id])}
                        aria-label={`Remove ${entry.title} from history`}
                        title="Remove from history"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default HistoryPage;
