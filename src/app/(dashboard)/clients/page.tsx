import Link from "next/link";
import { ArrowUpRight, Sparkles, Layers, Zap, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MESH_CLASSES = ["mesh-1", "mesh-2", "mesh-3", "mesh-4", "mesh-5"];

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { designs: true } },
      designs: {
        select: { _count: { select: { variants: true } } },
      },
    },
  });

  const totalDesigns = clients.reduce((sum, c) => sum + c._count.designs, 0);
  const totalVariants = clients.reduce(
    (sum, c) => sum + c.designs.reduce((s, d) => s + d._count.variants, 0),
    0,
  );

  return (
    <div>
      {/* Hero */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-zinc-400 mb-5">
          <Sparkles className="w-3 h-3 text-fuchsia-400" />
          AI-powered landing page studio
        </div>
        <h1 className="text-5xl font-semibold tracking-tight leading-[1.05]">
          Your <span className="gradient-text">workspace</span>
        </h1>
        <p className="text-zinc-400 mt-4 text-lg max-w-2xl">
          Manage clients, spin up new designs, and ship ad variants to unique URLs in seconds.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        <StatCard icon={<Layers className="w-4 h-4" />} label="Clients" value={clients.length} accent="from-indigo-500/20 to-indigo-500/0" />
        <StatCard icon={<Zap className="w-4 h-4" />} label="Designs" value={totalDesigns} accent="from-fuchsia-500/20 to-fuchsia-500/0" />
        <StatCard icon={<Sparkles className="w-4 h-4" />} label="Variants" value={totalVariants} accent="from-emerald-500/20 to-emerald-500/0" />
      </div>

      {/* Clients */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Clients
        </h2>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
        >
          <Plus className="w-4 h-4" />
          New client
        </Link>
      </div>

      <div className="grid gap-3">
        {clients.map((c, i) => {
          const variantCount = c.designs.reduce((s, d) => s + d._count.variants, 0);
          return (
            <Link
              key={c.id}
              href={`/clients/${c.slug}`}
              className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] hover:border-white/20 transition-all ${MESH_CLASSES[i % MESH_CLASSES.length]}`}
            >
              <div className="relative p-6 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.06] flex items-center justify-center text-2xl font-semibold">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">{c.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono mt-1">/{c.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">{c._count.designs}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">designs</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold tabular-nums">{variantCount}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wider">variants</div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {clients.length === 0 && (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
            <p className="text-sm text-zinc-500">No clients yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${accent} p-5`}>
      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-3">
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}
