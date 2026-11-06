import React from 'react';
import type { FormEvent, RefObject } from 'react';
import type { Tab } from '../../types/browser';

interface NavigationBarProps {
  activeTab?: Tab;
  canGoBack: boolean;
  canGoForward: boolean;
  addressQuery: string;
  aiOpen: boolean;
  isCurrentBookmarked?: boolean;
  addressInputRef: RefObject<HTMLInputElement>;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onAddressSearch: () => void;
  setAddressQuery: (query: string) => void;
  setAiOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  onOpenBookmarks: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  activeTab,
  canGoBack,
  canGoForward,
  addressQuery,
  aiOpen,
  isCurrentBookmarked = false,
  addressInputRef,
  onBack,
  onForward,
  onReload,
  onStop,
  onAddressSearch,
  setAddressQuery,
  setAiOpen,
  onOpenBookmarks,
  onOpenHistory,
  onOpenSettings,
}) => {
  return (
    <div className="navigation-bar">
      <div className="nav-arrows">
        <button
          className="nav-arrow-btn"
          title="Back (Alt+Left)"
          aria-label="Back"
          onClick={onBack}
          disabled={!canGoBack}
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <button
          className="nav-arrow-btn"
          title="Forward (Alt+Right)"
          aria-label="Forward"
          onClick={onForward}
          disabled={!canGoForward}
        >
          <i className="fa-solid fa-arrow-right"></i>
        </button>
        <button
          className="nav-arrow-btn"
          title={activeTab?.loading ? "Stop loading (Esc)" : "Reload (Ctrl+R)"}
          aria-label={activeTab?.loading ? "Stop loading" : "Reload"}
          onClick={activeTab?.loading ? onStop : onReload}
        >
          <i className={`fa-solid ${activeTab?.loading ? "fa-xmark" : "fa-rotate-right"}`}></i>
        </button>
      </div>

      <form
        className="address-bar-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          onAddressSearch();
        }}
      >
        <i className={`fa-solid ${activeTab?.url?.startsWith("https://") ? "fa-lock" : "fa-globe"} address-lock`}></i>
        <input
          ref={addressInputRef}
          type="text"
          className="address-input"
          value={addressQuery}
          onChange={(e) => setAddressQuery(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setAddressQuery(activeTab?.url ?? "");
              e.currentTarget.blur();
            }
          }}
          placeholder="Search or enter address"
        />
        <button
          type="button"
          className={`address-ai-btn ${aiOpen ? "active" : ""}`}
          title={aiOpen ? "Hide AI Assistant" : "Show AI Assistant"}
          aria-pressed={aiOpen}
          onClick={() => setAiOpen((open) => !open)}
        >
          <i className="fa-solid fa-wand-magic-sparkles"></i> Ask AI
        </button>
      </form>

      <div className="browser-tools">
        {/* Bookmarks Button */}
        <button
          className={`tool-btn ${isCurrentBookmarked ? "bookmarked-active" : ""}`}
          title="Bookmarks (Save / View Bookmarks)"
          aria-label="Bookmarks"
          onClick={onOpenBookmarks}
        >
          <i className={isCurrentBookmarked ? "fa-solid fa-star text-gold" : "fa-regular fa-star"}></i>
        </button>

        {/* History Button */}
        <button
          className="tool-btn"
          title="History (Visited pages & customize)"
          aria-label="History"
          onClick={onOpenHistory}
        >
          <i className="fa-solid fa-clock-rotate-left"></i>
        </button>

        {/* Settings Button */}
        <button
          className="tool-btn"
          title="Settings (Dark mode, themes, wallpaper, privacy)"
          aria-label="Settings"
          onClick={onOpenSettings}
        >
          <i className="fa-solid fa-gear"></i>
        </button>

        <button className="tool-btn" title="Extensions" aria-label="Extensions">
          <i className="fa-solid fa-puzzle-piece"></i>
        </button>

        <button className="tool-btn" title="Downloads" aria-label="Downloads">
          <i className="fa-solid fa-download"></i>
        </button>

        <button className="tool-btn profile" title="Profile" aria-label="Profile">
          <i className="fa-solid fa-user"></i>
        </button>
      </div>
    </div>
  );
};
