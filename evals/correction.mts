// Grades every case of correction-cases.json with Gemini in ONE request, to
// check the correction prompt at the cost of a single call:
//   npm run eval                  (effort minimal, as in the app)
//   npm run eval -- --effort medium
// It also writes every case with the model's full answer to
// evals/results/<date>-<effort>.json, to share or compare runs.
// It reads GEMINI_API_KEY from .env.local, and sends the app's own correction
// prompts (correctionRequest) and applies its own code checks after the model
// (finishCorrection), so each verdict is the one the page would show.
// Caveat: the app grades one answer per request; here the model reads all the
// cases at once, which can change a few verdicts. A mismatch is worth
// checking in the app before changing a prompt.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { generateText, NoObjectGeneratedError, Output, parsePartialJson } from "ai";
import { z } from "zod";
import {
  correctInputSchema,
  correctionRequest,
  finishCorrection,
  pointCorrectionSchema,
  wordCorrectionSchema,
} from "@/lib/correct";
import { model, thinking, withoutEntities } from "@/lib/model";
import { EFFORTS, MODES, SENTENCE_FOCUSES, TENSES, WORD_KINDS } from "@/lib/options";

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

const caseSchema = z.object({
  mode: z.enum(MODES),
  text: z.string(),
  context: z.string().optional(),
  reference: z.string(),
  tense: z.enum(TENSES).optional(),
  kind: z.enum(WORD_KINDS).optional(),
  focus: z.enum(SENTENCE_FOCUSES).optional(),
  point: z.string().optional(),
  answer: z.string(),
  expected: z.enum(["right", "wrong"]),
  category: z.enum(CATEGORIES),
  note: z.string(),
});

// One answer per case: the fields of every mode, those a case's instructions
// don't list left empty (pointResult is ignored for a case with no point).
const itemSchema = wordCorrectionSchema.extend({
  case: z.number(),
  alternative: z.string(),
  pointResult: pointCorrectionSchema.shape.pointResult,
});

const { values } = parseArgs({ options: { effort: { type: "string", default: "minimal" } } });
const effort = z.enum(EFFORTS).parse(values.effort);
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing: put it in .env.local.");
  process.exit(1);
}

const cases = z
  .array(caseSchema)
  .parse(JSON.parse(readFileSync(new URL("./correction-cases.json", import.meta.url), "utf8")));
const inputs = cases.map((item) =>
  correctInputSchema.parse({ ...item, translation: item.answer }),
);
const requests = inputs.map(correctionRequest);

// Cases with the same instructions share them, so the prompt stays short.
const systems = [...new Set(requests.map((request) => request.system))];
const label = (system: string) => String.fromCharCode(65 + systems.indexOf(system));

// All the cases in one request, at Gemini's limit of 65,536 output tokens
// (thoughts included). Cases a cut-off answer leaves out count as invalid.
const MAX_OUTPUT_TOKENS = 65_536;
const answerSchema = z.object({ items: z.array(itemSchema) });

let answered: z.infer<typeof itemSchema>[];
let cutOff = false;
try {
  const { output } = await generateText({
    model,
    providerOptions: thinking(MAX_OUTPUT_TOKENS, effort).providerOptions,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    output: Output.object({ schema: answerSchema }),
    system:
      `You grade ${cases.length} answers of learners in one go. Each case names the ` +
      "instructions it follows: grade each case on its own, exactly as they say. Return " +
      "items, one per case in order, with case (its number) and the fields its " +
      "instructions list; leave the fields they don't list empty.",
    prompt: [
      ...systems.map((system) => `# Instructions ${label(system)}\n\n${system}`),
      ...requests.map(
        (request, index) =>
          `# Case ${index + 1} (instructions ${label(request.system)})\n${request.prompt}`,
      ),
    ].join("\n\n"),
  });
  answered = output.items;
} catch (error) {
  if (!NoObjectGeneratedError.isInstance(error)) throw error;
  // A cut-off or malformed answer: keep the complete items it holds.
  cutOff = error.finishReason === "length";
  const { value } = await parsePartialJson(error.text);
  const partial = z.object({ items: z.array(z.unknown()) }).safeParse(value);
  answered = (partial.success ? partial.data.items : []).flatMap((item) => {
    const parsed = itemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  console.log(
    `${cutOff ? "Response cut off at the output limit" : "Malformed response"}: ` +
      `${answered.length} answers kept.\n`,
  );
}
const missingNote = cutOff ? "response cut off, output limit" : "no answer for this case";

const items = withoutEntities(answered);
type Got = "right" | "wrong" | "invalid";
type Tally = { matches: number; mismatches: number; invalid: number };
const tally = (rows: { got: Got; expected: string }[]): Tally => ({
  matches: rows.filter((row) => row.got === row.expected).length,
  mismatches: rows.filter((row) => row.got !== "invalid" && row.got !== row.expected).length,
  invalid: rows.filter((row) => row.got === "invalid").length,
});

const results = cases.map((item, index) => {
  const answer = items.find((candidate) => candidate.case === index + 1);
  // An empty correction is what the app would ask again instead of showing:
  // counted apart, since the eval makes no second request.
  const invalidNote = !answer
    ? missingNote
    : !answer.correction.trim()
      ? "empty correction (the app would retry)"
      : undefined;
  const correction = answer && !invalidNote ? finishCorrection(inputs[index], answer) : undefined;
  const got: Got = invalidNote ? "invalid" : correction?.isCorrect ? "right" : "wrong";
  return {
    case: index + 1,
    ...item,
    got,
    invalidNote,
    model: answer ?? null,
    result: correction ?? null,
  };
});

console.log("case  mode      expected  got     category / note");
for (const row of results) {
  console.log(
    `${String(row.case).padEnd(6)}${row.mode.padEnd(10)}${row.expected.padEnd(10)}` +
      `${row.got.padEnd(8)}${row.category} / ${row.note}`,
  );
  if (row.invalidNote) {
    console.log(`      invalid: ${row.invalidNote}`);
  } else if (row.got !== row.expected) {
    console.log(`      « ${row.answer} » → ${row.result?.correction ?? "no answer"}`);
    for (const mistake of row.model?.mistakes ?? []) {
      console.log(`      - [correct ${mistake.nativeWouldCorrectIt}] ${mistake.remark}`);
    }
  }
}

const summary = (key: "mode" | "category", names: readonly string[]) =>
  Object.fromEntries(
    names.flatMap((name) => {
      const rows = results.filter((row) => row[key] === name);
      return rows.length ? [[name, { cases: rows.length, ...tally(rows) }]] : [];
    }),
  );
const byMode = summary("mode", MODES);
const byCategory = summary("category", CATEGORIES);
console.log("\nBy mode:");
console.table(byMode);
console.log("By category:");
console.table(byCategory);

const { matches, mismatches, invalid } = tally(results);
console.log(
  `${matches}/${cases.length} verdicts match, ${mismatches} mismatches, ${invalid} invalid ` +
    `outputs (effort ${effort})`,
);
const mismatchList = results
  .filter((row) => row.got !== "invalid" && row.got !== row.expected)
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
mkdirSync("evals/results", { recursive: true });
const file = `evals/results/${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}-${effort}.json`;
writeFileSync(
  file,
  JSON.stringify(
    {
      effort,
      model: model.modelId,
      cutOff,
      total: { cases: cases.length, matches, mismatches, invalid },
      byMode,
      byCategory,
      mismatches: mismatchList,
      results,
    },
    null,
    2,
  ),
);
console.log(`Full results: ${file}`);
process.exitCode = matches === cases.length ? 0 : 1;
