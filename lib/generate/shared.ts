// What every mode's prompt shares: the request from the page, the learner,
// their history, and the call for the modes that return an item and its reference.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  InvalidAnswerError,
  isInvalidAnswer,
  model,
  retryIfInvalid,
  thinkingFor,
} from "@/lib/model";
import {
  englishKey,
  HISTORY_PER_MODE,
  isWordMode,
  MAX_HISTORY,
  MAX_KNOWN,
  MAX_REVIEW,
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
  answer: clipped(300).optional().catch(undefined),
  ok: z.boolean().optional().catch(undefined),
  tag: clipped(40).optional().catch(undefined),
  remark: clipped(300).optional().catch(undefined),
});

type HistoryItem = z.infer<typeof historyItemSchema>;

// A missed or unanswered word or verb that a review may give again.
const reviewItemSchema = z.object({
  text: clipped(300),
  english: clipped(40).optional().catch(undefined),
});

export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const generateInputSchema = settingsSchema.extend({
  history: z
    .array(historyItemSchema)
    .max(MAX_HISTORY)
    .optional()
    .catch(undefined),
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
  // The oldest missed words and verbs, by mode, for a review.
  review: z
    .object({
      word: z.array(reviewItemSchema).max(MAX_REVIEW),
      verb: z.array(reviewItemSchema).max(MAX_REVIEW),
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
  // A missed word or verb given again.
  review?: boolean;
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
  const intro = `## Learner\nA native French speaker learning American English, at CEFR ${level} in English.`;
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
  return text.replace(
    /(^|[\s«(])(l) (?=[aeiouyhàâéèêëîïôûœ])/giu,
    `$1$2${apostrophe}`,
  );
}

// The items of this mode the learner got right, and the recent ones.
export function history(input: GenerateInput, mode: Mode) {
  const known = isWordMode(mode)
    ? (input.known?.[mode as "word" | "verb"] ?? [])
    : [];
  // Only the items of this mode, so a word isn't compared with sentences.
  const recent = (input.history ?? [])
    .filter((item) => item.mode === mode)
    .slice(-HISTORY_PER_MODE);
  return { known, recent };
}

// The code decides when a word or verb is a review of a missed one: left to
// the model, missed items came back too often or never.
const REVIEW_CHANCE = 0.25;

export function reviewFor(input: GenerateInput, mode: "word" | "verb") {
  const items = input.review?.[mode] ?? [];
  return items.length && Math.random() < REVIEW_CHANCE ? items : undefined;
}

// The task of a review: one of the missed items, as is, with a new context.
export function reviewTask(
  items: ReviewItem[],
  mode: "word" | "verb",
  theme?: string,
) {
  const lines = items.map(
    (item) => `- « ${item.text} »${item.english ? ` → ${item.english}` : ""}`,
  );
  return (
    `This is a review. Give again one of these ${mode}s that the learner missed or ` +
    "left unanswered, oldest first, as is: the same French text, in the same meaning (the " +
    "English after the arrow, when there is one), with a new context sentence.\n" +
    lines.join("\n") +
    `\nPrefer one that fits the theme "${theme}"; if none does, take the first.`
  );
}

// The number of new words or verbs asked in one call: the code keeps the first
// one the learner neither learned nor saw recently, so a repeat rarely costs
// another call.
export const CANDIDATES = 3;

// The same French text, whatever its case, spaces, quotes or apostrophes.
function sameText(text: string) {
  return text
    .toLowerCase()
    .replace(/[«»"]/g, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type Choice = { text: string; english: string };

// The answer to give: in a review, the first one that is a missed item;
// otherwise the first one the learner neither learned nor saw recently.
export function chooseAnswer<T extends Choice>(
  answers: T[],
  rules: { known: string[]; recent: HistoryItem[]; review?: ReviewItem[] },
) {
  if (rules.review) {
    const texts = new Set(rules.review.map((item) => sameText(item.text)));
    return answers.find((answer) => texts.has(sameText(answer.text)));
  }
  const english = new Set([
    ...rules.known,
    ...rules.recent.flatMap((item) => (item.english ? [item.english] : [])),
  ]);
  // The same French word in another meaning is a new item: the French alone
  // only counts for an unanswered item, whose English isn't stored.
  const texts = new Set(
    rules.recent.flatMap((item) => (item.english ? [] : [sameText(item.text)])),
  );
  return answers.find(
    (answer) =>
      !english.has(answer.english) && !texts.has(sameText(answer.text)),
  );
}

// The English words or verbs the learner got right: the model avoids them, and
// the code still checks its answer.
export function knownSection(known: string[], mode: "word" | "verb") {
  if (!known.length) return "";
  return (
    `\n\n## Already learned\nThe learner already knows these English ${mode}s. ` +
    `Never give one of them again:\n${known.join(", ")}`
  );
}

// Told to the model when its first answers can't be used.
export function tryAgainSection(answers: Choice[], review: boolean) {
  return (
    "\n\n## Try again\n" +
    (review
      ? "Your last answer wasn't one of the items to review. Give one of the listed items."
      : "The learner already knows or just saw these English words: " +
        `${answers.map((answer) => answer.english).join(", ")}. Choose other ones.`)
  );
}

// The learner's recent items in this mode and how they did, so the model can
// vary its choices and test a missed point again.
export function historySection(items: HistoryItem[], mode: Mode) {
  if (!items.length) return "";
  const lines = items.map((item, index) => {
    const english =
      isWordMode(mode) && item.english ? ` → ${item.english}` : "";
    // Only when it says more than the expected English.
    const wrote =
      item.answer && !(isWordMode(mode) && englishKey(item.answer) === item.english)
        ? ` (learner wrote: « ${item.answer} »)`
        : "";
    // The last 5 sentences can give the next one its extra learning point.
    const recent =
      !isWordMode(mode) && items.length - index <= 5 ? " (recent)" : "";
    const result =
      item.ok === undefined
        ? "unanswered"
        : item.ok
          ? "right"
          : `wrong${recent}${item.remark ? `: ${item.remark}` : " (no detail)"}`;
    return `- « ${item.text} »${english}${wrote}: ${result}`;
  });
  return (
    "\n\n## History\n" +
    "The learner's last items in this mode, oldest first:\n" +
    lines.join("\n") +
    "\nUse it to choose the next item. What the learner wrote shows the English they " +
    "already use: a word they wrote right is a word they know, and their wording " +
    "shows what to practice next. " +
    (isWordMode(mode)
      ? "Give no item of the history again, and none of its English words, even with " +
        "another French word or context. The same French word with another meaning is " +
        "a new item."
      : "Vary the person, the sentence type, the situation and the characters from one " +
        "item to the next.")
  );
}

// Every field is required, so the model always writes each one.
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

type ItemAnswer = z.infer<typeof exerciseSchema> & { context?: string };

// Checks one answer in code, and cleans it up for the page.
function checkedItem(output: ItemAnswer, mode: Mode) {
  // The situation only helps the model think; the page doesn't need it.
  const raw = output.text.trim();
  const text = withApostrophes(raw);
  if (text !== raw) console.warn("Added a missing apostrophe:", raw);
  const reference = output.reference.trim();
  const context =
    output.context === undefined
      ? undefined
      : withApostrophes(output.context.trim());
  if (!text || !reference || context === "") {
    throw new InvalidAnswerError("Empty item, context or reference");
  }
  // A word is never a sentence, nor is its reference (the model sometimes
  // translates the context sentence instead).
  if (isWordMode(mode) && /[.!?]$/.test(text)) {
    throw new InvalidAnswerError(`A sentence instead of a word: ${text}`);
  }
  if (isWordMode(mode) && (/[.!?]$/.test(reference) || reference.split(/\s+/).length > 4)) {
    throw new InvalidAnswerError(`A sentence instead of a reference: ${reference}`);
  }
  if (
    text.length > MAX_TEXT_LENGTH ||
    reference.length > MAX_TEXT_LENGTH ||
    (context?.length ?? 0) > MAX_TEXT_LENGTH
  ) {
    throw new InvalidAnswerError(`Item too long (${text.length} characters)`);
  }
  return {
    text,
    reference,
    english: englishKey(reference),
    ...(context && { context }),
  };
}

// Keeps the answers that pass the code's checks, and drops the others.
export function usableAnswers<T, U>(answers: T[], check: (answer: T) => U) {
  return answers.flatMap((answer) => {
    try {
      return [check(answer)];
    } catch (error) {
      if (!isInvalidAnswer(error)) throw error;
      console.warn("Unusable answer:", (error as Error).message);
      return [];
    }
  });
}

// Asks the model for a sentence and its reference, or for a word with a
// context sentence: CANDIDATES new words at once, or one word in a review.
// Each mode gives its own fields, its task and its own sections. When no
// answer fits, the model is asked again once; the second time, the first
// usable answer is kept, so the page never gets an error.
export async function generateItem(
  input: GenerateInput,
  combination: Combination,
  prompt: {
    fields: string[];
    task: string;
    sections?: string;
    review?: ReviewItem[];
  },
): Promise<Exercise> {
  const { mode, level } = combination;
  const { known, recent } = history(input, mode);
  const several = isWordMode(mode) && !prompt.review;
  const schema = isWordMode(mode) ? wordExerciseSchema : exerciseSchema;

  let attempt = 0;
  let tryAgain = "";
  const item = await retryIfInvalid(async () => {
    attempt++;
    const { output } = await generateText({
      model,
      providerOptions: thinkingFor("generate"),
      maxRetries: 1,
      // Room for the thinking and a long sentence or several words, so the
      // JSON isn't cut short.
      maxOutputTokens: several ? 4000 : 3000,
      output: Output.object({
        schema: (several ? z.object({ items: z.array(schema) }) : schema) as z.ZodType<
          ItemAnswer | { items: ItemAnswer[] }
        >,
      }),
      system: [
        "You are an American English teacher for a French speaker. You write an item in",
        "natural, correct French that the learner will translate into American English.",
        "",
        "## Fields, in this order",
        ...(several
          ? [
              `items: ${CANDIDATES} different items, best first, each with these fields:`,
            ]
          : []),
        ...prompt.fields,
      ].join("\n"),
      prompt:
        GOAL +
        "\n\n" +
        learner(mode, level) +
        "\n\n## Task\n" +
        prompt.task +
        // A review only gives a listed item again: the history would contradict it.
        (prompt.review ? "" : historySection(recent, mode)) +
        (several ? knownSection(known, mode as "word" | "verb") : "") +
        (prompt.sections ?? "") +
        tryAgain,
    });

    const answers = several
      ? (output as { items: ItemAnswer[] }).items.slice(0, CANDIDATES)
      : [output as ItemAnswer];
    const usable = usableAnswers(answers, (answer) =>
      checkedItem(answer, mode),
    );
    if (!usable.length) throw new InvalidAnswerError("No usable item");
    if (!isWordMode(mode)) return { ...usable[0], fits: true };
    const chosen = chooseAnswer(usable, {
      known,
      recent,
      review: prompt.review,
    });
    if (chosen) return { ...chosen, fits: true };
    if (attempt > 1) return { ...usable[0], fits: false };
    tryAgain = tryAgainSection(usable, Boolean(prompt.review));
    throw new InvalidAnswerError(
      `No fitting item: ${usable.map((answer) => answer.english).join(", ")}`,
    );
  });

  return {
    text: item.text,
    reference: item.reference,
    ...(item.context && { context: item.context }),
    ...combination,
    // A review whose answer isn't a listed item is a new word.
    ...(prompt.review && item.fits && { review: true }),
  };
}
