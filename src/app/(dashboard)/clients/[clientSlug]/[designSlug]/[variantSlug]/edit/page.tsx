import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ChatPanel } from "./chat-panel";

export const dynamic = "force-dynamic";

export default async function EditVariantPage({
  params,
}: {
  params: Promise<{ clientSlug: string; designSlug: string; variantSlug: string }>;
}) {
  const { clientSlug, designSlug, variantSlug } = await params;
  const variant = await prisma.variant.findFirst({
    where: {
      slug: variantSlug,
      design: { slug: designSlug, client: { slug: clientSlug } },
    },
    include: {
      design: { include: { client: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!variant) notFound();

  const liveUrl = `/v/${variant.design.client.slug}/${variant.design.slug}/${variant.slug}`;

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/clients/${variant.design.client.slug}/${variant.design.slug}`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {variant.design.name}
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{variant.name}</h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">{liveUrl}</p>
          </div>
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white/[0.04] border border-white/[0.06] text-sm text-zinc-300 hover:bg-white/[0.08] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View live
          </a>
        </div>
      </div>

      <ChatPanel
        variantId={variant.id}
        initialHtml={variant.html}
        initialMessages={variant.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))}
      />
    </div>
  );
}
