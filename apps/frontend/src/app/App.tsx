import { useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  DragEvent as ReactDragEvent,
  FormEvent,
  MouseEvent,
} from "react";
import AIChat from "../features/assistant/AIChat";
import "./App.css";

const BG_KEY = "axiom-bg";
const COLOR_KEY = "axiom-bg-color";
const AI_OPEN_KEY = "axiom-ai-open";
const MAX_CLOSED_TABS = 10;

interface Shortcut {
  id: string;
  name: string;
  url: string;
  icon?: string; // Font Awesome classes (للأيقونات الجاهزة)
  colorClass?: string;
  builtin?: boolean;
}

const SHORTCUTS_KEY = "axiom-shortcuts";
const MAX_VISIBLE_SHORTCUTS = 6;

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "youtube", name: "YouTube", url: "https://youtube.com", icon: "fa-brands fa-youtube", colorClass: "icon-youtube", builtin: true },
  { id: "github", name: "GitHub", url: "https://github.com", icon: "fa-brands fa-github", colorClass: "icon-github", builtin: true },
  { id: "google", name: "Google", url: "https://google.com", icon: "fa-brands fa-google", colorClass: "icon-google", builtin: true },
  { id: "notion", name: "Notion", url: "https://notion.so", colorClass: "icon-notion", builtin: true },
];

// بيحوّل اللي المستخدم كتبه لـ URL صحيح، أو null لو مش صالح
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
  } catch {
    /* ignore */
  }

  return (
    <img
      className="shortcut-favicon"
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

interface ColorTheme {
  id: string;
  name: string;
  gradient: string;
}

// الأول (Default) بيرجع التدرج الأصلي
const COLOR_THEMES: ColorTheme[] = [
  { id: "", name: "Default", gradient: "var(--bg-gradient)" },
  { id: "ocean", name: "Ocean", gradient: "linear-gradient(180deg, #d4e8fb 0%, #b9d6f4 55%, #a5c4ee 100%)" },
  { id: "mint", name: "Mint", gradient: "linear-gradient(180deg, #dcf5ec 0%, #c3ebdb 55%, #aee0cb 100%)" },
  { id: "sunset", name: "Sunset", gradient: "linear-gradient(180deg, #fde6d8 0%, #f9cfc4 55%, #f2b9c4 100%)" },
  { id: "lavender", name: "Lavender", gradient: "linear-gradient(180deg, #e6dcfa 0%, #d3c4f4 55%, #c0acee 100%)" },
  { id: "rose", name: "Rose", gradient: "linear-gradient(180deg, #fbe0ec 0%, #f6c8dc 55%, #efb0cb 100%)" },
  { id: "sand", name: "Sand", gradient: "linear-gradient(180deg, #f6ecd9 0%, #eddcbc 55%, #e2cb9f 100%)" },
  { id: "slate", name: "Slate", gradient: "linear-gradient(180deg, #d9dee8 0%, #c2cad9 55%, #aab5ca 100%)" },
];

interface Tab {
  id: number;
  title: string;
  active: boolean;
  url: string;
  initialUrl?: string;
  favicon?: string;
  loading?: boolean;
  error?: string;
}

interface StoredTab {
  url: string;
  title: string;
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

// بتتحسب مرة واحدة عند تحميل الموديول، عشان StrictMode ما يعيدهاش
const INITIAL_TABS: Tab[] = [{ id: 1, title: "New Tab", active: true, url: "" }];

function App() {
  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const addressInputRef = useRef<HTMLInputElement>(null);
  const activeTabIdRef = useRef(
    INITIAL_TABS.find((tab) => tab.active)?.id ?? 1,
  );
  const nextTabIdRef = useRef(
    Math.max(...INITIAL_TABS.map((tab) => tab.id)) + 1,
  );
  const closedTabsRef = useRef<StoredTab[]>([]);
  const webviewRefs = useRef(new Map<number, ElectronWebviewElement>());
  const webviewRefCallbacks = useRef(
    new Map<number, (element: ElectronWebviewElement | null) => void>(),
  );
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [aiOpen, setAiOpen] = useState(() => {
    try {
      return localStorage.getItem(AI_OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });

  // خلفية المتصفح المخصصة (بتتحفظ في localStorage)
  const [bgImage, setBgImage] = useState<string>(() => {
    try {
      return localStorage.getItem(BG_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const [bgColor, setBgColor] = useState<string>(() => {
    try {
      return localStorage.getItem(COLOR_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);

  // الـ Shortcuts
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    try {
      const raw = localStorage.getItem(SHORTCUTS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Shortcut[];
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_SHORTCUTS;
  });
  const [showAllShortcuts, setShowAllShortcuts] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<number | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts));
    } catch {
      /* ignore */
    }
  }, [shortcuts]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_OPEN_KEY, aiOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [aiOpen]);

  useEffect(() => {
    if (!aiOpen || customizeOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAiOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [aiOpen, customizeOpen]);

  useEffect(() => {
    if (!addOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAdd();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [addOpen]);

  function openAdd() {
    setNewName("");
    setNewUrl("");
    setAddError("");
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
  }

  function handleAddShortcut(e: FormEvent) {
    e.preventDefault();
    const url = normalizeUrl(newUrl);
    if (!url) {
      setAddError("Enter a valid website address, like example.com");
      return;
    }
    const name = newName.trim() || new URL(url).hostname.replace(/^www\./, "");
    setShortcuts((prev) => [...prev, { id: String(Date.now()), name, url }]);
    setAddOpen(false);
  }

  function removeShortcut(id: string) {
    setShortcuts((prev) => prev.filter((sc) => sc.id !== id));
  }

  const visibleShortcuts = showAllShortcuts
    ? shortcuts
    : shortcuts.slice(0, MAX_VISIBLE_SHORTCUTS);

  // قفل البانل لما تدوس برّاها أو تدوس Escape
  useEffect(() => {
    if (!customizeOpen) return;

    function onMouseDown(e: globalThis.MouseEvent) {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) {
        setCustomizeOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCustomizeOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [customizeOpen]);

  const activeTheme = COLOR_THEMES.find((t) => t.id === bgColor);
  const previewBackground = bgImage
    ? `url(${bgImage})`
    : (activeTheme?.gradient ?? "var(--bg-gradient)");

  function chooseColor(id: string) {
    setBgImage("");
    setBgColor(id);
    try {
      localStorage.removeItem(BG_KEY);
      if (id) localStorage.setItem(COLOR_KEY, id);
      else localStorage.removeItem(COLOR_KEY);
    } catch {
      /* ignore */
    }
  }

  function handleBackgroundChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBgImage(dataUrl);
      setBgColor("");
      try {
        localStorage.removeItem(COLOR_KEY);
        localStorage.setItem(BG_KEY, dataUrl);
      } catch {
        // الصورة كبيرة على localStorage، هتشتغل في الجلسة دي بس
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // عشان تقدر تختار نفس الصورة تاني
  }

  function resetBackground() {
    setBgImage("");
    setBgColor("");
    try {
      localStorage.removeItem(BG_KEY);
      localStorage.removeItem(COLOR_KEY);
    } catch {
      /* ignore */
    }
  }

  // التبويبات بترجع من الجلسة اللي فاتت لو فيه حاجة محفوظة
  const [tabs, setTabs] = useState<Tab[]>(INITIAL_TABS);
  const activeTab = tabs.find((tab) => tab.active);

  useEffect(() => {
    document.title =
      activeTab?.title && activeTab.title !== "New Tab"
        ? `${activeTab.title} — Axiom`
        : "Axiom Browser";
  }, [activeTab?.title]);

  function addTab(url = "", title?: string) {
    const newId = nextTabIdRef.current++;
    activeTabIdRef.current = newId;
    setAddressQuery(url);
    setCanGoBack(false);
    setCanGoForward(false);
    setTabs((currentTabs) => {
      return [
        ...currentTabs.map((tab) => ({ ...tab, active: false })),
        {
          id: newId,
          title: title ?? (url ? hostnameOf(url) : "New Tab"),
          active: true,
          url,
          initialUrl: url || undefined,
        },
      ];
    });
  }

  function handleAddTab() {
    addTab();
  }

  function reopenClosedTab() {
    const entry = closedTabsRef.current.pop();
    if (!entry) return;
    addTab(entry.url, entry.title);
  }

  function stepTab(delta: number) {
    const currentIndex = tabs.findIndex((tab) => tab.active);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    handleSelectTab(tabs[nextIndex].id);
  }

  function focusAddressBar() {
    const input = addressInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }

  function handleSelectTab(id: number) {
    activeTabIdRef.current = id;
    const selectedTab = tabs.find((tab) => tab.id === id);
    setAddressQuery(selectedTab?.url ?? "");
    const webview = webviewRefs.current.get(id);
    setCanGoBack(webview?.canGoBack() ?? false);
    setCanGoForward(webview?.canGoForward() ?? false);
    setTabs((currentTabs) =>
      currentTabs.map((tab) => ({ ...tab, active: tab.id === id })),
    );
  }

  function handleTabDragStart(event: ReactDragEvent<HTMLDivElement>, id: number) {
    setDraggedTabId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  }

  function handleTabDrop(event: ReactDragEvent<HTMLDivElement>, targetId: number) {
    event.preventDefault();
    const sourceId = Number(event.dataTransfer.getData("text/plain"));
    if (!sourceId || sourceId === targetId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }

    setTabs((currentTabs) => {
      const sourceIndex = currentTabs.findIndex((tab) => tab.id === sourceId);
      const targetIndex = currentTabs.findIndex((tab) => tab.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return currentTabs;

      const reorderedTabs = [...currentTabs];
      const [movedTab] = reorderedTabs.splice(sourceIndex, 1);
      reorderedTabs.splice(targetIndex, 0, movedTab);
      return reorderedTabs;
    });
    setDraggedTabId(null);
    setDragOverTabId(null);
  }

  function closeTab(id: number) {
    if (tabs.length === 1) return;

    const closedIndex = tabs.findIndex((tab) => tab.id === id);
    if (closedIndex < 0) return;
    const closingTab = tabs[closedIndex];

    if (closingTab.initialUrl) {
      closedTabsRef.current.push({
        url: closingTab.url || closingTab.initialUrl,
        title: closingTab.title,
      });
      if (closedTabsRef.current.length > MAX_CLOSED_TABS) {
        closedTabsRef.current.shift();
      }
    }

    const remainingTabs = tabs.filter((tab) => tab.id !== id);
    const closedTabWasActive = closingTab.active;
    if (closedTabWasActive) {
      const nextActiveIndex = Math.min(closedIndex, remainingTabs.length - 1);
      const nextActiveTab = remainingTabs[nextActiveIndex];
      activeTabIdRef.current = nextActiveTab.id;
      setAddressQuery(nextActiveTab.url);
      const webview = webviewRefs.current.get(nextActiveTab.id);
      setCanGoBack(webview?.canGoBack() ?? false);
      setCanGoForward(webview?.canGoForward() ?? false);
    }

    setTabs(
      remainingTabs.map((tab) => ({
        ...tab,
        active: closedTabWasActive
          ? tab.id === activeTabIdRef.current
          : tab.active,
      })),
    );
  }

  function handleCloseTab(event: MouseEvent, id: number) {
    event.stopPropagation();
    closeTab(id);
  }

  function getSearchUrl(text: string): string {
    const value = text.trim();
    if (!value) return "";
    const isUrl = /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(value);
    if (isUrl) {
      if (/^https?:\/\//i.test(value)) return value;
      return `https://${value}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  }

  function getWebviewRef(id: number, initialUrl: string) {
    const existingCallback = webviewRefCallbacks.current.get(id);
    if (existingCallback) return existingCallback;

    const fallbackTitle = hostnameOf(initialUrl);
    const callback = (element: ElectronWebviewElement | null) => {
      if (!element) {
        webviewRefs.current.delete(id);
        webviewRefCallbacks.current.delete(id);
        return;
      }

      webviewRefs.current.set(id, element);
      // StrictMode بيعيد نداء الـ ref على نفس العنصر، فبنتأكد إن المستمعين اتضافوا مرة واحدة
      if (element.dataset.axiomBound === "1") return;
      element.dataset.axiomBound = "1";

      element.addEventListener("did-start-loading", () => {
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === id ? { ...tab, loading: true, error: undefined } : tab,
          ),
        );
      });
      element.addEventListener("did-stop-loading", () => {
        setTabs((currentTabs) =>
          currentTabs.map((tab) => (tab.id === id ? { ...tab, loading: false } : tab)),
        );
      });
      element.addEventListener("page-favicon-updated", (event) => {
        const { favicons } = event as Event & { favicons?: string[] };
        const favicon = favicons?.[0];
        if (!favicon) return;
        setTabs((currentTabs) =>
          currentTabs.map((tab) => (tab.id === id ? { ...tab, favicon } : tab)),
        );
      });

      const updateNavigation = (event: Event) => {
        const { url } = event as Event & { url: string };
        if (activeTabIdRef.current === id) {
          setAddressQuery(url);
          setCanGoBack(element.canGoBack());
          setCanGoForward(element.canGoForward());
        }
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === id ? { ...tab, url, error: undefined } : tab,
          ),
        );
      };
      const updateTitle = (event: Event) => {
        const { title } = event as Event & { title: string };
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === id
              ? { ...tab, title: title.trim() || fallbackTitle }
              : tab,
          ),
        );
      };
      const showLoadError = (event: Event) => {
        const { errorCode, errorDescription, isMainFrame } = event as Event & {
          errorCode: number;
          errorDescription: string;
          isMainFrame: boolean;
        };
        if (!isMainFrame || errorCode === -3) return;
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.id === id
              ? { ...tab, error: describeLoadError(errorDescription) }
              : tab,
          ),
        );
      };
      const allowWebNavigation = (event: Event) => {
        const navigationEvent = event as Event & {
          url: string;
          preventDefault(): void;
        };
        if (!/^https?:\/\//i.test(navigationEvent.url)) {
          navigationEvent.preventDefault();
        }
      };

      element.addEventListener("did-navigate", updateNavigation);
      element.addEventListener("did-navigate-in-page", updateNavigation);
      element.addEventListener("page-title-updated", updateTitle);
      element.addEventListener("did-fail-load", showLoadError);
      element.addEventListener("will-navigate", allowWebNavigation);
      element.addEventListener("will-redirect", allowWebNavigation);
    };

    webviewRefCallbacks.current.set(id, callback);
    return callback;
  }

  function navigateTo(text: string) {
    const url = getSearchUrl(text);
    if (!url || !activeTab) return;

    const activeId = activeTab.id;
    const currentWebview = webviewRefs.current.get(activeId);
    const title = new URL(url).hostname.replace(/^www\./, "");
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeId
          ? {
              ...tab,
              title: tab.initialUrl ? tab.title : title,
              url,
              initialUrl: tab.initialUrl ?? url,
              error: undefined,
            }
          : tab,
      ),
    );

    if (currentWebview) {
      // رسالة الخطأ بتتحدد من حدث did-fail-load (أوضح للمستخدم)
      void currentWebview.loadURL(url).catch((error: unknown) => {
        console.error("Navigation failed", error);
      });
    }
    setQuery("");
  }

  function handleMainSearch() {
    navigateTo(query);
  }

  function handleAddressSearch() {
    navigateTo(addressQuery);
  }

  function handleBack() {
    webviewRefs.current.get(activeTab?.id ?? -1)?.goBack();
  }

  function handleForward() {
    webviewRefs.current.get(activeTab?.id ?? -1)?.goForward();
  }

  function handleReload() {
    webviewRefs.current.get(activeTab?.id ?? -1)?.reload();
  }

  function handleStop() {
    const webview = webviewRefs.current.get(activeTab?.id ?? -1);
    if (!webview) return;
    webview.stop();
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTab?.id ? { ...tab, loading: false } : tab,
      ),
    );
  }

  function retryTab() {
    if (!activeTab?.url) return;
    const webview = webviewRefs.current.get(activeTab.id);
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === activeTab.id ? { ...tab, error: undefined } : tab,
      ),
    );
    void webview?.loadURL(activeTab.url).catch((error: unknown) => {
      console.error("Retry failed", error);
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && event.shiftKey && key === "t") {
        event.preventDefault();
        reopenClosedTab();
        return;
      }
      if (mod && !event.shiftKey && key === "t") {
        event.preventDefault();
        addTab();
        return;
      }
      if (mod && key === "w") {
        event.preventDefault();
        if (activeTab && tabs.length > 1) closeTab(activeTab.id);
        return;
      }
      if (mod && key === "l") {
        event.preventDefault();
        focusAddressBar();
        return;
      }
      if ((mod && key === "r") || event.key === "F5") {
        event.preventDefault();
        handleReload();
        return;
      }
      if (mod && event.key === "Tab") {
        event.preventDefault();
        stepTab(event.shiftKey ? -1 : 1);
        return;
      }
      if (mod && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        const index =
          event.key === "9" ? tabs.length - 1 : Number(event.key) - 1;
        if (tabs[index]) handleSelectTab(tabs[index].id);
        return;
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        handleBack();
        return;
      }
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        handleForward();
        return;
      }
      if (event.key === "Escape" && activeTab?.loading) {
        handleStop();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tabs, activeTab]);

  return (
    <div
      className={`browser-window ${bgImage ? "has-bg" : ""}`}
      style={
        bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : bgColor && activeTheme
            ? { backgroundImage: activeTheme.gradient }
            : undefined
      }
    >
      {/* Top Tab Bar */}
      <header className="top-tab-bar">
        <div className={`tabs-container ${tabs.length > 5 ? "compact" : ""}`}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item ${tab.active ? "active" : ""} ${draggedTabId === tab.id ? "dragging" : ""} ${dragOverTabId === tab.id && draggedTabId !== tab.id ? "drag-over" : ""}`}
              onClick={() => handleSelectTab(tab.id)}
              draggable
              onDragStart={(event) => handleTabDragStart(event, tab.id)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverTabId(tab.id);
              }}
              onDrop={(event) => handleTabDrop(event, tab.id)}
              onDragEnd={() => {
                setDraggedTabId(null);
                setDragOverTabId(null);
              }}
              onMouseDown={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  closeTab(tab.id);
                }
              }}
              role="tab"
              aria-selected={tab.active}
              tabIndex={0}
            >
              {tab.loading ? (
                <span className="tab-spinner" aria-hidden="true"></span>
              ) : tab.favicon ? (
                <img
                  className="tab-favicon"
                  src={tab.favicon}
                  alt=""
                  onError={() =>
                    setTabs((currentTabs) =>
                      currentTabs.map((currentTab) =>
                        currentTab.id === tab.id
                          ? { ...currentTab, favicon: undefined }
                          : currentTab,
                      ),
                    )
                  }
                />
              ) : (
                <i className="fa-solid fa-globe tab-icon"></i>
              )}
              <span className="tab-title">{tab.title}</span>
              <button
                className="close-tab-btn"
                onClick={(e) => handleCloseTab(e, tab.id)}
                title="Close Tab"
                aria-label={`Close ${tab.title}`}
                disabled={tabs.length === 1}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
          <button
            className="add-tab-btn"
            onClick={handleAddTab}
            title="New Tab"
            aria-label="New tab"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="navigation-bar">
        <div className="nav-arrows">
          <button
            className="nav-arrow-btn"
            title="Back"
            aria-label="Back"
            onClick={handleBack}
            disabled={!canGoBack}
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <button
            className="nav-arrow-btn"
            title="Forward"
            aria-label="Forward"
            onClick={handleForward}
            disabled={!canGoForward}
          >
            <i className="fa-solid fa-arrow-right"></i>
          </button>
          <button
            className="nav-arrow-btn"
            title={activeTab?.loading ? "Stop loading" : "Reload"}
            aria-label={activeTab?.loading ? "Stop loading" : "Reload"}
            onClick={activeTab?.loading ? handleStop : handleReload}
          >
            <i
              className={`fa-solid ${activeTab?.loading ? "fa-xmark" : "fa-rotate-right"}`}
            ></i>
          </button>
        </div>

        <form
          className="address-bar-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddressSearch();
          }}
        >
          <i
            className={`fa-solid ${activeTab?.url.startsWith("https://") ? "fa-lock" : "fa-globe"} address-lock`}
          ></i>
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
          <button className="tool-btn" title="Bookmarks">
            <i className="fa-regular fa-star"></i>
          </button>
          <button className="tool-btn" title="Extensions">
            <i className="fa-solid fa-puzzle-piece"></i>
          </button>
          <button className="tool-btn" title="Downloads">
            <i className="fa-solid fa-download"></i>
          </button>
          <button className="tool-btn profile" title="Profile">
            <i className="fa-solid fa-user"></i>
          </button>
        </div>
      </div>

      <div
        className={`load-progress ${activeTab?.loading ? "active" : ""}`}
        aria-hidden="true"
      ></div>

      {/* Browser Body (بدون sidebar على اليسار) */}
      <div className="browser-body">
        <div className="browser-content">
          <section
            className={`webview-host ${activeTab?.initialUrl ? "visible" : ""}`}
            aria-label="Browser page"
          >
            {tabs
              .filter((tab): tab is Tab & { initialUrl: string } =>
                Boolean(tab.initialUrl),
              )
              .map((tab) => (
                <webview
                  key={tab.id}
                  ref={getWebviewRef(tab.id, tab.initialUrl)}
                  src={tab.initialUrl}
                  webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
                  className={`browser-webview ${tab.active && !tab.error ? "active" : ""}`}
                />
              ))}
            {activeTab?.error && (
              <div className="browser-error-page" role="alert">
                <i className="fa-solid fa-triangle-exclamation error-icon"></i>
                <h2>This page couldn’t be loaded</h2>
                <p>{activeTab.error}</p>
                <span className="error-url">{activeTab.url}</span>
                <button className="error-retry-btn" type="button" onClick={retryTab}>
                  <i className="fa-solid fa-rotate-right"></i> Try again
                </button>
              </div>
            )}
          </section>

          {!activeTab?.initialUrl && <main className="main-content">
          <div className="landscape-bg"></div>

          <div className="greeting-section">
            <h1>Good morning <span className="sparkle-symbol">✦</span></h1>
            <p>Smarter browsing. Powered by AI.</p>
          </div>

          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleMainSearch();
            }}
          >
            <i className="fa-solid fa-wand-magic-sparkles sparkle-icon"></i>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything or search the web..."
            />
            <button type="button" className="icon-button" title="Voice Search">
              <i className="fa-solid fa-microphone"></i>
            </button>
            <button type="button" className="icon-button" title="Attach file">
              <i className="fa-solid fa-paperclip"></i>
            </button>
            <button type="submit" className="icon-button submit-btn" title="Search">
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>

          {/* Shortcuts Grid */}
          <div className="shortcuts-grid">
            {visibleShortcuts.map((sc) => (
              <div className="shortcut-wrap" key={sc.id}>
                <a
                  href={sc.url}
                  className="shortcut-item"
                  onClick={(event) => {
                    event.preventDefault();
                    navigateTo(sc.url);
                  }}
                >
                  <div className={`shortcut-icon ${sc.colorClass ?? ""}`}>
                    <ShortcutIcon shortcut={sc} />
                  </div>
                  <span>{sc.name}</span>
                </a>
                <button
                  className="shortcut-remove"
                  onClick={() => removeShortcut(sc.id)}
                  title={`Remove ${sc.name}`}
                  aria-label={`Remove ${sc.name}`}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}

            <button className="shortcut-item shortcut-btn" onClick={openAdd}>
              <div className="shortcut-icon icon-add">
                <i className="fa-solid fa-plus"></i>
              </div>
              <span>Add</span>
            </button>

            {shortcuts.length > MAX_VISIBLE_SHORTCUTS && (
              <button
                className="shortcut-item shortcut-btn"
                onClick={() => setShowAllShortcuts((v) => !v)}
              >
                <div className="shortcut-icon icon-more">
                  <i className={`fa-solid ${showAllShortcuts ? "fa-chevron-up" : "fa-ellipsis"}`}></i>
                </div>
                <span>{showAllShortcuts ? "Less" : "More"}</span>
              </button>
            )}
          </div>

          {addOpen && (
            <div className="shortcut-modal-backdrop" onMouseDown={closeAdd}>
              <form
                className="shortcut-modal"
                onMouseDown={(e) => e.stopPropagation()}
                onSubmit={handleAddShortcut}
              >
                <h3>Add shortcut</h3>

                <label htmlFor="sc-name">Name</label>
                <input
                  id="sc-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />

                <label htmlFor="sc-url">Website address</label>
                <input
                  id="sc-url"
                  type="text"
                  value={newUrl}
                  onChange={(e) => {
                    setNewUrl(e.target.value);
                    setAddError("");
                  }}
                />

                {addError && <p className="shortcut-error">{addError}</p>}

                <div className="shortcut-modal-actions">
                  <button type="button" className="modal-cancel" onClick={closeAdd}>
                    Cancel
                  </button>
                  <button type="submit" className="modal-save">
                    Add shortcut
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="footer-bar">
            <div className="footer-right">
              <div className="customize-wrap" ref={customizeRef}>
                <button
                  className="customize-btn"
                  onClick={() => setCustomizeOpen((o) => !o)}
                  aria-expanded={customizeOpen}
                >
                  <i className="fa-solid fa-sliders"></i> Customize
                </button>

                {customizeOpen && (
                  <div className="customize-panel" role="dialog" aria-label="Customize">
                    <div className="customize-header">
                      <h3>Customize</h3>
                      <button
                        className="customize-close"
                        onClick={() => setCustomizeOpen(false)}
                        title="Close"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <div
                      className="customize-preview"
                      style={{
                        backgroundImage: previewBackground,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <div className="preview-tab"></div>
                      <div className="preview-bar"></div>
                    </div>

                    <label className="upload-btn">
                      <i className="fa-solid fa-image"></i> Upload a wallpaper
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundChange}
                        style={{ display: "none" }}
                      />
                    </label>

                    <div className="customize-label">Colors</div>
                    <div className="swatch-grid">
                      {COLOR_THEMES.map((t) => {
                        const selected = !bgImage && bgColor === t.id;
                        return (
                          <button
                            key={t.id || "default"}
                            className={`swatch ${selected ? "selected" : ""}`}
                            style={{ backgroundImage: t.gradient }}
                            onClick={() => chooseColor(t.id)}
                            title={t.name}
                            aria-label={t.name}
                          >
                            {selected && <i className="fa-solid fa-check"></i>}
                          </button>
                        );
                      })}
                    </div>

                    {(bgImage || bgColor) && (
                      <button className="reset-link" onClick={resetBackground}>
                        <i className="fa-solid fa-rotate-left"></i> Reset to default
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          </main>}
        </div>

        <AIChat
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          onOpen={() => setAiOpen(true)}
        />
      </div>
    </div>
  );
}

export default App;