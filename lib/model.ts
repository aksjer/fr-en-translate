import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Gemini, through the Vercel AI SDK. The key comes from LLM_API_KEY.
const google = createGoogleGenerativeAI({ apiKey: process.env.LLM_API_KEY });

export const model = google("gemini-2.5-flash");
