// A French verb or short expression that translates as a phrasal verb.
import { generateItem, type GenerateInput } from "@/lib/generate/shared";
import type { Combination } from "@/lib/settings";

export function generatePhrasalVerb(input: GenerateInput, combination: Combination) {
  const { level, theme } = combination;
  return generateItem(input, combination, {
    fields: [
      "- situation: first, one short line in English: the English phrasal verb you chose,",
      "  then the context it is used in.",
      "- text: the French item only, with its context in parentheses if any, and no",
      "  quotation marks, translation or explanation. Check its spelling and accents.",
    ],
    task:
      "Give a French verb in the infinitive, or a short expression starting with one, " +
      `related to the theme "${theme}", that translates naturally into American English ` +
      `as one of the most common phrasal verbs that learners usually learn at CEFR ${level}. ` +
      "Vary the particle (up, out, off, down, on, over, back, away, through…) from the " +
      "history: not always up or out. " +
      "The French must be what a French speaker would really say for this meaning. " +
      "If the French alone could also be translated by another common verb, add a short " +
      "context in parentheses that rules it out (e.g. « abandonner (une habitude) » for " +
      "give up). The whole item has 10 words at most. " +
      "Never a sentence or a conjugated verb. The reference must be a real phrasal verb " +
      "(find out, give up), not a simple verb such as quit.",
  });
}
