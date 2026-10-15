// Runs the real prompts on a model and prints the results, to compare a prompt or
// model change with the version before it. It calls the provider, so it needs the
// API key in .env.local and uses the free quota (about 70 calls).
//
//   npm run eval                                   both suites, default model
//   npm run eval -- --model openai/gpt-oss-120b    another model
//   npm run eval -- --only correct --case depuis   the correction cases whose id contains "depuis"
//   npm run eval -- --only generate --modes phrase --levels A2 --runs 5
import "./load-env";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { APICallError, RetryError } from "ai";
import { correctTranslation, type CorrectInput } from "@/lib/correct";
import { generateExercise } from "@/lib/generate";
import { apiKeyName } from "@/lib/model";
import { DEFAULT_MODEL, MODELS, type Model } from "@/lib/model-list";
import {
  LEVELS,
  MODES,
  SENTENCE_WORDS,
  type Level,
  type Mode,
} from "@/lib/options";

// One correction case: an answer and the score range a good teacher would give it.
type CorrectCase = Omit<CorrectInput, "model"> & {
  id: string;
  expected: [number, number];
  note: string;
};

// Words that only exist in English, to spot an item given in the wrong language.
const ENGLISH_WORDS = new Set([
  "the", "is", "are", "was", "were", "you", "and", "of", "with", "this", "that",
  "have", "has", "will", "would", "it", "to", "in", "my", "your", "they", "we", "i",
]);

function fail(text: string): never {
  console.error(text);
  process.exit(1);
}

function count(total: number, word: string) {
  return `${total} ${word}${total > 1 ? "s" : ""}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksEnglish(text: string) {
  return (text.toLowerCase().match(/[\p{L}']+/gu) ?? []).some((word) =>
    ENGLISH_WORDS.has(word),
  );
}

// The small words that make a verb a phrasal verb (give up, find out).
const PARTICLES =
  /\b(up|out|off|down|on|in|over|back|away|through|around|about|along|into|after|for|by|across|apart|ahead|forward)\b/i;

// The item without its article, to compare a French word with its translation.
function bareWord(text: string) {
  return normalize(text).replace(/^(le |la |l'|les |un |une |des |the |a |an )/, "");
}

// The most words a sentence or a paragraph should have at this level.
function maxWords(mode: Mode, level: Level) {
  const perSentence = Number(SENTENCE_WORDS[level].split(" to ")[1]);
  if (mode === "phrase") return perSentence;
  if (mode === "paragraphe") return 3 * perSentence;
}

function sentences(text: string) {
  return text.split(/[.!?…]+(?:\s|$)/).filter((part) => part.trim()).length;
}

function listOption<T extends string>(
  value: string,
  allowed: readonly T[],
  name: string,
): T[] {
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  const unknown = items.filter((item) => !allowed.includes(item as T));
  if (unknown.length) {
    fail(`Unknown ${name}: ${unknown.join(", ")}. Use: ${allowed.join(", ")}.`);
  }
  return items as T[];
}

// The free tiers allow few requests per minute: on a 429, wait a minute and try again.
async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const apiError = RetryError.isInstance(error) ? error.lastError : error;
      const limited =
        APICallError.isInstance(apiError) && apiError.statusCode === 429;
      if (!limited || attempt === 3) throw error;
      console.log("  Rate limit reached, waiting a minute…");
      await new Promise((resolve) => setTimeout(resolve, 60_000));
    }
  }
}

// Returns the number of cases out of their range or failed.
async function evalCorrect(model: Model, filter: string) {
  const cases = (
    JSON.parse(readFileSync("evals/correct.json", "utf8")) as CorrectCase[]
  ).filter((item) => item.id.includes(filter));
  console.log(`\nCorrection · ${model} · ${cases.length} cases\n`);

  let passed = 0;
  let errors = 0;
  for (const { id, expected, note, ...input } of cases) {
    const [min, max] = expected;
    try {
      const result = await withRetry(() =>
        correctTranslation({ ...input, model }),
      );
      const ok = result.score >= min && result.score <= max;
      if (ok) passed++;
      console.log(
        `${ok ? "✓" : "✗"} ${id.padEnd(28)} ${String(result.score).padStart(2)}  (expected ${min}-${max})`,
      );
      if (!ok) {
        console.log(`    ${note}`);
        for (const point of result.points) console.log(`    - ${point}`);
        console.log(`    correction: ${result.correction}`);
      }
    } catch (error) {
      errors++;
      console.log(`! ${id.padEnd(28)} ${message(error)}`);
    }
  }

  console.log(
    `\n${passed}/${cases.length} in the expected range` +
      (errors ? `, ${errors} failed` : ""),
  );
  return cases.length - passed;
}

// Prints every item, so a person can read them. Returns the number of failed calls.
async function evalGenerate(
  model: Model,
  modes: Mode[],
  levels: Level[],
  runs: number,
) {
  console.log(
    `\nGeneration · ${model} · ${count(modes.length, "mode")} × ` +
      `${count(levels.length, "level")} × ${count(runs, "run")}`,
  );

  let flagged = 0;
  let errors = 0;
  for (const mode of modes) {
    console.log(`\n${mode}`);
    // Like the page, each request avoids the items given before it.
    const seen: string[] = [];
    for (const level of levels) {
      for (let run = 0; run < runs; run++) {
        try {
          const exercise = await withRetry(() =>
            generateExercise({
              model,
              modes: [mode],
              levels: [level],
              avoid: seen.slice(-20).map((item) => item.slice(0, 80)),
            }),
          );
          const words = exercise.text.split(/\s+/).filter(Boolean).length;
          const limit = maxWords(mode, level);
          const flags = [
            seen.some((item) => normalize(item) === normalize(exercise.text)) &&
              "repeated",
            looksEnglish(exercise.text) && "English?",
            limit && words > limit && `${words} words (${limit} at most)`,
            // A word, verb or phrasal verb should never be a whole sentence.
            !limit && /[.!?]$/.test(exercise.text) && "a sentence?",
            mode === "paragraphe" &&
              sentences(exercise.text) !== 3 &&
              count(sentences(exercise.text), "sentence"),
            mode === "phrasal verb" &&
              !PARTICLES.test(exercise.reference) &&
              "no phrasal verb?",
            mode === "mot" &&
              bareWord(exercise.text) === bareWord(exercise.reference) &&
              "same word in English",
          ].filter(Boolean);
          if (flags.length) flagged++;
          seen.push(exercise.text);

          const tags = [level, exercise.tense, exercise.verbType, exercise.theme]
            .filter(Boolean)
            .join(" · ");
          console.log(`  [${tags}] ${exercise.text}`);
          console.log(
            `      → ${exercise.reference}` +
              (flags.length ? `   ⚠ ${flags.join(", ")}` : ""),
          );
        } catch (error) {
          errors++;
          console.log(`  ! ${level} ${message(error)}`);
        }
      }
    }
    if (mode === "phrase" || mode === "paragraphe") {
      // Sentences that keep starting the same way are the first sign of repetition.
      const firstWords = new Set(seen.map((item) => normalize(item).split(" ")[0]));
      console.log(`  ${firstWords.size} different first words out of ${seen.length}`);
    }
  }

  console.log(
    `\n${flagged} items to check` + (errors ? `, ${errors} failed` : ""),
  );
  return errors;
}

async function main() {
  const { values } = parseArgs({
    options: {
      model: { type: "string", default: DEFAULT_MODEL },
      only: { type: "string" },
      case: { type: "string", default: "" },
      modes: { type: "string", default: MODES.join(",") },
      levels: { type: "string", default: "A1,B1,C1" },
      runs: { type: "string", default: "2" },
    },
  });

  const [model] = listOption(values.model, MODELS, "model");
  if (!model) fail(`Use --model with one of: ${MODELS.join(", ")}.`);
  if (values.only && values.only !== "correct" && values.only !== "generate") {
    fail("Use --only correct or --only generate.");
  }
  const modes = listOption(values.modes, MODES, "mode");
  const levels = listOption(values.levels, LEVELS, "level");
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) fail("--runs must be a whole number.");

  const keyName = apiKeyName(model);
  if (!process.env[keyName]) fail(`Add ${keyName} to .env.local first.`);

  let failures = 0;
  if (values.only !== "generate") failures += await evalCorrect(model, values.case);
  if (values.only !== "correct") {
    failures += await evalGenerate(model, modes, levels, runs);
  }
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
