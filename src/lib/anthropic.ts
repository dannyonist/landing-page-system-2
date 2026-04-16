import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Model tiers. Default to Sonnet for quality; Haiku available for speed-sensitive batch ops.
export const MODELS = {
  SONNET: "claude-sonnet-4-6",
  HAIKU: "claude-haiku-4-5-20251001",
  OPUS: "claude-opus-4-6",
} as const;

// Legacy export for existing code (planner uses this)
export const MODEL = MODELS.OPUS;

// Editor uses Opus 4.6 for highest quality output.
export const EDITOR_MODEL = MODELS.OPUS;
