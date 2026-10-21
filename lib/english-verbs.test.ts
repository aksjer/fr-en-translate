// npm test. The focus words and the tense check must agree: a sentence that
// uses a word in a tense the table allows, in its natural form, has that
// tense's form, or the batch would lose every such item.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hasTenseForm, verbForms } from "@/lib/english-verbs";
import { focusWordsFor } from "@/lib/focus-words";
import { SENTENCE_FOCUSES, TENSES, type Tense } from "@/lib/options";

// A modal is the verb of its sentence, so it has its own sentences.
const MODAL_SENTENCES: Record<string, Partial<Record<Tense, string>>> = {
  can: { present: "I can swim." },
  could: { past: "She could not open the door.", conditional: "We could go tomorrow." },
  should: { present: "You should call him.", conditional: "You should call him." },
  must: { present: "You must stop here." },
  might: {
    present: "He might be at home.",
    future: "It might rain tomorrow.",
    conditional: "It might rain if the wind turns.",
  },
  may: { present: "You may sit here.", future: "It may rain tomorrow." },
  "have to": { present: "I have to work today." },
  "had to": { past: "I had to leave early." },
  "has had to": { "present perfect": "She has had to move twice." },
  "will have to": { future: "We'll have to wait." },
  "would have to": { conditional: "You'd have to ask him." },
  "was able to": { past: "He was able to fix it." },
  "has been able to": { "present perfect": "She hasn't been able to sleep." },
  "had been able to": { "past perfect": "He had been able to save some money." },
  "will be able to": { future: "You will be able to see it." },
  "would be able to": { conditional: "I would be able to help." },
  "should have": { past: "You should have seen it." },
  "must have": { past: "He must have forgotten." },
  "had better": { present: "You'd better hurry." },
  "would rather": { present: "I'd rather stay.", conditional: "I would rather stay home." },
};

// Any other point leaves the verb to the tense.
const CLAUSES: Record<Tense, string> = {
  present: "I work there",
  past: "I worked there",
  "present perfect": "I've worked there",
  "past perfect": "I had worked there",
  future: "I will work there",
  conditional: "I would work there",
};

test("every focus word passes the tense check in each tense it is given", () => {
  for (const focus of SENTENCE_FOCUSES) {
    for (const tense of TENSES) {
      for (const word of focusWordsFor(focus, tense)) {
        const sentence =
          focus === "modal" ? MODAL_SENTENCES[word]?.[tense] : `${CLAUSES[tense]} ${word} it.`;
        assert.ok(sentence, `no sentence for « ${word} » in the ${tense}`);
        assert.ok(hasTenseForm(sentence, tense), `« ${sentence} » fails the ${tense}`);
      }
    }
  }
});

test("the tense check tells the tenses apart", () => {
  const cases: [string, Tense, boolean][] = [
    ["I've lived here for five years.", "present perfect", true],
    ["Have you ever seen it?", "present perfect", true],
    ["I had to leave early.", "present perfect", false],
    ["I had to leave early.", "past perfect", false],
    ["She's nice.", "present perfect", false],
    ["I lost my keys.", "present perfect", false],
    ["I'd finished my work.", "past perfect", true],
    ["I'd finished my work.", "conditional", false],
    ["I'd go if I could.", "conditional", true],
    ["I'd been there before.", "conditional", false],
    // A base that is also a participle: would or had, so both tenses.
    ["I'd come with you.", "conditional", true],
    ["I'd come with you.", "past perfect", true],
    ["I'd put it away.", "conditional", true],
    ["I'd run home.", "conditional", true],
    ["I'd read it later.", "conditional", true],
    ["It snows.", "future", false],
    ["I go home.", "past", false],
  ];
  for (const [sentence, tense, expected] of cases) {
    assert.equal(hasTenseForm(sentence, tense), expected, `« ${sentence} » in the ${tense}`);
  }
});

test("verb forms cover regular, doubled and irregular verbs", () => {
  assert.ok(verbForms("explain").has("explained"));
  assert.ok(verbForms("stop").has("stopped"));
  assert.ok(verbForms("keep").has("kept"));
  assert.ok(!verbForms("may").has("maybe"));
});
