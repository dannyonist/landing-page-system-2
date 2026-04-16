import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateNovelDesign } from "@/lib/design-generator";
import type { DesignBrief } from "@/lib/design-intake";

export const maxDuration = 300;

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
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { slug: clientSlug } = await params;
  const body = await req.json().catch(() => ({}));
  const brief = body?.brief as DesignBrief | undefined;
  if (!brief || typeof brief !== "object") {
    return new Response("Brief required", { status: 400 });
  }
  if (
    typeof brief.name !== "string" ||
    !brief.name.trim() ||
    !Array.isArray(brief.goalCategories) ||
    brief.goalCategories.length === 0
  ) {
    return new Response("Brief missing required fields", { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    select: { id: true, slug: true, name: true, description: true },
  });
  if (!client) {
    return new Response("Client not found", { status: 404 });
  }

  const encoder = new TextEncoder();
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
        emit("status", { phase: "starting", message: "Starting novel design generation…" });

        const { html, warnings } = await generateNovelDesign({
          brief,
          clientName: client.name,
          clientBrief: client.description,
          signal: workAbort.signal,
          onProgress: (p) => {
            if (p.type === "phase") {
              const messages: Record<string, string> = {
                starting: "Preparing brief & system prompt…",
                streaming: "Claude is writing the HTML…",
                validating: "Validating structure & conversion rules…",
                retrying: "Fixing issues — retrying once…",
                saving: "Saving design…",
              };
              emit("status", { phase: p.phase, message: messages[p.phase] });
            } else if (p.type === "tokens") {
              emit("tokens", { total: p.total });
            } else if (p.type === "warning") {
              emit("warning", { message: p.message });
            }
          },
        });

        const base = slugify(brief.name) || "design";
        let designSlug = base;
        let n = 1;
        while (
          await prisma.design.findUnique({
            where: { clientId_slug: { clientId: client.id, slug: designSlug } },
          })
        ) {
          n += 1;
          designSlug = `${base}-${n}`;
        }

        const design = await prisma.design.create({
          data: {
            clientId: client.id,
            slug: designSlug,
            name: brief.name.trim(),
            description: brief.description,
            baseHtml: html,
          },
        });

        if (warnings.length > 0) {
          emit("warning", {
            message: `Generated with ${warnings.length} unresolved issue(s): ${warnings.join("; ")}`,
          });
        }

        emit("done", {
          designId: design.id,
          designSlug: design.slug,
          clientSlug: client.slug,
          warnings,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Novel design generation failed:", msg);
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
