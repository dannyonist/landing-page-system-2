import { anthropic, MODELS } from "@/lib/anthropic";

const INTAKE_SYSTEM_PROMPT = `You are onboarding a NEW CLIENT into a landing-page studio for Danny's agency. The brief you produce will be used as PERMANENT CONTEXT by another AI that designs and edits landing pages for this client.

Your job:
1. Ask the user concise, focused questions to gather everything the design AI will need.
2. When you have enough info (usually after 2-4 turns), call the \`finalize_client\` tool with the full markdown brief.

What you need to collect:
- **Company name** (for display and slug)
- **What they do** — product/service in plain English
- **Website** — so a human can verify brand voice later
- **Target audience** — demographics, psychographics, buying context
- **Brand voice** — tone (confident? playful? clinical?), vocabulary patterns, things to avoid
- **Key offer / conversion mechanic** — what's being sold, discount structure, differentiation vs competitors
- **Core goals** — primary conversion, secondary goals
- **Constraints / compliance** — anything the AI MUST NOT say (outcome guarantees, specific claims, regulated language)
- **Starter instructions** — any design patterns, copy patterns, or mechanics the agency has already decided on

Be concise. Ask 2-4 questions per turn. Don't lecture. Paraphrase what you heard back briefly to confirm understanding.

The final markdown brief should be organized with clear section headings (## Company, ## Audience, ## Voice, ## Offer, ## Constraints, etc.) so the design AI can scan it for relevant context. Write as if explaining the business to a skilled freelancer on their first day.

NEVER fabricate details. If the user didn't give a website or specific audience, note "(not provided)" in the brief.`;

const FINALIZE_TOOL = {
  name: "finalize_client",
  description:
    "Call this when you have enough information to write the client brief. Returns a draft for the user to review and save.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Company or client name as it should appear in the studio UI.",
      },
      slug: {
        type: "string",
        description:
          "URL-safe kebab-case slug (lowercase, hyphens, no special chars). Used in URLs like /clients/[slug].",
      },
      description: {
        type: "string",
        description:
          "Full markdown brief. Multiple ## section headings covering: Company, Website, Audience, Voice, Offer, Goals, Constraints, Notes. This is permanent context for the design AI.",
      },
    },
    required: ["name", "slug", "description"],
  },
};

type IntakeMessage = { role: "user" | "assistant"; content: string };

export type ClientDraft = { name: string; slug: string; description: string };

export type IntakeResult =
  | { type: "reply"; reply: string }
  | { type: "finalized"; reply: string; draft: ClientDraft };

export async function intakeClientMessage({
  priorMessages,
  userMessage,
}: {
  priorMessages: IntakeMessage[];
  userMessage: string;
}): Promise<IntakeResult> {
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
        text: INTAKE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [FINALIZE_TOOL],
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

  if (toolUse && toolUse.name === "finalize_client") {
    const input = toolUse.input as Partial<ClientDraft>;
    if (typeof input.name === "string" && typeof input.description === "string") {
      const draft: ClientDraft = {
        name: input.name.trim(),
        slug: (input.slug || input.name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""),
        description: input.description,
      };
      return {
        type: "finalized",
        reply: reply || `Here's the brief for **${draft.name}**. Review it and click Create to save.`,
        draft,
      };
    }
  }

  return { type: "reply", reply: reply || "…" };
}
