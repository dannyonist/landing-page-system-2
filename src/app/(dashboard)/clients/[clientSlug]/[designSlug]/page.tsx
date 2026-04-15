import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Sparkles, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { VariantCard } from "./variant-card";

export const dynamic = "force-dynamic";

export default async function DesignPage({
  params,
}: {
  params: Promise<{ clientSlug: string; designSlug: string }>;
}) {
  const { clientSlug, designSlug } = await params;
  const design = await prisma.design.findFirst({
    where: { slug: designSlug, client: { slug: clientSlug } },
    include: {
      client: true,
      variants: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!design) notFound();

  return (
    <div>
      <div className="mb-10">
        <Link
          href={`/clients/${design.client.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {design.client.name}
        </Link>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{design.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {design.variants.length} ad variants · each gets its own public URL
            </p>
          </div>
          <div className="flex items-center gap-2">
            {design.variants.length > 0 && (
              <Link
                href={`/clients/${design.client.slug}/${design.slug}/bulk-edit`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-sm text-zinc-300 hover:bg-white/[0.08] transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
                Edit all variants
              </Link>
            )}
            <Link
              href={`/clients/${design.client.slug}/${design.slug}/new`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Generate variants
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {design.variants.map((v) => (
          <VariantCard
            key={v.id}
            id={v.id}
            name={v.name}
            slug={v.slug}
            html={v.html}
            clientSlug={design.client.slug}
            designSlug={design.slug}
          />
        ))}

        {design.variants.length === 0 && (
          <div className="col-span-full text-center py-20 border border-dashed border-white/10 rounded-2xl">
            <Sparkles className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
            <p className="text-sm text-zinc-500 mb-4">
              No variants yet for this design.
            </p>
            <Link
              href={`/clients/${design.client.slug}/${design.slug}/new`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/30"
            >
              <Plus className="w-4 h-4" />
              Create first variant
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
