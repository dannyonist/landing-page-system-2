import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wand2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PlanningChat } from "./planning-chat";

export const dynamic = "force-dynamic";

export default async function NewVariantPage({
  params,
}: {
  params: Promise<{ clientSlug: string; designSlug: string }>;
}) {
  const { clientSlug, designSlug } = await params;
  const design = await prisma.design.findFirst({
    where: { slug: designSlug, client: { slug: clientSlug } },
    include: {
      client: true,
      planningMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!design) notFound();

  // Load last proposals-bearing assistant message (if any) so user can resume.
  const lastWithProposals = [...design.planningMessages]
    .reverse()
    .find((m) => m.role === "ASSISTANT" && m.proposalsJson);
  let lastProposals: { name: string; brief: string }[] = [];
  if (lastWithProposals?.proposalsJson) {
    try {
      const parsed = JSON.parse(lastWithProposals.proposalsJson);
      if (Array.isArray(parsed)) lastProposals = parsed;
    } catch {
      // ignore
    }
  }

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Generate variants</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Strategy chat — AI proposes variants, you approve, it builds them in parallel.
            </p>
          </div>
        </div>
      </div>

      <PlanningChat
        designId={design.id}
        designName={design.name}
        clientName={design.client.name}
        clientSlug={design.client.slug}
        designSlug={design.slug}
        initialMessages={design.planningMessages.map((m) => ({
          id: m.id,
          role: m.role === "USER" ? "user" : "assistant",
          content: m.content,
        }))}
        initialProposals={lastProposals}
      />
    </div>
  );
}
