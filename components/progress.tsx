"use client";

import { useSyncExternalStore } from "react";
import {
  historyVersion,
  readKnown,
  readSeen,
  subscribeHistory,
} from "@/lib/seen-items";

const LEARNED_MODES = ["word", "verb"] as const;
const LEARNED_TITLES = { word: "Words", verb: "Verbs" };
const RECENT = 30;

// Everything comes from this browser: nothing is sent anywhere.
export function Progress() {
  // The server has no browser storage: the history is only read in the browser,
  // again after each answer saved.
  const inBrowser =
    useSyncExternalStore(subscribeHistory, historyVersion, () => -1) >= 0;
  const seen = inBrowser ? readSeen() : [];
  const known = inBrowser ? readKnown() : {};

  if (!inBrowser) return null;
  const answered = seen.filter((item) => item.ok !== undefined);
  const learned = LEARNED_MODES.some((mode) => known[mode]?.length);
  if (!answered.length && !learned) {
    return <p className="text-zinc-500">No answers yet.</p>;
  }

  const recent = answered.slice(-RECENT).reverse();

  const card =
    "flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className="font-medium">Learned</h2>
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
                <p className="text-sm text-zinc-400">None yet.</p>
              )}
            </div>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className={card}>
          <h2 className="font-medium">Recent answers</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {recent.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className={item.ok ? "text-green-600" : "text-red-600"}>
                  {item.ok ? "✓" : "✗"}
                </span>
                <span>
                  {item.text}
                  {item.english && (
                    <span className="text-zinc-500"> → {item.english}</span>
                  )}
                  {!item.ok && item.remark && (
                    <span className="block text-zinc-500">{item.remark}</span>
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
