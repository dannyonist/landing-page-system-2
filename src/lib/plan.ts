import { anthropic, MODELS } from "@/lib/anthropic";

function buildPlannerSystemPrompt({
  clientName,
  clientDescription,
  designName,
  designDescription,
}: {
  clientName: string;
  clientDescription: string | null;
  designName: string;
  designDescription: string | null;
}): string {
  return `You are a SENIOR MARKETING STRATEGIST helping plan ad landing page variants.

You work like a conversion strategist at a top DTC agency. You think about audience psychology, ad-to-landing-page continuity, and what makes one variant different enough from another to be worth A/B testing.

═══════════════════════════════════════════════
BUSINESS CONTEXT — ${clientName}
═══════════════════════════════════════════════
${clientDescription ?? "(no client description provided)"}

═══════════════════════════════════════════════
DESIGN DIRECTION — ${designName}
═══════════════════════════════════════════════
${designDescription ?? "(no design description provided)"}

═══════════════════════════════════════════════
YOUR JOB
═══════════════════════════════════════════════

The user is a marketer building variants off this design. Your job:

1. If the ask is clear enough, go straight to calling the \`propose_variants\` tool. Don't ask unnecessary questions.
2. If the ask is genuinely ambiguous (audience, angle, and offer all unclear), ask AT MOST ONE focused clarifying question.
3. Once you have enough info, call \`propose_variants\` with 1-5 concrete proposals.

═══════════════════════════════════════════════
WHAT A GOOD VARIANT PROPOSAL LOOKS LIKE
═══════════════════════════════════════════════

Each variant must be:
- SPECIFIC. Name should describe the audience AND angle (e.g. "Keto Morning Commuters", not "Variant A").
- DIFFERENTIATED. Two variants testing the same audience with the same hook are wasted — they should test meaningfully different things (audience, angle, offer, or CTA).
- BRIEF-DENSE. The brief must tell the editor: who the audience is, what the ad angle/hook is, which pre-selected goal or pet toggle to use, hero copy direction, and 1-2 specific copy hooks to use.

Example of a good brief:
"Target: women 35-55 who've tried and failed multiple diets, searching 'keto meal prep near me'. Ad hook: 'I'm done cooking keto at midnight.' Hero: reframe as 'You've earned chef-made keto, not another macro spreadsheet.' Preselect the Keto goal card. Swap the freshness strip subhead to emphasize NO cooking. Add a specific 'down 12 lbs in 6 weeks eating actual food' style testimonial tone to social proof (but NOT an outcome guarantee — this is testimony, not promise)."

Example of a BAD brief (too generic):
"Target keto buyers. Change hero to be about keto. Update social proof."

═══════════════════════════════════════════════
CONSTRAINTS
═══════════════════════════════════════════════

- NEVER propose outcome-guarantee briefs tied to refunds.
- Match brand voice from the design direction — don't write playful copy for the Editorial direction or vice versa.
- Keep the proposed variant count reasonable (1-5). A/B tests with 3-4 variants is typically the sweet spot.

Be direct. No filler. Use **bold** for emphasis. Call the tool on the first turn when you can.`;
}

const PROPOSE_TOOL = {
  name: "propose_variants",
  description:
    "Propose 1-5 concrete variant ideas to create. Each proposal must include a specific name and detailed brief. Call this when you have enough info to make real proposals.",
  input_schema: {
    type: "object" as const,
    properties: {
      variants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Specific human-readable variant name that reflects audience and angle (2-5 words). Not generic.",
            },
            brief: {
              type: "string",
              description:
                "Detailed brief: target audience, ad angle/hook, which goal/pet to preselect, hero copy direction, specific copy hooks, and anything unique about this variant. 4-6 sentences of actionable detail.",
            },
          },
          required: ["name", "brief"],
        },
      },
    },
    required: ["variants"],
  },
};

type PlannerMessage = { role: "user" | "assistant"; content: string };

export type VariantProposal = { name: string; brief: string };

export type PlannerResult =
  | { type: "reply"; reply: string }
  | { type: "proposals"; reply: string; proposals: VariantProposal[] };

export async function planVariants({
  designName,
  designDescription,
  clientName,
  clientDescription,
  priorMessages,
  userMessage,
}: {
  designName: string;
  designDescription: string | null;
  clientName: string;
  clientDescription: string | null;
  priorMessages: PlannerMessage[];
  userMessage: string;
}): Promise<PlannerResult> {
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
        text: buildPlannerSystemPrompt({
          clientName,
          clientDescription,
          designName,
          designDescription,
        }),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [PROPOSE_TOOL],
    messages,
  });
  const response = await stream.finalMessage();

  const textBlocks = response.content.filter(
    (c): c is { type: "text"; text: string } => c.type === "text",
  );
  const toolUse = response.content.find(
    (c): c is { type: "tool_use"; name: string; input: unknown; id: string } =>
      c.type === "tool_use",
  );

  const reply = textBlocks.map((b) => b.text).join("\n\n").trim();

  if (toolUse && toolUse.name === "propose_variants") {
    const input = toolUse.input as { variants?: VariantProposal[] };
    const proposals = Array.isArray(input.variants) ? input.variants : [];
    return {
      type: "proposals",
      reply: reply || `I'd build these ${proposals.length} variants:`,
      proposals,
    };
  }

  return { type: "reply", reply: reply || "…" };
}
