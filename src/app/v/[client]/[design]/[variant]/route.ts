import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ client: string; design: string; variant: string }> },
) {
  const { client, design, variant } = await params;
  const v = await prisma.variant.findFirst({
    where: {
      slug: variant,
      design: { slug: design, client: { slug: client } },
    },
    select: { html: true },
  });
  if (!v) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(v.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
