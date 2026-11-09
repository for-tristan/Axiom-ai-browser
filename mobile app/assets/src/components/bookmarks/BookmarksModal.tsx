import { useMemo, useState } from "react";
import type { BookmarkEntry } from "../../hooks/useBookmarks";
import "./BookmarksModal.css";

interface BookmarksModalProps {
  isOpen: boolean;
  bookmarks: BookmarkEntry[];
  currentUrl?: string;
  currentTitle?: string;
  currentFavicon?: string;
  isCurrentBookmarked: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onToggleCurrent: () => void;
  onRemoveBookmark: (id: string) => void;
  onAddBookmark: (title: string, url: string, favicon?: string) => void;
}

export function BookmarksModal({
  isOpen,
  bookmarks,
  currentUrl,
  currentTitle,
  currentFavicon,
  isCurrentBookmarked,
  onClose,
  onNavigate,
  onToggleCurrent,
  onRemoveBookmark,
  onAddBookmark,
}: BookmarksModalProps) {
  const [search, setSearch] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const filteredBookmarks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookmarks;
    return bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }, [bookmarks, search]);

  if (!isOpen) return null;

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;
    let url = customUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const title = customTitle.trim() || new URL(url).hostname;
    onAddBookmark(title, url);
    setCustomTitle("");
    setCustomUrl("");
    setIsAddingNew(false);
  };

  return (
    <div className="bookmarks-modal-backdrop" onClick={onClose}>
      <div className="bookmarks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bookmarks-header">
          <div className="bookmarks-title">
            <i className="fa-solid fa-bookmark"></i>
            <div>
              <h3>Bookmarks</h3>
              <span>{bookmarks.length} saved page{bookmarks.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <button className="bookmarks-close" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Current page quick bookmark bar */}
        {currentUrl && currentUrl !== "about:blank" && (
          <div className="bookmarks-quick-bar">
            <div className="quick-bar-info">
              {currentFavicon ? (
                <img src={currentFavicon} alt="" className="quick-bar-fav" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <i className="fa-solid fa-globe quick-bar-globe"></i>
              )}
              <div className="quick-bar-text">
                <strong>{currentTitle || currentUrl}</strong>
                <span>{currentUrl}</span>
              </div>
            </div>
            <button
              type="button"
              className={`quick-bookmark-btn ${isCurrentBookmarked ? "bookmarked" : ""}`}
              onClick={onToggleCurrent}
            >
              <i className={`fa-${isCurrentBookmarked ? "solid" : "regular"} fa-star`}></i>
              {isCurrentBookmarked ? "Saved" : "Save Tab"}
            </button>
          </div>
        )}

        {/* Search & Actions */}
        <div className="bookmarks-tools">
          <div className="bookmarks-search-box">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
          <button
            type="button"
            className="add-bm-trigger"
            onClick={() => setIsAddingNew((v) => !v)}
            title="Add bookmark manually"
          >
            <i className={`fa-solid ${isAddingNew ? "fa-minus" : "fa-plus"}`}></i>
          </button>
        </div>

        {isAddingNew && (
          <form className="add-bm-form" onSubmit={handleAddCustom}>
            <input
              type="text"
              placeholder="Bookmark Title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              placeholder="https://example.com"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <div className="add-bm-form-actions">
              <button type="button" onClick={() => setIsAddingNew(false)}>Cancel</button>
              <button type="submit" className="save-bm-btn">Add Bookmark</button>
            </div>
          </form>
        )}

        {/* Bookmarks List */}
        <div className="bookmarks-list">
          {filteredBookmarks.length === 0 ? (
            <div className="bookmarks-empty">
              <i className="fa-regular fa-star"></i>
              <p>{search ? "No bookmarks match your search" : "No bookmarks saved yet"}</p>
              <span>Click the star icon in the navigation bar to bookmark any website you visit.</span>
            </div>
          ) : (
            filteredBookmarks.map((bm) => (
              <div key={bm.id} className="bookmark-row">
                <button
                  type="button"
                  className="bookmark-btn"
                  onClick={() => {
                    onNavigate(bm.url);
                    onClose();
                  }}
                  title={bm.url}
                >
                  {bm.favicon ? (
                    <img src={bm.favicon} alt="" className="bookmark-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <span className="bookmark-icon-fallback">
                      <i className="fa-solid fa-globe"></i>
                    </span>
                  )}
                  <div className="bookmark-details">
                    <span className="bookmark-title-text">{bm.title}</span>
                    <span className="bookmark-url-text">{bm.url}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="bookmark-delete"
                  onClick={() => onRemoveBookmark(bm.id)}
                  title="Remove bookmark"
                  aria-label="Remove bookmark"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
export default BookmarksModal;
