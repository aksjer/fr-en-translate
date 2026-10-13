// Mistakes kept in this browser, reviewed again later with spaced intervals.

export const ERROR_TAGS = [
  "accent",
  "article",
  "temps",
  "vocabulaire",
  "grammaire",
  "ponctuation",
  "orthographe",
  "autre",
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number];

export type Mistake = {
  id: string;
  text: string;
  level: string;
  correction: string;
  tag?: ErrorTag;
  // Index in REVIEW_DAYS: a success moves it further, a failure resets it.
  step: number;
  dueAt: number;
};

const STORAGE_KEY = "fr-en-translate:mistakes";
const MAX_STORED = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_DAYS = [1, 3, 7, 14, 30];

export function readMistakes(): Mistake[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Mistake[]) : [];
  } catch {
    // Storage blocked or corrupted: start from an empty list.
    return [];
  }
}

const listeners = new Set<() => void>();

function writeMistakes(mistakes: Mistake[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mistakes.slice(-MAX_STORED)));
  } catch {
    // Not saved: the mistake is lost, which is acceptable for a practice aid.
  }
  listeners.forEach((listener) => listener());
}

// Lets components re-read the due list after a change in this tab or another one.
export function subscribeMistakes(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// Cached so useSyncExternalStore gets a stable snapshot between changes.
const NO_DUE: Mistake[] = [];
let cachedRaw: string | null = null;
let cachedDue: Mistake[] = NO_DUE;

export function getDueSnapshot(): Mistake[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing is due.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDue = dueMistakes();
  }
  return cachedDue;
}

export const getServerDueSnapshot = () => NO_DUE;

// Same French sentence again: its review restarts from the first interval.
export function addMistake(
  mistake: Omit<Mistake, "id" | "step" | "dueAt">,
) {
  const now = Date.now();
  const others = readMistakes().filter((item) => item.text !== mistake.text);
  writeMistakes([
    ...others,
    {
      ...mistake,
      id: crypto.randomUUID(),
      step: 0,
      dueAt: now + REVIEW_DAYS[0] * DAY_MS,
    },
  ]);
}

export function dueMistakes(now = Date.now()) {
  return readMistakes()
    .filter((item) => item.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function recordReview(id: string, success: boolean) {
  const now = Date.now();
  writeMistakes(
    readMistakes().map((item) => {
      if (item.id !== id) return item;
      const step = success
        ? Math.min(item.step + 1, REVIEW_DAYS.length - 1)
        : 0;
      return { ...item, step, dueAt: now + REVIEW_DAYS[step] * DAY_MS };
    }),
  );
}
