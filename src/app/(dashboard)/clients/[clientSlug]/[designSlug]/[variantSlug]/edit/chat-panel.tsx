"use client";
import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, User, Wand2 } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

export function ChatPanel({
  variantId,
  initialHtml,
  initialMessages,
}: {
  variantId: string;
  initialHtml: string;
  initialMessages: ChatMessage[];
}) {
  const [html, setHtml] = useState(initialHtml);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    const optimisticUser: ChatMessage = {
      id: "tmp-u-" + Date.now(),
      role: "USER",
      content,
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setSending(true);
    try {
      const res = await fetch(`/api/variants/${variantId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(error || "Failed");
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === optimisticUser.id ? { ...m, id: data.userMessageId } : m,
        ),
        {
          id: data.assistantMessageId,
          role: "ASSISTANT",
          content: data.reply,
        },
      ]);
      if (data.html) setHtml(data.html);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          role: "ASSISTANT",
          content: `⚠ ${errMsg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 h-[calc(100vh-11rem)]">
      {/* Preview */}
      <div className="rounded-2xl border border-white/[0.08] bg-white overflow-hidden shadow-2xl shadow-indigo-500/5">
        <iframe
          srcDoc={html}
          className="w-full h-full"
          title="Variant preview"
          data-variant-id={variantId}
        />
      </div>

      {/* Chat */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium">AI Designer</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Claude Sonnet</div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-6">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed">
                  Hey — I&apos;ve loaded the base template for this design.
                  Tell me about this variant: <span className="text-zinc-500">the target audience, the ad angle, the offer</span>. I&apos;ll generate it.
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SuggestionChip onClick={() => setInput("Make this for keto buyers — punchier hero, preselect the Keto goal, emphasize fat loss.")}>
                      Keto variant
                    </SuggestionChip>
                    <SuggestionChip onClick={() => setInput("Target busy professionals — lead with time savings, 5-minute meal copy, emphasize convenience over cooking.")}>
                      Busy professionals
                    </SuggestionChip>
                    <SuggestionChip onClick={() => setInput("Cart abandon variant — urgency banner should mention their cart, hero should reference what they already picked.")}>
                      Cart abandon
                    </SuggestionChip>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              placeholder="Describe changes…"
              rows={2}
              disabled={sending}
              className="flex-1 resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] p-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 px-1">
            Press Enter to send · Shift+Enter for newline
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "USER";
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
        {message.content}
      </div>
    </div>
  );
}

function SuggestionChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}
