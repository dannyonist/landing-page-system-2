import * as cheerio from "cheerio";
import { anthropic, EDITOR_MODEL } from "@/lib/anthropic";

function buildSystemPrompt({
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
  return `You are a SENIOR LANDING-PAGE DESIGNER working on a paid-ad variant for ${clientName}.

═══════════════════════════════════════════════
HOW YOU WORK — READ THIS FIRST
═══════════════════════════════════════════════

You make changes by calling tools. Two tools are available:

1. \`edit_html\` — DOM edits via CSS selectors (copy, classes, attributes, HTML structure).
2. \`update_js_data\` — replace an inline JS const that holds data (meal arrays, menu objects, config). Different designs use different const names — INSPECT the HTML first to find them.

You may call BOTH tools in a single turn, and \`update_js_data\` can include multiple const updates in one call.

Example: a "beef-focused variant" on the Editorial design would:
- update_js_data → replace MEALS const with beef-forward meal arrays
- edit_html → change hero copy, preselect muscle goal, swap urgency banner

On the Retail design, the data const might be named POPULAR_MEALS / DEAL_MEALS / NEW_MEALS — again, inspect the HTML to find the actual names.

If the user asks a clarifying question or needs info only, answer in plain English with no tool call.

NEVER put code, HTML, CSS, or JSON in your text reply. The tool call carries the changes; the text reply is 1-3 sentences of plain English.

═══════════════════════════════════════════════
BUSINESS CONTEXT — ${clientName}
═══════════════════════════════════════════════
${clientDescription ?? "(no client description provided)"}

═══════════════════════════════════════════════
DESIGN DIRECTION — ${designName}
═══════════════════════════════════════════════
${designDescription ?? "(no design description provided)"}

═══════════════════════════════════════════════
DESIGN PRINCIPLES
═══════════════════════════════════════════════

COPY: Hero headline = outcome + mechanism. Sharp, specific, sensory. Active voice, concrete nouns, numbers. Strip adjective stacking. Match the brand voice from the design direction above.

VISUAL HIERARCHY: Hero owns first-scroll attention. One primary CTA per screen. White space is a design element.

AD CONTINUITY: Hero mirrors the ad angle in 2 seconds. Friction kills — every extra link/field is an exit ramp.

AUDIENCE PSYCHOLOGY:
- Keto/weight-loss → identity-based copy
- Busy pros → time framing
- Families → practical stakes
- Cart abandon → loss aversion + what they chose
- Pet owners → emotional ownership

═══════════════════════════════════════════════
NON-NEGOTIABLE CONSTRAINTS
═══════════════════════════════════════════════

1. NEVER outcome-guarantee copy tied to refunds. Use product attributes ("chef-prepared", "grass-fed", "high-protein") and flexibility ("cancel anytime").
2. PRESERVE conversion mechanics: urgency banner, stripped nav, freshness strip, Apple/Google Pay in checkout, sticky checkout, 3-tier unlock bar.
3. PRESERVE BEM class names and :root custom properties for colors.
4. PRESERVE JS functions (selectGoal, addToCart, etc.) — only change the MEALS data, not the code around it.

═══════════════════════════════════════════════
TOOL 1 — edit_html
═══════════════════════════════════════════════

CSS-selector-based DOM edits. Actions:
- set_text, set_html, set_attr, add_class, remove_class, append_html, prepend_html, remove

CRITICAL: INSPECT THE CURRENT HTML (given in the user message) and use ACTUAL class names from it. Class names vary across designs. Don't guess BEM patterns — copy what's there.

Common needs:
- Hero headline → find the h1 element in the HTML, use its real class name
- Preselect a different goal → remove 'is-active' from the current active goal-card, add 'is-active' to the target (use :nth-child if no differentiating class exists)
- Urgency banner copy → find the text-bearing child of the urgency row (inspect HTML for the actual selector)
- CTA button text → find the button and set_text

Cheerio doesn't support :contains() or text-based pseudo-selectors. Use class + structure.

═══════════════════════════════════════════════
TOOL 2 — update_js_data
═══════════════════════════════════════════════

Replaces inline JS const declarations. Works across ALL designs because it operates by const name.

HOW TO USE:
1. Scan the current HTML for \`const SOMETHING = {...}\` or \`const SOMETHING = [...]\` declarations in <script> tags. Different designs use different names:
   - Editorial (MightyMeals): \`MEALS\` (object keyed by goal)
   - Retail: \`POPULAR_MEALS\`, \`DEAL_MEALS\`, \`NEW_MEALS\` (arrays)
   - Performance: \`MEALS\` (object keyed by goal)
   - Mighty Pets Editorial / Playful: \`MEALS\` (object keyed by pet: dog, cat)
2. Copy the EXACT const name.
3. Pass the new value as JSON (object or array, matching the original shape).

Each meal object (MightyMeals pattern):
\`id\` (kebab-case), \`name\`, \`img\` (Unsplash URL), \`protein\` ("42g"), \`cal\` ("480"), \`carbs\` ("38g"), \`price\` (number), \`badge\` (string or ""), \`badgeClass\` ("badge-green" | "badge-amber" | "badge-blue" | "")

For Mighty Pets meals the fields may differ — inspect the existing objects in the current HTML and match that shape.

IMAGES: Reuse image URLs that ALREADY exist in the current HTML. Scan the existing data const and collect \`img\` URLs. Reuse them for similar-category meals in your new data. DO NOT invent new Unsplash IDs — fabricated ones 404.

Provide enough items per key that the grid still looks populated (typically 3-6 per category).

═══════════════════════════════════════════════
WHAT YOU CAN AND CAN'T DO
═══════════════════════════════════════════════

CAN:
- Rewrite any text (hero, urgency banner, CTAs, section headlines, fine print)
- Swap the entire MEALS dataset (with update_meals)
- Toggle is-active on goal cards
- Change HTML structure inside containers
- Tweak small :root color variables (via set_html on <style>)

CAN'T reliably:
- Swap the hero background image to something the client hasn't provided (no image library exists yet)
- Change fonts / large structural redesigns

If a request asks for something you can't do, do what you CAN and mention the limitation in your reply.

Ship fast. Prefer informed assumptions over clarifying questions.`;
}

const EDIT_TOOL = {
  name: "edit_html",
  description:
    "Apply DOM-style edits via CSS selectors. For copy, classes, attributes, and HTML structure.",
  input_schema: {
    type: "object" as const,
    properties: {
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            selector: { type: "string" },
            action: {
              type: "string",
              enum: [
                "set_text",
                "set_html",
                "set_attr",
                "add_class",
                "remove_class",
                "append_html",
                "prepend_html",
                "remove",
              ],
            },
            value: { type: "string" },
            attr: { type: "string" },
          },
          required: ["selector", "action"],
        },
        minItems: 1,
      },
    },
    required: ["edits"],
  },
};

const UPDATE_JS_DATA_TOOL = {
  name: "update_js_data",
  description:
    "Replace one or more inline JavaScript const declarations that hold data (meal arrays, menu objects, config). Works for any design by operating on const name. Inspect the HTML first to find the exact const names.",
  input_schema: {
    type: "object" as const,
    properties: {
      updates: {
        type: "array",
        description: "One or more const replacements. Each has the exact const name and new JSON value.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Exact const identifier as it appears in the HTML (e.g. 'MEALS', 'POPULAR_MEALS', 'DEAL_MEALS'). Case-sensitive. Must match a `const NAME = ...` declaration in an inline <script>.",
            },
            value: {
              description:
                "New value (JSON object or array) matching the original structure. Keep the field shape of existing entries.",
            },
          },
          required: ["name", "value"],
        },
        minItems: 1,
      },
    },
    required: ["updates"],
  },
};

type EditOp = {
  selector: string;
  action:
    | "set_text"
    | "set_html"
    | "set_attr"
    | "add_class"
    | "remove_class"
    | "append_html"
    | "prepend_html"
    | "remove";
  value?: string;
  attr?: string;
};

type JsDataUpdate = { name: string; value: unknown };

type PriorMessage = { role: "user" | "assistant"; content: string };

export type GenerateResult = {
  reply: string;
  html: string | null;
  appliedEdits: number;
  failedFinds: string[];
};

function applyDomEdits(
  html: string,
  edits: EditOp[],
): { html: string; applied: number; failed: EditOp[] } {
  const $ = cheerio.load(html, { xml: { decodeEntities: false } });
  const failed: EditOp[] = [];
  let applied = 0;

  for (const e of edits) {
    if (typeof e?.selector !== "string" || typeof e?.action !== "string") {
      failed.push(e);
      continue;
    }
    let $el;
    try {
      $el = $(e.selector);
    } catch {
      failed.push(e);
      continue;
    }
    if ($el.length === 0) {
      failed.push(e);
      continue;
    }
    try {
      switch (e.action) {
        case "set_text": $el.text(e.value ?? ""); break;
        case "set_html": $el.html(e.value ?? ""); break;
        case "set_attr":
          if (!e.attr) { failed.push(e); continue; }
          $el.attr(e.attr, e.value ?? "");
          break;
        case "add_class": $el.addClass(e.value ?? ""); break;
        case "remove_class": $el.removeClass(e.value ?? ""); break;
        case "append_html": $el.append(e.value ?? ""); break;
        case "prepend_html": $el.prepend(e.value ?? ""); break;
        case "remove": $el.remove(); break;
        default: failed.push(e); continue;
      }
      applied += 1;
    } catch {
      failed.push(e);
    }
  }

  return { html: $.html(), applied, failed };
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Finds `const <name> = { ... };` or `const <name> = [ ... ];` in the HTML
 * and replaces the literal with the JSON-serialized newValue.
 * Works across any design by operating on the exact const identifier.
 */
function replaceConstByName(
  html: string,
  constName: string,
  newValue: unknown,
): { ok: boolean; html: string } {
  if (!IDENT_RE.test(constName)) return { ok: false, html };

  const pattern = new RegExp(`\\bconst\\s+${constName}\\s*=\\s*`);
  const startMatch = html.match(pattern);
  if (!startMatch || startMatch.index == null) return { ok: false, html };
  const blockStart = startMatch.index;
  const afterEquals = blockStart + startMatch[0].length;
  const firstCh = html[afterEquals];
  if (firstCh !== "{" && firstCh !== "[") return { ok: false, html };
  const openCh = firstCh;
  const closeCh = openCh === "{" ? "}" : "]";

  let i = afterEquals;
  let depth = 0;
  const len = html.length;
  let inString: '"' | "'" | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < len; i++) {
    const ch = html[i];
    const prev = i > 0 ? html[i - 1] : "";

    if (inLineComment) { if (ch === "\n") inLineComment = false; continue; }
    if (inBlockComment) { if (ch === "/" && prev === "*") inBlockComment = false; continue; }
    if (inString) { if (ch === inString && prev !== "\\") inString = null; continue; }

    if (ch === "/" && html[i + 1] === "/") { inLineComment = true; i++; continue; }
    if (ch === "/" && html[i + 1] === "*") { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch as '"' | "'" | "`"; continue; }

    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }

  if (depth !== 0) return { ok: false, html };

  let closeIdx = i;
  while (closeIdx < len && /\s/.test(html[closeIdx])) closeIdx++;
  if (html[closeIdx] === ";") closeIdx++;

  const serialized = JSON.stringify(newValue, null, 2);
  const replacement = `const ${constName} = ${serialized};`;

  return {
    ok: true,
    html: html.slice(0, blockStart) + replacement + html.slice(closeIdx),
  };
}

type ToolCall =
  | { kind: "edit_html"; edits: EditOp[] }
  | { kind: "update_js_data"; updates: JsDataUpdate[] };

async function callEditor({
  messages,
  systemPrompt,
  signal,
}: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt: string;
  signal?: AbortSignal;
}): Promise<{ textReply: string; toolCalls: ToolCall[] }> {
  const stream = anthropic.messages.stream(
    {
      model: EDITOR_MODEL,
      max_tokens: 8192,
      // Cache the system prompt — it's stable per (client, design) combo and ~3k tokens.
      // 90% rate-limit cost reduction on repeated turns inside 5-minute window.
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      tools: [EDIT_TOOL, UPDATE_JS_DATA_TOOL],
      messages,
    },
    { signal },
  );
  const response = await stream.finalMessage();

  const textBlocks = response.content.filter(
    (c): c is { type: "text"; text: string } => c.type === "text",
  );
  const textReply = textBlocks.map((b) => b.text).join("\n\n").trim();

  const toolCalls: ToolCall[] = [];
  for (const block of response.content) {
    if (block.type !== "tool_use") continue;
    if (block.name === "edit_html") {
      const input = block.input as { edits?: EditOp[] };
      if (Array.isArray(input.edits)) {
        toolCalls.push({ kind: "edit_html", edits: input.edits });
      }
    } else if (block.name === "update_js_data") {
      const input = block.input as { updates?: JsDataUpdate[] };
      if (Array.isArray(input.updates)) {
        const filtered = input.updates.filter(
          (u) => typeof u?.name === "string" && "value" in u,
        );
        if (filtered.length > 0) {
          toolCalls.push({ kind: "update_js_data", updates: filtered });
        }
      }
    }
  }

  return { textReply, toolCalls };
}

export async function generateVariantResponse({
  currentHtml,
  priorMessages,
  userMessage,
  designName,
  designDescription,
  clientName,
  clientDescription,
  signal,
}: {
  currentHtml: string;
  priorMessages: PriorMessage[];
  userMessage: string;
  designName: string;
  designDescription: string | null;
  clientName: string;
  clientDescription: string | null;
  signal?: AbortSignal;
}): Promise<GenerateResult> {
  const systemPrompt = buildSystemPrompt({
    clientName,
    clientDescription,
    designName,
    designDescription,
  });

  // Cap prior message history to keep context size bounded.
  // 12 messages = last ~6 conversation turns. Anything older is summarized away.
  // Keeps tokens-per-minute rate under control and responses fast.
  const trimmedHistory = priorMessages.slice(-12);

  // Turn 1
  const initialMessages = [
    ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user" as const,
      content: `Current HTML:\n\n\`\`\`html\n${currentHtml}\n\`\`\`\n\nUser request: ${userMessage}`,
    },
  ];
  const first = await callEditor({ messages: initialMessages, systemPrompt, signal });

  if (first.toolCalls.length === 0) {
    // No tool call — clarifying question or leaked code
    const codeFencePattern = /```[\w]*\n?[\s\S]*?```/g;
    const hasCode = codeFencePattern.test(first.textReply);
    codeFencePattern.lastIndex = 0;
    const cleaned = first.textReply.replace(codeFencePattern, "").trim();
    const reply = hasCode
      ? cleaned
        ? `${cleaned}\n\n⚠ I tried to dump code. Rephrase and I'll apply edits properly.`
        : "⚠ I didn't apply that change. Try rephrasing with something more specific."
      : first.textReply || "Hmm, I didn't catch an action. Can you rephrase?";
    return { reply, html: null, appliedEdits: 0, failedFinds: [] };
  }

  console.log(
    `[generate] user="${userMessage.slice(0, 80)}" calls=${first.toolCalls.length}`,
  );
  for (const c of first.toolCalls) {
    if (c.kind === "edit_html") {
      console.log(
        `[generate] edit_html ops=${c.edits.length}: ${c.edits.slice(0, 5).map((e) => `${e.action} ${e.selector}`).join(" | ")}`,
      );
    } else {
      console.log(`[generate] update_js_data consts=${c.updates.map((u) => u.name).join(",")}`);
    }
  }

  let working = currentHtml;
  let applied = 0;
  let failedEdits: EditOp[] = [];
  let dataUpdated: string[] = [];
  let dataFailed: string[] = [];

  for (const call of first.toolCalls) {
    if (call.kind === "edit_html") {
      const r = applyDomEdits(working, call.edits);
      working = r.html;
      applied += r.applied;
      failedEdits = [...failedEdits, ...r.failed];
    } else if (call.kind === "update_js_data") {
      for (const u of call.updates) {
        const r = replaceConstByName(working, u.name, u.value);
        if (r.ok) {
          working = r.html;
          dataUpdated.push(u.name);
        } else {
          dataFailed.push(u.name);
        }
      }
    }
  }

  // Retry anything that failed — both selector misses and const-name misses.
  if (failedEdits.length > 0 || dataFailed.length > 0) {
    const problems: string[] = [];
    if (failedEdits.length > 0) {
      problems.push(
        "FAILED DOM EDITS (selector matched nothing):\n" +
          failedEdits
            .map(
              (e, i) =>
                `${i + 1}. selector="${e.selector}" action="${e.action}"${e.value ? ` value="${e.value.slice(0, 120)}${e.value.length > 120 ? "…" : ""}"` : ""}`,
            )
            .join("\n"),
      );
    }
    if (dataFailed.length > 0) {
      problems.push(
        `FAILED JS DATA UPDATES (const name not found): ${dataFailed.join(", ")}`,
      );
    }

    const retryMessages = [
      ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user" as const,
        content: `Current HTML (after your successful changes):\n\n\`\`\`html\n${working}\n\`\`\`\n\nOriginal request: ${userMessage}\n\nI applied ${applied} DOM edits${dataUpdated.length > 0 ? ` and updated consts: ${dataUpdated.join(", ")}` : ""}. These did NOT apply:\n\n${problems.join("\n\n")}\n\nInspect the current HTML and retry with correct selectors / correct const names. Skip ones no longer applicable.`,
      },
    ];

    const retry = await callEditor({ messages: retryMessages, systemPrompt, signal });
    failedEdits = [];
    for (const call of retry.toolCalls) {
      if (call.kind === "edit_html") {
        const r = applyDomEdits(working, call.edits);
        working = r.html;
        applied += r.applied;
        failedEdits = [...failedEdits, ...r.failed];
      } else if (call.kind === "update_js_data") {
        for (const u of call.updates) {
          // Skip consts we already succeeded on
          if (dataUpdated.includes(u.name)) continue;
          const r = replaceConstByName(working, u.name, u.value);
          if (r.ok) {
            working = r.html;
            dataUpdated.push(u.name);
            dataFailed = dataFailed.filter((n) => n !== u.name);
          }
        }
      }
    }
  }

  const html = working !== currentHtml ? working : null;
  console.log(
    `[generate] result: applied=${applied} dataUpdated=[${dataUpdated.join(",")}] dataFailed=[${dataFailed.join(",")}] failedEdits=${failedEdits.length} htmlChanged=${html !== null}`,
  );

  let reply = first.textReply;
  if (!reply) {
    const parts: string[] = [];
    if (applied > 0) parts.push(`${applied} DOM edit${applied === 1 ? "" : "s"}`);
    if (dataUpdated.length > 0) parts.push(`updated ${dataUpdated.join(", ")}`);
    reply = parts.length > 0 ? `Applied ${parts.join(" + ")}.` : "No changes applied.";
  }
  if (dataFailed.length > 0) {
    reply += `\n\n⚠ Couldn't find these consts in the HTML: ${dataFailed.join(", ")}.`;
  }
  if (failedEdits.length > 0) {
    reply += `\n\n⚠ ${failedEdits.length} DOM edit${failedEdits.length === 1 ? "" : "s"} couldn't find a matching element after retry.`;
  }

  return {
    reply,
    html,
    appliedEdits: applied + dataUpdated.length,
    failedFinds: [
      ...failedEdits.map((e) => `${e.action} ${e.selector}`),
      ...dataFailed.map((n) => `const ${n}`),
    ],
  };
}
