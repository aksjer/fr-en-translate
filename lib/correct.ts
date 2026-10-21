// Corrects the learner's translation: right or wrong, the corrected English and
// a short French explanation.
import { generateText, Output } from "ai";
import { z } from "zod";
import { MINIMAL_THINKING, model, withoutEntities } from "@/lib/model";
import { MAX_TEXT_LENGTH, MODES, englishKey } from "@/lib/options";

const text = z.string().trim().min(1).max(MAX_TEXT_LENGTH);

export const correctInputSchema = z.object({
  mode: z.enum(MODES),
  text,
  reference: text,
  translation: text,
});

export type CorrectInput = z.infer<typeof correctInputSchema>;

export type Correction = {
  right: boolean;
  // The learner's answer corrected, or as it was when right.
  correction: string;
  // Why it was wrong, in French; empty when right.
  explanation: string;
  // Other ways to say a word or verb.
  variants?: string[];
  // A verb's base form, past and past participle.
  forms?: [string, string, string];
  // A more natural sentence, only when it helps.
  natural?: string;
};

const short = z.string().max(200);

function schemaFor(mode: CorrectInput["mode"]) {
  const base = {
    right: z.boolean(),
    correction: z.string().max(MAX_TEXT_LENGTH),
    explanation: z.string().max(MAX_TEXT_LENGTH),
  };
  if (mode === "sentence")
    return z.object({ ...base, natural: z.string().max(MAX_TEXT_LENGTH).optional() });
  const variants = z.array(short).max(5);
  if (mode === "word") return z.object({ ...base, variants });
  return z.object({ ...base, variants, base: short, past: short, pastParticiple: short });
}

const EXTRAS = {
  word: "variants: other common American words for it (none if there are none).",
  verb: "variants: other common American verbs for it; base, past and pastParticiple: the forms of the corrected verb.",
  sentence:
    "natural: a more natural American way to say it, only if the corrected answer sounds unnatural; leave it out otherwise.",
};

export async function correctTranslation(input: CorrectInput): Promise<Correction> {
  // The expected sentence itself needs no model; a word or verb still gets its
  // variants and forms.
  if (input.mode === "sentence" && englishKey(input.translation) === englishKey(input.reference)) {
    return { right: true, correction: input.translation, explanation: "" };
  }
  const { output } = await generateText({
    model,
    output: Output.object({ schema: schemaFor(input.mode) }),
    prompt: [
      `A French speaker translated this French ${input.mode} into American English.`,
      `French: ${input.text}`,
      `Reference translation: ${input.reference}`,
      `Learner's answer: ${input.translation}`,
      "right: would an American find this answer right, with the same meaning? It may differ from the reference.",
      "correction: the learner's answer corrected (unchanged if right). explanation: a short explanation in French of what was wrong (empty if right).",
      EXTRAS[input.mode],
    ].join("\n"),
    providerOptions: MINIMAL_THINKING,
    maxOutputTokens: 800,
  });
  const result = withoutEntities(
    output as Record<string, unknown> & z.infer<ReturnType<typeof schemaFor>>,
  );
  const variants = (result.variants as string[] | undefined)
    ?.map((variant) => variant.trim())
    .filter((variant) => variant && englishKey(variant) !== englishKey(result.correction));
  const forms = [result.base, result.past, result.pastParticiple].map((form) =>
    typeof form === "string" ? form.trim() : "",
  );
  const natural = typeof result.natural === "string" ? result.natural.trim() : "";
  return {
    right: result.right,
    correction: result.correction.trim() || input.reference,
    explanation: result.right ? "" : result.explanation.trim(),
    ...(variants?.length && { variants }),
    ...(forms.every(Boolean) && { forms: forms as [string, string, string] }),
    ...(natural && englishKey(natural) !== englishKey(result.correction) && { natural }),
  };
}
