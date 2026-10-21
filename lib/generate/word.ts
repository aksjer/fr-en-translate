// A single French word or short expression: a noun, an adjective, an adverb, a
// modal, a preposition or a conjunction, with a sentence that shows its meaning.
import { z } from "zod";
import {
  CHOICES,
  checkedContext,
  checkedItem,
  commonAt,
  firstFresh,
  freshness,
  generateBatch,
  history,
  historySection,
  keptItems,
  knownSection,
  reviewChecked,
  reviewSlots,
  reviewTask,
  similarSection,
  wordExerciseSchema,
  type BatchPlan,
  type Exercise,
  type GenerateInput,
  type ReviewItem,
  type Slot,
} from "@/lib/generate/shared";
import type { WordKind } from "@/lib/options";
import type { Combination } from "@/lib/settings";
import { InvalidAnswerError } from "@/lib/model";

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

// One item: a few choices for a new word, the code keeping the first new
// one; a single one for a review.
const wordItemSchema = z.object({ choices: z.array(wordExerciseSchema) });
type WordItem = z.infer<typeof wordItemSchema>;

// The English comes first, since the learner works on their English: starting
// from the French gave loose translations (un périple → an ordeal). The
// example describes its context instead of giving one, so it can't be copied.
const FIELDS = [
  `- choices: ${CHOICES} different words for this task, best first (just one for a`,
  "  review), each with:",
  "  - situation: one short line in English: the English word and its meaning here",
  "    (e.g. leaf: part of a tree).",
  "  - text: the French word or short expression only, with its article for a noun",
  "    (la feuille). Check its spelling and accents.",
  "  - context: one short, everyday French sentence that uses text in this meaning",
  "    only (for la feuille → leaf, a sentence about a tree, never about paper).",
  "  - itemInContext: the words of context that translate text, copied exactly as",
  "    written there, in any form (les feuilles).",
  "  - reference: the most natural American English translation of text alone, never",
  "    of the context, in American words and spelling (apartment, color).",
  "  - frequency: how often an American hears this English word: everyday (every day",
  "    or every week), sometimes, or rare.",
];

function newTask({ kind = "noun", theme }: Combination) {
  return (
    `${CHOICES} different English words. Each one is a French word, or a short ` +
    `expression except for a noun, whose American English translation is ${commonAt(kind)}, ` +
    `on the theme "${theme}" (only a direction: a common word loosely related to it ` +
    "beats a rare one). " +
    KIND_GUIDES[kind] +
    "Its English looks different from the French (not « généreux » → generous). The " +
    "French is the word a French speaker really uses for this English, so seeing text " +
    "and context they would answer with your reference. When the most common words of " +
    "this kind are learned, take another common form or use of one."
  );
}

// A review gives the missed word again, with its own kind; one stored whole
// keeps its French and English as stored, and only its context is new.
function reviewed(review: ReviewItem, combination: Combination, raw: WordItem): Exercise {
  const [choice] = raw.choices;
  if (!choice) throw new InvalidAnswerError("No word");
  const answer = reviewChecked(review, checkedItem(choice, "word"));
  const context = checkedContext(choice.context, choice.itemInContext, [review.context]);
  return {
    ...combination,
    kind: review.kind,
    text: review.english ? review.text : answer.text,
    reference: review.english ? (review.reference ?? review.english) : answer.reference,
    context,
    frequency: review.frequency ?? answer.frequency,
    review: true,
  };
}

export async function generateWords(input: GenerateInput, combinations: Combination[]) {
  const { batch, finish } = wordBatch(input, combinations);
  return finish(await generateBatch(input, batch));
}

// The call for a batch of words, without sending it.
export function wordBatch(input: GenerateInput, combinations: Combination[]): BatchPlan<WordItem> {
  const reviews = reviewSlots(input, "word", combinations.length);
  const fresh = freshness(input, "word");
  const { known, recent } = history(input, "word");
  for (const review of reviews) {
    if (review) fresh.take({ text: review.text, english: review.english ?? "" });
  }
  const slots = combinations.map((combination, index): Slot<WordItem> => {
    const review = reviews[index];
    return review
      ? { task: reviewTask(review, "word", combination.theme), check: (raw) => reviewed(review, combination, raw) }
      : {
          task: newTask(combination),
          check: (raw) => {
            const answer = firstFresh(raw.choices, (choice) => checkedItem(choice, "word"), fresh);
            return {
              ...combination,
              text: answer.text,
              reference: answer.reference,
              context: answer.context,
              frequency: answer.frequency,
            };
          },
        };
  });
  return {
    batch: {
      mode: "word",
      fields: FIELDS,
      schema: wordItemSchema,
      slots,
      sections: historySection(recent, "word") + knownSection(known, "word") + similarSection(input, "word"),
      tokensPerItem: 1500,
    },
    finish: (results) => keptItems(results, reviews),
  };
}

