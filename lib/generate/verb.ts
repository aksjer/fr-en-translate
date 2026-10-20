// One English verb, regular or irregular as in the settings, with its forms
// and a French sentence that shows its meaning. It has its own fields: with one
// free "text" field, models kept writing a sentence instead of a verb.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  CANDIDATES,
  checkedContext,
  chooseAnswer,
  commonAt,
  FREQUENCY_FIELD,
  GOAL,
  history,
  historySection,
  learner,
  reviewFor,
  reviewContext,
  reviewTask,
  similarSection,
  storedReview,
  tryAgainSection,
  knownSection,
  usableAnswers,
  withApostrophes,
  type Exercise,
  type GenerateInput,
} from "@/lib/generate/shared";
import {
  InvalidAnswerError,
  isInvalidAnswer,
  model,
  retryIfInvalid,
  thinkingFor,
  withoutEntities,
} from "@/lib/model";
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
function checkedVerb(output: z.infer<typeof verbSchema>, verbType?: VerbType) {
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
  const context = checkedContext(output.context, text, "verb");
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

// Asks the model for CANDIDATES new verbs at once, or one missed verb in a
// review, and checks them in code. When none fits, the model is asked again
// once; the second time, the first usable verb is kept, so the page never
// gets an error.
export async function generateVerb(
  input: GenerateInput,
  combination: Combination,
): Promise<Exercise> {
  const { theme } = combination;
  const verbType = combination.verbType ?? "regular";
  const { known, recent } = history(input, "verb");
  const review = reviewFor(input, "verb");
  // A review of a verb stored whole: the code gives it again as it was, with a
  // new context sentence.
  const stored = storedReview(review, "verb");
  if (stored?.forms) {
    const [base, past, participle] = stored.forms;
    return {
      ...combination,
      text: stored.text,
      reference: `to ${stored.english}`,
      forms: stored.forms,
      context: await reviewContext(stored, "verb", theme),
      verbType: isRegular(base, past, participle) ? "regular" : "irregular",
      ...(stored.frequency && { frequency: stored.frequency }),
      review: true,
    };
  }
  let attempt = 0;
  let tryAgain = "";
  // A usable first verb, kept if the one asked again is broken.
  let fallback: (ReturnType<typeof checkedVerb> & { fits: boolean }) | undefined;
  const verb = await retryIfInvalid(async () => {
    attempt++;
    const { output } = await generateText({
      model,
      providerOptions: thinkingFor("generate"),
      maxRetries: 1,
      maxOutputTokens: review ? 3000 : 4000,
      output: Output.object({
        schema: (review ? verbSchema : z.object({ verbs: z.array(verbSchema) })) as z.ZodType<
          z.infer<typeof verbSchema> | { verbs: z.infer<typeof verbSchema>[] }
        >,
      }),
      system: [
        "You are an American English teacher for a French speaker. You choose " +
          (review ? "one English verb" : `${CANDIDATES} English verbs`),
        "that the learner will translate from French.",
        "",
        "## Fields, in this order",
        ...(review ? [] : [`verbs: ${CANDIDATES} different verbs, best first, each with:`]),
        '- english: the verb in its base form, one word, without "to".',
        "- past, participle: its simple past and past participle in American English",
        "  (gotten, not got).",
        "- text: the most common French infinitive for this verb, only the infinitive",
        "  (« conduire » for drive). Check its spelling and accents.",
        "- context: one short, everyday French sentence that uses text, conjugated, in",
        "  this meaning only (for louer → rent, a sentence about a home or a car, never",
        "  about praise). Check its spelling and accents.",
        ...FREQUENCY_FIELD,
      ].join("\n"),
      prompt:
        GOAL +
        "\n\n" +
        learner("verb") +
        "\n\n## Task\n" +
        (review
          ? reviewTask(review, "verb", theme)
          : `Choose ${CANDIDATES} different verbs. Each one is ` +
            `${commonAt(`${verbType} verb`)}, useful when talking about "${theme}" (only ` +
            "a direction: a common verb loosely related to it beats a rare one). Its " +
            "French translation looks different from it (not decide → décider), and has " +
            "no look-alike with another meaning (attend is « assister à », not « attendre " +
            "»). A French speaker who sees text and context would answer with this verb, " +
            "not another one (« confondre » is confuse or mix up, not mistake).") +
        // A review only gives a listed verb again: the history would contradict it.
        (review
          ? ""
          : historySection(recent, "verb") +
            knownSection(known, "verb") +
            similarSection(input, "verb")) +
        tryAgain,
    });
    const answers = withoutEntities(
      review
        ? [output as z.infer<typeof verbSchema>]
        : (output as { verbs: z.infer<typeof verbSchema>[] }).verbs.slice(0, CANDIDATES),
    );
    let usable = usableAnswers(answers, (answer) =>
      checkedVerb(answer, review ? undefined : verbType),
    );
    // The second time, a verb of the other type is better than an error.
    if (!usable.length && attempt > 1)
      usable = usableAnswers(answers, (answer) => checkedVerb(answer));
    if (!usable.length) {
      if (!review)
        tryAgain =
          "\n\n## Try again\nYour last verbs weren't " +
          `${verbType}: ${answers.map((answer) => answer.english).join(", ")}. ` +
          `Give ${CANDIDATES} ${verbType} verbs.`;
      throw new InvalidAnswerError("No usable verb");
    }
    const chosen = chooseAnswer(usable, { known, recent, review });
    if (chosen) return { ...chosen, fits: true };
    // A review the model ignored twice gives a new verb, which still mustn't
    // be learned or recent.
    const fresh = review ? chooseAnswer(usable, { known, recent }) : undefined;
    if (attempt > 1) {
      // A good first answer beats a learned or recent second one.
      return fresh ? { ...fresh, fits: false } : (fallback ?? { ...usable[0], fits: false });
    }
    fallback = { ...(fresh ?? usable[0]), fits: false };
    tryAgain = tryAgainSection(usable, Boolean(review));
    throw new InvalidAnswerError(
      `No fitting verb: ${usable.map((answer) => answer.english).join(", ")}`,
    );
  }).catch((error) => {
    if (fallback && isInvalidAnswer(error)) return fallback;
    throw error;
  });

  return {
    text: verb.text,
    reference: `to ${verb.english}`,
    forms: [verb.english, verb.past, verb.participle],
    context: verb.context,
    ...combination,
    verbType: verb.verbType,
    frequency: verb.frequency,
    // A review whose answer isn't a listed verb is a new verb.
    ...(review && verb.fits && { review: true }),
  };
}
