import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import {
  InvalidAnswerError,
  modelFor,
  providerOptionsFor,
  retryIfInvalid,
  temperatureFor,
} from "@/lib/model";
import {
  LEVEL_DESCRIPTIONS,
  LEVELS,
  MAX_TEXT_LENGTH,
  MODES,
  TENSE_GUIDES,
  TENSES,
  VERB_TYPES,
  type Mode,
} from "@/lib/options";
import {
  pickCombination,
  settingsSchema,
  type Combination,
} from "@/lib/settings";

// Cuts a text from the page instead of rejecting it: mistakes stored in the
// browser may be longer than today's limits.
const clipped = (max: number) =>
  z.string().transform((text) => text.trim().slice(0, max));

// A mistake due for review. Mistakes stored before the mode was saved have none.
const reviewSchema = z.object({
  mode: z.enum(MODES).optional().catch(undefined),
  level: z.enum(LEVELS).optional().catch(undefined),
  tense: z.enum(TENSES).optional().catch(undefined),
  verbType: z.enum(VERB_TYPES).optional().catch(undefined),
  correction: clipped(MAX_TEXT_LENGTH),
  remark: clipped(300).optional(),
  tag: clipped(40).optional(),
});

type Review = z.infer<typeof reviewSchema>;

export const generateInputSchema = settingsSchema.extend({
  // Recent exercises, so the model doesn't keep giving the same words.
  avoid: z.array(clipped(80)).max(20).optional(),
  // The exercise tests this mistake again. A page from before this field
  // changed shape gets a normal exercise.
  review: reviewSchema.optional().catch(undefined),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export type Exercise = Combination & { text: string; reference: string };

// Picked by the code, not the model: each request is independent, so the model
// can't vary these across exercises and would always pick the same ones.
const PERSONS = ["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"];
// The impératif only exists with tu, nous and vous.
const IMPERATIVE_PERSONS = ["tu", "nous", "vous"];
const SENTENCE_TYPES = ["statement", "question", "negation", "exclamation"];
// An order can't really be a question.
const IMPERATIVE_TYPES = ["statement", "negation"];

// Told to the model, since models count words better than characters. The code
// also rejects any item over MAX_TEXT_LENGTH characters.
const MAX_WORDS = { "phrasal verb": 10, phrase: 40, paragraphe: 120 };

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
        "as a phrasal verb. Add a short context in parentheses if the meaning is ambiguous, " +
        `with ${MAX_WORDS[mode]} words at most in all.`
      );
    case "phrase": {
      const imperative = tense === "impératif";
      const person = pickOne(imperative ? IMPERATIVE_PERSONS : PERSONS);
      const type = pickOne(imperative ? IMPERATIVE_TYPES : SENTENCE_TYPES);
      return (
        `Write one original French sentence at ${cefr}, ` +
        `using the French tense "${tense}" (${tense && TENSE_GUIDES[tense]}), ` +
        `on the theme "${theme}". The main verb uses the person "${person}", ` +
        `and the sentence is a ${type}, with ${MAX_WORDS[mode]} words at most.` +
        variety +
        priority
      );
    }
    case "paragraphe":
      return (
        `Write a short French paragraph of three linked sentences at ${cefr}, ` +
        `on the theme "${theme}", mainly told with the person "${pickOne(PERSONS)}", ` +
        `with ${MAX_WORDS[mode]} words at most in all. ` +
        "Use logical connectors that fit the level." +
        variety +
        priority
      );
  }
}

function reviewSection(review: Review, mode: Mode) {
  const details = [
    review.remark && `- remark: ${review.remark}`,
    review.tag && `- error type: ${review.tag}`,
    `- corrected answer (fixed words between **): ${review.correction}`,
  ].filter(Boolean);
  const how =
    mode === "phrase" || mode === "paragraphe"
      ? "in a different situation"
      : "with the same word or another one";
  return (
    "\n\n## Review\n" +
    "The learner recently made this mistake:\n" +
    details.join("\n") +
    `\nWrite the item so it tests this exact point again, ${how}, without pointing it out. ` +
    "If this conflicts with the theme or the Avoid list, the review comes first."
  );
}

// Every field is required: Groq's strict JSON mode rejects optional ones.
// No length limits: one answer over a limit would fail the whole call, so the
// code checks the lengths instead.
// The situation comes first, so the model settles its idea before writing the item.
export const exerciseSchema = z.object({
  situation: z.string(),
  text: z.string(),
  reference: z.string(),
});

// Builds the prompt and asks the model for one exercise. The language model can
// be replaced, so tests can run this without calling a provider.
export async function generateExercise(
  input: GenerateInput,
  languageModel?: LanguageModel,
): Promise<Exercise> {
  const { review } = input;
  // A review keeps the mistake's mode, level and tense. Mistakes saved before
  // the mode was stored come back as a sentence.
  const combination = pickCombination(
    input,
    review && {
      mode: review.mode ?? "phrase",
      level: review.level,
      tense: review.tense,
      verbType: review.verbType,
    },
  );
  const avoid = input.avoid?.length
    ? "\n\n## Avoid\n" +
      `- These items, already given: ${input.avoid.join(" ; ")}.\n` +
      "- Reusing the same structure or the same characters."
    : "";

  const item = await retryIfInvalid(async () => {
    const { output } = await generateText({
      model: languageModel ?? modelFor(input.model),
      providerOptions: providerOptionsFor(input.model),
      temperature: temperatureFor(input.model, "generate"),
      maxRetries: 1,
      // Room for the thinking and a long paragraph, so the JSON isn't cut short.
      maxOutputTokens: 1500,
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
      prompt:
        "## Task\n" +
        instructions(combination) +
        avoid +
        (review ? reviewSection(review, combination.mode) : ""),
    });

    // The situation only helps the model think; the page doesn't need it.
    const text = output.text.trim();
    const reference = output.reference.trim();
    if (!text || !reference) {
      throw new InvalidAnswerError("Empty item or reference");
    }
    if (text.length > MAX_TEXT_LENGTH || reference.length > MAX_TEXT_LENGTH) {
      throw new InvalidAnswerError(`Item too long (${text.length} characters)`);
    }
    return { text, reference };
  });

  return { ...item, ...combination };
}
