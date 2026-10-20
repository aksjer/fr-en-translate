"use client";

import { useEffect, useRef, useState } from "react";
import type { ErrorTag } from "@/lib/error-tags";
import { englishKey, isWordMode, MAX_TEXT_LENGTH, type Frequency } from "@/lib/options";
import type { Combination } from "@/lib/settings";
import {
  masteredPoints,
  pointsToPractice,
  readKnown,
  readPoints,
  pastMistakes,
  readSeen,
  recentHistory,
  rememberKnown,
  rememberPoint,
  rememberResult,
  rememberSeen,
  toReview,
} from "@/lib/seen-items";
import { useSettings } from "@/lib/use-settings";
import { SpeakButton } from "@/components/speak-button";

type Exercise = Combination & {
  text: string;
  reference?: string;
  forms?: [string, string, string];
  context?: string;
  // A missed word or verb given again.
  review?: boolean;
  // How common the model says the English word or verb is.
  frequency?: Frequency;
  // The grammar point a sentence practices (as soon as, should).
  point?: string;
};

type Correction = {
  perfect: boolean;
  isCorrect: boolean;
  correction: string;
  points: string[];
  alternative?: string;
  inContext?: string;
  similar?: { word: string; nuance: string }[];
  meaning?: string;
  forms?: [string, string, string];
  tag?: ErrorTag;
  remark?: string;
  pointRight?: boolean;
};

// Renders **text** from the API as bold, without using innerHTML.
function Marked({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/).map((part, index) =>
    index % 2 ? (
      <strong
        key={index}
        className="font-semibold text-blue-700 dark:text-blue-300"
      >
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

const primaryButton =
  "rounded-full bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50";

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "The service isn't responding. Try again.");
  }
  return response.json();
}

export function Trainer() {
  const [settings] = useSettings();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [translation, setTranslation] = useState("");
  const [result, setResult] = useState<Correction | null>(null);
  const [loading, setLoading] = useState<"generate" | "correct" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the keyboard flow going: after a correction, Enter generates the next
  // exercise; after a new exercise, the answer field has the focus.
  useEffect(() => {
    if (!result || loading !== null) return;
    // An Enter pressed twice by mistake doesn't skip the correction.
    const shownAt = Date.now();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" || event.repeat || Date.now() - shownAt < 600) return;
      // Enter on a focused button (Listen) does that button's job.
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      generate();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [result, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (exercise && !result) inputRef.current?.focus();
  }, [exercise]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setLoading("generate");
    setError(null);
    try {
      // The recent exercises and their results, the items already learned and
      // the missed ones to review: the next item is chosen from them.
      const seen = readSeen();
      const known = readKnown();
      const points = readPoints();
      const history = recentHistory(seen).map((item) => ({
        ...item,
        text: item.text.slice(0, 300),
      }));
      const next = await post<Exercise>("/api/generate", {
        ...settings,
        history,
        known,
        review: { word: toReview(seen, known, "word"), verb: toReview(seen, known, "verb") },
        points: { mastered: masteredPoints(points), practice: pointsToPractice(points) },
      });
      setExercise(next);
      rememberSeen(next.text, next.mode, { frequency: next.frequency, point: next.point });
      setTranslation("");
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function correct() {
    if (!exercise || !translation.trim()) return;
    setLoading("correct");
    setError(null);
    try {
      const correction = await post<Correction>("/api/correct", {
        mode: exercise.mode,
        text: exercise.text,
        translation,
        tense: exercise.tense,
        kind: exercise.kind,
        focus: exercise.focus,
        point: exercise.point,
        reference: exercise.reference,
        context: exercise.context,
        pastMistakes: pastMistakes(readSeen(), exercise.mode, exercise.text),
      });
      setResult(correction);
      const english =
        isWordMode(exercise.mode) && exercise.reference
          ? englishKey(exercise.reference)
          : undefined;
      const answer = translation.trim().slice(0, 300);
      rememberResult(exercise.text, {
        english,
        answer,
        ok: correction.isCorrect,
        tag: correction.isCorrect ? undefined : correction.tag,
        remark: correction.isCorrect ? undefined : correction.remark,
      });
      if (exercise.point && correction.pointRight !== undefined) {
        rememberPoint(exercise.point, correction.pointRight);
      }
      // A word or verb answered right never comes back.
      if (english && correction.isCorrect) {
        rememberKnown(exercise.mode, english);
        // A right answer other than the expected one is learned too.
        const own = englishKey(answer);
        if (own && own !== english) rememberKnown(exercise.mode, own);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  // The forms from generation belong to the reference: shown only when the
  // correction uses that same verb.
  const forms =
    result &&
    (result.forms ??
      (exercise?.forms?.[0] === englishKey(result.correction.replaceAll("**", ""))
        ? exercise.forms
        : undefined));

  const tags = [
    exercise?.mode,
    exercise?.review ? "review" : undefined,
    exercise?.kind,
    exercise?.focus && `focus: ${exercise.focus}`,
    exercise?.verbType && `${exercise.verbType} verb`,
    exercise?.tense,
    exercise?.theme,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* Always there: before an answer, it also skips the item, which then
          comes back in a review. */}
      <div className="flex items-center justify-between gap-4">
        {exercise ? (
          <ul className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">
            Pick your settings, then generate a French item to translate into
            American English.
          </p>
        )}
        <button
          type="button"
          onClick={() => generate()}
          disabled={loading !== null}
          className={`shrink-0 ${primaryButton}`}
        >
          {loading === "generate"
            ? "Loading…"
            : loading === "correct"
              ? "Checking…"
              : "Generate"}
        </button>
      </div>

      {exercise && (
        <section className="flex flex-col gap-6">

          <div className="flex flex-col gap-2">
            <p
              lang="fr"
              className="text-3xl leading-tight font-semibold tracking-tight"
            >
              {exercise.text}
            </p>
            {exercise.context && (
              <p lang="fr" className="text-zinc-500 italic">
                <Marked text={exercise.context} />
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              correct();
            }}
            className="flex flex-col gap-4"
          >
            <textarea
              ref={inputRef}
              id="translation"
              lang="en-US"
              rows={exercise.mode === "sentence" ? 3 : 1}
              maxLength={MAX_TEXT_LENGTH}
              aria-label="Your answer"
              placeholder="Your answer · Enter to check"
              value={translation}
              onChange={(event) => setTranslation(event.target.value)}
              onKeyDown={(event) => {
                // Enter submits, Shift+Enter adds a new line.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  correct();
                }
              }}
              disabled={loading !== null || result !== null}
              className="rounded-xl border border-zinc-300 bg-transparent p-3 text-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-700"
            />

          </form>
        </section>
      )}

      {result && (
        <section
          aria-live="polite"
          className={`flex flex-col gap-4 rounded-2xl border p-6 ${
            result.isCorrect
              ? "border-green-600/30 bg-green-50 dark:bg-green-950/30"
              : "border-amber-600/30 bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          {/* The frame's color says right or wrong; a title only names the mistake. */}
          <div className="flex flex-col gap-1">
            {!result.perfect && (
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Correction{result.tag && ` · mistake: ${result.tag}`}
              </p>
            )}
            <p className="text-lg">
              <span lang="en-US">
                <Marked text={result.correction} />
              </span>{" "}
              <SpeakButton text={result.correction} compact />
              {result.meaning && (
                <span lang="fr" className="text-zinc-600 dark:text-zinc-400">
                  {" "}
                  · {result.meaning}
                </span>
              )}
            </p>
          </div>
          {forms && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Base · past · past participle
                <SpeakButton text={forms.join(", ")} compact />
              </p>
              <p lang="en-US" className="text-lg font-medium">
                {forms.join(" · ")}
              </p>
            </div>
          )}
          {result.inContext && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                In context
                <SpeakButton text={result.inContext} compact />
              </p>
              <p lang="en-US" className="text-lg">
                <Marked text={result.inContext} />
              </p>
            </div>
          )}
          {result.similar && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {exercise?.mode === "verb" ? "Similar verbs" : "Similar words"}
              </p>
              <ul className="flex flex-col gap-1">
                {result.similar.map((item) => (
                  <li key={item.word}>
                    <span lang="en-US" className="font-medium">
                      {item.word}
                    </span>{" "}
                    <SpeakButton text={item.word} compact />
                    <span lang="fr" className="text-zinc-600 dark:text-zinc-400">
                      {" "}
                      · {item.nuance}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.alternative && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Alternative sentence
                <SpeakButton text={result.alternative} compact />
              </p>
              <p lang="en-US" className="text-lg">
                {result.alternative}
              </p>
            </div>
          )}
          {result.points.length > 0 && (
            <ul className="flex list-disc flex-col gap-2 pl-5 text-zinc-700 dark:text-zinc-300">
              {result.points.map((point, index) => (
                <li key={index}>
                  <Marked text={point} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
