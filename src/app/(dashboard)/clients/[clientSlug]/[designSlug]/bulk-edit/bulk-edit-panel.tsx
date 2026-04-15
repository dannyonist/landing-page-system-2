"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  CheckCircle2,
  CircleDot,
  CircleAlert,
  Sparkles,
  Layers,
} from "lucide-react";

type Variant = { id: string; name: string; slug: string };
type Status = {
  id: string;
  name: string;
  slug: string;
  state: "pending" | "running" | "done" | "failed";
  appliedEdits?: number;
  error?: string;
};

export function BulkEditPanel({
  designId,
  designName,
  clientSlug,
  designSlug,
  variants,
}: {
  designId: string;
  designName: string;
  clientSlug: string;
  designSlug: string;
  variants: Variant[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(variants.map((v) => v.id)),
  );
  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === variants.length) setSelected(new Set());
    else setSelected(new Set(variants.map((v) => v.id)));
  }

  async function submit() {
    if (!message.trim() || running || selected.size === 0) return;
    setRunning(true);
    setError(null);
    setDone(false);

    const targetIds = Array.from(selected);
    const targets = variants.filter((v) => targetIds.includes(v.id));
    setStatuses(
      targets.map((v) => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        state: "pending",
      })),
    );

    try {
      const res = await fetch(`/api/designs/${designId}/bulk-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          variantIds: targetIds,
        }),
      });
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
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

          if (event === "variant_started") {
            setStatuses((prev) =>
              prev.map((s) =>
                s.id === parsed.id ? { ...s, state: "running" } : s,
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
            setDone(true);
          } else if (event === "error") {
            throw new Error((parsed.message as string) || "Failed");
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  const allSelected = selected.size === variants.length;
  const someSelected = selected.size > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
      {/* Left: message composer */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-fuchsia-400" />
          <h2 className="text-sm font-semibold">What should I change on all of them?</h2>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`Examples:\n• "Change the urgency banner to 'Ends Sunday — $30 off'"\n• "Add a 5-star-rating row under the hero, right above the meal grid"\n• "Replace all mentions of 'chef-made' with 'chef-prepared'"\n• "Make the primary CTA color stop teal — update the --g700 :root variable"`}
          rows={10}
          disabled={running}
          className="w-full resize-none rounded-lg bg-white/[0.04] border border-white/[0.06] p-3 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 disabled:opacity-50"
        />

        {error && (
          <div className="mt-3 text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg p-2.5">
            {error}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            Applies to <strong className="text-zinc-300">{selected.size}</strong> of {variants.length} variants, in parallel.
          </div>
          <button
            onClick={submit}
            disabled={running || !message.trim() || !someSelected}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white text-sm font-medium shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Apply to {selected.size} variants
              </>
            )}
          </button>
        </div>

        {done && !running && (
          <div className="mt-4 rounded-lg bg-emerald-950/30 border border-emerald-900/50 p-3 flex items-center justify-between">
            <div className="text-sm text-emerald-300">
              ✓ Bulk edit complete.
            </div>
            <button
              onClick={() => {
                router.push(`/clients/${clientSlug}/${designSlug}`);
                router.refresh();
              }}
              className="text-xs text-emerald-300 hover:text-white underline"
            >
              View updated variants →
            </button>
          </div>
        )}
      </div>

      {/* Right: variant selector + statuses */}
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 backdrop-blur-sm flex flex-col overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-fuchsia-400" />
            <div>
              <div className="text-sm font-medium">
                {running ? "Running" : "Target variants"}
              </div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                {designName}
              </div>
            </div>
          </div>
          {!running && variants.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[60vh]">
          {!running &&
            variants.map((v) => (
              <label
                key={v.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(v.id)}
                  onChange={() => toggle(v.id)}
                  className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-fuchsia-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{v.name}</div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate">
                    /{v.slug}
                  </div>
                </div>
              </label>
            ))}

          {running && (
            <>
              <div className="p-2">
                <OverallProgress statuses={statuses} />
              </div>
              {statuses.map((s) => (
                <StatusRow key={s.id} status={s} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverallProgress({ statuses }: { statuses: Status[] }) {
  const done = statuses.filter((s) => s.state === "done").length;
  const failed = statuses.filter((s) => s.state === "failed").length;
  const total = statuses.length;
  const complete = done + failed;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  const allDone = complete === total;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {allDone ? "Complete" : "Applying in parallel"}
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">
          {complete} / {total}
          {failed > 0 && <span className="text-red-400"> · {failed} failed</span>}
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatusRow({ status }: { status: Status }) {
  const icon =
    status.state === "pending" ? (
      <CircleDot className="w-4 h-4 text-zinc-600" />
    ) : status.state === "running" ? (
      <Loader2 className="w-4 h-4 text-fuchsia-400 animate-spin" />
    ) : status.state === "done" ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    ) : (
      <CircleAlert className="w-4 h-4 text-red-400" />
    );

  const label =
    status.state === "pending"
      ? "queued"
      : status.state === "running"
        ? "applying edits…"
        : status.state === "done"
          ? `done · ${status.appliedEdits ?? 0} edit${status.appliedEdits === 1 ? "" : "s"}`
          : status.error || "failed";

  const isRunning = status.state === "running";

  return (
    <div className="p-2 rounded-lg space-y-2">
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{status.name}</div>
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
