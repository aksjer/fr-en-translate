import assert from "node:assert/strict";
import test from "node:test";
import { generateExercise } from "@/lib/generate";
import { isInvalidAnswer } from "@/lib/model";
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

test("a review keeps the mode, level and tense of its mistake", async () => {
  const model = mockModel(answer);
  const exercise = await generateExercise(
    {
      modes: ["mot"],
      levels: ["A1"],
      review: {
        mode: "phrase",
        level: "B2",
        tense: "imparfait",
        correction: "When I was a child, I **lived** in Lyon.",
        remark: "« was living » → « lived » : un état passé se dit au simple past.",
        tag: "temps",
      },
    },
    model,
  );
  assert.equal(exercise.mode, "phrase");
  assert.equal(exercise.level, "B2");
  assert.equal(exercise.tense, "imparfait");
  assert.match(promptText(model), /un état passé se dit au simple past/);
});

test("an older mistake with no mode comes back as a sentence", async () => {
  const exercise = await generateExercise(
    { modes: ["mot"], review: { correction: "She **is** a nurse." } },
    mockModel(answer),
  );
  assert.equal(exercise.mode, "phrase");
});

test("an unusable answer is asked again once", async () => {
  const model = mockModel("not JSON", { ...answer, text: "  " }, answer);
  await assert.rejects(generateExercise({ modes: ["phrase"] }, model), (error) =>
    isInvalidAnswer(error),
  );
  assert.equal(model.doGenerateCalls.length, 2);

  const retried = mockModel("not JSON", answer);
  const exercise = await generateExercise({ modes: ["phrase"] }, retried);
  assert.equal(exercise.text, answer.text);
});

test("an item too long to correct is refused", async () => {
  const long = { ...answer, text: "Il pleut. ".repeat(150) };
  await assert.rejects(
    generateExercise({ modes: ["paragraphe"] }, mockModel(long)),
    (error) => isInvalidAnswer(error),
  );
});

test("the level is the learner's English level", async () => {
  const model = mockModel(answer);
  await generateExercise(
    { modes: ["phrase"], levels: ["B2"], tenses: ["présent"] },
    model,
  );
  const prompt = promptText(model);
  assert.match(prompt, /Their English level is CEFR B2: varied vocabulary; passive/);
  assert.match(prompt, /it has 12 to 20 words/);
  assert.match(prompt, /About this tense: action now/);
});
