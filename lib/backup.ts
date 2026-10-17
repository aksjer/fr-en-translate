// A backup of everything this app keeps in the browser (history, known words,
// settings, folded panels), as a JSON file the learner downloads and loads on
// another device or browser. Importing replaces what is there.

const APP = "fr-en-translate";
const PREFIX = `${APP}:`;
const VERSION = 1;

type Backup = {
  app: typeof APP;
  version: number;
  exportedAt: string;
  // Each stored value, parsed, by its key without the prefix.
  data: Record<string, unknown>;
};

function storedKeys() {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

function parse(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export function downloadBackup() {
  const data: Record<string, unknown> = {};
  for (const key of storedKeys()) {
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key.slice(PREFIX.length)] = parse(raw);
  }
  const backup: Backup = {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${APP}-${backup.exportedAt.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// The backup's data, or null if the file isn't a backup of this app.
export function readBackup(text: string): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { app, version, data } = parsed as Partial<Backup>;
  if (app !== APP || typeof version !== "number" || version > VERSION) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if ("seen" in data && !Array.isArray(data.seen)) return null;
  for (const key of ["known", "settings"]) {
    const value = data[key];
    if (key in data && (!value || typeof value !== "object" || Array.isArray(value))) return null;
  }
  return data;
}

// Replaces everything this app stored in the browser with the backup's data.
export function restoreBackup(data: Record<string, unknown>) {
  for (const key of storedKeys()) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  }
}
