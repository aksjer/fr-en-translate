"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";

type Props = {
  title: string;
  // A side panel: closed until opened on a phone, so the exercise stays first,
  // and on a wide screen it can be folded into a thin strip.
  collapsible?: boolean;
  // Which edge of the page the panel sits on, for the direction of the arrow.
  side?: "left" | "right";
  // The panel's width on a wide screen while it is open.
  width?: string;
  children: ReactNode;
};

const storageKey = (title: string) => `fr-en-translate:panel-collapsed:${title}`;

const listeners = new Set<() => void>();
// Used when storage is blocked, so folding still works until a reload.
const memory = new Map<string, boolean>();

function readCollapsed(title: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(title));
    if (raw !== null) return raw === "1";
  } catch {
    // Storage blocked: fall back to memory.
  }
  return memory.get(title) ?? false;
}

function writeCollapsed(title: string, collapsed: boolean) {
  memory.set(title, collapsed);
  try {
    localStorage.setItem(storageKey(title), collapsed ? "1" : "0");
  } catch {
    // Not remembered after a reload, but the panel still folds.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function Chevron({ pointsLeft }: { pointsLeft: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`size-5 ${pointsLeft ? "" : "rotate-180"}`}
    >
      <path
        fillRule="evenodd"
        d="M12.8 4.2a.75.75 0 0 1 0 1.06L8.06 10l4.74 4.74a.75.75 0 1 1-1.06 1.06l-5.27-5.27a.75.75 0 0 1 0-1.06l5.27-5.27a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// One column of the page: a title over a frame. On a wide screen the title and
// the frame stay in place and only the frame's content scrolls.
export function Panel({
  title,
  collapsible = false,
  side = "left",
  width = "",
  children,
}: Props) {
  // Phone: whether the section is open. Wide screen: whether it is folded.
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(
    subscribe,
    () => readCollapsed(title),
    () => false,
  );
  const contentId = useId();

  function toggleCollapsed() {
    writeCollapsed(title, !collapsed);
  }

  const folded = collapsible && collapsed;
  const hiddenOnPhone = collapsible && !open;
  // Folding points toward the page edge, unfolding toward the exercise.
  const foldPointsLeft = side === "left";

  return (
    <section
      className={`flex flex-col gap-3 lg:min-h-0 ${folded ? "lg:h-full" : width}`}
    >
      <div
        className={`items-center justify-between gap-2 ${
          collapsible ? `hidden ${folded ? "" : "lg:flex"}` : "flex"
        }`}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {collapsible && (
          <button
            type="button"
            aria-expanded
            aria-controls={contentId}
            aria-label={`Collapse ${title}`}
            title={`Collapse ${title}`}
            onClick={toggleCollapsed}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <Chevron pointsLeft={foldPointsLeft} />
          </button>
        )}
      </div>
      {folded && (
        <button
          type="button"
          aria-expanded={false}
          aria-controls={contentId}
          aria-label={`Expand ${title}`}
          title={`Expand ${title}`}
          onClick={toggleCollapsed}
          className="hidden w-12 flex-1 flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white py-4 text-zinc-500 hover:text-zinc-900 lg:flex dark:border-zinc-800 dark:bg-zinc-950 dark:hover:text-zinc-100"
        >
          <Chevron pointsLeft={!foldPointsLeft} />
          <span className="text-lg font-semibold [writing-mode:vertical-rl]">
            {title}
          </span>
        </button>
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
        className={`rounded-2xl border border-zinc-200 bg-white p-6 lg:min-h-0 lg:overflow-y-auto dark:border-zinc-800 dark:bg-zinc-950 ${
          hiddenOnPhone ? "hidden" : ""
        } ${folded ? "lg:hidden" : hiddenOnPhone ? "lg:block" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}
