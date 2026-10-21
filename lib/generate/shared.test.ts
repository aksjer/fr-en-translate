// npm test. A point counts as used only when its own words, or forms of its
// verb, are in the reference.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inReference } from "@/lib/generate/shared";

test("a point's words may have a few words between them", () => {
  assert.ok(inReference("explain to me", "", "He explained the problem to me."));
  assert.ok(inReference("as soon as", "", "Call me as soon as you land."));
  assert.ok(inReference("keep", "", "She kept the money."));
});

test("the start of a longer word is not the point", () => {
  assert.ok(!inReference("may", "", "Maybe she left."));
  assert.ok(!inReference("ever", "", "Everyone left."));
  assert.ok(!inReference("for", "", "I forgot it."));
});
