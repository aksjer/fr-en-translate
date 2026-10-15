// Generates one exercise: the code picks the mode and the other settings, and
// each mode has its own prompt in its own file.
import { generateParagraph } from "@/lib/generate/paragraph";
import { generatePhrasalVerb } from "@/lib/generate/phrasal-verb";
import { generateSentence } from "@/lib/generate/sentence";
import type { Exercise, GenerateInput } from "@/lib/generate/shared";
import { generateVerb } from "@/lib/generate/verb";
import { generateWord } from "@/lib/generate/word";
import { pickCombination } from "@/lib/settings";

export { generateInputSchema, type Exercise, type GenerateInput } from "@/lib/generate/shared";

const GENERATORS = {
  mot: generateWord,
  verbe: generateVerb,
  "phrasal verb": generatePhrasalVerb,
  phrase: generateSentence,
  paragraphe: generateParagraph,
};

export function generateExercise(input: GenerateInput): Promise<Exercise> {
  const combination = pickCombination(input);
  return GENERATORS[combination.mode](input, combination);
}
