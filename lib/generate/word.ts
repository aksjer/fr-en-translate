// A single French word: a noun, an adjective, an adverb, a modal, a preposition
// or a conjunction, with a sentence that shows its meaning.
import {
  CANDIDATES,
  commonAt,
  generateItem,
  reviewFor,
  reviewTask,
  type GenerateInput,
} from "@/lib/generate/shared";
import type { WordKind } from "@/lib/options";
import type { Combination } from "@/lib/settings";

// What a word of each kind looks like, besides the examples of commonAt. Only
// examples: the history keeps the model from giving the same ones again.
const KIND_GUIDES: Record<WordKind, string> = {
  noun: "Give it with its article (le, la, l', un, une). ",
  adjective: "",
  adverb: "",
  // Few modals exist: their other forms keep the kind from running out.
  modal:
    "The text is the French verb form as it appears in the context sentence, and other " +
    "forms of a modal count as other words (« tu aurais dû » → should have, « je n'ai " +
    "pas pu » → couldn't, « tu n'es pas obligé » → don't have to). ",
  preposition: "Expressions of several words count too (« au lieu de », « grâce à »). ",
  conjunction: "Linking expressions of several words count too (« dès que », « ainsi que »). ",
};

export function generateWord(input: GenerateInput, combination: Combination) {
  const { theme } = combination;
  // The code picks the kind of word: left to choose, a small model gives nouns
  // again and again.
  const kind = combination.kind ?? "noun";
  const review = reviewFor(input, "word");
  return generateItem(input, combination, {
    review,
    // The English comes first, since the learner works on their English: starting
    // from the French gave loose translations (un périple → an ordeal).
    fields: [
      "- situation: first, one short line in English: the English word you chose and its",
      "  meaning here (e.g. leaf: part of a tree).",
      "- text: the French word or short expression only, with its article for a noun (la",
      "  feuille), and no context, quotation marks, translation or explanation. Check its",
      "  spelling and accents.",
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
        "single French word (or a short expression for a modal, a preposition or a " +
        `conjunction) whose American English translation is ${commonAt(kind)}, with a ` +
        `context sentence on the theme "${theme}". ` +
        KIND_GUIDES[kind] +
        "Pick a word whose American English translation looks different from the French " +
        "(not « généreux » → generous). The French must be the word a French speaker would " +
        "really use for this English, never a look-alike with another meaning. " +
        "The text is only the word, never a sentence: the sentence goes in context. " +
        "The theme is only a direction: if no word fits it and every other rule, choose " +
        "one loosely related to it rather than a less common word. If the most common " +
        "words of this kind are all learned, take another common form or use of one " +
        "rather than a rare word.",
  });
}
