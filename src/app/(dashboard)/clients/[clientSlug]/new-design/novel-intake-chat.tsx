"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  User,
  Wand2,
  Loader2,
  Rocket,
  AlertTriangle,
} from "lucide-react";
import type { DesignBrief } from "@/lib/design-intake";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type GenStatus = {
  phase: "idle" | "starting" | "streaming" | "validating" | "retrying" | "saving" | "done" | "error";
  message: string;
  tokens: number;
  warnings: string[];
  error?: string;
};

const INITIAL_STATUS: GenStatus = {
  phase: "idle",
  message: "",
  tokens: 0,
  warnings: [],
};

export function NovelIntakeChat({ clientSlug }: { clientSlug: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greeting",
      role: "assistant",
      content:
        "Let's invent a brand new design direction. This won't duplicate anything — I'll produce a structured brief and a novel landing page from scratch.\n\n**To start**: what kind of design are you picturing? Give me a name (e.g. \"Holiday Promo\", \"Athlete Performance\", \"Luxury Editorial\") and a 1–2 sentence description of the vibe or the moment you want it to land.",
    },
  ]);
  const [brief, setBrief] = useState<DesignBrief | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<GenStatus>(INITIAL_STATUS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const generating =
    status.phase !== "idle" && status.phase !== "done" && status.phase !== "error";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, brief]);

  async function send() {
    const content = input.trim();
    if (!content || sending || generating) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content,
    };
    const nextHistory = [
      ...messages.filter((m) => m.id !== "greeting"),
      userMsg,
    ];
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`/api/designs/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          clientSlug,
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
      if (data.type === "finalized" && data.brief) {
        setBrief(data.brief);
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

  async function generate() {
    if (!brief || generating) return;
    setStatus({
      ...INITIAL_STATUS,
      phase: "starting",
      message: "Starting…",
    });

    try {
      const res = await fetch(`/api/clients/${clientSlug}/generate-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "Failed");
        throw new Error(text || "Generation failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          if (!frame.trim()) continue;
          const lines = frame.split("\n");
          let eventName = "message";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          let payload: unknown = null;
          try {
            payload = JSON.parse(dataStr);
          } catch {
            continue;
          }
          handleEvent(eventName, payload);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setStatus((s) => ({ ...s, phase: "error", error: msg, message: msg }));
    }
  }

  function handleEvent(event: string, payload: unknown) {
    const data = (payload || {}) as Record<string, unknown>;
    if (event === "status") {
      setStatus((s) => ({
        ...s,
        phase: (data.phase as GenStatus["phase"]) || s.phase,
        message: (data.message as string) || s.message,
      }));
    } else if (event === "tokens") {
      setStatus((s) => ({ ...s, tokens: (data.total as number) || s.tokens }));
    } else if (event === "warning") {
      setStatus((s) => ({
        ...s,
        warnings: [...s.warnings, (data.message as string) || "warning"],
      }));
    } else if (event === "done") {
      setStatus((s) => ({
        ...s,
        phase: "done",
        message: "Design created.",
      }));
      const designSlug = data.designSlug as string;
      setTimeout(() => {
        router.push(`/clients/${clientSlug}/${designSlug}`);
        router.refresh();
      }, 600);
    } else if (event === "error") {
      setStatus((s) => ({
        ...s,
        phase: "error",
        error: (data.message as string) || "Error",
        message: (data.message as string) || "Error",
      }));
    }
  }

  function updateBrief<K extends keyof DesignBrief>(key: K, value: DesignBrief[K]) {
    setBrief((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 max-w-6xl">
      {/* Chat */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden min-h-[70vh]">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">Novel design intake</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Interview → brief → generate from scratch
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center flex-shrink-0">
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
                brief
                  ? "Answer any follow-ups or click Generate →"
                  : "Describe the design direction…"
              }
              rows={2}
              disabled={sending || generating}
              className="flex-1 resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] p-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 focus:border-fuchsia-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || generating || !input.trim()}
              className="h-10 w-10 rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-fuchsia-500/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Brief / generation panel */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden min-h-[70vh]">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Rocket className={`w-3.5 h-3.5 ${brief ? "text-fuchsia-400" : "text-zinc-600"}`} />
            </div>
            <div>
              <div className="text-sm font-medium">
                {brief ? "Design brief — ready to generate" : "Waiting for enough info…"}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Editable before generation
              </div>
            </div>
          </div>
          {brief && status.phase === "idle" && (
            <button
              onClick={generate}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-gradient-to-br from-fuchsia-500 to-amber-400 text-white text-xs font-medium shadow-lg shadow-fuchsia-500/30"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate design
            </button>
          )}
          {generating && (
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-zinc-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {status.message || "Working…"}
            </div>
          )}
          {status.phase === "done" && (
            <div className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
              Created — redirecting…
            </div>
          )}
        </div>

        {!brief ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-zinc-500 max-w-sm">
              As the interview progresses, the AI will propose a complete design brief here — typography, palette, section order, hero copy. You&apos;ll be able to edit before generating.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {generating || status.phase === "done" || status.phase === "error" ? (
              <GenerationStatus status={status} />
            ) : null}

            <BriefSection title="Name">
              <input
                value={brief.name}
                onChange={(e) => updateBrief("name", e.target.value)}
                className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30"
              />
            </BriefSection>
            <BriefSection title="Description">
              <textarea
                value={brief.description}
                onChange={(e) => updateBrief("description", e.target.value)}
                rows={2}
                className="w-full rounded-md border border-white/[0.06] bg-white/[0.04] p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/30 resize-y"
              />
            </BriefSection>

            <div className="grid grid-cols-2 gap-3">
              <BriefSection title="Audience" compact>
                <input
                  value={brief.audience}
                  onChange={(e) => updateBrief("audience", e.target.value)}
                  className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm"
                />
              </BriefSection>
              <BriefSection title="Vibe" compact>
                <input
                  value={brief.vibe}
                  onChange={(e) => updateBrief("vibe", e.target.value)}
                  className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm"
                />
              </BriefSection>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <BriefSection title="Display font" compact>
                <input
                  value={brief.typography.display}
                  onChange={(e) =>
                    updateBrief("typography", { ...brief.typography, display: e.target.value })
                  }
                  className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm font-mono"
                />
              </BriefSection>
              <BriefSection title="Body font" compact>
                <input
                  value={brief.typography.body}
                  onChange={(e) =>
                    updateBrief("typography", { ...brief.typography, body: e.target.value })
                  }
                  className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm font-mono"
                />
              </BriefSection>
            </div>

            <BriefSection title="Palette">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    "bg",
                    "surface",
                    "ink",
                    "ink2",
                    "primary",
                    "primaryDark",
                    "accent",
                    "amber",
                    "line",
                  ] as const
                ).map((k) => (
                  <label key={k} className="block">
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider mb-1">
                      {k}
                    </span>
                    <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 h-8">
                      <span
                        className="inline-block w-4 h-4 rounded border border-white/10 flex-shrink-0"
                        style={{ background: brief.palette[k] }}
                      />
                      <input
                        value={brief.palette[k]}
                        onChange={(e) =>
                          updateBrief("palette", { ...brief.palette, [k]: e.target.value })
                        }
                        className="flex-1 min-w-0 bg-transparent text-xs font-mono focus:outline-none"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </BriefSection>

            <BriefSection title="Hero headline">
              <input
                value={brief.heroHeadline}
                onChange={(e) => updateBrief("heroHeadline", e.target.value)}
                className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm"
              />
            </BriefSection>
            <BriefSection title="Hero subhead">
              <textarea
                value={brief.heroSub}
                onChange={(e) => updateBrief("heroSub", e.target.value)}
                rows={2}
                className="w-full rounded-md border border-white/[0.06] bg-white/[0.04] p-2.5 text-sm resize-y"
              />
            </BriefSection>

            <div className="grid grid-cols-2 gap-3">
              <BriefSection title="Hero style" compact>
                <select
                  value={brief.heroStyle}
                  onChange={(e) =>
                    updateBrief("heroStyle", e.target.value as DesignBrief["heroStyle"])
                  }
                  className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm"
                >
                  <option value="editorial-serif">Editorial serif</option>
                  <option value="bold-poster">Bold poster</option>
                  <option value="split-image">Split image</option>
                  <option value="full-bleed-photo">Full-bleed photo</option>
                  <option value="athletic-dark">Athletic dark</option>
                  <option value="freeform">Freeform</option>
                </select>
              </BriefSection>
              <BriefSection title="Meal grid" compact>
                <select
                  value={brief.mealGridStyle}
                  onChange={(e) =>
                    updateBrief("mealGridStyle", e.target.value as DesignBrief["mealGridStyle"])
                  }
                  className="w-full h-9 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm"
                >
                  <option value="horizontal-scroll">Horizontal scroll</option>
                  <option value="grid-3col">3-column grid</option>
                  <option value="grid-4col">4-column grid</option>
                  <option value="masonry">Masonry</option>
                </select>
              </BriefSection>
            </div>

            <BriefSection title="Section order">
              <div className="text-xs font-mono text-zinc-400 p-2.5 rounded-md bg-white/[0.02] border border-white/[0.04] leading-relaxed">
                {brief.sectionOrder.join(" → ")}
              </div>
            </BriefSection>

            <BriefSection title="Goal categories">
              <div className="space-y-2">
                {brief.goalCategories.map((g, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-200">{g.label}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{g.key}</span>
                    </div>
                    <div className="text-zinc-500 mt-0.5">{g.description}</div>
                  </div>
                ))}
              </div>
            </BriefSection>

            <BriefSection title="Visual notes">
              <textarea
                value={brief.visualNotes}
                onChange={(e) => updateBrief("visualNotes", e.target.value)}
                rows={4}
                className="w-full rounded-md border border-white/[0.06] bg-white/[0.04] p-2.5 text-xs leading-relaxed resize-y"
              />
            </BriefSection>
          </div>
        )}
      </div>
    </div>
  );
}

function BriefSection({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : ""}>
      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
        {title}
      </label>
      {children}
    </div>
  );
}

function GenerationStatus({ status }: { status: GenStatus }) {
  const phases: Array<{ key: GenStatus["phase"]; label: string }> = [
    { key: "starting", label: "Prep" },
    { key: "streaming", label: "Writing HTML" },
    { key: "validating", label: "Validate" },
    { key: "saving", label: "Save" },
    { key: "done", label: "Done" },
  ];
  const currentIdx = phases.findIndex((p) => p.key === status.phase);

  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs text-fuchsia-200">
        {status.phase === "error" ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : status.phase === "done" ? (
          <Sparkles className="w-4 h-4" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        <span className="font-medium">{status.message || "Working…"}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {phases.map((p, i) => {
          const active = i <= currentIdx || status.phase === "done";
          return (
            <div
              key={p.key}
              className={`flex-1 h-1 rounded-full transition-colors ${
                active ? "bg-fuchsia-400" : "bg-white/10"
              }`}
              title={p.label}
            />
          );
        })}
      </div>

      {status.tokens > 0 && (
        <div className="text-[10px] font-mono text-zinc-500">
          ~{status.tokens.toLocaleString()} tokens written
        </div>
      )}

      {status.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-200">
          <div className="font-medium mb-1">Warnings:</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {status.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {status.error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
          {status.error}
        </div>
      )}
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
            : "bg-gradient-to-br from-fuchsia-500 to-amber-400"
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
