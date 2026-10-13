// Mistakes kept in this browser, reviewed again after a number of exercises.

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
  // Index in REVIEW_GAPS: a success moves it further, a failure resets it.
  step: number;
  // Exercise count at which the mistake is due again.
  dueAt: number;
};

type Store = { count: number; items: Mistake[] };

const STORAGE_KEY = "fr-en-translate:mistakes";
const MAX_STORED = 200;
// Exercises to wait before each review: 5, then 15, 40, 100 and 250.
const REVIEW_GAPS = [5, 15, 40, 100, 250];

const EMPTY_STORE: Store = { count: 0, items: [] };

function readStore(): Store {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed && typeof parsed === "object" && "items" in parsed) {
      const store = parsed as Store;
      return {
        count: typeof store.count === "number" ? store.count : 0,
        items: Array.isArray(store.items) ? store.items : [],
      };
    }
  } catch {
    // Storage blocked or corrupted: start from an empty store.
  }
  return EMPTY_STORE;
}

const listeners = new Set<() => void>();

function writeStore(store: Store) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...store, items: store.items.slice(-MAX_STORED) }),
    );
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

// Call once per new exercise: the review clock counts exercises, not days.
export function countExercise() {
  const store = readStore();
  writeStore({ ...store, count: store.count + 1 });
}

// Same French sentence again: its review restarts from the first gap.
export function addMistake(mistake: Omit<Mistake, "id" | "step" | "dueAt">) {
  const store = readStore();
  writeStore({
    ...store,
    items: [
      ...store.items.filter((item) => item.text !== mistake.text),
      {
        ...mistake,
        id: crypto.randomUUID(),
        step: 0,
        dueAt: store.count + REVIEW_GAPS[0],
      },
    ],
  });
}

export function dueMistakes(): Mistake[] {
  const { count, items } = readStore();
  return items
    .filter((item) => item.dueAt <= count)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function recordReview(id: string, success: boolean) {
  const store = readStore();
  writeStore({
    ...store,
    items: store.items.map((item) => {
      if (item.id !== id) return item;
      const step = success
        ? Math.min(item.step + 1, REVIEW_GAPS.length - 1)
        : 0;
      return { ...item, step, dueAt: store.count + REVIEW_GAPS[step] };
    }),
  });
}
