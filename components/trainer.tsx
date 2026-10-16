"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ErrorTag } from "@/lib/error-tags";
import { englishKey, isWordMode, MAX_TEXT_LENGTH } from "@/lib/options";
import type { Combination } from "@/lib/settings";
import {
  readKnown,
  pastMistakes,
  readSeen,
  recentHistory,
  rememberKnown,
  rememberResult,
  rememberSeen,
  toReview,
} from "@/lib/seen-items";
import { speak } from "@/lib/speak";
import { useSettings } from "@/lib/use-settings";

type Exercise = Combination & {
  text: string;
  reference?: string;
  forms?: [string, string, string];
  context?: string;
  // A missed word or verb given again.
  review?: boolean;
};

type Correction = {
  perfect: boolean;
  isCorrect: boolean;
  correction: string;
  points: string[];
  alternative?: string;
  example?: { english: string; french: string };
  forms?: [string, string, string];
  tag?: ErrorTag;
  remark?: string;
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
const secondaryButton =
  "rounded-full border border-blue-600 px-5 py-2.5 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-950/40";

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
  // Settings used for the current exercise, to know when they've changed since.
  const [exerciseSettings, setExerciseSettings] = useState<string | null>(null);
  const settingsChanged =
    exercise !== null && exerciseSettings !== JSON.stringify(settings);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Keep the keyboard flow going: after a correction, focus "Next";
  // after a new exercise, focus the answer field.
  useEffect(() => {
    if (result) nextRef.current?.focus();
  }, [result]);

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
      const history = recentHistory(seen).map((item) => ({
        ...item,
        text: item.text.slice(0, 300),
      }));
      const next = await post<Exercise>("/api/generate", {
        ...settings,
        history,
        known,
        review: { word: toReview(seen, known, "word"), verb: toReview(seen, known, "verb") },
      });
      setExercise(next);
      setExerciseSettings(JSON.stringify(settings));
      rememberSeen(next.text, next.mode);
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
        level: exercise.level,
        tense: exercise.tense,
        reference: exercise.reference,
        context: exercise.context,
        pastMistakes: pastMistakes(readSeen(), exercise.mode, exercise.text),
      });
      setResult(correction);
      const english =
        isWordMode(exercise.mode) && exercise.reference
          ? englishKey(exercise.reference)
          : undefined;
      rememberResult(exercise.text, {
        english,
        ok: correction.isCorrect,
        tag: correction.isCorrect ? undefined : correction.tag,
        remark: correction.isCorrect ? undefined : correction.remark,
      });
      // A word or verb answered right never comes back.
      if (english && correction.isCorrect) rememberKnown(exercise.mode, english);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const tags = [
    exercise?.mode,
    exercise?.review ? "review" : undefined,
    exercise?.level,
    exercise?.verbType && `${exercise.verbType} verb`,
    exercise?.tense,
    exercise?.theme,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-4 text-sm font-medium">
        <Link href="/settings" className="text-blue-700 hover:underline dark:text-blue-300">
          Settings
        </Link>
        <Link href="/progress" className="text-blue-700 hover:underline dark:text-blue-300">
          My progress
        </Link>
      </nav>

      {!exercise && (
        <p className="text-zinc-600 dark:text-zinc-400">
          Pick your settings, then start. You&apos;ll get a French item to
          translate into American English.
        </p>
      )}

      {exercise && (
        <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
              Translate into American English
            </p>
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
            <label
              htmlFor="translation"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Your answer
            </label>
            <textarea
              ref={inputRef}
              id="translation"
              lang="en-US"
              rows={exercise.mode === "sentence" ? 3 : 1}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Type your translation…"
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
            <p className="text-xs text-zinc-500">
              Enter to check · Shift+Enter for a new line
            </p>

            {!result && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading !== null || !translation.trim()}
                  className={primaryButton}
                >
                  {loading === "correct" ? "Checking…" : "Check"}
                </button>
                <button
                  type="button"
                  onClick={() => generate()}
                  disabled={loading !== null}
                  className={secondaryButton}
                >
                  {settingsChanged ? "New exercise" : "Skip"}
                </button>
              </div>
            )}
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
          <p className="text-lg font-semibold">
            {result.perfect ? "Perfect!" : result.isCorrect ? "Correct!" : "Almost!"}
          </p>
          {!result.perfect && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Correction{result.tag && ` · mistake: ${result.tag}`}
              </p>
              <p lang="en-US" className="text-lg">
                <Marked text={result.correction} />
              </p>
            </div>
          )}
          {(result.forms ?? exercise?.forms) && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Base · past · past participle
              </p>
              <p lang="en-US" className="text-lg font-medium">
                {(result.forms ?? exercise?.forms)?.join(" · ")}
              </p>
            </div>
          )}
          {result.example && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Example
              </p>
              <p lang="en-US" className="text-lg">
                <Marked text={result.example.english} />
              </p>
              <p lang="fr" className="text-zinc-600 dark:text-zinc-400">
                <Marked text={result.example.french} />
              </p>
            </div>
          )}
          {result.alternative && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Another natural way to say it
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
          <button
            type="button"
            onClick={() => speak(result.correction.replaceAll("**", ""))}
            className={`self-start ${secondaryButton}`}
          >
            Listen
          </button>
        </section>
      )}

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {(!exercise || result) && (
        <button
          type="button"
          ref={nextRef}
          onClick={() => generate()}
          disabled={loading !== null}
          className={`self-start ${primaryButton}`}
        >
          {loading === "generate"
            ? "Generating…"
            : exercise
              ? "Next"
              : "Start"}
        </button>
      )}
    </div>
  );
}
