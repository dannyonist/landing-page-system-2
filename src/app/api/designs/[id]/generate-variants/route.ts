import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateVariantResponse } from "@/lib/generate";

export const maxDuration = 60;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: designId } = await params;
  const body = await req.json().catch(() => ({}));
  const proposals = body?.proposals;
  if (!Array.isArray(proposals) || proposals.length === 0) {
    return new Response("Proposals required", { status: 400 });
  }
  if (proposals.length > 5) {
    return new Response("Max 5 variants per batch", { status: 400 });
  }

  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { client: true },
  });
  if (!design) {
    return new Response("Not found", { status: 404 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  // Propagate client disconnect to Claude calls so they abort cheaply.
  const workAbort = new AbortController();
  req.signal.addEventListener("abort", () => workAbort.abort());

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        emit("status", { step: "creating", message: `Reserving ${proposals.length} variant slots…` });
        const created: Array<{ id: string; slug: string; name: string; brief: string }> = [];
        for (const p of proposals) {
          if (typeof p?.name !== "string" || typeof p?.brief !== "string") continue;
          const name = p.name.trim();
          const brief = p.brief.trim();
          if (!name || !brief) continue;

          const base = slugify(name) || "variant";
          let slug = base;
          let n = 1;
          while (
            await prisma.variant.findUnique({
              where: { designId_slug: { designId, slug } },
            })
          ) {
            n += 1;
            slug = `${base}-${n}`;
          }

          const v = await prisma.variant.create({
            data: {
              designId,
              slug,
              name,
              html: design.baseHtml,
              createdById: userId,
            },
          });
          created.push({ id: v.id, slug: v.slug, name: v.name, brief });
          emit("variant_created", { id: v.id, slug: v.slug, name: v.name });
        }

        emit("status", {
          step: "generating",
          message: `Generating HTML for ${created.length} variants in parallel…`,
        });

        await Promise.all(
          created.map(async (v) => {
            if (closed || workAbort.signal.aborted) return;
            emit("variant_started", { id: v.id, slug: v.slug, name: v.name });
            try {
              await prisma.message.create({
                data: { variantId: v.id, role: "USER", content: v.brief },
              });
              const { reply, html, appliedEdits } = await generateVariantResponse({
                currentHtml: design.baseHtml,
                priorMessages: [],
                userMessage: v.brief,
                designName: design.name,
                designDescription: design.description,
                clientName: design.client.name,
                clientDescription: design.client.description,
                signal: workAbort.signal,
              });
              await prisma.message.create({
                data: { variantId: v.id, role: "ASSISTANT", content: reply },
              });
              if (html) {
                await prisma.variant.update({
                  where: { id: v.id },
                  data: { html },
                });
              }
              emit("variant_done", {
                id: v.id,
                slug: v.slug,
                name: v.name,
                appliedEdits,
                hasHtml: !!html,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              console.error(`Gen failed for ${v.slug}:`, msg);
              emit("variant_failed", { id: v.id, slug: v.slug, name: v.name, error: msg });
            }
          }),
        );

        emit("done", {
          clientSlug: design.client.slug,
          designSlug: design.slug,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        emit("error", { message: msg });
      } finally {
        close();
      }
    },
    cancel() {
      workAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
