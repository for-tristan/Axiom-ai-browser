import React, { useState, useEffect } from "react";
import "./App.css";

interface Tab {
  id: number;
  title: string;
  active: boolean;
}

interface Shortcut {
  name: string;
  url: string;
  icon?: string;
  imgUrl?: string;
  isCustom?: boolean;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface ISpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: unknown) => void;
  onend: () => void;
  start: () => void;
}

interface IWindow extends Window {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

function App() {
  const [mainQuery, setMainQuery] = useState(""); 
  const [addressQuery, setAddressQuery] = useState(""); 
  const [isListening, setIsListening] = useState(false);
  const [aiActiveTab, setAiActiveTab] = useState<"chat" | "notes" | "pdf">("chat");
  const [aiInput, setAiInput] = useState("");

  const [tabs, setTabs] = useState<Tab[]>([
    { id: 1, title: "New Tab", active: true },
  ]);

  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    const saved = localStorage.getItem("browser_shortcuts_v18");
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [
      { name: "YouTube", url: "https://youtube.com", icon: "fa-brands fa-youtube icon-youtube" },
      { name: "GitHub", url: "https://github.com", icon: "fa-brands fa-github icon-github" },
      { name: "Google", url: "https://google.com", icon: "fa-brands fa-google icon-google" },
      { name: "Notion", url: "https://notion.so", icon: "fa-solid fa-n icon-notion" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("browser_shortcuts_v18", JSON.stringify(shortcuts));
  }, [shortcuts]);

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

  function processAndOpenUrl(text: string) {
    const value = text.trim();
    if (!value) return;

    let targetUrl = "";
    let siteName = "";
    let siteImgUrl = "";

    const siteMap: { [key: string]: { name: string; url: string } } = {
      "يوتيوب": { name: "YouTube", url: "https://www.youtube.com" },
      "youtube": { name: "YouTube", url: "https://www.youtube.com" },
      "فيسبوك": { name: "Facebook", url: "https://www.facebook.com" },
      "فيس": { name: "Facebook", url: "https://www.facebook.com" },
      "facebook": { name: "Facebook", url: "https://www.facebook.com" },
      "انستجرام": { name: "Instagram", url: "https://www.instagram.com" },
      "انستا": { name: "Instagram", url: "https://www.instagram.com" },
      "instagram": { name: "Instagram", url: "https://www.instagram.com" },
      "جوجل": { name: "Google", url: "https://www.google.com" },
      "google": { name: "Google", url: "https://www.google.com" },
      "جيت هاب": { name: "GitHub", url: "https://github.com" },
      "github": { name: "GitHub", url: "https://github.com" },
      "نوتشن": { name: "Notion", url: "https://www.notion.so" },
      "notion": { name: "Notion", url: "https://www.notion.so" },
    };

    const lowerVal = value.toLowerCase();
    const isUrl = /^(https?:\/\/)?(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i.test(value);

    if (isUrl) {
      targetUrl = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    } else if (siteMap[lowerVal]) {
      targetUrl = siteMap[lowerVal].url;
      siteName = siteMap[lowerVal].name;
    } else if (!/\s/.test(value) && !/[\u0600-\u06FF]/.test(value)) {
      const cleanName = lowerVal.replace(/\s+/g, "");
      targetUrl = `https://www.${cleanName}.com`;
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
      siteName = value.length > 12 ? value.substring(0, 10) + "..." : value;
    }

    try {
      const urlObj = new URL(targetUrl);
      if (!siteName) {
        let hostname = urlObj.hostname.replace("www.", "");
        hostname = hostname.replace(/\.(com|net|org|edu|gov|io|co).*$/i, "");
        siteName = hostname.charAt(0).toUpperCase() + hostname.slice(1);
      }
      siteImgUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
    } catch {
      siteName = value;
      siteImgUrl = `https://www.google.com/s2/favicons?domain=google.com&sz=128`;
    }

    setAddressQuery(targetUrl);

    if (!targetUrl.includes("google.com/search?q=")) {
      setShortcuts((prev) => {
        const exists = prev.some((s) => s.url.toLowerCase() === targetUrl.toLowerCase());
        if (!exists) {
          return [
            ...prev,
            {
              name: siteName,
              url: targetUrl,
              imgUrl: siteImgUrl,
              isCustom: true,
            },
          ];
        }
        return prev;
      });
    }

    window.open(targetUrl, "_blank");
  }

  function handleVoiceSearch() {
    const customWindow = window as unknown as IWindow;
    const SpeechRecognitionAPI = customWindow.SpeechRecognition || customWindow.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      alert("متصفحك لا يدعم خاصية البحث الصوتي.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "ar-SA";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      const cleanedText = transcript.trim();
      if (cleanedText) {
        // تحديث النص في شريط البحث السفلي فوراً أثناء الكلام
        setMainQuery(cleanedText);
        
        // عند اكتمال الجملة والوصول للنتيجة النهائية، يتم تنفيذ البحث والانتقال أوتوماتيكياً
        if (event.results[event.results.length - 1].isFinal) {
          setIsListening(false);
          processAndOpenUrl(cleanedText);
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }

  function handleMainSearch() {
    processAndOpenUrl(mainQuery);
  }

  function handleAddressSearch() {
    processAndOpenUrl(addressQuery);
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
          <button className="nav-arrow-btn" title="Back" onClick={() => window.history.back()}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <button className="nav-arrow-btn" title="Forward" onClick={() => window.history.forward()}>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
          <button className="nav-arrow-btn" title="Reload" onClick={() => window.location.reload()}>
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

      {/* Browser Body */}
      <div className="browser-body">
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
              value={mainQuery}
              onChange={(e) => setMainQuery(e.target.value)}
              placeholder={isListening ? "Listening... Speak now" : "Ask anything or search the web..."}
            />
            <button
              type="button"
              className={`icon-button ${isListening ? "listening-active" : ""}`}
              title="Voice Search"
              onClick={handleVoiceSearch}
              style={{ color: isListening ? "#ef4444" : "inherit" }}
            >
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
            {shortcuts.map((shortcut, idx) => (
              <a key={idx} href={shortcut.url} className="shortcut-item" target="_blank" rel="noopener noreferrer">
                <div className="shortcut-icon">
                  {shortcut.imgUrl ? (
                    <img src={shortcut.imgUrl} alt={shortcut.name} style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                  ) : (
                    <i className={shortcut.icon}></i>
                  )}
                </div>
                <span>{shortcut.name}</span>
              </a>
            ))}
            <div className="shortcut-item" onClick={handleAddTab}>
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
              <div className="continue-card" onClick={() => window.open("https://github.com", "_blank")}>
                <div className="card-icon" style={{ color: "#181717" }}>
                  <i className="fa-brands fa-github"></i>
                </div>
                <div>
                  <div className="card-title">GitHub Repository</div>
                  <div className="card-sub">Quick Access</div>
                </div>
              </div>
              <div className="continue-card" onClick={() => window.open("https://youtube.com", "_blank")}>
                <div className="card-icon" style={{ color: "#ff0000" }}>
                  <i className="fa-brands fa-youtube"></i>
                </div>
                <div>
                  <div className="card-title">YouTube Focus</div>
                  <div className="card-sub">Quick Access</div>
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
                <i className="fa-solid fa-pen-nib"></i> Help me write something
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