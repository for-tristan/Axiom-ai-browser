import { useState } from "react";
import "./AIChat.css";

type AssistantTab = "chat" | "notes" | "pdf";

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

function AIChat({ isOpen, onClose, onOpen }: AIChatProps) {
  const [activeTab, setActiveTab] = useState<AssistantTab>("chat");
  const [input, setInput] = useState("");

  return (
    <>
      {!isOpen && (
        <button
          className="ai-reopen-btn"
          onClick={onOpen}
          title="Open AI Assistant"
        >
          <i className="fa-solid fa-wand-magic-sparkles"></i>
          <span>AI</span>
        </button>
      )}

      <aside
        className={`ai-sidebar ${isOpen ? "" : "closed"}`}
        aria-hidden={!isOpen}
      >
        <div className="ai-sidebar-inner">
          <div className="ai-header">
            <div className="ai-title">
              <i className="fa-solid fa-wand-magic-sparkles"></i> AI Assistant
            </div>
            <div className="ai-header-controls">
              <button className="ai-ctrl-btn" title="History" type="button">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </button>
              <button
                className="ai-ctrl-btn"
                title="Close"
                type="button"
                onClick={onClose}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <div className="ai-tabs">
            {(["chat", "notes", "pdf"] as const).map((tab) => (
              <button
                key={tab}
                className={`ai-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "pdf" ? "PDF" : tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
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
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <div className="ai-input-actions">
              <div className="ai-tools-left">
                <button className="ai-tool-btn" type="button" title="Attach file">
                  <i className="fa-solid fa-paperclip"></i>
                </button>
                <button className="ai-tool-btn pill" type="button">
                  ✦ Auto <i className="fa-solid fa-chevron-down"></i>
                </button>
              </div>
              <button className="ai-send-btn" type="button" title="Send">
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default AIChat;
