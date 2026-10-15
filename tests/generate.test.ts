import assert from "node:assert/strict";
import test from "node:test";
import { generateExercise } from "@/lib/generate";
import { mockModel, promptText } from "./helpers";

const answer = {
  situation: "Two friends at a train station, late at night",
  text: "Ne rate pas ton train !",
  reference: "Don't miss your train!",
};

test("returns the item, its reference and the combination", async () => {
  const model = mockModel(answer);
  const exercise = await generateExercise(
    { modes: ["phrase"], levels: ["A2"], tenses: ["impératif"] },
    model,
  );
  assert.equal(exercise.text, answer.text);
  assert.equal(exercise.reference, answer.reference);
  assert.equal(exercise.mode, "phrase");
  assert.equal(exercise.level, "A2");
  assert.equal(exercise.tense, "impératif");
  assert.equal("situation" in exercise, false);
});

test("the impératif only uses tu, nous or vous", async () => {
  for (let i = 0; i < 20; i++) {
    const model = mockModel(answer);
    await generateExercise({ modes: ["phrase"], tenses: ["impératif"] }, model);
    assert.match(promptText(model), /the person "(tu|nous|vous)"/);
  }
});

test("sends the recent items to avoid", async () => {
  const model = mockModel(answer);
  await generateExercise({ modes: ["mot"], avoid: ["la pomme"] }, model);
  assert.match(promptText(model), /la pomme/);
});
