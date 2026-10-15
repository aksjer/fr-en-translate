// What every mode's prompt shares: the request from the page, the learner,
// their history, and the call for the modes that return an item and its reference.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  InvalidAnswerError,
  modelFor,
  providerOptionsFor,
  retryIfInvalid,
  temperatureFor,
} from "@/lib/model";
import {
  englishKey,
  isWordMode,
  MAX_HISTORY,
  MAX_KNOWN,
  MAX_TEXT_LENGTH,
  MODES,
  type Level,
  type Mode,
} from "@/lib/options";
import { settingsSchema, type Combination } from "@/lib/settings";

// Cuts a text from the page instead of rejecting it: items stored in the
// browser may be longer than today's limits.
const clipped = (max: number) =>
  z.string().transform((text) => text.trim().slice(0, max));

// One recent exercise and how the learner did: the model uses these to choose
// the next item. Items given but not answered have no result.
const historyItemSchema = z.object({
  text: clipped(300),
  mode: z.enum(MODES).optional().catch(undefined),
  english: clipped(40).optional().catch(undefined),
  ok: z.boolean().optional().catch(undefined),
  tag: clipped(40).optional().catch(undefined),
  remark: clipped(300).optional().catch(undefined),
});

type HistoryItem = z.infer<typeof historyItemSchema>;

export const generateInputSchema = settingsSchema.extend({
  history: z.array(historyItemSchema).max(MAX_HISTORY).optional().catch(undefined),
  // The English of the items the learner got right, by mode: never given again.
  // A page from before this field changed shape sends none.
  known: z
    .object({
      word: z.array(clipped(40)).max(MAX_KNOWN),
      verb: z.array(clipped(40)).max(MAX_KNOWN),
    })
    .partial()
    .optional()
    .catch(undefined),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export type Exercise = Combination & {
  text: string;
  reference: string;
  // A verb's base form, past simple and past participle.
  forms?: [string, string, string];
  // A French sentence using a verb in the meaning to translate (tirer: pull or shoot).
  context?: string;
};

// What the app is for: with it, the model can choose well in cases no rule covers.
export const GOAL =
  "## Goal\n" +
  "The app helps a French speaker learn the most useful American English they don't know " +
  "yet. They translate your item into American English, and another teacher grades it. " +
  "Each item should teach them something new and useful at their level, or something " +
  "they got wrong before.";

// The level is the learner's English level: any French is easy for them, so what
// matters is the English the translation needs.
export function learner(mode: Mode, level: Level) {
  const intro =
    `## Learner\nA native French speaker learning American English, at CEFR ${level} in English.`;
  if (isWordMode(mode)) return intro;
  return `${intro} The French is never the difficulty: the English needed to translate it is.`;
}

// The learner wants the most useful English: words from the Oxford 5000, which
// gives a CEFR level to each word up to C1. "A C1 learner should know" gave
// basic words such as lose at every level.
export function commonAt(level: Level, kind: string) {
  return level === "C2"
    ? `an advanced ${kind}, beyond the Oxford 5000, that learners usually learn at CEFR C2`
    : `${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind} common in American English (COCA) ` +
        `from the Oxford 5000 that learners usually learn at CEFR ${level}, not at an ` +
        "easier level";
}

// Gemini sometimes drops the apostrophe of l' (« dans l avion »): the code adds
// it back. Only l', since a lone d or j can be a letter (la vitamine D, le jour J).
export function withApostrophes(text: string) {
  const apostrophe = text.includes("’") ? "’" : "'";
  return text.replace(/(^|[\s«(])(l) (?=[aeiouyhàâéèêëîïôûœ])/giu, `$1$2${apostrophe}`);
}

// The items of this mode the learner got right, and the recent ones.
export function history(input: GenerateInput, mode: Mode) {
  const known = isWordMode(mode) ? (input.known?.[mode as "word" | "verb"] ?? []) : [];
  // Only the items of this mode, so a word isn't compared with sentences.
  // The prompt only lists the last ones: a long list costs tokens and is
  // followed no better.
  const recent = (input.history ?? [])
    .filter((item) => item.mode === mode)
    .slice(-30);
  return { known, recent };
}

// The learner's recent items in this mode and how they did, so the model can
// vary its choices and test a missed point again.
export function historySection(items: HistoryItem[], mode: Mode) {
  if (!items.length) return "";
  const lines = items.map((item, index) => {
    const english = isWordMode(mode) && item.english ? ` → ${item.english}` : "";
    // A missed word comes back only after a few others: the code counts them,
    // since small models count lines badly.
    const back = isWordMode(mode) && items.length - 1 - index >= 5 ? " (may come back)" : "";
    const result =
      item.ok === undefined
        ? `skipped${back}`
        : item.ok
          ? "right"
          : `wrong${back}${item.remark ? `: ${item.remark}` : " (no detail)"}`;
    return `- « ${item.text} »${english}: ${result}`;
  });
  return (
    "\n\n## History\n" +
    "The learner's last items in this mode, oldest first:\n" +
    lines.join("\n") +
    "\nUse it to choose the next item. " +
    (isWordMode(mode)
      ? "Never give again an English word answered right, even with another French word " +
        "or context. The same French word with another meaning is a new item (tirer: pull, " +
        "then shoot). Only an item marked (may come back) may be given again as is; give " +
        "no other item of the history again."
      : "A wrong item among the 5 most recent ones (the last 5 lines), when its remark " +
        "names the difficulty, can give the extra learning point (see Learning point). Vary " +
        "the person, the sentence type, the situation and the characters from one item to " +
        "the next.")
  );
}

export function knownSection(known: string[]) {
  return known.length
    ? "\n\n## Already learned\n" +
        `The learner already knows these English words: ${known.join(", ")}. ` +
        "Choose none of them."
    : "";
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

// A word also gets a French sentence that shows its meaning, written before the
// reference so the reference translates the word in that meaning.
const wordExerciseSchema = z.object({
  situation: z.string(),
  text: z.string(),
  context: z.string(),
  reference: z.string(),
});

// Asks the model for one word or sentence and its reference, plus a context
// sentence for a word. Each mode gives its own fields, its task and its own
// sections; an item already known is asked again once, and the second
// answer is kept, so the page never gets an error.
export async function generateItem(
  input: GenerateInput,
  combination: Combination,
  prompt: { fields: string[]; task: string; sections?: string },
): Promise<Exercise> {
  const { mode, level } = combination;
  const { known, recent } = history(input, mode);

  let attempt = 0;
  const item = await retryIfInvalid(async () => {
    attempt++;
    const { output } = await generateText({
      model: modelFor(input.model),
      providerOptions: providerOptionsFor(input.model),
      temperature: temperatureFor(input.model, "generate"),
      maxRetries: 1,
      // Room for the thinking and a long sentence, so the JSON isn't cut short.
      maxOutputTokens: 1500,
      output: Output.object({
        schema: (isWordMode(mode) ? wordExerciseSchema : exerciseSchema) as z.ZodType<
          z.infer<typeof exerciseSchema> & { context?: string }
        >,
      }),
      system: [
        "You are an American English teacher for a French speaker. You write an item in",
        "natural, correct French that the learner will translate into American English.",
        "",
        "## Fields, in this order",
        ...prompt.fields,
      ].join("\n"),
      prompt:
        GOAL +
        "\n\n" +
        learner(mode, level) +
        "\n\n## Task\n" +
        prompt.task +
        knownSection(known) +
        historySection(recent, mode) +
        (prompt.sections ?? ""),
    });

    // The situation only helps the model think; the page doesn't need it.
    const raw = output.text.trim();
    const text = withApostrophes(raw);
    if (text !== raw) console.warn("Added a missing apostrophe:", raw);
    const reference = output.reference.trim();
    const context =
      output.context === undefined ? undefined : withApostrophes(output.context.trim());
    if (!text || !reference || context === "") {
      throw new InvalidAnswerError("Empty item, context or reference");
    }
    // A word is never a sentence: ask again if it is one.
    if (isWordMode(mode) && /[.!?]$/.test(text)) {
      throw new InvalidAnswerError(`A sentence instead of a word: ${text}`);
    }
    if (
      text.length > MAX_TEXT_LENGTH ||
      reference.length > MAX_TEXT_LENGTH ||
      (context?.length ?? 0) > MAX_TEXT_LENGTH
    ) {
      throw new InvalidAnswerError(`Item too long (${text.length} characters)`);
    }
    if (attempt === 1 && known.includes(englishKey(reference))) {
      throw new InvalidAnswerError(`Already known: ${reference}`);
    }
    return { text, reference, ...(context && { context }) };
  });

  return { ...item, ...combination };
}
