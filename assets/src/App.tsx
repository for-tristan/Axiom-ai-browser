import { useEffect, useState } from "react";
import "./App.css";

// ===== Flutter bridge =====
declare global {
  interface Window {
    AxiomHost?: {
      postMessage: (message: string) => void;
    };
  }
}

function postToFlutter(message: string) {
  try {
    window.AxiomHost?.postMessage(message);
  } catch {
    // مش جوّه Flutter WebView
  }
}

interface Tab {
  id: number;
  title: string;
  active: boolean;
}

interface SpeechResultItem {
  transcript: string;
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<SpeechResultItem>>;
}

interface SpeechErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

type NavId = "home" | "history" | "bookmarks" | "downloads" | "settings";
type TextSize = "small" | "default" | "large";
type UiStyle = "rounded" | "soft" | "crisp";

interface NavEntry {
  id: NavId;
  label: string;
  icon: string;
  section: string;
  flutterRoute?: "history" | "bookmarks" | "profile";
}

interface Appearance {
  textSize: TextSize;
  uiStyle: UiStyle;
}

const NAV_ITEMS: NavEntry[] = [
  { id: "home", label: "Home", icon: "fa-house", section: "Main" },
  {
    id: "history",
    label: "History",
    icon: "fa-clock-rotate-left",
    section: "Main",
    flutterRoute: "history",
  },
  {
    id: "bookmarks",
    label: "Bookmarks",
    icon: "fa-bookmark",
    section: "Main",
    flutterRoute: "bookmarks",
  },
  { id: "downloads", label: "Downloads", icon: "fa-download", section: "Main" },
  { id: "settings", label: "Settings", icon: "fa-gear", section: "Preferences" },
];

const TEXT_SIZES: { id: TextSize; label: string; sample: number }[] = [
  { id: "small", label: "Small", sample: 12 },
  { id: "default", label: "Default", sample: 15 },
  { id: "large", label: "Large", sample: 18 },
];

const UI_STYLES: { id: UiStyle; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "soft", label: "Soft" },
  { id: "crisp", label: "Crisp" },
];

const DEFAULT_APPEARANCE: Appearance = { textSize: "default", uiStyle: "rounded" };
const APPEARANCE_KEY = "axiom-appearance";

function loadAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Appearance>;
      const textSize =
        TEXT_SIZES.find((t) => t.id === parsed.textSize)?.id ??
        DEFAULT_APPEARANCE.textSize;
      const uiStyle =
        UI_STYLES.find((s) => s.id === parsed.uiStyle)?.id ??
        DEFAULT_APPEARANCE.uiStyle;
      return { textSize, uiStyle };
    }
  } catch {}
  return DEFAULT_APPEARANCE;
}

function App() {
  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("");

  const [tabs, setTabs] = useState<Tab[]>([
    { id: 1, title: "New Tab", active: true },
  ]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavId>("home");
  const [navFilter, setNavFilter] = useState("");

  const [savedAppearance, setSavedAppearance] =
    useState<Appearance>(loadAppearance);
  const [draftAppearance, setDraftAppearance] =
    useState<Appearance>(loadAppearance);

  const changesCount =
    (draftAppearance.textSize !== savedAppearance.textSize ? 1 : 0) +
    (draftAppearance.uiStyle !== savedAppearance.uiStyle ? 1 : 0);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // التعديل الأساسي: نبعت رسالة للـ Flutter لما يضغط History/Bookmarks/Profile
  function handleNavSelect(id: NavId) {
    setSidebarOpen(false);
    setNavFilter("");

    const entry = NAV_ITEMS.find((n) => n.id === id);
    if (entry?.flutterRoute) {
      postToFlutter(entry.flutterRoute);
      return;
    }
    setActiveNav(id);
  }

  function handleProfileClick() {
    setSidebarOpen(false);
    setNavFilter("");
    postToFlutter("profile");
  }

  function handleApplyAppearance() {
    setSavedAppearance(draftAppearance);
    try {
      window.localStorage.setItem(
        APPEARANCE_KEY,
        JSON.stringify(draftAppearance),
      );
    } catch {}
  }

  function handleDiscardAppearance() {
    setDraftAppearance(savedAppearance);
  }

  function handleAddTab() {
    const newId = Date.now();
    const updatedTabs = tabs.map((t) => ({ ...t, active: false }));
    setTabs([...updatedTabs, { id: newId, title: "New Tab", active: true }]);
  }

  function handleSelectTab(id: number) {
    setTabs(tabs.map((t) => ({ ...t, active: t.id === id })));
  }

  function handleCloseTab(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const filtered = tabs.filter((t) => t.id !== id);
    const hasActive = filtered.some((t) => t.active);
    if (!hasActive && filtered.length > 0) {
      filtered[filtered.length - 1].active = true;
    }
    setTabs(filtered);
  }

  function getSearchUrl(text: string): string {
    const value = text.trim();
    if (!value) return "";
    const isUrl =
      /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(value);
    if (isUrl) {
      if (/^https?:\/\//i.test(value)) return value;
      return `https://${value}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  }

  function handleMainSearch() {
    const url = getSearchUrl(query);
    if (!url) {
      setStatus("Please enter a search term or website address.");
      return;
    }
    setStatus("");
    window.location.assign(url);
  }

  function handleAddressSearch() {
    const url = getSearchUrl(addressQuery);
    if (!url) return;
    setStatus("");
    window.location.assign(url);
  }

  async function startVoiceSearch() {
    if (isListening) return;
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("Voice search is not supported in this browser.");
      return;
    }
    try {
      setStatus("Checking microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const recognition = new SpeechRecognition();
      recognition.lang = "ar-EG";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        setIsListening(true);
        setStatus("Listening... Speak now.");
      };
      recognition.onresult = (event: SpeechResultEvent) => {
        const transcript = event.results[0]?.[0]?.transcript.trim() ?? "";
        if (!transcript) {
          setStatus("No speech detected.");
          return;
        }
        setQuery(transcript);
        const url = getSearchUrl(transcript);
        if (url) {
          setStatus(`Searching for: ${transcript}`);
          window.location.assign(url);
        }
      };
      recognition.onerror = (event: SpeechErrorEvent) => {
        setIsListening(false);
        setStatus(`Voice error: ${event.error}`);
      };
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch {
      setIsListening(false);
      setStatus("Could not start voice search.");
    }
  }

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(navFilter.trim().toLowerCase()),
  );
  const navSections = Array.from(new Set(filteredNav.map((i) => i.section)));
  const activeEntry = NAV_ITEMS.find((i) => i.id === activeNav);
  const currentTextSize = TEXT_SIZES.find((t) => t.id === draftAppearance.textSize);
  const currentUiStyle = UI_STYLES.find((s) => s.id === draftAppearance.uiStyle);

  return (
    <div
      className="browser-window"
      data-text={draftAppearance.textSize}
      data-style={draftAppearance.uiStyle}
    >
      <div className="browser-body">
        {sidebarOpen && (
          <div
            className="sidebar-scrim"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}
          aria-label="Sidebar"
        >
          {sidebarOpen ? (
            <div className="sidebar-panel">
              <div className="panel-header">
                <div className="brand-mark" aria-hidden="true">A</div>
                <div className="brand-text">
                  <div className="brand-name">Axiom</div>
                  <div className="brand-sub">Browser workspace</div>
                </div>
              </div>

              <label className="panel-search">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  value={navFilter}
                  onChange={(e) => setNavFilter(e.target.value)}
                  placeholder="Search pages"
                  aria-label="Search pages"
                />
              </label>

              <nav className="sidebar-menu">
                {navSections.map((section) => (
                  <div className="menu-section" key={section}>
                    <div className="menu-section-label">{section}</div>
                    {filteredNav
                      .filter((item) => item.section === section)
                      .map((item) => (
                        <button
                          key={item.id}
                          className={`nav-item ${
                            activeNav === item.id ? "active" : ""
                          }`}
                          onClick={() => handleNavSelect(item.id)}
                        >
                          <i className={`fa-solid ${item.icon} nav-icon`}></i>
                          <span>{item.label}</span>
                        </button>
                      ))}
                  </div>
                ))}
                {filteredNav.length === 0 && (
                  <p className="menu-empty">No pages found</p>
                )}
              </nav>

              <div className="panel-footer">
                <div className="weather-card">
                  <i className="fa-solid fa-cloud-sun weather-icon"></i>
                  <div>
                    <div className="weather-temp">24°C</div>
                    <div className="weather-location">Cairo, Egypt</div>
                  </div>
                </div>

                <button className="user-card" onClick={handleProfileClick}>
                  <span className="user-avatar">
                    <i className="fa-regular fa-user"></i>
                  </span>
                  <span className="user-text">
                    <span className="user-name">Guest</span>
                    <span className="user-sub">Local profile</span>
                  </span>
                  <i className="fa-solid fa-chevron-right user-chevron"></i>
                </button>
              </div>
            </div>
          ) : (
            <nav className="sidebar-rail">
              <button
                className="brand-mark brand-button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >A</button>
              <div className="rail-divider"></div>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`rail-btn ${activeNav === item.id ? "active" : ""}`}
                  onClick={() => handleNavSelect(item.id)}
                  title={item.label}
                  aria-label={item.label}
                >
                  <i className={`fa-solid ${item.icon}`}></i>
                </button>
              ))}
              <div className="rail-divider"></div>
              <span className="rail-btn static" title="24°C · Cairo, Egypt">
                <i className="fa-solid fa-cloud-sun weather-icon"></i>
              </span>
            </nav>
          )}

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
          >
            <i className={`fa-solid ${sidebarOpen ? "fa-chevron-left" : "fa-chevron-right"}`}></i>
          </button>
        </aside>

        <main className="main-content">
          <div className="page-scroll">
            {activeNav === "home" && (
              <div className="page">
                <div className="greeting-section">
                  <h1>AXIOM BROWSER</h1>
                  <p>Search smarter with AI</p>
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
                    placeholder="Ask anything..."
                    aria-label="Ask anything"
                  />
                  <button
                    type="button"
                    className={`icon-button ${isListening ? "listening" : ""}`}
                    onClick={() => void startVoiceSearch()}
                    title="Voice Search"
                  >
                    <i className="fa-solid fa-microphone"></i>
                  </button>
                  <button type="submit" className="icon-button submit-btn" title="Search">
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </form>

                <div className="shortcuts-grid">
                  <a href="https://youtube.com" className="shortcut-item">
                    <div className="shortcut-icon" style={{ color: "#FF0000" }}>
                      <i className="fa-brands fa-youtube"></i>
                    </div>
                    <span>YouTube</span>
                  </a>
                  <a href="https://github.com" className="shortcut-item">
                    <div className="shortcut-icon">
                      <i className="fa-brands fa-github"></i>
                    </div>
                    <span>GitHub</span>
                  </a>
                  <a href="https://google.com" className="shortcut-item">
                    <div className="shortcut-icon" style={{ color: "#4285F4" }}>
                      <i className="fa-brands fa-google"></i>
                    </div>
                    <span>Google</span>
                  </a>
                  <a href="https://notion.so" className="shortcut-item">
                    <div className="shortcut-icon">
                      <i className="fa-solid fa-n"></i>
                    </div>
                    <span>Notion</span>
                  </a>
                  <div className="shortcut-item">
                    <div className="shortcut-icon">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <span>Add</span>
                  </div>
                </div>
              </div>
            )}

            {activeNav === "settings" && (
              <div className="page settings-page">
                <div className="page-header">
                  <h2>Settings</h2>
                  <p>Make the app feel like yours.</p>
                </div>
                <section className="card">
                  <h3 className="card-label">Appearance</h3>
                  <div className="setting-row">
                    <div className="setting-head">
                      <span>Text size</span>
                      <span className="setting-value">{currentTextSize?.label}</span>
                    </div>
                    <div className="segmented" role="radiogroup" aria-label="Text size">
                      {TEXT_SIZES.map((size) => (
                        <button
                          key={size.id}
                          role="radio"
                          aria-checked={draftAppearance.textSize === size.id}
                          className={`seg-btn ${draftAppearance.textSize === size.id ? "selected" : ""}`}
                          onClick={() => setDraftAppearance({ ...draftAppearance, textSize: size.id })}
                        >
                          <span style={{ fontSize: size.sample }}>Aa</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-row">
                    <div className="setting-head">
                      <span>UI style</span>
                      <span className="setting-value">{currentUiStyle?.label}</span>
                    </div>
                    <div className="style-grid" role="radiogroup" aria-label="UI style">
                      {UI_STYLES.map((style) => (
                        <button
                          key={style.id}
                          role="radio"
                          aria-checked={draftAppearance.uiStyle === style.id}
                          className={`style-card ${draftAppearance.uiStyle === style.id ? "selected" : ""}`}
                          onClick={() => setDraftAppearance({ ...draftAppearance, uiStyle: style.id })}
                        >
                          <span className={`style-preview ${style.id}`} aria-hidden="true"></span>
                          <span>{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeNav !== "home" && activeNav !== "settings" && (
              <div className="page">
                <div className="empty-card">
                  <div className="empty-icon">
                    <i className={`fa-solid ${activeEntry?.icon ?? "fa-folder"}`}></i>
                  </div>
                  <h2>{activeEntry?.label}</h2>
                  <p>Nothing here yet.</p>
                </div>
              </div>
            )}
          </div>

          {activeNav === "home" && status && (
            <p className="voice-status">{status}</p>
          )}

          {activeNav === "home" && (
            <div className="ai-badge">
              <i className="fa-solid fa-wand-magic-sparkles"></i> AI powered search{" "}
              <i className="fa-solid fa-arrow-right"></i>
            </div>
          )}

          {activeNav === "settings" && changesCount > 0 && (
            <div className="changes-bar">
              <span className="changes-count">
                <span className="changes-dot"></span>
                {changesCount} {changesCount === 1 ? "change" : "changes"}
              </span>
              <div className="changes-actions">
                <button className="ghost-btn" onClick={handleDiscardAppearance}>Discard</button>
                <button className="primary-btn" onClick={handleApplyAppearance}>Apply</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;