import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "./markdown";
import "./AIChat.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  /** Citations returned by the AI (for assistant messages). */
  citations?: { number: number; title: string; url: string }[];
  /** True when the typing animation is complete. */
  complete?: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  activeUrl?: string;
  activeTitle?: string;
  /** Function to extract text content from the current webview.
   *  Returns a Promise<string> of the page's visible text. */
  getPageContent?: () => Promise<string>;
}

/** The backend API URL. Change the port if your backend runs elsewhere. */
const API_URL = "http://localhost:8000";

export function AIChat({ isOpen, onClose, onOpen, activeUrl, activeTitle, getPageContent }: AIChatProps) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const eyeLeftRef = useRef<HTMLSpanElement>(null);
  const eyeRightRef = useRef<HTMLSpanElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const isResizing = useRef(false);

  // 3D tracking of mouse cursor on the robot head and eyes
  useEffect(() => {
    if (isOpen) return;

    const track = (x: number, y: number) => {
      const fab = fabRef.current;
      const head = headRef.current;
      if (!fab || !head) return;

      const rect = fab.getBoundingClientRect();
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const ux = dx / distance;
      const uy = dy / distance;
      const amount = Math.min(1, distance / 320);

      head.style.transform = `perspective(200px) rotateY(${ux * amount * 24}deg) rotateX(${-uy * amount * 20}deg)`;
      const eyeOffset = `${ux * 3.5}px, ${uy * 2.8}px`;
      if (eyeLeftRef.current) eyeLeftRef.current.style.transform = `translate(${eyeOffset})`;
      if (eyeRightRef.current) eyeRightRef.current.style.transform = `translate(${eyeOffset})`;
    };

    const onMouseMove = (e: MouseEvent) => track(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) track(t.clientX, t.clientY);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Resize handler: when the user drags the resize handle, adjust the
  // sidebar width. The handle is on the LEFT edge of the sidebar, so
  // dragging left = wider, dragging right = narrower.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // Width = distance from mouse to the right edge of the window
      const newWidth = window.innerWidth - e.clientX;
      // Clamp between 280px and 600px
      setSidebarWidth(Math.max(280, Math.min(600, newWidth)));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isOpen]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  /**
   * Send a message to the backend AI API and display the response.
   *
   * The backend at http://localhost:8000/chat handles two modes:
   * 1. Page chat: if the user is on a page, extract its content from the
   *    webview and send it to the backend. The AI answers based on the
   *    page's actual content (what the user sees).
   * 2. Web search: if no page is open, the AI searches the web (Wikipedia)
   *    and answers with citations.
   */
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // If the user is on a page, extract its text content from the webview.
    // This is more reliable than having the backend re-fetch the page
    // (many sites block server-side requests).
    let pageContent: string | null = null;
    if (activeUrl && getPageContent) {
      try {
        const raw = await getPageContent();
        console.log("[AIChat] getPageContent returned:", raw ? `${raw.length} chars` : "empty", raw?.substring(0, 100));
        if (raw && raw.trim().length > 50) {
          pageContent = raw.length > 8000 ? raw.substring(0, 8000) : raw;
        } else {
          console.log("[AIChat] page content too short or empty, will use web search mode");
        }
      } catch (err) {
        console.error("[AIChat] getPageContent failed:", err);
        pageContent = null;
      }
    } else {
      console.log("[AIChat] no activeUrl or no getPageContent — using web search mode");
    }

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          page_url: activeUrl || null,
          page_title: activeTitle || null,
          page_content: pageContent,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error ${response.status}`);
      }

      const data = await response.json();

      const fullText = data.answer || "I couldn't find an answer to that.";
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        text: fullText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: data.citations || [],
      };

      // Add the message with empty text first, then animate it in
      // character by character for a typing effect.
      setMessages((prev) => [...prev, { ...botMsg, text: "", complete: false }]);
      setIsTyping(false);

      // Type out the answer gradually
      const charsPerFrame = Math.max(1, Math.ceil(fullText.length / 150));
      let charIndex = 0;
      const typeInterval = setInterval(() => {
        charIndex = Math.min(charIndex + charsPerFrame, fullText.length);
        const partial = fullText.substring(0, charIndex);
        const isComplete = charIndex >= fullText.length;
        setMessages((prev) =>
          prev.map((m) => (m.id === botMsg.id ? { ...m, text: partial, complete: isComplete } : m)),
        );
        if (isComplete) {
          clearInterval(typeInterval);
        }
      }, 16); // ~60fps
    } catch (err) {
      const errMsg =
        err instanceof TypeError && err.message.includes("fetch")
          ? "Cannot connect to the AI backend. Make sure it's running:\n\n    cd backend/api\n    uvicorn main:app --port 8000"
          : `Error: ${err instanceof Error ? err.message : String(err)}`;

      const botMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: "assistant",
        text: errMsg,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Robot Mascot Button */}
      {!isOpen && (
        <button
          ref={fabRef}
          className="ai-mascot-fab"
          onClick={onOpen}
          type="button"
          aria-label="Open Axiom AI Copilot"
          title="Open Axiom AI Copilot"
        >
          {/* Robot mascot figure */}
          <div className="ai-mascot-figure">
            {/* Antenna with beacon glow */}
            <div className="ai-bot-antenna">
              <span className="antenna-stem"></span>
              <span className="antenna-beacon"></span>
            </div>

            {/* Robot Head */}
            <div className="ai-bot-head" ref={headRef}>
              {/* Side ear pods */}
              <span className="bot-ear bot-ear-left"></span>
              <span className="bot-ear bot-ear-right"></span>

              {/* Visor Screen */}
              <div className="bot-visor">
                <div className="visor-reflection"></div>
                {/* Expressive glowing eyes */}
                <div className="bot-eyes-wrapper">
                  <span className="bot-eye bot-eye-left" ref={eyeLeftRef}>
                    <i className="eye-pupil"></i>
                  </span>
                  <span className="bot-eye bot-eye-right" ref={eyeRightRef}>
                    <i className="eye-pupil"></i>
                  </span>
                </div>
                {/* Cute smile LED */}
                <div className="bot-mouth"></div>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* AI Sidebar Panel */}
      <aside
        className={`ai-sidebar ${isOpen ? "" : "closed"}`}
        aria-hidden={!isOpen}
        style={isOpen ? { width: `${sidebarWidth}px` } : undefined}
      >
        {/* Resize handle — drag to adjust sidebar width */}
        {isOpen && (
          <div
            className="ai-sidebar-resize-handle"
            onMouseDown={startResize}
            title="Drag to resize"
          />
        )}
        <div className="ai-sidebar-inner">
          {/* Header */}
          <div className="ai-header">
            <div className="ai-title-wrap">
              <div className="ai-title-meta">
                <div className="ai-title">Axiom AI Copilot</div>
                <div className="ai-subtitle">
                  {activeUrl ? "Page context active" : "Web search mode"}
                </div>
              </div>
            </div>

            <div className="ai-header-controls">
              {messages.length > 0 && (
                <button
                  className="ai-ctrl-btn"
                  title="Clear chat"
                  type="button"
                  onClick={() => setMessages([])}
                >
                  <i className="fa-solid fa-rotate-left"></i>
                </button>
              )}
              <button
                className="ai-ctrl-btn"
                title="Close AI Assistant"
                type="button"
                onClick={onClose}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="ai-content-body">
            {messages.length === 0 ? (
              <div className="ai-welcome-box">
                <div className="ai-sparkle-icon">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <h3>How can I assist your browsing?</h3>
                <p>
                  {activeUrl
                    ? "Ask me anything about this page, or search the web."
                    : "Ask me anything — I'll search the web and give you a cited answer."}
                </p>

                {activeTitle && (
                  <div className="ai-active-tab-card">
                    <i className="fa-solid fa-compass"></i>
                    <div>
                      <span>Current Page:</span>
                      <strong>{activeTitle}</strong>
                    </div>
                  </div>
                )}

                <div className="ai-suggestions">
                  {activeUrl && (
                    <button
                      className="ai-suggestion-chip"
                      onClick={() => handleSendMessage("Summarize this page for me")}
                    >
                      <i className="fa-regular fa-file-lines"></i> Summarize this page
                    </button>
                  )}
                  <button
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage("What is the capital of France?")}
                  >
                    <i className="fa-solid fa-globe"></i> Search the web
                  </button>
                  {activeUrl && (
                    <button
                      className="ai-suggestion-chip"
                      onClick={() => handleSendMessage("Explain the key concepts on this page")}
                    >
                      <i className="fa-regular fa-lightbulb"></i> Explain this page
                    </button>
                  )}
                  <button
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage("What is Python programming language?")}
                  >
                    <i className="fa-solid fa-code"></i> Ask about Python
                  </button>
                </div>
              </div>
            ) : (
              <div className="ai-messages-list">
                {messages.map((m) => (
                  <div key={m.id} className={`ai-message-row ${m.role}`}>
                    {m.role === "assistant" && (
                      <div className="ai-bot-avatar-sm">
                        <i className="fa-solid fa-robot"></i>
                      </div>
                    )}
                    <div className="ai-message-bubble">
                      <div className={`ai-message-text ${m.complete ? "complete" : ""}`}>
                        {m.role === "assistant" ? (
                          renderMarkdown(m.text)
                        ) : (
                          m.text
                        )}
                      </div>
                      {/* Show citations for assistant messages that have them */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="ai-citations">
                          <div className="ai-citations-label">Sources:</div>
                          {m.citations.map((c) => (
                            <a
                              key={c.number}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ai-citation-link"
                              title={c.url}
                            >
                              <span className="ai-citation-num">[{c.number}]</span>{" "}
                              {c.title}
                            </a>
                          ))}
                        </div>
                      )}
                      <span className="ai-message-time">{m.time}</span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="ai-message-row assistant">
                    <div className="ai-bot-avatar-sm">
                      <i className="fa-solid fa-robot"></i>
                    </div>
                    <div className="ai-message-bubble ai-typing-bubble">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="ai-input-area">
            <input
              type="text"
              placeholder={
                activeUrl
                  ? "Ask about this page or search the web..."
                  : "Ask anything..."
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendMessage();
                }
              }}
            />
            <div className="ai-input-actions">
              <div className="ai-tools-left">
                <span className="ai-model-pill">
                  {activeUrl ? "📄 Page" : "🌐 Web"}
                </span>
              </div>
              <button
                className={`ai-send-btn ${input.trim() ? "can-send" : ""}`}
                type="button"
                title="Send message"
                onClick={() => void handleSendMessage()}
                disabled={!input.trim() || isTyping}
              >
                <i className="fa-solid fa-arrow-up"></i>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default AIChat;
