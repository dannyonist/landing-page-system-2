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
export const MODEL = MODELS.SONNET;

// Editor uses Haiku 4.5 — 3-5x faster than Sonnet for tool use on large HTML contexts.
// Planner stays on Sonnet for strategic reasoning.
export const EDITOR_MODEL = MODELS.HAIKU;
