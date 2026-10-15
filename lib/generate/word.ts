// A single French noun, adjective or adverb.
import { commonAt, generateItem, type GenerateInput } from "@/lib/generate/shared";
import type { Combination } from "@/lib/settings";

export function generateWord(input: GenerateInput, combination: Combination) {
  const { level, theme } = combination;
  return generateItem(input, combination, {
    // The English comes first, since the level is about English: starting from
    // the French gave loose translations (un périple → an ordeal).
    fields: [
      "- situation: first, one short line in English: the English word you chose and its",
      "  meaning here (e.g. leaf: part of a tree).",
      "- text: the French word only, with its article for a noun (la feuille), and no",
      "  context, quotation marks, translation or explanation. Check its spelling and accents.",
      "- context: one short, everyday French sentence that uses this French word in the",
      "  meaning of the English word. The learner sees it under the word, so it must leave",
      "  only this meaning possible (e.g. « Les feuilles tombent des arbres en automne. »",
      "  for leaf, since feuille is also a sheet of paper). Check its spelling and accents.",
      "- reference: the most natural American English translation of text in the meaning",
      "  of context, in American words and spelling (apartment, color, not flat, colour).",
    ],
    task:
      "Give a single French noun, adjective or adverb whose American English " +
      `translation is ${commonAt(level, "word")}, related to the theme "${theme}". ` +
      "Choose the kind of word the recent history has had the fewest of: not always a noun. " +
      "Give a noun with its article (le, la, l', un, une). " +
      "Pick a word whose American English translation looks different from the French " +
      "(not « généreux » → generous). The French must be the word a French speaker would " +
      "really use for this English, never a look-alike with another meaning. " +
      "The text is only the word, never a sentence: the sentence goes in context. " +
      "The theme is only a direction: if no word fits it and every other rule, choose " +
      "one loosely related to it rather than one at another level.",
  });
}
