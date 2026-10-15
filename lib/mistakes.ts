// Answer stats kept in this browser, and the error tags they count.

// The kinds of mistakes French speakers make in English (defined below).
// Counts of tags used before stay in the browser and still show in the stats.
export const ERROR_TAGS = [
  "sens",
  "faux ami",
  "temps",
  "préposition",
  "article",
  "ordre des mots",
  "vocabulaire",
  "grammaire",
  "orthographe",
  "ponctuation",
  "autre",
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number];

// What each tag covers, for the prompts: the correction files every mistake
// under the right one, and generation reads the learner's weak points.
export const ERROR_TAG_DEFINITIONS: Record<ErrorTag, string> = {
  sens: "the meaning is wrong, missing or added, or an idiom is translated word for word",
  "faux ami": "a false friend (actually for actuellement, library for librairie)",
  temps: "a wrong tense (I have seen him yesterday)",
  préposition: "a wrong, missing or extra preposition (depend of)",
  article: "a wrong, missing or extra article (she is nurse, the life is beautiful)",
  "ordre des mots": "a wrong word order (a car red)",
  vocabulaire:
    "a wrong or unnatural word (make my homework), or a simple verb instead of a phrasal verb",
  grammaire:
    "any other grammar mistake: agreement, third person -s, verb forms (eated), " +
    "plurals (advices), questions and negations with do",
  orthographe: "spelling, British spelling included (colour)",
  ponctuation: "punctuation and capital letters",
  autre: "anything else",
};

type Stats = {
  answered: number;
  correct: number;
  // Number of wrong answers per error tag.
  byTag: Partial<Record<ErrorTag, number>>;
};

// Stats saved before kept other fields (a review queue): they are ignored.
const STORAGE_KEY = "fr-en-translate:mistakes";

const EMPTY_STATS: Stats = { answered: 0, correct: 0, byTag: {} };

function readStats(): Stats {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed && typeof parsed === "object") {
      const stats = parsed as Partial<Stats>;
      return {
        answered: typeof stats.answered === "number" ? stats.answered : 0,
        correct: typeof stats.correct === "number" ? stats.correct : 0,
        byTag: stats.byTag ?? {},
      };
    }
  } catch {
    // Storage blocked or corrupted: start from empty stats.
  }
  return EMPTY_STATS;
}

const listeners = new Set<() => void>();

// Counts every answer, so the page can show progress.
export function recordAnswer(result: { isCorrect: boolean; tag?: ErrorTag }) {
  const stats = readStats();
  const byTag = { ...stats.byTag };
  if (!result.isCorrect && result.tag) {
    byTag[result.tag] = (byTag[result.tag] ?? 0) + 1;
  }
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        answered: stats.answered + 1,
        correct: stats.correct + (result.isCorrect ? 1 : 0),
        byTag,
      }),
    );
  } catch {
    // Not saved: the stats miss this answer, which is acceptable.
  }
  listeners.forEach((listener) => listener());
}

// Cached so useSyncExternalStore gets a stable snapshot between changes.
let cachedRaw: string | null = null;
let cachedStats: Stats = EMPTY_STATS;

export function getStatsSnapshot(): Stats {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked: no stats.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStats = readStats();
  }
  return cachedStats;
}

export const getServerStatsSnapshot = () => EMPTY_STATS;

// Lets components re-read the stats after a change in this tab or another one.
export function subscribeStats(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
