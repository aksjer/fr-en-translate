import {
  HISTORY_PER_MODE,
  MAX_KNOWN,
  MAX_PAST_MISTAKES,
  MAX_POINTS,
  MAX_POINTS_TO_PRACTICE,
  MAX_REVIEW,
  POINT_MASTERY,
  pointName,
  type Frequency,
  type Mode,
} from "@/lib/options";

// The exercises shown to this learner and how they did, kept in this browser
// only. The last ones are sent to the API, so the model can vary its items, and
// the missed words and verbs come back in reviews.

const STORAGE_KEY = "fr-en-translate:seen";
// Per mode, so a mode practiced a lot doesn't push the others out.
const MAX_PER_MODE = 2000;
// A missed item seen in the last few of its mode isn't reviewed yet.
const RECENTLY_SEEN = 5;

// Items saved before the mode or the result was stored have none.
export type SeenItem = {
  text: string;
  mode?: Mode;
  // The English of a word or verb: the expected answer.
  english?: string;
  // What the learner wrote.
  answer?: string;
  // Right or wrong; none if the item wasn't answered.
  ok?: boolean;
  tag?: string;
  remark?: string;
  // How common the model said the English word or verb is.
  frequency?: Frequency;
  // The grammar point a sentence practiced (as soon as, should).
  point?: string;
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

// The last items of each mode, oldest first.
function lastByMode(items: SeenItem[], max: number) {
  const counts = new Map<Mode | undefined, number>();
  const kept: SeenItem[] = [];
  for (let index = items.length - 1; index >= 0; index--) {
    const count = counts.get(items[index].mode) ?? 0;
    if (count >= max) continue;
    counts.set(items[index].mode, count + 1);
    kept.push(items[index]);
  }
  return kept.reverse();
}

// Lets the progress panel show each answer as soon as it is saved.
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  listeners.forEach((listener) => listener());
}

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

function writeSeen(items: SeenItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastByMode(items, MAX_PER_MODE)));
  } catch {
    // Not saved: the model may repeat this item, which is acceptable.
  }
  changed();
}

export function rememberSeen(
  text: string,
  mode: Mode,
  extra: { frequency?: Frequency; point?: string } = {},
) {
  writeSeen([
    ...readSeen(),
    {
      text: text.trim(),
      mode,
      ...(extra.frequency && { frequency: extra.frequency }),
      ...(extra.point && { point: extra.point }),
    },
  ]);
}

// Adds the result to the last time this item was shown.
export function rememberResult(text: string, result: Omit<SeenItem, "text" | "mode">) {
  const items = readSeen();
  const index = items.findLastIndex((item) => item.text === text.trim());
  if (index === -1) return;
  items[index] = { ...items[index], ...result };
  writeSeen(items);
}

// The history sent to the API: the last items of each mode, since the server
// picks the mode.
export function recentHistory(items: SeenItem[]) {
  return lastByMode(
    items.filter((item) => item.mode),
    HISTORY_PER_MODE,
  );
}

// The learner's last wrong answers in a mode, with their remark, for the
// correction. The item being corrected is left out.
export function pastMistakes(items: SeenItem[], mode: Mode, current: string) {
  return items
    .filter(
      (item): item is SeenItem & { remark: string } =>
        item.mode === mode && item.ok === false && Boolean(item.remark) && item.text !== current,
    )
    .slice(-MAX_PAST_MISTAKES)
    .map(({ text, remark }) => ({ text, remark }));
}

export type ReviewItem = { text: string; english?: string };

// The words or verbs missed or left unanswered and not learned since, oldest first: a
// review gives one of them again. Each item counts once, at the last time it
// was shown, so one missed again becomes recent again.
export function toReview(items: SeenItem[], known: KnownItems, mode: "word" | "verb") {
  const ofMode = items.filter((item) => item.mode === mode);
  const learned = new Set(known[mode] ?? []);
  const lastIndex = new Map(ofMode.map((item, index) => [item.text, index]));
  return ofMode
    .filter(
      (item, index) =>
        lastIndex.get(item.text) === index &&
        index < ofMode.length - RECENTLY_SEEN &&
        item.ok !== true &&
        !(item.english && learned.has(item.english)),
    )
    .slice(0, MAX_REVIEW)
    .map(({ text, english }): ReviewItem => ({ text, ...(english && { english }) }));
}

// Words and verbs the learner translated correctly, by their
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
  changed();
}

// The grammar points of sentences (as soon as, should) and how the learner did:
// one is mastered after POINT_MASTERY right answers on different days, and a
// wrong answer starts it over. A mastered point is never the target again.
const POINTS_KEY = "fr-en-translate:points";

export type PointProgress = { right: number; lastRight?: string };

function today() {
  return new Date().toLocaleDateString("en-CA");
}

export function readPoints(): Record<string, PointProgress> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(POINTS_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, PointProgress] =>
          Boolean(entry[1]) && typeof (entry[1] as PointProgress).right === "number",
      ),
    );
  } catch {
    return {};
  }
}

export function rememberPoint(point: string, right: boolean) {
  const key = pointName(point);
  if (!key) return;
  try {
    const points = readPoints();
    const current = points[key] ?? { right: 0 };
    // Two right answers the same day count once: mastery needs another day.
    const next: PointProgress = right
      ? current.lastRight === today()
        ? current
        : { right: current.right + 1, lastRight: today() }
      : { right: 0 };
    // The point moves to the end, so the oldest go first when the list is full.
    const entries = [
      ...Object.entries(points).filter(([other]) => other !== key),
      [key, next] as const,
    ].slice(-MAX_POINTS);
    localStorage.setItem(POINTS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Not saved: this point may come back, which is acceptable.
  }
  changed();
}

export function masteredPoints(points: Record<string, PointProgress>) {
  return Object.keys(points).filter((key) => points[key].right >= POINT_MASTERY);
}

// The points missed or right only once, the most recent first.
export function pointsToPractice(points: Record<string, PointProgress>) {
  return Object.keys(points)
    .filter((key) => points[key].right < POINT_MASTERY)
    .reverse()
    .slice(0, MAX_POINTS_TO_PRACTICE);
}
