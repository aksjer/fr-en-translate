"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  // On a phone, a side panel is closed until opened, so the exercise stays first.
  collapsible?: boolean;
  children: ReactNode;
};

// One column of the page: a title over a frame. On a wide screen the title and
// the frame stay in place and only the frame's content scrolls.
export function Panel({ title, collapsible = false, children }: Props) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <section className="flex flex-col gap-3 lg:min-h-0">
      <h2
        className={`text-lg font-semibold ${collapsible ? "hidden lg:block" : ""}`}
      >
        {title}
      </h2>
      {collapsible && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left text-lg font-semibold lg:hidden dark:border-zinc-800"
        >
          {title}
          <span aria-hidden className="text-zinc-500">
            {open ? "−" : "+"}
          </span>
        </button>
      )}
      <div
        id={contentId}
        className={`rounded-2xl border border-zinc-200 bg-white p-6 lg:min-h-0 lg:overflow-y-auto dark:border-zinc-800 dark:bg-zinc-950 ${
          collapsible && !open ? "hidden lg:block" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}
