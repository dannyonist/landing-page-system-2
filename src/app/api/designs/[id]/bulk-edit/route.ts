import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateVariantResponse } from "@/lib/generate";

export const maxDuration = 60;

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
  const message: unknown = body?.message;
  const variantIds: unknown = body?.variantIds;
  if (typeof message !== "string" || !message.trim()) {
    return new Response("Message required", { status: 400 });
  }

  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      client: true,
      variants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!design) {
    return new Response("Not found", { status: 404 });
  }

  const targets =
    Array.isArray(variantIds) && variantIds.length > 0
      ? design.variants.filter((v) => variantIds.includes(v.id))
      : design.variants;

  if (targets.length === 0) {
    return new Response("No variants to edit", { status: 400 });
  }

  const encoder = new TextEncoder();
  const userMessage = message.trim();

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
        emit("status", {
          message: `Applying edit to ${targets.length} variants in parallel…`,
        });

        await Promise.all(
          targets.map(async (variant) => {
            if (closed || workAbort.signal.aborted) return;
            emit("variant_started", {
              id: variant.id,
              slug: variant.slug,
              name: variant.name,
            });
            try {
              await prisma.message.create({
                data: {
                  variantId: variant.id,
                  role: "USER",
                  content: `[BULK] ${userMessage}`,
                },
              });

              const { reply, html, appliedEdits, failedFinds } = await generateVariantResponse({
                currentHtml: variant.html,
                priorMessages: [],
                userMessage,
                designName: design.name,
                designDescription: design.description,
                clientName: design.client.name,
                clientDescription: design.client.description,
                signal: workAbort.signal,
              });

              await prisma.message.create({
                data: { variantId: variant.id, role: "ASSISTANT", content: reply },
              });

              if (html) {
                await prisma.variant.update({
                  where: { id: variant.id },
                  data: { html },
                });
              }

              emit("variant_done", {
                id: variant.id,
                slug: variant.slug,
                name: variant.name,
                appliedEdits,
                hasHtml: !!html,
                failedFinds: failedFinds.length,
              });
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Unknown error";
              console.error(`Bulk edit failed for ${variant.slug}:`, msg);
              emit("variant_failed", {
                id: variant.id,
                slug: variant.slug,
                name: variant.name,
                error: msg,
              });
            }
          }),
        );

        emit("done", { clientSlug: design.client.slug, designSlug: design.slug });
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
