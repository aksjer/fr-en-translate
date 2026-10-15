import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { generateText } from "ai";
import {
  DEFAULT_MODEL,
  MODELS,
  providerOf,
  type Model,
  type Provider,
} from "@/lib/settings";

// Gemini and Groq, through the Vercel AI SDK. Each provider has its own key.
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export const PROVIDER_NAMES: Record<Provider, string> = {
  gemini: "Gemini",
  groq: "Groq",
};

const API_KEYS: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
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
  return providerOf(model) === "groq" ? groq(model) : google(model);
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
  return model.startsWith("openai/gpt-oss")
    ? { groq: { reasoningEffort: "low" } }
    : {};
}
