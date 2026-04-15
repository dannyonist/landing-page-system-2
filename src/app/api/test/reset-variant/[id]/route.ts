import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Test-only endpoint. Resets a variant's HTML back to its design's baseHtml
// and deletes its chat history. Disabled in production.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const variant = await prisma.variant.findUnique({
    where: { id },
    include: { design: true },
  });
  if (!variant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.message.deleteMany({ where: { variantId: id } });
  await prisma.variant.update({
    where: { id },
    data: { html: variant.design.baseHtml },
  });

  return NextResponse.json({ ok: true });
}
