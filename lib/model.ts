import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import {
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  type generateText,
} from "ai";
import {
  DEFAULT_MODEL,
  MODELS,
  providerOf,
  type Model,
  type Provider,
} from "@/lib/model-list";

// Gemini, Groq and Cerebras, through the Vercel AI SDK. Each provider has its own key.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const cerebras = createCerebras({ apiKey: process.env.CEREBRAS_API_KEY });

export const PROVIDER_NAMES: Record<Provider, string> = {
  gemini: "Gemini",
  groq: "Groq",
  cerebras: "Cerebras",
};

const API_KEYS: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
};

// Only ids from the fixed list are accepted, so the client can't pick any model.
export function safeModel(id: Model | undefined): Model {
  return id && (MODELS as readonly string[]).includes(id) ? id : DEFAULT_MODEL;
}

// The env variable that holds the key for this model's provider.
export function apiKeyName(id: Model | undefined) {
  return API_KEYS[providerOf(safeModel(id))];
}

export function modelFor(id: Model | undefined) {
  const model = safeModel(id);
  const provider = providerOf(model);
  if (provider === "groq") return groq(model);
  if (provider === "cerebras") return cerebras(model);
  return google(model);
}

type ProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]["providerOptions"]
>;

// Keeps thinking short, so the JSON isn't cut short. Qwen keeps Groq's default,
// since it accepts other reasoning values.
export function providerOptionsFor(
  id: Model | undefined,
): ProviderOptions {
  const model = safeModel(id);
  if (providerOf(model) === "gemini") {
    return { google: { thinkingConfig: { thinkingLevel: "minimal" } } };
  }
  return providerOf(model) === "groq" && model.startsWith("openai/gpt-oss")
    ? { groq: { reasoningEffort: "low" } }
    : {};
}

// Google strongly recommends keeping Gemini 3 at its default temperature of 1:
// lower values can make it loop or get worse. Qwen recommends 0.6 when it thinks,
// and warns that values near 0 cause endless repetitions. gpt-oss grades more
// consistently at a low temperature. Generation stays at 1 for variety.
export function temperatureFor(
  id: Model | undefined,
  task: "generate" | "correct",
) {
  const model = safeModel(id);
  if (task === "generate" || providerOf(model) === "gemini") return 1;
  return model.startsWith("qwen") ? 0.6 : 0.2;
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
