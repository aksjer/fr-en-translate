"use client";

import { useEffect, useRef, useState } from "react";
import type { Correction } from "@/lib/correct";
import type { Exercise } from "@/lib/generate";
import { englishKey, MAX_TEXT_LENGTH } from "@/lib/options";
import {
  readSeen,
  recentEnglish,
  toReview,
  rememberKnown,
  rememberResult,
  rememberSeen,
} from "@/lib/seen-items";
import { useSettings } from "@/lib/use-settings";
import { MicButton } from "@/components/mic-button";
import { SpeakButton } from "@/components/speak-button";

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
  // One call gives several exercises: the next ones wait here, and are stored
  // in the history only when shown. New settings drop them.
  const queue = useRef<Exercise[]>([]);
  // The batch being fetched, shared so a second request never starts.
  const pending = useRef<Promise<Exercise[]> | null>(null);
  const busy = useRef(false);
  const settingsKey = JSON.stringify(settings);
  const current = useRef({ settings, settingsKey });
  useEffect(() => {
    current.current = { settings, settingsKey };
  }, [settings, settingsKey]);
  useEffect(() => {
    queue.current = [];
  }, [settingsKey]);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [translation, setTranslation] = useState("");
  const [result, setResult] = useState<Correction | null>(null);
  // The microphone is writing the answer.
  const [listening, setListening] = useState(false);
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

  // The last English items of each mode, so the batch has new ones, and the
  // missed ones, which some items practice again.
  async function fetchBatch() {
    const seen = readSeen();
    const { exercises } = await post<{ exercises: Exercise[] }>("/api/generate", {
      ...current.current.settings,
      avoid: recentEnglish(seen),
      review: toReview(seen),
    });
    return exercises;
  }

  // The next exercise of the queue, or of a new batch. A batch asked with
  // settings changed since is dropped, and another one asked.
  async function nextExercise() {
    for (;;) {
      const queued = queue.current.shift();
      if (queued) return queued;
      const key = current.current.settingsKey;
      pending.current ??= fetchBatch().finally(() => {
        pending.current = null;
      });
      const batch = await pending.current;
      if (!batch.length) throw new Error("The service isn't responding. Try again.");
      if (key === current.current.settingsKey) queue.current.push(...batch);
    }
  }

  async function generate() {
    if (busy.current) return;
    busy.current = true;
    setLoading("generate");
    setError(null);
    try {
      const next = await nextExercise();
      setExercise(next);
      rememberSeen(next.text, next.mode, next.reference);
      setTranslation("");
      setResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
      setLoading(null);
    }
  }

  async function correct() {
    if (!exercise || !translation.trim() || listening) return;
    setLoading("correct");
    setError(null);
    try {
      const correction = await post<Correction>("/api/correct", {
        mode: exercise.mode,
        text: exercise.text,
        reference: exercise.reference,
        translation,
      });
      setResult(correction);
      rememberResult(exercise.text, {
        answer: translation.trim().slice(0, 300),
        ok: correction.right,
        remark: correction.explanation || undefined,
      });
      // A word or verb answered right is learned.
      if (exercise.mode !== "sentence" && correction.right) {
        rememberKnown(exercise.mode, englishKey(exercise.reference));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const tags = [
    exercise?.mode,
    exercise?.review ? "review" : undefined,
    exercise?.kind,
    exercise?.verbType && `${exercise.verbType} verb`,
    exercise?.tense,
    exercise?.theme,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {/* Always there: before an answer, it also skips the item. */}
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
                {exercise.context}
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
            <div className="relative">
              <textarea
                ref={inputRef}
                id="translation"
                lang="en-US"
                // The field grows with the answer, so it never scrolls under the
                // microphone; rows are for browsers that can't grow it.
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
                readOnly={listening}
                className={`block w-full resize-none rounded-xl border border-zinc-300 bg-transparent p-3 pr-12 text-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-700 field-sizing-content ${exercise.mode === "sentence" ? "min-h-[6.5rem]" : ""}`}
              />
              <MicButton
                value={translation}
                onChange={setTranslation}
                disabled={loading !== null || result !== null}
                onListeningChange={setListening}
              />
            </div>

          </form>
        </section>
      )}

      {result && (
        <section
          aria-live="polite"
          className={`flex flex-col gap-4 rounded-2xl border p-6 ${
            result.right
              ? "border-green-600/30 bg-green-50 dark:bg-green-950/30"
              : "border-amber-600/30 bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          {/* The frame's color says right or wrong. */}
          <div className="flex flex-col gap-1">
            {englishKey(result.correction) !== englishKey(translation) && (
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Correction
              </p>
            )}
            <p className="text-lg">
              <span lang="en-US">{result.correction}</span>{" "}
              <SpeakButton text={result.correction} compact />
            </p>
          </div>
          {result.forms && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Base · past · past participle
                <SpeakButton text={result.forms.join(", ")} compact />
              </p>
              <p lang="en-US" className="text-lg font-medium">
                {result.forms.join(" · ")}
              </p>
            </div>
          )}
          {result.variants && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Other ways to say it
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {result.variants.map((variant) => (
                  <li key={variant} lang="en-US">
                    {variant} <SpeakButton text={variant} compact />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.natural && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                More natural
                <SpeakButton text={result.natural} compact />
              </p>
              <p lang="en-US" className="text-lg">
                {result.natural}
              </p>
            </div>
          )}
          {result.explanation && (
            <p lang="fr" className="text-zinc-700 dark:text-zinc-300">
              {result.explanation}
            </p>
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
