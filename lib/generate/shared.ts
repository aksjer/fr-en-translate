// What every mode's prompt shares: the request from the page, the learner,
// their history, and the call for the modes that return an item and its reference.
import expandContractions from "@stdlib/nlp-expand-contractions";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  InvalidAnswerError,
  isInvalidAnswer,
  model,
  thinking,
  withoutEntities,
} from "@/lib/model";
import {
  englishKey,
  HISTORY_PER_MODE,
  sameText,
  isWordMode,
  MAX_HISTORY,
  MAX_KNOWN,
  MAX_POINTS,
  MAX_POINTS_TO_PRACTICE,
  MAX_REVIEW,
  MAX_TEXT_LENGTH,
  FREQUENCIES,
  MODES,
  pointName,
  SENTENCE_FOCUSES,
  TENSES,
  THEMES,
  VERB_TYPES,
  WORD_KINDS,
  type Frequency,
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
  accepted: clipped(40).optional().catch(undefined),
  answer: clipped(300).optional().catch(undefined),
  ok: z.boolean().optional().catch(undefined),
  tag: clipped(40).optional().catch(undefined),
  remark: clipped(300).optional().catch(undefined),
  frequency: z.enum(FREQUENCIES).optional().catch(undefined),
  mistakes: z
    .array(z.object({ remark: clipped(300), tag: clipped(40) }))
    .max(6)
    .optional()
    .catch(undefined),
  at: clipped(30).optional().catch(undefined),
  kind: z.enum(WORD_KINDS).optional().catch(undefined),
  focus: z.enum(SENTENCE_FOCUSES).optional().catch(undefined),
  tense: z.enum(TENSES).optional().catch(undefined),
  theme: z.enum(THEMES).optional().catch(undefined),
  verbType: z.enum(VERB_TYPES).optional().catch(undefined),
  review: z.boolean().optional().catch(undefined),
  retest: z.boolean().optional().catch(undefined),
  retestMissed: z.boolean().optional().catch(undefined),
  context: clipped(300).optional().catch(undefined),
  reference: clipped(300).optional().catch(undefined),
  correction: clipped(300).optional().catch(undefined),
  point: clipped(60).optional().catch(undefined),
  similar: z.array(clipped(40)).max(6).optional().catch(undefined),
  pointResult: z.enum(["right", "wrong", "avoided"]).optional().catch(undefined),
});

type HistoryItem = z.infer<typeof historyItemSchema>;

// A missed or unanswered word or verb that a review may give again.
const reviewItemSchema = z.object({
  text: clipped(300),
  english: clipped(40).optional().catch(undefined),
  reference: clipped(60).optional().catch(undefined),
  forms: z.tuple([clipped(40), clipped(40), clipped(40)]).optional().catch(undefined),
  frequency: z.enum(FREQUENCIES).optional().catch(undefined),
  context: clipped(300).optional().catch(undefined),
  misses: z.number().int().min(0).optional().catch(undefined),
  kind: z.enum(WORD_KINDS).optional().catch(undefined),
  today: z.boolean().optional().catch(undefined),
});

export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const generateInputSchema = settingsSchema.extend({
  history: z
    .array(historyItemSchema)
    .max(MAX_HISTORY)
    .optional()
    .catch(undefined),
  // The English of the items the learner got right, by mode: never given again.
  known: z
    .object({
      word: z.array(clipped(40)).max(MAX_KNOWN),
      verb: z.array(clipped(40)).max(MAX_KNOWN),
    })
    .partial()
    .optional()
    .catch(undefined),
  // The grammar points of sentences the learner mastered (never the target
  // again) and the ones to practice again.
  points: z
    .object({
      mastered: z.array(clipped(60)).max(MAX_POINTS),
      practice: z.array(clipped(60)).max(MAX_POINTS_TO_PRACTICE),
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
  // How common the model says the English word or verb is.
  frequency?: Frequency;
  // The grammar point a sentence practices (as soon as, should).
  point?: string;
  // The French of the stored reviews whose context couldn't be written: the
  // batch replaces them, and they aren't due again today.
  reviewSkipped?: string[];
  // The batch's retest couldn't be written: the next batch tries it again.
  retestMissed?: boolean;
};

// What the app is for: with it, the model can choose well in cases no rule covers.
export const GOAL =
  "## Goal\n" +
  "The app helps a French speaker learn the most useful American English they don't know " +
  "yet. They translate your item into American English, and another teacher grades it " +
  "against your item as you wrote it.";

// Any French is easy for the learner: what matters is the English the
// translation needs.
export function learner(mode: Mode) {
  const intro =
    "## Learner\nA native French speaker learning American English. They want the English " +
    "used every day: in conversations, videos, TV shows, movies and the news.";
  if (isWordMode(mode)) return intro;
  return `${intro} The French is never the difficulty: the English needed to translate it is.`;
}

// The learner wants only the most common English, whatever their level: a
// small model knows the Oxford 3000 list, but it can't count frequency ranks.
// News words count too: the learner reads the news.
const COMMON_RULE =
  "among the most common words of everyday American English (the Oxford 3000, the top " +
  "of COCA, news words such as despite or according to), never a rare or specialized " +
  "word (craftsmanship, to reap)";

export const COMMON_ENGLISH = `${COMMON_RULE}.`;

// Examples of the kind asked for, so a verb isn't modeled on kitchen or until.
const COMMON_EXAMPLES: Record<string, string> = {
  noun: "bill, neighbor, deal, kitchen",
  adjective: "tired, busy, cheap, worth it",
  adverb: "already, still, almost, anyway",
  modal: "should, could, might, have to",
  preposition: "during, until, instead of, because of",
  conjunction: "although, unless, as soon as, as well as, as long as, even though",
  "regular verb": "need, try, wait, happen",
  "irregular verb": "get, keep, bring, find",
};

export function commonAt(kind: string) {
  const examples = COMMON_EXAMPLES[kind];
  return (
    `${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind} ` +
    (examples ? `(like ${examples}, only as examples) ` : "") +
    COMMON_RULE
  );
}

// The model rates each word, so the history shows how common the words it
// gives are. Nothing is asked again for a rare one.
export const FREQUENCY_FIELD = [
  "- frequency: how often an American hears this English word: everyday (every day or",
  "  every week), sometimes, or rare.",
];

// Gemini sometimes drops accented letters, leaving a space in their place
// (« je suis tr s occup . »). French never puts a space before a period or a
// comma, so that space shows a broken text; the item is asked again.
// An HTML entity left over after withoutEntities shows a broken text too; a
// lone & (AT&T, H&M) is fine.
export function hasDroppedLetters(text: string) {
  return /\s[.,]/.test(text) || /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(text);
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
// the model, missed items came back too often or never. One missed today
// comes back for sure (the page only sends it a few items later), but never
// twice in a row, so new items still come; older ones come back by chance.
// Each item of a batch is a review or not on its own, with a different
// missed item each time.
const REVIEW_CHANCE = 0.25;

export function reviewSlots(input: GenerateInput, mode: "word" | "verb", count: number) {
  const items = [...(input.review?.[mode] ?? [])];
  const slots: (ReviewItem | undefined)[] = [];
  let previous = input.history?.filter((item) => item.mode === mode).at(-1)?.review;
  for (let index = 0; index < count; index++) {
    const due = items[0]?.today && !previous;
    const review = items.length && (due || Math.random() < REVIEW_CHANCE) ? items.shift() : undefined;
    slots.push(review);
    previous = Boolean(review);
  }
  return slots;
}

// The task of a review: the missed item as it was, with a new context. Items
// stored whole keep their French and English, and the code gives them back
// as stored; older ones, whose English wasn't kept at show time, keep their
// French only.
export function reviewTask(review: ReviewItem, mode: "word" | "verb", theme?: string) {
  const english = review.english && (mode === "verb" ? `to ${review.english}` : review.english);
  return (
    `A review of « ${review.text} »${english ? ` → ${english}` : ""}, which the learner ` +
    "missed: choices has just one, with this exact French text" +
    (english ? " and English" : " in the meaning they missed") +
    `, and a new context sentence on the theme "${theme}" if it fits` +
    (review.context ? `, different from « ${review.context} ».` : ".")
  );
}

// Checks the answer to a review: the item it gives must be the missed one.
export function reviewChecked<T extends { text: string; english: string }>(
  review: ReviewItem,
  answer: T,
) {
  if (sameText(answer.text) !== sameText(review.text)) {
    throw new InvalidAnswerError(`Not the item to review: « ${answer.text} »`);
  }
  if (review.english && englishKey(answer.english) !== review.english) {
    throw new InvalidAnswerError(`Not the English to review: ${answer.english}`);
  }
  return answer;
}

// A text lowercase and without accents (« Été » is ete), with its words
// separated by single spaces, so one text can be looked for in another. An
// apostrophe separates words too: arbre is a word of « l'arbre ».
function folded(text: string) {
  return ` ${text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(" ")} `;
}

// Whether the words the model quoted are in the text, as they are written
// there: each part of a quote in several parts (ne … pas, not … yet).
function quotedIn(quote: string, text: string) {
  const parts = quote.split(/…|\.\.\./).filter((part) => folded(part).trim());
  return parts.length > 0 && parts.every((part) => folded(text).includes(folded(part)));
}

// English with its contractions written in full (we'll is we will, won't is
// will not), so a quote shares its words with the point.
function expanded(text: string) {
  return expandContractions(text.replace(/[’‘]/g, "'"));
}

// A context sentence, cleaned up, or an error if it can't be shown: the
// words that translate the item, as the model quoted them in any form
// (souviens, belle), must be in it, and it must not be a copy (of the last
// context of a review). The prompts give no context sentence to copy.
export function checkedContext(
  raw: string,
  itemInContext: string,
  others: (string | undefined)[] = [],
) {
  const context = withApostrophes(raw.trim());
  if (!context) throw new InvalidAnswerError("Empty context");
  if (hasDroppedLetters(context)) throw new InvalidAnswerError(`Letters missing: ${context}`);
  if (context.length > MAX_TEXT_LENGTH) {
    throw new InvalidAnswerError(`Context too long: ${context}`);
  }
  if (!quotedIn(itemInContext, context)) {
    throw new InvalidAnswerError(`« ${itemInContext} » not in the context: ${context}`);
  }
  if (others.some((other) => other && folded(other) === folded(context))) {
    throw new InvalidAnswerError(`Context copied: ${context}`);
  }
  return context;
}

// Whether a reference uses the point of its sentence: the words the model
// quoted (had to for have to, hasn't … yet for not … yet) must be in the
// reference, every part of them, and share a word with the point, whole or
// inflected (depends for depend).
export function inReference(point: string, quote: string, reference: string) {
  const words = (text: string) => folded(text).trim().split(" ");
  const pointWords = words(expanded(point));
  // The quote as written and in full; 'd and 's can stand for two words
  // (you'd better, he's been), so both readings count.
  const quoteWords = [
    ...words(quote),
    ...words(expanded(quote)),
    ...(/['’]d\b/i.test(quote) ? ["had", "would"] : []),
    ...(/['’]s\b/i.test(quote) ? ["is", "has"] : []),
  ];
  return (
    quotedIn(quote, reference) &&
    quoteWords.some((word) =>
      pointWords.some((own) => word === own || (own.length >= 3 && word.startsWith(own))),
    )
  );
}

// The number of choices asked for each new word or verb: the code keeps the
// first one the learner neither learned nor saw recently, so a repeat rarely
// costs another call.
export const CHOICES = 2;

type Choice = { text: string; english: string };

// The English the learner practiced with an item: their own right word when
// it differs from the expected one, which can then come back.
export function learnedEnglish(item: HistoryItem) {
  const english = item.ok && item.accepted ? item.accepted : item.english;
  return english ? [english] : [];
}

// Tells which words or verbs are new: neither learned, nor recent, nor
// already in the batch. take() adds one to the batch.
export function freshness(input: GenerateInput, mode: "word" | "verb") {
  const { known, recent } = history(input, mode);
  const english = new Set([...known, ...recent.flatMap(learnedEnglish)]);
  // The same French word in another meaning is a new item: the French alone
  // only counts for an unanswered item, or an old one whose English isn't stored.
  const texts = new Set(
    recent.flatMap((item) => (item.english && item.ok !== undefined ? [] : [sameText(item.text)])),
  );
  // An item answered right with another word (sofa for « le canapé » → couch)
  // doesn't come back as is: its expected word may, with another French word.
  const answered = new Set(
    recent.flatMap((item) =>
      item.accepted && item.english && item.ok ? [`${sameText(item.text)} → ${item.english}`] : [],
    ),
  );
  return {
    isFresh: (answer: Choice) =>
      !english.has(answer.english) &&
      !texts.has(sameText(answer.text)) &&
      !answered.has(`${sameText(answer.text)} → ${answer.english}`),
    take: (answer: Choice) => {
      english.add(answer.english);
      texts.add(sameText(answer.text));
    },
  };
}

// The first choice that passes the code's checks and is new, taken for the
// batch; the reasons of the others otherwise.
export function firstFresh<T, U extends Choice>(
  choices: T[],
  check: (choice: T) => U,
  fresh: ReturnType<typeof freshness>,
) {
  const reasons: string[] = [];
  for (const choice of choices.slice(0, CHOICES)) {
    try {
      const answer = check(choice);
      if (fresh.isFresh(answer)) {
        fresh.take(answer);
        return answer;
      }
      reasons.push(`${answer.english} is learned, recent or already in this batch`);
    } catch (error) {
      if (!isInvalidAnswer(error)) throw error;
      reasons.push((error as Error).message);
    }
  }
  throw new InvalidAnswerError(reasons.join("; ") || "No choice");
}

// The English words or verbs the learner got right: the model avoids them, and
// the code still checks its answer.
export function knownSection(known: string[], mode: "word" | "verb") {
  if (!known.length) return "";
  return (
    `\n\n## Already learned\nThe learner knows these English ${mode}s: never one of ` +
    `them:\n${known.join(", ")}`
  );
}

// The most similar words a learner sees in corrections and hasn't learned yet.
const MAX_SIMILAR_TO_TEACH = 30;

// Words the corrections showed as close to or often confused with the ones the
// learner practiced: good next items, since the learner just met them.
export function similarSection(input: GenerateInput, mode: "word" | "verb") {
  const { known, recent } = history(input, mode);
  const skip = new Set([...known, ...recent.flatMap(learnedEnglish)]);
  const words = [
    ...new Set(
      recent
        .flatMap((item) => item.similar ?? [])
        .map(englishKey)
        .reverse(),
    ),
  ]
    .filter((word) => word && !skip.has(word))
    .slice(0, MAX_SIMILAR_TO_TEACH);
  if (!words.length) return "";
  return (
    "\n\n## Seen in corrections\nEnglish " +
    `${mode}s the corrections showed the learner, the last first. Prefer one that is ` +
    `common American English and fits the task:\n${words.join(", ")}`
  );
}

// The learner's recent items in this mode and how they did, so the model can
// vary its choices and test a missed point again.
export function historySection(items: HistoryItem[], mode: Mode) {
  if (!items.length) return "";
  const lastRetest = items.findLastIndex((item) => item.retest);
  const lines = items.map((item, index) => {
    const date = item.at ? `${item.at.slice(0, 10)} ` : "";
    const context = item.context ? ` (context: « ${item.context} »)` : "";
    // A sentence's expected English, only when the learner didn't answer it.
    const english = isWordMode(mode)
      ? item.english
        ? ` → ${item.english}${item.ok && item.accepted ? ` (learner's right word: ${item.accepted})` : ""}`
        : ""
      : item.reference && item.ok === undefined
        ? ` → « ${item.reference} »`
        : "";
    const practiced = [
      item.review && "review",
      item.retest && "retest of the mistake before",
      item.kind,
      item.verbType && `${item.verbType} verb`,
      item.tense,
      item.focus && `focus: ${item.focus}`,
      item.theme,
      item.frequency && `frequency: ${item.frequency}`,
    ].filter(Boolean);
    // Only when it says more than the expected English.
    const wrote =
      item.answer && !(isWordMode(mode) && englishKey(item.answer) === item.english)
        ? ` (learner wrote: « ${item.answer} »)`
        : "";
    const remarks = item.mistakes?.length
      ? item.mistakes.map((mistake) => mistake.remark).join(" / ")
      : item.remark;
    // The last 5 sentences can give the next one its extra learning point,
    // unless a later retest already practiced their mistake; a missed retest
    // keeps it.
    const recent =
      !isWordMode(mode) && items.length - index <= 5 && index >= lastRetest
        ? " (recent)"
        : "";
    const result =
      item.ok === undefined
        ? "unanswered"
        : item.ok
          ? `right${remarks ? ` (small remarks: ${remarks})` : ""}`
          : `wrong${recent}${remarks ? `: ${remarks}` : " (no detail)"}`;
    const corrected =
      item.correction && item.ok === false
        ? ` (corrected: « ${item.correction.replace(/\*\*/g, "")} »)`
        : "";
    const point = item.point
      ? ` (point « ${item.point} »${item.pointResult ? `: ${item.pointResult}` : ""})`
      : "";
    return (
      `- ${date}« ${item.text} »${context}${english}` +
      (practiced.length ? ` [${practiced.join(", ")}]` : "") +
      `${wrote}: ${result}${corrected}${point}`
    );
  });
  return (
    "\n\n## History\n" +
    "The learner's last items in this mode, oldest first, with what they practiced (in " +
    "brackets), what the learner wrote and how they did. What they wrote right, they " +
    "know; what they missed, they need:\n" +
    lines.join("\n")
  );
}

// Every field is required, so the model always writes each one.
// No length limits: one answer over a limit would fail the whole call, so the
// code checks the lengths instead.
// The situation comes first, so the model settles its idea before writing the item.
const exerciseSchema = z.object({
  situation: z.string(),
  text: z.string(),
  reference: z.string(),
});

// A word also gets a French sentence that shows its meaning, written before the
// reference so the reference translates the word in that meaning.
export const wordExerciseSchema = z.object({
  situation: z.string(),
  text: z.string(),
  context: z.string(),
  itemInContext: z.string(),
  reference: z.string(),
  frequency: z.enum(FREQUENCIES),
});

// A sentence also names its learning point, so the page can remember it.
export const sentenceExerciseSchema = exerciseSchema.extend({
  point: z.string(),
  pointInReference: z.string(),
});

export type ItemAnswer = z.infer<typeof exerciseSchema> & {
  context?: string;
  itemInContext?: string;
  frequency?: Frequency;
  point?: string;
  pointInReference?: string;
};

// Checks one answer in code, and cleans it up for the page.
export function checkedItem(output: ItemAnswer, mode: Mode) {
  // The situation only helps the model think; the page doesn't need it.
  const raw = output.text.trim();
  const text = withApostrophes(raw);
  if (text !== raw) console.warn("Added a missing apostrophe:", raw);
  const reference = output.reference.trim();
  if (!text || !reference) throw new InvalidAnswerError("Empty item or reference");
  if (hasDroppedLetters(text)) throw new InvalidAnswerError(`Letters missing: ${text}`);
  const context =
    output.context === undefined
      ? undefined
      : checkedContext(output.context, output.itemInContext ?? "");
  // A word is never a sentence, nor is its reference (the model sometimes
  // translates the context sentence instead).
  if (isWordMode(mode) && /[.!?]$/.test(text)) {
    throw new InvalidAnswerError(`A sentence instead of a word: ${text}`);
  }
  if (isWordMode(mode) && (/[.!?]$/.test(reference) || reference.split(/\s+/).length > 4)) {
    throw new InvalidAnswerError(`A sentence instead of a reference: ${reference}`);
  }
  if (text.length > MAX_TEXT_LENGTH || reference.length > MAX_TEXT_LENGTH) {
    throw new InvalidAnswerError(`Item too long (${text.length} characters)`);
  }
  return {
    text,
    reference,
    english: englishKey(reference),
    ...(context && { context }),
    ...(output.frequency && { frequency: output.frequency }),
    ...(output.point && pointName(output.point) && { point: pointName(output.point) }),
    ...(output.pointInReference !== undefined && { pointInReference: output.pointInReference }),
  };
}

// One item of a batch: its task in the prompt, and the code's check of the
// model's answer to it. A check throws an InvalidAnswerError whose message
// the model gets when asked again; on the last try (final), a check may keep
// a weaker answer rather than none.
export type Slot<Raw> = {
  task: string;
  check: (raw: Raw, final: boolean) => Exercise;
};

// The number of items one call gives: the free tier allows 250,000 tokens a
// minute but only 500 calls a day, so each call gives several exercises.
export const BATCH_SIZE = 3;

// What one call of a mode asks: built by each mode's file, sent by
// generateBatch (the evals send several in one request).
export type Batch<Raw> = {
  mode: Mode;
  // The fields of one item, as lines of the system prompt.
  fields: string[];
  schema: z.ZodType<Raw>;
  slots: Slot<Raw>[];
  // The sections after the tasks: history, words learned…
  sections: string;
  // Room for one item's thinking and JSON.
  tokensPerItem: number;
};

// A mode's batch, and what turns its checked items into the exercises sent
// to the page.
export type BatchPlan<Raw> = {
  batch: Batch<Raw>;
  finish: (results: (Exercise | undefined)[]) => Exercise[];
};

export const GENERATE_ROLE = [
  "You are an American English teacher for a French speaker. You write items in",
  "natural, correct French that the learner will translate into American English.",
];

// What the model knows before the tasks: the app's goal and the learner.
export function batchContext(mode: Mode) {
  return `${GOAL}\n\n${learner(mode)}`;
}

// Asks the model for one item per slot in a single call, and checks each one
// in code. Items that fail are asked again once, in one more call for the
// whole batch; those still failing are left out (undefined), and the call
// fails only if none is usable.
export async function generateBatch<Raw>(
  input: GenerateInput,
  batch: Batch<Raw>,
): Promise<(Exercise | undefined)[]> {
  const { mode, slots } = batch;
  const results: (Exercise | undefined)[] = slots.map(() => undefined);
  let tryAgain = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    let items: Raw[];
    try {
      const { output } = await generateText({
        model,
        ...thinking(1000 + batch.tokensPerItem * slots.length),
        maxRetries: 1,
        output: Output.object({ schema: z.object({ items: z.array(batch.schema) }) }),
        system: [
          ...GENERATE_ROLE,
          "",
          "## Fields, in this order",
          `items: ${slots.length} items, one for each task below, in the same order, each with:`,
          ...batch.fields,
        ].join("\n"),
        prompt:
          batchContext(mode) +
          "\n\n## Tasks\n" +
          slots.map((slot, index) => `Item ${index + 1}: ${slot.task}`).join("\n\n") +
          batch.sections +
          tryAgain,
      });
      items = withoutEntities(output.items);
    } catch (error) {
      if (!isInvalidAnswer(error)) throw error;
      console.warn("Unusable model answer:", (error as Error).message);
      continue;
    }
    const reasons: string[] = [];
    slots.forEach((slot, index) => {
      if (results[index]) return;
      try {
        if (!items[index]) throw new InvalidAnswerError("missing");
        results[index] = slot.check(items[index], attempt === 2);
      } catch (error) {
        if (!isInvalidAnswer(error)) throw error;
        reasons.push(`Item ${index + 1}: ${(error as Error).message}`);
      }
    });
    if (!reasons.length) break;
    console.warn("Unusable items:", reasons.join(" / "));
    tryAgain =
      "\n\n## Try again\nThese items of your last answer couldn't be used. Write every " +
      "item again, fixing these:\n" +
      reasons.join("\n");
  }
  if (!results.some(Boolean)) throw new InvalidAnswerError("No usable item");
  return results;
}

// The usable items of a batch. The reviews left out (their context failed
// twice) are named on the first item, so the page doesn't make them due again
// today.
export function keptItems(results: (Exercise | undefined)[], reviews: (ReviewItem | undefined)[]) {
  const kept = results.filter((item): item is Exercise => Boolean(item));
  const skipped = reviews.flatMap((review, index) =>
    review && !results[index] ? [review.text] : [],
  );
  return skipped.length ? [{ ...kept[0], reviewSkipped: skipped }, ...kept.slice(1)] : kept;
}
