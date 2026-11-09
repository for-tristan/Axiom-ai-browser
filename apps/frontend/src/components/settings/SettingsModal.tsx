import { useState } from "react";
import type { ChangeEvent } from "react";
import type { ColorTheme } from "../../types/browser";
import type { SearchEngineId } from "../../hooks/useSearchEngine";
import "./SettingsModal.css";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableThemes: ColorTheme[];
  bgColor: string;
  bgImage: string;
  previewBackground: string;
  onColorChoose: (id: string) => void;
  onBgChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onResetTheme: () => void;
  historyCount: number;
  bookmarksCount: number;
  onClearHistory: () => void;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  searchEngineId: SearchEngineId;
  onSearchEngineChange: (id: SearchEngineId) => void;
}

type SettingsTab = "appearance" | "general" | "privacy";

export function SettingsModal({
  isOpen,
  onClose,
  availableThemes,
  bgColor,
  bgImage,
  previewBackground,
  onColorChoose,
  onBgChange,
  onResetTheme,
  historyCount,
  bookmarksCount,
  onClearHistory,
  onOpenHistory,
  onOpenBookmarks,
  searchEngineId,
  onSearchEngineChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const [clearedNotice, setClearedNotice] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  if (!isOpen) return null;

  const handleClearHistory = () => {
    onClearHistory();
    setConfirmingClear(false);
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 3000);
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar Tabs */}
        <aside className="settings-sidebar">
          <div className="settings-brand">
            <i className="fa-solid fa-gear"></i>
            <span>Settings</span>
          </div>

          <nav className="settings-nav">
            <button
              className={`settings-nav-btn ${activeTab === "appearance" ? "active" : ""}`}
              onClick={() => setActiveTab("appearance")}
            >
              <i className="fa-solid fa-palette"></i>
              <span>Appearance & Themes</span>
            </button>
            <button
              className={`settings-nav-btn ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              <i className="fa-solid fa-sliders"></i>
              <span>Search & General</span>
            </button>
            <button
              className={`settings-nav-btn ${activeTab === "privacy" ? "active" : ""}`}
              onClick={() => setActiveTab("privacy")}
            >
              <i className="fa-solid fa-shield-halved"></i>
              <span>History & Privacy</span>
            </button>
          </nav>
        </aside>

        {/* Content Panel */}
        <main className="settings-content">
          <header className="settings-content-header">
            <h2>
              {activeTab === "appearance" && "Appearance & Themes"}
              {activeTab === "general" && "Search & Browser Preferences"}
              {activeTab === "privacy" && "History & Privacy Data"}
            </h2>
            <button className="settings-close-btn" onClick={onClose} title="Close Settings">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </header>

          <div className="settings-scroll-area">
            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <section className="settings-section">
                {/* Theme Preview */}
                <div className="settings-group">
                  <h4>Theme Preview</h4>
                  <div
                    className="settings-theme-preview"
                    style={{
                      backgroundImage: previewBackground,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    <div className="theme-preview-ui">
                      <div className="preview-top-bar">
                        <span className="dot dot-red"></span>
                        <span className="dot dot-yellow"></span>
                        <span className="dot dot-green"></span>
                        <div className="preview-tab-pill">Axiom Home</div>
                      </div>
                      <div className="preview-nav-mock">
                        <div className="preview-arrow"></div>
                        <div className="preview-search-mock"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallpaper upload */}
                <div className="settings-group">
                  <h4>Custom Background Wallpaper</h4>
                  <div className="wallpaper-actions">
                    <label className="settings-upload-btn">
                      <i className="fa-solid fa-image"></i> Choose Image Wallpaper
                      <input
                        type="file"
                        accept="image/*"
                        onChange={onBgChange}
                        style={{ display: "none" }}
                      />
                    </label>
                    {(bgImage || bgColor) && (
                      <button type="button" className="settings-reset-btn" onClick={onResetTheme}>
                        <i className="fa-solid fa-rotate-left"></i> Reset to Default Theme
                      </button>
                    )}
                  </div>
                </div>

                {/* Color Schemes */}
                <div className="settings-group">
                  <h4>Color Schemes</h4>
                  <p className="settings-hint">Select a color harmony for your browser:</p>
                  <div className="settings-swatches-grid">
                    {availableThemes.map((t) => {
                      const selected = !bgImage && (bgColor === t.id || (!bgColor && t.id.includes("default")));
                      return (
                        <button
                          key={t.id || "default"}
                          className={`settings-swatch-card ${selected ? "active" : ""}`}
                          onClick={() => onColorChoose(t.id)}
                          title={t.name}
                        >
                          <span
                            className="settings-swatch-circle"
                            style={{ backgroundImage: t.gradient }}
                          >
                            {selected && <i className="fa-solid fa-check"></i>}
                          </span>
                          <span className="settings-swatch-name">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* General Tab */}
            {activeTab === "general" && (
              <section className="settings-section">
                <div className="setting-card">
                  <div className="setting-card-info">
                    <div className="setting-card-icon">
                      <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <div>
                      <strong>Search Engine</strong>
                      <p>Search engine used in address bar and new tab</p>
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={searchEngineId}
                    onChange={(e) => onSearchEngineChange(e.target.value as SearchEngineId)}
                  >
                    <option value="google">Google</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="bing">Bing</option>
                    <option value="ecosia">Ecosia</option>
                  </select>
                </div>

                <div className="setting-card">
                  <div className="setting-card-info">
                    <div className="setting-card-icon">
                      <i className="fa-solid fa-bookmark"></i>
                    </div>
                    <div>
                      <strong>Bookmarks</strong>
                      <p>You have {bookmarksCount} saved bookmark{bookmarksCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <button className="settings-btn-outline" onClick={onOpenBookmarks}>
                    Manage Bookmarks
                  </button>
                </div>
              </section>
            )}

            {/* Privacy & History Tab */}
            {activeTab === "privacy" && (
              <section className="settings-section">
                <div className="setting-card">
                  <div className="setting-card-info">
                    <div className="setting-card-icon">
                      <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <div>
                      <strong>Browsing History</strong>
                      <p>{historyCount} page visit{historyCount === 1 ? "" : "s"} recorded</p>
                    </div>
                  </div>
                  <button className="settings-btn-outline" onClick={onOpenHistory}>
                    View History
                  </button>
                </div>

                <div className="setting-card danger-zone">
                  <div className="setting-card-info">
                    <div className="setting-card-icon danger">
                      <i className="fa-solid fa-trash-can"></i>
                    </div>
                    <div>
                      <strong>Clear Browsing Data</strong>
                      <p>Permanently remove browsing history and visited pages log</p>
                    </div>
                  </div>
                  {!confirmingClear ? (
                    <button
                      className="settings-danger-btn"
                      onClick={() => setConfirmingClear(true)}
                    >
                      Clear All History
                    </button>
                  ) : (
                    <div className="settings-confirm-inline">
                      <button
                        type="button"
                        className="settings-confirm-cancel"
                        onClick={() => setConfirmingClear(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="settings-danger-btn"
                        onClick={handleClearHistory}
                      >
                        <i className="fa-solid fa-trash-can"></i> Yes, clear it
                      </button>
                    </div>
                  )}
                </div>

                {clearedNotice && (
                  <div className="settings-alert-success">
                    <i className="fa-solid fa-circle-check"></i> Browsing history cleared successfully!
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default SettingsModal;
