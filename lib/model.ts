import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, RetryError } from "ai";

// Gemini, through the Vercel AI SDK. The key comes from LLM_API_KEY.
const google = createGoogleGenerativeAI({ apiKey: process.env.LLM_API_KEY });

// Each model has its own quota, so the fallback also helps when the main one runs out.
const PRIMARY = "gemini-3.5-flash-lite";
const FALLBACK = "gemini-3.1-flash-lite";

// A slow attempt is given up after this, so the fallback can answer within the route's time limit.
const ATTEMPT_TIMEOUT_MS = 12_000;

// Both models are "lite" ones, which accept this level, so the JSON isn't cut short.
export const providerOptions = {
  google: { thinkingConfig: { thinkingLevel: "minimal" as const } },
};

function isBusy(error: unknown) {
  const apiError = RetryError.isInstance(error) ? error.lastError : error;
  if (apiError instanceof Error && apiError.name === "TimeoutError") return true;
  return (
    APICallError.isInstance(apiError) &&
    (apiError.statusCode === 503 || apiError.statusCode === 429)
  );
}

// Runs the call on the main model, and on the fallback when the main one is busy or too slow.
export async function withFallback<T>(
  run: (model: ReturnType<typeof google>, abortSignal: AbortSignal) => Promise<T>,
): Promise<T> {
  try {
    return await run(google(PRIMARY), AbortSignal.timeout(ATTEMPT_TIMEOUT_MS));
  } catch (error) {
    if (!isBusy(error)) throw error;
    return run(google(FALLBACK), AbortSignal.timeout(ATTEMPT_TIMEOUT_MS));
  }
}
