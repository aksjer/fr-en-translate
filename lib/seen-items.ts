import { MAX_KNOWN, type Mode } from "@/lib/options";

// The exercises shown to this learner and how they did, kept in this browser
// only. The last ones are sent to the API, so the model can vary its items and
// test a missed point again.

const STORAGE_KEY = "fr-en-translate:seen";
const MAX_STORED = 500;

// Items saved before the mode or the result was stored have none.
export type SeenItem = {
  text: string;
  mode?: Mode;
  // The English of a word, verb or phrasal verb.
  english?: string;
  // Right or wrong; none if the item wasn't answered.
  ok?: boolean;
  tag?: string;
  remark?: string;
};

export function readSeen(): SeenItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): SeenItem[] => {
      if (typeof item === "string") return [{ text: item }];
      if (item && typeof item.text === "string") return [item as SeenItem];
      return [];
    });
  } catch {
    // Storage blocked or corrupted: start from an empty history.
    return [];
  }
}

function writeSeen(items: SeenItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_STORED)));
  } catch {
    // Not saved: the model may repeat this item, which is acceptable.
  }
}

export function rememberSeen(text: string, mode: Mode) {
  writeSeen([...readSeen(), { text: text.trim(), mode }]);
}

// Adds the result to the last time this item was shown.
export function rememberResult(text: string, result: Omit<SeenItem, "text" | "mode">) {
  const items = readSeen();
  const index = items.findLastIndex((item) => item.text === text.trim());
  if (index === -1) return;
  items[index] = { ...items[index], ...result };
  writeSeen(items);
}

// Words, verbs and phrasal verbs the learner translated correctly, by their
// English (englishKey), kept for good: an item answered right never comes back.
const KNOWN_KEY = "fr-en-translate:known";

export type KnownItems = Partial<Record<Mode, string[]>>;

export function readKnown(): KnownItems {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KNOWN_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([mode, items]) => [
        mode,
        Array.isArray(items)
          ? items.filter((item): item is string => typeof item === "string").slice(-MAX_KNOWN)
          : [],
      ]),
    );
  } catch {
    return {};
  }
}

export function rememberKnown(mode: Mode, english: string) {
  try {
    const known = readKnown();
    const items = (known[mode] ?? []).filter((item) => item !== english);
    known[mode] = [...items, english].slice(-MAX_KNOWN);
    localStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  } catch {
    // Not saved: this item may come back, which is acceptable.
  }
}
