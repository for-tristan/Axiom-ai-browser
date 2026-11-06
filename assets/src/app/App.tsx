import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import AIChat from "../features/assistant/AIChat";
import { TabBar } from "../components/layout/TabBar";
import { NavigationBar } from "../components/layout/NavigationBar";
import { ShortcutsGrid } from "../components/search/ShortcutsGrid";
import { HistoryPage } from "../components/history/HistoryPage";
import { BookmarksModal } from "../components/bookmarks/BookmarksModal";
import { SettingsModal } from "../components/settings/SettingsModal";
import { DownloadsPanel } from "../components/downloads/DownloadsPanel";
import { useTabs } from "../hooks/useTabs";
import { useShortcuts } from "../hooks/useShortcuts";
import { useTheme } from "../hooks/useTheme";
import { useHistory } from "../hooks/useHistory";
import { useBookmarks } from "../hooks/useBookmarks";
import { useDownloads } from "../hooks/useDownloads";
import { useSearchEngine, buildSearchUrl } from "../hooks/useSearchEngine";
import "./App.css";
import "./mobile.css";

const AI_OPEN_KEY = "axiom-ai-open";

// ---- Flutter bridge (Android/iOS app). Not present in Electron. ----
type NativeEvent =
  | {
      type: "state";
      id: number;
      url?: string;
      title?: string;
      favicon?: string;
      loading?: boolean;
      error?: string;
      canGoBack?: boolean;
      canGoForward?: boolean;
    }
  | { type: "openUrl"; url: string };

declare global {
  interface Window {
    AxiomBridge?: { postMessage: (message: string) => void };
    __axiomNative?: (event: NativeEvent) => void;
  }
}

function isNative(): boolean {
  return typeof window !== "undefined" && !!window.AxiomBridge;
}

function sendNative(message: Record<string, unknown>) {
  try {
    window.AxiomBridge?.postMessage(JSON.stringify(message));
  } catch (err) {
    console.error(err);
  }
}

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
const { shortcuts, addShortcut, removeShortcut, updateShortcut } = useShortcuts();
  const {
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
  const {
    downloads,
    activeCount: downloadsActiveCount,
    removeDownload,
    clearCompleted: clearCompletedDownloads,
    pauseDownload,
    cancelDownload,
    openFile: openDownloadedFile,
    showInFolder: showDownloadedInFolder,
  } = useDownloads();

  type TabPatch = Parameters<typeof updateTab>[1];

  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const addressInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const webviewRefs = useRef(new Map<number, ElectronWebviewElement>());

  // Flutter bridge state
  const nativeLoadedRef = useRef(new Set<number>());
  const nativeNavRef = useRef(new Map<number, { back: boolean; forward: boolean }>());
  const lastBoundsRef = useRef("");

  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [aiOpen, setAiOpen] = useState(() => localStorage.getItem(AI_OPEN_KEY) !== "0");

  // New Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<number | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<number | null>(null);

  // Time-based greeting — recomputed when the component re-renders.
  // 5–11: Good morning, 12–16: Good afternoon, 17–4: Good evening.
  // Cheap to compute so no need for a timer/state.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    localStorage.setItem(AI_OPEN_KEY, aiOpen ? "1" : "0");
  }, [aiOpen]);

  // Keep the address bar in sync with the active tab. Without this,
  // closing a tab leaves the old URL in the address bar because the
  // onSelectTab handler (which updates addressQuery) doesn't fire on
  // close — closeTab switches the active tab internally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddressQuery(activeTab?.url ?? "");
  }, [activeTabId, activeTab?.url]);

  useEffect(() => {
    if (!aiOpen || isHistoryOpen || isBookmarksOpen || isSettingsOpen || isDownloadsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setAiOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [aiOpen, isHistoryOpen, isBookmarksOpen, isSettingsOpen, isDownloadsOpen]);

  // Global escape key to close open modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isHistoryOpen) setIsHistoryOpen(false);
        else if (isBookmarksOpen) setIsBookmarksOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isDownloadsOpen) setIsDownloadsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isHistoryOpen, isBookmarksOpen, isSettingsOpen, isDownloadsOpen]);

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

  // Back / forward / reload / stop: Flutter WebView in the app, <webview> in Electron.
  function tabAction(id: number, action: "back" | "forward" | "reload" | "stop") {
    if (isNative()) {
      sendNative({ type: action, id });
      return;
    }
    const wv = webviewRefs.current.get(id);
    if (!wv) return;
    if (action === "back") wv.goBack();
    else if (action === "forward") wv.goForward();
    else if (action === "reload") wv.reload();
    else wv.stop();
  }

  function retryLoad(id: number, url: string) {
    if (isNative()) {
      sendNative({ type: "load", id, url });
      return;
    }
    webviewRefs.current.get(id)?.loadURL(url);
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

    if (isNative()) {
      nativeLoadedRef.current.add(activeId);
      sendNative({ type: "load", id: activeId, url });
    } else if (currentWebview) {
      currentWebview.loadURL(url).catch(console.error);
    }
    setQuery("");
  }

  function stepTab(delta: number) {
    const currentIndex = tabs.findIndex((tab) => tab.active);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex].id);
  }

  // ---------------- Flutter bridge ----------------
  const latestRef = useRef({ updateTab, addHistoryEntry, navigateTo, activeTabId });
  useEffect(() => {
    latestRef.current = { updateTab, addHistoryEntry, navigateTo, activeTabId };
  });

  // Events coming from Flutter WebViews (loading, title, url, errors...)
  useEffect(() => {
    if (!isNative()) return;
    window.__axiomNative = (event) => {
      const api = latestRef.current;
      if (event.type === "openUrl") {
        api.navigateTo(event.url);
        return;
      }
      if (event.type !== "state") return;

      const { id } = event;
      const patch: TabPatch = {};
      if (event.url !== undefined) patch.url = event.url;
      if (event.title !== undefined) patch.title = event.title;
      if (event.favicon !== undefined) patch.favicon = event.favicon;
      if (event.loading !== undefined) {
        patch.loading = event.loading;
        if (event.loading) patch.error = undefined;
      }
      if (event.error !== undefined) patch.error = describeLoadError(event.error);
      if (Object.keys(patch).length > 0) api.updateTab(id, patch);

      if (event.title && event.url) {
        api.addHistoryEntry(event.title, event.url, event.favicon);
      }

      if (event.canGoBack !== undefined || event.canGoForward !== undefined) {
        const prev = nativeNavRef.current.get(id) ?? { back: false, forward: false };
        const next = {
          back: event.canGoBack ?? prev.back,
          forward: event.canGoForward ?? prev.forward,
        };
        nativeNavRef.current.set(id, next);
        if (id === api.activeTabId) {
          setCanGoBack(next.back);
          setCanGoForward(next.forward);
        }
      }
    };
    return () => {
      delete window.__axiomNative;
    };
  }, []);

  // Back/forward buttons follow the active tab
  useEffect(() => {
    if (!isNative()) return;
    const nav = nativeNavRef.current.get(activeTabId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanGoBack(nav?.back ?? false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanGoForward(nav?.forward ?? false);
  }, [activeTabId]);

  // Tell Flutter where the content area is so the site WebView sits exactly there
  useEffect(() => {
    if (!isNative()) return;
    const el = contentRef.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      const key = [r.left, r.top, r.width, r.height].map((n) => n.toFixed(1)).join(",");
      if (key === lastBoundsRef.current) return;
      lastBoundsRef.current = key;
      sendNative({ type: "bounds", left: r.left, top: r.top, width: r.width, height: r.height });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener("resize", report);
    const timer = window.setInterval(report, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
      window.clearInterval(timer);
    };
  }, []);

  // Create native tabs for tabs that have a site, and close the ones that were closed
  useEffect(() => {
    if (!isNative()) return;
    const loaded = nativeLoadedRef.current;
    const live = new Set<number>();
    for (const t of tabs) {
      if (!t.initialUrl) continue;
      live.add(t.id);
      if (!loaded.has(t.id)) {
        loaded.add(t.id);
        sendNative({ type: "load", id: t.id, url: t.url || t.initialUrl });
      }
    }
    for (const id of Array.from(loaded)) {
      if (!live.has(id)) {
        loaded.delete(id);
        nativeNavRef.current.delete(id);
        sendNative({ type: "close", id });
      }
    }
  }, [tabs]);

  // Show the active site only when nothing from the React UI should be on top of it
  const overlayOpen =
    aiOpen || isHistoryOpen || isBookmarksOpen || isSettingsOpen || isDownloadsOpen || addOpen;
  const nativeVisibleId =
    !overlayOpen && activeTab?.initialUrl && !activeTab?.error ? activeTabId : null;
  useEffect(() => {
    if (!isNative()) return;
    sendNative({ type: "show", id: nativeVisibleId });
  }, [nativeVisibleId]);
  // -------------------------------------------------

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
      if (mod && key === "j") { event.preventDefault(); setIsDownloadsOpen(d => !d); return; }
      if (mod && key === ",") { event.preventDefault(); setIsSettingsOpen(s2 => !s2); return; }
      if ((mod && key === "r") || event.key === "F5") { event.preventDefault(); tabAction(s.activeTabId, "reload"); return; }
      if (mod && event.key === "Tab") { event.preventDefault(); s.stepTab(event.shiftKey ? -1 : 1); return; }
      if (mod && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const index = event.key === "9" ? s.tabs.length - 1 : Number(event.key) - 1;
        if (s.tabs[index]) s.selectTab(s.tabs[index].id);
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); tabAction(s.activeTabId, "back"); return; }
      if (event.altKey && event.key === "ArrowRight") { event.preventDefault(); tabAction(s.activeTabId, "forward"); return; }
      if (event.key === "Escape" && s.activeTab?.loading) tabAction(s.activeTabId, "stop");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className={`browser-window ${bgImage ? "has-bg" : ""}`}
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
        onBack={() => tabAction(activeTabId, "back")}
        onForward={() => tabAction(activeTabId, "forward")}
        onReload={() => tabAction(activeTabId, "reload")}
        onStop={() => tabAction(activeTabId, "stop")}
        onAddressSearch={() => navigateTo(addressQuery)}
        setAddressQuery={setAddressQuery}
        setAiOpen={setAiOpen}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDownloads={() => setIsDownloadsOpen(true)}
        downloadsActiveCount={downloadsActiveCount}
      />

      <div className={`load-progress ${activeTab?.loading ? "active" : ""}`}></div>

      <div className="browser-body">
        <div className="browser-content" ref={contentRef}>
          <section className={`webview-host ${activeTab?.initialUrl ? "visible" : ""}`}>
            {!isNative() && tabs.filter(t => t.initialUrl).map(tab => (
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
                <button className="error-retry-btn" onClick={() => retryLoad(activeTabId, activeTab.url)}>Try again</button>
              </div>
            )}
          </section>

          {!activeTab?.initialUrl && (
            <main className="main-content">
              <div className="landscape-bg"></div>
              <div className="greeting-section">
                <h1>{greeting} <span className="sparkle-symbol">✦</span></h1>
              </div>
              <form className="search-bar" onSubmit={(e) => { e.preventDefault(); navigateTo(query); }}>
                <i className="fa-solid fa-wand-magic-sparkles sparkle-icon"></i>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask anything or search the web..." />
                <button type="submit" className="icon-button submit-btn"><i className="fa-solid fa-arrow-right"></i></button>
              </form>
<ShortcutsGrid shortcuts={shortcuts} onNavigate={navigateTo} onRemove={removeShortcut} onUpdate={updateShortcut} onOpenAdd={() => { setNewName(""); setNewUrl(""); setAddError(""); setAddOpen(true); }} />
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
          />
        )}

        {/* Settings & Themes Studio Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
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

        {/* Downloads Panel */}
        <DownloadsPanel
          isOpen={isDownloadsOpen}
          downloads={downloads}
          onClose={() => setIsDownloadsOpen(false)}
          onRemove={removeDownload}
          onClearCompleted={clearCompletedDownloads}
          onPause={pauseDownload}
          onCancel={cancelDownload}
          onOpenFile={openDownloadedFile}
          onShowInFolder={showDownloadedInFolder}
        />
      </div>
    </div>
  );
}

export default App;