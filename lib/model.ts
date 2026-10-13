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

// Thinking is switched off as far as each model allows, so the JSON isn't cut short.
// Gemini 2.5 uses a token budget. Gemini 3 "-lite" models accept "minimal";
// the other Gemini 3 models reject it (400 on 3.7 and 3.8), so they get "low".
export function providerOptionsFor(id: Model | undefined) {
  const model = safeModel(id);
  if (model.startsWith("gemini-2.5")) {
    return { google: { thinkingConfig: { thinkingBudget: 0 } } };
  }
  const thinkingLevel = model.includes("flash-lite") ? "minimal" : "low";
  return { google: { thinkingConfig: { thinkingLevel: thinkingLevel as "minimal" | "low" } } };
}
