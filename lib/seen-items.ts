import {
  HISTORY_PER_MODE,
  MAX_KNOWN,
  MAX_PAST_MISTAKES,
  MAX_POINTS,
  MAX_POINTS_TO_PRACTICE,
  MAX_REVIEW,
  MODES,
  POINT_MASTERY,
  pointName,
  type Frequency,
  type Mode,
  type SentenceFocus,
  type Tense,
  type Theme,
  type VerbType,
  type WordKind,
  englishKey,
  isWordMode,
} from "@/lib/options";

// The exercises shown to this learner and how they did, kept in this browser
// only. The last ones are sent to the API, so the model can vary its items, and
// the missed words and verbs come back in reviews.

const STORAGE_KEY = "fr-en-translate:seen";
// Per mode, so a mode practiced a lot doesn't push the others out.
const MAX_PER_MODE = 2000;
// A missed item seen in the last few of its mode isn't reviewed yet.
const RECENTLY_SEEN = 5;

// The optional fields are missing on items stored before they existed.
export type SeenItem = {
  text: string;
  mode: Mode;
  // The English of a word or verb: the expected answer, stored when the item
  // is shown and never changed after.
  english?: string;
  // Another right word the learner answered with (sofa for couch).
  accepted?: string;
  // A verb's base form, past simple and past participle, as shown.
  forms?: [string, string, string];
  // What the learner wrote.
  answer?: string;
  // Right or wrong; none if the item wasn't answered.
  ok?: boolean;
  tag?: string;
  remark?: string;
  // How common the model said the English word or verb is.
  frequency?: Frequency;
  // The grammar point a sentence practiced (as soon as, should), and how the
  // learner did on it: avoided when they said it another right way.
  point?: string;
  pointResult?: PointResult;
  // When the item was shown, then answered (ISO date and time).
  at?: string;
  // What the item practiced, as picked by the code.
  kind?: WordKind;
  focus?: SentenceFocus;
  tense?: Tense;
  theme?: Theme;
  verbType?: VerbType;
  // A missed word or verb given again, or a sentence that practices the
  // mistake of the one before.
  review?: boolean;
  // The French of a review this item replaced, its context having failed: not
  // due again the same day.
  reviewSkipped?: string;
  retest?: boolean;
  // The French sentence that showed the meaning of a word or verb.
  context?: string;
  // The expected English of the item, as generated (to drive, the couch, or a
  // sentence); and the learner's sentence corrected.
  reference?: string;
  correction?: string;
  // Every mistake of a wrong answer; tag and remark keep the main one.
  mistakes?: { remark: string; tag: string }[];
  // The English words the correction showed as close or often confused
  // (bookshop, library for bookstore): later items can teach them.
  similar?: string[];
};

export type PointResult = "right" | "wrong" | "avoided";

// What the page knows of an item when it is shown.
export type ShownItem = Pick<
  SeenItem,
  | "frequency"
  | "point"
  | "kind"
  | "focus"
  | "tense"
  | "theme"
  | "verbType"
  | "review"
  | "retest"
  | "context"
  | "reference"
  | "english"
  | "forms"
  | "reviewSkipped"
>;

// Items stored before accepted existed kept the learner's right synonym as
// english and the expected word as reference: they are read in today's shape.
function current(item: SeenItem): SeenItem {
  if (
    !isWordMode(item.mode) ||
    item.ok !== true ||
    item.accepted ||
    !item.english ||
    !item.reference ||
    englishKey(item.reference) === item.english
  ) {
    return item;
  }
  return { ...item, english: englishKey(item.reference), accepted: item.english };
}

export function readSeen(): SeenItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is SeenItem =>
          Boolean(item) && typeof item.text === "string" && MODES.includes(item.mode),
      )
      .map(current);
  } catch {
    // Storage blocked or corrupted: start from an empty history.
    return [];
  }
}

// The last items of each mode, oldest first.
function lastByMode(items: SeenItem[], max: number) {
  const counts = new Map<Mode, number>();
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

export function rememberSeen(text: string, mode: Mode, shown: ShownItem = {}) {
  // Only the fields that have a value, so the storage stays small.
  const fields = Object.fromEntries(
    Object.entries(shown).filter(([, value]) => value !== undefined && value !== ""),
  );
  writeSeen([
    ...readSeen(),
    { text: text.trim(), mode, ...fields, at: new Date().toISOString() },
  ]);
}

// Adds the result to the last time this item was shown, with the time of the answer.
export function rememberResult(text: string, result: Omit<SeenItem, "text" | "mode" | "at">) {
  const items = readSeen();
  const index = items.findLastIndex((item) => item.text === text.trim());
  if (index === -1) return;
  items[index] = { ...items[index], ...result, at: new Date().toISOString() };
  writeSeen(items);
}

// The history sent to the API: the last items of each mode, since the server
// picks the mode.
export function recentHistory(items: SeenItem[]) {
  return lastByMode(items, HISTORY_PER_MODE);
}

// The learner's last wrong answers in a mode, with their remark, for the
// correction. Earlier misses of the item being corrected count too: a review
// can then say the learner made the same mistake again. The item being
// corrected has no result yet, so it isn't in the list.
export function pastMistakes(items: SeenItem[], mode: Mode) {
  return items
    .filter(
      (item): item is SeenItem & { remark: string } =>
        item.mode === mode && item.ok === false && Boolean(item.remark),
    )
    .slice(-MAX_PAST_MISTAKES)
    .map(({ text, remark }) => ({ text, remark }));
}

export type ReviewItem = {
  text: string;
  english?: string;
  // The expected English as generated, and a verb's forms: a review gives
  // them again as they were.
  reference?: string;
  forms?: [string, string, string];
  frequency?: Frequency;
  // The context sentence shown last time, so the review gives a new one.
  context?: string;
  // How many times the learner missed this item.
  misses: number;
  // The kind of word of a word item.
  kind?: WordKind;
  // Missed or left unanswered today: always given again soon.
  today?: boolean;
};

// The words or verbs missed or left unanswered and not learned since: a review
// gives one of them again. Those of today come first, the last one first, so
// a fresh mistake comes back while it is fresh; then the older ones, oldest
// first. Each item counts once, at the last time it was shown.
export function toReview(items: SeenItem[], known: KnownItems, mode: "word" | "verb") {
  const ofMode = items.filter((item) => item.mode === mode);
  const learned = new Set(known[mode] ?? []);
  const lastIndex = new Map(ofMode.map((item, index) => [item.text, index]));
  const misses = new Map<string, number>();
  for (const item of ofMode) {
    if (item.ok === false) misses.set(item.text, (misses.get(item.text) ?? 0) + 1);
  }
  const isToday = (item: SeenItem) =>
    item.at !== undefined && new Date(item.at).toLocaleDateString("en-CA") === today();
  const skipped = new Set(
    ofMode.filter((item) => item.reviewSkipped && isToday(item)).map((item) => item.reviewSkipped),
  );
  const due = ofMode.filter(
    (item, index) =>
      lastIndex.get(item.text) === index &&
      !skipped.has(item.text) &&
      index < ofMode.length - RECENTLY_SEEN &&
      item.ok !== true &&
      !(item.english && learned.has(item.english)),
  );
  return [...due.filter(isToday).reverse(), ...due.filter((item) => !isToday(item))]
    .slice(0, MAX_REVIEW)
    .map(
      (item): ReviewItem => ({
        text: item.text,
        ...(item.english && { english: item.english }),
        ...(item.reference && { reference: item.reference }),
        ...(item.forms && { forms: item.forms }),
        ...(item.frequency && { frequency: item.frequency }),
        ...(item.context && { context: item.context }),
        ...(item.kind && { kind: item.kind }),
        ...(isToday(item) && { today: true }),
        misses: misses.get(item.text) ?? 0,
      }),
    );
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
// wrong answer starts it over. An avoided one keeps its count but becomes the
// most recent to practice. A mastered point is never the target again.
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

export function rememberPoint(point: string, result: PointResult) {
  const key = pointName(point);
  if (!key) return;
  try {
    const points = readPoints();
    const current = points[key] ?? { right: 0 };
    // Two right answers the same day count once: mastery needs another day.
    const next: PointProgress =
      result === "avoided"
        ? current
        : result === "wrong"
          ? { right: 0 }
          : current.lastRight === today()
            ? current
            : { right: current.right + 1, lastRight: today() };
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
    // One right today waits for tomorrow: a second right answer today wouldn't count.
    .filter((key) => points[key].right < POINT_MASTERY && points[key].lastRight !== today())
    .reverse()
    .slice(0, MAX_POINTS_TO_PRACTICE);
}
