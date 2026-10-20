// Generates one exercise: the code picks the mode and the other settings, and
// each mode has its own prompt in its own file.
import { generateSentence } from "@/lib/generate/sentence";
import type { Exercise, GenerateInput } from "@/lib/generate/shared";
import { generateVerb } from "@/lib/generate/verb";
import { generateWord } from "@/lib/generate/word";
import { pickCombination } from "@/lib/settings";

export { generateInputSchema, type Exercise, type GenerateInput } from "@/lib/generate/shared";

const GENERATORS = {
  word: generateWord,
  verb: generateVerb,
  sentence: generateSentence,
};

export function generateExercise(input: GenerateInput): Promise<Exercise> {
  // The last answered sentence, if wrong, gets one retest: none if it was a
  // retest itself or if a retest came after it, even one left unanswered.
  const sentences = (input.history ?? []).filter((item) => item.mode === "sentence");
  const lastIndex = sentences.findLastIndex((item) => item.ok !== undefined);
  const last = sentences[lastIndex];
  const retested = sentences.slice(lastIndex).some((item) => item.retest);
  const combination = pickCombination(
    input,
    last?.ok === false && !retested ? { tense: last.tense } : undefined,
  );
  return GENERATORS[combination.mode](input, combination);
}
