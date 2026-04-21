"use client";
// components/CustomerHelpWidget.tsx
// Floating AI Help Assistant for the customer-facing booking app.
// Uses /api/customer-help — completely separate from the admin help assistant.

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  cached?: boolean;
}

const HIDDEN_KEY = "katoomy:customerHelpHidden";

export default function CustomerHelpWidget() {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! 👋 I'm here to help you with booking, your appointments, loyalty points, and more. What can I help you with?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore hidden state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHidden(localStorage.getItem(HIDDEN_KEY) === "true");
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function hideWidget() {
    setOpen(false);
    setHidden(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(HIDDEN_KEY, "true");
    }
  }

  function showWidget() {
    setHidden(false);
    setOpen(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem(HIDDEN_KEY);
    }
  }

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/customer-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "Sorry, I couldn't find an answer. Please contact the business directly.",
          cached: data.cached,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (hidden) {
    return (
      <button
        onClick={showWidget}
        className="fixed bottom-4 right-4 z-50 text-xs text-white/60 hover:text-white/90 transition underline"
        aria-label="Show help assistant"
      >
        Need help?
      </button>
    );
  }

  return (
    <>
      {/* Floating Help Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-lg transition hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          aria-label="Open help assistant"
          title="Help"
        >
          ?
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-purple-100"
          style={{ maxHeight: "min(520px, calc(100vh - 2rem))" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                ?
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Help</p>
                <p className="text-xs text-purple-200 mt-0.5">Ask me anything</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Minimize */}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white"
                title="Minimize"
                aria-label="Minimize help panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              {/* Hide */}
              <button
                onClick={hideWidget}
                className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white"
                title="Hide help"
                aria-label="Hide help widget"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                  }`}
                  style={
                    msg.role === "user"
                      ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }
                      : {}
                  }
                >
                  {msg.content}
                  {msg.cached && msg.role === "assistant" && (
                    <span className="block mt-1 text-xs text-gray-400">⚡ Instant answer</span>
                  )}
                </div>
              </div>
            ))}
            {/* Loading dots */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 bg-gray-50"
              maxLength={500}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-9 h-9 rounded-xl text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
