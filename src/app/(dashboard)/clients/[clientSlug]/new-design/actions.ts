"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

export async function createDesignFromSource(
  clientId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") || "").trim();
  const sourceDesignId = String(formData.get("sourceDesignId") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!name || !sourceDesignId) {
    throw new Error("Name and source design required");
  }

  const [client, source] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.design.findUnique({ where: { id: sourceDesignId } }),
  ]);
  if (!client) throw new Error("Client not found");
  if (!source) throw new Error("Source design not found");

  const base = slugify(name) || "design";
  let slug = base;
  let n = 1;
  while (
    await prisma.design.findUnique({
      where: { clientId_slug: { clientId, slug } },
    })
  ) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const design = await prisma.design.create({
    data: {
      clientId,
      slug,
      name,
      description: description || source.description,
      baseHtml: source.baseHtml,
    },
  });

  redirect(`/clients/${client.slug}/${design.slug}`);
}
