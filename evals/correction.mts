// Grades every case of correction-cases.json with Gemini in ONE request, to
// check the correction prompt at the cost of a single call:
//   npm run eval                  (effort low)
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
import { generateText, Output } from "ai";
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
  note: z.string(),
});

// One answer per case: the fields of every mode, those a case's instructions
// don't list left empty (pointResult is ignored for a case with no point).
const itemSchema = wordCorrectionSchema.extend({
  case: z.number(),
  alternative: z.string(),
  pointResult: pointCorrectionSchema.shape.pointResult,
});

const { values } = parseArgs({ options: { effort: { type: "string", default: "low" } } });
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

const { output } = await generateText({
  model,
  ...thinking("correct", effort, 600 * cases.length),
  maxRetries: 1,
  output: Output.object({ schema: z.object({ items: z.array(itemSchema) }) }),
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

const items = withoutEntities(output.items);
let matches = 0;
let invalid = 0;
const results: object[] = [];
console.log("case  mode      expected  got     note");
cases.forEach((item, index) => {
  const answer = items.find((candidate) => candidate.case === index + 1);
  // What the app would ask again instead of showing: counted apart, since the
  // eval makes no second request.
  const retried =
    !answer ||
    !answer.correction.trim() ||
    (answer.translated && !answer.right && !answer.mistakes.length);
  const correction = answer && finishCorrection(inputs[index], answer);
  const got = retried ? "invalid" : correction?.isCorrect ? "right" : "wrong";
  results.push({ case: index + 1, ...item, got, model: answer ?? null, result: correction ?? null });
  if (retried) invalid++;
  else if (got === item.expected) matches++;
  console.log(
    `${String(index + 1).padEnd(6)}${item.mode.padEnd(10)}${item.expected.padEnd(10)}` +
      `${got.padEnd(8)}${item.note}`,
  );
  if (retried) {
    console.log("      invalid output (the app would retry)");
  } else if (got !== item.expected) {
    console.log(`      « ${item.answer} » → ${correction?.correction ?? "no answer"}`);
    for (const remark of correction?.points ?? []) console.log(`      - ${remark}`);
  }
});
const mismatches = cases.length - matches - invalid;
console.log(
  `\n${matches}/${cases.length} verdicts match, ${mismatches} mismatches, ${invalid} invalid ` +
    `outputs (effort ${effort})`,
);
mkdirSync("evals/results", { recursive: true });
const file = `evals/results/${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}-${effort}.json`;
writeFileSync(
  file,
  JSON.stringify({ effort, model: model.modelId, matches, mismatches, invalid, results }, null, 2),
);
console.log(`Full results: ${file}`);
process.exitCode = matches === cases.length ? 0 : 1;
