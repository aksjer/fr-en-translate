// A French paragraph of three sentences: it practices what one sentence can't,
// tenses that follow each other and the links between sentences.
import { generateItem, type GenerateInput } from "@/lib/generate/shared";
import {
  priority,
  SENTENCE_TEXT_FIELD,
  sentenceVocabulary,
  VARIETY,
  weakPointsSection,
} from "@/lib/generate/sentences";
import type { Combination } from "@/lib/settings";

export function generateParagraph(input: GenerateInput, combination: Combination) {
  const { level, theme } = combination;
  return generateItem(input, combination, {
    fields: [
      "- situation: first, one short line in English: the situation you chose (who, where,",
      "  when), then the main French verb of each of the three sentences, already conjugated.",
      ...SENTENCE_TEXT_FIELD,
    ],
    task:
      "Write a short French paragraph of exactly three sentences that tell one coherent " +
      `little story or moment, on the theme "${theme}", mainly told with one person ` +
      "(je, tu, il, elle, on, nous, vous, ils or elles) that you choose (other people or " +
      "things can also be the subject of a sentence). " +
      `Each sentence has a length typical of CEFR ${level}. ` +
      "Each sentence follows logically from the one before. Use a connector only where " +
      "a native speaker would (mais, alors, parce que, quand…), not at the start of every sentence. " +
      "Use the tenses the story needs, and mix them when it does (e.g. imparfait for the " +
      "background, passé composé for the events): a paragraph is where the learner " +
      "practices tenses that follow each other." +
      sentenceVocabulary(level) +
      VARIETY +
      priority(false),
    sections: weakPointsSection(input),
  });
}
