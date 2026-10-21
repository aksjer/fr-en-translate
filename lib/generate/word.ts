// A single French word or short expression: a noun, an adjective, an adverb, a
// modal, a preposition or a conjunction, with a sentence that shows its meaning.
import {
  CANDIDATES,
  commonAt,
  generateItem,
  reviewFor,
  reviewContext,
  reviewTask,
  sameText,
  storedReview,
  similarSection,
  type Exercise,
  type GenerateInput,
} from "@/lib/generate/shared";
import type { WordKind } from "@/lib/options";
import type { Combination } from "@/lib/settings";

// What a word of each kind looks like, besides the examples of commonAt. Only
// examples: the history keeps the model from giving the same ones again.
const KIND_GUIDES: Record<WordKind, string> = {
  noun: "",
  // Many of the most useful ones are expressions (anyway, worth it).
  adjective: "Expressions of several words count too (« ça vaut le coup » → worth it). ",
  adverb: "Expressions of several words count too (« de toute façon », « en fait »). ",
  // Few modals exist: their other forms keep the kind from running out.
  modal:
    "The text is the French verb form as it appears in the context sentence, and other " +
    "forms of a modal count as other words (« tu aurais dû » → should have, « je n'ai " +
    "pas pu » → couldn't, « tu n'es pas obligé » → don't have to). ",
  preposition: "Expressions of several words count too (« au lieu de », « grâce à »). ",
  conjunction: "Linking expressions of several words count too (« dès que », « ainsi que »). ",
};

export async function generateWord(
  input: GenerateInput,
  combination: Combination,
): Promise<Exercise> {
  const { theme } = combination;
  // The code picks the kind of word: left to choose, a small model gives nouns
  // again and again.
  const kind = combination.kind ?? "noun";
  let review = reviewFor(input, "word");
  // A review of a word stored whole: the code gives it again as it was, with a
  // new context sentence.
  const stored = storedReview(review, "word");
  const storedContext = stored && (await reviewContext(stored, "word", theme));
  if (stored && storedContext) {
    return {
      ...combination,
      text: stored.text,
      reference: stored.reference ?? stored.english,
      context: storedContext,
      kind: stored.kind,
      ...(stored.frequency && { frequency: stored.frequency }),
      review: true,
    };
  }
  if (stored) review = undefined;
  // A review gives a word of any kind: it gets its own kind back below.
  const exercise = await generateItem(input, review ? { ...combination, kind: undefined } : combination, {
    review,
    sections: review ? undefined : similarSection(input, "word"),
    // The English comes first, since the learner works on their English: starting
    // from the French gave loose translations (un périple → an ordeal). The
    // example describes its context instead of giving one, so it can't be copied.
    fields: [
      "- situation: one short line in English: the English word and its meaning here",
      "  (e.g. leaf: part of a tree).",
      "- text: the French word or short expression only, with its article for a noun",
      "  (la feuille). Check its spelling and accents.",
      "- context: one short, everyday French sentence that uses text in this meaning",
      "  only (for la feuille → leaf, a sentence about a tree, never about paper).",
      "- itemInContext: the words of context that translate text, copied exactly as",
      "  written there, in any form (les feuilles).",
      "- reference: the most natural American English translation of text alone, never",
      "  of the context, in American words and spelling (apartment, color).",
    ],
    task: review
      ? reviewTask(review, "word", theme)
      : `Give ${CANDIDATES} different English words. Each one is a French word, or a ` +
        "short expression except for a noun, whose American English translation is " +
        `${commonAt(kind)}, on the theme "${theme}" (only a direction: a common word ` +
        "loosely related to it beats a rare one). " +
        KIND_GUIDES[kind] +
        "Its English looks different from the French (not « généreux » → generous). The " +
        "French is the word a French speaker really uses for this English, so seeing text " +
        "and context they would answer with your reference. When the most common words " +
        "of this kind are learned, take another common form or use of one.",
  });
  const reviewed =
    exercise.review && review?.find((item) => sameText(item.text) === sameText(exercise.text));
  return reviewed ? { ...exercise, kind: reviewed.kind } : exercise;
}
