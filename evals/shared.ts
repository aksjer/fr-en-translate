// What both evals share: one request at Gemini's output cap that survives a
// cut-off answer, and the summaries of the results.
import { generateText, NoObjectGeneratedError, Output, parsePartialJson } from "ai";
import { z } from "zod";
import { model, thinking, withoutEntities } from "@/lib/model";
import type { Effort } from "@/lib/options";

// Gemini's limit of output tokens, thoughts included: each eval asks all its
// cases in one request, so it gets all of it.
const MAX_OUTPUT_TOKENS = 65_536;

export const CUT_OFF = "response cut off, output limit";

// The schema of one item of each list.
type Lists = Record<string, z.ZodTypeAny>;
type Answers<L extends Lists> = { [K in keyof L]: z.infer<L[K]>[] };

// Sends one request whose answer is a few lists of items, and returns the
// items that came back whole. A cut-off or malformed answer keeps its
// complete items instead of failing: the cases it leaves out are the
// caller's invalid ones.
export async function askAll<L extends Lists>(
  lists: L,
  request: { system: string; prompt: string },
  effort: Effort,
): Promise<{ answers: Answers<L>; cutOff: boolean; problem?: string }> {
  const schema = z.object(
    Object.fromEntries(Object.entries(lists).map(([key, item]) => [key, z.array(item)])),
  );
  const keep = (value: unknown) =>
    Object.fromEntries(
      Object.entries(lists).map(([key, item]) => {
        const list = (value as Record<string, unknown> | undefined)?.[key];
        const items = Array.isArray(list) ? list : [];
        return [key, items.flatMap((entry) => {
          const parsed = item.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        })];
      }),
    ) as Answers<L>;
  try {
    const { output } = await generateText({
      model,
      providerOptions: thinking(MAX_OUTPUT_TOKENS, effort).providerOptions,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 1,
      output: Output.object({ schema }),
      ...request,
    });
    return { answers: keep(withoutEntities(output)), cutOff: false };
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) throw error;
    const cutOff = error.finishReason === "length";
    const { value } = await parsePartialJson(error.text);
    const answers = keep(value ? withoutEntities(value) : undefined);
    const kept = Object.values(answers).reduce((sum, items) => sum + items.length, 0);
    const problem = `${cutOff ? "Response cut off at the output limit" : "Malformed response"}: ${kept} answers kept`;
    console.log(`${problem}.\n`);
    return { answers, cutOff, problem };
  }
}

// One row's outcome, counted in the summaries.
export type Outcome = "pass" | "fail" | "invalid";
export type Tally = { cases: number; pass: number; fail: number; invalid: number };

export function tally(outcomes: Outcome[]): Tally {
  return {
    cases: outcomes.length,
    pass: outcomes.filter((outcome) => outcome === "pass").length,
    fail: outcomes.filter((outcome) => outcome === "fail").length,
    invalid: outcomes.filter((outcome) => outcome === "invalid").length,
  };
}

// The rows grouped by the values an axis gives them (none leaves a row out
// of that axis), each value with its tally, in the order of first appearance.
export function byAxis<T extends { outcome: Outcome }>(
  rows: T[],
  axis: (row: T) => string | undefined,
) {
  const groups = new Map<string, Outcome[]>();
  for (const row of rows) {
    const value = axis(row);
    if (value !== undefined) groups.set(value, [...(groups.get(value) ?? []), row.outcome]);
  }
  return Object.fromEntries([...groups].map(([value, outcomes]) => [value, tally(outcomes)]));
}

// Prints each axis of a summary as a table.
export function printSummary(title: string, summary: Record<string, Record<string, Tally>>) {
  for (const [axis, values] of Object.entries(summary)) {
    console.log(`${title} by ${axis}:`);
    console.table(values);
  }
}

// One label per distinct instruction text, so cases that follow the same
// instructions share them and the prompt stays short.
export function instructionLabels(texts: string[]) {
  const distinct = [...new Set(texts)];
  return {
    distinct,
    label: (text: string) => String(distinct.indexOf(text) + 1),
  };
}
