import { useState } from "react";
import "./App.css";

interface Tab {
  id: number;
  title: string;
  active: boolean;
}

function App() {
  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [aiActiveTab, setAiActiveTab] = useState<"chat" | "notes" | "pdf">("chat");
  const [aiInput, setAiInput] = useState("");

  // بدايةً تبويب واحد فقط
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
    const isUrl = /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(value);
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
    <div className="browser-window">
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
          <button className="add-tab-btn" onClick={handleAddTab} title="New Tab">
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
            <div className="trackers-badge">
              <i className="fa-regular fa-shield"></i> 14 trackers blocked
            </div>
            <div className="footer-right">
              <div className="location-pill">
                <i className="fa-solid fa-location-dot"></i> Lake Como, Italy
              </div>
              <button className="customize-btn">
                <i className="fa-solid fa-sliders"></i> Customize
              </button>
            </div>
          </div>
        </main>

        {/* Right AI Assistant Sidebar */}
        <aside className="ai-sidebar">
          <div className="ai-header">
            <div className="ai-title">
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: "#7c3aed" }}></i> AI Assistant
            </div>
            <div className="ai-header-controls">
              <button className="ai-ctrl-btn"><i className="fa-solid fa-clock-rotate-left"></i></button>
              <button className="ai-ctrl-btn"><i className="fa-solid fa-xmark"></i></button>
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
              <p>Ask a question, get information, write, summarize, or work with your PDFs and notes.</p>
            </div>

            <div className="ai-suggestions">
              <button className="ai-suggestion-chip">
                <i className="fa-regular fa-file-lines"></i> Summarize this page
              </button>
              <button className="ai-suggestion-chip">
                <i className="fa-solid fa-pen-thin"></i> Help me write something
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
                <button className="ai-tool-btn"><i className="fa-solid fa-paperclip"></i></button>
                <button className="ai-tool-btn pill">✦ Auto <i className="fa-solid fa-chevron-down" style={{ fontSize: "9px" }}></i></button>
              </div>
              <button className="ai-send-btn"><i className="fa-solid fa-arrow-right"></i></button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;