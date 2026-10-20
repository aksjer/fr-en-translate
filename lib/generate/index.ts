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
  const lastSentence = (input.history ?? [])
    .filter((item) => item.mode === "sentence" && item.ok !== undefined)
    .at(-1);
  const combination = pickCombination(
    input,
    lastSentence?.ok === false && !lastSentence.retest
      ? { tense: lastSentence.tense }
      : undefined,
  );
  return GENERATORS[combination.mode](input, combination);
}
