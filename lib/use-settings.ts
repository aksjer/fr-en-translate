"use client";

import { useCallback, useSyncExternalStore } from "react";
import { fromLegacy } from "@/lib/legacy-storage";
import { settingsSchema, type Settings } from "@/lib/settings";

const STORAGE_KEY = "fr-en-translate:settings";
const EMPTY: Settings = {
  modes: [],
  levels: [],
  tenses: [],
  verbTypes: [],
  themes: [],
};

const listeners = new Set<() => void>();

// Cache the parsed value so useSyncExternalStore gets a stable snapshot.
let cachedRaw: string | null = null;
let cachedValue: Settings = EMPTY;

function read(): Settings {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, disabled cookies): fall back to defaults.
  }
  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  try {
    const saved: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    // Settings saved in French by the first version are read in English.
    const migrated = Object.fromEntries(
      Object.entries(saved ?? {}).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(fromLegacy) : value,
      ]),
    );
    const parsed = settingsSchema.safeParse(migrated);
    cachedValue = parsed.success ? { ...EMPTY, ...parsed.data } : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
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

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, read, () => EMPTY);

  const setSettings = useCallback((next: Settings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not saved, but the in-memory cache below still updates the UI.
      cachedRaw = JSON.stringify(next);
      cachedValue = next;
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [settings, setSettings] as const;
}
