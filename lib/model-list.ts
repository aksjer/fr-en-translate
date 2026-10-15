// Shared by the page and the server, so it holds no API keys (those are in lib/model.ts).

// Models the learner can pick, by provider. The server only accepts ids from these lists.
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;
export const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
] as const;
export const MODELS = [...GEMINI_MODELS, ...GROQ_MODELS] as const;
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";


export type Model = (typeof MODELS)[number];
export type Provider = "gemini" | "groq";

export function providerOf(model: Model): Provider {
  return (GROQ_MODELS as readonly string[]).includes(model) ? "groq" : "gemini";
}
