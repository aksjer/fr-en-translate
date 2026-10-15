// Shared by the page and the server, so it holds no API keys (those are in lib/model.ts).

// Models the learner can pick, by provider. The server only accepts ids from these lists.
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;
export const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
] as const;
export const MISTRAL_MODELS = ["mistral-small-latest", "mistral-medium-latest"] as const;
export const MODELS = [...GEMINI_MODELS, ...GROQ_MODELS, ...MISTRAL_MODELS] as const;
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";


export type Model = (typeof MODELS)[number];
export type Provider = "gemini" | "groq" | "mistral";

// The settings page shows the models by provider.
export const MODEL_GROUPS: { provider: Provider; name: string; models: readonly Model[] }[] = [
  { provider: "gemini", name: "Gemini", models: GEMINI_MODELS },
  { provider: "groq", name: "Groq", models: GROQ_MODELS },
  { provider: "mistral", name: "Mistral", models: MISTRAL_MODELS },
];

export function providerOf(model: Model): Provider {
  return MODEL_GROUPS.find((group) => group.models.includes(model))?.provider ?? "gemini";
}
