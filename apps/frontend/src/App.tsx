import { useState } from "react";
import "./App.css";

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

function App() {
  const [query, setQuery] = useState("");
  const [addressQuery, setAddressQuery] = useState(""); // حالة شريط العنوان العلوي
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("");

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

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setStatus("Could not start voice search.");
    }
  }

  return (
    <div className="browser-window">
      <header className="top-tab-bar">
        <div className="tabs-container">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item ${tab.active ? "active" : ""}`}
              onClick={() => handleSelectTab(tab.id)}
            >
              <i className="fa-solid fa-globe tab-icon"></i>
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

        <div className="window-controls">
          <button className="win-control-btn">
            <i className="fa-solid fa-window-minimize"></i>
          </button>
          <button className="win-control-btn">
            <i className="fa-regular fa-window-maximize"></i>
          </button>
          <button className="win-control-btn close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

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
            placeholder="Search or enter address..."
            aria-label="Search or enter address"
          />
        </form>

        <div className="browser-tools">
          <button className="tool-btn" title="Bookmarks">
            <i className="fa-regular fa-star"></i>
          </button>
          <button className="tool-btn" title="Extensions">
            <i className="fa-solid fa-puzzle-piece"></i>
          </button>
          <button className="tool-btn profile" title="Profile">
            <i className="fa-regular fa-user"></i>
          </button>
        </div>
      </div>

      <div className="browser-body">
        <aside className="sidebar">
          <nav className="sidebar-menu">
            <div className="nav-item active">
              <i className="fa-solid fa-house nav-icon"></i> <span>Home</span>
            </div>
            <div className="nav-item">
              <i className="fa-solid fa-clock-rotate-left nav-icon"></i>{" "}
              <span>History</span>
            </div>
            <div className="nav-item">
              <i className="fa-solid fa-bookmark nav-icon"></i>{" "}
              <span>Bookmarks</span>
            </div>
            <div className="nav-item">
              <i className="fa-solid fa-download nav-icon"></i>{" "}
              <span>Downloads</span>
            </div>
            <div className="nav-item">
              <i className="fa-solid fa-gear nav-icon"></i>{" "}
              <span>Settings</span>
            </div>
          </nav>

          <div className="weather-card">
            <i className="fa-solid fa-cloud-sun weather-icon"></i>
            <div>
              <div className="weather-temp">24°C</div>
              <div className="weather-location">Cairo, Egypt</div>
            </div>
          </div>
        </aside>

        <main className="main-content">
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

            <button
              type="submit"
              className="icon-button submit-btn"
              title="Search"
            >
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

          {status && <p className="voice-status">{status}</p>}

          <div className="ai-badge">
            <i className="fa-solid fa-wand-magic-sparkles"></i> AI powered
            search <i className="fa-solid fa-arrow-right"></i>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
