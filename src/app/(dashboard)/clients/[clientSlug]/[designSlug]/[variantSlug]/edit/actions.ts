"use server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function saveVariantHtml(variantId: string, html: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await prisma.variant.update({
    where: { id: variantId },
    data: { html },
  });
}
