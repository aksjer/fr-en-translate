import assert from "node:assert/strict";
import test from "node:test";
import { LEVELS } from "@/lib/options";
import { frenchOf, verbForms, verbsFor } from "@/lib/verbs";

test("every irregular verb has its own past forms", () => {
  for (const level of LEVELS) {
    for (const verb of verbsFor("irrégulier", level)) {
      const [, past, participle] = verbForms(verb);
      const regular = verb.endsWith("e") ? `${verb}d` : `${verb}ed`;
      assert.ok(past !== regular || participle !== regular, verb);
    }
  }
  assert.deepEqual(verbForms("wear"), ["wear", "wore", "worn"]);
  assert.deepEqual(verbForms("get"), ["get", "got", "gotten"]);
});

test("regular verbs follow American spelling", () => {
  const pasts = {
    travel: "traveled",
    try: "tried",
    obey: "obeyed",
    convey: "conveyed",
    breathe: "breathed",
    regret: "regretted",
    deter: "deterred",
    apologize: "apologized",
  };
  for (const [verb, past] of Object.entries(pasts)) {
    assert.deepEqual(verbForms(verb), [verb, past, past]);
  }
  for (const level of LEVELS) {
    for (const verb of verbsFor("régulier", level)) {
      assert.match(verbForms(verb)[1], /ed$/, verb);
    }
  }
});

test("every verb has its own French", () => {
  const seen = new Map<string, string>();
  for (const level of LEVELS) {
    for (const verbType of ["régulier", "irrégulier"] as const) {
      for (const verb of verbsFor(verbType, level)) {
        const french = frenchOf(verb);
        assert.ok(french, verb);
        const other = seen.get(french);
        assert.ok(!other || other === verb, `${verb} and ${other}: ${french}`);
        seen.set(french, verb);
      }
    }
  }
});
