import { generateText, Output } from "ai";
import { z } from "zod";
import { guardRequest, providerErrorResponse } from "@/lib/api";
import { modelFor, providerOptionsFor } from "@/lib/model";
import { LEVEL_DESCRIPTIONS, TENSE_GUIDES } from "@/lib/options";
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

// Picked by the code, not the model: each request is independent, so the model
// can't vary these across exercises and would always pick the same ones.
const PERSONS = ["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"];
// The impératif only exists with tu, nous and vous.
const IMPERATIVE_PERSONS = ["tu", "nous", "vous"];
const SENTENCE_TYPES = ["statement", "question", "negation", "exclamation"];
// An order can't really be a question.
const IMPERATIVE_TYPES = ["statement", "negation"];

function pickOne(items: string[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function instructions({ mode, level, tense, verbType, theme }: Combination) {
  const cefr = `CEFR level ${level} (${LEVEL_DESCRIPTIONS[level]})`;
  // The model invents the situation itself; this keeps it from always
  // falling back on the most typical sentence for the theme.
  const variety =
    "\n\n## Variety\nInvent a specific, concrete situation on this theme: decide who " +
    "is involved, where and when, and make it a little unexpected. Avoid the most " +
    "obvious example for the theme (going to the market, today's weather…).";
  const priority =
    "\n\n## Priority\nIf two instructions conflict, the tense and the theme come first, " +
    "then the level, then the variety.";
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
    case "phrase": {
      const imperative = tense === "impératif";
      const person = pickOne(imperative ? IMPERATIVE_PERSONS : PERSONS);
      const type = pickOne(imperative ? IMPERATIVE_TYPES : SENTENCE_TYPES);
      return (
        `Write one original French sentence at ${cefr}, ` +
        `using the French tense "${tense}" (${tense && TENSE_GUIDES[tense]}), ` +
        `on the theme "${theme}". The main verb uses the person "${person}", ` +
        `and the sentence is a ${type}.` +
        variety +
        priority
      );
    }
    case "paragraphe":
      return (
        `Write a short French paragraph of three linked sentences at ${cefr}, ` +
        `on the theme "${theme}", mainly told with the person "${pickOne(PERSONS)}". ` +
        "Use logical connectors that fit the level." +
        variety +
        priority
      );
  }
}

// Every field is required: Groq's strict JSON mode rejects optional ones.
// The situation comes first, so the model settles its idea before writing the item.
const exerciseSchema = z.object({
  situation: z.string().max(300),
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
    ? "\n\n## Avoid\n" +
      `- These items, already given: ${data.avoid.join(" ; ")}.\n` +
      "- Reusing the same structure or the same characters."
    : "";
  const review = data.review?.length
    ? "\n\n## Review\nThe learner recently made these mistakes. Write the item so it " +
      "tests the same point again, without pointing it out:\n" +
      data.review
        .map(
          (item) =>
            `- type "${item.tag ?? "autre"}", correct form: "${item.correction}"`,
        )
        .join("\n")
    : "";

  try {
    const { output } = await generateText({
      model: modelFor(data.model),
      providerOptions: providerOptionsFor(data.model),
      temperature: 1,
      maxRetries: 1,
      maxOutputTokens: 800,
      output: Output.object({ schema: exerciseSchema }),
      system: [
        "You are a French teacher. You give an item in natural, correct French",
        "that a French-speaking learner will translate into American English.",
        "",
        "## Fields, in this order",
        "- situation: first, one short line in English describing the idea or situation",
        "  you chose (who, where, when), or the word's context for a single word or verb.",
        "- text: the item, always written in French, with no quotes, translation or explanation.",
        "- reference: a natural, correct American English translation of text,",
        "  with the same meaning and the equivalent tense, in American spelling.",
      ].join("\n"),
      prompt: "## Task\n" + instructions(combination) + avoid + review,
    });

    // The situation only helps the model think; the page doesn't need it.
    const { text, reference } = output;
    return Response.json({ text, reference, ...combination });
  } catch (error) {
    console.error("Model generation failed", error);
    return providerErrorResponse(error, "Generation failed", data.model);
  }
}
