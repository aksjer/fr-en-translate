// Generates a batch of exercises: the code picks the mode and the other
// settings of each one, and each mode has its own prompt in its own file.
import { commonMistakes } from "@/lib/common-mistakes";
import { generateSentences } from "@/lib/generate/sentence";
import { BATCH_SIZE, type Exercise, type GenerateInput } from "@/lib/generate/shared";
import { generateVerbs } from "@/lib/generate/verb";
import { generateWords } from "@/lib/generate/word";
import { pickCombination, type Combination } from "@/lib/settings";

export { generateInputSchema, type Exercise, type GenerateInput } from "@/lib/generate/shared";

const GENERATORS = {
  word: generateWords,
  verb: generateVerbs,
  sentence: generateSentences,
};

// One call gives BATCH_SIZE items of one mode, since each mode has its own
// prompt and fields; each item has its own other settings.
export function generateExercises(input: GenerateInput): Promise<Exercise[]> {
  // The last answered sentence, if wrong, gets one retest: none if it was a
  // retest itself or if a retest came after it, even one left unanswered. A
  // retest the model couldn't write leaves a mark on the batch's first item:
  // the wrong sentence before it is still due, whatever came after.
  const sentences = (input.history ?? []).filter((item) => item.mode === "sentence");
  const lastIndex = sentences.findLastIndex((item) => item.ok !== undefined);
  const wrongIndex = sentences.findLastIndex((item) => item.ok === false);
  const missed = sentences.findLastIndex((item) => item.retestMissed);
  const dueIndex = wrongIndex === lastIndex || missed > wrongIndex ? wrongIndex : -1;
  const last = sentences[dueIndex];
  const retested = sentences.slice(dueIndex).some((item) => item.retest);
  const retest = last?.ok === false && !retested;
  // The page asks for a new batch right after a wrong sentence, so its retest
  // comes first, while the mistake is fresh, if the settings allow sentences.
  const sentenceAllowed = !input.modes?.length || input.modes.includes("sentence");
  const mistakes = commonMistakes(input.history ?? [], input.points?.mastered);
  const combinations: Combination[] = [
    pickCombination(
      input,
      retest
        ? {
            tense: last.tense,
            // A point answered right needs no retest: the mistake was elsewhere.
            point: last.pointResult === "right" ? undefined : last.point,
            mistake: last.remark,
          }
        : undefined,
      mistakes,
      [sentences.at(-1)?.point],
      retest && sentenceAllowed ? "sentence" : undefined,
    ),
  ];
  // The other items practice no retest, and never a habit another item has.
  while (combinations.length < BATCH_SIZE) {
    combinations.push(
      pickCombination(
        input,
        undefined,
        mistakes,
        [
          sentences.at(-1)?.point,
          ...combinations.map((combination) => combination.target?.right ?? combination.retestPoint),
        ],
        combinations[0].mode,
      ),
    );
  }
  return GENERATORS[combinations[0].mode](input, combinations);
}
