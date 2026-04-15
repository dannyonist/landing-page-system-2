"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, User, Wand2, X, Check, Loader2, CheckCircle2, CircleDot, CircleAlert } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Proposal = { name: string; brief: string };

type VariantStatus = {
  id: string;
  name: string;
  slug: string;
  state: "pending" | "generating" | "done" | "failed";
  appliedEdits?: number;
  error?: string;
};

export function PlanningChat({
  designId,
  designName,
  clientName,
  clientSlug,
  designSlug,
  initialMessages,
  initialProposals,
}: {
  designId: string;
  designName: string;
  clientName: string;
  clientSlug: string;
  designSlug: string;
  initialMessages: ChatMessage[];
  initialProposals: Proposal[];
}) {
  const router = useRouter();
  const hasHistory = initialMessages.length > 0;
  const [messages, setMessages] = useState<ChatMessage[]>(
    hasHistory
      ? initialMessages
      : [
          {
            id: "greeting",
            role: "assistant",
            content: `Let's plan variants for **${designName}** (${clientName}). Tell me about the campaign — audience, ad angle, offer — and I'll propose concrete variants. I can spin up 1-5 at once.`,
          },
        ],
  );
  const [proposals, setProposals] = useState<Proposal[]>(initialProposals);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statuses, setStatuses] = useState<VariantStatus[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, proposals, statuses]);

  async function send() {
    const content = input.trim();
    if (!content || sending || generating) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const res = await fetch(`/api/designs/${designId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(error || "Failed");
      }
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: data.assistantMessageId || "a-" + Date.now(),
        role: "assistant",
        content: data.reply || "",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.type === "proposals" && Array.isArray(data.proposals)) {
        setProposals(data.proposals);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        { id: "err-" + Date.now(), role: "assistant", content: `⚠ ${err}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  function removeProposal(index: number) {
    setProposals((prev) => prev.filter((_, i) => i !== index));
  }

  function editProposal(index: number, field: "name" | "brief", value: string) {
    setProposals((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  async function generateAll() {
    if (proposals.length === 0 || generating) return;
    setGenerating(true);
    setStatuses(
      proposals.map((p) => ({
        id: "pending-" + p.name,
        name: p.name,
        slug: "",
        state: "pending",
      })),
    );

    try {
      const res = await fetch(`/api/designs/${designId}/generate-variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposals }),
      });
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.trim()) continue;

          const lines = raw.split("\n");
          let event = "message";
          let data = "";
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }

          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          if (event === "variant_created") {
            setStatuses((prev) =>
              prev.map((s) =>
                s.state === "pending" && s.name === parsed.name
                  ? { ...s, id: parsed.id as string, slug: parsed.slug as string }
                  : s,
              ),
            );
          } else if (event === "variant_started") {
            setStatuses((prev) =>
              prev.map((s) =>
                s.id === parsed.id ? { ...s, state: "generating" } : s,
              ),
            );
          } else if (event === "variant_done") {
            setStatuses((prev) =>
              prev.map((s) =>
                s.id === parsed.id
                  ? {
                      ...s,
                      state: "done",
                      appliedEdits: parsed.appliedEdits as number,
                    }
                  : s,
              ),
            );
          } else if (event === "variant_failed") {
            setStatuses((prev) =>
              prev.map((s) =>
                s.id === parsed.id
                  ? { ...s, state: "failed", error: parsed.error as string }
                  : s,
              ),
            );
          } else if (event === "done") {
            setTimeout(() => {
              router.push(`/clients/${clientSlug}/${designSlug}`);
              router.refresh();
            }, 800);
          } else if (event === "error") {
            throw new Error((parsed.message as string) || "Generation failed");
          }
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        { id: "err-" + Date.now(), role: "assistant", content: `⚠ ${err}` },
      ]);
      setGenerating(false);
      setStatuses([]);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden min-h-[60vh]">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">Strategy mode</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Planning variants for {designName}
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
                <span className="text-xs text-zinc-500 ml-1">Strategizing…</span>
              </div>
            </div>
          )}

          {proposals.length > 0 && !generating && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">
                Proposed variants · click to edit
              </div>
              {proposals.map((p, i) => (
                <ProposalCard
                  key={i}
                  proposal={p}
                  onRemove={() => removeProposal(i)}
                  onChange={(field, val) => editProposal(i, field, val)}
                />
              ))}
              <button
                onClick={generateAll}
                className="w-full mt-3 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Generate {proposals.length} variant{proposals.length > 1 ? "s" : ""}
              </button>
            </div>
          )}

          {generating && statuses.length > 0 && (
            <div className="space-y-2 pt-2">
              <OverallProgress statuses={statuses} />
              {statuses.map((s) => (
                <StatusRow key={s.id} status={s} />
              ))}
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
              placeholder={proposals.length > 0 ? "Tweak the proposals, or click Generate…" : "Describe the campaign — audience, angle, offer…"}
              rows={2}
              disabled={sending || generating}
              className="flex-1 resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] p-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || generating || !input.trim()}
              className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
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

function ProposalCard({
  proposal,
  onRemove,
  onChange,
}: {
  proposal: Proposal;
  onRemove: () => void;
  onChange: (field: "name" | "brief", value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="p-3 flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Check className="w-3.5 h-3.5 text-fuchsia-300" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={proposal.name}
            onChange={(e) => onChange("name", e.target.value)}
            className="w-full font-medium text-sm bg-transparent border-none focus:outline-none"
          />
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-zinc-500 hover:text-zinc-300 mt-0.5"
          >
            {expanded ? "Hide brief" : "Show brief"}
          </button>
          {expanded && (
            <textarea
              value={proposal.brief}
              onChange={(e) => onChange("brief", e.target.value)}
              rows={6}
              className="w-full mt-2 text-xs text-zinc-400 bg-white/[0.02] border border-white/[0.06] rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
            />
          )}
        </div>
        <button
          onClick={onRemove}
          className="w-6 h-6 rounded-md hover:bg-white/[0.06] flex items-center justify-center flex-shrink-0"
          title="Remove"
        >
          <X className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      </div>
    </div>
  );
}

function OverallProgress({ statuses }: { statuses: VariantStatus[] }) {
  const done = statuses.filter((s) => s.state === "done").length;
  const failed = statuses.filter((s) => s.state === "failed").length;
  const total = statuses.length;
  const complete = done + failed;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  const allDone = complete === total;

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {allDone ? "Complete" : "Building variants"}
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">
          {complete} / {total}
          {failed > 0 && <span className="text-red-400"> · {failed} failed</span>}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatusRow({ status }: { status: VariantStatus }) {
  const icon =
    status.state === "pending" ? (
      <CircleDot className="w-3.5 h-3.5 text-zinc-500" />
    ) : status.state === "generating" ? (
      <Loader2 className="w-3.5 h-3.5 text-fuchsia-400 animate-spin" />
    ) : status.state === "done" ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    ) : (
      <CircleAlert className="w-3.5 h-3.5 text-red-400" />
    );

  const label =
    status.state === "pending"
      ? "queued"
      : status.state === "generating"
        ? "generating HTML…"
        : status.state === "done"
          ? `done · ${status.appliedEdits ?? 0} edit${status.appliedEdits === 1 ? "" : "s"}`
          : status.error || "failed";

  const isRunning = status.state === "generating";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 space-y-2">
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-200 truncate">{status.name}</div>
          <div className="text-xs text-zinc-500 truncate">{label}</div>
        </div>
      </div>
      {isRunning && (
        <div className="h-0.5 rounded-full bg-white/[0.04] overflow-hidden relative">
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent indeterminate-bar" />
        </div>
      )}
    </div>
  );
}
