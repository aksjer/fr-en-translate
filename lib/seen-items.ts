import { MAX_KNOWN, type Mode } from "@/lib/options";

// Items already shown to this learner, kept in this browser only.
// The last ones are sent to the API so it avoids repeating them.

const STORAGE_KEY = "fr-en-translate:seen";
const MAX_STORED = 500;
// Items of every mode are sent: the server keeps the ones of the mode it picks.
export const MAX_SENT = 40;

// Items saved before the mode was stored have none.
export type SeenItem = { text: string; mode?: Mode };

// Without the context in parentheses, so a word given again with another context
// (« se rattraper », then « se rattraper (le temps perdu) ») counts as seen.
const normalize = (text: string) =>
  text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

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

export function isSeen(text: string) {
  const target = normalize(text);
  return readSeen().some((item) => normalize(item.text) === target);
}

export function rememberSeen(text: string, mode: Mode) {
  try {
    const items = [...readSeen(), { text: text.trim(), mode }].slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Not saved: the next exercise may repeat this item, which is acceptable.
  }
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
