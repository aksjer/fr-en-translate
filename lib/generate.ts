import { generateText, Output } from "ai";
import { z } from "zod";
import {
  InvalidAnswerError,
  modelFor,
  providerOptionsFor,
  retryIfInvalid,
  temperatureFor,
} from "@/lib/model";
import { ERROR_TAG_DEFINITIONS, ERROR_TAGS, type ErrorTag } from "@/lib/mistakes";
import {
  englishKey,
  MAX_HISTORY,
  MAX_KNOWN,
  MAX_TEXT_LENGTH,
  MODES,
  TENSE_GUIDES,
  type Level,
  isWordMode,
  type Mode,
} from "@/lib/options";
import {
  pickCombination,
  settingsSchema,
  type Combination,
} from "@/lib/settings";

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
      mot: z.array(clipped(40)).max(MAX_KNOWN),
      verbe: z.array(clipped(40)).max(MAX_KNOWN),
      "phrasal verb": z.array(clipped(40)).max(MAX_KNOWN),
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
const GOAL =
  "## Goal\n" +
  "The app helps a French speaker learn the most useful American English they don't know " +
  "yet. They translate your item into American English, and another teacher grades it. " +
  "Each item should teach them something new and useful at their level.";

// The level is the learner's English level: any French is easy for them, so what
// matters is the English the translation needs.
function learner(mode: Mode, level: Level) {
  const intro =
    `## Learner\nA native French speaker learning American English, at CEFR ${level} in English.`;
  if (isWordMode(mode)) return intro;
  return (
    `${intro} The French is never the difficulty: choose French whose natural American ` +
    `English translation needs the vocabulary and grammar learners usually study at ${level}.`
  );
}

// The learner wants the most useful English: words from the Oxford 5000, which
// gives a CEFR level to each word up to C1. "A C1 learner should know" gave
// basic words such as lose at every level.
function commonAt(level: Level, kind: string) {
  return level === "C2"
    ? `an advanced ${kind}, beyond the Oxford 5000, that learners usually learn at CEFR C2`
    : `${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind} common in American English (COCA) ` +
        `from the Oxford 5000 that learners usually learn at CEFR ${level}, not at an ` +
        "easier level";
}

// Sentences get the same frequency lists as words, so they use useful English.
function sentenceVocabulary(level: Level) {
  return (
    "\nBuild it so its American English translation uses common words (Oxford 5000, COCA) " +
    `at or below CEFR ${level}, plus one or two words or one structure typical of ` +
    `${level}, so it teaches something new.`
  );
}

function instructions({ mode, level, tense, theme }: Combination) {
  // The model invents the situation itself; this keeps it from always
  // falling back on the most typical sentence for the theme.
  const variety =
    "\n\n## Variety\nInvent a specific, concrete situation on this theme that could " +
    "happen in real life: decide who is involved, where and when. Avoid the most " +
    "obvious example for the theme (going to the market, today's weather…), " +
    "but stay realistic: no science fiction or fantasy.";
  const priority =
    "\n\n## Priority\nIf two instructions conflict, " +
    (tense ? "the tense and the theme come first" : "the theme comes first") +
    ", then the level, then the variety.";
  switch (mode) {
    case "mot": {
      return (
        "Give a single French noun, adjective or adverb whose American English " +
        `translation is ${commonAt(level, "word")}, related to the theme "${theme}". ` +
        "Choose the kind of word from the history: not always a noun. " +
        "Give a noun with its article (le, la, l', un, une). " +
        "Pick a word whose American English translation looks different from the French " +
        "(not « généreux » → generous). The French must be the word a French speaker would " +
        "really use for this English, never a look-alike with another meaning. If the French " +
        "word also has another common meaning, add a short context in parentheses that rules " +
        "it out (e.g. « la feuille (d'un arbre) » for leaf, since feuille is also a sheet of " +
        "paper). Give only the word, never a sentence."
      );
    }
    case "verbe":
      throw new Error("Verbs have their own prompt: see generateVerb");
    case "phrasal verb":
      return (
        "Give a French verb in the infinitive, or a short expression starting with one, " +
        `related to the theme "${theme}", that translates naturally into American English ` +
        `as one of the most common phrasal verbs that learners usually learn at CEFR ${level}. ` +
        "Vary the particle (up, out, off, down, on, over, back, away, through…) from the " +
        "history: not always up or out. " +
        "The French must be what a French speaker would really say for this meaning. " +
        "If the French alone could also be translated by another common verb, add a short " +
        "context in parentheses that rules it out (e.g. « abandonner (une habitude) » for " +
        "give up), " +
        "with 10 words at most in all. " +
        "Never a sentence or a conjugated verb. The reference must be a real phrasal verb " +
        "(find out, give up), not a simple verb such as quit."
      );
    case "phrase": {
      const imperative = tense === "impératif";
      return (
        `Write one original French sentence on the theme "${theme}", ` +
        `using the French tense "${tense}", of a length typical of CEFR ${level}. ` +
        "Choose the person of the main verb " +
        (imperative
          ? "(tu, nous or vous) and whether it is a statement or a negation, "
          : "(je, tu, il, elle, on, nous, vous, ils or elles) and the sentence type " +
            "(statement, question, negation or exclamation), ") +
        "different from the last items of the history." +
        sentenceVocabulary(level) +
        "\n" +
        `This tense in American English: ${tense && TENSE_GUIDES[tense]}.` +
        variety +
        priority
      );
    }
    case "paragraphe":
      return (
        "Write a short French paragraph of exactly three sentences that tell one coherent " +
        `little story or moment, on the theme "${theme}", mainly told with one person ` +
        "(je, tu, il, elle, on, nous, vous, ils or elles) that you choose, different from the " +
        "last items of the history (other people or things can also be the subject of a sentence). " +
        `Each sentence has a length typical of CEFR ${level}. ` +
        "Each sentence follows logically from the one before. Use a connector only where " +
        "a native speaker would (mais, alors, parce que, quand…), not at the start of every sentence." +
        sentenceVocabulary(level) +
        variety +
        priority
      );
  }
}

// Word modes plan the English first, since the level is about English: starting
// from the French gave loose translations (un périple → an ordeal) and a regular
// verb as an irregular one (étirer → stretch). Only sentences plan a conjugated
// French verb: for a single verb, it made models conjugate it and write a sentence.
function situationField(mode: Mode) {
  const start = "- situation: first, one short line in English:";
  switch (mode) {
    case "mot":
      return [`${start} the English word you chose, then the context it is used in.`];
    case "verbe":
      throw new Error("Verbs have their own prompt: see generateVerb");
    case "phrasal verb":
      return [
        `${start} the English phrasal verb you chose, then the context`,
        "  it is used in.",
      ];
    case "phrase":
      return [
        `${start} the situation you chose (who, where, when),`,
        "  then the main French verb already conjugated in the required tense and person",
        '  (e.g. "que nous partions").',
      ];
    case "paragraphe":
      return [
        `${start} the situation you chose (who, where, when),`,
        "  then the main French verb of each of the three sentences, already conjugated.",
      ];
  }
}

// Gemini sometimes drops the apostrophe of l' (« dans l avion »): the code adds
// it back. Only l', since a lone d or j can be a letter (la vitamine D, le jour J).
function withApostrophes(text: string) {
  const apostrophe = text.includes("’") ? "’" : "'";
  return text.replace(/(^|[\s«(])(l) (?=[aeiouyhàâéèêëîïôûœ])/giu, `$1$2${apostrophe}`);
}

// The learner's recent items in this mode and how they did, so the model can
// vary its choices and test a missed point again.
function historySection(items: HistoryItem[], mode: Mode) {
  if (!items.length) return "";
  const lines = items.map((item) => {
    const english = isWordMode(mode) && item.english ? ` → ${item.english}` : "";
    const result =
      item.ok === undefined
        ? "not answered"
        : item.ok
          ? "right"
          : `wrong${item.remark ? `: ${item.remark}` : ""}`;
    return `- « ${item.text} »${english}: ${result}`;
  });
  return (
    "\n\n## History\n" +
    "The learner's last items in this mode, oldest first:\n" +
    lines.join("\n") +
    "\nUse it to choose the next item. " +
    (isWordMode(mode)
      ? "Never give an item answered right again, even with another context. An item " +
        "answered wrong may come back as is, but only after a few other items."
      : "When a recent item was wrong, test the same difficulty again in a new item, " +
        "without pointing it out. Vary the person, the sentence type, the situations and " +
        "the characters: not the same structure, kind of event or characters.")
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

// A verb gets its own fields: the English verb first, then its forms, then
// the French. With one free "text" field, models kept writing a sentence.
export const verbSchema = z.object({
  english: z.string(),
  past: z.string(),
  participle: z.string(),
  text: z.string(),
  context: z.string(),
});

// A regular verb's past and participle are the same -ed form built on it
// (worked, tried, stopped); fled or bled are shorter than their verb.
function isRegular(verb: string, past: string, participle: string) {
  return (
    past === participle &&
    past.endsWith("ed") &&
    past.length > verb.length &&
    past.startsWith(verb.slice(0, -1))
  );
}

// The items of this mode the learner got right, and the recent ones.
function history(input: GenerateInput, mode: Mode) {
  const known = mode === "mot" || mode === "verbe" || mode === "phrasal verb"
    ? (input.known?.[mode] ?? [])
    : [];
  // Only the items of this mode, so a word isn't compared with sentences.
  // The prompt only lists the last ones: a long list costs tokens and is
  // followed no better.
  const recent = (input.history ?? [])
    .filter((item) => !item.mode || item.mode === mode)
    .slice(-30);
  return { known, recent };
}

// The kinds of mistakes the learner made most in their recent answers, in all
// modes, for sentences only: a single word can't practice a tense or a
// preposition. Recent answers only, so a point they have fixed drops out by itself.
// Spelling, punctuation and "anything else" can't be built into a sentence.
const UNPRACTICED_TAGS: ErrorTag[] = ["orthographe", "ponctuation", "autre"];

function weakPointsSection(input: GenerateInput) {
  const counts = new Map<ErrorTag, number>();
  for (const item of input.history ?? []) {
    const tag = ERROR_TAGS.find((known) => known === item.tag);
    if (item.ok === false && tag && !UNPRACTICED_TAGS.includes(tag)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const top = [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return top.length
    ? "\n\n## Weak points\n" +
        "The kinds of mistakes the learner made most in their recent answers:\n" +
        top.map(([tag, count]) => `- ${ERROR_TAG_DEFINITIONS[tag]}: ${count} times`).join("\n") +
        "\nBuild the item so its translation practices one of these points, without " +
        "pointing it out."
    : "";
}

function knownSection(known: string[]) {
  return known.length
    ? "\n\n## Already learned\n" +
        `The learner already knows these English words: ${known.join(", ")}. ` +
        "Choose none of them."
    : "";
}

// Asks the model for one verb and checks it in code. A verb already known is
// asked again once; the second answer is kept, so the page never gets an error.
async function generateVerb(
  input: GenerateInput,
  combination: Combination,
): Promise<Exercise> {
  const { level } = combination;
  const verbType = combination.verbType ?? "régulier";
  const { known, recent } = history(input, "verbe");
  const english = verbType === "irrégulier" ? "irregular" : "regular";
  let attempt = 0;
  const verb = await retryIfInvalid(async () => {
    attempt++;
    const { output } = await generateText({
      model: modelFor(input.model),
      providerOptions: providerOptionsFor(input.model),
      temperature: temperatureFor(input.model, "generate"),
      maxRetries: 1,
      maxOutputTokens: 1000,
      output: Output.object({ schema: verbSchema }),
      system: [
        "You are an American English teacher for a French speaker. You choose one English",
        "verb that the learner will translate from French.",
        "",
        "## Fields, in this order",
        '- english: the verb, in its base form, one word, without "to".',
        "- past: its simple past in American English.",
        "- participle: its past participle in American English (gotten, not got).",
        "- text: the most common French infinitive for this verb (e.g. « conduire » for",
        "  drive). If this infinitive often means something else too, add a short context",
        "  in parentheses that points to this meaning (e.g. « louer (un appartement) » for",
        "  rent, since louer can also mean to praise). Only the infinitive, never a sentence",
        "  or a conjugated verb, with no quotation marks. Check its spelling and accents.",
        "- context: one short, natural French sentence at the learner's level that uses",
        "  this French verb, conjugated, in the meaning of the English verb, so the learner",
        "  knows which meaning to translate (e.g. « Nous louons un appartement près de la",
        "  plage. » for rent). Check its spelling and accents.",
      ].join("\n"),
      prompt:
        GOAL +
        "\n\n" +
        learner("verbe", level) +
        "\n\n## Task\n" +
        `Choose ${commonAt(level, `${english} verb`)}. ` +
        "Never a verb that looks like its French translation (decide → décider), or one " +
        "whose look-alike French verb means something else (to attend is « assister à », " +
        "not « attendre »). " +
        "Then check it the other way: a French speaker who sees your French infinitive and " +
        "its context sentence must naturally answer with this English verb. If they would " +
        "rather answer another English verb (« confondre » is confuse or mix up, not " +
        "mistake), choose another verb." +
        knownSection(known) +
        historySection(recent, "verbe"),
    });
    const base = output.english.trim().toLowerCase().replace(/^to\s+/, "");
    const past = output.past.trim().toLowerCase();
    const participle = output.participle.trim().toLowerCase();
    const text = output.text.trim();
    const context = output.context.trim();
    if (!/^[a-z]+$/.test(base) || !past || !participle || !text || !context) {
      throw new InvalidAnswerError(`Not a verb: ${base}`);
    }
    if (context.length > MAX_TEXT_LENGTH) {
      throw new InvalidAnswerError(`Context too long: ${context}`);
    }
    if (/[.!?]$/.test(text) || text.replace(/\([^)]*\)/g, "").split(/\s+/).length > 6) {
      throw new InvalidAnswerError(`A sentence instead of a verb: ${text}`);
    }
    if (isRegular(base, past, participle) !== (verbType === "régulier")) {
      throw new InvalidAnswerError(`Not ${english}: ${base}, ${past}, ${participle}`);
    }
    if (attempt === 1 && known.includes(base)) {
      throw new InvalidAnswerError(`Already known: ${base}`);
    }
    return {
      base,
      past,
      participle,
      text: withApostrophes(text),
      context: withApostrophes(context),
    };
  });

  return {
    text: verb.text,
    reference: `to ${verb.base}`,
    forms: [verb.base, verb.past, verb.participle],
    context: verb.context,
    ...combination,
  };
}

// Builds the prompt and asks the model for one exercise.
export async function generateExercise(input: GenerateInput): Promise<Exercise> {
  const combination = pickCombination(input);
  if (combination.mode === "verbe") {
    return generateVerb(input, combination);
  }
  const { known, recent } = history(input, combination.mode);

  let attempt = 0;
  const item = await retryIfInvalid(async () => {
    attempt++;
    const { output } = await generateText({
      model: modelFor(input.model),
      providerOptions: providerOptionsFor(input.model),
      temperature: temperatureFor(input.model, "generate"),
      maxRetries: 1,
      // Room for the thinking and a long paragraph, so the JSON isn't cut short.
      maxOutputTokens: 1500,
      output: Output.object({ schema: exerciseSchema }),
      system: [
        "You are an American English teacher for a French speaker. You write an item in",
        "natural, correct French that the learner will translate into American English.",
        "",
        "## Fields, in this order",
        ...situationField(combination.mode),
        // "As people speak it today" gave slang and negations without « ne »;
        // "correct French" alone gave literary French. "No quotes" may have made
        // models drop apostrophes (« l avion »).
        ...(isWordMode(combination.mode)
          ? [
              "- text: the French item only, with its context in parentheses if any, and no",
              "  quotation marks, translation or explanation. Check its spelling and accents.",
            ]
          : [
              "- text: the item, in correct, modern French with a neutral register: no slang,",
              "  swear words or literary style, always the « ne » of a negation, and no passé",
              "  simple or imparfait du subjonctif. Use French punctuation (a space before",
              "  ! ? : ;) and apostrophes (j'ai, qu'il), with no quotation marks around the item",
              "  and no translation or explanation. Check the spelling and accents of every word.",
            ]),
        "- reference: the most natural American English translation of text as the learner",
        "  sees it (with its context, if any), with the same meaning and the equivalent tense,",
        "  in American words and spelling (apartment, color, not flat, colour).",
      ].join("\n"),
      prompt:
        GOAL +
        "\n\n" +
        learner(combination.mode, combination.level) +
        "\n\n## Task\n" +
        instructions(combination) +
        knownSection(known) +
        historySection(recent, combination.mode) +
        (isWordMode(combination.mode) ? "" : weakPointsSection(input)),
    });

    // The situation only helps the model think; the page doesn't need it.
    const raw = output.text.trim();
    const text = withApostrophes(raw);
    if (text !== raw) console.warn("Added a missing apostrophe:", raw);
    const reference = output.reference.trim();
    if (!text || !reference) {
      throw new InvalidAnswerError("Empty item or reference");
    }
    // A word, verb or phrasal verb is never a sentence: ask again if it is one.
    if (isWordMode(combination.mode) && /[.!?]$/.test(text)) {
      throw new InvalidAnswerError(`A sentence instead of a word: ${text}`);
    }
    if (text.length > MAX_TEXT_LENGTH || reference.length > MAX_TEXT_LENGTH) {
      throw new InvalidAnswerError(`Item too long (${text.length} characters)`);
    }
    // The second answer is kept even if known, so the page never gets an error.
    if (attempt === 1 && known.includes(englishKey(reference))) {
      throw new InvalidAnswerError(`Already known: ${reference}`);
    }
    return { text, reference };
  });

  return { ...item, ...combination };
}
