// A small eval of the two prompts, one request each: a few generated batches
// to read, then the correction of every case in cases.json.
// Run with `npm run eval` (GEMINI_API_KEY in .env.local).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { correctTranslation } from "@/lib/correct";
import { BATCH_SIZE, generateExercises, generateInputSchema } from "@/lib/generate";
import type { Mode } from "@/lib/options";

const GENERATIONS = 21;

type Case = { mode: Mode; french: string; reference: string; answer: string; right: boolean };

async function main() {
  console.log("Generation");
  for (let call = 0; call < Math.ceil(GENERATIONS / BATCH_SIZE); call++) {
    try {
      for (const item of await generateExercises(generateInputSchema.parse({}))) {
        const settings = [item.mode, item.kind, item.verbType, item.tense, item.theme];
        console.log(`  [${settings.filter(Boolean).join(", ")}] ${item.text} → ${item.reference}`);
        if (item.context) console.log(`      ${item.context}`);
      }
    } catch (error) {
      console.log(`  failed: ${(error as Error).message}`);
    }
  }

  const cases: Case[] = JSON.parse(readFileSync(join(__dirname, "cases.json"), "utf8"));
  console.log("\nCorrection");
  let passed = 0;
  for (const test of cases) {
    try {
      const result = await correctTranslation({
        mode: test.mode,
        text: test.french,
        reference: test.reference,
        translation: test.answer,
      });
      const ok = result.right === test.right;
      if (ok) passed++;
      console.log(
        `  ${ok ? "✓" : "✗"} ${test.answer} (${test.right ? "right" : "wrong"}) → ${result.correction}` +
          (result.explanation ? ` · ${result.explanation}` : ""),
      );
    } catch (error) {
      console.log(`  ✗ ${test.answer}: failed: ${(error as Error).message}`);
    }
  }
  console.log(`\n${passed}/${cases.length} corrections as expected`);
}

main();
