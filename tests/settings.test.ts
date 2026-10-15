import assert from "node:assert/strict";
import test from "node:test";
import { pickCombination } from "@/lib/settings";

test("fixed values win over the settings, except the theme", () => {
  const combination = pickCombination(
    { modes: ["mot"], levels: ["A1"], tenses: ["présent"], themes: ["travail"] },
    { mode: "phrase", level: "C1", tense: "imparfait" },
  );
  assert.deepEqual(combination, {
    mode: "phrase",
    level: "C1",
    tense: "imparfait",
    theme: "travail",
  });
});

test("a fixed value the mode doesn't use is dropped", () => {
  const combination = pickCombination({}, { mode: "mot", tense: "imparfait" });
  assert.equal(combination.tense, undefined);
});
