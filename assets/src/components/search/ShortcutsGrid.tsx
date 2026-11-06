import React, { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Shortcut } from '../../types/browser';

interface ShortcutsGridProps {
  shortcuts: Shortcut[];
  onNavigate: (url: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, name: string, url: string) => void;
  onOpenAdd: () => void;
}

const MAX_VISIBLE_SHORTCUTS = 6;
const LONG_PRESS_MS = 500;

function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.href;
  } catch {
    return null;
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ShortcutIcon({ shortcut }: { shortcut: Shortcut }) {
  // 0 = gstatic favicon, 1 = duckduckgo favicon, 2+ = first letter
  const [stage, setStage] = useState(0);

  if (shortcut.icon) return <i className={shortcut.icon}></i>;

  const letter = (shortcut.name.trim()[0] ?? "?").toUpperCase();

  let host = "";
  try {
    host = new URL(shortcut.url).hostname;
  } catch { /* ignore */ }

  if (shortcut.builtin || !host || stage >= 2) {
    return <span className="notion-letter">{letter}</span>;
  }

  const sources = [
    `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${host}`)}&size=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
  ];

  return (
    <img
      key={stage}
      className="shortcut-favicon"
      src={sources[stage]}
      alt=""
      onError={() => setStage((s) => s + 1)}
    />
  );
}

export const ShortcutsGrid: React.FC<ShortcutsGridProps> = ({
  shortcuts,
  onNavigate,
  onRemove,
  onUpdate,
  onOpenAdd,
}) => {
  const [showAll, setShowAll] = useState(false);
  const visibleShortcuts = showAll ? shortcuts : shortcuts.slice(0, MAX_VISIBLE_SHORTCUTS);

  const [menuFor, setMenuFor] = useState<Shortcut | null>(null);
  const [editing, setEditing] = useState<Shortcut | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editError, setEditError] = useState("");

  const pressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const suppressTimer = useRef<number | null>(null);

  function armSuppress(ms: number) {
    suppressClick.current = true;
    if (suppressTimer.current !== null) window.clearTimeout(suppressTimer.current);
    suppressTimer.current = window.setTimeout(() => {
      suppressClick.current = false;
    }, ms);
  }

  function clearPress() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function startPress(sc: Shortcut) {
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      armSuppress(1000);
      setMenuFor(sc);
    }, LONG_PRESS_MS);
  }

  function endPress() {
    clearPress();
    if (suppressClick.current) armSuppress(400);
  }

  function openEdit(sc: Shortcut) {
    setEditing(sc);
    setEditName(sc.name);
    setEditUrl(sc.url);
    setEditError("");
    setMenuFor(null);
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const url = normalizeUrl(editUrl);
    if (!url) {
      setEditError("Enter a valid website address, like example.com");
      return;
    }
    const name = editName.trim() || hostnameOf(url);
    onUpdate(editing.id, name, url);
    setEditing(null);
  }

  return (
    <>
      <div className="shortcuts-grid">
        {visibleShortcuts.map((sc) => (
          <div
            className="shortcut-wrap"
            key={sc.id}
            onTouchStart={() => startPress(sc)}
            onTouchEnd={endPress}
            onTouchMove={clearPress}
            onTouchCancel={clearPress}
            onContextMenu={(event) => {
              event.preventDefault();
              clearPress();
              armSuppress(1000);
              setMenuFor(sc);
            }}
          >
            <a
              href={sc.url}
              className="shortcut-item"
              onClick={(event) => {
                event.preventDefault();
                if (suppressClick.current) return;
                onNavigate(sc.url);
              }}
            >
              <div className={`shortcut-icon ${sc.colorClass ?? ""}`}>
                <ShortcutIcon key={sc.url} shortcut={sc} />
              </div>
              <span>{sc.name}</span>
            </a>
            <button
              type="button"
              className="shortcut-more"
              onClick={() => setMenuFor(sc)}
              title={`Options for ${sc.name}`}
              aria-label={`Options for ${sc.name}`}
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>
        ))}

        <button className="shortcut-item shortcut-btn" onClick={onOpenAdd}>
          <div className="shortcut-icon icon-add">
            <i className="fa-solid fa-plus"></i>
          </div>
          <span>Add</span>
        </button>

        {shortcuts.length > MAX_VISIBLE_SHORTCUTS && (
          <button
            className="shortcut-item shortcut-btn"
            onClick={() => setShowAll((v) => !v)}
          >
            <div className="shortcut-icon icon-more">
              <i className={`fa-solid ${showAll ? "fa-chevron-up" : "fa-ellipsis"}`}></i>
            </div>
            <span>{showAll ? "Less" : "More"}</span>
          </button>
        )}
      </div>

      {menuFor && (
        <div className="shortcut-modal-backdrop" onMouseDown={() => setMenuFor(null)} onTouchStart={() => setMenuFor(null)}>
          <div
            className="shortcut-menu"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="shortcut-menu-title">{menuFor.name}</div>
            <button type="button" onClick={() => openEdit(menuFor)}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                onRemove(menuFor.id);
                setMenuFor(null);
              }}
            >
              <i className="fa-solid fa-trash"></i> Delete
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="shortcut-modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form
            className="shortcut-modal"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={handleSaveEdit}
          >
            <h3>Edit shortcut</h3>
            <label>Name</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            <label>Website address</label>
            <input
              value={editUrl}
              onChange={(e) => {
                setEditUrl(e.target.value);
                setEditError("");
              }}
            />
            {editError && <p className="shortcut-error">{editError}</p>}
            <div className="shortcut-modal-actions">
              <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};