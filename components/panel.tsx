"use client";

import { useId, useState, type ReactNode } from "react";
import { useFolded } from "@/lib/use-folded";

type Props = {
  title: string;
  // A side panel: closed until opened on a phone, so the exercise stays first,
  // and on a wide screen it folds up to its title.
  collapsible?: boolean;
  // Shown at the end of the title row on a wide screen.
  action?: ReactNode;
  // On a wide screen, the title row stays at the top of the side column while
  // it scrolls. The section then lays its parts straight into the column, so
  // its own spacing is rebuilt with padding and margins.
  pinned?: boolean;
  children: ReactNode;
};

// One block of the page: a title over a frame. On a wide screen the exercise's
// frame scrolls on its own; side panels scroll with their column.
export function Panel({
  title,
  collapsible = false,
  action,
  pinned = false,
  children,
}: Props) {
  // Phone: whether the section is open. Wide screen: whether it is folded.
  const [open, setOpen] = useState(false);
  const [storedFolded, setFolded] = useFolded(title);
  const folded = collapsible && storedFolded;
  const hiddenOnPhone = collapsible && !open;
  const contentId = useId();

  return (
    <section
      className={`flex flex-col gap-3 ${
        !collapsible ? "lg:min-h-0" : pinned ? "lg:contents" : "lg:mt-3"
      }`}
    >
      {collapsible ? (
        <div
          className={`hidden items-center gap-2 lg:flex ${
            pinned ? "lg:sticky lg:top-0 lg:z-10 lg:bg-background lg:pb-3" : ""
          }`}
        >
          <button
            type="button"
            aria-expanded={!folded}
            aria-controls={contentId}
            onClick={() => setFolded(!folded)}
            className="flex flex-1 items-center gap-1.5 text-left text-lg font-semibold"
          >
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`size-5 text-zinc-500 transition-transform ${folded ? "" : "rotate-90"}`}
            >
              <path
                fillRule="evenodd"
                d="M7.2 4.2a.75.75 0 0 1 1.06 0l5.27 5.27a.75.75 0 0 1 0 1.06l-5.27 5.27a.75.75 0 1 1-1.06-1.06L11.94 10 7.2 5.26a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
            {title}
          </button>
          {action}
        </div>
      ) : (
        <h2 className="text-lg font-semibold">{title}</h2>
      )}
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
        className={`rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 ${
          !collapsible ? "lg:min-h-0 lg:overflow-y-auto" : pinned ? "lg:mb-3" : ""
        } ${hiddenOnPhone ? "hidden" : ""} ${
          folded ? "lg:hidden" : hiddenOnPhone ? "lg:block" : ""
        }`}
      >
        {children}
      </div>
    </section>
  );
}
