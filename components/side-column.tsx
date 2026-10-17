"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useFolded } from "@/lib/use-folded";

const ToggleContext = createContext<(() => void) | null>(null);

function SidebarIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="size-5"
    >
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2" />
      <path d="M7.75 3.75v12.5" />
    </svg>
  );
}

const iconButton =
  "rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";

// The button that hides the whole side column, placed in a panel's title row.
export function SideColumnToggle() {
  const toggle = useContext(ToggleContext);
  if (!toggle) return null;
  return (
    <button
      type="button"
      aria-label="Hide side column"
      title="Hide side column"
      onClick={toggle}
      className={iconButton}
    >
      <SidebarIcon />
    </button>
  );
}

// The left column on a wide screen: its panels scroll together, and the whole
// column can be hidden behind one small button so the exercise gets the room.
// On a phone it is just the panels under the exercise.
export function SideColumn({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useFolded("side-column");
  return (
    <ToggleContext.Provider value={() => setHidden(!hidden)}>
      <div
        className={`flex flex-col gap-8 lg:order-1 lg:min-h-0 lg:gap-6 ${
          hidden ? "lg:hidden" : "lg:w-80 lg:overflow-y-auto"
        }`}
      >
        {children}
      </div>
      {hidden && (
        <div className="hidden lg:order-1 lg:block">
          <button
            type="button"
            aria-label="Show side column"
            title="Show side column"
            onClick={() => setHidden(false)}
            className={iconButton}
          >
            <SidebarIcon />
          </button>
        </div>
      )}
    </ToggleContext.Provider>
  );
}
