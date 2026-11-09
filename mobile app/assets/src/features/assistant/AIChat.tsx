import { useEffect, useRef, useState } from "react";
import "./AIChat.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  activeUrl?: string;
  activeTitle?: string;
}

/** Safely extract a hostname; returns "" for invalid URLs (avoids throwing
 *  inside the chat response builder when activeUrl is e.g. "about:blank"). */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function AIChat({ isOpen, onClose, onOpen, activeUrl, activeTitle }: AIChatProps) {
  const fabRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const eyeLeftRef = useRef<HTMLSpanElement>(null);
  const eyeRightRef = useRef<HTMLSpanElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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

  const handleSendMessage = (textToSend?: string) => {
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

    setTimeout(() => {
      let botResponse: string;
      const lower = text.toLowerCase();

      if (lower.includes("summarize") || lower.includes("تلخيص") || lower.includes("summary")) {
        const pageName = activeTitle || (activeUrl ? safeHostname(activeUrl) : "this page");
        botResponse = `📄 **Page Summary (${pageName})**:\n\n• **Core Topic**: Real-time content and navigation information.\n• **Key Takeaways**: High-speed browsing, AI-assisted productivity, and customizable aesthetics.\n• **Next Step**: Would you like me to dive deeper into any specific section or extract key facts for you?`;
      } else if (lower.includes("dark") || lower.includes("theme") || lower.includes("mode") || lower.includes("ثيم") || lower.includes("دارك")) {
        botResponse = `🎨 You can customize the look anytime!\n\nClick the **Settings** (⚙️) icon in the top bar to pick from 8 rich color gradients.`;
      } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("مرحبا") || lower.includes("سلام")) {
        botResponse = `Hello there! I'm your **Axiom AI Browser Copilot** 🤖. I can summarize any page you visit, explain complex topics, find answers, and assist your browsing in real time!`;
      } else {
        botResponse = `I'm analyzing your request: "${text}".\n\nI can assist you with web searches, reading documents, or explaining topics as you browse. Feel free to ask me anything about the active tab or any web page!`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        text: botResponse,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 700);
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
      <aside className={`ai-sidebar ${isOpen ? "" : "closed"}`} aria-hidden={!isOpen}>
        <div className="ai-sidebar-inner">
          {/* Header */}
          <div className="ai-header">
            <div className="ai-title-wrap">
              <div className="ai-title-meta">
                <div className="ai-title">Axiom AI Copilot</div>
                <div className="ai-subtitle">Always here to help</div>
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
                <p>Ask anything, summarize this webpage, analyze data, or draft content.</p>

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
                  <button
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage("Summarize this page for me")}
                  >
                    <i className="fa-regular fa-file-lines"></i> Summarize this page
                  </button>
                  <button
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage("Help me write an email or post")}
                  >
                    <i className="fa-solid fa-pen-nib"></i> Help me write something
                  </button>
                  <button
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage("Explain the key concepts here")}
                  >
                    <i className="fa-regular fa-lightbulb"></i> Explain this topic
                  </button>
                  <button
                    className="ai-suggestion-chip"
                    onClick={() => handleSendMessage("How do I change dark mode and themes?")}
                  >
                    <i className="fa-solid fa-palette"></i> Themes & Colors
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
                      <div className="ai-message-text">{m.text}</div>
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
              placeholder="Ask Axiom AI or summarize page..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="ai-input-actions">
              <div className="ai-tools-left">
                <button className="ai-tool-btn" type="button" title="Attach file or screenshot">
                  <i className="fa-solid fa-paperclip"></i>
                </button>
                <span className="ai-model-pill">
                  ✦ Copilot
                </span>
              </div>
              <button
                className={`ai-send-btn ${input.trim() ? "can-send" : ""}`}
                type="button"
                title="Send message"
                onClick={() => handleSendMessage()}
                disabled={!input.trim()}
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
