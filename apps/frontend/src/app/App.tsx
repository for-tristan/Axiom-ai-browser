import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import AIChat from "../features/assistant/AIChat";
import { TabBar } from "../components/layout/TabBar";
import { NavigationBar } from "../components/layout/NavigationBar";
import { ShortcutsGrid } from "../components/search/ShortcutsGrid";
import { HistoryPage } from "../components/history/HistoryPage";
import { BookmarksModal } from "../components/bookmarks/BookmarksModal";
import { SettingsModal } from "../components/settings/SettingsModal";
import { useTabs } from "../hooks/useTabs";
import { useShortcuts } from "../hooks/useShortcuts";
import { useTheme } from "../hooks/useTheme";
import { useHistory } from "../hooks/useHistory";
import { useBookmarks } from "../hooks/useBookmarks";
import { useSearchEngine, buildSearchUrl } from "../hooks/useSearchEngine";
import "./App.css";

const AI_OPEN_KEY = "axiom-ai-open";

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

function describeLoadError(description: string): string {
  switch (description) {
    case "ERR_NAME_NOT_RESOLVED":
      return "We couldn’t find that site. Check the address or your internet connection.";
    case "ERR_INTERNET_DISCONNECTED":
      return "You’re offline. Check your internet connection and try again.";
    case "ERR_CONNECTION_REFUSED":
      return "The site refused the connection. It may be down right now.";
    case "ERR_CONNECTION_TIMED_OUT":
    case "ERR_CONNECTION_CLOSED":
      return "The site took too long to respond. Try again in a moment.";
    case "ERR_ADDRESS_UNREACHABLE":
      return "That address can’t be reached right now.";
    case "ERR_CERT_AUTHORITY_INVALID":
    case "ERR_CERT_COMMON_NAME_INVALID":
      return "The site’s security certificate isn’t valid, so we stopped the connection.";
    case "ERR_SSL_PROTOCOL_ERROR":
      return "Secure connection to this site failed.";
    case "ERR_BLOCKED_BY_CLIENT":
      return "The request was blocked.";
    default:
      return description || "Something went wrong while loading this page.";
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type FaviconEvent = Event & { favicons?: string[] };
type PageTitleEvent = Event & { title: string };
type LoadFailureEvent = Event & {
  isMainFrame: boolean;
  errorCode: number;
  errorDescription: string;
};
type NavigationEvent = Event & { url: string };

function App() {
  const { tabs, setTabs, activeTab, addTab, closeTab, selectTab, reopenClosedTab, updateTab, activeTabId } = useTabs();
  const { shortcuts, addShortcut, removeShortcut } = useShortcuts();
  const {
    isDark,
    toggleDarkMode,
    availableThemes,
    bgImage,
    bgColor,
    activeTheme,
    previewBackground,
    chooseColor,
    setCustomBg,
    resetBackground,
  } = useTheme();

  const {
    entries: historyEntries,
    addEntry: addHistoryEntry,
    removeEntries: removeHistoryEntries,
    clearHistory,
  } = useHistory();

  const {
    bookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
  } = useBookmarks();

  const { engineId: searchEngineId, setEngineId: setSearchEngineId } = useSearchEngine();

  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const addressInputRef = useRef<HTMLInputElement>(null);
  
  const webviewRefs = useRef(new Map<number, ElectronWebviewElement>());
  
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [aiOpen, setAiOpen] = useState(() => localStorage.getItem(AI_OPEN_KEY) !== "0");

  // New Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<number | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(AI_OPEN_KEY, aiOpen ? "1" : "0");
  }, [aiOpen]);

  useEffect(() => {
    if (!aiOpen || isHistoryOpen || isBookmarksOpen || isSettingsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setAiOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [aiOpen, isHistoryOpen, isBookmarksOpen, isSettingsOpen]);

  // Global escape key to close open modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isHistoryOpen) setIsHistoryOpen(false);
        else if (isBookmarksOpen) setIsBookmarksOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isHistoryOpen, isBookmarksOpen, isSettingsOpen]);

  function handleAddShortcut(e: FormEvent) {
    e.preventDefault();
    const url = normalizeUrl(newUrl);
    if (!url) { setAddError("Enter a valid website address, like example.com"); return; }
    const name = newName.trim() || hostnameOf(url);
    addShortcut(name, url);
    setAddOpen(false);
  }

  function handleBackgroundChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCustomBg(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function getSearchUrl(text: string): string {
    const value = text.trim();
    if (!value) return "";
    const isUrl = /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(value);
    if (isUrl) {
      if (/^https?:\/\//i.test(value)) return value;
      return `https://${value}`;
    }
    return buildSearchUrl(searchEngineId, value);
  }

  function getWebviewRef(id: number, initialUrl: string) {
    const fallbackTitle = hostnameOf(initialUrl);
    return (element: ElectronWebviewElement | null) => {
      if (!element) {
        webviewRefs.current.delete(id);
        return;
      }
      webviewRefs.current.set(id, element);
      if (element.dataset.axiomBound === "1") return;
      element.dataset.axiomBound = "1";

      element.addEventListener("did-start-loading", () => updateTab(id, { loading: true, error: undefined }));
      element.addEventListener("did-stop-loading", () => updateTab(id, { loading: false }));
      element.addEventListener("page-favicon-updated", (event) => {
        const { favicons } = event as FaviconEvent;
        if (favicons?.[0]) {
          updateTab(id, { favicon: favicons[0] });
          addHistoryEntry(element.getTitle() || fallbackTitle, element.getURL() || initialUrl, favicons[0]);
        }
      });

      const updateNavigation = (event: Event) => {
        const { url } = event as NavigationEvent;
        if (activeTabId === id) {
          setAddressQuery(url);
          setCanGoBack(element.canGoBack());
          setCanGoForward(element.canGoForward());
        }
        updateTab(id, { url, error: undefined });
        addHistoryEntry(element.getTitle() || fallbackTitle, url);
      };

      element.addEventListener("did-navigate", updateNavigation);
      element.addEventListener("did-navigate-in-page", updateNavigation);
      element.addEventListener("page-title-updated", (event) => {
        const e = event as PageTitleEvent;
        const newTitle = e.title.trim() || fallbackTitle;
        updateTab(id, { title: newTitle });
        addHistoryEntry(newTitle, element.getURL() || initialUrl);
      });
      element.addEventListener("did-fail-load", (event) => {
        const e = event as LoadFailureEvent;
        if (!e.isMainFrame || e.errorCode === -3) return;
        updateTab(id, { error: describeLoadError(e.errorDescription) });
      });
      
      const allowWebNavigation = (event: Event) => {
        if (!/^https?:\/\//i.test((event as NavigationEvent).url)) event.preventDefault();
      };
      element.addEventListener("will-navigate", allowWebNavigation);
      element.addEventListener("will-redirect", allowWebNavigation);
    };
  }

  function navigateTo(text: string) {
    const url = getSearchUrl(text);
    if (!url || !activeTab) return;

    const activeId = activeTab.id;
    const currentWebview = webviewRefs.current.get(activeId);
    const title = hostnameOf(url);
    
    updateTab(activeId, {
      title: activeTab.initialUrl ? activeTab.title : title,
      url,
      initialUrl: activeTab.initialUrl ?? url,
      error: undefined,
    });

    addHistoryEntry(title, url);

    if (currentWebview) currentWebview.loadURL(url).catch(console.error);
    setQuery("");
  }

  function stepTab(delta: number) {
    const currentIndex = tabs.findIndex((tab) => tab.active);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex].id);
  }

  // Keep a ref to the latest keyboard-action handlers so the global
  // keydown listener can be registered once (on mount) yet always act on
  // up-to-date state. Re-registering on every tab/activeTab change is
  // wasteful and was triggering a react-hooks/exhaustive-deps warning.
  const shortcutsRef = useRef({
    reopenClosedTab,
    addTab,
    closeTab,
    selectTab,
    stepTab,
    tabs,
    activeTab,
    activeTabId,
  });
  useEffect(() => {
    shortcutsRef.current = {
      reopenClosedTab,
      addTab,
      closeTab,
      selectTab,
      stepTab,
      tabs,
      activeTab,
      activeTabId,
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const s = shortcutsRef.current;

      if (mod && event.shiftKey && key === "t") { event.preventDefault(); s.reopenClosedTab(); return; }
      if (mod && !event.shiftKey && key === "t") { event.preventDefault(); s.addTab(); return; }
      if (mod && key === "w") { event.preventDefault(); if (s.activeTab && s.tabs.length > 1) s.closeTab(s.activeTab.id); return; }
      if (mod && key === "l") { event.preventDefault(); addressInputRef.current?.focus(); addressInputRef.current?.select(); return; }
      if (mod && key === "h") { event.preventDefault(); setIsHistoryOpen(h => !h); return; }
      if (mod && key === "b") { event.preventDefault(); setIsBookmarksOpen(b => !b); return; }
      if (mod && key === ",") { event.preventDefault(); setIsSettingsOpen(s2 => !s2); return; }
      if ((mod && key === "r") || event.key === "F5") { event.preventDefault(); webviewRefs.current.get(s.activeTabId)?.reload(); return; }
      if (mod && event.key === "Tab") { event.preventDefault(); s.stepTab(event.shiftKey ? -1 : 1); return; }
      if (mod && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const index = event.key === "9" ? s.tabs.length - 1 : Number(event.key) - 1;
        if (s.tabs[index]) s.selectTab(s.tabs[index].id);
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); webviewRefs.current.get(s.activeTabId)?.goBack(); return; }
      if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); webviewRefs.current.get(s.activeTabId)?.goForward(); return; }
      if (event.key === "Escape" && s.activeTab?.loading) webviewRefs.current.get(s.activeTabId)?.stop();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className={`browser-window ${isDark ? "theme-dark" : ""} ${bgImage ? "has-bg" : ""}`}
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : activeTheme ? { backgroundImage: activeTheme.gradient } : undefined}
    >
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        draggedTabId={draggedTabId}
        dragOverTabId={dragOverTabId}
        onSelectTab={(id) => { selectTab(id); setAddressQuery(tabs.find(t => t.id === id)?.url ?? ""); }}
        onCloseTab={(e, id) => { e.stopPropagation(); closeTab(id); }}
        onAddTab={() => addTab()}
        onTabDragStart={(e, id) => { setDraggedTabId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(id)); }}
        onTabDrop={(e, targetId) => {
          e.preventDefault();
          const sourceId = Number(e.dataTransfer.getData("text/plain"));
          if (sourceId && sourceId !== targetId) {
            setTabs(prev => {
              const sourceIndex = prev.findIndex(t => t.id === sourceId);
              const targetIndex = prev.findIndex(t => t.id === targetId);
              const newTabs = [...prev];
              const [moved] = newTabs.splice(sourceIndex, 1);
              newTabs.splice(targetIndex, 0, moved);
              return newTabs;
            });
          }
          setDraggedTabId(null); setDragOverTabId(null);
        }}
        setDragOverTabId={setDragOverTabId}
        setDraggedTabId={setDraggedTabId}
        setTabs={setTabs}
      />

      <NavigationBar
        activeTab={activeTab}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        addressQuery={addressQuery}
        aiOpen={aiOpen}
        isCurrentBookmarked={isBookmarked(activeTab?.url)}
        addressInputRef={addressInputRef}
        onBack={() => webviewRefs.current.get(activeTabId)?.goBack()}
        onForward={() => webviewRefs.current.get(activeTabId)?.goForward()}
        onReload={() => webviewRefs.current.get(activeTabId)?.reload()}
        onStop={() => webviewRefs.current.get(activeTabId)?.stop()}
        onAddressSearch={() => navigateTo(addressQuery)}
        setAddressQuery={setAddressQuery}
        setAiOpen={setAiOpen}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className={`load-progress ${activeTab?.loading ? "active" : ""}`}></div>

      <div className="browser-body">
        <div className="browser-content">
          <section className={`webview-host ${activeTab?.initialUrl ? "visible" : ""}`}>
            {tabs.filter(t => t.initialUrl).map(tab => (
              <webview
                key={tab.id}
                ref={getWebviewRef(tab.id, tab.initialUrl!)}
                src={tab.initialUrl}
                webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
                className={`browser-webview ${tab.id === activeTabId && !tab.error ? "active" : ""}`}
              />
            ))}
            {activeTab?.error && (
              <div className="browser-error-page">
                <i className="fa-solid fa-triangle-exclamation error-icon"></i>
                <h2>This page couldn’t be loaded</h2>
                <p>{activeTab.error}</p>
                <button className="error-retry-btn" onClick={() => webviewRefs.current.get(activeTabId)?.loadURL(activeTab.url)}>Try again</button>
              </div>
            )}
          </section>

          {!activeTab?.initialUrl && (
            <main className="main-content">
              <div className="landscape-bg"></div>
              <div className="greeting-section">
                <h1>Good morning <span className="sparkle-symbol">✦</span></h1>
              </div>
              <form className="search-bar" onSubmit={(e) => { e.preventDefault(); navigateTo(query); }}>
                <i className="fa-solid fa-wand-magic-sparkles sparkle-icon"></i>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask anything or search the web..." />
                <button type="submit" className="icon-button submit-btn"><i className="fa-solid fa-arrow-right"></i></button>
              </form>
              <ShortcutsGrid shortcuts={shortcuts} onNavigate={navigateTo} onRemove={removeShortcut} onOpenAdd={() => { setNewName(""); setNewUrl(""); setAddError(""); setAddOpen(true); }} />
              
              {addOpen && (
                <div className="shortcut-modal-backdrop" onMouseDown={() => setAddOpen(false)}>
                  <form className="shortcut-modal" onMouseDown={e => e.stopPropagation()} onSubmit={handleAddShortcut}>
                    <h3>Add shortcut</h3>
                    <label>Name</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                    <label>Website address</label>
                    <input value={newUrl} onChange={e => { setNewUrl(e.target.value); setAddError(""); }} />
                    {addError && <p className="shortcut-error">{addError}</p>}
                    <div className="shortcut-modal-actions">
                      <button type="button" onClick={() => setAddOpen(false)}>Cancel</button>
                      <button type="submit">Add shortcut</button>
                    </div>
                  </form>
                </div>
              )}
              
            </main>
          )}
        </div>

        {/* Floating Robot Mascot & AI Chat */}
        <AIChat
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          onOpen={() => setAiOpen(true)}
          activeUrl={activeTab?.url}
          activeTitle={activeTab?.title}
        />

        {/* Bookmarks Modal */}
        <BookmarksModal
          isOpen={isBookmarksOpen}
          bookmarks={bookmarks}
          currentUrl={activeTab?.url}
          currentTitle={activeTab?.title}
          currentFavicon={activeTab?.favicon}
          isCurrentBookmarked={isBookmarked(activeTab?.url)}
          onClose={() => setIsBookmarksOpen(false)}
          onNavigate={(url) => { navigateTo(url); setIsBookmarksOpen(false); }}
          onToggleCurrent={() => toggleBookmark(activeTab?.title || activeTab?.url || '', activeTab?.url || '', activeTab?.favicon)}
          onRemoveBookmark={removeBookmark}
          onAddBookmark={addBookmark}
        />

        {/* History & Personalization Overlay */}
        {isHistoryOpen && (
          <HistoryPage
            entries={historyEntries}
            onOpen={(url) => { navigateTo(url); setIsHistoryOpen(false); }}
            onRemove={removeHistoryEntries}
            onOpenSettings={() => { setIsHistoryOpen(false); setIsSettingsOpen(true); }}
            onClose={() => setIsHistoryOpen(false)}
            onOpenCustomize={() => { setIsHistoryOpen(false); setIsSettingsOpen(true); }}
            isDark={isDark}
            onToggleDarkMode={toggleDarkMode}
          />
        )}

        {/* Settings & Themes Studio Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDark={isDark}
          onToggleDarkMode={toggleDarkMode}
          availableThemes={availableThemes}
          bgColor={bgColor}
          bgImage={bgImage}
          previewBackground={previewBackground}
          onColorChoose={chooseColor}
          onBgChange={handleBackgroundChange}
          onResetTheme={resetBackground}
          historyCount={historyEntries.length}
          bookmarksCount={bookmarks.length}
          onClearHistory={clearHistory}
          onOpenHistory={() => { setIsSettingsOpen(false); setIsHistoryOpen(true); }}
          onOpenBookmarks={() => { setIsSettingsOpen(false); setIsBookmarksOpen(true); }}
          searchEngineId={searchEngineId}
          onSearchEngineChange={setSearchEngineId}
        />
      </div>
    </div>
  );
}

export default App;
