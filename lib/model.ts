import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { DEFAULT_MODEL, MODELS, type Model } from "@/lib/settings";

// Gemini, through the Vercel AI SDK. The key comes from LLM_API_KEY.
const google = createGoogleGenerativeAI({ apiKey: process.env.LLM_API_KEY });

// Only ids from the fixed list are accepted, so the client can't pick any model.
// Thinking is turned off: the answers are short, and thinking tokens use the
// output limit. Gemini 2.5 takes a token budget, Gemini 3 takes a level.
export function modelOptions(id: Model | undefined) {
  const safe =
    id && (MODELS as readonly string[]).includes(id) ? id : DEFAULT_MODEL;
  const thinkingConfig = safe.startsWith("gemini-2.5")
    ? { thinkingBudget: 0 }
    : { thinkingLevel: "minimal" as const };
  return {
    model: google(safe),
    providerOptions: { google: { thinkingConfig } },
  };
}
