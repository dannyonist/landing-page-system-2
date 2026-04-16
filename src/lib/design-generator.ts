import { anthropic, MODELS } from "@/lib/anthropic";
import type { DesignBrief } from "@/lib/design-intake";

const CURATED_FOOD_IMAGES: string[] = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1432139509613-5c4255815697?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=352&h=272&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=352&h=272&q=85&auto=format&fit=crop",
];

const HERO_IMAGES: string[] = [
  "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1200&h=800&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=1200&h=800&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&h=800&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=1200&h=800&q=85&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=1200&h=800&q=85&auto=format&fit=crop",
];

function buildSystemPrompt(brief: DesignBrief, clientName: string, clientBrief: string | null): string {
  return `You are the GENERATOR AI in a landing-page studio. You are about to produce a COMPLETE, NOVEL, single-file HTML landing page from scratch for the client "${clientName}".

This is NOT a duplicate of an existing design. You are inventing the layout, the section flow, the card treatment, the micro-interactions — every visual choice — based on the brief below. Be ambitious. Make it impressive.

# Output contract — MANDATORY

Output a single complete HTML document from \`<!DOCTYPE html>\` to \`</html>\`. Nothing before, nothing after. No code fences. No commentary.

Structure:
- \`<head>\`: viewport meta, title, Google Fonts \`<link>\` for the typography pair, a single inline \`<style>\` block containing \`:root\` tokens and all page CSS.
- \`<body>\`: all sections in the order specified by the brief's \`sectionOrder\`.
- A single inline \`<script>\` block at the end of \`<body>\` containing: the MEALS data object, selectGoal/addToCart/renderMeals/refreshCartUI/refreshUnlockBar functions, IntersectionObserver for \`.reveal\` elements.

# Required interactive contract (DO NOT omit, DO NOT rename)

The inline script MUST declare a top-level const named exactly \`MEALS\` with the following shape (so future AI edits can find and update it):

\`\`\`js
const MEALS = {
  "${brief.goalCategories[0]?.key ?? "goal-1"}": [ /* 4-6 meal objects */ ],
  ${brief.goalCategories
    .slice(1)
    .map((g) => `"${g.key}": [ /* 4-6 meal objects */ ]`)
    .join(",\n  ")}
};
\`\`\`

Each meal object has EXACTLY these keys: \`{ id, name, img, protein, cal, carbs, price, badge, badgeClass }\`. Example:
\`{ id: "grilled-salmon", name: "Grilled Salmon Bowl", img: "<from curated list>", protein: "42g", cal: "480", carbs: "38g", price: 11.99, badge: "Best seller", badgeClass: "badge-green" }\`

Functions that MUST exist and MUST work:
- \`selectGoal(key)\` — updates the meals header, calls \`renderMeals(MEALS[key])\`, toggles \`is-active\` on the clicked goal card, sets \`aria-checked\`.
- \`renderMeals(mealsArray)\` — rebuilds the meal grid container's innerHTML.
- \`addToCart(id)\` — adds a meal to the cart state, calls \`refreshCartUI()\` and \`refreshUnlockBar()\`.
- \`refreshCartUI()\` — updates both mobile sticky bar price and desktop cart panel totals.
- \`refreshUnlockBar()\` — updates the 3-tier unlock bar fill and tier states (is-done / is-active).
- IntersectionObserver that adds \`is-visible\` to elements with class \`reveal\`.

Cart state: \`let cart = { items: {}, mealCount: 0, total: 0 };\` in-memory.

Unlock bar tiers (hardcoded, these are the conversion mechanic):
- 5 meals → free delivery
- 8 meals → $8 off
- 10 meals → $15 off total

# Conversion rules — NON-NEGOTIABLE

These sections MUST appear with these behaviors:

1. **Urgency banner** — fixed or at the very top, always visible, never dismissible. Discount is "already applied", NOT a coupon code.
2. **Nav** — logo + rating stars only. NO nav links. NO hamburger. NO "menu". Every extra link is an exit ramp.
3. **Hero** — headline + subhead + primary CTA.
4. **Freshness strip** — directly after hero. Must mention freshness (never frozen, made fresh, delivered within X days, etc). This is the #1 competitive differentiator.
5. **Goal selector** — ${brief.goalCategories.length} goal cards. One has class \`is-active\` by default.
6. **Meal grid** — renders meals from MEALS[activeGoal]. Style: ${brief.mealGridStyle}.
7. **Unlock bar** — 3 tiers as above. Placed BETWEEN meal grid and social proof.
8. **Social proof** — reviews, stats, logos, or testimonials.
9. **Sticky checkout bar (mobile)** — \`position: sticky; bottom: 0\`. Shows cart count, total, Apple Pay + Google Pay buttons visibly (not hidden behind "more options"). Desktop can show the cart as a fixed side panel at ≥940px.
10. **Footer** — minimal.

# Copy rules — LEGAL/COMPLIANCE

NEVER write outcome-guarantee copy tied to refunds (no "X result in Y days or money back", no "guaranteed weight loss"). Use product-attribute claims ("chef-prepared", "never frozen", "high protein") and general flexibility ("cancel anytime", "pause anytime").

# Images

You MUST ONLY use image URLs from this curated list. Do NOT invent Unsplash photo IDs — they will 404.

Meal card images (pick any, repeat if needed):
${CURATED_FOOD_IMAGES.map((u) => `- ${u}`).join("\n")}

Hero photos (use 0–1 depending on hero style):
${HERO_IMAGES.map((u) => `- ${u}`).join("\n")}

# Design tokens — USE THESE EXACT HEX VALUES IN :root

\`\`\`css
:root {
  --bg: ${brief.palette.bg};
  --surface: ${brief.palette.surface};
  --ink: ${brief.palette.ink};
  --ink2: ${brief.palette.ink2};
  --primary: ${brief.palette.primary};
  --primary-dark: ${brief.palette.primaryDark};
  --accent: ${brief.palette.accent};
  --amber: ${brief.palette.amber};
  --line: ${brief.palette.line};
  --ff-display: "${brief.typography.display}", serif;
  --ff-body: "${brief.typography.body}", sans-serif;
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 24px; --r-2xl: 32px;
}
\`\`\`

Load both fonts in \`<head>\`: \`<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(brief.typography.display)}:wght@400;500;600;700&family=${encodeURIComponent(brief.typography.body)}:wght@400;500;600;700&display=swap" rel="stylesheet">\`

Display font for h1/h2/section headings. Body font for everything else.

# CSS naming

BEM-style: \`.block__element\`, \`.block--modifier\`, state classes \`is-active\`, \`is-visible\`, \`is-done\`, \`is-added\`. No raw \`border-radius\` values — always use \`var(--r-*)\`.

# Mobile-first

The page is primarily served to cold paid-ad traffic on mobile. Build mobile-first. Use media queries at 940px for desktop enhancements (side cart panel, larger type).

# BE NOVEL

Within the structural contract, invent the visual treatment. Surprise the viewer. The user wants an IMPRESSIVE design. Unusual type pairings, unexpected micro-interactions, confident white space, considered color use, distinctive card shapes, memorable hero moments — these are all encouraged. Don't produce generic SaaS chrome.`;
}

function buildUserPrompt(brief: DesignBrief, clientName: string, clientBrief: string | null): string {
  return `# Generate this design now

**Client**: ${clientName}
${clientBrief ? `\n**Client brief** (permanent context):\n${clientBrief}\n` : ""}

**Design name**: ${brief.name}
**Description**: ${brief.description}
**Audience**: ${brief.audience}
**Vibe**: ${brief.vibe}

**Typography**: ${brief.typography.display} (display) + ${brief.typography.body} (body)
**Hero style**: ${brief.heroStyle}
**Hero headline**: ${brief.heroHeadline}
**Hero subhead**: ${brief.heroSub}

**Section order**: ${brief.sectionOrder.join(" → ")}

**Goal categories** (these become MEALS keys):
${brief.goalCategories.map((g) => `- \`${g.key}\` — "${g.label}" — ${g.description}`).join("\n")}

**Meal grid style**: ${brief.mealGridStyle}

**Visual notes**: ${brief.visualNotes}

Now generate the complete HTML. Make it genuinely impressive. Start with \`<!DOCTYPE html>\`.`;
}

export type GenerateProgress =
  | { type: "phase"; phase: "starting" | "streaming" | "validating" | "retrying" | "saving" }
  | { type: "tokens"; total: number }
  | { type: "warning"; message: string };

export async function generateNovelDesign({
  brief,
  clientName,
  clientBrief,
  signal,
  onProgress,
}: {
  brief: DesignBrief;
  clientName: string;
  clientBrief: string | null;
  signal?: AbortSignal;
  onProgress?: (p: GenerateProgress) => void;
}): Promise<{ html: string; warnings: string[] }> {
  onProgress?.({ type: "phase", phase: "starting" });

  const system = buildSystemPrompt(brief, clientName, clientBrief);
  const userPrompt = buildUserPrompt(brief, clientName, clientBrief);

  const warnings: string[] = [];

  async function runGeneration(extraUserNote?: string): Promise<string> {
    onProgress?.({ type: "phase", phase: "streaming" });
    const messages = [
      {
        role: "user" as const,
        content: extraUserNote ? `${userPrompt}\n\n---\n${extraUserNote}` : userPrompt,
      },
    ];

    const stream = anthropic.messages.stream(
      {
        model: MODELS.SONNET,
        max_tokens: 32000,
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages,
      },
      { signal },
    );

    let emittedTokens = 0;
    stream.on("text", (delta) => {
      emittedTokens += Math.max(1, Math.round(delta.length / 4));
      onProgress?.({ type: "tokens", total: emittedTokens });
    });

    const response = await stream.finalMessage();
    const textBlocks = response.content.filter((c) => c.type === "text") as Array<{
      type: "text";
      text: string;
    }>;
    return textBlocks.map((b) => b.text).join("");
  }

  let raw = await runGeneration();
  let html = extractHtml(raw);

  onProgress?.({ type: "phase", phase: "validating" });
  let issues = validateHtml(html, brief);

  if (issues.length > 0) {
    onProgress?.({ type: "phase", phase: "retrying" });
    const feedback = `Your previous output had these problems — fix them in the next response. Output the COMPLETE corrected HTML again from \`<!DOCTYPE html>\` to \`</html>\`:\n\n${issues.map((i) => `- ${i}`).join("\n")}`;
    raw = await runGeneration(feedback);
    html = extractHtml(raw);
    issues = validateHtml(html, brief);
    if (issues.length > 0) {
      warnings.push(...issues);
    }
  }

  onProgress?.({ type: "phase", phase: "saving" });
  return { html, warnings };
}

function extractHtml(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const docIdx = trimmed.toLowerCase().indexOf("<!doctype html");
  if (docIdx > 0) return trimmed.slice(docIdx);
  return trimmed;
}

function validateHtml(html: string, brief: DesignBrief): string[] {
  const issues: string[] = [];
  const lower = html.toLowerCase();

  if (!lower.startsWith("<!doctype html")) {
    issues.push("Missing <!DOCTYPE html> at the start of output.");
  }
  if (!lower.includes("</html>")) {
    issues.push("Missing closing </html> tag.");
  }
  if (!html.includes("const MEALS")) {
    issues.push("Missing `const MEALS = {...}` declaration — required for the editor AI to update meal data.");
  } else {
    for (const g of brief.goalCategories) {
      if (!html.includes(`"${g.key}"`) && !html.includes(`'${g.key}'`) && !new RegExp(`\\b${g.key.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*:`).test(html)) {
        issues.push(`MEALS object missing key "${g.key}" from goalCategories.`);
      }
    }
  }
  for (const fn of ["selectGoal", "addToCart", "renderMeals", "refreshCartUI", "refreshUnlockBar"]) {
    if (!new RegExp(`function\\s+${fn}\\b`).test(html) && !new RegExp(`${fn}\\s*=\\s*(function|\\()`).test(html)) {
      issues.push(`Missing required JS function \`${fn}\`.`);
    }
  }
  if (!html.includes("IntersectionObserver")) {
    issues.push("Missing IntersectionObserver for .reveal scroll animations.");
  }
  if (!/sticky|position:\s*sticky/i.test(html)) {
    issues.push("Missing sticky checkout bar (`position: sticky`).");
  }
  if (!/apple\s*pay/i.test(html) || !/google\s*pay/i.test(html)) {
    issues.push("Sticky checkout must visibly include both Apple Pay and Google Pay.");
  }

  return issues;
}
