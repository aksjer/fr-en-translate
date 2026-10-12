"use client";

import { useCallback, useSyncExternalStore } from "react";
import { settingsSchema, type Settings } from "@/lib/settings";

const STORAGE_KEY = "fr-en-translate:settings";
const EMPTY: Settings = { levels: [], tenses: [], themes: [] };

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
    const parsed = settingsSchema.safeParse(raw ? JSON.parse(raw) : {});
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
