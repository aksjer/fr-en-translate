"use client";

import { useEffect, useRef, useState } from "react";
import { SettingsPanel } from "@/components/settings-panel";
import type { Combination } from "@/lib/settings";
import { isSeen, MAX_SENT, readSeen, rememberSeen } from "@/lib/seen-items";
import { useSettings } from "@/lib/use-settings";

type Exercise = Combination & { text: string };

type Correction = {
  score: number;
  isCorrect: boolean;
  correction: string;
  explanation: string;
};

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
  if (response.status === 429) {
    const wait = response.headers.get("Retry-After");
    throw new Error(
      `Trop de demandes, réessaie dans ${wait ?? "quelques"} secondes.`,
    );
  }
  if (!response.ok) throw new Error("Le service ne répond pas, réessaie.");
  return response.json();
}

export function Trainer() {
  const [settings, setSettings] = useSettings();
  const [showSettings, setShowSettings] = useState(false);
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

  // Keep the keyboard flow going: after a correction, focus "Suivant";
  // after a new exercise, focus the answer field.
  useEffect(() => {
    if (result) nextRef.current?.focus();
  }, [result]);

  useEffect(() => {
    if (exercise && !result) inputRef.current?.focus();
  }, [exercise]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recent items from this browser, so the API varies its exercises.
  function requestExercise() {
    const avoid = readSeen()
      .slice(-MAX_SENT)
      .map((item) => item.slice(0, 80));
    return post<Exercise>("/api/generate", { ...settings, avoid });
  }

  async function generate() {
    setLoading("generate");
    setError(null);
    try {
      let next = await requestExercise();
      // One retry if the item was already seen here.
      if (isSeen(next.text)) next = await requestExercise();
      setExercise(next);
      setExerciseSettings(JSON.stringify(settings));
      rememberSeen(next.text);
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
      setResult(
        await post<Correction>("/api/correct", {
          mode: exercise.mode,
          text: exercise.text,
          translation,
          level: exercise.level,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const tags = [
    exercise?.mode,
    exercise?.level,
    exercise?.verbType && `verbe ${exercise.verbType}`,
    exercise?.tense,
    exercise?.theme,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left font-medium"
        >
          Réglages
          <span className="text-sm font-normal text-zinc-500">
            {showSettings ? "Masquer" : "Afficher"}
          </span>
        </button>
        {showSettings && (
          <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">
            <SettingsPanel settings={settings} onChange={setSettings} />
          </div>
        )}
      </section>

      {!exercise && (
        <p className="text-zinc-600 dark:text-zinc-400">
          Choisis tes réglages, puis commence. Tu recevras un élément en
          français à traduire en anglais américain.
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
              Traduis en anglais américain
            </p>
            <p
              lang="fr"
              className="text-3xl leading-tight font-semibold tracking-tight"
            >
              {exercise.text}
            </p>
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
              Ta réponse
            </label>
            <textarea
              ref={inputRef}
              id="translation"
              lang="en-US"
              rows={exercise.mode === "phrase" ? 3 : 1}
              maxLength={600}
              placeholder="Écris ta traduction…"
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
              Entrée pour corriger · Maj+Entrée pour une nouvelle ligne
            </p>

            {!result && (
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading !== null || !translation.trim()}
                  className={primaryButton}
                >
                  {loading === "correct" ? "Correction en cours…" : "Corriger"}
                </button>
                {settingsChanged && (
                  <button
                    type="button"
                    onClick={generate}
                    disabled={loading !== null}
                    className={secondaryButton}
                  >
                    Nouvel exercice
                  </button>
                )}
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
          <p className="flex items-center gap-3 text-lg font-semibold">
            <span
              className={`rounded-full px-3 py-1 text-sm ${
                result.isCorrect
                  ? "bg-green-600 text-white"
                  : "bg-amber-500 text-zinc-950"
              }`}
            >
              {result.score}/10
            </span>
            {result.isCorrect ? "Correct !" : "Presque !"}
          </p>
          {!result.isCorrect && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Correction
              </p>
              <p lang="en-US" className="text-lg">
                {result.correction}
              </p>
            </div>
          )}
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {result.explanation}
          </p>
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
          onClick={generate}
          disabled={loading !== null}
          className={`self-start ${primaryButton}`}
        >
          {loading === "generate"
            ? "Génération…"
            : exercise
              ? "Suivant"
              : "Commencer"}
        </button>
      )}
    </div>
  );
}
