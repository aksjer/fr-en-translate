"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { SettingsPanel } from "@/components/settings-panel";
import { downloadBackup, readBackup, restoreBackup } from "@/lib/backup";
import { useSettings } from "@/lib/use-settings";

// The settings: changes are saved in this browser as they are made, and apply
// to the next exercise.
export function Settings() {
  const [settings, setSettings] = useSettings();
  return (
    <div className="flex flex-col gap-5">
      <SettingsPanel settings={settings} onChange={setSettings} />
      <Backup />
    </div>
  );
}

const button =
  "rounded-full border border-zinc-300 px-3 py-1 text-sm transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500";

// Export and import of the progress and settings, to move them to another
// device or browser.
function Backup() {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    const data = readBackup(await file.text());
    if (!data) {
      setError("This isn't a valid backup file.");
      return;
    }
    if (!window.confirm("This replaces your progress and settings on this device.")) return;
    try {
      restoreBackup(data);
    } catch {
      setError("The backup couldn't be saved in this browser.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
      <p className="mb-2 text-sm font-medium">Backup</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadBackup} className={button}>
          Export
        </button>
        <button type="button" onClick={() => input.current?.click()} className={button}>
          Import
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          onChange={importFile}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
