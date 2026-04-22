"use client";
// file: components/AiHelpWidget.tsx
// Floating AI Help Assistant widget — admin & staff portals.
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

const HIDDEN_KEY   = "katoomy:helpWidgetHidden";
const POS_KEY      = "katoomy:helpWidgetPos";
const BTN_SIZE     = 56; // px — matches w-14 h-14
const EDGE_MARGIN  = 16; // px from viewport edge

// ─── helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

/** Return the best corner position that avoids overlapping clickable elements. */
function smartPosition(
  preferredX: number,
  preferredY: number,
): { x: number; y: number } {
  if (typeof document === "undefined") return { x: preferredX, y: preferredY };

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Candidate positions: preferred → bottom-left → slightly higher right → higher left
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

  // Fall back to preferred if all candidates are blocked
  return { x: preferredX, y: preferredY };
}

// ─── component ────────────────────────────────────────────────────────────────

export default function AiHelpWidget() {
  const [open,   setOpen]   = useState(false);
  const [hidden, setHidden] = useState(false);

  // Position of the floating button (bottom-left origin → we convert to CSS top/left)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  // Auto-hide opacity state
  const [visible, setVisible] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        'Hi! I\'m your Katoomy Help Assistant. Ask me anything about how to use the app — like "How do I add a service?" or "How do I set up Stripe?"',
    },
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const btnRef      = useRef<HTMLButtonElement>(null);
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging  = useRef(false);
  const dragOffset  = useRef({ x: 0, y: 0 });

  // ── initialise position ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Restore permanently-hidden preference
    if (localStorage.getItem(HIDDEN_KEY) === "true") {
      setHidden(true);
    }

    // Restore last saved position or compute smart default
    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        setPos(parsed);
        return;
      } catch { /* ignore */ }
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const defaultX = vw - BTN_SIZE - EDGE_MARGIN;
    const defaultY = vh - BTN_SIZE - EDGE_MARGIN;
    setPos(smartPosition(defaultX, defaultY));
  }, []);

  // ── auto-scroll chat ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── focus input when panel opens ─────────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // ── auto-hide logic ──────────────────────────────────────────────────────
  const scheduleReappear = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(true), 2500);
  }, []);

  const triggerHide = useCallback(() => {
    if (open) return; // never hide while chat is open
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

  // ── drag logic ───────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (open) return; // don't drag while panel is open
      isDragging.current = false;
      const btn = btnRef.current;
      if (!btn || pos === null) return;

      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };

      const onMove = (ev: PointerEvent) => {
        isDragging.current = true;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const nx = clamp(ev.clientX - dragOffset.current.x, EDGE_MARGIN, vw - BTN_SIZE - EDGE_MARGIN);
        const ny = clamp(ev.clientY - dragOffset.current.y, EDGE_MARGIN, vh - BTN_SIZE - EDGE_MARGIN);
        setPos({ x: nx, y: ny });
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        if (isDragging.current) {
          // Snap to smart position after drag
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
  const hideWidget = useCallback(() => {
    setHidden(true);
    setOpen(false);
    localStorage.setItem(HIDDEN_KEY, "true");
  }, []);

  const showWidget = useCallback(() => {
    setHidden(false);
    localStorage.removeItem(HIDDEN_KEY);
  }, []);

  const handleBtnClick = useCallback(() => {
    if (!isDragging.current) setOpen(true);
  }, []);

  // ── send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res  = await fetch("/api/ai-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.ok && !data.error
            ? data.answer
            : (data.error ?? "Something went wrong. Please try again."),
          cached: data.cached,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Unable to reach the help service. Please check your connection." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── render: permanently hidden ───────────────────────────────────────────
  if (hidden) {
    return (
      <button
        onClick={showWidget}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-blue-600 text-white text-lg font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center opacity-50 hover:opacity-100"
        title="Show Help Assistant"
        aria-label="Show Help Assistant"
      >
        ?
      </button>
    );
  }

  // Don't render until position is calculated (avoids flash at 0,0)
  if (pos === null) return null;

  // Panel dimensions
  const PANEL_WIDTH  = 384; // sm:w-96 = 384px (falls back to 320px on small screens)
  const PANEL_HEIGHT = 560;
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Horizontal: keep panel inside viewport
  const panelLeft = Math.max(
    EDGE_MARGIN,
    Math.min(pos.x, vw - Math.min(PANEL_WIDTH, vw - EDGE_MARGIN * 2) - EDGE_MARGIN),
  );

  // Vertical: open upward from button if near bottom, downward if near top
  const spaceBelow = vh - pos.y - BTN_SIZE;
  const spaceAbove = pos.y;
  const panelH     = Math.min(PANEL_HEIGHT, vh - EDGE_MARGIN * 2);
  const panelTop   = spaceBelow >= panelH + EDGE_MARGIN
    ? pos.y + BTN_SIZE + 8          // enough room below → open downward
    : Math.max(EDGE_MARGIN, pos.y - panelH - 8); // not enough → open upward

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: panelLeft,
    top:  panelTop,
    zIndex: 50,
    maxHeight: `${panelH}px`,
    width: `min(${PANEL_WIDTH}px, calc(100vw - ${EDGE_MARGIN * 2}px))`,
  };

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
  };

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          ref={btnRef}
          style={btnStyle}
          onPointerDown={onPointerDown}
          onClick={handleBtnClick}
          className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 active:scale-95 flex items-center justify-center group select-none"
          title="Open Help Assistant"
          aria-label="Open Help Assistant"
        >
          <span className="text-2xl font-bold leading-none">?</span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Help Assistant
          </span>
        </button>
      )}

      {/* Chat panel — anchored to same position as button */}
      {open && (
        <div
          style={panelStyle}
          className="flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200 bg-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">?</div>
              <div>
                <p className="text-sm font-semibold leading-none">Help Assistant</p>
                <p className="text-xs text-blue-200 mt-0.5">Ask me anything</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white" title="Minimize" aria-label="Minimize">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button onClick={hideWidget} className="p-1.5 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white" title="Hide widget" aria-label="Hide widget">
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
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                }`}>
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
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 bg-gray-50 text-gray-900 placeholder-gray-400"
              maxLength={500}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
