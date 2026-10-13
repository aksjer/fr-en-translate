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

// Both models are "lite" ones, which accept this level, so the JSON isn't cut short.
export const providerOptions = {
  google: { thinkingConfig: { thinkingLevel: "minimal" as const } },
};
