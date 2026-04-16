import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers, Copy, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createDesignFromSource } from "./actions";
import { NovelIntakeChat } from "./novel-intake-chat";

export const dynamic = "force-dynamic";

type Mode = "scaffolded" | "novel";

export default async function NewDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientSlug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { clientSlug } = await params;
  const { mode: modeParam } = await searchParams;
  const mode: Mode = modeParam === "novel" ? "novel" : "scaffolded";

  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    include: {
      designs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!client) notFound();

  const otherClientsDesigns =
    mode === "scaffolded"
      ? await prisma.design.findMany({
          where: { clientId: { not: client.id } },
          orderBy: [{ client: { name: "asc" } }, { createdAt: "asc" }],
          include: { client: { select: { name: true, slug: true } } },
        })
      : [];

  return (
    <div className={mode === "novel" ? "max-w-6xl" : "max-w-2xl"}>
      <div className="mb-6">
        <Link
          href={`/clients/${client.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {client.name}
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New design</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {mode === "novel"
                ? "Invent a brand new direction via chat — AI will generate the full landing page from scratch."
                : "Duplicate an existing design as a starting point. Customize with chat after."}
            </p>
          </div>
        </div>
      </div>

      <ModeToggle clientSlug={client.slug} mode={mode} />

      {mode === "novel" ? (
        <NovelIntakeChat clientSlug={client.slug} />
      ) : (
        <form
          action={createDesignFromSource.bind(null, client.id)}
          className="rounded-2xl border border-white/[0.08] bg-zinc-950/70 p-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              Design name
            </label>
            <input
              name="name"
              required
              autoFocus
              placeholder="e.g. Black Friday Edition"
              className="w-full h-10 rounded-md border border-white/[0.06] bg-white/[0.04] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
              Short description (optional)
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="e.g. Dark, urgent direction for holiday promos. Heavier CTAs, countdown banner, discount-forward copy."
              className="w-full rounded-md border border-white/[0.06] bg-white/[0.04] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Used by the AI as permanent design-direction context.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Start from
            </label>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {client.designs.length > 0 && (
                <>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider pl-1">
                    This client ({client.name})
                  </div>
                  {client.designs.map((d, i) => (
                    <SourceOption
                      key={d.id}
                      id={d.id}
                      label={d.name}
                      sublabel={`/${d.slug}`}
                      defaultChecked={i === 0}
                    />
                  ))}
                </>
              )}
              {otherClientsDesigns.length > 0 && (
                <>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider pl-1 pt-3">
                    Other clients&apos; designs (as templates)
                  </div>
                  {otherClientsDesigns.map((d) => (
                    <SourceOption
                      key={d.id}
                      id={d.id}
                      label={d.name}
                      sublabel={`${d.client.name} · /${d.slug}`}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/30"
            >
              <Copy className="w-4 h-4" />
              Create design
            </button>
            <Link
              href={`/clients/${client.slug}`}
              className="h-10 inline-flex items-center px-3 text-sm text-zinc-500 hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function ModeToggle({ clientSlug, mode }: { clientSlug: string; mode: Mode }) {
  return (
    <div className="mb-5 inline-flex rounded-xl border border-white/[0.08] bg-zinc-950/70 p-1">
      <Link
        href={`/clients/${clientSlug}/new-design`}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
          mode === "scaffolded"
            ? "bg-white/[0.08] text-white"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <Copy className="w-3.5 h-3.5" />
        Scaffolded
        <span className="text-[10px] text-zinc-500 font-normal ml-1">duplicate</span>
      </Link>
      <Link
        href={`/clients/${clientSlug}/new-design?mode=novel`}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
          mode === "novel"
            ? "bg-gradient-to-br from-fuchsia-500/20 to-amber-400/20 text-white ring-1 ring-fuchsia-500/40"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Novel
        <span className="text-[10px] text-zinc-500 font-normal ml-1">from scratch</span>
      </Link>
    </div>
  );
}

function SourceOption({
  id,
  label,
  sublabel,
  defaultChecked,
}: {
  id: string;
  label: string;
  sublabel: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer has-[:checked]:border-indigo-500/50 has-[:checked]:bg-indigo-500/10 transition-colors">
      <input
        type="radio"
        name="sourceDesignId"
        value={id}
        defaultChecked={defaultChecked}
        required
        className="w-4 h-4 accent-indigo-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-xs text-zinc-500 font-mono truncate">{sublabel}</div>
      </div>
    </label>
  );
}
