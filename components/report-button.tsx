"use client";

import { useState } from "react";
import { rememberReport, type Report } from "@/lib/reports";

const button =
  "rounded-full border border-zinc-300 px-3 py-1 text-sm transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500";

// A note on what went wrong with this exercise, saved with its context.
export function ReportButton({ context }: { context: Omit<Report, "at" | "note"> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);

  function save() {
    if (!note.trim()) return;
    const saved = rememberReport({ ...context, note: note.trim().slice(0, 2000) });
    setStatus(saved ? "saved" : "failed");
    if (saved) {
      setNote("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 text-sm text-zinc-500">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setStatus(null);
          }}
          className="underline-offset-4 hover:underline"
        >
          Report a problem
        </button>
        {status === "saved" && <span>Saved. It&apos;s in your next export.</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        autoFocus
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="What's wrong with this exercise or its correction?"
        className="rounded-xl border border-zinc-300 bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-zinc-700"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={!note.trim()} className={button}>
          Save report
        </button>
        <button type="button" onClick={() => setOpen(false)} className={button}>
          Cancel
        </button>
        {status === "failed" && (
          <span className="text-sm text-red-600 dark:text-red-400">
            The report couldn&apos;t be saved in this browser.
          </span>
        )}
      </div>
    </div>
  );
}
