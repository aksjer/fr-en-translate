"use client";

import { useCallback, useSyncExternalStore } from "react";

// Whether a part of the page is folded on a wide screen, remembered by the
// browser so it stays the same after a reload.

const storageKey = (name: string) => `fr-en-translate:folded:${name}`;

const listeners = new Set<() => void>();
// Used when storage is blocked, so folding still works until a reload.
const memory = new Map<string, boolean>();

function read(name: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (raw !== null) return raw === "1";
  } catch {
    // Storage blocked: fall back to memory.
  }
  return memory.get(name) ?? false;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keeps several open tabs in sync.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useFolded(name: string) {
  const folded = useSyncExternalStore(
    subscribe,
    () => read(name),
    () => false,
  );

  const setFolded = useCallback(
    (next: boolean) => {
      memory.set(name, next);
      try {
        localStorage.setItem(storageKey(name), next ? "1" : "0");
      } catch {
        // Not remembered after a reload, but the page still folds.
      }
      listeners.forEach((listener) => listener());
    },
    [name],
  );

  return [folded, setFolded] as const;
}
