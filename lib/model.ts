import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { DEFAULT_MODEL, MODELS, type Model } from "@/lib/settings";

// Gemini, through the Vercel AI SDK. The key comes from LLM_API_KEY.
const google = createGoogleGenerativeAI({ apiKey: process.env.LLM_API_KEY });

// Only ids from the fixed list are accepted, so the client can't pick any model.
export function modelFor(id: Model | undefined) {
  const safe =
    id && (MODELS as readonly string[]).includes(id) ? id : DEFAULT_MODEL;
  return google(safe);
}
