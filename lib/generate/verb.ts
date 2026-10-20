// One English verb, regular or irregular as in the settings, with its forms
// and a French sentence that shows its meaning. It has its own fields: with one
// free "text" field, models kept writing a sentence instead of a verb.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  CANDIDATES,
  chooseAnswer,
  commonAt,
  FREQUENCY_FIELD,
  GOAL,
  hasDroppedLetters,
  history,
  historySection,
  learner,
  reviewFor,
  reviewTask,
  tryAgainSection,
  knownSection,
  usableAnswers,
  withApostrophes,
  type Exercise,
  type GenerateInput,
} from "@/lib/generate/shared";
import {
  InvalidAnswerError,
  model,
  retryIfInvalid,
  thinkingFor,
} from "@/lib/model";
import { FREQUENCIES, MAX_TEXT_LENGTH, type VerbType } from "@/lib/options";
import type { Combination } from "@/lib/settings";

// A verb gets its own fields: the English verb first, then its forms, then
// the French. With one free "text" field, models kept writing a sentence.
export const verbSchema = z.object({
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
  const context = output.context.trim();
  if (!/^[a-z]+$/.test(base) || !past || !participle || !text || !context) {
    throw new InvalidAnswerError(`Not a verb: ${base}`);
  }
  if (hasDroppedLetters(context)) {
    throw new InvalidAnswerError(`Letters missing: ${context}`);
  }
  if (context.length > MAX_TEXT_LENGTH) {
    throw new InvalidAnswerError(`Context too long: ${context}`);
  }
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
    context: withApostrophes(context),
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
  let attempt = 0;
  let tryAgain = "";
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
        ...(review
          ? []
          : [
              `verbs: ${CANDIDATES} different verbs, best first, each with these fields:`,
            ]),
        '- english: the verb, in its base form, one word, without "to".',
        "- past: its simple past in American English.",
        "- participle: its past participle in American English (gotten, not got).",
        "- text: the most common French infinitive for this verb (e.g. « conduire » for",
        "  drive). Only the infinitive, never a sentence or a conjugated verb, with no",
        "  context or quotation marks. Check its spelling and accents.",
        "- context: one short, everyday French sentence that uses this French verb,",
        "  conjugated, in the meaning of the English verb. The learner sees it under the",
        "  infinitive, so it must leave only this meaning possible (e.g. « Nous louons un",
        "  appartement près de la plage. » for rent, since louer can also mean to praise).",
        "  Check its spelling and accents.",
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
            `${commonAt(`${verbType} verb`)}, useful when talking about ` +
            `"${theme}". The theme is only a direction: if no verb fits it and every other ` +
            "rule, choose one loosely related to it rather than a less common verb. " +
            "Never a verb that looks like its French translation (decide → décider), or one " +
            "whose look-alike French verb means something else (to attend is « assister à », " +
            "not « attendre »). " +
            "Then check it the other way: a French speaker who sees your French infinitive " +
            "and its context sentence must naturally answer with this English verb. If they " +
            "would rather answer another English verb (« confondre » is confuse or mix up, " +
            "not mistake), choose another verb.") +
        // A review only gives a listed verb again: the history would contradict it.
        (review ? "" : historySection(recent, "verb") + knownSection(known, "verb")) +
        tryAgain,
    });
    const answers = review
      ? [output as z.infer<typeof verbSchema>]
      : (output as { verbs: z.infer<typeof verbSchema>[] }).verbs.slice(
          0,
          CANDIDATES,
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
    if (attempt > 1) return { ...usable[0], fits: false };
    tryAgain = tryAgainSection(usable, Boolean(review));
    throw new InvalidAnswerError(
      `No fitting verb: ${usable.map((answer) => answer.english).join(", ")}`,
    );
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
