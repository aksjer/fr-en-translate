import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { DEFAULT_MODEL, MODELS, type Model } from "@/lib/settings";

// Gemini, through the Vercel AI SDK. The key comes from LLM_API_KEY.
const google = createGoogleGenerativeAI({ apiKey: process.env.LLM_API_KEY });

// Only ids from the fixed list are accepted, so the client can't pick any model.
function safeModel(id: Model | undefined): Model {
  return id && (MODELS as readonly string[]).includes(id) ? id : DEFAULT_MODEL;
}

export function modelFor(id: Model | undefined) {
  return google(safeModel(id));
}

// Thinking is switched off for each family, so the JSON isn't cut short.
// Gemini 2.5 uses a token budget; Gemini 3 uses a level; Gemini 2.0 has no thinking.
export function providerOptionsFor(id: Model | undefined) {
  const model = safeModel(id);
  if (model.startsWith("gemini-2.5")) {
    return { google: { thinkingConfig: { thinkingBudget: 0 } } };
  }
  if (model.startsWith("gemini-3")) {
    return { google: { thinkingConfig: { thinkingLevel: "minimal" as const } } };
  }
  return undefined;
}
