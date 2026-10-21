// One English verb, regular or irregular as in the settings, with its forms
// and a French sentence that shows its meaning. It has its own fields: with one
// free "text" field, models kept writing a sentence instead of a verb.
import { z } from "zod";
import {
  CHOICES,
  checkedContext,
  commonAt,
  firstFresh,
  freshness,
  generateBatch,
  history,
  historySection,
  keptItems,
  knownSection,
  reviewChecked,
  reviewSlots,
  reviewTask,
  similarSection,
  withApostrophes,
  type Exercise,
  type GenerateInput,
  type ReviewItem,
  type Slot,
} from "@/lib/generate/shared";
import { InvalidAnswerError } from "@/lib/model";
import { FREQUENCIES, type VerbType } from "@/lib/options";
import type { Combination } from "@/lib/settings";

// A verb gets its own fields: the English verb first, then its forms, then
// the French. With one free "text" field, models kept writing a sentence.
const verbSchema = z.object({
  english: z.string(),
  past: z.string(),
  participle: z.string(),
  text: z.string(),
  context: z.string(),
  itemInContext: z.string(),
  frequency: z.enum(FREQUENCIES),
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

// Checks one verb in code. In a review, the verb keeps its own type, whatever
// the settings.
function checkedVerb(
  output: z.infer<typeof verbSchema>,
  verbType?: VerbType,
  others: (string | undefined)[] = [],
) {
  const base = output.english
    .trim()
    .toLowerCase()
    .replace(/^to\s+/, "");
  const past = output.past.trim().toLowerCase();
  const participle = output.participle.trim().toLowerCase();
  const text = output.text.trim();
  if (!/^[a-z]+$/.test(base) || !past || !participle || !text) {
    throw new InvalidAnswerError(`Not a verb: ${base}`);
  }
  const context = checkedContext(output.context, output.itemInContext, others);
  if (
    /[.!?]$/.test(text) ||
    text.replace(/\([^)]*\)/g, "").split(/\s+/).length > 6
  ) {
    throw new InvalidAnswerError(`A sentence instead of a verb: ${text}`);
  }
  const regular = isRegular(base, past, participle);
  if (verbType && regular !== (verbType === "regular")) {
    throw new InvalidAnswerError(
      `Not ${verbType}: ${base}, ${past}, ${participle}`,
    );
  }
  return {
    english: base,
    past,
    participle,
    verbType: (regular ? "regular" : "irregular") as VerbType,
    text: withApostrophes(text),
    context,
    frequency: output.frequency,
  };
}

// One item: a few choices for a new verb, the code keeping the first new one;
// a single one for a review.
const verbItemSchema = z.object({ choices: z.array(verbSchema) });
type VerbItem = z.infer<typeof verbItemSchema>;

const FIELDS = [
  `- choices: ${CHOICES} different verbs for this task, best first (just one for a`,
  "  review), each with:",
  '  - english: the verb in its base form, one word, without "to".',
  "  - past, participle: its simple past and past participle in American English",
  "    (gotten, not got).",
  "  - text: the most common French infinitive for this verb, only the infinitive",
  "    (« conduire » for drive). Check its spelling and accents.",
  "  - context: one short, everyday French sentence that uses text, conjugated, in",
  "    this meaning only (for louer → rent, a sentence about a home or a car, never",
  "    about praise). Check its spelling and accents.",
  "  - itemInContext: the words of context that translate the verb, copied exactly",
  "    as written there (nous louons).",
  "  - frequency: how often an American hears this English verb: everyday (every day",
  "    or every week), sometimes, or rare.",
];

function newTask({ theme, verbType = "regular" }: Combination) {
  return (
    `${CHOICES} different verbs. Each one is ${commonAt(`${verbType} verb`)}, useful ` +
    `when talking about "${theme}" (only a direction: a common verb loosely related to ` +
    "it beats a rare one). Its French translation looks different from it (not decide " +
    "→ décider), and has no look-alike with another meaning (attend is « assister à », " +
    "not « attendre »). A French speaker who sees text and context would answer with " +
    "this verb, not another one (« confondre » is confuse or mix up, not mistake)."
  );
}

function exercise(verb: ReturnType<typeof checkedVerb>, combination: Combination): Exercise {
  return {
    ...combination,
    text: verb.text,
    reference: `to ${verb.english}`,
    forms: [verb.english, verb.past, verb.participle],
    context: verb.context,
    verbType: verb.verbType,
    frequency: verb.frequency,
  };
}

// A review gives the missed verb again, with its own type; one stored whole
// keeps its French, English and forms as stored, and only its context is new.
function reviewed(review: ReviewItem, combination: Combination, raw: VerbItem): Exercise {
  const [choice] = raw.choices;
  if (!choice) throw new InvalidAnswerError("No verb");
  const verb = reviewChecked(review, checkedVerb(choice, undefined, [review.context]));
  if (!review.english || !review.forms) return { ...exercise(verb, combination), review: true };
  const [base, past, participle] = review.forms;
  return {
    ...combination,
    text: review.text,
    reference: `to ${review.english}`,
    forms: review.forms,
    context: verb.context,
    verbType: isRegular(base, past, participle) ? "regular" : "irregular",
    frequency: review.frequency ?? verb.frequency,
    review: true,
  };
}

export async function generateVerbs(
  input: GenerateInput,
  combinations: Combination[],
): Promise<Exercise[]> {
  const reviews = reviewSlots(input, "verb", combinations.length);
  const fresh = freshness(input, "verb");
  const { known, recent } = history(input, "verb");
  for (const review of reviews) {
    if (review) fresh.take({ text: review.text, english: review.english ?? "" });
  }
  const slots = combinations.map((combination, index): Slot<VerbItem> => {
    const review = reviews[index];
    return review
      ? { task: reviewTask(review, "verb", combination.theme), check: (raw) => reviewed(review, combination, raw) }
      : {
          task: newTask(combination),
          // The last time, a verb of the other type is better than none.
          check: (raw, final) =>
            exercise(
              firstFresh(
                raw.choices,
                (choice) => checkedVerb(choice, final ? undefined : combination.verbType),
                fresh,
              ),
              combination,
            ),
        };
  });
  const results = await generateBatch(input, {
    mode: "verb",
    fields: FIELDS,
    schema: verbItemSchema,
    slots,
    sections: historySection(recent, "verb") + knownSection(known, "verb") + similarSection(input, "verb"),
    tokensPerItem: 1500,
  });
  return keptItems(results, reviews);
}
