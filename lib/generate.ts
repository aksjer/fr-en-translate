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
  LEVEL_GRAMMAR,
  LEVEL_VOCABULARY,
  LEVELS,
  MAX_TEXT_LENGTH,
  MODES,
  SENTENCE_WORDS,
  TENSE_GUIDES,
  TENSES,
  VERB_TYPES,
  type Level,
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

// Lengths are told to the model in words, which it counts better than characters
// (see SENTENCE_WORDS for sentences). The code also rejects any item over
// MAX_TEXT_LENGTH characters.
const MAX_PHRASAL_VERB_WORDS = 10;

function pickOne(items: string[]) {
  return items[Math.floor(Math.random() * items.length)];
}

// A single word or verb, as opposed to a sentence or a paragraph.
function isWordMode(mode: Mode) {
  return mode === "mot" || mode === "verbe" || mode === "phrasal verb";
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

function instructions({ mode, level, tense, verbType, theme }: Combination) {
  // "A C1 learner should know" gave basic words such as lose at every level.
  const levelFit = `that learners usually learn at CEFR ${level}, not at an easier level`;
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
    case "mot":
      return (
        "Give a single French noun, adjective or adverb whose American English translation " +
        `is a word ${levelFit}, related to the theme "${theme}". ` +
        "Include the article for a noun (le, la, l', un, une). " +
        "Pick a word whose American English translation is clear and looks different from " +
        "the French (not « un smartphone » → a smartphone, or « généreux » → generous). " +
        "Give only the word, never a sentence."
      );
    case "verbe": {
      const kind = verbType === "irrégulier" ? "irregular" : "regular";
      return (
        "Give a single French verb in the infinitive (e.g. « conduire ») whose American English " +
        `translation is ${kind === "irregular" ? "an" : "a"} ${kind} verb ${levelFit} ` +
        "(go/went/gone is irregular, work/worked/worked is regular). " +
        `Being ${kind} matters more than the level. The English verb must look different ` +
        "from the French (not « décider » → decide) and not translate as a phrasal verb. " +
        "Give only the infinitive, never a sentence or a conjugated verb."
      );
    }
    case "phrasal verb":
      return (
        "Give a French verb in the infinitive, or a short expression starting with one, " +
        `related to the theme "${theme}", that translates naturally into American English ` +
        `as a phrasal verb ${levelFit}. Add a short context in parentheses ` +
        "if the meaning is ambiguous (e.g. « abandonner (une habitude) » for give up), " +
        `with ${MAX_PHRASAL_VERB_WORDS} words at most in all. ` +
        "Never a sentence or a conjugated verb. The reference must be a real phrasal verb, " +
        "a verb followed by a particle such as up, out, off or down (find out, give up), " +
        "not a simple verb such as quit."
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
      return [
        // Planning its three forms or its context made 6/6 verbs come out as
        // sentences, twice: the plan is the English verb alone.
        `${start} only the English verb you chose, in the base form.`,
      ];
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
  // Models got around the list by changing a word's context (éteindre la
  // télévision, then la lumière) or by telling the same story again.
  const avoid = input.avoid?.length
    ? "\n\n## Avoid\n" +
      `These items were already given: ${input.avoid.join(" ; ")}\n` +
      (isWordMode(combination.mode)
        ? "Give a different word: none of these, even with another context or article, " +
          "and none with the same English translation."
        : "Write something different: not the same structure, the same kind of event " +
          "or the same characters.")
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
        ...situationField(combination.mode),
        // "As people speak it today" gave slang and negations without « ne »;
        // "correct French" alone gave literary French. "No quotes" may have made
        // models drop apostrophes (« l avion »).
        "- text: the item, in correct, modern French with a neutral register: no slang,",
        "  swear words or literary style, always the « ne » of a negation, and no passé",
        "  simple or imparfait du subjonctif. Use French punctuation (a space before",
        "  ! ? : ;) and apostrophes (j'ai, qu'il), with no quotation marks around the item",
        "  and no translation or explanation. Check the spelling and accents of every word.",
        "- reference: a natural, correct American English translation of text, with the",
        "  same meaning and the equivalent tense, in American words and spelling",
        "  (apartment, color, not flat, colour).",
      ].join("\n"),
      prompt:
        learner(combination.mode, combination.level) +
        "\n\n## Task\n" +
        instructions(combination) +
        avoid +
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
    return { text, reference };
  });

  return { ...item, ...combination };
}
