import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { decodeHTML } from "entities";
import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  type generateText,
} from "ai";

// The only model: Gemini 3.5 Flash-Lite, through the Vercel AI SDK. Its free
// tier gives 250,000 tokens a minute, enough for prompts with the full history.
// Gemini 3 keeps its default temperature of 1, as Google recommends.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
export const model = google("gemini-3.5-flash-lite");

type ProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]["providerOptions"]
>;

// Short thinking, a bit more for the correction: more (low and high) made each
// answer take 4 to 14 seconds, too slow.
export function thinkingFor(task: "generate" | "correct"): ProviderOptions {
  return {
    google: { thinkingConfig: { thinkingLevel: task === "correct" ? "low" : "minimal" } },
  };
}

// The answer matched the schema, but its content can't be used (empty, too long).
export class InvalidAnswerError extends Error {}

export function isInvalidAnswer(error: unknown) {
  return (
    error instanceof InvalidAnswerError ||
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  );
}

// Answers are random: when one can't be used, a second try usually works.
export async function retryIfInvalid<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isInvalidAnswer(error)) throw error;
    console.warn("Unusable model answer, trying again:", (error as Error).message);
    return call();
  }
}

// Gemini sometimes writes accents as HTML entities (« malgr&eacute; »): every
// text of an answer, at any depth, gets its letters back.
export function withoutEntities<T>(value: T): T {
  if (typeof value === "string") return decodeHTML(value) as T;
  if (Array.isArray(value)) return value.map(withoutEntities) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, withoutEntities(field)]),
    ) as T;
  }
  return value;
}
