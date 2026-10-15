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
  LEVEL_GRAMMAR,
  LEVEL_VOCABULARY,
  LEVELS,
  englishKey,
  MAX_KNOWN,
  MAX_TEXT_LENGTH,
  MODES,
  SENTENCE_WORDS,
  TENSE_GUIDES,
  TENSES,
  VERB_TYPES,
  type Level,
  isWordMode,
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
  // The item itself, so a verb due for review comes back as is.
  text: clipped(80).optional(),
  correction: clipped(MAX_TEXT_LENGTH),
  remark: clipped(300).optional(),
  tag: clipped(40).optional(),
});

type Review = z.infer<typeof reviewSchema>;

export const generateInputSchema = settingsSchema.extend({
  // Recent exercises, so the model doesn't keep giving the same words. Items
  // have their mode, except in an older page.
  avoid: z
    .array(
      z.union([
        clipped(80),
        z.object({
          text: clipped(80),
          mode: z.enum(MODES).optional().catch(undefined),
        }),
      ]),
    )
    .max(40)
    .optional(),
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
  // The exercise tests this mistake again. A page from before this field
  // changed shape gets a normal exercise.
  review: reviewSchema.optional().catch(undefined),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export type Exercise = Combination & {
  text: string;
  reference: string;
  // A verb's base form, past simple and past participle.
  forms?: [string, string, string];
};

// Picked by the code, not the model: each request is independent, so the model
// can't vary these across exercises and would always pick the same ones.
const PERSONS = ["je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles"];
// The impératif only exists with tu, nous and vous.
const IMPERATIVE_PERSONS = ["tu", "nous", "vous"];
const SENTENCE_TYPES = ["statement", "question", "negation", "exclamation"];
// An order can't really be a question.
const IMPERATIVE_TYPES = ["statement", "negation"];

// Lengths are told to the model in words, which it counts better than characters
// (see SENTENCE_WORDS for sentences). The code also rejects any item over
// MAX_TEXT_LENGTH characters.
const MAX_PHRASAL_VERB_WORDS = 10;

// Picked by the code too, so single words and phrasal verbs vary: left to
// choose, the model gave mostly nouns, and phrasal verbs mostly with up or out.
const WORD_KINDS = ["noun", "noun", "adjective", "adverb"];
const PARTICLES = ["up", "out", "off", "down", "on", "over", "back", "away", "through", "into"];

function pickOne(items: string[]) {
  return items[Math.floor(Math.random() * items.length)];
}

// The level is the learner's English level: any French is easy for them, so what
// matters is the English the translation needs. Word modes only get the
// vocabulary: with the grammar too, models wrote sentences instead of a word.
function learner(mode: Mode, level: Level) {
  const intro = `## Learner\nA native French speaker learning American English. Their English level is CEFR ${level}: `;
  if (isWordMode(mode)) return `${intro}${LEVEL_VOCABULARY[level]}.`;
  return (
    `${intro}${LEVEL_VOCABULARY[level]}; ${LEVEL_GRAMMAR[level]}. ` +
    "The French is never the difficulty: choose French whose natural American English " +
    `translation needs ${level} English.`
  );
}

// The learner wants the most useful English: words from the Oxford 5000, which
// gives a CEFR level to each word up to C1. "A C1 learner should know" gave
// basic words such as lose at every level.
function commonAt(level: Level, kind: string) {
  return level === "C2"
    ? `an advanced ${kind}, beyond the Oxford 5000, that learners usually learn at CEFR C2`
    : `a common ${kind} from the Oxford 5000 that learners usually learn at CEFR ${level}, ` +
        "not at an easier level";
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
    "\n\n## Priority\nIf two instructions conflict, the tense and the theme come first, " +
    "then the level, then the variety.";
  switch (mode) {
    case "mot": {
      const kind = pickOne(WORD_KINDS);
      return (
        `Give a single French ${kind} whose American English translation ` +
        `is ${commonAt(level, kind)}, related to the theme "${theme}". ` +
        (kind === "noun" ? "Include its article (le, la, l', un, une). " : "") +
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
        `as one of the most common phrasal verbs that learners usually learn at CEFR ${level}, ` +
        `with the particle "${pickOne(PARTICLES)}". ` +
        "The French must be what a French speaker would really say for this meaning. " +
        "If the French alone could also be translated by another common verb, add a short " +
        "context in parentheses that rules it out (e.g. « abandonner (une habitude) » for " +
        "give up), " +
        `with ${MAX_PHRASAL_VERB_WORDS} words at most in all. ` +
        "Never a sentence or a conjugated verb. The reference must be a real phrasal verb " +
        "(find out, give up), not a simple verb such as quit."
      );
    case "phrase": {
      const imperative = tense === "impératif";
      const person = pickOne(imperative ? IMPERATIVE_PERSONS : PERSONS);
      const type = pickOne(imperative ? IMPERATIVE_TYPES : SENTENCE_TYPES);
      return (
        `Write one original French sentence on the theme "${theme}", ` +
        `using the French tense "${tense}". The main verb uses the person "${person}", ` +
        `the sentence is a ${type}, and it has ${SENTENCE_WORDS[level]} words.\n` +
        `About this tense: ${tense && TENSE_GUIDES[tense]}.` +
        variety +
        priority
      );
    }
    case "paragraphe":
      return (
        "Write a short French paragraph of exactly three sentences that tell one coherent " +
        `little story or moment, on the theme "${theme}", mainly told with the person ` +
        `"${pickOne(PERSONS)}" (other people or things can also be the subject of a sentence). ` +
        `Each sentence has ${SENTENCE_WORDS[level]} words. ` +
        "Each sentence follows logically from the one before. Use a connector only where " +
        "a native speaker would (mais, alors, parce que, quand…), not at the start of every sentence." +
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

function reviewSection(review: Review, mode: Mode) {
  const details = [
    review.text && `- item: ${review.text}`,
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

// A verb gets its own fields: the English verb first, then its forms, then
// the French. With one free "text" field, models kept writing a sentence.
export const verbSchema = z.object({
  english: z.string(),
  past: z.string(),
  participle: z.string(),
  text: z.string(),
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

// The items of this mode the learner got right, and the ones given recently.
function history(input: GenerateInput, mode: Mode) {
  const known = mode === "mot" || mode === "verbe" || mode === "phrasal verb"
    ? (input.known?.[mode] ?? [])
    : [];
  // Only the items of this mode, so a word isn't compared with sentences.
  // The prompt only lists the last ones: a long list costs tokens and is
  // followed no better.
  const given = (input.avoid ?? [])
    .flatMap((item) =>
      typeof item === "string"
        ? [item]
        : !item.mode || item.mode === mode
          ? [item.text]
          : [],
    )
    .slice(-20);
  return { known, given };
}

function knownSection(known: string[]) {
  return known.length
    ? "\n\n## Already learned\n" +
        `The learner already knows these English words: ${known.join(", ")}. ` +
        "Choose none of them."
    : "";
}

// Models got around the list by changing a word's context (éteindre la
// télévision, then la lumière) or by telling the same story again.
function avoidSection(given: string[], mode: Mode) {
  return given.length
    ? "\n\n## Avoid\n" +
        `These items were already given: ${given.join(" ; ")}\n` +
        (isWordMode(mode)
          ? "Give a different word: none of these, even with another context or article, " +
            "and none with the same English translation."
          : "Write something different: not the same structure, the same kind of event " +
            "or the same characters.")
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
  const { known, given } = history(input, "verbe");
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
        "You are an English teacher for a French speaker. You choose one English verb",
        "that the learner will translate from French.",
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
      ].join("\n"),
      prompt:
        learner("verbe", level) +
        "\n\n## Task\n" +
        `Choose ${commonAt(level, `${english} verb`)}. ` +
        "Never a verb that looks like its French translation (decide → décider), or one " +
        "whose look-alike French verb means something else (to attend is « assister à », " +
        "not « attendre »)." +
        knownSection(known) +
        avoidSection(given, "verbe") +
        (input.review ? reviewSection(input.review, "verbe") : ""),
    });
    const base = output.english.trim().toLowerCase().replace(/^to\s+/, "");
    const past = output.past.trim().toLowerCase();
    const participle = output.participle.trim().toLowerCase();
    const text = output.text.trim();
    if (!/^[a-z]+$/.test(base) || !past || !participle || !text) {
      throw new InvalidAnswerError(`Not a verb: ${base}`);
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
    return { base, past, participle, text: withApostrophes(text) };
  });

  return {
    text: verb.text,
    reference: `to ${verb.base}`,
    forms: [verb.base, verb.past, verb.participle],
    ...combination,
  };
}

// Builds the prompt and asks the model for one exercise.
export async function generateExercise(input: GenerateInput): Promise<Exercise> {
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
  if (combination.mode === "verbe") {
    return generateVerb(input, combination);
  }
  const { known, given } = history(input, combination.mode);

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
        "You are a French teacher. You give an item in natural, correct French",
        "that a French-speaking learner will translate into American English.",
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
        learner(combination.mode, combination.level) +
        "\n\n## Task\n" +
        instructions(combination) +
        knownSection(known) +
        avoidSection(given, combination.mode) +
        (review ? reviewSection(review, combination.mode) : ""),
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
