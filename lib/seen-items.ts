import { MAX_AVOID, MODES, englishKey, type Mode } from "@/lib/options";

// The exercises shown to this learner and how they did, kept in this browser
// only. The last English items of each mode are sent to the generation so they
// don't come again. Items stored by older versions have more fields: they are
// kept as they are and ignored.

const STORAGE_KEY = "fr-en-translate:seen";
const MAX_PER_MODE = 2000;

export type SeenItem = {
  text: string;
  mode: Mode;
  // The expected English: englishKey of a word or verb (stored by older
  // versions), and the reference as generated.
  english?: string;
  reference?: string;
  // What the learner wrote, right or wrong (none if unanswered), and why.
  answer?: string;
  ok?: boolean;
  remark?: string;
  // The key of the missed item this one practiced again (see toReview).
  reviewOf?: string;
  // When the item was shown, then answered (ISO date and time).
  at?: string;
};

export function readSeen(): SeenItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SeenItem =>
        Boolean(item) && typeof item.text === "string" && MODES.includes(item.mode),
    );
  } catch {
    // Storage blocked or corrupted: start from an empty history.
    return [];
  }
}

// Lets the progress panel show each answer as soon as it is saved.
const listeners = new Set<() => void>();
let version = 0;

export function subscribeHistory(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A number that changes with every write, as a snapshot for useSyncExternalStore.
export function historyVersion() {
  return version;
}

function changed() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function writeSeen(items: SeenItem[]) {
  // The last items of each mode, so a mode practiced a lot doesn't push the others out.
  const counts = new Map<Mode, number>();
  const kept = items
    .toReversed()
    .filter((item) => {
      const count = (counts.get(item.mode) ?? 0) + 1;
      counts.set(item.mode, count);
      return count <= MAX_PER_MODE;
    })
    .reverse();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // Not saved: the model may repeat this item, which is acceptable.
  }
  changed();
}

export function rememberSeen(text: string, mode: Mode, reference: string, reviewOf?: string) {
  writeSeen([
    ...readSeen(),
    {
      text: text.trim(),
      mode,
      reference,
      ...(reviewOf && { reviewOf }),
      at: new Date().toISOString(),
    },
  ]);
}

// Adds the result to the last time this item was shown.
export function rememberResult(text: string, result: Pick<SeenItem, "answer" | "ok" | "remark">) {
  const items = readSeen();
  const index = items.findLastIndex((item) => item.text === text.trim());
  if (index === -1) return;
  items[index] = { ...items[index], ...result, at: new Date().toISOString() };
  writeSeen(items);
}

// The English of an item, as compared for repeats.
export function seenEnglish(item: SeenItem) {
  return item.english ?? (item.reference ? englishKey(item.reference) : undefined);
}

// The last English items of each mode, most recent last.
export function recentEnglish(items: SeenItem[]) {
  return Object.fromEntries(
    MODES.map((mode) => [
      mode,
      items
        .filter((item) => item.mode === mode)
        .map((item) => seenEnglish(item)?.slice(0, 300))
        .filter((english): english is string => Boolean(english))
        .slice(-MAX_AVOID),
    ]),
  ) as Record<Mode, string[]>;
}

// Words and verbs the learner translated correctly, by their English (englishKey).
const KNOWN_KEY = "fr-en-translate:known";
const MAX_KNOWN = 2000;

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
    // Not saved: acceptable.
  }
  changed();
}

export type ReviewItem = { key: string; french: string; english: string };

// The items missed and not answered right since, most recent first, per mode:
// some new items practice them again. An item is known by its key; a review
// counts for the item it practices (reviewOf), so a right review clears it and
// a missed one keeps it pending once.
export function toReview(items: SeenItem[]) {
  const reviews = Object.fromEntries(MODES.map((mode) => [mode, [] as ReviewItem[]]));
  const done = new Set<string>();
  for (const item of items.toReversed()) {
    const english = item.reference ?? item.english;
    if (!english || item.ok === undefined) continue;
    const key = item.reviewOf ?? `${item.mode}:${seenEnglish(item)}`.slice(0, 400);
    if (done.has(key)) continue;
    done.add(key);
    if (item.ok === false && reviews[item.mode].length < MAX_AVOID) {
      reviews[item.mode].push({
        key,
        french: item.text.slice(0, 300),
        english: english.slice(0, 300),
      });
    }
  }
  return reviews as Record<Mode, ReviewItem[]>;
}
