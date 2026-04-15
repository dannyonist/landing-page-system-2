import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const SOURCE_ROOT =
  "C:/Users/Daniel Gargano/Documents/Claude Projects/MightyMeals Mockups";

const MIGHTYMEALS_DESCRIPTION = `MightyMeals is a chef-prepared meal delivery service. Fresh, never frozen, cooked today and delivered tomorrow — direct from the kitchen in Burke, VA.

Key differentiators vs Factor/HelloFresh:
- 24-hour fresh-to-door (not frozen from a warehouse)
- Chef-made, not reheated trays
- No subscription lock-in (pause or cancel anytime)
- Goal-based menus: Muscle / Lose / Keto / Clean
- 3-tier discount unlock: 5 meals → free delivery, 8 → $8 off, 10 → $15 off

Tone: Confident, direct, food-forward. Like talking to a chef, not a marketing department. Avoid corporate wellness copy.

Target audience: Busy Northern-Virginia / DMV-area professionals and families who want real chef food at the convenience of delivery. Weight-conscious, gym-going, often on macro-tracking plans.

NEVER claim outcome guarantees tied to refunds (no "lose 10 lbs or money back"). Use product attributes ("chef-prepared", "high-protein", "low-carb") and flexibility ("cancel anytime").

There's also an add-on line called Mighty Pets — fresh, vet-formulated meals for dogs and cats. Same freshness / delivery story, for pet parents.`;

type DesignSpec = {
  slug: string;
  name: string;
  description: string;
  folder: string;
  baseFile: string;
  variantPrefix: string;
  variants: Array<{ slug: string; name: string }>;
};

const MIGHTYMEALS_VARIANTS = [
  { slug: "keto", name: "Keto" },
  { slug: "weightloss", name: "Weight Loss" },
  { slug: "families", name: "Families" },
  { slug: "busy", name: "Busy Professionals" },
  { slug: "vegan", name: "Vegan" },
  { slug: "deal", name: "Deal Seekers" },
  { slug: "abandon", name: "Cart Abandon" },
];

const MIGHTYPETS_VARIANTS = [
  { slug: "dog", name: "Dog Owners" },
  { slug: "cat", name: "Cat Owners" },
  { slug: "senior", name: "Senior Pets" },
  { slug: "puppy", name: "Puppies" },
  { slug: "sensitive", name: "Sensitive Stomachs" },
  { slug: "bundle", name: "Multi-Pet Bundle" },
  { slug: "deal", name: "Deal Seekers" },
  { slug: "abandon", name: "Cart Abandon" },
];

const DESIGNS: DesignSpec[] = [
  {
    slug: "editorial",
    name: "Editorial",
    description: `Editorial / magazine aesthetic. Fraunces serif display + DM Sans body. Cream background (#f5f2ec) + forest-green primary (#294a3f). Targets refined upscale buyers who want premium positioning — warm, confident, food-forward. Think Bon Appétit, not weight-loss brochure.`,
    folder: "design-1-editorial",
    baseFile: "mightymeals-landing.html",
    variantPrefix: "mightymeals",
    variants: MIGHTYMEALS_VARIANTS,
  },
  {
    slug: "retail",
    name: "Retail",
    description: `Marketplace / DoorDash-style retail direction. Utility-first UI with clear pricing, speed cues, and bold yellow accents. Targets deal-seekers and utilitarian buyers — emphasizes variety, speed of delivery, and obvious value. Think Uber Eats or Walmart Plus aesthetic.`,
    folder: "design-2-retail",
    baseFile: "mightymeals-landing.html",
    variantPrefix: "mightymeals",
    variants: MIGHTYMEALS_VARIANTS,
  },
  {
    slug: "performance",
    name: "Performance",
    description: `Athletic dark-mode direction inspired by Whoop, AG1, and Gymshark. Black backgrounds, electric green accents, bold sans-serif. Targets fitness-focused, macro-counting buyers — prioritizes protein/calorie stats, "fuel" language over "meals", high-intensity tone.`,
    folder: "design-3-performance",
    baseFile: "mightymeals-landing.html",
    variantPrefix: "mightymeals",
    variants: MIGHTYMEALS_VARIANTS,
  },
  {
    slug: "pets-editorial",
    name: "Mighty Pets — Editorial",
    description: `Mighty Pets (add-on line for dogs/cats) in the same editorial aesthetic as the core Editorial direction — Fraunces + DM Sans, cream + forest green. Targets upscale pet parents who want chef-grade food for their dogs/cats. Tone matches premium meal delivery, not cutesy pet-brand copy.`,
    folder: "mightypets-editorial",
    baseFile: "mightypets-landing.html",
    variantPrefix: "mightypets",
    variants: MIGHTYPETS_VARIANTS,
  },
  {
    slug: "pets-playful",
    name: "Mighty Pets — Playful",
    description: `Mighty Pets in a BarkBox/Chewy-style playful direction. Coral + navy + butter + mint palette, Nunito body font. Targets emotionally-driven pet parents — warm, bouncy, personality-forward tone. "Mealtime, but make it happy tails" energy. Much more brand-voice than the editorial direction.`,
    folder: "mightypets-playful",
    baseFile: "mightypets-landing.html",
    variantPrefix: "mightypets",
    variants: MIGHTYPETS_VARIANTS,
  },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? "Admin";
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Seed requires ADMIN_EMAIL and ADMIN_PASSWORD env vars. Set them in .env.local before running `npm run seed`.",
    );
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, name: adminName, role: "ADMIN" },
    create: {
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "ADMIN",
    },
  });
  console.log(`✓ Admin user (${adminEmail})`);

  const client = await prisma.client.upsert({
    where: { slug: "mightymeals" },
    update: { name: "MightyMeals", description: MIGHTYMEALS_DESCRIPTION },
    create: {
      slug: "mightymeals",
      name: "MightyMeals",
      description: MIGHTYMEALS_DESCRIPTION,
    },
  });
  console.log("✓ Client: MightyMeals");

  let totalVariants = 0;
  for (const design of DESIGNS) {
    const baseHtml = readFileSync(
      join(SOURCE_ROOT, design.folder, design.baseFile),
      "utf-8",
    );
    const designRecord = await prisma.design.upsert({
      where: { clientId_slug: { clientId: client.id, slug: design.slug } },
      update: { name: design.name, description: design.description, baseHtml },
      create: {
        clientId: client.id,
        slug: design.slug,
        name: design.name,
        description: design.description,
        baseHtml,
      },
    });
    console.log(`✓ Design: ${design.name} (${(baseHtml.length / 1024).toFixed(1)}kb)`);

    for (const variant of design.variants) {
      const variantPath = join(
        SOURCE_ROOT,
        design.folder,
        `${design.variantPrefix}-${variant.slug}.html`,
      );
      const html = readFileSync(variantPath, "utf-8");
      await prisma.variant.upsert({
        where: {
          designId_slug: { designId: designRecord.id, slug: variant.slug },
        },
        update: { name: variant.name, html },
        create: {
          designId: designRecord.id,
          slug: variant.slug,
          name: variant.name,
          html,
          createdById: adminUser.id,
        },
      });
      totalVariants++;
    }
    console.log(`  + ${design.variants.length} variants`);
  }

  console.log(`\nSeed complete: ${DESIGNS.length} designs, ${totalVariants} variants.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
