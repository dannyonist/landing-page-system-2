import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { intakeClientMessage } from "@/lib/client-intake";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message: unknown = body?.message;
  const history: unknown = body?.history;
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  if (!Array.isArray(history)) {
    return NextResponse.json({ error: "History required" }, { status: 400 });
  }

  try {
    const result = await intakeClientMessage({
      priorMessages: (
        history as Array<{ role: "user" | "assistant"; content: string }>
      ).filter(
        (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
      ),
      userMessage: message.trim(),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Client intake error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Intake failed: ${msg}` }, { status: 500 });
  }
}
