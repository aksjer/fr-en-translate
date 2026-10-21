// Runs the evals, each in ONE request to Gemini, and writes their results to
// one file, evals/results/<date>-<effort>.json, to share or compare runs:
//   npm run eval                          (both, effort minimal as in the app)
//   npm run eval -- --only generate       (or correct)
//   npm run eval -- --effort low
// It reads GEMINI_API_KEY from .env.local. Each eval sends the app's own
// prompts and applies its own code checks: see generate.ts and correct.ts,
// and their caveats.
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { model } from "@/lib/model";
import { EFFORTS } from "@/lib/options";
import { readCases, runCorrection } from "./correct";
import { runGeneration } from "./generate";

async function main() {
  const { values } = parseArgs({
    options: {
      effort: { type: "string", default: "minimal" },
      only: { type: "string" },
    },
  });
  const effort = z.enum(EFFORTS).parse(values.effort);
  const only = z.enum(["generate", "correct"]).optional().parse(values.only);
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing: put it in .env.local.");
    process.exitCode = 1;
    return;
  }
  // The cases are checked before any request, so a gap costs no call.
  if (only !== "generate") readCases();

  const generate = only === "correct" ? undefined : await runGeneration(effort);
  const correct = only === "generate" ? undefined : await runCorrection(effort);

  mkdirSync("evals/results", { recursive: true });
  const file = `evals/results/${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}-${effort}.json`;
  writeFileSync(file, JSON.stringify({ effort, model: model.modelId, generate, correct }, null, 2));
  console.log(`Full results: ${file}`);
  const sections = [generate, correct].filter((section) => section !== undefined);
  process.exitCode = sections.every((section) => section.total.pass === section.total.cases) ? 0 : 1;
}

// A plain script, not a module: the app's files load once, so their error
// classes are the same ones the evals test.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
