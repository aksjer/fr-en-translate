// Items already shown to this learner, kept in this browser only.
// The last ones are sent to the API so it avoids repeating them.

const STORAGE_KEY = "fr-en-translate:seen";
const MAX_STORED = 500;
export const MAX_SENT = 20;

const normalize = (text: string) => text.trim().toLowerCase();

export function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    // Storage blocked or corrupted: start from an empty history.
    return [];
  }
}

export function isSeen(text: string) {
  const target = normalize(text);
  return readSeen().some((item) => normalize(item) === target);
}

export function rememberSeen(text: string) {
  try {
    const items = [...readSeen(), text.trim()].slice(-MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Not saved: the next exercise may repeat this item, which is acceptable.
  }
}
