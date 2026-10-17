"use client";

import { useId, useState, type ReactNode } from "react";
import { useFolded } from "@/lib/use-folded";

type Props = {
  title: string;
  // Shown at the end of the title row on a wide screen.
  action?: ReactNode;
  // Where the panel sits in the side column: 0 for the first, 1 for the second.
  stack?: 0 | 1;
  children: ReactNode;
};

// On a wide screen, a panel's title row sticks to the top of the column as it
// scrolls, under the titles of the panels above it, so every title stays in
// reach. Panels have no frame there: a line beside the column and a line over
// every title but the first are enough. The section lays its parts straight
// into the column for that, and its spacing is rebuilt with padding and
// margins. The first title row is 40px tall, the second 53px.
const STACK = [
  { title: "lg:top-0", frame: "" },
  {
    title:
      "lg:top-10 lg:mt-3 lg:border-t lg:border-zinc-200 lg:pt-3 lg:dark:border-zinc-800",
    frame: "lg:scroll-mt-[93px]",
  },
];

// One panel of the side column: a title over its content. On a phone it is
// closed until opened, so the exercise stays first; on a wide screen it folds
// up to its title.
export function Panel({ title, action, stack = 0, children }: Props) {
  // Phone: whether the section is open. Wide screen: whether it is folded.
  const [open, setOpen] = useState(false);
  const [folded, setFolded] = useFolded(title);
  const contentId = useId();

  return (
    <section className="flex flex-col gap-3 lg:contents">
      <div
        className={`hidden items-center gap-2 lg:sticky lg:z-10 lg:flex lg:bg-background lg:pb-3 ${STACK[stack].title}`}
      >
        <button
          type="button"
          aria-expanded={!folded}
          aria-controls={contentId}
          onClick={(event) => {
            const column = event.currentTarget.closest("[data-side-column]");
            setFolded(!folded);
            // The browser would keep the part of the column being read in
            // place, so the change seemed to do nothing. Show the panel's
            // start instead, once the page has redrawn.
            requestAnimationFrame(() => {
              if (stack === 0) column?.scrollTo({ top: 0 });
              else if (folded) {
                document.getElementById(contentId)?.scrollIntoView();
              }
            });
          }}
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
      <div
        id={contentId}
        className={`rounded-2xl border border-zinc-200 bg-white p-6 lg:mb-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 dark:border-zinc-800 dark:bg-zinc-950 lg:dark:bg-transparent ${
          STACK[stack].frame
        } ${open ? "" : "hidden"} ${folded ? "lg:hidden" : open ? "" : "lg:block"}`}
      >
        {children}
      </div>
    </section>
  );
}
