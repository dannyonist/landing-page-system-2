"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function deleteVariant(variantId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    include: { design: { include: { client: true } } },
  });
  if (!variant) throw new Error("Variant not found");

  await prisma.variant.delete({ where: { id: variantId } });

  revalidatePath(
    `/clients/${variant.design.client.slug}/${variant.design.slug}`,
  );
}
