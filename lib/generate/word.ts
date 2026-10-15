// A single French noun, adjective or adverb.
import { commonAt, generateItem, type GenerateInput } from "@/lib/generate/shared";
import type { Combination } from "@/lib/settings";

export function generateWord(input: GenerateInput, combination: Combination) {
  const { level, theme } = combination;
  return generateItem(input, combination, {
    // The English comes first, since the level is about English: starting from
    // the French gave loose translations (un périple → an ordeal).
    fields: [
      "- situation: first, one short line in English: the English word you chose, then the",
      "  context it is used in.",
      "- text: the French word only, with its context in parentheses if any, and no",
      "  quotation marks, translation or explanation. Check its spelling and accents.",
    ],
    task:
      "Give a single French noun, adjective or adverb whose American English " +
      `translation is ${commonAt(level, "word")}, related to the theme "${theme}". ` +
      "Choose the kind of word from the history: not always a noun. " +
      "Give a noun with its article (le, la, l', un, une). " +
      "Pick a word whose American English translation looks different from the French " +
      "(not « généreux » → generous). The French must be the word a French speaker would " +
      "really use for this English, never a look-alike with another meaning. If the French " +
      "word also has another common meaning, add a short context in parentheses that rules " +
      "it out (e.g. « la feuille (d'un arbre) » for leaf, since feuille is also a sheet of " +
      "paper). Give only the word, never a sentence.",
  });
}
