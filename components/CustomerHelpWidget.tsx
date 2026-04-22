"use client";
// components/CustomerHelpWidget.tsx
// Floating AI Help Assistant — customer-facing booking app.
// Uses /api/customer-help (separate from admin help).
//
// Features:
//  1. Drag-to-move  — user can reposition the button anywhere on screen.
//  2. Auto-hide     — fades out on scroll / input focus / select open;
//                     reappears after 2.5 s of inactivity.
//  3. Smart position — on mount (and after drag ends) checks for nearby
//                     clickable elements and shifts to avoid overlap.

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  cached?: boolean;
}

const HIDDEN_KEY  = "katoomy:customerHelpHidden";
const POS_KEY     = "katoomy:customerHelpPos";
const BTN_SIZE    = 48; // px — matches w-12 h-12
const EDGE_MARGIN = 16;

// ─── helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function smartPosition(preferredX: number, preferredY: number): { x: number; y: number } {
  if (typeof document === "undefined") return { x: preferredX, y: preferredY };

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates = [
    { x: preferredX, y: preferredY },
    { x: EDGE_MARGIN, y: vh - BTN_SIZE - EDGE_MARGIN },
    { x: vw - BTN_SIZE - EDGE_MARGIN, y: vh - BTN_SIZE - EDGE_MARGIN - 80 },
    { x: EDGE_MARGIN, y: vh - BTN_SIZE - EDGE_MARGIN - 80 },
  ];

  const interactiveSelectors =
    'button, a, input, select, textarea, [role="button"], [role="link"], [tabindex]';

  for (const pos of candidates) {
    const cx = pos.x + BTN_SIZE / 2;
    const cy = pos.y + BTN_SIZE / 2;
    const elements = document.elementsFromPoint(cx, cy);
    const blocked = elements.some(
      (el) =>
        el !== document.documentElement &&
        el !== document.body &&
        el.matches(interactiveSelectors),
    );
    if (!blocked) return pos;
  }

  return { x: preferredX, y: preferredY };
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CustomerHelpWidget() {
  const [hidden,  setHidden]  = useState(false);
  const [open,    setOpen]    = useState(false);
  const [pos,     setPos]     = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! 👋 I'm here to help you with booking, your appointments, loyalty points, and more. What can I help you with?",
    },
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const btnRef     = useRef<HTMLButtonElement>(null);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ── initialise ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (localStorage.getItem(HIDDEN_KEY) === "true") {
      setHidden(true);
    }

    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      try {
        setPos(JSON.parse(saved) as { x: number; y: number });
        return;
      } catch { /* ignore */ }
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos(smartPosition(vw - BTN_SIZE - EDGE_MARGIN, vh - BTN_SIZE - EDGE_MARGIN));
  }, []);

  // ── auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── focus input when panel opens ─────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── auto-hide ────────────────────────────────────────────────────────────
  const scheduleReappear = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(true), 2500);
  }, []);

  const triggerHide = useCallback(() => {
    if (open) return;
    setVisible(false);
    scheduleReappear();
  }, [open, scheduleReappear]);

  useEffect(() => {
    const onScroll  = () => triggerHide();
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        target !== inputRef.current &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        triggerHide();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest("select, [role='listbox'], [role='menu']")) {
        triggerHide();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mousedown", onMouseDown);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [triggerHide]);

  // ── drag ─────────────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (open) return;
      isDragging.current = false;
      if (pos === null) return;

      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

      const onMove = (ev: PointerEvent) => {
        isDragging.current = true;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setPos({
          x: clamp(ev.clientX - dragOffset.current.x, EDGE_MARGIN, vw - BTN_SIZE - EDGE_MARGIN),
          y: clamp(ev.clientY - dragOffset.current.y, EDGE_MARGIN, vh - BTN_SIZE - EDGE_MARGIN),
        });
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (isDragging.current) {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const nx = clamp(ev.clientX - dragOffset.current.x, EDGE_MARGIN, vw - BTN_SIZE - EDGE_MARGIN);
          const ny = clamp(ev.clientY - dragOffset.current.y, EDGE_MARGIN, vh - BTN_SIZE - EDGE_MARGIN);
          const snapped = smartPosition(nx, ny);
          setPos(snapped);
          localStorage.setItem(POS_KEY, JSON.stringify(snapped));
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [open, pos],
  );

  // ── widget actions ───────────────────────────────────────────────────────
  function hideWidget() {
    setOpen(false);
    setHidden(true);
    localStorage.setItem(HIDDEN_KEY, "true");
  }

  function showWidget() {
    setHidden(false);
    setOpen(true);
    localStorage.removeItem(HIDDEN_KEY);
  }

  const handleBtnClick = useCallback(() => {
    if (!isDragging.current) setOpen(true);
  }, []);

  // ── send message ─────────────────────────────────────────────────────────
  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);

    try {
      const res  = await fetch("/api/customer-help", {
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
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ── render: permanently hidden ───────────────────────────────────────────
  if (hidden) {
    return (
      <button
        onClick={showWidget}
        className="fixed bottom-4 right-4 z-50 text-xs text-gray-400 hover:text-gray-600 transition underline"
        aria-label="Show help assistant"
      >
        Need help?
      </button>
    );
  }

  if (pos === null) return null;

  const btnStyle: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top:  pos.y,
    zIndex: 50,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 0.4s ease",
    cursor: "grab",
    touchAction: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  };

  // Panel dimensions
  const PANEL_WIDTH  = 384;
  const PANEL_HEIGHT = 520;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Horizontal: keep panel inside viewport
  const panelLeft = Math.max(
    EDGE_MARGIN,
    Math.min(pos.x, vw - Math.min(PANEL_WIDTH, vw - EDGE_MARGIN * 2) - EDGE_MARGIN),
  );

  // Vertical: open upward from button if near bottom, downward if near top
  const spaceBelow = vh - pos.y - BTN_SIZE;
  const panelH     = Math.min(PANEL_HEIGHT, vh - EDGE_MARGIN * 2);
  const panelTop   = spaceBelow >= panelH + EDGE_MARGIN
    ? pos.y + BTN_SIZE + 8
    : Math.max(EDGE_MARGIN, pos.y - panelH - 8);

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: panelLeft,
    top:  panelTop,
    zIndex: 50,
    maxHeight: `${panelH}px`,
    width: `min(${PANEL_WIDTH}px, calc(100vw - ${EDGE_MARGIN * 2}px))`,
  };

  return (
    <>
      {/* Floating Help Button */}
      {!open && (
        <button
          ref={btnRef}
          style={btnStyle}
          onPointerDown={onPointerDown}
          onClick={handleBtnClick}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-lg select-none active:scale-95"
          aria-label="Open help assistant"
          title="Help"
        >
          ?
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          style={panelStyle}
          className="flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-purple-100 bg-white"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">?</div>
              <div>
                <p className="text-sm font-semibold leading-none">Help</p>
                <p className="text-xs text-purple-200 mt-0.5">Ask me anything</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white" title="Minimize" aria-label="Minimize">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button onClick={hideWidget} className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white" title="Hide help" aria-label="Hide help">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                  }`}
                  style={msg.role === "user" ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)" } : {}}
                >
                  {msg.content}
                  {msg.cached && msg.role === "assistant" && (
                    <span className="block mt-1 text-xs text-gray-400">⚡ Instant answer</span>
                  )}
                </div>
              </div>
            ))}
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
