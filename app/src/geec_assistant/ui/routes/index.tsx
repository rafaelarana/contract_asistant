import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast, Toaster } from "sonner";
import { Send, ThumbsUp, ThumbsDown, Plus, Loader2, FileText, X, ExternalLink } from "lucide-react";
import { type Lang, DEFAULT_LANG, t } from "@/lib/i18n";
import {
  chat,
  listConversations,
  getMessages,
  getDocument,
  submitFeedback,
  currentUser,
  type ConversationOut,
  type ChatOut,
  type Citation,
  type DocumentOut,
  type User,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  component: ChatApp,
});

// --- Gencat colors ---
const C = {
  red: "#C00000",
  redHover: "#A00000",
  darkBar: "#333333",
  darkBarText: "#cccccc",
  white: "#ffffff",
  bg: "#f5f5f5",
  surface: "#ffffff",
  border: "#e0e0e0",
  text: "#333333",
  textSecondary: "#666666",
  textMuted: "#999999",
  userBubble: "#C00000",
  assistantBg: "#ffffff",
  sidebarBg: "#fafafa",
  success: "#2e7d32",
  successLight: "#e8f5e9",
  danger: "#c62828",
  dangerLight: "#ffebee",
};

// --- Types ---
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  citations?: Citation[];
}

interface TraceMap {
  [msgIndex: string]: string;
}

interface FeedbackMap {
  [msgIndex: string]: "positive" | "negative";
}

// --- Main component ---
function ChatApp() {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [traceMap, setTraceMap] = useState<TraceMap>({});
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackMap>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationOut[]>([]);
  const [feedbackModal, setFeedbackModal] = useState<{ idx: number; traceId: string } | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [docPanel, setDocPanel] = useState<{ url: string; title: string } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [docPanelWidth, setDocPanelWidth] = useState(480);
  const [user, setUser] = useState<User | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentUser().then(({ data }) => setUser(data)).catch(() => {});
  }, []);

  const refreshSidebar = useCallback(async () => {
    try {
      const res = await listConversations();
      setConversations(res.data.conversations);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshSidebar();
  }, [refreshSidebar]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages((prev) => [...prev, { role: "user", content: msg, timestamp: now }]);
    setLoading(true);

    try {
      const { data: res }: { data: ChatOut } = await chat({
        message: msg,
        conversation_id: conversationId,
        lang,
      });
      setConversationId(res.conversation_id);
      const assistantIdx = messages.length + 1; // index of the assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.response,
          timestamp: now,
          citations: res.citations && res.citations.length > 0 ? res.citations : undefined,
        },
      ]);
      if (res.trace_id) {
        setTraceMap((prev) => ({ ...prev, [assistantIdx]: res.trace_id! }));
      }
      refreshSidebar();
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${e}`, timestamp: now },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setTraceMap({});
    setFeedbackGiven({});
    setDocPanel(null);
    refreshSidebar();
  };

  const handleLoadConversation = async (convId: string) => {
    try {
      const { data: msgs } = await getMessages({ conversation_id: convId });
      setConversationId(convId);
      setMessages(msgs.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        citations: m.citations && m.citations.length > 0 ? m.citations : undefined,
      })));
      setTraceMap({});
      setFeedbackGiven({});
      setDocPanel(null);
    } catch {
      // ignore
    }
  };

  const handleThumbsUp = async (idx: number) => {
    const traceId = traceMap[idx];
    if (!traceId || feedbackGiven[idx]) return;
    setFeedbackGiven((prev) => ({ ...prev, [idx]: "positive" }));
    try {
      await submitFeedback({ trace_id: traceId, is_positive: true });
      toast.success(t("toast_pos", lang));
    } catch {
      // ignore
    }
  };

  const handleThumbsDown = (idx: number) => {
    const traceId = traceMap[idx];
    if (!traceId || feedbackGiven[idx]) return;
    setFeedbackModal({ idx, traceId });
    setFeedbackComment("");
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackModal) return;
    const { idx, traceId } = feedbackModal;
    setFeedbackGiven((prev) => ({ ...prev, [idx]: "negative" }));
    setFeedbackModal(null);
    try {
      await submitFeedback({ trace_id: traceId, is_positive: false, comment: feedbackComment });
      toast.error(t("toast_neg", lang));
    } catch {
      // ignore
    }
  };

  const handleCitationClick = (citation: Citation) => {
    setDocPanel({ url: citation.url, title: citation.title || "Document" });
  };

  const tr = (key: Parameters<typeof t>[0]) => t(key, lang);

  const hasMessages = messages.length > 0 || loading;

  return (
    <div
      style={{
        fontFamily: "'Open Sans', Arial, Helvetica, sans-serif",
        backgroundColor: C.bg,
        height: "100vh",
        color: C.text,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Language bar */}
      <LanguageBar lang={lang} onLangChange={setLang} />

      {/* Header */}
      <Header lang={lang} user={user} />

      {hasMessages ? (
        /* ===== CHAT VIEW ===== */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <Sidebar
            lang={lang}
            conversations={conversations}
            onNewChat={handleNewChat}
            onLoadConversation={handleLoadConversation}
            width={sidebarWidth}
          />
          <ResizeHandle
            currentWidth={sidebarWidth}
            onWidthChange={setSidebarWidth}
            side="right"
            minWidth={180}
            maxWidth={450}
          />

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              backgroundColor: C.bg,
            }}
          >
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px" }}>
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  msg={msg}
                  idx={i}
                  feedback={feedbackGiven[i]}
                  hasTrace={!!traceMap[i]}
                  lang={lang}
                  onThumbsUp={() => handleThumbsUp(i)}
                  onThumbsDown={() => handleThumbsDown(i)}
                  onCitationClick={handleCitationClick}
                />
              ))}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      backgroundColor: C.red,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: C.white,
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    G
                  </div>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "2px 12px 12px 12px",
                      backgroundColor: C.assistantBg,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <Loader2 size={18} className="animate-spin" style={{ color: C.textMuted }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom input */}
            <div
              style={{
                padding: "12px 32px 20px",
                borderTop: `1px solid ${C.border}`,
                backgroundColor: C.white,
              }}
            >
              <ChatInput
                inputRef={inputRef}
                input={input}
                loading={loading}
                placeholder={tr("placeholder")}
                sendLabel={tr("send")}
                onInputChange={setInput}
                onSend={() => handleSend()}
              />
            </div>
          </div>

          {/* Document panel */}
          {docPanel && (
            <>
              <ResizeHandle
                currentWidth={docPanelWidth}
                onWidthChange={setDocPanelWidth}
                side="left"
                minWidth={320}
                maxWidth={900}
              />
              <DocumentPanel
                url={docPanel.url}
                title={docPanel.title}
                lang={lang}
                width={docPanelWidth}
                onClose={() => setDocPanel(null)}
              />
            </>
          )}
        </div>
      ) : (
        /* ===== WELCOME / LANDING VIEW (ChatGPT style) ===== */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <Sidebar
            lang={lang}
            conversations={conversations}
            onNewChat={handleNewChat}
            onLoadConversation={handleLoadConversation}
            width={sidebarWidth}
          />
          <ResizeHandle
            currentWidth={sidebarWidth}
            onWidthChange={setSidebarWidth}
            side="right"
            minWidth={180}
            maxWidth={450}
          />

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
              backgroundColor: C.bg,
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: C.red,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                marginBottom: 20,
                boxShadow: "0 4px 16px rgba(192,0,0,0.2)",
              }}
            >
              <span>{"\ud83c\udfdb\ufe0f"}</span>
            </div>

            {/* Title & description */}
            <h2
              style={{
                margin: "0 0 6px",
                fontSize: 26,
                fontWeight: 700,
                color: C.text,
              }}
            >
              {t("welcome_title", lang)}
            </h2>
            <p
              style={{
                margin: "0 0 32px",
                color: C.textSecondary,
                fontSize: 15,
                maxWidth: 520,
                textAlign: "center",
                lineHeight: 1.6,
              }}
            >
              {t("welcome_desc", lang)}
            </p>

            {/* Centered input box */}
            <div style={{ width: "100%", maxWidth: 640, marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  backgroundColor: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "6px 6px 6px 16px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={tr("placeholder")}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    border: "none",
                    backgroundColor: "transparent",
                    color: C.text,
                    fontSize: 15,
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: C.red,
                    color: C.white,
                    border: "none",
                    borderRadius: 8,
                    cursor: loading ? "default" : "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: loading || !input.trim() ? 0.5 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <Send size={16} />
                  {tr("send")}
                </button>
              </div>
            </div>

            {/* Suggestion cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                width: "100%",
                maxWidth: 640,
              }}
            >
              {tr("examples").slice(0, 6).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(ex.text)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 10,
                    backgroundColor: C.white,
                    border: `1px solid ${C.border}`,
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.red;
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(192,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <span style={{ fontSize: 20 }}>{ex.icon}</span>
                  <span style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4 }}>
                    {ex.short}
                  </span>
                </button>
              ))}
            </div>

            {/* Powered by */}
            <p style={{ marginTop: 32, fontSize: 11, color: C.textMuted }}>
              {t("powered", lang)} &middot; MLflow Traces
            </p>
          </div>
        </div>
      )}

      {hasMessages && <Toaster richColors position="top-right" />}

      {/* Feedback modal */}
      {feedbackModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => setFeedbackModal(null)}
        >
          <div
            style={{
              backgroundColor: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: 28,
              maxWidth: 480,
              width: "90%",
              boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 17, color: C.text }}>{tr("modal_title")}</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: C.textSecondary }}>
              {tr("modal_desc")}
            </p>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder={tr("modal_placeholder")}
              style={{
                width: "100%",
                minHeight: 90,
                padding: 10,
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                backgroundColor: C.bg,
                color: C.text,
                fontSize: 14,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                onClick={() => setFeedbackModal(null)}
                style={{
                  padding: "8px 18px",
                  backgroundColor: C.white,
                  color: C.textSecondary,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {tr("modal_cancel")}
              </button>
              <button
                onClick={handleFeedbackSubmit}
                style={{
                  padding: "8px 18px",
                  backgroundColor: C.red,
                  color: C.white,
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {tr("modal_submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ResizeHandle({
  currentWidth,
  onWidthChange,
  side,
  minWidth = 180,
  maxWidth = 700,
}: {
  currentWidth: number;
  onWidthChange: (w: number) => void;
  side: "right" | "left";
  minWidth?: number;
  maxWidth?: number;
}) {
  const startRef = useRef({ x: 0, width: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width: currentWidth };

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startRef.current.x;
      // Sidebar (right edge): drag right = wider. DocPanel (left edge): drag left = wider.
      const newW = startRef.current.width + (side === "right" ? dx : -dx);
      onWidthChange(Math.min(maxWidth, Math.max(minWidth, newW)));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 5,
        cursor: "col-resize",
        backgroundColor: "transparent",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = C.border)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    />
  );
}

function LanguageBar({ lang, onLangChange }: { lang: Lang; onLangChange: (l: Lang) => void }) {
  const langs: Lang[] = ["ca", "es", "en"];
  return (
    <div
      style={{
        backgroundColor: C.darkBar,
        padding: "6px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 12, color: C.darkBarText, marginRight: 8 }}>Idioma:</span>
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => onLangChange(l)}
          style={{
            padding: "3px 12px",
            fontSize: 12,
            fontWeight: lang === l ? 700 : 600,
            backgroundColor: lang === l ? C.white : "transparent",
            color: lang === l ? C.darkBar : C.darkBarText,
            border: lang === l ? "none" : `1px solid ${C.darkBarText}`,
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function GencatLogo() {
  const sq = (
    <div style={{ width: 8, height: 8, backgroundColor: C.red }} />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {sq}
      {sq}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {sq}
          {sq}
        </div>
      </div>
    </div>
  );
}

function Header({ lang, user }: { lang: Lang; user: User | null }) {
  return (
    <div
      style={{
        backgroundColor: C.white,
        padding: "14px 24px",
        borderBottom: `3px solid ${C.red}`,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <GencatLogo />
      <div>
        <span style={{ fontSize: 13, fontWeight: 400, color: C.text, display: "block", lineHeight: 1.2 }}>
          Generalitat
        </span>
        <span style={{ fontSize: 13, fontWeight: 400, color: C.text, display: "block", lineHeight: 1.2 }}>
          de Catalunya
        </span>
      </div>
      <div style={{ width: 1, height: 36, backgroundColor: C.border, margin: "0 8px" }} />
      <div>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{t("title", lang)}</h1>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textSecondary }}>
          {t("subtitle", lang)}
        </p>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            padding: "4px 12px",
            borderRadius: 2,
            backgroundColor: C.successLight,
            fontSize: 11,
            color: C.success,
            fontWeight: 600,
            border: `1px solid ${C.success}`,
          }}
        >
          {t("tracing", lang)}
        </div>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
          Powered by Databricks
        </span>
        <UserAvatar lang={lang} user={user} />
      </div>
    </div>
  );
}

function UserAvatar({ lang, user }: { lang: Lang; user: User | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const displayName = user?.display_name || user?.user_name || "";
  const email = user?.user_name || user?.emails?.[0]?.value || "";
  const initial = (displayName || email).trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        title={displayName || email}
        aria-label={displayName || "User"}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          backgroundColor: C.red,
          color: C.white,
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        {initial}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 260,
            backgroundColor: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 14,
            zIndex: 100,
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: C.textMuted,
            }}
          >
            {t("signed_in_as", lang)}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              wordBreak: "break-word",
            }}
          >
            {displayName || email || "—"}
          </p>
          {email && email !== displayName && (
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 12,
                color: C.textSecondary,
                wordBreak: "break-word",
              }}
            >
              {email}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Sidebar({
  lang,
  conversations,
  onNewChat,
  onLoadConversation,
  width = 260,
}: {
  lang: Lang;
  conversations: ConversationOut[];
  onNewChat: () => void;
  onLoadConversation: (id: string) => void;
  width?: number;
}) {
  return (
    <div
      style={{
        width,
        backgroundColor: C.sidebarBg,
        borderRight: "none",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: 16 }}>
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: C.red,
            color: C.white,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "center",
          }}
        >
          <Plus size={14} />
          {t("new_chat", lang)}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: C.textMuted,
            margin: "8px 4px 10px",
          }}
        >
          {t("recent", lang)}
        </p>

        {conversations.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textMuted, padding: 8, textAlign: "center" }}>
            {t("none_yet", lang)}
          </p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onLoadConversation(c.id)}
              style={{
                padding: "8px 10px",
                borderRadius: 4,
                cursor: "pointer",
                marginBottom: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <p
                style={{
                  fontSize: 13,
                  margin: 0,
                  color: C.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {(c.title || "...").slice(0, 40)}
              </p>
              {c.updated_at && (
                <p style={{ fontSize: 10, margin: "2px 0 0", color: C.textMuted }}>
                  {new Date(c.updated_at).toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${C.border}`,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>{t("powered", lang)}</p>
        <p style={{ fontSize: 10, color: C.red, margin: "2px 0 0", fontWeight: 600 }}>
          MLflow Traces
        </p>
      </div>
    </div>
  );
}

function ChatInput({
  inputRef,
  input,
  loading,
  placeholder,
  sendLabel,
  onInputChange,
  onSend,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  input: string;
  loading: boolean;
  placeholder: string;
  sendLabel: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        placeholder={placeholder}
        disabled={loading}
        style={{
          flex: 1,
          padding: "11px 16px",
          borderRadius: 4,
          border: `1px solid ${C.border}`,
          backgroundColor: C.white,
          color: C.text,
          fontSize: 14,
          outline: "none",
        }}
      />
      <button
        onClick={onSend}
        disabled={loading || !input.trim()}
        style={{
          padding: "11px 24px",
          backgroundColor: C.red,
          color: C.white,
          border: "none",
          borderRadius: 4,
          cursor: loading ? "default" : "pointer",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
          opacity: loading || !input.trim() ? 0.6 : 1,
        }}
      >
        <Send size={16} />
        {sendLabel}
      </button>
    </div>
  );
}

/** Parse text with [N] citation markers and render them as clickable superscripts. */
function renderTextWithCitations(
  text: string,
  citations: Citation[],
  onCitationClick: (c: Citation) => void,
): React.ReactNode {
  // Split on citation markers like [1], [2][3], etc.
  const parts = text.split(/(\[\d+\])/g);
  if (parts.length === 1) return text; // no markers found

  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return part;

    const idx = parseInt(match[1], 10);
    const citation = citations[idx - 1]; // 1-based → 0-based
    if (!citation) return part; // unknown index, render as-is

    const pageInfo = citation.page ? ` (p. ${citation.page})` : "";
    return (
      <button
        key={i}
        onClick={() => onCitationClick(citation)}
        title={`${citation.title || `Source ${idx}`}${pageInfo}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.red,
          color: C.white,
          border: "none",
          borderRadius: "50%",
          width: 18,
          height: 18,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          verticalAlign: "super",
          lineHeight: 1,
          margin: "0 1px",
          padding: 0,
          position: "relative",
          top: -2,
        }}
      >
        {idx}
      </button>
    );
  });
}

function MessageBubble({
  msg,
  idx: _idx,
  feedback,
  hasTrace,
  lang,
  onThumbsUp,
  onThumbsDown,
  onCitationClick,
}: {
  msg: ChatMessage;
  idx: number;
  feedback?: "positive" | "negative";
  hasTrace: boolean;
  lang: Lang;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onCitationClick: (c: Citation) => void;
}) {
  const isUser = msg.role === "user";
  const citations = msg.citations;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 14,
        alignItems: "flex-start",
        gap: 10,
        animation: "fadeIn 0.25s ease-out",
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            backgroundColor: C.red,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            flexShrink: 0,
            color: C.white,
          }}
        >
          G
        </div>
      )}
      <div
        style={{
          maxWidth: "72%",
          padding: "12px 16px",
          borderRadius: isUser ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
          backgroundColor: isUser ? C.userBubble : C.assistantBg,
          color: isUser ? C.white : C.text,
          border: isUser ? "none" : `1px solid ${C.border}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {citations && citations.length > 0
            ? renderTextWithCitations(msg.content, citations, onCitationClick)
            : msg.content}
        </div>
        {citations && citations.length > 0 && (
          <CitationsBlock citations={citations} lang={lang} onCitationClick={onCitationClick} />
        )}
        {msg.timestamp && (
          <div
            style={{
              fontSize: 10,
              color: isUser ? "rgba(255,255,255,0.7)" : C.textMuted,
              marginTop: 6,
              textAlign: "right",
            }}
          >
            {msg.timestamp}
          </div>
        )}
        {!isUser && (
          <FeedbackButtons
            feedback={feedback}
            hasTrace={hasTrace}
            lang={lang}
            onThumbsUp={onThumbsUp}
            onThumbsDown={onThumbsDown}
          />
        )}
      </div>
    </div>
  );
}

function DocumentPanel({
  url,
  title,
  lang,
  width = 480,
  onClose,
}: {
  url: string;
  title: string;
  lang: Lang;
  width?: number;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<DocumentOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDoc(null);

    getDocument({ url })
      .then(({ data }) => {
        if (!cancelled) {
          if (data.content.startsWith("Error:")) {
            setError(data.content);
          } else {
            setDoc(data);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url]);

  // Cleanup blob URL on unmount or doc change
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [doc]);

  // Auto-scroll to highlight after render
  useEffect(() => {
    if (doc && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [doc]);

  const renderContent = () => {
    if (!doc) return null;
    const { content, content_type, highlight_text, page } = doc;

    // PDF: render in an iframe via blob URL with cited text banner
    if (content_type === "application/pdf") {
      if (!blobUrlRef.current) {
        const byteChars = atob(content);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: "application/pdf" });
        blobUrlRef.current = URL.createObjectURL(blob);
      }
      // Append #page=N to navigate to the cited page
      const pdfSrc = page ? `${blobUrlRef.current}#page=${page}` : blobUrlRef.current;
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Cited text banner */}
          {highlight_text && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#FFF9C4",
                borderBottom: `2px solid #F9A825`,
                fontSize: 12,
                lineHeight: 1.6,
                color: C.text,
                flexShrink: 0,
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}>
                <span style={{
                  backgroundColor: "#F9A825",
                  color: C.white,
                  borderRadius: 3,
                  padding: "2px 7px",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                  whiteSpace: "nowrap",
                }}>
                  {page ? `p. ${page}` : "CITE"}
                </span>
                <span style={{ fontStyle: "italic" }}>
                  &ldquo;{highlight_text.length > 300 ? highlight_text.slice(0, 300) + "..." : highlight_text}&rdquo;
                </span>
              </div>
            </div>
          )}
          <iframe
            src={pdfSrc}
            title={title}
            style={{ width: "100%", flex: 1, border: "none", minHeight: 500 }}
          />
        </div>
      );
    }

    // Text content with optional highlighting
    if (!highlight_text) {
      return (
        <pre style={preStyle}>{content}</pre>
      );
    }

    // Try to find the highlight text in the content
    const idx = content.indexOf(highlight_text);
    if (idx === -1) {
      // Try a shorter match (first 80 chars of highlight)
      const shorter = highlight_text.slice(0, 80);
      const shortIdx = content.indexOf(shorter);
      if (shortIdx === -1) {
        return <pre style={preStyle}>{content}</pre>;
      }
      return (
        <pre style={preStyle}>
          {content.slice(0, shortIdx)}
          <span
            ref={highlightRef}
            style={{ backgroundColor: "#FFF9C4", borderRadius: 2, padding: "1px 0" }}
          >
            {content.slice(shortIdx, shortIdx + shorter.length)}
          </span>
          {content.slice(shortIdx + shorter.length)}
        </pre>
      );
    }

    return (
      <pre style={preStyle}>
        {content.slice(0, idx)}
        <span
          ref={highlightRef}
          style={{ backgroundColor: "#FFF9C4", borderRadius: 2, padding: "1px 0" }}
        >
          {content.slice(idx, idx + highlight_text.length)}
        </span>
        {content.slice(idx + highlight_text.length)}
      </pre>
    );
  };

  const preStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "'Open Sans', Arial, sans-serif",
    color: C.text,
  };

  return (
    <div
      style={{
        width,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: "none",
        backgroundColor: C.white,
        animation: "slideInRight 0.25s ease-out",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <FileText size={16} style={{ color: C.red, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={t("doc_open_tab", lang)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 4,
            borderRadius: 4,
            color: C.textMuted,
            textDecoration: "none",
          }}
        >
          <ExternalLink size={15} />
        </a>
        <button
          onClick={onClose}
          title={t("doc_close", lang)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 4,
            borderRadius: 4,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: C.textMuted,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Panel content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: doc?.content_type === "application/pdf" ? 0 : "16px 20px",
      }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, padding: 20 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>{t("doc_loading", lang)}</span>
          </div>
        )}
        {error && (
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: C.danger, margin: "0 0 12px" }}>
              {t("doc_error", lang)}
            </p>
            <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 12px" }}>{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: C.red,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ExternalLink size={12} />
              {t("doc_open_tab", lang)}
            </a>
          </div>
        )}
        {doc && renderContent()}
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function CitationsBlock({
  citations,
  lang,
  onCitationClick,
}: {
  citations: Citation[];
  lang: Lang;
  onCitationClick: (c: Citation) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${C.border}`,
      }}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
          fontSize: 12,
          fontWeight: 600,
          color: C.red,
        }}
      >
        <FileText size={13} />
        {t("doc_sources", lang)} ({citations.length})
        <span style={{ fontSize: 10, marginLeft: 2 }}>{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>
      {expanded && (
        <ul
          style={{
            margin: "6px 0 0",
            padding: "0 0 0 8px",
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {citations.map((c, i) => (
            <li key={i}>
              <button
                onClick={() => onCitationClick(c)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: 12,
                  color: C.red,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  lineHeight: 1.4,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                <FileText size={11} style={{ flexShrink: 0, opacity: 0.6 }} />
                {c.title || "Document"}{c.page ? ` (p. ${c.page})` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedbackButtons({
  feedback,
  hasTrace,
  lang,
  onThumbsUp,
  onThumbsDown,
}: {
  feedback?: "positive" | "negative";
  hasTrace: boolean;
  lang: Lang;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
}) {
  const btnStyle = (kind: "positive" | "negative") => {
    const isActive = feedback === kind;
    const activeBg = kind === "positive" ? C.successLight : C.dangerLight;
    const activeBorder = kind === "positive" ? C.success : C.danger;
    return {
      padding: "3px 10px",
      borderRadius: 4,
      border: `1px solid ${isActive ? activeBorder : C.border}`,
      backgroundColor: isActive ? activeBg : C.white,
      color: isActive ? activeBorder : C.textMuted,
      cursor: hasTrace && !feedback ? "pointer" : "default",
      fontSize: 12,
      display: "inline-flex" as const,
      alignItems: "center" as const,
      gap: 4,
      opacity: !feedback || isActive ? 1 : 0.3,
      transition: "all 0.2s ease",
    };
  };

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
      <button onClick={onThumbsUp} disabled={!!feedback} style={btnStyle("positive")}>
        <ThumbsUp size={12} />
        <span style={{ fontSize: 11 }}>{t("useful", lang)}</span>
      </button>
      <button onClick={onThumbsDown} disabled={!!feedback} style={btnStyle("negative")}>
        <ThumbsDown size={12} />
        <span style={{ fontSize: 11 }}>{t("improvable", lang)}</span>
      </button>
      {feedback && (
        <span style={{ fontSize: 11, color: C.success, marginLeft: 6 }}>{t("thanks", lang)}</span>
      )}
    </div>
  );
}
