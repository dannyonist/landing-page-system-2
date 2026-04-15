import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateVariantResponse } from "@/lib/generate";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const message: unknown = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const variant = await prisma.variant.findUnique({
    where: { id },
    include: {
      design: { include: { client: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!variant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userMessage = await prisma.message.create({
    data: { variantId: id, role: "USER", content: message.trim() },
  });

  // Abort the Claude call if the client disconnects OR 55s passes (under Vercel 60s maxDuration).
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());
  const timeoutHandle = setTimeout(() => abort.abort(), 55_000);

  try {
    const { reply, html, appliedEdits, failedFinds } = await generateVariantResponse({
      currentHtml: variant.html,
      priorMessages: variant.messages.map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      userMessage: message.trim(),
      designName: variant.design.name,
      designDescription: variant.design.description,
      clientName: variant.design.client.name,
      clientDescription: variant.design.client.description,
      signal: abort.signal,
    });

    const assistantMessage = await prisma.message.create({
      data: { variantId: id, role: "ASSISTANT", content: reply },
    });

    if (html) {
      await prisma.variant.update({
        where: { id },
        data: { html },
      });
    }

    return NextResponse.json({
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      reply,
      html,
      appliedEdits,
      failedFinds,
    });
  } catch (err) {
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || /abort/i.test(err.message));
    console.error("Claude generation error:", err);
    const msg = isAbort
      ? "Request timed out. Try again with a more specific prompt."
      : err instanceof Error
        ? err.message
        : "Unknown error";
    return NextResponse.json(
      { error: `Generation failed: ${msg}` },
      { status: isAbort ? 504 : 500 },
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}
