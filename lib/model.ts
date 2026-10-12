import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Gemini 3.5 Flash-Lite, through the Vercel AI SDK. The key comes from LLM_API_KEY.
const google = createGoogleGenerativeAI({ apiKey: process.env.LLM_API_KEY });

export const model = google("gemini-3.5-flash-lite");

// Thinking is kept to a minimum: the answers are short, and thinking tokens
// count against the output limit.
export const providerOptions = {
  google: { thinkingConfig: { thinkingLevel: "minimal" as const } },
};
