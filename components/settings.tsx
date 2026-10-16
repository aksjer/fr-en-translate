"use client";

import { SettingsPanel } from "@/components/settings-panel";
import { useSettings } from "@/lib/use-settings";

// The settings: changes are saved in this browser as they are made, and apply
// to the next exercise.
export function Settings() {
  const [settings, setSettings] = useSettings();
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <SettingsPanel settings={settings} onChange={setSettings} />
    </section>
  );
}
