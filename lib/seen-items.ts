import type { Mode } from "@/lib/options";

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

// Verbs the learner translated correctly, kept for good: a verb answered
// right never comes back. Sent in full, since the server only checks them.
const KNOWN_VERBS_KEY = "fr-en-translate:known-verbs";
export const MAX_KNOWN_VERBS = 500;

export function readKnownVerbs(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KNOWN_VERBS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function rememberKnownVerb(text: string) {
  try {
    const known = readKnownVerbs().filter((item) => item !== text.trim());
    const items = [...known, text.trim()].slice(-MAX_KNOWN_VERBS);
    localStorage.setItem(KNOWN_VERBS_KEY, JSON.stringify(items));
  } catch {
    // Not saved: this verb may come back, which is acceptable.
  }
}
