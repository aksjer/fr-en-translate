// One English verb, regular or irregular as in the settings, with its forms
// and a French sentence that shows its meaning. It has its own fields: with one
// free "text" field, models kept writing a sentence instead of a verb.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  commonAt,
  GOAL,
  history,
  historySection,
  knownSection,
  learner,
  withApostrophes,
  type Exercise,
  type GenerateInput,
} from "@/lib/generate/shared";
import {
  InvalidAnswerError,
  modelFor,
  providerOptionsFor,
  retryIfInvalid,
  temperatureFor,
} from "@/lib/model";
import { MAX_TEXT_LENGTH } from "@/lib/options";
import type { Combination } from "@/lib/settings";

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

// Asks the model for one verb and checks it in code. A verb already known is
// asked again once; the second answer is kept, so the page never gets an error.
export async function generateVerb(
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
        "- context: one short, everyday French sentence that uses this French verb,",
        "  conjugated, in the meaning of the English verb, so the learner",
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
