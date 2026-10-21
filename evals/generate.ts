// The generation eval: asks Gemini in ONE request for 120 items covering every
// option, each combination twice (runs 1 and 2), with the app's own prompts
// (wordBatch, verbBatch, sentenceBatch) and its own code checks (each slot's
// check: the context holds the item, the point is in the reference, the verb
// type, new items only, a review keeps its French and English).
// Caveat: the app asks 3 items of one mode per request; here the model writes
// all of them at once and sees run 1 while it writes run 2, so the two runs
// are not fully independent, and a few items may differ from the app's.
import { z } from "zod";
import { sentenceBatch } from "@/lib/generate/sentence";
import {
  batchContext,
  GENERATE_ROLE,
  generateInputSchema,
  type BatchPlan,
  type Exercise,
  type GenerateInput,
} from "@/lib/generate/shared";
import { verbBatch } from "@/lib/generate/verb";
import { wordBatch } from "@/lib/generate/word";
import { isInvalidAnswer } from "@/lib/model";
import {
  sameText,
  SENTENCE_FOCUSES,
  TENSES,
  THEMES,
  VERB_TYPES,
  WORD_KINDS,
  type Effort,
  type Mode,
} from "@/lib/options";
import { focusWordsFor } from "@/lib/focus-words";
import type { Combination } from "@/lib/settings";
import {
  askAll,
  byAxis,
  CUT_OFF,
  instructionLabels,
  printSummary,
  tally,
  type Outcome,
} from "./shared";

const RUNS = 2;

// The app situations, each with the learner data it needs: fake but
// realistic history, known items and reviews.
const SPECIALS: Record<string, { input: unknown; combination: Combination }> = {
  "review of a missed word": {
    input: {
      history: [
        {
          mode: "word",
          text: "le reçu",
          english: "receipt",
          context: "Gardez bien le reçu en cas de problème.",
          answer: "recipe",
          ok: false,
          kind: "noun",
        },
      ],
      review: {
        word: [
          {
            text: "le reçu",
            english: "receipt",
            reference: "receipt",
            context: "Gardez bien le reçu en cas de problème.",
            kind: "noun",
            misses: 1,
            today: true,
          },
        ],
      },
    },
    combination: { mode: "word", kind: "adjective", theme: "daily life" },
  },
  "review of a missed verb": {
    input: {
      history: [
        {
          mode: "verb",
          text: "plier",
          english: "fold",
          context: "Plie tes vêtements avant de les ranger.",
          answer: "bend",
          ok: false,
          verbType: "regular",
        },
      ],
      review: {
        verb: [
          {
            text: "plier",
            english: "fold",
            forms: ["fold", "folded", "folded"],
            context: "Plie tes vêtements avant de les ranger.",
            misses: 1,
            today: true,
          },
        ],
      },
    },
    combination: { mode: "verb", verbType: "irregular", theme: "daily life" },
  },
  "retest after a wrong sentence": {
    input: {
      history: [
        {
          mode: "sentence",
          text: "Je t'appellerai quand je serai rentré à la maison.",
          tense: "future",
          reference: "I'll call you when I get home.",
          point: "when",
          answer: "I'll call you when I will be home.",
          ok: false,
          pointResult: "wrong",
          remark: "« when I will be home » → « when I get home » : après when, le présent.",
          mistakes: [
            {
              remark: "« when I will be home » → « when I get home » : après when, le présent.",
              tag: "tense",
            },
          ],
        },
      ],
    },
    combination: { mode: "sentence", tense: "future", retest: true, retestPoint: "when", theme: "work" },
  },
  "habit target": {
    input: {
      history: [
        ["Tu peux m'expliquer le problème ?", "Can you explain me the problem?"],
        ["Il m'a expliqué la règle du jeu.", "He explained me the rules of the game."],
        ["Explique-moi comment ça marche.", "Explain me how it works."],
      ].map(([text, answer]) => ({
        mode: "sentence",
        text,
        answer,
        ok: false,
        mistakes: [
          { remark: "« explain me » → « explain to me » : explain se construit avec to.", tag: "preposition" },
        ],
      })),
    },
    combination: {
      mode: "sentence",
      tense: "past",
      theme: "work",
      target: { wrong: "explain me", right: "explain to me", tag: "preposition", count: 3 },
    },
  },
  "known words to avoid": {
    input: {
      known: {
        word: (
          "time, people, way, day, thing, life, child, world, school, family, student, " +
          "country, problem, hand, place, week, company, question, job, money, night, home, " +
          "water, room, mother, father, story, month, book, friend, house, car, city, team, " +
          "idea, kid, door, health, person, party, morning, reason, girl, guy, teacher, " +
          "doctor, phone, food, dinner, lunch, breakfast, coffee, meal, dish, cup, glass, " +
          "plate, fork, knife, spoon, table, chair, bed, window, street, store, price, bag"
        ).split(", "),
      },
    },
    combination: { mode: "word", kind: "noun", theme: "daily life" },
  },
  "known verbs to avoid": {
    input: {
      known: {
        verb: (
          "be, have, do, say, go, get, make, know, think, take, see, come, give, find, tell, " +
          "become, leave, feel, put, bring, begin, keep, hold, write, stand, hear, let, mean, " +
          "set, meet, run, pay, sit, speak, lie, lead, read, grow, lose, fall, send, build, " +
          "understand, break, spend, cut, drive, buy, wear, choose, throw, catch, win, " +
          "forget, sell, teach, eat, sleep, drink, fly, swim, ride, wake, hide, steal, fight, " +
          "feed, lend, shoot, hang, quit, bet"
        ).split(", "),
      },
    },
    combination: { mode: "verb", verbType: "irregular", theme: "travel" },
  },
};

// One group of items asked together, as one call of the app would ask them.
type Group = {
  name: string;
  input: GenerateInput;
  combinations: Combination[];
  // The label of each combination, the same in both runs.
  labels: string[];
  special?: string;
};

function groups(): Group[] {
  const base = generateInputSchema.parse({});
  const words = WORD_KINDS.flatMap((kind) =>
    (["travel", "food"] as const).map((theme): Combination => ({ mode: "word", kind, theme })),
  );
  const verbs = VERB_TYPES.flatMap((verbType) =>
    (["health", "technology", "family and friends"] as const).map(
      (theme): Combination => ({ mode: "verb", verbType, theme }),
    ),
  );
  // Each point gets a word that fits the tense, as the app picks it, but in
  // turn rather than at random, so both runs ask the same; a point with no
  // word for the tense gives a sentence without one.
  const sentences = TENSES.flatMap((tense) =>
    [...SENTENCE_FOCUSES, undefined].map((focus) => ({ tense, focus })),
  ).map(({ tense, focus }, index): Combination => {
    const words = focus ? focusWordsFor(focus, tense) : [];
    const focusWord = words[index % Math.max(words.length, 1)];
    return {
      mode: "sentence",
      tense,
      ...(focus && focusWord && { focus, focusWord }),
      theme: THEMES[index % THEMES.length],
    };
  });
  const asked = TENSES.flatMap(() => [...SENTENCE_FOCUSES, undefined]);
  const label = (combination: Combination, asked?: string) =>
    [
      combination.mode,
      combination.kind,
      combination.verbType,
      combination.tense,
      combination.mode === "sentence" &&
        (combination.focusWord
          ? `focus ${combination.focus} « ${combination.focusWord} »`
          : asked
            ? `focus ${asked} (no word fits the tense)`
            : "focus none"),
      combination.theme,
    ]
      .filter(Boolean)
      .join(", ");
  return [
    { name: "words", input: base, combinations: words, labels: words.map((combination) => label(combination)) },
    { name: "verbs", input: base, combinations: verbs, labels: verbs.map((combination) => label(combination)) },
    {
      name: "sentences",
      input: base,
      combinations: sentences,
      labels: sentences.map((combination, index) => label(combination, asked[index])),
    },
    ...Object.entries(SPECIALS).map(([name, special]) => ({
      name,
      input: generateInputSchema.parse(special.input),
      combinations: [special.combination],
      labels: [name],
      special: name,
    })),
  ];
}

// The call of a group, built by the app's own code for its mode.
function plan(group: Group): BatchPlan<unknown> {
  const builders = { word: wordBatch, verb: verbBatch, sentence: sentenceBatch };
  const mode = group.combinations[0].mode;
  return builders[mode](group.input, group.combinations) as BatchPlan<unknown>;
}

// The examples the prompts give, which the model must never hand back as an
// item, a context or a sentence: the texts quoted in « », and those in
// parentheses, each side of an arrow (j'habite ici depuis 2010 → I have
// lived here since 2010).
const exampleKey = (text: string) => sameText(text).replace(/[.!?]+$/, "").trim();

function promptExamples(text: string) {
  const quoted = [...text.matchAll(/«\s*([^»]+?)\s*»/g)].map((match) => match[1]);
  const inParentheses = [...text.matchAll(/\(([^()]+)\)/g)].flatMap((match) =>
    match[1].split(/;|→/).map((part) => part.replace(/^\s*e\.g\.\s*/, "")),
  );
  return new Set([...quoted, ...inParentheses].map(exampleKey).filter(Boolean));
}

// Whether an exercise copies one of the prompt's examples. A review gives its
// own item back, which its task quotes: only its context counts.
function copiedExample(exercise: Exercise, examples: Set<string>) {
  const texts = [
    ...(exercise.review ? [] : [exercise.text]),
    exercise.context,
    exercise.mode === "sentence" ? exercise.reference : undefined,
  ];
  return texts.find((text) => text && examples.has(exampleKey(text)));
}

export async function runGeneration(effort: Effort) {
  // Each run builds its own calls, so a run doesn't count the other's items
  // as already given.
  const planned = groups();
  const cases = Array.from({ length: RUNS }, (_, run) =>
    planned.flatMap((group) => {
      const { batch } = plan(group);
      return batch.slots.map((slot, index) => ({
        run: run + 1,
        group,
        batch,
        slot,
        combination: group.combinations[index],
        label: group.labels[index],
      }));
    }),
  ).flat();
  const instructions = (item: (typeof cases)[number]) =>
    [
      `## Fields of each item (mode ${item.batch.mode})`,
      ...item.batch.fields,
      "",
      batchContext(item.batch.mode),
    ].join("\n") + item.batch.sections;
  const { distinct, label } = instructionLabels(cases.map(instructions));
  const examples = promptExamples(
    [...distinct, ...cases.map((item) => item.slot.task)].join("\n"),
  );

  // Each mode's items have their own fields: the answer has a list per mode.
  const schemaOf = (mode: Mode) =>
    z.object({ case: z.number(), item: cases.find((item) => item.batch.mode === mode)!.batch.schema });
  const lists = { word: schemaOf("word"), verb: schemaOf("verb"), sentence: schemaOf("sentence") };
  const { answers, cutOff, problem } = await askAll(
    lists,
    {
      system: [
        ...GENERATE_ROLE,
        "",
        `You write the items of ${cases.length} tasks in one go. Each task names the`,
        "instructions it follows: they give the fields of its item and what you know about",
        "the learner. Write each item on its own, exactly as its instructions and task say.",
        "Return, in the list of the task's mode (word, verb or sentence), one entry per",
        "task, in order, with case (the task's number) and item (its fields).",
      ].join("\n"),
      prompt: [
        ...distinct.map((text) => `# Instructions ${label(text)}\n\n${text}`),
        ...cases.map(
          (item, index) =>
            `# Task ${index + 1} (instructions ${label(instructions(item))}, mode ` +
            `${item.batch.mode})\n${item.slot.task}`,
        ),
      ].join("\n\n"),
    },
    effort,
  );
  const missingNote = cutOff ? CUT_OFF : "no answer for this task";

  // Each item gets the check of its own slot, in the order of its call, so
  // a word already given earlier in the same call counts as a repeat.
  const results = cases.map((item, index) => {
    const answer = answers[item.batch.mode].find((entry) => entry.case === index + 1);
    const failures: string[] = [];
    let exercise: Exercise | undefined;
    if (answer) {
      try {
        exercise = item.slot.check(answer.item, false);
      } catch (error) {
        if (!isInvalidAnswer(error)) throw error;
        failures.push((error as Error).message);
      }
      const copy = exercise && copiedExample(exercise, examples);
      if (copy) failures.push(`copies a prompt example: « ${copy} »`);
    }
    const outcome: Outcome = !answer ? "invalid" : failures.length ? "fail" : "pass";
    const { combination } = item;
    return {
      case: index + 1,
      run: item.run,
      combination: item.label,
      mode: combination.mode,
      kind: combination.kind,
      verbType: combination.verbType,
      tense: combination.tense,
      focus:
        combination.mode === "sentence" && !item.group.special
          ? (combination.focus ?? "none")
          : undefined,
      focusWord: combination.focusWord,
      special: item.group.special,
      outcome,
      invalidNote: answer ? undefined : missingNote,
      failures,
      // No standard check tells an English tense from a sentence: the asked
      // tense and the reference are shown for a person to check.
      tenseToReview:
        exercise && combination.tense ? { asked: combination.tense, reference: exercise.reference } : undefined,
      exercise: exercise ?? null,
      model: answer?.item ?? null,
    };
  });

  for (const row of results) {
    const what = row.exercise
      ? `« ${row.exercise.text} » → ${row.exercise.reference}${row.exercise.point ? ` [${row.exercise.point}]` : ""}`
      : "";
    console.log(`${String(row.case).padEnd(5)}run ${row.run}  ${row.outcome.padEnd(8)}${row.combination}  ${what}`);
    if (row.invalidNote) console.log(`      invalid: ${row.invalidNote}`);
    for (const failure of row.failures) console.log(`      - ${failure}`);
  }

  // The two runs of each combination: consistent when both pass or both fail.
  const consistency = [...new Set(results.map((row) => row.combination))].map((combination) => {
    const runs = results.filter((row) => row.combination === combination);
    const outcomes = runs.map((row) => row.outcome);
    const verdict = outcomes.includes("invalid")
      ? "invalid"
      : outcomes.every((outcome) => outcome === "pass")
        ? "both pass"
        : outcomes.every((outcome) => outcome === "fail")
          ? "both fail"
          : "one fails";
    return {
      combination,
      verdict,
      items: runs.map((row) => (row.exercise ? `${row.exercise.text} → ${row.exercise.reference}` : null)),
      failures: runs.map((row) => row.failures),
    };
  });
  const verdicts = Object.fromEntries(
    ["both pass", "one fails", "both fail", "invalid"].map((verdict) => [
      verdict,
      consistency.filter((row) => row.verdict === verdict).length,
    ]),
  );

  const summary = {
    mode: byAxis(results, (row) => row.mode),
    kind: byAxis(results, (row) => row.kind),
    "verb type": byAxis(results, (row) => row.verbType),
    tense: byAxis(results, (row) => (row.special ? undefined : row.tense)),
    focus: byAxis(results, (row) => row.focus),
    special: byAxis(results, (row) => row.special),
    run: byAxis(results, (row) => `run ${row.run}`),
  };
  printSummary("Generation", summary);
  console.log("Generation, the two runs of each combination:");
  console.table(verdicts);
  const total = tally(results.map((row) => row.outcome));
  console.log(
    `Generation: ${total.pass}/${total.cases} items pass the checks, ${total.fail} fail, ` +
      `${total.invalid} invalid outputs (effort ${effort})\n`,
  );
  const failures = results
    .filter((row) => row.outcome !== "pass")
    .map((row) => ({
      case: row.case,
      run: row.run,
      combination: row.combination,
      outcome: row.outcome,
      reasons: row.invalidNote ? [row.invalidNote] : row.failures,
      item: row.exercise ?? row.model,
    }));
  return {
    cutOff,
    problem,
    total,
    summary,
    runs: { verdicts, combinations: consistency },
    failures,
    tensesToReview: results.flatMap((row) =>
      row.tenseToReview ? [{ case: row.case, ...row.tenseToReview }] : [],
    ),
    results,
  };
}

