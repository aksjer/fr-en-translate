import { generateText, Output } from "ai";
import { z } from "zod";
import { guardRequest, providerErrorResponse } from "@/lib/api";
import { modelFor, providerOptionsFor } from "@/lib/model";
import { LEVEL_DESCRIPTIONS } from "@/lib/options";
import {
  pickCombination,
  settingsSchema,
  type Combination,
} from "@/lib/settings";

const requestSchema = settingsSchema.extend({
  // Recent exercises, so the model doesn't keep giving the same words.
  avoid: z.array(z.string().max(80)).max(20).optional(),
  // Mistakes due for review, worked into the sentence without being named.
  review: z
    .array(
      z.object({
        correction: z.string().max(800),
        tag: z.string().max(40).optional(),
      }),
    )
    .max(2)
    .optional(),
});

function instructions({ mode, level, tense, verbType, theme }: Combination) {
  // The model invents the situation itself; these rules keep it from always
  // falling back on the most typical sentence for the theme.
  const variety =
    " Invent a specific, concrete situation on this theme: decide who is involved, " +
    "where and when, and make it a little unexpected. Avoid clichés such as going " +
    "to the market, the weather today or a simple daily routine. Vary the grammatical " +
    "person (je, tu, il, elle, nous, vous, ils, elles, on) and the sentence type " +
    "(statement, question, negation, exclamation).";
  const cefr = `CEFR level ${level} (${LEVEL_DESCRIPTIONS[level]})`;
  switch (mode) {
    case "mot":
      return (
        `Give a single French noun, adjective or adverb at ${cefr}, ` +
        `related to the theme "${theme}". Include the article for a noun (le, la, l', un, une). ` +
        "Pick a word whose American English translation is clear."
      );
    case "verbe":
      return (
        `Give a single French verb in the infinitive at ${cefr}, ` +
        `whose American English translation is a ${verbType === "irrégulier" ? "irregular" : "regular"} verb ` +
        "(go/went/gone is irregular, work/worked/worked is regular). " +
        "No verb that translates as a phrasal verb."
      );
    case "phrasal verb":
      return (
        `Give a French verb or short expression at ${cefr}, ` +
        `related to the theme "${theme}", that translates naturally into American English ` +
        "as a phrasal verb. Add a short context in parentheses if the meaning is ambiguous."
      );
    case "phrase":
      return (
        `Write one original French sentence at ${cefr}, ` +
        `using the French tense "${tense}", on the theme "${theme}".` + variety
      );
    case "paragraphe":
      return (
        `Write a short French paragraph of three linked sentences at ${cefr}, ` +
        `on the theme "${theme}". Use varied logical connectors, not always the same ones.` +
        variety
      );
  }
}

// Every field is required: Groq's strict JSON mode rejects optional ones.
const exerciseSchema = z.object({
  text: z.string().min(1).max(800),
  reference: z.string().min(1).max(800),
});

export async function POST(request: Request) {
  const { data, error } = await guardRequest(
    request,
    "generate",
    requestSchema,
  );
  if (error) return error;

  const combination = pickCombination(data);
  const avoid = data.avoid?.length
    ? `\nAvoid these items, already given: ${data.avoid.join(" ; ")}. ` +
      "Also avoid reusing the same structure or the same characters."
    : "";
  const review = data.review?.length
    ? "\nNaturally work in the following difficulty, without pointing it out: " +
      data.review
        .map((item) => `${item.tag ?? "point"} (e.g. "${item.correction}")`)
        .join(" ; ") +
      "."
    : "";

  try {
    const { output } = await generateText({
      model: modelFor(data.model),
      providerOptions: providerOptionsFor(data.model),
      temperature: 1,
      maxRetries: 1,
      maxOutputTokens: 800,
      output: Output.object({ schema: exerciseSchema }),
      system:
        "You are a French teacher. You give an item in natural, correct French " +
        "that a French-speaking learner will translate into American English. " +
        "text: the item, always written in French, with no quotes, translation or explanation. " +
        "reference: a natural, correct American English translation of text.",
      prompt: instructions(combination) + avoid + review,
    });

    return Response.json({ ...output, ...combination });
  } catch (error) {
    console.error("Model generation failed", error);
    return providerErrorResponse(error, "Generation failed", data.model);
  }
}
