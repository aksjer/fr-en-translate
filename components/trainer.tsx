"use client";

import { useEffect, useRef, useState } from "react";
import { SettingsPanel } from "@/components/settings-panel";
import type { Combination } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";

type Exercise = Combination & { text: string };

const HISTORY_SIZE = 20;

type Correction = {
  score: number;
  isCorrect: boolean;
  correction: string;
  explanation: string;
};

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
  // Recent items sent back to the API so it varies its exercises.
  const [history, setHistory] = useState<string[]>([]);
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

  async function generate() {
    setLoading("generate");
    setError(null);
    try {
      const next = await post<Exercise>("/api/generate", {
        ...settings,
        avoid: history,
      });
      setExercise(next);
      setExerciseSettings(JSON.stringify(settings));
      setHistory((items) =>
        [next.text.slice(0, 80), ...items].slice(0, HISTORY_SIZE),
      );
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

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          aria-expanded={showSettings}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
        >
          Réglages
          <span className="text-sm text-zinc-500">
            {showSettings ? "Masquer" : "Afficher"}
          </span>
        </button>
        {showSettings && (
          <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
            <SettingsPanel settings={settings} onChange={setSettings} />
          </div>
        )}
      </section>

      {exercise && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              exercise.mode,
              exercise.level,
              exercise.verbType && `verbe ${exercise.verbType}`,
              exercise.tense,
              exercise.theme,
            ]
              .filter(Boolean)
              .map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {tag}
                </span>
              ))}
          </div>
          <p className="text-sm text-zinc-500">
            Traduis en anglais américain :
          </p>
          <p lang="fr" className="text-2xl leading-snug font-medium">
            {exercise.text}
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              correct();
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="translation" className="text-sm text-zinc-500">
              Ta réponse
            </label>
            <textarea
              ref={inputRef}
              id="translation"
              lang="en-US"
              rows={exercise.mode === "phrase" ? 3 : 1}
              maxLength={600}
              value={translation}
              onChange={(event) => setTranslation(event.target.value)}
              onKeyDown={(event) => {
                // Enter submits, Shift+Enter adds a new line.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  correct();
                }
              }}
              disabled={loading !== null}
              className="rounded-lg border border-zinc-300 bg-transparent p-3 text-lg outline-none focus:border-blue-600 dark:border-zinc-700"
            />
            {!result && settingsChanged && (
              <button
                type="button"
                onClick={generate}
                disabled={loading !== null}
                className="self-start rounded-lg border border-blue-600 px-4 py-2 font-medium text-blue-600 disabled:opacity-50"
              >
                Nouvel exercice
              </button>
            )}
            {!result && (
              <button
                type="submit"
                disabled={loading !== null || !translation.trim()}
                className="self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {loading === "correct" ? "Correction…" : "Corriger"}
              </button>
            )}
          </form>
        </section>
      )}

      {result && (
        <section
          aria-live="polite"
          className={`flex flex-col gap-3 rounded-xl border p-4 ${
            result.isCorrect
              ? "border-green-600/40 bg-green-50 dark:bg-green-950/30"
              : "border-amber-600/40 bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          <p className="text-lg font-semibold">
            {result.score}/10 · {result.isCorrect ? "Correct !" : "Presque…"}
          </p>
          {!result.isCorrect && (
            <p lang="en-US" className="text-lg">
              {result.correction}
            </p>
          )}
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {result.explanation}
          </p>
        </section>
      )}

      {error && <p className="text-red-600">{error}</p>}

      {(!exercise || result) && (
        <button
          type="button"
          ref={nextRef}
          onClick={generate}
          disabled={loading !== null}
          className="self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
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
