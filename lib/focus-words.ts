// The English words each grammar point of a sentence can practice, with the
// tenses each one sounds natural in. The code picks the tense first, then a
// word that fits it: left to the model, a word and a tense that don't go
// together (unless with a past perfect) gave forced sentences.
import { TENSES, type SentenceFocus, type Tense } from "@/lib/options";

const ALL = TENSES;

const FOCUS_WORDS: Record<SentenceFocus, { word: string; tenses: readonly Tense[] }[]> = {
  // do-support, which French doesn't show; the other auxiliaries are the
  // tense's own (have, had, will, would), never a point.
  auxiliary: [
    { word: "do", tenses: ["present"] },
    { word: "does", tenses: ["present"] },
    { word: "don't", tenses: ["present"] },
    { word: "doesn't", tenses: ["present"] },
    { word: "did", tenses: ["past"] },
    { word: "didn't", tenses: ["past"] },
  ],
  // Each modal in the form a tense gives it.
  modal: [
    { word: "can", tenses: ["present"] },
    { word: "could", tenses: ["past", "conditional"] },
    { word: "should", tenses: ["present", "conditional"] },
    { word: "must", tenses: ["present"] },
    { word: "might", tenses: ["present", "future", "conditional"] },
    { word: "may", tenses: ["present", "future"] },
    { word: "have to", tenses: ["present"] },
    { word: "had to", tenses: ["past"] },
    { word: "has had to", tenses: ["present perfect"] },
    { word: "will have to", tenses: ["future"] },
    { word: "would have to", tenses: ["conditional"] },
    { word: "was able to", tenses: ["past"] },
    { word: "has been able to", tenses: ["present perfect"] },
    { word: "had been able to", tenses: ["past perfect"] },
    { word: "will be able to", tenses: ["future"] },
    { word: "would be able to", tenses: ["conditional"] },
    { word: "should have", tenses: ["past"] },
    { word: "must have", tenses: ["past"] },
    { word: "had better", tenses: ["present"] },
    { word: "would rather", tenses: ["present", "conditional"] },
  ],
  preposition: [
    { word: "on", tenses: ALL },
    { word: "at", tenses: ALL },
    { word: "in", tenses: ALL },
    { word: "for", tenses: ALL },
    { word: "by", tenses: ALL },
    { word: "during", tenses: ALL },
    { word: "until", tenses: ["present", "past", "past perfect", "future", "conditional"] },
    { word: "since", tenses: ["present perfect", "past perfect"] },
    { word: "depend on", tenses: ["present", "future", "conditional"] },
    { word: "wait for", tenses: ALL },
  ],
  conjunction: [
    { word: "although", tenses: ALL },
    { word: "even though", tenses: ALL },
    { word: "while", tenses: ALL },
    { word: "whereas", tenses: ALL },
    { word: "before", tenses: ALL },
    { word: "after", tenses: ALL },
    { word: "unless", tenses: ["present", "future", "conditional"] },
    { word: "as soon as", tenses: ["present", "past", "future"] },
    { word: "as long as", tenses: ["present", "future", "conditional"] },
    { word: "so that", tenses: ["present", "past", "future", "conditional"] },
    { word: "once", tenses: ["present", "past", "future"] },
    { word: "in case", tenses: ["present", "future"] },
  ],
  adverb: [
    { word: "already", tenses: ["past", "present perfect", "past perfect"] },
    { word: "yet", tenses: ["past", "present perfect"] },
    { word: "ever", tenses: ["present perfect", "past perfect"] },
    { word: "just", tenses: ["past", "present perfect", "past perfect"] },
    { word: "lately", tenses: ["present perfect"] },
    { word: "recently", tenses: ["past", "present perfect"] },
    { word: "soon", tenses: ["future", "conditional"] },
    { word: "often", tenses: ["present", "past", "future"] },
    { word: "rarely", tenses: ["present", "past"] },
    { word: "still", tenses: ALL },
    { word: "always", tenses: ALL },
    { word: "almost", tenses: ALL },
    { word: "never", tenses: ALL },
  ],
};

// The words of a grammar point that fit a tense; every tense when none is set.
export function focusWordsFor(focus: SentenceFocus, tense?: Tense) {
  return FOCUS_WORDS[focus]
    .filter((entry) => !tense || entry.tenses.includes(tense))
    .map((entry) => entry.word);
}
