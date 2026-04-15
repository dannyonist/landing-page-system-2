"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  User,
  Wand2,
  Check,
  Loader2,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Draft = { name: string; slug: string; description: string };

export function ClientIntakeChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greeting",
      role: "assistant",
      content:
        "Let's onboard a new client. I'll build a brief that future AI runs will use as permanent context for this client's designs and variants.\n\n**Start with the basics**: what's the company name, what do they do, and what's their website (if they have one)?",
    },
  ]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, draft]);

  async function send() {
    const content = input.trim();
    if (!content || sending || saving) return;
    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content,
    };
    const nextHistory = [...messages.filter((m) => m.id !== "greeting"), userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`/api/clients/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: nextHistory.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(error || "Failed");
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: "a-" + Date.now(),
          role: "assistant",
          content: data.reply || "",
        },
      ]);
      if (data.type === "finalized" && data.draft) {
        setDraft(data.draft);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "assistant",
          content: `⚠ ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function save() {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(error || "Failed");
      }
      const data = await res.json();
      router.push(`/clients/${data.slug}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 max-w-6xl">
      {/* Chat */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden min-h-[70vh]">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">Client intake</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Interview → brief → save
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {sending && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse [animation-delay:300ms]" />
                <span className="text-xs text-zinc-500 ml-1">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-white/[0.06] p-3"
        >
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                draft
                  ? "Answer any follow-ups or click Create →"
                  : "Describe the client…"
              }
              rows={2}
              disabled={sending || saving}
              className="flex-1 resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] p-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || saving || !input.trim()}
              className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Draft panel */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden min-h-[70vh]">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Check className={`w-3.5 h-3.5 ${draft ? "text-emerald-400" : "text-zinc-600"}`} />
            </div>
            <div>
              <div className="text-sm font-medium">
                {draft ? "Proposed brief" : "Waiting for enough info…"}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Markdown — editable before save
              </div>
            </div>
          </div>
          {draft && (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-xs font-medium shadow-lg shadow-indigo-500/30 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Create client
                </>
              )}
            </button>
          )}
        </div>

        {!draft ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-zinc-500">
              As the interview progresses, the AI will propose a complete client brief here. You&apos;ll be able to edit before saving.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Name
              </label>
              <input
                value={draft.name}
                onChange={(e) => updateDraft("name", e.target.value)}
                className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Slug
              </label>
              <input
                value={draft.slug}
                onChange={(e) =>
                  updateDraft("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <p className="text-xs text-zinc-500 mt-1 font-mono">/clients/{draft.slug}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Brief (markdown)
              </label>
              <textarea
                value={draft.description}
                onChange={(e) => updateDraft("description", e.target.value)}
                rows={18}
                className="w-full rounded-md border border-white/[0.06] bg-white/[0.04] p-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
              />
            </div>
            {error && (
              <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md p-2.5">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-white/[0.06] border border-white/[0.08]"
            : "bg-gradient-to-br from-indigo-500 to-fuchsia-500"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-zinc-400" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-white" />
        )}
      </div>
      <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap pt-0.5 min-w-0 flex-1">
        {renderWithBold(message.content)}
      </div>
    </div>
  );
}

function renderWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
