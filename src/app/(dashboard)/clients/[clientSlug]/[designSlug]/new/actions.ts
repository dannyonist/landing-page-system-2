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

export async function createVariant(designId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: { client: true },
  });
  if (!design) throw new Error("Design not found");

  // Find a unique slug for this design
  const base = slugify(name) || "variant";
  let slug = base;
  let n = 1;
  while (
    await prisma.variant.findUnique({
      where: { designId_slug: { designId, slug } },
    })
  ) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const variant = await prisma.variant.create({
    data: {
      designId,
      slug,
      name,
      html: design.baseHtml,
      createdById: session.user.id,
    },
  });

  redirect(
    `/clients/${design.client.slug}/${design.slug}/${variant.slug}/edit`,
  );
}
