// The correction eval: grades every case of correction-cases.json with Gemini
// in ONE request, with the app's own correction prompts (correctionRequest)
// and its own code checks after the model (finishCorrection), so each verdict
// is the one the page would show.
// Caveat: the app grades one answer per request; here the model reads all the
// cases at once, which can change a few verdicts. A mismatch is worth
// checking in the app before changing a prompt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  correctInputSchema,
  correctionRequest,
  finishCorrection,
  pointCorrectionSchema,
  wordCorrectionSchema,
} from "@/lib/correct";
import {
  MODES,
  SENTENCE_FOCUSES,
  TENSES,
  WORD_KINDS,
  type Effort,
} from "@/lib/options";
import {
  askAll,
  byAxis,
  CUT_OFF,
  instructionLabels,
  printSummary,
  tally,
  type Outcome,
} from "./shared";

// The kind of mistake (or of good variant) a case tests, for the summary.
const CATEGORIES = [
  "false friend",
  "meaning/word choice",
  "spelling",
  "grammar form",
  "article",
  "preposition",
  "tense",
  "modal",
  "word order",
  "countable/uncountable",
  "collocation",
  "phrasal/verb pattern",
  "register/US vs UK",
  "natural paraphrase",
  "format",
] as const;

// The app situation a case comes from: a missed word given again, a
// sentence retesting the point just missed, or one practicing a habit.
const SITUATIONS = ["review", "retest", "habit"] as const;

const caseSchema = z.object({
  mode: z.enum(MODES),
  text: z.string(),
  context: z.string().optional(),
  reference: z.string(),
  // A verb whose past or participle isn't the -ed form.
  irregular: z.boolean().optional(),
  tense: z.enum(TENSES).optional(),
  kind: z.enum(WORD_KINDS).optional(),
  focus: z.enum(SENTENCE_FOCUSES).optional(),
  point: z.string().optional(),
  situation: z.enum(SITUATIONS).optional(),
  pastMistakes: correctInputSchema.shape.pastMistakes,
  answer: z.string(),
  expected: z.enum(["right", "wrong"]),
  category: z.enum(CATEGORIES),
  note: z.string(),
});

type Case = z.infer<typeof caseSchema>;

// A verb with a particle or preposition after it (count on, throw away).
const withPreposition = (item: Case) =>
  item.mode === "verb" &&
  /^to \w+ (on|for|at|about|of|to|with|in|up|out|off|away|into|from|after|down|back)\b/.test(
    item.reference,
  );

// The least each value must have, so the cases cover every option; the eval
// stops before any request if one falls short.
function coverageGaps(cases: Case[]) {
  const count = (test: (item: Case) => boolean) => cases.filter(test).length;
  const sentences = cases.filter((item) => item.mode === "sentence");
  const rules: [string, number, number][] = [
    ...WORD_KINDS.map((kind): [string, number, number] => [
      `word kind ${kind}`,
      count((item) => item.mode === "word" && item.kind === kind),
      6,
    ]),
    ["regular verbs", count((item) => item.mode === "verb" && !item.irregular), 10],
    ["irregular verbs", count((item) => item.mode === "verb" && Boolean(item.irregular)), 10],
    ["verbs + preposition", count(withPreposition), 6],
    ...TENSES.map((tense): [string, number, number] => [
      `sentences in the ${tense}`,
      sentences.filter((item) => item.tense === tense).length,
      8,
    ]),
    ...SENTENCE_FOCUSES.map((focus): [string, number, number] => [
      `sentences with focus ${focus} and a point`,
      sentences.filter((item) => item.focus === focus && item.point).length,
      6,
    ]),
    ...CATEGORIES.map((category): [string, number, number] => [
      `category ${category}`,
      count((item) => item.category === category),
      6,
    ]),
    ["expected right", count((item) => item.expected === "right"), Math.ceil(cases.length * 0.4)],
    ["expected wrong", count((item) => item.expected === "wrong"), Math.ceil(cases.length * 0.4)],
    ["cases with past mistakes", count((item) => Boolean(item.pastMistakes?.length)), 10],
    ["review items", count((item) => item.situation === "review"), 8],
    [
      "retests or habits with their point",
      count((item) => (item.situation === "retest" || item.situation === "habit") && Boolean(item.point)),
      8,
    ],
  ];
  return rules
    .filter(([, has, least]) => has < least)
    .map(([name, has, least]) => `${name}: ${has} (at least ${least})`);
}

// One answer per case: the fields of every mode, those a case's instructions
// don't list left empty (pointResult is ignored for a case with no point).
const itemSchema = wordCorrectionSchema.extend({
  case: z.number(),
  alternative: z.string(),
  pointResult: pointCorrectionSchema.shape.pointResult,
});

export function readCases() {
  const cases = z
    .array(caseSchema)
    .parse(JSON.parse(readFileSync(join(__dirname, "correction-cases.json"), "utf8")));
  const gaps = coverageGaps(cases);
  if (gaps.length) {
    throw new Error(`correction-cases.json doesn't cover every option:\n- ${gaps.join("\n- ")}`);
  }
  return cases;
}

export async function runCorrection(effort: Effort) {
  const cases = readCases();
  const inputs = cases.map((item) => correctInputSchema.parse({ ...item, translation: item.answer }));
  const requests = inputs.map(correctionRequest);
  const { distinct, label } = instructionLabels(requests.map((request) => request.system));

  const { answers, cutOff, problem } = await askAll(
    { items: itemSchema },
    {
      system:
        `You grade ${cases.length} answers of learners in one go. Each case names the ` +
        "instructions it follows: grade each case on its own, exactly as they say. Return " +
        "items, one per case in order, with case (its number) and the fields its " +
        "instructions list; leave the fields they don't list empty.",
      prompt: [
        ...distinct.map((system) => `# Instructions ${label(system)}\n\n${system}`),
        ...requests.map(
          (request, index) =>
            `# Case ${index + 1} (instructions ${label(request.system)})\n${request.prompt}`,
        ),
      ].join("\n\n"),
    },
    effort,
  );
  const missingNote = cutOff ? CUT_OFF : "no answer for this case";

  const results = cases.map((item, index) => {
    const answer = answers.items.find((candidate) => candidate.case === index + 1);
    // An empty correction is what the app would ask again instead of showing:
    // counted apart, since the eval makes no second request.
    const invalidNote = !answer
      ? missingNote
      : !answer.correction.trim()
        ? "empty correction (the app would retry)"
        : undefined;
    const correction = answer && !invalidNote ? finishCorrection(inputs[index], answer) : undefined;
    const got = invalidNote ? "invalid" : correction?.isCorrect ? "right" : "wrong";
    const outcome: Outcome = invalidNote ? "invalid" : got === item.expected ? "pass" : "fail";
    return { case: index + 1, ...item, got, outcome, invalidNote, model: answer ?? null, result: correction ?? null };
  });

  console.log("case  mode      expected  got     category / note");
  for (const row of results) {
    console.log(
      `${String(row.case).padEnd(6)}${row.mode.padEnd(10)}${row.expected.padEnd(10)}` +
        `${row.got.padEnd(8)}${row.category} / ${row.note}`,
    );
    if (row.invalidNote) {
      console.log(`      invalid: ${row.invalidNote}`);
    } else if (row.outcome === "fail") {
      console.log(`      « ${row.answer} » → ${row.result?.correction ?? "no answer"}`);
      for (const mistake of row.model?.mistakes ?? []) {
        console.log(`      - [correct ${mistake.nativeWouldCorrectIt}] ${mistake.remark}`);
      }
    }
  }

  const summary = {
    mode: byAxis(results, (row) => row.mode),
    category: byAxis(results, (row) => row.category),
    kind: byAxis(results, (row) => row.kind),
    verb: byAxis(results, (row) =>
      row.mode === "verb" ? (row.irregular ? "irregular" : "regular") : undefined,
    ),
    "verb pattern": byAxis(results, (row) => (withPreposition(row) ? "verb + preposition" : undefined)),
    tense: byAxis(results, (row) => row.tense),
    focus: byAxis(results, (row) => (row.mode === "sentence" ? (row.focus ?? "none") : undefined)),
    situation: byAxis(results, (row) => row.situation),
    "past mistakes": byAxis(results, (row) => (row.pastMistakes?.length ? "given" : "none")),
    expected: byAxis(results, (row) => row.expected),
  };
  printSummary("Correction", summary);
  const total = tally(results.map((row) => row.outcome));
  console.log(
    `Correction: ${total.pass}/${total.cases} verdicts match, ${total.fail} mismatches, ` +
      `${total.invalid} invalid outputs (effort ${effort})\n`,
  );
  const mismatches = results
    .filter((row) => row.outcome === "fail")
    .map((row) => ({
      case: row.case,
      category: row.category,
      answer: row.answer,
      expected: row.expected,
      got: row.got,
      remarks: (row.model?.mistakes ?? []).map((mistake) => ({
        remark: mistake.remark,
        nativeWouldCorrectIt: mistake.nativeWouldCorrectIt,
      })),
    }));
  return { cutOff, problem, total, summary, mismatches, results };
}
