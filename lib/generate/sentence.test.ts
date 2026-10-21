// npm test. A free sentence (no point picked by the code, no retest, no
// habit) has a learning point only when the learner's mistakes give the
// model one to choose.
import assert from "node:assert/strict";
import { test } from "node:test";
import { sentenceBatch } from "@/lib/generate/sentence";
import { generateInputSchema } from "@/lib/generate/shared";
import type { Combination } from "@/lib/settings";

const free: Combination = { mode: "sentence", tense: "past", theme: "cars and EVs" };
const answer = {
  situation: "A driver talks about a trip.",
  text: "La batterie a tenu longtemps.",
  reference: "The battery lasted a long time.",
  point: "receipt",
  pointInReference: "",
};

test("with nothing to choose from, a free sentence has no point", () => {
  const { batch } = sentenceBatch(generateInputSchema.parse({}), [free]);
  assert.match(batch.slots[0].task, /No learning point besides the tense/);
  const exercise = batch.slots[0].check(answer, false);
  assert.equal(exercise.point, undefined);
});

test("with a wrong recent sentence, the model picks the point and the code checks it", () => {
  const input = generateInputSchema.parse({
    history: [{ mode: "sentence", text: "Je suis venu hier.", answer: "I have come yesterday.", ok: false }],
  });
  const { batch } = sentenceBatch(input, [free]);
  assert.doesNotMatch(batch.slots[0].task, /No learning point/);
  assert.throws(() => batch.slots[0].check(answer, false), /doesn't use the point « receipt »/);
});
