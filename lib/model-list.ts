// Shared by the page and the server, so it holds no API keys (those are in lib/model.ts).

// Models the learner can pick, by provider. The server only accepts ids from these lists.
export const GEMINI_MODELS = ["gemini-3.5-flash-lite"] as const;
export const GROQ_MODELS = ["qwen/qwen3.8-27b"] as const;
export const MODELS = [...GEMINI_MODELS, ...GROQ_MODELS] as const;

export type Model = (typeof MODELS)[number];
export type Provider = "gemini" | "groq";

// Smartest first, by the Artificial Analysis Intelligence Index (October 2026):
// Qwen 26 to 34 depending on its reasoning, Gemini 3.5 Flash-Lite 22. The
// settings list them in this order.
export const MODELS_BY_INTELLIGENCE: readonly Model[] = [
  "qwen/qwen3.8-27b",
  "gemini-3.5-flash-lite",
];
// Gemini is the default: Groq's free plan allows Qwen only 8,000 tokens a
// minute and 200,000 a day, too few for the prompts with the full history.
export const DEFAULT_MODEL: Model = "gemini-3.5-flash-lite";

// The company serving each provider's models, shown next to them.
export const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: "Google",
  groq: "Groq",
};

export function providerOf(model: Model): Provider {
  return (GROQ_MODELS as readonly string[]).includes(model) ? "groq" : "gemini";
}
