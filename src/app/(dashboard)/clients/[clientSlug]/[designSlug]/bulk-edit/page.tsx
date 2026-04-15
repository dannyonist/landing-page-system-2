import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BulkEditPanel } from "./bulk-edit-panel";

export const dynamic = "force-dynamic";

export default async function BulkEditPage({
  params,
}: {
  params: Promise<{ clientSlug: string; designSlug: string }>;
}) {
  const { clientSlug, designSlug } = await params;
  const design = await prisma.design.findFirst({
    where: { slug: designSlug, client: { slug: clientSlug } },
    include: {
      client: true,
      variants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!design) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clients/${design.client.slug}/${design.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {design.name}
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Edit all variants</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Request one change — apply it in parallel to {design.variants.length} variants.
            </p>
          </div>
        </div>
      </div>

      <BulkEditPanel
        designId={design.id}
        designName={design.name}
        clientSlug={design.client.slug}
        designSlug={design.slug}
        variants={design.variants.map((v) => ({
          id: v.id,
          name: v.name,
          slug: v.slug,
        }))}
      />
    </div>
  );
}
