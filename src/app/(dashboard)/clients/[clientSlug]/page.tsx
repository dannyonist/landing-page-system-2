import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PreviewTile } from "@/components/preview-tile";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    include: {
      designs: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { variants: true } } },
      },
    },
  });
  if (!client) notFound();

  return (
    <div>
      <div className="mb-10">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All clients
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-xl font-semibold shadow-lg shadow-indigo-500/30">
            {client.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {client.designs.length} designs · {client.designs.reduce((s, d) => s + d._count.variants, 0)} variants
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Designs
        </h2>
        <Link
          href={`/clients/${client.slug}/new-design`}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
        >
          <Sparkles className="w-4 h-4" />
          New design
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {client.designs.map((d) => (
          <DesignCard
            key={d.id}
            href={`/clients/${client.slug}/${d.slug}`}
            name={d.name}
            slug={d.slug}
            variantCount={d._count.variants}
            html={d.baseHtml}
          />
        ))}
      </div>
    </div>
  );
}

async function DesignCard({
  href,
  name,
  slug,
  variantCount,
  html,
}: {
  href: string;
  name: string;
  slug: string;
  variantCount: number;
  html: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-white/[0.08] hover:border-white/20 bg-zinc-950/50 overflow-hidden transition-all hover:-translate-y-0.5"
    >
      <div className="aspect-[16/10] border-b border-white/[0.06]">
        <PreviewTile html={html} className="w-full h-full" />
      </div>
      <div className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight truncate">{name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-500 font-mono">/{slug}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-400">{variantCount} variants</span>
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors flex-shrink-0">
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
}
