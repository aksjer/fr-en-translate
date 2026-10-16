"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

// A side column on a wide screen; on a phone, a section under the exercise
// that opens on demand, so the exercise stays first.
export function SidePanel({ title, children }: Props) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="hidden text-lg font-semibold lg:block">{title}</h2>
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
      <div id={contentId} className={open ? "" : "hidden lg:block"}>
        {children}
      </div>
    </section>
  );
}
