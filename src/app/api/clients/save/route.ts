import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name: unknown = body?.name;
  const slug: unknown = body?.slug;
  const description: unknown = body?.description;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug.trim()) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase letters, numbers, hyphens" },
      { status: 400 },
    );
  }

  const existing = await prisma.client.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: `Slug "${slug}" is taken. Pick a different one.` },
      { status: 409 },
    );
  }

  const client = await prisma.client.create({
    data: {
      slug,
      name: name.trim(),
      description: typeof description === "string" ? description : null,
    },
  });

  return NextResponse.json({ id: client.id, slug: client.slug, name: client.name });
}
