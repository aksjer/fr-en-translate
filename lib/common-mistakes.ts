import type { ErrorTag } from "@/lib/error-tags";
import { pointName, type Mode, type SentenceFocus } from "@/lib/options";

// The learner's recurring mistakes in sentences: the same right form missed in
// several answers (« in » → « into » twice). Used in the browser (My progress)
// and on the server (the next sentences practice them), from the same history.

type HistoryLike = {
  mode?: Mode;
  ok?: boolean;
  tag?: string;
  remark?: string;
  mistakes?: { remark: string; tag: string }[];
};

export type CommonMistake = {
  // What the learner wrote the last time, and the right form.
  wrong: string;
  right: string;
  tag: string;
  // The answers that had it.
  count: number;
};

// A mistake must come back to be a habit.
const MIN_COUNT = 2;
// Longer right forms are one sentence's wording, not a habit.
const MAX_WORDS = 4;
// Spelling, punctuation and "anything else" can't be built into a sentence.
const SKIPPED_TAGS: string[] = ["spelling", "punctuation", "other"] satisfies ErrorTag[];
// The kinds of mistakes a sentence focus practices.
const FOCUS_OF_TAG: Partial<Record<ErrorTag, SentenceFocus>> = {
  preposition: "preposition",
  "word order": "adverb",
};

// Remarks start with « what the learner wrote » → « the right form ».
const PAIR = /«\s*([^»]+?)\s*»\s*→\s*«\s*([^»]+?)\s*»/;

function clean(text: string) {
  return text.replaceAll("**", "").replace(/\.{3}|…/g, " … ").replace(/\s+/g, " ").trim();
}

// The recurring mistakes, the most frequent first, then the most recent;
// those whose right form is a mastered point are left out.
export function commonMistakes(history: HistoryLike[], mastered: string[] = []) {
  const done = new Set(mastered.map(pointName));
  const found = new Map<string, CommonMistake & { last: number }>();
  history.forEach((item, index) => {
    if (item.mode !== "sentence" || item.ok !== false) return;
    const mistakes = item.mistakes?.length
      ? item.mistakes
      : item.remark
        ? [{ remark: item.remark, tag: item.tag ?? "other" }]
        : [];
    // Each answer counts once for a mistake.
    const keys = new Set<string>();
    for (const mistake of mistakes) {
      if (SKIPPED_TAGS.includes(mistake.tag)) continue;
      const pair = PAIR.exec(mistake.remark);
      if (!pair) continue;
      const [wrong, right] = [clean(pair[1]), clean(pair[2])];
      const key = pointName(right);
      if (!key || key === pointName(wrong) || key.split(" ").length > MAX_WORDS) continue;
      if (done.has(key) || keys.has(key)) continue;
      keys.add(key);
      const current = found.get(key);
      found.set(key, {
        wrong,
        right,
        tag: mistake.tag,
        count: (current?.count ?? 0) + 1,
        last: index,
      });
    }
  });
  return [...found.values()]
    .filter((mistake) => mistake.count >= MIN_COUNT)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .map(({ wrong, right, tag, count }): CommonMistake => ({ wrong, right, tag, count }));
}

// How often each sentence focus should come, from the learner's mistakes: a
// focus that matches their habits comes more often.
export function focusWeights(mistakes: CommonMistake[]) {
  const weights = new Map<SentenceFocus, number>();
  for (const mistake of mistakes) {
    const focus = FOCUS_OF_TAG[mistake.tag as ErrorTag];
    if (focus) weights.set(focus, (weights.get(focus) ?? 0) + mistake.count);
  }
  return weights;
}
