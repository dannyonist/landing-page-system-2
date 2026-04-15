import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { planVariants } from "@/lib/plan";

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

  const design = await prisma.design.findUnique({
    where: { id },
    include: {
      client: true,
      planningMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!design) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userMessage = await prisma.planningMessage.create({
    data: { designId: id, role: "USER", content: message.trim() },
  });

  try {
    const result = await planVariants({
      designName: design.name,
      designDescription: design.description,
      clientName: design.client.name,
      clientDescription: design.client.description,
      priorMessages: design.planningMessages.map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      userMessage: message.trim(),
    });

    const assistantMessage = await prisma.planningMessage.create({
      data: {
        designId: id,
        role: "ASSISTANT",
        content: result.reply,
        proposalsJson:
          result.type === "proposals" ? JSON.stringify(result.proposals) : null,
      },
    });

    return NextResponse.json({
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      ...result,
    });
  } catch (err) {
    console.error("Planner error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Planning failed: ${msg}` },
      { status: 500 },
    );
  }
}
