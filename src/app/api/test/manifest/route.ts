import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Dev-only. Returns the full client/design/variant tree so E2E tests can
// iterate over everything without hardcoding names.
// Auth check skipped on this endpoint since it's gated by NODE_ENV.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      designs: {
        orderBy: { createdAt: "asc" },
        include: {
          variants: {
            orderBy: { createdAt: "asc" },
            select: { id: true, slug: true, name: true },
          },
        },
      },
    },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      designs: c.designs.map((d) => ({
        id: d.id,
        slug: d.slug,
        name: d.name,
        variants: d.variants,
      })),
    })),
  });
}
