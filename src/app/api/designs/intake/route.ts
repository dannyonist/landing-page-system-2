import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { intakeDesignMessage } from "@/lib/design-intake";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message: unknown = body?.message;
  const history: unknown = body?.history;
  const clientSlug: unknown = body?.clientSlug;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (!Array.isArray(history)) {
    return NextResponse.json({ error: "History required" }, { status: 400 });
  }
  if (typeof clientSlug !== "string" || !clientSlug.trim()) {
    return NextResponse.json({ error: "Client slug required" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    select: { id: true, name: true, description: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  try {
    const result = await intakeDesignMessage({
      priorMessages: (
        history as Array<{ role: "user" | "assistant"; content: string }>
      ).filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      ),
      userMessage: message.trim(),
      clientName: client.name,
      clientDescription: client.description,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Design intake error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Intake failed: ${msg}` },
      { status: 500 },
    );
  }
}
