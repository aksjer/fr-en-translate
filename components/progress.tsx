"use client";

import { useSyncExternalStore } from "react";
import { getServerStatsSnapshot, getStatsSnapshot, subscribeStats } from "@/lib/mistakes";
import { MODES } from "@/lib/options";
import { readKnown, readSeen } from "@/lib/seen-items";

const LEARNED_MODES = ["mot", "verbe", "phrasal verb"] as const;
const LEARNED_TITLES = { mot: "Mots", verbe: "Verbes", "phrasal verb": "Phrasal verbs" };
const RECENT = 30;

const percent = (part: number, total: number) => `${Math.round((part / total) * 100)} %`;

const noSubscribe = () => () => {};

// Everything comes from this browser: nothing is sent anywhere.
export function Progress() {
  const stats = useSyncExternalStore(subscribeStats, getStatsSnapshot, getServerStatsSnapshot);
  // The server has no browser storage: render the history once in the browser.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const seen = inBrowser ? readSeen() : [];
  const known = inBrowser ? readKnown() : {};

  if (!inBrowser) return null;
  if (stats.answered === 0 && !seen.some((item) => item.ok !== undefined)) {
    return <p className="text-zinc-500">Aucune réponse pour l&apos;instant.</p>;
  }

  const answered = seen.filter((item) => item.ok !== undefined);
  const byMode = MODES.map((mode) => {
    const items = answered.filter((item) => item.mode === mode);
    return { mode, total: items.length, right: items.filter((item) => item.ok).length };
  }).filter(({ total }) => total > 0);
  const errors = Object.entries(stats.byTag).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
  const recent = answered.slice(-RECENT).reverse();

  const card =
    "flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className="font-medium">Réponses</h2>
        <p>
          {stats.answered} réponses · {stats.answered ? percent(stats.correct, stats.answered) : "0 %"}{" "}
          justes
        </p>
        {byMode.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {byMode.map(({ mode, total, right }) => (
              <li key={mode}>
                {mode} : {right}/{total} ({percent(right, total)})
              </li>
            ))}
          </ul>
        )}
      </section>

      {errors.length > 0 && (
        <section className={card}>
          <h2 className="font-medium">Erreurs fréquentes</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {errors.map(([tag, count]) => (
              <li key={tag} className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">
                {tag} · {count}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="font-medium">Appris</h2>
        {LEARNED_MODES.map((mode) => {
          const items = known[mode] ?? [];
          return (
            <div key={mode} className="flex flex-col gap-1">
              <h3 className="text-sm text-zinc-500">
                {LEARNED_TITLES[mode]} ({items.length})
              </h3>
              {items.length > 0 ? (
                <p className="text-sm">{[...items].reverse().join(", ")}</p>
              ) : (
                <p className="text-sm text-zinc-400">Aucun pour l&apos;instant.</p>
              )}
            </div>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className={card}>
          <h2 className="font-medium">Dernières réponses</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {recent.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className={item.ok ? "text-green-600" : "text-red-600"}>
                  {item.ok ? "✓" : "✗"}
                </span>
                <span>
                  {item.text}
                  {item.english && <span className="text-zinc-500"> → {item.english}</span>}
                  {!item.ok && item.remark && (
                    <span className="block text-zinc-500">
                      {item.tag && `${item.tag} : `}
                      {item.remark}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
