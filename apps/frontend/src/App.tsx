import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import "./App.css";

const BG_KEY = "axiom-bg";
const COLOR_KEY = "axiom-bg-color";

interface ColorTheme {
  id: string;
  name: string;
  gradient: string;
}

const COLOR_THEMES: ColorTheme[] = [
  { id: "", name: "Default", gradient: "var(--bg-gradient)" },
  {
    id: "ocean",
    name: "Ocean",
    gradient: "linear-gradient(180deg, #d4e8fb 0%, #b9d6f4 55%, #a5c4ee 100%)",
  },
  {
    id: "mint",
    name: "Mint",
    gradient: "linear-gradient(180deg, #dcf5ec 0%, #c3ebdb 55%, #aee0cb 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    gradient: "linear-gradient(180deg, #fde6d8 0%, #f9cfc4 55%, #f2b9c4 100%)",
  },
  {
    id: "lavender",
    name: "Lavender",
    gradient: "linear-gradient(180deg, #e6dcfa 0%, #d3c4f4 55%, #c0acee 100%)",
  },
  {
    id: "rose",
    name: "Rose",
    gradient: "linear-gradient(180deg, #fbe0ec 0%, #f6c8dc 55%, #efb0cb 100%)",
  },
  {
    id: "sand",
    name: "Sand",
    gradient: "linear-gradient(180deg, #f6ecd9 0%, #eddcbc 55%, #e2cb9f 100%)",
  },
  {
    id: "slate",
    name: "Slate",
    gradient: "linear-gradient(180deg, #d9dee8 0%, #c2cad9 55%, #aab5ca 100%)",
  },
];

interface Tab {
  id: number;
  title: string;
  active: boolean;
}

function App() {
  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [aiActiveTab, setAiActiveTab] = useState<"chat" | "notes" | "pdf">(
    "chat",
  );
  const [aiInput, setAiInput] = useState("");

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

  // قفل البانل لما تدوس برّاها أو تدوس Escape
  useEffect(() => {
    if (!customizeOpen) return;

    function onMouseDown(e: globalThis.MouseEvent) {
      if (
        customizeRef.current &&
        !customizeRef.current.contains(e.target as Node)
      ) {
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

  const [tabs, setTabs] = useState<Tab[]>([
    { id: 1, title: "New Tab", active: true },
  ]);

  function handleAddTab() {
    const newId = Date.now();
    const updatedTabs = tabs.map((t) => ({ ...t, active: false }));
    setTabs([...updatedTabs, { id: newId, title: "New Tab", active: true }]);
  }

  function handleSelectTab(id: number) {
    setTabs(tabs.map((t) => ({ ...t, active: t.id === id })));
  }

  function handleCloseTab(e: MouseEvent, id: number) {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const filtered = tabs.filter((t) => t.id !== id);
    const hasActive = filtered.some((t) => t.active);

    setTabs(
      hasActive
        ? filtered
        : filtered.map((t, i) => ({ ...t, active: i === filtered.length - 1 })),
    );
  }

  function getSearchUrl(text: string): string {
    const value = text.trim();
    if (!value) return "";
    const isUrl =
      /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(
        value,
      );
    if (isUrl) {
      if (/^https?:\/\//i.test(value)) return value;
      return `https://${value}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  }

  function handleMainSearch() {
    const url = getSearchUrl(query);
    if (url) window.location.assign(url);
  }

  function handleAddressSearch() {
    const url = getSearchUrl(addressQuery);
    if (url) window.location.assign(url);
  }

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
        <div className="tabs-container">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item ${tab.active ? "active" : ""}`}
              onClick={() => handleSelectTab(tab.id)}
            >
              <i className="fa-solid fa-wand-magic-sparkles tab-icon"></i>
              <span className="tab-title">{tab.title}</span>
              <button
                className="close-tab-btn"
                onClick={(e) => handleCloseTab(e, tab.id)}
                title="Close Tab"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
          <button
            className="add-tab-btn"
            onClick={handleAddTab}
            title="New Tab"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="navigation-bar">
        <div className="nav-arrows">
          <button className="nav-arrow-btn" title="Back">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <button className="nav-arrow-btn" title="Forward">
            <i className="fa-solid fa-arrow-right"></i>
          </button>
          <button className="nav-arrow-btn" title="Reload">
            <i className="fa-solid fa-rotate-right"></i>
          </button>
        </div>

        <form
          className="address-bar-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleAddressSearch();
          }}
        >
          <i className="fa-solid fa-lock address-lock"></i>
          <input
            type="text"
            className="address-input"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Search or enter address"
          />
          <button type="button" className="address-ai-btn" title="Ask AI">
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

      {/* Browser Body (بدون sidebar على اليسار) */}
      <div className="browser-body">
        {/* Main Content Area */}
        <main className="main-content">
          <div className="landscape-bg"></div>

          <div className="greeting-section">
            <h1>
              Good morning <span className="sparkle-symbol">✦</span>
            </h1>
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
            <button
              type="submit"
              className="icon-button submit-btn"
              title="Search"
            >
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>

          {/* Shortcuts Grid */}
          <div className="shortcuts-grid">
            <a href="https://youtube.com" className="shortcut-item">
              <div className="shortcut-icon icon-youtube">
                <i className="fa-brands fa-youtube"></i>
              </div>
              <span>YouTube</span>
            </a>
            <a href="https://github.com" className="shortcut-item">
              <div className="shortcut-icon icon-github">
                <i className="fa-brands fa-github"></i>
              </div>
              <span>GitHub</span>
            </a>
            <a href="https://google.com" className="shortcut-item">
              <div className="shortcut-icon icon-google">
                <i className="fa-brands fa-google"></i>
              </div>
              <span>Google</span>
            </a>
            <a href="https://notion.so" className="shortcut-item">
              <div className="shortcut-icon icon-notion">
                <span className="notion-letter">N</span>
              </div>
              <span>Notion</span>
            </a>
            <div className="shortcut-item">
              <div className="shortcut-icon icon-add">
                <i className="fa-solid fa-plus"></i>
              </div>
              <span>Add</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-icon icon-more">
                <i className="fa-solid fa-ellipsis"></i>
              </div>
              <span>More</span>
            </div>
          </div>

          {/* Continue Section */}
          <div className="continue-section">
            <div className="continue-header">
              <span>Continue where you left off</span>
              <span className="view-all">View all</span>
            </div>
            <div className="continue-cards">
              <div className="continue-card">
                <div className="card-icon icon-github-sm">
                  <i className="fa-brands fa-github"></i>
                </div>
                <div>
                  <div className="card-title">Pull request #482</div>
                  <div className="card-sub">GitHub · Yesterday</div>
                </div>
              </div>
              <div className="continue-card">
                <div className="card-icon icon-youtube-sm">
                  <i className="fa-brands fa-youtube"></i>
                </div>
                <div>
                  <div className="card-title">Lofi focus mix</div>
                  <div className="card-sub">YouTube · 3 days ago</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bar">
            <div className="footer-right">
              <div className="location-pill">
                <i className="fa-solid fa-location-dot"></i> Lake Como, Italy
              </div>

              <div className="customize-wrap" ref={customizeRef}>
                <button
                  className="customize-btn"
                  onClick={() => setCustomizeOpen((o) => !o)}
                  aria-expanded={customizeOpen}
                >
                  <i className="fa-solid fa-sliders"></i> Customize
                </button>

                {customizeOpen && (
                  <div
                    className="customize-panel"
                    role="dialog"
                    aria-label="Customize"
                  >
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
                        <i className="fa-solid fa-rotate-left"></i> Reset to
                        default
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right AI Assistant Sidebar */}
        <aside className="ai-sidebar">
          <div className="ai-header">
            <div className="ai-title">
              <i
                className="fa-solid fa-wand-magic-sparkles"
                style={{ color: "#7c3aed" }}
              ></i>{" "}
              AI Assistant
            </div>
            <div className="ai-header-controls">
              <button className="ai-ctrl-btn">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </button>
              <button className="ai-ctrl-btn">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <div className="ai-tabs">
            <button
              className={`ai-tab ${aiActiveTab === "chat" ? "active" : ""}`}
              onClick={() => setAiActiveTab("chat")}
            >
              Chat
            </button>
            <button
              className={`ai-tab ${aiActiveTab === "notes" ? "active" : ""}`}
              onClick={() => setAiActiveTab("notes")}
            >
              Notes
            </button>
            <button
              className={`ai-tab ${aiActiveTab === "pdf" ? "active" : ""}`}
              onClick={() => setAiActiveTab("pdf")}
            >
              PDF
            </button>
          </div>

          <div className="ai-content-body">
            <div className="ai-welcome-box">
              <div className="ai-sparkle-icon">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <h3>How can I help you today?</h3>
              <p>
                Ask a question, get information, write, summarize, or work with
                your PDFs and notes.
              </p>
            </div>

            <div className="ai-suggestions">
              <button className="ai-suggestion-chip">
                <i className="fa-regular fa-file-lines"></i> Summarize this page
              </button>
              <button className="ai-suggestion-chip">
                <i className="fa-solid fa-pen"></i> Help me write something
              </button>
              <button className="ai-suggestion-chip">
                <i className="fa-regular fa-lightbulb"></i> Explain this topic
              </button>
              <button className="ai-suggestion-chip">
                <i className="fa-solid fa-globe"></i> Find information online
              </button>
            </div>
          </div>

          <div className="ai-input-area">
            <input
              type="text"
              placeholder="Ask a question..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
            />
            <div className="ai-input-actions">
              <div className="ai-tools-left">
                <button className="ai-tool-btn">
                  <i className="fa-solid fa-paperclip"></i>
                </button>
                <button className="ai-tool-btn pill">
                  ✦ Auto{" "}
                  <i
                    className="fa-solid fa-chevron-down"
                    style={{ fontSize: "9px" }}
                  ></i>
                </button>
              </div>
              <button className="ai-send-btn">
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
