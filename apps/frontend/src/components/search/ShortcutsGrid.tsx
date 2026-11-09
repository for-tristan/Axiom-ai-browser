import React, { useState } from 'react';
import type { Shortcut } from '../../types/browser';

interface ShortcutsGridProps {
  shortcuts: Shortcut[];
  onNavigate: (url: string) => void;
  onRemove: (id: string) => void;
  onOpenAdd: () => void;
}

const MAX_VISIBLE_SHORTCUTS = 6;

function ShortcutIcon({ shortcut }: { shortcut: Shortcut }) {
  const [failed, setFailed] = useState(false);

  if (shortcut.icon) return <i className={shortcut.icon}></i>;

  const letter = (shortcut.name.trim()[0] ?? "?").toUpperCase();
  if (shortcut.builtin || failed) {
    return <span className="notion-letter">{letter}</span>;
  }

  let host = "";
  try {
    host = new URL(shortcut.url).hostname;
  } catch { /* ignore */ }

  return (
    <img
      className="shortcut-favicon"
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

export const ShortcutsGrid: React.FC<ShortcutsGridProps> = ({
  shortcuts,
  onNavigate,
  onRemove,
  onOpenAdd,
}) => {
  const [showAll, setShowAll] = useState(false);
  const visibleShortcuts = showAll ? shortcuts : shortcuts.slice(0, MAX_VISIBLE_SHORTCUTS);

  return (
    <div className="shortcuts-grid">
      {visibleShortcuts.map((sc) => (
        <div className="shortcut-wrap" key={sc.id}>
          <a
            href={sc.url}
            className="shortcut-item"
            onClick={(event) => {
              event.preventDefault();
              onNavigate(sc.url);
            }}
          >
            <div className={`shortcut-icon ${sc.colorClass ?? ""}`}>
              <ShortcutIcon shortcut={sc} />
            </div>
            <span>{sc.name}</span>
          </a>
          <button
            className="shortcut-remove"
            onClick={() => onRemove(sc.id)}
            title={`Remove ${sc.name}`}
            aria-label={`Remove ${sc.name}`}
          >
            <i className="fa-solid fa-xmark"></i>
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
  );
};
