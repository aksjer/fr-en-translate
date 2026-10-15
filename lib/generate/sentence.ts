// One French sentence in the tense from the settings.
import { generateItem, type GenerateInput } from "@/lib/generate/shared";
import {
  priority,
  SENTENCE_TEXT_FIELD,
  sentenceVocabulary,
  VARIETY,
  weakPointsSection,
} from "@/lib/generate/sentences";
import { TENSE_GUIDES } from "@/lib/options";
import type { Combination } from "@/lib/settings";

export function generateSentence(input: GenerateInput, combination: Combination) {
  const { level, tense, theme } = combination;
  const imperative = tense === "impératif";
  return generateItem(input, combination, {
    // Planning the conjugated verb first keeps the tense right.
    fields: [
      "- situation: first, one short line in English: the situation you chose (who, where,",
      "  when), then the main French verb already conjugated in the required tense and",
      '  person (e.g. "que nous partions").',
      ...SENTENCE_TEXT_FIELD,
    ],
    task:
      `Write one original French sentence on the theme "${theme}", ` +
      `using the French tense "${tense}", of a length typical of CEFR ${level}. ` +
      "Choose the person of the main verb " +
      (imperative
        ? "(tu, nous or vous) and whether it is a statement or a negation."
        : "(je, tu, il, elle, on, nous, vous, ils or elles) and the sentence type " +
          "(statement, question, negation or exclamation).") +
      sentenceVocabulary(level) +
      "\n" +
      `This tense in American English: ${tense && TENSE_GUIDES[tense]}.` +
      VARIETY +
      priority(true),
    sections: weakPointsSection(input),
  });
}
