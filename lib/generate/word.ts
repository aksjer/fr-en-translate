// A single French noun, adjective or adverb.
import {
  CANDIDATES,
  commonAt,
  generateItem,
  reviewFor,
  reviewTask,
  type GenerateInput,
} from "@/lib/generate/shared";
import type { Combination } from "@/lib/settings";

// The code picks the kind of word: asked to vary it from the history, a small
// model has to classify and count 30 items, and gives nouns again and again.
// Nouns come up twice as often, as they do in the language.
const KINDS = ["noun", "noun", "adjective", "adverb"] as const;

export function generateWord(input: GenerateInput, combination: Combination) {
  const { level, theme } = combination;
  const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
  const review = reviewFor(input, "word");
  return generateItem(input, combination, {
    review,
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
      "- reference: the most natural American English translation of text alone (the word,",
      "  never the context sentence) in the meaning of context, in American words and",
      "  spelling (apartment, color, not flat, colour).",
    ],
    task: review
      ? reviewTask(review, "word", theme)
      : `Give ${CANDIDATES} items, ${CANDIDATES} different English words. Each one is a ` +
        `single French ${kind} whose American English translation is ` +
        `${commonAt(level, kind)}, related to the theme "${theme}". ` +
        (kind === "noun" ? "Give it with its article (le, la, l', un, une). " : "") +
        "Pick a word whose American English translation looks different from the French " +
        "(not « généreux » → generous). The French must be the word a French speaker would " +
        "really use for this English, never a look-alike with another meaning. " +
        "The text is only the word, never a sentence: the sentence goes in context. " +
        "The theme is only a direction: if no word fits it and every other rule, choose " +
        "one loosely related to it rather than one at another level.",
  });
}
