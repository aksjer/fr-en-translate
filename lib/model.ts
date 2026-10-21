import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { decodeHTML } from "entities";
import { NoObjectGeneratedError, NoOutputGeneratedError, type generateText } from "ai";

// The only model: Gemini 3.5 Flash-Lite, thinking minimally so answers come fast.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
export const model = google("gemini-3.5-flash-lite");

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

export const MINIMAL_THINKING: ProviderOptions = {
  google: { thinkingConfig: { thinkingLevel: "minimal" } },
};

// The answer matched the schema, but its content can't be used (e.g. empty).
export class InvalidAnswerError extends Error {}

export function isInvalidAnswer(error: unknown) {
  return (
    error instanceof InvalidAnswerError ||
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error)
  );
}

// Gemini sometimes writes accents as HTML entities (malgr&eacute;).
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
