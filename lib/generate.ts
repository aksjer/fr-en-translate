// Generates a batch of exercises: one short prompt per mode, built from the settings.
import { generateText, Output } from "ai";
import { z } from "zod";
import { InvalidAnswerError, MINIMAL_THINKING, model, withoutEntities } from "@/lib/model";
import {
  MAX_AVOID,
  MAX_TEXT_LENGTH,
  MODE_USES,
  MODES,
  TENSES,
  THEMES,
  VERB_TYPES,
  WORD_TYPES,
  englishKey,
  type Mode,
  type Tense,
  type Theme,
  type VerbType,
  type WordType,
} from "@/lib/options";
import { pick, settingsSchema } from "@/lib/settings";

// Items per call; the page keeps the extra ones in a queue.
export const BATCH_SIZE = 3;

const avoidList = z.array(z.string().max(300)).max(MAX_AVOID).optional();
const reviewList = z
  .array(z.object({ french: z.string().max(300), english: z.string().max(300) }))
  .max(MAX_AVOID)
  .optional();

// About 1 in 4 items practices again a past mistake, when there is one.
const REVIEW_CHANCE = 0.25;

export const generateInputSchema = settingsSchema.extend({
  // The last English items of each mode, not to give again.
  avoid: z.object({ word: avoidList, verb: avoidList, sentence: avoidList }).partial().optional(),
  // The items the learner missed and hasn't got right since, per mode.
  review: z
    .object({ word: reviewList, verb: reviewList, sentence: reviewList })
    .partial()
    .optional(),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

type Pick = {
  theme: Theme;
  kind?: WordType;
  verbType?: VerbType;
  tense?: Tense;
  // A missed item practiced again.
  review?: { french: string; english: string };
};

export type Exercise = Omit<Pick, "review"> & {
  review?: boolean;
  mode: Mode;
  // The French to translate, its expected English, and for a word or verb a
  // French example sentence.
  text: string;
  reference: string;
  context?: string;
};

const text = z.string().min(1).max(MAX_TEXT_LENGTH);

function describe(mode: Mode, item: Pick) {
  const { review } = item;
  if (review && mode === "sentence") {
    return `a new sentence in the ${item.tense} that practices again what was missed in: ${review.french} (${review.english})`;
  }
  if (review)
    return `the same item again: ${review.french} (${review.english}), with a new example`;
  if (mode === "word") return `a ${item.kind} about ${item.theme}`;
  if (mode === "verb") return `a verb that is ${item.verbType} in English, about ${item.theme}`;
  return `in the ${item.tense}, about ${item.theme}`;
}

function prompt(mode: Mode, items: Pick[], avoid: string[]) {
  const list = items.map((item, index) => `${index + 1}. ${describe(mode, item)}`).join("\n");
  const task =
    mode === "sentence"
      ? `Write ${items.length} short natural French sentences, each with its translation into natural American English:`
      : mode === "word"
        ? `Give ${items.length} common English words, each with its French word, the English word, and a short French example sentence using the French word:`
        : `Give ${items.length} common English verbs, each with its French infinitive, the English infinitive with "to", and a short French example sentence using the French verb:`;
  return [task, list, avoid.length ? `Don't use any of these: ${avoid.join(", ")}.` : ""]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateExercises(input: GenerateInput): Promise<Exercise[]> {
  const mode = pick(input.modes, MODES);
  const uses = MODE_USES[mode];
  const reviews = [...(input.review?.[mode] ?? [])];
  const items: Pick[] = Array.from({ length: BATCH_SIZE }, () => ({
    theme: pick(input.themes, THEMES),
    ...(uses.wordType && { kind: pick(input.wordTypes, WORD_TYPES) }),
    ...(uses.verbType && { verbType: pick(input.verbTypes, VERB_TYPES) }),
    ...(uses.tense && { tense: pick(input.tenses, TENSES) }),
    // Each missed item at most once a batch.
    ...(reviews.length > 0 &&
      Math.random() < REVIEW_CHANCE && {
        review: reviews.splice(Math.floor(Math.random() * reviews.length), 1)[0],
      }),
  }));
  const avoid = input.avoid?.[mode] ?? [];
  const schema = z.object({
    items: z.array(
      z.object({
        french: text,
        english: text,
        // The French example sentence of a word or verb.
        ...(mode !== "sentence" && { example: text }),
      }),
    ),
  });
  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: prompt(mode, items, avoid),
    providerOptions: MINIMAL_THINKING,
    maxOutputTokens: 1500,
  });
  const avoided = new Set(avoid.map(englishKey));
  const exercises = withoutEntities(output.items)
    .slice(0, BATCH_SIZE)
    .map((item, index): Exercise => {
      const { review, ...settings } = items[index] ?? items[0];
      return {
        mode,
        ...settings,
        ...(review && { review: true }),
        text: item.french.trim(),
        reference: item.english.trim(),
        ...(typeof item.example === "string" && { context: item.example.trim() }),
      };
    });
  // The model doesn't always follow the list: repeats are dropped in code.
  const fresh = exercises.filter(
    (exercise) => exercise.review || !avoided.has(englishKey(exercise.reference)),
  );
  if (!exercises.length) throw new InvalidAnswerError("No items");
  return fresh.length ? fresh : exercises;
}
