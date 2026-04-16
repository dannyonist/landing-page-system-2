import { anthropic, MODELS } from "@/lib/anthropic";

const INTAKE_SYSTEM_PROMPT = `You are helping a marketer create a BRAND NEW landing-page design from scratch for a client in Danny's agency studio. A design is a visual direction (like "Editorial", "Retail", "Performance") — it will spawn many ad variants later. Your job is to interview the user, then produce a structured design brief that the generation AI will use to write a complete, novel landing page.

This is a NOVEL design — not a duplicate. You are defining the visual direction, not tweaking an existing one.

Interview flow:
1. Ask focused questions to gather what the generator needs.
2. When you have enough info (usually 2-4 turns), call \`finalize_design_brief\` with the full structured brief.

What you need to collect:
- **Design name** (e.g. "Holiday Promo", "Athlete Performance", "Luxury Editorial")
- **Short description** — 1–2 sentences on the visual direction
- **Audience** — who this specific design targets (may be a subset of the client's overall audience)
- **Vibe / mood** — 3–6 adjectives (e.g. "premium, slow, editorial, warm, confident")
- **Typography pair** — Google Fonts. One display font, one body font. If the user is non-specific, suggest something that fits the vibe.
- **Color palette** — brand primary, surface/background, ink/text, and an accent. Hex codes. If unsure, propose a palette that matches the vibe and get user confirmation.
- **Hero style** — one of: editorial-serif (big serif headline, cream bg, single hero photo), bold-poster (massive sans headline, dense, punchy), split-image (photo left, copy right), full-bleed-photo (photo background, overlay text), athletic-dark (dark mode, neon accent), or freeform
- **Hero copy** — a proposed headline + subhead (the user can tweak later)
- **Section order** — from: urgency-banner, nav, hero, freshness-strip, goal-selector, meal-grid, unlock-bar, proof, how-it-works, faq, footer-cta, footer. The first four and last few are usually fixed; middle sections can reorder.
- **Goal categories** — the meal-filter tabs (e.g. "Build muscle", "Lose fat"). Usually 3–5. These become keys in the MEALS data object. Match the client's offer.
- **Meal grid style** — horizontal-scroll, grid-3col, grid-4col, masonry
- **Visual notes** — photography treatment, iconography, animation preferences

Be concise — 2-4 questions per turn max. Paraphrase what you heard to confirm. Never fabricate — if the user didn't specify a font or color, ASK or PROPOSE with rationale before finalizing.

IMPORTANT: Every design MUST respect these hard conversion rules (do not remove from the brief):
- Urgency banner at top, always visible, never dismissible
- Stripped nav: logo + rating only, no links
- Freshness strip directly after hero (competitive differentiator)
- Three-tier unlock/discount bar between meal grid and social proof
- Sticky checkout bar on mobile with Apple Pay + Google Pay visible
- No outcome-guarantee copy tied to refunds

Section order and visual treatment can change. These conversion landmarks cannot.`;

const FINALIZE_TOOL = {
  name: "finalize_design_brief",
  description:
    "Call this when the interview has produced enough information to generate a complete, novel landing-page design. Returns a draft brief for the user to review before generation.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Design name for the studio UI (e.g. 'Holiday Promo', 'Athletic Dark').",
      },
      description: {
        type: "string",
        description:
          "One-paragraph summary of the visual direction. Saved as Design.description and used as permanent AI context for future variants.",
      },
      audience: {
        type: "string",
        description: "Who this specific design targets.",
      },
      vibe: {
        type: "string",
        description: "3–6 adjectives describing the mood, comma-separated.",
      },
      typography: {
        type: "object",
        properties: {
          display: {
            type: "string",
            description: "Google Font name for display (headings). e.g. 'Fraunces', 'Playfair Display', 'Space Grotesk'.",
          },
          body: {
            type: "string",
            description: "Google Font name for body text. e.g. 'DM Sans', 'Inter', 'Nunito'.",
          },
        },
        required: ["display", "body"],
      },
      palette: {
        type: "object",
        description: "Hex color codes. No named colors, no rgb() strings.",
        properties: {
          bg: { type: "string", description: "Page background hex." },
          surface: { type: "string", description: "Card/input surface hex." },
          ink: { type: "string", description: "Primary body text hex." },
          ink2: { type: "string", description: "Secondary text hex." },
          primary: { type: "string", description: "Brand primary hex — used on CTAs and accents." },
          primaryDark: { type: "string", description: "Darker primary for hover/emphasis." },
          accent: { type: "string", description: "Secondary accent color hex." },
          amber: { type: "string", description: "Star-rating gold/amber hex." },
          line: { type: "string", description: "Border/divider color hex." },
        },
        required: ["bg", "surface", "ink", "ink2", "primary", "primaryDark", "accent", "amber", "line"],
      },
      heroStyle: {
        type: "string",
        enum: [
          "editorial-serif",
          "bold-poster",
          "split-image",
          "full-bleed-photo",
          "athletic-dark",
          "freeform",
        ],
      },
      heroHeadline: { type: "string" },
      heroSub: { type: "string" },
      sectionOrder: {
        type: "array",
        items: { type: "string" },
        description:
          "Ordered list of section ids. Must include: urgency-banner, nav, hero, freshness-strip, goal-selector, meal-grid, unlock-bar, proof, footer. May include: how-it-works, faq, footer-cta, testimonials.",
      },
      goalCategories: {
        type: "array",
        description: "3–5 meal-filter categories that become keys in the MEALS data object.",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "kebab-case key, e.g. 'build-muscle'. Used as the MEALS object key.",
            },
            label: { type: "string", description: "Display label, e.g. 'Build muscle'." },
            description: {
              type: "string",
              description: "One-line subtitle shown on the goal card.",
            },
          },
          required: ["key", "label", "description"],
        },
      },
      mealGridStyle: {
        type: "string",
        enum: ["horizontal-scroll", "grid-3col", "grid-4col", "masonry"],
      },
      visualNotes: {
        type: "string",
        description:
          "Free-form notes on photography treatment, iconography, animation, unique visual moments. The generator AI reads this verbatim.",
      },
    },
    required: [
      "name",
      "description",
      "audience",
      "vibe",
      "typography",
      "palette",
      "heroStyle",
      "heroHeadline",
      "heroSub",
      "sectionOrder",
      "goalCategories",
      "mealGridStyle",
      "visualNotes",
    ],
  },
};

type IntakeMessage = { role: "user" | "assistant"; content: string };

export type DesignBrief = {
  name: string;
  description: string;
  audience: string;
  vibe: string;
  typography: { display: string; body: string };
  palette: {
    bg: string;
    surface: string;
    ink: string;
    ink2: string;
    primary: string;
    primaryDark: string;
    accent: string;
    amber: string;
    line: string;
  };
  heroStyle:
    | "editorial-serif"
    | "bold-poster"
    | "split-image"
    | "full-bleed-photo"
    | "athletic-dark"
    | "freeform";
  heroHeadline: string;
  heroSub: string;
  sectionOrder: string[];
  goalCategories: { key: string; label: string; description: string }[];
  mealGridStyle: "horizontal-scroll" | "grid-3col" | "grid-4col" | "masonry";
  visualNotes: string;
};

export type DesignIntakeResult =
  | { type: "reply"; reply: string }
  | { type: "finalized"; reply: string; brief: DesignBrief };

export async function intakeDesignMessage({
  priorMessages,
  userMessage,
  clientName,
  clientDescription,
}: {
  priorMessages: IntakeMessage[];
  userMessage: string;
  clientName: string;
  clientDescription: string | null;
}): Promise<DesignIntakeResult> {
  const clientContext = `\n\n---\nCLIENT CONTEXT (this design is for this client):\n**${clientName}**\n${clientDescription || "(no brief yet)"}\n---`;

  const messages = [
    ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const stream = anthropic.messages.stream({
    model: MODELS.SONNET,
    max_tokens: 4000,
    system: [
      {
        type: "text",
        text: INTAKE_SYSTEM_PROMPT + clientContext,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [FINALIZE_TOOL],
    messages,
  });
  const response = await stream.finalMessage();

  const textBlocks = response.content.filter((c) => c.type === "text") as Array<{
    type: "text";
    text: string;
  }>;
  const toolUse = response.content.find((c) => c.type === "tool_use") as
    | { type: "tool_use"; name: string; input: unknown; id: string }
    | undefined;

  const reply = textBlocks.map((b) => b.text).join("\n\n").trim();

  if (toolUse && toolUse.name === "finalize_design_brief") {
    const brief = toolUse.input as DesignBrief;
    return {
      type: "finalized",
      reply:
        reply ||
        `Here's the brief for **${brief.name}**. Review it and click **Generate design** when ready — I'll build the full page.`,
      brief,
    };
  }

  return { type: "reply", reply: reply || "…" };
}
