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
  withoutEntities,
} from "@/lib/model";
import {
  englishKey,
  HISTORY_PER_MODE,
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
};

// What the app is for: with it, the model can choose well in cases no rule covers.
export const GOAL =
  "## Goal\n" +
  "The app helps a French speaker learn the most useful American English they don't know " +
  "yet. They translate your item into American English, and another teacher grades it. " +
  "Each item should teach them something new and useful in everyday American English, " +
  "or something they got wrong before.";

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
  "of COCA): words heard every week in conversations, videos, TV shows and the news, " +
  "or found in almost every news article (amid, despite, according to), never a rare " +
  "or specialized word (craftsmanship, journey for « périple », to reap)";

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
const REVIEW_CHANCE = 0.25;

export function reviewFor(input: GenerateInput, mode: "word" | "verb") {
  const items = input.review?.[mode] ?? [];
  if (!items.length) return undefined;
  const last = input.history?.filter((item) => item.mode === mode).at(-1);
  const due = items[0].today && !last?.review;
  return due || Math.random() < REVIEW_CHANCE ? items : undefined;
}

// The task of a review: one of the missed items, as is, with a new context.
export function reviewTask(
  items: ReviewItem[],
  mode: "word" | "verb",
  theme?: string,
) {
  const lines = items.map((item) => {
    const details = [
      item.misses && `missed ${item.misses} time${item.misses > 1 ? "s" : ""}`,
      item.context && `last context: « ${item.context} »`,
    ].filter(Boolean);
    return (
      `- « ${item.text} »${item.english ? ` → ${item.english}` : ""}` +
      (details.length ? ` (${details.join("; ")})` : "")
    );
  });
  return (
    `This is a review. Give again one of these ${mode}s that the learner missed or ` +
    "left unanswered, as is: the same French text, in the same meaning (the English " +
    "after the arrow, when there is one), with a new context sentence, different from " +
    "the last one. They come by priority: take the first one.\n" +
    lines.join("\n") +
    `\nSet its new context sentence on the theme "${theme}" if it fits.`
  );
}

// The number of new words or verbs asked in one call: the code keeps the first
// one the learner neither learned nor saw recently, so a repeat rarely costs
// another call.
export const CANDIDATES = 3;

// The same French text, whatever its case, spaces, quotes or apostrophes.
export function sameText(text: string) {
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

// The most similar words a learner sees in corrections and hasn't learned yet.
const MAX_SIMILAR_TO_TEACH = 30;

// Words the corrections showed as close to or often confused with the ones the
// learner practiced: good next items, since the learner just met them.
export function similarSection(input: GenerateInput, mode: "word" | "verb") {
  const { known, recent } = history(input, mode);
  const skip = new Set([
    ...known,
    ...recent.flatMap((item) => (item.english ? [item.english] : [])),
  ]);
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
    "\n\n## Seen in corrections\nThe corrections showed the learner these English " +
    `${mode}s, close to or often confused with ones they practiced, the last first. ` +
    "Some are British or rare: skip them. When one is common American English and " +
    `fits the ${mode === "word" ? "kind" : "type"} asked for and every other rule, ` +
    `prefer it as one of your items:\n${words.join(", ")}`
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
  const lastRetest = items.findLastIndex((item) => item.retest);
  const lines = items.map((item, index) => {
    const date = item.at ? `${item.at.slice(0, 10)} ` : "";
    const context = item.context ? ` (context: « ${item.context} »)` : "";
    // A sentence's expected English, only when the learner didn't answer it.
    const english = isWordMode(mode)
      ? item.english
        ? ` → ${item.english}`
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
    // unless a retest already practiced their mistake.
    const recent =
      !isWordMode(mode) && items.length - index <= 5 && index > lastRetest
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
    "The learner's last items in this mode, oldest first:\n" +
    lines.join("\n") +
    "\nEach line gives the date, the French item, what it practiced (in brackets), what " +
    "the learner wrote and how they did. A point avoided means the learner said it " +
    "another right way: they may not know it yet. " +
    (isWordMode(mode)
      ? "If several recent words have a frequency of sometimes or rare, choose more " +
        "common ones. "
      : "") +
    "Use it to choose the next item. What the learner wrote shows the English they " +
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
const exerciseSchema = z.object({
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
  frequency: z.enum(FREQUENCIES),
});

// A sentence also names its learning point, so the page can remember it.
const sentenceExerciseSchema = exerciseSchema.extend({ point: z.string() });

type ItemAnswer = z.infer<typeof exerciseSchema> & {
  context?: string;
  frequency?: Frequency;
  point?: string;
};

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
  if (hasDroppedLetters(text) || (context && hasDroppedLetters(context))) {
    throw new InvalidAnswerError(`Letters missing: ${context ?? text}`);
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
    ...(output.frequency && { frequency: output.frequency }),
    ...(output.point && pointName(output.point) && { point: pointName(output.point) }),
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
  const { mode } = combination;
  const { known, recent } = history(input, mode);
  const several = isWordMode(mode) && !prompt.review;
  const schema = isWordMode(mode) ? wordExerciseSchema : sentenceExerciseSchema;
  const mastered = new Set((input.points?.mastered ?? []).map(pointName));

  let attempt = 0;
  let tryAgain = "";
  // A usable first answer, kept if the one asked again is broken.
  let fallback: (ReturnType<typeof checkedItem> & { fits: boolean }) | undefined;
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
        ...(isWordMode(mode) ? FREQUENCY_FIELD : []),
      ].join("\n"),
      prompt:
        GOAL +
        "\n\n" +
        learner(mode) +
        "\n\n## Task\n" +
        prompt.task +
        // A review only gives a listed item again: the history would contradict it.
        (prompt.review ? "" : historySection(recent, mode)) +
        (several ? knownSection(known, mode as "word" | "verb") : "") +
        (prompt.sections ?? "") +
        tryAgain,
    });

    const answers = withoutEntities(
      several
        ? (output as { items: ItemAnswer[] }).items.slice(0, CANDIDATES)
        : [output as ItemAnswer],
    );
    const usable = usableAnswers(answers, (answer) =>
      checkedItem(answer, mode),
    );
    if (!usable.length) throw new InvalidAnswerError("No usable item");
    if (!isWordMode(mode)) {
      // A mastered point is never the target again: the model is asked once more.
      const point = usable[0].point;
      if (attempt === 1 && point && mastered.has(point)) {
        fallback = { ...usable[0], fits: true };
        tryAgain =
          `\n\n## Try again\nThe learner already mastered « ${point} ». Choose another ` +
          "learning point, not in Points mastered.";
        throw new InvalidAnswerError(`Mastered point: ${point}`);
      }
      return { ...usable[0], fits: true };
    }
    const chosen = chooseAnswer(usable, {
      known,
      recent,
      review: prompt.review,
    });
    if (chosen) return { ...chosen, fits: true };
    // A review the model ignored twice gives a new item, which still mustn't
    // be learned or recent.
    const fresh = prompt.review ? chooseAnswer(usable, { known, recent }) : undefined;
    if (attempt > 1) return { ...(fresh ?? usable[0]), fits: false };
    fallback = { ...(fresh ?? usable[0]), fits: false };
    tryAgain = tryAgainSection(usable, Boolean(prompt.review));
    throw new InvalidAnswerError(
      `No fitting item: ${usable.map((answer) => answer.english).join(", ")}`,
    );
  }).catch((error) => {
    if (fallback && isInvalidAnswer(error)) return fallback;
    throw error;
  });

  return {
    text: item.text,
    reference: item.reference,
    ...(item.context && { context: item.context }),
    ...("frequency" in item && item.frequency && { frequency: item.frequency }),
    ...("point" in item && item.point && { point: item.point }),
    ...combination,
    // A review whose answer isn't a listed item is a new word.
    ...(prompt.review && item.fits && { review: true }),
  };
}
