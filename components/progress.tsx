"use client";

import { useSyncExternalStore } from "react";
import {
  historyVersion,
  masteredPoints,
  readKnown,
  readPoints,
  readSeen,
  subscribeHistory,
} from "@/lib/seen-items";
import { englishKey } from "@/lib/options";

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
  const points = inBrowser ? masteredPoints(readPoints()) : [];

  if (!inBrowser) return null;
  const answered = seen.filter((item) => item.ok !== undefined);
  const learned = LEARNED_MODES.some((mode) => known[mode]?.length) || points.length > 0;
  if (!answered.length && !learned) {
    return <p className="text-zinc-500">No answers yet.</p>;
  }

  const recent = answered.slice(-RECENT).reverse();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="font-medium">Learned</h3>
        {LEARNED_MODES.map((mode) => {
          const items = known[mode] ?? [];
          return (
            <div key={mode} className="flex flex-col gap-1">
              <h4 className="text-sm text-zinc-500">
                {LEARNED_TITLES[mode]} ({items.length})
              </h4>
              {items.length > 0 ? (
                <p className="text-sm">{[...items].reverse().join(", ")}</p>
              ) : (
                <p className="text-sm text-zinc-400">None yet.</p>
              )}
            </div>
          );
        })}
        {/* Grammar points of sentences, right twice on different days. */}
        <div className="flex flex-col gap-1">
          <h4 className="text-sm text-zinc-500">Points ({points.length})</h4>
          {points.length > 0 ? (
            <p className="text-sm">{[...points].reverse().join(", ")}</p>
          ) : (
            <p className="text-sm text-zinc-400">None yet.</p>
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Recent answers</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {recent.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className={item.ok ? "text-green-600" : "text-red-600"}>
                  {item.ok ? "✓" : "✗"}
                </span>
                <span>
                  {item.text}
                  {item.english &&
                    (item.answer && englishKey(item.answer) !== item.english ? (
                      <span className="text-zinc-500">
                        {" "}→ {item.answer} ({item.english})
                      </span>
                    ) : (
                      <span className="text-zinc-500"> → {item.english}</span>
                    ))}
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
